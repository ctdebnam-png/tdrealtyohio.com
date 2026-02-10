/**
 * snapshot.mjs
 *
 * Manages "last known good" snapshots for recovery.
 * Stores snapshot metadata under seo-autopilot/state/snapshots/ (gitignored).
 * Tracks lastGoodSha in state.json for hard-reset recovery.
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, unlinkSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SNAPSHOTS_DIR = join(__dirname, '..', 'state', 'snapshots');
const SAFETY_PATH = join(__dirname, '..', 'config', 'safety.json');

function loadSafety() {
  try { return JSON.parse(readFileSync(SAFETY_PATH, 'utf-8')); }
  catch { return { snapshots: { keepRuns: 14 } }; }
}

/**
 * Get the current HEAD SHA.
 * @returns {string|null}
 */
export function getHeadSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

/**
 * Save a snapshot metadata file.
 *
 * @param {object} options
 * @param {string} options.headSha - The HEAD SHA at snapshot time
 * @param {string} options.reason - Why the snapshot was taken (e.g., 'pre_run', 'post_run_ok')
 * @param {object} options.audits - Summary audit data
 * @param {string} options.focus - The focus decision
 * @returns {Promise<string>} - Path to saved snapshot file
 */
export async function saveSnapshot({ headSha, reason, audits = {}, focus = '' } = {}) {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });

  const metadata = {
    runAt: new Date().toISOString(),
    headSha: headSha || getHeadSha() || 'unknown',
    reason,
    audits,
    focus,
  };

  const filename = `snapshot-${metadata.runAt.replace(/[:.]/g, '-')}.json`;
  const filepath = join(SNAPSHOTS_DIR, filename);
  await writeFile(filepath, JSON.stringify(metadata, null, 2) + '\n');

  // Prune old snapshots
  const safety = loadSafety();
  const keepRuns = safety.snapshots?.keepRuns || 14;
  await pruneSnapshots(keepRuns);

  return filepath;
}

/**
 * Keep only the most recent N snapshot files.
 */
async function pruneSnapshots(keepRuns) {
  try {
    const files = readdirSync(SNAPSHOTS_DIR)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort();

    if (files.length > keepRuns) {
      const toDelete = files.slice(0, files.length - keepRuns);
      for (const f of toDelete) {
        unlinkSync(join(SNAPSHOTS_DIR, f));
      }
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Revert working tree to a given SHA using git reset --hard.
 *
 * @param {string} sha - The SHA to reset to
 * @returns {{ ok: boolean, reason: string }}
 */
export function revertToSha(sha) {
  if (!sha) return { ok: false, reason: 'no_sha_provided' };

  try {
    execSync(`git reset --hard ${sha}`, { cwd: ROOT, encoding: 'utf-8', timeout: 10000 });
    return { ok: true, reason: `reverted to ${sha}` };
  } catch (err) {
    return { ok: false, reason: `git reset failed: ${err.message}` };
  }
}
