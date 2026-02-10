/**
 * url-normalize.mjs
 *
 * URL normalization utilities for canonical URLs.
 */

// File extensions that should not get a trailing slash
const FILE_EXTENSIONS = /\.(html|xml|json|pdf|txt|css|js|jpg|jpeg|png|gif|svg|ico|webp|woff2?)$/i;

/**
 * Normalize a path according to the canonical strategy.
 *
 * @param {string} path - URL path (e.g., "/about" or "/about/")
 * @param {string} strategy - "slash" or "no-slash"
 * @returns {string} Normalized path
 */
export function normalizePath(path, strategy = 'slash') {
  if (!path) return '/';

  // Strip query string and hash
  let clean = path.split('?')[0].split('#')[0];

  // Ensure leading slash
  if (!clean.startsWith('/')) clean = '/' + clean;

  // Root is always "/"
  if (clean === '/' || clean === '') return '/';

  // Don't modify file paths
  if (FILE_EXTENSIONS.test(clean)) return clean;

  // Apply trailing slash strategy
  if (strategy === 'slash') {
    if (!clean.endsWith('/')) clean = clean + '/';
  } else {
    if (clean.endsWith('/') && clean.length > 1) {
      clean = clean.slice(0, -1);
    }
  }

  return clean;
}

/**
 * Convert a path to an absolute URL.
 *
 * @param {string} baseUrl - Site base URL (e.g., "https://example.com")
 * @param {string} path - URL path
 * @returns {string} Absolute URL
 */
export function toAbsoluteUrl(baseUrl, path) {
  const base = baseUrl.replace(/\/+$/, '');
  const normalized = path.startsWith('/') ? path : '/' + path;
  return base + normalized;
}

/**
 * Normalize a URL to its canonical form.
 *
 * @param {string} url - Full URL or path
 * @param {string} baseUrl - Site base URL
 * @param {string} strategy - "slash" or "no-slash"
 * @returns {string} Normalized absolute URL
 */
export function normalizeAbsoluteUrl(url, baseUrl, strategy = 'slash') {
  const base = baseUrl.replace(/\/+$/, '');

  let path;
  if (url.startsWith(base)) {
    path = url.slice(base.length) || '/';
  } else if (url.startsWith('/')) {
    path = url;
  } else {
    // External or relative — return as-is
    return url;
  }

  return toAbsoluteUrl(base, normalizePath(path, strategy));
}
