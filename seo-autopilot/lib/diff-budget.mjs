/**
 * diff-budget.mjs
 *
 * Runs git diff --numstat to measure change scope and checks
 * against configurable budgets. Never throws.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SAFETY_PATH = join(__dirname, '..', 'config', 'safety.json');

function loadSafety() {
  try { return JSON.parse(readFileSync(SAFETY_PATH, 'utf-8')); }
  catch { return { budgets: {} }; }
}

/**
 * Check diff budget against safety limits.
 *
 * @param {object} options
 * @param {string} options.baselineSha - The SHA to diff against (HEAD~1 if omitted)
 * @returns {{ ok: boolean, reason: string, stats: object }}
 */
export function checkDiffBudget({ baselineSha } = {}) {
  const safety = loadSafety();
  const budgets = safety.budgets || {};

  let numstat;
  try {
    const ref = baselineSha || 'HEAD~1';
    numstat = execSync(`git diff --numstat ${ref}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
  } catch (err) {
    // Git not available or diff failed — allow the run
    console.warn(`[diff-budget] git diff failed (non-fatal): ${err.message}`);
    return { ok: true, reason: 'git_unavailable', stats: {} };
  }

  if (!numstat) {
    return { ok: true, reason: 'no_changes', stats: { filesChanged: 0, linesAdded: 0, linesDeleted: 0, totalLinesChanged: 0 } };
  }

  let filesChanged = 0;
  let linesAdded = 0;
  let linesDeleted = 0;

  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue;
    const [added, deleted] = line.split('\t');
    // Binary files show '-' for added/deleted
    if (added === '-' || deleted === '-') {
      filesChanged++;
      continue;
    }
    linesAdded += parseInt(added, 10) || 0;
    linesDeleted += parseInt(deleted, 10) || 0;
    filesChanged++;
  }

  const totalLinesChanged = linesAdded + linesDeleted;
  const stats = { filesChanged, linesAdded, linesDeleted, totalLinesChanged };

  const reasons = [];
  if (budgets.maxFilesChanged && filesChanged > budgets.maxFilesChanged) {
    reasons.push(`files: ${filesChanged} > ${budgets.maxFilesChanged}`);
  }
  if (budgets.maxLinesChanged && totalLinesChanged > budgets.maxLinesChanged) {
    reasons.push(`lines: ${totalLinesChanged} > ${budgets.maxLinesChanged}`);
  }

  if (reasons.length > 0) {
    return { ok: false, reason: `budget_exceeded: ${reasons.join(', ')}`, stats };
  }

  return { ok: true, reason: 'within_budget', stats };
}
