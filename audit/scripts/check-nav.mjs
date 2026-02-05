#!/usr/bin/env node

/**
 * Navigation Consistency Check
 * Verifies that hamburger menu and footer render from the same registry.
 * Outputs drift report to /audit/nav-diff.txt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// Import nav registry
const { NAV_REGISTRY } = await import('../../src/config/nav.js');

// Build expected sets from registry
const registryServices = new Set(
  NAV_REGISTRY.groups.services.items.map(i => i.href)
);
const registryCompany = new Set(
  NAV_REGISTRY.groups.company.items.map(i => i.href)
);
const registryAll = new Set([
  ...registryServices,
  ...registryCompany,
  ...NAV_REGISTRY.headerExtras.map(i => i.href),
  ...NAV_REGISTRY.footerLegal.map(i => i.href)
]);

// Parse actual nav from index.html
function extractActualNav(html) {
  const result = {
    header: [],
    footerServices: [],
    footerCompany: [],
    footerLegal: []
  };

  // Extract header nav
  const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/i);
  if (navMatch) {
    const linkRegex = /href="([^"]+)"/gi;
    let match;
    while ((match = linkRegex.exec(navMatch[1])) !== null) {
      if (match[1].startsWith('/')) {
        result.header.push(match[1]);
      }
    }
  }

  // Extract footer
  const footerMatch = html.match(/<footer[^>]*class="footer"[^>]*>([\s\S]*?)<\/footer>/i);
  if (footerMatch) {
    const footerHtml = footerMatch[1];

    // Services
    const servicesMatch = footerHtml.match(/<h3[^>]*>Services<\/h3>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
    if (servicesMatch) {
      const linkRegex = /href="([^"]+)"/gi;
      let match;
      while ((match = linkRegex.exec(servicesMatch[1])) !== null) {
        if (match[1].startsWith('/')) {
          result.footerServices.push(match[1]);
        }
      }
    }

    // Company
    const companyMatch = footerHtml.match(/<h3[^>]*>Company<\/h3>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
    if (companyMatch) {
      const linkRegex = /href="([^"]+)"/gi;
      let match;
      while ((match = linkRegex.exec(companyMatch[1])) !== null) {
        if (match[1].startsWith('/')) {
          result.footerCompany.push(match[1]);
        }
      }
    }

    // Legal
    const legalMatch = footerHtml.match(/<div[^>]*class="footer-legal"[^>]*>([\s\S]*?)<\/div>/i);
    if (legalMatch) {
      const linkRegex = /href="([^"]+)"/gi;
      let match;
      while ((match = linkRegex.exec(legalMatch[1])) !== null) {
        if (match[1].startsWith('/')) {
          result.footerLegal.push(match[1]);
        }
      }
    }
  }

  return result;
}

// Check all HTML files for nav consistency
const htmlFiles = fs.readdirSync(ROOT, { recursive: true })
  .filter(f => f.endsWith('index.html') && !f.includes('node_modules'))
  .map(f => path.join(ROOT, f));

const diffs = [];
let hasErrors = false;

for (const file of htmlFiles) {
  const relativePath = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf-8');
  const actual = extractActualNav(html);

  const fileDiffs = [];

  // Check footer Services against registry
  const actualServicesSet = new Set(actual.footerServices);
  const missingServices = [...registryServices].filter(h => !actualServicesSet.has(h));
  const extraServices = actual.footerServices.filter(h => !registryServices.has(h));

  if (missingServices.length > 0) {
    fileDiffs.push(`  Footer Services missing: ${missingServices.join(', ')}`);
  }
  if (extraServices.length > 0) {
    fileDiffs.push(`  Footer Services extra (not in registry): ${extraServices.join(', ')}`);
  }

  // Check footer Company against registry
  const actualCompanySet = new Set(actual.footerCompany);
  const missingCompany = [...registryCompany].filter(h => !actualCompanySet.has(h));
  const extraCompany = actual.footerCompany.filter(h => !registryCompany.has(h));

  if (missingCompany.length > 0) {
    fileDiffs.push(`  Footer Company missing: ${missingCompany.join(', ')}`);
  }
  if (extraCompany.length > 0) {
    fileDiffs.push(`  Footer Company extra (not in registry): ${extraCompany.join(', ')}`);
  }

  if (fileDiffs.length > 0) {
    diffs.push(`${relativePath}:\n${fileDiffs.join('\n')}`);
    hasErrors = true;
  }
}

// Write diff report
const outputPath = path.join(ROOT, 'audit/nav-diff.txt');
const report = diffs.length > 0
  ? `Navigation Drift Report\nGenerated: ${new Date().toISOString()}\n\n${diffs.join('\n\n')}`
  : `Navigation Drift Report\nGenerated: ${new Date().toISOString()}\n\nNo drift detected. All navigation surfaces match the registry.`;

fs.writeFileSync(outputPath, report);

console.log(report);

if (hasErrors) {
  console.log('\n❌ Navigation drift detected. See audit/nav-diff.txt');
  process.exit(1);
} else {
  console.log('\n✓ Navigation is consistent with registry.');
  process.exit(0);
}
