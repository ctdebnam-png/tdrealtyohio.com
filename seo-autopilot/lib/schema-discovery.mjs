/**
 * schema-discovery.mjs
 *
 * Discovers where JSON-LD schema is injected across the site.
 * Returns a map of schema types → pages and source files.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { listHtmlPages } from './list-html-pages.mjs';
import { detectBuildOutput } from './detect-build-output.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/**
 * Discover JSON-LD schema injection points across the built site.
 *
 * @param {object[]} [pages] - Pre-enumerated pages, or auto-discover
 * @param {object} [options]
 * @param {number} [options.maxPages=50] - Cap for performance
 * @returns {{
 *   localBusiness: { injectedOn: string[], sourceFile: string },
 *   faqPage: { injectedOn: string[], markerOrComponent: string },
 *   blogPosting: { injectedOn: string[], sourceFile: string },
 *   organization: { injectedOn: string[] },
 *   breadcrumbList: { injectedOn: string[] },
 *   webSite: { injectedOn: string[] },
 *   service: { injectedOn: string[] },
 *   other: { injectedOn: string[], types: string[] }
 * }}
 */
export function discoverSchema(pages, options = {}) {
  const maxPages = options.maxPages || 50;

  if (!pages || pages.length === 0) {
    try {
      const buildOutput = detectBuildOutput(ROOT);
      pages = listHtmlPages(buildOutput.root || ROOT);
    } catch {
      pages = [];
    }
  }

  const result = {
    localBusiness: {
      injectedOn: [],
      sourceFile: 'seo-autopilot/generators/localbusiness-schema.mjs',
    },
    faqPage: {
      injectedOn: [],
      markerOrComponent: 'inline <script type="application/ld+json"> or publish-post.mjs',
    },
    blogPosting: {
      injectedOn: [],
      sourceFile: 'seo-autopilot/generators/publish-post.mjs',
    },
    organization: { injectedOn: [] },
    breadcrumbList: { injectedOn: [] },
    webSite: { injectedOn: [] },
    service: { injectedOn: [] },
    other: { injectedOn: [], types: [] },
  };

  const sampled = pages.slice(0, maxPages);

  for (const page of sampled) {
    let html;
    try {
      html = readFileSync(page.filePath, 'utf-8');
    } catch {
      continue;
    }

    // Extract all JSON-LD blocks
    const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const nodes = flattenJsonLd(data);
        for (const node of nodes) {
          const type = normalizeType(node['@type']);
          if (type === 'localbusiness' || type === 'realestateagent') {
            result.localBusiness.injectedOn.push(page.routePath);
          } else if (type === 'faqpage') {
            result.faqPage.injectedOn.push(page.routePath);
          } else if (type === 'blogposting' || type === 'article') {
            result.blogPosting.injectedOn.push(page.routePath);
          } else if (type === 'organization') {
            result.organization.injectedOn.push(page.routePath);
          } else if (type === 'breadcrumblist') {
            result.breadcrumbList.injectedOn.push(page.routePath);
          } else if (type === 'website') {
            result.webSite.injectedOn.push(page.routePath);
          } else if (type === 'service') {
            result.service.injectedOn.push(page.routePath);
          } else if (type) {
            result.other.injectedOn.push(page.routePath);
            if (!result.other.types.includes(type)) {
              result.other.types.push(type);
            }
          }
        }
      } catch {
        // Invalid JSON — skip for discovery, will be caught by auditor
      }
    }
  }

  // Deduplicate arrays
  for (const key of Object.keys(result)) {
    if (result[key].injectedOn) {
      result[key].injectedOn = [...new Set(result[key].injectedOn)];
    }
  }

  return result;
}

/**
 * Flatten JSON-LD data into individual nodes.
 * Handles @graph arrays, plain arrays, and single objects.
 */
function flattenJsonLd(data) {
  if (Array.isArray(data)) return data;
  if (data && data['@graph']) return Array.isArray(data['@graph']) ? data['@graph'] : [data['@graph']];
  return [data];
}

/**
 * Normalize @type to lowercase string.
 */
function normalizeType(type) {
  if (!type) return '';
  if (Array.isArray(type)) type = type[0];
  return String(type).toLowerCase().replace(/^schema\.org\//, '');
}
