#!/usr/bin/env node
/**
 * Nav Registry CI Check
 * Validates that every HTML page's nav and footer links match the canonical
 * NAV_REGISTRY defined in src/config/nav.js, and that assets/js/nav.js
 * (the browser-side TD_NAV object) is also in sync.
 *
 * Exit code 1 on any mismatch.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Import the canonical registry via require() (CJS export)
// ---------------------------------------------------------------------------
const { NAV_REGISTRY } = require(join(ROOT, 'src', 'config', 'nav.js'));

const registryServicesHrefs = NAV_REGISTRY.groups.services.items.map(i => i.href);
const registryCompanyHrefs  = NAV_REGISTRY.groups.company.items.map(i => i.href);
const allRegistryHrefs      = new Set([...registryServicesHrefs, ...registryCompanyHrefs]);

const errors = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all .html file paths, skipping excluded dirs. */
const SKIP_DIRS = new Set([
  'node_modules', 'admin', 'audit', 'output',
  'scripts', 'templates', 'tools', 'reports', 'data',
]);

async function collectHtmlFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...await collectHtmlFiles(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

/**
 * Extract all hrefs from the main nav element.
 * Matches <nav class="nav" ...> or <nav ... id="main-nav" ...>.
 */
function extractNavHrefs(html) {
  const navRegex = /<nav[^>]*(?:class="nav"|id="main-nav")[^>]*>([\s\S]*?)<\/nav>/i;
  const match = html.match(navRegex);
  if (!match) return null;

  const navBlock = match[1];
  const hrefs = [];
  const re = /href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(navBlock)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

/**
 * Extract hrefs from a <ul class="footer-links"> that is preceded by a
 * <h3 class="footer-title">Title</h3>.
 */
function extractFooterSectionHrefs(html, sectionTitle) {
  const re = new RegExp(
    `<h3[^>]*class="footer-title"[^>]*>\\s*${sectionTitle}\\s*</h3>\\s*<ul[^>]*class="footer-links"[^>]*>([\\s\\S]*?)</ul>`,
    'i',
  );
  const match = html.match(re);
  if (!match) return null;

  const block = match[1];
  const hrefs = [];
  const hrefRe = /href="([^"]+)"/gi;
  let m;
  while ((m = hrefRe.exec(block)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

/** Pretty-print a file path relative to the repo root. */
function rel(absPath) {
  return relative(ROOT, absPath);
}

/** Compare two ordered arrays of hrefs and report mismatches. */
function compareExact(actual, expected, label, file) {
  const expectedSet = new Set(expected);
  const actualSet   = new Set(actual);

  for (const href of expected) {
    if (!actualSet.has(href)) {
      errors.push(`${rel(file)}: ${label} missing href ${href}`);
    }
  }
  for (const href of actual) {
    if (!expectedSet.has(href)) {
      errors.push(`${rel(file)}: ${label} has unexpected href ${href}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2-3. Scan all HTML files
// ---------------------------------------------------------------------------

async function checkHtmlFiles() {
  const files = await collectHtmlFiles(ROOT);
  console.log(`Found ${files.length} HTML file(s) to scan.\n`);

  let checked = 0;

  for (const file of files) {
    // Skip 404 page (intentionally has reduced footer)
    if (file.endsWith('404.html')) continue;

    const html = await readFile(file, 'utf-8');

    // Only inspect pages that contain both a nav and a footer
    if (!html.includes('<nav') || !html.includes('<footer')) continue;
    checked++;

    const rp = rel(file);

    // --- 3a. Nav link hrefs --------------------------------------------------
    const navHrefs = extractNavHrefs(html);
    if (!navHrefs) {
      errors.push(`${rp}: contains <nav but could not extract main-nav/nav.nav section`);
    } else {
      // Every nav href must exist somewhere in the registry
      for (const href of navHrefs) {
        if (!allRegistryHrefs.has(href)) {
          errors.push(`${rp}: nav contains href ${href} not found in NAV_REGISTRY`);
        }
      }
    }

    // --- 3b-d. Footer Services -----------------------------------------------
    const footerServicesHrefs = extractFooterSectionHrefs(html, 'Services');
    if (!footerServicesHrefs) {
      errors.push(`${rp}: could not find footer Services section`);
    } else {
      compareExact(footerServicesHrefs, registryServicesHrefs, 'Footer Services', file);
    }

    // --- 3e. Footer Company --------------------------------------------------
    const footerCompanyHrefs = extractFooterSectionHrefs(html, 'Company');
    if (!footerCompanyHrefs) {
      errors.push(`${rp}: could not find footer Company section`);
    } else {
      // /contact/ may be omitted from footer Company (it appears in the
      // footer Contact section instead), so exclude it from the expected set.
      const expectedCompany = registryCompanyHrefs.filter(h => h !== '/contact/');
      const expectedCompanySet = new Set(expectedCompany);
      const actualSet = new Set(footerCompanyHrefs);

      for (const href of expectedCompany) {
        if (!actualSet.has(href)) {
          errors.push(`${rp}: Footer Company missing href ${href}`);
        }
      }
      for (const href of footerCompanyHrefs) {
        // /contact/ is allowed but not required
        if (href === '/contact/') continue;
        if (!expectedCompanySet.has(href)) {
          errors.push(`${rp}: Footer Company has unexpected href ${href}`);
        }
      }
    }
  }

  console.log(`Checked nav & footer in ${checked} page(s).\n`);
}

// ---------------------------------------------------------------------------
// 4. Verify assets/js/nav.js TD_NAV object matches the registry
// ---------------------------------------------------------------------------

async function checkAssetsNavJs() {
  const navJsPath = join(ROOT, 'assets', 'js', 'nav.js');
  const src = await readFile(navJsPath, 'utf-8');

  // Extract all href values from the TD_NAV object literal.
  // The file structure is a plain object literal so we can grab hrefs with a
  // simple regex: href: '/some-path/'
  const hrefRe = /href:\s*'([^']+)'/g;
  const tdNavHrefs = [];
  let m;
  while ((m = hrefRe.exec(src)) !== null) {
    tdNavHrefs.push(m[1]);
  }

  // We also need to know which group each href belongs to so we can compare
  // services vs company separately.
  // Strategy: split the source into the two group blocks.
  const servicesBlock = src.match(/services:\s*\{[\s\S]*?items:\s*\[([\s\S]*?)\]/);
  const companyBlock  = src.match(/company:\s*\{[\s\S]*?items:\s*\[([\s\S]*?)\]/);

  function hrefsFromBlock(block) {
    if (!block) return [];
    const hrefs = [];
    const re = /href:\s*'([^']+)'/g;
    let m2;
    while ((m2 = re.exec(block[1])) !== null) {
      hrefs.push(m2[1]);
    }
    return hrefs;
  }

  const tdServices = hrefsFromBlock(servicesBlock);
  const tdCompany  = hrefsFromBlock(companyBlock);

  // Compare with registry
  const rp = 'assets/js/nav.js';

  const regSvcSet = new Set(registryServicesHrefs);
  const tdSvcSet  = new Set(tdServices);
  for (const href of registryServicesHrefs) {
    if (!tdSvcSet.has(href)) {
      errors.push(`${rp}: TD_NAV services missing href ${href}`);
    }
  }
  for (const href of tdServices) {
    if (!regSvcSet.has(href)) {
      errors.push(`${rp}: TD_NAV services has unexpected href ${href}`);
    }
  }

  const regCoSet = new Set(registryCompanyHrefs);
  const tdCoSet  = new Set(tdCompany);
  for (const href of registryCompanyHrefs) {
    if (!tdCoSet.has(href)) {
      errors.push(`${rp}: TD_NAV company missing href ${href}`);
    }
  }
  for (const href of tdCompany) {
    if (!regCoSet.has(href)) {
      errors.push(`${rp}: TD_NAV company has unexpected href ${href}`);
    }
  }

  console.log(`assets/js/nav.js: TD_NAV services=${tdServices.length}, company=${tdCompany.length} hrefs.\n`);
}

// ---------------------------------------------------------------------------
// 5. Run and report
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n=== Nav Registry CI Check ===\n');

  await checkHtmlFiles();
  await checkAssetsNavJs();

  console.log('=== Results ===\n');

  if (errors.length > 0) {
    console.error('ERRORS:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    console.error(`\nFailed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('All nav-registry checks passed.\n');
}

main().catch(err => {
  console.error('Nav registry check crashed:', err);
  process.exit(1);
});
