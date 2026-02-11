/**
 * workflows-quiet-mode.mjs
 *
 * Optional auto-remediation fixer that removes push/pull_request triggers
 * from workflows not in the allowlist. Off by default.
 *
 * Enable with env: SEO_AUTOPILOT_FIX_WORKFLOWS=1
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');
const ALLOWLIST_PATH = join(__dirname, '..', 'config', 'workflows-allowlist.json');

const NOISY_TRIGGERS = ['push', 'pull_request', 'pull_request_target', 'issue_comment', 'issues'];

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Fix noisy workflow triggers.
 * Only runs if SEO_AUTOPILOT_FIX_WORKFLOWS=1.
 *
 * @param {Array} noisyWorkflows - workflows with push/PR triggers from the auditor
 * @returns {{ enabled, filesFixed, details }}
 */
export function fixWorkflowsQuietMode(noisyWorkflows = []) {
  if (process.env.SEO_AUTOPILOT_FIX_WORKFLOWS !== '1') {
    return { enabled: false, filesFixed: 0, details: ['disabled'] };
  }

  const allowlist = loadJson(ALLOWLIST_PATH, { keepTriggersFor: [] });
  const keepSet = new Set(allowlist.keepTriggersFor || []);

  // Never touch the autopilot workflow itself
  keepSet.add('seo-autopilot.yml');
  keepSet.add('seo-autopilot.yaml');

  let filesFixed = 0;
  const details = [];

  for (const wf of noisyWorkflows) {
    const filename = wf.file.split('/').pop();
    if (keepSet.has(filename)) {
      details.push(`skip: ${filename} (allowlisted)`);
      continue;
    }

    // Skip deploy/pages workflows even if not explicitly allowlisted
    if (/deploy|pages/i.test(filename)) {
      details.push(`skip: ${filename} (deploy/pages)`);
      continue;
    }

    const filePath = join(WORKFLOWS_DIR, filename);
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      details.push(`skip: ${filename} (unreadable)`);
      continue;
    }

    let doc;
    try {
      doc = YAML.parse(content);
    } catch {
      details.push(`skip: ${filename} (unparseable)`);
      continue;
    }

    if (!doc || !doc.on) continue;

    const on = doc.on;
    let changed = false;

    if (typeof on === 'object' && !Array.isArray(on)) {
      for (const trigger of NOISY_TRIGGERS) {
        if (trigger in on) {
          delete on[trigger];
          changed = true;
        }
      }

      // Ensure at least workflow_dispatch remains
      if (Object.keys(on).length === 0) {
        on.workflow_dispatch = null;
      }
    }

    if (changed) {
      try {
        const updated = YAML.stringify(doc, { lineWidth: 0 });
        writeFileSync(filePath, updated, 'utf-8');
        filesFixed++;
        details.push(`fixed: ${filename}`);
      } catch (err) {
        details.push(`error: ${filename}: ${err.message}`);
      }
    }
  }

  return { enabled: true, filesFixed, details };
}
