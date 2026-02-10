/**
 * pillar-nav.mjs
 *
 * Injects bounded subnav + "Next steps" crosslinks into pillar root pages.
 * Uses stable markers for idempotent updates. Only touches pillar roots.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const PILLARS_ROUTING_PATH = join(__dirname, '..', 'config', 'pillars-routing.json');

const SUBNAV_START = '<!-- SEO_AUTOPILOT_SUBNAV_START -->';
const SUBNAV_END = '<!-- SEO_AUTOPILOT_SUBNAV_END -->';
const NEXTSTEPS_START = '<!-- SEO_AUTOPILOT_NEXTSTEPS_START -->';
const NEXTSTEPS_END = '<!-- SEO_AUTOPILOT_NEXTSTEPS_END -->';

function loadJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Resolve route to file path.
 */
function resolveFile(routePath) {
  const slug = routePath.replace(/^\/|\/$/g, '');
  if (!slug) return join(ROOT, 'index.html');
  return join(ROOT, slug, 'index.html');
}

/**
 * Build subnav HTML for a pillar.
 */
function buildSubnavHtml(pillar, rules) {
  const links = pillar.supporting.slice(0, rules.subnavMaxLinks || 5);
  if (links.length === 0) return '';

  const items = links.map(href => {
    const label = href.replace(/^\/|\/$/g, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `          <li><a href="${href}">${label}</a></li>`;
  });

  return [
    `      ${SUBNAV_START}`,
    `      <nav class="pillar-subnav" aria-label="${pillar.navLabel} resources">`,
    `        <span class="pillar-subnav-label">Related:</span>`,
    `        <ul>`,
    ...items,
    `        </ul>`,
    `      </nav>`,
    `      ${SUBNAV_END}`,
  ].join('\n');
}

/**
 * Build crosslinks HTML for a pillar.
 * Each pillar gets different intent-appropriate links.
 */
function buildNextStepsHtml(pillar) {
  const crosslinks = getCrosslinks(pillar.id);
  if (crosslinks.length === 0) return '';

  const items = crosslinks.map(({ href, text }) =>
    `          <li><a href="${href}">${text}</a></li>`
  );

  return [
    `      ${NEXTSTEPS_START}`,
    `      <section class="pillar-next-steps" aria-label="Next steps">`,
    `        <h2>Next Steps</h2>`,
    `        <ul>`,
    ...items,
    `        </ul>`,
    `      </section>`,
    `      ${NEXTSTEPS_END}`,
  ].join('\n');
}

/**
 * Get intent-appropriate crosslinks for a pillar.
 */
function getCrosslinks(pillarId) {
  switch (pillarId) {
    case 'sell':
      return [
        { href: '/1-percent-commission/', text: 'See our 1% commission listing' },
        { href: '/pre-listing-inspection/', text: 'Get a pre-listing inspection' },
        { href: '/contact/', text: 'Talk to an agent today' },
      ];
    case 'buy':
      return [
        { href: '/affordability/', text: 'Check your affordability' },
        { href: '/contact/', text: 'Talk to an agent today' },
      ];
    case 'areas':
      return [
        { href: '/sellers/', text: 'Selling in your area' },
        { href: '/buyers/', text: 'Buying in your area' },
        { href: '/contact/', text: 'Talk to a local agent' },
      ];
    case 'blog':
      return [
        { href: '/sellers/', text: 'Learn about selling' },
        { href: '/buyers/', text: 'Learn about buying' },
        { href: '/areas/', text: 'Explore neighborhoods' },
      ];
    default:
      return [];
  }
}

/**
 * Insert or replace a marker block in HTML.
 *
 * @param {string} html - Page HTML
 * @param {string} startMarker - Start marker
 * @param {string} endMarker - End marker
 * @param {string} content - New block content
 * @param {string} insertBefore - String to insert before (if block doesn't exist)
 * @returns {{ html: string, inserted: boolean }}
 */
function upsertBlock(html, startMarker, endMarker, content, insertBefore) {
  if (!content) return { html, inserted: false };

  const hasExisting = html.includes(startMarker) && html.includes(endMarker);

  if (hasExisting) {
    // Match leading whitespace on the marker line to prevent indentation doubling
    const regex = new RegExp(
      '[ \\t]*' + startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '[\\s\\S]*?' +
      '[ \\t]*' + endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const newHtml = html.replace(regex, content);
    return { html: newHtml, inserted: newHtml !== html };
  }

  // Insert before target
  const idx = html.lastIndexOf(insertBefore);
  if (idx === -1) return { html, inserted: false };

  const newHtml = html.slice(0, idx) + content + '\n' + html.slice(idx);
  return { html: newHtml, inserted: true };
}

/**
 * Apply pillar nav enhancements to all pillar root pages.
 *
 * @returns {{
 *   filesChanged: number,
 *   details: Array<{ route: string, subnavInserted: boolean, nextStepsInserted: boolean }>
 * }}
 */
export function applyPillarNav() {
  const config = loadJson(PILLARS_ROUTING_PATH, { pillars: [], rules: {} });
  const { pillars, rules } = config;

  const details = [];
  let filesChanged = 0;

  for (const pillar of pillars) {
    const filePath = resolveFile(pillar.root);
    let html;
    try {
      html = readFileSync(filePath, 'utf-8');
    } catch {
      details.push({ route: pillar.root, subnavInserted: false, nextStepsInserted: false, error: 'file_not_found' });
      continue;
    }

    const original = html;
    let subnavInserted = false;
    let nextStepsInserted = false;

    // Subnav: insert after first </h1> (hero heading)
    if (rules.showPillarSubnav !== false) {
      const subnavHtml = buildSubnavHtml(pillar, rules);
      if (subnavHtml) {
        const h1CloseIdx = html.indexOf('</h1>');
        if (h1CloseIdx !== -1) {
          // Find the end of the line containing </h1>
          const lineEnd = html.indexOf('\n', h1CloseIdx);
          const insertPoint = lineEnd !== -1 ? lineEnd + 1 : h1CloseIdx + 5;
          const result = upsertBlock(html, SUBNAV_START, SUBNAV_END, subnavHtml, html.slice(insertPoint, insertPoint + 40));
          if (result.inserted) {
            html = result.html;
            subnavInserted = true;
          } else if (!html.includes(SUBNAV_START)) {
            // First-time insert after </h1> line
            html = html.slice(0, insertPoint) + subnavHtml + '\n' + html.slice(insertPoint);
            subnavInserted = true;
          }
        }
      }
    }

    // Next steps: insert before </main>
    const nextStepsHtml = buildNextStepsHtml(pillar);
    if (nextStepsHtml) {
      const result = upsertBlock(html, NEXTSTEPS_START, NEXTSTEPS_END, nextStepsHtml, '</main>');
      html = result.html;
      nextStepsInserted = result.inserted;
    }

    if (html !== original) {
      writeFileSync(filePath, html);
      filesChanged++;
    }

    details.push({ route: pillar.root, subnavInserted, nextStepsInserted });
  }

  return { filesChanged, details };
}

/**
 * Revert pillar nav changes on a specific file.
 */
export function revertPillarNav(filePath, originalContent) {
  if (filePath && originalContent) {
    writeFileSync(filePath, originalContent);
  }
}

/**
 * Remove all pillar nav blocks from all pillar root pages.
 * Used for safe rollback.
 *
 * @returns {{ filesChanged: number }}
 */
export function removeAllPillarNavBlocks() {
  const config = loadJson(PILLARS_ROUTING_PATH, { pillars: [], rules: {} });
  let filesChanged = 0;

  for (const pillar of config.pillars) {
    const filePath = resolveFile(pillar.root);
    let html;
    try {
      html = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const original = html;

    // Remove subnav block
    if (html.includes(SUBNAV_START) && html.includes(SUBNAV_END)) {
      const regex = new RegExp(
        '\\n?' + SUBNAV_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[\\s\\S]*?' +
        SUBNAV_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?'
      );
      html = html.replace(regex, '');
    }

    // Remove next steps block
    if (html.includes(NEXTSTEPS_START) && html.includes(NEXTSTEPS_END)) {
      const regex = new RegExp(
        '\\n?' + NEXTSTEPS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[\\s\\S]*?' +
        NEXTSTEPS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?'
      );
      html = html.replace(regex, '');
    }

    if (html !== original) {
      writeFileSync(filePath, html);
      filesChanged++;
    }
  }

  return { filesChanged };
}
