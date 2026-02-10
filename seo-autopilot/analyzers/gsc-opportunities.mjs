/**
 * gsc-opportunities.mjs
 *
 * Consumes GSC data and site config to compute opportunity sets:
 * A) High impressions / low CTR pages
 * B) Striking distance queries
 * C) Declining pages
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { normalizePath } from '../lib/url-normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadGscConfig() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'config', 'gsc.json'), 'utf-8'));
  } catch {
    return {};
  }
}

function loadSiteConfig() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'config', 'site.json'), 'utf-8'));
  } catch {
    return { baseUrl: '', canonicalStrategy: 'slash', utilityRoutesNoIndex: [] };
  }
}

/**
 * Convert a page URL to a normalized path key.
 */
function pageToPath(pageUrl, baseUrl, strategy) {
  let path = pageUrl;
  if (baseUrl && path.startsWith(baseUrl)) {
    path = path.slice(baseUrl.length);
    if (!path.startsWith('/')) path = '/' + path;
  }
  if (!path.startsWith('/')) return null; // External
  return normalizePath(path, strategy);
}

/**
 * Compute opportunity sets from GSC data.
 *
 * @param {object} gscResult - Result from pullGscData() (must be ok:true)
 * @returns {object} Opportunities
 */
export function computeOpportunities(gscResult) {
  const gscConfig = loadGscConfig();
  const siteConfig = loadSiteConfig();
  const { baseUrl = '', canonicalStrategy = 'slash', utilityRoutesNoIndex = [] } = siteConfig;
  const utilitySet = new Set([...utilityRoutesNoIndex, '/404/', '/500/']);

  const {
    minImpressionsForCtrWork = 200,
    maxCtrForCtrWork = 0.015,
    minImpressionsForStrikingDistance = 100,
    strikingDistanceMinPos = 8.0,
    strikingDistanceMaxPos = 20.0,
    minClicksForDeclineCheck = 5,
    declineClickRatioThreshold = 0.7,
  } = gscConfig;

  const { pages28 = [], pages7 = [], rows28 = [] } = gscResult;

  // ── A) High impressions, low CTR pages ──────────────────
  const highImpressionsLowCtrPages = pages28
    .filter((p) => {
      const path = pageToPath(p.page, baseUrl, canonicalStrategy);
      if (!path) return false;
      if (utilitySet.has(path)) return false;
      return p.impressions >= minImpressionsForCtrWork && p.ctrWeighted <= maxCtrForCtrWork;
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)
    .map((p) => {
      const path = pageToPath(p.page, baseUrl, canonicalStrategy);
      // Get top queries for this page
      const pageRows = rows28
        .filter((r) => r.page === p.page)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 10);

      return {
        path,
        impressions28: p.impressions,
        clicks28: p.clicks,
        ctr28: p.ctrWeighted,
        pos28: p.positionWeighted,
        topQueries: pageRows.map((r) => ({
          query: r.query,
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: r.ctr,
          position: r.position,
        })),
      };
    });

  // ── B) Striking distance queries ────────────────────────
  // Group rows28 by query, pick best page
  const queryMap = {};
  for (const row of rows28) {
    if (row.query.length < 3) continue;
    if (!queryMap[row.query]) {
      queryMap[row.query] = { query: row.query, impressions: 0, clicks: 0, posSum: 0, bestPage: null, bestPageImpressions: 0 };
    }
    const q = queryMap[row.query];
    q.impressions += row.impressions;
    q.clicks += row.clicks;
    q.posSum += row.position * row.impressions;
    if (row.impressions > q.bestPageImpressions) {
      q.bestPage = row.page;
      q.bestPageImpressions = row.impressions;
    }
  }

  const strikingDistanceQueries = Object.values(queryMap)
    .filter((q) => {
      if (q.impressions < minImpressionsForStrikingDistance) return false;
      const avgPos = q.impressions > 0 ? q.posSum / q.impressions : 0;
      return avgPos >= strikingDistanceMinPos && avgPos <= strikingDistanceMaxPos;
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 200)
    .map((q) => {
      const avgPos = q.impressions > 0 ? q.posSum / q.impressions : 0;
      const avgCtr = q.impressions > 0 ? q.clicks / q.impressions : 0;
      const bestPath = q.bestPage ? pageToPath(q.bestPage, baseUrl, canonicalStrategy) : null;
      return {
        query: q.query,
        impressions28: q.impressions,
        clicks28: q.clicks,
        ctr28: avgCtr,
        pos28: avgPos,
        bestPagePath: bestPath,
      };
    });

  // ── C) Declining pages ──────────────────────────────────
  // Build pages7 lookup
  const pages7Map = {};
  for (const p of pages7) {
    pages7Map[p.page] = p;
  }

  const decliningPages = pages28
    .filter((p28) => {
      const baselineClicks7Expected = p28.clicks / 4;
      if (baselineClicks7Expected < minClicksForDeclineCheck) return false;

      const p7 = pages7Map[p28.page];
      if (!p7) return false; // Not appearing at all in 7d — could be decline, but might be data gap

      // Guard against seasonality: impressions should not have dropped too much
      const impressions7Expected = p28.impressions / 4;
      if (p7.impressions < impressions7Expected * 0.6) return false;

      return p7.clicks < baselineClicks7Expected * declineClickRatioThreshold;
    })
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 50)
    .map((p28) => {
      const p7 = pages7Map[p28.page];
      const path = pageToPath(p28.page, baseUrl, canonicalStrategy);
      return {
        path,
        clicks7: p7.clicks,
        expectedClicks7: Math.round(p28.clicks / 4),
        impressions7: p7.impressions,
        pos7: p7.positionWeighted,
        ctr7: p7.ctrWeighted,
      };
    });

  return {
    highImpressionsLowCtrPages,
    strikingDistanceQueries,
    decliningPages,
  };
}

/**
 * Build compact page snapshots for state persistence.
 */
export function buildPageSnapshots(gscResult, baseUrl, canonicalStrategy, maxPages = 300) {
  const { pages28 = [], pages7 = [] } = gscResult;

  // Sort by 28d impressions, take top N
  const top28 = [...pages28].sort((a, b) => b.impressions - a.impressions).slice(0, maxPages);

  // Build 7d lookup
  const pages7Map = {};
  for (const p of pages7) {
    pages7Map[p.page] = p;
  }

  const snapshots = {};
  for (const p28 of top28) {
    const path = pageToPath(p28.page, baseUrl, canonicalStrategy);
    if (!path) continue;

    const p7 = pages7Map[p28.page] || {};
    snapshots[path] = {
      impressions28: p28.impressions,
      clicks28: p28.clicks,
      ctr28: Math.round(p28.ctrWeighted * 10000) / 10000,
      pos28: Math.round(p28.positionWeighted * 10) / 10,
      impressions7: p7.impressions || 0,
      clicks7: p7.clicks || 0,
      ctr7: Math.round((p7.ctrWeighted || 0) * 10000) / 10000,
      pos7: Math.round((p7.positionWeighted || 0) * 10) / 10,
    };
  }

  return snapshots;
}
