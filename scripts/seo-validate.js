#!/usr/bin/env node
/**
 * SEO Crawl Surface Validation
 * Validates robots.txt, sitemap.xml, filesystem cross-references,
 * coverage, and _headers/_redirects sanity for search engine crawlability.
 */

const { readdir, readFile, access } = require('fs').promises;
const { join } = require('path');

const ROOT = join(__dirname, '..');
const DOMAIN = 'https://tdrealtyohio.com';
const errors = [];
const warnings = [];

// Directories to skip when scanning for public routes
const SKIP_DIRS = new Set([
  'node_modules', 'scripts', 'templates', 'tools', 'reports',
  'output', 'data', 'audit', 'admin', 'lp'
]);

// ============================================================
// 1. robots.txt validation
// ============================================================
async function validateRobotsTxt() {
  console.log('--- robots.txt validation ---\n');

  let content;
  try {
    content = await readFile(join(ROOT, 'robots.txt'), 'utf-8');
  } catch {
    errors.push('robots.txt: file not found');
    return;
  }

  // Check for Sitemap directive (exact URL)
  const expectedSitemap = `Sitemap: ${DOMAIN}/sitemap.xml`;
  if (content.includes(expectedSitemap)) {
    console.log(`  PASS  Sitemap directive present: ${expectedSitemap}`);
  } else {
    errors.push(`robots.txt: missing or incorrect Sitemap directive (expected "${expectedSitemap}")`);
  }

  // Check for User-agent: * with Allow: /
  // Parse robots.txt blocks to find the wildcard user-agent section
  const lines = content.split('\n').map(l => l.trim());
  let inWildcardBlock = false;
  let foundAllow = false;

  for (const line of lines) {
    if (/^User-agent:\s*\*$/i.test(line)) {
      inWildcardBlock = true;
      continue;
    }
    if (inWildcardBlock && /^User-agent:/i.test(line)) {
      // Entered a new user-agent block, stop looking
      break;
    }
    if (inWildcardBlock && /^Allow:\s*\/$/i.test(line)) {
      foundAllow = true;
    }
  }

  if (inWildcardBlock && foundAllow) {
    console.log('  PASS  User-agent: * with Allow: / found');
  } else {
    errors.push('robots.txt: missing User-agent: * with Allow: /');
  }
}

// ============================================================
// 2. sitemap.xml validation
// ============================================================
async function validateSitemapXml() {
  console.log('\n--- sitemap.xml validation ---\n');

  let content;
  try {
    content = await readFile(join(ROOT, 'sitemap.xml'), 'utf-8');
  } catch {
    errors.push('sitemap.xml: file not found');
    return [];
  }

  // Parse all <loc> URLs
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  const urls = [];
  let match;
  while ((match = locRegex.exec(content)) !== null) {
    urls.push(match[1].trim());
  }

  if (urls.length === 0) {
    errors.push('sitemap.xml: no <loc> URLs found');
    return [];
  }

  console.log(`  Found ${urls.length} URLs in sitemap\n`);

  // Check all URLs start with the correct domain
  const badPrefix = urls.filter(u => !u.startsWith(DOMAIN + '/'));
  if (badPrefix.length > 0) {
    for (const u of badPrefix) {
      errors.push(`sitemap.xml: URL does not start with ${DOMAIN}/: ${u}`);
    }
  } else {
    console.log(`  PASS  All URLs start with ${DOMAIN}/`);
  }

  // Check all URLs end with trailing slash
  const noTrailing = urls.filter(u => !u.endsWith('/'));
  if (noTrailing.length > 0) {
    for (const u of noTrailing) {
      errors.push(`sitemap.xml: URL missing trailing slash: ${u}`);
    }
  } else {
    console.log('  PASS  All URLs end with /');
  }

  // Check no URLs contain query params
  const hasQuery = urls.filter(u => u.includes('?'));
  if (hasQuery.length > 0) {
    for (const u of hasQuery) {
      errors.push(`sitemap.xml: URL contains query params: ${u}`);
    }
  } else {
    console.log('  PASS  No URLs contain query params');
  }

  // Check no duplicate URLs
  const seen = new Set();
  const dupes = [];
  for (const u of urls) {
    if (seen.has(u)) {
      dupes.push(u);
    }
    seen.add(u);
  }
  if (dupes.length > 0) {
    for (const u of dupes) {
      errors.push(`sitemap.xml: duplicate URL: ${u}`);
    }
  } else {
    console.log('  PASS  No duplicate URLs');
  }

  return urls;
}

