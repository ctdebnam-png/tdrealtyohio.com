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

    const agent = await import(pathToFileURL(join(ROOT, 'functions/api/agent-apply.js')).href);
    console.log('\n  /api/agent-apply');
    await assertStatus('KV write succeeds', await agent.onRequestPost(context(APPLICATION, WORKING_KV)), 200);
    await assertStatus('KV write throws', await agent.onRequestPost(context(APPLICATION, THROWING_KV)), 500);
    await assertStatus('no LEADS binding', await agent.onRequestPost(context(APPLICATION, NO_BINDING)), 500);
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
  console.log('[api-capture] both endpoints report capture failures instead of claiming success.');
  return 0;
}

process.exit(await main());
