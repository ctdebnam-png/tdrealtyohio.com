/**
 * live-robots-sitemap.mjs
 *
 * Fetches and audits the live robots.txt and sitemap.xml files.
 * Checks for:
 * - robots.txt existence and correct directives
 * - sitemap.xml existence, XML validity, and URL consistency
 * - robots.txt blocking of rank-intent routes
 *
 * Never throws — returns results with issues.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTrace } from '../lib/fetch-with-trace.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');
const LIVE_CHECKS_PATH = join(__dirname, '..', 'config', 'live-checks.json');

function loadSiteConfig() {
  try { return JSON.parse(readFileSync(SITE_CONFIG_PATH, 'utf-8')); } catch { return { baseUrl: '', rankIntentRoutes: [] }; }
}

function loadLiveChecksConfig() {
  try { return JSON.parse(readFileSync(LIVE_CHECKS_PATH, 'utf-8')); } catch { return { timeoutMs: 15000, userAgent: 'tdrealtyohio-seo-autopilot/1.0' }; }
}

/**
 * Parse robots.txt content and extract rules.
 *
 * @param {string} text - robots.txt content
 * @returns {{ disallowRules: string[], sitemapUrls: string[] }}
 */
function parseRobotsTxt(text) {
  const lines = text.split('\n');
  const disallowRules = [];
  const sitemapUrls = [];
  let inWildcardAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.toLowerCase().startsWith('user-agent:')) {
      const agent = line.slice('user-agent:'.length).trim();
      inWildcardAgent = agent === '*';
    } else if (line.toLowerCase().startsWith('disallow:') && inWildcardAgent) {
      const path = line.slice('disallow:'.length).trim();
      if (path) disallowRules.push(path);
    } else if (line.toLowerCase().startsWith('sitemap:')) {
      const url = line.slice('sitemap:'.length).trim();
      if (url) sitemapUrls.push(url);
    }
  }

  return { disallowRules, sitemapUrls };
}

/**
 * Check if a route is blocked by robots.txt disallow rules.
 * Simple prefix matching (standard robots.txt semantics).
 */
function isRouteDisallowed(route, disallowRules) {
  for (const rule of disallowRules) {
    if (route.startsWith(rule)) return true;
    // Handle wildcard at end
    if (rule.endsWith('*') && route.startsWith(rule.slice(0, -1))) return true;
  }
  return false;
}

/**
 * Audit live robots.txt and sitemap.xml.
 *
 * @returns {Promise<{ checkedAt: string, issues: Array<{ code: string, detail: string }>, issueCounts: object, robotsDisallowed: string[] }>}
 */
export async function auditLiveRobotsSitemap() {
  const siteConfig = loadSiteConfig();
  const liveConfig = loadLiveChecksConfig();
  const baseUrl = siteConfig.baseUrl || '';
  const rankIntentRoutes = siteConfig.rankIntentRoutes || [];
  const timeoutMs = liveConfig.timeoutMs || 15000;
  const userAgent = liveConfig.userAgent || 'tdrealtyohio-seo-autopilot/1.0';

  if (!baseUrl) {
    console.log('[live-robots-sitemap] No baseUrl configured — skipping');
    return { checkedAt: new Date().toISOString(), issues: [], issueCounts: {}, robotsDisallowed: [] };
  }

  const issues = [];
  const issueCounts = {};
  const robotsDisallowed = [];

  // 1) Fetch robots.txt
  const robotsUrl = baseUrl + '/robots.txt';
  const robotsResult = await fetchWithTrace(robotsUrl, { maxHops: 3, timeoutMs, headers: { 'User-Agent': userAgent } });

  if (!robotsResult.ok || !robotsResult.final || robotsResult.final.status !== 200) {
    issues.push({ code: 'LIVE_ROBOTS_MISSING', detail: `robots.txt not accessible (${robotsResult.error || 'status ' + robotsResult.final?.status})` });
  } else {
    const robotsText = robotsResult.final.bodySnippet || '';
    const parsed = parseRobotsTxt(robotsText);

    // Check for sitemap directive
    const expectedSitemapUrl = baseUrl + '/sitemap.xml';
    const hasSitemapDirective = parsed.sitemapUrls.some(u => u === expectedSitemapUrl);
    if (!hasSitemapDirective) {
      issues.push({ code: 'LIVE_SITEMAP_DIRECTIVE_MISSING', detail: `Expected Sitemap: ${expectedSitemapUrl}` });
    }

    // Check for blocking of rank-intent routes
    for (const route of rankIntentRoutes) {
      if (isRouteDisallowed(route, parsed.disallowRules)) {
        robotsDisallowed.push(route);
        issues.push({ code: 'LIVE_ROBOTS_TXT_BLOCKING', detail: `Route ${route} blocked by robots.txt` });
      }
    }
  }

  // 2) Fetch sitemap.xml
  const sitemapUrl = baseUrl + '/sitemap.xml';
  const sitemapResult = await fetchWithTrace(sitemapUrl, { maxHops: 3, timeoutMs, headers: { 'User-Agent': userAgent } });

  if (!sitemapResult.ok || !sitemapResult.final || sitemapResult.final.status !== 200) {
    issues.push({ code: 'LIVE_SITEMAP_MISSING', detail: `sitemap.xml not accessible (${sitemapResult.error || 'status ' + sitemapResult.final?.status})` });
  } else {
    const sitemapText = sitemapResult.final.bodySnippet || '';

    // Basic XML check
    if (!sitemapText.includes('<urlset') && !sitemapText.includes('<sitemapindex')) {
      issues.push({ code: 'LIVE_SITEMAP_INVALID', detail: 'sitemap.xml does not appear to be valid XML' });
    }

    // Check that at least some rank-intent routes are in the sitemap
    const liveCheckRoutes = ['/sellers/', '/buyers/', '/1-percent-commission/', '/areas/', '/blog/', '/about/', '/contact/'];
    let matchedRoutes = 0;
    for (const route of liveCheckRoutes) {
      const fullUrl = baseUrl + route;
      if (sitemapText.includes(fullUrl)) matchedRoutes++;
    }
    if (matchedRoutes === 0 && liveCheckRoutes.length > 0) {
      issues.push({ code: 'LIVE_SITEMAP_ROUTES_MISSING', detail: 'No rank-intent routes found in sitemap.xml' });
    }

    // Check URL domain consistency
    const locMatches = sitemapText.match(/<loc>([^<]+)<\/loc>/g) || [];
    for (const locMatch of locMatches.slice(0, 20)) { // Check first 20
      const loc = locMatch.replace(/<\/?loc>/g, '');
      if (baseUrl && !loc.startsWith(baseUrl)) {
        issues.push({ code: 'LIVE_SITEMAP_URL_DOMAIN_MISMATCH', detail: loc });
        break; // Report once
      }
    }
  }

  // Count issues
  for (const issue of issues) {
    issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
  }

  return { checkedAt: new Date().toISOString(), issues, issueCounts, robotsDisallowed };
}
