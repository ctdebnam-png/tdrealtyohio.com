/**
 * striking-refresh-plan.mjs
 *
 * Selects a page to refresh based on striking-distance queries.
 * Enforces cooldowns, experiment locks, and quality gates.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { groupQueriesByPage } from '../analyzers/query-page-map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCORING_PATH = join(__dirname, '..', 'config', 'scoring.json');
const REFRESH_BLOCKS_PATH = join(__dirname, '..', 'config', 'refresh-blocks.json');

function loadJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Determine the page type for a given path.
 * @param {string} pagePath
 * @param {string[]} moneyRoutes
 * @returns {'blog'|'money'|'area'|'other'}
 */
function getPageType(pagePath, moneyRoutes = []) {
  if (pagePath.startsWith('/blog/')) return 'blog';
  if (pagePath.startsWith('/areas/')) return 'area';
  if (moneyRoutes.includes(pagePath)) return 'money';
  return 'other';
}

/**
 * Select a page + queries for striking-distance refresh.
 *
 * @param {object} options
 * @param {object[]} options.queryMap - Compact or full query map entries
 * @param {string[]} options.rankIntentRoutes - Indexable routes
 * @param {string[]} options.moneyRoutes - Money page routes
 * @param {object}   options.state - state.json
 * @param {object}   options.experimentsState - experiments state (active experiments)
 * @param {object[]} options.nearDuplicatePairs - Near-duplicate pairs
 * @param {object[]} options.thinRankIntent - Thin rank-intent pages
 * @returns {{ action: string, targetPagePath: string|null, queries: object[], pageType: string, reason: string }}
 */
export function planStrikingRefresh({
  queryMap = [],
  rankIntentRoutes = [],
  moneyRoutes = [],
  state = {},
  experimentsState = {},
  nearDuplicatePairs = [],
  thinRankIntent = [],
} = {}) {
  if (queryMap.length === 0) {
    return { action: 'none', targetPagePath: null, queries: [], pageType: '', reason: 'no_striking_queries' };
  }

  const scoring = loadJson(SCORING_PATH, {});
  const refreshBlocks = loadJson(REFRESH_BLOCKS_PATH, {});
  const minDaysEdit = scoring.thresholds?.minDaysBetweenSamePageEdit || 21;
  const rankSet = new Set(rankIntentRoutes);
  const now = new Date();

  // Build cooldown set from strikingRefresh history
  const cooldownPages = new Set();
  const refreshHistory = state.strikingRefresh?.history || [];
  for (const entry of refreshHistory) {
    const daysSince = (now - new Date(entry.at)) / (1000 * 60 * 60 * 24);
    if (daysSince < minDaysEdit) {
      cooldownPages.add(entry.pagePath);
    }
  }

  // Also add pages from content engine edits
  const contentTargets = state.content?.lastTargets || [];
  for (const t of contentTargets) {
    const lastActionAt = state.content?.lastActionAt;
    if (lastActionAt) {
      const daysSince = (now - new Date(lastActionAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < minDaysEdit) {
        cooldownPages.add(t.path);
      }
    }
  }

  // Build experiment lock set (pages with active meta experiments)
  const experimentLockPages = new Set();
  const activeExperiments = experimentsState.active || [];
  for (const exp of activeExperiments) {
    if (exp.path) experimentLockPages.add(exp.path);
  }

  // Build near-duplicate set
  const nearDupPages = new Set();
  for (const pair of nearDuplicatePairs) {
    if (pair.routeA || pair.pathA) nearDupPages.add(pair.routeA || pair.pathA);
    if (pair.routeB || pair.pathB) nearDupPages.add(pair.routeB || pair.pathB);
  }

  // Group queries by page and score pages
  const grouped = groupQueriesByPage(queryMap);
  const candidates = [];

  for (const [pagePath, queries] of grouped) {
    // Must be rank-intent
    if (!rankSet.has(pagePath)) continue;

    // Must not be in cooldown
    if (cooldownPages.has(pagePath)) continue;

    // Must not have active experiment
    if (experimentLockPages.has(pagePath)) continue;

    // Must not be near-duplicate
    if (nearDupPages.has(pagePath)) continue;

    const pageType = getPageType(pagePath, moneyRoutes);
    if (pageType === 'other') continue; // Only refresh blog/money/area

    const blockConfig = refreshBlocks[pageType];
    if (!blockConfig) continue;

    // Score: total impressions from all striking queries for this page
    const totalImpressions = queries.reduce((sum, q) => sum + (q.impressions28 || 0), 0);
    const queryCount = queries.length;

    candidates.push({
      pagePath,
      pageType,
      queries: queries.sort((a, b) => b.impressions28 - a.impressions28),
      totalImpressions,
      queryCount,
      maxQueries: blockConfig.maxQueriesPerRefresh || 3,
    });
  }

  if (candidates.length === 0) {
    return { action: 'none', targetPagePath: null, queries: [], pageType: '', reason: 'no_eligible_pages' };
  }

  // Prioritize: pages with most striking queries clustered together, then by impressions
  candidates.sort((a, b) => {
    // First by query count (more queries = more opportunity)
    if (b.queryCount !== a.queryCount) return b.queryCount - a.queryCount;
    // Then by total impressions
    return b.totalImpressions - a.totalImpressions;
  });

  const winner = candidates[0];
  const selectedQueries = winner.queries.slice(0, winner.maxQueries);

  return {
    action: 'refresh',
    targetPagePath: winner.pagePath,
    queries: selectedQueries,
    pageType: winner.pageType,
    reason: `${winner.queryCount} striking queries, ${winner.totalImpressions} total impressions`,
  };
}
