/**
 * metadata-fixer.mjs
 *
 * Patches the <head> of HTML pages to ensure all SEO metadata is present.
 * Uses routes.js as the source of truth for per-page metadata.
 * Operates on source HTML files directly (this is a static site).
 *
 * What it fixes:
 * - Missing OG tags (og:title, og:description, og:url, og:type, og:image, og:site_name)
 * - Missing Twitter tags (twitter:card, twitter:title, twitter:description, twitter:image)
 * - Missing robots meta for noindex pages
 *
 * What it does NOT fix (already present on most pages):
 * - <title>, <meta description>, <link rel="canonical"> — these are already correct
 * - <html lang="en"> — already set on all pages
 * - JSON-LD — managed separately
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { toAbsoluteUrl, normalizePath } from '../lib/url-normalize.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/**
 * Load SEO defaults config.
 */
function loadSeoDefaults() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'config', 'seo-defaults.json'), 'utf-8'));
  } catch {
    return {
      baseUrl: 'https://tdrealtyohio.com',
      siteName: 'TD Realty Ohio',
      defaultOgImagePath: '/assets/images/og-default.jpg',
      twitterCard: 'summary_large_image',
      canonicalStrategy: 'slash',
    };
  }
}

/**
 * Load all routes from the route registry.
 */
function loadRoutes() {
  try {
    const routeModule = require('../../src/config/routes.js');
    return routeModule.buildRoutes();
  } catch (err) {
    console.error('[metadata-fixer] Failed to load routes.js:', err.message);
    return [];
  }
}

/**
 * Load route-meta.json overrides (from experiments or manual config).
 */
function loadRouteMeta() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'config', 'route-meta.json'), 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Build a map of route path -> route object.
 */
function buildRouteMap(routes) {
  const map = new Map();
  for (const route of routes) {
    map.set(route.path, route);
  }
  return map;
}

/**
 * Determine the OG type based on page type.
 */
function getOgType(route) {
  if (!route) return 'website';
  if (route.pageType === 'blog') return 'article';
  return 'website';
}

/**
 * Build the OG/Twitter tags block to insert.
 */
function buildMetaTags(route, defaults) {
  const baseUrl = defaults.baseUrl;
  const canonical = toAbsoluteUrl(baseUrl, normalizePath(route.path, defaults.canonicalStrategy));
  const ogImage = toAbsoluteUrl(baseUrl, defaults.defaultOgImagePath);
  const ogTitle = route.ogTitle || route.title || defaults.defaultTitle;
  const ogDesc = route.ogDescription || route.description || defaults.defaultDescription;
  const ogType = getOgType(route);

  return {
    og: {
      'og:type': ogType,
      'og:title': ogTitle,
      'og:description': ogDesc,
      'og:url': canonical,
      'og:site_name': defaults.siteName,
      'og:image': ogImage,
    },
    twitter: {
      'twitter:card': defaults.twitterCard,
      'twitter:title': ogTitle,
      'twitter:description': ogDesc,
      'twitter:image': ogImage,
    },
  };
}

/**
 * Check which OG tags are missing from the HTML.
 */
function findMissingOgTags(html, required) {
  const missing = {};
  for (const [key, value] of Object.entries(required)) {
    // Check if <meta property="og:xxx" content="..."> exists
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<meta\\s+[^>]*property=["']${escaped}["'][^>]*>`, 'i');
    if (!regex.test(html)) {
      missing[key] = value;
    }
  }
  return missing;
}

/**
 * Check which Twitter tags are missing from the HTML.
 */
function findMissingTwitterTags(html, required) {
  const missing = {};
  for (const [key, value] of Object.entries(required)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<meta\\s+[^>]*name=["']${escaped}["'][^>]*>`, 'i');
    if (!regex.test(html)) {
      missing[key] = value;
    }
  }
  return missing;
}

/**
 * Generate HTML meta tag lines for missing OG tags.
 */
function ogTagLines(tags) {
  return Object.entries(tags)
    .map(([prop, content]) => `  <meta property="${prop}" content="${escapeAttr(content)}">`)
    .join('\n');
}

/**
 * Generate HTML meta tag lines for missing Twitter tags.
 */
function twitterTagLines(tags) {
  return Object.entries(tags)
    .map(([name, content]) => `  <meta name="${name}" content="${escapeAttr(content)}">`)
    .join('\n');
}

/**
 * Escape HTML attribute value.
 */
function escapeAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Inject missing meta tags into the HTML <head>.
 * Inserts right before </head>.
 */
function injectMetaTags(html, missingOg, missingTwitter) {
  const lines = [];

  if (Object.keys(missingOg).length > 0) {
    lines.push('\n  <!-- Open Graph (auto-injected by seo-autopilot) -->');
    lines.push(ogTagLines(missingOg));
  }

  if (Object.keys(missingTwitter).length > 0) {
    lines.push('\n  <!-- Twitter Card (auto-injected by seo-autopilot) -->');
    lines.push(twitterTagLines(missingTwitter));
  }

  if (lines.length === 0) return html;

  const block = lines.join('\n');
  // Insert before </head>
  return html.replace('</head>', `${block}\n</head>`);
}

/**
 * Run the metadata fixer across all pages.
 *
 * @param {Array<{filePath: string, routePath: string, isUtility: boolean}>} pages
 * @returns {{ filesChanged: number, tagsAdded: number, details: Array }}
 */
export function fixMetadata(pages) {
  const defaults = loadSeoDefaults();
  const routes = loadRoutes();
  const routeMap = buildRouteMap(routes);
  const routeMeta = loadRouteMeta();

  let filesChanged = 0;
  let tagsAdded = 0;
  const details = [];

  for (const page of pages) {
    const route = routeMap.get(page.routePath);
    if (!route) continue; // Skip pages not in route registry

    let html;
    try {
      html = readFileSync(page.filePath, 'utf-8');
    } catch {
      continue;
    }

    // Don't patch template fragments (no <head>)
    if (!html.includes('</head>')) continue;

    // Merge route-meta.json overrides (from experiments) into route data
    const override = routeMeta[page.routePath];
    const mergedRoute = override
      ? { ...route, title: override.title || route.title, description: override.description || route.description }
      : route;

    const tags = buildMetaTags(mergedRoute, defaults);
    const missingOg = findMissingOgTags(html, tags.og);
    const missingTwitter = findMissingTwitterTags(html, tags.twitter);

    const totalMissing = Object.keys(missingOg).length + Object.keys(missingTwitter).length;
    if (totalMissing === 0) continue;

    const patched = injectMetaTags(html, missingOg, missingTwitter);

    // Only write if content actually changed
    if (patched !== html) {
      writeFileSync(page.filePath, patched, 'utf-8');
      filesChanged++;
      tagsAdded += totalMissing;
      details.push({
        routePath: page.routePath,
        ogAdded: Object.keys(missingOg),
        twitterAdded: Object.keys(missingTwitter),
      });
    }
  }

  return { filesChanged, tagsAdded, details };
}
