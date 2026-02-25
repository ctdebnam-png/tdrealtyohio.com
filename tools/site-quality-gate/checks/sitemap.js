/**
 * Sitemap Consistency Check
 * Validates sitemap.xml matches centralized indexing policy + actual site structure.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile } = require('./utils');
const { loadPolicy, normalizeRoute, shouldBeInSitemap } = require('./indexing-policy');

async function checkSitemap(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      sitemapUrls: 0,
      htmlFiles: 0,
      missingFromSitemap: 0,
      orphanedInSitemap: 0
    }
  };

  const policy = loadPolicy();
  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);
  const sitemapPath = path.join(siteRoot, config.sitemapFile);
  const trailingSlash = policy.canonical?.trailingSlash || 'always';
  const baseUrl = `${policy.canonical?.scheme || 'https'}://${policy.canonical?.host || 'tdrealtyohio.com'}`;

  if (!fs.existsSync(sitemapPath)) {
    result.errors.push({ file: config.sitemapFile, message: 'Sitemap file not found' });
    result.passed = false;
    return result;
  }

  const sitemapXml = fs.readFileSync(sitemapPath, 'utf-8');
  const $ = cheerio.load(sitemapXml, { xmlMode: true });

  const sitemapUrls = new Set();
  $('url loc').each((i, el) => {
    const loc = $(el).text().trim();
    if (!loc.startsWith(baseUrl)) {
      result.errors.push({ file: config.sitemapFile, message: `Sitemap URL uses non-policy host: ${loc}` });
      result.passed = false;
      return;
    }
    const route = normalizeRoute(loc.replace(baseUrl, '') || '/', trailingSlash);
    sitemapUrls.add(route);
  });

  result.stats.sitemapUrls = sitemapUrls.size;

  const files = await getHtmlFiles(config);
  result.stats.htmlFiles = files.length;

  const pageRobots = new Map();
  const expectedUrls = new Set();

  for (const file of files) {
    const route = normalizeRoute('/' + file.relative, trailingSlash);
    const html = readHtmlFile(file.absolute);
    const robotsMatch = html.match(/meta\s[^>]*name=["']robots["'][^>]*content=["']([^"']+)/i);
    const robotsDirective = robotsMatch ? robotsMatch[1].toLowerCase() : null;

    pageRobots.set(route, robotsDirective);

    if (shouldBeInSitemap(route, policy, robotsDirective)) {
      expectedUrls.add(route);
    }
  }

  for (const url of expectedUrls) {
    if (!sitemapUrls.has(url)) {
      result.errors.push({ file: config.sitemapFile, message: `Policy divergence: expected route missing from sitemap: ${url}` });
      result.stats.missingFromSitemap++;
      result.passed = false;
    }
  }

  for (const url of sitemapUrls) {
    if (!expectedUrls.has(url)) {
      result.errors.push({ file: config.sitemapFile, message: `Policy divergence: route should not be in sitemap: ${url}` });
      result.stats.orphanedInSitemap++;
      result.passed = false;
    }
  }

  $('url').each((i, el) => {
    const loc = $(el).find('loc').text();
    const lastmod = $(el).find('lastmod').text();

    if (lastmod) {
      const date = new Date(lastmod);
      if (isNaN(date.getTime())) {
        result.errors.push({ file: config.sitemapFile, message: `Invalid lastmod date for ${loc}: ${lastmod}` });
        result.passed = false;
      }
    }
  });

  return result;
}

module.exports = checkSitemap;
