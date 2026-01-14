#!/usr/bin/env tsx

/**
 * TD Realty Ohio - Media Ingestion Pipeline
 *
 * Downloads legally-reusable images from Openverse and Wikimedia Commons,
 * converts to WebP, uploads to R2, and generates manifest with attribution.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'crypto';

// Configuration
const TOPICS_FILE = 'media/topics.json';
const OUTPUT_DIR = 'public/media';
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'manifest.json');
const HEALTH_FILE = path.join(OUTPUT_DIR, 'health.json');
const MIN_WIDTH = 1600;
const ALLOWED_LICENSES = ['cc0', 'pdm', 'cc-by', 'cc-by-sa'];
const MAX_PAGES = 5;
const PAGE_SIZE = 20;
const TARGET_IMAGES_PER_TOPIC = 2;

// Environment variables
const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
};

const OPENVERSE_USER_AGENT = process.env.OPENVERSE_USER_AGENT || 'TDRealtyOhio/2.0 (https://tdrealtyohio.com)';

// Check if R2 is configured
const isR2Configured = Boolean(
  R2_CONFIG.accountId &&
  R2_CONFIG.accessKeyId &&
  R2_CONFIG.secretAccessKey &&
  R2_CONFIG.bucket &&
  R2_CONFIG.publicBaseUrl
);

// Initialize R2 client
let s3Client: S3Client | null = null;
if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_CONFIG.accessKeyId!,
      secretAccessKey: R2_CONFIG.secretAccessKey!,
    },
  });
}

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

interface TopicsConfig {
  [category: string]: string[];
}

interface HealthReport {
  timestamp: string;
  totalImages: number;
  byTopic: Record<string, number>;
  r2Configured: boolean;
}

/**
 * Read topics configuration
 */
async function loadTopics(): Promise<TopicsConfig> {
  const content = await fs.readFile(TOPICS_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Search Openverse API
 */
async function searchOpenverse(query: string, page: number = 1): Promise<any[]> {
  try {
    const response = await axios.get('https://api.openverse.org/v1/images/', {
      params: {
        q: query,
        page,
        page_size: PAGE_SIZE,
        license: ALLOWED_LICENSES.join(','),
        mature: false,
      },
      headers: {
        'User-Agent': OPENVERSE_USER_AGENT,
      },
      timeout: 10000,
    });

    return response.data.results || [];
  } catch (error: any) {
    console.warn(`⚠️  Openverse search failed for "${query}": ${error.message}`);
    return [];
  }
}

/**
 * Search Wikimedia Commons API
 */
async function searchWikimedia(query: string): Promise<any[]> {
  try {
    const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
      params: {
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: query,
        gsrnamespace: 6, // File namespace
        gsrlimit: 20,
        prop: 'imageinfo',
        iiprop: 'url|size|extmetadata',
        iiurlwidth: MIN_WIDTH,
      },
      timeout: 10000,
    });

    if (!response.data.query?.pages) {
      return [];
    }

    const pages = Object.values(response.data.query.pages) as any[];
    const results = [];

    for (const page of pages) {
      const imageInfo = page.imageinfo?.[0];
      if (!imageInfo) continue;

      const metadata = imageInfo.extmetadata || {};
      const license = metadata.License?.value || metadata.LicenseShortName?.value || 'unknown';

      // Only accept CC0, PDM, CC-BY, CC-BY-SA
      const normalizedLicense = license.toLowerCase().replace(/\s+/g, '-');
      if (!ALLOWED_LICENSES.some(l => normalizedLicense.includes(l))) {
        continue;
      }

      results.push({
        id: `wikimedia_${page.pageid}`,
        url: imageInfo.url,
        width: imageInfo.width,
        height: imageInfo.height,
        creator: metadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Unknown',
        license: license,
        license_url: metadata.LicenseUrl?.value || 'https://commons.wikimedia.org/wiki/Commons:Licensing',
        title: page.title?.replace('File:', '') || '',
        foreign_landing_url: imageInfo.descriptionurl,
      });
    }

    return results;
  } catch (error: any) {
    console.warn(`⚠️  Wikimedia search failed for "${query}": ${error.message}`);
    return [];
  }
}

/**
 * Download image
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024, // 50MB max
    });
    return Buffer.from(response.data);
  } catch (error: any) {
    console.warn(`⚠️  Download failed for ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Convert image to WebP
 */
async function convertToWebP(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || metadata.width < MIN_WIDTH) {
      return null;
    }

    const webpBuffer = await image
      .webp({ quality: 85 })
      .toBuffer();

    return {
      buffer: webpBuffer,
      width: metadata.width,
      height: metadata.height || 0,
    };
  } catch (error: any) {
    console.warn(`⚠️  WebP conversion failed: ${error.message}`);
    return null;
  }
}

/**
 * Upload to R2
 */
async function uploadToR2(buffer: Buffer, filename: string): Promise<string | null> {
  if (!s3Client || !isR2Configured) {
    return null;
  }

  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: R2_CONFIG.bucket!,
        Key: filename,
        Body: buffer,
        ContentType: 'image/webp',
      },
    });

    await upload.done();
    return `${R2_CONFIG.publicBaseUrl}/${filename}`;
  } catch (error: any) {
    console.error(`❌ R2 upload failed for ${filename}: ${error.message}`);
    return null;
  }
}

/**
 * Generate unique filename
 */
