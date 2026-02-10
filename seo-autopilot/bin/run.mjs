#!/usr/bin/env node
/**
 * SEO Autopilot — main entry point
 *
 * This script is invoked by the seo-autopilot GitHub Actions workflow.
 * It always exits 0 so the workflow never fails.
 *
 * Pipeline:
 * 1. Detect build output directory
 * 2. Run before-audit on existing HTML
 * 3. Apply metadata fixer (OG/Twitter tags)
 * 4. Run after-audit and compute diff
 * 5. Write report with before/after comparison
 */

import { readFileSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { detectBuildOutput } from '../lib/detect-build-output.mjs';
import { listHtmlPages } from '../lib/list-html-pages.mjs';
import { runBuildAudit, printAuditSummary } from '../auditors/build-audit.mjs';
import { fixMetadata } from '../fixers/metadata-fixer.mjs';

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

/**
 * Compute the diff between before and after issue counts.
 */
function computeDiff(before, after) {
  const diff = {};
  const allCodes = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const code of allCodes) {
    const b = (before || {})[code] || 0;
    const a = (after || {})[code] || 0;
    if (b !== a) {
      diff[code] = { before: b, after: a, delta: a - b };
    }
  }
  return diff;
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
    beforeAudit: null,
    afterAudit: null,
    diff: null,
    fixerResults: null,
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

  if (buildOutput.mode === 'static-html') {
    // Step 2: Before-audit
    let pages;
    try {
      pages = listHtmlPages(buildOutput.outputDir, {
        canonicalStrategy: config.canonicalStrategy,
      });
      console.log(`[seo-autopilot] Found ${pages.length} HTML page(s)`);

      const beforeAudit = runBuildAudit(pages, config);
      report.beforeAudit = {
        pagesScanned: beforeAudit.totals.pagesScanned,
        issuesTotal: beforeAudit.totals.issuesTotal,
        issueCounts: beforeAudit.totals.issueCounts,
      };

      console.log('\n=== BEFORE FIXES ===');
      printAuditSummary(beforeAudit);
    } catch (err) {
      report.errors.push(`beforeAudit: ${err.message}`);
      console.error('[seo-autopilot] Before-audit error (non-fatal):', err.message);
    }

    // Step 3: Apply metadata fixer
    if (pages) {
      try {
        const fixResult = fixMetadata(pages);
        report.fixerResults = {
          filesChanged: fixResult.filesChanged,
          tagsAdded: fixResult.tagsAdded,
          details: fixResult.details,
        };
        console.log(`[seo-autopilot] Metadata fixer: ${fixResult.filesChanged} file(s) changed, ${fixResult.tagsAdded} tag(s) added`);
      } catch (err) {
        report.errors.push(`metadataFixer: ${err.message}`);
        console.error('[seo-autopilot] Metadata fixer error (non-fatal):', err.message);
      }
    }

    // Step 4: After-audit
    if (pages) {
      try {
        // Re-enumerate to pick up any changes
        const afterPages = listHtmlPages(buildOutput.outputDir, {
          canonicalStrategy: config.canonicalStrategy,
        });
        const afterAudit = runBuildAudit(afterPages, config);
        report.afterAudit = {
          pagesScanned: afterAudit.totals.pagesScanned,
          issuesTotal: afterAudit.totals.issuesTotal,
          issueCounts: afterAudit.totals.issueCounts,
          samples: afterAudit.samples,
          pages: afterAudit.pages,
        };

        console.log('\n=== AFTER FIXES ===');
        printAuditSummary(afterAudit);

        // Step 5: Compute diff
        if (report.beforeAudit) {
          report.diff = computeDiff(
            report.beforeAudit.issueCounts,
            report.afterAudit.issueCounts,
          );

          // Print diff summary
          const diffEntries = Object.entries(report.diff);
          if (diffEntries.length > 0) {
            console.log('=== DIFF (before -> after) ===');
            for (const [code, { before, after, delta }] of diffEntries) {
              const sign = delta > 0 ? '+' : '';
              console.log(`  ${code}: ${before} -> ${after} (${sign}${delta})`);
            }
            console.log('');
          }
        }

        report.notes = `Before: ${report.beforeAudit?.issuesTotal ?? '?'} issues. After: ${afterAudit.totals.issuesTotal} issues.`;
      } catch (err) {
        report.errors.push(`afterAudit: ${err.message}`);
        console.error('[seo-autopilot] After-audit error (non-fatal):', err.message);
      }
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
