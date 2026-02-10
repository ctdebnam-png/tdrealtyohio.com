/**
 * link-plan.mjs
 *
 * Deterministic planner that decides which internal links to add.
 * Uses link graph metrics, pillar config, cluster coverage, and history state.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', 'state', 'state.json');
const GUIDES_PATH = join(__dirname, '..', 'config', 'related-guides.json');

function loadState() {
  try {
    if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch { /* ignore */ }
  return { linksAdded: [], lastRunDate: null };
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

function loadGuidesConfig() {
  try {
    return JSON.parse(readFileSync(GUIDES_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function normalizeGuidesEntry(entry) {
  if (Array.isArray(entry)) return { intentClusters: [{ intent: 'related guides', links: entry }] };
  if (entry && Array.isArray(entry.intentClusters)) return entry;
  return { intentClusters: [] };
}

function wasAlreadyAdded(state, from, to, anchor) {
  return (state.linksAdded || []).some((l) => l.from === from && l.to === to && l.anchor === anchor);
}

function countAnchorUsage(actions) {
  const usage = {};
  for (const action of actions) usage[action.anchorText] = (usage[action.anchorText] || 0) + 1;
  return usage;
}

function buildClusterCandidates(pillars, guidesConfig, linkGraph, minAnchorLen) {
  const candidates = [];
  const edges = linkGraph.edges || [];

  for (const pillar of (pillars.pillars || [])) {
    const route = pillar.path;
    const clusterDefs = pillar.intentClusters || [];
    if (clusterDefs.length === 0) continue;

    const existing = normalizeGuidesEntry(guidesConfig[route]);

    for (const clusterDef of clusterDefs) {
      const existingCluster = existing.intentClusters.find((c) => c.intent === clusterDef.intent);
      const existingHrefs = new Set((existingCluster?.links || []).map((l) => l.href));
      const preferredLinks = (clusterDef.preferredLinks || []).filter((l) => l.href && l.text && l.text.length >= minAnchorLen);

      const uncovered = preferredLinks.filter((l) => !existingHrefs.has(l.href));
      if (uncovered.length === 0) continue;

      const firstMissing = uncovered[0];
      const alreadyLinkedToHub = edges.some((e) => e.from === firstMissing.href && e.to === route);

      candidates.push({
        pillarPath: route,
        intentCluster: clusterDef.intent,
        sourcePath: firstMissing.href,
        targetPath: route,
        anchorText: firstMissing.text,
        score: uncovered.length,
        alreadyLinkedToHub,
      });
    }
  }

  return candidates
    .filter((c) => !c.alreadyLinkedToHub)
    .sort((a, b) => b.score - a.score);
}

/**
 * @returns {{ actions: Array<{fromPath: string, toPath: string, anchorText: string, placementRule: string, intentCluster?: string}>, state: object }}
 */
export function generateLinkPlan(linkGraph, config, pillars) {
  const state = loadState();
  const guidesConfig = loadGuidesConfig();
  const rules = pillars.rules || {};

  let qualityLinking = {};
  try {
    const qPath = join(__dirname, '..', 'config', 'quality.json');
    qualityLinking = JSON.parse(readFileSync(qPath, 'utf-8')).linking || {};
  } catch { /* defaults */ }

  const maxLinks = Math.min(rules.maxNewLinksPerRun || 3, qualityLinking.maxTotalInternalLinksAddedPerRun || 5);
  const maxPerFile = rules.maxLinksAddedPerFile || 2;
  const minAnchorLen = rules.minAnchorLength || 4;
  const maxAnchorRepeats = qualityLinking.maxExactAnchorRepeatsPerRun || 2;

  const { inDegree = {} } = linkGraph;
  const { rankIntentRoutes = [], utilityRoutesNoIndex = [] } = config;
  const utilitySet = new Set([...utilityRoutesNoIndex, '/404/', '/500/']);

  const pillarMap = new Map();
  for (const p of (pillars.pillars || [])) pillarMap.set(p.path, p);

  const targets = rankIntentRoutes
    .filter((p) => !utilitySet.has(p) && p !== '/')
    .map((path) => ({ path, inDeg: inDegree[path] || 0 }))
    .sort((a, b) => a.inDeg - b.inDeg);

  const pillarPaths = new Set(pillars.pillars?.map((p) => p.path) || []);
  const sortedTargets = [...targets.filter((t) => pillarPaths.has(t.path)), ...targets.filter((t) => !pillarPaths.has(t.path))];

  const fileEditCounts = {};
  const sourcePreferences = ['/blog/', '/', '/sellers/', '/buyers/', '/compare/', '/areas/'];
  const allRoutes = new Set(Object.keys(inDegree));
  const actions = [];

  const clusterCandidates = buildClusterCandidates(pillars, guidesConfig, linkGraph, minAnchorLen);
  for (const candidate of clusterCandidates) {
    if (actions.length >= maxLinks) break;
    if (!allRoutes.has(candidate.sourcePath)) continue;
    if ((fileEditCounts[candidate.sourcePath] || 0) >= maxPerFile) continue;

    const usage = countAnchorUsage(actions);
    if (usage[candidate.anchorText] >= maxAnchorRepeats) continue;
    if (wasAlreadyAdded(state, candidate.sourcePath, candidate.targetPath, candidate.anchorText)) continue;

    actions.push({
      fromPath: candidate.sourcePath,
      toPath: candidate.targetPath,
      anchorText: candidate.anchorText,
      intentCluster: candidate.intentCluster,
      placementRule: candidate.sourcePath.startsWith('/blog/') ? 'blog-related-guides-block' : 'intent-cluster-related-guides-block',
    });
    fileEditCounts[candidate.sourcePath] = (fileEditCounts[candidate.sourcePath] || 0) + 1;
  }

  for (const target of sortedTargets) {
    if (actions.length >= maxLinks) break;

    const pillar = pillarMap.get(target.path);
    const anchors = pillar ? [...(pillar.primaryAnchors || []), ...(pillar.secondaryAnchors || [])] : [];
    if (anchors.length === 0) {
      const pathName = target.path.replace(/^\/|\/$/g, '').replace(/-/g, ' ');
      if (pathName && pathName.length >= minAnchorLen) anchors.push(pathName);
    }

    for (const sourcePref of sourcePreferences) {
      if (actions.length >= maxLinks) break;
      if (sourcePref === target.path) continue;
      if (!allRoutes.has(sourcePref)) continue;
      if ((fileEditCounts[sourcePref] || 0) >= maxPerFile) continue;

      const usage = countAnchorUsage(actions);
      const anchor = anchors.find((a) => a.length >= minAnchorLen && !wasAlreadyAdded(state, sourcePref, target.path, a) && (usage[a] || 0) < maxAnchorRepeats);
      if (!anchor) continue;

      const alreadyLinked = (linkGraph.edges || []).some((e) => e.from === sourcePref && e.to === target.path);
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

  const today = new Date().toISOString().split('T')[0];
  for (const action of actions) {
    state.linksAdded = state.linksAdded || [];
    state.linksAdded.push({ from: action.fromPath, to: action.toPath, anchor: action.anchorText, date: today });
  }
  state.lastRunDate = today;
  if (state.linksAdded && state.linksAdded.length > 100) state.linksAdded = state.linksAdded.slice(-100);

  saveState(state);
  return { actions, state };
}
