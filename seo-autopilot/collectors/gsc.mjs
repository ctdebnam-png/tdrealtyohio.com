/**
 * gsc.mjs
 *
 * Google Search Console data collector.
 * Pulls search analytics data and computes per-page metrics.
 * Never throws — always returns a result object.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { refreshAccessToken } from '../lib/oauth-refresh.mjs';
import { normalizePath } from '../lib/url-normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GSC_CONFIG_PATH = join(__dirname, '..', 'config', 'gsc.json');
const GSC_STATE_PATH = join(__dirname, '..', 'state', 'gsc-latest.json');

const SEARCH_ANALYTICS_URL = 'https://searchconsole.googleapis.com/webmasters/v3/sites';

function loadGscConfig() {
  try {
    return JSON.parse(readFileSync(GSC_CONFIG_PATH, 'utf-8'));
  } catch {
    return {
      lookbackDaysPrimary: 28,
      lookbackDaysShort: 7,
      maxRowsPerQuery: 25000,
    };
  }
}

function loadSiteConfig() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'config', 'site.json'), 'utf-8'));
  } catch {
    return { baseUrl: '', canonicalStrategy: 'slash' };
  }
}

/**
 * Format a date as YYYY-MM-DD.
 */
function formatDate(d) {
  return d.toISOString().split('T')[0];
}

/**
 * Get date range: [startDate, endDate] where endDate is N days ago and startDate is N+lookback days ago.
 * GSC data has ~3 day delay.
 */
function getDateRange(lookbackDays) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - 3); // 3-day data delay
  const start = new Date(end);
  start.setDate(start.getDate() - lookbackDays);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

/**
 * Call the Search Analytics API.
 */
async function querySearchAnalytics(siteUrl, accessToken, startDate, endDate, rowLimit) {
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const url = `${SEARCH_ANALYTICS_URL}/${encodedSiteUrl}/searchAnalytics/query`;

  const body = {
    startDate,
    endDate,
    dimensions: ['page', 'query'],
    rowLimit,
    startRow: 0,
    aggregationType: 'auto',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GSC API error: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.rows || []).map((row) => ({
    page: row.keys[0],
    query: row.keys[1],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
}

/**
 * Summarize rows by page.
 */
function summarizeByPage(rows, baseUrl, strategy) {
  const pageMap = {};

  for (const row of rows) {
    if (!pageMap[row.page]) {
      pageMap[row.page] = { page: row.page, clicks: 0, impressions: 0, posSum: 0 };
    }
    const p = pageMap[row.page];
    p.clicks += row.clicks;
    p.impressions += row.impressions;
    p.posSum += row.position * row.impressions;
  }

  return Object.values(pageMap).map((p) => ({
    page: p.page,
    clicks: p.clicks,
    impressions: p.impressions,
    ctrWeighted: p.impressions > 0 ? p.clicks / p.impressions : 0,
    positionWeighted: p.impressions > 0 ? p.posSum / p.impressions : 0,
  }));
}

/**
 * Compute totals from page summaries.
 */
function computeTotals(pages) {
  let clicks = 0;
  let impressions = 0;
  let posSum = 0;

  for (const p of pages) {
    clicks += p.clicks;
    impressions += p.impressions;
    posSum += p.positionWeighted * p.impressions;
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? posSum / impressions : 0,
  };
}

/**
 * Pull GSC data.
 *
 * @returns {Promise<object>} Result with ok, skipped, data, or error info
 */
export async function pullGscData() {
  const siteUrl = process.env.GSC_SITE_URL;
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  const refreshToken = process.env.GSC_REFRESH_TOKEN;

  // Check for missing secrets
  if (!siteUrl || !clientId || !clientSecret || !refreshToken) {
    const missing = [];
    if (!siteUrl) missing.push('GSC_SITE_URL');
    if (!clientId) missing.push('GSC_CLIENT_ID');
    if (!clientSecret) missing.push('GSC_CLIENT_SECRET');
    if (!refreshToken) missing.push('GSC_REFRESH_TOKEN');
    return {
      ok: false,
      skipped: true,
      reason: `missing_secrets: ${missing.join(', ')}`,
    };
  }

  // Get access token
  const tokenResult = await refreshAccessToken({ clientId, clientSecret, refreshToken });
  if (!tokenResult.accessToken) {
    return {
      ok: false,
      skipped: false,
      reason: `token_refresh_failed: ${tokenResult.error?.message || 'unknown'}`,
    };
  }

  const gscConfig = loadGscConfig();
  const siteConfig = loadSiteConfig();
  const accessToken = tokenResult.accessToken;

  try {
    // Pull 28-day data
    const range28 = getDateRange(gscConfig.lookbackDaysPrimary);
    const rows28 = await querySearchAnalytics(
      siteUrl, accessToken,
      range28.startDate, range28.endDate,
      gscConfig.maxRowsPerQuery,
    );

    // Pull 7-day data
    const range7 = getDateRange(gscConfig.lookbackDaysShort);
    const rows7 = await querySearchAnalytics(
      siteUrl, accessToken,
      range7.startDate, range7.endDate,
      gscConfig.maxRowsPerQuery,
    );

    // Summarize by page
    const pages28 = summarizeByPage(rows28, siteConfig.baseUrl, siteConfig.canonicalStrategy);
    const pages7 = summarizeByPage(rows7, siteConfig.baseUrl, siteConfig.canonicalStrategy);

    const totals28 = computeTotals(pages28);
    const totals7 = computeTotals(pages7);

    const pulledAt = new Date().toISOString();

    // Write full state to gsc-latest.json (gitignored)
    const fullState = {
      pulledAt,
      siteUrl,
      rows28Count: rows28.length,
      rows7Count: rows7.length,
      rows28,
      rows7,
      pages28,
      pages7,
    };
    writeFileSync(GSC_STATE_PATH, JSON.stringify(fullState, null, 2) + '\n', 'utf-8');

    // Return compact summary
    const sortByImpressions = (a, b) => b.impressions - a.impressions;
    return {
      ok: true,
      skipped: false,
      pulledAt,
      totals28,
      totals7,
      pages28Top: pages28.sort(sortByImpressions).slice(0, 50),
      pages7Top: pages7.sort(sortByImpressions).slice(0, 50),
      rows28,
      rows7,
      pages28,
      pages7,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      reason: `api_error: ${err.message}`,
    };
  }
}
