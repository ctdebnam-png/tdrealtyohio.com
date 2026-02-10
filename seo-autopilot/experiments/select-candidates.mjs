/**
 * select-candidates.mjs
 *
 * Selects pages for title/meta description experiments based on
 * GSC opportunity data, experiment state, and config thresholds.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Select candidate pages for experiments.
 *
 * @param {object} options
 * @param {Array} options.opportunities - highImpressionsLowCtrPages from GSC
 * @param {object} options.experimentsConfig - experiments.json config
 * @param {object} options.experimentsState - experiments state
 * @param {object} options.siteConfig - site.json config
 * @returns {Array<{path: string, impressions28: number, ctr28: number, pos28: number, topQueries: Array}>}
 */
export function selectCandidates({ opportunities, experimentsConfig, experimentsState, siteConfig }) {
  const {
    maxPagesPerRun = 3,
    minImpressions28 = 200,
  } = experimentsConfig || {};

  const { rankIntentRoutes = [], utilityRoutesNoIndex = [] } = siteConfig || {};
  const utilitySet = new Set([...utilityRoutesNoIndex, '/404/', '/500/']);
  const rankSet = rankIntentRoutes.length > 0 ? new Set(rankIntentRoutes) : null;

  const pages = experimentsState?.pages || {};
  const now = new Date();

  // Filter candidates
  const candidates = (opportunities || []).filter((page) => {
    // Must have enough impressions
    if (page.impressions28 < minImpressions28) return false;

    // Must not be a utility route
    if (utilitySet.has(page.path)) return false;

    // If rankIntentRoutes is populated, must be in it
    if (rankSet && !rankSet.has(page.path)) return false;

    // Must not be locked or in cooldown
    const exp = pages[page.path];
    if (exp) {
      if (exp.lockUntil && new Date(exp.lockUntil) > now) return false;
      if (exp.cooldownUntil && new Date(exp.cooldownUntil) > now) return false;
    }

    return true;
  });

  // Sort: impressions descending, then CTR ascending, then position ascending
  candidates.sort((a, b) => {
    if (b.impressions28 !== a.impressions28) return b.impressions28 - a.impressions28;
    if (a.ctr28 !== b.ctr28) return a.ctr28 - b.ctr28;
    return a.pos28 - b.pos28;
  });

  return candidates.slice(0, maxPagesPerRun);
}
