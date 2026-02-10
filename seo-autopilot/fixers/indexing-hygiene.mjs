/**
 * indexing-hygiene.mjs
 *
 * Auto-fixes safe, source-level indexing items:
 * - Ensures robots.txt exists with correct directives
 * - Ensures HTML pages have correct robots meta (index/follow vs noindex)
 * - Ensures canonical tags are absolute and follow canonicalStrategy
 *
 * Only operates on files already controlled in the repo.
 * Does NOT fix server-level redirects or hosting config.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SITE_CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');

function loadSiteConfig() {
  try { return JSON.parse(readFileSync(SITE_CONFIG_PATH, 'utf-8')); } catch { return { baseUrl: 'https://tdrealtyohio.com', canonicalStrategy: 'slash', rankIntentRoutes: [], utilityRoutesNoIndex: [] }; }
}

/**
 * Fix indexing hygiene issues.
 *
 * @returns {{ filesChanged: number, fixes: Array<{ file: string, action: string }> }}
 */
export function fixIndexingHygiene() {
  const config = loadSiteConfig();
  const baseUrl = config.baseUrl || 'https://tdrealtyohio.com';
  const fixes = [];
  let filesChanged = 0;

  // 1) Ensure robots.txt exists and has correct content
  const robotsPath = join(ROOT, 'robots.txt');
  const expectedRobots = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');

  if (existsSync(robotsPath)) {
    const current = readFileSync(robotsPath, 'utf-8');
    // Check essential directives are present
    const hasAllow = current.includes('Allow: /');
    const hasSitemap = current.includes(`Sitemap: ${baseUrl}/sitemap.xml`);

    if (!hasAllow || !hasSitemap) {
      // Only fix missing directives; don't overwrite custom rules
      let fixed = current;
      if (!hasAllow && !current.includes('Disallow: /')) {
        // Add Allow: / after User-agent: *
        fixed = fixed.replace(
          /(User-agent:\s*\*[^\n]*\n)/i,
          '$1Allow: /\n',
        );
      }
      if (!hasSitemap) {
        fixed = fixed.trimEnd() + '\n\nSitemap: ' + baseUrl + '/sitemap.xml\n';
      }
      if (fixed !== current) {
        writeFileSync(robotsPath, fixed, 'utf-8');
        fixes.push({ file: 'robots.txt', action: 'added_missing_directives' });
        filesChanged++;
      }
    }
  } else {
    writeFileSync(robotsPath, expectedRobots, 'utf-8');
    fixes.push({ file: 'robots.txt', action: 'created' });
    filesChanged++;
  }

  // 2) Fix noindex on rank-intent pages and ensure noindex on utility pages
  const utilityNoIndex = new Set(config.utilityRoutesNoIndex || []);
  const rankIntentRoutes = config.rankIntentRoutes || [];

  for (const route of rankIntentRoutes) {
    const filePath = resolveRouteFile(route);
    if (!filePath || !existsSync(filePath)) continue;

    let html;
    try { html = readFileSync(filePath, 'utf-8'); } catch { continue; }

    // Check for accidental noindex on rank-intent pages
    const noindexMatch = html.match(/<meta\s+name\s*=\s*["']robots["']\s+content\s*=\s*["'][^"']*noindex[^"']*["']/i);
    if (noindexMatch && !utilityNoIndex.has(route)) {
      // Remove the noindex directive
      const fixed = html.replace(noindexMatch[0], noindexMatch[0].replace(/noindex,?\s*/i, ''));
      if (fixed !== html) {
        writeFileSync(filePath, fixed, 'utf-8');
        fixes.push({ file: filePath, action: 'removed_noindex_from_rank_page' });
        filesChanged++;
      }
    }

    // Ensure canonical is absolute and follows strategy
    const canonicalMatch = html.match(/<link\s+rel\s*=\s*["']canonical["']\s+href\s*=\s*["']([^"']*)["']/i);
    if (canonicalMatch) {
      const currentCanonical = canonicalMatch[1];
      const expectedCanonical = baseUrl + normalizeRoutePath(route, config.canonicalStrategy);

      if (currentCanonical !== expectedCanonical) {
        // Only fix if the canonical is clearly wrong (not absolute, or wrong domain)
        if (!currentCanonical.startsWith('http') || !currentCanonical.startsWith(baseUrl)) {
          const fixed = html.replace(canonicalMatch[0], `<link rel="canonical" href="${expectedCanonical}">`);
          if (fixed !== html) {
            writeFileSync(filePath, fixed, 'utf-8');
            fixes.push({ file: filePath, action: `fixed_canonical: ${currentCanonical} -> ${expectedCanonical}` });
            filesChanged++;
          }
        }
      }
    }
  }

  return { filesChanged, fixes };
}

/**
 * Resolve a route path to a file path.
 */
function resolveRouteFile(route) {
  // Handle root route
  if (route === '/') return join(ROOT, 'index.html');

  // Standard: /path/ -> /path/index.html
  const clean = route.replace(/\/$/, '');
  return join(ROOT, clean, 'index.html');
}

/**
 * Normalize a route path according to the canonical strategy.
 */
function normalizeRoutePath(route, strategy) {
  if (strategy === 'slash') {
    return route.endsWith('/') ? route : route + '/';
  }
  if (strategy === 'no-slash') {
    return route === '/' ? '/' : route.replace(/\/$/, '');
  }
  return route;
}
