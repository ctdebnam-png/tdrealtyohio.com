/**
 * content-plan.mjs
 *
 * Chooses exactly one content action per run:
 * - refresh-post: refresh an existing blog post
 * - refresh-page: refresh an existing money page section
 * - publish-post: publish a new blog post from the backlog
 * - none: no content action (tech gate failed, no opportunities, etc.)
 *
 * Selection is deterministic and driven by GSC striking-distance queries
 * and the pre-defined content cluster backlog.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));


const REFRESH_RUN_CAP = 3;
const POSITION_BANDS = [
  { min: 4, max: 10, score: 1.0 },
  { min: 11, max: 20, score: 0.8 },
  { min: 21, max: 35, score: 0.4 },
];

const ROUTE_INTENT_WEIGHTS = {
  money: 1.0,
  informational: 0.45,
};

const CONVERSION_ASSIST_WEIGHTS = [
  ['/contact/', 1.0],
  ['/home-value/', 0.95],
  ['/1-percent-commission/', 0.9],
  ['/sellers/', 0.85],
  ['/buyers/', 0.85],
  ['/sellers/', 0.8],
  ['/areas/', 0.7],
  ['/blog/', 0.35],
];

function getPositionBandScore(position) {
  for (const band of POSITION_BANDS) {
    if (position >= band.min && position <= band.max) return band.score;
  }
  return 0;
}

function getRouteIntentWeight(routePath, rankSet) {
  const isMoneyPage = rankSet.has(routePath) && !routePath.startsWith('/blog/');
  return isMoneyPage ? ROUTE_INTENT_WEIGHTS.money : ROUTE_INTENT_WEIGHTS.informational;
}

function getConversionAssistValue(routePath) {
  for (const [prefix, weight] of CONVERSION_ASSIST_WEIGHTS) {
    if (routePath.startsWith(prefix)) return weight;
  }
  return 0.4;
}


function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Check the technical gate: if any rankIntentRoutes page has MISSING_CANONICAL,
 * CANONICAL_NOT_ABSOLUTE, or NOINDEX_ON_RANK_PAGE issues, block content work.
 *
 * @param {object} auditResult - The build-audit result (with .pages)
 * @param {string[]} rankIntentRoutes - List of rank-intent route paths
 * @returns {{ pass: boolean, blockers: string[] }}
 */
function checkTechGate(auditResult, rankIntentRoutes) {
  const GATE_CODES = new Set([
    'MISSING_CANONICAL',
    'CANONICAL_NOT_ABSOLUTE',
    'NOINDEX_ON_RANK_PAGE',
  ]);

  const rankSet = new Set(rankIntentRoutes || []);
  const blockers = [];

  if (!auditResult || !auditResult.pages) {
    return { pass: true, blockers: [] };
  }

  for (const page of auditResult.pages) {
    if (!rankSet.has(page.path)) continue;
    for (const issue of page.issues || []) {
      if (GATE_CODES.has(issue.code)) {
        blockers.push(`${page.path}: ${issue.code}`);
      }
    }
  }

  return { pass: blockers.length === 0, blockers };
}

/**
 * Plan one content action per run.
 *
 * @param {object} options
 * @param {object[]} options.strikingDistanceQueries - GSC striking distance queries
 * @param {object} options.backlog - content-backlog.json data
 * @param {object[]} options.blogPosts - from blog-discovery
 * @param {string[]} options.rankIntentRoutes - from site.json
 * @param {object} options.auditResult - from build-audit (with .pages)
 * @param {object} options.state - from state/state.json
 * @param {object} options.linkGraph - from link-graph (optional, for cluster prioritization)
 * @returns {{ action: string, target: object|null, reason: string }}
 */
