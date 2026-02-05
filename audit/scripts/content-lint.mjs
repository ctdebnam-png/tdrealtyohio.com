#!/usr/bin/env node

/**
 * Content Lint
 * Scans all HTML files for first-person language and vague phrases.
 * Outputs matches to audit files and fails if violations found.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// First-person patterns (word boundaries)
const FIRST_PERSON_PATTERNS = [
  { pattern: /\bI'll\b/gi, token: "I'll" },
  { pattern: /\bI'm\b/gi, token: "I'm" },
  { pattern: /\bI've\b/gi, token: "I've" },
  { pattern: /\bI'd\b/gi, token: "I'd" },
  { pattern: /(?<![?'""'])\s+I\s+(will|am|have|would|can|could|see|respond|coordinate|help|provide|live|start|saw|kept|explain|break)\b/gi, token: "I + verb" },
  { pattern: /\bmy\s+(home|house|listing|fee|commission|team|experience|approach)\b/gi, token: "my + noun" },
  { pattern: /\bcontact\s+me\b/gi, token: "contact me" },
  { pattern: /\bcall\s+me\b/gi, token: "call me" },
  { pattern: /\bemail\s+me\b/gi, token: "email me" }
];

// Vague phrases to flag
const VAGUE_PHRASES = [
  { pattern: /\bexpert negotiation\b/gi, phrase: "expert negotiation" },
  { pattern: /\bguidance through\b/gi, phrase: "guidance through" },
  { pattern: /\bguidance from\b/gi, phrase: "guidance from" },
  { pattern: /\bsame full-service experience\b/gi, phrase: "same full-service experience" },
  { pattern: /\bmore value,?\s*lower cost\b/gi, phrase: "more value, lower cost" },
  { pattern: /\bour team\b/gi, phrase: "our team" },
  { pattern: /\bmy team\b/gi, phrase: "my team" },
  { pattern: /\blocal team\b/gi, phrase: "local team" },
  { pattern: /\bdirect access\b/gi, phrase: "direct access" },
  { pattern: /\bfull-service,?\s*not discount\b/gi, phrase: "full-service, not discount" }
];

// Patterns to exclude (FAQ questions, schema, form labels, etc.)
const EXCLUDE_CONTEXTS = [
  /<button[^>]*class="faq-question"[^>]*>[\s\S]*?<\/button>/gi,
  /"name"\s*:\s*"[^"]*"/gi, // Schema FAQ names
  /<option[^>]*>[\s\S]*?<\/option>/gi,
  /placeholder="[^"]*"/gi,
  /I agree to be contacted/gi,
  /I have a question/gi,
  /<title>[^<]*<\/title>/gi,
  /<meta[^>]*content="[^"]*"/gi
];

// Files/directories to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git/,
  /audit/,
  /tools\/site-quality-gate/,
  /src\/config/,
  /functions\//
];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(p => p.test(filePath));
}

function stripExcludedContexts(html) {
  let cleaned = html;
  for (const pattern of EXCLUDE_CONTEXTS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
}

function findMatches(content, patterns, filePath) {
  const matches = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, token, phrase } of patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        matches.push({
          file: filePath,
          line: i + 1,
          token: token || phrase,
          content: line.trim().substring(0, 100)
        });
      }
    }
  }

  return matches;
}

// Find all HTML files
const allFiles = [];
function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;

    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.html')) {
      allFiles.push(fullPath);
    }
  }
}

walkDir(ROOT);

const firstPersonMatches = [];
const vagueMatches = [];

for (const file of allFiles) {
  const relativePath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf-8');
  const cleanedContent = stripExcludedContexts(content);

  // Check first-person
  const fpMatches = findMatches(cleanedContent, FIRST_PERSON_PATTERNS, relativePath);
  firstPersonMatches.push(...fpMatches);

  // Check vague phrases
  const vMatches = findMatches(cleanedContent, VAGUE_PHRASES, relativePath);
  vagueMatches.push(...vMatches);
}

// Write reports
const fpReport = firstPersonMatches.length > 0
  ? firstPersonMatches.map(m => `${m.file}:${m.line} [${m.token}] ${m.content}`).join('\n')
  : 'No first-person language found.';

const vagueReport = vagueMatches.length > 0
  ? vagueMatches.map(m => `${m.file}:${m.line} [${m.token}] ${m.content}`).join('\n')
  : 'No vague phrases found.';

fs.writeFileSync(path.join(ROOT, 'audit/first-person-matches.txt'), fpReport);
fs.writeFileSync(path.join(ROOT, 'audit/vague-matches.txt'), vagueReport);

console.log('Content Lint Report');
console.log('===================');
console.log(`First-person matches: ${firstPersonMatches.length}`);
console.log(`Vague phrase matches: ${vagueMatches.length}`);

if (firstPersonMatches.length > 0) {
  console.log('\n--- First-person matches ---');
  firstPersonMatches.slice(0, 10).forEach(m => {
    console.log(`  ${m.file}:${m.line} [${m.token}]`);
  });
  if (firstPersonMatches.length > 10) {
    console.log(`  ... and ${firstPersonMatches.length - 10} more`);
  }
}

if (vagueMatches.length > 0) {
  console.log('\n--- Vague phrase matches ---');
  vagueMatches.slice(0, 10).forEach(m => {
    console.log(`  ${m.file}:${m.line} [${m.token}]`);
  });
  if (vagueMatches.length > 10) {
    console.log(`  ... and ${vagueMatches.length - 10} more`);
  }
}

const hasErrors = firstPersonMatches.length > 0 || vagueMatches.length > 0;

if (hasErrors) {
  console.log('\n❌ Content lint failed. See audit/*.txt for details.');
  process.exit(1);
} else {
  console.log('\n✓ Content lint passed.');
  process.exit(0);
}
