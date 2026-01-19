#!/usr/bin/env node

/**
 * SEO Report Generator
 * Creates a JSON report of SEO metrics for tracking over time
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
  'areas/index.html'
];

function analyzeFile(filepath) {
  const fullPath = path.join(ROOT_DIR, filepath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const stats = fs.statSync(fullPath);

  // Extract metrics
  const titleMatch = content.match(/<title>([^<]+)<\/title>/);
  const descMatch = content.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const h2Count = (content.match(/<h2/g) || []).length;
  const imgCount = (content.match(/<img/g) || []).length;
  const imgWithAlt = (content.match(/<img[^>]+alt="[^"]+"/g) || []).length;
  const internalLinks = (content.match(/href="\/[^"]+"/g) || []).length;
  const externalLinks = (content.match(/href="https?:\/\/[^"]+"/g) || []).length;
  const wordCount = content.replace(/<[^>]+>/g, '').split(/\s+/).length;

  return {
    file: filepath,
    lastModified: stats.mtime.toISOString(),
    title: titleMatch ? titleMatch[1] : null,
    titleLength: titleMatch ? titleMatch[1].length : 0,
    description: descMatch ? descMatch[1] : null,
    descriptionLength: descMatch ? descMatch[1].length : 0,
    h1: h1Match ? h1Match[1] : null,
    h2Count,
    imageCount: imgCount,
    imagesWithAlt: imgWithAlt,
    internalLinks,
    externalLinks,
    wordCount,
    hasStructuredData: content.includes('application/ld+json'),
    hasOpenGraph: content.includes('og:title'),
    hasTwitterCard: content.includes('twitter:card'),
    hasCanonical: content.includes('rel="canonical"'),
    fileSize: stats.size
  };
}

console.log('Generating SEO Report...\n');

const report = {
  generated: new Date().toISOString(),
  site: 'tdrealtyohio.com',
  pages: [],
  summary: {
    totalPages: 0,
    pagesWithTitle: 0,
    pagesWithDescription: 0,
    pagesWithH1: 0,
    pagesWithStructuredData: 0,
    pagesWithOpenGraph: 0,
    totalImages: 0,
    imagesWithAlt: 0,
    totalWordCount: 0
  }
};

for (const file of HTML_FILES) {
  const analysis = analyzeFile(file);

  if (analysis) {
    report.pages.push(analysis);
    report.summary.totalPages++;

    if (analysis.title) report.summary.pagesWithTitle++;
    if (analysis.description) report.summary.pagesWithDescription++;
    if (analysis.h1) report.summary.pagesWithH1++;
    if (analysis.hasStructuredData) report.summary.pagesWithStructuredData++;
    if (analysis.hasOpenGraph) report.summary.pagesWithOpenGraph++;

    report.summary.totalImages += analysis.imageCount;
    report.summary.imagesWithAlt += analysis.imagesWithAlt;
    report.summary.totalWordCount += analysis.wordCount;
  }
}

// Calculate scores
report.summary.titleScore = Math.round((report.summary.pagesWithTitle / report.summary.totalPages) * 100);
report.summary.descriptionScore = Math.round((report.summary.pagesWithDescription / report.summary.totalPages) * 100);
report.summary.imageAltScore = report.summary.totalImages > 0
  ? Math.round((report.summary.imagesWithAlt / report.summary.totalImages) * 100)
  : 100;
report.summary.overallScore = Math.round(
  (report.summary.titleScore + report.summary.descriptionScore + report.summary.imageAltScore) / 3
);

// Save report
const reportPath = path.join(ROOT_DIR, 'seo-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('SEO Report Summary');
console.log('==================');
console.log(`Total Pages: ${report.summary.totalPages}`);
console.log(`Title Score: ${report.summary.titleScore}%`);
console.log(`Description Score: ${report.summary.descriptionScore}%`);
console.log(`Image Alt Score: ${report.summary.imageAltScore}%`);
console.log(`Overall Score: ${report.summary.overallScore}%`);
console.log(`\nReport saved to: seo-report.json`);

// Output for GitHub Actions
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `seo-score=${report.summary.overallScore}\n`);
}
