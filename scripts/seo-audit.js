#!/usr/bin/env node

/**
 * SEO Audit Script
 * Checks HTML files for SEO best practices
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const HTML_FILES = [
  'index.html',
  'sellers.html',
  'buyers.html',
  'about.html',
  'contact.html',
  'pre-listing-inspection.html',
  'areas/index.html',
  'privacy.html',
  'terms.html',
  'fair-housing.html'
];

const issues = [];
const warnings = [];
const passes = [];

function checkFile(filepath) {
  const fullPath = path.join(ROOT_DIR, filepath);

  if (!fs.existsSync(fullPath)) {
    issues.push(`${filepath}: File not found`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const filename = path.basename(filepath);

  // Check for title tag
  const titleMatch = content.match(/<title>([^<]+)<\/title>/);
  if (!titleMatch) {
    issues.push(`${filepath}: Missing <title> tag`);
  } else if (titleMatch[1].length > 60) {
    warnings.push(`${filepath}: Title too long (${titleMatch[1].length} chars, recommend < 60)`);
  } else {
    passes.push(`${filepath}: Title tag OK (${titleMatch[1].length} chars)`);
  }

  // Check for meta description
  const descMatch = content.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  if (!descMatch) {
    issues.push(`${filepath}: Missing meta description`);
  } else if (descMatch[1].length > 160) {
    warnings.push(`${filepath}: Meta description too long (${descMatch[1].length} chars, recommend < 160)`);
  } else if (descMatch[1].length < 50) {
    warnings.push(`${filepath}: Meta description too short (${descMatch[1].length} chars, recommend > 50)`);
  } else {
    passes.push(`${filepath}: Meta description OK (${descMatch[1].length} chars)`);
  }

  // Check for H1
  const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (!h1Match) {
    issues.push(`${filepath}: Missing H1 tag`);
  } else {
    passes.push(`${filepath}: H1 tag present`);
  }

  // Check for multiple H1s
  const h1Count = (content.match(/<h1/g) || []).length;
  if (h1Count > 1) {
    warnings.push(`${filepath}: Multiple H1 tags (${h1Count}), recommend only 1`);
  }

  // Check for Open Graph tags
  const ogTitle = content.includes('og:title');
  const ogDesc = content.includes('og:description');
  const ogImage = content.includes('og:image');

  if (!ogTitle || !ogDesc) {
    warnings.push(`${filepath}: Missing Open Graph tags (og:title or og:description)`);
  } else {
    passes.push(`${filepath}: Open Graph tags present`);
  }

  // Check for canonical URL
  const canonical = content.includes('rel="canonical"');
  if (!canonical && filepath === 'index.html') {
    warnings.push(`${filepath}: Consider adding canonical URL`);
  }

  // Check for alt text on images
  const imgTags = content.match(/<img[^>]+>/g) || [];
  const imgWithoutAlt = imgTags.filter(img => !img.includes('alt='));
  if (imgWithoutAlt.length > 0) {
    issues.push(`${filepath}: ${imgWithoutAlt.length} images missing alt text`);
  } else if (imgTags.length > 0) {
    passes.push(`${filepath}: All images have alt text`);
  }

  // Check for structured data
  const hasStructuredData = content.includes('application/ld+json');
  if (filepath === 'index.html' && !hasStructuredData) {
    warnings.push(`${filepath}: Consider adding structured data (JSON-LD)`);
  } else if (hasStructuredData) {
    passes.push(`${filepath}: Structured data present`);
  }

  // Check for mobile viewport
  const hasViewport = content.includes('viewport');
  if (!hasViewport) {
    issues.push(`${filepath}: Missing viewport meta tag`);
  } else {
    passes.push(`${filepath}: Viewport meta tag present`);
  }

  // Check for HTTPS in links
  const httpLinks = content.match(/href="http:\/\//g) || [];
  if (httpLinks.length > 0) {
    warnings.push(`${filepath}: ${httpLinks.length} non-HTTPS links found`);
  }
}

console.log('=================================');
console.log('SEO Audit Report');
console.log('=================================\n');

HTML_FILES.forEach(checkFile);

console.log('ISSUES (must fix):');
if (issues.length === 0) {
  console.log('  None!\n');
} else {
  issues.forEach(i => console.log(`  - ${i}`));
  console.log();
}

console.log('WARNINGS (should fix):');
if (warnings.length === 0) {
  console.log('  None!\n');
} else {
  warnings.forEach(w => console.log(`  - ${w}`));
  console.log();
}

console.log('PASSED:');
passes.forEach(p => console.log(`  + ${p}`));

console.log('\n=================================');
console.log(`Summary: ${issues.length} issues, ${warnings.length} warnings, ${passes.length} passes`);
console.log('=================================');

// Just report, don't fail the workflow
console.log('\nSEO audit complete.');
