#!/usr/bin/env node
/**
 * Navigation Consistency Check for TD Realty Ohio
 *
 * Header nav links are static HTML in every page (for SEO crawlability).
 * Footer links are also static HTML in every page (for SEO and reliability).
 * This script validates:
 *   1. Every page has <nav id="main-nav"> with static links matching NAV_REGISTRY
 *   2. assets/js/nav.js TD_NAV matches src/config/nav.js NAV_REGISTRY
 *   3. Footer static links match NAV_REGISTRY
 */

import { createRequire } from 'module';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const require = createRequire(import.meta.url);
const { NAV_REGISTRY } = require('../src/config/nav.js');

const errors = [];

/**
 * Validate that a single HTML file has the expected placeholder containers
 * and no remaining hardcoded nav/footer links.
 */
async function checkFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const rel = filePath.replace(ROOT + '/', '');

  // 1. Check for nav#main-nav placeholder
  const navMatch = content.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/i);
  if (!navMatch) {
    errors.push(`${rel}: missing <nav id="main-nav">`);
    return;
  }

  // Validate static nav contains all required links from NAV_REGISTRY
  const navInner = navMatch[1];
  const hrefRe = /href="([^"]+)"/g;
  const foundHrefs = new Set();
  let hm;
  while ((hm = hrefRe.exec(navInner)) !== null) {
    foundHrefs.add(hm[1]);
  }
  for (const group of Object.values(NAV_REGISTRY.groups)) {
    for (const item of group.items) {
      if (!foundHrefs.has(item.href)) {
        errors.push(`${rel}: nav#main-nav missing link to ${item.href}`);
      }
    }
  }

  // 2. Check for data-footer-nav="services" container
  if (!content.includes('data-footer-nav="services"')) {
    errors.push(`${rel}: missing data-footer-nav="services" container`);
  }
  if (!content.includes('data-footer-nav="company"')) {
    errors.push(`${rel}: missing data-footer-nav="company" container`);
  }

  // 3. Check footer static links match NAV_REGISTRY
  const svcMatch = content.match(/data-footer-nav="services">([\s\S]*?)<\/ul>/i);
  if (svcMatch) {
    const footerHrefRe = /href="([^"]+)"/g;
    const footerSvcHrefs = new Set();
    let fm;
    while ((fm = footerHrefRe.exec(svcMatch[1])) !== null) {
      footerSvcHrefs.add(fm[1]);
    }
    for (const item of NAV_REGISTRY.groups.services.items) {
      if (!footerSvcHrefs.has(item.href)) {
        errors.push(`${rel}: footer services missing link to ${item.href}`);
      }
    }
  }

  const cmpMatch = content.match(/data-footer-nav="company">([\s\S]*?)<\/ul>/i);
  if (cmpMatch) {
    const footerHrefRe2 = /href="([^"]+)"/g;
    const footerCmpHrefs = new Set();
    let fm2;
    while ((fm2 = footerHrefRe2.exec(cmpMatch[1])) !== null) {
      footerCmpHrefs.add(fm2[1]);
    }
    for (const item of NAV_REGISTRY.groups.company.items) {
      if (!footerCmpHrefs.has(item.href)) {
        errors.push(`${rel}: footer company missing link to ${item.href}`);
      }
    }
  }

  // 4. No testimonials links anywhere
  if (content.includes('href="/testimonials/"')) {
    errors.push(`${rel}: testimonials link found (should be removed)`);
  }
}

/**
 * Validate that assets/js/nav.js TD_NAV is in sync with src/config/nav.js NAV_REGISTRY
 */
async function checkNavSync() {
  const navJsContent = await readFile(join(ROOT, 'assets/js/nav.js'), 'utf-8');

  // Extract TD_NAV hrefs from nav.js
  const hrefRegex = /href:\s*['"]([^'"]+)['"]/g;
  const navJsHrefs = new Set();
  let m;
  while ((m = hrefRegex.exec(navJsContent)) !== null) {
    navJsHrefs.add(m[1]);
  }

  // Get all hrefs from NAV_REGISTRY
  const registryHrefs = new Set();
  for (const group of Object.values(NAV_REGISTRY.groups)) {
    for (const item of group.items) {
      registryHrefs.add(item.href);
    }
  }

  // Check every registry href is in nav.js
  for (const href of registryHrefs) {
    if (!navJsHrefs.has(href)) {
      errors.push(`assets/js/nav.js TD_NAV is missing: ${href} (present in src/config/nav.js)`);
    }
  }

  // Check for extra hrefs in nav.js not in registry
  for (const href of navJsHrefs) {
    if (!registryHrefs.has(href)) {
      errors.push(`assets/js/nav.js TD_NAV has extra link: ${href} (not in src/config/nav.js)`);
    }
  }

  console.log(`  NAV_REGISTRY has ${registryHrefs.size} destinations`);
  console.log(`  assets/js/nav.js TD_NAV has ${navJsHrefs.size} destinations`);
}

async function validate() {
  console.log('\n=== TD Realty Ohio Navigation Check ===\n');

  // Find all public HTML files
  const skipDirs = ['node_modules', 'templates', 'tools', 'data', 'reports', 'audit', 'scripts', 'lp', 'admin'];
  const htmlFiles = globSync('**/*.html', {
    cwd: ROOT,
    ignore: skipDirs.map(d => `${d}/**`),
    absolute: true,
  });

  console.log(`Checking ${htmlFiles.length} HTML files for nav/footer placeholders...\n`);

  for (const filePath of htmlFiles) {
    await checkFile(filePath);
  }

  console.log('  Checking TD_NAV ↔ NAV_REGISTRY sync...');
  await checkNavSync();

  console.log('\n=== Results ===\n');

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
    console.log(`\nFailed with ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log('All navigation checks passed!\n');
}

validate().catch(err => {
  console.error('Navigation check failed:', err);
  process.exit(1);
});
