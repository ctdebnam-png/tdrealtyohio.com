#!/usr/bin/env node
/**
 * TD Realty Ohio - Site Audit Script
 *
 * Checks for common issues:
 * 1. Internal hrefs containing .html (should use clean routes)
 * 2. Hamburger button has aria-controls attribute
 * 3. Slider track CSS uses --value variable
 *
 * Usage: node tools/site-audit/audit.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const HTML_EXTENSIONS = ['.html'];
const WARNINGS = [];
const PASSES = [];

// Colors for console output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

/**
 * Recursively find all HTML files
 */
function findHtmlFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules and hidden directories
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'tools') {
      continue;
    }

    if (entry.isDirectory()) {
      findHtmlFiles(fullPath, files);
    } else if (HTML_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check 1: Internal hrefs containing .html
 */
function checkInternalHtmlLinks(filePath, content) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  // Match href="/something.html" (internal links with .html extension)
  const internalHtmlLinkRegex = /href="\/[^"]*\.html"/g;
  const matches = content.match(internalHtmlLinkRegex);

  if (matches && matches.length > 0) {
    WARNINGS.push({
      file: relativePath,
      issue: `Found ${matches.length} internal .html href(s)`,
      details: matches.slice(0, 5).join(', ') + (matches.length > 5 ? '...' : '')
    });
  }
}

/**
 * Check 2: Hamburger button has aria-controls
 */
function checkHamburgerAria(filePath, content) {
  const relativePath = path.relative(ROOT_DIR, filePath);

  // Look for mobile menu button
  if (content.includes('mobile-menu-btn')) {
    // Check if it has aria-controls
    const hasAriaControls = /mobile-menu-btn[^>]*aria-controls=/i.test(content);
    const hasAriaExpanded = /mobile-menu-btn[^>]*aria-expanded=/i.test(content);

    if (!hasAriaControls) {
      WARNINGS.push({
        file: relativePath,
        issue: 'Hamburger button missing aria-controls attribute',
        details: 'Add aria-controls="main-nav" to #mobile-menu-btn'
      });
    } else {
      PASSES.push(`${relativePath}: Hamburger button has aria-controls`);
    }

    if (!hasAriaExpanded) {
      WARNINGS.push({
        file: relativePath,
        issue: 'Hamburger button missing aria-expanded attribute',
        details: 'Add aria-expanded="false" to #mobile-menu-btn'
      });
    }
  }
}

/**
 * Check 3: Slider track uses --value CSS variable
 */
function checkSliderTrack(filePath, content) {
  const relativePath = path.relative(ROOT_DIR, filePath);

  // Only check CSS files or inline styles in HTML
  if (content.includes('calculator-range') && content.includes('-webkit-slider-runnable-track')) {
    // Check if track uses --value variable
    const hasValueVariable = /slider-runnable-track[^}]*var\(--value/i.test(content);

    if (!hasValueVariable) {
      WARNINGS.push({
        file: relativePath,
        issue: 'Slider track may not use --value CSS variable',
        details: 'Ensure ::-webkit-slider-runnable-track uses var(--value) for fill'
      });
    } else {
      PASSES.push(`${relativePath}: Slider track uses --value variable`);
    }
  }
}

/**
 * Check JS for updateSliderTrack function
 */
function checkSliderJs(filePath, content) {
  const relativePath = path.relative(ROOT_DIR, filePath);

  if (filePath.endsWith('.js') && content.includes('updateSliderTrack')) {
    const setsValueVariable = content.includes("style.setProperty('--value'") ||
                              content.includes('style.setProperty("--value"');

    if (setsValueVariable) {
      PASSES.push(`${relativePath}: updateSliderTrack sets --value CSS variable`);
    } else {
      WARNINGS.push({
        file: relativePath,
        issue: 'updateSliderTrack may not set --value CSS variable',
        details: 'Ensure function calls slider.style.setProperty(\'--value\', percentage + \'%\')'
      });
    }
  }
}

/**
 * Main audit function
 */
function runAudit() {
  console.log('\n===========================================');
  console.log('   TD Realty Ohio - Site Audit');
  console.log('===========================================\n');

  // Find all HTML files
  const htmlFiles = findHtmlFiles(ROOT_DIR);
  console.log(`Found ${htmlFiles.length} HTML files to check.\n`);

  // Check each file
  for (const filePath of htmlFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');

    checkInternalHtmlLinks(filePath, content);
    checkHamburgerAria(filePath, content);
  }

  // Check CSS file for slider track
  const cssPath = path.join(ROOT_DIR, 'assets/css/styles.css');
  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    checkSliderTrack(cssPath, cssContent);
  }

  // Check JS file for slider function
  const jsPath = path.join(ROOT_DIR, 'assets/js/main.js');
  if (fs.existsSync(jsPath)) {
    const jsContent = fs.readFileSync(jsPath, 'utf-8');
    checkSliderJs(jsPath, jsContent);
  }

  // Print results
  if (PASSES.length > 0) {
    console.log(`${GREEN}PASSED CHECKS:${RESET}`);
    PASSES.forEach(pass => console.log(`  ${GREEN}✓${RESET} ${pass}`));
    console.log('');
  }

  if (WARNINGS.length > 0) {
    console.log(`${YELLOW}WARNINGS:${RESET}`);
    WARNINGS.forEach(warning => {
      console.log(`  ${YELLOW}⚠${RESET} ${warning.file}`);
      console.log(`    Issue: ${warning.issue}`);
      console.log(`    ${warning.details}`);
      console.log('');
    });
  } else {
    console.log(`${GREEN}No issues found!${RESET}\n`);
  }

  // Summary
  console.log('-------------------------------------------');
  console.log(`Total files checked: ${htmlFiles.length}`);
  console.log(`${GREEN}Passes: ${PASSES.length}${RESET}`);
  console.log(`${WARNINGS.length > 0 ? YELLOW : GREEN}Warnings: ${WARNINGS.length}${RESET}`);
  console.log('-------------------------------------------\n');

  // Exit with error code if warnings found
  process.exit(WARNINGS.length > 0 ? 1 : 0);
}

// Run the audit
runAudit();
