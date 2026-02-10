/**
 * extract-visible-text.mjs
 *
 * Extracts visible text content from HTML, removing scripts, styles,
 * navigation, and footer boilerplate. Used for word count analysis
 * and duplicate detection — not for modifying files.
 */

import { load as cheerioLoad } from 'cheerio';

/**
 * Extract visible text from an HTML string.
 *
 * @param {string} html - Full HTML content
 * @returns {string} Cleaned text with collapsed whitespace
 */
export function extractVisibleText(html) {
  if (!html) return '';

  const $ = cheerioLoad(html);

  // Remove non-content elements
  $('script').remove();
  $('style').remove();
  $('noscript').remove();
  $('header').remove();
  $('nav').remove();
  $('footer').remove();
  $('[aria-hidden="true"]').remove();
  $('.skip-link').remove();
  $('.breadcrumb').remove();
  $('svg').remove();

  // Get text from remaining elements
  const text = $('body').text() || $.text() || '';

  // Collapse whitespace
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Count words in an HTML string after extracting visible text.
 *
 * @param {string} html - Full HTML content
 * @returns {number} Word count
 */
export function countWords(html) {
  const text = extractVisibleText(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
