#!/usr/bin/env tsx
/**
 * ORC 4733.16 string check.
 *
 * Ohio Revised Code 4733.16 bars a firm without a certificate of authorization
 * from holding itself out with the words "engineer", "engineering", "surveyor"
 * or "surveying", or any derivation of them. TD Environmental does not hold
 * one.
 *
 * The statute is triggered by OFFERING engineering services, not only by
 * performing them, so this reads the built site in /dist and fails the build if
 * any reserved term appears in:
 *   - a <title>
 *   - a <meta name="description"> or og:description
 *   - any heading, h1 through h6
 *   - the visible body copy of any page
 *   - the firm name or the site origin
 *
 * Service names are additionally checked at the source, in
 * src/schemas/services.ts, so a bad record fails validation before it renders.
 *
 * Body copy is scanned fail-closed: a lawful reference ("delivered to your
 * engineer") fails just as a prohibited offer ("we provide engineering
 * studies") does, because no pattern can separate them. Admit a lawful phrase
 * by adding it to ORC_COPY_ALLOWLIST in src/lib/prohibited-terms.ts, with a
 * reason. Rewriting the copy is usually the better answer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  prohibitedTermMatches,
  advisoryTermMatches,
  ORC_COPY_ALLOWLIST,
  ORC_CITATION,
} from '../src/lib/prohibited-terms.js';
import { SITE, SITE_URL } from '../src/lib/site.js';
import {
  getServices,
  getSubcontractors,
  getBuyers,
  getMarketLanguage,
} from '../src/lib/data.js';

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

/**
 * Third-party organisation names, taken from the data itself.
 *
 * A subcontractor really called "Acme Engineering Inc" is a proper noun naming
 * somebody else's firm. Rendering it is not TD Environmental offering
 * engineering services — it is a reference to a company that lawfully holds
 * itself out that way. ORC 4733.16 restrains what THIS firm may offer, not
 * whose name it may write down.
 *
 * So these exact names are permitted wherever they appear, and every use is
 * reported, so the exemption is visible rather than silent. It applies only to
 * names in subcontractors.yaml, buyers.yaml and market-language.yaml — the
 * files that describe other people's firms. A service name in services.yaml
 * gets no such exemption: that is this firm's own offer, and the schema
 * rejects it outright.
 */
const thirdPartyNames = (): string[] => {
  const names = [
    ...getSubcontractors().map((record) => record.name),
    ...getBuyers().map((record) => record.name),
    ...getMarketLanguage().map((record) => record.firm_name),
  ];
  // Longest first, so "Acme Engineering Inc" is removed before a shorter name
  // that happens to be a prefix of it.
  return [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
};

const THIRD_PARTY = thirdPartyNames();
const thirdPartyHits = new Set<string>();

/**
 * Removes allowlisted phrases before the scan, and records which entries were
 * actually used so unused ones can be reported rather than left to rot.
 */
const allowlistHits = new Set<string>();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const allowlisted = (text: string): string => {
  let out = text;
  for (const name of THIRD_PARTY) {
    const pattern = new RegExp(escape(name), 'gi');
    if (pattern.test(out)) {
      thirdPartyHits.add(name);
      out = out.replace(pattern, ' ');
    }
  }
  for (const entry of ORC_COPY_ALLOWLIST) {
    const pattern = new RegExp(escape(entry.phrase), 'gi');
    if (pattern.test(out)) {
      allowlistHits.add(entry.phrase);
      out = out.replace(pattern, ' ');
    }
  }
  return out;
};

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

  for (const heading of html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)) {
    record(`${page} <${heading[1].toLowerCase()}>`, stripTags(heading[2]));
  }

  // Visible body copy. Script, style and template contents are not copy.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    const visible = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<template[\s\S]*?<\/template>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');
    record(`${page} body copy`, allowlisted(stripTags(visible)));
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
    // Show the words around the hit, not the start of the page: on a long body
    // the offending phrase would otherwise never appear in the output.
    for (const term of v.terms.slice(0, 3)) {
      const at = v.context.toLowerCase().indexOf(term.toLowerCase());
      const from = Math.max(0, at - 70);
      const to = Math.min(v.context.length, at + term.length + 70);
      console.error(
        `    context: ${from > 0 ? '…' : ''}${v.context.slice(from, to)}${to < v.context.length ? '…' : ''}`,
      );
    }
  }
  console.error(
    `\nThese words are reserved by ${ORC_CITATION} for firms holding a certificate of` +
      '\nauthorization, which this firm does not hold. OFFERING the service is the' +
      '\ntrigger, not only performing it, so this applies to body copy as much as to' +
      '\ntitles and headings.' +
      '\n\nRewrite the copy. If the phrase is genuinely a lawful reference rather than' +
      '\nan offer, add it to ORC_COPY_ALLOWLIST in src/lib/prohibited-terms.ts with a' +
      '\nreason. Do not simply put the word back.',
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

const namedThirdParties = [...thirdPartyHits].filter((name) => /engineer|surveyor|surveying/i.test(name));
if (namedThirdParties.length > 0) {
  console.log(
    `\n${ORC_CITATION} note: ${namedThirdParties.length} third-party firm name(s) carrying a` +
      '\nreserved term were rendered and permitted, as proper nouns naming other',
  );
  console.log("companies rather than this firm's own offer:");
  for (const name of namedThirdParties) console.log(`  ${name}`);
  console.log(
    'Check that each appears as a named firm and not as a description of work\n' +
      'TD Environmental offers.\n',
  );
}

const unusedAllowlist = ORC_COPY_ALLOWLIST.filter((entry) => !allowlistHits.has(entry.phrase));
if (unusedAllowlist.length > 0) {
  console.log(
    `\n${ORC_CITATION} note: ${unusedAllowlist.length} allowlist entr(y/ies) matched nothing and can be removed:`,
  );
  for (const entry of unusedAllowlist) console.log(`  "${entry.phrase}" — ${entry.reason}`);
  console.log('');
}

console.log(
  `${ORC_CITATION} check passed: ${pagesScanned} page(s) scanned — titles, meta descriptions, ` +
    `headings h1-h6, body copy, service names, the firm name and the site origin. ` +
    `No reserved terms.`,
);
