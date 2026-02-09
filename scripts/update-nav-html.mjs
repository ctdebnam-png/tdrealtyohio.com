#!/usr/bin/env node
/**
 * Batch-update all HTML files with the new nav structure.
 * Run with: node scripts/update-nav-html.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const htmlFiles = globSync('**/*.html', {
  cwd: '/home/user/tdrealtyohio.com',
  absolute: true,
  ignore: ['**/node_modules/**']
});

// --- Old nav pattern (the static nav block used in all pages) ---
const oldNavPattern = /<nav class="nav" id="main-nav" aria-label="Main navigation">\s*<div class="nav-section-header">Services<\/div>\s*<a href="\/sellers\/" class="nav-link">For Sellers<\/a>\s*<a href="\/buyers\/" class="nav-link">For Buyers<\/a>\s*<a href="\/pre-listing-inspection\/" class="nav-link">Pre-Listing Inspection<\/a>\s*<a href="\/areas\/" class="nav-link">Service Areas<\/a>\s*<a href="\/home-value\/" class="nav-link">Free Home Value<\/a>\s*<a href="\/affordability\/" class="nav-link">Affordability Calculator<\/a>\s*<a href="\/referrals\/" class="nav-link">Referral Credit<\/a>\s*<a href="\/compare\/" class="nav-link">Compare Options<\/a>\s*<div class="nav-section-header">Company<\/div>\s*<a href="\/about\/" class="nav-link">About<\/a>\s*(?:<a href="\/contact\/" class="nav-link">Contact<\/a>\s*)?<a href="\/blog\/" class="nav-link">Blog<\/a>\s*<a href="\/agents\/" class="nav-link">Agent Opportunities<\/a>\s*<a href="\/faq\/" class="nav-link">FAQ<\/a>\s*<a href="\/contact\/" class="btn btn-primary nav-cta">Contact<\/a>\s*<\/nav>/;

const newNav = `<nav class="nav" id="main-nav" aria-label="Main navigation">
        <a href="/sellers/" class="nav-link">For Sellers</a>
        <a href="/buyers/" class="nav-link">For Buyers</a>
        <a href="/areas/" class="nav-link">Service Areas</a>
        <a href="/about/" class="nav-link">About</a>
        <div class="nav-more">
          <button class="nav-more-toggle" aria-expanded="false">More <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></button>
          <div class="nav-more-dropdown">
            <div class="nav-section-header">Services</div>
            <a href="/pre-listing-inspection/" class="nav-link">Pre-Listing Inspection</a>
            <a href="/home-value/" class="nav-link">Free Home Value</a>
            <a href="/affordability/" class="nav-link">Affordability Calculator</a>
            <a href="/referrals/" class="nav-link">Referral Credit</a>
            <a href="/compare/" class="nav-link">Compare Options</a>
            <div class="nav-section-header">Company</div>
            <a href="/contact/" class="nav-link">Contact</a>
            <a href="/blog/" class="nav-link">Blog</a>
            <a href="/agents/" class="nav-link">Agent Opportunities</a>
            <a href="/faq/" class="nav-link">FAQ</a>
          </div>
        </div>
        <a href="/contact/" class="btn btn-primary nav-cta">Contact</a>
      </nav>`;

// --- Add mobile phone button before hamburger button ---
const oldHamburger = /<button class="mobile-menu-btn" id="mobile-menu-btn"/;
const newHamburgerPrefix = `<a href="tel:6143928858" class="mobile-phone-btn" aria-label="Call (614) 392-8858">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </a>
      <button class="mobile-menu-btn" id="mobile-menu-btn"`;

// --- Footer "Contact" link parity: ensure Contact appears in Company section ---
const oldFooterCompany = /<ul class="footer-links" data-footer-nav="company">\s*<li><a href="\/about\/">About<\/a><\/li>\s*<li><a href="\/contact\/">Contact<\/a><\/li>\s*<li><a href="\/blog\/">Blog<\/a><\/li>\s*<li><a href="\/agents\/">Agent Opportunities<\/a><\/li>\s*<li><a href="\/faq\/">FAQ<\/a><\/li>\s*<\/ul>/;

// Footer company without Contact (some pages may not have it)
const oldFooterCompanyNoContact = /<ul class="footer-links" data-footer-nav="company">\s*<li><a href="\/about\/">About<\/a><\/li>\s*<li><a href="\/blog\/">Blog<\/a><\/li>\s*<li><a href="\/agents\/">Agent Opportunities<\/a><\/li>\s*<li><a href="\/faq\/">FAQ<\/a><\/li>\s*<\/ul>/;

const newFooterCompany = `<ul class="footer-links" data-footer-nav="company">
            <li><a href="/about/">About</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/agents/">Agent Opportunities</a></li>
            <li><a href="/faq/">FAQ</a></li>
          </ul>`;

let navUpdated = 0;
let phoneAdded = 0;
let footerUpdated = 0;
let errors = [];

for (const file of htmlFiles) {
  try {
    let content = readFileSync(file, 'utf8');
    let changed = false;

    // 1. Update nav
    if (oldNavPattern.test(content)) {
      content = content.replace(oldNavPattern, newNav);
      navUpdated++;
      changed = true;
    }

    // 2. Add mobile phone button (if not already present)
    if (!content.includes('mobile-phone-btn') && oldHamburger.test(content)) {
      content = content.replace(oldHamburger, newHamburgerPrefix);
      phoneAdded++;
      changed = true;
    }

    // 3. Ensure footer Company section has Contact link
    if (oldFooterCompanyNoContact.test(content) && !oldFooterCompany.test(content)) {
      content = content.replace(oldFooterCompanyNoContact, newFooterCompany);
      footerUpdated++;
      changed = true;
    }

    if (changed) {
      writeFileSync(file, content, 'utf8');
    }
  } catch (e) {
    errors.push(`${file}: ${e.message}`);
  }
}

console.log(`Nav updated: ${navUpdated} files`);
console.log(`Phone button added: ${phoneAdded} files`);
console.log(`Footer updated: ${footerUpdated} files`);
if (errors.length) {
  console.log(`Errors: ${errors.length}`);
  errors.forEach(e => console.log(`  ${e}`));
}
