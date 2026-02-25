/**
 * Asset budget check for CSS/JS regression guard.
 */

const fs = require('fs');
const path = require('path');

function fileSize(filePath) {
  return fs.statSync(filePath).size;
}

module.exports = async function checkAssetBudget(config) {
  const result = { passed: true, errors: [], warnings: [], meta: {} };
  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);
  const budget = config.assetBudget || {};

  const cssFiles = (budget.cssFiles || []).map(f => path.join(siteRoot, f));
  const jsFiles = (budget.jsFiles || []).map(f => path.join(siteRoot, f));

  let cssBytes = 0;
  for (const cssFile of cssFiles) {
    if (!fs.existsSync(cssFile)) {
      result.errors.push({ file: path.relative(siteRoot, cssFile), message: 'Missing CSS file in budget config' });
      result.passed = false;
      continue;
    }
    cssBytes += fileSize(cssFile);
  }

  let jsBytes = 0;
  for (const jsFile of jsFiles) {
    if (!fs.existsSync(jsFile)) {
      result.errors.push({ file: path.relative(siteRoot, jsFile), message: 'Missing JS file in budget config' });
      result.passed = false;
      continue;
    }
    jsBytes += fileSize(jsFile);
  }

  result.meta = {
    cssBytes,
    cssBudgetBytes: budget.maxCssBytes,
    jsBytes,
    jsBudgetBytes: budget.maxJsBytes
  };

  if (typeof budget.maxCssBytes === 'number' && cssBytes > budget.maxCssBytes) {
    result.errors.push({
      file: 'assets/css',
      message: `CSS budget exceeded (${cssBytes} > ${budget.maxCssBytes} bytes)`
    });
    result.passed = false;
  }

  if (typeof budget.maxJsBytes === 'number' && jsBytes > budget.maxJsBytes) {
    result.errors.push({
      file: 'assets/js',
      message: `JS budget exceeded (${jsBytes} > ${budget.maxJsBytes} bytes)`
    });
    result.passed = false;
  }

  return result;
};
