#!/usr/bin/env node
/**
 * Regression Guardrails for TD Realty Ohio
 * Fails the build if rendered HTML output contains banned strings.
 *
 * Checks:
 *  1. No "Testimonials" link or label in any public HTML nav/footer
 *  2. No "By Travis Debnam" in any public HTML
 *  3. No deprecated phone "614-956-8656" (any variant)
 *  4. No personal email "travisdrealtor@gmail.com" in public output
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let errors = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  errors++;
}

/**
 * Recursively find all HTML files in the deploy root
 * (skip node_modules, scripts, audit, etc.)
 */
async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'scripts' ||
        entry.name === 'templates' ||
        entry.name === 'tools' ||
        entry.name === 'reports' ||
        entry.name === 'output' ||
        entry.name === 'data' ||
        entry.name === 'admin' ||
        entry.name === 'audit' ||
        entry.name.startsWith('audit-')
      ) continue;
      await findHtmlFiles(full, files);
    } else if (entry.name.endsWith('.html') && entry.name !== '404.html') {
      files.push(full);
    }
  }
  return files;
}

const BANNED = [
  {
    label: '"Testimonials" link',
    test: (html) => /href=["'][^"']*testimonials[^"']*["']/i.test(html) ||
                     /<a[^>]*>[^<]*Testimonials[^<]*<\/a>/i.test(html),
  },
  {
    label: '"By Travis Debnam"',
    test: (html) => /By Travis Debnam/i.test(html),
  },
  {
    label: 'Deprecated phone 614-956-8656',
    test: (html) => ['614-956-8656', '614.956.8656', '(614) 956-8656', '6149568656']
                       .some(v => html.includes(v)),
  },
  {
    label: 'Personal email travisdrealtor@gmail.com',
    test: (html) => html.includes('travisdrealtor@gmail.com'),
  },
];

async function main() {
  console.log('check-regressions: scanning public HTML...');
  const htmlFiles = await findHtmlFiles(ROOT);
  console.log(`  Found ${htmlFiles.length} HTML files`);

  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf-8');
    const rel = filePath.replace(ROOT + '/', '');

    for (const { label, test } of BANNED) {
      if (test(html)) {
        fail(`${rel}: contains ${label}`);
      }
    }
  }

  if (errors > 0) {
    console.error(`\ncheck-regressions: ${errors} error(s) found`);
    process.exit(1);
  }
  console.log('check-regressions: all checks passed ✓');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
