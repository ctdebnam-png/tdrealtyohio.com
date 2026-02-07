#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const ALLOWLIST_PATH = path.join(__dirname, 'content-scan-allowlist.json');

const SKIP_DIRS = new Set([
  'node_modules',
  'admin',
  'audit',
  'output',
  'scripts',
  'templates',
  'tools',
  'reports',
  'data',
  'lp',
]);

// ---------------------------------------------------------------------------
// Banned patterns
// ---------------------------------------------------------------------------

const BANNED = [];

// --- First-person voice ---------------------------------------------------

// "I" followed by specific verbs
const I_VERBS = [
  ' am ',
  ' will ',
  ' have ',
  ' recommend',
  ' always ',
  ' respond',
  ' hear ',
  ' want ',
];
for (const verb of I_VERBS) {
  BANNED.push({
    label: 'First-person: I' + verb.trimEnd(),
    regex: new RegExp('\\bI' + verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
    raw: 'I' + verb.trimEnd(),
  });
}

// Contractions
for (const contraction of ["I'm", "I'll", "I've"]) {
  // Match both straight apostrophe (') and curly apostrophe (')
  const escaped = contraction.replace(/['']/g, "[''']");
  BANNED.push({
    label: 'First-person: ' + contraction,
    regex: new RegExp('\\b' + escaped + '\\b', 'gi'),
    raw: contraction,
  });
}

// Possessives
BANNED.push({
  label: 'First-person: my client(s)',
  regex: /\bmy clients?\b/gi,
  raw: 'my client(s)',
});
BANNED.push({
  label: 'First-person: my brokerage',
  regex: /\bmy brokerage\b/gi,
  raw: 'my brokerage',
});
BANNED.push({
  label: 'First-person: my team',
  regex: /\bmy team\b/gi,
  raw: 'my team',
});

// Calls to action with "me"
BANNED.push({
  label: 'First-person: contact me',
  regex: /\bcontact me\b/gi,
  raw: 'contact me',
});
BANNED.push({
  label: 'First-person: work with me',
  regex: /\bwork with me\b/gi,
  raw: 'work with me',
});

// --- Vague / guarantee language -------------------------------------------

BANNED.push({
  label: 'Vague: save thousands',
  regex: /save thousands/gi,
  raw: 'save thousands',
});
BANNED.push({
  label: 'Vague: get started today',
  regex: /get started today/gi,
  raw: 'get started today',
});
BANNED.push({
  label: 'Guarantee language: guaranteed',
  regex: /\bguaranteed\b/gi,
  raw: 'guaranteed',
});
BANNED.push({
  label: 'Vague: studies consistently show',
  regex: /studies consistently show/gi,
  raw: 'studies consistently show',
});
BANNED.push({
  label: 'Vague: exposed to more buyers',
  regex: /exposed to more buyers/gi,
  raw: 'exposed to more buyers',
});

// --- Hard-coded personal info / style issues ------------------------------

BANNED.push({
  label: 'Personal email leak',
  regex: /travisdrealtor@gmail\.com/gi,
  raw: 'travisdrealtor@gmail.com',
});

// Phone number and common variants (with dots, dashes, spaces, parens)
BANNED.push({
  label: 'Personal phone leak',
  regex: /6[\s.(-]*1[\s.)-]*4[\s.(-]*9[\s.)-]*5[\s.(-]*6[\s.)-]*8[\s.(-]*6[\s.)-]*5[\s.)-]*6/g,
  raw: '614-956-8656',
});

BANNED.push({
  label: 'Link text: Testimonials',
  regex: /Testimonials/g,
  raw: 'Testimonials',
});

BANNED.push({
  label: 'Byline: By Travis Debnam',
  regex: /By Travis Debnam/gi,
  raw: 'By Travis Debnam',
});

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

let allowlist = [];

