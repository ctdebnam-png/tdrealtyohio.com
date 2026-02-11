#!/usr/bin/env node
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const REQUIRED = ['alt', 'loading', 'decoding', 'width', 'height'];
const EXEMPT_ATTR = 'data-img-exempt';

function isExempt($img) {
  if ($img.attr(EXEMPT_ATTR) !== undefined) return true;
  const role = ($img.attr('role') || '').toLowerCase();
  if (role === 'presentation' || role === 'none') return true;
  if (($img.attr('aria-hidden') || '').toLowerCase() === 'true') return true;
  return false;
}

function isDescriptiveAlt(alt) {
  const value = (alt || '').trim();
  if (!value) return false;
  return !['image', 'photo', 'picture', 'icon', 'graphic'].includes(value.toLowerCase());
}

let errors = 0;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  errors++;
}

async function main() {
  const files = await glob(['index.html', '**/index.html'], {
    cwd: ROOT,
    nodir: true,
    ignore: ['node_modules/**'],
  });

  for (const file of files) {
    const html = await readFile(path.join(ROOT, file), 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    $('img').each((_, img) => {
      const $img = $(img);
      if (isExempt($img)) return;

      const alt = $img.attr('alt');
      if (!isDescriptiveAlt(alt)) {
        fail(`${file}: <img src="${$img.attr('src') || ''}"> missing descriptive alt text`);
      }

      for (const attr of REQUIRED.filter(a => a !== 'alt')) {
        const value = $img.attr(attr);
        if (!value || !String(value).trim()) {
          fail(`${file}: <img src="${$img.attr('src') || ''}"> missing required ${attr}`);
        }
      }
    });
  }

  if (errors > 0) {
    console.error(`\ncheck-image-attributes: ${errors} issue(s) found.`);
    process.exit(1);
  }

  console.log('check-image-attributes: all checks passed ✓');
}

main().catch(err => {
  console.error('check-image-attributes: fatal', err);
  process.exit(1);
});
