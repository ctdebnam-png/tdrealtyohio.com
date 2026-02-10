#!/usr/bin/env node
/**
 * Validates sitemap.xml lastmod diversity.
 * Fails when sitemap lastmod dates are all identical but source files have varied dates.
 */

import { readFile, readdir, stat } from 'fs/promises';
import { execFile } from 'child_process';
import { dirname, join, relative } from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITEMAP_PATH = join(ROOT, 'sitemap.xml');
const execFileAsync = promisify(execFile);

const SKIP_DIRS = new Set([
  'node_modules',
  'scripts',
  'audit-output',
  'audit-artifacts',
  'output',
  'reports',
  'assets',
  'media',
  'site-quality-gate',
  'site-audit'
]);

async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) {
        continue;
      }
      await findHtmlFiles(fullPath, files);
      continue;
    }

    if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function getFileDate(filePath) {
  const relativePath = relative(ROOT, filePath).replace(/\\/g, '/');

  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cs', '--', relativePath], {
      cwd: ROOT,
    });
    const gitDate = stdout.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(gitDate)) {
      return gitDate;
    }
  } catch {
    // fallback below
  }

  try {
    const fileStats = await stat(filePath);
    if (!Number.isNaN(fileStats.mtimeMs)) {
      return fileStats.mtime.toISOString().split('T')[0];
    }
  } catch {
    // ignored
  }

  return null;
}

async function validateSitemapLastmodDiversity() {
  const sitemap = await readFile(SITEMAP_PATH, 'utf-8');
  const lastmodMatches = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(match => match[1]);

  if (lastmodMatches.length === 0) {
    throw new Error('sitemap.xml contains no <lastmod> values to validate');
  }

  const sitemapUniqueDates = new Set(lastmodMatches);
  if (sitemapUniqueDates.size > 1) {
    console.log(`✅ sitemap.xml has ${sitemapUniqueDates.size} unique lastmod dates`);
    return;
  }

  const htmlFiles = await findHtmlFiles(ROOT);
  const sourceDates = new Set();

  for (const filePath of htmlFiles) {
    const date = await getFileDate(filePath);
    if (date) {
      sourceDates.add(date);
    }
  }

  if (sourceDates.size <= 1) {
    console.log('✅ sitemap.xml has one lastmod date, and source files also indicate a full-site single-date update');
    return;
  }

  const [uniformDate] = [...sitemapUniqueDates];
  throw new Error(
    `sitemap.xml lastmod dates are all ${uniformDate}, but source files span ${sourceDates.size} dates; this likely indicates a lastmod regression`
  );
}

validateSitemapLastmodDiversity().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});
