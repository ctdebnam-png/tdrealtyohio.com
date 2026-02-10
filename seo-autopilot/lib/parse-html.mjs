/**
 * parse-html.mjs
 *
 * Parses an HTML string with cheerio and extracts SEO-relevant signals.
 */

import { load } from 'cheerio';

/**
 * Parse HTML and return SEO signals.
 *
 * @param {string} html - Raw HTML string
 * @returns {object} Extracted SEO data
 */
export function parseHtml(html) {
  const $ = load(html);

  // Title
  const titleText = $('title').first().text().trim() || null;

  // Meta description
  const metaDesc = $('meta[name="description"]').attr('content');
  const metaDescription = metaDesc?.trim() || null;

  // Canonicals
  const canonicals = [];
  $('link[rel="canonical"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) canonicals.push(href.trim());
  });

  // H1 tags
  const h1Texts = [];
  $('h1').each((_, el) => {
    h1Texts.push($(el).text().trim());
  });

  // Lang attribute
  const langAttr = $('html').attr('lang')?.trim() || null;

  // Open Graph tags
  const ogTags = {};
  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr('property');
    const content = $(el).attr('content');
    if (property && content !== undefined) {
      ogTags[property] = content;
    }
  });

  // Twitter tags
  const twitterTags = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content !== undefined) {
      twitterTags[name] = content;
    }
  });

  // Robots meta
  const robotsContent = $('meta[name="robots"]').attr('content');
  const robotsMeta = robotsContent?.trim() || null;

  // Links (all <a> hrefs)
  const links = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) links.push(href);
  });

  // Images
  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || null;
    const alt = $(el).attr('alt');
    images.push({ src, alt: alt !== undefined ? alt : null });
  });

  return {
    titleText,
    metaDescription,
    canonicals,
    h1Texts,
    langAttr,
    ogTags,
    twitterTags,
    robotsMeta,
    links,
    images,
  };
}
