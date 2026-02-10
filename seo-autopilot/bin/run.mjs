#!/usr/bin/env node
/**
 * SEO Autopilot — main entry point
 *
 * This script is invoked by the seo-autopilot GitHub Actions workflow.
 * It always exits 0 so the workflow never fails.
 *
 * Pipeline:
 * 1. Detect build output directory
 * 2. If static-html: enumerate pages, run build audit, write report
 * 3. If not static-html: write report noting scan was skipped
 */

import { readFileSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { detectBuildOutput } from '../lib/detect-build-output.mjs';
import { listHtmlPages } from '../lib/list-html-pages.mjs';
import { runBuildAudit, printAuditSummary } from '../auditors/build-audit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REPORT_DIR = join(__dirname, '..', 'report');
const CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    console.warn('[seo-autopilot] Could not load site.json — using defaults');
    return { baseUrl: '', canonicalStrategy: 'slash', utilityRoutesNoIndex: [] };
  }
}

async function main() {
  const start = Date.now();
  console.log('[seo-autopilot] Starting run…');

  // Ensure report directory exists
  await mkdir(REPORT_DIR, { recursive: true });

  const config = loadConfig();

  const report = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    buildOutput: null,
    totals: null,
    pages: [],
    samples: null,
    notes: '',
    errors: [],
  };

  // Step 1: Detect build output
  let buildOutput;
  try {
    buildOutput = detectBuildOutput(ROOT);
  } catch (err) {
    buildOutput = { outputDir: ROOT, mode: 'unknown', reason: `Detection error: ${err.message}` };
    report.errors.push(`detectBuildOutput: ${err.message}`);
  }
  report.buildOutput = buildOutput;
  console.log(`[seo-autopilot] Build output: ${buildOutput.mode} — ${buildOutput.reason}`);

  // Step 2: Run audit if static HTML is available
  if (buildOutput.mode === 'static-html') {
    try {
      const pages = listHtmlPages(buildOutput.outputDir, {
        canonicalStrategy: config.canonicalStrategy,
      });
      console.log(`[seo-autopilot] Found ${pages.length} HTML page(s)`);

      const audit = runBuildAudit(pages, config);
      report.totals = audit.totals;
      report.pages = audit.pages;
      report.samples = audit.samples;
      report.notes = `Scanned ${audit.totals.pagesScanned} pages, found ${audit.totals.issuesTotal} issue(s).`;

      printAuditSummary(audit);
    } catch (err) {
      report.errors.push(`buildAudit: ${err.message}`);
      report.notes = `Build audit failed: ${err.message}`;
      console.error('[seo-autopilot] Build audit error (non-fatal):', err.message);
    }
  } else if (buildOutput.mode === 'ssr-unknown') {
    report.notes = 'SSR output not available; skipping html scan.';
    console.log('[seo-autopilot] SSR output not available; skipping html scan');
  } else {
    report.notes = `Build output mode "${buildOutput.mode}" — html scan skipped.`;
    console.log(`[seo-autopilot] Mode "${buildOutput.mode}" — html scan skipped`);
  }

  report.durationMs = Date.now() - start;

  await writeFile(
    join(REPORT_DIR, 'latest.json'),
    JSON.stringify(report, null, 2) + '\n',
  );

  console.log(`[seo-autopilot] Done in ${report.durationMs}ms`);
}

main().catch((err) => {
  console.error('[seo-autopilot] Unexpected error (non-fatal):', err);
  // Always exit 0 so the workflow never fails
  process.exit(0);
});
