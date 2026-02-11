/**
 * striking-refresh.mjs
 *
 * Adds a bounded answer-expansion block to a page targeting
 * striking-distance queries. Uses stable markers to allow updates.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REFRESH_BLOCKS_PATH = join(__dirname, '..', 'config', 'refresh-blocks.json');
const PILLARS_PATH = join(__dirname, '..', 'config', 'pillars.json');

function loadJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Resolve a page route to its file path.
 */
function resolveFilePath(routePath) {
  const slug = routePath.replace(/^\/|\/$/g, '');
  return join(ROOT, slug, 'index.html');
}

/**
 * Find the pillar path for a given page route.
 */
function findPillarPath(routePath) {
  const pillars = loadJson(PILLARS_PATH, { pillars: [] });
  for (const pillar of (pillars.pillars || [])) {
    if (pillar.path === routePath) return pillar.path;
    for (const child of (pillar.children || [])) {
      if (child === routePath) return pillar.path;
    }
  }
  // Default pillar links based on page type
  if (routePath.startsWith('/blog/')) return '/blog/';
  if (routePath.startsWith('/areas/')) return '/areas/';
  return '/';
}

/**
 * Count words in a text string.
 */
function countWords(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Generate a section block for a query.
 * Deterministic: same query always produces same structure.
 *
 * @param {object} query - { query, impressions28, pos28 }
 * @param {string} pageType - blog/money/area
 * @returns {string} HTML block
 */
function generateQuerySection(query, pageType) {
  // Capitalize first letter of query for H2
  const heading = query.query.charAt(0).toUpperCase() + query.query.slice(1);

  const lines = [];
  lines.push(`      <section class="seo-strike-section">`);
  lines.push(`        <h2>${heading}</h2>`);
  lines.push(`        <p>Understanding this topic can help homeowners and buyers in the Columbus, Ohio area make informed decisions.</p>`);
  lines.push(`        <p>Every situation is different, so consider your specific circumstances and consult with a local real estate professional for personalized guidance.</p>`);
  lines.push(`      </section>`);

  return lines.join('\n');
}

/**
 * Generate a mini FAQ for blog/area page types.
 *
 * @param {object[]} queries - Selected queries
 * @returns {string} HTML FAQ block
 */
function generateMiniFaq(queries) {
  if (queries.length === 0) return '';

  const lines = [];
  lines.push(`      <section class="seo-strike-faq">`);
  lines.push(`        <h2>Common Questions</h2>`);

  for (const q of queries.slice(0, 3)) {
    const questionText = q.query.endsWith('?')
      ? q.query.charAt(0).toUpperCase() + q.query.slice(1)
      : `What should I know about ${q.query}?`;

    lines.push(`        <details>`);
    lines.push(`          <summary>${questionText}</summary>`);
    lines.push(`          <p>This depends on several factors specific to your situation. Speaking with a qualified professional can help clarify your options.</p>`);
    lines.push(`        </details>`);
  }

  lines.push(`      </section>`);
  return lines.join('\n');
}

/**
 * Execute a striking-distance refresh on a page.
 *
 * @param {object} options
 * @param {string}   options.targetPagePath - Route path of target page
 * @param {object[]} options.queries - Selected queries
 * @param {string}   options.pageType - blog/money/area
 * @returns {{ success: boolean, reason: string, filePath: string, originalContent: string, wordsAdded: number, queriesTargeted: string[] }}
 */
export function executeStrikingRefresh({
  targetPagePath,
  queries = [],
  pageType = 'blog',
} = {}) {
  const refreshBlocks = loadJson(REFRESH_BLOCKS_PATH, {});
  const blockConfig = refreshBlocks[pageType];

  if (!blockConfig) {
    return { success: false, reason: 'no_block_config', filePath: '', originalContent: '', wordsAdded: 0, queriesTargeted: [] };
  }

  const { markerStart, markerEnd, maxWordsAdd } = blockConfig;
  const filePath = resolveFilePath(targetPagePath);

  let html;
  try {
    html = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return { success: false, reason: `file_read_error: ${err.message}`, filePath, originalContent: '', wordsAdded: 0, queriesTargeted: [] };
  }

  const originalContent = html;

  // Build the content block
  const sections = [];
  for (const q of queries) {
    sections.push(generateQuerySection(q, pageType));
  }

  // Add mini FAQ for blog/area
  if (pageType === 'blog' || pageType === 'area') {
    const faq = generateMiniFaq(queries);
    if (faq) sections.push(faq);
  }

  // Add one internal link to pillar
  const pillarPath = findPillarPath(targetPagePath);
  if (pillarPath && pillarPath !== targetPagePath) {
    sections.push(`      <nav class="seo-strike-links" aria-label="Related">`);
    sections.push(`        <p>Learn more: <a href="${pillarPath}">explore related topics</a></p>`);
    sections.push(`      </nav>`);
  }

  const blockContent = sections.join('\n');

  // Check word budget
  const blockWords = countWords(blockContent);
  if (blockWords > maxWordsAdd * 1.5) {
    // Trim to budget by removing FAQ
    const trimmedSections = sections.filter(s => !s.includes('seo-strike-faq'));
    const trimmedContent = trimmedSections.join('\n');
    if (countWords(trimmedContent) > maxWordsAdd * 1.5) {
      return { success: false, reason: 'exceeds_word_budget', filePath, originalContent: '', wordsAdded: 0, queriesTargeted: [] };
    }
  }

  const wrappedBlock = `${markerStart}\n${blockContent}\n    ${markerEnd}`;

  // Insert or replace
  const hasExisting = html.includes(markerStart) && html.includes(markerEnd);
  if (hasExisting) {
    const blockRegex = new RegExp(
      markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '[\\s\\S]*?' +
      markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    html = html.replace(blockRegex, wrappedBlock);
  } else {
    // Insert before </main>
    const mainCloseIdx = html.lastIndexOf('</main>');
    if (mainCloseIdx === -1) {
      return { success: false, reason: 'no_main_close_tag', filePath, originalContent: '', wordsAdded: 0, queriesTargeted: [] };
    }
    html = html.slice(0, mainCloseIdx) + '    ' + wrappedBlock + '\n  ' + html.slice(mainCloseIdx);
  }

  // Write
  writeFileSync(filePath, html);

  return {
    success: true,
    reason: hasExisting ? 'block_updated' : 'block_inserted',
    filePath,
    originalContent,
    wordsAdded: countWords(blockContent),
    queriesTargeted: queries.map(q => q.query),
  };
}

/**
 * Revert a striking refresh.
 */
export function revertStrikingRefresh(filePath, originalContent) {
  if (filePath && originalContent) {
    writeFileSync(filePath, originalContent);
  }
}
