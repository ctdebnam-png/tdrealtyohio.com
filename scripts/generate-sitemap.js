#!/usr/bin/env node
/**
 * Generate sitemap.xml from the filesystem.
 *
 * Scans all index.html files and produces a sitemap with:
 * - Correct lastmod from file mtime or article:modified_time meta
 * - Priority based on page type
 * - Excludes noindex pages
 *
 * Usage:
 *   node scripts/generate-sitemap.js           # writes sitemap.xml
 *   node scripts/generate-sitemap.js --dry-run # prints without writing
 */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://tdrealtyohio.com';
const SITE_ROOT = path.join(__dirname, '..');

// Priority by page type
const PRIORITY = {
  homepage: 1.0,
  core: 0.8,
  area: 0.7,
  blog: 0.6,
  compare: 0.7,
  hub: 0.5,
  landing: 0.4,
  legal: 0.2,
};

// Change frequency by type
const CHANGEFREQ = {
  homepage: 'weekly',
  core: 'monthly',
  area: 'monthly',
  blog: 'monthly',
  compare: 'monthly',
  hub: 'weekly',
  landing: 'monthly',
  legal: 'yearly',
};

// Pages to exclude (noindex or duplicates)
const EXCLUDE_PATTERNS = [
  /^\/lp\//,      // landing pages (typically noindex for paid campaigns)
];

function categorize(urlPath) {
  if (urlPath === '/') return 'homepage';
  if (urlPath.startsWith('/areas/') && urlPath !== '/areas/') return 'area';
  if (urlPath === '/areas/') return 'hub';
  if (urlPath.startsWith('/blog/') && urlPath !== '/blog/') return 'blog';
  if (urlPath === '/blog/') return 'hub';
  if (urlPath.startsWith('/compare/') && urlPath !== '/compare/') return 'compare';
  if (urlPath === '/compare/') return 'hub';
  if (['/privacy/', '/terms/', '/fair-housing/'].includes(urlPath)) return 'legal';
  if (urlPath === '/sitemap-page/') return 'hub';
  return 'core';
}

function getLastmod(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Try to extract article:modified_time
  const metaMatch = html.match(
    /<meta\s+property=["']article:modified_time["']\s+content=["']([^"']+)["']/i
  );
  if (metaMatch) {
    return metaMatch[1].split('T')[0]; // Just the date part
  }

  // Fall back to file mtime
  const stats = fs.statSync(htmlPath);
  return stats.mtime.toISOString().split('T')[0];
}

function hasNoindex(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  return /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

function discoverPages() {
  const pages = [];

  // Homepage
  const indexPath = path.join(SITE_ROOT, 'index.html');
  if (fs.existsSync(indexPath)) {
    pages.push({ path: '/', file: indexPath });
  }

  // Scan directories
  const dirs = fs.readdirSync(SITE_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .filter(d => !d.name.startsWith('.') && !['node_modules', 'output', 'scripts', 'assets', 'media'].includes(d.name))
    .map(d => d.name);

  for (const dir of dirs) {
    const dirPath = path.join(SITE_ROOT, dir);

    // Check for index.html directly in this dir
    const dirIndex = path.join(dirPath, 'index.html');
    if (fs.existsSync(dirIndex)) {
      pages.push({ path: `/${dir}/`, file: dirIndex });
    }

    // Check subdirectories (areas/columbus, blog/post-slug, etc.)
    const subdirs = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const subdir of subdirs) {
      const subIndex = path.join(dirPath, subdir, 'index.html');
      if (fs.existsSync(subIndex)) {
        pages.push({ path: `/${dir}/${subdir}/`, file: subIndex });
      }
    }
  }

  return pages;
}

function generateSitemap(dryRun = false) {
  const pages = discoverPages();
  console.log(`Discovered ${pages.length} pages.`);

  const entries = [];
  let excluded = 0;

  for (const page of pages) {
    // Check exclusion patterns
    if (EXCLUDE_PATTERNS.some(p => p.test(page.path))) {
      console.log(`  Excluding (pattern): ${page.path}`);
      excluded++;
      continue;
    }

    // Check noindex
    if (hasNoindex(page.file)) {
      console.log(`  Excluding (noindex): ${page.path}`);
      excluded++;
      continue;
    }

    const category = categorize(page.path);
    const lastmod = getLastmod(page.file);
    const priority = PRIORITY[category] || 0.5;
    const changefreq = CHANGEFREQ[category] || 'monthly';

    entries.push({
      loc: `${SITE_URL}${page.path}`,
      lastmod,
      changefreq,
      priority,
      category,
    });
  }

  // Sort by priority (descending) then path
  entries.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.loc.localeCompare(b.loc);
  });

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`).join('\n')}
</urlset>
`;

  if (dryRun) {
    console.log('\n--- Generated sitemap.xml ---');
    console.log(xml);
  } else {
    const sitemapPath = path.join(SITE_ROOT, 'sitemap.xml');
    fs.writeFileSync(sitemapPath, xml);
    console.log(`\nWritten: ${sitemapPath}`);
  }

  console.log(`\nSummary:`);
  console.log(`  Included: ${entries.length}`);
  console.log(`  Excluded: ${excluded}`);

  // Category breakdown
  const byCat = {};
  entries.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + 1; });
  console.log(`  By category:`);
  for (const [cat, count] of Object.entries(byCat).sort((a,b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }
}

// CLI
const dryRun = process.argv.includes('--dry-run');
generateSitemap(dryRun);
