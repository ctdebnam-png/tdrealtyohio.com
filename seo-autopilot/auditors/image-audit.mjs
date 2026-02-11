/**
 * image-audit.mjs
 *
 * Comprehensive image SEO audit for built HTML pages.
 * Checks: alt text, width/height, loading attribute, og:image.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

const ALT_TEXT_MAP_PATH = join(__dirname, '..', 'config', 'alt-text-map.json');
const SEO_DEFAULTS_PATH = join(__dirname, '..', 'config', 'seo-defaults.json');

/**
 * Extract <img> tags from HTML.
 * Returns array of { src, alt, loading, width, height, lineApprox }.
 */
function extractImgTags(html) {
  const imgs = [];
  const regex = /<img\b([^>]*)>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    imgs.push({
      src: getAttr(attrs, 'src'),
      alt: getAttr(attrs, 'alt'),
      hasAlt: /\balt\s*=/i.test(attrs),
      loading: getAttr(attrs, 'loading'),
      width: getAttr(attrs, 'width'),
      height: getAttr(attrs, 'height'),
    });
  }
  return imgs;
}

/**
 * Extract og:image from meta tags.
 */
function extractOgImage(html) {
  const match = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*>/i);
  if (!match) return null;
  const content = getAttr(match[0].replace(/<meta\s+/, ''), 'content');
  return content || null;
}

/**
 * Extract twitter:image from meta tags.
 */
