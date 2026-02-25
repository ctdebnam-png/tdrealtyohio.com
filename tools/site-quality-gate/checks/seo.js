/**
 * SEO Tags Check
 * Validates required meta tags and SEO elements
 */

const path = require('path');
const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile } = require('./utils');

async function checkSeo(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      missingTags: 0
    }
  };

  const files = await getHtmlFiles(config);
  const excludeFromSeo = config.excludeFromSeoCheck || [];
  result.stats.filesChecked = files.length;

  for (const file of files) {
    // Skip files excluded from SEO checks (like 404.html)
    if (excludeFromSeo.some(f => file.relative === f || file.relative.endsWith('/' + f))) {
      continue;
    }

    const html = readHtmlFile(file.absolute);
    const $ = cheerio.load(html);

    // Check each required SEO tag
    for (const selector of config.requiredSeoTags) {
      const element = $(selector);

      if (element.length === 0) {
        result.errors.push({
          file: file.relative,
          message: `Missing SEO tag: ${selector}`
        });
        result.stats.missingTags++;
        result.passed = false;
        continue;
      }

      // Validate tag has content
      if (selector === 'title') {
        const title = element.text().trim();
        if (!title) {
          result.errors.push({
            file: file.relative,
            message: 'Empty title tag'
          });
          result.passed = false;
        } else if (title.length < 10) {
          result.warnings.push({
            file: file.relative,
            message: `Title tag may be too short: "${title}"`
          });
        } else if (title.length > 60) {
          result.warnings.push({
            file: file.relative,
            message: `Title tag may be too long (${title.length} chars): "${title.substring(0, 50)}..."`
          });
        }
      } else if (selector.includes('meta[name="description"]')) {
        const content = element.attr('content');
        if (!content) {
          result.errors.push({
            file: file.relative,
            message: 'Empty meta description'
          });
          result.passed = false;
        } else if (content.length < 50) {
          result.warnings.push({
            file: file.relative,
            message: `Meta description may be too short (${content.length} chars)`
          });
        } else if (content.length > 160) {
          result.warnings.push({
            file: file.relative,
            message: `Meta description may be too long (${content.length} chars)`
          });
        }
      } else if (selector.includes('link[rel="canonical"]')) {
        const href = element.attr('href');
        if (!href) {
          result.errors.push({
            file: file.relative,
            message: 'Canonical tag missing href'
          });
          result.passed = false;
        } else if (!href.startsWith('https://')) {
          result.warnings.push({
            file: file.relative,
            message: `Canonical should use https: ${href}`
          });
        }

        // Canonical URL must not contain query strings or fragments
        if (href && (href.includes('?') || href.includes('#'))) {
          result.errors.push({
            file: file.relative,
            message: `Canonical URL must not contain query string or fragment: ${href}`
          });
          result.passed = false;
        }

        // Canonical URL must start with site origin
        if (href && !href.startsWith('https://tdrealtyohio.com/')) {
          result.errors.push({
            file: file.relative,
            message: `Canonical URL must start with "https://tdrealtyohio.com/": ${href}`
          });
          result.passed = false;
        }

        // Canonical URL must end with trailing slash
        if (href && !href.endsWith('/')) {
          result.errors.push({
            file: file.relative,
            message: `Canonical URL must end with trailing slash: ${href}`
          });
          result.passed = false;
        }
      } else if (selector.includes('meta[property="og:')) {
        const content = element.attr('content');
        if (!content) {
          result.errors.push({
            file: file.relative,
            message: `Empty Open Graph tag: ${selector}`
          });
          result.passed = false;
        }
      }
    }

    // Check that og:url matches canonical URL exactly
    const canonicalEl = $('link[rel="canonical"]');
    const ogUrlEl = $('meta[property="og:url"]');
    if (canonicalEl.length > 0 && ogUrlEl.length > 0) {
      const canonicalHref = canonicalEl.attr('href');
      const ogUrlContent = ogUrlEl.attr('content');
      if (canonicalHref && ogUrlContent && canonicalHref !== ogUrlContent) {
        result.errors.push({
          file: file.relative,
          message: `og:url ("${ogUrlContent}") does not match canonical URL ("${canonicalHref}")`
        });
        result.passed = false;
      }
    }


    // Disallow legacy meta keywords tags
    if ($('meta[name="keywords"]').length > 0) {
      result.errors.push({
        file: file.relative,
        message: 'Legacy meta keywords tag is not allowed'
      });
      result.passed = false;
    }

    // Check for duplicate title tags
    if ($('title').length > 1) {
      result.errors.push({
        file: file.relative,
        message: 'Multiple title tags found'
      });
      result.passed = false;
    }

    // Check for h1 tag — exactly one H1 is required
    const h1Count = $('h1').length;
    if (h1Count === 0) {
      result.errors.push({
        file: file.relative,
        message: 'No H1 tag found'
      });
      result.passed = false;
    } else if (h1Count > 1) {
      result.errors.push({
        file: file.relative,
        message: `Multiple H1 tags found (${h1Count})`
      });
      result.passed = false;
    }

    // Check for lang attribute on html tag
    const lang = $('html').attr('lang');
    if (!lang) {
      result.warnings.push({
        file: file.relative,
        message: 'Missing lang attribute on <html> tag'
      });
    }

    // Check for viewport meta tag
    if ($('meta[name="viewport"]').length === 0) {
      result.warnings.push({
        file: file.relative,
        message: 'Missing viewport meta tag'
      });
    }
  }

  return result;
}

module.exports = checkSeo;
