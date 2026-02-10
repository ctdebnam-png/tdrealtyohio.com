/**
 * detect-build-output.mjs
 *
 * Determines where the built HTML output lives.
 * Returns { outputDir, mode, reason }.
 */

import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Count .html files recursively (shallow limit to avoid huge scans).
 */
function countHtml(dir, depth = 0, max = 3) {
  if (depth > max) return 0;
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countHtml(full, depth + 1, max);
      } else if (entry.name.endsWith('.html')) {
        count++;
      }
    }
  } catch { /* permission or read error — ignore */ }
  return count;
}

/**
 * Detect the build output directory for a project.
 *
 * @param {string} rootDir - Project root directory
 * @returns {{ outputDir: string, mode: string, reason: string }}
 */
export function detectBuildOutput(rootDir) {
  // Priority candidates for framework output directories
  const candidates = ['dist', 'build', 'out', 'public', '.next'];

  // Check if root itself has index.html (static site pattern)
  const rootIndex = join(rootDir, 'index.html');
  const rootHasIndex = existsSync(rootIndex);

  // Check framework output dirs
  const found = [];
  for (const dir of candidates) {
    const full = join(rootDir, dir);
    if (!existsSync(full) || !statSync(full).isDirectory()) continue;

    const hasIndex = existsSync(join(full, 'index.html'));
    const htmlCount = countHtml(full);

    if (dir === '.next') {
      // Next.js SSR — only treat as static if out/ exists
      const outDir = join(rootDir, 'out');
      if (existsSync(outDir) && statSync(outDir).isDirectory()) {
        found.push({ dir: outDir, hasIndex: existsSync(join(outDir, 'index.html')), htmlCount: countHtml(outDir), name: 'out' });
      } else {
        return {
          outputDir: full,
          mode: 'ssr-unknown',
          reason: '.next directory found but no out/ for static export',
        };
      }
      continue;
    }

    if (htmlCount > 0) {
      found.push({ dir: full, hasIndex, htmlCount, name: dir });
    }
  }

  // Pick best candidate: prefer one with index.html and most .html files
  if (found.length > 0) {
    found.sort((a, b) => {
      if (a.hasIndex !== b.hasIndex) return a.hasIndex ? -1 : 1;
      return b.htmlCount - a.htmlCount;
    });
    const best = found[0];
    return {
      outputDir: best.dir,
      mode: 'static-html',
      reason: `Found ${best.htmlCount} HTML file(s) in ${best.name}/`,
    };
  }

  // Fallback: if root has index.html with significant HTML content, treat root as output
  if (rootHasIndex) {
    const rootHtmlCount = countHtml(rootDir);
    if (rootHtmlCount > 0) {
      return {
        outputDir: rootDir,
        mode: 'static-html',
        reason: `No framework output dir; root contains ${rootHtmlCount} HTML file(s) (static site)`,
      };
    }
  }

  return {
    outputDir: rootDir,
    mode: 'unknown',
    reason: 'Could not determine build output directory',
  };
}
