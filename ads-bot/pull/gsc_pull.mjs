#!/usr/bin/env node
/**
 * Google Search Console Data Pull
 * Pulls queries, pages, positions, CTR, and coverage issues.
 *
 * Required environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_KEY (JSON string or path to key file)
 *   GSC_SITE_URL (default: https://tdrealtyohio.com)
 *
 * Output: /ops/snapshots/YYYY-MM-DD/gsc.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function pullGSC() {
  const date = daysAgo(1);
  const outDir = join(ROOT, 'ops', 'snapshots', date);
  await mkdir(outDir, { recursive: true });

  const siteUrl = process.env.GSC_SITE_URL || 'https://tdrealtyohio.com';
  const keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!keyEnv) {
    console.warn('[gsc-pull] Missing GOOGLE_SERVICE_ACCOUNT_KEY. Writing empty snapshot.');
    const emptyData = { date, status: 'skipped', reason: 'Missing credentials', queries: [], pages: [] };
    await writeFile(join(outDir, 'gsc.json'), JSON.stringify(emptyData, null, 2));
    return emptyData;
  }

  try {
    const { google } = await import('googleapis');

    let credentials;
    try {
      credentials = JSON.parse(keyEnv);
    } catch {
      const keyContent = await readFile(keyEnv, 'utf-8');
      credentials = JSON.parse(keyContent);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // Pull search analytics - queries (last 7 days for statistical significance)
    const startDate = daysAgo(7);
    const endDate = daysAgo(1);

    const queryResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 1000,
        dataState: 'all',
      },
    });

    // Pull search analytics - pages
    const pageResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 500,
        dataState: 'all',
      },
    });

    // Pull search analytics - query + page combos for target queries
    const targetQueries = [
      '1 percent commission', 'full-service representation', 'low commission realtor',
      'sell home westerville', 'sell home columbus', 'discount real estate',
      'flat fee mls ohio', 'first time homebuyer buyer support',
    ];

    const queryPageResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        dimensionFilterGroups: [{
          filters: targetQueries.map(q => ({
            dimension: 'query',
            operator: 'contains',
            expression: q,
          })),
        }],
        rowLimit: 500,
        dataState: 'all',
      },
    });

    const data = {
      date,
      dateRange: { startDate, endDate },
      status: 'success',
      queries: (queryResponse.data.rows || []).map(r => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      pages: (pageResponse.data.rows || []).map(r => ({
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      queryPageCombos: (queryPageResponse.data.rows || []).map(r => ({
        query: r.keys[0],
        page: r.keys[1],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
    };

    await writeFile(join(outDir, 'gsc.json'), JSON.stringify(data, null, 2));
    console.log(`[gsc-pull] Wrote ${data.queries.length} queries, ${data.pages.length} pages to ${outDir}/gsc.json`);
    return data;
  } catch (err) {
    console.error('[gsc-pull] Error:', err.message);
    const errorData = { date, status: 'error', error: err.message, queries: [], pages: [] };
    await writeFile(join(outDir, 'gsc.json'), JSON.stringify(errorData, null, 2));
    return errorData;
  }
}

export { pullGSC };

if (process.argv[1] && process.argv[1].includes('gsc_pull')) {
  pullGSC();
}
