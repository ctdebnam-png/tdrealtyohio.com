// Leads Handler - Lead queries and missing outcome detection

import type { Env, RequestContext, Lead, MissingOutcomeFilter, ApiResponse } from '../types';
import { parseJSONSafe } from '../types';

/**
 * Gets a single lead by ID
 */
export async function getLead(
  env: Env,
  ctx: RequestContext,
  lead_id: string
): Promise<ApiResponse<Lead>> {
  const lead = await env.DB.prepare(
    'SELECT * FROM leads WHERE id = ? AND tenant_id = ?'
  )
    .bind(lead_id, ctx.tenant_id)
    .first<any>();

  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }

  lead.metadata = parseJSONSafe(lead.metadata, {});

  return { success: true, data: lead as Lead };
}

/**
 * Finds leads with missing/stale outcomes
 */
export async function getLeadsMissingOutcomes(
  env: Env,
  ctx: RequestContext,
  filter: MissingOutcomeFilter
): Promise<ApiResponse<any[]>> {
  // Find leads where:
  // - last_activity_at > 7 days ago (stale)
  // - AND (no outcome beyond "contacted" OR no outcome at all)
  // - AND tier is A or B (high value)
  // - AND timeline_bucket is 0-30 or 31-90 (active)

  let sql = `
    SELECT
      l.id,
      l.source_key,
      l.geo_key,
      l.tier,
      l.timeline_bucket,
      l.assigned_partner,
      l.last_activity_at,
      ls.current_stage,
      ls.last_outcome_type,
      julianday('now') - julianday(l.last_activity_at) as days_stale
    FROM leads l
    LEFT JOIN lead_state ls ON l.id = ls.lead_id AND l.tenant_id = ls.tenant_id
    WHERE l.tenant_id = ?
      AND (
        (l.last_activity_at IS NOT NULL AND julianday('now') - julianday(l.last_activity_at) > 7)
        OR ls.lead_id IS NULL
      )
      AND (ls.current_stage IS NULL OR ls.current_stage = 'top_of_funnel')
      AND l.tier IN ('A', 'B')
      AND l.timeline_bucket IN ('0-30', '31-90')
  `;

  const params: any[] = [ctx.tenant_id];

  if (filter.source_key) {
    sql += ` AND l.source_key = ?`;
    params.push(filter.source_key);
  }

  if (filter.geo_key) {
    sql += ` AND l.geo_key = ?`;
    params.push(filter.geo_key);
  }

  if (filter.tier && filter.tier.length > 0) {
    const placeholders = filter.tier.map(() => '?').join(',');
    sql += ` AND l.tier IN (${placeholders})`;
    params.push(...filter.tier);
  }

  if (filter.assigned_partner) {
    sql += ` AND l.assigned_partner = ?`;
    params.push(filter.assigned_partner);
  }

  sql += ` ORDER BY days_stale DESC`;

  if (filter.limit) {
    sql += ` LIMIT ?`;
    params.push(filter.limit);
  }

  const results = await env.DB.prepare(sql).bind(...params).all();

  return { success: true, data: results.results || [] };
}
