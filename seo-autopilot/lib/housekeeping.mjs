/**
 * housekeeping.mjs
 *
 * Trims state files to configured size limits.
 * Never throws. Only writes if content changed.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeJsonStable } from './write-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'housekeeping.json');
const STATE_DIR = join(__dirname, '..', 'state');

function loadConfig() {
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return { state: {}, snapshots: {} }; }
}

function loadJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

/**
 * Run housekeeping on all state files.
 *
 * @returns {Promise<{ trimmed: string[] }>} - List of files that were trimmed
 */
export async function runHousekeeping() {
  const config = loadConfig();
  const limits = config.state || {};
  const trimmed = [];

  // Trim score-history.json
  try {
    const historyPath = join(STATE_DIR, 'score-history.json');
    const history = loadJson(historyPath);
    if (history && history.runs) {
      const max = limits.maxScoreRuns || 120;
      if (history.runs.length > max) {
        history.runs = history.runs.slice(-max);
        const wrote = await writeJsonStable(historyPath, history, 'scoreHistory');
        if (wrote) trimmed.push('score-history.json');
      }
    }
  } catch { /* non-fatal */ }

  // Trim experiments.json recentEdits
  try {
    const expPath = join(STATE_DIR, 'experiments.json');
    const experiments = loadJson(expPath);
    if (experiments && experiments.recentEdits) {
      const max = limits.maxRecentEdits || 50;
      if (experiments.recentEdits.length > max) {
        experiments.recentEdits = experiments.recentEdits.slice(-max);
        const wrote = await writeJsonStable(expPath, experiments);
        if (wrote) trimmed.push('experiments.json');
      }
    }
  } catch { /* non-fatal */ }

  // Trim state.json opportunity lists and worstRoutes
  try {
    const statePath = join(STATE_DIR, 'state.json');
    const state = loadJson(statePath);
    if (state) {
      let changed = false;

      // Trim GSC opportunity lists
      if (state.gsc?.opportunities) {
        const opp = state.gsc.opportunities;
        const maxCtr = limits.maxOpportunityCtrPages || 50;
        const maxDeclines = limits.maxOpportunityDeclines || 50;
        const maxStriking = limits.maxOpportunityStriking || 200;

        if (opp.highImpressionsLowCtrPages?.length > maxCtr) {
          opp.highImpressionsLowCtrPages = opp.highImpressionsLowCtrPages.slice(0, maxCtr);
          changed = true;
        }
        if (opp.decliningPages?.length > maxDeclines) {
          opp.decliningPages = opp.decliningPages.slice(0, maxDeclines);
          changed = true;
        }
        if (opp.strikingDistanceQueries?.length > maxStriking) {
          opp.strikingDistanceQueries = opp.strikingDistanceQueries.slice(0, maxStriking);
          changed = true;
        }
      }

      // Trim worstRoutes
      const maxWorst = limits.maxWorstRoutes || 10;
      if (state.live?.worstRoutes?.length > maxWorst) {
        state.live.worstRoutes = state.live.worstRoutes.slice(0, maxWorst);
        changed = true;
      }

      // Trim areas expandedHistory
      if (state.areas?.expandedHistory?.length > 50) {
        state.areas.expandedHistory = state.areas.expandedHistory.slice(-50);
        changed = true;
      }

      if (changed) {
        const wrote = await writeJsonStable(statePath, state, 'state');
        if (wrote) trimmed.push('state.json');
      }
    }
  } catch { /* non-fatal */ }

  return { trimmed };
}
