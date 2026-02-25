#!/usr/bin/env node

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const GSC_DIR = join(ROOT, 'output', 'gsc-reports');
const OUTPUT_DIR = join(ROOT, 'output', 'blog-briefs');

// ---------------------------------------------------------------------------
// Scoring rubric
// ---------------------------------------------------------------------------
const RUBRIC_WEIGHTS = {
  searchVolume: 0.25,
  currentPosition: 0.20,
  competitorPresence: 0.15,
  contentFreshness: 0.15,
  conversionPotential: 0.25,
};

// ---------------------------------------------------------------------------
// Default underperforming keywords (used when no feedback file exists)
// ---------------------------------------------------------------------------
const DEFAULT_KEYWORDS = [
  { keyword: 'how to sell home without realtor Columbus Ohio', position: null, impressions: 0 },
  { keyword: 'Columbus Ohio housing market forecast', position: 15, impressions: 200 },
  { keyword: 'best time to sell house Columbus', position: 12, impressions: 150 },
  { keyword: 'home staging tips Columbus Ohio', position: null, impressions: 0 },
  { keyword: 'closing costs Ohio seller', position: 18, impressions: 100 },
  { keyword: 'seller preparation worth it', position: 8, impressions: 80 },
  { keyword: 'sell home as is Columbus', position: null, impressions: 0 },
  { keyword: 'property tax Columbus Ohio', position: 20, impressions: 90 },
  { keyword: 'first time home buyer Ohio programs', position: 14, impressions: 250 },
  { keyword: 'how much commission real estate agent Ohio', position: 6, impressions: 300 },
];

