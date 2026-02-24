#!/usr/bin/env node
/**
 * Sitemap Generator for TD Realty Ohio
 * Generates sitemap index + child sitemap files from canonical URLs.
 */

import { readdir, stat, writeFile, readFile } from 'fs/promises';
import { execFile } from 'child_process';
import { join, dirname, relative } from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE_URL = 'https://tdrealtyohio.com';
const execFileAsync = promisify(execFile);

const SITEMAP_FILES = {
  index: 'sitemap-index.xml',
  core: 'sitemap-core.xml',
  areas: 'sitemap-areas.xml',
  blog: 'sitemap-blog.xml',
};

// Priority mapping based on page type
const PRIORITY_MAP = {
  '/': '1.0',
  '/sellers/': '0.9',
  '/buyers/': '0.9',
  '/tools/': '0.7',
  '/pre-listing-inspection/': '0.8',
  '/contact/': '0.8',
  '/home-value/': '0.7',
  '/affordability/': '0.7',
  '/areas/': '0.8',
  '/about/': '0.7',
  '/careers/': '0.6',
  '/blog/': '0.7',
  '/faq/': '0.7',
  '/sitemap-page/': '0.4',
  '/privacy/': '0.3',
  '/terms/': '0.3',
  '/fair-housing/': '0.3',
};

// Pages to exclude from sitemap
// Note: /lp/ pages are ad landing pages with noindex meta tags
const EXCLUDE = ['/404.html', '/404/', '/lp/', '/sell-and-buy/', '/admin/'];

function parseCanonicalAndRobots(html) {
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  return {
    canonical: canonicalMatch ? canonicalMatch[1].trim() : null,
    robots: robotsMatch ? robotsMatch[1].trim().toLowerCase() : null,
  };
}

function normalizeRoute(path) {
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

/**
 * Map file path to canonical URL
 */
function filePathToCanonicalUrl(filePath) {
  const relativePath = filePath.replace(ROOT, '').replace(/\\/g, '/');

  if (relativePath === '/index.html') {
    return `${SITE_URL}/`;
  }

  if (relativePath.endsWith('/index.html')) {
    const dir = relativePath.replace('/index.html', '/');
    return `${SITE_URL}${dir}`;
  }

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
    'site-audit',
    'src',
    'templates',
    'data',
    'tools',
    'admin',
    'audit'
  ]);

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || skipDirs.has(entry.name)) {
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
async function getLastMod(filePath) {
  const relativePath = relative(ROOT, filePath).replace(/\\/g, '/');

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

  try {
    const fileStats = await stat(filePath);
    if (!Number.isNaN(fileStats.mtimeMs)) {
      return fileStats.mtime.toISOString().split('T')[0];
    }
  } catch {
    // Handled by explicit error below
  }

  throw new Error(`Unable to determine lastmod for ${relativePath}`);
}

function routeToSitemapKey(route) {
  if (route.startsWith('/areas/')) return 'areas';
  if (route.startsWith('/blog/')) return 'blog';
  return 'core';
}

function buildUrlEntry(route, canonicalUrl, lastmod) {
  const priority = PRIORITY_MAP[route] || (route.startsWith('/blog/') && route !== '/blog/' ? '0.6' : '0.5');
  const changefreq = route.startsWith('/blog/') ? 'monthly' :
                     route === '/' ? 'weekly' :
                     ['privacy', 'terms', 'fair-housing'].some(p => route.includes(p)) ? 'yearly' : 'monthly';

  return {
    loc: canonicalUrl,
    route,
    lastmod,
    changefreq,
    priority,
  };
}

function generateUrlSetXml(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
}

function generateSitemapIndexXml(childSitemaps) {
  const today = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${childSitemaps.map(name => `  <sitemap>\n    <loc>${SITE_URL}/${name}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`).join('\n')}\n</sitemapindex>\n`;
}

function validateLastModDistribution(urls) {
  if (urls.length < 5) return;

  const counts = new Map();
  for (const url of urls) {
    counts.set(url.lastmod, (counts.get(url.lastmod) || 0) + 1);
  }

  const uniqueCount = counts.size;
  const mostCommonCount = Math.max(...counts.values());
  const mostCommonRatio = mostCommonCount / urls.length;

  const today = new Date().toISOString().split('T')[0];

  if (uniqueCount === 1) {
    const onlyDate = urls[0].lastmod;
    const severity = onlyDate === today ? 'Error' : 'Warning';
    console.warn(
      `${severity}: suspicious sitemap lastmod pattern: all ${urls.length} URLs share ${onlyDate}. ` +
      'Verify dates are being sourced from each page file and not a global value.'
    );
  } else if (mostCommonRatio >= 0.9) {
    console.warn(
      `Warning: ${mostCommonCount}/${urls.length} URLs share the same lastmod date. ` +
      'Verify dates are being sourced from file-specific metadata.'
    );
  }
}

function validateSitemapCoverage(urlsByChild, expectedIndexableUrls) {
  const assignments = new Map();

  for (const [childName, urls] of urlsByChild.entries()) {
    for (const url of urls) {
      if (!assignments.has(url.loc)) {
        assignments.set(url.loc, []);
      }
      assignments.get(url.loc).push(childName);
    }
  }

  const errors = [];

  for (const canonicalUrl of expectedIndexableUrls) {
    const foundIn = assignments.get(canonicalUrl) || [];
    if (foundIn.length !== 1) {
      errors.push(`${canonicalUrl} appears in ${foundIn.length} child sitemaps (${foundIn.join(', ') || 'none'})`);
    }
  }

  for (const [canonicalUrl, foundIn] of assignments.entries()) {
    if (!expectedIndexableUrls.has(canonicalUrl)) {
      errors.push(`${canonicalUrl} appears in child sitemap(s) but is not an indexable canonical URL`);
    } else if (foundIn.length !== 1) {
      errors.push(`${canonicalUrl} appears ${foundIn.length} times across child sitemaps (${foundIn.join(', ')})`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Sitemap coverage validation failed:\n- ${errors.join('\n- ')}`);
  }
}

