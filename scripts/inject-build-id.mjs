#!/usr/bin/env node
/**
 * Build ID Injector for TD Realty Ohio
 * Injects git commit SHA into all HTML files for production verification
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/**
 * Get current git commit SHA (short)
 */
function getGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Get current timestamp
 */
function getBuildTime() {
  return new Date().toISOString();
}

/**
 * Recursively find all HTML files
 */
async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip non-content directories
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'scripts' ||
          entry.name === 'tools' ||
          entry.name === 'audit-output' ||
          entry.name === 'audit-artifacts') {
        continue;
      }
      await findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Inject build ID into HTML file
 */
async function injectBuildId(filePath, buildId, buildTime) {
  let content = await readFile(filePath, 'utf-8');

  const buildComment = `<!-- Build: ${buildId} | ${buildTime} -->`;

  // Remove any existing build comment
  content = content.replace(/<!-- Build: [a-f0-9]+ \| [^\n]+ -->\n?/g, '');

  // Inject build comment after opening <head> tag
  if (content.includes('<head>')) {
    content = content.replace('<head>', `<head>\n  ${buildComment}`);
  }

  // Also add to footer if it exists (visible identifier)
  const footerBuildId = `<div class="footer-build" style="text-align: center; font-size: 0.6875rem; color: var(--gray-500); margin-top: 1rem;">Build: ${buildId}</div>`;

  // Remove any existing footer build div
  content = content.replace(/<div class="footer-build"[^>]*>Build: [a-f0-9]+<\/div>\n?/g, '');

  // Add footer build ID before closing </footer> tag
  if (content.includes('</footer>')) {
    content = content.replace('</footer>', `  ${footerBuildId}\n  </footer>`);
  }

  await writeFile(filePath, content);
  return true;
}

/**
 * Main function
 */
async function main() {
  const buildId = getGitSha();
  const buildTime = getBuildTime();

  console.log(`=== TD Realty Ohio Build ID Injector ===`);
  console.log(`Build ID: ${buildId}`);
  console.log(`Build Time: ${buildTime}`);
  console.log('');

  const htmlFiles = await findHtmlFiles(ROOT);
  console.log(`Found ${htmlFiles.length} HTML files`);

  let injected = 0;
  for (const filePath of htmlFiles) {
    try {
      await injectBuildId(filePath, buildId, buildTime);
      const relativePath = filePath.replace(ROOT, '');
      console.log(`  ✓ ${relativePath}`);
      injected++;
    } catch (e) {
      console.error(`  ✗ ${filePath}: ${e.message}`);
    }
  }

  console.log('');
  console.log(`Injected build ID into ${injected} files`);
  console.log(`Build identifier: ${buildId}`);
}

main().catch(console.error);
