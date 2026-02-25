/**
 * CSS selector usage audit by template family.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { getHtmlFiles } = require('./utils');

function extractSelectors(cssText) {
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  const blocks = withoutComments.split('}');

  for (const block of blocks) {
    const beforeBrace = block.split('{')[0];
    if (!beforeBrace) continue;
    const header = beforeBrace.trim();
    if (!header || header.startsWith('@')) continue;

    header.split(',').forEach(rawSelector => {
      const selector = rawSelector.trim();
      if (!selector) return;
      if (selector.includes('%')) return; // keyframe steps etc.
      selectors.push(selector);
    });
  }

  return [...new Set(selectors)];
}

function normalizeForCheerio(selector) {
  return selector
    .replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '')
    .replace(/:not\(([^)]*)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function selectorUsed(selector, htmlDocs) {
  const normalized = normalizeForCheerio(selector);
  if (!normalized) return true;

  for (const { $ } of htmlDocs) {
    try {
      if ($(normalized).length > 0) return true;
    } catch {
      // selector unsupported by cheerio parser; skip false positives
      return true;
    }
  }

  return false;
}

function familyForFile(relativePath) {
  if (relativePath.startsWith('lp/')) return 'landing-pages';
  if (relativePath.startsWith('tools/')) return 'tools';
  if (relativePath.startsWith('areas/')) return 'areas';
  if (relativePath.startsWith('blog/')) return 'blog';
  return 'core';
}

module.exports = async function checkCssUsage(config, verbose = false) {
  const result = { passed: true, errors: [], warnings: [], meta: {} };
  const siteRoot = path.resolve(__dirname, '..', config.siteRoot);

  const htmlFiles = await getHtmlFiles(config);
  const docsByFamily = new Map();

  for (const file of htmlFiles) {
    const family = familyForFile(file.relative.replace(/\\/g, '/'));
    if (!docsByFamily.has(family)) docsByFamily.set(family, []);
    const html = fs.readFileSync(file.absolute, 'utf-8');
    docsByFamily.get(family).push({ file: file.relative, $: cheerio.load(html) });
  }

  const familySheets = config.cssUsage?.families || {};

  for (const [family, sheets] of Object.entries(familySheets)) {
    const docs = docsByFamily.get(family) || [];
    if (docs.length === 0) continue;

    const selectors = new Set();
    for (const relSheet of sheets) {
      const cssPath = path.join(siteRoot, relSheet);
      if (!fs.existsSync(cssPath)) {
        result.errors.push({ file: relSheet, message: `Missing stylesheet for family ${family}` });
        result.passed = false;
        continue;
      }

      const css = fs.readFileSync(cssPath, 'utf-8');
      extractSelectors(css).forEach(s => selectors.add(s));
    }

    const unused = [];
    for (const selector of selectors) {
      if (!selectorUsed(selector, docs)) unused.push(selector);
    }

    result.meta[family] = {
      htmlFiles: docs.length,
      selectorCount: selectors.size,
      unusedCount: unused.length
    };

    if (unused.length > 0) {
      const sample = unused.slice(0, 25).join(', ');
      result.warnings.push({
        file: family,
        message: `Unused selectors: ${unused.length}/${selectors.size}. Sample: ${sample}`
      });
    }

    if (verbose) {
      console.log(`  ${family}: ${unused.length}/${selectors.size} selectors unused across ${docs.length} pages`);
    }
  }

  return result;
};
