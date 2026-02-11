/**
 * image-lazy.mjs
 *
 * Ensures below-fold images have loading="lazy" and
 * above-fold images do not. Uses heuristics based on
 * position in HTML structure (footer, after main content).
 */

import { readFileSync, writeFileSync } from 'fs';

/**
 * Add loading="lazy" to below-fold images that lack it.
 *
 * @param {object[]} pages - Array of { filePath, routePath }
 * @param {object} [options]
 * @param {number} [options.maxPagesToFix=100]
 * @returns {{ filesChanged: number, tagsFixed: number, details: object[] }}
 */
export function fixImageLazy(pages = [], options = {}) {
  const maxFix = options.maxPagesToFix || 100;

  let filesChanged = 0;
  let tagsFixed = 0;
  const details = [];
  const sampled = pages.slice(0, maxFix);

  for (const page of sampled) {
    let html;
    try {
      html = readFileSync(page.filePath, 'utf-8');
    } catch {
      continue;
    }

    let modified = false;
    let pageFixCount = 0;

    const footerIdx = html.indexOf('<footer');

    const result = html.replace(/<img\b([^>]*)>/gi, (fullMatch, attrs, offset) => {
      // Skip if already has loading attribute
      if (/\bloading\s*=/i.test(attrs)) return fullMatch;

      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']*)["']/i);
      if (!srcMatch) return fullMatch;
      const src = srcMatch[1];

      // Determine if below fold: in footer, compliance images, or far down in document
      const isBelowFold = isBelowFoldHeuristic(src, offset, footerIdx, html);

      if (isBelowFold) {
        modified = true;
        pageFixCount++;
        return `<img loading="lazy" ${attrs}>`;
      }

      return fullMatch;
    });

    if (modified) {
      writeFileSync(page.filePath, result, 'utf-8');
      filesChanged++;
      tagsFixed += pageFixCount;
      details.push({ routePath: page.routePath, fixes: pageFixCount });
    }
  }

  return { filesChanged, tagsFixed, details: details.slice(0, 20) };
}

/**
 * Heuristic: is this image likely below the fold?
 */
function isBelowFoldHeuristic(src, offset, footerIdx, html) {
  // Compliance/media images are always below fold
  if (src.includes('compliance/') || src.includes('media/')) return true;

  // If there's a footer and the image appears after it
  if (footerIdx > -1 && offset > footerIdx) return true;

  // Images in the bottom 30% of the HTML are likely below fold
  if (offset > html.length * 0.7) return true;

  return false;
}
