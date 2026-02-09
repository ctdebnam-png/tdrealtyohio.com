#!/usr/bin/env node
/**
 * Combined data pull - runs all three API pulls in parallel.
 */

import { pullGoogleAds } from './google_ads_pull.mjs';
import { pullGSC } from './gsc_pull.mjs';
import { pullGA4 } from './ga4_pull.mjs';

async function pullAll() {
  console.log('[pull] Starting all data pulls...');

  const results = await Promise.allSettled([
    pullGoogleAds(),
    pullGSC(),
    pullGA4(),
  ]);

  const labels = ['Google Ads', 'GSC', 'GA4'];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[pull] ${labels[i]}: ${r.value.status}`);
    } else {
      console.error(`[pull] ${labels[i]}: FAILED - ${r.reason?.message}`);
    }
  });

  return {
    ads: results[0].status === 'fulfilled' ? results[0].value : null,
    gsc: results[1].status === 'fulfilled' ? results[1].value : null,
    ga4: results[2].status === 'fulfilled' ? results[2].value : null,
  };
}

export { pullAll };

pullAll();
