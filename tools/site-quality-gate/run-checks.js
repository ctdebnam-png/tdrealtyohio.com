#!/usr/bin/env node

/**
 * Site Quality Gate - Main Entry Point
 * Runs all quality checks and outputs results
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

// Check modules
const checkLinks = require('./checks/links');
const checkSeo = require('./checks/seo');
const checkBusiness = require('./checks/business');
const checkSitemap = require('./checks/sitemap');
const checkSchema = require('./checks/schema');

// Parse command line arguments
const args = process.argv.slice(2);
const onlyCheck = args.find(a => a.startsWith('--only='))?.split('=')[1];
const verbose = args.includes('--verbose') || args.includes('-v');
const ciMode = args.includes('--ci');

async function main() {
  console.log('='.repeat(60));
  console.log('TD Realty Ohio - Site Quality Gate');
  console.log('='.repeat(60));
  console.log();

  const results = {
    timestamp: new Date().toISOString(),
    passed: true,
    checks: {}
  };

  const checks = [
    { name: 'links', fn: checkLinks, label: 'Link Validation' },
    { name: 'seo', fn: checkSeo, label: 'SEO Tags' },
    { name: 'business', fn: checkBusiness, label: 'Business Facts' },
    { name: 'sitemap', fn: checkSitemap, label: 'Sitemap Consistency' },
    { name: 'schema', fn: checkSchema, label: 'Schema.org Structured Data' }
  ];

  for (const check of checks) {
    if (onlyCheck && check.name !== onlyCheck) {
      continue;
    }

    console.log(`Running check: ${check.label}...`);
    console.log('-'.repeat(40));

    try {
      const checkResult = await check.fn(config, verbose);
      results.checks[check.name] = checkResult;

      if (!checkResult.passed) {
        results.passed = false;
      }

      // Print summary
      if (checkResult.errors && checkResult.errors.length > 0) {
        console.log(`  ERRORS: ${checkResult.errors.length}`);
        if (verbose || ciMode) {
          checkResult.errors.forEach(err => {
            console.log(`    - ${err.file}: ${err.message}`);
          });
        }
      }

      if (checkResult.warnings && checkResult.warnings.length > 0) {
        console.log(`  WARNINGS: ${checkResult.warnings.length}`);
        if (verbose) {
          checkResult.warnings.forEach(warn => {
            console.log(`    - ${warn.file}: ${warn.message}`);
          });
        }
      }

      const status = checkResult.passed ? 'PASSED' : 'FAILED';
      console.log(`  Status: ${status}`);
    } catch (err) {
      console.error(`  Error running check: ${err.message}`);
      results.checks[check.name] = {
        passed: false,
        error: err.message
      };
      results.passed = false;
    }

    console.log();
  }

  // Write results to JSON file
  const reportsDir = path.resolve(__dirname, config.reportsDir);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportFile = path.join(reportsDir, 'latest.json');
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`Report written to: ${reportFile}`);

  // Also write timestamped report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const timestampedFile = path.join(reportsDir, `report-${timestamp}.json`);
  fs.writeFileSync(timestampedFile, JSON.stringify(results, null, 2));

  // Final summary
  console.log();
  console.log('='.repeat(60));
  if (results.passed) {
    console.log('QUALITY GATE: PASSED');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.log('QUALITY GATE: FAILED');
    console.log('='.repeat(60));
    console.log();
    console.log('Fix the errors above and run checks again.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
