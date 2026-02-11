#!/usr/bin/env node
/**
 * Nav Registry CI Check
 *
 * Header: 5 flat links (Sell, Buy, Areas, About, Contact CTA).
 * Footer: Sell, Buy, Learn groups via data-footer-nav attributes.
 * This script validates:
 *   1. Every page has <nav id="main-nav"> with header links matching NAV_REGISTRY
 *   2. assets/js/nav.js TD_NAV matches src/config/nav.js NAV_REGISTRY
 *   3. Footer data-footer-nav containers have static links matching NAV_REGISTRY
 *   4. No testimonials links
 *
 * Exit code 1 on any mismatch.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { NAV_REGISTRY } = require(join(ROOT, 'src', 'config', 'nav.js'));

const registryHeaderHrefs = NAV_REGISTRY.header.map(i => i.href);
const footerGroupNames = NAV_REGISTRY.footerGroups
  ? Object.keys(NAV_REGISTRY.footerGroups)
  : ['services', 'learn'];

const errors = [];

const SKIP_DIRS = new Set([
  'node_modules', 'admin', 'audit', 'output',
  'scripts', 'templates', 'tools', 'reports', 'data', 'lp',
]);

async function collectHtmlFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...await collectHtmlFiles(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

function rel(absPath) {
  return relative(ROOT, absPath);
}

async function checkHtmlFiles() {
  const files = await collectHtmlFiles(ROOT);
  console.log(`Found ${files.length} HTML file(s) to scan.\n`);

  let checked = 0;

  for (const file of files) {
    if (file.endsWith('404.html')) continue;

    const html = await readFile(file, 'utf-8');
    if (!html.includes('<nav') || !html.includes('<footer')) continue;
    checked++;

    const rp = rel(file);

    // 1. Check nav exists and static links match NAV_REGISTRY header
    const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/i);
    if (!navMatch) {
      errors.push(`${rp}: missing <nav id="main-nav">`);
    } else {
      const navInner = navMatch[1];
      const hrefRe = /href="([^"]+)"/g;
      const foundHrefs = new Set();
      let hm;
      while ((hm = hrefRe.exec(navInner)) !== null) {
        foundHrefs.add(hm[1]);
      }
      for (const href of registryHeaderHrefs) {
        if (!foundHrefs.has(href)) {
          errors.push(`${rp}: nav#main-nav missing link to ${href}`);
        }
      }
    }

    // 2. Check footer group containers exist
    for (const groupName of footerGroupNames) {
      if (!html.includes(`data-footer-nav="${groupName}"`)) {
        errors.push(`${rp}: missing data-footer-nav="${groupName}" container`);
      }
    }

    // 3. Check footer static links match NAV_REGISTRY.footerGroups
    const footerGroupsConfig = NAV_REGISTRY.footerGroups || {};
    for (const groupName of footerGroupNames) {
      const groupRe = new RegExp(`data-footer-nav="${groupName}"[^>]*>([\\s\\S]*?)<\\/ul>`, 'i');
      const groupMatch = html.match(groupRe);
      if (groupMatch && footerGroupsConfig[groupName]) {
        const footerHrefRe = /href="([^"]+)"/g;
        const footerHrefs = new Set();
        let fm;
        while ((fm = footerHrefRe.exec(groupMatch[1])) !== null) {
          footerHrefs.add(fm[1]);
        }
        for (const item of footerGroupsConfig[groupName].items) {
          if (!footerHrefs.has(item.href)) {
            errors.push(`${rp}: footer ${groupName} missing link to ${item.href}`);
          }
        }
      }
    }

    // 4. No testimonials links
    if (html.includes('href="/testimonials/"')) {
      errors.push(`${rp}: testimonials link found (should be removed)`);
    }
  }

  console.log(`Checked nav & footer in ${checked} page(s).\n`);
}

async function checkAssetsNavJs() {
  const navJsPath = join(ROOT, 'assets', 'js', 'nav.js');
  const src = await readFile(navJsPath, 'utf-8');

  // Extract all hrefs from nav.js
  const hrefRegex = /href:\s*'([^']+)'/g;
  const navJsHrefs = new Set();
  let m;
  while ((m = hrefRegex.exec(src)) !== null) {
    navJsHrefs.add(m[1]);
  }

  // Get all hrefs from NAV_REGISTRY (header + groups)
  const registryHrefs = new Set();
  for (const item of NAV_REGISTRY.header) {
    registryHrefs.add(item.href);
  }
  for (const group of Object.values(NAV_REGISTRY.groups)) {
    for (const item of group.items) {
      registryHrefs.add(item.href);
    }
  }

  for (const href of registryHrefs) {
    if (!navJsHrefs.has(href)) {
      errors.push(`assets/js/nav.js: TD_NAV missing href ${href}`);
    }
  }
  for (const href of navJsHrefs) {
    // Skip footerInternal-only hrefs (e.g. /) since those aren't in groups
    if (registryHrefs.has(href)) continue;
    // Allow hrefs in footerLegal or footerInternal
    if (NAV_REGISTRY.footerInternal && NAV_REGISTRY.footerInternal.includes(href)) continue;
    if (NAV_REGISTRY.footerLegal && NAV_REGISTRY.footerLegal.some(l => l.href === href)) continue;
    errors.push(`assets/js/nav.js: TD_NAV has unexpected href ${href}`);
  }

  console.log(`assets/js/nav.js: TD_NAV has ${navJsHrefs.size} hrefs, NAV_REGISTRY has ${registryHrefs.size} hrefs.\n`);
}

async function main() {
  console.log('\n=== Nav Registry CI Check ===\n');

  await checkHtmlFiles();
  await checkAssetsNavJs();

  console.log('=== Results ===\n');

  if (errors.length > 0) {
    console.error('ERRORS:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    console.error(`\nFailed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('All nav-registry checks passed.\n');
}

main().catch(err => {
  console.error('Nav registry check crashed:', err);
  process.exit(1);
});
