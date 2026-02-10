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
 * 4) refresh — striking distance queries with existing page matches
 * 5) publish — backlog has pending topics and enough time since last publish
 * 6) none — nothing to do
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

  // 4) Refresh opportunities
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

  // 5) Publish from backlog
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

  // 6) Nothing to do
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
