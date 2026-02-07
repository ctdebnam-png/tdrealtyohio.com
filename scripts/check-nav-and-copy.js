#!/usr/bin/env node
/**
 * Navigation & Copy Consistency Check
 * Fails CI if:
 * 1. "Testimonials" appears anywhere in nav/footer
 * 2. First-person tokens remain in user-facing text
 * 3. Header and footer link sets differ
 */

const { readdir, readFile } = require('fs').promises;
const { join } = require('path');

const ROOT = join(__dirname, '..');
const errors = [];

/**
 * Recursively find all HTML files
 */
async function findHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'templates' ||
          entry.name === 'tools' ||
          entry.name === 'reports' ||
          entry.name === 'audit' ||
          entry.name === 'data' ||
          entry.name.startsWith('audit-')) {
        continue;
      }
      await findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html') && entry.name !== '404.html') {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extract visible text from HTML (excluding scripts, styles, schema)
 */
function extractVisibleText(html) {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, ' ')
             .replace(/\u2019/g, "'");
  return text;
}

/**
 * Extract hrefs from nav#main-nav (excluding CTA button duplicates)
 */
function extractNavHrefs(html) {
  const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
  if (!navMatch) return null;
  const hrefs = new Set();
  const hrefRegex = /href="([^"]+)"/g;
  let m;
  while ((m = hrefRegex.exec(navMatch[1])) !== null) {
    hrefs.add(m[1]);
  }
  return hrefs;
}

/**
 * Extract hrefs from footer .footer-links sections
 */
function extractFooterHrefs(html) {
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/);
  if (!footerMatch) return null;
  const hrefs = new Set();
  // Get links from footer-links ul elements (Services + Company)
  const listRegex = /<ul class="footer-links">([\s\S]*?)<\/ul>/g;
  let listMatch;
  while ((listMatch = listRegex.exec(footerMatch[1])) !== null) {
    const hrefRegex = /href="([^"]+)"/g;
    let m;
    while ((m = hrefRegex.exec(listMatch[1])) !== null) {
      hrefs.add(m[1]);
    }
  }
  return hrefs;
}

/**
 * Check 1: No "Testimonials" in nav or footer
 */
function checkNoTestimonials(html, relativePath) {
  const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/);

  if (navMatch && /testimonials/i.test(navMatch[1])) {
    errors.push(`${relativePath}: "Testimonials" found in header nav`);
  }
  if (footerMatch && /testimonials/i.test(footerMatch[1])) {
    errors.push(`${relativePath}: "Testimonials" found in footer`);
  }
}

/**
 * Check 2: No first-person tokens in user-facing text
 * We check for specific first-person patterns that indicate author voice,
 * but allow "I" in user-facing form options, FAQ questions, and blog post
 * titles/headings where the user is the speaker.
 */
