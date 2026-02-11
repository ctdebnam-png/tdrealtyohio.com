/**
 * localbusiness-schema.mjs
 *
 * Generates LocalBusiness JSON-LD from business.json and injects
 * it into target pages using stable markers.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateLocalBusiness } from '../schema/validators/localbusiness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BUSINESS_CONFIG_PATH = join(__dirname, '..', 'config', 'business.json');

const SCHEMA_START = '<!-- SEO_AUTOPILOT_LOCALBUSINESS_START -->';
const SCHEMA_END = '<!-- SEO_AUTOPILOT_LOCALBUSINESS_END -->';

// Pages that should have LocalBusiness schema
const TARGET_PAGES = ['/', '/contact/'];

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Build a LocalBusiness JSON-LD object from business.json.
 * Omits empty fields entirely.
 *
 * @returns {object} JSON-LD object
 */
export function buildLocalBusinessSchema() {
  const biz = loadJson(BUSINESS_CONFIG_PATH, {});

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
  };

  if (biz.businessName) schema.name = biz.businessName;
  if (biz.website) schema.url = biz.website;
  if (biz.phone) schema.telephone = biz.phone;
  if (biz.email) schema.email = biz.email;

  // Address — only include if meaningful fields are present
  const addr = biz.address || {};
  if (addr.city && addr.region) {
    const postalAddress = {
      '@type': 'PostalAddress',
      addressLocality: addr.city,
      addressRegion: addr.region,
    };
    if (addr.street) postalAddress.streetAddress = addr.street;
    if (addr.postalCode) postalAddress.postalCode = addr.postalCode;
    if (addr.country) postalAddress.addressCountry = addr.country;
    schema.address = postalAddress;
  }

  // Service area
  if (biz.serviceArea && biz.serviceArea.length > 0) {
    schema.areaServed = biz.serviceArea.map(area => ({
      '@type': 'Place',
      name: area,
    }));
  }

  // sameAs (social profiles, etc)
  if (biz.sameAs && biz.sameAs.length > 0) {
    schema.sameAs = biz.sameAs;
  }

  return schema;
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
 * Inject LocalBusiness schema into target pages.
 *
 * @returns {{
 *   injected: boolean,
 *   pagesUpdated: string[],
 *   schema: object
 * }}
 */
export function injectLocalBusinessSchema() {
  const schema = buildLocalBusinessSchema();

  // Validate before injection (Chunk 22 gate)
  const validation = validateLocalBusiness(schema);
  if (!validation.ok) {
    const codes = validation.errors.map(e => e.code).join(', ');
    console.warn(`[schema] LocalBusiness validation failed (${codes}) — skipping injection`);
    return { injected: false, pagesUpdated: [], schema, validationErrors: validation.errors };
  }

  const jsonLd = JSON.stringify(schema, null, 2);

  const block = [
    `    ${SCHEMA_START}`,
    `    <script type="application/ld+json">`,
    jsonLd,
    `    </script>`,
    `    ${SCHEMA_END}`,
  ].join('\n');

  const pagesUpdated = [];

  for (const route of TARGET_PAGES) {
    const filePath = resolveFilePath(route);
    let html;
    try {
      html = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const original = html;
    const hasExisting = html.includes(SCHEMA_START) && html.includes(SCHEMA_END);

    if (hasExisting) {
      // Replace existing block
      const regex = new RegExp(
        '[ \\t]*' + SCHEMA_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[\\s\\S]*?' +
        '[ \\t]*' + SCHEMA_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      html = html.replace(regex, block);
    } else {
      // Insert before </head>
      const headIdx = html.indexOf('</head>');
      if (headIdx === -1) continue;
      html = html.slice(0, headIdx) + block + '\n' + html.slice(headIdx);
    }

    if (html !== original) {
      writeFileSync(filePath, html);
      pagesUpdated.push(route);
    }
  }

  return {
    injected: pagesUpdated.length > 0,
    pagesUpdated,
    schema,
  };
}

/**
 * Remove LocalBusiness schema blocks from all target pages.
 */
export function removeLocalBusinessSchema() {
  let filesChanged = 0;
  for (const route of TARGET_PAGES) {
    const filePath = resolveFilePath(route);
    let html;
    try {
      html = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    const original = html;
    if (html.includes(SCHEMA_START) && html.includes(SCHEMA_END)) {
      const regex = new RegExp(
        '\\n?[ \\t]*' + SCHEMA_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[\\s\\S]*?' +
        '[ \\t]*' + SCHEMA_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?'
      );
      html = html.replace(regex, '');
      if (html !== original) {
        writeFileSync(filePath, html);
        filesChanged++;
      }
    }
  }
  return { filesChanged };
}