/**
 * Generate sitemap XML files
 */
async function generateSitemap() {
  console.log('Generating sitemap index and child files...');

  const htmlFiles = await findHtmlFiles(ROOT);
  const urlsByChild = new Map([
    ['core', []],
    ['areas', []],
    ['blog', []],
    ['compare', []],
  ]);
  const expectedIndexableUrls = new Set();

  for (const filePath of htmlFiles) {
    const canonicalUrlFromPath = filePathToCanonicalUrl(filePath);
    if (!canonicalUrlFromPath) continue;

    const html = await readFile(filePath, 'utf-8');
    const { canonical, robots } = parseCanonicalAndRobots(html);

    const route = normalizeRoute(canonicalUrlFromPath.replace(SITE_URL, ''));
    if (EXCLUDE.some(ex => route === ex || route.startsWith(ex.replace('.html', '')))) {
      continue;
    }

    const hasNoindex = Boolean(robots && robots.includes('noindex'));

    if (hasNoindex) {
      continue;
    }

    if (!canonical) {
      throw new Error(`Indexable page is missing canonical tag: ${relative(ROOT, filePath)}`);
    }

    if (!canonical.startsWith(`${SITE_URL}/`)) {
      throw new Error(`Indexable page has non-canonical host in canonical tag: ${relative(ROOT, filePath)} => ${canonical}`);
    }

    const canonicalUrl = canonical;
    expectedIndexableUrls.add(canonicalUrl);

    const lastmod = await getLastMod(filePath);
    const childKey = routeToSitemapKey(route);
    urlsByChild.get(childKey).push(buildUrlEntry(route, canonicalUrl, lastmod));
  }

  for (const urls of urlsByChild.values()) {
    urls.sort((a, b) => {
      const pDiff = parseFloat(b.priority) - parseFloat(a.priority);
      if (pDiff !== 0) return pDiff;
      return a.loc.localeCompare(b.loc);
    });
  }

  const allUrls = Array.from(urlsByChild.values()).flat();
  validateLastModDistribution(allUrls);
  validateSitemapCoverage(urlsByChild, expectedIndexableUrls);

  const writtenChildren = [];

  for (const [key, urls] of urlsByChild.entries()) {
    if (key === 'compare' && urls.length === 0) {
      continue;
    }

    const fileName = SITEMAP_FILES[key];
    const xml = generateUrlSetXml(urls);
    await writeFile(join(ROOT, fileName), xml);
    writtenChildren.push(fileName);
    console.log(`Generated ${fileName} with ${urls.length} URLs`);
  }

  const sitemapIndexXml = generateSitemapIndexXml(writtenChildren);
  await writeFile(join(ROOT, SITEMAP_FILES.index), sitemapIndexXml);
  console.log(`Generated ${SITEMAP_FILES.index} with ${writtenChildren.length} child sitemaps`);

  return {
    childSitemaps: writtenChildren,
    urlCount: allUrls.length,
  };
}

generateSitemap().catch((err) => {
  console.error(err);
  process.exit(1);
});
