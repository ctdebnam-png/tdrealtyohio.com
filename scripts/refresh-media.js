#!/usr/bin/env node

/**
 * TD Realty Ohio - Pexels Media Pipeline
 *
 * This script fetches licensed photos from Pexels API and generates thumbnails.
 * It maintains a manifest.json file with all media metadata including attribution.
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// Configuration
const CONFIG_FILE = 'pexels-config.json';
const MANIFEST_FILE = 'assets/stock/manifest.json';
const PHOTOS_DIR = 'assets/stock/photos';
const THUMBS_DIR = 'assets/stock/thumbs';
const PEXELS_API_URL = 'https://api.pexels.com/v1';

// Thumbnail dimensions
const THUMB_WIDTH = 400;
const THUMB_HEIGHT = 300;

/**
 * Load configuration from JSON file
 */
async function loadConfig() {
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Load existing manifest or create new one
 */
async function loadManifest() {
  try {
    const manifestData = await fs.readFile(MANIFEST_FILE, 'utf8');
    return JSON.parse(manifestData);
  } catch (error) {
    // If file doesn't exist, return empty manifest
    return {
      generated: new Date().toISOString(),
      photos: [],
      videos: []
    };
  }
}

/**
 * Save manifest to file
 */
async function saveManifest(manifest) {
  manifest.generated = new Date().toISOString();
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✓ Manifest saved with ${manifest.photos.length} photos`);
}

/**
 * Search Pexels API for photos
 */
async function searchPexels(query, perPage = 15, orientation = 'landscape') {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    throw new Error('PEXELS_API_KEY environment variable is required');
  }

  try {
    const response = await axios.get(`${PEXELS_API_URL}/search`, {
      params: {
        query,
        per_page: perPage,
        orientation
      },
      headers: {
        'Authorization': apiKey
      }
    });

    return response.data.photos || [];
  } catch (error) {
    console.error(`Error searching Pexels for "${query}": ${error.message}`);
    return [];
  }
}

/**
 * Download image from URL
 */
async function downloadImage(url, outputPath) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    await fs.writeFile(outputPath, response.data);
    return true;
  } catch (error) {
    console.error(`Error downloading image: ${error.message}`);
    return false;
  }
}

/**
 * Generate thumbnail from image
 */
async function generateThumbnail(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(THUMB_WIDTH, THUMB_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    return true;
  } catch (error) {
    console.error(`Error generating thumbnail: ${error.message}`);
    return false;
  }
}

/**
 * Generate a safe filename from Pexels photo ID and photographer
 */
function generateFilename(photo, extension = 'jpg') {
  const photographer = photo.photographer
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30);

  return `pexels-${photo.id}-${photographer}.${extension}`;
}

/**
 * Check if photo already exists in manifest
 */
function photoExists(manifest, photoId) {
  return manifest.photos.some(p => p.id === photoId);
}

/**
 * Process a single photo from Pexels
 */
async function processPhoto(photo, manifest) {
  // Check if already downloaded
  if (photoExists(manifest, photo.id)) {
    console.log(`  ⊘ Photo ${photo.id} already exists, skipping`);
    return null;
  }

  const filename = generateFilename(photo);
  const thumbFilename = generateFilename(photo);

  const photoPath = path.join(PHOTOS_DIR, filename);
  const thumbPath = path.join(THUMBS_DIR, thumbFilename);

  // Download the large image (use large2x for high quality)
  console.log(`  ↓ Downloading photo ${photo.id} by ${photo.photographer}...`);
  const downloaded = await downloadImage(photo.src.large2x, photoPath);

  if (!downloaded) {
    return null;
  }

  // Generate thumbnail
  console.log(`  ⚙ Generating thumbnail...`);
  const thumbnailGenerated = await generateThumbnail(photoPath, thumbPath);

  if (!thumbnailGenerated) {
    // Clean up photo if thumbnail generation failed
    await fs.unlink(photoPath).catch(() => {});
    return null;
  }

  // Create manifest entry
  const manifestEntry = {
    id: photo.id,
    type: 'photo',
    src: `assets/stock/photos/${filename}`,
    thumb: `assets/stock/thumbs/${thumbFilename}`,
    photographer: photo.photographer,
    photographer_url: photo.photographer_url,
    source: 'pexels',
    source_url: photo.url,
    width: photo.width,
    height: photo.height,
    alt: photo.alt || `Photo by ${photo.photographer}`,
    avg_color: photo.avg_color
  };

  console.log(`  ✓ Successfully processed photo ${photo.id}`);
  return manifestEntry;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 TD Realty Ohio - Pexels Media Pipeline\n');

  // Load configuration
  const config = await loadConfig();
  console.log(`📋 Loaded config: ${config.queries.length} queries, ${config.imagesPerQuery} images per query\n`);

  // Load existing manifest
  const manifest = await loadManifest();
  console.log(`📦 Current manifest has ${manifest.photos.length} photos\n`);

  // Process each query
  let totalProcessed = 0;

  for (const query of config.queries) {
    console.log(`🔍 Searching Pexels for: "${query}"`);

    const photos = await searchPexels(query, config.imagesPerQuery * 2, config.orientation);
    console.log(`  Found ${photos.length} photos`);

    let processedForQuery = 0;

    for (const photo of photos) {
      // Stop if we've processed enough for this query
      if (processedForQuery >= config.imagesPerQuery) {
        break;
      }

      const entry = await processPhoto(photo, manifest);

      if (entry) {
        manifest.photos.push(entry);
        processedForQuery++;
        totalProcessed++;
      }
    }

    console.log(`  ✓ Processed ${processedForQuery} new photos for "${query}"\n`);
  }

  // Save updated manifest
  await saveManifest(manifest);

  console.log(`\n✅ Media refresh complete!`);
  console.log(`   Total photos in library: ${manifest.photos.length}`);
  console.log(`   New photos added: ${totalProcessed}`);

  if (totalProcessed === 0) {
    console.log(`\n💡 No new photos were added. All configured images already exist.`);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
