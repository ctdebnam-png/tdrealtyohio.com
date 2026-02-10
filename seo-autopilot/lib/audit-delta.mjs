/**
 * audit-delta.mjs
 *
 * Compares before/after audit results to detect regressions.
 * Returns delta counts and a shouldRevert boolean per safety.json thresholds.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAFETY_PATH = join(__dirname, '..', 'config', 'safety.json');

function loadSafety() {
  try { return JSON.parse(readFileSync(SAFETY_PATH, 'utf-8')); }
  catch { return { revertIfWorse: {} }; }
}

/**
 * Compute audit deltas and determine if a revert is needed.
 *
 * @param {object} options
 * @param {object} options.before - { criticalCount, brokenLinkCount, issueCounts }
 * @param {object} options.after  - { criticalCount, brokenLinkCount, issueCounts }
 * @returns {{ criticalDelta: number, brokenLinkDelta: number, byCodeDelta: object, shouldRevert: boolean, reasons: string[] }}
 */
export function computeAuditDelta({ before = {}, after = {} } = {}) {
  const safety = loadSafety();
  const thresholds = safety.revertIfWorse || {};

  const criticalDelta = (after.criticalCount || 0) - (before.criticalCount || 0);
  const brokenLinkDelta = (after.brokenLinkCount || 0) - (before.brokenLinkCount || 0);

  // Compute per-code deltas
  const allCodes = new Set([
    ...Object.keys(before.issueCounts || {}),
    ...Object.keys(after.issueCounts || {}),
  ]);
  const byCodeDelta = {};
  for (const code of allCodes) {
    const b = (before.issueCounts || {})[code] || 0;
    const a = (after.issueCounts || {})[code] || 0;
    if (b !== a) {
      byCodeDelta[code] = { before: b, after: a, delta: a - b };
    }
  }

  const reasons = [];

  if (thresholds.criticalTechIssueIncrease != null && criticalDelta >= thresholds.criticalTechIssueIncrease) {
    reasons.push(`critical tech issues increased by ${criticalDelta} (threshold: ${thresholds.criticalTechIssueIncrease})`);
  }

  if (thresholds.brokenInternalLinkIncrease != null && brokenLinkDelta >= thresholds.brokenInternalLinkIncrease) {
    reasons.push(`broken links increased by ${brokenLinkDelta} (threshold: ${thresholds.brokenInternalLinkIncrease})`);
  }

  return {
    criticalDelta,
    brokenLinkDelta,
    byCodeDelta,
    shouldRevert: reasons.length > 0,
    reasons,
  };
}
