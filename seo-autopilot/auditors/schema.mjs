/**
 * schema.mjs
 *
 * Structured data auditor. Extracts JSON-LD from built pages,
 * validates with offline validators, and checks content consistency.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractJsonLd } from '../lib/extract-jsonld.mjs';
import { validateLocalBusiness } from '../schema/validators/localbusiness.mjs';
import { validateFaqPage } from '../schema/validators/faqpage.mjs';
import { validateBlogPosting } from '../schema/validators/blogposting.mjs';
import { checkSchemaConsistency } from '../schema/consistency.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOCALBUSINESS_TYPES = ['localbusiness', 'realestateagent'];
const ARTICLE_TYPES = ['blogposting', 'article'];

/**
 * Audit structured data across built pages.
 *
 * @param {object[]} pages - Array of { filePath, routePath }
 * @param {object} [options]
 * @param {number} [options.maxPagesToCheck=100]
 * @returns {{
 *   checkedAt: string,
 *   pagesChecked: number,
 *   issueCounts: object,
 *   samples: { invalidJson: object[], invalidSchema: object[], mismatches: object[] },
 *   keyPages: object
 * }}
 */
export function auditSchema(pages = [], options = {}) {
  const maxCheck = options.maxPagesToCheck || 100;
  const keyRoutes = ['/', '/contact/'];

  const issueCounts = {
    SCHEMA_INVALID_JSON: 0,
    SCHEMA_INVALID_LOCALBUSINESS: 0,
    SCHEMA_INVALID_FAQPAGE: 0,
    SCHEMA_INVALID_BLOGPOSTING: 0,
    SCHEMA_CONTENT_MISMATCH: 0,
  };

  const samples = {
    invalidJson: [],
    invalidSchema: [],
    mismatches: [],
  };

  const keyPages = {};
  for (const route of keyRoutes) {
    keyPages[route] = { ok: true, issues: [] };
  }

  const sampled = pages.slice(0, maxCheck);

  for (const page of sampled) {
    let html;
    try {
      html = readFileSync(page.filePath, 'utf-8');
    } catch {
      continue;
    }

    const { nodes, issues: jsonIssues } = extractJsonLd(html);
    const pageIssues = [];

    // Invalid JSON
    for (const issue of jsonIssues) {
      issueCounts.SCHEMA_INVALID_JSON++;
      pageIssues.push({ code: 'SCHEMA_INVALID_JSON', detail: issue.message });
      if (samples.invalidJson.length < 10) {
        samples.invalidJson.push({ routePath: page.routePath, snippet: issue.snippet });
      }
    }

    // Validate each node
    for (const node of nodes) {
      const type = node.type;

      if (LOCALBUSINESS_TYPES.includes(type)) {
        const result = validateLocalBusiness(node.data);
        if (!result.ok) {
          issueCounts.SCHEMA_INVALID_LOCALBUSINESS++;
          const codes = result.errors.map(e => e.code);
          pageIssues.push({ code: 'SCHEMA_INVALID_LOCALBUSINESS', codes });
          if (samples.invalidSchema.length < 10) {
            samples.invalidSchema.push({ routePath: page.routePath, type: 'LocalBusiness', codes });
          }
        }
      }

      if (type === 'faqpage') {
        const result = validateFaqPage(node.data);
        if (!result.ok) {
          issueCounts.SCHEMA_INVALID_FAQPAGE++;
          const codes = result.errors.map(e => e.code);
          pageIssues.push({ code: 'SCHEMA_INVALID_FAQPAGE', codes });
          if (samples.invalidSchema.length < 10) {
            samples.invalidSchema.push({ routePath: page.routePath, type: 'FAQPage', codes });
          }
        }
      }

      if (ARTICLE_TYPES.includes(type)) {
        const result = validateBlogPosting(node.data);
        if (!result.ok) {
          issueCounts.SCHEMA_INVALID_BLOGPOSTING++;
          const codes = result.errors.map(e => e.code);
          pageIssues.push({ code: 'SCHEMA_INVALID_BLOGPOSTING', codes });
          if (samples.invalidSchema.length < 10) {
            samples.invalidSchema.push({ routePath: page.routePath, type: 'BlogPosting', codes });
          }
        }
      }
    }

    // Content consistency checks
    const mismatches = checkSchemaConsistency(nodes, html, page.routePath);
    for (const m of mismatches) {
      issueCounts.SCHEMA_CONTENT_MISMATCH++;
      pageIssues.push({ code: 'SCHEMA_CONTENT_MISMATCH', detail: m.detail });
      if (samples.mismatches.length < 10) {
        samples.mismatches.push({ routePath: page.routePath, type: m.type, detail: m.detail });
      }
    }

    // Track key pages
    if (keyPages[page.routePath]) {
      keyPages[page.routePath].ok = pageIssues.length === 0;
      keyPages[page.routePath].issues = pageIssues;
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    pagesChecked: sampled.length,
    issueCounts,
    samples,
    keyPages,
  };
}
