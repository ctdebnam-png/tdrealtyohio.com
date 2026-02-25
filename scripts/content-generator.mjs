#!/usr/bin/env node
/**
 * Content Generator
 * Reads /content/backlog.csv and generates markdown drafts in /blog/YYYY/MM/slug/
 * with proper frontmatter. Requires human approval before publish.
 *
 * Usage:
 *   node scripts/content-generator.mjs                    # Generate next 2 draft posts
 *   node scripts/content-generator.mjs --count 5          # Generate next 5 draft posts
 *   node scripts/content-generator.mjs --keyword "..."    # Generate specific keyword
 *
 * Generated files go to /content/drafts/ and require human review + approval.
 * To publish: move from /content/drafts/ to /blog/{slug}/ and convert to HTML.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { CITIES } = require('../src/config/routes.js');

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (values[i] || '').trim());
    return obj;
  });
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function getInternalLinks(keyword, city) {
  const links = [];

  // Hub links
  if (keyword.includes('sell') || keyword.includes('seller') || keyword.includes('listing')) {
    links.push({ text: 'selling your home', url: '/sellers/' });
    links.push({ text: '1% listing commission', url: '/1-percent-commission/' });
  }
  if (keyword.includes('buy') || keyword.includes('buyer') || keyword.includes('first time')) {
    links.push({ text: 'buying a home', url: '/buyers/' });
    links.push({ text: '1% cash back program', url: '/buyers/' });
  }

  // City links
  if (city) {
    const cityObj = CITIES.find(c => c.slug === city || c.name.toLowerCase() === city.toLowerCase());
    if (cityObj) {
      links.push({ text: `${cityObj.name} real estate`, url: `/areas/${cityObj.slug}/` });
    }
  }

  // Always link to contact
  links.push({ text: 'free consultation', url: '/contact/' });

  // Sibling content
  links.push({ text: 'compare commission options', url: '/compare/' });
  links.push({ text: 'home value estimate', url: '/home-value/' });

  return links;
}

function generateFAQBlock(keyword) {
  const faqs = [];

  if (keyword.includes('sell') || keyword.includes('listing')) {
    faqs.push({
      q: 'What does a 1% listing commission include?',
      a: 'Full MLS listing, professional photography, pricing strategy, negotiation, and closing support. The only difference is the fee — service is the same.',
    });
    faqs.push({
      q: 'How much can I save with a 1% commission?',
      a: 'On a $400,000 home, you save $8,000 compared to a traditional 3% listing fee. Use our commission calculator for your specific price.',
    });
  }

  if (keyword.includes('buy') || keyword.includes('first time')) {
    faqs.push({
      q: 'How does the 1% cash back program work?',
      a: 'First-time homebuyers receive 1% of the purchase price back at closing, subject to lender approval. This can be applied toward closing costs.',
    });
  }

  if (keyword.includes('inspection')) {
    faqs.push({
      q: 'What does a seller preparation cover?',
      a: 'A licensed inspector examines the structure, systems, roof, HVAC, plumbing, and electrical. You receive a written report to address issues before listing.',
    });
  }

  return faqs;
}

function generateDraft(entry) {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const slug = slugify(entry.keyword);
  const links = getInternalLinks(entry.keyword, entry.target_city_zip);
  const faqs = generateFAQBlock(entry.keyword);

  const frontmatter = `---
title: "${entry.keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}"
description: "DRAFT — requires human review and unique description"
date: ${date}
city: ${entry.target_city_zip}
primary_keyword: "${entry.keyword}"
intent: ${entry.intent}
page_type: ${entry.page_type}
status: draft
author: TD Realty Ohio
---`;

  const linksSection = links.map(l => `- [${l.text}](${l.url})`).join('\n');

  const faqSection = faqs.length > 0
    ? `\n## Frequently Asked Questions\n\n${faqs.map(f => `### ${f.q}\n\n${f.a}\n`).join('\n')}`
    : '';

  const content = `${frontmatter}

# ${entry.keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

> **DRAFT** — This content requires human review before publishing.
> Generated: ${date}
> Primary keyword: ${entry.keyword}
> Target: ${entry.target_city_zip}

## [SECTION 1: Introduction — Write unique opening paragraph]

[Placeholder: Write 150-200 words introducing the topic. Reference local context for ${entry.target_city_zip}.]

## [SECTION 2: Main Content — Write 3-5 substantive paragraphs]

[Placeholder: Core content addressing the keyword intent. Use specific Ohio/Central Ohio data where available.]

## [SECTION 3: Actionable Advice]

[Placeholder: Practical steps readers can take.]
${faqSection}

## Internal Links

${linksSection}

## Service Areas

TD Realty Ohio serves Westerville, New Albany, Gahanna, Worthington, Lewis Center, Hilliard, Dublin, Powell, Sunbury, Columbus, and surrounding Central Ohio communities.

## Next Step

Ready to discuss your real estate goals? [Contact TD Realty Ohio](/contact/) or call [(614) 392-8858](tel:6143928858) for a free consultation.

---

*TD Realty Ohio, LLC | Broker: Travis Debnam | License #2023006467 | Brokerage #2023006602*
`;

  return { slug, year, month, content };
}

async function generate() {
  const count = parseInt(process.argv.find(a => a.startsWith('--count'))?.split('=')[1] || '2', 10);
  const specificKeyword = process.argv.find(a => a.startsWith('--keyword='))?.split('=').slice(1).join('=');

  // Read backlog
  const csvContent = await readFile(join(ROOT, 'content', 'backlog.csv'), 'utf-8');
  const entries = parseCSV(csvContent);

  // Filter to draft entries
  let drafts = entries.filter(e => e.status === 'draft');

  if (specificKeyword) {
    drafts = drafts.filter(e => e.keyword.includes(specificKeyword));
  }

  const toGenerate = drafts.slice(0, count);

  if (toGenerate.length === 0) {
    console.log('[content-gen] No draft entries to generate');
    return;
  }

  console.log(`[content-gen] Generating ${toGenerate.length} draft(s)...`);

  const draftsDir = join(ROOT, 'content', 'drafts');
  await mkdir(draftsDir, { recursive: true });

  for (const entry of toGenerate) {
    const { slug, year, month, content } = generateDraft(entry);
    const outputDir = join(draftsDir, `${year}-${month}-${slug}`);
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'draft.md'), content);
    console.log(`  Generated: /content/drafts/${year}-${month}-${slug}/draft.md`);
  }

  console.log(`[content-gen] Done. Review drafts in /content/drafts/ before publishing.`);
}

generate();
