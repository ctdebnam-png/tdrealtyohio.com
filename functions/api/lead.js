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

  // Validate required fields
  if (!body.email || !EMAIL_RE.test(body.email)) {
    return new Response(JSON.stringify({ error: 'Valid email is required' }), {
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
    email: body.email,
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
    calculator_type: body.calculator_type || null,
    calculator_inputs_summary: body.calculator_inputs_summary || null,

    // Consent
    consent_to_contact: true,
    consent_text_version: body.consent_text_version || '2025-01-28',
    privacy_ack: body.privacy_ack || false,

    // Form-specific extra fields (address, referred_by, experience, message, etc.)
    extra: body.extra || {},
  };

  // Store in KV with 90-day TTL
  const kvKey = `lead:${createdAt}:${leadId}`;
  try {
    if (env.LEADS) {
      await env.LEADS.put(kvKey, JSON.stringify(lead), {
        expirationTtl: 90 * 24 * 60 * 60, // 90 days in seconds
      });
    }
  } catch (err) {
    // Log but don't fail the request — Formspree is the fallback
    console.error('KV write failed:', err);
  }

  // Forward to Formspree as fallback/parallel delivery
  try {
    const formspreeBody = new URLSearchParams();
    formspreeBody.append('name', lead.name);
    formspreeBody.append('email', lead.email);
    formspreeBody.append('phone', lead.phone);
    formspreeBody.append('event_name', lead.event_name);
    formspreeBody.append('intent_type', lead.intent_type);
    formspreeBody.append('page_path', lead.page_path);
    formspreeBody.append('lead_id', lead.lead_id);
    if (lead.extra.message) formspreeBody.append('message', lead.extra.message);
    if (lead.extra.property_address) formspreeBody.append('property_address', lead.extra.property_address);
    if (lead.extra.referred_by) formspreeBody.append('referred_by', lead.extra.referred_by);
    if (lead.extra.experience) formspreeBody.append('experience', lead.extra.experience);
    if (lead.extra.interest) formspreeBody.append('interest', lead.extra.interest);
    if (lead.extra.home_details) formspreeBody.append('home_details', lead.extra.home_details);
    if (lead.extra.transaction_type) formspreeBody.append('transaction_type', lead.extra.transaction_type);
    if (lead.utm_source) formspreeBody.append('utm_source', lead.utm_source);

    await fetch('https://formspree.io/f/mykkypyd', {
      method: 'POST',
      body: formspreeBody,
      headers: { 'Accept': 'application/json' },
    });
  } catch (err) {
    console.error('Formspree forward failed:', err);
  }

  return new Response(JSON.stringify({ ok: true, lead_id: leadId }), {
    status: 200,
    headers,
  });
}
