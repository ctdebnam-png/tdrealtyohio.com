/**
 * Blog Content Quality Check
 * Ensures every indexable blog post includes:
 * - author attribution
 * - publish/review date signals
 * - methodology/source/data note content
 */

const path = require('path');
const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile } = require('./utils');

function hasIndexableRobotsNoindex($) {
  const robots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  return robots.includes('noindex');
}

function parseJsonLd($) {
  const schemas = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (raw) schemas.push(JSON.parse(raw));
    } catch {
      // ignore JSON parse errors in this check
    }
  });
  return schemas;
}

function hasAuthorSignals($, schemas) {
  if ($('.author-card a[href="/about/"]').length > 0) return true;
  if ($('a[href="/about/"]').filter((_, el) => /author/i.test($(el).closest('*').text())).length > 0) return true;
  if ($('meta[property="article:author"]').length > 0) return true;
  return schemas.some(s => s['@type'] === 'Article' && !!s.author);
}

function hasPublishReviewSignals($, schemas, text) {
  const hasPublishedMeta = $('meta[property="article:published_time"]').length > 0;
  const hasModifiedMeta = $('meta[property="article:modified_time"]').length > 0;
  const articleSchema = schemas.find(s => s['@type'] === 'Article') || {};
  const hasSchemaDates = !!articleSchema.datePublished && !!(articleSchema.dateModified || articleSchema.dateCreated);
  const hasVisibleSignals = /published\s*:?\s*\d{4}-\d{2}-\d{2}/i.test(text) && /last\s+reviewed\s*:?/i.test(text);
  return (hasPublishedMeta && hasModifiedMeta) || hasSchemaDates || hasVisibleSignals;
}

function hasSourceOrDataNote(text) {
  return /(methodology|data\s*note|data\s*sources?|sources?:)/i.test(text);
}

async function checkBlogContentQuality(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      indexableBlogPostsChecked: 0,
      missingAuthor: 0,
      missingDates: 0,
      missingSourceDataNote: 0
    }
  };

  const files = await getHtmlFiles(config);
  result.stats.filesChecked = files.length;

  for (const file of files) {
    if (!file.relative.startsWith(path.join('blog', path.sep)) && !file.relative.startsWith('blog/')) continue;
    if (file.relative === 'blog/index.html') continue;

    const html = readHtmlFile(file.absolute);
    const $ = cheerio.load(html);

    if (hasIndexableRobotsNoindex($)) continue;

    result.stats.indexableBlogPostsChecked++;

    const schemas = parseJsonLd($);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    const hasAuthor = hasAuthorSignals($, schemas);
    const hasDates = hasPublishReviewSignals($, schemas, text);
    const hasSource = hasSourceOrDataNote(text);

    if (!hasAuthor) {
      result.errors.push({ file: file.relative, message: 'Indexable blog post missing author attribution (author card/meta/schema).' });
      result.stats.missingAuthor++;
      result.passed = false;
    }
    if (!hasDates) {
      result.errors.push({ file: file.relative, message: 'Indexable blog post missing publish/review date signals.' });
      result.stats.missingDates++;
      result.passed = false;
    }
    if (!hasSource) {
      result.errors.push({ file: file.relative, message: 'Indexable blog post missing methodology/source/data-note content.' });
      result.stats.missingSourceDataNote++;
      result.passed = false;
    }

    if (verbose && hasAuthor && hasDates && hasSource) {
      result.warnings.push({ file: file.relative, message: 'Blog quality signals present.' });
    }
  }

  return result;
}

module.exports = checkBlogContentQuality;