export function planContent({
  strikingDistanceQueries = [],
  backlog = null,
  blogPosts = [],
  rankIntentRoutes = [],
  auditResult = null,
  state = {},
  linkGraph = null,
  qualitySignals = null,
}) {
  // A) Technical gate
  const gate = checkTechGate(auditResult, rankIntentRoutes);
  if (!gate.pass) {
    console.log(`[content-plan] Tech gate failed: ${gate.blockers.length} blocker(s)`);
    for (const b of gate.blockers.slice(0, 5)) {
      console.log(`  ${b}`);
    }
    return { action: 'none', target: null, reason: 'tech_gate' };
  }

  // Quality gate: if thin rank-intent pages exist, block publishing (prefer refresh)
  const thinRankIntentCount = qualitySignals?.thinRankIntentCount || 0;
  const nearDuplicatePairs = qualitySignals?.nearDuplicatePairs || [];
  const publishBlockedByQuality = thinRankIntentCount > 0;
  if (publishBlockedByQuality) {
    console.log(`[content-plan] Quality gate: ${thinRankIntentCount} thin rank-intent page(s) — publishing blocked, refresh preferred`);
  }

  // Check daily publish limit
  const lastPublishAt = state.content?.lastPublishAt;
  const today = new Date().toISOString().slice(0, 10);
  const publishedToday = lastPublishAt && lastPublishAt.slice(0, 10) === today;

  if (!backlog || !backlog.clusters) {
    return { action: 'none', target: null, reason: 'no_backlog' };
  }

  const rules = backlog.rules || {};
  const rankSet = new Set(rankIntentRoutes);

  // Build a map of blog post paths for matching
  const blogPathSet = new Set(blogPosts.map(p => p.path));
  const blogSlugMap = new Map(blogPosts.map(p => [p.slug, p]));

  // B) Prefer refresh over new publish when existing page matches opportunity
  const refreshCandidates = [];

  if (strikingDistanceQueries.length > 0) {
    for (const sq of strikingDistanceQueries) {
      const bestPage = sq.bestPagePath || sq.page || '';
      if (!bestPage) continue;

      // Normalize to route path
      let routePath = bestPage;
      try {
        const u = new URL(bestPage);
        routePath = u.pathname;
      } catch { /* already a path */ }

      // Ensure trailing slash
      if (!routePath.endsWith('/')) routePath += '/';

      // Check if this is an existing blog post or money page
      const isBlogPost = blogPathSet.has(routePath) || routePath.startsWith('/blog/');
      const isMoneyPage = rankSet.has(routePath) && !routePath.startsWith('/blog/');

      if (isBlogPost || isMoneyPage) {
        const impressions = sq.impressions28 || sq.impressions || 0;
        const ctr = sq.ctr28 ?? sq.ctr ?? 0;
        const position = sq.position28 || sq.position || 0;
        const ctrGap = Math.max(0, 0.03 - ctr) / 0.03;
        const impressionCtr = Math.min(1, impressions / 1000) * ctrGap;
        const positionBand = getPositionBandScore(position);
        if (impressionCtr <= 0 || positionBand <= 0) continue;

        const routeIntent = getRouteIntentWeight(routePath, rankSet);
        const conversionAssist = getConversionAssistValue(routePath);
        const score =
          impressionCtr * 0.45 +
          positionBand * 0.2 +
          routeIntent * 0.2 +
          conversionAssist * 0.15;

        refreshCandidates.push({
          routePath,
          query: sq.query,
          impressions,
          ctr,
          position,
          isBlogPost,
          isMoneyPage,
          score,
          components: {
            impressionCtr,
            positionBand,
            routeIntent,
            conversionAssist,
          },
        });
      }
    }
  }

  // Deterministic sorting and capped run selection
  refreshCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.routePath.localeCompare(b.routePath);
  });

  const refreshQueue = refreshCandidates.slice(0, REFRESH_RUN_CAP);
  if (refreshCandidates.length > 0) {
    console.log(`[content-plan] Refresh scoring: ${refreshCandidates.length} candidates, selected ${refreshQueue.length} (cap=${REFRESH_RUN_CAP})`);
    for (const c of refreshQueue) {
      console.log(`[content-plan][audit] ${c.routePath} score=${c.score.toFixed(4)} impCtr=${c.components.impressionCtr.toFixed(4)} posBand=${c.components.positionBand.toFixed(2)} intent=${c.components.routeIntent.toFixed(2)} assist=${c.components.conversionAssist.toFixed(2)}`);
    }

    const best = refreshQueue[0];
    const action = best.isBlogPost ? 'refresh-post' : 'refresh-page';

    // Find matching topic from backlog for context
    let matchedTopic = null;
    let matchedCluster = null;
    for (const cluster of backlog.clusters) {
      for (const topic of cluster.topics) {
        const hints = topic.targetQueryHints || [];
        for (const hint of hints) {
          if (best.query.toLowerCase().includes(hint.toLowerCase()) ||
              hint.toLowerCase().includes(best.query.toLowerCase())) {
            matchedTopic = topic;
            matchedCluster = cluster;
            break;
          }
        }
        if (matchedTopic) break;
      }
      if (matchedTopic) break;
    }

    return {
      action,
      target: {
        pathOrSlug: best.routePath,
        topicId: matchedTopic?.topicId || null,
        clusterId: matchedCluster?.clusterId || null,
        query: best.query,
        impressions: best.impressions,
        position: best.position,
        score: Number(best.score.toFixed(4)),
        components: {
          impressionCtr: Number(best.components.impressionCtr.toFixed(4)),
          positionBand: Number(best.components.positionBand.toFixed(4)),
          routeIntent: Number(best.components.routeIntent.toFixed(4)),
          conversionAssist: Number(best.components.conversionAssist.toFixed(4)),
        },
        refreshQueue: refreshQueue.map(c => c.routePath),
        refreshCap: REFRESH_RUN_CAP,
        internalLinksTo: matchedTopic?.internalLinksTo || [],
      },
      reason: `refresh_scored: ${best.query} (${best.impressions} imp, pos ${best.position.toFixed(1)}, score ${best.score.toFixed(3)})`,
    };
  }

  // C) No refresh candidates — try publishing a new post
  if (publishBlockedByQuality) {
    // If thin pages exist but no refresh candidates from GSC, try to refresh a thin page directly
    const thinPages = qualitySignals?.thinRankIntent || [];
    if (thinPages.length > 0) {
      const thinTarget = thinPages[0];
      const isBlog = thinTarget.routePath.startsWith('/blog/');
      return {
        action: isBlog ? 'refresh-post' : 'refresh-page',
        target: {
          pathOrSlug: thinTarget.routePath,
          topicId: null,
          clusterId: null,
          query: 'thin page improvement',
          internalLinksTo: ['/contact/'],
        },
        reason: `quality_gate_thin_refresh: ${thinTarget.routePath} (${thinTarget.wordCount} words)`,
      };
    }
    return { action: 'none', target: null, reason: 'quality_gate_blocks_publish' };
  }
  if (publishedToday) {
    return { action: 'none', target: null, reason: 'already_published_today' };
  }

  // Find a pending backlog topic
  // Prioritize clusters whose pillarPath has lower in-degree
  const clusterPriority = [];
  for (const cluster of backlog.clusters) {
    const pendingTopics = cluster.topics.filter(t => t.status === 'pending');
    if (pendingTopics.length === 0) continue;

    // Get in-degree of pillar page from link graph
    let pillarInDegree = 999;
    if (linkGraph && linkGraph.nodes) {
      const pillarNode = linkGraph.nodes[cluster.pillarPath];
      pillarInDegree = pillarNode?.inDegree ?? 999;
    }

    clusterPriority.push({
      cluster,
      pendingTopics,
      pillarInDegree,
    });
  }

  // Sort by pillarInDegree ascending (lowest in-degree gets priority)
  clusterPriority.sort((a, b) => a.pillarInDegree - b.pillarInDegree);

  // Within each cluster, pick first pending topic whose targetQueryHints overlap
  // with striking distance queries (if any)
  const strikingQueryTexts = strikingDistanceQueries.map(sq => (sq.query || '').toLowerCase());

  for (const { cluster, pendingTopics } of clusterPriority) {
    // Try to find a topic that overlaps with striking distance queries
    for (const topic of pendingTopics) {
      const hints = (topic.targetQueryHints || []).map(h => h.toLowerCase());
      const hasOverlap = strikingQueryTexts.length === 0 || hints.some(hint =>
        strikingQueryTexts.some(sq => sq.includes(hint) || hint.includes(sq))
      );

      if (hasOverlap) {
        return {
          action: 'publish-post',
          target: {
            pathOrSlug: null, // Will be determined by the publisher
            topicId: topic.topicId,
            clusterId: cluster.clusterId,
            query: hints[0] || '',
            pillarPath: cluster.pillarPath,
            requiredSections: topic.requiredSections || [],
            internalLinksTo: topic.internalLinksTo || [],
            targetQueryHints: topic.targetQueryHints || [],
            primaryIntent: topic.primaryIntent || 'explain',
          },
          reason: `publish_backlog: ${topic.topicId} (cluster: ${cluster.clusterId})`,
        };
      }
    }
  }

  // Fallback: pick the first pending topic from any cluster
  for (const { cluster, pendingTopics } of clusterPriority) {
    const topic = pendingTopics[0];
    return {
      action: 'publish-post',
      target: {
        pathOrSlug: null,
        topicId: topic.topicId,
        clusterId: cluster.clusterId,
        query: (topic.targetQueryHints || [])[0] || '',
        pillarPath: cluster.pillarPath,
        requiredSections: topic.requiredSections || [],
        internalLinksTo: topic.internalLinksTo || [],
        targetQueryHints: topic.targetQueryHints || [],
        primaryIntent: topic.primaryIntent || 'explain',
      },
      reason: `publish_backlog_fallback: ${topic.topicId}`,
    };
  }

  return { action: 'none', target: null, reason: 'no_eligible_content' };
}
