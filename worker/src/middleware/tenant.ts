// Tenant Resolution Middleware

import type { Env, RequestContext, Tenant } from '../types';

/**
 * Resolves tenant from slug in URL path (/t/:slug/...)
 * Returns null if tenant not found or slug invalid
 */
export async function resolveTenant(
  env: Env,
  slug: string
): Promise<{ tenant: Tenant | null; error?: string }> {
  if (!slug || slug.length === 0) {
    return { tenant: null, error: 'Missing tenant slug' };
  }

  const tenant = await env.DB.prepare(
    'SELECT id, slug, name, created_at, metadata FROM tenants WHERE slug = ?'
  )
    .bind(slug)
    .first<any>();

  if (!tenant) {
    return { tenant: null, error: `Tenant not found: ${slug}` };
  }

  // Parse metadata JSON
  try {
    tenant.metadata = JSON.parse(tenant.metadata || '{}');
  } catch {
    tenant.metadata = {};
  }

  return { tenant: tenant as Tenant };
}

/**
 * Creates request context from tenant and auth info
 */
export function createRequestContext(
  tenant: Tenant,
  user_email?: string,
  partner_id?: string
): RequestContext {
  return {
    tenant_id: tenant.id,
    tenant_slug: tenant.slug,
    user_email,
    partner_id,
  };
}
