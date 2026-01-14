#!/usr/bin/env tsx

/**
 * TD Realty Ohio - Media Injection
 *
 * Reads manifest and injects hero images into HTML pages
 */

import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';

const MANIFEST_FILE = 'public/media/manifest.json';
const PAGES_TO_UPDATE = [
  'index.html',
  'about.html',
  'buyers.html',
  'sellers.html',
];

interface ImageMetadata {
  id: string;
  topic: string;
  cdnUrl: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  creator: string;
  attribution: string;
  width: number;
  height: number;
  retrievedAt: string;
}

/**
 * Load manifest
 */
async function loadManifest(): Promise<ImageMetadata[]> {
  try {
    const content = await fs.readFile(MANIFEST_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠️  Manifest not found, skipping media injection');
    return [];
  }
}

/**
 * Get random image from topic
 */
function getImageForTopic(manifest: ImageMetadata[], topic: string): ImageMetadata | null {
  const images = manifest.filter(img => img.topic === topic);
  if (images.length === 0) return null;
  return images[Math.floor(Math.random() * images.length)];
}

/**
 * Create picture element HTML
 */
function createPictureHTML(image: ImageMetadata, cssClass: string = 'hero-image'): string {
  return `
    <picture class="${cssClass}">
      <source srcset="${image.cdnUrl}" type="image/webp">
      <img
        src="${image.cdnUrl}"
        alt="${image.attribution}"
        width="${image.width}"
        height="${image.height}"
        loading="lazy"
        style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 0;"
      />
    </picture>
  `.trim();
}

/**
 * Inject hero image into HTML
 */
async function injectHeroImage(htmlPath: string, manifest: ImageMetadata[]) {
  console.log(`  Processing ${htmlPath}...`);

  // Determine topic from filename
  let topic = 'hero';
  if (htmlPath.includes('sellers')) topic = 'sellers';
  else if (htmlPath.includes('buyers')) topic = 'buyers';
  else if (htmlPath.includes('about')) topic = 'hero';

  // Get image for topic
  const image = getImageForTopic(manifest, topic);
  if (!image) {
    console.log(`    ⚠️  No image found for topic "${topic}", skipping`);
    return;
  }

  // Read HTML
  const html = await fs.readFile(htmlPath, 'utf-8');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Find hero section
  const heroSection = document.querySelector('section.hero');
  if (!heroSection) {
    console.log(`    ⚠️  No .hero section found, skipping`);
    return;
  }

  // Check if hero section already has position relative
  const existingStyle = heroSection.getAttribute('style') || '';
  if (!existingStyle.includes('position')) {
    heroSection.setAttribute('style', `position: relative; overflow: hidden; ${existingStyle}`);
  }

  // Remove existing hero images/pictures
  const existingMedia = heroSection.querySelectorAll('.hero-image, .hero-video-container, picture');
  existingMedia.forEach(el => el.remove());

  // Create picture element
  const pictureHTML = createPictureHTML(image, 'hero-image');

  // Insert at the beginning of hero section
  heroSection.insertAdjacentHTML('afterbegin', pictureHTML);

  // Ensure hero content has proper z-index
  const container = heroSection.querySelector('.container');
  if (container) {
    const containerStyle = container.getAttribute('style') || '';
    if (!containerStyle.includes('position')) {
      container.setAttribute('style', `position: relative; z-index: 1; ${containerStyle}`);
    }
  }

  // Write updated HTML
  await fs.writeFile(htmlPath, dom.serialize());
  console.log(`    ✅ Injected ${topic} image by ${image.creator}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🖼️  TD Realty Ohio - Media Injection\n');

  // Load manifest
  const manifest = await loadManifest();

  if (manifest.length === 0) {
    console.log('No manifest found, skipping injection');
    return;
  }

  console.log(`📋 Loaded ${manifest.length} images from manifest\n`);

  // Process each page
  for (const page of PAGES_TO_UPDATE) {
    const pagePath = path.join(process.cwd(), page);
    try {
      await injectHeroImage(pagePath, manifest);
    } catch (error: any) {
      console.error(`  ❌ Error processing ${page}: ${error.message}`);
    }
  }

  console.log('\n✨ Media injection complete!');
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
