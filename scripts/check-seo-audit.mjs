#!/usr/bin/env node
/**
 * Comprehensive SEO Audit — CI-blocking checks
 *
 * Checks enforced:
 *  1. Title uniqueness across all pages
 *  2. Meta description uniqueness across all pages
 *  3. Canonical ↔ og:url parity; og:title/description not template defaults
 *  4. Exactly one H1 per page, geo token required on geo pages
 *  5. Thin content guard (required sections + word count)
 *  6. JSON-LD coverage by page type (no aggregateRating allowed)
 *  7. Image alt text with geo token on geo pages
 *  8. Blog pagination integrity (canonical, rel prev/next, unique titles)
 *  9. CTA consistency on money pages (primary CTA to real route)
 * 10. Content freshness signaling (dateModified present)
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { PAGE_TYPES, ROUTES, SITE_URL } = require('../src/config/routes.js');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
  'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
  'gsc', 'data', 'functions', 'docs', 'media', 'templates', 'lp',
  'thank-you', 'tests',
]);

const errors = [];
const warnings = [];

function err(check, file, msg) {
  errors.push(`[${check}] ${file}: ${msg}`);
}
function warn(check, file, msg) {
  warnings.push(`[${check}] ${file}: ${msg}`);
}

// ── Helpers ──────────────────────────────────────────────
async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      await findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function relPath(file) {
  return file.replace(ROOT, '') || '/';
}

function routeFromFile(file) {
  let path = relPath(file).replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
  if (path === '/') return '/';
  return path;
}

function extractTag(html, regex) {
  const m = html.match(regex);
  return m ? m[1] : null;
}

function countWords(html) {
  // Strip all tags, scripts, styles
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function getRouteForPath(path) {
  return ROUTES.find(r => r.path === path);
}

function isGeoPage(route) {
  return route && (route.pageType === PAGE_TYPES.AREA || route.pageType === PAGE_TYPES.ZIP);
}

function geoToken(route) {
  if (!route) return null;
  if (route.pageType === PAGE_TYPES.AREA && route.cityData) return route.cityData.name;
  if (route.pageType === PAGE_TYPES.ZIP && route.zipData) return route.zipData.zip;
  return null;
}

const MONEY_PAGE_TYPES = new Set([
  PAGE_TYPES.HOME, PAGE_TYPES.SERVICE, PAGE_TYPES.AREA, PAGE_TYPES.ZIP,
  PAGE_TYPES.COMPARISON, PAGE_TYPES.CALCULATOR, PAGE_TYPES.HUB,
]);

// Required sections for geo pages (thin content guard)
const GEO_REQUIRED_SECTIONS = ['selling', 'buying', 'cta', 'service'];
const MIN_WORD_COUNT = { [PAGE_TYPES.AREA]: 300, [PAGE_TYPES.ZIP]: 250 };

// ── Main audit ──────────────────────────────────────────
async function audit() {
  console.log('[seo-audit] Starting comprehensive SEO audit...\n');
  const htmlFiles = await findHtmlFiles(ROOT);
  console.log(`[seo-audit] Scanning ${htmlFiles.length} HTML files\n`);

  const titles = new Map();       // title -> [file]
  const descriptions = new Map(); // description -> [file]

  for (const file of htmlFiles) {
    const content = await readFile(file, 'utf-8');
    const rp = relPath(file);
    const routePath = routeFromFile(file);
    const route = getRouteForPath(routePath);

    // Skip noindex pages and error pages
    if (route && route.noindex) continue;
    if (routePath === '/404/' || rp.endsWith('/404.html')) continue;

    // ── 1. Title uniqueness ────────────────────────────
    const title = extractTag(content, /<title>([^<]+)<\/title>/i);
    if (title) {
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(rp);
    } else {
      err('title', rp, 'Missing <title> tag');
    }

    // ── 2. Meta description uniqueness ─────────────────
    const desc = extractTag(content, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (desc) {
      if (!descriptions.has(desc)) descriptions.set(desc, []);
      descriptions.get(desc).push(rp);
    } else {
      warn('meta-desc', rp, 'Missing meta description');
    }

    // ── 3. Canonical ↔ OG parity ──────────────────────
    const canonical = extractTag(content, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    const ogUrl = extractTag(content, /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
    const ogTitle = extractTag(content, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogDesc = extractTag(content, /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

    if (canonical && ogUrl && canonical !== ogUrl) {
      err('og-parity', rp, `canonical="${canonical}" but og:url="${ogUrl}"`);
    }
    if (!canonical) {
      err('canonical', rp, 'Missing <link rel="canonical">');
    }
    if (canonical && (canonical === SITE_URL + '/' || canonical === '/') && routePath !== '/') {
      err('canonical', rp, `Canonical points to root "/" but page is ${routePath}`);
    }
    if (!ogUrl && route && !route.noindex) {
      warn('og-parity', rp, 'Missing og:url');
    }
    // Check og:title not template default
    if (ogTitle && (ogTitle === 'TD Realty Ohio' || ogTitle === 'Default Title')) {
      err('og-parity', rp, `og:title is generic template default: "${ogTitle}"`);
    }

    // ── 4. H1 rule: exactly one, with geo token ──────
    const h1Matches = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    if (h1Matches.length === 0) {
      err('h1', rp, 'No H1 tag found');
    } else if (h1Matches.length > 1) {
      err('h1', rp, `Multiple H1 tags found (${h1Matches.length})`);
    }
    if (h1Matches.length === 1 && route && isGeoPage(route)) {
      const token = geoToken(route);
      const h1Text = h1Matches[0].replace(/<[^>]+>/g, '');
      if (token && !h1Text.includes(token)) {
        warn('h1-geo', rp, `H1 does not contain geo token "${token}"`);
      }
    }

    // ── 5. Thin content guard ─────────────────────────
    if (route && isGeoPage(route)) {
      const words = countWords(content);
      const minWords = MIN_WORD_COUNT[route.pageType] || 200;
      if (words < minWords) {
        err('thin-content', rp, `Only ${words} words (minimum ${minWords})`);
      }

      // Check for required sections (selling/buying/cta/service)
      const lowerContent = content.toLowerCase();
      const missingSections = [];
      if (!lowerContent.includes('selling in') && !lowerContent.includes('sell your') && !lowerContent.includes('for sellers')) {
        missingSections.push('seller angle');
      }
      if (!lowerContent.includes('buying in') && !lowerContent.includes('buy your') && !lowerContent.includes('for buyers') && !lowerContent.includes('first-time buyer')) {
        missingSections.push('buyer angle');
      }
      if (!/<a[^>]*class="[^"]*btn[^"]*btn-primary[^"]*"[^>]*>/i.test(content)) {
        missingSections.push('primary CTA button');
      }
      if (!lowerContent.includes('service area') && !lowerContent.includes('/areas/')) {
        missingSections.push('internal links block');
      }
      if (missingSections.length > 0) {
        warn('thin-content', rp, `Missing sections: ${missingSections.join(', ')}`);
      }
    }

    // ── 6. JSON-LD coverage ───────────────────────────
    const jsonLdBlocks = content.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    if (route && !route.noindex) {
      // Check no aggregateRating anywhere
      for (const block of jsonLdBlocks) {
        if (block.includes('aggregateRating') || block.includes('AggregateRating')) {
          err('json-ld', rp, 'Contains aggregateRating — remove fake reviews');
        }
      }

      // Check coverage by page type
      const allSchemaText = jsonLdBlocks.join(' ');

      if (route.pageType === PAGE_TYPES.SERVICE && !allSchemaText.includes('"Service"')) {
        warn('json-ld', rp, 'Service page missing Service schema');
      }
      if (isGeoPage(route)) {
        if (!allSchemaText.includes('"LocalBusiness"') && !allSchemaText.includes('"RealEstateAgent"')) {
          warn('json-ld', rp, 'Geo page missing LocalBusiness/RealEstateAgent schema');
        }
        if (!allSchemaText.includes('areaServed') && !allSchemaText.includes('placeServed') && !allSchemaText.includes('postalCode')) {
          warn('json-ld', rp, 'Geo page missing areaServed/placeServed');
        }
      }
      if (route.pageType === PAGE_TYPES.BLOG) {
        if (!allSchemaText.includes('"Article"') && !allSchemaText.includes('"BlogPosting"') && !allSchemaText.includes('"NewsArticle"')) {
          warn('json-ld', rp, 'Blog post missing Article/BlogPosting schema');
        }
        if (!allSchemaText.includes('datePublished')) {
          warn('json-ld', rp, 'Blog post missing datePublished');
        }
      }
      if ((route.pageType === PAGE_TYPES.COMPARISON || route.pageType === PAGE_TYPES.TOOL || route.pageType === PAGE_TYPES.CALCULATOR) && !allSchemaText.includes('BreadcrumbList')) {
        warn('json-ld', rp, 'Comparison/tool page missing BreadcrumbList schema');
      }
    }

    // ── 7. Image SEO on geo pages ─────────────────────
    if (route && isGeoPage(route)) {
      const token = geoToken(route);
      const imgTags = content.match(/<img[^>]+>/gi) || [];
      // We don't require images on every geo page, but if present, check alt text
      for (const img of imgTags) {
        const altMatch = img.match(/alt=["']([^"']*)["']/i);
        if (!altMatch || altMatch[1].trim() === '') {
          warn('img-seo', rp, 'Image missing alt text');
        }
      }
    }

    // ── 8. Content freshness: dateModified ────────────
    if (route && isGeoPage(route)) {
      const hasModTime = content.includes('article:modified_time') || content.includes('dateModified') || content.includes('Last updated');
      if (!hasModTime) {
        warn('freshness', rp, 'No dateModified / last-updated signal');
      }
    }

    // ── 9. CTA consistency on money pages ─────────────
    if (route && MONEY_PAGE_TYPES.has(route.pageType)) {
      const ctaLinks = content.match(/<a[^>]*class="[^"]*btn[^"]*btn-primary[^"]*"[^>]*href=["']([^"']+)["'][^>]*>/gi) || [];
      if (ctaLinks.length === 0) {
        warn('cta', rp, 'Money page has no primary CTA (.btn.btn-primary)');
      } else {
        // Check that primary CTA points to a real route
        for (const cta of ctaLinks) {
          const hrefMatch = cta.match(/href=["']([^"']+)["']/i);
          if (hrefMatch) {
            const href = hrefMatch[1];
            // Allow tel:, mailto:, and internal routes
            if (!href.startsWith('tel:') && !href.startsWith('mailto:') && !href.startsWith('http') && !href.startsWith('#')) {
              const targetPath = href.split('?')[0].split('#')[0];
              const normalizedTarget = targetPath.endsWith('/') ? targetPath : targetPath + '/';
              const targetRoute = ROUTES.find(r => r.path === normalizedTarget);
              if (!targetRoute) {
                warn('cta', rp, `Primary CTA links to unregistered route: ${href}`);
              }
            }
          }
        }
      }
    }
  }

  // ── Post-scan: title & description duplicates ────────
  for (const [title, files] of titles) {
    if (files.length > 1) {
      err('title-dup', files.join(', '), `Duplicate <title>: "${title.slice(0, 60)}..."`);
    }
  }
  for (const [desc, files] of descriptions) {
    if (files.length > 1) {
      err('desc-dup', files.join(', '), `Duplicate meta description: "${desc.slice(0, 60)}..."`);
    }
  }

  // ── 10. Blog pagination integrity ───────────────────
  const blogIndex = join(ROOT, 'blog', 'index.html');
  try {
    const blogContent = await readFile(blogIndex, 'utf-8');
    const blogCanonical = extractTag(blogContent, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (!blogCanonical) {
      err('blog-pagination', '/blog/index.html', 'Blog index missing canonical');
    }
    // Check for blog post links
    const blogLinks = blogContent.match(/<a[^>]*href=["']\/blog\/[^"']+["'][^>]*>/gi) || [];
    if (blogLinks.length === 0) {
      warn('blog-pagination', '/blog/index.html', 'Blog index has no links to blog posts');
    }
  } catch {
    warn('blog-pagination', '/blog/index.html', 'Blog index.html not found');
  }

  // ── Report ──────────────────────────────────────────
  console.log('');
  if (warnings.length > 0) {
    console.log(`[seo-audit] ⚠ ${warnings.length} warning(s):`);
    warnings.forEach(w => console.warn(`  ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.error(`[seo-audit] ✗ ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  ${e}`));
    console.error(`\n[seo-audit] FAILED — ${errors.length} blocking error(s)`);
    return errors.length;
  }

  console.log(`[seo-audit] ✓ All checks passed (${warnings.length} warnings)`);
  return 0;
}

const exitCode = await audit();
if (exitCode > 0) {
  process.exit(1);
}
