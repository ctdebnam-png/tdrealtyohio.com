/**
 * perf-regressions.mjs
 *
 * Compare current perf run to previous run and flag regressions
 * that exceed configured thresholds.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeJsonStable } from '../lib/write-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERF_CONFIG_PATH = join(__dirname, '..', 'config', 'perf.json');
const PERF_HISTORY_PATH = join(__dirname, '..', 'state', 'perf-history.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Record a perf run and detect regressions against the previous run.
 *
 * @param {object[]} perRoute - Current run data from auditPerf
 * @returns {{
 *   regressions: Array<{ route: string, metric: string, previous: number, current: number, deltaPct: number }>,
 *   recorded: boolean
 * }}
 */
export async function detectPerfRegressions(perRoute) {
  const config = loadJson(PERF_CONFIG_PATH, { regressions: {} });
  const thresholds = config.regressions || {};
  const history = loadJson(PERF_HISTORY_PATH, { runs: [] });

  // Build current run snapshot
  const currentRoutes = {};
  for (const entry of perRoute) {
    currentRoutes[entry.route] = {
      htmlBytes: entry.htmlBytes,
      scripts: entry.scripts,
      inlineJsBytes: entry.inlineJsBytes,
    };
  }

  const currentRun = {
    runAt: new Date().toISOString(),
    routes: currentRoutes,
  };

  // Get previous run for comparison
  const previousRun = history.runs.length > 0
    ? history.runs[history.runs.length - 1]
    : null;

  const regressions = [];

  if (previousRun && previousRun.routes) {
    for (const [route, current] of Object.entries(currentRoutes)) {
      const prev = previousRun.routes[route];
      if (!prev) continue;

      // htmlBytes regression
      if (thresholds.htmlBytesPct && prev.htmlBytes > 0) {
        const delta = (current.htmlBytes - prev.htmlBytes) / prev.htmlBytes;
        if (delta > thresholds.htmlBytesPct) {
          regressions.push({
            route,
            metric: 'htmlBytes',
            previous: prev.htmlBytes,
            current: current.htmlBytes,
            deltaPct: Math.round(delta * 1000) / 1000,
          });
        }
      }

      // scriptCount regression
      if (thresholds.scriptCount && prev.scripts > 0) {
        const delta = (current.scripts - prev.scripts) / prev.scripts;
        if (delta > thresholds.scriptCount) {
          regressions.push({
            route,
            metric: 'scripts',
            previous: prev.scripts,
            current: current.scripts,
            deltaPct: Math.round(delta * 1000) / 1000,
          });
        }
      }
    }
  }

  // Append and trim history (keep last 60 runs)
  history.runs.push(currentRun);
  if (history.runs.length > 60) {
    history.runs = history.runs.slice(-60);
  }

  await writeJsonStable(PERF_HISTORY_PATH, history, 'perfHistory');

  return { regressions, recorded: true };
}
