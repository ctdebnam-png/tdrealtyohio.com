#!/usr/bin/env node
/**
 * Sitemap Generator for TD Realty Ohio
 * Generates sitemap.xml from HTML files using canonical URLs
 */

import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { join, dirname, relative } from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE_URL = 'https://tdrealtyohio.com';
const execFileAsync = promisify(execFile);

// Priority mapping based on page type
const PRIORITY_MAP = {
  '/': '1.0',
  '/sellers/': '0.9',
  '/buyers/': '0.9',
  '/tools/': '0.7',
  '/1-percent-commission/': '0.9',
  '/sell-only-2-percent/': '0.9',
  '/pre-listing-inspection/': '0.8',
  '/contact/': '0.8',
  '/home-value/': '0.7',
  '/affordability/': '0.7',
  '/areas/': '0.8',
  '/about/': '0.7',
  '/agents/': '0.6',
  '/referrals/': '0.5',
  '/blog/': '0.7',
  '/faq/': '0.7',
  '/compare/': '0.7',
  '/compare/1-percent-vs-3-percent/': '0.7',
  '/compare/discount-broker-vs-full-service/': '0.7',
  '/compare/flat-fee-mls-vs-full-service/': '0.7',
  '/sitemap-page/': '0.4',
  '/privacy/': '0.3',
  '/terms/': '0.3',
  '/fair-housing/': '0.3',
};

// Pages to exclude from sitemap
// Note: /lp/ pages are ad landing pages with noindex meta tags
const EXCLUDE = ['/404.html', '/404/', '/lp/', '/sell-and-buy/', '/admin/'];

/**
 * Get canonical URL from HTML file
 */
async function getCanonicalUrl(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const match = content.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (match) {
      return match[1];
    }
  } catch (e) {
    // File might not exist
  }
  return null;
}

/**
 * Map file path to canonical URL
 */
function filePathToCanonicalUrl(filePath) {
  const relativePath = filePath.replace(ROOT, '').replace(/\\/g, '/');

  // Handle index.html files
  if (relativePath === '/index.html') {
    return `${SITE_URL}/`;
  }

  // Handle subdirectory index.html (blog/*, areas/*)
  if (relativePath.endsWith('/index.html')) {
    const dir = relativePath.replace('/index.html', '/');
    return `${SITE_URL}${dir}`;
  }

  // Handle regular .html files - convert to clean URL with trailing slash
  if (relativePath.endsWith('.html')) {
    const cleanPath = relativePath.replace('.html', '/');
    return `${SITE_URL}${cleanPath}`;
  }

  return null;
}

/**
 * Recursively find all HTML files
 */
async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  const skipDirs = new Set([
    'node_modules',
    'scripts',
    'audit-output',
    'audit-artifacts',
    'output',
    'reports',
    'assets',
    'media',
    'site-quality-gate',
    'site-audit'
  ]);

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip node_modules, hidden dirs, and other non-content dirs
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') ||
          skipDirs.has(entry.name)) {
        continue;
      }
      await findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Get last modified date for a file
 */
async function getLastMod(filePath, existingLastMod = null) {
  const relativePath = relative(ROOT, filePath).replace(/\\/g, '/');

  // Preferred source: git commit date for the file
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cs', '--', relativePath], {
      cwd: ROOT,
    });
    const gitDate = stdout.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(gitDate)) {
      return gitDate;
    }
  } catch {
    // Fall through to filesystem mtime
  }

  // Fallback source: filesystem mtime
  try {
    const fileStats = await stat(filePath);
    if (!Number.isNaN(fileStats.mtimeMs)) {
      return fileStats.mtime.toISOString().split('T')[0];
    }
  } catch {
    // Guard below preserves existing value when no reliable date is available
  }

  return existingLastMod;
}

/**
 * Parse an existing sitemap to preserve historic lastmod values when needed
 */
async function readExistingSitemapLastMods() {
  const existing = new Map();

  try {
    const sitemapContent = await readFile(join(ROOT, 'sitemap.xml'), 'utf-8');
    const urlPattern = /<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/g;
    let match;

    while ((match = urlPattern.exec(sitemapContent)) !== null) {
      existing.set(match[1], match[2]);
    }
  } catch {
    // No existing sitemap yet
  }

  return existing;
}

/**
 * Generate sitemap XML
 */
async function generateSitemap() {
  console.log('Generating sitemap.xml...');

  const htmlFiles = await findHtmlFiles(ROOT);
  const existingLastMods = await readExistingSitemapLastMods();
  const urls = [];

  for (const filePath of htmlFiles) {
    const canonicalUrl = filePathToCanonicalUrl(filePath);

    if (!canonicalUrl) continue;

    // Check if excluded
    const path = canonicalUrl.replace(SITE_URL, '');
    if (EXCLUDE.some(ex => path === ex || path.startsWith(ex.replace('.html', '')))) {
      continue;
    }

    const lastmod = await getLastMod(filePath, existingLastMods.get(canonicalUrl));
    const priority = PRIORITY_MAP[path] || (path.startsWith('/blog/') && path !== '/blog/' ? '0.6' : '0.5');
    const changefreq = path.startsWith('/blog/') ? 'monthly' :
                       path === '/' ? 'weekly' :
                       ['privacy', 'terms', 'fair-housing'].some(p => path.includes(p)) ? 'yearly' : 'monthly';

    urls.push({
      loc: canonicalUrl,
      lastmod,
      changefreq,
      priority
    });
  }

  // Sort by priority (descending) then alphabetically
  urls.sort((a, b) => {
    const pDiff = parseFloat(b.priority) - parseFloat(a.priority);
    if (pDiff !== 0) return pDiff;
    return a.loc.localeCompare(b.loc);
  });

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

  await writeFile(join(ROOT, 'sitemap.xml'), xml);
  console.log(`Generated sitemap.xml with ${urls.length} URLs`);

  return urls;
}

// Run if executed directly
generateSitemap().catch(console.error);
