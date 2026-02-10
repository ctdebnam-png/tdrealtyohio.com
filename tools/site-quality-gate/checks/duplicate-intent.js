/**
 * Duplicate Intent Check
 * Detects pages in /areas and /compare that target the same intent cluster
 * without sufficient differentiating content sections.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { glob } = require('glob');

const LOCAL_STAT_TERMS = [
  'median price',
  'average price',
  'price per square foot',
  'days on market',
  'inventory',
  'months of supply',
  'sale-to-list',
  'absorption rate',
  'market trend'
];

const SCHEMA_KEYS_OF_INTEREST = new Set([
  'name',
  'areaServed',
  'serviceType',
  'about',
  'description',
  'sameAs',
  'url'
]);

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTokenSet(value) {
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'in', 'of', 'to', 'vs', 'with', 'your', 'you']);
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter(Boolean)
      .filter(token => token.length > 2)
      .filter(token => !stopwords.has(token))
  );
}

function jaccard(setA, setB) {
  if (!setA.size && !setB.size) return 1;
  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function ngramSet(text, n = 5) {
  const tokens = normalizeText(text)
    .split(' ')
    .filter(Boolean);

  if (tokens.length < n) {
    return new Set([tokens.join(' ')]);
  }

  const grams = new Set();
  for (let i = 0; i <= tokens.length - n; i++) {
    grams.add(tokens.slice(i, i + n).join(' '));
  }
  return grams;
}

function getSlugTokens(relativePath) {
  const slug = relativePath
    .replace(/index\.html$/, '')
    .replace(/^areas\//, '')
    .replace(/^compare\//, '')
    .replace(/\/$/, '')
    .replace(/-/g, ' ');

  return toTokenSet(slug);
}

function flattenSchemaAttributes(node, attrs = []) {
  if (node === null || node === undefined) {
    return attrs;
  }

  if (Array.isArray(node)) {
    node.forEach(item => flattenSchemaAttributes(item, attrs));
    return attrs;
  }

  if (typeof node !== 'object') {
    return attrs;
  }

  Object.entries(node).forEach(([key, value]) => {
    if (SCHEMA_KEYS_OF_INTEREST.has(key) && typeof value !== 'object') {
      attrs.push(`${key}:${normalizeText(String(value))}`);
    }
    flattenSchemaAttributes(value, attrs);
  });

  return attrs;
}

function parsePage(filePath, relativePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim();
  const h1 = $('h1').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';

  const bodyText = $('main').text().trim() || $('body').text().trim();

  const internalLinks = new Set();
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
      return;
    }

    const normalized = href
      .split('#')[0]
      .split('?')[0]
      .replace(/\/$/, '') || '/';

    internalLinks.add(normalized);
  });

  const faqQuestions = [];
  $('.faq-question').each((_, el) => {
    faqQuestions.push($(el).text().trim());
  });

  const schemaAttrs = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;

    try {
      const parsed = JSON.parse(content);
      flattenSchemaAttributes(parsed, schemaAttrs);
    } catch {
      // Ignore invalid JSON-LD in this check.
    }
  });

  const normalizedBody = normalizeText(bodyText);
  const hasLocalStats =
    LOCAL_STAT_TERMS.some(term => normalizedBody.includes(term)) &&
    /(\$\s?\d|\d+\s?%|\d+,\d+)/.test(bodyText);

  return {
    relativePath,
    title,
    h1,
    metaDescription,
    titleTokens: toTokenSet(title),
    h1Tokens: toTokenSet(h1),
    metaTokens: toTokenSet(metaDescription),
    bodyNgrams: ngramSet(bodyText, 5),
    bodyTokens: toTokenSet(bodyText),
    slugTokens: getSlugTokens(relativePath),
    faqTokens: toTokenSet(faqQuestions.join(' ')),
    internalLinks,
    schemaAttrs: new Set(schemaAttrs.filter(Boolean)),
    hasLocalStats
  };
}

function calcOverlap(pageA, pageB, thresholds) {
  const titleSimilarity = jaccard(pageA.titleTokens, pageB.titleTokens);
  const h1Similarity = jaccard(pageA.h1Tokens, pageB.h1Tokens);
  const metaSimilarity = jaccard(pageA.metaTokens, pageB.metaTokens);
  const bodySimilarity = jaccard(pageA.bodyNgrams, pageB.bodyNgrams);
  const intentSimilarity = jaccard(pageA.bodyTokens, pageB.bodyTokens);

  const primaryIntentScore =
    (titleSimilarity * 0.2) +
    (h1Similarity * 0.2) +
    (metaSimilarity * 0.15) +
    (bodySimilarity * 0.35) +
    (intentSimilarity * 0.1);

  const strongHeaderOverlap =
    titleSimilarity >= thresholds.titleSimilarity &&
    h1Similarity >= thresholds.h1Similarity &&
    metaSimilarity >= thresholds.metaSimilarity;

  const samePrimaryIntent =
    (strongHeaderOverlap && bodySimilarity >= thresholds.bodySimilarity) ||
    primaryIntentScore >= thresholds.primaryIntentScore;

  if (!samePrimaryIntent) {
    return null;
  }

  const uniqueLinksA = [...pageA.internalLinks].filter(link => !pageB.internalLinks.has(link));
  const uniqueLinksB = [...pageB.internalLinks].filter(link => !pageA.internalLinks.has(link));

  const uniqueSchemaA = [...pageA.schemaAttrs].filter(attr => !pageB.schemaAttrs.has(attr));
  const uniqueSchemaB = [...pageB.schemaAttrs].filter(attr => !pageA.schemaAttrs.has(attr));

  const faqSimilarity = jaccard(pageA.faqTokens, pageB.faqTokens);

  const differentiators = {
    localStats: pageA.hasLocalStats || pageB.hasLocalStats,
    neighborhoodFaq: faqSimilarity < thresholds.maxFaqSimilarity,
    uniqueInternalLinks:
      uniqueLinksA.length >= thresholds.minUniqueLinks ||
      uniqueLinksB.length >= thresholds.minUniqueLinks,
    uniqueSchemaAttributes:
      uniqueSchemaA.length >= thresholds.minUniqueSchemaAttrs ||
      uniqueSchemaB.length >= thresholds.minUniqueSchemaAttrs
  };

  const differentiatorCount = Object.values(differentiators).filter(Boolean).length;

  return {
    urlA: `/${pageA.relativePath.replace(/index\.html$/, '')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/',
    urlB: `/${pageB.relativePath.replace(/index\.html$/, '')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/',
    overlap: {
      titleSimilarity: Number(titleSimilarity.toFixed(3)),
      h1Similarity: Number(h1Similarity.toFixed(3)),
      metaSimilarity: Number(metaSimilarity.toFixed(3)),
      bodySimilarity: Number(bodySimilarity.toFixed(3)),
      intentSimilarity: Number(intentSimilarity.toFixed(3)),
      primaryIntentScore: Number(primaryIntentScore.toFixed(3))
    },
    differentiators,
    differentiatorCount,
    uniqueSignals: {
      uniqueLinksA: uniqueLinksA.slice(0, 10),
      uniqueLinksB: uniqueLinksB.slice(0, 10),
      uniqueSchemaA: uniqueSchemaA.slice(0, 10),
      uniqueSchemaB: uniqueSchemaB.slice(0, 10)
    }
  };
}

async function checkDuplicateIntent(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      pairsAnalyzed: 0,
      duplicatePairs: 0
    },
    report: {
      generatedAt: new Date().toISOString(),
      thresholds: {
        titleSimilarity: 0.75,
        h1Similarity: 0.75,
        metaSimilarity: 0.7,
        bodySimilarity: 0.72,
        primaryIntentScore: 0.76,
        maxFaqSimilarity: 0.75,
        minUniqueLinks: 3,
        minUniqueSchemaAttrs: 2,
        minDifferentiators: 2
      },
      queue: []
    }
  };

  const thresholds = {
    ...result.report.thresholds,
    ...(config.duplicateIntent || {})
  };
  result.report.thresholds = thresholds;

  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);

  const areasFiles = await glob('areas/**/*.html', { cwd: siteRoot, absolute: true });
  const compareFiles = await glob('compare/**/*.html', { cwd: siteRoot, absolute: true });

  const candidateFiles = [...areasFiles, ...compareFiles].map(file => ({
    absolute: file,
    relative: path.relative(siteRoot, file)
  }));

  result.stats.filesChecked = candidateFiles.length;

  const pages = candidateFiles.map(file => parsePage(file.absolute, file.relative));

  const duplicates = [];

  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const pageA = pages[i];
      const pageB = pages[j];

      // Fast prefilter: require some slug/topic overlap.
      const slugSimilarity = jaccard(pageA.slugTokens, pageB.slugTokens);
      if (slugSimilarity < 0.15) {
        continue;
      }

      result.stats.pairsAnalyzed++;

      const overlap = calcOverlap(pageA, pageB, thresholds);
      if (!overlap) {
        continue;
      }

      const isInsufficientlyDifferentiated = overlap.differentiatorCount < thresholds.minDifferentiators;
      if (isInsufficientlyDifferentiated) {
        duplicates.push(overlap);
      }
    }
  }

  duplicates.sort((a, b) => b.overlap.primaryIntentScore - a.overlap.primaryIntentScore);

  result.stats.duplicatePairs = duplicates.length;
  result.report.queue = duplicates.map((item, index) => ({
    rank: index + 1,
    priorityScore: item.overlap.primaryIntentScore,
    urlA: item.urlA,
    urlB: item.urlB,
    differentiatorCount: item.differentiatorCount,
    overlap: item.overlap,
    missingDifferentiators: Object.entries(item.differentiators)
      .filter(([, value]) => !value)
      .map(([key]) => key)
  }));

  if (duplicates.length > 0) {
    result.passed = false;

    duplicates.forEach(item => {
      result.errors.push({
        file: `${item.urlA} <-> ${item.urlB}`,
        message:
          `High intent overlap (score=${item.overlap.primaryIntentScore}) with only ` +
          `${item.differentiatorCount}/${thresholds.minDifferentiators} differentiators.`
      });
    });
  }

  const reportsDir = path.resolve(__dirname, '..', config.reportsDir);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'duplicate-intent-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(result.report, null, 2));
  result.reportPath = reportPath;

  if (verbose) {
    console.log(`  Duplicate-intent queue entries: ${result.report.queue.length}`);
    console.log(`  Report: ${reportPath}`);
  }

  return result;
}

module.exports = checkDuplicateIntent;
