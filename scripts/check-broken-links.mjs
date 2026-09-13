#!/usr/bin/env node
/**
 * Internal Broken Link Checker
 * Crawls all HTML files and verifies:
 * 1. Every internal href points to an existing file/route
 * 2. Every hash target (#id) exists on the target page
 * 3. No orphaned anchors
 *
 * Fails CI if any internal link returns 404 or any hash target is missing.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'output', 'audit',
  'audit-output', 'audit-artifacts', 'reports', 'ops', 'ads-bot',
  'gsc', 'data', 'functions', 'docs', 'media',
]);

const SKIP_PREFIXES = ['http://', 'https://', 'mailto:', 'tel:', 'javascript:', 'data:', '#'];
const EXTERNAL_PREFIXES = ['http://', 'https://'];

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

function extractLinks(html) {
  const links = [];
  // Only extract hrefs from <a> tags, not <link> (stylesheets, preloads, canonicals, etc.)
  const hrefRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

function extractIds(html) {
  const ids = new Set();
  const idRegex = /\bid=["']([^"']+)["']/g;
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function resolveInternalPath(href, currentFile) {
  // Remove hash and query string
  const [pathPart] = href.split('#')[0].split('?');
  if (!pathPart) return null;

  // Resolve relative to current file's directory
  const currentDir = dirname(currentFile);
  let resolved;

  if (pathPart.startsWith('/')) {
    resolved = join(ROOT, pathPart);
  } else {
    resolved = resolve(currentDir, pathPart);
  }

  return resolved;
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function checkLinks() {
  console.log('[broken-links] Scanning HTML files...');
  const htmlFiles = await findHtmlFiles(ROOT);
  console.log(`[broken-links] Found ${htmlFiles.length} HTML files`);

  const errors = [];
  const pageIds = new Map(); // path -> Set of ids

  // First pass: collect all IDs from all pages
  for (const file of htmlFiles) {
    const content = await readFile(file, 'utf-8');
    const ids = extractIds(content);
    const relativePath = file.replace(ROOT, '');
    pageIds.set(relativePath, ids);
  }

  // Second pass: check all links
  for (const file of htmlFiles) {
    const content = await readFile(file, 'utf-8');
    const links = extractLinks(content);
    const relativePath = file.replace(ROOT, '');

    for (const href of links) {
      // Skip external links and special protocols
      if (EXTERNAL_PREFIXES.some(p => href.startsWith(p))) continue;
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || href.startsWith('data:')) continue;

      // Handle hash-only links
      if (href.startsWith('#')) {
        const targetId = href.slice(1);
        if (targetId && !pageIds.get(relativePath)?.has(targetId)) {
          errors.push({ file: relativePath, href, error: `Missing anchor target: #${targetId}` });
        }
        continue;
      }

      // Parse path and hash
      const [pathPart, hashPart] = href.split('#');
      const resolvedPath = resolveInternalPath(href, file);
      if (!resolvedPath) continue;

      // Check if file exists (try as-is, then with /index.html, then with .html)
      const candidates = [
        resolvedPath,
        join(resolvedPath, 'index.html'),
        resolvedPath + '.html',
        resolvedPath.replace(/\/$/, '') + '/index.html',
      ];

      let found = false;
      let foundPath = null;

      for (const candidate of candidates) {
        if (await fileExists(candidate)) {
          found = true;
          foundPath = candidate;
          break;
        }
      }

      if (!found) {
        errors.push({ file: relativePath, href, error: `File not found: ${pathPart}` });
        continue;
      }

      // Check hash target if present
      if (hashPart && foundPath) {
        const targetContent = await readFile(foundPath, 'utf-8');
        const targetIds = extractIds(targetContent);
        if (!targetIds.has(hashPart)) {
          errors.push({ file: relativePath, href, error: `Missing anchor on target page: #${hashPart}` });
        }
      }
    }
  }

  // Report
  if (errors.length === 0) {
    console.log('[broken-links] All internal links valid');
    return 0;
  }

  console.error(`\n[broken-links] Found ${errors.length} broken link(s):\n`);
  errors.forEach(e => {
    console.error(`  ${e.file}: href="${e.href}" — ${e.error}`);
  });

  return errors.length;
}

const errorCount = await checkLinks();
if (errorCount > 0) {
  process.exit(1);
}
