/**
 * schedule.mjs
 *
 * Determines which expensive analyses should run based on
 * day-of-week or run count. Keeps lightweight audits daily
 * and heavy ones weekly.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', 'state', 'state.json');

function loadState() {
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf-8')); }
  catch { return {}; }
}

/**
 * Get schedule flags for this run.
 *
 * @param {object} options
 * @param {Date}   options.now - Current date (default: new Date())
 * @param {number} options.runCount - Total run count from score-history (optional)
 * @returns {{ runNearDuplicateAudit: boolean, runFullLinkGraph: boolean, runFullThinScan: boolean, runLiveChecks: boolean }}
 */
export function getSchedule({ now = new Date(), runCount = 0 } = {}) {
  const dayOfWeek = now.getDay(); // 0=Sunday

  return {
    // Near-duplicate: Sundays only or every 7th run
    runNearDuplicateAudit: dayOfWeek === 0 || (runCount > 0 && runCount % 7 === 0),

    // Full link graph: daily (lightweight enough)
    runFullLinkGraph: true,

    // Full thin-page scan: Sundays; otherwise rank-intent + newest posts only
    runFullThinScan: dayOfWeek === 0 || (runCount > 0 && runCount % 7 === 0),

    // Live checks: daily (already capped to key routes in live-indexing auditor)
    runLiveChecks: true,
  };
}
