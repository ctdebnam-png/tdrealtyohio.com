/**
 * shingles.mjs
 *
 * Creates word n-gram shingles from text for near-duplicate detection.
 * Uses 5-grams by default.
 */

/**
 * Create a set of word n-gram shingles from text.
 *
 * @param {string} text - Cleaned text content
 * @param {number} n - Shingle size (default 5)
 * @returns {Set<string>}
 */
export function createShingles(text, n = 5) {
  if (!text) return new Set();

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < n) return new Set();

  const shingles = new Set();
  for (let i = 0; i <= words.length - n; i++) {
    shingles.add(words.slice(i, i + n).join(' '));
  }
  return shingles;
}

/**
 * Compute Jaccard similarity between two shingle sets.
 *
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number} Similarity between 0 and 1
 */
export function jaccardSimilarity(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size > b.size ? a : b;

  for (const s of smaller) {
    if (larger.has(s)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}
