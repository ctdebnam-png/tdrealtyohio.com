/**
 * og-image.mjs
 *
 * Ensures og:image and twitter:image meta tags are present
 * and consistent on all pages. Uses the default OG image
 * from seo-defaults.json as fallback.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEO_DEFAULTS_PATH = join(__dirname, '..', 'config', 'seo-defaults.json');
const SITE_CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Ensure og:image is present and uses absolute URL.
 *
 * @param {object[]} pages - Array of { filePath, routePath }
 * @param {object} [options]
 * @param {number} [options.maxPagesToFix=100]
 * @returns {{ filesChanged: number, tagsFixed: number, details: object[] }}
 */
export function fixOgImage(pages = [], options = {}) {
  const maxFix = options.maxPagesToFix || 100;
  const seoDefaults = loadJson(SEO_DEFAULTS_PATH, {});
  const siteConfig = loadJson(SITE_CONFIG_PATH, {});
  const baseUrl = (siteConfig.baseUrl || 'https://tdrealtyohio.com').replace(/\/$/, '');
  const defaultOgPath = seoDefaults.defaultOgImagePath || '/assets/images/og-default.jpg';
  const absoluteOgUrl = `${baseUrl}${defaultOgPath}`;

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
    let pageActions = [];

    // Check og:image
    const hasOgImage = /<meta\s+[^>]*property=["']og:image["'][^>]*>/i.test(html);

    if (!hasOgImage) {
      // Find insertion point: after last <meta> in <head>, or before </head>
      const insertPoint = findMetaInsertPoint(html);
      if (insertPoint > -1) {
        const ogTag = `  <meta property="og:image" content="${absoluteOgUrl}">\n`;
        html = html.slice(0, insertPoint) + ogTag + html.slice(insertPoint);
        modified = true;
        pageActions.push('added og:image');
      }
    } else {
      // Ensure og:image uses absolute URL
      const ogMatch = html.match(/<meta\s+[^>]*property=["']og:image["']\s+content=["']([^"']*)["'][^>]*>/i)
        || html.match(/<meta\s+[^>]*content=["']([^"']*)["']\s+[^>]*property=["']og:image["'][^>]*>/i);
      if (ogMatch && ogMatch[1] && !ogMatch[1].startsWith('http')) {
        const relPath = ogMatch[1];
        const absUrl = `${baseUrl}${relPath.startsWith('/') ? '' : '/'}${relPath}`;
        html = html.replace(ogMatch[0], ogMatch[0].replace(ogMatch[1], absUrl));
        modified = true;
        pageActions.push('absolutized og:image');
      }
    }

    // Check twitter:image
    const hasTwitterImage = /<meta\s+[^>]*(?:name|property)=["']twitter:image["'][^>]*>/i.test(html);
    if (!hasTwitterImage && hasOgImage) {
      // Add twitter:image matching og:image
      const ogContentMatch = html.match(/<meta\s+[^>]*property=["']og:image["']\s+content=["']([^"']*)["']/i)
        || html.match(/<meta\s+[^>]*content=["']([^"']*)["']\s+[^>]*property=["']og:image["']/i);
      if (ogContentMatch) {
        const insertPoint = findMetaInsertPoint(html);
        if (insertPoint > -1) {
          const twitterTag = `  <meta name="twitter:image" content="${ogContentMatch[1]}">\n`;
          html = html.slice(0, insertPoint) + twitterTag + html.slice(insertPoint);
          modified = true;
          pageActions.push('added twitter:image');
        }
      }
    }

    if (modified) {
      writeFileSync(page.filePath, html, 'utf-8');
      filesChanged++;
      tagsFixed += pageActions.length;
      details.push({ routePath: page.routePath, actions: pageActions });
    }
  }

  return { filesChanged, tagsFixed, details: details.slice(0, 20) };
}

/**
 * Find a good insertion point for meta tags (before </head>).
 */
function findMetaInsertPoint(html) {
  const headEnd = html.indexOf('</head>');
  if (headEnd === -1) return -1;
  return headEnd;
}
