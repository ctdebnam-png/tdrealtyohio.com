/**
 * consolidation-mitigations.mjs
 *
 * Applies safe, marker-based mitigations for cannibalization.
 * No page removals, no canonical changes, no noindex.
 *
 * Mitigations:
 * A) Add a "Related" paragraph on supporting page linking to primary
 * B) Add internal link to primary from supporting page's content
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CONSOLIDATION_CONFIG_PATH = join(__dirname, '..', 'config', 'consolidation.json');

const MARKER_START = '<!-- SEO_AUTOPILOT_CONSOLIDATION_START -->';
const MARKER_END = '<!-- SEO_AUTOPILOT_CONSOLIDATION_END -->';

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Resolve a route path to its file path.
 */
function resolveFilePath(routePath) {
  const slug = routePath.replace(/^\/|\/$/g, '');
  if (!slug) return join(ROOT, 'index.html');
  return join(ROOT, slug, 'index.html');
}

/**
 * Apply safe mitigations for one consolidation plan item.
 *
 * @param {object} planItem - { primary, supporting, sampleQueries }
 * @param {object} [options]
 * @returns {{ applied: boolean, filesChanged: number, actions: string[] }}
 */
export function applyConsolidationMitigation(planItem, options = {}) {
  const config = loadJson(CONSOLIDATION_CONFIG_PATH, {});
  if (!config.applyMitigations) {
    return { applied: false, filesChanged: 0, actions: ['mitigations_disabled'] };
  }

  if (!planItem || !planItem.primary || !planItem.supporting?.length) {
    return { applied: false, filesChanged: 0, actions: ['invalid_plan_item'] };
  }

  let filesChanged = 0;
  const actions = [];

  // Apply mitigation on supporting page: add "Related" link block
  for (const supportingPath of planItem.supporting) {
    const filePath = resolveFilePath(supportingPath);
    let html;
    try {
      html = readFileSync(filePath, 'utf-8');
    } catch {
      actions.push(`skip: ${supportingPath} not found`);
      continue;
    }

    const original = html;

    // Build the mitigation block
    const primaryLabel = getPrimaryLabel(planItem.primary);
    const block = buildMitigationBlock(planItem.primary, primaryLabel);

    if (html.includes(MARKER_START) && html.includes(MARKER_END)) {
      // Replace existing block
      const regex = new RegExp(
        '[ \\t]*' + escapeRegex(MARKER_START) +
        '[\\s\\S]*?' +
        '[ \\t]*' + escapeRegex(MARKER_END)
      );
      html = html.replace(regex, block);
    } else {
      // Insert before closing </main> or before </article> or before the last </section>
      const insertPoint = findContentInsertPoint(html);
      if (insertPoint === -1) {
        actions.push(`skip: ${supportingPath} no insertion point`);
        continue;
      }
      html = html.slice(0, insertPoint) + '\n' + block + '\n' + html.slice(insertPoint);
    }

    if (html !== original) {
      writeFileSync(filePath, html, 'utf-8');
      filesChanged++;
      actions.push(`mitigated: ${supportingPath} → links to ${planItem.primary}`);
    }
  }

  return {
    applied: filesChanged > 0,
    filesChanged,
    actions,
  };
}

/**
 * Remove all consolidation mitigation blocks from target pages.
 */
export function removeConsolidationMitigations(planItems = []) {
  let filesChanged = 0;
  const paths = new Set();

  for (const item of planItems) {
    for (const s of (item.supporting || [])) {
      paths.add(s);
    }
  }

  for (const routePath of paths) {
    const filePath = resolveFilePath(routePath);
    let html;
    try {
      html = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    if (html.includes(MARKER_START) && html.includes(MARKER_END)) {
      const regex = new RegExp(
        '\\n?[ \\t]*' + escapeRegex(MARKER_START) +
        '[\\s\\S]*?' +
        '[ \\t]*' + escapeRegex(MARKER_END) + '\\n?'
      );
      const updated = html.replace(regex, '');
      if (updated !== html) {
        writeFileSync(filePath, updated, 'utf-8');
        filesChanged++;
      }
    }
  }

  return { filesChanged };
}

/**
 * Build the marker-based mitigation block HTML.
 */
function buildMitigationBlock(primaryPath, primaryLabel) {
  return [
    `        ${MARKER_START}`,
    `        <aside class="related-content" style="margin: 2rem 0; padding: 1rem; border-left: 3px solid var(--color-accent, #2563eb); background: var(--color-surface, #f8fafc);">`,
    `          <p style="margin: 0; font-size: 0.95rem;">`,
    `            Looking for more details? See our main guide: <a href="${primaryPath}">${primaryLabel}</a>`,
    `          </p>`,
    `        </aside>`,
    `        ${MARKER_END}`,
  ].join('\n');
}

/**
 * Get a human-readable label for a route path.
 */
function getPrimaryLabel(routePath) {
  const slug = routePath.replace(/^\/|\/$/g, '');
  if (!slug) return 'Home';
  // Convert slug to title case
  return slug
    .split('/')
    .pop()
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Find a content insertion point (before </main>, </article>, or last </section>).
 */
function findContentInsertPoint(html) {
  // Prefer before </main>
  const mainEnd = html.lastIndexOf('</main>');
  if (mainEnd > -1) return mainEnd;

  // Before </article>
  const articleEnd = html.lastIndexOf('</article>');
  if (articleEnd > -1) return articleEnd;

  // Before last </section> before footer
  const footerIdx = html.indexOf('<footer');
  const lastSection = html.lastIndexOf('</section>', footerIdx > -1 ? footerIdx : undefined);
  if (lastSection > -1) return lastSection;

  return -1;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
