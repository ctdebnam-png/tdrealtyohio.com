#!/usr/bin/env node

/**
 * TD Realty Ohio - Manifest Builder
 *
 * Builds the final manifest.json from verified assets
 * Structure: per-page keys with hero_image and hero_video assignments
 */

const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Configuration
const VERIFIED_DATA_FILE = 'assets/media/verified_data.json';
const MANIFEST_FILE = 'assets/media/manifest.json';
const SCHEMA_FILE = 'assets/media/manifest-schema.json';
const CONFIG_FILE = 'media-sources.json';
const ATTRIBUTION_DIR = 'assets/media/attribution';

/**
 * Load verified data
 */
async function loadVerifiedData() {
  try {
    const data = await fs.readFile(VERIFIED_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ No verified data found. Run verify_media.js first.');
    process.exit(1);
  }
}

/**
 * Load config
 */
async function loadConfig() {
  const data = await fs.readFile(CONFIG_FILE, 'utf8');
  return JSON.parse(data);
}

/**
 * Load manifest schema
 */
async function loadSchema() {
  const data = await fs.readFile(SCHEMA_FILE, 'utf8');
  return JSON.parse(data);
}

/**
 * Build per-page manifest structure
 */
async function buildManifest(verifiedData, config) {
  console.log('🔨 Building manifest...\n');

  const manifest = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    pages: {}
  };

  // Group assets by page_key
  const assetsByPage = {};
  for (const asset of verifiedData.assets) {
    if (!asset.page_key) continue;

    if (!assetsByPage[asset.page_key]) {
      assetsByPage[asset.page_key] = {
        images: [],
        videos: []
      };
    }

    if (asset.media_type === 'image') {
      assetsByPage[asset.page_key].images.push(asset);
    } else if (asset.media_type === 'video') {
      assetsByPage[asset.page_key].videos.push(asset);
    }
  }

  // Assign hero media for each page
  for (const [pageKey, assets] of Object.entries(assetsByPage)) {
    console.log(`📄 ${pageKey}:`);

    manifest.pages[pageKey] = {};

    // Assign hero image (prefer first verified image)
    if (assets.images.length > 0) {
      const heroImage = assets.images[0];
      manifest.pages[pageKey].hero_image = {
        local_path: heroImage.local_path,
        optimized_paths: heroImage.optimized_paths || {},
        source: heroImage.source,
        source_url: heroImage.source_url,
        author: heroImage.author,
        author_url: heroImage.author_url,
        license_name: heroImage.license_name,
        license_url: heroImage.license_url,
        attribution_text: heroImage.attribution_text,
        attribution_required: heroImage.attribution_required || false,
        fetched_at: heroImage.fetched_at,
        checksum: heroImage.checksum,
        perceptual_hash: heroImage.perceptual_hash,
        width: heroImage.width,
        height: heroImage.height,
        file_size: heroImage.file_size,
        media_type: 'image',
        format: path.extname(heroImage.local_path).substring(1),
        keywords: heroImage.keywords
      };
      console.log(`  ✓ Hero image: ${path.basename(heroImage.local_path)}`);
    }

    // Assign hero video if available
    if (assets.videos.length > 0) {
      const heroVideo = assets.videos[0];
      manifest.pages[pageKey].hero_video = {
        local_path: heroVideo.local_path,
        source: heroVideo.source,
        source_url: heroVideo.source_url,
        author: heroVideo.author,
        author_url: heroVideo.author_url,
        license_name: heroVideo.license_name,
        license_url: heroVideo.license_url,
        attribution_text: heroVideo.attribution_text,
        attribution_required: heroVideo.attribution_required || false,
        fetched_at: heroVideo.fetched_at,
        checksum: heroVideo.checksum,
        width: heroVideo.width,
        height: heroVideo.height,
        file_size: heroVideo.file_size,
        media_type: 'video',
        format: path.extname(heroVideo.local_path).substring(1),
        duration: heroVideo.duration,
        keywords: heroVideo.keywords
      };
      console.log(`  ✓ Hero video: ${path.basename(heroVideo.local_path)}`);
    }

    if (!manifest.pages[pageKey].hero_image && !manifest.pages[pageKey].hero_video) {
      console.log(`  ⚠ No media assigned`);
      delete manifest.pages[pageKey];
    }
  }

  return manifest;
}

