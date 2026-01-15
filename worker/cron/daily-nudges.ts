// Daily Nudges Cron Job
// Runs every day at 6am UTC to identify leads needing outcome updates

import type { Env } from '../src/types';
import { generateUUID, getCurrentISO8601 } from '../src/types';

export async function runDailyNudges(env: Env): Promise<void> {
  const jobId = generateUUID();
  const startedAt = getCurrentISO8601();
  const jobName = 'daily_outcome_nudges';

  console.log('Starting daily outcome nudges...');

  // Record job start
  await env.DB.prepare(
    `INSERT INTO job_runs (id, job_name, started_at, status, metadata)
     VALUES (?, ?, ?, 'running', '{}')`
  )
    .bind(jobId, jobName, startedAt)
    .run();

  try {
    // Get all tenants
    const tenants = await env.DB.prepare('SELECT id, slug FROM tenants').all<{
      id: string;
      slug: string;
    }>();

    let totalAlerts = 0;

    for (const tenant of tenants.results || []) {
      const alertCount = await processNudgesForTenant(env, tenant.id);
      totalAlerts += alertCount;
    }

    // Mark job as successful
    await env.DB.prepare(
      `UPDATE job_runs
       SET status = 'success', completed_at = ?, records_processed = ?, metadata = ?
       WHERE id = ?`
    )
      .bind(
        getCurrentISO8601(),
        totalAlerts,
        JSON.stringify({ alerts_created: totalAlerts }),
        jobId
      )
      .run();

    console.log(`Daily nudges completed: ${totalAlerts} alerts created`);
  } catch (error: any) {
    console.error('Daily nudges failed:', error);

    await env.DB.prepare(
      `UPDATE job_runs
       SET status = 'failed', completed_at = ?, error_message = ?
       WHERE id = ?`
    )
      .bind(getCurrentISO8601(), error.message, jobId)
      .run();

    throw error;
  }
}

async function processNudgesForTenant(env: Env, tenant_id: string): Promise<number> {
  // Find stale leads (criteria from spec)
  const staleLeads = await env.DB.prepare(
    `SELECT
      l.id,
      l.source_key,
      l.geo_key,
      l.tier,
      l.last_activity_at,
      julianday('now') - julianday(l.last_activity_at) as days_stale
    FROM leads l
    LEFT JOIN lead_state ls ON l.id = ls.lead_id AND l.tenant_id = ls.tenant_id
    WHERE l.tenant_id = ?
      AND (
        (l.last_activity_at IS NOT NULL AND julianday('now') - julianday(l.last_activity_at) > 7)
        OR (l.last_sms_reply_at IS NOT NULL AND julianday('now') - julianday(l.last_sms_reply_at) > 7)
      )
      AND (ls.current_stage IS NULL OR ls.current_stage = 'top_of_funnel')
      AND l.tier IN ('A', 'B')
      AND l.timeline_bucket IN ('0-30', '31-90')
    ORDER BY days_stale DESC
    LIMIT 100`
  )
    .bind(tenant_id)
    .all();

  const leads = staleLeads.results || [];

  if (leads.length === 0) {
    return 0;
  }

  // Check if alert already exists for today (avoid duplicates)
  const today = new Date().toISOString().split('T')[0];
  const existingAlert = await env.DB.prepare(
    `SELECT id FROM admin_alerts
     WHERE tenant_id = ?
       AND code = 'OUTCOME_MISSING'
       AND dismissed_at IS NULL
       AND date(created_at) = ?`
  )
    .bind(tenant_id, today)
    .first();

  if (existingAlert) {
    console.log(`Alert already exists for tenant ${tenant_id} today`);
    return 0;
  }

  // Create alert
  const alertId = generateUUID();
  const leadIds = leads.map((l: any) => l.id);
  const oldestActivity = leads.length > 0 ? (leads[0] as any).last_activity_at : null;

  await env.DB.prepare(
    `INSERT INTO admin_alerts (
      id, tenant_id, created_at, category, code, severity, title, message, evidence, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      alertId,
      tenant_id,
      getCurrentISO8601(),
      'ops',
      'OUTCOME_MISSING',
      'warning',
      `${leads.length} leads need outcome updates`,
      `${leads.length} high-value leads (Tier A/B) have not been updated in 7+ days`,
      JSON.stringify({
        lead_ids: leadIds,
        count: leads.length,
        oldest_activity: oldestActivity,
      }),
      '{}'
    )
    .run();

  console.log(`Created OUTCOME_MISSING alert for tenant ${tenant_id}: ${leads.length} leads`);

  return 1;
}
