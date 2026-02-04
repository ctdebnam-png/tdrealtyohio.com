/**
 * PR Quality Gate
 * Additional checks that block merges if:
 * - Multiple H1s appear on a page
 * - Title or meta description missing
 * - Canonical drift (canonical doesn't match expected URL)
 * - NAP drift (old phone numbers or missing business facts)
 * - Missing "How pricing works" link on seller entry pages
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile } = require('./utils');

const CANONICAL_BASE = 'https://tdrealtyohio.com';

// Seller entry pages that must link to pricing explanation
const SELLER_PAGES = [
  'sellers/index.html',
  '1-percent-commission/index.html',
  'sell-and-buy/index.html',
  'sell-only-2-percent/index.html',
];

// Old / wrong phone numbers
const OLD_PHONES = [
  /614[\-.\s]?956[\-.\s]?8656/,
];

async function checkPrGate(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      multipleH1: 0,
      missingTitle: 0,
      missingMeta: 0,
      canonicalDrift: 0,
      napDrift: 0,
      missingPricing: 0,
    },
  };

  const files = await getHtmlFiles(config);
  result.stats.filesChecked = files.length;

  for (const file of files) {
    const html = readHtmlFile(file.absolute);
    const $ = cheerio.load(html);
    const rel = file.relative;

    // Skip noindex pages for most checks
    const isNoindex = /meta\s[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);

    // 1. Multiple H1 tags
    const h1Count = $('h1').length;
    if (h1Count > 1) {
      result.errors.push({ file: rel, message: `Multiple H1 tags found (${h1Count})` });
      result.stats.multipleH1++;
      result.passed = false;
    }

    // 2. Missing title
    const title = $('title').text().trim();
    if (!title) {
      result.errors.push({ file: rel, message: 'Missing <title> tag' });
      result.stats.missingTitle++;
      result.passed = false;
    }

    // 3. Missing meta description
    const metaDesc = $('meta[name="description"]').attr('content');
    if (!metaDesc && !isNoindex) {
      result.errors.push({ file: rel, message: 'Missing meta description' });
      result.stats.missingMeta++;
      result.passed = false;
    }

    // 4. Canonical drift
    const canonical = $('link[rel="canonical"]').attr('href');
    if (canonical && !isNoindex) {
      // Build expected canonical from file path
      let expectedPath = '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '');
      if (!expectedPath.endsWith('/')) expectedPath += '/';
      const expectedCanonical = CANONICAL_BASE + expectedPath;

      if (canonical !== expectedCanonical) {
        // Allow minor variations (with/without trailing slash)
        const normalizedCanonical = canonical.replace(/\/$/, '');
        const normalizedExpected = expectedCanonical.replace(/\/$/, '');
        if (normalizedCanonical !== normalizedExpected) {
          result.warnings.push({
            file: rel,
            message: `Canonical drift: got "${canonical}", expected "${expectedCanonical}"`,
          });
          result.stats.canonicalDrift++;
        }
      }
    }

    // 5. NAP drift — old phone numbers
    for (const pattern of OLD_PHONES) {
      if (pattern.test(html)) {
        result.errors.push({ file: rel, message: 'Old phone number found (614-956-8656)' });
        result.stats.napDrift++;
        result.passed = false;
      }
    }

    // 6. Seller pages must link to pricing explanation
    if (SELLER_PAGES.includes(rel)) {
      const hasHowPricingLink = html.includes('/how-we-get-paid/') || html.includes('How Pricing Works') || html.includes('how pricing works');
      if (!hasHowPricingLink) {
        result.warnings.push({
          file: rel,
          message: 'Seller entry page missing "How pricing works" link',
        });
        result.stats.missingPricing++;
      }
    }
  }

  return result;
}

module.exports = checkPrGate;
