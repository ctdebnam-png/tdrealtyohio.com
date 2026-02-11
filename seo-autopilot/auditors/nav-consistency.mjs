/**
 * nav-consistency.mjs
 *
 * Audits header/footer nav consistency across all pages.
 * Checks that built HTML includes the expected nav links
 * from the canonical nav config.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractHeaderNavHrefs, extractFooterNavHrefs, discoverNav } from '../lib/nav-discovery.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NAV_CONFIG_PATH = join(__dirname, '..', 'config', 'nav.json');
const PILLARS_ROUTING_PATH = join(__dirname, '..', 'config', 'pillars-routing.json');

function loadJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Audit nav consistency across pages.
 *
 * @param {object[]} pages - Array of { filePath, routePath, html } from list-html-pages
 * @param {object} [options]
 * @param {number} [options.maxPagesToCheck=30] - Cap sampling to limit runtime
 * @returns {{
 *   headerInconsistencies: object[],
 *   footerInconsistencies: object[],
 *   pillarInDegree: object,
 *   totalChecked: number,
 *   issues: object[]
 * }}
 */
export function auditNavConsistency(pages = [], options = {}) {
  const maxCheck = options.maxPagesToCheck || 30;
  const navConfig = loadJson(NAV_CONFIG_PATH, { topNav: [], footerNav: [] });
  const pillarsRouting = loadJson(PILLARS_ROUTING_PATH, { pillars: [] });

  // Expected top-nav hrefs from config
  const expectedTopNavHrefs = new Set(navConfig.topNav.map(n => n.href));
  // Expected footer hrefs from config
  const expectedFooterHrefs = new Set(navConfig.footerNav.map(n => n.href));

  // Discover what TD_NAV says
  const navDiscovery = discoverNav();

  const headerInconsistencies = [];
  const footerInconsistencies = [];
  const issues = [];

  // Track pillar in-degree from nav links (how many pages link to each pillar root)
  const pillarRoots = pillarsRouting.pillars.map(p => p.root);
  const pillarInDegree = {};
  for (const root of pillarRoots) {
    pillarInDegree[root] = 0;
  }

  // Sample pages (pick rank-intent first, then fill with others)
  const sampled = pages.slice(0, maxCheck);

  for (const page of sampled) {
    let html;
    try {
      html = readFileSync(page.filePath, 'utf-8');
    } catch {
      continue;
    }

    // Check header nav
    const headerHrefs = extractHeaderNavHrefs(html);
    const headerHrefSet = new Set(headerHrefs);

    // Count pillar root links in header
    for (const root of pillarRoots) {
      if (headerHrefSet.has(root)) {
        pillarInDegree[root]++;
      }
    }

    // Check for missing expected top-nav hrefs
    for (const expected of expectedTopNavHrefs) {
      // Skip /1-percent-commission/ — it's not in current static header (it's in dropdown)
      // Only check hrefs that should be top-level
      if (!headerHrefSet.has(expected)) {
        // Check if it's in the full header (including dropdown)
        if (!headerHrefs.includes(expected)) {
          headerInconsistencies.push({
            route: page.routePath,
            missing: expected,
            code: 'HEADER_MISSING_NAV_LINK',
          });
        }
      }
    }

    // Check footer nav
    const footerHrefs = extractFooterNavHrefs(html);
    const allFooterHrefs = new Set([...footerHrefs.services, ...footerHrefs.company]);

    // Count pillar root links in footer
    for (const root of pillarRoots) {
      if (allFooterHrefs.has(root)) {
        pillarInDegree[root]++;
      }
    }

    for (const expected of expectedFooterHrefs) {
      if (!allFooterHrefs.has(expected)) {
        footerInconsistencies.push({
          route: page.routePath,
          missing: expected,
          code: 'FOOTER_MISSING_NAV_LINK',
        });
      }
    }
  }

  // Aggregate unique inconsistencies
  const uniqueHeaderMissing = [...new Set(headerInconsistencies.map(i => i.missing))];
  const uniqueFooterMissing = [...new Set(footerInconsistencies.map(i => i.missing))];

  if (uniqueHeaderMissing.length > 0) {
    issues.push({
      code: 'NAV_HEADER_INCONSISTENT',
      detail: `Header nav missing: ${uniqueHeaderMissing.join(', ')} (across ${headerInconsistencies.length} page(s))`,
      severity: 'warning',
      count: headerInconsistencies.length,
    });
  }

  if (uniqueFooterMissing.length > 0) {
    issues.push({
      code: 'NAV_FOOTER_INCONSISTENT',
      detail: `Footer nav missing: ${uniqueFooterMissing.join(', ')} (across ${footerInconsistencies.length} page(s))`,
      severity: 'warning',
      count: footerInconsistencies.length,
    });
  }

  // Check pillar in-degree
  for (const root of pillarRoots) {
    if (pillarInDegree[root] < sampled.length * 0.5) {
      issues.push({
        code: 'NAV_LOW_PILLAR_INDEGREE',
        detail: `Pillar ${root} linked from ${pillarInDegree[root]}/${sampled.length} checked pages (header+footer)`,
        severity: 'info',
      });
    }
  }

  return {
    headerInconsistencies: headerInconsistencies.slice(0, 20),
    footerInconsistencies: footerInconsistencies.slice(0, 20),
    pillarInDegree,
    totalChecked: sampled.length,
    issues,
  };
}
