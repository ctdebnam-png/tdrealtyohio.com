#!/usr/bin/env node
/**
 * Fix Navigation Consistency
 * Adds Tools nav link to all pages missing it
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

// Directories to skip
const SKIP_DIRS = ['node_modules', '.git', 'audit', 'scripts', 'tools/site-quality-gate', 'reports', 'tests', 'functions', 'templates', 'data', 'assets'];

function findHtmlFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = relative(PROJECT_ROOT, fullPath);

    if (SKIP_DIRS.some(skip => relativePath.startsWith(skip))) {
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findHtmlFiles(fullPath, files);
    } else if (entry === 'index.html') {
      files.push(fullPath);
    }
  }

  return files;
}

function hasToolsNavLink(html) {
  // Check if Tools link exists in nav
  return /<nav[^>]*>[\s\S]*?<a[^>]+href=["']\/tools\/["'][^>]*>[\s\S]*?<\/nav>/i.test(html);
}

function addToolsNavLink(html) {
  // Find the nav and add Tools after Buyers link
  // Pattern: after </a> for Buyers, before the next <a
  const buyersLinkPattern = /(<a[^>]+href=["']\/buyers\/["'][^>]*>[^<]*<\/a>)(\s*)(<a[^>]+href=["']\/)/g;

  if (buyersLinkPattern.test(html)) {
    // Reset regex state
    buyersLinkPattern.lastIndex = 0;

    return html.replace(buyersLinkPattern, (match, buyersLink, whitespace, nextLink) => {
      return `${buyersLink}${whitespace}<a href="/tools/" class="nav-link">Tools</a>${whitespace}${nextLink}`;
    });
  }

  return html;
}

function run() {
  console.log('Fixing navigation consistency...\n');

  const htmlFiles = findHtmlFiles(PROJECT_ROOT);
  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const filePath of htmlFiles) {
    const relativePath = relative(PROJECT_ROOT, filePath);

    try {
      let html = readFileSync(filePath, 'utf-8');

      if (hasToolsNavLink(html)) {
        skipped++;
        continue;
      }

      const newHtml = addToolsNavLink(html);

      if (newHtml !== html) {
        writeFileSync(filePath, newHtml);
        console.log(`✓ Fixed: ${relativePath}`);
        fixed++;
      } else {
        console.log(`⚠ Could not fix: ${relativePath}`);
        errors++;
      }
    } catch (error) {
      console.error(`✗ Error processing ${relativePath}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\nSummary:`);
  console.log(`  Fixed: ${fixed}`);
  console.log(`  Already correct: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

run();
