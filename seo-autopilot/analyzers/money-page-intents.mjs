/**
 * money-page-intents.mjs
 *
 * Extracts top search intents per money page from GSC query data.
 * Groups queries into intent buckets defined in money-intents.json.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INTENTS_PATH = join(__dirname, '..', 'config', 'money-intents.json');
const SITE_CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');

function loadJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Extract intent buckets per money page from GSC rows.
 *
 * @param {object} options
 * @param {object[]} options.rows28 - GSC rows with { page, query, impressions, clicks, ctr, position }
 * @param {string}   options.baseUrl - Site base URL (e.g. "https://tdrealtyohio.com")
 * @returns {object} - Keyed by route path, each with buckets[] and unbucketedTopQueries[]
 */
export function extractMoneyPageIntents({ rows28 = [], baseUrl = '' } = {}) {
  const intentsConfig = loadJson(INTENTS_PATH, {});
  const siteConfig = loadJson(SITE_CONFIG_PATH, {});
  const moneyRoutes = siteConfig.moneyRoutes || [];

  if (rows28.length === 0 || moneyRoutes.length === 0) {
    return {};
  }

  // Build route->URL mapping for matching
  const routeToAbsolute = {};
  for (const route of moneyRoutes) {
    routeToAbsolute[route] = `${baseUrl}${route}`.replace(/\/$/, '/');
  }

  // Collect queries per money page
  const pageQueries = {};
  for (const route of moneyRoutes) {
    pageQueries[route] = [];
  }

  for (const row of rows28) {
    if (!row.page || !row.query) continue;

    // Match row.page against money routes
    for (const route of moneyRoutes) {
      const abs = routeToAbsolute[route];
      // Normalize: GSC page URLs may or may not have trailing slash
      const normalizedPage = row.page.endsWith('/') ? row.page : row.page + '/';
      if (normalizedPage === abs) {
        pageQueries[route].push({
          query: row.query,
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        });
        break;
      }
    }
  }

  // Group into intent buckets
  const result = {};
  for (const route of moneyRoutes) {
    const queries = pageQueries[route];
    const routeIntents = intentsConfig[route];
    const buckets = [];
    const bucketed = new Set();

    if (routeIntents && routeIntents.intentBuckets) {
      for (const bucket of routeIntents.intentBuckets) {
        const hints = (bucket.hintQueries || []).map(h => h.toLowerCase());
        const matching = queries.filter(q => {
          const ql = q.query.toLowerCase();
          return hints.some(h => ql.includes(h));
        });

        let totalImpressions = 0;
        let totalClicks = 0;
        for (const m of matching) {
          totalImpressions += m.impressions;
          totalClicks += m.clicks;
          bucketed.add(m.query);
        }

        // Top 5 by impressions
        const topQueries = matching
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 5)
          .map(q => ({ query: q.query, impressions: q.impressions, clicks: q.clicks }));

        buckets.push({
          bucketId: bucket.bucketId,
          impressions: totalImpressions,
          clicks: totalClicks,
          topQueries,
        });
      }
    }

    // Unbucketed top queries
    const unbucketed = queries
      .filter(q => !bucketed.has(q.query))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5)
      .map(q => ({ query: q.query, impressions: q.impressions, clicks: q.clicks }));

    result[route] = { buckets, unbucketedTopQueries: unbucketed };
  }

  return result;
}
