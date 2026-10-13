#!/usr/bin/env node
/**
 * Gone-list sanity check.
 *
 * src/config/gone-urls.mjs makes URLs answer 410 Gone — permanently, by
 * definition. That is a loaded gun pointed at the site: listing a live route
 * takes the page down and tells search engines never to come back, and unlike
 * a bad redirect it does not merely loop, it deletes.
 *
 * This is the same shape of mistake as the _redirects globs that matched their
 * own destinations and took /buyers/, /sellers/ and /areas/ off the site. That
 * one was survivable. This one is worse.
 *
 * Fails on:
 *   - any canonical route from src/config/routes.js appearing in the list
 *   - a glob, wildcard, query string or fragment — matching is exact by design
 *   - a path that is not rooted, or that lacks a trailing slash
 *   - duplicates
 *
 * It deliberately does NOT complain when a listed path also has a rule in
 * _redirects. That overlap is the design: Functions run before _redirects, so
 * the 410 wins while the path is listed, and removing it restores the 301.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { ROUTES } = require('../src/config/routes.js');
const { GONE_URLS, GONE_SET } = await import('../src/config/gone-urls.mjs');

const errors = [];

console.log('[gone-urls] Checking the 410 list cannot take a live page down...\n');

// 1. No canonical route may ever be listed.
const live = new Set(ROUTES.map((r) => r.path));
for (const url of GONE_URLS) {
  if (live.has(url)) {
    errors.push(`${url} is a CANONICAL ROUTE in routes.js — a 410 would take it off the site`);
  }
}

// 2. Shape. Exact paths only.
for (const url of GONE_URLS) {
  if (/[*?#]/.test(url)) {
    errors.push(`${url} contains a glob, query or fragment — matching is exact, one path per entry`);
    continue;
  }
  if (!url.startsWith('/')) {
    errors.push(`${url} is not a rooted path`);
    continue;
  }
  if (!url.endsWith('/')) {
    errors.push(`${url} has no trailing slash — the middleware matches pathname exactly`);
  }
}

// 3. Duplicates. The Set silently swallows them, so compare sizes.
if (GONE_SET.size !== GONE_URLS.length) {
  const seen = new Set();
  const dupes = GONE_URLS.filter((u) => (seen.has(u) ? true : (seen.add(u), false)));
  errors.push(`${GONE_URLS.length - GONE_SET.size} duplicate entr(ies): ${[...new Set(dupes)].join(', ')}`);
}

console.log(`  ${GONE_URLS.length} URL(s) listed, ${ROUTES.length} canonical route(s) checked against them`);
console.log('');

if (errors.length > 0) {
  console.error(`[gone-urls] FAILED — ${errors.length} problem(s):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log('[gone-urls] list is well-formed and collides with no live route.');
process.exit(0);
