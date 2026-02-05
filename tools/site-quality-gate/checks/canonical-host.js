/**
 * Canonical Host Check
 * Validates that all URLs use the canonical host (non-www)
 * Fails if www.tdrealtyohio.com is found in HTML files or sitemap
 */

const path = require('path');
const fs = require('fs');
const { getHtmlFiles, readHtmlFile } = require('./utils');

// Pattern to match www.tdrealtyohio.com
const WWW_PATTERN = /www\.tdrealtyohio\.com/gi;

// Files/patterns to exclude from www check (e.g., CORS origin lists are OK)
const EXCLUDE_PATTERNS = [
  /functions\/api\//,  // API CORS origins need both www and non-www
  /node_modules\//
];

async function checkCanonicalHost(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      wwwReferences: 0
    }
  };

  // Check HTML files
  const files = await getHtmlFiles(config);
  result.stats.filesChecked = files.length;

  for (const file of files) {
    // Skip excluded files
    if (EXCLUDE_PATTERNS.some(pattern => pattern.test(file.relative))) {
      continue;
    }

    const html = readHtmlFile(file.absolute);
    const matches = html.match(WWW_PATTERN);

    if (matches && matches.length > 0) {
      result.errors.push({
        file: file.relative,
        message: `Found ${matches.length} www.tdrealtyohio.com reference(s) - use tdrealtyohio.com instead`
      });
      result.stats.wwwReferences += matches.length;
      result.passed = false;
    }
  }

  // Check sitemap.xml
  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);
  const sitemapPath = path.join(siteRoot, config.sitemapFile || 'sitemap.xml');

  if (fs.existsSync(sitemapPath)) {
    const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
    const sitemapMatches = sitemapContent.match(WWW_PATTERN);

    if (sitemapMatches && sitemapMatches.length > 0) {
      result.errors.push({
        file: 'sitemap.xml',
        message: `Found ${sitemapMatches.length} www.tdrealtyohio.com reference(s) in sitemap`
      });
      result.stats.wwwReferences += sitemapMatches.length;
      result.passed = false;
    }
    result.stats.filesChecked++;
  }

  // Check robots.txt
  const robotsPath = path.join(siteRoot, 'robots.txt');

  if (fs.existsSync(robotsPath)) {
    const robotsContent = fs.readFileSync(robotsPath, 'utf-8');
    const robotsMatches = robotsContent.match(WWW_PATTERN);

    if (robotsMatches && robotsMatches.length > 0) {
      result.errors.push({
        file: 'robots.txt',
        message: `Found ${robotsMatches.length} www.tdrealtyohio.com reference(s) in robots.txt`
      });
      result.stats.wwwReferences += robotsMatches.length;
      result.passed = false;
    }
    result.stats.filesChecked++;
  }

  // Check JavaScript files for hardcoded www URLs (excluding API CORS)
  const jsGlob = require('glob').sync('**/*.js', {
    cwd: siteRoot,
    ignore: ['node_modules/**', 'tools/**', 'functions/api/**']
  });

  for (const jsFile of jsGlob) {
    const jsPath = path.join(siteRoot, jsFile);
    const jsContent = fs.readFileSync(jsPath, 'utf-8');
    const jsMatches = jsContent.match(WWW_PATTERN);

    if (jsMatches && jsMatches.length > 0) {
      result.errors.push({
        file: jsFile,
        message: `Found ${jsMatches.length} www.tdrealtyohio.com reference(s) - use tdrealtyohio.com instead`
      });
      result.stats.wwwReferences += jsMatches.length;
      result.passed = false;
    }
    result.stats.filesChecked++;
  }

  return result;
}

module.exports = checkCanonicalHost;
