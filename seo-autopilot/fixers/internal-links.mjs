/**
 * internal-links.mjs
 *
 * Applies bounded internal link insertions to source HTML files.
 * Uses a "Related Guides" block injected before </main>.
 *
 * Strategy: maintains related-guides.json as a config file that
 * maps source pages to their related links. The fixer:
 * 1. Updates related-guides.json with new planned links
 * 2. Injects or updates the Related Guides block in source HTML
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const GUIDES_PATH = join(__dirname, '..', 'config', 'related-guides.json');

const BLOCK_START = '<!-- seo-autopilot:related-guides -->';
const BLOCK_END = '<!-- /seo-autopilot:related-guides -->';

/**
 * Load the related guides config.
 */
function loadGuidesConfig() {
  try {
    return JSON.parse(readFileSync(GUIDES_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Save related guides config.
 */
function saveGuidesConfig(config) {
  writeFileSync(GUIDES_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Convert a route path to a file path.
 */
function routeToFile(routePath) {
  if (routePath === '/') return join(ROOT, 'index.html');
  return join(ROOT, routePath, 'index.html');
}

/**
 * Build the Related Guides HTML block.
 */
function buildGuidesBlock(links) {
  if (!links || links.length === 0) return '';

  const items = links
    .map((l) => `      <li><a href="${l.href}">${escapeHtml(l.text)}</a></li>`)
    .join('\n');

  return `${BLOCK_START}
  <section class="section-compact" style="background: var(--off-white); padding: 2rem 0;">
    <div class="container">
      <h3 style="margin-bottom: 1rem;">Related Guides</h3>
      <ul style="list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.75rem;">
${items}
      </ul>
    </div>
  </section>
  ${BLOCK_END}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Apply link plan actions.
 *
 * @param {Array<{fromPath: string, toPath: string, anchorText: string, placementRule: string}>} actions
 * @returns {{ filesEdited: number, linksAdded: number, details: Array }}
 */
export function applyInternalLinks(actions) {
  if (!actions || actions.length === 0) {
    return { filesEdited: 0, linksAdded: 0, details: [] };
  }

  const guidesConfig = loadGuidesConfig();
  const details = [];

  // Group actions by source file
  const bySource = {};
  for (const action of actions) {
    if (!bySource[action.fromPath]) bySource[action.fromPath] = [];
    bySource[action.fromPath].push(action);
  }

  let filesEdited = 0;
  let linksAdded = 0;

  for (const [fromPath, fileActions] of Object.entries(bySource)) {
    const filePath = routeToFile(fromPath);
    if (!existsSync(filePath)) {
      details.push({ fromPath, status: 'skipped', reason: 'file not found' });
      continue;
    }

    let html;
    try {
      html = readFileSync(filePath, 'utf-8');
    } catch (err) {
      details.push({ fromPath, status: 'skipped', reason: err.message });
      continue;
    }

    // Ensure the page has </main> for injection
    if (!html.includes('</main>')) {
      details.push({ fromPath, status: 'skipped', reason: 'no </main> tag found' });
      continue;
    }

    // Update guides config for this source page
    if (!guidesConfig[fromPath]) guidesConfig[fromPath] = [];

    for (const action of fileActions) {
      // Check if link already exists in config
      const exists = guidesConfig[fromPath].some(
        (l) => l.href === action.toPath,
      );
      if (!exists) {
        guidesConfig[fromPath].push({
          href: action.toPath,
          text: action.anchorText,
        });
        linksAdded++;
        details.push({
          fromPath,
          toPath: action.toPath,
          anchorText: action.anchorText,
          status: 'added',
        });
      }
    }

    // Build the Related Guides block
    const links = guidesConfig[fromPath];
    if (!links || links.length === 0) continue;

    const block = buildGuidesBlock(links);

    // Remove existing block if present
    let newHtml = html;
    const startIdx = newHtml.indexOf(BLOCK_START);
    const endIdx = newHtml.indexOf(BLOCK_END);
    if (startIdx !== -1 && endIdx !== -1) {
      newHtml = newHtml.slice(0, startIdx) + newHtml.slice(endIdx + BLOCK_END.length);
    }

    // Insert before </main>
    newHtml = newHtml.replace('</main>', `  ${block}\n  </main>`);

    if (newHtml !== html) {
      writeFileSync(filePath, newHtml, 'utf-8');
      filesEdited++;
    }
  }

  // Save updated guides config
  saveGuidesConfig(guidesConfig);

  return { filesEdited, linksAdded, details };
}
