/**
 * Content Voice Check
 * Validates that site content uses third-person/company voice
 * Fails if first-person tokens appear in editorial content
 */

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
      violations: 0
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
  }

  return result;
}

module.exports = checkContentVoice;