const FIRST_PERSON_PATTERNS = [
  { pattern: /\bI respond\b/gi, desc: '"I respond"' },
  { pattern: /\bI want to be fair\b/gi, desc: '"I want to be fair"' },
  { pattern: /\bI hear these questions\b/gi, desc: '"I hear these questions"' },
  { pattern: /\bLet me (break down|explain|show)\b/gi, desc: '"Let me..."' },
  { pattern: /\bI recommend to my\b/gi, desc: '"I recommend to my"' },
  { pattern: /\bI always tell\b/gi, desc: '"I always tell"' },
  { pattern: /\bContact me\b/gi, desc: '"Contact me"' },
  { pattern: /\bI will call\b/gi, desc: '"I will call"' },
  { pattern: /\bI'll call\b/gi, desc: '"I\'ll call"' },
  { pattern: /\bwork with me personally\b/gi, desc: '"work with me personally"' },
  { pattern: /\bIn this article, I\b/gi, desc: '"In this article, I"' },
  { pattern: /\bmy clients?\b/gi, desc: '"my client(s)"' },
  { pattern: /\bmy brokerage\b/gi, desc: '"my brokerage"' },
  { pattern: /\bmy team\b/gi, desc: '"my team"' },
];

function checkFirstPerson(html, relativePath) {
  const visibleText = extractVisibleText(html);

  for (const { pattern, desc } of FIRST_PERSON_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = visibleText.match(pattern);
    if (matches) {
      for (const match of matches) {
        errors.push(`${relativePath}: First-person token ${desc} found: "${match}"`);
      }
    }
  }
}

/**
 * Check 3: Header and footer link sets match
 * The nav should contain all the same destinations as the footer.
 * Footer links are JS-rendered from TD_NAV, so if the footer containers
 * are empty in source HTML we skip this check (nav-registry checks
 * already validate both header and footer against NAV_REGISTRY).
 */
function checkHeaderFooterMatch(html, relativePath) {
  const navHrefs = extractNavHrefs(html);
  const footerHrefs = extractFooterHrefs(html);

  if (!navHrefs || !footerHrefs) return;
  // Footer links are JS-rendered; if empty in source, skip comparison
  if (footerHrefs.size === 0) return;

  // Footer links that should all be in the nav
  for (const href of footerHrefs) {
    if (!navHrefs.has(href)) {
      errors.push(`${relativePath}: Footer link ${href} not found in header nav`);
    }
  }

  // Nav links that should all be in the footer (except /contact/ CTA)
  for (const href of navHrefs) {
    if (href === '/contact/') continue; // CTA is separate
    if (!footerHrefs.has(href)) {
      errors.push(`${relativePath}: Header nav link ${href} not found in footer`);
    }
  }
}

/**
 * Also check nav data files for "Testimonials"
 */
async function checkNavDataFiles() {
  const navFiles = [
    join(ROOT, 'src/config/nav.js'),
    join(ROOT, 'src/config/nav.ts'),
    join(ROOT, 'assets/js/nav.js'),
  ];

  for (const filePath of navFiles) {
    try {
      const content = await readFile(filePath, 'utf-8');
      if (/testimonials/i.test(content)) {
        const relativePath = filePath.replace(ROOT + '/', '');
        errors.push(`${relativePath}: "Testimonials" found in nav data file`);
      }
    } catch {
      // File may not exist
    }
  }
}

async function main() {
  console.log('\n=== Navigation & Copy Consistency Check ===\n');

  const htmlFiles = await findHtmlFiles(ROOT);
  console.log(`Scanning ${htmlFiles.length} HTML files...\n`);

  // Check nav data files first
  await checkNavDataFiles();

  // Use index.html as the reference page for header/footer matching
  const indexPath = join(ROOT, 'index.html');
  const indexContent = await readFile(indexPath, 'utf-8');

  // Check every HTML file
  for (const filePath of htmlFiles) {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = filePath.replace(ROOT + '/', '');

    checkNoTestimonials(content, relativePath);
    checkFirstPerson(content, relativePath);
  }

  // Check header/footer match on the index page (representative)
  checkHeaderFooterMatch(indexContent, 'index.html');

  console.log('=== Results ===\n');

  if (errors.length > 0) {
    const testimonialErrors = errors.filter(e => e.includes('Testimonials'));
    const firstPersonErrors = errors.filter(e => e.includes('First-person'));
    const matchErrors = errors.filter(e => e.includes('not found in'));

    if (testimonialErrors.length > 0) {
      console.log(`Testimonials issues (${testimonialErrors.length}):`);
      for (const e of testimonialErrors) console.log(`  - ${e}`);
      console.log('');
    }

    if (firstPersonErrors.length > 0) {
      console.log(`First-person issues (${firstPersonErrors.length}):`);
      for (const e of firstPersonErrors) console.log(`  - ${e}`);
      console.log('');
    }

    if (matchErrors.length > 0) {
      console.log(`Header/footer mismatch issues (${matchErrors.length}):`);
      for (const e of matchErrors) console.log(`  - ${e}`);
      console.log('');
    }

    console.log(`Failed with ${errors.length} issue(s)\n`);
    process.exit(1);
  }

  console.log('All navigation & copy consistency checks passed!\n');
}

main().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
