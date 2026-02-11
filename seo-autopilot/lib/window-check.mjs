/**
 * window-check.mjs
 *
 * Enforces deploy windows so the autopilot only makes edits when
 * there's a measurable opportunity or a real problem.
 *
 * Returns which modules are allowed this run, with reasons for any blocks.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'deploy-windows.json');

function loadConfig() {
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

/**
 * Get ISO week number for a date.
 */
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

/**
 * Check which modules are allowed in the current deploy window.
 *
 * @param {object} options
 * @param {object} options.windows - state.windows from state.json
 * @param {object} options.signals - current run signals
 * @returns {{ allowed: { tech, meta, refresh, publish, areas }, reasons: object }}
 */
export function checkDeployWindows({
  windows = {},
  signals = {},
}) {
  const config = loadConfig();
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const reasons = {};

  // ── Tech: always allowed if issues exist ─────────────────────────
  const techConfig = config.tech || { allowedAnyDay: true, maxEditsPerWeek: 7 };
  let techAllowed = true;

  if (techConfig.allowedAnyDay && (signals.criticalCount > 0 || signals.liveIssueCount > 0)) {
    techAllowed = true;
  } else {
    // Check weekly cap
    const techWindow = windows.tech || {};
    const techWeek = techWindow.lastWeek || 0;
    const editsThisWeek = techWeek === currentWeek ? (techWindow.editsThisWeek || 0) : 0;
    if (editsThisWeek >= techConfig.maxEditsPerWeek) {
      techAllowed = false;
      reasons.tech = 'weekly_cap';
    }
  }

  // ── Meta (CTR experiments): requires cooldown + opportunities ────
  const metaConfig = config.meta || { minDaysBetweenRuns: 7, maxPagesPerWindow: 3, requiresOpportunity: true };
  let metaAllowed = true;
  const metaWindow = windows.meta || {};
  const metaLastRun = metaWindow.lastRunAt ? new Date(metaWindow.lastRunAt) : null;
  const daysSinceMeta = metaLastRun ? (now - metaLastRun) / 86400000 : Infinity;

  if (daysSinceMeta < metaConfig.minDaysBetweenRuns) {
    metaAllowed = false;
    reasons.meta = 'cooldown';
  } else if (metaConfig.requiresOpportunity && (signals.highImpLowCtrCount || 0) === 0) {
    metaAllowed = false;
    reasons.meta = 'no_opportunity';
  }

  // ── Content Refresh: requires cooldown + striking distance ───────
  const refreshConfig = config.contentRefresh || { minDaysBetweenRuns: 10, maxPagesPerWindow: 1, requiresStrikingDistance: true };
  let refreshAllowed = true;
  const refreshWindow = windows.contentRefresh || {};
  const refreshLastRun = refreshWindow.lastRunAt ? new Date(refreshWindow.lastRunAt) : null;
  const daysSinceRefresh = refreshLastRun ? (now - refreshLastRun) / 86400000 : Infinity;

  if (daysSinceRefresh < refreshConfig.minDaysBetweenRuns) {
    refreshAllowed = false;
    reasons.refresh = 'cooldown';
  } else if (refreshConfig.requiresStrikingDistance && (signals.strikingDistanceCount || 0) === 0) {
    refreshAllowed = false;
    reasons.refresh = 'no_opportunity';
  } else if (signals.criticalCount > 0) {
    refreshAllowed = false;
    reasons.refresh = 'tech_not_clean';
  }

  // ── Content Publish: requires cooldown + backlog + tech clean ────
  const publishConfig = config.contentPublish || { minDaysBetweenRuns: 14, maxPublishesPerWindow: 1, requiresBacklog: true, requiresTechClean: true };
  let publishAllowed = true;
  const publishWindow = windows.contentPublish || {};
  const publishLastRun = publishWindow.lastRunAt ? new Date(publishWindow.lastRunAt) : null;
  const daysSincePublish = publishLastRun ? (now - publishLastRun) / 86400000 : Infinity;

  if (daysSincePublish < publishConfig.minDaysBetweenRuns) {
    publishAllowed = false;
    reasons.publish = 'cooldown';
  } else if (publishConfig.requiresBacklog && (signals.pendingTopicCount || 0) === 0) {
    publishAllowed = false;
    reasons.publish = 'no_opportunity';
  } else if (publishConfig.requiresTechClean && (signals.criticalCount || 0) > 0) {
    publishAllowed = false;
    reasons.publish = 'tech_not_clean';
  }

  // ── Areas: requires cooldown + thin/underlinked + clean ──────────
  const areasConfig = config.areas || { minDaysBetweenRuns: 14, maxPagesPerWindow: 1, requiresThinOrUnderlinked: true };
  let areasAllowed = true;
  const areasWindow = windows.areas || {};
  const areasLastRun = areasWindow.lastRunAt ? new Date(areasWindow.lastRunAt) : null;
  const daysSinceAreas = areasLastRun ? (now - areasLastRun) / 86400000 : Infinity;

  if (daysSinceAreas < areasConfig.minDaysBetweenRuns) {
    areasAllowed = false;
    reasons.areas = 'cooldown';
  } else if (areasConfig.requiresThinOrUnderlinked && (signals.thinCount || 0) === 0 && (signals.underlinkedCount || 0) === 0) {
    areasAllowed = false;
    reasons.areas = 'no_opportunity';
  } else if ((signals.criticalCount || 0) > 0) {
    areasAllowed = false;
    reasons.areas = 'tech_not_clean';
  }

  return {
    allowed: {
      tech: techAllowed,
      meta: metaAllowed,
      refresh: refreshAllowed,
      publish: publishAllowed,
      areas: areasAllowed,
    },
    reasons,
    currentWeek,
  };
}

/**
 * Update the windows state after a module runs.
 *
 * @param {object} windows - state.windows
 * @param {string} module - which module ran (tech, meta, contentRefresh, contentPublish, areas)
 * @param {object} [details] - optional details to track
 * @returns {object} updated windows
 */
export function recordWindowUsage(windows = {}, module, details = {}) {
  const now = new Date();
  const currentWeek = getISOWeek(now);

  const updated = { ...windows };

  if (module === 'tech') {
    const prev = updated.tech || {};
    const editsThisWeek = prev.lastWeek === currentWeek ? (prev.editsThisWeek || 0) + 1 : 1;
    updated.tech = { lastRunAt: now.toISOString(), lastWeek: currentWeek, editsThisWeek };
  } else {
    const moduleKey = module;
    const prev = updated[moduleKey] || {};
    const targets = (prev.lastTargets || []).slice(-10);
    if (details.target) targets.push({ path: details.target, at: now.toISOString() });
    updated[moduleKey] = { lastRunAt: now.toISOString(), lastTargets: targets };
  }

  return updated;
}
