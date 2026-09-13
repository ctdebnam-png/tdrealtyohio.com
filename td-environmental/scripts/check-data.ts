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

if (!process.env.SITE_URL) {
  console.warn(
    '\nWARNING: SITE_URL is unset, so canonical URLs, og:url, robots.txt and the\n' +
      'sitemap will all be built against the default origin in src/lib/site.ts.\n' +
      'That domain is not confirmed. Set SITE_URL in the host build environment\n' +
      'before a production deploy.',
  );
}

console.log('\nData validation passed.');