function generateFilename(query: string, index: number): string {
  const hash = crypto.createHash('md5').update(`${query}-${index}-${Date.now()}`).digest('hex').substring(0, 8);
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${slug}-${hash}.webp`;
}

/**
 * Process a single query
 */
async function processQuery(query: string, topic: string): Promise<ImageMetadata[]> {
  console.log(`\n🔍 Searching for "${query}"...`);

  const images: ImageMetadata[] = [];
  let foundCount = 0;

  // Try Openverse first
  for (let page = 1; page <= MAX_PAGES && foundCount < TARGET_IMAGES_PER_TOPIC; page++) {
    const results = await searchOpenverse(query, page);

    for (const result of results) {
      if (foundCount >= TARGET_IMAGES_PER_TOPIC) break;

      // Filter by dimensions
      if (result.width < MIN_WIDTH) continue;

      console.log(`  📥 Downloading: ${result.title || result.id}`);

      // Download and convert
      const imageBuffer = await downloadImage(result.url);
      if (!imageBuffer) continue;

      const converted = await convertToWebP(imageBuffer);
      if (!converted) continue;

      // Upload to R2 or use source URL
      const filename = generateFilename(query, foundCount);
      let cdnUrl: string;

      if (isR2Configured) {
        const uploadedUrl = await uploadToR2(converted.buffer, filename);
        if (!uploadedUrl) continue;
        cdnUrl = uploadedUrl;
      } else {
        // Local dev fallback - use source URL
        cdnUrl = result.url;
      }

      // Create metadata
      const metadata: ImageMetadata = {
        id: result.id || `openverse_${Date.now()}_${foundCount}`,
        topic,
        cdnUrl,
        sourceUrl: result.foreign_landing_url || result.url,
        license: result.license || 'unknown',
        licenseUrl: result.license_url || '',
        creator: result.creator || 'Unknown',
        attribution: `Photo by ${result.creator || 'Unknown'} - ${result.license || 'Unknown License'}`,
        width: converted.width,
        height: converted.height,
        retrievedAt: new Date().toISOString(),
      };

      images.push(metadata);
      foundCount++;
      console.log(`  ✅ Added (${foundCount}/${TARGET_IMAGES_PER_TOPIC})`);
    }

    if (foundCount >= TARGET_IMAGES_PER_TOPIC) break;
  }

  // Fallback to Wikimedia if needed
  if (foundCount < TARGET_IMAGES_PER_TOPIC) {
    console.log(`  🔄 Trying Wikimedia Commons fallback...`);
    const wikiResults = await searchWikimedia(query);

    for (const result of wikiResults) {
      if (foundCount >= TARGET_IMAGES_PER_TOPIC) break;

      console.log(`  📥 Downloading from Wikimedia: ${result.title}`);

      const imageBuffer = await downloadImage(result.url);
      if (!imageBuffer) continue;

      const converted = await convertToWebP(imageBuffer);
      if (!converted) continue;

      const filename = generateFilename(query, foundCount);
      let cdnUrl: string;

      if (isR2Configured) {
        const uploadedUrl = await uploadToR2(converted.buffer, filename);
        if (!uploadedUrl) continue;
        cdnUrl = uploadedUrl;
      } else {
        cdnUrl = result.url;
      }

      const metadata: ImageMetadata = {
        id: result.id,
        topic,
        cdnUrl,
        sourceUrl: result.foreign_landing_url,
        license: result.license,
        licenseUrl: result.license_url,
        creator: result.creator,
        attribution: `Photo by ${result.creator} - ${result.license}`,
        width: converted.width,
        height: converted.height,
        retrievedAt: new Date().toISOString(),
      };

      images.push(metadata);
      foundCount++;
      console.log(`  ✅ Added from Wikimedia (${foundCount}/${TARGET_IMAGES_PER_TOPIC})`);
    }
  }

  if (foundCount === 0) {
    console.log(`  ⚠️  No suitable images found for "${query}"`);
  } else {
    console.log(`  ✨ Found ${foundCount} image(s) for "${query}"`);
  }

  return images;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 TD Realty Ohio - Media Sync Pipeline\n');

  // Check R2 configuration
  if (!isR2Configured) {
    console.log('⚠️  R2 not configured — using source URLs directly\n');
  } else {
    console.log('✅ R2 configured - images will be uploaded to CDN\n');
  }

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load topics
  const topics = await loadTopics();
  console.log(`📋 Loaded ${Object.keys(topics).length} topic categories\n`);

  // Process all queries
  const allImages: ImageMetadata[] = [];
  const topicCounts: Record<string, number> = {};

  for (const [topic, queries] of Object.entries(topics)) {
    console.log(`\n📂 Processing topic: ${topic}`);
    topicCounts[topic] = 0;

    for (const query of queries) {
      const images = await processQuery(query, topic);
      allImages.push(...images);
      topicCounts[topic] += images.length;
    }

    console.log(`✅ Topic "${topic}" complete: ${topicCounts[topic]} images`);
  }

  // Write manifest
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(allImages, null, 2));
  console.log(`\n📝 Manifest written: ${MANIFEST_FILE}`);
  console.log(`   Total images: ${allImages.length}`);

  // Write health report
  const health: HealthReport = {
    timestamp: new Date().toISOString(),
    totalImages: allImages.length,
    byTopic: topicCounts,
    r2Configured: isR2Configured,
  };

  await fs.writeFile(HEALTH_FILE, JSON.stringify(health, null, 2));
  console.log(`\n📊 Health report written: ${HEALTH_FILE}`);

  // Summary
  console.log('\n✨ Media sync complete!');
  console.log(`   Total images: ${allImages.length}`);
  console.log(`   By topic:`);
  for (const [topic, count] of Object.entries(topicCounts)) {
    console.log(`     - ${topic}: ${count}`);
  }

  if (!isR2Configured) {
    console.log('\n⚠️  Note: Images are using source URLs (R2 not configured)');
  }
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
