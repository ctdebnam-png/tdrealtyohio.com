#!/usr/bin/env node
/**
 * WP-10, the third clause: the must-never-appear list, enforced each way.
 *
 * TD Realty Ohio, LLC does not perform environmental work. Naming the other
 * company in the footer — which WP-10 requires — puts environmental vocabulary
 * onto all eleven pages of a brokerage site for the first time, and vocabulary
 * is how a capability claim starts. A visitor who reads "environmental site
 * assessment" on a brokerage page has been told the brokerage does it, whatever
 * the sentence around it says.
 *
 * So those terms are allowed in EXACTLY ONE place: inside the
 * <div class="footer-related"> block, where they describe the other company by
 * name and sit beside the disclosure. Anywhere else on any page, they fail.
 *
 * The block is not a general escape hatch and this checks that it is not
 * becoming one:
 *   - at most one per page
 *   - inside <footer>, not somewhere a reader meets it first
 *
 * Without those two, wrapping a section in class="footer-related" would be
 * enough to sell environmental services from this site with the gate green.
 *
 * The mirror runs in td-environmental: scripts/check-cross-claims.ts, holding
 * that site to the brokerage vocabulary it must never use.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.playwright', 'reports', 'scripts', 'src', 'tests', 'functions']);

/**
 * Terms that assert environmental capability. Not "environmental" alone: the
 * word appears legitimately in the other company's NAME, which the footer must
 * be able to print.
 */
const ENVIRONMENTAL_CLAIMS = [
  'environmental site assessment',
  'environmental due diligence',
  'environmental consulting',
  'environmental assessment',
  'phase i esa',
  'phase ii esa',
  'phase i environmental',
  'phase ii environmental',
  'transaction screen',
  'vapor encroachment',
  'groundwater monitoring',
  'soil sampling',
  'remediation',
  'brownfield',
  'contaminated site',
  'recognized environmental condition',
];

const htmlFiles = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...htmlFiles(path));
    else if (entry.endsWith('.html')) out.push(path);
  }
  return out;
};

const BLOCK = /<div class="footer-related">[\s\S]*?<\/div>/g;

/*
 * Word-bounded, whitespace flexible because HTML wraps, and a trailing plural
 * allowed. The mirror gate in td-environmental passed clean against "we
 * prepare site plans" until the plural was added — the boundary after "plan"
 * failed on the "s", so the one sentence the gate existed to catch slipped
 * through it.
 */
const patternFor = (term) =>
  new RegExp(
    `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+')}(?:es|s)?\\b`,
    'gi',
  );

const problems = [];
const pages = htmlFiles('.');

for (const page of pages) {
  const html = readFileSync(page, 'utf8');

  const blocks = html.match(BLOCK) ?? [];
  if (blocks.length > 1) {
    problems.push([page, `${blocks.length} footer-related blocks; there is exactly one disclosure per page`]);
  }
  for (const block of blocks) {
    const at = html.indexOf(block);
    const footerAt = html.indexOf('<footer');
    if (footerAt < 0 || at < footerAt) {
      problems.push([page, 'a footer-related block sits outside <footer>; the exemption is for the footer disclosure only']);
    }
  }

  // Comments are stripped too: a term in a comment is not shown to a reader.
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(BLOCK, '');
  for (const term of ENVIRONMENTAL_CLAIMS) {
    const hits = body.match(patternFor(term));
    if (hits) problems.push([page, `claims environmental capability: "${hits[0]}" (${hits.length} occurrence(s))`]);
  }
}

if (problems.length > 0) {
  console.error(`Cross-claim check FAILED on ${problems.length} finding(s):\n`);
  for (const [page, why] of problems) console.error(`  ${page}\n      ${why}`);
  console.error(
    '\n  TD Realty Ohio, LLC does not perform environmental work. TD Environmental\n' +
      '  Ohio, LLC is a separate company; naming what it does belongs in the footer\n' +
      '  disclosure block and nowhere else. Do not widen the allowlist to make this\n' +
      '  pass — the term on the page is the claim.',
  );
  process.exit(1);
}

console.log(
  `Cross-claim check passed: ${pages.length} page(s) make no environmental capability claim ` +
    `outside the footer disclosure (${ENVIRONMENTAL_CLAIMS.length} terms checked).`,
);
