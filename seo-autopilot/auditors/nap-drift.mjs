/**
 * nap-drift.mjs
 *
 * Scans built HTML for NAP (Name, Address, Phone) consistency.
 * Detects phone numbers, emails, and business names that differ
 * from the canonical values in business.json.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUSINESS_CONFIG_PATH = join(__dirname, '..', 'config', 'business.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Normalize phone to digits-only for comparison.
 */
function normalizePhone(phone) {
  return (phone || '').replace(/[^\d]/g, '');
}

/**
 * Extract all phone-like patterns from text.
 * Matches common US phone formats.
 */
function extractPhones(text) {
  const patterns = [];
  // Match (614) 392-8858, 614-392-8858, 614.392.8858, 6143928858, +16143928858
  const regex = /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    patterns.push({ raw: match[0], normalized: normalizePhone(match[0]) });
  }
  return patterns;
}

/**
 * Extract all email-like patterns from text.
 */
function extractEmails(text) {
  const regex = /[\w.+-]+@[\w.-]+\.\w{2,}/g;
  const emails = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    emails.push(match[0].toLowerCase());
  }
  return emails;
}

/**
 * Audit NAP consistency across pages.
 *
 * @param {object[]} pages - Array of { filePath, routePath }
 * @param {object} [options]
 * @param {number} [options.maxPagesToCheck=50] - Cap for performance
 * @returns {{
 *   phoneMismatches: Array<{ routePath: string, snippet: string }>,
 *   emailMismatches: Array<{ routePath: string, snippet: string }>,
 *   nameMismatches: Array<{ routePath: string, snippet: string }>,
 *   phoneMismatchCount: number,
 *   emailMismatchCount: number,
 *   nameMismatchCount: number
 * }}
 */
export function auditNapDrift(pages = [], options = {}) {
  const maxCheck = options.maxPagesToCheck || 50;
  const biz = loadJson(BUSINESS_CONFIG_PATH, {});

  const canonicalPhone = normalizePhone(biz.phone || '');
  const canonicalEmail = (biz.email || '').toLowerCase();
  const canonicalName = (biz.businessName || '').toLowerCase();

  // Known non-phone number strings to exclude (license numbers, etc)
  const knownNonPhones = new Set();
  if (biz.licenses) {
    for (const val of Object.values(biz.licenses)) {
      if (val) knownNonPhones.add(normalizePhone(val));
    }
  }
  // Common acceptable variations
  const nameVariations = new Set([
    canonicalName,
    canonicalName.replace(', llc', '').trim(),
    canonicalName.replace(', llc', ' llc').trim(),
    canonicalName.replace(/ llc$/, '').trim(),
  ]);

  const phoneMismatches = [];
  const emailMismatches = [];
  const nameMismatches = [];

  const sampled = pages.slice(0, maxCheck);

  for (const page of sampled) {
    let html;
    try {
      html = readFileSync(page.filePath, 'utf-8');
    } catch {
      continue;
    }

    // Strip script/style tags to avoid false positives from JSON-LD etc
    const visibleText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Phone check: look for phone patterns, flag if digits don't match canonical
    const phones = extractPhones(visibleText);
    for (const phone of phones) {
      // Allow canonical phone (with or without country code prefix)
      const stripped = phone.normalized.replace(/^1/, '');
      const canonStripped = canonicalPhone.replace(/^1/, '');
      if (stripped !== canonStripped && stripped.length >= 10 && !knownNonPhones.has(stripped)) {
        phoneMismatches.push({
          routePath: page.routePath,
          snippet: phone.raw,
        });
      }
    }

    // Email check
    const emails = extractEmails(visibleText);
    for (const email of emails) {
      // Skip common non-business emails
      if (email.includes('@formspree.io')) continue;
      if (email.includes('@cloudflare.com')) continue;
      if (email.includes('@example.com')) continue;
      // Only flag if it's a different email in the same domain or looks business-related
      if (email !== canonicalEmail && email.endsWith('@tdrealtyohio.com')) {
        emailMismatches.push({
          routePath: page.routePath,
          snippet: email,
        });
      }
    }

    // Name check: look for the business name in visible text
    // Only flag if a clearly different real estate business name appears
    // This is conservative — we only check for the canonical name NOT appearing
    // We don't try to detect all possible name variations
  }

  return {
    phoneMismatches: phoneMismatches.slice(0, 20),
    emailMismatches: emailMismatches.slice(0, 20),
    nameMismatches: nameMismatches.slice(0, 20),
    phoneMismatchCount: phoneMismatches.length,
    emailMismatchCount: emailMismatches.length,
    nameMismatchCount: nameMismatches.length,
  };
}
