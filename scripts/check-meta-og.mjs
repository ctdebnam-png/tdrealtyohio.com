#!/usr/bin/env node
/**
 * OG / Social Preview Meta Check
 *
 * Validates every public HTML page has the required Open Graph, Twitter Card,
 * and canonical metadata so link previews (iMessage, Slack, Facebook, etc.)
 * render correctly.
 *
 * Required tags per page:
 *  - <title>
 *  - <meta name="description">
 *  - <link rel="canonical">
 *  - og:title, og:description, og:url, og:image, og:site_name, og:type
 *  - twitter:card, twitter:title, twitter:description, twitter:image
 *
 * Additional checks:
 *  - og:image must be an absolute URL on tdrealtyohio.com
 *  - og:url must match canonical
 *  - og:image asset must exist on disk
 *  - Homepage must have robots meta tag
 */

import { readdir, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { ROUTES } = require('../src/config/routes.js');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
  'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
  'gsc', 'data', 'functions', 'docs', 'media', 'templates',
  'thank-you', 'tests', 'tools/site-audit', 'tools/site-quality-gate',
]);

const errors = [];
const warnings = [];

function err(file, msg) { errors.push(`${file}: ${msg}`); }
function warn(file, msg) { warnings.push(`${file}: ${msg}`); }

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
  let p = relPath(file).replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
  return p === '/' ? '/' : p;
}

function extract(html, regex) {
  const m = html.match(regex);
  return m ? m[1] : null;
}

const SITE_ORIGIN = 'https://tdrealtyohio.com';

// Track which og:image paths we've already verified on disk
const verifiedImages = new Set();

async function imageExistsOnDisk(ogImageUrl) {
  if (!ogImageUrl.startsWith(SITE_ORIGIN)) return false;
  const urlPath = ogImageUrl.slice(SITE_ORIGIN.length);
  if (verifiedImages.has(urlPath)) return true;
  try {
    await access(join(ROOT, urlPath));
    verifiedImages.add(urlPath);
    return true;
  } catch {
    return false;
  }
}

async function audit() {
  console.log('[meta-og] Checking OG / social preview metadata...\n');
  const htmlFiles = await findHtmlFiles(ROOT);
  console.log(`[meta-og] Scanning ${htmlFiles.length} HTML files\n`);

  for (const file of htmlFiles) {
    const content = await readFile(file, 'utf-8');
    const rp = relPath(file);
    const routePath = routeFromFile(file);
    const route = ROUTES.find(r => r.path === routePath);

    // Skip noindex pages and 404
    if (route && route.noindex) continue;
    if (routePath === '/404/' || rp.endsWith('/404.html')) continue;
    // Skip landing pages and admin
    if (routePath.startsWith('/lp/') || routePath.startsWith('/admin/')) continue;

    // --- Required tags ---
    const title = extract(content, /<title>([^<]+)<\/title>/i);
    const metaDesc = extract(content, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const canonical = extract(content, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    const ogTitle = extract(content, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogDesc = extract(content, /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const ogUrl = extract(content, /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
    const ogImage = extract(content, /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const ogSiteName = extract(content, /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    const ogType = extract(content, /<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["']/i);
    const twCard = extract(content, /<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']+)["']/i);
    const twTitle = extract(content, /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
    const twDesc = extract(content, /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i);
    const twImage = extract(content, /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);

    if (!title)     err(rp, 'Missing <title>');
    if (!metaDesc)  warn(rp, 'Missing <meta name="description">');
    if (!canonical)  err(rp, 'Missing <link rel="canonical">');
    if (!ogTitle)    err(rp, 'Missing og:title');
    if (!ogDesc)     err(rp, 'Missing og:description');
    if (!ogUrl)      err(rp, 'Missing og:url');
    if (!ogImage)    err(rp, 'Missing og:image');
    if (!ogSiteName) err(rp, 'Missing og:site_name');
    if (!ogType)     warn(rp, 'Missing og:type');
    if (!twCard)     err(rp, 'Missing twitter:card');
    if (!twTitle)    err(rp, 'Missing twitter:title');
    if (!twDesc)     err(rp, 'Missing twitter:description');
    if (!twImage)    err(rp, 'Missing twitter:image');

    // --- Value checks ---
    if (canonical && ogUrl && canonical !== ogUrl) {
      err(rp, `canonical (${canonical}) != og:url (${ogUrl})`);
    }
    if (ogImage && !ogImage.startsWith('https://')) {
      err(rp, `og:image must be absolute HTTPS URL, got: ${ogImage}`);
    }
    if (ogImage && ogImage.startsWith(SITE_ORIGIN)) {
      const exists = await imageExistsOnDisk(ogImage);
      if (!exists) {
        err(rp, `og:image file not found on disk: ${ogImage}`);
      }
    }
    if (twImage && !twImage.startsWith('https://')) {
      err(rp, `twitter:image must be absolute HTTPS URL, got: ${twImage}`);
    }

    // Homepage-specific checks
    if (routePath === '/') {
      const robots = extract(content, /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
      if (!robots) {
        err(rp, 'Homepage missing <meta name="robots">');
      }
    }
  }

  // --- Report ---
  console.log('');
  if (warnings.length > 0) {
    console.log(`[meta-og] ⚠ ${warnings.length} warning(s):`);
    warnings.forEach(w => console.warn(`  ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.error(`[meta-og] ✗ ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  ${e}`));
    console.error(`\n[meta-og] FAILED — ${errors.length} blocking error(s)`);
    return errors.length;
  }

  console.log(`[meta-og] ✓ All OG/social preview checks passed (${warnings.length} warnings)`);
  return 0;
}

const exitCode = await audit();
if (exitCode > 0) {
  process.exit(1);
}
