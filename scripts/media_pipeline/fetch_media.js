#!/usr/bin/env node

/**
 * TD Realty Ohio - Multi-Source Legal Media Pipeline
 *
 * Fetches media from multiple legal sources:
 * - Pexels (photos + videos)
 * - Pixabay (photos + videos)
 * - Unsplash (photos)
 * - Wikimedia Commons (photos)
 *
 * All media is fetched via official APIs with proper license verification.
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const CONFIG_FILE = 'media-sources.json';
const RAW_IMAGES_DIR = 'assets/media/images';
const RAW_VIDEOS_DIR = 'assets/media/videos';
const FETCHED_DATA_FILE = 'assets/media/fetched_data.json';

/**
 * Load configuration from JSON file
 */
async function loadConfig() {
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error(`❌ Error loading config file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Load or initialize fetched data tracking
 */
async function loadFetchedData() {
  try {
    const data = await fs.readFile(FETCHED_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {
      fetched_at: new Date().toISOString(),
      assets: []
    };
  }
}

/**
 * Save fetched data tracking
 */
async function saveFetchedData(data) {
  data.fetched_at = new Date().toISOString();
  await fs.writeFile(FETCHED_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Check if asset already fetched (by source + ID)
 */
function assetAlreadyFetched(fetchedData, source, assetId) {
  return fetchedData.assets.some(
    a => a.source === source && a.source_id === String(assetId)
  );
}

/**
 * Calculate SHA-256 checksum of buffer
 */
function calculateChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Download file from URL
 */
async function downloadFile(url, outputPath) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 50 * 1024 * 1024 // 50MB max
    });

    await fs.writeFile(outputPath, response.data);

    return {
      success: true,
      size: response.data.length,
      checksum: calculateChecksum(response.data)
    };
  } catch (error) {
    console.error(`  ⚠ Download failed: ${error.message}`);
    return { success: false };
  }
}

/**
 * Fetch photos from Pexels API
 */
async function fetchFromPexels(keywords, count, fetchedData) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log('  ⊘ PEXELS_API_KEY not set, skipping Pexels');
    return [];
  }

  console.log(`  🔍 Searching Pexels for: "${keywords}"`);
  const results = [];

  try {
    // Fetch photos
    const photoResponse = await axios.get('https://api.pexels.com/v1/search', {
      params: {
        query: keywords,
        per_page: count * 2,
        orientation: 'landscape'
      },
      headers: { 'Authorization': apiKey }
    });

    const photos = photoResponse.data.photos || [];

    for (const photo of photos.slice(0, count)) {
      if (assetAlreadyFetched(fetchedData, 'pexels', photo.id)) {
        console.log(`  ⊘ Pexels photo ${photo.id} already fetched`);
        continue;
      }

      const filename = `pexels-photo-${photo.id}.jpg`;
      const filepath = path.join(RAW_IMAGES_DIR, filename);

      console.log(`  ↓ Downloading Pexels photo ${photo.id}...`);
      const download = await downloadFile(photo.src.large2x, filepath);

      if (download.success) {
        results.push({
          source: 'pexels',
          source_id: String(photo.id),
          media_type: 'image',
          local_path: filepath,
          source_url: photo.url,
          author: photo.photographer,
          author_url: photo.photographer_url,
          license_name: 'Pexels License',
          license_url: 'https://www.pexels.com/license/',
          attribution_text: `Photo by ${photo.photographer} on Pexels`,
          attribution_required: false,
          width: photo.width,
          height: photo.height,
          checksum: download.checksum,
          file_size: download.size,
          keywords: keywords,
          fetched_at: new Date().toISOString()
        });
        console.log(`  ✓ Downloaded Pexels photo ${photo.id}`);
      }
    }
  } catch (error) {
    console.error(`  ⚠ Pexels API error: ${error.message}`);
  }

  return results;
}

/**
 * Fetch videos from Pexels API
 */
async function fetchVideosFromPexels(keywords, count, fetchedData) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return [];
  }

  console.log(`  🔍 Searching Pexels videos for: "${keywords}"`);
  const results = [];

  try {
    const videoResponse = await axios.get('https://api.pexels.com/videos/search', {
      params: {
        query: keywords,
        per_page: count * 2,
        orientation: 'landscape'
      },
      headers: { 'Authorization': apiKey }
    });

    const videos = videoResponse.data.videos || [];

    for (const video of videos.slice(0, count)) {
      if (assetAlreadyFetched(fetchedData, 'pexels-video', video.id)) {
        console.log(`  ⊘ Pexels video ${video.id} already fetched`);
        continue;
      }

      // Find HD or SD video file
      const videoFile = video.video_files.find(f =>
        f.quality === 'hd' || f.quality === 'sd'
      );

      if (!videoFile) continue;

      const filename = `pexels-video-${video.id}.mp4`;
      const filepath = path.join(RAW_VIDEOS_DIR, filename);

      console.log(`  ↓ Downloading Pexels video ${video.id}...`);
      const download = await downloadFile(videoFile.link, filepath);

      if (download.success) {
        results.push({
          source: 'pexels',
          source_id: String(video.id),
          media_type: 'video',
          local_path: filepath,
          source_url: video.url,
          author: video.user.name,
          author_url: video.user.url,
          license_name: 'Pexels License',
          license_url: 'https://www.pexels.com/license/',
          attribution_text: `Video by ${video.user.name} on Pexels`,
          attribution_required: false,
          width: video.width,
          height: video.height,
          duration: video.duration,
          checksum: download.checksum,
          file_size: download.size,
          keywords: keywords,
          fetched_at: new Date().toISOString()
        });
        console.log(`  ✓ Downloaded Pexels video ${video.id}`);
      }
    }
  } catch (error) {
    console.error(`  ⚠ Pexels video API error: ${error.message}`);
  }

  return results;
}

/**
 * Fetch photos from Pixabay API
 */
async function fetchFromPixabay(keywords, count, fetchedData) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    console.log('  ⊘ PIXABAY_API_KEY not set, skipping Pixabay');
    return [];
  }

  console.log(`  🔍 Searching Pixabay for: "${keywords}"`);
  const results = [];

  try {
    // Fetch photos
    const photoResponse = await axios.get('https://pixabay.com/api/', {
      params: {
        key: apiKey,
        q: keywords,
        per_page: count * 2,
        image_type: 'photo',
        orientation: 'horizontal',
        safesearch: 'true'
      }
    });

    const photos = photoResponse.data.hits || [];

    for (const photo of photos.slice(0, count)) {
      if (assetAlreadyFetched(fetchedData, 'pixabay', photo.id)) {
        console.log(`  ⊘ Pixabay photo ${photo.id} already fetched`);
        continue;
      }

      const filename = `pixabay-photo-${photo.id}.jpg`;
      const filepath = path.join(RAW_IMAGES_DIR, filename);

      console.log(`  ↓ Downloading Pixabay photo ${photo.id}...`);
      const download = await downloadFile(photo.largeImageURL, filepath);

      if (download.success) {
        results.push({
          source: 'pixabay',
          source_id: String(photo.id),
          media_type: 'image',
          local_path: filepath,
          source_url: photo.pageURL,
          author: photo.user,
          author_url: `https://pixabay.com/users/${photo.user}-${photo.user_id}/`,
          license_name: 'Pixabay License',
          license_url: 'https://pixabay.com/service/license/',
          attribution_text: `Image by ${photo.user} from Pixabay`,
          attribution_required: false,
          width: photo.imageWidth,
          height: photo.imageHeight,
          checksum: download.checksum,
          file_size: download.size,
          keywords: keywords,
          fetched_at: new Date().toISOString()
        });
        console.log(`  ✓ Downloaded Pixabay photo ${photo.id}`);
      }
    }
  } catch (error) {
    console.error(`  ⚠ Pixabay API error: ${error.message}`);
  }

  return results;
}

