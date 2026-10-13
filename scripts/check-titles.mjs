#!/usr/bin/env node
/**
 * Title drift check.
 *
 * src/config/routes.js is documented as the single source of truth for titles.
 * Three pages had drifted from it — /, /areas/ and /contact/ — and nothing
 * noticed, because check:seo-audit validates that a title EXISTS and is a
 * sensible length, never that it is the title the registry declares.
 *
 * The registry wins. If a title is wrong as marketing copy, that is a copy
 * decision made in the registry, not a drift ratified after the fact.
 *
 * og:title and twitter:title are checked against the registry too. They mirror
 * <title> on every page today, and fixing only <title> would have moved the
 * drift into the social cards rather than removing it — where it is harder to
 * see, because nothing renders them in a browser tab.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { ROUTES } = require('../src/config/routes.js');

const FIELDS = [
  { label: '<title>', pattern: /<title>([^<]*)<\/title>/ },
  { label: 'og:title', pattern: /property="og:title" content="([^"]*)"/ },
  { label: 'twitter:title', pattern: /name="twitter:title" content="([^"]*)"/ },
];

const errors = [];
console.log('[titles] every shipped title must equal its registry entry...\n');

for (const route of ROUTES) {
  const rel = route.path === '/' ? 'index.html' : `${route.path.replace(/^\//, '')}index.html`;
  const html = await readFile(join(ROOT, rel), 'utf-8');
  const bad = [];

  for (const field of FIELDS) {
    const match = html.match(field.pattern);
    if (!match) {
      errors.push(`${rel}: no ${field.label}`);
      bad.push(field.label);
      continue;
    }
    if (match[1] !== route.title) {
      errors.push(
        `${rel} ${field.label}\n      shipped:  ${match[1]}\n      registry: ${route.title}`,
      );
      bad.push(field.label);
    }
  }

  console.log(`  ${bad.length ? 'X ' : 'ok'} ${route.path.padEnd(17)} ${bad.length ? bad.join(', ') + ' differ' : route.title}`);
}

console.log('');
if (errors.length) {
  console.error(`[titles] FAILED — ${errors.length} mismatch(es):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error('\n  The registry is the source of truth. Change routes.js, then the page.');
  process.exit(1);
}
console.log(`[titles] ${ROUTES.length} route(s) match the registry.`);
