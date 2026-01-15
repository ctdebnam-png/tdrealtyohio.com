// Cron Handler - Routes scheduled events

import type { Env } from './types';
import { runWeeklyAggregation } from '../cron/weekly-aggregation';
import { runDailyNudges } from '../cron/daily-nudges';

/**
 * Routes cron events based on schedule
 */
export async function handleCron(event: ScheduledEvent, env: Env): Promise<void> {
  const cron = event.cron;

  // Weekly aggregation: Sunday 2am UTC (0 2 * * 0)
  if (cron === '0 2 * * 0') {
    console.log('Running weekly aggregation...');
    await runWeeklyAggregation(env);
    return;
  }

  // Daily nudges: Daily 6am UTC (0 6 * * *)
  if (cron === '0 6 * * *') {
    console.log('Running daily nudges...');
    await runDailyNudges(env);
    return;
  }

  console.warn('Unknown cron schedule:', cron);
}
