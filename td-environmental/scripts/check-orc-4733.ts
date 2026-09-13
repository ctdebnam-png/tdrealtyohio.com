#!/usr/bin/env tsx
/**
 * ORC 4733.16 string check.
 *
 * Ohio Revised Code 4733.16 bars a firm without a certificate of authorization
 * from holding itself out with the words "engineer", "engineering", "surveyor"
 * or "surveying", or any derivation of them. TD Environmental does not hold
 * one.
 *
 * This script reads the built site in /dist and fails the build if any of those
 * strings appears in:
 *   - a <title>
 *   - a <meta name="description"> or og:description
 *   - any <h1>
 *   - the firm name or the site origin
 *
 * Service names are additionally checked at the source, in
 * src/schemas/services.ts, so a bad record fails validation before it renders.
 *
 * Body copy is not scanned: describing a client's engineer, or a report
 * prepared by one, is lawful. The prohibition is on how the firm names itself
 * and its work.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  prohibitedTermMatches,
  advisoryTermMatches,
  ORC_CITATION,
} from '../src/lib/prohibited-terms.js';
import { SITE, SITE_URL } from '../src/lib/site.js';
import { getServices } from '../src/lib/data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');

type Violation = { where: string; context: string; terms: string[] };
const violations: Violation[] = [];
const advisories: Violation[] = [];

const record = (where: string, context: string) => {
  const terms = prohibitedTermMatches(context);
  if (terms.length > 0) violations.push({ where, context: context.trim(), terms });

  const advisory = advisoryTermMatches(context);
  if (advisory.length > 0) advisories.push({ where, context: context.trim(), terms: advisory });
};

const htmlFiles = (dir: string): string[] => {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(htmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
};

const decode = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");

const stripTags = (value: string): string => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');

// 1. The firm's own name and origin.
record('site.name', SITE.name);
record('SITE_URL', SITE_URL);

// 2. Service names, from the data rather than the rendered page, so blocked
//    services are covered too.
for (const service of getServices()) {
  record(`services.yaml -> ${service.slug} (name)`, service.name);
  record(`services.yaml -> ${service.slug} (slug)`, service.slug);
}

// 3. Titles, meta descriptions, and h1s in the built output.
let pagesScanned = 0;
let files: string[] = [];
try {
  files = htmlFiles(distDir);
} catch {
  console.error(`No build output at ${distDir}. Run "astro build" first.`);
  process.exit(1);
}

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const page = `/${relative(distDir, file)}`;
  pagesScanned += 1;

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) record(`${page} <title>`, stripTags(title[1]));

  // Attribute values can contain '>' and the other quote character, so match
  // each tag by its quoted attributes rather than by scanning to the first '>'.
  for (const meta of html.matchAll(/<meta\s+((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    const attributes = meta[1];
    const name = attributes.match(/(?:name|property)\s*=\s*("([^"]*)"|'([^']*)')/i);
    const key = (name?.[2] ?? name?.[3] ?? '').toLowerCase();
    if (!['description', 'og:description', 'og:title', 'og:site_name'].includes(key)) continue;
    const content = attributes.match(/content\s*=\s*("([^"]*)"|'([^']*)')/i);
    const value = content?.[2] ?? content?.[3];
    if (value !== undefined) record(`${page} <meta ${key}>`, decode(value));
  }

  for (const h1 of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
    record(`${page} <h1>`, stripTags(h1[1]));
  }
}

// A scan of an empty or half-built dist would pass vacuously. Refuse to be
// the gate that waves through a build that never happened.
if (pagesScanned === 0) {
  console.error(`No HTML found under ${distDir}. The build output is missing or empty.`);
  process.exit(1);
}
if (!files.some((file) => relative(distDir, file) === 'index.html')) {
  console.error(
    `${distDir} has ${pagesScanned} page(s) but no index.html — the build output looks incomplete.`,
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error(`\n${ORC_CITATION} check FAILED: ${violations.length} violation(s).\n`);
  for (const v of violations) {
    console.error(`  ${v.where}`);
    console.error(`    term(s): ${v.terms.join(', ')}`);
    console.error(`    text:    ${v.context.slice(0, 160)}`);
  }
  console.error(
    `\nThese words are reserved by ${ORC_CITATION} for firms holding a certificate of` +
      '\nauthorization. Rename the page, service, or heading. Do not add the word back.',
  );
  process.exit(1);
}

if (advisories.length > 0) {
  console.log(
    `\n${ORC_CITATION} advisory: "survey" appears in ${advisories.length} title, heading, or service name.`,
  );
  console.log(
    'That word is not reserved and is ordinary Phase I vocabulary. Confirm each one',
  );
  console.log('does not read as an offer to practise land surveying. This does not fail the build.');
  for (const advisory of advisories) {
    console.log(`  ${advisory.where}: ${advisory.context.slice(0, 100)}`);
  }
  console.log('');
}

console.log(
  `${ORC_CITATION} check passed: ${pagesScanned} page(s) scanned, no reserved terms in titles, meta descriptions, h1s, or service names.`,
);
