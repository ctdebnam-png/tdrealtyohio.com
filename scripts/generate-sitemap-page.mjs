#!/usr/bin/env node
/**
 * HTML Sitemap Page Generator for TD Realty Ohio
 * Auto-generates sitemap-page/index.html from filesystem
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set([
  '.git', '.github', 'node_modules', 'scripts', 'tools', 'assets', 'media',
  'output', 'reports', 'audit-output', 'audit-artifacts', 'lp', 'sitemap-page',
]);

// Categories for grouping pages
const SECTIONS = {
  'Main Pages': [
    { path: '/', label: 'Home' },
    { path: '/about/', label: 'About' },
    { path: '/contact/', label: 'Contact' },
    { path: '/faq/', label: 'FAQ' },
  ],
  'Services': [
    { path: '/sellers/', label: 'For Sellers' },
    { path: '/1-percent-commission/', label: '1% Commission Listing' },
    { path: '/sell-and-buy/', label: 'Sell & Buy Together (1%)' },
    { path: '/sell-only-2-percent/', label: 'Sell Only (2%)' },
    { path: '/buyers/', label: 'For Buyers' },
    { path: '/sellers/', label: 'Seller Preparation' },
    { path: '/agents/', label: 'Agent Opportunities' },
    { path: '/referrals/', label: 'Referral Program' },
  ],
  'Tools': [
    { path: '/home-value/', label: 'Home Value Estimate' },
    { path: '/affordability/', label: 'Affordability Calculator' },
  ],
  'Compare': [
    { path: '/compare/', label: 'Compare Options' },
    { path: '/compare/1-percent-vs-3-percent/', label: '1% vs 3% Commission' },
    { path: '/compare/discount-broker-vs-full-service/', label: 'Discount Broker vs Full Service' },
    { path: '/compare/flat-fee-mls-vs-full-service/', label: 'Flat Fee MLS vs Full Service' },
  ],
  'Legal': [
    { path: '/privacy/', label: 'Privacy Policy' },
    { path: '/terms/', label: 'Terms of Service' },
    { path: '/fair-housing/', label: 'Fair Housing Statement' },
  ],
};

/**
 * Get title from HTML file
 */
async function getTitle(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const match = content.match(/<title>([^|<]+)/i);
    return match ? match[1].trim() : null;
  } catch { return null; }
}

/**
 * Find all area pages
 */
async function getAreaPages() {
  const areasDir = join(ROOT, 'areas');
  const entries = await readdir(areasDir, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'index.html') {
      const indexPath = join(areasDir, entry.name, 'index.html');
      const title = await getTitle(indexPath);
      if (title) {
        pages.push({
          path: `/areas/${entry.name}/`,
          label: title.replace(/, OH Homes.*/, '').replace(/ \|.*/, ''),
        });
      }
    }
  }
  return pages.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Find all blog posts
 */
async function getBlogPages() {
  const blogDir = join(ROOT, 'blog');
  const entries = await readdir(blogDir, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const indexPath = join(blogDir, entry.name, 'index.html');
      const title = await getTitle(indexPath);
      if (title) {
        pages.push({
          path: `/blog/${entry.name}/`,
          label: title,
        });
      }
    }
  }
  return pages.sort((a, b) => a.label.localeCompare(b.label));
}

function renderSection(name, items) {
  return `          <div class="sitemap-section">
            <h3>${name}</h3>
            <ul class="sitemap-list">
${items.map(i => `              <li><a href="${i.path}">${i.label}</a></li>`).join('\n')}
            </ul>
          </div>`;
}

async function generate() {
  console.log('Generating HTML sitemap page...');

  const areaPages = await getAreaPages();
  const blogPages = await getBlogPages();

  const existingPage = await readFile(join(ROOT, 'sitemap-page', 'index.html'), 'utf-8');

  // Extract header (everything up to and including <section class="section">)
  const headerMatch = existingPage.match(/([\s\S]*?<section class="section">\s*<div class="container">)/);
  // Extract footer (everything from </section>\s*</main> onwards)
  const footerMatch = existingPage.match(/([\s\S]*?)(<\/div>\s*<\/section>\s*<\/main>[\s\S]*)/);

  if (!headerMatch || !footerMatch) {
    console.error('Could not parse sitemap-page template');
    process.exit(1);
  }

  const header = headerMatch[1];
  const footer = footerMatch[2];

  // Build sections
  const sections = [];
  for (const [name, items] of Object.entries(SECTIONS)) {
    sections.push(renderSection(name, items));
  }
  sections.push(renderSection('Areas Served', [
    { path: '/areas/', label: 'All Areas' },
    ...areaPages,
  ]));
  sections.push(renderSection('Blog', [
    { path: '/blog/', label: 'All Articles' },
    ...blogPages,
  ]));

  const html = `${header}
        <div class="sitemap-grid">
${sections.join('\n\n')}
        </div>
${footer}`;

  await writeFile(join(ROOT, 'sitemap-page', 'index.html'), html);
  console.log(`Generated sitemap-page with ${Object.keys(SECTIONS).length + 2} sections, ${areaPages.length} area pages, ${blogPages.length} blog posts`);
}

generate().catch(console.error);
