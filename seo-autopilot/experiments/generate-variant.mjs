/**
 * generate-variant.mjs
 *
 * Generates deterministic title/meta description variants for experiments.
 * No LLM required — uses topQueries and template rules.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSeoDefaults() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'config', 'seo-defaults.json'), 'utf-8'));
  } catch {
    return { siteName: 'TD Realty Ohio', titleTemplate: '%s | TD Realty Ohio' };
  }
}

function loadGscConfig() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'config', 'gsc.json'), 'utf-8'));
  } catch {
    return { maxCtrForCtrWork: 0.015 };
  }
}

/**
 * Extract a usable intent phrase from top queries.
 * Filters out brand-only queries and short queries.
 */
function extractIntentPhrases(topQueries) {
  const brandTerms = ['td realty', 'td realty ohio', 'tdrealtyohio'];

  return (topQueries || [])
    .filter((q) => {
      const lower = q.query.toLowerCase().trim();
      // Skip brand-only queries
      if (brandTerms.some((b) => lower === b)) return false;
      // Skip very short queries
      if (lower.length < 4) return false;
      return true;
    })
    .map((q) => ({
      phrase: q.query.trim(),
      impressions: q.impressions,
    }));
}

/**
 * Build a title from an intent phrase + brand suffix.
 * Keeps within 20-70 chars.
 */
function buildTitle(intentPhrase, seoDefaults) {
  const brand = seoDefaults.siteName || 'TD Realty Ohio';
  const suffix = ` | ${brand}`;

  // Capitalize first letter of phrase
  let base = intentPhrase.charAt(0).toUpperCase() + intentPhrase.slice(1);

  // Remove brand from base if it appears
  base = base.replace(/\s*\|\s*TD Realty Ohio/gi, '').trim();

  let title = base + suffix;

  // Truncate if too long
  if (title.length > 70) {
    title = base.slice(0, 70 - suffix.length) + suffix;
  }

  // If too short, pad with the original phrase
  if (title.length < 20) {
    return null; // Can't build a valid title from this phrase
  }

  return title;
}

/**
 * Build a description from intent phrases + page context.
 * Keeps within 70-160 chars.
 */
function buildDescription(intentPhrases, existingDescription, path) {
  const location = 'Central Ohio';
  const phrases = intentPhrases.slice(0, 2).map((p) => p.phrase);

  let desc;
  if (phrases.length >= 2) {
    desc = `Learn about ${phrases[0]} and ${phrases[1]} in ${location}. TD Realty Ohio offers full-service real estate at reduced commission rates.`;
  } else if (phrases.length === 1) {
    desc = `Everything you need to know about ${phrases[0]} in ${location}. Full-service real estate with TD Realty Ohio.`;
  } else {
    return null; // Can't generate without intent phrases
  }

  // Trim to 160 chars
  if (desc.length > 160) {
    desc = desc.slice(0, 157) + '...';
  }

  // If too short, return null
  if (desc.length < 70) {
    return null;
  }

  return desc;
}

/**
 * Generate two candidate variants for a page.
 *
 * @param {object} options
 * @param {string} options.path
 * @param {string} options.existingTitle
 * @param {string} options.existingDescription
 * @param {Array} options.topQueries
 * @param {number} options.ctr28 - Current CTR for deterministic choice
 * @returns {{ chosen: {title, description}, variantA: {title, description}, variantB: {title, description} } | null}
 */
export function generateVariant({ path, existingTitle, existingDescription, topQueries, ctr28 }) {
  const seoDefaults = loadSeoDefaults();
  const gscConfig = loadGscConfig();

  const intentPhrases = extractIntentPhrases(topQueries);
  if (intentPhrases.length === 0) return null;

  // Variant A: first intent phrase
  const titleA = buildTitle(intentPhrases[0].phrase, seoDefaults);
  const descA = buildDescription(intentPhrases, existingDescription, path);

  // Variant B: second intent phrase (or different ordering)
  const phrasesB = intentPhrases.length > 1 ? [intentPhrases[1], intentPhrases[0]] : intentPhrases;
  const titleB = intentPhrases.length > 1
    ? buildTitle(intentPhrases[1].phrase, seoDefaults)
    : titleA;
  const descB = buildDescription(phrasesB, existingDescription, path);

  const variantA = {
    title: titleA || existingTitle,
    description: descA || existingDescription,
  };
  const variantB = {
    title: titleB || existingTitle,
    description: descB || existingDescription,
  };

  // Deterministic choice: very low CTR -> A (primary intent), else B
  const halfMaxCtr = (gscConfig.maxCtrForCtrWork || 0.015) / 2;
  const chosen = ctr28 <= halfMaxCtr ? variantA : variantB;

  // Don't return if chosen is same as existing
  if (chosen.title === existingTitle && chosen.description === existingDescription) {
    return null;
  }

  return { chosen, variantA, variantB };
}
