const fs = require('fs');
const path = require('path');

const POLICY_PATH = path.resolve(__dirname, '../../../seo-autopilot/config/indexing-policy.json');

function loadPolicy() {
  try {
    return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf-8'));
  } catch {
    return {
      canonical: { scheme: 'https', host: 'tdrealtyohio.com', trailingSlash: 'always', disallowWww: true },
      indexing: { defaultDirective: 'index', noindexPrefixes: [], noindexExact: [] },
      sitemap: { includeByDefault: true, excludePrefixes: [], excludeExact: [], excludePatterns: [], excludeNoindex: true }
    };
  }
}

function normalizeRoute(route, trailingSlash = 'always') {
  if (!route) return '/';
  let value = route.startsWith('/') ? route : `/${route}`;
  value = value.split('?')[0].split('#')[0];
  if (value === '/index.html') value = '/';
  if (value.endsWith('/index.html')) value = `${value.slice(0, -'/index.html'.length)}/`;
  else if (value.endsWith('.html')) value = `${value.slice(0, -'.html'.length)}/`;
  if (value !== '/' && trailingSlash === 'always' && !value.endsWith('/')) value += '/';
  if (value !== '/' && trailingSlash === 'never' && value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

function matchesFamilies(route, { prefixes = [], exact = [], patterns = [] } = {}) {
  if (exact.includes(route)) return true;
  if (prefixes.some((prefix) => route.startsWith(prefix))) return true;
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(route);
    } catch {
      return false;
    }
  });
}

function expectedDirective(route, policy) {
  const normalized = normalizeRoute(route, policy.canonical?.trailingSlash || 'always');
  const isNoindex = matchesFamilies(normalized, {
    prefixes: policy.indexing?.noindexPrefixes || [],
    exact: policy.indexing?.noindexExact || []
  });
  return isNoindex ? 'noindex' : (policy.indexing?.defaultDirective || 'index');
}

function shouldBeInSitemap(route, policy, robotsDirective = null) {
  const normalized = normalizeRoute(route, policy.canonical?.trailingSlash || 'always');
  const sitemap = policy.sitemap || {};

  if (matchesFamilies(normalized, {
    prefixes: sitemap.excludePrefixes || [],
    exact: sitemap.excludeExact || [],
    patterns: sitemap.excludePatterns || []
  })) {
    return false;
  }

  if (sitemap.excludeNoindex && robotsDirective && robotsDirective.toLowerCase().includes('noindex')) {
    return false;
  }

  if (sitemap.includeByDefault === false) {
    return matchesFamilies(normalized, {
      prefixes: sitemap.includePrefixes || [],
      exact: sitemap.includeExact || []
    });
  }

  return true;
}

function canonicalBase(policy) {
  return `${policy.canonical?.scheme || 'https'}://${policy.canonical?.host || 'tdrealtyohio.com'}`;
}

module.exports = { loadPolicy, normalizeRoute, expectedDirective, shouldBeInSitemap, canonicalBase };
