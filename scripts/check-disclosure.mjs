#!/usr/bin/env node
/**
 * WP-10. TD Environmental Ohio, LLC is a separate company, and the footer of
 * each site says so in one sentence that is identical on both.
 *
 * This checks the SHIPPED HTML, not the constant. A constant proves only that
 * the string exists in the repository; what matters is whether the sentence
 * reached the page a visitor reads. A footer edit that drops the paragraph
 * leaves src/config/related-entity.js untouched and the disclosure gone.
 *
 * Three things are checked on every public page:
 *
 *   1. the cross-link to the environmental site is present
 *   2. the disclosure sentence is present, verbatim
 *   3. neither appears without the other
 *
 * (3) is the one that matters. A cross-link without the disclosure is exactly
 * what the disclosure exists to prevent — two companies presented as one — and
 * the sentence without the link is a claim about a company the reader cannot go
 * and check.
 *
 * The td-environmental repo runs the mirror of this, scripts/check-disclosure.ts,
 * against the same sentence. If the two ever disagree, both builds fail rather
 * than one site quietly describing the relationship differently from the other.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RELATED_ENTITY } = require('../src/config/related-entity.js');

const SKIP_DIRS = new Set(['node_modules', '.git', '.playwright', 'reports', 'scripts', 'src', 'tests', 'functions']);

const htmlFiles = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...htmlFiles(path));
    else if (entry.endsWith('.html')) out.push(path);
  }
  return out;
};

/*
 * The sentence carries a straight apostrophe in "other's". Pages are authored
 * by hand here, so compare against both spellings rather than assuming which
 * one an editor will leave behind — a gate that fails on a typographic
 * apostrophe teaches people to bypass it.
 */
const SENTENCE = RELATED_ENTITY.disclosure;
const VARIANTS = [SENTENCE, SENTENCE.replace(/'/g, '&#39;'), SENTENCE.replace(/'/g, '’')];

const pages = htmlFiles('.');
if (pages.length === 0) {
  console.error('No HTML pages found. Run this from the repository root.');
  process.exit(1);
}

const problems = [];
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const hasLink = html.includes(RELATED_ENTITY.url);
  const hasSentence = VARIANTS.some((variant) => html.includes(variant));

  if (hasLink && !hasSentence) problems.push([page, 'links to the environmental site with NO disclosure sentence']);
  else if (hasSentence && !hasLink) problems.push([page, 'carries the disclosure sentence but does NOT link to the site']);
  else if (!hasLink && !hasSentence) problems.push([page, 'has neither the cross-link nor the disclosure']);
}

if (problems.length > 0) {
  console.error(`Cross-entity disclosure check FAILED on ${problems.length} page(s):\n`);
  for (const [page, why] of problems) console.error(`  ${page}\n      ${why}`);
  console.error(`\n  Expected in the footer of every public page, verbatim:\n    ${SENTENCE}`);
  console.error(`  and a link to ${RELATED_ENTITY.url}\n`);
  console.error('  The link and the sentence travel together. Footer only, never nav.');
  process.exit(1);
}

console.log(
  `Cross-entity disclosure check passed: ${pages.length} page(s) carry the link and the sentence.`,
);
