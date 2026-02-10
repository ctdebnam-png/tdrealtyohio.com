/**
 * build-audit.mjs
 *
 * Scans all HTML pages in the build output and detects SEO issues.
 * Returns a structured report. Never throws.
 */

import { readFileSync } from 'fs';
import { parseHtml } from '../lib/parse-html.mjs';

// ── Asset path prefixes that are not page routes ──────────
const ASSET_PREFIXES = [
  '/assets/', '/images/', '/_next/', '/static/', '/fonts/',
  '/css/', '/js/', '/media/', '/favicon',
];

const DOWNLOAD_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.csv'];

/**
 * Normalize a link target to a route path for comparison.
 *
 * @param {string} href - Raw href value
 * @param {string} baseUrl - Site base URL
 * @param {string} strategy - "slash" or "no-slash"
 * @returns {string|null} Normalized route path or null if not an internal page link
 */
function normalizeTarget(href, baseUrl, strategy) {
  if (!href) return null;

  // Skip non-page links
  if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(href)) return null;
  if (href === '#' || href.startsWith('#')) return null;

  let path = href;

  // Strip base URL if present
  if (path.startsWith(baseUrl)) {
    path = path.slice(baseUrl.length);
    if (!path.startsWith('/')) path = '/' + path;
  }

  // Only process site-relative links
  if (!path.startsWith('/')) return null;

  // Strip query string and hash
  path = path.split('?')[0].split('#')[0];

  // Check if it's a download/asset
  const lower = path.toLowerCase();
  if (ASSET_PREFIXES.some((p) => lower.startsWith(p))) return null;
  if (DOWNLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    // Mark as download — will be validated if present in output
    return `__download__${path}`;
  }

  // Normalize trailing slash
  if (path === '/') return '/';
  if (strategy === 'slash') {
    if (!path.endsWith('/')) path = path + '/';
  } else {
    if (path.endsWith('/') && path !== '/') path = path.slice(0, -1);
  }

  return path;
}

/**
 * Run the build audit across all pages.
 *
 * @param {Array<{filePath: string, routePath: string, isUtility: boolean}>} pages
 * @param {object} config - Site config from site.json
 * @returns {object} Audit results
 */
