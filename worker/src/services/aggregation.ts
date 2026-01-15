// Aggregation Service - Win rate calculations

import type { Env } from '../types';
import { getWeekString } from '../types';

/**
 * Computes win rates for a specific week (idempotent)
 */
export async function computeWeeklyWinRates(
  env: Env,
  week: string,
  tenant_id?: string
): Promise<{ local: number; source: number }> {
  const tenants = tenant_id
    ? [{ id: tenant_id }]
    : await env.DB.prepare('SELECT id FROM tenants').all<{ id: string }>();

  let localRows = 0;
  let sourceRows = 0;

  for (const tenant of tenants.results || []) {
    localRows += await computeLocalWinRates(env, tenant.id, week);
    sourceRows += await computeSourceWinRates(env, tenant.id, week);
  }

  return { local: localRows, source: sourceRows };
}

/**
 * Computes local (geo-based) win rates for a tenant/week
 */
async function computeLocalWinRates(
  env: Env,
  tenant_id: string,
  week: string
): Promise<number> {
  // Extract geo_key from attribution metadata, group by intent_type
  const query = `
    WITH outcome_data AS (
      SELECT
        json_extract(metadata, '$.attribution.geo_key') as geo_key,
        json_extract(metadata, '$.attribution.intent_type') as intent_type,
        lead_id,
        outcome_type
      FROM lead_outcomes
      WHERE tenant_id = ?
        AND strftime('%Y-%W', occurred_at) = ?
        AND json_extract(metadata, '$.attribution.geo_key') IS NOT NULL
    )
    SELECT
      geo_key,
      COALESCE(intent_type, 'unknown') as intent_type,
      COUNT(DISTINCT lead_id) as leads_entered,
      COUNT(DISTINCT CASE WHEN outcome_type = 'appointment_set' THEN lead_id END) as appointments,
      COUNT(DISTINCT CASE WHEN outcome_type = 'closed_won' THEN lead_id END) as won,
      COUNT(DISTINCT CASE WHEN outcome_type = 'closed_lost' THEN lead_id END) as lost
    FROM outcome_data
    GROUP BY geo_key, intent_type
  `;

  const results = await env.DB.prepare(query).bind(tenant_id, week).all();

  // Upsert aggregates
  const stmt = env.DB.prepare(`
    INSERT INTO agg_local_win_rates (tenant_id, week, geo_key, intent_type, leads_entered, appointments, won, lost, win_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, week, geo_key, intent_type)
    DO UPDATE SET
      leads_entered = excluded.leads_entered,
      appointments = excluded.appointments,
      won = excluded.won,
      lost = excluded.lost,
      win_rate = excluded.win_rate
  `);

  let count = 0;
  for (const row of results.results || []) {
    const { geo_key, intent_type, leads_entered, appointments, won, lost } = row as any;
    const denominator = won + lost;
    const win_rate = denominator > 0 ? won / denominator : null;

    await stmt.bind(tenant_id, week, geo_key, intent_type, leads_entered, appointments, won, lost, win_rate).run();
    count++;
  }

  return count;
}

/**
 * Computes source-based win rates for a tenant/week
 */
async function computeSourceWinRates(
  env: Env,
  tenant_id: string,
  week: string
): Promise<number> {
  const query = `
    WITH outcome_data AS (
      SELECT
        json_extract(metadata, '$.attribution.source_key') as source_key,
        json_extract(metadata, '$.attribution.intent_type') as intent_type,
        lead_id,
        outcome_type
      FROM lead_outcomes
      WHERE tenant_id = ?
        AND strftime('%Y-%W', occurred_at) = ?
        AND json_extract(metadata, '$.attribution.source_key') IS NOT NULL
    )
    SELECT
      source_key,
      COALESCE(intent_type, 'unknown') as intent_type,
      COUNT(DISTINCT lead_id) as leads_entered,
      COUNT(DISTINCT CASE WHEN outcome_type = 'appointment_set' THEN lead_id END) as appointments,
      COUNT(DISTINCT CASE WHEN outcome_type = 'closed_won' THEN lead_id END) as won,
      COUNT(DISTINCT CASE WHEN outcome_type = 'closed_lost' THEN lead_id END) as lost
    FROM outcome_data
    GROUP BY source_key, intent_type
  `;

  const results = await env.DB.prepare(query).bind(tenant_id, week).all();

  const stmt = env.DB.prepare(`
    INSERT INTO agg_source_win_rates (tenant_id, week, source_key, intent_type, leads_entered, appointments, won, lost, win_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, week, source_key, intent_type)
    DO UPDATE SET
      leads_entered = excluded.leads_entered,
      appointments = excluded.appointments,
      won = excluded.won,
      lost = excluded.lost,
      win_rate = excluded.win_rate
  `);

  let count = 0;
  for (const row of results.results || []) {
    const { source_key, intent_type, leads_entered, appointments, won, lost } = row as any;
    const denominator = won + lost;
    const win_rate = denominator > 0 ? won / denominator : null;

    await stmt.bind(tenant_id, week, source_key, intent_type, leads_entered, appointments, won, lost, win_rate).run();
    count++;
  }

  return count;
}

/**
 * Gets list of weeks to aggregate (e.g., last 4 weeks)
 */
export function getWeeksToAggregate(count: number = 4): string[] {
  const weeks: string[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    weeks.push(getWeekString(weekDate));
  }

  return weeks;
}
