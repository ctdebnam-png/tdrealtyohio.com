/**
 * POST /api/lead — First-party lead capture endpoint
 * Stores leads in Cloudflare KV (LEADS namespace) and forwards to Formspree.
 */

const ALLOWED_ORIGINS = [
  'https://tdrealtyohio.com',
  'https://www.tdrealtyohio.com',
  'http://localhost:8788',
  'http://localhost:3000',
  'http://127.0.0.1:8788',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limiter (per-isolate, resets on cold start)
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per IP per window

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimiter.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ status: 'ok', method: 'POST required' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' },
  });
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
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };

  // Rate limit by IP
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers,
    });
  }

  // Validate required fields — require email OR phone (phone-only for tool text actions)
  const PHONE_RE = /^\+?[\d\s().-]{10,}$/;
  const hasEmail = body.email && EMAIL_RE.test(body.email);
  const hasPhone = body.phone && PHONE_RE.test(body.phone);

  if (!hasEmail && !hasPhone) {
    return new Response(JSON.stringify({ error: 'Valid email or phone is required' }), {
      status: 400,
      headers,
    });
  }
  if (body.consent_to_contact !== true) {
    return new Response(JSON.stringify({ error: 'Consent to contact is required' }), {
      status: 400,
      headers,
    });
  }

  // Build the lead record
  const leadId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const lead = {
    lead_id: leadId,
    created_at: createdAt,
    source: 'website',

    // Page context
    page_path: body.page_path || '',
    page_title: body.page_title || '',
    referrer: body.referrer || '',
    user_agent: request.headers.get('User-Agent') || '',
    ip_geo: (request.cf?.region || '') + (request.cf?.country ? ', ' + request.cf.country : ''),

    // UTM / click IDs
    utm_source: body.utm_source || '',
    utm_medium: body.utm_medium || '',
    utm_campaign: body.utm_campaign || '',
    utm_content: body.utm_content || '',
    utm_term: body.utm_term || '',
    gclid: body.gclid || '',
    msclkid: body.msclkid || '',

    // Contact info
    name: body.name || '',
    email: body.email || '',
    phone: body.phone || '',
    preferred_contact_method: body.preferred_contact_method || '',

    // Intent
    intent_type: body.intent_type || '',
    intent_strength: body.intent_strength || 'medium',
    target_area: body.target_area || '',
    timeframe: body.timeframe || '',

    // Event
    event_name: body.event_name || '',
    event_value: body.event_value || null,

    // Consent
    consent_to_contact: true,
    consent_text_version: body.consent_text_version || '2025-01-28',
    privacy_ack: body.privacy_ack || false,

    // Form-specific extra fields (address, referred_by, experience, message, etc.)
    extra: body.extra || {},
  };

  // Store in KV with 90-day TTL
  const kvKey = `lead:${createdAt}:${leadId}`;
  let kvStatus = 'skipped';
  try {
    if (env.LEADS) {
      await env.LEADS.put(kvKey, JSON.stringify(lead), {
        expirationTtl: 90 * 24 * 60 * 60, // 90 days in seconds
      });
      kvStatus = 'ok';
    } else {
      kvStatus = 'no_binding';
    }
  } catch (err) {
    kvStatus = 'error: ' + (err.message || String(err));
    console.error('KV write failed:', err);
  }

  /*
   * The response says whether the lead was actually captured.
   *
   * This used to compute kvStatus — 'ok', 'no_binding' or 'error: ...' — and
   * then return 200 {ok:true} regardless, throwing the answer away. The browser
   * decides what to tell the visitor from this response, so a failed KV write
   * still printed "Your message has been sent" over a lead that was never
   * stored. Removing the dual-submit in the form fixed the browser half of that
   * bug and left this half in place, which made the fix look complete while the
   * same lie survived one layer down.
   *
   * KV is the only store. If the write did not happen, the message is gone, and
   * a 5xx is the truthful answer — the form then shows the failure and offers
   * the phone and email instead.
   */
  if (kvStatus !== 'ok') {
    console.error(`Lead capture failed (${kvStatus}) for ${leadId}`);
    return new Response(
      JSON.stringify({ ok: false, error: 'not_captured', detail: kvStatus }),
      { status: 500, headers },
    );
  }

  return new Response(JSON.stringify({ ok: true, lead_id: leadId }), {
    status: 200,
    headers,
  });
}
