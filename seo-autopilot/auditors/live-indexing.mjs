/**
 * live-indexing.mjs
 *
 * Audits live URLs for indexing issues:
 * - Status/redirect problems
 * - Noindex directives
 * - Canonical inconsistencies
 * - Missing title/description
 *
 * Never throws — returns results with issues.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTrace } from '../lib/fetch-with-trace.mjs';
import { parseIndexingDirectives } from '../lib/parse-indexing-directives.mjs';
import { loadIndexingPolicy, canonicalBaseFromPolicy, expectedDirectiveForRoute } from '../lib/indexing-policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIVE_CHECKS_PATH = join(__dirname, '..', 'config', 'live-checks.json');
const SITE_CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');

function loadLiveChecksConfig() {
  try { return JSON.parse(readFileSync(LIVE_CHECKS_PATH, 'utf-8')); } catch { return { routes: [], maxRedirectHops: 5, timeoutMs: 15000, requireHttps: true }; }
}

function loadSiteConfig() {
  try { return JSON.parse(readFileSync(SITE_CONFIG_PATH, 'utf-8')); } catch { return { baseUrl: '', canonicalStrategy: 'slash', rankIntentRoutes: [] }; }
}

/**
 * Audit live URLs for indexing issues.
 *
 * @param {object} options
 * @param {string[]} options.robotsDisallowed - Routes blocked by robots.txt
 * @returns {Promise<{ checkedAt: string, results: object[], issueCounts: object }>}
 */
export async function auditLiveIndexing({ robotsDisallowed = [] } = {}) {
  const liveConfig = loadLiveChecksConfig();
  const siteConfig = loadSiteConfig();
  const policy = loadIndexingPolicy();
  const baseUrl = canonicalBaseFromPolicy(policy);
  const strategy = policy.canonical?.trailingSlash === 'never' ? 'no-slash' : 'slash';
  const rankSet = new Set(siteConfig.rankIntentRoutes || []);
  const disallowedSet = new Set(robotsDisallowed);

  if (!baseUrl) {
    console.log('[live-indexing] No baseUrl configured — skipping live checks');
    return { checkedAt: new Date().toISOString(), results: [], issueCounts: {} };
  }

  const results = [];
  const issueCounts = {};

  for (const route of liveConfig.routes || []) {
    const url = baseUrl + route;
    const isRankIntent = rankSet.has(route);
    const expectedDirective = expectedDirectiveForRoute(route, policy);

    const fetchResult = await fetchWithTrace(url, {
      maxHops: liveConfig.maxRedirectHops || 5,
      timeoutMs: liveConfig.timeoutMs || 15000,
      headers: { 'User-Agent': liveConfig.userAgent || 'tdrealtyohio-seo-autopilot/1.0' },
    });

    const issues = [];

    if (!fetchResult.ok) {
      issues.push({ code: 'LIVE_FETCH_ERROR', detail: fetchResult.error });
    } else {
      const final = fetchResult.final;
      const chain = fetchResult.chain;

      // Status checks
      if (isRankIntent && (final.status < 200 || final.status >= 300)) {
        issues.push({ code: 'LIVE_NON_200', detail: `Status ${final.status}` });
      }

      // Redirect chain (more than 1 hop = chain)
      if (chain.length > 2) {
        issues.push({ code: 'LIVE_REDIRECT_CHAIN', detail: `${chain.length - 1} redirect(s)` });
      }

      // Redirect loop (detected by fetch-with-trace as error)
      if (fetchResult.error && fetchResult.error.includes('loop')) {
        issues.push({ code: 'LIVE_REDIRECT_LOOP', detail: fetchResult.error });
      }

      // HTTPS check
      if (liveConfig.requireHttps && final.url && !final.url.startsWith('https://')) {
        issues.push({ code: 'LIVE_HTTPS_REQUIRED', detail: `Final URL: ${final.url}` });
      }

      // Parse HTML directives
      const directives = parseIndexingDirectives(final.bodySnippet);

      // x-robots-tag check
      const xRobots = final.headersSubset?.['x-robots-tag'] || '';
      if (expectedDirective !== 'noindex' && xRobots.toLowerCase().includes('noindex')) {
        issues.push({ code: 'LIVE_NOINDEX', detail: `x-robots-tag: ${xRobots}` });
      }

      // Meta robots noindex check
      if (expectedDirective !== 'noindex' && directives.robotsMeta && directives.robotsMeta.includes('noindex')) {
        issues.push({ code: 'LIVE_NOINDEX', detail: `meta robots: ${directives.robotsMeta}` });
      }


      if (expectedDirective === 'noindex') {
        const metaNoindex = directives.robotsMeta && directives.robotsMeta.includes('noindex');
        const headerNoindex = xRobots.toLowerCase().includes('noindex');
        if (!metaNoindex && !headerNoindex) {
          issues.push({ code: 'LIVE_EXPECTED_NOINDEX_MISSING', detail: 'Policy expects noindex for route' });
        }
      }
      // Canonical checks
      if (isRankIntent && !directives.canonicalHref) {
        issues.push({ code: 'LIVE_CANONICAL_MISSING', detail: 'No canonical tag found' });
      }
      if (directives.canonicalHref) {
        if (!directives.canonicalHref.startsWith('http')) {
          issues.push({ code: 'LIVE_CANONICAL_NOT_ABSOLUTE', detail: directives.canonicalHref });
        } else if (baseUrl && !directives.canonicalHref.startsWith(baseUrl)) {
          issues.push({ code: 'LIVE_CANONICAL_DOMAIN_MISMATCH', detail: directives.canonicalHref });
        } else if (strategy === 'slash' && !directives.canonicalHref.endsWith('/')) {
          issues.push({ code: 'LIVE_CANONICAL_TRAILING_SLASH_MISMATCH', detail: `${directives.canonicalHref} (expected trailing slash)` });
        } else if (strategy === 'no-slash' && directives.canonicalHref.endsWith('/') && directives.canonicalHref !== baseUrl + '/') {
          issues.push({ code: 'LIVE_CANONICAL_TRAILING_SLASH_MISMATCH', detail: `${directives.canonicalHref} (expected no trailing slash)` });
        }
      }

      // Robots.txt blocking
      if (isRankIntent && disallowedSet.has(route)) {
        issues.push({ code: 'LIVE_ROBOTS_TXT_BLOCKING', detail: `Route ${route} is disallowed by robots.txt` });
      }

      // Head basics
      if (isRankIntent && !directives.hasTitle) {
        issues.push({ code: 'LIVE_MISSING_TITLE', detail: 'No <title> found' });
      }
      if (isRankIntent && !directives.hasDescription) {
        issues.push({ code: 'LIVE_MISSING_DESCRIPTION', detail: 'No meta description found' });
      }

      results.push({
        route,
        finalUrl: final.url,
        status: final.status,
        issues,
        chain: chain.map(c => ({ url: c.url, status: c.status })),
      });
    }

    // Count issues
    for (const issue of issues) {
      issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
    }

    if (!fetchResult.ok) {
      results.push({
        route,
        finalUrl: null,
        status: null,
        issues,
        chain: fetchResult.chain.map(c => ({ url: c.url, status: c.status })),
      });
    }
  }

  return { checkedAt: new Date().toISOString(), results, issueCounts };
}