/**
 * Validate manifest against schema
 */
async function validateManifest(manifest, schema) {
  console.log('\n✓ Validating manifest against schema...');

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(manifest);

  if (!valid) {
    console.error('❌ Manifest validation failed:');
    for (const error of validate.errors) {
      console.error(`  - ${error.instancePath}: ${error.message}`);
    }
    return false;
  }

  console.log('  ✓ Manifest is valid');
  return true;
}

/**
 * Generate attribution files
 */
async function generateAttributionFiles(manifest) {
  console.log('\n📝 Generating attribution files...');

  await fs.mkdir(ATTRIBUTION_DIR, { recursive: true });

  const attributions = [];

  for (const [pageKey, pageMedia] of Object.entries(manifest.pages)) {
    const assets = [];

    if (pageMedia.hero_image) {
      assets.push(pageMedia.hero_image);
    }
    if (pageMedia.hero_video) {
      assets.push(pageMedia.hero_video);
    }

    for (const asset of assets) {
      attributions.push({
        page: pageKey,
        file: path.basename(asset.local_path),
        media_type: asset.media_type,
        source: asset.source,
        source_url: asset.source_url,
        author: asset.author,
        author_url: asset.author_url,
        license: asset.license_name,
        license_url: asset.license_url,
        attribution_text: asset.attribution_text,
        attribution_required: asset.attribution_required
      });
    }
  }

  // Save as JSON
  const jsonPath = path.join(ATTRIBUTION_DIR, 'attributions.json');
  await fs.writeFile(jsonPath, JSON.stringify(attributions, null, 2), 'utf8');
  console.log(`  ✓ Saved: ${jsonPath}`);

  // Generate human-readable text file
  const textPath = path.join(ATTRIBUTION_DIR, 'attributions.txt');
  let textContent = 'TD Realty Ohio - Media Attributions\n';
  textContent += '=' .repeat(50) + '\n\n';

  for (const attr of attributions) {
    textContent += `Page: ${attr.page}\n`;
    textContent += `File: ${attr.file}\n`;
    textContent += `Type: ${attr.media_type}\n`;
    textContent += `${attr.attribution_text}\n`;
    textContent += `Source: ${attr.source_url}\n`;
    textContent += `License: ${attr.license} (${attr.license_url})\n`;
    textContent += `Required: ${attr.attribution_required ? 'Yes' : 'No'}\n`;
    textContent += '\n' + '-'.repeat(50) + '\n\n';
  }

  await fs.writeFile(textPath, textContent, 'utf8');
  console.log(`  ✓ Saved: ${textPath}`);

  return attributions;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 TD Realty Ohio - Manifest Builder\n');

  const verifiedData = await loadVerifiedData();
  const config = await loadConfig();
  const schema = await loadSchema();

  console.log(`📦 Loaded ${verifiedData.assets.length} verified assets\n`);

  // Build manifest
  const manifest = await buildManifest(verifiedData, config);

  console.log(`\n✅ Built manifest with ${Object.keys(manifest.pages).length} pages`);

  // Validate manifest
  const isValid = await validateManifest(manifest, schema);
  if (!isValid) {
    console.error('\n❌ Manifest validation failed. Cannot proceed.');
    process.exit(1);
  }

  // Save manifest
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n💾 Manifest saved to: ${MANIFEST_FILE}`);

  // Generate attribution files
  await generateAttributionFiles(manifest);

  console.log('\n✅ Manifest build complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   Pages with media: ${Object.keys(manifest.pages).length}`);
  console.log(`   Total images: ${Object.values(manifest.pages).filter(p => p.hero_image).length}`);
  console.log(`   Total videos: ${Object.values(manifest.pages).filter(p => p.hero_video).length}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
