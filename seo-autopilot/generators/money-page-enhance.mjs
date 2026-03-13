/**
 * money-page-enhance.mjs
 *
 * Inserts or updates a marker-based enhancement block on money pages.
 * Adds H2 sections, FAQ, and FAQPage JSON-LD schema.
 * Uses stable markers so content can be updated without duplicating.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BLOCKS_PATH = join(__dirname, '..', 'config', 'money-page-blocks.json');

const START_MARKER = '<!-- SEO_AUTOPILOT_MONEY_START -->';
const END_MARKER = '<!-- SEO_AUTOPILOT_MONEY_END -->';
const SCHEMA_START = '<!-- SEO_AUTOPILOT_MONEY_SCHEMA_START -->';
const SCHEMA_END = '<!-- SEO_AUTOPILOT_MONEY_SCHEMA_END -->';

function loadBlocks() {
  try { return JSON.parse(readFileSync(BLOCKS_PATH, 'utf-8')); }
  catch { return {}; }
}

/**
 * Resolve a money route to its source file path.
 * @param {string} routePath - e.g. "/sellers/"
 * @returns {string} - Absolute file path
 */
function resolveFilePath(routePath) {
  // Strip leading/trailing slashes, map to dir/index.html
  const slug = routePath.replace(/^\/|\/$/g, '');
  return join(ROOT, slug, 'index.html');
}

/**
 * Generate FAQ answer text from a hint.
 * Deterministic — same hint always produces same answer structure.
 *
 * @param {string} question
 * @param {string} aHint
 * @param {string} routePath
 * @returns {string}
 */
function generateAnswer(question, aHint, routePath) {
  // Use the hint as a guiding sentence for a brief, factual answer.
  // Keep it concise and claim-free.
  return aHint;
}

/**
 * Build the HTML content block for a money page enhancement.
 *
 * @param {object} blockConfig - From money-page-blocks.json
 * @param {object} intents - From money-page-intents analyzer
 * @param {string} routePath
 * @returns {{ html: string, sectionsAdded: number, faqAdded: number }}
 */
function buildContentBlock(blockConfig, intents, routePath) {
  const parts = [];
  let sectionsAdded = 0;
  let faqAdded = 0;

  parts.push(buildServiceTrustAndProofBlock());

  // H2 sections
  for (const h2 of (blockConfig.requiredH2 || [])) {
    // Find a relevant intent query to lightly incorporate
    let intentPhrase = '';
    if (intents && intents.buckets) {
      for (const bucket of intents.buckets) {
        if (bucket.topQueries && bucket.topQueries.length > 0 && !intentPhrase) {
          intentPhrase = bucket.topQueries[0].query;
        }
      }
    }

    parts.push(`    <section class="seo-enhance-section">`);
    parts.push(`      <h2>${h2}</h2>`);
    parts.push(`      <p>Learn more about how this works for homeowners in the Columbus, Ohio area.</p>`);
    parts.push(`    </section>`);
    sectionsAdded++;
  }

  // FAQ section
  const faqs = blockConfig.faq || [];
  if (faqs.length > 0) {
    parts.push(`    <section class="seo-enhance-faq">`);
    parts.push(`      <h2>Frequently Asked Questions</h2>`);
    for (const faq of faqs) {
      parts.push(`      <details>`);
      parts.push(`        <summary>${faq.q}</summary>`);
      parts.push(`        <p>${generateAnswer(faq.q, faq.aHint, routePath)}</p>`);
      parts.push(`      </details>`);
      faqAdded++;
    }
    parts.push(`    </section>`);
  }

  // Internal links (capped at 3)
  const links = [];
  if (routePath !== '/contact/') links.push({ href: '/contact/', text: 'Get in touch' });
  if (routePath !== '/sellers/' && routePath !== '/buyers/') {
    links.push({ href: '/sellers/', text: 'Learn about selling' });
  }
  if (routePath !== '/sellers/' && links.length < 3) {
    links.push({ href: '/sellers/', text: 'See our commission structure' });
  }

  if (links.length > 0) {
    parts.push(`    <nav class="seo-enhance-links" aria-label="Related pages">`);
    parts.push(`      <p>Explore related topics:</p>`);
    parts.push(`      <ul>`);
    for (const link of links.slice(0, 3)) {
      parts.push(`        <li><a href="${link.href}">${link.text}</a></li>`);
    }
    parts.push(`      </ul>`);
    parts.push(`    </nav>`);
  }

  const html = parts.join('\n');
  return { html, sectionsAdded, faqAdded };
}


function buildServiceTrustAndProofBlock() {
  return [
    '    <section class="service-template-meta" style="margin:1.25rem 0;padding:1rem 1.1rem;background:#f7f9fc;border:1px solid #d9e2ee;border-radius:8px;">',
    '      <p><strong>Author:</strong> <a href="/about/">Travis Debnam, Broker</a></p>',
    '      <p><strong>Last reviewed:</strong> ' + new Date().toISOString().slice(0, 10) + '</p>',
    '      <p><strong>Methodology/Data note:</strong> Guidance reflects TD Realty Ohio workflows plus local transaction patterns; validate current prices and timing with active comps and MLS data.</p>',
    '      <p><strong>Brokerage trust:</strong> TD Realty Ohio, LLC | Broker License #2023006467 | Brokerage License #2023006602</p>',
    '      <p><strong>Local proof:</strong> Service support across Franklin, Delaware, Licking, and Fairfield counties with process details tailored to property condition, neighborhood, and market demand. No guaranteed outcomes are implied.</p>',
    '    </section>'
  ].join('\n');
}

/**
 * Build FAQPage JSON-LD schema from FAQ entries.
 *
 * @param {object[]} faqs - Array of { q, aHint }
 * @returns {string} - JSON-LD script tag
 */
