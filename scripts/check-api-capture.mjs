#!/usr/bin/env node
/**
 * Capture-honesty check for the lead APIs.
 *
 * Both endpoints write to KV and nothing else. If the write does not happen,
 * the submission is gone — so the response must say so, because the browser
 * decides what to tell the visitor from it.
 *
 * This has now been wrong twice, in the same way, at two different layers:
 *
 *   1. assets/js/main.js posted to /api/lead AND to an empty form action, and
 *      reported success on either. Fixed by making /api/lead the only path.
 *   2. functions/api/lead.js computed kvStatus — 'ok', 'no_binding' or
 *      'error: ...' — and then returned 200 {ok:true} regardless. Fixing (1)
 *      made the form trust this response, which made the fix look complete
 *      while the same lie survived one layer down.
 *
 * So the gate calls the handlers directly with a fake env and asserts the
 * status. It does not need a server: the whole point is the branch taken when
 * KV is absent or throwing, and `wrangler pages dev` binds a working local KV
 * from wrangler.toml, so a live server can only ever exercise the happy path.
 * That is exactly why the bug survived local testing.
 *
 * Since WP-2b both endpoints also email a notice through Resend after the
 * write. The gate stubs fetch and holds three lines: a notice goes out only
 * after a write that happened, its subject names the interest and the person,
 * and a failed notice still answers 200, because the lead was captured.
 *
 * The honeypot case is asserted too, in the other direction: a submission that
 * trips it must still return 200, indistinguishable from success, or the
 * honeypot tells a bot it was caught.
 */

import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://tdrealtyohio.com';

let ip = 0;
const context = (body, env) => ({
  request: new Request('https://tdrealtyohio.com/api/x', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      // A fresh IP per call: both handlers rate-limit per IP.
      'CF-Connecting-IP': `203.0.113.${(ip = (ip + 1) % 250)}`,
    },
    body: JSON.stringify(body),
  }),
  env,
});

const WORKING_KV = { LEADS: { put: async () => {} } };
const THROWING_KV = { LEADS: { put: async () => { throw new Error('KV unavailable'); } } };
const NO_BINDING = {};

const LEAD = { name: 'Gate Check', email: 'gate@example.com', consent_to_contact: true, page_path: '/contact/' };
const APPLICATION = {
  production_level: 'growing', business_mix: 'listings', has_crm_marketing: 'yes',
  form_started_at: Date.now() - 6000, page_path: '/agents/',
};

const errors = [];

const RESEND = { RESEND_API_KEY: 're_test', NOTIFY_FROM: 'Leads <leads@example.com>' };
let sends = [];
let resendStatus = 200;
globalThis.fetch = async (url, init) => {
  sends.push({ url: String(url), body: JSON.parse(init.body) });
  return new Response('{}', { status: resendStatus });
};

function assert(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok ${label}`);
    return;
  }
  errors.push(`${label}${detail ? ': ' + detail : ''}`);
  console.log(`  X  ${label}`);
}

async function assertStatus(label, response, expected) {
  const actual = response.status;
  if (actual === expected) {
    console.log(`  ok ${label.padEnd(52)} ${actual}`);
    return;
  }
  const body = await response.clone().text().catch(() => '');
  errors.push(`${label}: expected ${expected}, got ${actual} ${body.slice(0, 90)}`);
  console.log(`  X  ${label.padEnd(52)} ${actual} (want ${expected})`);
}

async function main() {
  console.log('[api-capture] a submission is only reported captured if it was captured\n');

  // Handler logs are the point of the failure paths; keep them out of the report.
  const realError = console.error;
  console.error = () => {};
  try {
    const lead = await import(pathToFileURL(join(ROOT, 'functions/api/lead.js')).href);
    console.log('  /api/lead');
    await assertStatus('KV write succeeds', await lead.onRequestPost(context(LEAD, WORKING_KV)), 200);
    await assertStatus('KV write throws', await lead.onRequestPost(context(LEAD, THROWING_KV)), 500);
    await assertStatus('no LEADS binding', await lead.onRequestPost(context(LEAD, NO_BINDING)), 500);

    sends = [];
    await lead.onRequestPost(context(LEAD, { ...THROWING_KV, ...RESEND }));
    assert('no notice when the KV write throws', sends.length === 0);
    sends = [];
    const contactLead = { ...LEAD, phone: '614-555-0100', extra: { interest: 'selling', message: 'Line one\nLine two' } };
    const sentRes = await lead.onRequestPost(context(contactLead, { ...WORKING_KV, ...RESEND }));
    const sentBody = await sentRes.json();
    const notice = sends[0]?.body;
    assert('one notice to Resend after a stored lead', sends.length === 1 && sends[0].url === 'https://api.resend.com/emails');
    assert('notice goes to ctdebnam@gmail.com by default', notice?.to?.[0] === 'ctdebnam@gmail.com', JSON.stringify(notice?.to));
    assert("subject is 'New website lead: [interest] - [name]'", notice?.subject === 'New website lead: selling - Gate Check', notice?.subject);
    assert('body carries lead_id, page URL and every field',
      !!notice && [`lead_id: ${sentBody.lead_id}`, 'page_url: https://tdrealtyohio.com/contact/', 'email: gate@example.com',
        'phone: 614-555-0100', 'extra.interest: selling', 'extra.message:\n  Line one\n  Line two'].every((t) => notice.text.includes(t)));
    resendStatus = 500;
    await assertStatus('Resend fails, lead still reported captured', await lead.onRequestPost(context(LEAD, { ...WORKING_KV, ...RESEND })), 200);
    resendStatus = 200;

    const agent = await import(pathToFileURL(join(ROOT, 'functions/api/agent-apply.js')).href);
    console.log('\n  /api/agent-apply');
    await assertStatus('KV write succeeds', await agent.onRequestPost(context(APPLICATION, WORKING_KV)), 200);
    await assertStatus('KV write throws', await agent.onRequestPost(context(APPLICATION, THROWING_KV)), 500);
    await assertStatus('no LEADS binding', await agent.onRequestPost(context(APPLICATION, NO_BINDING)), 500);
    sends = [];
    await agent.onRequestPost(context(APPLICATION, { ...WORKING_KV, ...RESEND, NOTIFY_TO: 'other@example.com' }));
    assert('agent application sends one notice, NOTIFY_TO honored',
      sends.length === 1 && sends[0].body.to[0] === 'other@example.com' && sends[0].body.subject.startsWith('New website lead: agent application'));
    resendStatus = 500;
    await assertStatus('Resend fails, application still reported captured',
      await agent.onRequestPost(context({ ...APPLICATION, form_started_at: Date.now() - 6000 }, { ...WORKING_KV, ...RESEND })), 200);
    resendStatus = 200;
    await assertStatus(
      'honeypot still indistinguishable from success',
      await agent.onRequestPost(context({ ...APPLICATION, website: 'bot' }, NO_BINDING)),
      200,
    );
  } finally {
    console.error = realError;
  }

  console.log('');
  if (errors.length) {
    console.error(`[api-capture] FAILED — ${errors.length} problem(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    return 1;
  }
  console.log('[api-capture] both endpoints report capture failures instead of claiming success, and notify after a real write.');
  return 0;
}

process.exit(await main());