/**
 * Fetch videos from Pixabay API
 */
async function fetchVideosFromPixabay(keywords, count, fetchedData) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return [];
  }

  console.log(`  🔍 Searching Pixabay videos for: "${keywords}"`);
  const results = [];

  try {
    const videoResponse = await axios.get('https://pixabay.com/api/videos/', {
      params: {
        key: apiKey,
        q: keywords,
        per_page: count * 2,
        safesearch: 'true'
      }
    });

    const videos = videoResponse.data.hits || [];

    for (const video of videos.slice(0, count)) {
      if (assetAlreadyFetched(fetchedData, 'pixabay-video', video.id)) {
        console.log(`  ⊘ Pixabay video ${video.id} already fetched`);
        continue;
      }

      // Find medium or small video file
      const videoFile = video.videos.medium || video.videos.small;
      if (!videoFile) continue;

      const filename = `pixabay-video-${video.id}.mp4`;
      const filepath = path.join(RAW_VIDEOS_DIR, filename);

      console.log(`  ↓ Downloading Pixabay video ${video.id}...`);
      const download = await downloadFile(videoFile.url, filepath);

      if (download.success) {
        results.push({
          source: 'pixabay',
          source_id: String(video.id),
          media_type: 'video',
          local_path: filepath,
          source_url: video.pageURL,
          author: video.user,
          author_url: `https://pixabay.com/users/${video.user}-${video.user_id}/`,
          license_name: 'Pixabay License',
          license_url: 'https://pixabay.com/service/license/',
          attribution_text: `Video by ${video.user} from Pixabay`,
          attribution_required: false,
          width: videoFile.width,
          height: videoFile.height,
          duration: video.duration,
          checksum: download.checksum,
          file_size: download.size,
          keywords: keywords,
          fetched_at: new Date().toISOString()
        });
        console.log(`  ✓ Downloaded Pixabay video ${video.id}`);
      }
    }
  } catch (error) {
    console.error(`  ⚠ Pixabay video API error: ${error.message}`);
  }

  return results;
}

