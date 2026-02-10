/**
 * evaluate.mjs
 *
 * Evaluates running experiments using GSC data.
 * Keeps, reverts, or extends experiments based on CTR changes.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTE_META_PATH = join(__dirname, '..', 'config', 'route-meta.json');
const EXPERIMENTS_STATE_PATH = join(__dirname, '..', 'state', 'experiments.json');

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

function saveJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function loadExperimentsConfig() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'config', 'experiments.json'), 'utf-8'));
  } catch {
    return {
      cooldownDays: 21,
      minClicksBaseline7: 5,
      improvementCtrThreshold: 0.10,
      worsenCtrThreshold: -0.10,
    };
  }
}

/**
 * Evaluate all running experiments.
 *
 * @param {object} pageSnapshots - Current GSC page snapshots from state
 * @returns {Array<{path: string, result: string, baselineCtr7: number, currentCtr7: number, notes: string}>}
 */
export function evaluateExperiments(pageSnapshots) {
  const config = loadExperimentsConfig();
  const expState = loadJson(EXPERIMENTS_STATE_PATH);
  const routeMeta = loadJson(ROUTE_META_PATH);
  const results = [];

  if (!expState.pages) return results;

  const now = new Date();
  const {
    cooldownDays = 21,
    minClicksBaseline7 = 5,
    improvementCtrThreshold = 0.10,
    worsenCtrThreshold = -0.10,
  } = config;

  for (const [path, exp] of Object.entries(expState.pages)) {
    if (exp.status !== 'running') continue;

    // Still locked?
    if (exp.lockUntil && new Date(exp.lockUntil) > now) {
      continue; // Not ready for evaluation
    }

    const snapshot = pageSnapshots?.[path];
    const baselineCtr = exp.baseline?.ctr7 || 0;
    const baselineClicks = exp.baseline?.clicks7 || 0;
    const currentCtr = snapshot?.ctr7 || 0;
    const currentClicks = snapshot?.clicks7 || 0;

    // Not enough data? Extend once
    if (baselineClicks < minClicksBaseline7 || currentClicks < minClicksBaseline7) {
      if (!exp.extended) {
        // Extend lock by 7 days
        const newLock = new Date(now);
        newLock.setDate(newLock.getDate() + 7);
        exp.lockUntil = newLock.toISOString();
        exp.extended = true;
        exp.lastEvaluation = {
          evaluatedAt: now.toISOString(),
          result: 'extended',
          notes: `Insufficient data (baseline clicks: ${baselineClicks}, current: ${currentClicks}). Extended 7 days.`,
        };
        results.push({
          path,
          result: 'extended',
          baselineCtr7: baselineCtr,
          currentCtr7: currentCtr,
          notes: exp.lastEvaluation.notes,
        });
      } else {
        // Already extended once — move to cooldown to avoid indefinite churn
        const cooldownUntil = new Date(now);
        cooldownUntil.setDate(cooldownUntil.getDate() + cooldownDays);
        exp.status = 'cooldown';
        exp.cooldownUntil = cooldownUntil.toISOString();
        exp.lastEvaluation = {
          evaluatedAt: now.toISOString(),
          result: 'kept',
          notes: 'Insufficient data after extension. Keeping variant and entering cooldown.',
        };
        results.push({
          path,
          result: 'kept',
          baselineCtr7: baselineCtr,
          currentCtr7: currentCtr,
          notes: exp.lastEvaluation.notes,
        });
      }
      continue;
    }

    // Compute relative CTR change
    const relativeChange = baselineCtr > 0 ? (currentCtr - baselineCtr) / baselineCtr : 0;

    const cooldownUntil = new Date(now);
    cooldownUntil.setDate(cooldownUntil.getDate() + cooldownDays);

    if (relativeChange >= improvementCtrThreshold) {
      // KEEP — CTR improved
      exp.status = 'cooldown';
      exp.cooldownUntil = cooldownUntil.toISOString();
      exp.lastEvaluation = {
        evaluatedAt: now.toISOString(),
        result: 'kept',
        notes: `CTR improved by ${(relativeChange * 100).toFixed(1)}% (${(baselineCtr * 100).toFixed(2)}% -> ${(currentCtr * 100).toFixed(2)}%).`,
      };
      results.push({
        path,
        result: 'kept',
        baselineCtr7: baselineCtr,
        currentCtr7: currentCtr,
        notes: exp.lastEvaluation.notes,
      });
    } else if (relativeChange <= worsenCtrThreshold) {
      // REVERT — CTR worsened
      // Restore previous title/description in route-meta.json
      if (exp.previous) {
        if (exp.previous.title || exp.previous.description) {
          routeMeta[path] = {
            ...(routeMeta[path] || {}),
            title: exp.previous.title,
            description: exp.previous.description,
          };
        } else {
          // If previous was empty, remove the override
          delete routeMeta[path];
        }
      }

      exp.status = 'cooldown';
      exp.cooldownUntil = cooldownUntil.toISOString();
      exp.lastEvaluation = {
        evaluatedAt: now.toISOString(),
        result: 'reverted',
        notes: `CTR dropped by ${(Math.abs(relativeChange) * 100).toFixed(1)}% (${(baselineCtr * 100).toFixed(2)}% -> ${(currentCtr * 100).toFixed(2)}%). Reverted to previous.`,
      };
      results.push({
        path,
        result: 'reverted',
        baselineCtr7: baselineCtr,
        currentCtr7: currentCtr,
        notes: exp.lastEvaluation.notes,
      });
    } else {
      // Inconclusive — extend once or keep
      if (!exp.extended) {
        const newLock = new Date(now);
        newLock.setDate(newLock.getDate() + 7);
        exp.lockUntil = newLock.toISOString();
        exp.extended = true;
        exp.lastEvaluation = {
          evaluatedAt: now.toISOString(),
          result: 'extended',
          notes: `CTR change inconclusive (${(relativeChange * 100).toFixed(1)}%). Extended 7 days.`,
        };
        results.push({
          path,
          result: 'extended',
          baselineCtr7: baselineCtr,
          currentCtr7: currentCtr,
          notes: exp.lastEvaluation.notes,
        });
      } else {
        // Already extended — keep and cooldown
        exp.status = 'cooldown';
        exp.cooldownUntil = cooldownUntil.toISOString();
        exp.lastEvaluation = {
          evaluatedAt: now.toISOString(),
          result: 'kept',
          notes: `Inconclusive after extension (${(relativeChange * 100).toFixed(1)}%). Keeping variant.`,
        };
        results.push({
          path,
          result: 'kept',
          baselineCtr7: baselineCtr,
          currentCtr7: currentCtr,
          notes: exp.lastEvaluation.notes,
        });
      }
    }
  }

  // Save updated state
  saveJson(EXPERIMENTS_STATE_PATH, expState);
  saveJson(ROUTE_META_PATH, routeMeta);

  return results;
}
