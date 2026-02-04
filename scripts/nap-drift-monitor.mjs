#!/usr/bin/env node
/**
 * NAP Drift Monitor
 * Scans production HTML files for old/incorrect business contact info
 * and mismatches against canonical business facts.
 *
 * Usage: node scripts/nap-drift-monitor.mjs [--production]
 *   Default: scans local files
 *   --production: fetches live pages from tdrealtyohio.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, '..');

// ── Canonical business facts (do NOT edit — matches locked config) ──
const CANONICAL = {
  phone: '(614) 392-8858',
  phoneRaw: '6143928858',
  email: 'info@tdrealtyohio.com',
  brokerLicense: '2023006467',
  brokerageLicense: '2023006602',
  broker: 'Travis Debnam',
  company: 'TD Realty Ohio, LLC',
  location: 'Westerville, Ohio',
  address: '3600 Tremont Rd Ste 250',
};

// ── Known old / wrong values to flag ──
const OLD_VALUES = [
  { pattern: /614[\-.\s]?956[\-.\s]?8656/g, label: 'Old phone number 614-956-8656' },
  { pattern: /614[\-.\s]?555[\-.\s]?\d{4}/g, label: 'Placeholder 614-555-xxxx phone' },
];

// ── Required facts per page (at least one must appear in each non-noindex HTML) ──
const REQUIRED_FACTS = [
  { pattern: /\(614\)\s*392-8858|6143928858/g, label: 'Phone' },
  { pattern: /info@tdrealtyohio\.com/g, label: 'Email' },
  { pattern: /2023006602/g, label: 'Brokerage license' },
];

function getHtmlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') ||
        ['node_modules', 'templates', 'data', 'tools', 'reports', 'output', 'scripts'].includes(entry.name) ||
        entry.name.startsWith('audit-')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

function isNoindex(html) {
  return /meta\s[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

function scan() {
  const files = getHtmlFiles(SITE_ROOT);
  const errors = [];
  const warnings = [];

  for (const file of files) {
    const rel = path.relative(SITE_ROOT, file);
    const html = fs.readFileSync(file, 'utf-8');

    // Check for old/incorrect values
    for (const { pattern, label } of OLD_VALUES) {
      pattern.lastIndex = 0;
      const match = pattern.exec(html);
      if (match) {
        errors.push({ file: rel, message: `${label} found: "${match[0]}"` });
      }
    }

    // Skip noindex pages for required-fact checks
    if (isNoindex(html)) continue;

    // Check required business facts are present
    for (const { pattern, label } of REQUIRED_FACTS) {
      pattern.lastIndex = 0;
      if (!pattern.test(html)) {
        warnings.push({ file: rel, message: `Missing ${label}` });
      }
    }
  }

  return { files: files.length, errors, warnings };
}

// ── Run ──
const result = scan();
const passed = result.errors.length === 0;

console.log(`\nNAP Drift Monitor`);
console.log(`${'='.repeat(50)}`);
console.log(`Files scanned: ${result.files}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Warnings: ${result.warnings.length}`);
console.log(`Status: ${passed ? 'PASS' : 'FAIL'}\n`);

if (result.errors.length > 0) {
  console.log('ERRORS (old/incorrect business info):');
  for (const e of result.errors) {
    console.log(`  ✗ ${e.file}: ${e.message}`);
  }
  console.log('');
}

if (result.warnings.length > 0) {
  console.log('WARNINGS (missing required business facts):');
  for (const w of result.warnings) {
    console.log(`  ⚠ ${w.file}: ${w.message}`);
  }
  console.log('');
}

// Write report
const report = {
  timestamp: new Date().toISOString(),
  passed,
  filesScanned: result.files,
  errors: result.errors,
  warnings: result.warnings,
};

const reportDir = path.join(SITE_ROOT, 'reports', 'nap-drift');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(
  path.join(reportDir, 'latest.json'),
  JSON.stringify(report, null, 2)
);

process.exit(passed ? 0 : 1);
