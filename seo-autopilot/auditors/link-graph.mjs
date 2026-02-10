/**
 * link-graph.mjs
 *
 * Constructs an internal link graph from built HTML output.
 * Computes in-degree, out-degree, orphan pages, and underlinked rank-intent pages.
 */

import { readFileSync } from 'fs';
import { parseHtml } from '../lib/parse-html.mjs';
import { normalizePath } from '../lib/url-normalize.mjs';

/**
 * Normalize a link href to a route path for graph construction.
 * Returns null for non-internal or non-page links.
 */
function normalizeHref(href, baseUrl, strategy) {
  if (!href) return null;
  if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(href)) return null;
  if (href === '#' || href.startsWith('#')) return null;

  let path = href;

  // Strip baseUrl prefix
  if (baseUrl && path.startsWith(baseUrl)) {
    path = path.slice(baseUrl.length);
    if (!path.startsWith('/')) path = '/' + path;
  }

  // Only process site-relative links
  if (!path.startsWith('/')) return null;

  // Strip query and hash
  path = path.split('?')[0].split('#')[0];

  // Skip asset paths
  const lower = path.toLowerCase();
  const assetPrefixes = ['/assets/', '/images/', '/_next/', '/static/', '/fonts/', '/css/', '/js/', '/media/', '/favicon'];
  if (assetPrefixes.some(p => lower.startsWith(p))) return null;

  // Skip file downloads
  if (/\.(pdf|doc|docx|xls|xlsx|zip|csv)$/i.test(path)) return null;

  return normalizePath(path, strategy);
}

/**
 * Build the internal link graph.
 *
 * @param {Array<{filePath: string, routePath: string, isUtility: boolean}>} pages
 * @param {object} config - Site config with baseUrl, canonicalStrategy, rankIntentRoutes, utilityRoutesNoIndex
 * @returns {object} Link graph data
 */
export function buildLinkGraph(pages, config) {
  const { baseUrl = '', canonicalStrategy = 'slash', rankIntentRoutes = [], utilityRoutesNoIndex = [] } = config;

  const routeIndex = new Set(pages.map(p => p.routePath));
  const utilitySet = new Set([...utilityRoutesNoIndex, '/404/', '/500/']);
  for (const p of pages) {
    if (p.isUtility) utilitySet.add(p.routePath);
  }

  // Graph structures
  const inDegree = {};   // target -> count
  const outDegree = {};  // source -> count
  const edges = [];      // { from, to }
  const brokenEdges = []; // { from, href, normalizedTarget }

  // Initialize degrees
  for (const p of pages) {
    inDegree[p.routePath] = 0;
    outDegree[p.routePath] = 0;
  }

  for (const page of pages) {
    let parsed;
    try {
      const html = readFileSync(page.filePath, 'utf-8');
      parsed = parseHtml(html);
    } catch {
      continue;
    }

    const seenTargets = new Set();

    for (const href of parsed.links) {
      const target = normalizeHref(href, baseUrl, canonicalStrategy);
      if (!target) continue;

      // Deduplicate edges per source page
      if (seenTargets.has(target)) continue;
      seenTargets.add(target);

      if (routeIndex.has(target)) {
        edges.push({ from: page.routePath, to: target });
        inDegree[target] = (inDegree[target] || 0) + 1;
        outDegree[page.routePath] = (outDegree[page.routePath] || 0) + 1;
      } else {
        brokenEdges.push({ from: page.routePath, href, normalizedTarget: target });
      }
    }
  }

  // Compute orphan pages (inDegree == 0, excluding "/" and utility pages)
  const orphanPages = Object.entries(inDegree)
    .filter(([path, deg]) => deg === 0 && path !== '/' && !utilitySet.has(path))
    .map(([path]) => path)
    .sort();

  // Underlinked rank-intent pages (sorted by inDegree ascending)
  const rankIntentSet = new Set(rankIntentRoutes);
  const underlinked = Object.entries(inDegree)
    .filter(([path]) => rankIntentSet.has(path))
    .sort((a, b) => a[1] - b[1])
    .map(([path, deg]) => ({ path, inDegree: deg }));

  // Top link sources (highest outDegree)
  const topSources = Object.entries(outDegree)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path, deg]) => ({ path, outDegree: deg }));

  return {
    pagesInGraph: pages.length,
    edgesInGraph: edges.length,
    orphanCount: orphanPages.length,
    orphanPages,
    topUnderlinked: underlinked.slice(0, 10),
    topLinkSources: topSources,
    brokenEdgesSample: brokenEdges.slice(0, 25),
    // Full data for planner
    inDegree,
    outDegree,
    edges,
  };
}

/**
 * Print link graph summary to console.
 */
export function printLinkGraphSummary(graph) {
  console.log(`\n[link-graph] Pages in graph: ${graph.pagesInGraph}`);
  console.log(`[link-graph] Edges (unique links): ${graph.edgesInGraph}`);
  console.log(`[link-graph] Orphan pages (0 inlinks): ${graph.orphanCount}`);

  if (graph.topUnderlinked.length > 0) {
    console.log('\n[link-graph] Underlinked rank-intent pages:');
    for (const p of graph.topUnderlinked.slice(0, 5)) {
      console.log(`  ${p.path} (inDegree: ${p.inDegree})`);
    }
  }

  if (graph.orphanCount > 0) {
    console.log(`\n[link-graph] Orphan pages (first 10):`);
    for (const p of graph.orphanPages.slice(0, 10)) {
      console.log(`  ${p}`);
    }
  }

  if (graph.brokenEdgesSample.length > 0) {
    console.log(`\n[link-graph] Broken internal links (first 5):`);
    for (const e of graph.brokenEdgesSample.slice(0, 5)) {
      console.log(`  ${e.from} -> ${e.href}`);
    }
  }

  console.log('');
}
