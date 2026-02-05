#!/usr/bin/env node
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteMap = JSON.parse(readFileSync(join(__dirname, '..', 'site-map.json'), 'utf-8'));

console.log('Checking canonical URL consistency...\n');

let issues = 0;

for (const page of siteMap.pages) {
  if (page.canonical_link && page.url !== page.canonical_link) {
    console.log(`URL mismatch:`);
    console.log(`  File: ${page.file_path}`);
    console.log(`  URL: ${page.url}`);
    console.log(`  Canonical: ${page.canonical_link}`);
    console.log();
    issues++;
  }
}

if (issues === 0) {
  console.log('All canonical URLs match their page URLs.');
} else {
  console.log(`Found ${issues} canonical URL mismatches.`);
}
