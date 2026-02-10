/**
 * refresh.mjs
 *
 * Refreshes existing content:
 * - Mode 1: Blog post — adds a FAQ section and/or new section answering the target query
 * - Mode 2: Money page — adds a bounded FAQ or process section
 *
 * Uses marker comments for idempotent insertions:
 *   <!-- SEO_AUTOPILOT_REFRESH_START --> ... <!-- SEO_AUTOPILOT_REFRESH_END -->
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const MARKER_START = '<!-- SEO_AUTOPILOT_REFRESH_START -->';
const MARKER_END = '<!-- SEO_AUTOPILOT_REFRESH_END -->';

/**
 * Refresh an existing blog post.
 *
 * @param {object} options
 * @param {string} options.filePath - Absolute path to the blog post HTML
 * @param {string} options.query - The target query to answer
 * @param {string[]} options.internalLinksTo - Paths to link to
 * @param {string[]} options.rankIntentRoutes - For validating link targets
 * @returns {{ success: boolean, filesEdited: string[], wordsAdded: number, reason: string }}
 */
export function refreshBlogPost({ filePath, query, internalLinksTo = [], rankIntentRoutes = [] }) {
  let html;
  try {
    html = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return { success: false, filesEdited: [], wordsAdded: 0, reason: `cannot read: ${err.message}` };
  }

  // Check if already refreshed
  if (html.includes(MARKER_START)) {
    // Replace existing content between markers
    const startIdx = html.indexOf(MARKER_START);
    const endIdx = html.indexOf(MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      const newContent = generateBlogRefreshContent(query, internalLinksTo, rankIntentRoutes);
      const before = html.slice(0, startIdx);
      const after = html.slice(endIdx + MARKER_END.length);
      html = before + MARKER_START + '\n' + newContent + '\n    ' + MARKER_END + after;
      writeFileSync(filePath, html, 'utf-8');
      const wordCount = newContent.split(/\s+/).filter(Boolean).length;
      return { success: true, filesEdited: [filePath], wordsAdded: wordCount, reason: 'replaced_existing_refresh' };
    }
  }

  // Find insertion point: before </article> or before the "Related Articles" section
  const newContent = generateBlogRefreshContent(query, internalLinksTo, rankIntentRoutes);
  const wordCount = newContent.split(/\s+/).filter(Boolean).length;

  // Try to insert before the closing </div> of .article-content
  // Look for the related-areas section or the end of article-content
  const insertionPatterns = [
    '      <!-- related-areas -->',
    '    </article>',
    '</article>',
  ];

  let inserted = false;
  for (const pattern of insertionPatterns) {
    const idx = html.indexOf(pattern);
    if (idx !== -1) {
      const block = `\n    ${MARKER_START}\n${newContent}\n    ${MARKER_END}\n\n`;
      html = html.slice(0, idx) + block + html.slice(idx);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    return { success: false, filesEdited: [], wordsAdded: 0, reason: 'no_insertion_point_found' };
  }

  writeFileSync(filePath, html, 'utf-8');
  return { success: true, filesEdited: [filePath], wordsAdded: wordCount, reason: 'added_refresh_section' };
}

/**
 * Refresh a money page (non-blog rank-intent page).
 *
 * @param {object} options
 * @param {string} options.routePath - The route path
 * @param {string} options.query - The target query to answer
 * @param {string[]} options.internalLinksTo - Paths to link to
 * @returns {{ success: boolean, filesEdited: string[], wordsAdded: number, reason: string }}
 */
export function refreshMoneyPage({ routePath, query, internalLinksTo = [] }) {
  // Convert route path to file path
  const filePath = join(ROOT, routePath.replace(/\/$/, ''), 'index.html');

  let html;
  try {
    html = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return { success: false, filesEdited: [], wordsAdded: 0, reason: `cannot read: ${err.message}` };
  }

  // Check if already refreshed
  if (html.includes(MARKER_START)) {
    const startIdx = html.indexOf(MARKER_START);
    const endIdx = html.indexOf(MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      const newContent = generateMoneyPageRefreshContent(query, internalLinksTo);
      const before = html.slice(0, startIdx);
      const after = html.slice(endIdx + MARKER_END.length);
      html = before + MARKER_START + '\n' + newContent + '\n    ' + MARKER_END + after;
      writeFileSync(filePath, html, 'utf-8');
      const wordCount = newContent.split(/\s+/).filter(Boolean).length;
      return { success: true, filesEdited: [filePath], wordsAdded: wordCount, reason: 'replaced_existing_refresh' };
    }
  }

  const newContent = generateMoneyPageRefreshContent(query, internalLinksTo);
  const wordCount = newContent.split(/\s+/).filter(Boolean).length;

  // Insert before </main> or before footer
  const insertionPatterns = [
    '  </main>',
    '</main>',
    '  <footer',
    '<footer',
  ];

  let inserted = false;
  for (const pattern of insertionPatterns) {
    const idx = html.indexOf(pattern);
    if (idx !== -1) {
      const block = `\n    ${MARKER_START}\n${newContent}\n    ${MARKER_END}\n\n`;
      html = html.slice(0, idx) + block + html.slice(idx);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    return { success: false, filesEdited: [], wordsAdded: 0, reason: 'no_insertion_point_found' };
  }

  writeFileSync(filePath, html, 'utf-8');
  return { success: true, filesEdited: [filePath], wordsAdded: wordCount, reason: 'added_refresh_section' };
}

/**
 * Generate FAQ + section content for a blog post refresh.
 */
function generateBlogRefreshContent(query, internalLinksTo, rankIntentRoutes) {
  const cleanQuery = capitalizeFirst(query.trim());
  const rankSet = new Set(rankIntentRoutes || []);

  // Generate FAQ items based on the query
  const faqs = generateFaqItems(query);

  // Build internal links section
  const links = buildInternalLinks(internalLinksTo, rankSet);

  const sections = [];

  // New section addressing the query
  sections.push(`          <h2>Understanding ${cleanQuery}</h2>`);
  sections.push(`          <p>Many homeowners in Central Ohio have questions about ${query.toLowerCase()}. This is one of the most common topics our clients ask about when preparing for a real estate transaction in the Columbus metro area.</p>`);
  sections.push(`          <p>The answer depends on several factors specific to your situation, including your property location, current market conditions, and your timeline. Working with an experienced local agent who understands the Central Ohio market can help you navigate these decisions with confidence.</p>`);
  sections.push(`          <p>At TD Realty Ohio, we help clients throughout Franklin, Delaware, and surrounding counties with transparent pricing and straightforward guidance. Whether you are buying or selling, understanding ${query.toLowerCase()} is an important part of making informed decisions.</p>`);

  if (links.length > 0) {
    sections.push(`          <p>For more information, explore these resources:</p>`);
    sections.push(`          <ul>`);
    for (const link of links) {
      sections.push(`            <li><a href="${link.path}">${link.text}</a></li>`);
    }
    sections.push(`          </ul>`);
  }

  // FAQ section
  sections.push(``);
  sections.push(`          <h2>Frequently Asked Questions</h2>`);
  sections.push(`          <div class="faq-list" style="margin-top: 1.5rem;">`);

  for (const faq of faqs) {
    sections.push(`            <div class="faq-item">`);
    sections.push(`              <button class="faq-question" aria-expanded="false">`);
    sections.push(`                ${faq.question}`);
    sections.push(`                <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">`);
    sections.push(`                  <polyline points="6 9 12 15 18 9"/>`);
    sections.push(`                </svg>`);
    sections.push(`              </button>`);
    sections.push(`              <div class="faq-answer">`);
    sections.push(`                <p>${faq.answer}</p>`);
    sections.push(`              </div>`);
    sections.push(`            </div>`);
  }

  sections.push(`          </div>`);

  return sections.join('\n');
}

/**
 * Generate FAQ content for a money page refresh.
 */
function generateMoneyPageRefreshContent(query, internalLinksTo) {
  const cleanQuery = capitalizeFirst(query.trim());
  const faqs = generateFaqItems(query);
  const links = buildInternalLinks(internalLinksTo, new Set());

  const sections = [];

  sections.push(`    <section class="section" style="padding-top: 2rem;">`);
  sections.push(`      <div class="container" style="max-width: 800px;">`);
  sections.push(`        <h2>Common Questions About ${cleanQuery}</h2>`);
  sections.push(`        <div class="faq-list" style="margin-top: 1.5rem;">`);

  for (const faq of faqs) {
    sections.push(`          <div class="faq-item">`);
    sections.push(`            <button class="faq-question" aria-expanded="false">`);
    sections.push(`              ${faq.question}`);
    sections.push(`              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">`);
    sections.push(`                <polyline points="6 9 12 15 18 9"/>`);
    sections.push(`              </svg>`);
    sections.push(`            </button>`);
    sections.push(`            <div class="faq-answer">`);
    sections.push(`              <p>${faq.answer}</p>`);
    sections.push(`            </div>`);
    sections.push(`          </div>`);
  }

  sections.push(`        </div>`);

  if (links.length > 0) {
    sections.push(`        <div style="margin-top: 2rem;">`);
    sections.push(`          <h3>Related Resources</h3>`);
    sections.push(`          <ul>`);
    for (const link of links) {
      sections.push(`            <li><a href="${link.path}">${link.text}</a></li>`);
    }
    sections.push(`          </ul>`);
    sections.push(`        </div>`);
  }

  sections.push(`      </div>`);
  sections.push(`    </section>`);

  return sections.join('\n');
}

/**
 * Generate FAQ items for a given query. Deterministic based on query text.
 */
function generateFaqItems(query) {
  const q = query.toLowerCase().trim();

  // Base FAQs that are always relevant
  const faqs = [
    {
      question: `What should I know about ${q} in Central Ohio?`,
      answer: `In the Columbus metro area, ${q} is influenced by local market conditions, property values, and county-specific regulations. Franklin and Delaware counties may have different requirements. Consulting with a local real estate professional who handles transactions in your specific area ensures you get accurate, current information.`,
    },
    {
      question: `How does ${q} affect my home sale or purchase?`,
      answer: `Understanding ${q} can directly impact your net proceeds when selling or your total costs when buying. Homeowners who research this topic before listing or making an offer are typically better prepared to negotiate favorable terms and avoid unexpected costs at the closing table.`,
    },
    {
      question: `Where can I get help with ${q}?`,
      answer: `TD Realty Ohio assists clients throughout Central Ohio with questions about ${q} and other real estate topics. You can call (614) 392-8858 or visit our contact page to schedule a consultation. There is no obligation, and we provide straightforward guidance based on your specific situation.`,
    },
  ];

  return faqs;
}

/**
 * Build internal link items from the internalLinksTo list.
 */
function buildInternalLinks(internalLinksTo, rankSet) {
  const pathLabels = {
    '/sellers/': 'Seller services and listing options',
    '/buyers/': 'Buyer programs and homebuying guide',
    '/1-percent-commission/': '1% commission listing details',
    '/contact/': 'Schedule a consultation',
    '/areas/': 'Central Ohio service areas',
    '/pre-listing-inspection/': 'Pre-listing inspection program',
    '/home-value/': 'Free home value estimate',
    '/affordability/': 'Affordability calculator',
    '/compare/': 'Compare listing options',
    '/sell-and-buy/': 'Sell and buy with TD Realty',
    '/sell-only-2-percent/': 'Sell-only listing at 2%',
    '/blog/': 'Real estate blog',
    '/faq/': 'Frequently asked questions',
    '/referrals/': 'Referral credit program',
  };

  const links = [];
  for (const path of internalLinksTo) {
    if (!path) continue;
    const text = pathLabels[path] || pathToLabel(path);
    links.push({ path, text });
  }

  // Cap at 3 links
  return links.slice(0, 3);
}

function pathToLabel(path) {
  return path
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/[-/]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function capitalizeFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
