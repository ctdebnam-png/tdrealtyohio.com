#!/usr/bin/env tsx

/**
 * TD Realty Ohio - Media Verification
 *
 * Validates the media manifest to ensure:
 * - Manifest exists
 * - Contains at least 12 images
 * - All entries have required fields
 */

import fs from 'fs/promises';
import path from 'path';

const MANIFEST_FILE = 'public/media/manifest.json';
const MIN_IMAGES = 12;

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

const REQUIRED_FIELDS: (keyof ImageMetadata)[] = [
  'id',
  'topic',
  'cdnUrl',
  'sourceUrl',
  'license',
  'licenseUrl',
  'creator',
  'attribution',
  'width',
  'height',
  'retrievedAt',
];

/**
 * Verify a single image entry
 */
function verifyImageEntry(image: any, index: number): string[] {
  const errors: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!image[field]) {
      errors.push(`Entry ${index}: Missing required field "${field}"`);
    }
  }

  // Type checks
  if (typeof image.width !== 'number' || image.width <= 0) {
    errors.push(`Entry ${index}: Invalid width (must be positive number)`);
  }

  if (typeof image.height !== 'number' || image.height <= 0) {
    errors.push(`Entry ${index}: Invalid height (must be positive number)`);
  }

  // URL validation
  if (image.cdnUrl && !image.cdnUrl.startsWith('http')) {
    errors.push(`Entry ${index}: cdnUrl must be a valid URL`);
  }

  if (image.sourceUrl && !image.sourceUrl.startsWith('http')) {
    errors.push(`Entry ${index}: sourceUrl must be a valid URL`);
  }

  return errors;
}

/**
 * Main verification
 */
async function main() {
  console.log('🔍 TD Realty Ohio - Media Verification\n');

  let exitCode = 0;
  const errors: string[] = [];

  // Check if manifest exists
  try {
    await fs.access(MANIFEST_FILE);
  } catch {
    console.error(`❌ Manifest not found: ${MANIFEST_FILE}`);
    process.exit(1);
  }

  // Read and parse manifest
  let manifest: ImageMetadata[];
  try {
    const content = await fs.readFile(MANIFEST_FILE, 'utf-8');
    manifest = JSON.parse(content);

    if (!Array.isArray(manifest)) {
      console.error('❌ Manifest is not an array');
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ Failed to parse manifest: ${error.message}`);
    process.exit(1);
  }

  console.log(`📊 Found ${manifest.length} images in manifest\n`);

  // Check minimum count
  if (manifest.length < MIN_IMAGES) {
    errors.push(`Manifest contains only ${manifest.length} images (minimum required: ${MIN_IMAGES})`);
    exitCode = 1;
  }

  // Verify each entry
  let validEntries = 0;
  for (let i = 0; i < manifest.length; i++) {
    const entryErrors = verifyImageEntry(manifest[i], i);
    if (entryErrors.length > 0) {
      errors.push(...entryErrors);
      exitCode = 1;
    } else {
      validEntries++;
    }
  }

  // Report results
  if (exitCode === 0) {
    console.log('✅ Verification passed!');
    console.log(`   Total images: ${manifest.length}`);
    console.log(`   All entries valid: ${validEntries}/${manifest.length}`);
    console.log(`   Minimum threshold: ${MIN_IMAGES} images`);

    // Show breakdown by topic
    const byTopic: Record<string, number> = {};
    for (const image of manifest) {
      byTopic[image.topic] = (byTopic[image.topic] || 0) + 1;
    }

    console.log('\n📂 Images by topic:');
    for (const [topic, count] of Object.entries(byTopic)) {
      console.log(`   - ${topic}: ${count}`);
    }
  } else {
    console.error('\n❌ Verification failed!\n');
    console.error(`Found ${errors.length} error(s):\n`);
    for (const error of errors.slice(0, 20)) {
      console.error(`  • ${error}`);
    }
    if (errors.length > 20) {
      console.error(`  ... and ${errors.length - 20} more errors`);
    }
  }

  process.exit(exitCode);
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
