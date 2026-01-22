/**
 * Sitemap Consistency Check
 * Validates sitemap.xml matches actual site structure
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { getHtmlFiles } = require('./utils');

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

  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);
  const sitemapPath = path.join(siteRoot, config.sitemapFile);

  // Check if sitemap exists
  if (!fs.existsSync(sitemapPath)) {
    result.errors.push({
      file: config.sitemapFile,
      message: 'Sitemap file not found'
    });
    result.passed = false;
    return result;
  }

  // Parse sitemap
  const sitemapXml = fs.readFileSync(sitemapPath, 'utf-8');
  const $ = cheerio.load(sitemapXml, { xmlMode: true });

  // Extract URLs from sitemap
  const sitemapUrls = new Set();
  $('url loc').each((i, el) => {
    let url = $(el).text().trim();
    // Normalize URL
    url = url.replace(config.baseUrl, '');
    url = url.replace(/\/$/, '') || '/';
    sitemapUrls.add(url);
  });

  result.stats.sitemapUrls = sitemapUrls.size;

  // Get all HTML files
  const files = await getHtmlFiles(config);
  result.stats.htmlFiles = files.length;

  // Build set of expected URLs from HTML files
  const expectedUrls = new Set();
  for (const file of files) {
    let url = '/' + file.relative;
    // Convert index.html to directory URLs
    url = url.replace(/\/index\.html$/, '/').replace(/index\.html$/, '/');
    // Handle other .html files
    url = url.replace(/\.html$/, '.html');
    // Normalize
    url = url.replace(/\/$/, '') || '/';
    expectedUrls.add(url);
  }

  // Find HTML files missing from sitemap
  for (const url of expectedUrls) {
    // Skip certain files that shouldn't be in sitemap
    if (url.includes('404') || url.includes('error')) {
      continue;
    }

    // Check both with and without trailing content
    const urlVariants = [
      url,
      url.replace('.html', ''),
      url + '/'
    ];

    const inSitemap = urlVariants.some(v => sitemapUrls.has(v) || sitemapUrls.has(v.replace(/\/$/, '')));

    if (!inSitemap) {
      result.warnings.push({
        file: config.sitemapFile,
        message: `HTML file not in sitemap: ${url}`
      });
      result.stats.missingFromSitemap++;
    }
  }

  // Find sitemap URLs that don't have corresponding HTML files
  for (const url of sitemapUrls) {
    // Convert sitemap URL to file path
    let filePath = url;
    if (filePath === '/') {
      filePath = '/index.html';
    } else if (filePath.endsWith('/')) {
      filePath = filePath + 'index.html';
    } else if (!filePath.endsWith('.html')) {
      filePath = filePath + '.html';
    }

    // Remove leading slash for path comparison
    filePath = filePath.replace(/^\//, '');

    const fullPath = path.join(siteRoot, filePath);

    // Check if file exists (or if it's a directory with index.html)
    if (!fs.existsSync(fullPath)) {
      // Try without .html extension (might be a directory)
      const dirPath = path.join(siteRoot, filePath.replace('.html', ''));
      const indexPath = path.join(dirPath, 'index.html');

      if (!fs.existsSync(indexPath)) {
        result.errors.push({
          file: config.sitemapFile,
          message: `Sitemap URL has no matching file: ${url}`
        });
        result.stats.orphanedInSitemap++;
        result.passed = false;
      }
    }
  }

  // Check for valid lastmod dates
  $('url').each((i, el) => {
    const loc = $(el).find('loc').text();
    const lastmod = $(el).find('lastmod').text();

    if (lastmod) {
      const date = new Date(lastmod);
      if (isNaN(date.getTime())) {
        result.errors.push({
          file: config.sitemapFile,
          message: `Invalid lastmod date for ${loc}: ${lastmod}`
        });
        result.passed = false;
      }
    }
  });

  return result;
}

module.exports = checkSitemap;
