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
  if (env.LEADS) {
    try {
      await env.LEADS.put(`agent_apply:${submittedAt}:${crypto.randomUUID()}`, JSON.stringify(summary), {
        expirationTtl: 90 * 24 * 60 * 60
      });
      captured = true;
    } catch (error) {
      console.error('Agent apply KV write failed', error);
    }
  } else {
    console.error('Agent apply: no LEADS binding — nothing was stored');
  }

  /*
   * No mail is sent from here.
   *
   * This posted to api.mailchannels.net, which stopped serving Cloudflare
   * Workers for free in mid-2024. Every call since has failed into a catch that
   * logged and carried on, so the endpoint has been storing applications and
   * sending nothing while reporting success. Dead code shaped like a delivery
   * path is worse than no delivery path — it is why nobody noticed.
   *
   * Server-side mail is WP-2b, via Resend, once a sending domain is verified.
   * Until then KV is the only record and /api/leads-export is how it is read.
   */

  if (!captured) {
    return new Response(JSON.stringify({ ok: false, error: 'not_captured' }), { status: 500, headers });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
