/**
 * canonical-agreement.mjs
 *
 * Detects canonical URL disagreements across three layers:
 * - Source/intended (canonical URL set)
 * - Built (extracted from HTML <link rel="canonical">)
 * - Live (fetched from production)
 *
 * Mismatches indicate deployment or configuration issues.
 */

import { toAbsoluteUrl, normalizePath } from '../lib/url-normalize.mjs';
import { loadIndexingPolicy, canonicalBaseFromPolicy } from '../lib/indexing-policy.mjs';

/**
 * Audit canonical agreement between intended, built, and live canonicals.
 *
 * @param {object} options
 * @param {object} options.auditResult - Build audit result with .pages[].issues and canonical extraction
 * @param {string[]} options.canonicalUrls - Intended canonical URLs
 * @param {object[]} options.liveResults - From live-indexing auditor (with .route and directives)
 * @param {string[]} options.rankIntentRoutes - Rank-intent route paths
 * @returns {{ buildMismatches: object[], liveMismatches: object[], issueCounts: object }}
 */
export function auditCanonicalAgreement({
  auditResult = null,
  canonicalUrls = [],
  liveResults = [],
  rankIntentRoutes = [],
} = {}) {
  const policy = loadIndexingPolicy();
  const baseUrl = canonicalBaseFromPolicy(policy);
  const strategy = policy.canonical?.trailingSlash === 'never' ? 'no-slash' : 'slash';
  const rankSet = new Set(rankIntentRoutes);

  const canonicalSet = new Set(canonicalUrls);
  const buildMismatches = [];
  const liveMismatches = [];

  // Check built canonicals against expected
  if (auditResult && auditResult.pages) {
    for (const page of auditResult.pages) {
      const pagePath = page.path || page.routePath;
      if (!pagePath || !rankSet.has(pagePath)) continue;

      const expectedCanonical = toAbsoluteUrl(baseUrl, normalizePath(pagePath, strategy));

      // Extract canonical from page issues or built data
      const canonicalIssue = (page.issues || []).find(i =>
        i.code === 'MISSING_CANONICAL' || i.code === 'CANONICAL_NOT_ABSOLUTE' || i.code === 'CANONICAL_DOMAIN_MISMATCH'
      );

      if (canonicalIssue) {
        // Already flagged by build audit — these are inherent mismatches
        buildMismatches.push({
          route: pagePath,
          expected: expectedCanonical,
          actual: canonicalIssue.detail || 'missing',
          issue: canonicalIssue.code,
        });
      }

      // Check the extracted canonical from HTML (if parsedCanonical exists on page)
      if (page.canonical && page.canonical !== expectedCanonical) {
        // Only flag if not already captured above
        if (!canonicalIssue) {
          buildMismatches.push({
            route: pagePath,
            expected: expectedCanonical,
            actual: page.canonical,
            issue: 'CANONICAL_BUILD_MISMATCH',
          });
        }
      }
    }
  }

  // Check live canonicals against expected
  for (const result of liveResults) {
    if (!result.route || !rankSet.has(result.route)) continue;

    const expectedCanonical = toAbsoluteUrl(baseUrl, normalizePath(result.route, strategy));

    // Look for canonical info in the live result
    const canonicalIssues = (result.issues || []).filter(i =>
      i.code === 'LIVE_CANONICAL_MISSING' ||
      i.code === 'LIVE_CANONICAL_NOT_ABSOLUTE' ||
      i.code === 'LIVE_CANONICAL_DOMAIN_MISMATCH' ||
      i.code === 'LIVE_CANONICAL_TRAILING_SLASH_MISMATCH'
    );

    for (const issue of canonicalIssues) {
      liveMismatches.push({
        route: result.route,
        expected: expectedCanonical,
        actual: issue.detail || 'unknown',
        issue: 'CANONICAL_LIVE_MISMATCH',
      });
    }
  }

  const issueCounts = {};
  if (buildMismatches.length > 0) {
    issueCounts.CANONICAL_BUILD_MISMATCH = buildMismatches.length;
  }
  if (liveMismatches.length > 0) {
    issueCounts.CANONICAL_LIVE_MISMATCH = liveMismatches.length;
  }

  return { buildMismatches, liveMismatches, issueCounts };
}
