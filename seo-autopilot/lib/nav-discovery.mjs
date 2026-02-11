/**
 * nav-discovery.mjs
 *
 * Discovers where navigation is implemented in the repo.
 * Returns file paths, component info, and structural details.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/**
 * Discover navigation implementation details.
 *
 * @returns {{
 *   configFile: string,
 *   headerNavPattern: string,
 *   footerNavPattern: string,
 *   mobileNavBuilder: string,
 *   tdNav: object|null,
 *   topLevelHrefs: string[],
 *   dropdownHrefs: string[],
 *   footerServiceHrefs: string[],
 *   footerCompanyHrefs: string[],
 *   allNavHrefs: string[]
 * }}
 */
export function discoverNav() {
  const configFile = join(ROOT, 'assets', 'js', 'nav.js');
  const mobileNavBuilder = join(ROOT, 'assets', 'js', 'main.js');

  // Parse TD_NAV from nav.js
  let tdNav = null;
  const topLevelHrefs = [];
  const dropdownHrefs = [];
  const footerServiceHrefs = [];
  const footerCompanyHrefs = [];

  try {
    const navSrc = readFileSync(configFile, 'utf-8');

    // Extract items from services group
    const servicesMatch = navSrc.match(/services:\s*\{[^}]*items:\s*\[([\s\S]*?)\]/);
    if (servicesMatch) {
      const items = parseNavItems(servicesMatch[1]);
      for (const item of items) {
        footerServiceHrefs.push(item.href);
        if (item.headerTopLevel) {
          topLevelHrefs.push(item.href);
        } else {
          dropdownHrefs.push(item.href);
        }
      }
    }

    // Extract items from company group
    const companyMatch = navSrc.match(/company:\s*\{[^}]*items:\s*\[([\s\S]*?)\]/);
    if (companyMatch) {
      const items = parseNavItems(companyMatch[1]);
      for (const item of items) {
        footerCompanyHrefs.push(item.href);
        if (item.headerTopLevel) {
          topLevelHrefs.push(item.href);
        } else {
          dropdownHrefs.push(item.href);
        }
      }
    }

    tdNav = { services: footerServiceHrefs, company: footerCompanyHrefs };
  } catch {
    // nav.js not found or parse error
  }

  const allNavHrefs = [...new Set([...topLevelHrefs, ...dropdownHrefs])];

  return {
    configFile,
    headerNavPattern: 'static HTML <nav class="nav" id="main-nav">',
    footerNavPattern: 'static HTML <footer class="footer">',
    mobileNavBuilder: existsSync(mobileNavBuilder) ? mobileNavBuilder : '',
    tdNav,
    topLevelHrefs,
    dropdownHrefs,
    footerServiceHrefs,
    footerCompanyHrefs,
    allNavHrefs,
  };
}

/**
 * Parse nav items from a TD_NAV items array string.
 * Extracts href, label, and headerTopLevel from JS object literals.
 */
function parseNavItems(itemsStr) {
  const items = [];
  const itemRegex = /\{[^}]*href:\s*'([^']+)'[^}]*\}/g;
  let match;
  while ((match = itemRegex.exec(itemsStr)) !== null) {
    const block = match[0];
    const href = match[1];
    const label = block.match(/label:\s*'([^']+)'/)?.[1] || '';
    const headerTopLevel = block.includes('headerTopLevel: true');
    items.push({ href, label, headerTopLevel });
  }
  return items;
}

/**
 * Extract header nav hrefs from a page's HTML.
 * Looks for links inside <nav class="nav" id="main-nav">.
 *
 * @param {string} html - Page HTML content
 * @returns {string[]} Array of hrefs found in header nav
 */
export function extractHeaderNavHrefs(html) {
  const hrefs = [];
  // Match the nav element
  const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
  if (!navMatch) return hrefs;

  const navHtml = navMatch[1];
  const hrefRegex = /href="([^"]+)"/g;
  let m;
  while ((m = hrefRegex.exec(navHtml)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

/**
 * Extract footer nav hrefs from a page's HTML.
 * Looks for links inside <footer class="footer">.
 *
 * @param {string} html - Page HTML content
 * @returns {{ services: string[], company: string[], legal: string[] }}
 */
export function extractFooterNavHrefs(html) {
  const result = { services: [], company: [], legal: [] };

  const footerMatch = html.match(/<footer[^>]*class="footer"[^>]*>([\s\S]*?)<\/footer>/);
  if (!footerMatch) return result;

  const footerHtml = footerMatch[1];

  // Services section
  const servicesMatch = footerHtml.match(/data-footer-nav="services"[^>]*>([\s\S]*?)<\/ul>/);
  if (servicesMatch) {
    const hrefRegex = /href="([^"]+)"/g;
    let m;
    while ((m = hrefRegex.exec(servicesMatch[1])) !== null) {
      result.services.push(m[1]);
    }
  }

  // Company section
  const companyMatch = footerHtml.match(/data-footer-nav="company"[^>]*>([\s\S]*?)<\/ul>/);
  if (companyMatch) {
    const hrefRegex = /href="([^"]+)"/g;
    let m;
    while ((m = hrefRegex.exec(companyMatch[1])) !== null) {
      result.company.push(m[1]);
    }
  }

  // Legal section
  const legalMatch = footerHtml.match(/class="footer-legal"[^>]*>([\s\S]*?)<\/div>/);
  if (legalMatch) {
    const hrefRegex = /href="([^"]+)"/g;
    let m;
    while ((m = hrefRegex.exec(legalMatch[1])) !== null) {
      result.legal.push(m[1]);
    }
  }

  return result;
}
