/**
 * link-plan.mjs
 *
 * Deterministic planner that decides which internal links to add.
 * Uses link graph metrics, pillar config, and history state to produce
 * a bounded action list.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', 'state', 'state.json');

/**
 * Load or initialize state.
 */
function loadState() {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { linksAdded: [], lastRunDate: null };
}

/**
 * Save state back to disk.
 */
function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

/**
 * Check if a link was already added in a previous run.
 */
function wasAlreadyAdded(state, from, to, anchor) {
  return (state.linksAdded || []).some(
    (l) => l.from === from && l.to === to && l.anchor === anchor,
  );
}

/**
 * Generate the link insertion plan.
 *
 * @param {object} linkGraph - Link graph from link-graph.mjs
 * @param {object} config - Site config (rankIntentRoutes, utilityRoutesNoIndex)
 * @param {object} pillars - Pillars config
 * @returns {{ actions: Array<{fromPath: string, toPath: string, anchorText: string, placementRule: string}>, state: object }}
 */
export function generateLinkPlan(linkGraph, config, pillars) {
  const state = loadState();
  const rules = pillars.rules || {};
  const maxLinks = rules.maxNewLinksPerRun || 3;
  const maxPerFile = rules.maxLinksAddedPerFile || 2;
  const minAnchorLen = rules.minAnchorLength || 4;

  const { inDegree = {}, outDegree = {} } = linkGraph;
  const { rankIntentRoutes = [], utilityRoutesNoIndex = [] } = config;
  const utilitySet = new Set([...utilityRoutesNoIndex, '/404/', '/500/']);

  // Build pillar lookup
  const pillarMap = new Map();
  for (const p of (pillars.pillars || [])) {
    pillarMap.set(p.path, p);
  }

  // Sort rank-intent routes by inDegree ascending (most underlinked first)
  const targets = rankIntentRoutes
    .filter((p) => !utilitySet.has(p) && p !== '/')
    .map((path) => ({ path, inDeg: inDegree[path] || 0 }))
    .sort((a, b) => a.inDeg - b.inDeg);

  // Prioritize pillar pages
  const pillarPaths = new Set(pillars.pillars?.map((p) => p.path) || []);
  const pillarTargets = targets.filter((t) => pillarPaths.has(t.path));
  const nonPillarTargets = targets.filter((t) => !pillarPaths.has(t.path));
  const sortedTargets = [...pillarTargets, ...nonPillarTargets];

  // Track how many links we've added per file this run
  const fileEditCounts = {};

  // Source preference: blog posts and blog index are good link sources
  // Area pages can link to sellers/buyers
  // Homepage can link to anything
  const sourcePreferences = [
    '/blog/',
    '/',
    '/sellers/',
    '/buyers/',
    '/compare/',
    '/areas/',
  ];

  // Build source candidates from the graph (pages that exist)
  const allRoutes = new Set(Object.keys(inDegree));

  const actions = [];

  for (const target of sortedTargets) {
    if (actions.length >= maxLinks) break;

    const pillar = pillarMap.get(target.path);
    const anchors = pillar
      ? [...(pillar.primaryAnchors || []), ...(pillar.secondaryAnchors || [])]
      : [];

    // If no pillar anchors, use a simple descriptive anchor
    if (anchors.length === 0) {
      // Generate a basic anchor from the path
      const pathName = target.path.replace(/^\/|\/$/g, '').replace(/-/g, ' ');
      if (pathName && pathName.length >= minAnchorLen) {
        anchors.push(pathName);
      }
    }

    // Find a suitable source page
    for (const sourcePref of sourcePreferences) {
      if (actions.length >= maxLinks) break;

      // Don't link a page to itself
      if (sourcePref === target.path) continue;

      // Check source exists in graph
      if (!allRoutes.has(sourcePref)) continue;

      // Check max edits per file
      if ((fileEditCounts[sourcePref] || 0) >= maxPerFile) continue;

      // Pick an anchor not already used
      const anchor = anchors.find(
        (a) => a.length >= minAnchorLen && !wasAlreadyAdded(state, sourcePref, target.path, a),
      );
      if (!anchor) continue;

      // Check if this source already links to this target
      const alreadyLinked = (linkGraph.edges || []).some(
        (e) => e.from === sourcePref && e.to === target.path,
      );
      if (alreadyLinked) continue;

      actions.push({
        fromPath: sourcePref,
        toPath: target.path,
        anchorText: anchor,
        placementRule: sourcePref.startsWith('/blog/')
          ? 'blog-related-guides-block'
          : sourcePref.startsWith('/areas/')
            ? 'area-page-related-links-block'
            : 'page-related-links-block',
      });

      fileEditCounts[sourcePref] = (fileEditCounts[sourcePref] || 0) + 1;
      break;
    }
  }

  // Record actions in state
  const today = new Date().toISOString().split('T')[0];
  for (const action of actions) {
    state.linksAdded = state.linksAdded || [];
    state.linksAdded.push({
      from: action.fromPath,
      to: action.toPath,
      anchor: action.anchorText,
      date: today,
    });
  }
  state.lastRunDate = today;

  // Keep state bounded (last 100 entries)
  if (state.linksAdded && state.linksAdded.length > 100) {
    state.linksAdded = state.linksAdded.slice(-100);
  }

  saveState(state);

  return { actions, state };
}
