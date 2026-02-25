/**
 * Content Voice Check
 * Validates that site content uses third-person/company voice
 * Fails if first-person tokens appear in editorial content
 */

const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile } = require('./utils');

// First-person patterns to flag (word boundaries required)
// Note: FAQ questions use first-person from user perspective and are OK
const FIRST_PERSON_PATTERNS = [
  /\bI'll\b/g,
  /\bI'm\b/g,
  /\bI've\b/g,
  /\bI'd\b/g,
  /\bI am\b/gi,
  /\bI will\b/gi,
  /\bI have\b/gi,
  /\bI would\b/gi,
  /\bI can\b/gi,
  /\bI'll\b/gi,
  // "I" at start of sentence in content (not FAQ)
  /(?<![?"])\s+I\s+(?:respond|coordinate|help|provide|see|live|start|saw|kept)/gi
];

// Patterns that are OK (user-facing FAQs, form labels, quotes)
const ALLOWED_CONTEXTS = [
  /<button[^>]*class="faq-question"[^>]*>.*?<\/button>/gis,  // FAQ question buttons
  /(?:name|"name"|'name')\s*:\s*"[^"]*"/g,  // Schema.org FAQ names
  /<option[^>]*>.*?<\/option>/gis,  // Select options (user perspective)
  /placeholder="[^"]*"/gi,  // Form placeholders
  /<label[^>]*>.*?<\/label>/gis,  // Form labels (some use "I agree")
  /I agree to be contacted/gi  // Consent checkbox text
];

// Banned phrases - terms that must never appear in rendered content
// "reviews" excludes legitimate real estate contexts like "offer review"
const BANNED_PHRASES = [
  { pattern: /\btestimonials?\b/gi, label: 'testimonial(s)' },
  { pattern: /\breviews\b/gi, label: 'reviews', exclude: /\boffer\s+reviews?\b|\breview\s+and\s+counteroffer\b/gi },
  { pattern: /zillowRating/g, label: 'zillowRating' },
  { pattern: /\bstar\s+rating\b/gi, label: 'star rating' },
  { pattern: /\u2605{5}/g, label: '\u2605\u2605\u2605\u2605\u2605 (five stars)' }
];

// First-person tokens banned inside CTA elements (buttons and .btn links)
const CTA_FIRST_PERSON = /\b(I|I'm|I've|I'll|my|me)\b/gi;

// Files to skip
const SKIP_FILES = [
  /node_modules\//,
  /tools\//,
  /functions\//
];

function stripAllowedContexts(html) {
  let cleaned = html;
  for (const pattern of ALLOWED_CONTEXTS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
}

async function checkContentVoice(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      violations: 0,
      bannedPhrases: 0,
      ctaViolations: 0
    }
  };

  const files = await getHtmlFiles(config);

  for (const file of files) {
    // Skip excluded files
    if (SKIP_FILES.some(pattern => pattern.test(file.relative))) {
      continue;
    }

    result.stats.filesChecked++;
    const html = readHtmlFile(file.absolute);

    // Strip allowed contexts before checking
    const contentToCheck = stripAllowedContexts(html);

    const violations = [];

    for (const pattern of FIRST_PERSON_PATTERNS) {
      const matches = contentToCheck.match(pattern);
      if (matches && matches.length > 0) {
        violations.push(...matches);
      }
    }

    if (violations.length > 0) {
      // Deduplicate
      const unique = [...new Set(violations)];
      result.errors.push({
        file: file.relative,
        message: `Found first-person language: ${unique.slice(0, 5).join(', ')}${unique.length > 5 ? '...' : ''}`
      });
      result.stats.violations += violations.length;
      result.passed = false;
    }

    // --- Banned phrase enforcement ---
    const $ = cheerio.load(html);
    const bodyText = $('body').text();

    for (const { pattern, label, exclude } of BANNED_PHRASES) {
      // Reset regex state
      pattern.lastIndex = 0;
      const matches = bodyText.match(pattern);
      if (matches && matches.length > 0) {
        if (exclude) {
          // Remove legitimate uses before counting
          exclude.lastIndex = 0;
          const cleaned = bodyText.replace(exclude, '');
          pattern.lastIndex = 0;
          const remaining = cleaned.match(pattern);
          if (remaining && remaining.length > 0) {
            result.errors.push({
              file: file.relative,
              message: `Banned phrase found: "${label}" (${remaining.length} occurrence${remaining.length > 1 ? 's' : ''})`
            });
            result.stats.bannedPhrases += remaining.length;
            result.passed = false;
          }
        } else {
          result.errors.push({
            file: file.relative,
            message: `Banned phrase found: "${label}" (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`
          });
          result.stats.bannedPhrases += matches.length;
          result.passed = false;
        }
      }
    }

    // --- First-person in CTA labels ---
    const ctaViolations = [];

    $('button, a[class*="btn"]').each((i, el) => {
      const $el = $(el);

      // Skip FAQ question buttons and form consent elements
      if ($el.hasClass('faq-question') || $el.closest('.faq-question').length > 0) return;
      if ($el.closest('label').length > 0) return;

      const text = $el.text().trim();
      if (!text) return;

      CTA_FIRST_PERSON.lastIndex = 0;
      const matches = text.match(CTA_FIRST_PERSON);
      if (matches && matches.length > 0) {
        ctaViolations.push(`"${text.substring(0, 40)}" contains: ${[...new Set(matches)].join(', ')}`);
      }
    });

    if (ctaViolations.length > 0) {
      result.errors.push({
        file: file.relative,
        message: `First-person language in CTA: ${ctaViolations.slice(0, 3).join('; ')}${ctaViolations.length > 3 ? '...' : ''}`
      });
      result.stats.ctaViolations += ctaViolations.length;
      result.passed = false;
    }
  }

  return result;
}

module.exports = checkContentVoice;
