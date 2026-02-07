#!/usr/bin/env node
/**
 * CI check: nav/footer/sitemap-page consistency
 *
 * Fails if:
 *  1. Any header or footer renders duplicate hrefs in the same menu
 *  2. /terms/ footer contains "Testimonials"
 *  3. /sitemap-page/ contains labels not present in the canonical nav registry
 *  4. Footer Company section is missing canonical links
 *  5. /terms/ contains "REALTOR Code of Ethics"
 *  6. /areas/ or /areas/{city}/ has market metrics without "Updated:" adjacent
 *  7. Blog post post-meta does not match "TD Realty Ohio | Month Year"
 */

import { createRequire } from 'module';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const require = createRequire(import.meta.url);
const { NAV_REGISTRY } = require('../src/config/nav.js');

// Derive canonical nav from the single source of truth
const CANONICAL_NAV = {
  services: NAV_REGISTRY.groups.services.items.map(i => ({ href: i.href, label: i.label })),
  company: NAV_REGISTRY.groups.company.items.map(i => ({ href: i.href, label: i.label })),
};

// Allowed labels on the sitemap page that are NOT in the nav registry
// (commission landers, compare sub-pages, legal, areas, blog articles)
const SITEMAP_ALLOWED_EXTRA_LABELS = new Set([
  'Home', 'All Areas', 'All Articles',
  '1% Commission Listing', 'Sell Only (2%)',
  'Compare Options', '1% vs 3% Commission', 'Discount Broker vs Full Service', 'Flat Fee MLS vs Full Service',
  'Privacy Policy', 'Terms of Service', 'Fair Housing Statement',
  'Home Value Estimate',
]);

// Banned labels that must NOT appear on /sitemap-page/
const BANNED_SITEMAP_LABELS = [
  'Testimonials',
  'Referral Program',  // must use "Referral Credit"
];

let errors = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  errors++;
}

