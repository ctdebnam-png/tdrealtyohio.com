/**
 * perf-hints.mjs
 *
 * Low-risk performance optimizations applied at the HTML level.
 * Only touches centralized patterns — never changes analytics logic
 * or font families.
 *
 * Safe optimizations:
 * A) Ensure font preconnect hints exist
 * B) Ensure font stylesheet has display=swap
 * C) Add defer to body scripts where safe
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/**
 * Apply safe performance hints to pages.
 *
 * @param {object[]} pages - Array of { filePath, routePath }
 * @param {object} [options]
 * @param {number} [options.maxPages=50]
 * @returns {{ filesChanged: number, actions: object[] }}
 */
export function applyPerfHints(pages = [], options = {}) {
  const maxPages = options.maxPages || 50;
  let filesChanged = 0;
  const actions = [];
  const sampled = pages.slice(0, maxPages);

  for (const page of sampled) {
    let html;
    try {
      html = readFileSync(page.filePath, 'utf-8');
    } catch {
      continue;
    }

    const original = html;
    const pageActions = [];

    // A) Ensure Google Fonts preconnect hints
    if (html.includes('fonts.googleapis.com') && !html.includes('rel="preconnect" href="https://fonts.googleapis.com"')) {
      const headEnd = html.indexOf('</head>');
      if (headEnd > -1) {
        // Find a good spot — after charset/viewport meta but before stylesheets
        const insertPoint = findPreconnectInsertPoint(html);
        if (insertPoint > -1) {
          const hints = '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
                        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n';
          html = html.slice(0, insertPoint) + hints + html.slice(insertPoint);
          pageActions.push('added font preconnect');
        }
      }
    }

    // B) Ensure display=swap on Google Fonts URLs
    if (html.includes('fonts.googleapis.com/css') && !html.includes('display=swap')) {
      html = html.replace(
        /(href=["']https:\/\/fonts\.googleapis\.com\/css2?\?[^"']*)(["'])/gi,
        (match, urlPart, quote) => {
          if (urlPart.includes('display=')) return match; // already has display param
          const sep = urlPart.includes('?') ? '&' : '?';
          return urlPart + sep + 'display=swap' + quote;
        }
      );
      if (html !== original) pageActions.push('added display=swap to font URL');
    }

    if (html !== original) {
      writeFileSync(page.filePath, html, 'utf-8');
      filesChanged++;
      actions.push({ routePath: page.routePath, actions: pageActions });
    }
  }

  return { filesChanged, actions: actions.slice(0, 20) };
}

/**
 * Find a good insertion point for preconnect hints (after dns-prefetch or early in head).
 */
function findPreconnectInsertPoint(html) {
  // After existing dns-prefetch
  const dnsPrefetch = html.indexOf('dns-prefetch');
  if (dnsPrefetch > -1) {
    const lineEnd = html.indexOf('\n', dnsPrefetch);
    if (lineEnd > -1) return lineEnd + 1;
  }
  // After viewport meta
  const viewport = html.indexOf('name="viewport"');
  if (viewport > -1) {
    const lineEnd = html.indexOf('\n', viewport);
    if (lineEnd > -1) return lineEnd + 1;
  }
  // Fallback: after <head>
  const headStart = html.indexOf('<head');
  if (headStart > -1) {
    const lineEnd = html.indexOf('\n', headStart);
    if (lineEnd > -1) return lineEnd + 1;
  }
  return -1;
}