function buildFaqSchema(faqs) {
  if (!faqs || faqs.length === 0) return '';

  const schemaObj = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.aHint,
      },
    })),
  };

  return `<script type="application/ld+json">${JSON.stringify(schemaObj)}</script>`;
}

/**
 * Check if an enhancement block already exists and whether it needs updating.
 *
 * @param {string} html - Page HTML content
 * @param {object} blockConfig - Block configuration
 * @returns {{ exists: boolean, needsUpdate: boolean, reason: string }}
 */
function checkExistingBlock(html, blockConfig) {
  const hasBlock = html.includes(START_MARKER) && html.includes(END_MARKER);
  if (!hasBlock) {
    return { exists: false, needsUpdate: true, reason: 'no_block' };
  }

  // Block exists — check if required H2s, FAQs are present
  const blockMatch = html.match(new RegExp(`${START_MARKER}([\\s\\S]*?)${END_MARKER}`));
  if (!blockMatch) {
    return { exists: true, needsUpdate: true, reason: 'malformed_block' };
  }

  const blockContent = blockMatch[1];

  // Check required H2s
  for (const h2 of (blockConfig.requiredH2 || [])) {
    if (!blockContent.includes(h2)) {
      return { exists: true, needsUpdate: true, reason: `missing_h2: ${h2}` };
    }
  }

  // Check FAQs
  for (const faq of (blockConfig.faq || [])) {
    if (!blockContent.includes(faq.q)) {
      return { exists: true, needsUpdate: true, reason: `missing_faq: ${faq.q}` };
    }
  }

  return { exists: true, needsUpdate: false, reason: 'complete' };
}

/**
 * Enhance a money page with structured content block + FAQ schema.
 *
 * @param {object} options
 * @param {string} options.routePath - Money page route
 * @param {object} options.intents - Intent buckets from analyzer
 * @returns {{ success: boolean, reason: string, filePath: string, originalContent: string, sectionsAdded: number, faqAdded: number, schemaAdded: boolean }}
 */
export function enhanceMoneyPage({ routePath, intents = {} } = {}) {
  const blocks = loadBlocks();
  const blockConfig = blocks[routePath];

  if (!blockConfig) {
    return { success: false, reason: 'no_block_config', filePath: '', originalContent: '', sectionsAdded: 0, faqAdded: 0, schemaAdded: false };
  }

  // Skip pages with empty config (contact, about)
  if ((blockConfig.requiredH2 || []).length === 0 && (blockConfig.faq || []).length === 0) {
    return { success: false, reason: 'empty_block_config', filePath: '', originalContent: '', sectionsAdded: 0, faqAdded: 0, schemaAdded: false };
  }

  const filePath = resolveFilePath(routePath);
  let html;
  try {
    html = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return { success: false, reason: `file_read_error: ${err.message}`, filePath, originalContent: '', sectionsAdded: 0, faqAdded: 0, schemaAdded: false };
  }

  const originalContent = html;

  // Check if block already exists and is complete
  const check = checkExistingBlock(html, blockConfig);
  if (check.exists && !check.needsUpdate) {
    return { success: false, reason: 'block_already_complete', filePath, originalContent: '', sectionsAdded: 0, faqAdded: 0, schemaAdded: false };
  }

  // Build the content block
  const pageIntents = intents[routePath] || {};
  const { html: blockHtml, sectionsAdded, faqAdded } = buildContentBlock(blockConfig, pageIntents, routePath);

  const wrappedBlock = `${START_MARKER}\n${blockHtml}\n  ${END_MARKER}`;

  // Insert or replace the content block
  if (check.exists) {
    // Replace existing block
    const blockRegex = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);
    html = html.replace(blockRegex, wrappedBlock);
  } else {
    // Insert before </main>
    const mainCloseIdx = html.lastIndexOf('</main>');
    if (mainCloseIdx === -1) {
      return { success: false, reason: 'no_main_close_tag', filePath, originalContent: '', sectionsAdded: 0, faqAdded: 0, schemaAdded: false };
    }
    html = html.slice(0, mainCloseIdx) + '  ' + wrappedBlock + '\n  ' + html.slice(mainCloseIdx);
  }

  // Handle FAQPage schema
  let schemaAdded = false;
  if (blockConfig.schema?.enabled && (blockConfig.faq || []).length > 0) {
    const schemaTag = buildFaqSchema(blockConfig.faq);

    // Remove existing schema block if present
    if (html.includes(SCHEMA_START)) {
      const schemaRegex = new RegExp(`${SCHEMA_START}[\\s\\S]*?${SCHEMA_END}`);
      html = html.replace(schemaRegex, `${SCHEMA_START}\n${schemaTag}\n${SCHEMA_END}`);
    } else {
      // Insert before </body>
      const bodyCloseIdx = html.lastIndexOf('</body>');
      if (bodyCloseIdx !== -1) {
        html = html.slice(0, bodyCloseIdx) + `${SCHEMA_START}\n${schemaTag}\n${SCHEMA_END}\n` + html.slice(bodyCloseIdx);
        schemaAdded = true;
      }
    }
  }

  // Write the updated file
  writeFileSync(filePath, html);

  return {
    success: true,
    reason: check.exists ? 'block_updated' : 'block_inserted',
    filePath,
    originalContent,
    sectionsAdded,
    faqAdded,
    schemaAdded,
  };
}

/**
 * Revert an enhancement by restoring original content.
 *
 * @param {string} filePath
 * @param {string} originalContent
 */
export function revertMoneyEnhancement(filePath, originalContent) {
  if (filePath && originalContent) {
    writeFileSync(filePath, originalContent);
  }
}
