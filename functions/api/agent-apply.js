import { noticeSubject, noticeText, sendNotice } from '../lib/notify.js';
import { verifyTurnstile } from '../lib/turnstile.js';

const ALLOWED_ORIGINS = [
  'https://tdrealtyohio.com',
  'https://www.tdrealtyohio.com',
  'http://localhost:8788',
  'http://localhost:3000',
  'http://127.0.0.1:8788'
];

const PRODUCTION_LEVELS = new Set(['new', 'growing', 'high']);
const BUSINESS_MIX = new Set(['listings', 'buyers']);
const YES_NO = new Set(['yes', 'no']);

const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimiter.get(ip);

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimiter.set(ip, { start: now, count: 1 });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  return new Response(null, { status: 403 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  if (body.website) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  const startedAt = Number(body.form_started_at || 0);
  if (!startedAt || Date.now() - startedAt < 3000) {
    return new Response(JSON.stringify({ error: 'Invalid submission timing' }), { status: 400, headers });
  }

  if (!PRODUCTION_LEVELS.has(body.production_level) || !BUSINESS_MIX.has(body.business_mix) || !YES_NO.has(body.has_crm_marketing)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid fields' }), { status: 400, headers });
  }

  // Spam check, before anything is stored or emailed (functions/lib/turnstile.js).
  if (await verifyTurnstile(env, body.turnstile_token, ip) === 'fail') {
    return new Response(JSON.stringify({ ok: false, error: 'spam_check_failed' }), { status: 403, headers });
  }

  const submittedAt = new Date().toISOString();
  const summary = {
    submitted_at: submittedAt,
    production_level: body.production_level,
    business_mix: body.business_mix,
    has_crm_marketing: body.has_crm_marketing,
    page_path: body.page_path || '',
    page_title: body.page_title || '',
    ip,
    user_agent: request.headers.get('User-Agent') || ''
  };

  /*
   * Capture, and remember whether it actually happened.
   *
   * This skipped the write entirely when the binding was absent and swallowed
   * any error, then returned {ok:true} either way — so an application could be
   * dropped and the applicant told it went through.
   */
  let captured = false;
  const kvKey = `agent_apply:${submittedAt}:${crypto.randomUUID()}`;
  if (env.LEADS) {
    try {
      await env.LEADS.put(kvKey, JSON.stringify(summary), {
        expirationTtl: 365 * 24 * 60 * 60
      });
      captured = true;
    } catch (error) {
      console.error('Agent apply KV write failed', error);
    }
  } else {
    console.error('Agent apply: no LEADS binding — nothing was stored');
  }

  if (!captured) {
    return new Response(JSON.stringify({ ok: false, error: 'not_captured' }), { status: 500, headers });
  }

  /*
   * Notify through Resend once the record is stored. This replaces the
   * MailChannels call removed in October 2026, which had failed silently since
   * mid-2024. A failed notice is logged and the applicant still gets ok,
   * because the application was captured.
   */
  const sent = await sendNotice(env, {
    subject: noticeSubject('agent application', body.name),
    text: noticeText('A new agent application came in through tdrealtyohio.com.', {
      page_url: summary.page_path ? new URL(summary.page_path, origin).href : '',
      record: kvKey,
      ...summary
    })
  });
  if (sent !== 'sent') console.error(`Agent apply notice not sent (${sent}); record ${kvKey}`);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
