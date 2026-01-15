// Request Router

import type { Env, RecordOutcomeRequest, BulkOutcomeRequest, WinRatesQuery, MissingOutcomeFilter } from './types';
import { authenticate } from './middleware/auth';
import { resolveTenant, createRequestContext } from './middleware/tenant';
import { recordOutcome, recordBulkOutcomes, getLeadOutcomes } from './handlers/outcomes';
import { getWinRatesBySource, getWinRatesByGeo, exportToCSV } from './handlers/win-rates';
import { getLead, getLeadsMissingOutcomes } from './handlers/leads';

/**
 * Routes incoming requests
 */
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === '/health') {
    return jsonResponse({ status: 'ok', service: 'td-realty-outcome-tracker' });
  }

  // API routes: /api/t/:slug/...
  if (path.startsWith('/api/t/')) {
    return handleAPIRequest(request, env, path);
  }

  // Admin UI routes: /t/:slug/admin/...
  if (path.startsWith('/t/') && path.includes('/admin')) {
    return handleAdminUIRequest(request, env, path);
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Handles API requests (JSON endpoints)
 */
async function handleAPIRequest(request: Request, env: Env, path: string): Promise<Response> {
  // Authenticate
  const auth = await authenticate(request, env);
  if (!auth.authenticated) {
    return jsonResponse({ success: false, error: auth.error }, 401);
  }

  // Parse tenant slug from path: /api/t/:slug/...
  const pathParts = path.split('/');
  const tenantSlugIndex = pathParts.indexOf('t') + 1;
  if (tenantSlugIndex === 0 || tenantSlugIndex >= pathParts.length) {
    return jsonResponse({ success: false, error: 'Invalid path format' }, 400);
  }

  const tenantSlug = pathParts[tenantSlugIndex];
  const { tenant, error } = await resolveTenant(env, tenantSlug);
  if (!tenant) {
    return jsonResponse({ success: false, error }, 404);
  }

  const ctx = createRequestContext(tenant, auth.user_email);
  const method = request.method;

  // Route to handlers
  // POST /api/t/:slug/outcomes - Record single outcome
  if (path.match(/^\/api\/t\/[^/]+\/outcomes$/) && method === 'POST') {
    const body = await request.json<RecordOutcomeRequest>();
    const result = await recordOutcome(env, ctx, body);
    return jsonResponse(result, result.success ? 200 : 400);
  }

  // POST /api/t/:slug/outcomes/bulk - Record bulk outcomes
  if (path.match(/^\/api\/t\/[^/]+\/outcomes\/bulk$/) && method === 'POST') {
    const body = await request.json<BulkOutcomeRequest>();
    const result = await recordBulkOutcomes(env, ctx, body);
    return jsonResponse(result, result.success ? 200 : 400);
  }

  // GET /api/t/:slug/leads/:id/outcomes - Get outcome history
  if (path.match(/^\/api\/t\/[^/]+\/leads\/[^/]+\/outcomes$/) && method === 'GET') {
    const leadId = pathParts[pathParts.length - 2];
    const result = await getLeadOutcomes(env, ctx, leadId);
    return jsonResponse(result);
  }

  // GET /api/t/:slug/leads/:id - Get lead details
  if (path.match(/^\/api\/t\/[^/]+\/leads\/[^/]+$/) && method === 'GET') {
    const leadId = pathParts[pathParts.length - 1];
    const result = await getLead(env, ctx, leadId);
    return jsonResponse(result, result.success ? 200 : 404);
  }

  // GET /api/t/:slug/win-rates/by-source - Win rates by source
  if (path.match(/^\/api\/t\/[^/]+\/win-rates\/by-source$/) && method === 'GET') {
    const query = parseQueryParams<WinRatesQuery>(new URL(request.url).searchParams);
    const result = await getWinRatesBySource(env, ctx, query);
    return jsonResponse(result);
  }

  // GET /api/t/:slug/win-rates/by-geo - Win rates by geo
  if (path.match(/^\/api\/t\/[^/]+\/win-rates\/by-geo$/) && method === 'GET') {
    const query = parseQueryParams<WinRatesQuery>(new URL(request.url).searchParams);
    const result = await getWinRatesByGeo(env, ctx, query);
    return jsonResponse(result);
  }

  // GET /api/t/:slug/win-rates/export - Export CSV
  if (path.match(/^\/api\/t\/[^/]+\/win-rates\/export$/) && method === 'GET') {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') as 'source' | 'geo' || 'source';
    const query = parseQueryParams<WinRatesQuery>(url.searchParams);

    const result = type === 'source'
      ? await getWinRatesBySource(env, ctx, query)
      : await getWinRatesByGeo(env, ctx, query);

    if (!result.success) {
      return jsonResponse(result, 400);
    }

    const csv = exportToCSV(result.data!, type);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}_win_rates.csv"`,
      },
    });
  }

  // GET /api/t/:slug/outcomes/missing - Leads missing outcomes
  if (path.match(/^\/api\/t\/[^/]+\/outcomes\/missing$/) && method === 'GET') {
    const filter = parseQueryParams<MissingOutcomeFilter>(new URL(request.url).searchParams);
    const result = await getLeadsMissingOutcomes(env, ctx, filter);
    return jsonResponse(result);
  }

  return jsonResponse({ success: false, error: 'Endpoint not found' }, 404);
}

/**
 * Handles admin UI requests (serves HTML pages)
 */
async function handleAdminUIRequest(request: Request, env: Env, path: string): Promise<Response> {
  // In production, these would serve actual HTML files
  // For now, return simple placeholders

  if (path.includes('/admin/win-rates')) {
    return new Response('Win Rates Dashboard (HTML to be implemented)', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (path.includes('/admin/outcomes/missing')) {
    return new Response('Missing Outcomes Page (HTML to be implemented)', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (path.includes('/admin/outcomes/bulk')) {
    return new Response('Bulk Outcomes Page (HTML to be implemented)', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (path.match(/\/admin\/leads\/[^/]+$/)) {
    return new Response('Lead Detail Page (HTML to be implemented)', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (path.includes('/admin')) {
    return new Response('Admin Dashboard (HTML to be implemented)', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Helper: JSON response
 */
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Helper: Parse query params
 */
function parseQueryParams<T>(params: URLSearchParams): T {
  const obj: any = {};
  for (const [key, value] of params.entries()) {
    // Handle arrays (e.g., tier=A&tier=B)
    if (obj[key]) {
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      // Try to parse numbers
      if (!isNaN(Number(value))) {
        obj[key] = Number(value);
      } else {
        obj[key] = value;
      }
    }
  }
  return obj as T;
}
