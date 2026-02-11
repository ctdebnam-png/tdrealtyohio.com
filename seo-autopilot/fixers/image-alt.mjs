/**
 * image-alt.mjs
 *
 * Fixes missing or empty alt text on <img> tags using the
 * canonical alt-text-map.json config. Only updates images
 * that have a known mapping — never invents alt text.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALT_TEXT_MAP_PATH = join(__dirname, '..', 'config', 'alt-text-map.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Fix alt text on images using the canonical map.
 *
 * @param {object[]} pages - Array of { filePath, routePath }
 * @param {object} [options]
 * @param {number} [options.maxPagesToFix=100]
 * @returns {{ filesChanged: number, tagsFixed: number, details: object[] }}
 */
export function fixImageAlt(pages = [], options = {}) {
  const maxFix = options.maxPagesToFix || 100;
  const altMap = loadJson(ALT_TEXT_MAP_PATH, { images: {} });
  const imageMap = altMap.images || {};

  if (Object.keys(imageMap).length === 0) {
    return { filesChanged: 0, tagsFixed: 0, details: [] };
  }

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

    // Process each <img> tag
    const result = html.replace(/<img\b([^>]*)>/gi, (fullMatch, attrs) => {
      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']*)["']/i);
      if (!srcMatch) return fullMatch;
      const src = srcMatch[1];

      // Normalize src for map lookup (strip query params, leading slash)
      const normalizedSrc = src.replace(/\?.*$/, '');
      const canonicalAlt = imageMap[normalizedSrc];
      if (!canonicalAlt) return fullMatch;

      // Check if alt is missing or empty
      const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
      const hasAlt = /\balt\s*=/i.test(attrs);

      if (!hasAlt) {
        // Add alt attribute
        modified = true;
        pageFixCount++;
        return `<img alt="${escapeAttr(canonicalAlt)}" ${attrs}>`;
      } else if (altMatch && altMatch[1].trim() === '') {
        // Replace empty alt
        modified = true;
        pageFixCount++;
        const newAttrs = attrs.replace(/\balt\s*=\s*["'][^"']*["']/i, `alt="${escapeAttr(canonicalAlt)}"`);
        return `<img${newAttrs}>`;
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

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
