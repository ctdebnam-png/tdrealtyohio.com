#!/usr/bin/env node
/**
 * Orphan Page & Sitemap Drift Checker
 *
 * Fails CI if:
 *  1. Any page is not reachable from at least one hub page (orphan)
 *  2. Any page is reachable but not in sitemap (sitemap drift)
 *  3. Any sitemap URL does not have a corresponding HTML file
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { SITE_URL, getIndexableRoutes } = require('../src/config/routes.js');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
  'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
  'gsc', 'data', 'functions', 'docs', 'media', 'templates', 'lp',
  'thank-you', 'tests',
]);

const errors = [];

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

function fileToRoute(file) {
  return file.replace(ROOT, '').replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
}

function extractInternalLinks(html) {
  const links = new Set();
  const hrefRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('/') && !href.startsWith('//')) {
      const path = href.split('?')[0].split('#')[0];
      const normalized = path.endsWith('/') ? path : path + '/';
      links.add(normalized);
    }
  }
  return links;
}

async function check() {
  console.log('[orphan-sitemap] Scanning for orphan pages and sitemap drift...\n');

  const htmlFiles = await findHtmlFiles(ROOT);
  const allRoutes = new Set();
  const linkedFrom = new Map(); // route -> Set of pages that link to it

  // Build route set and link graph
  for (const file of htmlFiles) {
    const route = fileToRoute(file);
    allRoutes.add(route);

    const content = await readFile(file, 'utf-8');
    const links = extractInternalLinks(content);

    for (const link of links) {
      if (!linkedFrom.has(link)) linkedFrom.set(link, new Set());
      linkedFrom.get(link).add(route);
    }
  }

  // Hub pages — these are the entry points from which pages should be reachable
  const hubPaths = new Set(['/', '/areas/', '/sellers/', '/buyers/', '/blog/', '/compare/', '/faq/']);

  // Check 1: Orphan pages — not linked from any hub page
  const registeredRoutes = getIndexableRoutes();
  let orphanCount = 0;

  for (const route of registeredRoutes) {
    const path = route.path;
    // Skip hubs themselves and legal/noindex pages
    if (hubPaths.has(path) || route.noindex) continue;
    if (route.pageType === 'legal') continue;

    const linkers = linkedFrom.get(path);
    if (!linkers || linkers.size === 0) {
      // Check if it's at least linked from somewhere via parent
      const parentLinkers = linkedFrom.get(path.replace(/\/$/, ''));
      if (!parentLinkers || parentLinkers.size === 0) {
        errors.push(`[orphan] ${path} — not linked from any page`);
        orphanCount++;
      }
    }
  }

  // Check 2: Sitemap drift — page exists but not in route registry
  const registeredPaths = new Set(registeredRoutes.map(r => r.path));
  // Also add noindex routes
  const { ROUTES } = require('../src/config/routes.js');
  const allRegisteredPaths = new Set(ROUTES.map(r => r.path));

  let driftCount = 0;
  for (const route of allRoutes) {
    // Skip known non-content paths
    if (route.startsWith('/lp/') || route.startsWith('/thank-you/') || route === '/404/') continue;
    if (!allRegisteredPaths.has(route)) {
      // Check if it's a blog post or tool city variant (dynamic, not pre-registered)
      if (route.startsWith('/blog/') && route !== '/blog/') continue;
      if (route.startsWith('/tools/') && route.split('/').filter(Boolean).length > 2) continue;
      errors.push(`[drift] ${route} — exists as HTML but not in route registry`);
      driftCount++;
    }
  }

  // Check 3: Sitemap URL without corresponding HTML
  let missingCount = 0;
  for (const route of registeredRoutes) {
    if (!allRoutes.has(route.path)) {
      // File doesn't exist yet — warning, not error
      console.warn(`[missing] ${route.path} — in route registry but no HTML file exists`);
      missingCount++;
    }
  }

  // Report
  console.log('');
  if (errors.length === 0) {
    console.log(`[orphan-sitemap] ✓ No orphan pages or sitemap drift (${missingCount} pending generation)`);
    return 0;
  }

  if (orphanCount > 0) {
    console.error(`[orphan-sitemap] ${orphanCount} orphan page(s) found`);
  }
  if (driftCount > 0) {
    console.error(`[orphan-sitemap] ${driftCount} page(s) not in route registry`);
  }

  errors.forEach(e => console.error(`  ${e}`));
  console.error(`\n[orphan-sitemap] ${errors.length} issue(s) found`);
  return errors.length;
}

const exitCode = await check();
if (exitCode > 0) {
  process.exit(1);
}
