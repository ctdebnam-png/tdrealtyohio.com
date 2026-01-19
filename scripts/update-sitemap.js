#!/usr/bin/env node

/**
 * Update Sitemap Script
 * Generates/updates sitemap.xml with current dates and proper priorities
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SITE_URL = 'https://tdrealtyohio.com';

// Page configuration with priorities and change frequencies
const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/sellers.html', priority: '0.9', changefreq: 'weekly' },
  { path: '/buyers.html', priority: '0.9', changefreq: 'weekly' },
  { path: '/pre-listing-inspection.html', priority: '0.8', changefreq: 'monthly' },
  { path: '/areas/', priority: '0.8', changefreq: 'monthly' },
  { path: '/about.html', priority: '0.7', changefreq: 'monthly' },
  { path: '/contact.html', priority: '0.8', changefreq: 'monthly' },
  { path: '/privacy.html', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms.html', priority: '0.3', changefreq: 'yearly' },
  { path: '/fair-housing.html', priority: '0.4', changefreq: 'yearly' },
];

function getLastModified(filepath) {
  const fullPath = path.join(ROOT_DIR, filepath === '/' ? 'index.html' : filepath.replace(/\/$/, '/index.html'));

  try {
    const stats = fs.statSync(fullPath);
    return stats.mtime.toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
`;

  for (const page of PAGES) {
    const lastmod = getLastModified(page.path);

    xml += `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  xml += `</urlset>
`;

  return xml;
}

console.log('Generating sitemap.xml...');

const sitemap = generateSitemap();
const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');

fs.writeFileSync(sitemapPath, sitemap);

console.log(`Sitemap updated with ${PAGES.length} URLs`);
console.log(`Saved to: sitemap.xml`);

// Also update robots.txt to reference sitemap
const robotsPath = path.join(ROOT_DIR, 'robots.txt');
let robotsContent = '';

if (fs.existsSync(robotsPath)) {
  robotsContent = fs.readFileSync(robotsPath, 'utf-8');
}

if (!robotsContent.includes('Sitemap:')) {
  robotsContent += `\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(robotsPath, robotsContent);
  console.log('Added sitemap reference to robots.txt');
}
