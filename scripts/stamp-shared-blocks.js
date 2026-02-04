#!/usr/bin/env node
/**
 * stamp-shared-blocks.js
 *
 * Reads shared HTML templates from /templates/blocks/ and stamps them into
 * target pages between marker comments.
 *
 * Markers: <!-- SHARED:block-name:START --> ... <!-- SHARED:block-name:END -->
 *
 * Usage: node scripts/stamp-shared-blocks.js [--dry-run]
 *
 * Shared blocks:
 *   - pricing-summary: "How pricing works" block for seller entry pages
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BLOCKS_DIR = path.join(ROOT, 'templates', 'blocks');
const DRY_RUN = process.argv.includes('--dry-run');

// Target pages for each block
const BLOCK_TARGETS = {
  'pricing-summary': [
    'sellers/index.html',
    '1-percent-commission/index.html',
  ],
};

function readBlock(blockName) {
  const blockPath = path.join(BLOCKS_DIR, blockName + '.html');
  if (!fs.existsSync(blockPath)) {
    console.error(`Block template not found: ${blockPath}`);
    return null;
  }
  return fs.readFileSync(blockPath, 'utf8').trim();
}

function stampBlock(filePath, blockName, blockContent) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  Target not found: ${filePath}`);
    return false;
  }

  const html = fs.readFileSync(fullPath, 'utf8');
  const startMarker = `<!-- SHARED:${blockName}:START -->`;
  const endMarker = `<!-- SHARED:${blockName}:END -->`;

  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.warn(`  Markers not found in ${filePath} — skipping`);
    console.warn(`  Add ${startMarker} and ${endMarker} to mark where the block goes`);
    return false;
  }

  const before = html.substring(0, startIdx + startMarker.length);
  const after = html.substring(endIdx);
  const newHtml = before + '\n' + blockContent + '\n    ' + after;

  if (newHtml === html) {
    console.log(`  ${filePath} — already up to date`);
    return false;
  }

  if (DRY_RUN) {
    console.log(`  ${filePath} — would update (dry run)`);
  } else {
    fs.writeFileSync(fullPath, newHtml, 'utf8');
    console.log(`  ${filePath} — updated`);
  }
  return true;
}

// Main
let updated = 0;
for (const [blockName, targets] of Object.entries(BLOCK_TARGETS)) {
  console.log(`\nBlock: ${blockName}`);
  const content = readBlock(blockName);
  if (!content) continue;

  for (const target of targets) {
    if (stampBlock(target, blockName, content)) updated++;
  }
}

console.log(`\n${DRY_RUN ? 'Dry run:' : 'Done:'} ${updated} file(s) ${DRY_RUN ? 'would be' : ''} updated`);
