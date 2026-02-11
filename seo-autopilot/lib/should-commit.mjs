#!/usr/bin/env node
/**
 * should-commit.mjs
 *
 * Determines whether the current working-tree changes justify a git commit.
 * Callable as a module (import) or as a CLI script (exit code 0 = commit, 1 = skip).
 *
 * Rules — commit only if ANY of these are true:
 *   1. Source files outside seo-autopilot/state/ changed  (HTML, config, fixers, etc.)
 *   2. A critical tech issue count changed (before vs after audit)
 *   3. An experiment was applied or reverted
 *   4. A content action occurred (publish, refresh, area expansion)
 *
 * If none apply, the run was purely observational (state/score churn) — skip commit.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, '..', 'report', 'latest.json');

/**
 * @returns {{ shouldCommit: boolean, reasons: string[] }}
 */
export function shouldCommit() {
  const reasons = [];

  // 1. Check git diff for files outside seo-autopilot/state/ and seo-autopilot/report/
  try {
    const diff = execSync('git diff --name-only HEAD', { encoding: 'utf-8' }).trim();
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' }).trim();
    const allChanged = [...diff.split('\n'), ...untracked.split('\n')].filter(Boolean);

    const meaningfulFiles = allChanged.filter(f =>
      !f.startsWith('seo-autopilot/state/') &&
      !f.startsWith('seo-autopilot/report/')
    );

    if (meaningfulFiles.length > 0) {
      reasons.push(`source_files_changed: ${meaningfulFiles.slice(0, 5).join(', ')}`);
    }
  } catch {
    // If git fails, assume we should commit (safe default)
    reasons.push('git_diff_failed');
  }

  // 2-4. Check the report for meaningful actions
  try {
    const report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));

    // 2. Critical tech issue count changed
    if (report.diff) {
      const criticalCodes = [
        'MISSING_CANONICAL', 'BROKEN_INTERNAL_LINK', 'NOINDEX_ON_RANK_INTENT',
        'MISSING_TITLE', 'DUPLICATE_TITLE', 'MISSING_META_DESCRIPTION',
      ];
      for (const code of criticalCodes) {
        if (report.diff[code] && report.diff[code].delta !== 0) {
          reasons.push(`critical_delta: ${code} ${report.diff[code].delta > 0 ? '+' : ''}${report.diff[code].delta}`);
          break;
        }
      }
    }

    // 3. Experiment applied or reverted
    if (report.experiments?.applied?.length > 0) {
      reasons.push(`experiments_applied: ${report.experiments.applied.length}`);
    }
    if (report.experiments?.evaluated?.length > 0) {
      const reverted = report.experiments.evaluated.filter(e => e.result === 'REVERT');
      if (reverted.length > 0) {
        reasons.push(`experiments_reverted: ${reverted.length}`);
      }
    }

    // 4. Content action
    if (report.content?.action && report.content.action !== 'none') {
      reasons.push(`content_action: ${report.content.action}`);
    }

    // Area expansion
    if (report.areas?.selected && report.areas.reason !== 'reverted_near_duplicate') {
      reasons.push(`area_expanded: ${report.areas.selected}`);
    }

    // Money page enhancement
    if (report.moneyEnhancements?.length > 0) {
      const applied = report.moneyEnhancements.filter(m => m.blockUpdated);
      if (applied.length > 0) {
        reasons.push(`money_enhanced: ${applied.length}`);
      }
    }

    // Striking refresh
    if (report.strikingRefresh?.action === 'refresh') {
      reasons.push(`striking_refresh: ${report.strikingRefresh.targetPagePath}`);
    }
  } catch {
    // If report is unreadable, fall through to git-based check only
  }

  return {
    shouldCommit: reasons.length > 0,
    reasons,
  };
}

// CLI mode: exit 0 = should commit, exit 1 = skip
if (process.argv[1] && process.argv[1].includes('should-commit')) {
  const result = shouldCommit();
  if (result.shouldCommit) {
    console.log(`[should-commit] YES — ${result.reasons.join('; ')}`);
    process.exit(0);
  } else {
    console.log('[should-commit] NO — no meaningful changes');
    process.exit(1);
  }
}
