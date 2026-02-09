#!/usr/bin/env node
/**
 * Daily Plan Generator
 * Reads analyzed actions and generates a constrained plan JSON.
 *
 * Hard constraints:
 * - No click fraud, no competitor sabotage, no policy evasion
 * - Budget deltas capped per metrics.json guardrails
 * - Churn limiters: max edits per period
 * - Only statistically justified actions
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function loadJSON(path) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

async function generatePlan() {
  const date = yesterday();
  const reportDir = join(ROOT, 'ops', 'reports');
  await mkdir(reportDir, { recursive: true });

  const metrics = await loadJSON(join(ROOT, 'ops', 'metrics.json'));
  const actions = await loadJSON(join(reportDir, `daily-${date}.actions.json`));
  const experiments = await loadJSON(join(ROOT, 'ops', 'experiments', 'experiment-log.json')) || [];

  if (!actions) {
    console.warn('[plan] No actions file found. Run analyze first.');
    return;
  }

  const guardrails = metrics?.guardrails || {};

  // Build failed actions set from experiment log
  const failedActions = new Set(
    experiments.filter(e => e.result === 'failed' || e.result === 'rollback')
      .map(e => `${e.change_type}:${e.scope}`)
  );

  // ── Plan schema ──────────────────────────────────────────
  const plan = {
    date,
    generated: new Date().toISOString(),
    constraints: {
      maxBudgetDeltaPct: guardrails.maxDailyBudgetChangePct || 10,
      maxRSAEditsPerWeek: guardrails.maxRSAEditsPerAdGroupPerWeek || 3,
      maxMetadataEditsPerDay: guardrails.maxLandingPageMetadataEditsPerDay || 5,
      maxNavChangesPerWeek: guardrails.maxStructuralNavChangesPerWeek || 1,
      minClicksBeforePause: guardrails.minClicksBeforePause || 20,
      minDaysBeforeWin: guardrails.minDaysBeforeSEOWin || 14,
    },
    ads: {
      negatives_add: [],
      keywords_pause: [],
      rsa_assets_swap: [],
      budgets_delta: [],
    },
    seo: {
      pages_to_improve: [],
      internal_links_to_add: [],
      schema_fixes: [],
      broken_links_fix: [],
    },
    content: {
      new_pages: [],
      new_posts: [],
    },
    site: {
      metadata_edits: [],
      heading_fixes: [],
      cta_improvements: [],
      broken_link_fixes: [],
      nav_parity_fixes: [],
    },
  };

  // ── Populate ads actions ─────────────────────────────────
  (actions.ads || []).forEach(a => {
    // Skip actions that previously failed
    const key = `${a.type}:${a.term || a.keyword || a.campaign || ''}`;
    if (failedActions.has(key)) return;

    switch (a.type) {
      case 'negative_add':
        plan.ads.negatives_add.push({ term: a.term, reason: a.reason });
        break;
      case 'keyword_pause':
        plan.ads.keywords_pause.push({ keyword: a.keyword, matchType: a.matchType, reason: a.reason });
        break;
      case 'budget_decrease':
      case 'budget_increase':
        plan.ads.budgets_delta.push({
          campaign: a.campaign,
          direction: a.type === 'budget_increase' ? 'increase' : 'decrease',
          maxDeltaPct: Math.min(a.maxDeltaPct || 10, plan.constraints.maxBudgetDeltaPct),
          reason: a.reason,
        });
        break;
    }
  });

  // ── Populate SEO actions ─────────────────────────────────
  (actions.seo || []).forEach(a => {
    switch (a.type) {
      case 'page_improve':
        plan.seo.pages_to_improve.push({ page: a.page, currentPosition: a.position, reason: a.reason });
        break;
      case 'title_description_improve':
        if (plan.site.metadata_edits.length < plan.constraints.maxMetadataEditsPerDay) {
          plan.site.metadata_edits.push({ query: a.query, reason: a.reason });
        }
        break;
    }
  });

  // ── Populate content actions ─────────────────────────────
  (actions.content || []).forEach(a => {
    if (a.type === 'new_page') {
      plan.content.new_pages.push({ query: a.query, impressions: a.impressions });
    }
  });

  // ── Populate landing page actions ────────────────────────
  (actions.landingPage || []).forEach(a => {
    if (a.type === 'reduce_bounce') {
      plan.site.cta_improvements.push({ page: a.page, bounceRate: a.bounceRate });
    }
  });

  // Write plan
  await writeFile(join(reportDir, `daily-${date}.plan.json`), JSON.stringify(plan, null, 2));
  console.log(`[plan] Wrote plan to /ops/reports/daily-${date}.plan.json`);

  // Summary
  const totalActions =
    plan.ads.negatives_add.length +
    plan.ads.keywords_pause.length +
    plan.ads.budgets_delta.length +
    plan.seo.pages_to_improve.length +
    plan.site.metadata_edits.length +
    plan.content.new_pages.length;

  console.log(`[plan] Total actions: ${totalActions}`);
  return plan;
}

export { generatePlan };

generatePlan();
