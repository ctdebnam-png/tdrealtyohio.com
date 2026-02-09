#!/usr/bin/env node
/**
 * Google Ads API Data Pull
 * Pulls yesterday's performance data for campaigns, ad groups, keywords, and search terms.
 *
 * Required environment variables:
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_REFRESH_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID
 *
 * Output: /ops/snapshots/YYYY-MM-DD/google-ads.json
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function pullGoogleAds() {
  const date = yesterday();
  const outDir = join(ROOT, 'ops', 'snapshots', date);
  await mkdir(outDir, { recursive: true });

  const config = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    clientId: process.env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID,
  };

  // Validate configuration
  const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.warn(`[ads-pull] Missing env vars: ${missing.join(', ')}. Writing empty snapshot.`);
    const emptyData = {
      date,
      status: 'skipped',
      reason: `Missing: ${missing.join(', ')}`,
      campaigns: [],
      adGroups: [],
      keywords: [],
      searchTerms: [],
    };
    await writeFile(join(outDir, 'google-ads.json'), JSON.stringify(emptyData, null, 2));
    return emptyData;
  }

  try {
    // Dynamic import to avoid failing when googleapis not installed
    const { GoogleAdsApi } = await import('@google-ads/api');

    const client = new GoogleAdsApi({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      developer_token: config.developerToken,
    });

    const customer = client.Customer({
      customer_id: config.customerId,
      refresh_token: config.refreshToken,
    });

    // Pull campaign performance
    const campaigns = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.search_impression_share
      FROM campaign
      WHERE segments.date = '${date}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `);

    // Pull ad group performance
    const adGroups = await customer.query(`
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.campaign.id,
        ad_group.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.average_cpc
      FROM ad_group
      WHERE segments.date = '${date}'
        AND ad_group.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `);

    // Pull keyword performance
    const keywords = await customer.query(`
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.ad_group.id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.average_cpc,
        ad_group_criterion.quality_info.quality_score
      FROM keyword_view
      WHERE segments.date = '${date}'
      ORDER BY metrics.cost_micros DESC
      LIMIT 200
    `);

    // Pull search terms
    const searchTerms = await customer.query(`
      SELECT
        search_term_view.search_term,
        search_term_view.ad_group.id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM search_term_view
      WHERE segments.date = '${date}'
      ORDER BY metrics.impressions DESC
      LIMIT 500
    `);

    const data = {
      date,
      status: 'success',
      campaigns: campaigns.map(c => ({
        id: c.campaign.id,
        name: c.campaign.name,
        status: c.campaign.status,
        impressions: Number(c.metrics.impressions),
        clicks: Number(c.metrics.clicks),
        cost: Number(c.metrics.cost_micros) / 1_000_000,
        conversions: Number(c.metrics.conversions),
        conversionValue: Number(c.metrics.conversions_value),
        impressionShare: Number(c.metrics.search_impression_share),
      })),
      adGroups: adGroups.map(ag => ({
        id: ag.ad_group.id,
        name: ag.ad_group.name,
        campaignId: ag.ad_group.campaign?.id,
        status: ag.ad_group.status,
        impressions: Number(ag.metrics.impressions),
        clicks: Number(ag.metrics.clicks),
        cost: Number(ag.metrics.cost_micros) / 1_000_000,
        conversions: Number(ag.metrics.conversions),
        avgCpc: Number(ag.metrics.average_cpc) / 1_000_000,
      })),
      keywords: keywords.map(k => ({
        text: k.ad_group_criterion.keyword.text,
        matchType: k.ad_group_criterion.keyword.match_type,
        adGroupId: k.ad_group_criterion.ad_group?.id,
        impressions: Number(k.metrics.impressions),
        clicks: Number(k.metrics.clicks),
        cost: Number(k.metrics.cost_micros) / 1_000_000,
        conversions: Number(k.metrics.conversions),
        avgCpc: Number(k.metrics.average_cpc) / 1_000_000,
        qualityScore: k.ad_group_criterion.quality_info?.quality_score || null,
      })),
      searchTerms: searchTerms.map(st => ({
        term: st.search_term_view.search_term,
        adGroupId: st.search_term_view.ad_group?.id,
        impressions: Number(st.metrics.impressions),
        clicks: Number(st.metrics.clicks),
        cost: Number(st.metrics.cost_micros) / 1_000_000,
        conversions: Number(st.metrics.conversions),
      })),
    };

    await writeFile(join(outDir, 'google-ads.json'), JSON.stringify(data, null, 2));
    console.log(`[ads-pull] Wrote ${data.campaigns.length} campaigns, ${data.searchTerms.length} search terms to ${outDir}/google-ads.json`);
    return data;
  } catch (err) {
    console.error('[ads-pull] Error:', err.message);
    const errorData = { date, status: 'error', error: err.message, campaigns: [], adGroups: [], keywords: [], searchTerms: [] };
    await writeFile(join(outDir, 'google-ads.json'), JSON.stringify(errorData, null, 2));
    return errorData;
  }
}

export { pullGoogleAds };

if (process.argv[1] && process.argv[1].includes('google_ads_pull')) {
  pullGoogleAds();
}
