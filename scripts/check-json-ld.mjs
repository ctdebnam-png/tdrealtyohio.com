#!/usr/bin/env node
/**
 * JSON-LD check.
 *
 * Every route's registry entry declares what structured data its page carries.
 * Before this, all ten declared something and NOT ONE emitted anything:
 * check:seo-audit only warned, and only about three of them, so ten pages
 * shipped with no structured data at all and the suite stayed green.
 *
 * Three things are asserted:
 *
 *  1. What the page emits is byte-identical to what the generator would write
 *     from the registry. Comparing against a regeneration rather than a list
 *     of expected types means a change to a route's entry, to schema.js, or to
 *     the contact record fails here instead of silently shipping stale
 *     structured data. `npm run generate:json-ld` is the fix.
 *
 *  2. Every block parses, carries https://schema.org as @context, and has an
 *     @type. Invalid JSON-LD is ignored by consumers, which looks exactly like
 *     having none.
 *
 *  3. The browser fallback literals in assets/js/schema.js still match
 *     src/config/contact.js. schema.js derives from contact.js under Node but
 *     keeps literals for a browser load, and an unchecked fallback is how the
 *     retired phone number came to live in four places.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { blocksFor, renderBlocks, START, END } from './generate-json-ld.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { ROUTES } = require('../src/config/routes.js');
const { CONTACT, LICENSES } = require('../src/config/contact.js');

const errors = [];
const fileFor = (path) => (path === '/' ? 'index.html' : `${path.replace(/^\//, '')}index.html`);

console.log('[json-ld] every route emits what its registry entry declares...\n');

const byPath = new Map(ROUTES.map((route) => [route.path, route]));

for (const route of ROUTES) {
  const rel = fileFor(route.path);
  const html = await readFile(join(ROOT, rel), 'utf-8');

  const declared = route.schema || [];
  const expected = renderBlocks(blocksFor(route, byPath));

  const start = html.indexOf(START);
  const end = html.indexOf(END);

  if (!expected) {
    if (start !== -1) errors.push(`${rel}: declares no schema but carries a generated block`);
    console.log(`  -- ${route.path.padEnd(17)} declares none`);
    continue;
  }

  if (start === -1 || end === -1) {
    errors.push(`${rel}: declares [${declared.join(', ')}] but emits no JSON-LD — run "npm run generate:json-ld"`);
    console.log(`  X  ${route.path.padEnd(17)} missing`);
    continue;
  }

  const actual = html.slice(start, end + END.length);
  if (actual !== expected) {
    errors.push(`${rel}: emitted JSON-LD does not match the registry — run "npm run generate:json-ld"`);
    console.log(`  X  ${route.path.padEnd(17)} stale`);
    continue;
  }

  // Independently parse what is actually on the page.
  const types = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch (error) {
      errors.push(`${rel}: a JSON-LD block does not parse: ${error.message}`);
      continue;
    }
    if (parsed['@context'] !== 'https://schema.org') {
      errors.push(`${rel}: @context is ${JSON.stringify(parsed['@context'])}, expected https://schema.org`);
    }
    if (!parsed['@type']) errors.push(`${rel}: a block has no @type`);
    else types.push(parsed['@type']);
  }

  console.log(`  ok ${route.path.padEnd(17)} ${types.join(', ')}`);
}

/* Fallback literals must agree with the record they fall back to. */
const schemaSource = await readFile(join(ROOT, 'assets/js/schema.js'), 'utf-8');
const fallbacks = [
  ['phone', CONTACT.phone_display],
  ['email', CONTACT.email],
  ['locality', CONTACT.address.city],
  ['broker licence', LICENSES.broker],
  ['brokerage licence', LICENSES.brokerage],
  ['company name', LICENSES.company_name],
  ['broker name', LICENSES.broker_name],
];
for (const [label, value] of fallbacks) {
  if (!schemaSource.includes(`'${value}'`)) {
    errors.push(
      `assets/js/schema.js: browser fallback for ${label} no longer matches contact.js ("${value}")`,
    );
  }
}

console.log('');
if (errors.length) {
  console.error(`[json-ld] FAILED — ${errors.length} problem(s):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`[json-ld] ${ROUTES.length} route(s) match the registry; browser fallbacks agree with contact.js.`);
