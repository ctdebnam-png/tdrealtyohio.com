/**
 * sitemap-coverage.mjs
 *
 * Compares the generated sitemap.xml against the canonical URL set
 * to detect missing rank-intent pages and extra/stale URLs.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/**
 * Audit sitemap coverage against canonical URL set.
 *
 * @param {object} options
 * @param {string[]} options.canonicalUrls - Intended canonical URLs
 * @param {string} options.sitemapPath - Path to sitemap.xml (defaults to repo root)
 * @returns {{ missingInSitemap: string[], extraInSitemap: string[], issueCounts: object, sitemapUrls: string[] }}
 */
export function auditSitemapCoverage({ canonicalUrls = [], sitemapPath = null } = {}) {
  const sitemapFile = sitemapPath || join(ROOT, 'sitemap.xml');

  let sitemapContent;
  try {
    sitemapContent = readFileSync(sitemapFile, 'utf-8');
  } catch {
    return {
      missingInSitemap: canonicalUrls.slice(0, 25),
      extraInSitemap: [],
      issueCounts: { SITEMAP_NOT_FOUND: 1, SITEMAP_MISSING_RANK_INTENT: canonicalUrls.length },
      sitemapUrls: [],
    };
  }

  // Parse <loc> entries
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  const sitemapUrls = [];
  let match;
  while ((match = locRegex.exec(sitemapContent)) !== null) {
    sitemapUrls.push(match[1].trim());
  }

  const sitemapSet = new Set(sitemapUrls);
  const canonicalSet = new Set(canonicalUrls);

  // Find missing (canonical URLs not in sitemap)
  const missingInSitemap = canonicalUrls.filter(url => !sitemapSet.has(url));

  // Find extra (sitemap URLs not in canonical set)
  const extraInSitemap = sitemapUrls.filter(url => !canonicalSet.has(url));

  const issueCounts = {};
  if (missingInSitemap.length > 0) {
    issueCounts.SITEMAP_MISSING_RANK_INTENT = missingInSitemap.length;
  }
  if (extraInSitemap.length > 0) {
    issueCounts.SITEMAP_HAS_EXTRA_URLS = extraInSitemap.length;
  }

  return {
    missingInSitemap,
    extraInSitemap,
    issueCounts,
    sitemapUrls,
  };
}