function extractHrefs(html, sectionRegex) {
  const section = html.match(sectionRegex);
  if (!section) return [];
  const linkRe = /href="([^"]+)"/g;
  const hrefs = [];
  let m;
  while ((m = linkRe.exec(section[0])) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

function extractLinkLabels(html) {
  const re = /<a\s[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const links = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    links.push({ href: m[1], label: m[2].trim() });
  }
  return links;
}

// Check 1: Duplicate hrefs in header nav or footer menus
async function checkDuplicateHrefs() {
  const files = await glob('**/*.html', {
    cwd: ROOT,
    ignore: ['node_modules/**', 'lp/**'],
  });

  for (const file of files) {
    const html = await readFile(join(ROOT, file), 'utf-8');

    // Check header nav for duplicate hrefs
    const navMatch = html.match(/<nav[^>]*class="nav"[^>]*>([\s\S]*?)<\/nav>/i);
    if (navMatch) {
      const navHrefs = extractHrefs(navMatch[0], /[\s\S]*/);
      const seen = new Set();
      for (const href of navHrefs) {
        if (seen.has(href)) {
          fail(`${file}: duplicate href "${href}" in header nav`);
        }
        seen.add(href);
      }
    }

    // Check footer Services for duplicate hrefs
    const footerServicesMatch = html.match(/class="footer-title">Services<\/h3>\s*<ul class="footer-links">([\s\S]*?)<\/ul>/i);
    if (footerServicesMatch) {
      const hrefs = extractHrefs(footerServicesMatch[0], /[\s\S]*/);
      const seen = new Set();
      for (const href of hrefs) {
        if (seen.has(href)) {
          fail(`${file}: duplicate href "${href}" in footer Services`);
        }
        seen.add(href);
      }
    }

    // Check footer Company for duplicate hrefs
    const footerCompanyMatch = html.match(/class="footer-title">Company<\/h3>\s*<ul class="footer-links">([\s\S]*?)<\/ul>/i);
    if (footerCompanyMatch) {
      const hrefs = extractHrefs(footerCompanyMatch[0], /[\s\S]*/);
      const seen = new Set();
      for (const href of hrefs) {
        if (seen.has(href)) {
          fail(`${file}: duplicate href "${href}" in footer Company`);
        }
        seen.add(href);
      }
    }
  }
}

// Check 2: /terms/ footer must not contain "Testimonials"
async function checkTermsFooter() {
  const html = await readFile(join(ROOT, 'terms/index.html'), 'utf-8');
  if (/testimonials/i.test(html.slice(html.indexOf('<footer')))) {
    fail('/terms/index.html footer contains "Testimonials"');
  }
}

// Check 3: /sitemap-page/ must not contain banned labels or unknown labels
async function checkSitemapPage() {
  const html = await readFile(join(ROOT, 'sitemap-page/index.html'), 'utf-8');
  const mainContent = html.slice(
    html.indexOf('<main'),
    html.indexOf('</main>')
  );

  // Build set of all canonical labels
  const canonicalLabels = new Set();
  for (const group of Object.values(CANONICAL_NAV)) {
    for (const item of group) {
      canonicalLabels.add(item.label);
    }
  }
  for (const label of SITEMAP_ALLOWED_EXTRA_LABELS) {
    canonicalLabels.add(label);
  }

  // Check for banned labels
  for (const banned of BANNED_SITEMAP_LABELS) {
    if (mainContent.includes(banned)) {
      fail(`/sitemap-page/ contains banned label "${banned}"`);
    }
  }

  // Extract all link labels from the sitemap page main content
  const links = extractLinkLabels(mainContent);
  for (const { href, label } of links) {
    // Skip area pages and blog articles — they use city names and article titles
    if (href.startsWith('/areas/') && href !== '/areas/') continue;
    if (href.startsWith('/blog/') && href !== '/blog/') continue;

    if (!canonicalLabels.has(label)) {
      fail(`/sitemap-page/ contains label "${label}" (href="${href}") not in canonical nav registry`);
    }
  }
}

// Check 4: Footer Company section must have all canonical company links
async function checkFooterCompanyCompleteness() {
  const files = await glob('**/*.html', {
    cwd: ROOT,
    ignore: ['node_modules/**', 'lp/**'],
  });

  const requiredHrefs = CANONICAL_NAV.company.map(c => c.href);

  for (const file of files) {
    const html = await readFile(join(ROOT, file), 'utf-8');
    const footerCompanyMatch = html.match(/class="footer-title">Company<\/h3>\s*<ul class="footer-links">([\s\S]*?)<\/ul>/i);
    if (!footerCompanyMatch) continue;

    const hrefs = extractHrefs(footerCompanyMatch[0], /[\s\S]*/);
    for (const required of requiredHrefs) {
      if (!hrefs.includes(required)) {
        fail(`${file}: footer Company missing "${required}"`);
      }
    }
  }
}

// Check 5: /terms/ must not contain "REALTOR Code of Ethics"
async function checkTermsRealtorCode() {
  const html = await readFile(join(ROOT, 'terms/index.html'), 'utf-8');
  if (html.includes('REALTOR Code of Ethics')) {
    fail('/terms/index.html contains "REALTOR Code of Ethics" — remove unless intentional');
  }
}

// Check 6: Area pages with market metrics must have "Updated:" adjacent
async function checkAreasFreshness() {
  // Check the hub page /areas/
  const hubHtml = await readFile(join(ROOT, 'areas/index.html'), 'utf-8');
  if (/Median.*days on market/i.test(hubHtml) && !/[Uu]pdated:/.test(hubHtml)) {
    fail('areas/index.html has market metrics but no "Updated:" line');
  }

  // Check each city detail page
  const cityFiles = await glob('areas/*/index.html', {
    cwd: ROOT,
    ignore: ['node_modules/**'],
  });

  for (const file of cityFiles) {
    const html = await readFile(join(ROOT, file), 'utf-8');
    // City pages have .city-stats with Median Home Price, Days on Market, etc.
    if (/city-stat|Median Home Price|Days on Market/i.test(html) && !/[Uu]pdated:/.test(html)) {
      fail(`${file}: has market metrics but no "Updated:" line`);
    }
  }
}

// Check 7: Blog post meta format must be "TD Realty Ohio | Month Year"
async function checkBlogPostMeta() {
  const blogFiles = await glob('blog/*/index.html', {
    cwd: ROOT,
    ignore: ['node_modules/**'],
  });

  const validPattern = /^TD Realty Ohio \| (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;

  for (const file of blogFiles) {
    const html = await readFile(join(ROOT, file), 'utf-8');
    const metaMatch = html.match(/<p class="post-meta">([^<]+)<\/p>/);
    if (metaMatch) {
      const metaText = metaMatch[1].trim();
      if (!validPattern.test(metaText)) {
        fail(`${file}: post-meta "${metaText}" does not match "TD Realty Ohio | Month Year"`);
      }
    }
  }
}

async function main() {
  console.log('check-nav-footer-sitemap: running...');
  await checkDuplicateHrefs();
  await checkTermsFooter();
  await checkSitemapPage();
  await checkFooterCompanyCompleteness();
  await checkTermsRealtorCode();
  await checkAreasFreshness();
  await checkBlogPostMeta();

  if (errors > 0) {
    console.error(`\ncheck-nav-footer-sitemap: ${errors} error(s) found`);
    process.exit(1);
  }
  console.log('check-nav-footer-sitemap: all checks passed \u2713');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
