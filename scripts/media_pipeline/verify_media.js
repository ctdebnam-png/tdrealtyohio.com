#!/usr/bin/env node

/**
 * TD Realty Ohio - Media Verification Pipeline
 *
 * Implements 6 verification gates:
 * 1. License verification
 * 2. Content safety (watermarks/logos)
 * 3. Quality checks (resolution, dimensions)
 * 4. Deduplication (perceptual hashing)
 * 5. Performance optimization (webp, responsive sizes)
 * 6. Build/link validation (performed in GitHub Actions)
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

// Configuration
const FETCHED_DATA_FILE = 'assets/media/fetched_data.json';
const VERIFIED_DATA_FILE = 'assets/media/verified_data.json';
const OPTIMIZED_DIR = 'assets/media/optimized';
const CONFIG_FILE = 'media-sources.json';

// Quality thresholds
const MIN_IMAGE_WIDTH = 1600;
const MIN_IMAGE_HEIGHT = 900;
const MAX_VIDEO_DURATION = 15;
const MIN_VIDEO_HEIGHT = 720;
const TARGET_HERO_SIZE_KB = 250;

/**
 * Load fetched data
 */
async function loadFetchedData() {
  try {
    const data = await fs.readFile(FETCHED_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ No fetched data found. Run fetch_media.js first.');
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
 * Save verified data
 */
async function saveVerifiedData(data) {
  data.verified_at = new Date().toISOString();
  await fs.writeFile(VERIFIED_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * GATE 1: License Verification
 * Ensures all assets have valid license information
 */
function verifyLicense(asset) {
  const requiredFields = [
    'license_name',
    'license_url',
    'attribution_text',
    'author'
  ];

  for (const field of requiredFields) {
    if (!asset[field]) {
      console.log(`  ✗ License check failed: missing ${field}`);
      return false;
    }
  }

  // Verify license is from known source
  const validSources = ['pexels', 'pixabay', 'unsplash', 'wikimedia'];
  if (!validSources.includes(asset.source)) {
    console.log(`  ✗ License check failed: unknown source ${asset.source}`);
    return false;
  }

  console.log(`  ✓ License verified: ${asset.license_name}`);
  return true;
}

/**
 * GATE 2: Content Safety Check
 * Best-effort detection of watermarks and logos
 */
async function checkContentSafety(asset) {
  // Heuristic: check filename and metadata for watermark indicators
  const watermarkKeywords = [
    'watermark',
    'logo',
    'shutterstock',
    'gettyimages',
    'stock',
    'preview',
    'sample'
  ];

  const filename = path.basename(asset.local_path).toLowerCase();
  const hasWatermarkIndicator = watermarkKeywords.some(kw => filename.includes(kw));

  if (hasWatermarkIndicator) {
    console.log(`  ✗ Safety check failed: potential watermark in filename`);
    return false;
  }

  // For images, we could add more sophisticated checks here
  // (e.g., detecting repeated patterns, text overlay)
  // For now, rely on the fact that our sources provide watermark-free content

  console.log(`  ✓ Safety check passed`);
  return true;
}

/**
 * GATE 3: Quality Check
 * Validates resolution, dimensions, and duration
 */
async function checkQuality(asset, config) {
  if (asset.media_type === 'image') {
    // Check minimum dimensions
    if (asset.width < MIN_IMAGE_WIDTH || asset.height < MIN_IMAGE_HEIGHT) {
      console.log(`  ✗ Quality check failed: image too small (${asset.width}x${asset.height})`);
      return false;
    }

    // Check aspect ratio (prefer landscape)
    const aspectRatio = asset.width / asset.height;
    if (aspectRatio < 1.2) {
      console.log(`  ⚠ Warning: aspect ratio not ideal for hero (${aspectRatio.toFixed(2)})`);
    }

    console.log(`  ✓ Quality check passed: ${asset.width}x${asset.height}`);
    return true;
  }

  if (asset.media_type === 'video') {
    // Check resolution
    if (asset.height < MIN_VIDEO_HEIGHT) {
      console.log(`  ✗ Quality check failed: video resolution too low (${asset.height}p)`);
      return false;
    }

    // Check duration
    if (asset.duration > MAX_VIDEO_DURATION) {
      console.log(`  ✗ Quality check failed: video too long (${asset.duration}s > ${MAX_VIDEO_DURATION}s)`);
      return false;
    }

    console.log(`  ✓ Quality check passed: ${asset.height}p, ${asset.duration}s`);
    return true;
  }

  return false;
}

/**
 * GATE 4: Deduplication using Perceptual Hash
 * Calculates a simple perceptual hash for images
 */
async function calculatePerceptualHash(imagePath) {
  try {
    // Resize to 8x8 and convert to grayscale
    const buffer = await sharp(imagePath)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    // Calculate average pixel value
    const avg = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;

    // Create hash: 1 if pixel > avg, 0 otherwise
    let hash = '';
    for (let i = 0; i < buffer.length; i++) {
      hash += buffer[i] > avg ? '1' : '0';
    }

    // Convert to hex
    return parseInt(hash, 2).toString(16).padStart(16, '0');
  } catch (error) {
    console.error(`  ⚠ Error calculating perceptual hash: ${error.message}`);
    return null;
  }
}

/**
 * Calculate Hamming distance between two hashes
 */
function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 100;

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

/**
 * Check for duplicates
 */
async function checkDuplicate(asset, verifiedAssets) {
  if (asset.media_type === 'video') {
    // For videos, use checksum
    const duplicate = verifiedAssets.find(
      a => a.media_type === 'video' && a.checksum === asset.checksum
    );

    if (duplicate) {
      console.log(`  ✗ Duplicate detected (checksum match)`);
      return true;
    }
  } else {
    // For images, use perceptual hash
    const pHash = await calculatePerceptualHash(asset.local_path);
    if (!pHash) return false; // Skip if hash calculation failed

    asset.perceptual_hash = pHash;

    // Check against existing verified assets
    for (const verified of verifiedAssets) {
      if (verified.media_type !== 'image' || !verified.perceptual_hash) continue;

      const distance = hammingDistance(pHash, verified.perceptual_hash);
      if (distance < 10) { // Similar images have distance < 10
        console.log(`  ✗ Duplicate detected (perceptual hash distance: ${distance})`);
        return true;
      }
    }
  }

  console.log(`  ✓ Not a duplicate`);
  return false;
}

/**
 * GATE 5: Performance Optimization
 * Generates WebP versions and responsive sizes
 */
async function optimizeImage(asset, config) {
  if (asset.media_type !== 'image') {
    return { optimized: false };
  }

  console.log(`  ⚙ Optimizing image...`);

  const basename = path.basename(asset.local_path, path.extname(asset.local_path));
  const optimizedPaths = {
    webp: null,
    sizes: {}
  };

  try {
    // Generate WebP version
    const webpPath = path.join(OPTIMIZED_DIR, `${basename}.webp`);
    await sharp(asset.local_path)
      .webp({ quality: config.global_settings.image_quality.webp_quality })
      .toFile(webpPath);

    const webpStats = await fs.stat(webpPath);
    optimizedPaths.webp = webpPath;
    console.log(`  ✓ Generated WebP (${(webpStats.size / 1024).toFixed(0)}KB)`);

    // Generate responsive sizes
    const sizes = config.global_settings.performance.generate_responsive_sizes;
    for (const width of sizes) {
      const sizePath = path.join(OPTIMIZED_DIR, `${basename}-${width}w.webp`);
      await sharp(asset.local_path)
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality: config.global_settings.image_quality.webp_quality })
        .toFile(sizePath);

      optimizedPaths.sizes[width] = sizePath;
      const sizeStats = await fs.stat(sizePath);
      console.log(`  ✓ Generated ${width}w (${(sizeStats.size / 1024).toFixed(0)}KB)`);
    }

    return {
      optimized: true,
      paths: optimizedPaths
    };
  } catch (error) {
    console.error(`  ⚠ Optimization error: ${error.message}`);
    return { optimized: false };
  }
}

/**
 * Main verification process
 */
async function main() {
  console.log('🔍 TD Realty Ohio - Media Verification Pipeline\n');
  console.log('Running 5 verification gates...\n');

  const config = await loadConfig();
  const fetchedData = await loadFetchedData();

  console.log(`📦 Loaded ${fetchedData.assets.length} fetched assets\n`);

  // Ensure optimized directory exists
  await fs.mkdir(OPTIMIZED_DIR, { recursive: true });

  const verifiedAssets = [];
  const rejectedAssets = [];

  for (let i = 0; i < fetchedData.assets.length; i++) {
    const asset = fetchedData.assets[i];
    console.log(`\n[${i + 1}/${fetchedData.assets.length}] Verifying ${path.basename(asset.local_path)}`);
    console.log(`  Source: ${asset.source} | Type: ${asset.media_type} | Page: ${asset.page_key}`);

    let passed = true;
    const reasons = [];

    // Gate 1: License Verification
    if (!verifyLicense(asset)) {
      passed = false;
      reasons.push('license');
    }

    // Gate 2: Content Safety
    if (passed && !(await checkContentSafety(asset))) {
      passed = false;
      reasons.push('safety');
    }

    // Gate 3: Quality Check
    if (passed && !(await checkQuality(asset, config))) {
      passed = false;
      reasons.push('quality');
    }

    // Gate 4: Deduplication
    if (passed && (await checkDuplicate(asset, verifiedAssets))) {
      passed = false;
      reasons.push('duplicate');
    }

    // Gate 5: Performance Optimization
    let optimized = { optimized: false };
    if (passed && asset.media_type === 'image') {
      optimized = await optimizeImage(asset, config);
      asset.optimized_paths = optimized.paths;
    }

    if (passed) {
      verifiedAssets.push(asset);
      console.log(`  ✅ PASSED all gates`);
    } else {
      rejectedAssets.push({
        asset: asset.local_path,
        reasons: reasons
      });
      console.log(`  ❌ REJECTED: ${reasons.join(', ')}`);

      // Clean up rejected files
      try {
        await fs.unlink(asset.local_path);
        console.log(`  🗑 Cleaned up rejected file`);
      } catch (e) {
        // File might not exist, ignore
      }
    }
  }

  // Save verified data
  const verifiedData = {
    verified_at: new Date().toISOString(),
    assets: verifiedAssets,
    rejected: rejectedAssets,
    stats: {
      total_fetched: fetchedData.assets.length,
      verified: verifiedAssets.length,
      rejected: rejectedAssets.length,
      by_source: {}
    }
  };

  // Calculate stats by source
  for (const asset of verifiedAssets) {
    if (!verifiedData.stats.by_source[asset.source]) {
      verifiedData.stats.by_source[asset.source] = 0;
    }
    verifiedData.stats.by_source[asset.source]++;
  }

  await saveVerifiedData(verifiedData);

  console.log('\n\n✅ Verification complete!');
  console.log(`   Total fetched: ${fetchedData.assets.length}`);
  console.log(`   Verified: ${verifiedAssets.length}`);
  console.log(`   Rejected: ${rejectedAssets.length}`);
  console.log(`\n📊 By source:`);
  for (const [source, count] of Object.entries(verifiedData.stats.by_source)) {
    console.log(`   ${source}: ${count}`);
  }
  console.log(`\n📦 Verified data saved to: ${VERIFIED_DATA_FILE}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
