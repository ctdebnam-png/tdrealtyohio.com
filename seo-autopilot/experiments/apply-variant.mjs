/**
 * apply-variant.mjs
 *
 * Applies experiment variants by updating route-meta.json and experiments state.
 * Also updates the HTML files via the metadata fixer integration.
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
    return { lockDays: 21 };
  }
}

/**
 * Apply a variant to a page.
 *
 * @param {object} options
 * @param {string} options.path - Route path
 * @param {string} options.title - New title
 * @param {string} options.description - New description
 * @param {string} options.existingTitle - Current title
 * @param {string} options.existingDescription - Current description
 * @param {object} options.baseline - { impressions7, clicks7, ctr7, pos7 }
 * @returns {{ applied: boolean, path: string }}
 */
export function applyVariant({ path, title, description, existingTitle, existingDescription, baseline }) {
  const config = loadExperimentsConfig();
  const routeMeta = loadJson(ROUTE_META_PATH);
  const expState = loadJson(EXPERIMENTS_STATE_PATH);

  if (!expState.pages) expState.pages = {};
  if (!expState.recentEdits) expState.recentEdits = [];

  // Update route-meta.json
  const previous = routeMeta[path] || {};
  routeMeta[path] = {
    ...previous,
    title: title,
    description: description,
  };
  saveJson(ROUTE_META_PATH, routeMeta);

  // Update experiments state
  const now = new Date();
  const lockUntil = new Date(now);
  lockUntil.setDate(lockUntil.getDate() + (config.lockDays || 21));

  expState.pages[path] = {
    status: 'running',
    startedAt: now.toISOString(),
    lockUntil: lockUntil.toISOString(),
    cooldownUntil: null,
    baseline: baseline || { impressions7: 0, clicks7: 0, ctr7: 0, pos7: 0 },
    variantApplied: { title, description },
    previous: {
      title: existingTitle || previous.title || '',
      description: existingDescription || previous.description || '',
    },
    extended: false,
    lastEvaluation: null,
  };

  expState.recentEdits.push({ path, editedAt: now.toISOString() });
  // Keep bounded
  if (expState.recentEdits.length > 50) {
    expState.recentEdits = expState.recentEdits.slice(-50);
  }

  saveJson(EXPERIMENTS_STATE_PATH, expState);

  return { applied: true, path };
}
