#!/usr/bin/env node
/**
 * Duplicate Canonical Checker
 * Ensures no two pages claim the same canonical URL.
 * Also validates that noindex is never applied to money pages.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
  'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
  'gsc', 'data', 'functions', 'docs', 'media', 'tools/site-quality-gate',
  'tools/site-audit',
]);

// Money page paths that must NEVER have noindex
const MONEY_PATHS = [
  '/', '/sellers/', '/buyers/', '/sellers/', '/sell-only-2-percent/',
  '/sellers/', '/home-value/', '/affordability/', '/contact/',
  '/areas/', '/compare/', '/faq/', '/about/',
];

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

async function check() {
  console.log('[canonicals] Scanning for duplicate canonicals and noindex issues...');
  const htmlFiles = await findHtmlFiles(ROOT);
  const canonicals = new Map(); // canonical URL -> [file paths]
  let errors = 0;

  for (const file of htmlFiles) {
    const content = await readFile(file, 'utf-8');
    const relativePath = file.replace(ROOT, '');

    // Extract canonical
    const canonMatch = content.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (canonMatch) {
      const canonical = canonMatch[1];
      if (!canonicals.has(canonical)) {
        canonicals.set(canonical, []);
      }
      canonicals.get(canonical).push(relativePath);
    }

    // Check for noindex on money pages
    const isMoneyPage = MONEY_PATHS.some(mp =>
      relativePath === mp + 'index.html' ||
      relativePath.startsWith('/areas/') ||
      relativePath.startsWith('/compare/') ||
      relativePath.startsWith('/tools/')
    );

    if (isMoneyPage) {
      const hasNoindex = content.match(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["']/i);
      if (hasNoindex) {
        console.error(`[canonicals] NOINDEX ON MONEY PAGE: ${relativePath}`);
        errors++;
      }
    }
  }

  // Check for duplicates
  for (const [canonical, files] of canonicals) {
    if (files.length > 1) {
      console.error(`[canonicals] DUPLICATE CANONICAL: ${canonical}`);
      files.forEach(f => console.error(`    - ${f}`));
      errors++;
    }
  }

  if (errors === 0) {
    console.log(`[canonicals] ${canonicals.size} canonical URLs checked — no duplicates, no noindex on money pages`);
  } else {
    console.error(`\n[canonicals] ${errors} issue(s) found`);
  }

  return errors;
}

const errorCount = await check();
if (errorCount > 0) {
  process.exit(1);
}
