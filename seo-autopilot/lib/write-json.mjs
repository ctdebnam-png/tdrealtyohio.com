/**
 * write-json.mjs
 *
 * Deterministic JSON writer with stable key ordering.
 * Uses 2-space indentation and trailing newline.
 * Only writes if content actually changed.
 */

import { readFileSync } from 'fs';
import { writeFile } from 'fs/promises';

/**
 * Known top-level key orderings for specific schemas.
 * Keys not listed here retain their natural order.
 */
const KNOWN_ORDERINGS = {
  state: ['safety', 'gsc', 'live', 'quality', 'indexing', 'content', 'areas', 'liveGateForced'],
  scoreHistory: ['runs'],
  moduleOutcomes: ['tech', 'links', 'ctr', 'content'],
};

/**
 * Reorder top-level keys of an object according to a known schema.
 *
 * @param {object} obj - The object to reorder
 * @param {string[]} order - Ordered key names
 * @returns {object} - New object with keys in specified order
 */
function reorderKeys(obj, order) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

  const result = {};
  // Add ordered keys first
  for (const key of order) {
    if (key in obj) result[key] = obj[key];
  }
  // Add remaining keys in natural order
  for (const key of Object.keys(obj)) {
    if (!(key in result)) result[key] = obj[key];
  }
  return result;
}

/**
 * Serialize object to stable JSON string.
 *
 * @param {*} data - Data to serialize
 * @param {string} schema - Optional schema name for key ordering
 * @returns {string} - JSON string with 2-space indent and trailing newline
 */
export function stableStringify(data, schema = '') {
  let ordered = data;
  if (schema && KNOWN_ORDERINGS[schema]) {
    ordered = reorderKeys(data, KNOWN_ORDERINGS[schema]);
  }
  return JSON.stringify(ordered, null, 2) + '\n';
}

/**
 * Write JSON to file only if content changed.
 *
 * @param {string} filePath - Absolute path to write
 * @param {*} data - Data to serialize
 * @param {string} schema - Optional schema name for key ordering
 * @returns {Promise<boolean>} - true if file was written, false if unchanged
 */
export async function writeJsonStable(filePath, data, schema = '') {
  const newContent = stableStringify(data, schema);

  // Check if content is identical
  try {
    const existing = readFileSync(filePath, 'utf-8');
    if (existing === newContent) return false;
  } catch {
    // File doesn't exist yet — proceed to write
  }

  await writeFile(filePath, newContent);
  return true;
}
