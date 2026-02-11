/**
 * focus-plan.mjs
 *
 * Decision engine that determines what the next run should focus on.
 * Uses scoring data, score history, and thresholds to pick exactly one focus area.
 *
 * Focus areas (strict priority order):
 * 1) tech — critical tech issues exceed threshold
 * 2) links — broken internal links or orphan pages above threshold
 * 3) ctr — GSC shows high-impression/low-CTR pages
 * 4) money — on-page enhancement for money pages (after CTR experiments exist)
 * 5) refresh — striking distance queries with existing page matches
 * 6) publish — backlog has pending topics and enough time since last publish
 * 7) none — nothing to do
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCORING_CONFIG_PATH = join(__dirname, '..', 'config', 'scoring.json');

function loadScoringConfig() {
  try {
    return JSON.parse(readFileSync(SCORING_CONFIG_PATH, 'utf-8'));
  } catch {
    return {
      thresholds: {
        minDaysBetweenSameModule: 3,
        minDaysBetweenSamePageEdit: 21,
        techGateCriticalMax: 0,
        brokenLinksMax: 0,
        orphanMax: 0,
      },
    };
  }
}

/**
 * Determine the focus for this run.
 *
 * @param {object} options
 * @param {object} options.scoreResult - { score, components, rationale }
 * @param {object[]} options.scoreHistory - score-history.json runs array
 * @param {object} options.opportunities - GSC opportunities
 * @param {object|null} options.backlog - content-backlog.json
 * @param {object} options.state - state.json
 * @param {object} options.moduleOutcomes - module-outcomes.json
 * @returns {{ focus: string, reason: string, budgets: { maxMetaEdits: number, maxLinkAdds: number, contentActionAllowed: boolean } }}
 */
