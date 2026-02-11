/**
 * cannibalization.mjs
 *
 * Detects likely query cannibalization: page pairs that compete
 * for the same queries without clear dominance.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONSOLIDATION_CONFIG_PATH = join(__dirname, '..', 'config', 'consolidation.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Detect cannibalization candidates from multi-page query data.
 *
 * @param {Array<{ query: string, pages: object[] }>} multiPageQueries
 * @returns {{
 *   pairs: Array<{
 *     a: string, b: string,
 *     sharedQueries: number, sampleQueries: string[],
 *     aTotals: { impressions: number, clicks: number },
 *     bTotals: { impressions: number, clicks: number }
 *   }>,
 *   totalCandidates: number
 * }}
 */
export function detectCannibalization(multiPageQueries = []) {
  const config = loadJson(CONSOLIDATION_CONFIG_PATH, {});
  const minShared = config.minSharedQueries || 5;

  if (multiPageQueries.length === 0) {
    return { pairs: [], totalCandidates: 0 };
  }

  // Track page-pair overlaps
  // key: "pageA|||pageB" (sorted alphabetically)
  const pairMap = new Map();

  for (const { query, pages } of multiPageQueries) {
    if (pages.length < 2) continue;

    // Check if competition exists (no clear dominant page)
    const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0);
    const totalClicks = pages.reduce((s, p) => s + p.clicks, 0);
    const bestImprShare = pages[0].impressions / (totalImpressions || 1);
    const bestClickShare = totalClicks > 0 ? pages[0].clicks / totalClicks : 0;

    // Dominance heuristic: if best page has < 70% share, there's competition
    if (bestImprShare >= 0.7 && bestClickShare >= 0.7) continue;

    // Generate page pairs for this query
    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        const a = pages[i].path;
        const b = pages[j].path;
        const key = a < b ? `${a}|||${b}` : `${b}|||${a}`;

        if (!pairMap.has(key)) {
          pairMap.set(key, {
            a: a < b ? a : b,
            b: a < b ? b : a,
            sharedQueries: 0,
            sampleQueries: [],
            aTotals: { impressions: 0, clicks: 0 },
            bTotals: { impressions: 0, clicks: 0 },
          });
        }

        const pair = pairMap.get(key);
        pair.sharedQueries++;
        if (pair.sampleQueries.length < 10) {
          pair.sampleQueries.push(query);
        }

        // Accumulate totals for correct page
        const aPage = a < b ? pages[i] : pages[j];
        const bPage = a < b ? pages[j] : pages[i];
        pair.aTotals.impressions += aPage.impressions;
        pair.aTotals.clicks += aPage.clicks;
        pair.bTotals.impressions += bPage.impressions;
        pair.bTotals.clicks += bPage.clicks;
      }
    }
  }

  // Filter by minimum shared queries
  const pairs = [...pairMap.values()]
    .filter(p => p.sharedQueries >= minShared)
    .sort((a, b) => b.sharedQueries - a.sharedQueries)
    .slice(0, 50);

  return {
    pairs,
    totalCandidates: pairs.length,
  };
}
