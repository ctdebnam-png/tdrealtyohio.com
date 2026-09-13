#!/usr/bin/env tsx
/**
 * Link-text lint.
 *
 * WCAG 2.2 AA asks that a link's purpose be clear from its text. "Click here",
 * "learn more", "read more" and bare "here" fail that in a way no amount of
 * surrounding copy fixes for someone tabbing through a list of links.
 *
 * Scans the built output and fails on:
 *   - banned phrases as the whole of a link's text
 *   - empty links with no accessible name
 *   - a raw URL used as link text
 *
 * Runs after the build, alongside the ORC 4733.16 check.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const BANNED = [
  'click here',
  'here',
  'learn more',
  'read more',
  'more',
  'this link',
  'link',
  'more info',
  'more information',
  'details',
  'continue',
];

type Problem = { page: string; text: string; reason: string };
const problems: Problem[] = [];

const htmlFiles = (dir: string): string[] => {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(htmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
};

const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = match[1];
    const text = textOf(match[2]);
    const ariaLabel = attributes.match(/aria-label=["']([^"']*)["']/i)?.[1];
    const accessibleName = (ariaLabel ?? text).trim();

    if (accessibleName.length === 0) {
      problems.push({ page, text: match[0].slice(0, 80), reason: 'link has no accessible name' });
      continue;
    }
    if (BANNED.includes(accessibleName.toLowerCase().replace(/[.…>»\s]+$/g, ''))) {
      problems.push({ page, text: accessibleName, reason: 'link text does not say where it goes' });
    }
    if (/^https?:\/\//i.test(accessibleName)) {
      problems.push({ page, text: accessibleName, reason: 'raw URL used as link text' });
    }
  }
}

if (problems.length > 0) {
  console.error(`\nLink-text check FAILED: ${problems.length} problem(s).\n`);
  for (const problem of problems) {
    console.error(`  ${problem.page}: "${problem.text}" — ${problem.reason}`);
  }
  console.error('\nWrite link text that names the destination. "All services with scope" beats "learn more".');
  process.exit(1);
}

console.log(`Link-text check passed: ${files.length} page(s) scanned.`);
