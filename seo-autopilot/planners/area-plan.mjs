/**
 * area-plan.mjs
 *
 * Selects at most 1 area page per run for expansion.
 * Prioritizes pages that are both thin (wordCount < minWordsTarget)
 * and underlinked (low inDegree).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Plan which area page to expand.
 *
 * @param {object} options
 * @param {string[]} options.areaRoutes - Area routes from area-discovery
 * @param {object[]} options.thinRankIntent - Thin rank-intent pages with { routePath, wordCount }
 * @param {object} options.linkGraphInDegree - { [route]: inDegree }
 * @param {object} options.areasConfig - From areas.json
 * @param {object[]} options.nearDuplicatePairs - Near-duplicate pairs from auditor
 * @param {object} options.state - State from state.json
 * @returns {{ selected: string|null, wordCount: number, inDegree: number, reason: string }}
 */
export function planAreaExpansion({
  areaRoutes = [],
  thinRankIntent = [],
  linkGraphInDegree = {},
  areasConfig = {},
  nearDuplicatePairs = [],
  state = {},
}) {
  const minWordsTarget = areasConfig.minWordsTarget || 700;

  if (areaRoutes.length === 0) {
    return { selected: null, wordCount: 0, inDegree: 0, reason: 'no_area_routes' };
  }

  // Build thin-page lookup
  const thinMap = new Map();
  for (const t of thinRankIntent) {
    thinMap.set(t.routePath, t.wordCount || 0);
  }

  // Build near-duplicate set for area pages
  const nearDupAreaRoutes = new Set();
  for (const pair of nearDuplicatePairs) {
    if (pair.pathA?.startsWith('/areas/')) nearDupAreaRoutes.add(pair.pathA);
    if (pair.pathB?.startsWith('/areas/')) nearDupAreaRoutes.add(pair.pathB);
  }

  // Recently expanded routes (skip if expanded in the last 7 days)
  const recentlyExpanded = new Set();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  for (const entry of (state.areas?.expandedHistory || [])) {
    const expandedAt = new Date(entry.at).getTime();
    if (now - expandedAt < sevenDaysMs) {
      recentlyExpanded.add(entry.route);
    }
  }

  // Score and filter candidates
  const candidates = [];
  for (const route of areaRoutes) {
    // Skip near-duplicates
    if (nearDupAreaRoutes.has(route)) continue;

    // Skip recently expanded
    if (recentlyExpanded.has(route)) continue;

    const wordCount = thinMap.get(route) ?? 9999; // If not in thin list, assume adequate
    const isThin = wordCount < minWordsTarget;
    const inDeg = linkGraphInDegree[route] || 0;

    candidates.push({
      route,
      wordCount,
      isThin,
      inDegree: inDeg,
      // Severity: lower wordCount = more thin, lower inDegree = more underlinked
      thinSeverity: isThin ? minWordsTarget - wordCount : 0,
    });
  }

  if (candidates.length === 0) {
    return { selected: null, wordCount: 0, inDegree: 0, reason: 'no_eligible_candidates' };
  }

  // Prioritize: thin pages first, then by thin severity desc, then inDegree asc, then route alpha
  candidates.sort((a, b) => {
    // Thin pages first
    if (a.isThin !== b.isThin) return a.isThin ? -1 : 1;
    // Higher thin severity first
    if (a.thinSeverity !== b.thinSeverity) return b.thinSeverity - a.thinSeverity;
    // Lower inDegree first
    if (a.inDegree !== b.inDegree) return a.inDegree - b.inDegree;
    // Alphabetical fallback
    return a.route.localeCompare(b.route);
  });

  const best = candidates[0];
  const reason = best.isThin
    ? `thin_area: ${best.route} (${best.wordCount} words, inDeg ${best.inDegree})`
    : `underlinked_area: ${best.route} (${best.wordCount} words, inDeg ${best.inDegree})`;

  return {
    selected: best.route,
    wordCount: best.wordCount,
    inDegree: best.inDegree,
    reason,
  };
}
