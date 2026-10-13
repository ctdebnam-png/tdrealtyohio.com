#!/usr/bin/env node
/**
 * Form action check.
 *
 * Every <form> that ships must name where it posts. A form with action=""
 * — or with no action attribute at all — resolves to the page's own URL, so a
 * submission posts the page back to itself.
 *
 * That is not hypothetical. contact/index.html shipped action="" while
 * main.js submitted to `form.action` as a second delivery path and computed
 * success as `kvOk || formspreeOk`. Every submission posted itself to
 * /contact/, and a 2xx from that stray request printed "Your message has been
 * sent" over a failed capture. No email was ever sent from the site.
 *
 * An empty action is also indistinguishable, in the markup, from a form whose
 * endpoint someone forgot to fill in — which is exactly how it got there.
 *
 * Fails on:
 *   - action="" or action="   "
 *   - a <form> with no action attribute
 *   - an action that is not a rooted path or an absolute https URL, since a
 *     relative action re-introduces the same "resolves against the page"
 *     problem one directory up
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'src', 'tests',
  'templates', 'data', 'tools', 'reports', 'output', 'admin', 'audit',
]);

const errors = [];

async function findHtml(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      await findHtml(join(dir, entry.name), found);
    } else if (entry.name.endsWith('.html')) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

function lineOf(html, index) {
  return html.slice(0, index).split('\n').length;
}

async function main() {
  console.log('[form-actions] Checking every shipped <form> names an endpoint...\n');

  const files = await findHtml(ROOT);
  let formCount = 0;

  for (const file of files) {
    const html = await readFile(file, 'utf-8');
    const rel = relative(ROOT, file);

    for (const match of html.matchAll(/<form\b[^>]*>/gi)) {
      formCount++;
      const tag = match[0];
      const line = lineOf(html, match.index);
      const where = `${rel}:${line}`;

      const actionMatch = tag.match(/\baction\s*=\s*["']([^"']*)["']/i);

      if (!actionMatch) {
        errors.push(`${where}: <form> has no action attribute`);
        continue;
      }

      const action = actionMatch[1].trim();

      if (action === '') {
        errors.push(`${where}: <form action=""> — resolves to the page itself`);
        continue;
      }

      if (!action.startsWith('/') && !action.startsWith('https://')) {
        errors.push(
          `${where}: <form action="${action}"> is relative — use a rooted path or an absolute https URL`,
        );
        continue;
      }

      console.log(`  ok ${where.padEnd(34)} action="${action}"`);
    }
  }

  console.log('');
  if (errors.length > 0) {
    console.error(`[form-actions] FAILED — ${errors.length} problem(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    return 1;
  }

  console.log(`[form-actions] ${formCount} form(s) checked, all name an endpoint.`);
  return 0;
}

process.exit(await main());
