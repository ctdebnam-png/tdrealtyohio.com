/**
 * Canonical Host Check
 * Validates canonical host + trailing slash rules from centralized indexing policy.
 */

const path = require('path');
const fs = require('fs');
const { getHtmlFiles, readHtmlFile } = require('./utils');
const { loadPolicy, normalizeRoute, canonicalBase } = require('./indexing-policy');

async function checkCanonicalHost(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      hostViolations: 0,
      trailingSlashViolations: 0
    }
  };

  const policy = loadPolicy();
  const trailing = policy.canonical?.trailingSlash || 'always';
  const baseUrl = canonicalBase(policy);
  const hostPattern = new RegExp(`${policy.canonical?.host || 'tdrealtyohio.com'}`.replace('.', '\\.'), 'i');
  const disallowWww = policy.canonical?.disallowWww !== false;

  const files = await getHtmlFiles(config);
  result.stats.filesChecked = files.length;

  for (const file of files) {
    const html = readHtmlFile(file.absolute);
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);

    if (!canonicalMatch) continue;

    const canonical = canonicalMatch[1].trim();
    if (!canonical.startsWith(baseUrl)) {
      result.errors.push({ file: file.relative, message: `Canonical uses non-policy base URL: ${canonical}` });
      result.stats.hostViolations++;
      result.passed = false;
      continue;
    }

    if (disallowWww && canonical.includes('://www.')) {
      result.errors.push({ file: file.relative, message: `Canonical includes disallowed www host: ${canonical}` });
      result.stats.hostViolations++;
      result.passed = false;
    }

    if (!hostPattern.test(canonical)) {
      result.errors.push({ file: file.relative, message: `Canonical host does not match policy host: ${canonical}` });
      result.stats.hostViolations++;
      result.passed = false;
    }

    const routeFromFile = normalizeRoute('/' + file.relative, trailing);
    const canonicalRoute = normalizeRoute(canonical.replace(baseUrl, '') || '/', trailing);

    if (routeFromFile !== canonicalRoute) {
      result.errors.push({ file: file.relative, message: `Canonical route mismatch. Expected ${baseUrl}${routeFromFile}, found ${canonical}` });
      result.stats.trailingSlashViolations++;
      result.passed = false;
    }
  }

  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);
  for (const artifactFile of [config.sitemapFile || 'sitemap.xml', 'robots.txt']) {
    const artifactPath = path.join(siteRoot, artifactFile);
    if (!fs.existsSync(artifactPath)) continue;
    const content = fs.readFileSync(artifactPath, 'utf-8');
    if (disallowWww && content.includes('www.tdrealtyohio.com')) {
      result.errors.push({ file: artifactFile, message: 'Found disallowed www host reference' });
      result.stats.hostViolations++;
      result.passed = false;
    }
    if (artifactFile === (config.sitemapFile || 'sitemap.xml')) {
      const badLoc = content.match(/<loc>([^<]+)<\/loc>/g)?.find((entry) => !entry.includes(baseUrl));
      if (badLoc) {
        result.errors.push({ file: artifactFile, message: `Sitemap contains URL outside policy host: ${badLoc}` });
        result.stats.hostViolations++;
        result.passed = false;
      }
    }
    result.stats.filesChecked++;
  }

  return result;
}

module.exports = checkCanonicalHost;
