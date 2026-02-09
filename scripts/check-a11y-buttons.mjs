#!/usr/bin/env node
/**
 * Accessibility Button Lint
 * Checks for:
 * 1. No div/span elements styled as buttons (missing role="button" or should be <button>/<a>)
 * 2. Keyboard support: clickable elements must be focusable
 * 3. aria-expanded correctness on toggleable elements
 * 4. Interactive elements must have accessible names
 *
 * Fails CI on violations.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
  'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
  'gsc', 'data', 'functions', 'docs', 'media',
]);

async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      await findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function check() {
  console.log('[a11y-buttons] Scanning for accessibility violations...');
  const htmlFiles = await findHtmlFiles(ROOT);
  const errors = [];

  for (const file of htmlFiles) {
    const content = await readFile(file, 'utf-8');
    const relativePath = file.replace(ROOT, '');

    // Check for div/span with onclick but no role="button" and no tabindex
    const divClickRegex = /<(div|span)[^>]*onclick=["'][^"']+["'][^>]*>/gi;
    let match;
    while ((match = divClickRegex.exec(content)) !== null) {
      const tag = match[0];
      if (!tag.includes('role="button"') && !tag.includes("role='button'")) {
        errors.push({
          file: relativePath,
          line: content.substring(0, match.index).split('\n').length,
          error: `<${match[1]}> with onclick but missing role="button"`,
          suggestion: `Use <button> instead, or add role="button" tabindex="0"`,
        });
      }
      if (!tag.includes('tabindex')) {
        errors.push({
          file: relativePath,
          line: content.substring(0, match.index).split('\n').length,
          error: `<${match[1]}> with onclick but not keyboard-focusable`,
          suggestion: `Add tabindex="0" for keyboard access`,
        });
      }
    }

    // Check for elements with class "btn" that are not <a> or <button>
    // Skip if nested inside an <a> or <button> tag (the parent is the interactive element)
    const btnClassRegex = /<(div|span|p)[^>]*class=["'][^"']*\bbtn\b[^"']*["'][^>]*>/gi;
    while ((match = btnClassRegex.exec(content)) !== null) {
      const tag = match[0];
      if (!tag.includes('role="button"') && !tag.includes("role='button'") &&
          !tag.includes('role="link"') && !tag.includes("role='link'")) {
        // Check if nested inside an <a> or <button> by counting open/close tags before this position
        const before = content.substring(0, match.index);
        const aOpens = (before.match(/<a\b/gi) || []).length;
        const aCloses = (before.match(/<\/a>/gi) || []).length;
        const btnOpens = (before.match(/<button\b/gi) || []).length;
        const btnCloses = (before.match(/<\/button>/gi) || []).length;
        if (aOpens > aCloses || btnOpens > btnCloses) continue;

        errors.push({
          file: relativePath,
          line: content.substring(0, match.index).split('\n').length,
          error: `<${match[1]}> with .btn class but not a <button> or <a>`,
          suggestion: `Use <a> or <button> element instead`,
        });
      }
    }

    // Check aria-expanded usage
    const ariaExpandedRegex = /aria-expanded=["']([^"']*)["']/g;
    while ((match = ariaExpandedRegex.exec(content)) !== null) {
      const value = match[1];
      if (value !== 'true' && value !== 'false') {
        errors.push({
          file: relativePath,
          line: content.substring(0, match.index).split('\n').length,
          error: `aria-expanded="${value}" is invalid`,
          suggestion: `Value must be "true" or "false"`,
        });
      }
    }

    // Check buttons without accessible names
    const emptyButtonRegex = /<button[^>]*>(\s*)<\/button>/gi;
    while ((match = emptyButtonRegex.exec(content)) !== null) {
      const tag = content.substring(match.index, match.index + 200);
      if (!tag.includes('aria-label') && !tag.includes('aria-labelledby') && !tag.includes('title')) {
        errors.push({
          file: relativePath,
          line: content.substring(0, match.index).split('\n').length,
          error: `Empty <button> without accessible name`,
          suggestion: `Add aria-label or visible text content`,
        });
      }
    }
  }

  // Report
  if (errors.length === 0) {
    console.log(`[a11y-buttons] ${htmlFiles.length} files checked — no violations`);
    return 0;
  }

  console.error(`\n[a11y-buttons] ${errors.length} violation(s) found:\n`);
  errors.forEach(e => {
    console.error(`  ${e.file}:${e.line}: ${e.error}`);
    console.error(`    Fix: ${e.suggestion}`);
  });

  return errors.length;
}

const errorCount = await check();
if (errorCount > 0) {
  process.exit(1);
}
