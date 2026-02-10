/**
 * list-html-pages.mjs
 *
 * Recursively finds all .html files under the output directory
 * and computes route paths for each.
 */

import { readdirSync } from 'fs';
import { join, relative, posix } from 'path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', '.wrangler', '.lighthouseci',
  'seo-autopilot', 'playwright-report', 'test-results', 'screenshots',
  'ads-bot', 'ops', 'admin', 'audit', 'docs', 'media', 'output',
  'functions', 'scripts', 'src', 'tests', 'templates',
]);

const UTILITY_FILES = new Set(['404.html', '500.html']);

/**
 * Recursively collect .html files.
 */
function walk(dir, base, results) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip non-page directories when scanning from project root
      const rel = relative(base, full);
      const topLevel = rel.split('/')[0];
      if (SKIP_DIRS.has(topLevel)) continue;
      walk(full, base, results);
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
}

/**
 * Convert a file path to a route path.
 *
 * @param {string} filePath - Absolute path to the .html file
 * @param {string} outputDir - The output directory root
 * @param {string} strategy - "slash" or "no-slash"
 * @returns {string} Route path
 */
function toRoutePath(filePath, outputDir, strategy) {
  const rel = relative(outputDir, filePath);
  // Normalize to forward slashes
  const parts = rel.split(/[\\/]/);

  if (parts.length === 1) {
    // Root-level file: index.html -> "/", about.html -> "/about"
    const name = parts[0];
    if (name === 'index.html') return '/';
    const base = name.replace(/\.html$/, '');
    return strategy === 'slash' ? `/${base}/` : `/${base}`;
  }

  // Nested: about/index.html -> "/about/", about/team.html -> "/about/team"
  const last = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  const dirPath = '/' + dirParts.join('/');

  if (last === 'index.html') {
    return strategy === 'slash' ? `${dirPath}/` : dirPath;
  }

  const base = last.replace(/\.html$/, '');
  const full = `${dirPath}/${base}`;
  return strategy === 'slash' ? `${full}/` : full;
}

/**
 * List all HTML pages in the output directory.
 *
 * @param {string} outputDir - Directory to scan
 * @param {object} opts
 * @param {string} [opts.canonicalStrategy="slash"] - "slash" or "no-slash"
 * @returns {Array<{filePath: string, routePath: string, isUtility: boolean}>}
 */
export function listHtmlPages(outputDir, { canonicalStrategy = 'slash' } = {}) {
  const files = [];
  walk(outputDir, outputDir, files);

  return files.map((filePath) => {
    const rel = relative(outputDir, filePath);
    const fileName = rel.split(/[\\/]/).pop();
    const isUtility = UTILITY_FILES.has(fileName);
    const routePath = toRoutePath(filePath, outputDir, canonicalStrategy);

    return { filePath, routePath, isUtility };
  });
}
