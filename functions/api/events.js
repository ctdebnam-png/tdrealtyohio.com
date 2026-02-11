/**
 * POST /api/events — Lightweight event tracking endpoint
 * Stores daily aggregate counts in Cloudflare KV (EVENTS namespace).
 * Events: cta_click, calculator_interact, form_start, form_submit
 */

const ALLOWED_ORIGINS = [
  'https://tdrealtyohio.com',
  'https://www.tdrealtyohio.com',
  'http://localhost:8788',
  'http://localhost:3000',
  'http://127.0.0.1:8788',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
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
    return new Response('', { status: 403 });
  }

  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const eventName = body.event || '';
  const pagePath = body.path || '/';
  const label = body.label || '';

  // Validate event name against known events
  const VALID_EVENTS = ['cta_click', 'calculator_interact', 'form_start', 'form_submit', 'phone_tap', 'call_click', 'email_click', 'calculator_submit'];
  if (!VALID_EVENTS.includes(eventName)) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  // Build daily aggregate key: events:YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10);
  const kvKey = `events:${today}`;

  try {
    if (env.EVENTS) {
      // Read existing daily aggregate
      const existing = await env.EVENTS.get(kvKey, 'json') || {};
      const pageKey = pagePath || '/';

      if (!existing[pageKey]) existing[pageKey] = {};
      if (!existing[pageKey][eventName]) existing[pageKey][eventName] = 0;
      existing[pageKey][eventName]++;

      // Track labels for CTA clicks (top 20)
      if (eventName === 'cta_click' && label) {
        if (!existing[pageKey].cta_labels) existing[pageKey].cta_labels = {};
        if (!existing[pageKey].cta_labels[label]) existing[pageKey].cta_labels[label] = 0;
        existing[pageKey].cta_labels[label]++;
      }

      // Store with 90-day TTL
      await env.EVENTS.put(kvKey, JSON.stringify(existing), {
        expirationTtl: 90 * 24 * 60 * 60,
      });
    }
  } catch (err) {
    console.error('Events KV write failed:', err);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
