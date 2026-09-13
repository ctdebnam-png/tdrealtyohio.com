#!/usr/bin/env node
/**
 * TD Realty Ohio - Build Step
 * Generates sitemap.xml + robots.txt from the route registry.
 * Also validates canonical URL normalization.
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { SITE_URL, getIndexableRoutes, normalizeCanonical } = require('../src/config/routes.js');

const currentDate = () => new Date().toISOString().split('T')[0];

// ── Sitemap Generator ──────────────────────────────────────
async function getLastMod() {
  return currentDate();
}

function pathToFile(routePath) {
  if (routePath === '/') return join(ROOT, 'index.html');
  return join(ROOT, routePath, 'index.html');
}

async function generateSitemap() {
  const routes = getIndexableRoutes();
  const urls = [];

  for (const route of routes) {
    const filePath = pathToFile(route.path);
    const lastmod = await getLastMod(filePath);
    const loc = normalizeCanonical(route.path);

    urls.push({
      loc,
      lastmod,
      changefreq: route.changefreq || 'monthly',
      priority: route.priority || '0.5',
    });
  }

  // Sort by priority descending, then alphabetically
  urls.sort((a, b) => {
    const pDiff = parseFloat(b.priority) - parseFloat(a.priority);
    if (pDiff !== 0) return pDiff;
    return a.loc.localeCompare(b.loc);
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

  await writeFile(join(ROOT, 'sitemap.xml'), xml);
  console.log(`[build] Generated sitemap.xml with ${urls.length} URLs`);
  return urls;
}

// ── Robots.txt Generator ───────────────────────────────────
async function generateRobots() {
  const timestamp = new Date().toISOString();

  const robots = `# TD Realty Ohio - robots.txt
# https://tdrealtyohio.com
# Generated: ${timestamp}

# ==============================================
# DEFAULT: Allow all standard search engines
# ==============================================
User-agent: *
Allow: /
Disallow: /api/
Disallow: /lp/
Disallow: /ops/
Disallow: /ads-bot/

# ==============================================
# BLOCK AI TRAINING CRAWLERS
# ==============================================

User-agent: Amazonbot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /
User-agent: anthropic-ai
Disallow: /

User-agent: ChatGPT-User
Disallow: /
User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: FacebookBot
Disallow: /
User-agent: Meta-ExternalAgent
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: omgili
Disallow: /
User-agent: omgilibot
Disallow: /
User-agent: Diffbot
Disallow: /
User-agent: PetalBot
Disallow: /
User-agent: Scrapy
Disallow: /

# ==============================================
# SITEMAP
# ==============================================
Sitemap: ${SITE_URL}/sitemap.xml
`;

  await writeFile(join(ROOT, 'robots.txt'), robots);
  console.log('[build] Generated robots.txt');
}

// ── Canonical Validation ───────────────────────────────────
async function validateCanonicals() {
  const routes = getIndexableRoutes();
  let errors = 0;

  for (const route of routes) {
    const filePath = pathToFile(route.path);
    try {
      const content = await readFile(filePath, 'utf-8');
      const match = content.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);

      if (!match) {
        console.warn(`[canonical] MISSING: ${route.path}`);
        errors++;
        continue;
      }

      const expected = normalizeCanonical(route.canonical || route.path);
      if (match[1] !== expected) {
        console.warn(`[canonical] MISMATCH: ${route.path} — found "${match[1]}", expected "${expected}"`);
        errors++;
      }

      // Check noindex is not on money pages
      const moneyTypes = ['service', 'area', 'zip', 'comparison', 'calculator', 'hub', 'home'];
      if (moneyTypes.includes(route.pageType)) {
        if (content.includes('noindex')) {
          console.error(`[canonical] NOINDEX ON MONEY PAGE: ${route.path}`);
          errors++;
        }
      }
    } catch {
      // File doesn't exist yet (e.g., new ZIP pages) — not an error during build
    }
  }

  if (errors > 0) {
    console.warn(`[canonical] ${errors} canonical issue(s) found`);
  } else {
    console.log('[canonical] All canonicals valid');
  }

  return errors;
}

// ── Main ───────────────────────────────────────────────────
async function build() {
  console.log('[build] Starting build...');
  await generateSitemap();
  await generateRobots();
  await validateCanonicals();
  console.log('[build] Build complete');
}

build().catch(err => {
  console.error('[build] FATAL:', err);
  process.exit(1);
});