function extractTwitterImage(html) {
  const match = html.match(/<meta\s+[^>]*(?:name|property)=["']twitter:image["'][^>]*>/i);
  if (!match) return null;
  const content = getAttr(match[0].replace(/<meta\s+/, ''), 'content');
  return content || null;
}

function getAttr(attrStr, name) {
  const regex = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i');
  const m = attrStr.match(regex);
  return m ? m[1] : null;
}

/**
 * Check if a local image file exists and get its size.
 */
function checkLocalImage(src) {
  if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('//')) {
    return { exists: null, size: null }; // external or data URI
  }
  const filePath = join(ROOT, src.startsWith('/') ? src.slice(1) : src);
  try {
    const stat = statSync(filePath);
    return { exists: true, size: stat.size };
  } catch {
    return { exists: false, size: null };
  }
}

/**
 * Audit images across all pages.
 *
 * @param {object[]} pages - Array of { filePath, routePath }
 * @param {object} [options]
 * @param {number} [options.maxPagesToCheck=100] - Cap for performance
 * @param {number} [options.oversizedThresholdKB=500] - Image size threshold in KB
 * @returns {{
 *   pagesChecked: number,
 *   issueCounts: object,
 *   issues: object[],
 *   oversizedImages: object[],
 *   ogImageIssues: object[],
 *   summary: object
 * }}
 */
export function auditImages(pages = [], options = {}) {
  const maxCheck = options.maxPagesToCheck || 100;
  const oversizedKB = options.oversizedThresholdKB || 500;
  const altTextMap = loadJson(ALT_TEXT_MAP_PATH, { images: {} });
  const seoDefaults = loadJson(SEO_DEFAULTS_PATH, {});
  const defaultOgImage = seoDefaults.defaultOgImagePath || '/assets/images/og-default.jpg';

  const issueCounts = {
    MISSING_ALT: 0,
    EMPTY_ALT: 0,
    MISSING_DIMENSIONS: 0,
    MISSING_LAZY_LOADING: 0,
    ABOVE_FOLD_LAZY: 0,
    MISSING_OG_IMAGE: 0,
    OG_IMAGE_NOT_FOUND: 0,
    OG_TWITTER_MISMATCH: 0,
    OVERSIZED_IMAGE: 0,
  };

  const issues = [];
  const oversizedImages = [];
  const ogImageIssues = [];
  const checkedImageFiles = new Map(); // path -> size

  const sampled = pages.slice(0, maxCheck);

  for (const page of sampled) {
    let html;
    try {
      html = readFileSync(page.filePath, 'utf-8');
    } catch {
      continue;
    }

    const imgs = extractImgTags(html);
    const ogImage = extractOgImage(html);
    const twitterImage = extractTwitterImage(html);

    // Check each <img> tag
    for (const img of imgs) {
      if (!img.src) continue;

      // Alt text check
      if (!img.hasAlt) {
        issueCounts.MISSING_ALT++;
        issues.push({
          routePath: page.routePath,
          code: 'MISSING_ALT',
          src: img.src,
        });
      } else if (img.alt !== null && img.alt.trim() === '' && !isDecorativeImage(img.src)) {
        // Empty alt on non-decorative image
        issueCounts.EMPTY_ALT++;
        issues.push({
          routePath: page.routePath,
          code: 'EMPTY_ALT',
          src: img.src,
        });
      }

      // Width/height check (skip SVG — they scale)
      if (!img.src.endsWith('.svg') && (!img.width || !img.height)) {
        issueCounts.MISSING_DIMENSIONS++;
        issues.push({
          routePath: page.routePath,
          code: 'MISSING_DIMENSIONS',
          src: img.src,
        });
      }

      // Lazy loading check — footer images should be lazy
      if (!img.loading && isLikellyBelowFold(img.src, html)) {
        issueCounts.MISSING_LAZY_LOADING++;
        issues.push({
          routePath: page.routePath,
          code: 'MISSING_LAZY_LOADING',
          src: img.src,
        });
      }

      // Check for file size if local
      if (!img.src.startsWith('http') && !img.src.startsWith('data:') && !img.src.startsWith('//')) {
        const check = checkLocalImage(img.src);
        if (check.exists && check.size) {
          checkedImageFiles.set(img.src, check.size);
          if (check.size > oversizedKB * 1024) {
            issueCounts.OVERSIZED_IMAGE++;
            oversizedImages.push({
              routePath: page.routePath,
              src: img.src,
              sizeKB: Math.round(check.size / 1024),
              thresholdKB: oversizedKB,
            });
          }
        }
      }
    }

    // OG image checks
    if (!ogImage) {
      issueCounts.MISSING_OG_IMAGE++;
      ogImageIssues.push({
        routePath: page.routePath,
        code: 'MISSING_OG_IMAGE',
      });
    } else {
      // Check og:image file exists locally
      const ogPath = ogImage.startsWith('http')
        ? ogImage.replace(/^https?:\/\/[^/]+/, '')
        : ogImage;
      const fileCheck = checkLocalImage(ogPath);
      if (fileCheck.exists === false) {
        issueCounts.OG_IMAGE_NOT_FOUND++;
        ogImageIssues.push({
          routePath: page.routePath,
          code: 'OG_IMAGE_NOT_FOUND',
          ogImage,
        });
      }
    }

    // OG/Twitter image consistency
    if (ogImage && twitterImage && ogImage !== twitterImage) {
      issueCounts.OG_TWITTER_MISMATCH++;
      ogImageIssues.push({
        routePath: page.routePath,
        code: 'OG_TWITTER_MISMATCH',
        ogImage,
        twitterImage,
      });
    }
  }

  const totalIssues = Object.values(issueCounts).reduce((a, b) => a + b, 0);

  return {
    pagesChecked: sampled.length,
    issueCounts,
    issues: issues.slice(0, 50),
    oversizedImages: oversizedImages.slice(0, 20),
    ogImageIssues: ogImageIssues.slice(0, 20),
    summary: {
      totalIssues,
      uniqueImageFiles: checkedImageFiles.size,
    },
  };
}

/**
 * Heuristic: is this image purely decorative?
 * (compliance logos with known alt, spacers, etc.)
 */
function isDecorativeImage(src) {
  if (!src) return false;
  // 1x1 spacer images
  if (src.includes('spacer') || src.includes('pixel')) return true;
  return false;
}

/**
 * Heuristic: is this image likely below the fold?
 * Footer images, compliance logos are below fold.
 */
function isLikellyBelowFold(src, html) {
  if (!src) return false;
  // Compliance/footer logos
  if (src.includes('compliance/') || src.includes('media/')) return true;
  // If image appears in footer section
  const footerIdx = html.indexOf('<footer');
  if (footerIdx > -1) {
    const imgIdx = html.indexOf(src);
    if (imgIdx > footerIdx) return true;
  }
  return false;
}
