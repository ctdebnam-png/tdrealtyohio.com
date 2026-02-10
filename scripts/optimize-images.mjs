#!/usr/bin/env node
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TARGETS = ['index.html', 'areas/*/index.html', 'blog/*/index.html'];
const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png']);
const BREAKPOINTS = [480, 768, 1024, 1280, 1536, 1920];

function isLocalAsset(src) {
  return src && src.startsWith('/') && !src.startsWith('//');
}

function variantPaths(src, width, format) {
  const original = src.replace(/^\//, '');
  const parsed = path.parse(original);
  const outputDir = path.join('media', 'optimized', parsed.dir);
  const filename = `${parsed.name}-${width}.${format}`;
  return {
    fsPath: path.join(ROOT, outputDir, filename),
    webPath: `/${path.posix.join(outputDir.replaceAll(path.sep, '/'), filename)}`,
  };
}

async function ensureExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function optimizeImage(src) {
  const sourcePath = path.join(ROOT, src.replace(/^\//, ''));
  if (!(await ensureExists(sourcePath))) return null;

  const image = sharp(sourcePath);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) return null;

  const widths = [...new Set([...BREAKPOINTS.filter(w => w < meta.width), meta.width])];
  const srcsets = { avif: [], webp: [] };

  for (const width of widths) {
    for (const format of ['avif', 'webp']) {
      const variant = variantPaths(src, width, format);
      await mkdir(path.dirname(variant.fsPath), { recursive: true });
      const pipeline = sharp(sourcePath).resize({ width, withoutEnlargement: true });
      if (format === 'avif') await pipeline.avif({ quality: 50 }).toFile(variant.fsPath);
      if (format === 'webp') await pipeline.webp({ quality: 75 }).toFile(variant.fsPath);
      srcsets[format].push(`${variant.webPath} ${width}w`);
    }
  }

  return {
    width: meta.width,
    height: meta.height,
    avif: srcsets.avif.join(', '),
    webp: srcsets.webp.join(', '),
  };
}

async function run() {
  const files = await glob(TARGETS, { cwd: ROOT, nodir: true });
  const manifest = {};

  for (const file of files) {
    const fullPath = path.join(ROOT, file);
    const html = await readFile(fullPath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    let changed = false;
    const imgs = $('img').toArray();

    for (const img of imgs) {
      const el = $(img);
      const src = el.attr('src');
      if (!isLocalAsset(src)) continue;

      const ext = path.extname(src.split('?')[0]).toLowerCase();
      if (!RASTER_EXT.has(ext)) continue;

      const optimized = await optimizeImage(src);
      if (!optimized) continue;

      const sizes = el.attr('sizes') || '(max-width: 768px) 100vw, 768px';
      const sourceAvif = `<source type="image/avif" srcset="${optimized.avif}" sizes="${sizes}">`;
      const sourceWebp = `<source type="image/webp" srcset="${optimized.webp}" sizes="${sizes}">`;

      el.attr('width', String(optimized.width));
      el.attr('height', String(optimized.height));
      if (!el.attr('loading')) el.attr('loading', 'lazy');
      if (!el.attr('decoding')) el.attr('decoding', 'async');
      if (!el.attr('sizes')) el.attr('sizes', sizes);

      if (!el.parent().is('picture')) {
        el.before(`${sourceAvif}${sourceWebp}`);
        el.wrap('<picture data-optimized="true"></picture>');
        changed = true;
      }

      manifest[src] = {
        width: optimized.width,
        height: optimized.height,
        avifSrcset: optimized.avif,
        webpSrcset: optimized.webp,
        sizes,
      };
    }

    if (changed) {
      await writeFile(fullPath, $.html(), 'utf8');
      console.log(`[optimize-images] Updated ${file}`);
    }
  }

  await writeFile(path.join(ROOT, 'ops/image-variants-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[optimize-images] Wrote manifest for ${Object.keys(manifest).length} image(s)`);
}

run().catch(err => {
  console.error('[optimize-images] Fatal:', err);
  process.exit(1);
});
