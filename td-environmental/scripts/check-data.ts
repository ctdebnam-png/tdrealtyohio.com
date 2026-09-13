#!/usr/bin/env tsx
/**
 * Validates every file in /src/data against its Zod schema and fails on the
 * first file that does not parse. Runs as a prebuild step, so a malformed or
 * under-sourced record cannot reach a rendered page.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATA_FILES, loadData, DataValidationError, getTeam } from '../src/lib/data.js';
import { SITE_URL, IS_PUBLISHED } from '../src/lib/site.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = false;

for (const { file, schema, surface } of DATA_FILES) {
  try {
    const records = loadData(file, schema) as unknown[];
    const count = records.length;
    console.log(
      `  ok    ${file.padEnd(24)} ${String(count).padStart(4)} record${count === 1 ? ' ' : 's'}  (${surface})`,
    );
  } catch (error) {
    failed = true;
    const message = error instanceof DataValidationError ? error.message : String(error);
    console.error(`  FAIL  ${message}`);
  }
}

/**
 * A photo path that points at nothing renders a broken image on a public page.
 * Nothing else in the pipeline looks at the filesystem, so this does.
 */
if (!failed) {
  for (const member of getTeam()) {
    if (!member.photo) continue;
    const asset = join(root, 'public', member.photo.replace(/^\//, ''));
    if (!existsSync(asset)) {
      failed = true;
      console.error(
        `  FAIL  team.yaml -> ${member.name}: photo "${member.photo}" is not in public/`,
      );
    }
  }
}

if (failed) {
  console.error('\nData validation failed. Unknown values stay null; they do not get filled in.');
  process.exit(1);
}

console.log('\nData validation passed.');

/**
 * State banner. The single most costly mistake available here is publishing
 * before the firm is insured and registered, so every build says plainly which
 * mode it is in and against which origin.
 */
const REGISTERED_ORIGIN = 'https://tdenvironmentalohio.com';

console.log('');
console.log('  ─────────────────────────────────────────────────────────────');
if (IS_PUBLISHED) {
  console.log('   PUBLISH=true — this build is PUBLISHED.');
  console.log('   robots allows crawling, a sitemap is generated, forms are live.');
  console.log('   Only correct once professional liability is bound AND the trade');
  console.log('   name is registered with the Ohio Secretary of State.');
} else {
  console.log('   HELD — this build is not published.');
  console.log('   robots disallows everything, no sitemap, every page noindex,');
  console.log('   every form inert. Deploy to preview only.');
  console.log('   Set PUBLISH=true to go live. That is the only switch.');
}
console.log(`   origin: ${SITE_URL}`);
console.log('  ─────────────────────────────────────────────────────────────');

if (SITE_URL !== REGISTERED_ORIGIN) {
  console.warn(
    `\nWARNING: SITE_URL is "${SITE_URL}", not the registered origin\n` +
      `${REGISTERED_ORIGIN}. Canonical links, og:url, robots.txt and the sitemap\n` +
      'will all carry that value. Confirm this is deliberate.',
  );
}
if (/\/\/www\./.test(SITE_URL)) {
  console.error('\nSITE_URL uses www. The site is apex-only; use the bare domain.');
  process.exit(1);
}
