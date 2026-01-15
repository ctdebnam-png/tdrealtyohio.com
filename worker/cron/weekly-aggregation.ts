// Weekly Aggregation Cron Job
// Runs every Sunday at 2am UTC to compute win rates for the previous week

import type { Env } from '../src/types';
import { generateUUID, getCurrentISO8601, getWeekString } from '../src/types';
import { computeWeeklyWinRates } from '../src/services/aggregation';

export async function runWeeklyAggregation(env: Env): Promise<void> {
  const jobId = generateUUID();
  const startedAt = getCurrentISO8601();
  const jobName = 'weekly_win_rate_aggregation';

  // Determine which week to aggregate (last week)
  const now = new Date();
  now.setDate(now.getDate() - 7); // Go back one week
  const targetWeek = getWeekString(now);

  console.log(`Starting weekly aggregation for week ${targetWeek}...`);

  // Record job start
  await env.DB.prepare(
    `INSERT INTO job_runs (id, job_name, started_at, status, metadata)
     VALUES (?, ?, ?, 'running', ?)`
  )
    .bind(jobId, jobName, startedAt, JSON.stringify({ target_week: targetWeek }))
    .run();

  try {
    // Compute aggregates for all tenants
    const result = await computeWeeklyWinRates(env, targetWeek);

    // Mark job as successful
    await env.DB.prepare(
      `UPDATE job_runs
       SET status = 'success', completed_at = ?, records_processed = ?, metadata = ?
       WHERE id = ?`
    )
      .bind(
        getCurrentISO8601(),
        result.local + result.source,
        JSON.stringify({
          target_week: targetWeek,
          local_rows: result.local,
          source_rows: result.source,
        }),
        jobId
      )
      .run();

    console.log(
      `Weekly aggregation completed: ${result.local} local rows, ${result.source} source rows`
    );
  } catch (error: any) {
    console.error('Weekly aggregation failed:', error);

    // Mark job as failed
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
