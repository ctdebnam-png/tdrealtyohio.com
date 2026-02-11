/**
 * consolidation-plan.mjs
 *
 * Chooses a primary page and supporting pages for each
 * cannibalization pair, then produces a deterministic
 * consolidation plan.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { writeJsonStable } from '../lib/write-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');
const PLAN_PATH = join(__dirname, '..', 'report', 'consolidation-plan.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Create a consolidation plan from cannibalization pairs.
 *
 * @param {object[]} pairs - From detectCannibalization
 * @returns {{
 *   createdAt: string,
 *   items: Array<{
 *     queryGroupId: string,
 *     primary: string,
 *     supporting: string[],
 *     sampleQueries: string[],
 *     action: string
 *   }>
 * }}
 */
export async function planConsolidation(pairs = []) {
  const siteConfig = loadJson(SITE_CONFIG_PATH, {});
  const moneyRoutes = new Set(siteConfig.moneyRoutes || []);

  const items = [];

  for (const pair of pairs.slice(0, 25)) {
    // Determine primary by higher total clicks across shared queries
    let primary, supporting;

    if (pair.aTotals.clicks > pair.bTotals.clicks) {
      primary = pair.a;
      supporting = [pair.b];
    } else if (pair.bTotals.clicks > pair.aTotals.clicks) {
      primary = pair.b;
      supporting = [pair.a];
    } else {
      // Tiebreaker: prefer money page, then alphabetically first (deterministic)
      if (moneyRoutes.has(pair.a) && !moneyRoutes.has(pair.b)) {
        primary = pair.a;
        supporting = [pair.b];
      } else if (moneyRoutes.has(pair.b) && !moneyRoutes.has(pair.a)) {
        primary = pair.b;
        supporting = [pair.a];
      } else {
        primary = pair.a;
        supporting = [pair.b];
      }
    }

    const queryGroupId = createHash('md5')
      .update(pair.sampleQueries.slice(0, 3).join('|'))
      .digest('hex')
      .slice(0, 8);

    items.push({
      queryGroupId,
      primary,
      supporting,
      sampleQueries: pair.sampleQueries.slice(0, 5),
      sharedQueries: pair.sharedQueries,
      action: 'mitigate',
    });
  }

  const plan = {
    createdAt: new Date().toISOString(),
    items,
  };

  await writeJsonStable(PLAN_PATH, plan, 'consolidationPlan');

  return plan;
}

/**
 * Load previously persisted consolidation plan.
 */
export function loadConsolidationPlan() {
  return loadJson(PLAN_PATH, { items: [] });
}
