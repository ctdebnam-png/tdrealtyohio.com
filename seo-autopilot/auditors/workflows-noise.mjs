/**
 * workflows-noise.mjs
 *
 * Deterministic auditor that scans GitHub Actions workflows for "noise risk":
 * push triggers, PR bots, issue creation, failure-prone steps.
 * Produces a bounded report. Never fails.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');

// Patterns that indicate PR/issue creation
const PR_BOT_PATTERNS = [
  { pattern: /peter-evans\/create-pull-request/i, signal: 'create-pull-request action' },
  { pattern: /gh\s+pr\s+create/i, signal: 'gh pr create' },
  { pattern: /github\.rest\.pulls\.create/i, signal: 'github.rest.pulls.create' },
];

const ISSUE_COMMENT_PATTERNS = [
  { pattern: /gh\s+issue\s+create/i, signal: 'gh issue create' },
  { pattern: /github\.rest\.issues\.create/i, signal: 'github.rest.issues.create' },
  { pattern: /github\.rest\.issues\.createComment/i, signal: 'github.rest.issues.createComment' },
];

const FAIL_PRONE_PATTERNS = [
  { pattern: /exit\s+1/, signal: 'exit 1' },
  { pattern: /set\s+-e/, signal: 'set -e' },
];

/**
 * Audit all workflow files for noise risk.
 * @returns {{ checkedAt, workflows, summary }}
 */
export function auditWorkflowNoise() {
  const checkedAt = new Date().toISOString();
  const workflows = [];

  let files;
  try {
    files = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch {
    return {
      checkedAt,
      workflows: [],
      summary: { workflowsTotal: 0, pushTriggeredCount: 0, prTriggeredCount: 0, prBotCount: 0, likelyFailCount: 0 },
    };
  }

  for (const file of files) {
    const filePath = join(WORKFLOWS_DIR, file);
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    let doc;
    try {
      doc = YAML.parse(content);
    } catch {
      workflows.push({
        file: `.github/workflows/${file}`,
        name: file,
        triggers: [],
        risk: { runsOnPush: false, runsOnPR: false, prBotSignals: [], issueCommentSignals: [], likelyToFailSignals: [], notes: ['YAML parse error'] },
      });
      continue;
    }

    if (!doc) continue;

    // Extract triggers
    const triggers = extractTriggers(doc.on || doc.true || {});
    const runsOnPush = triggers.includes('push');
    const runsOnPR = triggers.includes('pull_request') || triggers.includes('pull_request_target');

    // Scan all steps for bot/fail signals
    const prBotSignals = [];
    const issueCommentSignals = [];
    const likelyToFailSignals = [];
    const notes = [];

    const stepsContent = extractAllStepsContent(doc);

    for (const { pattern, signal } of PR_BOT_PATTERNS) {
      if (pattern.test(stepsContent)) {
        prBotSignals.push(signal);
      }
    }
    for (const { pattern, signal } of ISSUE_COMMENT_PATTERNS) {
      if (pattern.test(stepsContent)) {
        issueCommentSignals.push(signal);
      }
    }
    for (const { pattern, signal } of FAIL_PRONE_PATTERNS) {
      if (pattern.test(stepsContent)) {
        likelyToFailSignals.push(signal);
      }
    }

    // Check for concurrency/matrix (informational)
    if (doc.concurrency) notes.push('has concurrency');
    const jobs = doc.jobs || {};
    for (const [, job] of Object.entries(jobs)) {
      if (job?.strategy?.matrix) notes.push('has matrix');
    }

    workflows.push({
      file: `.github/workflows/${file}`,
      name: doc.name || file,
      triggers,
      risk: { runsOnPush, runsOnPR, prBotSignals, issueCommentSignals, likelyToFailSignals, notes },
    });
  }

  const summary = {
    workflowsTotal: workflows.length,
    pushTriggeredCount: workflows.filter(w => w.risk.runsOnPush).length,
    prTriggeredCount: workflows.filter(w => w.risk.runsOnPR).length,
    prBotCount: workflows.filter(w => w.risk.prBotSignals.length > 0).length,
    likelyFailCount: workflows.filter(w => w.risk.likelyToFailSignals.length > 0).length,
  };

  return { checkedAt, workflows, summary };
}

/**
 * Extract trigger names from the `on` field of a workflow.
 */
function extractTriggers(on) {
  if (!on) return [];
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String);
  if (typeof on === 'object') return Object.keys(on);
  return [];
}

/**
 * Extract all step run/uses content as a single string for pattern matching.
 */
function extractAllStepsContent(doc) {
  const parts = [];
  const jobs = doc.jobs || {};
  for (const [, job] of Object.entries(jobs)) {
    const steps = job?.steps || [];
    for (const step of steps) {
      if (step.run) parts.push(String(step.run));
      if (step.uses) parts.push(String(step.uses));
      if (step.with?.script) parts.push(String(step.with.script));
    }
  }
  return parts.join('\n');
}
