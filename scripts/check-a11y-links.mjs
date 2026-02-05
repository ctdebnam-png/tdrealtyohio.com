#!/usr/bin/env node

/**
 * check-a11y-links.mjs
 * Fail if any <a> with only an icon (no visible text) has no aria-label.
 * Checks all HTML files in the project.
 */

import { readFileSync } from 'fs';
import { glob } from 'glob';

const files = await glob('**/*.html', {
  cwd: process.cwd(),
  ignore: ['node_modules/**', '.git/**'],
  absolute: true,
});

let errors = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const relPath = file.replace(process.cwd() + '/', '');

  // Match all <a ...>...</a> blocks (non-greedy, single-line tolerant)
  const linkRegex = /<a\s[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const inner = match[1];

    // Strip HTML tags to get visible text
    const visibleText = inner.replace(/<[^>]*>/g, '').trim();

    // If no visible text, this is an icon-only link
    if (!visibleText) {
      // Check for aria-label on the <a> tag itself
      const openTag = fullTag.match(/<a\s[^>]*>/i);
      if (openTag && !openTag[0].match(/aria-label\s*=/i)) {
        // Find the line number
        const beforeMatch = html.substring(0, match.index);
        const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
        console.error(`FAIL: ${relPath}:${lineNum} — <a> with no visible text and no aria-label`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} icon-only link(s) missing aria-label.`);
  process.exit(1);
} else {
  console.log('check-a11y-links: all icon-only links have aria-label ✓');
}
