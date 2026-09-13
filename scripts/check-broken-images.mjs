#!/usr/bin/env node
/**
 * Broken Image Checker
 * Scans all HTML files for <img> tags and verifies that referenced
 * image files exist on disk. Also checks CSS background-image urls.
 *
 * Fails CI if any broken images are found.
 */

import { readdir, readFile, access } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
  'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
  'gsc', 'data', 'functions', 'docs', 'test-results',
  'playwright-report', 'screenshots',
]);

async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      await findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractImageSources(html) {
  const sources = [];

  // <img src="...">
  const imgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    sources.push(match[1]);
  }

  // <source srcset="...">
  const srcsetRegex = /\bsrcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const entries = match[1].split(',');
    for (const entry of entries) {
      const src = entry.trim().split(/\s+/)[0];
      if (src) sources.push(src);
    }
  }

  // background-image in inline styles
  const bgRegex = /background(?:-image)?\s*:\s*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    sources.push(match[1]);
  }

  // <link rel="preload" as="image" href="...">
  const preloadRegex = /<link\b[^>]*\bas=["']image["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  while ((match = preloadRegex.exec(html)) !== null) {
    sources.push(match[1]);
  }

  return sources;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function resolveImagePath(src, htmlFile) {
  // Skip external URLs, data URIs, and protocol-relative URLs
  if (src.startsWith('http://') || src.startsWith('https://') ||
      src.startsWith('data:') || src.startsWith('//')) {
    return null;
  }

  // Remove query strings and hash fragments
  const cleanSrc = src.split('?')[0].split('#')[0];

  // Absolute path (starts with /)
  if (cleanSrc.startsWith('/')) {
    return join(ROOT, cleanSrc);
  }

  // Relative path
  const htmlDir = dirname(htmlFile);
  return resolve(htmlDir, cleanSrc);
}

async function main() {
  console.log('\n[images] Broken Image Checker');
  console.log('='.repeat(60));

  const htmlFiles = await findHtmlFiles(ROOT);
  const broken = [];
  let totalImages = 0;

  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf-8');
    const sources = extractImageSources(html);

    for (const src of sources) {
      const resolved = resolveImagePath(src, filePath);
      if (!resolved) continue; // Skip external URLs

      totalImages++;

      if (!(await fileExists(resolved))) {
        const pagePath = '/' + relative(ROOT, filePath).replace(/\\/g, '/');
        broken.push({ pagePath, src, resolved: relative(ROOT, resolved) });
      }
    }
  }

  if (broken.length > 0) {
    console.log('\n  BROKEN IMAGES:');
    for (const { pagePath, src } of broken) {
      console.log(`    ${pagePath}`);
      console.log(`      src: ${src}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  HTML files scanned:  ${htmlFiles.length}`);
  console.log(`  Image refs checked:  ${totalImages}`);
  console.log(`  Broken images:       ${broken.length}`);
  console.log('='.repeat(60));

  if (broken.length > 0) {
    console.log(`\n  FAIL: ${broken.length} broken image(s) found.`);
    process.exit(1);
  } else {
    console.log('\n  All image references are valid!');
  }
}

main().catch(err => {
  console.error('[images] FATAL:', err);
  process.exit(1);
});
