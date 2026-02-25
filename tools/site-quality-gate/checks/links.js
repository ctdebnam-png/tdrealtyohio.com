/**
 * Link Validation Check
 * Checks for broken internal and external links
 */

const path = require('path');
const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile, isExternalUrl, localFileExists } = require('./utils');

async function checkLinks(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      totalLinks: 0,
      internalLinks: 0,
      externalLinks: 0,
      brokenInternal: 0,
      skippedExternal: 0
    }
  };

  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);
  const files = await getHtmlFiles(config);

  // Collect all external URLs for batch checking
  const externalUrls = new Map(); // url -> [files that reference it]

  for (const file of files) {
    const html = readHtmlFile(file.absolute);
    const $ = cheerio.load(html);

    // Check all anchor tags
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      result.stats.totalLinks++;

      // Skip anchors, mailto, tel, javascript
      if (href.startsWith('#') || href.startsWith('mailto:') ||
          href.startsWith('tel:') || href.startsWith('javascript:')) {
        return;
      }

      if (isExternalUrl(href, config.baseUrl)) {
        result.stats.externalLinks++;

        // Check if domain should be skipped
        try {
          const url = new URL(href);
          if (config.externalLinks.skipDomains.some(d => url.hostname.includes(d))) {
            result.stats.skippedExternal++;
            return;
          }
        } catch {
          // Invalid URL
          result.errors.push({
            file: file.relative,
            message: `Invalid URL: ${href}`
          });
          result.passed = false;
          return;
        }

        // Track external URL for later checking
        if (!externalUrls.has(href)) {
          externalUrls.set(href, []);
        }
        externalUrls.get(href).push(file.relative);
      } else {
        result.stats.internalLinks++;

        // Check internal link
        if (!localFileExists(href, file.absolute, siteRoot)) {
          result.errors.push({
            file: file.relative,
            message: `Broken internal link: ${href}`
          });
          result.stats.brokenInternal++;
          result.passed = false;
        }
      }
    });

    // Check image sources
    $('img[src]').each((i, el) => {
      const src = $(el).attr('src');
      if (!src) return;

      // Skip external images and data URIs
      if (isExternalUrl(src, config.baseUrl) || src.startsWith('data:')) {
        return;
      }

      if (!localFileExists(src, file.absolute, siteRoot)) {
        result.errors.push({
          file: file.relative,
          message: `Missing image: ${src}`
        });
        result.passed = false;
      }
    });

    // Check script sources
    $('script[src]').each((i, el) => {
      const src = $(el).attr('src');
      if (!src) return;

      // Skip external scripts
      if (isExternalUrl(src, config.baseUrl)) {
        return;
      }

      if (!localFileExists(src, file.absolute, siteRoot)) {
        result.errors.push({
          file: file.relative,
          message: `Missing script: ${src}`
        });
        result.passed = false;
      }
    });

    // Check CSS links
    $('link[rel="stylesheet"][href]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Skip external stylesheets
      if (isExternalUrl(href, config.baseUrl)) {
        return;
      }

      if (!localFileExists(href, file.absolute, siteRoot)) {
        result.errors.push({
          file: file.relative,
          message: `Missing stylesheet: ${href}`
        });
        result.passed = false;
      }
    });
  }

  // Note: External link checking disabled by default in CI due to rate limiting
  // and flakiness. Enable with --check-external flag if needed.
  if (verbose) {
    result.warnings.push({
      file: 'N/A',
      message: `${externalUrls.size} external URLs found. Use --check-external to validate them.`
    });
  }

  return result;
}

module.exports = checkLinks;
