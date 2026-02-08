#!/usr/bin/env node
/**
 * Nav Registry CI Check
 *
 * Header nav links are static HTML in every page (for SEO crawlability).
 * Footer links are also static HTML in every page (for SEO and reliability).
 * This script validates:
 *   1. Every page has <nav id="main-nav"> with static links matching NAV_REGISTRY
 *   2. assets/js/nav.js TD_NAV matches src/config/nav.js NAV_REGISTRY
 *   3. Footer data-footer-nav containers have static links matching NAV_REGISTRY
 *   4. No testimonials links
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

const { NAV_REGISTRY } = require(join(ROOT, 'src', 'config', 'nav.js'));

const registryServicesHrefs = NAV_REGISTRY.groups.services.items.map(i => i.href);
const registryCompanyHrefs  = NAV_REGISTRY.groups.company.items.map(i => i.href);

const errors = [];

const SKIP_DIRS = new Set([
  'node_modules', 'admin', 'audit', 'output',
  'scripts', 'templates', 'tools', 'reports', 'data', 'lp',
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

function rel(absPath) {
  return relative(ROOT, absPath);
}

async function checkHtmlFiles() {
  const files = await collectHtmlFiles(ROOT);
  console.log(`Found ${files.length} HTML file(s) to scan.\n`);

  let checked = 0;

  for (const file of files) {
    if (file.endsWith('404.html')) continue;

    const html = await readFile(file, 'utf-8');
    if (!html.includes('<nav') || !html.includes('<footer')) continue;
    checked++;

    const rp = rel(file);

    // 1. Check nav exists and static links match NAV_REGISTRY
    const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/i);
    if (!navMatch) {
      errors.push(`${rp}: missing <nav id="main-nav">`);
    } else {
      const navInner = navMatch[1];
      const hrefRe = /href="([^"]+)"/g;
      const foundHrefs = new Set();
      let hm;
      while ((hm = hrefRe.exec(navInner)) !== null) {
        foundHrefs.add(hm[1]);
      }
      for (const href of registryServicesHrefs) {
        if (!foundHrefs.has(href)) {
          errors.push(`${rp}: nav#main-nav missing link to ${href}`);
        }
      }
      for (const href of registryCompanyHrefs) {
        if (!foundHrefs.has(href)) {
          errors.push(`${rp}: nav#main-nav missing link to ${href}`);
        }
      }
    }

    // 2. Check footer placeholder containers exist
    if (!html.includes('data-footer-nav="services"')) {
      errors.push(`${rp}: missing data-footer-nav="services" container`);
    }
    if (!html.includes('data-footer-nav="company"')) {
      errors.push(`${rp}: missing data-footer-nav="company" container`);
    }

    // 3. Check footer static links match NAV_REGISTRY
    const svcMatch = html.match(/data-footer-nav="services">([\s\S]*?)<\/ul>/i);
    if (svcMatch) {
      const hrefRe2 = /href="([^"]+)"/g;
      const footerSvcHrefs = new Set();
      let hm2;
      while ((hm2 = hrefRe2.exec(svcMatch[1])) !== null) {
        footerSvcHrefs.add(hm2[1]);
      }
      for (const href of registryServicesHrefs) {
        if (!footerSvcHrefs.has(href)) {
          errors.push(`${rp}: footer services missing link to ${href}`);
        }
      }
    }

    const cmpMatch = html.match(/data-footer-nav="company">([\s\S]*?)<\/ul>/i);
    if (cmpMatch) {
      const hrefRe3 = /href="([^"]+)"/g;
      const footerCmpHrefs = new Set();
      let hm3;
      while ((hm3 = hrefRe3.exec(cmpMatch[1])) !== null) {
        footerCmpHrefs.add(hm3[1]);
      }
      for (const href of registryCompanyHrefs) {
        if (!footerCmpHrefs.has(href)) {
          errors.push(`${rp}: footer company missing link to ${href}`);
        }
      }
    }

    // 4. No testimonials links
    if (html.includes('href="/testimonials/"')) {
      errors.push(`${rp}: testimonials link found (should be removed)`);
    }
  }

  console.log(`Checked nav & footer in ${checked} page(s).\n`);
}

async function checkAssetsNavJs() {
  const navJsPath = join(ROOT, 'assets', 'js', 'nav.js');
  const src = await readFile(navJsPath, 'utf-8');

  const servicesBlock = src.match(/services:\s*\{[\s\S]*?items:\s*\[([\s\S]*?)\]/);
  const companyBlock  = src.match(/company:\s*\{[\s\S]*?items:\s*\[([\s\S]*?)\]/);

  function hrefsFromBlock(block) {
    if (!block) return [];
    const hrefs = [];
    const re = /href:\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(block[1])) !== null) {
      hrefs.push(m[1]);
    }
    return hrefs;
  }

  const tdServices = hrefsFromBlock(servicesBlock);
  const tdCompany  = hrefsFromBlock(companyBlock);

  const regSvcSet = new Set(registryServicesHrefs);
  const tdSvcSet  = new Set(tdServices);
  for (const href of registryServicesHrefs) {
    if (!tdSvcSet.has(href)) {
      errors.push(`assets/js/nav.js: TD_NAV services missing href ${href}`);
    }
  }
  for (const href of tdServices) {
    if (!regSvcSet.has(href)) {
      errors.push(`assets/js/nav.js: TD_NAV services has unexpected href ${href}`);
    }
  }

  const regCoSet = new Set(registryCompanyHrefs);
  const tdCoSet  = new Set(tdCompany);
  for (const href of registryCompanyHrefs) {
    if (!tdCoSet.has(href)) {
      errors.push(`assets/js/nav.js: TD_NAV company missing href ${href}`);
    }
  }
  for (const href of tdCompany) {
    if (!regCoSet.has(href)) {
      errors.push(`assets/js/nav.js: TD_NAV company has unexpected href ${href}`);
    }
  }

  console.log(`assets/js/nav.js: TD_NAV services=${tdServices.length}, company=${tdCompany.length} hrefs.\n`);
}

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