// ---------------------------------------------------------------------------
// Internal link targets (pages that already exist on the site)
// ---------------------------------------------------------------------------
const INTERNAL_LINKS = [
  { url: '/', label: 'Home' },
  { url: '/about', label: 'About TD Realty' },
  { url: '/services', label: 'Our Services' },
  { url: '/contact', label: 'Contact Us' },
  { url: '/listings', label: 'Current Listings' },
  { url: '/blog', label: 'Blog' },
  { url: '/communities/columbus', label: 'Columbus Community Guide' },
  { url: '/communities/dublin', label: 'Dublin Community Guide' },
  { url: '/communities/westerville', label: 'Westerville Community Guide' },
  { url: '/communities/grove-city', label: 'Grove City Community Guide' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load the most recent feedback JSON from the GSC reports directory.
 * Returns null if nothing is found.
 */
async function loadFeedbackData() {
  let files;
  try {
    files = await readdir(GSC_DIR);
  } catch {
    return null;
  }

  // Prefer feedback_latest.json, then the most recent feedback_*.json
  if (files.includes('feedback_latest.json')) {
    const raw = await readFile(join(GSC_DIR, 'feedback_latest.json'), 'utf-8');
    return JSON.parse(raw);
  }

  const feedbackFiles = files
    .filter((f) => /^feedback_.*\.json$/.test(f))
    .sort()
    .reverse();

  if (feedbackFiles.length === 0) return null;

  const raw = await readFile(join(GSC_DIR, feedbackFiles[0]), 'utf-8');
  return JSON.parse(raw);
}

/**
 * Extract underperforming keyword rows from a feedback payload.
 * Feedback files may vary in shape; we try common structures.
 */
function extractKeywords(feedback) {
  if (!feedback) return null;

  // Direct array of keyword objects
  if (Array.isArray(feedback)) {
    return feedback.map(normalizeRow);
  }

  // Nested under common keys
  for (const key of ['keywords', 'underperforming', 'rows', 'queries', 'data']) {
    if (Array.isArray(feedback[key])) {
      return feedback[key].map(normalizeRow);
    }
  }

  return null;
}

function normalizeRow(row) {
  return {
    keyword: row.keyword || row.query || row.keys?.[0] || '',
    position: row.position ?? row.avg_position ?? null,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    ctr: row.ctr ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Scoring functions – each returns a value between 0 and 1
// ---------------------------------------------------------------------------

function scoreSearchVolume(impressions) {
  // Cap at 500 for normalization
  return Math.min(impressions / 500, 1);
}

function scoreCurrentPosition(position) {
  if (position === null || position === undefined) {
    // No ranking yet — big opportunity
    return 0.8;
  }
  // Sweet spot: positions 5-20 have the highest optimization opportunity
  if (position >= 5 && position <= 20) {
    // Peak at position 11, tapering at edges
    const dist = Math.abs(position - 11);
    return Math.max(0, 1 - dist / 15);
  }
  if (position < 5) return 0.3; // already ranking well
  return 0.2; // beyond page 2, harder to move
}

function scoreCompetitorPresence(keyword) {
  // Heuristic: longer-tail keywords have fewer competitors
  const words = keyword.trim().split(/\s+/).length;
  if (words >= 6) return 0.9;
  if (words >= 4) return 0.7;
  if (words >= 3) return 0.5;
  return 0.3;
}

function scoreContentFreshness(_keyword) {
  // Without real freshness data, assume content is stale (opportunity)
  return 0.6;
}

function scoreConversionPotential(keyword) {
  const kw = keyword.toLowerCase();
  const highIntent = ['sell', 'buy', 'listing', 'commission', 'closing cost', 'agent', 'realtor', 'first time home buyer', 'programs'];
  const medIntent = ['market', 'forecast', 'staging', 'inspection', 'worth', 'tax', 'as is'];

  if (highIntent.some((t) => kw.includes(t))) return 1.0;
  if (medIntent.some((t) => kw.includes(t))) return 0.6;
  return 0.3;
}

function computePriorityScore(row) {
  const scores = {
    searchVolume: scoreSearchVolume(row.impressions),
    currentPosition: scoreCurrentPosition(row.position),
    competitorPresence: scoreCompetitorPresence(row.keyword),
    contentFreshness: scoreContentFreshness(row.keyword),
    conversionPotential: scoreConversionPotential(row.keyword),
  };

  let total = 0;
  for (const [key, weight] of Object.entries(RUBRIC_WEIGHTS)) {
    total += scores[key] * weight;
  }

  return { total: Math.round(total * 100) / 100, breakdown: scores };
}

// ---------------------------------------------------------------------------
// Brief generation
// ---------------------------------------------------------------------------

function pickSchemaType(keyword) {
  const kw = keyword.toLowerCase();
  if (/how|guide|tips|steps/.test(kw)) return 'HowTo';
  if (/what|cost|worth|much/.test(kw)) return 'FAQPage';
  if (/best|top|forecast/.test(kw)) return 'Article';
  return 'BlogPosting';
}

function generateHeadings(keyword) {
  const kw = keyword.toLowerCase();
  const headings = [];

  // Context-aware heading generation
  if (kw.includes('sell')) {
    headings.push(
      'Understanding the Columbus Ohio Real Estate Market',
      'Step-by-Step Process for Sellers',
      'Common Mistakes to Avoid',
      'How TD Realty Can Help You Sell Faster',
    );
  } else if (kw.includes('buy') || kw.includes('first time home buyer')) {
    headings.push(
      'Overview of the Home Buying Process in Ohio',
      'Programs and Incentives Available to Buyers',
      'What to Expect at Closing',
      'Neighborhood Guides for Columbus Area',
    );
  } else if (kw.includes('market') || kw.includes('forecast')) {
    headings.push(
      'Current Columbus Housing Market Trends',
      'Price Trends and Inventory Levels',
      'Expert Predictions for the Coming Year',
      'What This Means for Buyers and Sellers',
    );
  } else if (kw.includes('staging') || kw.includes('inspection')) {
    headings.push(
      'Why This Matters for Columbus Home Sellers',
      'Cost vs. Return on Investment',
      'Professional Tips from Local Experts',
      'Frequently Asked Questions',
    );
  } else if (kw.includes('cost') || kw.includes('commission') || kw.includes('tax')) {
    headings.push(
      'Breaking Down the Numbers',
      'What Ohio Law Requires',
      'How to Minimize Your Out-of-Pocket Expenses',
      'Comparing Options in the Columbus Market',
    );
  } else {
    headings.push(
      `What You Need to Know About ${titleCase(keyword)}`,
      'Key Factors for Columbus Ohio Homeowners',
      'Expert Advice and Local Insights',
      'Next Steps and Resources',
    );
  }

  return headings;
}

function titleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function suggestTitle(keyword) {
  const kw = keyword.toLowerCase();
  if (kw.includes('how')) return titleCase(keyword) + ': A Complete Guide';
  if (kw.includes('best')) return titleCase(keyword) + ' — Expert Tips';
  if (kw.includes('forecast')) return titleCase(keyword) + ': What to Expect';
  return titleCase(keyword) + ' | TD Realty Ohio';
}

function pickInternalLinks(keyword) {
  const kw = keyword.toLowerCase();
  const links = [{ url: '/blog', label: 'Blog' }];

  if (kw.includes('sell') || kw.includes('listing') || kw.includes('staging')) {
    links.push({ url: '/services', label: 'Our Services' });
  }
  if (kw.includes('buy') || kw.includes('home buyer')) {
    links.push({ url: '/listings', label: 'Current Listings' });
  }
  if (kw.includes('columbus')) {
    links.push({ url: '/communities/columbus', label: 'Columbus Community Guide' });
  }
  links.push({ url: '/contact', label: 'Contact Us' });

  // Deduplicate by url
  const seen = new Set();
  return links.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

function wordCountTarget(score) {
  // Higher priority = longer, more comprehensive content
  if (score >= 0.7) return 2000;
  if (score >= 0.5) return 1500;
  return 1200;
}

function generateBrief(row) {
  const { total, breakdown } = computePriorityScore(row);
  return {
    suggestedTitle: suggestTitle(row.keyword),
    targetKeyword: row.keyword,
    suggestedH2Headings: generateHeadings(row.keyword),
    wordCountTarget: wordCountTarget(total),
    internalLinks: pickInternalLinks(row.keyword),
    schemaType: pickSchemaType(row.keyword),
    priorityScore: total,
    scoreBreakdown: breakdown,
    sourceMetrics: {
      position: row.position,
      impressions: row.impressions,
      clicks: row.clicks ?? null,
      ctr: row.ctr ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[blog-brief-generator] Starting...');

  // 1. Try to load feedback data
  const feedback = await loadFeedbackData();
  let keywords = extractKeywords(feedback);

  if (keywords && keywords.length > 0) {
    console.log(`[blog-brief-generator] Loaded ${keywords.length} keywords from feedback data.`);
  } else {
    console.log('[blog-brief-generator] No feedback data found — using default keywords.');
    keywords = DEFAULT_KEYWORDS;
  }

  // 2. Generate briefs
  const briefs = keywords
    .filter((r) => r.keyword)
    .map(generateBrief)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const output = {
    generatedAt: new Date().toISOString(),
    rubricWeights: RUBRIC_WEIGHTS,
    totalBriefs: briefs.length,
    briefs,
  };

  // 3. Write output
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, 'latest.json');
  await writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`[blog-brief-generator] Generated ${briefs.length} briefs → ${outPath}`);
  console.log('[blog-brief-generator] Top 3 by priority:');
  for (const b of briefs.slice(0, 3)) {
    console.log(`  ${b.priorityScore.toFixed(2)}  ${b.targetKeyword}`);
  }
}

main().catch((err) => {
  console.error('[blog-brief-generator] Fatal error:', err);
  process.exit(1);
});