/**
 * Fetch photos from Unsplash API
 */
async function fetchFromUnsplash(keywords, count, fetchedData) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) {
    console.log('  ⊘ UNSPLASH_ACCESS_KEY not set, skipping Unsplash');
    return [];
  }

  console.log(`  🔍 Searching Unsplash for: "${keywords}"`);
  const results = [];

  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: keywords,
        per_page: count * 2,
        orientation: 'landscape'
      },
      headers: {
        'Authorization': `Client-ID ${apiKey}`
      }
    });

    const photos = response.data.results || [];

    for (const photo of photos.slice(0, count)) {
      if (assetAlreadyFetched(fetchedData, 'unsplash', photo.id)) {
        console.log(`  ⊘ Unsplash photo ${photo.id} already fetched`);
        continue;
      }

      const filename = `unsplash-photo-${photo.id}.jpg`;
      const filepath = path.join(RAW_IMAGES_DIR, filename);

      console.log(`  ↓ Downloading Unsplash photo ${photo.id}...`);
      // Trigger download tracking as per Unsplash guidelines
      if (photo.links && photo.links.download_location) {
        try {
          await axios.get(photo.links.download_location, {
            headers: { 'Authorization': `Client-ID ${apiKey}` }
          });
        } catch (e) {
          console.log('  ⚠ Could not trigger Unsplash download tracking');
        }
      }

      const download = await downloadFile(photo.urls.full, filepath);

      if (download.success) {
        results.push({
          source: 'unsplash',
          source_id: String(photo.id),
          media_type: 'image',
          local_path: filepath,
          source_url: photo.links.html,
          author: photo.user.name,
          author_url: photo.user.links.html,
          license_name: 'Unsplash License',
          license_url: 'https://unsplash.com/license',
          attribution_text: `Photo by ${photo.user.name} on Unsplash`,
          attribution_required: true,
          width: photo.width,
          height: photo.height,
          checksum: download.checksum,
          file_size: download.size,
          keywords: keywords,
          fetched_at: new Date().toISOString()
        });
        console.log(`  ✓ Downloaded Unsplash photo ${photo.id}`);
      }
    }
  } catch (error) {
    console.error(`  ⚠ Unsplash API error: ${error.message}`);
  }

  return results;
}

/**
 * Fetch photos from Wikimedia Commons
 * Only accepts files with reuse-friendly licenses
 */
