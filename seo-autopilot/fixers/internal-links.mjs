/**
 * internal-links.mjs
 *
 * Applies bounded internal link insertions to source HTML files.
 * Uses a "Related Guides" block injected before </main>.
 *
 * Strategy: maintains related-guides.json as a config file that
 * maps source pages to links grouped by intent clusters when available.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const GUIDES_PATH = join(__dirname, '..', 'config', 'related-guides.json');

const BLOCK_START = '<!-- seo-autopilot:related-guides -->';
const BLOCK_END = '<!-- /seo-autopilot:related-guides -->';

function loadGuidesConfig() {
  try {
    return JSON.parse(readFileSync(GUIDES_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveGuidesConfig(config) {
  writeFileSync(GUIDES_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function routeToFile(routePath) {
  if (routePath === '/') return join(ROOT, 'index.html');
  return join(ROOT, routePath, 'index.html');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeGuidesEntry(entry) {
  if (Array.isArray(entry)) {
    return {
      intentClusters: [{ intent: 'related guides', links: entry }],
      usedLegacyShape: true,
    };
  }

  if (entry && Array.isArray(entry.intentClusters)) {
    return {
      intentClusters: entry.intentClusters.map((cluster) => ({
        intent: cluster.intent || 'related guides',
        links: Array.isArray(cluster.links) ? cluster.links : [],
      })),
      usedLegacyShape: false,
    };
  }

  return { intentClusters: [], usedLegacyShape: false };
}

function flattenLinks(intentClusters) {
  return intentClusters.flatMap((cluster) => cluster.links || []);
}

function buildGuidesBlock(entry) {
  const { intentClusters } = normalizeGuidesEntry(entry);
  if (intentClusters.length === 0) return '';

  const clustersHtml = intentClusters
    .filter((cluster) => (cluster.links || []).length > 0)
    .map((cluster) => {
      const items = cluster.links
        .map((l) => `              <li><a href="${l.href}">${escapeHtml(l.text)}</a></li>`)
        .join('\n');

      return `        <article class="guide-card">
          <h4>${escapeHtml(cluster.intent)}</h4>
          <ul>
${items}
          </ul>
        </article>`;
    })
    .join('\n');

  if (!clustersHtml) return '';

  return `${BLOCK_START}
  <section class="section-compact u-04df6151">
    <div class="container">
      <h3 class="u-4986ecf7">Related Guides by Intent</h3>
      <div class="guide-card-grid" data-collapsible-grid="3">
${clustersHtml}
      </div>
    </div>
  </section>
  ${BLOCK_END}`;
}

/**
 * @param {Array<{fromPath: string, toPath: string, anchorText: string, placementRule: string, intentCluster?: string}>} actions
 * @returns {{ filesEdited: number, linksAdded: number, details: Array }}
 */
export function applyInternalLinks(actions) {
  if (!actions || actions.length === 0) {
    return { filesEdited: 0, linksAdded: 0, details: [] };
  }

  const guidesConfig = loadGuidesConfig();
  const details = [];

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

    if (!html.includes('</main>')) {
      details.push({ fromPath, status: 'skipped', reason: 'no </main> tag found' });
      continue;
    }

    const normalized = normalizeGuidesEntry(guidesConfig[fromPath]);
    if (normalized.intentClusters.length === 0) {
      normalized.intentClusters.push({ intent: 'related guides', links: [] });
    }

    for (const action of fileActions) {
      const clusterIntent = action.intentCluster || 'related guides';
      let cluster = normalized.intentClusters.find((c) => c.intent === clusterIntent);
      if (!cluster) {
        cluster = { intent: clusterIntent, links: [] };
        normalized.intentClusters.push(cluster);
      }

      const exists = flattenLinks(normalized.intentClusters).some((l) => l.href === action.toPath);
      if (!exists) {
        cluster.links.push({ href: action.toPath, text: action.anchorText });
        linksAdded++;
        details.push({ fromPath, toPath: action.toPath, anchorText: action.anchorText, intentCluster: clusterIntent, status: 'added' });
      }
    }

    guidesConfig[fromPath] = normalized.usedLegacyShape
      ? flattenLinks(normalized.intentClusters)
      : { intentClusters: normalized.intentClusters };

    const block = buildGuidesBlock(guidesConfig[fromPath]);
    if (!block) continue;

    let newHtml = html;
    const startIdx = newHtml.indexOf(BLOCK_START);
    const endIdx = newHtml.indexOf(BLOCK_END);
    if (startIdx !== -1 && endIdx !== -1) {
      newHtml = newHtml.slice(0, startIdx) + newHtml.slice(endIdx + BLOCK_END.length);
    }

    newHtml = newHtml.replace('</main>', `  ${block}\n  </main>`);

    if (newHtml !== html) {
      writeFileSync(filePath, newHtml, 'utf-8');
      filesEdited++;
    }
  }

  saveGuidesConfig(guidesConfig);

  return { filesEdited, linksAdded, details };
}
