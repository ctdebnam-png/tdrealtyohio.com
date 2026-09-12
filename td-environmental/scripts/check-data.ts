#!/usr/bin/env tsx
/**
 * Validates every file in /src/data against its Zod schema and fails on the
 * first file that does not parse. Runs as a prebuild step, so a malformed or
 * under-sourced record cannot reach a rendered page.
 */
import { DATA_FILES, loadData, DataValidationError } from '../src/lib/data.js';

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

if (failed) {
  console.error('\nData validation failed. Unknown values stay null; they do not get filled in.');
  process.exit(1);
}

console.log('\nData validation passed.');
