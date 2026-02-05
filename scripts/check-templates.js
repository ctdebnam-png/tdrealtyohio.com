#!/usr/bin/env node
/**
 * Header Template Consistency Check
 * Fails CI if more than one header pattern is used across routes,
 * or if any nav contains duplicate hrefs.
 */

const { readdir, readFile } = require('fs').promises;
const { join } = require('path');

const ROOT = join(__dirname, '..');
const errors = [];

/**
 * Recursively find all HTML files, excluding non-page directories
 */
async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'templates' ||
          entry.name === 'tools' ||
          entry.name === 'reports' ||
          entry.name === 'audit' ||
          entry.name === 'data' ||
          entry.name.startsWith('audit-')) {
        continue;
      }
      await findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html') && entry.name !== '404.html') {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extract the header nav pattern from an HTML file.
 * Returns a normalized string of the nav structure for comparison.
 */
function extractNavPattern(html) {
  const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
  if (!navMatch) return null;

  const navContent = navMatch[1];
  // Extract all hrefs in order
  const hrefs = [];
  const hrefRegex = /href="([^"]+)"/g;
  let m;
  while ((m = hrefRegex.exec(navContent)) !== null) {
    hrefs.push(m[1]);
  }

  // Extract section headers
  const headers = [];
  const headerRegex = /class="nav-section-header"[^>]*>([^<]+)/g;
  while ((m = headerRegex.exec(navContent)) !== null) {
    headers.push(m[1].trim());
  }

  return JSON.stringify({ headers, hrefs });
}

/**
 * Check for duplicate hrefs in the nav
 */
function checkDuplicateNavHrefs(html, filePath) {
  const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
  if (!navMatch) return;

  const navContent = navMatch[1];
  const hrefs = [];
  const hrefRegex = /href="([^"]+)"/g;
  let m;
  while ((m = hrefRegex.exec(navContent)) !== null) {
    hrefs.push(m[1]);
  }

  const seen = new Set();
  for (const href of hrefs) {
    if (seen.has(href)) {
      errors.push(`${filePath}: Duplicate nav href found: ${href}`);
    }
    seen.add(href);
  }
}

async function main() {
  console.log('\n=== Header Template Consistency Check ===\n');

  const htmlFiles = await findHtmlFiles(ROOT);
  console.log(`Scanning ${htmlFiles.length} HTML files...\n`);

  const patterns = new Map(); // pattern -> [files]

  for (const filePath of htmlFiles) {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = filePath.replace(ROOT + '/', '');

    // Skip files without a nav (e.g., template fragments)
    if (!content.includes('id="main-nav"')) continue;

    const pattern = extractNavPattern(content);
    if (pattern) {
      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern).push(relativePath);
    }

    // Check for duplicate hrefs
    checkDuplicateNavHrefs(content, relativePath);
  }

  // Check: only one header pattern should exist
  if (patterns.size > 1) {
    errors.push(`Found ${patterns.size} different header patterns across routes:`);
    let i = 0;
    for (const [pattern, files] of patterns) {
      i++;
      const parsed = JSON.parse(pattern);
      errors.push(`  Pattern ${i} (${files.length} files): sections=[${parsed.headers.join(', ')}], ${parsed.hrefs.length} links`);
      errors.push(`    Example files: ${files.slice(0, 3).join(', ')}${files.length > 3 ? ` ... and ${files.length - 3} more` : ''}`);
    }
  } else if (patterns.size === 1) {
    const [, files] = [...patterns][0];
    console.log(`  Single header pattern found across ${files.length} pages`);
  }

  console.log('\n=== Results ===\n');

  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`  ERROR: ${e}`);
    }
    console.log(`\nFailed with ${errors.length} issue(s)\n`);
    process.exit(1);
  }

  console.log('All header template checks passed!\n');
}

main().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
