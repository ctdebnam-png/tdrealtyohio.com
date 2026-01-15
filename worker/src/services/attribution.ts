// Attribution Service - Deterministic snapshot capture

import type { Env, Lead, OutcomeAttribution } from '../types';

/**
 * Captures an immutable attribution snapshot from a lead's current state.
 * This ensures outcomes remain attributable even if lead attributes change later.
 */
export async function captureAttribution(
  env: Env,
  tenant_id: string,
  lead_id: string
): Promise<OutcomeAttribution> {
  // Fetch current lead state
  const lead = await env.DB.prepare(
    `SELECT source_key, geo_key, intent_type, timeline_bucket, price_band, budget_band, assigned_partner
     FROM leads
     WHERE id = ? AND tenant_id = ?`
  )
    .bind(lead_id, tenant_id)
    .first<Lead>();

  if (!lead) {
    throw new Error(`Lead not found: ${lead_id}`);
  }

  // Create immutable snapshot
  const attribution: OutcomeAttribution = {
    source_key: lead.source_key,
    geo_key: lead.geo_key,
    intent_type: lead.intent_type,
    timeline_bucket: lead.timeline_bucket,
    assigned_partner: lead.assigned_partner,
  };

  // Include relevant band (price for sellers, budget for buyers)
  if (lead.intent_type === 'seller' && lead.price_band) {
    attribution.price_band = lead.price_band;
  } else if (lead.intent_type === 'buyer' && lead.budget_band) {
    attribution.budget_band = lead.budget_band;
  }

  return attribution;
}

/**
 * Extracts attribution from outcome metadata for aggregations
 */
export function extractAttribution(metadata: any): OutcomeAttribution | null {
  if (!metadata || !metadata.attribution) {
    return null;
  }
  return metadata.attribution as OutcomeAttribution;
}
