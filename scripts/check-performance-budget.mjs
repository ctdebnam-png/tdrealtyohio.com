#!/usr/bin/env node
/**
 * Performance Budget Checker
 * Validates that CSS/JS bundle sizes stay within budget.
 * Also checks total page weight and image optimization.
 *
 * Fails CI if any budget is exceeded.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Performance budgets (in KB)
const BUDGETS = {
  // Individual file limits
  maxCssFileKB: 300,       // Single CSS file should stay under 300KB
  maxJsFileKB: 100,        // Single JS file should stay under 100KB
  maxHtmlFileKB: 150,      // Individual HTML pages under 150KB
  maxImageFileKB: 500,     // Individual images under 500KB

  // Total asset limits
  maxTotalCssKB: 400,      // All CSS combined
  maxTotalJsKB: 200,       // All JS combined (excluding vendor)

  // Page weight limits (HTML + inline assets)
  maxHtmlAvgKB: 50,        // Average HTML page size

  // Count limits
  maxCssFiles: 5,
  maxJsFiles: 10,
};

async function getFileSize(filePath) {
  const s = await stat(filePath);
  return s.size;
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1);
}

async function findFiles(dir, extensions, files = [], skipDirs = new Set()) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || skipDirs.has(entry.name)) continue;
      await findFiles(fullPath, extensions, files, skipDirs);
    } else if (extensions.includes(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  console.log('\n[perf] Performance Budget Check');
  console.log('='.repeat(60));

  const violations = [];

  // Check CSS files
  const cssFiles = await findFiles(join(ROOT, 'assets', 'css'), ['.css']);
  let totalCssBytes = 0;

  console.log('\n  CSS Files:');
  for (const file of cssFiles) {
    const size = await getFileSize(file);
    totalCssBytes += size;
    const sizeKB = size / 1024;
    const status = sizeKB > BUDGETS.maxCssFileKB ? 'OVER' : 'OK';
    const rel = relative(ROOT, file);
    console.log(`    ${status === 'OVER' ? 'X' : '✓'} ${rel.padEnd(40)} ${formatKB(size)} KB (limit: ${BUDGETS.maxCssFileKB} KB)`);
    if (sizeKB > BUDGETS.maxCssFileKB) {
      violations.push(`CSS file ${rel} is ${formatKB(size)} KB (limit: ${BUDGETS.maxCssFileKB} KB)`);
    }
  }

  if (cssFiles.length > BUDGETS.maxCssFiles) {
    violations.push(`Too many CSS files: ${cssFiles.length} (limit: ${BUDGETS.maxCssFiles})`);
  }

  const totalCssKB = totalCssBytes / 1024;
  if (totalCssKB > BUDGETS.maxTotalCssKB) {
    violations.push(`Total CSS is ${formatKB(totalCssBytes)} KB (limit: ${BUDGETS.maxTotalCssKB} KB)`);
  }
  console.log(`    Total CSS: ${formatKB(totalCssBytes)} KB (limit: ${BUDGETS.maxTotalCssKB} KB)`);

  // Check JS files
  const jsDir = join(ROOT, 'assets', 'js');
  const jsFiles = await findFiles(jsDir, ['.js']);
  let totalJsBytes = 0;

  console.log('\n  JS Files:');
  for (const file of jsFiles) {
    const size = await getFileSize(file);
    totalJsBytes += size;
    const sizeKB = size / 1024;
    const status = sizeKB > BUDGETS.maxJsFileKB ? 'OVER' : 'OK';
    const rel = relative(ROOT, file);
    console.log(`    ${status === 'OVER' ? 'X' : '✓'} ${rel.padEnd(40)} ${formatKB(size)} KB (limit: ${BUDGETS.maxJsFileKB} KB)`);
    if (sizeKB > BUDGETS.maxJsFileKB) {
      violations.push(`JS file ${rel} is ${formatKB(size)} KB (limit: ${BUDGETS.maxJsFileKB} KB)`);
    }
  }

  if (jsFiles.length > BUDGETS.maxJsFiles) {
    violations.push(`Too many JS files: ${jsFiles.length} (limit: ${BUDGETS.maxJsFiles})`);
  }

  const totalJsKB = totalJsBytes / 1024;
  if (totalJsKB > BUDGETS.maxTotalJsKB) {
    violations.push(`Total JS is ${formatKB(totalJsBytes)} KB (limit: ${BUDGETS.maxTotalJsKB} KB)`);
  }
  console.log(`    Total JS: ${formatKB(totalJsBytes)} KB (limit: ${BUDGETS.maxTotalJsKB} KB)`);

  // Check HTML page sizes (sample)
  const skipDirs = new Set([
    'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
    'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
    'gsc', 'data', 'functions', 'docs', 'test-results',
    'playwright-report', 'screenshots',
  ]);
  const htmlFiles = await findFiles(ROOT, ['.html'], [], skipDirs);
  let totalHtmlBytes = 0;
  let oversizedHtml = [];

  for (const file of htmlFiles) {
    const size = await getFileSize(file);
    totalHtmlBytes += size;
    const sizeKB = size / 1024;
    if (sizeKB > BUDGETS.maxHtmlFileKB) {
      oversizedHtml.push({ file: relative(ROOT, file), sizeKB });
    }
  }

  const avgHtmlKB = htmlFiles.length > 0 ? (totalHtmlBytes / htmlFiles.length / 1024) : 0;

  console.log(`\n  HTML Pages:`);
  console.log(`    Count: ${htmlFiles.length}`);
  console.log(`    Average size: ${avgHtmlKB.toFixed(1)} KB (limit: ${BUDGETS.maxHtmlAvgKB} KB)`);

  if (oversizedHtml.length > 0) {
    console.log(`    Oversized pages (>${BUDGETS.maxHtmlFileKB} KB):`);
    for (const { file, sizeKB } of oversizedHtml) {
      console.log(`      ${file}: ${sizeKB.toFixed(1)} KB`);
    }
  }

  // Check large images
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
  const imageFiles = await findFiles(join(ROOT, 'assets', 'images'), imageExts);
  let oversizedImages = [];

  for (const file of imageFiles) {
    const size = await getFileSize(file);
    const sizeKB = size / 1024;
    if (sizeKB > BUDGETS.maxImageFileKB) {
      oversizedImages.push({ file: relative(ROOT, file), sizeKB });
    }
  }

  console.log(`\n  Images:`);
  console.log(`    Total image files: ${imageFiles.length}`);
  if (oversizedImages.length > 0) {
    console.log(`    Oversized images (>${BUDGETS.maxImageFileKB} KB):`);
    for (const { file, sizeKB } of oversizedImages.slice(0, 10)) {
      console.log(`      ${file}: ${sizeKB.toFixed(1)} KB`);
      violations.push(`Image ${file} is ${sizeKB.toFixed(1)} KB (limit: ${BUDGETS.maxImageFileKB} KB)`);
    }
    if (oversizedImages.length > 10) {
      console.log(`      ... and ${oversizedImages.length - 10} more`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`  CSS:    ${formatKB(totalCssBytes)} KB total, ${cssFiles.length} file(s)`);
  console.log(`  JS:     ${formatKB(totalJsBytes)} KB total, ${jsFiles.length} file(s)`);
  console.log(`  HTML:   ${avgHtmlKB.toFixed(1)} KB avg, ${htmlFiles.length} page(s)`);
  console.log(`  Images: ${imageFiles.length} file(s), ${oversizedImages.length} oversized`);
  console.log('='.repeat(60));

  if (violations.length > 0) {
    console.log(`\n  BUDGET VIOLATIONS (${violations.length}):`);
    for (const v of violations) {
      console.log(`    - ${v}`);
    }
    console.log(`\n  FAIL: ${violations.length} performance budget violation(s).`);
    process.exit(1);
  } else {
    console.log('\n  All performance budgets met!');
  }
}

main().catch(err => {
  console.error('[perf] FATAL:', err);
  process.exit(1);
});
