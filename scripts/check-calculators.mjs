#!/usr/bin/env node

/**
 * check-calculators.mjs
 * Static analysis checks for calculator safety:
 * 1. Fail if calculator output code can produce NaN or negative values
 *    (must use Math.round, clampPrice/parseInt, and Math.max for subtraction results).
 * 2. Fail if range slider inputs lack keyboard focusability
 *    (must not have tabindex="-1").
 */

import { readFileSync } from 'fs';
import { glob } from 'glob';

let errors = 0;

// --- Check 1: main.js calculator safety ---
const mainJs = readFileSync('assets/js/main.js', 'utf8');

// Check that clampPrice function exists
if (!mainJs.includes('function clampPrice')) {
  console.error('FAIL: assets/js/main.js — missing clampPrice() helper for input validation');
  errors++;
} else {
  console.log('  clampPrice() helper present ✓');
}

// Check that seller calculator uses clampPrice
if (mainJs.includes('initSellerCalculator') && !mainJs.match(/function initSellerCalculator[\s\S]*?clampPrice/)) {
  console.error('FAIL: assets/js/main.js — initSellerCalculator does not use clampPrice()');
  errors++;
} else {
  console.log('  initSellerCalculator uses clampPrice ✓');
}

// Check that buyer calculator uses clampPrice
if (mainJs.includes('initBuyerCalculator') && !mainJs.match(/function initBuyerCalculator[\s\S]*?clampPrice/)) {
  console.error('FAIL: assets/js/main.js — initBuyerCalculator does not use clampPrice()');
  errors++;
} else {
  console.log('  initBuyerCalculator uses clampPrice ✓');
}

// Check Math.round usage in calculator functions
const calcSection = mainJs.match(/function initSellerCalculator[\s\S]*?^}/m);
if (calcSection && !calcSection[0].includes('Math.round')) {
  console.error('FAIL: assets/js/main.js — initSellerCalculator does not use Math.round() for output rounding');
  errors++;
} else {
  console.log('  Math.round in seller calculator ✓');
}

// Check Math.max(0) for subtraction results (savings, agentKeeps)
if (mainJs.includes('Math.max(traditional - tdRealty, 0)') || mainJs.includes('Math.max(savings')) {
  console.log('  Math.max(0) for seller savings ✓');
} else {
  console.error('FAIL: assets/js/main.js — seller savings subtraction not guarded with Math.max(x, 0)');
  errors++;
}

if (mainJs.includes('Math.max(commission - buyer support, 0)') || mainJs.includes('Math.max(agentKeeps')) {
  console.log('  Math.max(0) for buyer agentKeeps ✓');
} else {
  console.error('FAIL: assets/js/main.js — buyer agentKeeps subtraction not guarded with Math.max(x, 0)');
  errors++;
}

// --- Check 2: slider inputs must be keyboard-focusable ---
const htmlFiles = await glob('**/*.html', {
  cwd: process.cwd(),
  ignore: ['node_modules/**', '.git/**'],
  absolute: true,
});

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const relPath = file.replace(process.cwd() + '/', '');

  // Find all range inputs
  const rangeRegex = /<input\s[^>]*type\s*=\s*["']range["'][^>]*>/gi;
  let match;
  while ((match = rangeRegex.exec(html)) !== null) {
    const tag = match[0];
    // Check for tabindex="-1" which would prevent keyboard focus
    if (tag.match(/tabindex\s*=\s*["']-1["']/i)) {
      const lineNum = (html.substring(0, match.index).match(/\n/g) || []).length + 1;
      console.error(`FAIL: ${relPath}:${lineNum} — range input has tabindex="-1", not keyboard-focusable`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} calculator check(s) failed.`);
  process.exit(1);
} else {
  console.log('\ncheck-calculators: all checks passed ✓');
}
