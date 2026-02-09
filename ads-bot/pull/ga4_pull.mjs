#!/usr/bin/env node
/**
 * GA4 Data Pull
 * Pulls landing page engagement and conversion events.
 *
 * Required environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_KEY (JSON string or path to key file)
 *   GA4_PROPERTY_ID
 *
 * Output: /ops/snapshots/YYYY-MM-DD/ga4.json
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

async function pullGA4() {
  const date = daysAgo(1);
  const outDir = join(ROOT, 'ops', 'snapshots', date);
  await mkdir(outDir, { recursive: true });

  const propertyId = process.env.GA4_PROPERTY_ID;
  const keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!propertyId || !keyEnv) {
    console.warn('[ga4-pull] Missing GA4_PROPERTY_ID or GOOGLE_SERVICE_ACCOUNT_KEY. Writing empty snapshot.');
    const emptyData = { date, status: 'skipped', reason: 'Missing credentials', landingPages: [], events: [] };
    await writeFile(join(outDir, 'ga4.json'), JSON.stringify(emptyData, null, 2));
    return emptyData;
  }

  try {
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data');

    let credentials;
    try {
      credentials = JSON.parse(keyEnv);
    } catch {
      const keyContent = await readFile(keyEnv, 'utf-8');
      credentials = JSON.parse(keyContent);
    }

    const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });

    const startDate = daysAgo(1);
    const endDate = daysAgo(1);

    // Landing page metrics
    const [lpResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'landingPage' }],
      metrics: [
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'screenPageViews' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 100,
    });

    // Conversion events
    const [eventsResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }, { name: 'pagePath' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        orGroup: {
          expressions: [
            { filter: { fieldName: 'eventName', stringFilter: { value: 'form_submit' } } },
            { filter: { fieldName: 'eventName', stringFilter: { value: 'call_click' } } },
            { filter: { fieldName: 'eventName', stringFilter: { value: 'email_click' } } },
            { filter: { fieldName: 'eventName', stringFilter: { value: 'calculator_submit' } } },
            { filter: { fieldName: 'eventName', stringFilter: { value: 'cta_click' } } },
          ],
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 200,
    });

    const data = {
      date,
      status: 'success',
      landingPages: (lpResponse.rows || []).map(r => ({
        page: r.dimensionValues[0].value,
        sessions: Number(r.metricValues[0].value),
        engagedSessions: Number(r.metricValues[1].value),
        avgDuration: Number(r.metricValues[2].value),
        bounceRate: Number(r.metricValues[3].value),
        pageViews: Number(r.metricValues[4].value),
      })),
      events: (eventsResponse.rows || []).map(r => ({
        event: r.dimensionValues[0].value,
        page: r.dimensionValues[1].value,
        count: Number(r.metricValues[0].value),
      })),
    };

    await writeFile(join(outDir, 'ga4.json'), JSON.stringify(data, null, 2));
    console.log(`[ga4-pull] Wrote ${data.landingPages.length} landing pages, ${data.events.length} events to ${outDir}/ga4.json`);
    return data;
  } catch (err) {
    console.error('[ga4-pull] Error:', err.message);
    const errorData = { date, status: 'error', error: err.message, landingPages: [], events: [] };
    await writeFile(join(outDir, 'ga4.json'), JSON.stringify(errorData, null, 2));
    return errorData;
  }
}

export { pullGA4 };

if (process.argv[1] && process.argv[1].includes('ga4_pull')) {
  pullGA4();
}
