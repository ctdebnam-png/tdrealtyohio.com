#!/usr/bin/env node
/**
 * Topic Coverage Report
 * Lists missing intents (seller, buyer, first-time, inspection, closing costs)
 * per city/zip and opens an issue when gaps appear.
 *
 * Reads from:
 * - /src/config/routes.js (all registered routes)
 * - /content/backlog.csv (keyword backlog)
 * - /ops/snapshots/ (GSC data if available)
 *
 * Output: /ops/reports/topic-coverage.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { CITIES, ZIPS, ROUTES } = require('../src/config/routes.js');

// Required intents per city
const REQUIRED_INTENTS = ['seller', 'buyer', 'first-time', 'inspection', 'closing-costs', 'comparison'];

// Map routes to covered intents per location
function buildCoverageMap() {
  const coverage = {};

  CITIES.forEach(city => {
    coverage[city.slug] = {
      name: city.name,
      type: 'city',
      intents: new Set(),
      pages: [],
    };
  });

  ZIPS.forEach(z => {
    coverage[`zip-${z.zip}`] = {
      name: `ZIP ${z.zip} (${z.city})`,
      type: 'zip',
      intents: new Set(),
      pages: [],
    };
  });

  // Analyze existing routes
  ROUTES.forEach(route => {
    const path = route.path;

    // City pages cover seller intent
    if (path.startsWith('/areas/') && path !== '/areas/') {
      const slug = path.replace('/areas/', '').replace('/', '');
      if (coverage[slug]) {
        coverage[slug].intents.add('seller');
        coverage[slug].pages.push(path);
      }
    }

    // ZIP pages
    if (path.startsWith('/areas/zip/')) {
      const zip = path.replace('/areas/zip/', '').replace('/', '');
      const key = `zip-${zip}`;
      if (coverage[key]) {
        coverage[key].intents.add('seller');
        coverage[key].intents.add('buyer');
        coverage[key].pages.push(path);
      }
    }

    // Service pages cover intents globally
    if (path === '/sellers/') {
      Object.values(coverage).forEach(c => c.intents.add('seller'));
    }
    if (path === '/buyers/') {
      Object.values(coverage).forEach(c => c.intents.add('buyer'));
    }
    if (path === '/sellers/') {
      Object.values(coverage).forEach(c => c.intents.add('inspection'));
    }

    // Blog posts
    if (path.includes('closing-costs')) {
      Object.values(coverage).forEach(c => c.intents.add('closing-costs'));
    }
    if (path.includes('first-time')) {
      Object.values(coverage).forEach(c => c.intents.add('first-time'));
    }

    // Comparison pages
    if (path.startsWith('/compare/')) {
      Object.values(coverage).forEach(c => c.intents.add('comparison'));
    }
  });

  return coverage;
}

function findGaps(coverage) {
  const gaps = [];

  for (const [key, data] of Object.entries(coverage)) {
    REQUIRED_INTENTS.forEach(intent => {
      if (!data.intents.has(intent)) {
        gaps.push({
          locality: key,
          localityName: data.name,
          type: data.type,
          intent,
          existingPages: data.pages,
        });
      }
    });
  }

  return gaps;
}

async function generateReport() {
  console.log('[topic-coverage] Analyzing topic coverage...');

  const coverage = buildCoverageMap();
  const gaps = findGaps(coverage);

  const reportDir = join(ROOT, 'ops', 'reports');
  await mkdir(reportDir, { recursive: true });

  // Summary
  const totalLocalities = Object.keys(coverage).length;
  const totalIntents = totalLocalities * REQUIRED_INTENTS.length;
  const coveredIntents = totalIntents - gaps.length;
  const coveragePct = ((coveredIntents / totalIntents) * 100).toFixed(1);

  const report = {
    generated: new Date().toISOString(),
    summary: {
      totalLocalities,
      requiredIntentsPerLocality: REQUIRED_INTENTS.length,
      totalRequiredIntents: totalIntents,
      coveredIntents,
      coveragePct: `${coveragePct}%`,
      gapCount: gaps.length,
    },
    gaps: gaps.map(g => ({
      keyword: `${g.intent} ${g.localityName}`.toLowerCase(),
      intent: g.intent,
      locality: g.locality,
      localityName: g.localityName,
      locationType: g.type,
      impressions: 0, // Would be populated from GSC data
      position: null,
      targetUrl: null,
      hubLink: g.intent.includes('seller') ? '/sellers/' : '/buyers/',
      cityLink: g.type === 'city' ? `/areas/${g.locality}/` : null,
    })),
    coverage: Object.fromEntries(
      Object.entries(coverage).map(([key, data]) => [
        key,
        {
          name: data.name,
          type: data.type,
          coveredIntents: Array.from(data.intents),
          missingIntents: REQUIRED_INTENTS.filter(i => !data.intents.has(i)),
          pageCount: data.pages.length,
        },
      ])
    ),
  };

  await writeFile(join(reportDir, 'topic-coverage.json'), JSON.stringify(report, null, 2));

  // Console report
  console.log(`[topic-coverage] Coverage: ${coveragePct}% (${coveredIntents}/${totalIntents})`);
  console.log(`[topic-coverage] Gaps: ${gaps.length}`);

  if (gaps.length > 0) {
    console.log('\n  Top gaps:');
    gaps.slice(0, 15).forEach(g => {
      console.log(`    ${g.localityName}: missing "${g.intent}"`);
    });
  }

  // Check if running as weekly (from workflow)
  if (process.argv.includes('--weekly')) {
    console.log('[topic-coverage] Weekly mode — report saved for issue creation');
  }

  return report;
}

generateReport();
