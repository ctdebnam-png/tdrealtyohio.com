#!/usr/bin/env node
/**
 * SEO Autopilot — main entry point
 *
 * This script is invoked by the seo-autopilot GitHub Actions workflow.
 * It always exits 0 so the workflow never fails.
 *
 * Current behaviour (foundation): log a timestamp and write a stub report.
 * Future chunks will add actual SEO analysis and fixes here.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REPORT_DIR = join(__dirname, '..', 'report');

async function main() {
  const start = Date.now();
  console.log('[seo-autopilot] Starting run…');

  // Ensure report directory exists
  await mkdir(REPORT_DIR, { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    filesChanged: 0,
    notes: 'Foundation skeleton — no SEO fixes applied yet.',
    errors: [],
  };

  // ── Future: SEO analysis and fixes will be added here ──

  report.durationMs = Date.now() - start;

  await writeFile(
    join(REPORT_DIR, 'latest.json'),
    JSON.stringify(report, null, 2) + '\n',
  );

  console.log(`[seo-autopilot] Done in ${report.durationMs}ms — ${report.filesChanged} file(s) changed`);
}

main().catch((err) => {
  console.error('[seo-autopilot] Unexpected error (non-fatal):', err);
  // Always exit 0 so the workflow never fails
  process.exit(0);
});