async function fetchFromWikimedia(keywords, count, fetchedData) {
  console.log(`  🔍 Searching Wikimedia Commons for: "${keywords}"`);
  const results = [];

  // Licenses that allow reuse
  const ALLOWED_LICENSES = [
    'cc-zero',
    'cc-by-sa-4.0',
    'cc-by-4.0',
    'cc-by-sa-3.0',
    'cc-by-3.0',
    'pd'
  ];

  try {
    // Search for images
    const searchResponse = await axios.get('https://commons.wikimedia.org/w/api.php', {
      params: {
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrnamespace: 6, // File namespace
        gsrsearch: keywords,
        gsrlimit: count * 3,
        prop: 'imageinfo',
        iiprop: 'url|size|extmetadata',
        iiurlwidth: 2000
      }
    });

    const pages = searchResponse.data.query?.pages;
    if (!pages) return results;

    const pageList = Object.values(pages).slice(0, count * 2);

    for (const page of pageList) {
      if (!page.imageinfo || !page.imageinfo[0]) continue;

      const imageInfo = page.imageinfo[0];
      const extmetadata = imageInfo.extmetadata || {};

      // Check license
      const licenseShortName = extmetadata.LicenseShortName?.value || '';
      const isAllowedLicense = ALLOWED_LICENSES.some(lic =>
        licenseShortName.toLowerCase().includes(lic)
      );

      if (!isAllowedLicense) {
        console.log(`  ⊘ Wikimedia file ${page.title} has restricted license: ${licenseShortName}`);
        continue;
      }

      const fileId = page.pageid;
      if (assetAlreadyFetched(fetchedData, 'wikimedia', fileId)) {
        console.log(`  ⊘ Wikimedia file ${fileId} already fetched`);
        continue;
      }

      // Skip if too small
      if (imageInfo.width < 1600 || imageInfo.height < 900) {
        console.log(`  ⊘ Wikimedia file ${page.title} too small: ${imageInfo.width}x${imageInfo.height}`);
        continue;
      }

      const filename = `wikimedia-photo-${fileId}.jpg`;
      const filepath = path.join(RAW_IMAGES_DIR, filename);

      console.log(`  ↓ Downloading Wikimedia file ${page.title}...`);
      const download = await downloadFile(imageInfo.url, filepath);

      if (download.success) {
        const artist = extmetadata.Artist?.value || 'Unknown';
        const licenseUrl = extmetadata.LicenseUrl?.value || 'https://commons.wikimedia.org/wiki/Commons:Licensing';

        results.push({
          source: 'wikimedia',
          source_id: String(fileId),
          media_type: 'image',
          local_path: filepath,
          source_url: imageInfo.descriptionurl,
          author: artist.replace(/<[^>]*>/g, ''), // Strip HTML tags
          author_url: imageInfo.descriptionurl,
          license_name: licenseShortName,
          license_url: licenseUrl,
          attribution_text: `${artist} via Wikimedia Commons (${licenseShortName})`,
          attribution_required: !licenseShortName.toLowerCase().includes('cc-zero') && !licenseShortName.toLowerCase().includes('pd'),
          width: imageInfo.width,
          height: imageInfo.height,
          checksum: download.checksum,
          file_size: download.size,
          keywords: keywords,
          fetched_at: new Date().toISOString()
        });
        console.log(`  ✓ Downloaded Wikimedia file ${page.title}`);

        if (results.length >= count) break;
      }
    }
  } catch (error) {
    console.error(`  ⚠ Wikimedia API error: ${error.message}`);
  }

  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 TD Realty Ohio - Multi-Source Legal Media Pipeline\n');
  console.log('📥 Fetching media from multiple legal sources...\n');

  const config = await loadConfig();
  const fetchedData = await loadFetchedData();

  const allFetchedAssets = [];

  // Process each page configuration
  for (const [pageKey, pageConfig] of Object.entries(config.pages)) {
    console.log(`\n📄 Processing page: ${pageKey}`);

    const keywords = pageConfig.keywords[0]; // Use first keyword for now
    const imageCount = pageConfig.media_count.images;
    const videoCount = pageConfig.media_count.videos;

    let pageFetched = [];

    // Fetch images from all sources
    if (imageCount > 0 && config.sources.pexels.enabled) {
      const pexelsImages = await fetchFromPexels(keywords, 1, fetchedData);
      pageFetched.push(...pexelsImages);
    }

    if (imageCount > 0 && config.sources.pixabay.enabled) {
      const pixabayImages = await fetchFromPixabay(keywords, 1, fetchedData);
      pageFetched.push(...pixabayImages);
    }

    if (imageCount > 0 && config.sources.unsplash.enabled) {
      const unsplashImages = await fetchFromUnsplash(keywords, 1, fetchedData);
      pageFetched.push(...unsplashImages);
    }

    if (imageCount > 0 && config.sources.wikimedia.enabled) {
      const wikimediaImages = await fetchFromWikimedia(keywords, 1, fetchedData);
      pageFetched.push(...wikimediaImages);
    }

    // Fetch videos if requested
    if (videoCount > 0 && pageConfig.prefer_video) {
      if (config.sources.pexels.enabled) {
        const pexelsVideos = await fetchVideosFromPexels(keywords, videoCount, fetchedData);
        pageFetched.push(...pexelsVideos);
      }
      if (config.sources.pixabay.enabled) {
        const pixabayVideos = await fetchVideosFromPixabay(keywords, videoCount, fetchedData);
        pageFetched.push(...pixabayVideos);
      }
    }

    // Tag assets with page key
    pageFetched.forEach(asset => {
      asset.page_key = pageKey;
    });

    allFetchedAssets.push(...pageFetched);
    console.log(`  ✓ Fetched ${pageFetched.length} assets for ${pageKey}`);
  }

  // Update fetched data tracking
  fetchedData.assets.push(...allFetchedAssets);
  await saveFetchedData(fetchedData);

  console.log(`\n✅ Fetch complete!`);
  console.log(`   Total assets fetched: ${allFetchedAssets.length}`);
  console.log(`   Images: ${allFetchedAssets.filter(a => a.media_type === 'image').length}`);
  console.log(`   Videos: ${allFetchedAssets.filter(a => a.media_type === 'video').length}`);
  console.log(`\n📦 Data saved to: ${FETCHED_DATA_FILE}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