// ============================================================
// 3. Cross-reference sitemap with filesystem
// ============================================================
async function crossReferenceFilesystem(sitemapUrls) {
  console.log('\n--- Filesystem cross-reference ---\n');

  if (sitemapUrls.length === 0) {
    console.log('  SKIP  No sitemap URLs to cross-reference');
    return;
  }

  const prefix = DOMAIN;

  for (const url of sitemapUrls) {
    // Strip domain to get path
    const path = url.slice(prefix.length); // e.g. "/sellers/"

    // Skip root / which maps to index.html at project root
    if (path === '/') {
      continue;
    }

    // Remove leading slash, keep trailing slash -> "sellers/"
    const relativePath = path.slice(1); // "sellers/"

    // Skip non-public paths that shouldn't be in the sitemap (warn only)
    const nonPublicPrefixes = ['templates/', 'scripts/', 'tools/', 'data/'];
    if (nonPublicPrefixes.some(p => relativePath.startsWith(p))) {
      warnings.push(`sitemap.xml contains non-public path ${url} — consider removing from sitemap`);
      continue;
    }

    const indexFile = join(ROOT, relativePath, 'index.html');

    try {
      await access(indexFile);
    } catch {
      errors.push(`sitemap.xml: no index.html found for ${url} (expected ${relativePath}index.html)`);
    }
  }

  const checked = sitemapUrls.length - 1; // minus root
  const errorCountForSection = errors.filter(e => e.startsWith('sitemap.xml: no index.html')).length;
  if (errorCountForSection === 0) {
    console.log(`  PASS  All ${checked} non-root sitemap URLs have matching index.html files`);
  }
}

// ============================================================
// 4. Coverage check - find public routes not in sitemap
// ============================================================
async function findPublicRoutes(dir, routes = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return routes;
  }

  // Check if this directory itself has an index.html
  const hasIndex = entries.some(e => !e.isDirectory() && e.name === 'index.html');
  if (hasIndex) {
    const relativePath = dir.replace(ROOT, '') || '/';
    routes.push(relativePath);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    await findPublicRoutes(join(dir, entry.name), routes);
  }

  return routes;
}

async function checkCoverage(sitemapUrls) {
  console.log('\n--- Coverage check ---\n');

  if (sitemapUrls.length === 0) {
    console.log('  SKIP  No sitemap URLs for coverage check');
    return;
  }

  // Build set of sitemap paths
  const sitemapPaths = new Set();
  for (const url of sitemapUrls) {
    const path = url.slice(DOMAIN.length); // e.g. "/sellers/"
    // Normalize: ensure trailing slash
    sitemapPaths.add(path.endsWith('/') ? path : path + '/');
  }

  // Find all public routes on the filesystem
  const publicRoutes = await findPublicRoutes(ROOT);

  let missingCount = 0;
  for (const route of publicRoutes) {
    // Normalize route to match sitemap format: ensure trailing slash
    const normalized = route.endsWith('/') ? route : route + '/';

    if (!sitemapPaths.has(normalized)) {
      warnings.push(`Coverage: public route ${normalized} has index.html but is NOT in sitemap`);
      missingCount++;
    }
  }

  console.log(`  Scanned ${publicRoutes.length} public routes with index.html`);
  console.log(`  Sitemap contains ${sitemapUrls.length} URLs`);

  if (missingCount === 0) {
    console.log('  PASS  All public routes are represented in sitemap');
  } else {
    console.log(`  WARN  ${missingCount} public route(s) not in sitemap (see warnings below)`);
  }
}

