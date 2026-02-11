/**
 * conversion-attribution.mjs
 *
 * Simple path-level conversion attribution.
 * Computes conversions by page, conversion rate proxy,
 * money page conversion share, and week-over-week deltas.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Compute conversion attribution from daily summaries.
 *
 * @param {object} options
 * @param {object[]} options.days - Array of { date, totals, topPaths }
 * @param {number}   [options.gscClicks7] - GSC clicks last 7 days (for rate proxy)
 * @returns {{
 *   last7: { totals: object, totalConversions: number, topPaths: object[], conversionRateProxy: number },
 *   prior7: { totals: object, totalConversions: number },
 *   deltas: { totalDeltaPct: number, formSubmitDeltaPct: number },
 *   moneyPageShare: number,
 *   moneyPageConversions: number,
 *   insufficientData: boolean
 * }}
 */
export function computeConversionAttribution({ days = [], gscClicks7 = 0 } = {}) {
  const siteConfig = loadJson(SITE_CONFIG_PATH, { moneyRoutes: [] });
  const moneyRoutes = new Set(siteConfig.moneyRoutes || []);

  // Sort days by date descending
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));

  // Split into last 7 and prior 7
  const last7Days = sorted.slice(0, 7);
  const prior7Days = sorted.slice(7, 14);

  if (last7Days.length < 3) {
    return {
      last7: { totals: {}, totalConversions: 0, topPaths: [], conversionRateProxy: 0 },
      prior7: { totals: {}, totalConversions: 0 },
      deltas: { totalDeltaPct: 0, formSubmitDeltaPct: 0 },
      moneyPageShare: 0,
      moneyPageConversions: 0,
      insufficientData: true,
    };
  }

  // Aggregate last 7
  const last7Totals = aggregateTotals(last7Days);
  const last7TotalConv = sumConversions(last7Totals);
  const last7PathMap = aggregatePathCounts(last7Days);

  // Aggregate prior 7
  const prior7Totals = aggregateTotals(prior7Days);
  const prior7TotalConv = sumConversions(prior7Totals);

  // Top 20 paths by conversion count
  const topPaths = [...last7PathMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path, count]) => ({ path, count }));

  // Conversion rate proxy: conversions / GSC clicks (sitewide)
  const conversionRateProxy = gscClicks7 > 10
    ? last7TotalConv / gscClicks7
    : 0;

  // Money page conversion share
  let moneyPageConversions = 0;
  for (const [path, count] of last7PathMap.entries()) {
    // Normalize path to match money routes
    const normalized = path.endsWith('/') ? path : path + '/';
    if (moneyRoutes.has(normalized)) {
      moneyPageConversions += count;
    }
  }
  const moneyPageShare = last7TotalConv > 0
    ? moneyPageConversions / last7TotalConv
    : 0;

  // Week-over-week deltas
  const totalDeltaPct = prior7TotalConv > 5
    ? (last7TotalConv - prior7TotalConv) / prior7TotalConv
    : 0;

  const last7FormSubmit = last7Totals.form_submit || 0;
  const prior7FormSubmit = prior7Totals.form_submit || 0;
  const formSubmitDeltaPct = prior7FormSubmit > 3
    ? (last7FormSubmit - prior7FormSubmit) / prior7FormSubmit
    : 0;

  return {
    last7: {
      totals: last7Totals,
      totalConversions: last7TotalConv,
      topPaths,
      conversionRateProxy: Math.round(conversionRateProxy * 10000) / 10000,
    },
    prior7: {
      totals: prior7Totals,
      totalConversions: prior7TotalConv,
    },
    deltas: {
      totalDeltaPct: Math.round(totalDeltaPct * 1000) / 1000,
      formSubmitDeltaPct: Math.round(formSubmitDeltaPct * 1000) / 1000,
    },
    moneyPageShare: Math.round(moneyPageShare * 1000) / 1000,
    moneyPageConversions,
    insufficientData: false,
  };
}

/**
 * Aggregate totals across days.
 */
function aggregateTotals(days) {
  const totals = {};
  for (const day of days) {
    if (!day.totals) continue;
    for (const [event, count] of Object.entries(day.totals)) {
      totals[event] = (totals[event] || 0) + count;
    }
  }
  return totals;
}

/**
 * Sum all conversion event counts.
 */
function sumConversions(totals) {
  return (totals.form_submit || 0) +
    (totals.call_click || 0) +
    (totals.email_click || 0) +
    (totals.calculator_submit || 0);
}

/**
 * Aggregate path-level conversion counts across days.
 */
function aggregatePathCounts(days) {
  const pathMap = new Map();
  for (const day of days) {
    if (!day.topPaths) continue;
    for (const { path, count } of day.topPaths) {
      pathMap.set(path, (pathMap.get(path) || 0) + count);
    }
  }
  return pathMap;
}
