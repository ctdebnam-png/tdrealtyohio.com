#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output', 'competitor-analysis');

const TARGET_KEYWORDS = [
  '1 percent commission realtor Columbus Ohio',
  'low commission real estate agent Columbus',
  'sell home Columbus Ohio',
  'discount realtor Columbus OH',
  'flat fee MLS Columbus Ohio',
  '1% listing agent Ohio',
  'best realtor Westerville Ohio',
  'sell home Dublin Ohio',
  'real estate agent Powell Ohio',
  'home value Columbus Ohio',
  'seller preparation Columbus',
  'sell and buy same agent Columbus',
  'first time homebuyer Columbus Ohio',
  'cash back buyer agent Columbus',
  'Columbus Ohio housing market 2026',
  'sell home Grove City Ohio',
  'real estate agent Hilliard Ohio',
  'Upper Arlington homes for sale',
  'New Albany Ohio real estate',
  'Gahanna Ohio realtor',
];

const COMPETITORS = [
  { name: 'Houwzer', domain: 'houwzer.com' },
  { name: 'Redfin', domain: 'redfin.com' },
  { name: 'Clever Real Estate', domain: 'listwithclever.com' },
  { name: 'Ideal Agent', domain: 'idealagent.com' },
  { name: 'HomeLight', domain: 'homelight.com' },
  { name: 'Zillow', domain: 'zillow.com' },
  { name: 'Realtor.com', domain: 'realtor.com' },
];

const OUR_DOMAIN = 'tdrealtyohio.com';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, apiKey: null, cx: null, serpApiKey: null };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--api-key':
        opts.apiKey = args[++i];
        break;
      case '--cx':
        opts.cx = args[++i];
        break;
      case '--serpapi-key':
        opts.serpApiKey = args[++i];
        break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Google Custom Search API
// ---------------------------------------------------------------------------
async function searchGoogle(keyword, apiKey, cx) {
  const q = encodeURIComponent(keyword);
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${q}&num=10&gl=us`;
  const data = await httpsGet(url);
  return (data.items || []).map((item, idx) => ({
    position: idx + 1,
    link: item.link,
    domain: new URL(item.link).hostname.replace(/^www\./, ''),
    title: item.title,
    snippet: item.snippet || '',
  }));
}

// ---------------------------------------------------------------------------
// SerpAPI fallback
// ---------------------------------------------------------------------------
async function searchSerpApi(keyword, serpApiKey) {
  const q = encodeURIComponent(keyword);
  const url = `https://serpapi.com/search.json?engine=google&q=${q}&api_key=${serpApiKey}&gl=us&num=10`;
  const data = await httpsGet(url);
  return (data.organic_results || []).map((item) => ({
    position: item.position,
    link: item.link,
    domain: new URL(item.link).hostname.replace(/^www\./, ''),
    title: item.title,
    snippet: item.snippet || '',
  }));
}

// ---------------------------------------------------------------------------
// Dry-run: generate plausible template data
// ---------------------------------------------------------------------------
function generateDryRunResults(keyword) {
  // Deterministic pseudo-random seed from keyword string
  let seed = 0;
  for (const ch of keyword) seed = ((seed << 5) - seed + ch.charCodeAt(0)) | 0;
  const rng = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed & 0x7fffffff) / 2147483647;
  };

  const pool = [...COMPETITORS];
  // Possibly include our own site
  if (rng() > 0.55) {
    pool.push({ name: 'TD Realty Ohio', domain: OUR_DOMAIN });
  }
  // Shuffle and take up to 8
  pool.sort(() => rng() - 0.5);
  const count = Math.min(pool.length, 3 + Math.floor(rng() * 6));
  return pool.slice(0, count).map((c, idx) => ({
    position: idx + 1,
    link: `https://www.${c.domain}/`,
    domain: c.domain,
    title: `${c.name} - ${keyword}`,
    snippet: `[dry-run] Simulated result for "${keyword}"`,
  }));
}

// ---------------------------------------------------------------------------
// Analysis helpers
// ---------------------------------------------------------------------------
function buildPositionMatrix(allResults) {
  // keyword -> { competitorDomain: position | null }
  const matrix = {};
  for (const { keyword, results } of allResults) {
    const row = { keyword };
    // Our position
    const ours = results.find((r) => r.domain === OUR_DOMAIN || r.domain === `www.${OUR_DOMAIN}`);
    row[OUR_DOMAIN] = ours ? ours.position : null;
    for (const comp of COMPETITORS) {
      const match = results.find((r) => r.domain === comp.domain || r.domain === `www.${comp.domain}`);
      row[comp.domain] = match ? match.position : null;
    }
    matrix[keyword] = row;
  }
  return matrix;
}

function identifyContentGaps(matrix) {
  const gaps = [];
  for (const [keyword, row] of Object.entries(matrix)) {
    if (row[OUR_DOMAIN] != null) continue; // we already rank
    const competitorsRanking = COMPETITORS.filter((c) => row[c.domain] != null).map((c) => ({
      name: c.name,
      domain: c.domain,
      position: row[c.domain],
    }));
    if (competitorsRanking.length > 0) {
      gaps.push({ keyword, competitorsRanking });
    }
  }
  // Sort by number of competitors ranking (most competitive gaps first)
  gaps.sort((a, b) => b.competitorsRanking.length - a.competitorsRanking.length);
  return gaps;
}