export function runBuildAudit(pages, config) {
  const {
    baseUrl = '',
    canonicalStrategy = 'slash',
    utilityRoutesNoIndex = [],
  } = config;

  // Build route index for internal link checking
  const routeIndex = new Set(pages.map((p) => p.routePath));

  // Utility routes: config list + built-in utility pages
  const utilitySet = new Set([
    ...utilityRoutesNoIndex,
    '/404', '/404/', '/500', '/500/',
  ]);
  // Also tag pages flagged as isUtility
  for (const p of pages) {
    if (p.isUtility) {
      utilitySet.add(p.routePath);
    }
  }

  const results = [];
  const brokenLinks = [];

  for (const page of pages) {
    const pageResult = {
      routePath: page.routePath,
      filePath: page.filePath,
      issues: [],
      extracted: {},
    };

    let parsed;
    try {
      const html = readFileSync(page.filePath, 'utf-8');
      parsed = parseHtml(html);
    } catch (err) {
      pageResult.issues.push({
        code: 'PARSE_ERROR',
        detail: err.message,
      });
      results.push(pageResult);
      continue;
    }

    const {
      titleText,
      metaDescription,
      canonicals,
      h1Texts,
      langAttr,
      ogTags,
      twitterTags,
      robotsMeta,
      links,
      images,
    } = parsed;

    // Store extracted summary
    pageResult.extracted = {
      titleText,
      metaDescription,
      canonical: canonicals[0] || null,
      h1Count: h1Texts.length,
      langAttr,
      robotsMeta,
    };

    const issues = pageResult.issues;
    const isUtility = utilitySet.has(page.routePath);

    // ── Core tags ──────────────────────────────────────────
    if (!titleText) {
      issues.push({ code: 'MISSING_TITLE', detail: null });
    } else if (titleText.length < 20 || titleText.length > 70) {
      issues.push({ code: 'TITLE_LENGTH', detail: `length=${titleText.length}` });
    }

    if (!metaDescription) {
      issues.push({ code: 'MISSING_META_DESCRIPTION', detail: null });
    } else if (metaDescription.length < 70 || metaDescription.length > 160) {
      issues.push({
        code: 'META_DESCRIPTION_LENGTH',
        detail: `length=${metaDescription.length}`,
      });
    }

    if (canonicals.length === 0) {
      issues.push({ code: 'MISSING_CANONICAL', detail: null });
    } else {
      if (canonicals.length > 1) {
        issues.push({ code: 'MULTIPLE_CANONICAL', detail: `count=${canonicals.length}` });
      }
      const canonical = canonicals[0];
      if (!/^https?:\/\//.test(canonical)) {
        issues.push({ code: 'CANONICAL_NOT_ABSOLUTE', detail: canonical });
      } else if (baseUrl && !canonical.startsWith(baseUrl)) {
        issues.push({ code: 'CANONICAL_DOMAIN_MISMATCH', detail: canonical });
      } else if (baseUrl && canonical.startsWith(baseUrl)) {
        // Check trailing slash consistency
        const canonPath = canonical.slice(baseUrl.length) || '/';
        if (canonPath !== '/') {
          const wantsSlash = canonicalStrategy === 'slash';
          const hasSlash = canonPath.endsWith('/');
          if (wantsSlash !== hasSlash) {
            issues.push({
              code: 'CANONICAL_TRAILING_SLASH_MISMATCH',
              detail: `canonical="${canonical}" strategy="${canonicalStrategy}"`,
            });
          }
        }
      }
    }

    // ── Headings ───────────────────────────────────────────
    if (h1Texts.length === 0) {
      issues.push({ code: 'MISSING_H1', detail: null });
    } else {
      if (h1Texts.length > 1) {
        issues.push({ code: 'MULTIPLE_H1', detail: `count=${h1Texts.length}` });
      }
      for (const h1 of h1Texts) {
        if (!h1 || !h1.trim()) {
          issues.push({ code: 'EMPTY_H1', detail: null });
          break; // Report once
        }
      }
    }

    // ── HTML root ──────────────────────────────────────────
    if (!langAttr) {
      issues.push({ code: 'MISSING_LANG', detail: null });
    }

    // ── Social tags ────────────────────────────────────────
    const missingOg = [];
    if (!ogTags['og:title']) missingOg.push('og:title');
    if (!ogTags['og:description']) missingOg.push('og:description');
    if (!ogTags['og:url']) missingOg.push('og:url');
    if (missingOg.length > 0) {
      issues.push({ code: 'MISSING_OG', detail: missingOg.join(', ') });
    }
    if (ogTags['og:url'] && !/^https?:\/\//.test(ogTags['og:url'])) {
      issues.push({ code: 'OG_URL_NOT_ABSOLUTE', detail: ogTags['og:url'] });
    }

    const missingTwitter = [];
    if (!twitterTags['twitter:card']) missingTwitter.push('twitter:card');
    if (!twitterTags['twitter:title']) missingTwitter.push('twitter:title');
    if (!twitterTags['twitter:description']) missingTwitter.push('twitter:description');
    if (missingTwitter.length > 0) {
      issues.push({ code: 'MISSING_TWITTER', detail: missingTwitter.join(', ') });
    }

    // ── Robots meta ────────────────────────────────────────
    if (robotsMeta && /noindex/i.test(robotsMeta) && !isUtility) {
      issues.push({ code: 'NOINDEX_ON_RANK_PAGE', detail: robotsMeta });
    }

    // ── Internal broken links ──────────────────────────────
    for (const href of links) {
      const target = normalizeTarget(href, baseUrl, canonicalStrategy);
      if (!target) continue;

      // Skip downloads — just check they are internal
      if (target.startsWith('__download__')) continue;

      if (!routeIndex.has(target)) {
        issues.push({
          code: 'BROKEN_INTERNAL_LINK',
          detail: href,
        });
        brokenLinks.push({
          from: page.routePath,
          href,
          normalizedTarget: target,
        });
      }
    }

    // ── Images alt ─────────────────────────────────────────
    for (const img of images) {
      if (!img.src) continue;
      // Only check local images (not external or data URIs)
      if (!img.src.startsWith('/')) continue;
      if (ASSET_PREFIXES.some((p) => img.src.startsWith(p) && p.includes('_next'))) continue;

      if (img.alt === null || img.alt.trim() === '') {
        issues.push({ code: 'MISSING_IMAGE_ALT', detail: img.src });
      }
    }

    results.push(pageResult);
  }

  // ── Aggregate counts ─────────────────────────────────────
  const issueCounts = {};
  let issuesTotal = 0;
  for (const page of results) {
    for (const issue of page.issues) {
      issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
      issuesTotal++;
    }
  }

  // ── Worst pages ──────────────────────────────────────────
  const worstPages = [...results]
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 10)
    .map((p) => ({ routePath: p.routePath, issueCount: p.issues.length }));

  return {
    totals: {
      pagesScanned: pages.length,
      issuesTotal,
      issueCounts,
    },
    pages: results.map((p) => ({
      routePath: p.routePath,
      issues: p.issues,
    })),
    samples: {
      worstPages,
      brokenLinks: brokenLinks.slice(0, 50),
    },
  };
}

/**
 * Print a short console summary of audit results.
 */
export function printAuditSummary(audit) {
  const { totals, samples } = audit;

  console.log(`\n[build-audit] Pages scanned: ${totals.pagesScanned}`);
  console.log(`[build-audit] Total issues:  ${totals.issuesTotal}`);

  // Top 10 issue codes
  const sorted = Object.entries(totals.issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length > 0) {
    console.log('\n[build-audit] Top issue codes:');
    for (const [code, count] of sorted) {
      console.log(`  ${code}: ${count}`);
    }
  }

  // Top 5 worst pages
  const worst = samples.worstPages.slice(0, 5);
  if (worst.length > 0 && worst[0].issueCount > 0) {
    console.log('\n[build-audit] Worst pages:');
    for (const p of worst) {
      console.log(`  ${p.routePath} (${p.issueCount} issues)`);
    }
  }

  // Broken links
  const broken = samples.brokenLinks;
  if (broken.length > 0) {
    console.log(`\n[build-audit] Broken internal links (${broken.length} total, showing first 10):`);
    for (const link of broken.slice(0, 10)) {
      console.log(`  ${link.from} -> ${link.href} (resolved: ${link.normalizedTarget})`);
    }
  }

  console.log('');
}
