/**
 * query-page-map.mjs
 *
 * Builds a stable query-to-page map from GSC striking-distance queries.
 * Normalizes queries and page paths, stores a compact version in state.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build a query-to-page map from striking-distance queries.
 *
 * @param {object} options
 * @param {object[]} options.strikingDistanceQueries - From gsc-opportunities
 * @param {string[]} options.rankIntentRoutes - From site.json
 * @param {number}   options.maxQueries - Cap on stored queries (default 200)
 * @returns {{ fullMap: object[], compactMap: object[] }}
 */
export function buildQueryPageMap({
  strikingDistanceQueries = [],
  rankIntentRoutes = [],
  maxQueries = 200,
} = {}) {
  const rankSet = new Set(rankIntentRoutes);

  // Normalize and filter
  const entries = [];
  for (const q of strikingDistanceQueries) {
    if (!q.query || !q.bestPagePath) continue;

    const normalized = q.query.trim().toLowerCase();
    const pagePath = normalizePath(q.bestPagePath);

    // Only keep queries mapped to rank-intent pages
    if (!rankSet.has(pagePath)) continue;

    entries.push({
      query: normalized,
      pagePath,
      impressions28: q.impressions28 || 0,
      clicks28: q.clicks28 || 0,
      ctr28: q.ctr28 || 0,
      pos28: q.pos28 || 0,
    });
  }

  // Sort by impressions descending, cap
  entries.sort((a, b) => b.impressions28 - a.impressions28);
  const fullMap = entries.slice(0, maxQueries);

  // Compact version: only query, pagePath, impressions28, pos28
  const compactMap = fullMap.map(e => ({
    query: e.query,
    pagePath: e.pagePath,
    impressions28: e.impressions28,
    pos28: Math.round(e.pos28 * 10) / 10,
  }));

  return { fullMap, compactMap };
}

/**
 * Normalize a route path to ensure trailing slash.
 */
function normalizePath(path) {
  if (!path) return '/';
  return path.endsWith('/') ? path : path + '/';
}

/**
 * Group queries by their mapped page path.
 *
 * @param {object[]} queryMap - fullMap or compactMap entries
 * @returns {Map<string, object[]>} - Map of pagePath -> query entries
 */
export function groupQueriesByPage(queryMap) {
  const grouped = new Map();
  for (const entry of queryMap) {
    if (!grouped.has(entry.pagePath)) {
      grouped.set(entry.pagePath, []);
    }
    grouped.get(entry.pagePath).push(entry);
  }
  return grouped;
}
