// Win Rates Handler - Dashboard queries and exports

import type { Env, RequestContext, WinRatesQuery, WinRateRow, ApiResponse } from '../types';

/**
 * Gets win rates by source
 */
export async function getWinRatesBySource(
  env: Env,
  ctx: RequestContext,
  query: WinRatesQuery
): Promise<ApiResponse<WinRateRow[]>> {
  const { from, to, intent_type, min_denominator, limit, offset } = query;

  const minDenom = min_denominator || 5;
  const intentFilter = intent_type && intent_type !== 'all' ? intent_type : null;

  let sql = `
    SELECT
      source_key as key,
      intent_type,
      SUM(leads_entered) as leads_entered,
      SUM(appointments) as appointments,
      SUM(won) as won,
      SUM(lost) as lost,
      CASE
        WHEN SUM(won + lost) > 0
        THEN CAST(SUM(won) AS REAL) / SUM(won + lost)
        ELSE NULL
      END as win_rate,
      CASE
        WHEN SUM(leads_entered) > 0
        THEN CAST(SUM(appointments) AS REAL) / SUM(leads_entered)
        ELSE NULL
      END as appointment_rate
    FROM agg_source_win_rates
    WHERE tenant_id = ?
  `;

  const params: any[] = [ctx.tenant_id];

  if (from) {
    sql += ` AND week >= ?`;
    params.push(from);
  }

  if (to) {
    sql += ` AND week <= ?`;
    params.push(to);
  }

  if (intentFilter) {
    sql += ` AND intent_type = ?`;
    params.push(intentFilter);
  }

  sql += ` GROUP BY source_key, intent_type`;
  sql += ` HAVING SUM(won + lost) >= ?`;
  params.push(minDenom);

  sql += ` ORDER BY win_rate DESC NULLS LAST`;

  if (limit) {
    sql += ` LIMIT ?`;
    params.push(limit);
  }

  if (offset) {
    sql += ` OFFSET ?`;
    params.push(offset);
  }

  const results = await env.DB.prepare(sql).bind(...params).all<WinRateRow>();

  return { success: true, data: results.results || [] };
}

/**
 * Gets win rates by geo
 */
export async function getWinRatesByGeo(
  env: Env,
  ctx: RequestContext,
  query: WinRatesQuery
): Promise<ApiResponse<WinRateRow[]>> {
  const { from, to, intent_type, min_denominator, limit, offset } = query;

  const minDenom = min_denominator || 5;
  const intentFilter = intent_type && intent_type !== 'all' ? intent_type : null;

  let sql = `
    SELECT
      geo_key as key,
      intent_type,
      SUM(leads_entered) as leads_entered,
      SUM(appointments) as appointments,
      SUM(won) as won,
      SUM(lost) as lost,
      CASE
        WHEN SUM(won + lost) > 0
        THEN CAST(SUM(won) AS REAL) / SUM(won + lost)
        ELSE NULL
      END as win_rate,
      CASE
        WHEN SUM(leads_entered) > 0
        THEN CAST(SUM(appointments) AS REAL) / SUM(leads_entered)
        ELSE NULL
      END as appointment_rate
    FROM agg_local_win_rates
    WHERE tenant_id = ?
  `;

  const params: any[] = [ctx.tenant_id];

  if (from) {
    sql += ` AND week >= ?`;
    params.push(from);
  }

  if (to) {
    sql += ` AND week <= ?`;
    params.push(to);
  }

  if (intentFilter) {
    sql += ` AND intent_type = ?`;
    params.push(intentFilter);
  }

  sql += ` GROUP BY geo_key, intent_type`;
  sql += ` HAVING SUM(won + lost) >= ?`;
  params.push(minDenom);

  sql += ` ORDER BY win_rate DESC NULLS LAST`;

  if (limit) {
    sql += ` LIMIT ?`;
    params.push(limit);
  }

  if (offset) {
    sql += ` OFFSET ?`;
    params.push(offset);
  }

  const results = await env.DB.prepare(sql).bind(...params).all<WinRateRow>();

  return { success: true, data: results.results || [] };
}

/**
 * Exports win rates to CSV format
 */
export function exportToCSV(rows: WinRateRow[], type: 'source' | 'geo'): string {
  const keyHeader = type === 'source' ? 'source_key' : 'geo_key';

  const headers = [
    keyHeader,
    'intent_type',
    'leads_entered',
    'appointments',
    'appointment_rate',
    'won',
    'lost',
    'win_rate',
  ];

  const lines = [headers.join(',')];

  for (const row of rows) {
    const line = [
      row.key,
      row.intent_type,
      row.leads_entered,
      row.appointments,
      row.appointment_rate !== null ? row.appointment_rate.toFixed(3) : '',
      row.won,
      row.lost,
      row.win_rate !== null ? row.win_rate.toFixed(3) : '',
    ];
    lines.push(line.join(','));
  }

  return lines.join('\n');
}
