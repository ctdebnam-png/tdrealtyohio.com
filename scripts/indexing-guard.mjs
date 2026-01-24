#!/usr/bin/env node
/**
 * Indexing Guard for TD Realty Ohio
 * Validates SEO/indexing requirements after build
 */

import { readdir, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE_URL = 'https://tdrealtyohio.com';
const OLD_PHONE = '614-956-8656';
const OLD_PHONE_VARIANTS = ['614-956-8656', '614.956.8656', '(614) 956-8656', '6149568656'];

let errors = [];
let warnings = [];

/**
 * Check if a file exists
 */
async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively find all files with given extensions
 */
async function findFiles(dir, extensions, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name.startsWith('audit-')) {
        continue;
      }
      await findFiles(fullPath, extensions, files);
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check robots.txt exists
 */
async function checkRobotsTxt() {
  console.log('Checking robots.txt...');
  const robotsPath = join(ROOT, 'robots.txt');

  if (!await fileExists(robotsPath)) {
    errors.push('robots.txt is missing from deploy root');
    return;
  }

  const content = await readFile(robotsPath, 'utf-8');

  if (!content.includes('Sitemap:')) {
    errors.push('robots.txt does not contain Sitemap directive');
  }

  if (!content.includes(SITE_URL)) {
    warnings.push('robots.txt Sitemap URL should use https://tdrealtyohio.com');
  }

  console.log('  robots.txt: OK');
}

/**
 * Check sitemap.xml exists and is valid
 */
async function checkSitemapXml() {
  console.log('Checking sitemap.xml...');
  const sitemapPath = join(ROOT, 'sitemap.xml');

  if (!await fileExists(sitemapPath)) {
    errors.push('sitemap.xml is missing from deploy root');
    return;
  }

  const content = await readFile(sitemapPath, 'utf-8');

  // Check for .html URLs (should use clean URLs)
  const htmlUrls = content.match(/<loc>[^<]*\.html<\/loc>/g);
  if (htmlUrls && htmlUrls.length > 0) {
    errors.push(`sitemap.xml contains ${htmlUrls.length} .html URLs (should use clean canonical URLs)`);
  }

  // Check all URLs start with correct base
  const locMatches = content.matchAll(/<loc>([^<]+)<\/loc>/g);
  for (const match of locMatches) {
    const url = match[1];
    if (!url.startsWith(SITE_URL)) {
      errors.push(`sitemap.xml contains URL not starting with ${SITE_URL}: ${url}`);
    }
  }

  console.log('  sitemap.xml: OK');
}

/**
 * Check all HTML files have valid canonical tags
 */
async function checkCanonicals() {
  console.log('Checking canonical tags...');
  const htmlFiles = await findFiles(ROOT, ['.html']);

  for (const filePath of htmlFiles) {
    const relativePath = filePath.replace(ROOT, '');

    // Skip 404 page
    if (relativePath.includes('404')) continue;

    const content = await readFile(filePath, 'utf-8');

    // Check for canonical link
    const canonicalMatch = content.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);

    if (!canonicalMatch) {
      errors.push(`Missing canonical tag: ${relativePath}`);
      continue;
    }

    const canonical = canonicalMatch[1];

    // Check canonical is absolute
    if (!canonical.startsWith('http')) {
      errors.push(`Canonical not absolute in ${relativePath}: ${canonical}`);
    }

    // Check canonical starts with correct domain
    if (!canonical.startsWith(SITE_URL)) {
      errors.push(`Canonical uses wrong domain in ${relativePath}: ${canonical}`);
    }

    // Check canonical doesn't use .html (except for blog which uses directories)
    if (canonical.endsWith('.html')) {
      errors.push(`Canonical uses .html extension in ${relativePath}: ${canonical} (should use clean URL)`);
    }
  }

  console.log(`  Checked ${htmlFiles.length} HTML files`);
}

/**
 * Check for old phone number
 */
async function checkOldPhoneNumber() {
  console.log('Checking for old phone number...');
  const allFiles = await findFiles(ROOT, ['.html', '.js', '.json', '.css', '.md']);

  for (const filePath of allFiles) {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = filePath.replace(ROOT, '');

    for (const variant of OLD_PHONE_VARIANTS) {
      if (content.includes(variant)) {
        errors.push(`Old phone number found in ${relativePath}: ${variant}`);
      }
    }
  }

  console.log('  No old phone numbers found');
}

/**
 * Main validation function
 */
async function validate() {
  console.log('\n=== TD Realty Ohio Indexing Guard ===\n');

  await checkRobotsTxt();
  await checkSitemapXml();
  await checkCanonicals();
  await checkOldPhoneNumber();

  console.log('\n=== Results ===\n');

  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach(w => console.log(`  - ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
    console.log(`\nFailed with ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log('All checks passed!\n');
}

validate().catch(err => {
  console.error('Indexing guard failed:', err);
  process.exit(1);
});