// ============================================================
// 5. _headers / _redirects sanity
// ============================================================
async function validateHeadersAndRedirects() {
  console.log('\n--- _headers / _redirects sanity ---\n');

  // --- _headers ---
  let headersContent;
  try {
    headersContent = await readFile(join(ROOT, '_headers'), 'utf-8');
  } catch {
    console.log('  SKIP  _headers file not found');
    headersContent = null;
  }

  if (headersContent !== null) {
    // Check that no rule specifically targets /robots.txt or /sitemap.xml
    // with blocking headers (X-Robots-Tag: noindex, etc.)
    const headersLines = headersContent.split('\n');
    let currentPath = null;

    for (const line of headersLines) {
      const trimmed = line.trim();
      // Path rules start at column 0 (no leading whitespace) and start with /
      if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.startsWith('/')) {
        currentPath = trimmed.split(/\s/)[0];
      }

      // Check if current path applies to robots.txt or sitemap.xml
      if (currentPath === '/robots.txt' || currentPath === '/sitemap.xml') {
        if (/x-robots-tag/i.test(trimmed) && /noindex/i.test(trimmed)) {
          errors.push(`_headers: path ${currentPath} has X-Robots-Tag: noindex which blocks crawling`);
        }
        // Check for deny/block patterns
        if (/access-control/i.test(trimmed) && /deny/i.test(trimmed)) {
          errors.push(`_headers: path ${currentPath} has access control deny header`);
        }
      }
    }

    console.log('  PASS  _headers does not block /robots.txt or /sitemap.xml');
  }

  // --- _redirects ---
  let redirectsContent;
  try {
    redirectsContent = await readFile(join(ROOT, '_redirects'), 'utf-8');
  } catch {
    console.log('  SKIP  _redirects file not found');
    redirectsContent = null;
  }

  if (redirectsContent !== null) {
    const redirectLines = redirectsContent.split('\n');

    for (const line of redirectLines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse redirect rule: source destination [status]
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;

      const source = parts[0];

      // Check if any redirect source matches /robots.txt or /sitemap.xml
      // Exact match
      if (source === '/robots.txt' || source === '/robots.txt/') {
        errors.push(`_redirects: redirect rule matches /robots.txt: ${trimmed}`);
      }
      if (source === '/sitemap.xml' || source === '/sitemap.xml/') {
        errors.push(`_redirects: redirect rule matches /sitemap.xml: ${trimmed}`);
      }

      // Wildcard match - check if a splat or pattern could capture these files
      // e.g. /*.txt or /*.xml
      if (source.includes('*')) {
        const pattern = source.replace(/\*/g, '.*').replace(/\//g, '\\/');
        try {
          const regex = new RegExp('^' + pattern + '$');
          if (regex.test('/robots.txt')) {
            errors.push(`_redirects: wildcard rule "${source}" matches /robots.txt: ${trimmed}`);
          }
          if (regex.test('/sitemap.xml')) {
            errors.push(`_redirects: wildcard rule "${source}" matches /sitemap.xml: ${trimmed}`);
          }
        } catch {
          // If regex construction fails, skip
        }
      }
    }

    console.log('  PASS  _redirects does not redirect /robots.txt or /sitemap.xml');
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('\n========================================');
  console.log(' SEO Crawl Surface Validation');
  console.log('========================================\n');

  await validateRobotsTxt();
  const sitemapUrls = await validateSitemapXml();
  await crossReferenceFilesystem(sitemapUrls);
  await checkCoverage(sitemapUrls);
  await validateHeadersAndRedirects();

  // Print summary
  console.log('\n========================================');
  console.log(' Summary');
  console.log('========================================\n');

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.log(`  WARN  ${w}`);
    }
    console.log('');
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`  FAIL  ${e}`);
    }
    console.log(`\nFailed with ${errors.length} error(s)\n`);
    process.exit(1);
  }

  console.log(`  ${warnings.length} warning(s), 0 error(s)`);
  console.log('\nAll SEO crawl surface checks passed!\n');
}

main().catch(err => {
  console.error('SEO validation failed:', err);
  process.exit(1);
});
