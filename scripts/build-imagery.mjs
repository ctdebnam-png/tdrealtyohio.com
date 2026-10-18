#!/usr/bin/env node
/**
 * Page imagery: turns the full-size illustration set ("TDR - Home - A.jpg",
 * 1776x896) into web sizes under assets/images/photos/.
 *
 *   node scripts/build-imagery.mjs <source-folder> [Home-A Buyers-A ...]
 *
 * Each image becomes <page>-<variant>-<width>.{avif,webp,jpg} at the widths
 * below, e.g. home-a-1024.webp. To swap a page's picture from A to B, change
 * "home-a" to "home-b" in that page's <picture> (and its preload, if it is the
 * hero). Sources are not committed; they live in the Drive imagery folder.
 */
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'images', 'photos');
const WIDTHS = [640, 1024, 1600];

const [srcDir, ...only] = process.argv.slice(2);
if (!srcDir) {
  console.error('usage: node scripts/build-imagery.mjs <source-folder> [Home-A ...]');
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(srcDir)).filter((f) => /^TDR - .+ - [AB]\.jpe?g$/i.test(f));
for (const file of files) {
  const [, page, variant] = file.match(/^TDR - (.+) - ([AB])\./i);
  const key = `${page}-${variant}`;
  if (only.length && !only.some((o) => o.toLowerCase() === key.toLowerCase())) continue;
  const slug = key.toLowerCase().replace(/\s+/g, '-');
  for (const w of WIDTHS) {
    const base = sharp(path.join(srcDir, file)).resize({ width: w });
    await base.clone().avif({ quality: 50, effort: 4 }).toFile(path.join(OUT, `${slug}-${w}.avif`));
    await base.clone().webp({ quality: 74 }).toFile(path.join(OUT, `${slug}-${w}.webp`));
    await base.clone().jpeg({ quality: 76, mozjpeg: true, progressive: true }).toFile(path.join(OUT, `${slug}-${w}.jpg`));
  }
  console.log(`built ${slug}`);
}
