#!/usr/bin/env node
/**
 * Copy Quality Check for TD Realty Ohio
 * Scans for banned first-person author voice and vague marketing phrases
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let errors = [];

// First-person patterns that indicate author voice (not user-facing FAQ/form content)
const FIRST_PERSON_PATTERNS = [
  { pattern: /\bI want to be fair\b/gi, description: 'first-person author voice' },
  { pattern: /\bI hear these questions\b/gi, description: 'first-person author voice' },
  { pattern: /\bLet me (break down|explain|show)\b/gi, description: 'first-person author voice' },
  { pattern: /\bI recommend to my\b/gi, description: 'first-person author voice' },
  { pattern: /\bI always tell\b/gi, description: 'first-person author voice' },
  { pattern: /\bContact me\b/gi, description: 'first-person "contact me"' },
  { pattern: /\bI will call\b/gi, description: 'first-person promise' },
  { pattern: /\bI'll call\b/gi, description: 'first-person promise' },
  { pattern: /\bwork with me personally\b/gi, description: 'first-person "me personally"' },
  { pattern: /\bIn this article, I\b/gi, description: 'first-person article intro' },
];

// Banned vague marketing phrases
const BANNED_PHRASES = [
  { pattern: /\bkeep thousands more\b/gi, replacement: 'keep more at closing' },
  { pattern: /\bwe operate efficiently\b/gi, replacement: 'lower overhead and standardized workflows' },
  { pattern: /\bexpert negotiation\b/gi, replacement: 'offer review, counteroffer drafting, and negotiation support' },
  { pattern: /\bbest price\b/gi, replacement: 'pricing guidance based on a CMA and current competition' },
  { pattern: /\bstrongest (real estate )?market\b/gi, replacement: '(remove unsupported market claim)' },
  { pattern: /\brising steadily\b/gi, replacement: '(remove unsupported market claim)' },
  { pattern: /\bhealthy appreciation\b/gi, replacement: '(remove unsupported market claim)' },
];

/**
 * Recursively find all files with given extensions
 */
async function findFiles(dir, extensions, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'templates' ||
          entry.name === 'data' ||
          entry.name === 'tools' ||
          entry.name === 'reports' ||
          entry.name === 'audit' ||
          entry.name === 'scripts' ||
          entry.name.startsWith('audit-')) {
        continue;
      }
      await findFiles(fullPath, extensions, files);
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract visible text from HTML, excluding JSON-LD schema
 */
function extractVisibleText(html) {
  // Remove script tags (including JSON-LD)
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove style tags
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Keep content inside tags but remove the tags themselves
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode HTML entities
  text = text.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, ' ');
  return text;
}

/**
 * Check a file for banned patterns
 */
async function checkFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const relativePath = filePath.replace(ROOT + '/', '');
  const visibleText = extractVisibleText(content);

  // Check first-person patterns
  for (const { pattern, description } of FIRST_PERSON_PATTERNS) {
    const matches = visibleText.match(pattern);
    if (matches) {
      for (const match of matches) {
        errors.push({
          file: relativePath,
          type: 'first-person',
          match: match,
          description: description,
        });
      }
    }
  }

  // Check banned phrases
  for (const { pattern, replacement } of BANNED_PHRASES) {
    const matches = visibleText.match(pattern);
    if (matches) {
      for (const match of matches) {
        errors.push({
          file: relativePath,
          type: 'banned-phrase',
          match: match,
          replacement: replacement,
        });
      }
    }
  }
}

/**
 * Main validation function
 */
async function validate() {
  console.log('\n=== TD Realty Ohio Copy Quality Check ===\n');

  const htmlFiles = await findFiles(ROOT, ['.html']);
  console.log(`Scanning ${htmlFiles.length} HTML files...\n`);

  for (const filePath of htmlFiles) {
    await checkFile(filePath);
  }

  console.log('=== Results ===\n');

  if (errors.length > 0) {
    // Group by type
    const firstPerson = errors.filter(e => e.type === 'first-person');
    const bannedPhrases = errors.filter(e => e.type === 'banned-phrase');

    if (firstPerson.length > 0) {
      console.log('First-Person Author Voice Issues:');
      for (const e of firstPerson) {
        console.log(`  - ${e.file}: "${e.match}" (${e.description})`);
      }
      console.log('');
    }

    if (bannedPhrases.length > 0) {
      console.log('Banned Vague Phrases:');
      for (const e of bannedPhrases) {
        console.log(`  - ${e.file}: "${e.match}" -> use "${e.replacement}"`);
      }
      console.log('');
    }

    console.log(`Failed with ${errors.length} issue(s)`);
    process.exit(1);
  }

  console.log('All copy quality checks passed!\n');
}

validate().catch(err => {
  console.error('Copy check failed:', err);
  process.exit(1);
});
