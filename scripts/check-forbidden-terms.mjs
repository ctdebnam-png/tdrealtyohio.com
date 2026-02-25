#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const FILES = [
  'index.html',
  'sellers/index.html',
  'buyers/index.html',
  'about/index.html',
  'tools/index.html',
  'assets/js/main.js',
  'assets/js/nav.js',
  '_redirects'
];

const TERM_RULES = [
  { name: '1%', regex: /1%/i },
  { name: '2%', regex: /2%/i },
  { name: '3%', regex: /3%/i },
  { name: 'percent', regex: /\bpercent\b/i },
  { name: 'cash back', regex: /cash\s*back/i },
  { name: 'cashback', regex: /\bcashback\b/i },
  { name: 'savings', regex: /\bsavings?\b/i },
  { name: 'save', regex: /\bsave\b/i },
  { name: 'difference', regex: /\bdifference\b/i },
  { name: 'listing plan', regex: /listing\s+plan/i },
  { name: 'buyer credit', regex: /buyer\s+credit/i },
  { name: 'credit back', regex: /credit\s+back/i }
];

const COMMISSION_OFFER_REGEX = /commission/i;
const COMMISSION_CONTEXT = /(1%|2%|3%|discount|save|savings|for less|cash\s*back)/i;

let failures = [];
for (const file of FILES) {
  const content = await readFile(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (file === '_redirects' && /1-percent-commission|sell-only-2-percent|buy\/cash-back/.test(line)) return;
    for (const rule of TERM_RULES) {
      if (rule.regex.test(line)) failures.push(`${file}:${idx + 1} forbidden term "${rule.name}"`);
    }
    if (COMMISSION_OFFER_REGEX.test(line) && COMMISSION_CONTEXT.test(line)) {
      failures.push(`${file}:${idx + 1} forbidden offer-framing "commission"`);
    }
  });
}

if (failures.length) {
  console.error('Forbidden terms check failed:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Forbidden terms check passed.');
