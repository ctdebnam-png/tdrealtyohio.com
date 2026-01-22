/**
 * Shared utilities for quality checks
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

/**
 * Get all HTML files in the site
 */
async function getHtmlFiles(config) {
  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);
  const pattern = path.join(siteRoot, config.htmlGlob);

  const files = await glob(pattern, {
    ignore: config.excludeDirs.map(d => `**/${d}/**`)
  });

  return files.map(f => ({
    absolute: f,
    relative: path.relative(siteRoot, f)
  }));
}

/**
 * Read and parse an HTML file
 */
function readHtmlFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Normalize a URL for comparison
 */
function normalizeUrl(url, baseUrl) {
  if (!url) return null;

  // Remove trailing slash for consistency
  url = url.replace(/\/$/, '');

  // Handle relative URLs
  if (url.startsWith('/')) {
    return baseUrl + url;
  }

  // Handle protocol-relative URLs
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  return url;
}

/**
 * Check if a URL is external
 */
function isExternalUrl(url, baseUrl) {
  if (!url) return false;
  if (url.startsWith('#')) return false;
  if (url.startsWith('mailto:')) return false;
  if (url.startsWith('tel:')) return false;
  if (url.startsWith('javascript:')) return false;

  try {
    const urlObj = new URL(url, baseUrl);
    const baseObj = new URL(baseUrl);
    return urlObj.hostname !== baseObj.hostname;
  } catch {
    return false;
  }
}

/**
 * Check if a local file exists
 */
function localFileExists(href, htmlFile, siteRoot) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
      href.startsWith('tel:') || href.startsWith('javascript:')) {
    return true;
  }

  // Handle absolute paths
  let targetPath;
  if (href.startsWith('/')) {
    targetPath = path.join(siteRoot, href);
  } else {
    // Handle relative paths
    const htmlDir = path.dirname(htmlFile);
    targetPath = path.join(htmlDir, href);
  }

  // Remove query strings and fragments
  targetPath = targetPath.split('?')[0].split('#')[0];

  // Check if it's a directory (should have index.html)
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      return fs.existsSync(path.join(targetPath, 'index.html'));
    }
    return true;
  }

  // Try adding .html extension
  if (!targetPath.endsWith('.html') && fs.existsSync(targetPath + '.html')) {
    return true;
  }

  return false;
}

module.exports = {
  getHtmlFiles,
  readHtmlFile,
  normalizeUrl,
  isExternalUrl,
  localFileExists
};
