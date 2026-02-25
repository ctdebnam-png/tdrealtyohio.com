/**
 * Centralized Inline Script Check
 *
 * Detects duplicated inline analytics bootstrap signatures and enforces use of
 * centralized external includes.
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const LEGACY_SIGNATURES = [
  "s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17866418952';",
  "if (localStorage.getItem('cookie-consent') !== 'declined')"
];

const REQUIRED_EXTERNAL_INCLUDE = '<script src="/assets/js/analytics-consent.js"></script>';

async function listTargetFiles(config) {
  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);
  const checkConfig = config.centralizedInlineScriptCheck || {};
  const includeGlobs = checkConfig.includeGlobs || ['tools/**/*.html'];
  const excludeDirs = checkConfig.excludeDirs || ['node_modules', 'reports', '.git', 'templates', 'data'];

  const seen = new Set();
  const files = [];

  for (const includeGlob of includeGlobs) {
    const matches = await glob(includeGlob, {
      cwd: siteRoot,
      absolute: true,
      ignore: excludeDirs.map((d) => `${d}/**`)
    });

    for (const absolute of matches) {
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      files.push({
        absolute,
        relative: path.relative(siteRoot, absolute)
      });
    }
  }

  return files;
}

async function checkCentralizedInlineScripts(config) {
  const results = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      legacyInlineMatches: 0,
      missingCentralizedInclude: 0
    }
  };

  const files = await listTargetFiles(config);
  results.stats.filesChecked = files.length;

  for (const file of files) {
    const html = fs.readFileSync(file.absolute, 'utf8');

    const hasLegacy = LEGACY_SIGNATURES.some((signature) => html.includes(signature));
    if (hasLegacy) {
      results.errors.push({
        file: file.relative,
        message: 'Found duplicated inline analytics bootstrap signature. Use /assets/js/analytics-consent.js include instead.'
      });
      results.stats.legacyInlineMatches += 1;
      results.passed = false;
    }

    if (!html.includes(REQUIRED_EXTERNAL_INCLUDE)) {
      results.errors.push({
        file: file.relative,
        message: 'Missing centralized analytics include <script src="/assets/js/analytics-consent.js"></script>.'
      });
      results.stats.missingCentralizedInclude += 1;
      results.passed = false;
    }
  }

  return results;
}

module.exports = checkCentralizedInlineScripts;