export function computeFocusPlan({
  scoreResult = {},
  scoreHistory = [],
  opportunities = {},
  backlog = null,
  state = {},
  moduleOutcomes = {},
  indexingSignals = {},
  moneyRoutes = [],
  liveIssueCounts = {},
  nearDuplicateRoutes = [],
  workflowNoiseCounts = {},
}) {
  const config = loadScoringConfig();
  const thresholds = config.thresholds || {};
  const components = scoreResult.components || {};

  const criticalCount = components.tech?.criticalCount || 0;
  const brokenLinks = components.tech?.brokenInternalLinks || 0;
  const orphanCount = components.links?.orphanCount || 0;

  const highImpLowCtr = opportunities.highImpressionsLowCtrPages || [];
  const strikingQueries = opportunities.strikingDistanceQueries || [];

  // Default budgets
  const budgets = {
    maxMetaEdits: 3,
    maxLinkAdds: 3,
    contentActionAllowed: true,
  };

  // Get last run's focus for recency guard
  const lastRun = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null;
  const lastFocus = lastRun?.decisions?.focus || null;
  const lastRunAt = lastRun?.runAt ? new Date(lastRun.runAt) : null;
  const now = new Date();
  const daysSinceLastRun = lastRunAt ? (now - lastRunAt) / (1000 * 60 * 60 * 24) : Infinity;
  const minDaysBetweenSame = thresholds.minDaysBetweenSameModule || 3;

  // 1) Tech gate: critical issues
  if (criticalCount > (thresholds.techGateCriticalMax || 0)) {
    // Tech always overrides recency guard
    return {
      focus: 'tech',
      reason: `${criticalCount} critical tech issue(s) exceed threshold`,
      budgets: { ...budgets, contentActionAllowed: false },
    };
  }

  // 1a) Workflow noise gate (Chunk 27): push triggers or PR bots
  const pushTriggered = workflowNoiseCounts.pushTriggeredCount || 0;
  const prBots = workflowNoiseCounts.prBotCount || 0;
  if (pushTriggered > 0 || prBots > 0) {
    return {
      focus: 'tech',
      reason: `Workflow noise risk: ${pushTriggered} push-triggered, ${prBots} PR-bot workflow(s) — pausing growth work`,
      budgets: { ...budgets, contentActionAllowed: false },
    };
  }

  // 1b) Indexing consistency gate (Chunk 12): sitemap or canonical mismatches
  const sitemapMissing = indexingSignals.sitemapMissingRankIntent || 0;
  const canonicalBuildMismatch = indexingSignals.canonicalBuildMismatchCount || 0;
  const canonicalLiveMismatch = indexingSignals.canonicalLiveMismatchCount || 0;
  if (sitemapMissing > 0 || canonicalBuildMismatch > 0 || canonicalLiveMismatch > 0) {
    return {
      focus: 'tech',
      reason: `Indexing issues: ${sitemapMissing} missing in sitemap, ${canonicalBuildMismatch} build canonical mismatches, ${canonicalLiveMismatch} live canonical mismatches`,
      budgets: { ...budgets, contentActionAllowed: false },
    };
  }

  // 2) Broken links or orphan pages
  if (brokenLinks > (thresholds.brokenLinksMax || 0) || orphanCount > (thresholds.orphanMax || 0)) {
    if (lastFocus === 'links' && daysSinceLastRun < minDaysBetweenSame) {
      // Skip due to recency — fall through to next priority
    } else {
      return {
        focus: 'links',
        reason: `${brokenLinks} broken link(s), ${orphanCount} orphan page(s)`,
        budgets: { ...budgets, contentActionAllowed: false },
      };
    }
  }

  // 3) CTR opportunities
  if (highImpLowCtr.length > 0) {
    if (lastFocus === 'ctr' && daysSinceLastRun < minDaysBetweenSame) {
      // Skip due to recency
    } else {
      return {
        focus: 'ctr',
        reason: `${highImpLowCtr.length} high-impression/low-CTR page(s)`,
        budgets,
      };
    }
  }

  // 4) Money page enhancements (after at least one CTR experiment cycle)
  const hasActiveCtrExperiments = (moduleOutcomes.ctr?.pagesEdited || 0) > 0;
  const moneyPageCtrTargets = highImpLowCtr.filter(p => moneyRoutes.includes(p.page || p.path));
  const liveCritical = (liveIssueCounts.LIVE_NOINDEX || 0) + (liveIssueCounts.LIVE_ROBOTS_TXT_BLOCKING || 0);
  const nearDupSet = new Set(nearDuplicateRoutes);
  const moneyNotNearDup = moneyRoutes.filter(r => !nearDupSet.has(r));

  if (hasActiveCtrExperiments && moneyNotNearDup.length > 0 && liveCritical === 0) {
    // Check if any money page has low CTR or striking distance queries
    const moneyStriking = strikingQueries.filter(q => moneyRoutes.includes(q.page || q.path));
    if (moneyPageCtrTargets.length > 0 || moneyStriking.length > 0) {
      if (lastFocus === 'money' && daysSinceLastRun < minDaysBetweenSame) {
        // Skip due to recency
      } else {
        return {
          focus: 'money',
          reason: `${moneyPageCtrTargets.length} money page(s) low CTR, ${moneyStriking.length} striking`,
          budgets,
        };
      }
    }
  }

  // 5) Refresh opportunities
  if (strikingQueries.length > 0) {
    if (lastFocus === 'refresh' && daysSinceLastRun < minDaysBetweenSame) {
      // Skip
    } else {
      return {
        focus: 'refresh',
        reason: `${strikingQueries.length} striking distance queries`,
        budgets,
      };
    }
  }

  // 6) Publish from backlog
  const pendingTopics = countPendingTopics(backlog);
  const lastPublish = state.content?.lastPublishAt;
  const daysSincePublish = lastPublish
    ? (now - new Date(lastPublish)) / (1000 * 60 * 60 * 24)
    : Infinity;

  if (pendingTopics > 0 && daysSincePublish > 7) {
    if (lastFocus === 'publish' && daysSinceLastRun < minDaysBetweenSame) {
      // Skip
    } else {
      return {
        focus: 'publish',
        reason: `${pendingTopics} pending topic(s), ${Math.round(daysSincePublish)}d since last publish`,
        budgets,
      };
    }
  }

  // 7) Nothing to do
  return {
    focus: 'none',
    reason: 'all metrics within acceptable ranges',
    budgets: { ...budgets, contentActionAllowed: false },
  };
}

function countPendingTopics(backlog) {
  if (!backlog || !backlog.clusters) return 0;
  let count = 0;
  for (const cluster of backlog.clusters) {
    for (const topic of cluster.topics) {
      if (topic.status === 'pending') count++;
    }
  }
  return count;
}
