#!/usr/bin/env node
/**
 * Offer-era language and machinery, in the files that do NOT ship.
 *
 * check:forbidden-terms scans the ten shipped pages plus main.js, nav.js and
 * _redirects. That is the right scope for "what a visitor can read", and it is
 * why a 57 KB calculator module, five page generators for retired families, and
 * a Python content pipeline all sat in the repo for months without a single
 * gate noticing: none of them ships, so nothing looked at them.
 *
 * This gate looks at them. Source, scripts, config and content — the machinery
 * that could rebuild the offer era, not the pages that display it.
 *
 * WHAT IT DOES NOT SCAN, and why
 *
 *   CSS. styles.css carries .savings, .calculator and .tool- rules. Those are
 *   dead weight to prune, not an offer being made; a class name is not copy. If
 *   they are ever rendered they fail check:forbidden-terms on the page, which
 *   is the right place to catch it.
 *
 *   src/config/gone-urls.mjs. It is a list of URLs that must never resolve
 *   again, so it necessarily names /1-percent-commission/ and
 *   /compare/discount-broker-vs-full-service/. Naming a dead URL in order to
 *   kill it is the opposite of offering it.
 *
 *   This file and src/config/forbidden-source-terms.mjs, which contain the
 *   patterns by definition.
 *
 * NOT IN check:all YET, deliberately.
 *
 * It currently reports 111 findings in 12 files. Eleven of those twelve are
 * files already proposed for deletion and awaiting a go/no-go; the twelfth is
 * scripts/check-calculators.mjs, a gate that checks for calculator code the
 * site no longer has and which self-disables and always passes.
 *
 * Verified by running it with those eleven absent: only check-calculators.mjs
 * remains. So this joins check:all the moment the deletions land, and until
 * then `npm run check:source-terms` is the machine-readable version of the
 * Part 2.2 report. Wiring it in now would make check:all red pending a
 * decision that is not the build's to make; silencing any of it to get green
 * would defeat the point of writing it.
 *
 * There is no /agents/ carve-out. 2.4 called for one until WP-4 landed; WP-4
 * has landed and the split percentages are gone, so the carve-out was never
 * needed. Do not add one back.
 */

import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SELF = new Set([
  'scripts/check-source-terms.mjs',
  // The sibling gate. Its TERM_RULES are the banned strings, so scanning it
  // reports the rules as violations of themselves.
  'scripts/check-forbidden-terms.mjs',
  // A list of dead URLs must be allowed to name them. See the header.
  'src/config/gone-urls.mjs',
]);

const SCANNED_EXT = /\.(m?js|ts|py|json|md)$/;
const SCANNED_DIRS = ['src', 'scripts', 'functions', 'assets/js'];

const TERM_RULES = [
  { name: 'rebate', regex: /\brebate(s|d)?\b/i },
  { name: 'cash back', regex: /\bcash[\s-]?back\b/i },
  { name: 'cashback', regex: /\bcashback\b/i },
  { name: 'commission comparison', regex: /commission\s+(comparison|savings)|compare\s+commission/i },
  { name: 'savings claim', regex: /\bsavings\b|\byou\s+keep\b/i },
  { name: 'percent-commission', regex: /(?<![\d.])[123]\s?%|\b(one|two|three)[\s-]percent\b|percent[\s-]commission/i },
  { name: 'discount', regex: /\bdiscount(s|ed|ing)?\b/i },
];

/**
 * Generators for page families that are retired and redirected. A file that
 * references one is a file that can rebuild pages the site has spent this much
 * effort removing — and two of these are still exposed as npm scripts.
 */
const RETIRED_GENERATORS = [
  'generate-compare-pages',
  'generate-new-compare-pages',
  'generate-tool-pages',
  'generate-zip-pages',
  'generate-city-pages',
  'generate-sitemap-page',
  'content-generator',
  'scaffold-blog-post',
  'blog-brief-generator',
];

const errors = [];

const tracked = (dir) => {
  try {
    return execSync(`git ls-files ${dir}`, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

console.log('[source-terms] scanning the files that do NOT ship...\n');

const files = SCANNED_DIRS.flatMap(tracked).filter((f) => SCANNED_EXT.test(f) && !SELF.has(f));

for (const rel of files) {
  /*
   * `git ls-files` lists what is TRACKED, which is not the same as what is on
   * disk: a file deleted but not yet committed is still listed. Reading it
   * blind throws ENOENT and takes the whole gate down silently — which is
   * exactly what happened the first time this was tested against a simulated
   * deletion, producing no output at all rather than a pass.
   */
  let content;
  try {
    content = await readFile(join(ROOT, rel), 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  content.split(/\r?\n/).forEach((line, index) => {
    for (const rule of TERM_RULES) {
      if (rule.regex.test(line)) {
        errors.push(`${rel}:${index + 1} offer-era term "${rule.name}"`);
      }
    }
  });
}

/* Generator references, including the npm scripts that expose them. */
const referrers = [...files, 'package.json'];
for (const rel of new Set(referrers)) {
  if (SELF.has(rel)) continue;
  let content;
  try {
    content = await readFile(join(ROOT, rel), 'utf-8');
  } catch {
    continue;
  }
  for (const generator of RETIRED_GENERATORS) {
    // A file naming itself is the file existing, which the term scan already
    // reports; this rule is about anything else keeping it reachable.
    if (rel.includes(generator)) continue;
    if (content.includes(generator)) {
      errors.push(`${rel}: references "${generator}", a generator for a retired page family`);
    }
  }
}

console.log(`  ${files.length} file(s) scanned across ${SCANNED_DIRS.join(', ')}`);
console.log('');

if (errors.length) {
  const byFile = new Map();
  for (const error of errors) {
    const file = error.split(':')[0];
    byFile.set(file, (byFile.get(file) || 0) + 1);
  }
  console.error(`[source-terms] FAILED — ${errors.length} finding(s) in ${byFile.size} file(s):\n`);
  for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(count).padStart(3)}  ${file}`);
  }
  console.error('\n  First 12:');
  errors.slice(0, 12).forEach((e) => console.error(`    - ${e}`));
  process.exit(1);
}

console.log('[source-terms] no offer-era language or machinery outside the shipped pages.');
