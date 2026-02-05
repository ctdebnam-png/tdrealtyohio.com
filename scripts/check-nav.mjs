#!/usr/bin/env node
/**
 * Navigation Consistency Check for TD Realty Ohio
 * Validates that hamburger menu and footer navigation match src/config/nav.ts
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Expected nav structure matching assets/js/nav.js TD_NAV
const EXPECTED_NAV = {
  services: [
    { label: 'For Sellers', href: '/sellers/' },
    { label: 'For Buyers', href: '/buyers/' },
    { label: 'Pre-Listing Inspection', href: '/pre-listing-inspection/' },
    { label: 'Service Areas', href: '/areas/' },
    { label: 'Free Home Value', href: '/home-value/' },
    { label: 'Affordability Calculator', href: '/affordability/' },
    { label: 'Referral Credit', href: '/referrals/' },
    { label: 'Compare Options', href: '/compare/' },
  ],
  company: [
    { label: 'About', href: '/about/' },
    { label: 'Contact', href: '/contact/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Agent Opportunities', href: '/agents/' },
    { label: 'FAQ', href: '/faq/' },
  ],
};

const expectedServiceHrefs = new Set(EXPECTED_NAV.services.map(i => i.href));
const expectedCompanyHrefs = new Set(EXPECTED_NAV.company.map(i => i.href));

let errors = [];

/**
 * Extract hrefs from the hamburger menu (mobile nav)
 */
function extractHamburgerLinks(html) {
  // Find the nav element with id="main-nav"
  const navRegex = /<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/i;
  const match = html.match(navRegex);
  if (!match) return null;

  const navHtml = match[1];
  const hrefRegex = /<a[^>]*href="([^"]+)"[^>]*class="nav-link"[^>]*>/gi;
  const hrefs = [];
  let hrefMatch;
  while ((hrefMatch = hrefRegex.exec(navHtml)) !== null) {
    hrefs.push(hrefMatch[1]);
  }
  // Also check for class="nav-link" before href
  const hrefRegex2 = /<a[^>]*class="nav-link"[^>]*href="([^"]+)"[^>]*>/gi;
  while ((hrefMatch = hrefRegex2.exec(navHtml)) !== null) {
    if (!hrefs.includes(hrefMatch[1])) {
      hrefs.push(hrefMatch[1]);
    }
  }
  return hrefs;
}

/**
 * Extract hrefs from a footer section
 */
function extractFooterLinks(html, sectionTitle) {
  // Find the section by title
  const sectionRegex = new RegExp(
    `<h3[^>]*class="footer-title"[^>]*>${sectionTitle}</h3>\\s*<ul[^>]*class="footer-links"[^>]*>([\\s\\S]*?)</ul>`,
    'i'
  );
  const match = html.match(sectionRegex);
  if (!match) return null;

  const linksHtml = match[1];
  const hrefRegex = /<a[^>]*href="([^"]+)"[^>]*>/gi;
  const hrefs = [];
  let hrefMatch;
  while ((hrefMatch = hrefRegex.exec(linksHtml)) !== null) {
    hrefs.push(hrefMatch[1]);
  }
  return hrefs;
}

/**
 * Check navigation consistency in index.html
 */
async function checkNav() {
  console.log('Checking navigation consistency...\n');

  const indexPath = join(ROOT, 'index.html');
  const content = await readFile(indexPath, 'utf-8');

  // All expected hrefs combined
  const allExpectedHrefs = new Set([...expectedServiceHrefs, ...expectedCompanyHrefs]);

  // Extract hamburger menu links
  const hamburgerLinks = extractHamburgerLinks(content);
  if (!hamburgerLinks) {
    errors.push('Could not find hamburger menu (nav#main-nav) in index.html');
  } else {
    const hamburgerSet = new Set(hamburgerLinks);

    // Check hamburger has all expected links
    // /contact/ is rendered as a CTA button (not nav-link) so skip it here
    for (const href of allExpectedHrefs) {
      if (href === '/contact/') continue;
      if (!hamburgerSet.has(href)) {
        errors.push(`Hamburger menu missing: ${href}`);
      }
    }

    // Check for unexpected links in hamburger (except /contact/ CTA)
    for (const href of hamburgerLinks) {
      if (!allExpectedHrefs.has(href) && href !== '/contact/') {
        errors.push(`Hamburger menu has unexpected link: ${href}`);
      }
    }

    console.log(`  Hamburger menu: ${hamburgerLinks.length} links found`);
  }

  // Extract footer Services links
  const footerServices = extractFooterLinks(content, 'Services');
  if (!footerServices) {
    errors.push('Could not find footer Services section in index.html');
  } else {
    const footerServicesSet = new Set(footerServices);

    // Check for missing links
    for (const href of expectedServiceHrefs) {
      if (!footerServicesSet.has(href)) {
        errors.push(`Footer Services missing: ${href}`);
      }
    }

    // Check for extra links
    for (const href of footerServices) {
      if (!expectedServiceHrefs.has(href)) {
        errors.push(`Footer Services has unexpected link: ${href}`);
      }
    }

    console.log(`  Footer Services: ${footerServices.length} links found`);
  }

  // Extract footer Company links
  const footerCompany = extractFooterLinks(content, 'Company');
  if (!footerCompany) {
    errors.push('Could not find footer Company section in index.html');
  } else {
    const footerCompanySet = new Set(footerCompany);

    // Check for missing links
    for (const href of expectedCompanyHrefs) {
      if (!footerCompanySet.has(href)) {
        errors.push(`Footer Company missing: ${href}`);
      }
    }

    // Check for extra links (including testimonials which should be removed)
    for (const href of footerCompany) {
      if (!expectedCompanyHrefs.has(href)) {
        errors.push(`Footer Company has unexpected link: ${href}`);
      }
    }

    console.log(`  Footer Company: ${footerCompany.length} links found`);
  }

  // Check that testimonials is not present anywhere in nav
  if (content.includes('href="/testimonials/"')) {
    errors.push('Testimonials link found in index.html (should be removed)');
  }
}

/**
 * Main validation function
 */
async function validate() {
  console.log('\n=== TD Realty Ohio Navigation Check ===\n');

  await checkNav();

  console.log('\n=== Results ===\n');

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
    console.log(`\nFailed with ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log('All navigation checks passed!\n');
}

validate().catch(err => {
  console.error('Navigation check failed:', err);
  process.exit(1);
});