function generateRecommendations(gaps, matrix) {
  const recommendations = [];

  // Map keywords to likely page types
  const pageTypeMap = {
    'sell home': '/sell',
    'home value': '/home-value',
    'first time homebuyer': '/buy',
    'cash back buyer': '/buy',
    'housing market': '/blog',
    'seller preparation': '/blog',
    'sell and buy same agent': '/about',
    'flat fee MLS': '/flat-fee-mls',
    'commission': '/',
    'discount realtor': '/',
    'listing agent': '/',
  };

  const cityPattern = /\b(Westerville|Dublin|Powell|Grove City|Hilliard|Upper Arlington|New Albany|Gahanna|Columbus)\b/i;

  for (const gap of gaps) {
    const kw = gap.keyword;
    const cityMatch = kw.match(cityPattern);
    const city = cityMatch ? cityMatch[1] : null;

    let action = 'create';
    let targetPage = null;
    let suggestion = '';

    // Check if there is an existing page that could be optimised
    for (const [fragment, pagePath] of Object.entries(pageTypeMap)) {
      if (kw.toLowerCase().includes(fragment)) {
        targetPage = pagePath;
        break;
      }
    }

    if (city && city.toLowerCase() !== 'columbus') {
      const slug = city.toLowerCase().replace(/\s+/g, '-');
      suggestion = `Create or enhance city page at /cities/${slug} targeting "${kw}". Include local market stats and neighbourhood-specific FAQ schema.`;
      action = 'create_city_page';
      targetPage = `/cities/${slug}`;
    } else if (targetPage) {
      suggestion = `Optimise existing page ${targetPage} for keyword "${kw}". Add dedicated H2 section, FAQ schema, and internal links.`;
      action = 'optimise_existing';
    } else {
      suggestion = `Create new blog post or landing page targeting "${kw}". Focus on local Columbus Ohio relevance and 1% commission value prop.`;
      action = 'create_content';
      targetPage = `/blog/${kw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;
    }

    recommendations.push({
      keyword: kw,
      action,
      targetPage,
      suggestion,
      competitorCount: gap.competitorsRanking.length,
      topCompetitor: gap.competitorsRanking[0]?.name || null,
    });
  }

  // Sort: city pages first, then by competitor count
  recommendations.sort((a, b) => {
    if (a.action === 'create_city_page' && b.action !== 'create_city_page') return -1;
    if (b.action === 'create_city_page' && a.action !== 'create_city_page') return 1;
    return b.competitorCount - a.competitorCount;
  });

  return recommendations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();
  const timestamp = new Date().toISOString();

  console.log('=== TD Realty Ohio - Competitor Analysis ===');
  console.log(`Mode: ${opts.dryRun ? 'DRY RUN (no API calls)' : 'LIVE'}`);
  console.log(`Keywords: ${TARGET_KEYWORDS.length}`);
  console.log(`Competitors: ${COMPETITORS.length}`);
  console.log('');

  // Choose search function
  let searchFn;
  if (opts.dryRun) {
    searchFn = async (kw) => generateDryRunResults(kw);
  } else if (opts.apiKey && opts.cx) {
    searchFn = (kw) => searchGoogle(kw, opts.apiKey, opts.cx);
  } else if (opts.serpApiKey) {
    searchFn = (kw) => searchSerpApi(kw, opts.serpApiKey);
  } else {
    console.error(
      'Error: Provide --api-key and --cx (Google Custom Search), --serpapi-key (SerpAPI), or --dry-run.'
    );
    process.exit(1);
  }

  // Run searches
  const allResults = [];
  for (const keyword of TARGET_KEYWORDS) {
    process.stdout.write(`  Searching: "${keyword}" ... `);
    try {
      const results = await searchFn(keyword);
      allResults.push({ keyword, results });
      console.log(`${results.length} results`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      allResults.push({ keyword, results: [], error: err.message });
    }
    // Polite delay for live calls
    if (!opts.dryRun) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  // Build analysis
  const matrix = buildPositionMatrix(allResults);
  const contentGaps = identifyContentGaps(matrix);
  const recommendations = generateRecommendations(contentGaps, matrix);

  // Summary stats
  const keywordsWeRank = Object.values(matrix).filter((r) => r[OUR_DOMAIN] != null).length;
  const avgPosition =
    keywordsWeRank > 0
      ? (
          Object.values(matrix)
            .filter((r) => r[OUR_DOMAIN] != null)
            .reduce((sum, r) => sum + r[OUR_DOMAIN], 0) / keywordsWeRank
        ).toFixed(1)
      : null;

  const report = {
    meta: {
      timestamp,
      mode: opts.dryRun ? 'dry-run' : 'live',
      keywordsSearched: TARGET_KEYWORDS.length,
      competitorsTracked: COMPETITORS.length,
    },
    summary: {
      keywordsWeRank,
      keywordsWeDoNotRank: TARGET_KEYWORDS.length - keywordsWeRank,
      averagePosition: avgPosition,
      contentGapsFound: contentGaps.length,
      recommendationsGenerated: recommendations.length,
    },
    positionMatrix: matrix,
    contentGaps,
    recommendations,
    rawResults: allResults,
  };

  // Write output
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, 'latest.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('');
  console.log('--- Summary ---');
  console.log(`Keywords where TD Realty ranks:     ${keywordsWeRank} / ${TARGET_KEYWORDS.length}`);
  console.log(`Average position (where ranking):   ${avgPosition || 'N/A'}`);
  console.log(`Content gaps identified:            ${contentGaps.length}`);
  console.log(`Recommendations:                    ${recommendations.length}`);
  console.log('');

  if (recommendations.length > 0) {
    console.log('--- Top Recommendations ---');
    for (const rec of recommendations.slice(0, 5)) {
      console.log(`  [${rec.action}] ${rec.targetPage}`);
      console.log(`    ${rec.suggestion}`);
      console.log('');
    }
  }

  console.log(`Report saved to: ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
