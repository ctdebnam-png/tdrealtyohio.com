/**
 * area-discovery.mjs
 *
 * Identifies area pages from the built output route list.
 * Area pages start with areaRoutePrefix and are not in the exclude list.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const AREAS_CONFIG_PATH = join(__dirname, '..', 'config', 'areas.json');

function loadAreasConfig() {
  try {
    return JSON.parse(readFileSync(AREAS_CONFIG_PATH, 'utf-8'));
  } catch {
    return { areaRoutePrefix: '/areas/', exclude: ['/areas/', '/areas/index/'], maxAreaUpdatesPerRun: 1, minWordsTarget: 700, maxWordsAddPerRun: 600 };
  }
}

/**
 * Discover area routes from the filesystem.
 *
 * @param {object[]} pages - Pages from list-html-pages (optional, for enrichment)
 * @returns {{ areaRoutes: string[], config: object }}
 */
export function discoverAreas(pages = []) {
  const config = loadAreasConfig();
  const prefix = config.areaRoutePrefix || '/areas/';
  const excludeSet = new Set(config.exclude || []);

  // Build set of routes from pages list if available
  const pageRoutes = new Set(pages.map(p => p.path));

  // Also scan the filesystem directly for robustness
  const areasDir = join(ROOT, 'areas');
  const areaRoutes = [];

  try {
    scanDir(areasDir, '/areas/', areaRoutes, excludeSet, prefix);
  } catch {
    // If areas dir doesn't exist, fall back to pages list
  }

  // Also check pages list for any routes missed by filesystem scan
  for (const route of pageRoutes) {
    if (route.startsWith(prefix) && !excludeSet.has(route) && !areaRoutes.includes(route)) {
      areaRoutes.push(route);
    }
  }

  // Deduplicate and sort
  const unique = [...new Set(areaRoutes)].sort();

  return { areaRoutes: unique, config };
}

/**
 * Recursively scan directory for area pages (index.html files).
 */
function scanDir(dir, routePrefix, results, excludeSet, areaPrefix) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'index.html') {
      const route = routePrefix;
      if (route.startsWith(areaPrefix) && !excludeSet.has(route)) {
        results.push(route);
      }
    } else if (entry.isDirectory()) {
      const childDir = join(dir, entry.name);
      const childRoute = routePrefix + entry.name + '/';
      scanDir(childDir, childRoute, results, excludeSet, areaPrefix);
    }
  }
}