if (fs.existsSync(ALLOWLIST_PATH)) {
  try {
    const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
    if (Array.isArray(raw.allowlist)) {
      allowlist = raw.allowlist.map((entry) => ({
        file: entry.file,
        pattern: new RegExp(entry.pattern, 'i'),
      }));
    }
  } catch (err) {
    console.error('Warning: could not parse allowlist –', err.message);
  }
}

/**
 * Return true if this specific match is covered by the allowlist.
 * @param {string} relFile  – path relative to ROOT (forward slashes)
 * @param {string} matchStr – the literal text that matched
 * @param {RegExp} regex    – the banned regex that fired
 */
function isAllowed(relFile, matchStr, regex) {
  for (const entry of allowlist) {
    if (relFile !== entry.file && !relFile.endsWith('/' + entry.file)) {
      continue;
    }
    if (entry.pattern.test(matchStr)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// HTML → visible text
// ---------------------------------------------------------------------------

/**
 * Strip non-visible content from HTML and return plain text.
 */
function extractVisibleText(html) {
  // Remove <script>…</script>, <style>…</style>, <head>…</head> blocks
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<head[\s\S]*?<\/head>/gi, ' ');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…');

  // Strip any remaining numeric/hex entities
  text = text.replace(/&#?\w+;/g, ' ');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// ---------------------------------------------------------------------------
// Also scan raw HTML for link-text patterns (e.g. "Testimonials" as <a> text)
// ---------------------------------------------------------------------------

/**
 * Extract all <a>…</a> inner text fragments from raw HTML.
 */
function extractLinkTexts(html) {
  const results = [];
  const re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Strip inner tags and collapse whitespace
    const inner = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (inner) results.push(inner);
  }
  return results;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/**
 * Recursively collect *.html files under `dir`, honouring SKIP_DIRS.
 */
function collectHtmlFiles(dir) {
  const results = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return results;
  }

  for (const entry of entries) {
    const name = entry.name;

    // Skip hidden directories/files
    if (name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      results.push(...collectHtmlFiles(path.join(dir, name)));
    } else if (entry.isFile() && name.endsWith('.html')) {
      results.push(path.join(dir, name));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function contextSnippet(text, index, matchLength) {
  const PAD = 30;
  const start = Math.max(0, index - PAD);
  const end = Math.min(text.length, index + matchLength + PAD);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

function run() {
  const files = collectHtmlFiles(ROOT);
  const violations = [];

  for (const filePath of files) {
    const relFile = path.relative(ROOT, filePath).replace(/\\/g, '/');
    let html;
    try {
      html = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      continue;
    }

    const visibleText = extractVisibleText(html);
    const linkTexts = extractLinkTexts(html);

    for (const rule of BANNED) {
      // Special handling: "Testimonials" should only fire as link text
      if (rule.raw === 'Testimonials') {
        for (const lt of linkTexts) {
          if (/Testimonials/g.test(lt)) {
            if (!isAllowed(relFile, lt, rule.regex)) {
              violations.push({
                file: relFile,
                label: rule.label,
                snippet: '<a>…' + lt + '…</a>',
              });
            }
          }
        }
        continue;
      }

      // Reset lastIndex for global regexes
      rule.regex.lastIndex = 0;

      let match;
      while ((match = rule.regex.exec(visibleText)) !== null) {
        const matchedText = match[0];

        if (isAllowed(relFile, matchedText, rule.regex)) {
          continue;
        }

        const snippet = contextSnippet(visibleText, match.index, matchedText.length);
        violations.push({
          file: relFile,
          label: rule.label,
          snippet: snippet,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Report
  // -----------------------------------------------------------------------

  if (violations.length === 0) {
    console.log('content-scan: OK – no banned patterns found across ' + files.length + ' HTML files.');
    process.exit(0);
  }

  console.error('content-scan: FAIL – ' + violations.length + ' violation(s) found:\n');

  for (const v of violations) {
    console.error('  ' + v.file);
    console.error('    [' + v.label + ']');
    console.error('    "' + v.snippet + '"');
    console.error('');
  }

  process.exit(1);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

run();
