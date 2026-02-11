/**
 * perf.mjs
 *
 * Fast built-HTML performance auditor. Measures script/stylesheet counts,
 * inline sizes, blocking patterns, and font hints without running a browser.
 */

import { readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const PERF_CONFIG_PATH = join(__dirname, '..', 'config', 'perf.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Resolve a route path to its file path.
 */
function resolveFilePath(routePath) {
  const slug = routePath.replace(/^\/|\/$/g, '');
  if (!slug) return join(ROOT, 'index.html');
  return join(ROOT, slug, 'index.html');
}

/**
 * Count <script> tags (all types).
 */
function countScripts(html) {
  const matches = html.match(/<script\b[^>]*>/gi);
  return matches ? matches.filter(s => !s.includes('type="application/ld+json"')).length : 0;
}

/**
 * Count <link rel="stylesheet"> tags.
 */
function countStylesheets(html) {
  const matches = html.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi);
  return matches ? matches.length : 0;
}

/**
 * Compute total inline <style> bytes.
 */
function inlineCssBytes(html) {
  let total = 0;
  const regex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    total += Buffer.byteLength(match[1], 'utf-8');
  }
  return total;
}

/**
 * Compute total inline <script> bytes (exclude JSON-LD and external).
 */
function inlineJsBytes(html) {
  let total = 0;
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    // Skip JSON-LD
    if (attrs.includes('application/ld+json')) continue;
    // Skip external scripts (have src attribute)
    if (/\bsrc\s*=/i.test(attrs)) continue;
    total += Buffer.byteLength(match[2], 'utf-8');
  }
  return total;
}

/**
 * Find scripts in <head> without defer/async (blocking).
 */
function findHeadBlockingScripts(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return [];

  const head = headMatch[1];
  const blocking = [];
  const regex = /<script\b([^>]*)>/gi;
  let match;
  while ((match = regex.exec(head)) !== null) {
    const attrs = match[1];
    // Skip JSON-LD
    if (attrs.includes('application/ld+json')) continue;
    // External script without defer/async
    if (/\bsrc\s*=/i.test(attrs)) {
      if (!/\bdefer\b/i.test(attrs) && !/\basync\b/i.test(attrs)) {
        const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']*)["']/i);
        blocking.push(srcMatch ? srcMatch[1] : 'unknown');
      }
    }
    // Inline scripts in head are inherently blocking but expected (analytics, etc.)
  }
  return blocking;
}

/**
 * Count font-related hints and requests.
 */
function countFontHints(html) {
  const hints = {
    preconnectFonts: 0,
    fontStylesheets: 0,
    preloadFonts: 0,
  };

  // Preconnect to font origins
  const preconnects = html.match(/<link\b[^>]*rel=["']preconnect["'][^>]*>/gi) || [];
  for (const pc of preconnects) {
    if (pc.includes('fonts.googleapis.com') || pc.includes('fonts.gstatic.com')) {
      hints.preconnectFonts++;
    }
  }

  // Font stylesheets (Google Fonts, etc.)
  const stylesheets = html.match(/<link\b[^>]*href=["'][^"']*fonts[^"']*["'][^>]*>/gi) || [];
  hints.fontStylesheets = stylesheets.length;

  // Preload fonts
  const preloads = html.match(/<link\b[^>]*rel=["']preload["'][^>]*as=["']font["'][^>]*>/gi) || [];
  hints.preloadFonts = preloads.length;

  return hints;
}

/**
 * Audit performance of built HTML on configured routes.
 *
 * @param {object} [options]
 * @returns {{
 *   checkedAt: string,
 *   perRoute: object[],
 *   issueCounts: object,
 *   issues: object[]
 * }}
 */
export function auditPerf(options = {}) {
  const config = loadJson(PERF_CONFIG_PATH, { routes: [], budgets: {} });
  const routes = config.routes || [];
  const budgets = config.budgets || {};

  const issueCounts = {
    PERF_HTML_OVER_BUDGET: 0,
    PERF_HEAD_BLOCKING_SCRIPT: 0,
    PERF_TOO_MANY_SCRIPTS: 0,
    PERF_TOO_MANY_FONTS: 0,
    PERF_INLINE_JS_OVER_BUDGET: 0,
    PERF_INLINE_CSS_OVER_BUDGET: 0,
  };

  const issues = [];
  const perRoute = [];

  for (const route of routes) {
    const filePath = resolveFilePath(route);
    let html;
    try {
      html = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const htmlBytes = Buffer.byteLength(html, 'utf-8');
    const scripts = countScripts(html);
    const stylesheets = countStylesheets(html);
    const inlineCss = inlineCssBytes(html);
    const inlineJs = inlineJsBytes(html);
    const headBlocking = findHeadBlockingScripts(html);
    const fontHints = countFontHints(html);
    const totalFontRequests = fontHints.fontStylesheets + fontHints.preloadFonts;

    const routeData = {
      route,
      htmlBytes,
      scripts,
      stylesheets,
      inlineCssBytes: inlineCss,
      inlineJsBytes: inlineJs,
      headBlockingScripts: headBlocking.length,
      fontHints,
    };
    perRoute.push(routeData);

    // Check budgets
    if (budgets.maxHtmlBytes && htmlBytes > budgets.maxHtmlBytes) {
      issueCounts.PERF_HTML_OVER_BUDGET++;
      issues.push({ route, code: 'PERF_HTML_OVER_BUDGET', value: htmlBytes, budget: budgets.maxHtmlBytes });
    }

    if (headBlocking.length > 0) {
      issueCounts.PERF_HEAD_BLOCKING_SCRIPT++;
      issues.push({ route, code: 'PERF_HEAD_BLOCKING_SCRIPT', scripts: headBlocking });
    }

    if (budgets.maxScriptsCount && scripts > budgets.maxScriptsCount) {
      issueCounts.PERF_TOO_MANY_SCRIPTS++;
      issues.push({ route, code: 'PERF_TOO_MANY_SCRIPTS', value: scripts, budget: budgets.maxScriptsCount });
    }

    if (budgets.maxFontRequests && totalFontRequests > budgets.maxFontRequests) {
      issueCounts.PERF_TOO_MANY_FONTS++;
      issues.push({ route, code: 'PERF_TOO_MANY_FONTS', value: totalFontRequests, budget: budgets.maxFontRequests });
    }

    if (budgets.maxInlineJsBytes && inlineJs > budgets.maxInlineJsBytes) {
      issueCounts.PERF_INLINE_JS_OVER_BUDGET++;
      issues.push({ route, code: 'PERF_INLINE_JS_OVER_BUDGET', value: inlineJs, budget: budgets.maxInlineJsBytes });
    }

    if (budgets.maxInlineCssBytes && inlineCss > budgets.maxInlineCssBytes) {
      issueCounts.PERF_INLINE_CSS_OVER_BUDGET++;
      issues.push({ route, code: 'PERF_INLINE_CSS_OVER_BUDGET', value: inlineCss, budget: budgets.maxInlineCssBytes });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    perRoute,
    issueCounts,
    issues,
  };
}
