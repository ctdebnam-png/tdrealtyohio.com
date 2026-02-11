#!/usr/bin/env node
/**
 * Navigation Allowlist Regression Guard
 * Ensures header and footer nav href sets match strict allowlists.
 * If any extra or missing links appear, this check fails.
 *
 * Header allowlist: /sellers/, /buyers/, /areas/, /about/, /blog/, /contact/
 * Footer nav allowlist: /sellers/, /buyers/, /areas/, /about/, /blog/, /contact/
 * Footer legal allowlist: /privacy/, /terms/, /fair-housing/, /sitemap-page/
 */

const { readdir, readFile } = require('fs').promises;
const { join } = require('path');

const ROOT = join(__dirname, '..');
const errors = [];

// ── Allowlists ──
const HEADER_ALLOWLIST = new Set([
  '/sellers/', '/buyers/', '/areas/', '/about/', '/blog/', '/contact/'
]);

const FOOTER_NAV_ALLOWLIST = new Set([
  '/sellers/', '/buyers/', '/areas/', '/about/', '/blog/', '/contact/'
]);

const FOOTER_LEGAL_ALLOWLIST = new Set([
  '/privacy/', '/terms/', '/fair-housing/', '/sitemap-page/'
]);

// ── Helpers ──
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
          entry.name.startsWith('audit-')) continue;
      await findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html') && entry.name !== '404.html') {
      files.push(fullPath);
    }
  }
  return files;
}

function extractNavHrefs(html) {
  const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
  if (!navMatch) return null;
  const hrefs = new Set();
  const hrefRegex = /href="([^"]+)"/g;
  let m;
  while ((m = hrefRegex.exec(navMatch[1])) !== null) {
    hrefs.add(m[1]);
  }
  return hrefs;
}

function extractFooterNavHrefs(html) {
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/);
  if (!footerMatch) return null;
  const hrefs = new Set();
  const listRegex = /<ul[^>]*class="footer-links"[^>]*>([\s\S]*?)<\/ul>/g;
  let listMatch;
  while ((listMatch = listRegex.exec(footerMatch[1])) !== null) {
    const hrefRegex = /href="([^"]+)"/g;
    let m;
    while ((m = hrefRegex.exec(listMatch[1])) !== null) {
      hrefs.add(m[1]);
    }
  }
  return hrefs;
}

function extractFooterLegalHrefs(html) {
  const legalMatch = html.match(/<div class="footer-legal">([\s\S]*?)<\/div>/);
  if (!legalMatch) return null;
  const hrefs = new Set();
  const hrefRegex = /href="([^"]+)"/g;
  let m;
  while ((m = hrefRegex.exec(legalMatch[1])) !== null) {
    hrefs.add(m[1]);
  }
  return hrefs;
}

function checkAllowlist(actual, allowed, label, relativePath) {
  if (!actual) return;
  for (const href of actual) {
    if (!allowed.has(href)) {
      errors.push(`${relativePath}: ${label} contains disallowed link: ${href}`);
    }
  }
  for (const href of allowed) {
    if (!actual.has(href)) {
      errors.push(`${relativePath}: ${label} missing required link: ${href}`);
    }
  }
}

async function main() {
  console.log('\n=== Navigation Allowlist Regression Guard ===\n');

  const htmlFiles = await findHtmlFiles(ROOT);
  console.log(`Scanning ${htmlFiles.length} HTML files...\n`);

  // Check a representative sample (index.html as canonical reference)
  const indexPath = join(ROOT, 'index.html');
  const indexContent = await readFile(indexPath, 'utf-8');
  const rel = 'index.html';

  const headerHrefs = extractNavHrefs(indexContent);
  checkAllowlist(headerHrefs, HEADER_ALLOWLIST, 'Header nav', rel);

  const footerNavHrefs = extractFooterNavHrefs(indexContent);
  checkAllowlist(footerNavHrefs, FOOTER_NAV_ALLOWLIST, 'Footer nav', rel);

  const footerLegalHrefs = extractFooterLegalHrefs(indexContent);
  checkAllowlist(footerLegalHrefs, FOOTER_LEGAL_ALLOWLIST, 'Footer legal', rel);

  // Spot-check all pages for header nav consistency
  for (const filePath of htmlFiles) {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = filePath.replace(ROOT + '/', '');
    const navHrefs = extractNavHrefs(content);
    if (navHrefs) {
      for (const href of navHrefs) {
        if (!HEADER_ALLOWLIST.has(href)) {
          errors.push(`${relativePath}: Header nav contains disallowed link: ${href}`);
        }
      }
    }
  }

  console.log('=== Results ===\n');

  if (errors.length > 0) {
    for (const e of errors) console.log(`  FAIL: ${e}`);
    console.log(`\nFailed with ${errors.length} issue(s)\n`);
    process.exit(1);
  }

  console.log('All navigation allowlist checks passed!\n');
}

main().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
