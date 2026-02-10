/**
 * near-duplicates.mjs
 *
 * Detects near-duplicate content pages using Jaccard similarity on word shingles.
 * Bounded to a capped set of pages (rank-intent + newest blog posts) to keep runtime low.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractVisibleText } from '../lib/extract-visible-text.mjs';
import { createShingles, jaccardSimilarity } from '../lib/shingles.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUALITY_PATH = join(__dirname, '..', 'config', 'quality.json');

function loadQualityConfig() {
  try { return JSON.parse(readFileSync(QUALITY_PATH, 'utf-8')); } catch { return { duplication: { maxJaccardSimilarity: 0.55, maxNearDuplicateCount: 3 } }; }
}

/**
 * Detect near-duplicate pages.
 *
 * @param {object[]} pages - From listHtmlPages (each has .filePath, .routePath)
 * @param {object} config - Site config with rankIntentRoutes
 * @param {object[]} blogPosts - Blog posts from blog-discovery (for recency sorting)
 * @returns {{ flaggedPairs: object[], perPageNearDuplicateCount: object }}
 */
export function detectNearDuplicates(pages, config = {}, blogPosts = []) {
  const quality = loadQualityConfig();
  const threshold = quality.duplication?.maxJaccardSimilarity || 0.55;
  const rankSet = new Set(config.rankIntentRoutes || []);

  // Build the bounded comparison set
  const pageMap = new Map(pages.map(p => [p.routePath, p]));
  const comparisonSet = new Set();

  // Add all rank-intent routes
  for (const route of (config.rankIntentRoutes || [])) {
    if (pageMap.has(route)) comparisonSet.add(route);
  }

  // Add newest 10 blog posts
  const sortedPosts = [...blogPosts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const post of sortedPosts.slice(0, 10)) {
    if (pageMap.has(post.path)) comparisonSet.add(post.path);
  }

  // Cap at 60 pages
  const comparisonRoutes = [...comparisonSet].slice(0, 60);

  if (comparisonRoutes.length < 2) {
    return { flaggedPairs: [], perPageNearDuplicateCount: {} };
  }

  // Extract text and compute shingles for each page
  const pageShingles = new Map();
  for (const route of comparisonRoutes) {
    const page = pageMap.get(route);
    if (!page) continue;

    try {
      const html = readFileSync(page.filePath, 'utf-8');
      const text = extractVisibleText(html);
      const shingles = createShingles(text, 5);
      if (shingles.size > 0) {
        pageShingles.set(route, shingles);
      }
    } catch {
      // Skip pages we can't read
    }
  }

  // Compare pairs
  const routes = [...pageShingles.keys()];
  const flaggedPairs = [];
  const perPageNearDuplicateCount = {};

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const a = routes[i];
      const b = routes[j];
      const sim = jaccardSimilarity(pageShingles.get(a), pageShingles.get(b));

      if (sim >= threshold) {
        flaggedPairs.push({
          a,
          b,
          similarity: Math.round(sim * 1000) / 1000,
        });
        perPageNearDuplicateCount[a] = (perPageNearDuplicateCount[a] || 0) + 1;
        perPageNearDuplicateCount[b] = (perPageNearDuplicateCount[b] || 0) + 1;
      }
    }
  }

  // Sort by similarity descending
  flaggedPairs.sort((a, b) => b.similarity - a.similarity);

  return { flaggedPairs, perPageNearDuplicateCount };
}
