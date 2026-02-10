#!/usr/bin/env node
/**
 * Content Freshness Checker
 * Scans all HTML files and checks article:modified_time meta tags.
 * Flags pages that haven't been updated within a configurable threshold.
 *
 * Usage:
 *   node scripts/check-content-freshness.mjs                # default 90-day threshold
 *   node scripts/check-content-freshness.mjs --days 60      # custom threshold
 *   node scripts/check-content-freshness.mjs --strict       # exit 1 on stale pages
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
  'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
  'gsc', 'data', 'functions', 'docs', 'media', 'lp', 'thank-you',
  'admin', 'tools', 'test-results', 'playwright-report', 'screenshots',
]);

// Pages where freshness is less critical
const LOW_PRIORITY_PATHS = new Set([
  '/privacy/', '/terms/', '/fair-housing/', '/sitemap-page/',
  '/credentials/', '/agents/',
]);

const args = process.argv.slice(2);
const daysIndex = args.indexOf('--days');
const THRESHOLD_DAYS = daysIndex >= 0 ? parseInt(args[daysIndex + 1], 10) : 90;
const STRICT = args.includes('--strict');

async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      await findHtmlFiles(fullPath, files);
    } else if (entry.name === 'index.html') {
      files.push(fullPath);
    }
  }
  return files;
}

function extractModifiedTime(html) {
  const match = html.match(/<meta\s+property=["']article:modified_time["']\s+content=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function daysBetween(dateStr, now) {
  const date = new Date(dateStr);
  const diff = now - date;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getPagePath(filePath) {
  const rel = relative(ROOT, filePath);
  const pagePath = '/' + rel.replace(/index\.html$/, '').replace(/\\/g, '/');
  return pagePath === '//' ? '/' : pagePath;
}

async function main() {
  console.log(`\n[freshness] Content Freshness Check (threshold: ${THRESHOLD_DAYS} days)`);
  console.log('='.repeat(60));

  const files = await findHtmlFiles(ROOT);
  const now = new Date();
  const stale = [];
  const fresh = [];
  const noDate = [];

  for (const filePath of files) {
    const html = await readFile(filePath, 'utf-8');
    const modifiedTime = extractModifiedTime(html);
    const pagePath = getPagePath(filePath);

    if (!modifiedTime) {
      noDate.push({ pagePath, filePath });
      continue;
    }

    const age = daysBetween(modifiedTime, now);
    const entry = { pagePath, modifiedTime, age, filePath };

    if (age > THRESHOLD_DAYS && !LOW_PRIORITY_PATHS.has(pagePath)) {
      stale.push(entry);
    } else {
      fresh.push(entry);
    }
  }

  // Sort stale by age descending
  stale.sort((a, b) => b.age - a.age);

  if (stale.length > 0) {
    console.log(`\n  STALE PAGES (>${THRESHOLD_DAYS} days old):`);
    for (const { pagePath, modifiedTime, age } of stale) {
      console.log(`    ${pagePath.padEnd(50)} ${modifiedTime}  (${age} days ago)`);
    }
  }

  if (noDate.length > 0) {
    console.log(`\n  MISSING article:modified_time:`);
    for (const { pagePath } of noDate) {
      console.log(`    ${pagePath}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`  Total pages:     ${files.length}`);
  console.log(`  Fresh:           ${fresh.length}`);
  console.log(`  Stale:           ${stale.length}`);
  console.log(`  Missing date:    ${noDate.length}`);
  console.log('='.repeat(60));

  if (stale.length > 0) {
    console.log(`\n  ${stale.length} page(s) haven't been updated in ${THRESHOLD_DAYS}+ days.`);
    if (STRICT) {
      console.log('  [strict mode] Exiting with error.');
      process.exit(1);
    }
  } else {
    console.log('\n  All content is fresh!');
  }
}

main().catch(err => {
  console.error('[freshness] FATAL:', err);
  process.exit(1);
});
