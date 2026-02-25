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

  if (env.LEADS) {
    try {
      await env.LEADS.put(`agent_apply:${submittedAt}:${crypto.randomUUID()}`, JSON.stringify(summary), {
        expirationTtl: 90 * 24 * 60 * 60
      });
    } catch (error) {
      console.error('Agent apply KV write failed', error);
    }
  }

  const mailPayload = {
    personalizations: [{ to: [{ email: 'info@tdrealtyohio.com' }] }],
    from: {
      email: 'noreply@tdrealtyohio.com',
      name: 'TD Realty Ohio Website'
    },
    subject: 'New agent recruiting pre-screen submission',
    content: [
      {
        type: 'text/plain',
        value:
          `New agent recruiting pre-screen submission\n\n` +
          `Production level: ${summary.production_level}\n` +
          `Primary business mix: ${summary.business_mix}\n` +
          `Own CRM and marketing system: ${summary.has_crm_marketing}\n\n` +
          `Page: ${summary.page_path}\n` +
          `Submitted at: ${summary.submitted_at}\n` +
          `IP: ${summary.ip}\n` +
          `User-Agent: ${summary.user_agent}`
      }
    ]
  };

  try {
    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mailPayload)
    });
  } catch (error) {
    console.error('Mail send failed', error);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
