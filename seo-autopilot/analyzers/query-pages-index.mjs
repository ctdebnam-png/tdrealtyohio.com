/**
 * query-pages-index.mjs
 *
 * Builds a query-to-pages index from GSC page+query data.
 * Identifies queries where multiple pages compete for the same terms.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeJsonStable } from '../lib/write-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONSOLIDATION_CONFIG_PATH = join(__dirname, '..', 'config', 'consolidation.json');
const QUERY_PAGES_PATH = join(__dirname, '..', 'state', 'query-pages.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Build a query-to-pages index from GSC row data.
 *
 * @param {object[]} rows28 - GSC rows with { query, page, clicks, impressions, ctr, position }
 * @returns {{
 *   multiPageQueries: Array<{ query: string, pages: object[] }>,
 *   totalQueries: number,
 *   multiPageCount: number,
 *   persisted: boolean
 * }}
 */
export async function buildQueryPagesIndex(rows28 = []) {
  const config = loadJson(CONSOLIDATION_CONFIG_PATH, {});
  const minImpressions = config.minImpressionsPerQuery || 50;
  const maxPages = config.maxPagesPerQuery || 3;

  if (rows28.length === 0) {
    return { multiPageQueries: [], totalQueries: 0, multiPageCount: 0, persisted: false };
  }

  // Group by normalized query
  const queryMap = new Map();

  for (const row of rows28) {
    if (!row.query || !row.page) continue;

    const query = row.query.toLowerCase().trim();
    const path = normalizePageToPath(row.page);

    if (!queryMap.has(query)) {
      queryMap.set(query, new Map());
    }

    const pageMap = queryMap.get(query);
    if (!pageMap.has(path)) {
      pageMap.set(path, { path, impressions: 0, clicks: 0, ctr: 0, position: 0, rowCount: 0 });
    }

    const entry = pageMap.get(path);
    entry.impressions += row.impressions || 0;
    entry.clicks += row.clicks || 0;
    entry.rowCount++;
    // Weighted average position
    if (row.impressions > 0) {
      entry.position = (entry.position * (entry.rowCount - 1) + (row.position || 0)) / entry.rowCount;
    }
  }

  // Filter: keep queries with impressions >= threshold and 2+ pages
  const multiPageQueries = [];

  for (const [query, pageMap] of queryMap) {
    // Filter pages by impression threshold
    const qualifyingPages = [...pageMap.values()]
      .filter(p => p.impressions >= minImpressions)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, maxPages);

    if (qualifyingPages.length >= 2) {
      // Compute CTR for each page
      for (const p of qualifyingPages) {
        p.ctr = p.impressions > 0 ? Math.round((p.clicks / p.impressions) * 10000) / 10000 : 0;
        p.position = Math.round(p.position * 10) / 10;
      }

      multiPageQueries.push({
        query,
        pages: qualifyingPages,
      });
    }
  }

  // Sort by total impressions descending
  multiPageQueries.sort((a, b) => {
    const aTotal = a.pages.reduce((s, p) => s + p.impressions, 0);
    const bTotal = b.pages.reduce((s, p) => s + p.impressions, 0);
    return bTotal - aTotal;
  });

  // Persist full index (for detailed analysis)
  const top200 = multiPageQueries.slice(0, 200);
  await writeJsonStable(QUERY_PAGES_PATH, { queries: top200, updatedAt: new Date().toISOString() }, 'queryPages');

  return {
    multiPageQueries: top200,
    totalQueries: queryMap.size,
    multiPageCount: multiPageQueries.length,
    persisted: true,
  };
}

/**
 * Normalize a full URL to a path.
 */
function normalizePageToPath(page) {
  try {
    const url = new URL(page);
    return url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
  } catch {
    return page.endsWith('/') ? page : page + '/';
  }
}

/**
 * Load previously persisted query-pages index.
 */
export function loadQueryPagesIndex() {
  return loadJson(QUERY_PAGES_PATH, { queries: [] });
}
