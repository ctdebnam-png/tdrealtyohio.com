import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICY_PATH = join(__dirname, '..', 'config', 'indexing-policy.json');

const FALLBACK_POLICY = {
  canonical: { scheme: 'https', host: 'tdrealtyohio.com', trailingSlash: 'always', disallowWww: true },
  indexing: { defaultDirective: 'index', indexPrefixes: ['/'], noindexPrefixes: [], noindexExact: [] },
  sitemap: { includeByDefault: true, excludePrefixes: [], excludeExact: [], excludePatterns: [], excludeNoindex: true },
};

export function loadIndexingPolicy() {
  try {
    return JSON.parse(readFileSync(POLICY_PATH, 'utf-8'));
  } catch {
    return FALLBACK_POLICY;
  }
}

export function normalizeRoute(route, trailingSlash = 'always') {
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

export function matchesRouteFamily(route, { prefixes = [], exact = [], patterns = [] } = {}) {
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

export function expectedDirectiveForRoute(route, policy) {
  const normalized = normalizeRoute(route, policy.canonical?.trailingSlash || 'always');
  const noindex = matchesRouteFamily(normalized, {
    prefixes: policy.indexing?.noindexPrefixes || [],
    exact: policy.indexing?.noindexExact || [],
  });
  return noindex ? 'noindex' : (policy.indexing?.defaultDirective || 'index');
}

export function shouldRouteBeInSitemap(route, policy, robotsDirective = null) {
  const normalized = normalizeRoute(route, policy.canonical?.trailingSlash || 'always');
  const sitemap = policy.sitemap || {};

  if (matchesRouteFamily(normalized, {
    prefixes: sitemap.excludePrefixes || [],
    exact: sitemap.excludeExact || [],
    patterns: sitemap.excludePatterns || [],
  })) {
    return false;
  }

  if (sitemap.excludeNoindex && robotsDirective && robotsDirective.toLowerCase().includes('noindex')) {
    return false;
  }

  if (sitemap.includeByDefault === false) {
    return matchesRouteFamily(normalized, { prefixes: sitemap.includePrefixes || [], exact: sitemap.includeExact || [] });
  }

  return true;
}

export function canonicalBaseFromPolicy(policy) {
  const scheme = policy.canonical?.scheme || 'https';
  const host = policy.canonical?.host || 'tdrealtyohio.com';
  return `${scheme}://${host}`;
}
