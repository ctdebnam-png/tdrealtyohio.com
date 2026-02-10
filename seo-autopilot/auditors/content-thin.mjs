/**
 * content-thin.mjs
 *
 * Detects thin pages (low word count) across the built output.
 * Flags rank-intent pages that fall below the minimum threshold.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { countWords } from '../lib/extract-visible-text.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUALITY_PATH = join(__dirname, '..', 'config', 'quality.json');

function loadQualityConfig() {
  try { return JSON.parse(readFileSync(QUALITY_PATH, 'utf-8')); } catch { return { thin: { minWordsIndexablePage: 250 } }; }
}

/**
 * Audit pages for thin content.
 *
 * @param {object[]} pages - From listHtmlPages (each has .filePath, .routePath)
 * @param {object} config - Site config with rankIntentRoutes and utilityRoutesNoIndex
 * @param {object} options - { fullScan: boolean } — when false, only scan rank-intent + newest posts
 * @returns {{ pages: object[], thinRankIntent: object[], thinAny: object[] }}
 */
export function auditThinContent(pages, config = {}, options = {}) {
  const quality = loadQualityConfig();
  const minWords = quality.thin?.minWordsIndexablePage || 250;
  const rankSet = new Set(config.rankIntentRoutes || []);
  const utilitySet = new Set(config.utilityRoutesNoIndex || []);
  const fullScan = options.fullScan !== false; // default true for backwards compat

  // When not doing full scan, only check rank-intent + blog routes
  let scanPages = pages;
  if (!fullScan) {
    scanPages = pages.filter(p =>
      rankSet.has(p.routePath) || (p.routePath && p.routePath.startsWith('/blog/'))
    );
  }

  const results = [];
  const thinRankIntent = [];
  const thinAny = [];

  for (const page of scanPages) {
    // Skip utility/noindex pages
    if (utilitySet.has(page.routePath)) continue;
    if (page.pageType === 'utility') continue;

    let wordCount = 0;
    try {
      const html = readFileSync(page.filePath, 'utf-8');
      wordCount = countWords(html);
    } catch {
      continue;
    }

    const isRankIntent = rankSet.has(page.routePath);
    const entry = { routePath: page.routePath, wordCount, isRankIntent };
    results.push(entry);

    if (wordCount < minWords) {
      if (isRankIntent) {
        thinRankIntent.push(entry);
      }
      thinAny.push(entry);
    }
  }

  // Sort thin lists by word count ascending
  thinRankIntent.sort((a, b) => a.wordCount - b.wordCount);
  thinAny.sort((a, b) => a.wordCount - b.wordCount);

  return { pages: results, thinRankIntent, thinAny };
}
