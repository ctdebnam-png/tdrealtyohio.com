/**
 * canonical-url-set.mjs
 *
 * Builds the authoritative set of canonical URLs that the site
 * intends to have indexed. Used for sitemap coverage checks and
 * canonical agreement audits.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { normalizePath, toAbsoluteUrl } from './url-normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');

function loadConfig() {
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return { baseUrl: '', canonicalStrategy: 'slash', rankIntentRoutes: [], utilityRoutesNoIndex: [] }; }
}

/**
 * Build the canonical URL set for the site.
 *
 * @param {object} options
 * @param {object[]} options.blogPosts - Blog posts from blog-discovery (with .path)
 * @param {string[]} options.areaRoutes - Area routes from area-discovery
 * @returns {{ canonicalUrls: string[], baseUrl: string, strategy: string }}
 */
export function buildCanonicalUrlSet({ blogPosts = [], areaRoutes = [] } = {}) {
  const config = loadConfig();
  const baseUrl = config.baseUrl || 'https://tdrealtyohio.com';
  const strategy = config.canonicalStrategy || 'slash';
  const utilitySet = new Set(config.utilityRoutesNoIndex || []);

  // Collect all routes that should be indexed
  const routes = new Set();

  // Add rank-intent routes (excluding noindex utilities)
  for (const r of (config.rankIntentRoutes || [])) {
    if (!utilitySet.has(r)) {
      routes.add(normalizePath(r, strategy));
    }
  }

  // Add discovered blog posts
  for (const post of blogPosts) {
    if (post.path) {
      routes.add(normalizePath(post.path, strategy));
    }
  }

  // Add area routes
  for (const route of areaRoutes) {
    if (!utilitySet.has(route)) {
      routes.add(normalizePath(route, strategy));
    }
  }

  // Convert to absolute URLs, sort for stability
  const canonicalUrls = [...routes]
    .map(path => toAbsoluteUrl(baseUrl, path))
    .sort();

  return { canonicalUrls, baseUrl, strategy };
}
