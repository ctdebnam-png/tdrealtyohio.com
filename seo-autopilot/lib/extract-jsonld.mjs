/**
 * extract-jsonld.mjs
 *
 * Parse HTML and extract all JSON-LD blocks, returning flattened
 * schema nodes. Never throws — invalid JSON produces an issue object.
 */

/**
 * Extract all JSON-LD nodes from an HTML string.
 *
 * @param {string} html - Raw HTML content
 * @returns {{
 *   nodes: Array<{ type: string, data: object }>,
 *   issues: Array<{ code: string, message: string, snippet: string }>
 * }}
 */
export function extractJsonLd(html) {
  const nodes = [];
  const issues = [];

  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;

    try {
      const data = JSON.parse(raw);
      const flattened = flattenJsonLd(data);
      for (const node of flattened) {
        const type = normalizeType(node['@type']);
        nodes.push({ type, data: node });
      }
    } catch (err) {
      issues.push({
        code: 'SCHEMA_INVALID_JSON',
        message: `Invalid JSON in ld+json block: ${err.message}`,
        snippet: raw.slice(0, 120),
      });
    }
  }

  return { nodes, issues };
}

/**
 * Flatten JSON-LD data into individual nodes.
 * Handles @graph arrays, plain arrays, and single objects.
 */
function flattenJsonLd(data) {
  if (Array.isArray(data)) return data;
  if (data && data['@graph']) {
    return Array.isArray(data['@graph']) ? data['@graph'] : [data['@graph']];
  }
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
