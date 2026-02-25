/**
 * area-expand.mjs
 *
 * Expands an existing area page by inserting or updating a bounded
 * content block using marker comments. Does not rewrite the whole page.
 *
 * Markers:
 *   <!-- SEO_AUTOPILOT_AREA_START -->
 *   ... content ...
 *   <!-- SEO_AUTOPILOT_AREA_END -->
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TEMPLATE_PATH = join(__dirname, '..', 'config', 'area-template.json');

const MARKER_START = '<!-- SEO_AUTOPILOT_AREA_START -->';
const MARKER_END = '<!-- SEO_AUTOPILOT_AREA_END -->';

function loadTemplate() {
  try {
    return JSON.parse(readFileSync(TEMPLATE_PATH, 'utf-8'));
  } catch {
    return {
      requiredBlocks: ['Snapshot', 'Housing patterns', 'Commute and access', 'What affects price', 'Buying and selling considerations', 'FAQ'],
      internalLinks: { alwaysInclude: ['/areas/', '/contact/'], conditional: [{ when: 'sellerIntent', include: ['/sellers/', '/1-percent-commission/'] }] },
    };
  }
}

/**
 * Extract the area/city name from the route path.
 */
function extractAreaName(routePath) {
  // Handle zip code routes: /areas/zip/43004/ -> "ZIP 43004"
  const zipMatch = routePath.match(/\/areas\/zip\/(\d+)\//);
  if (zipMatch) return `ZIP ${zipMatch[1]}`;

  // Handle city routes: /areas/westerville/ -> "Westerville"
  const parts = routePath.replace(/^\/areas\//, '').replace(/\/$/, '').split('/');
  const slug = parts[parts.length - 1] || '';
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Expand an area page with bounded content.
 *
 * @param {object} options
 * @param {string} options.routePath - The area route (e.g., /areas/westerville/)
 * @param {number} options.maxWordsAdd - Max words to add this run
 * @param {string} options.intent - "sellerIntent" or "buyerIntent" (default: sellerIntent)
 * @returns {{ success: boolean, filePath: string, wordsBefore: number, wordsAfter: number, linksAdded: string[], reason: string, originalContent: string|null }}
 */
export function expandAreaPage({ routePath, maxWordsAdd = 600, intent = 'sellerIntent' }) {
  const template = loadTemplate();
  const areaName = extractAreaName(routePath);

  if (!areaName) {
    return { success: false, filePath: '', wordsBefore: 0, wordsAfter: 0, linksAdded: [], reason: 'cannot_extract_area_name', originalContent: null };
  }

  // Resolve file path
  const filePath = join(ROOT, routePath.replace(/\/$/, ''), 'index.html');

  let html;
  try {
    html = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return { success: false, filePath, wordsBefore: 0, wordsAfter: 0, linksAdded: [], reason: `cannot_read: ${err.message}`, originalContent: null };
  }

  const originalContent = html;
  const wordsBefore = countWords(html);

  // Build internal links list
  const links = [...(template.internalLinks?.alwaysInclude || ['/areas/', '/contact/'])];
  const conditionalLinks = template.internalLinks?.conditional || [];
  for (const cond of conditionalLinks) {
    if (cond.when === intent) {
      for (const link of cond.include || []) {
        if (!links.includes(link)) links.push(link);
      }
    }
  }
  // Cap at 3 pillar links
  const pillarLinks = links.slice(0, 3);

  // Generate content block
  const blocks = template.requiredBlocks || [];
  const blockContent = generateAreaBlocks(areaName, blocks, pillarLinks, maxWordsAdd);

  // Check if markers already exist
  if (html.includes(MARKER_START)) {
    const startIdx = html.indexOf(MARKER_START);
    const endIdx = html.indexOf(MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      const before = html.slice(0, startIdx);
      const after = html.slice(endIdx + MARKER_END.length);
      html = before + MARKER_START + '\n' + blockContent + '\n    ' + MARKER_END + after;
      writeFileSync(filePath, html, 'utf-8');
      const wordsAfter = countWords(html);
      return { success: true, filePath, wordsBefore, wordsAfter, linksAdded: pillarLinks, reason: 'replaced_existing_block', originalContent };
    }
  }

  // Find insertion point: before the CTA section or before </main> or before footer
  const insertionPatterns = [
    '    <section class="section cta-section">',
    '  <section class="section cta-section">',
    '  </main>',
    '</main>',
    '  <footer',
    '<footer',
  ];

  let inserted = false;
  for (const pattern of insertionPatterns) {
    const idx = html.indexOf(pattern);
    if (idx !== -1) {
      const block = `\n    ${MARKER_START}\n${blockContent}\n    ${MARKER_END}\n\n`;
      html = html.slice(0, idx) + block + html.slice(idx);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    return { success: false, filePath, wordsBefore, wordsAfter: wordsBefore, linksAdded: [], reason: 'no_insertion_point', originalContent };
  }

  writeFileSync(filePath, html, 'utf-8');
  const wordsAfter = countWords(html);

  return { success: true, filePath, wordsBefore, wordsAfter, linksAdded: pillarLinks, reason: 'added_expansion_block', originalContent };
}

/**
 * Revert an area page expansion (restore original content).
 */
export function revertAreaExpansion(filePath, originalContent) {
  if (originalContent) {
    writeFileSync(filePath, originalContent, 'utf-8');
    return true;
  }
  return false;
}

/**
 * Generate content blocks for the area page.
 */
function generateAreaBlocks(areaName, blocks, pillarLinks, maxWordsAdd) {
  const sections = [];
  let totalWords = 0;

  const pathLabels = {
    '/areas/': 'Service Areas',
    '/contact/': 'Contact Us',
    '/sellers/': 'Seller Services',
    '/buyers/': 'Buyer Programs',
    '/1-percent-commission/': '1% Commission Listing',
  };

  sections.push(`    <section class="section" style="padding-top: 2rem;">`);
  sections.push(`      <div class="container" style="max-width: 800px;">`);

  for (const block of blocks) {
    if (totalWords >= maxWordsAdd) break;

    const content = generateBlock(block, areaName, maxWordsAdd - totalWords);
    if (content) {
      sections.push(content);
      totalWords += countBlockWords(content);
    }
  }

  // Internal links section
  if (pillarLinks.length > 0) {
    sections.push(`        <div style="margin-top: 2rem;">`);
    sections.push(`          <h3>Explore More</h3>`);
    sections.push(`          <ul>`);
    for (const link of pillarLinks) {
      const label = pathLabels[link] || link.replace(/^\/|\/$/g, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      sections.push(`            <li><a href="${link}">${label}</a></li>`);
    }
    sections.push(`          </ul>`);
    sections.push(`        </div>`);
  }

  sections.push(`      </div>`);
  sections.push(`    </section>`);

  return sections.join('\n');
}

/**
 * Generate content for a specific block type.
 * Content is informational and generic — no stats, rankings, or claims requiring citations.
 */
function generateBlock(blockName, areaName, remainingWords) {
  if (remainingWords <= 0) return null;

  const lower = blockName.toLowerCase();

  if (lower === 'snapshot') {
    return [
      `        <h2>${areaName} at a Glance</h2>`,
      `        <p>${areaName} is one of many communities in the Columbus metro area where homebuyers and sellers are active throughout the year. The neighborhood character, school district access, and proximity to employment centers all play a role in how the local real estate market functions.</p>`,
      `        <p>Whether you are considering a move to the area or preparing to sell a property here, understanding the general landscape helps you make more informed decisions. Each street and subdivision has its own considerations, and working with an agent who knows the area can help you navigate them.</p>`,
    ].join('\n');
  }

  if (lower === 'housing patterns') {
    return [
      `        <h2>Housing Patterns</h2>`,
      `        <p>The housing stock in this part of Central Ohio includes a mix of single-family homes, townhomes, and condominiums. Lot sizes, construction eras, and neighborhood layouts vary from one section to another, which means buyers have a range of options depending on their priorities.</p>`,
      `        <p>Sellers in the area benefit from understanding how their property compares to others nearby. Features like updated kitchens, finished basements, and outdoor living spaces tend to be valued by buyers searching in this market. A seller evaluation can help identify which improvements offer the best return.</p>`,
    ].join('\n');
  }

  if (lower === 'commute and access') {
    return [
      `        <h2>Commute and Access</h2>`,
      `        <p>Access to major routes and employment centers is an important factor for many homebuyers in Central Ohio. The Columbus metro area offers several highway corridors and surface streets that connect residential communities to downtown, suburban office parks, and retail centers.</p>`,
      `        <p>Proximity to grocery stores, medical offices, parks, and other daily amenities also influences how buyers evaluate different neighborhoods. When comparing properties, it is worth considering both the commute to work and the convenience of everyday errands.</p>`,
    ].join('\n');
  }

  if (lower === 'what affects price') {
    return [
      `        <h2>What Affects Home Prices</h2>`,
      `        <p>Home prices in any Central Ohio community are influenced by a combination of factors including lot size, condition, school district, and overall demand. Properties that are well-maintained and competitively priced tend to generate more buyer interest and sell within a reasonable timeframe.</p>`,
      `        <p>Market conditions shift over time, so the pricing strategy that works today may differ from what worked a year ago. Working with an agent who tracks local trends and understands buyer behavior in this specific area helps ensure your pricing is accurate from the start.</p>`,
    ].join('\n');
  }

  if (lower === 'buying and selling considerations') {
    return [
      `        <h2>Buying and Selling Considerations</h2>`,
      `        <p>If you are buying in this area, take time to explore different neighborhoods, visit at different times of day, and learn about the community resources available. Each section of the metro area has its own feel, and finding the right fit takes more than just online research.</p>`,
      `        <p>If you are selling, presentation matters. Homes that are clean, decluttered, and well-photographed tend to attract more showings and stronger offers. TD Realty Ohio provides full-service listing support at reduced commission rates, helping you keep more of your equity at closing.</p>`,
    ].join('\n');
  }

  if (lower === 'faq') {
    return [
      `        <h2>Frequently Asked Questions</h2>`,
      `        <div class="faq-list" style="margin-top: 1.5rem;">`,
      `          <div class="faq-item">`,
      `            <button class="faq-question" aria-expanded="false">`,
      `              What should I consider before buying a home in this area?`,
      `              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
      `            </button>`,
      `            <div class="faq-answer">`,
      `              <p>Consider your commute, school district preferences, neighborhood character, and budget. Visit the area at different times to get a sense of traffic patterns and daily life. An experienced local agent can help you evaluate how different properties align with your priorities.</p>`,
      `            </div>`,
      `          </div>`,
      `          <div class="faq-item">`,
      `            <button class="faq-question" aria-expanded="false">`,
      `              How can I save on commission when selling my home?`,
      `              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
      `            </button>`,
      `            <div class="faq-answer">`,
      `              <p>TD Realty Ohio offers full-service listing representation at 1-2% commission instead of the traditional 3%. This means you keep more of your home's equity without sacrificing the marketing, negotiation, or transaction management you need for a successful sale.</p>`,
      `            </div>`,
      `          </div>`,
      `          <div class="faq-item">`,
      `            <button class="faq-question" aria-expanded="false">`,
      `              How long does it typically take to sell a home in Central Ohio?`,
      `              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
      `            </button>`,
      `            <div class="faq-answer">`,
      `              <p>Timelines vary based on price point, condition, location, and market conditions. Well-priced homes in desirable areas tend to move more quickly. Your agent can provide a realistic timeline based on current activity in your specific neighborhood.</p>`,
      `            </div>`,
      `          </div>`,
      `        </div>`,
    ].join('\n');
  }

  // Generic block fallback
  return [
    `        <h2>${escHtml(blockName)}</h2>`,
    `        <p>This is an important consideration for homebuyers and sellers in the Columbus metro area. Local conditions and preferences can vary from one community to the next, so understanding the specifics of your target area helps you make better decisions.</p>`,
  ].join('\n');
}

function countWords(html) {
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

function countBlockWords(content) {
  return content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
