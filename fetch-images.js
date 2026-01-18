#!/usr/bin/env node

/**
 * TD Realty Ohio - Image Fetcher Script
 *
 * This script downloads real estate images from the Pexels API
 * and creates an attribution file for proper credit.
 *
 * Usage:
 *   PEXELS_API_KEY=your_api_key node fetch-images.js
 *
 * If no API key is provided, the script will display fallback URLs
 * from Unsplash that can be used directly without downloading.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const IMAGES_DIR = path.join(__dirname, 'assets', 'images');

// Image specifications with search queries
const IMAGE_SPECS = [
  { filename: 'hero-home.jpg', query: 'suburban home exterior', description: 'Hero image for homepage' },
  { filename: 'area-columbus.jpg', query: 'columbus ohio skyline', description: 'Columbus city skyline' },
  { filename: 'area-westerville.jpg', query: 'suburban neighborhood street', description: 'Suburban neighborhood' },
  { filename: 'area-dublin.jpg', query: 'luxury home exterior', description: 'Upscale home' },
  { filename: 'area-powell.jpg', query: 'family neighborhood homes', description: 'Family neighborhood' },
  { filename: 'area-gahanna.jpg', query: 'residential street houses', description: 'Residential street' },
  { filename: 'area-newalbany.jpg', query: 'upscale home exterior', description: 'Upscale home' },
  { filename: 'area-hilliard.jpg', query: 'midwest suburban home', description: 'Midwest suburban home' },
  { filename: 'interior-living.jpg', query: 'living room interior', description: 'Living room' },
  { filename: 'interior-kitchen.jpg', query: 'modern kitchen interior', description: 'Kitchen' },
  { filename: 'sold-sign.jpg', query: 'home sold sign', description: 'Sold sign' },
  { filename: 'buyers-keys.jpg', query: 'house keys handoff', description: 'Keys handoff' }
];

// Fallback URLs from Unsplash (work without API key)
const FALLBACK_URLS = {
  'hero-home.jpg': 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600&q=80',
  'area-columbus.jpg': 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&q=80',
  'area-westerville.jpg': 'https://images.unsplash.com/photo-1592595896616-c37162298647?w=600&q=80',
  'area-dublin.jpg': 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80',
  'area-powell.jpg': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80',
  'area-gahanna.jpg': 'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=600&q=80',
  'area-newalbany.jpg': 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=600&q=80',
  'area-hilliard.jpg': 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80',
  'interior-living.jpg': 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&q=80',
  'interior-kitchen.jpg': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
  'sold-sign.jpg': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  'buyers-keys.jpg': 'https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&q=80'
};

/**
 * Make an HTTPS request and return the response as JSON
 */
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: headers
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse JSON response'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download a file from URL and save to disk
 */
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Search Pexels API for an image
 */
async function searchPexels(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const data = await fetchJson(url, { Authorization: PEXELS_API_KEY });

  if (data.photos && data.photos.length > 0) {
    const photo = data.photos[0];
    return {
      url: photo.src.large2x || photo.src.large,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      pexelsUrl: photo.url
    };
  }

  return null;
}

/**
 * Main function to fetch all images
 */
async function main() {
  console.log('TD Realty Ohio - Image Fetcher\n');

  // Check for API key
  if (!PEXELS_API_KEY) {
    console.log('No PEXELS_API_KEY environment variable found.\n');
    console.log('The site currently uses Unsplash URLs directly in the HTML.');
    console.log('If you want to download and host images locally, you can:\n');
    console.log('1. Get a free Pexels API key at: https://www.pexels.com/api/');
    console.log('2. Run: PEXELS_API_KEY=your_key node fetch-images.js\n');
    console.log('Fallback URLs currently in use:\n');

    Object.entries(FALLBACK_URLS).forEach(([filename, url]) => {
      console.log(`  ${filename}:`);
      console.log(`    ${url}\n`);
    });

    return;
  }

  // Create images directory if it doesn't exist
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log(`Created directory: ${IMAGES_DIR}\n`);
  }

  const attributions = [];

  // Fetch each image
  for (const spec of IMAGE_SPECS) {
    console.log(`Searching for: ${spec.description} (${spec.query})`);

    try {
      const result = await searchPexels(spec.query);

      if (result) {
        const filepath = path.join(IMAGES_DIR, spec.filename);
        console.log(`  Downloading from Pexels...`);
        await downloadFile(result.url, filepath);
        console.log(`  Saved: ${spec.filename}`);

        attributions.push({
          filename: spec.filename,
          photographer: result.photographer,
          photographerUrl: result.photographerUrl,
          source: 'Pexels',
          sourceUrl: result.pexelsUrl
        });
      } else {
        console.log(`  No results found, using fallback URL`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
      console.log(`  Use fallback: ${FALLBACK_URLS[spec.filename]}`);
    }

    // Rate limiting - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Write attribution file
  if (attributions.length > 0) {
    const attributionText = `TD Realty Ohio - Image Attributions
=====================================

The following images were obtained from Pexels (https://www.pexels.com)
and are used under the Pexels License.

${attributions.map(a => `
${a.filename}
  Photographer: ${a.photographer}
  Profile: ${a.photographerUrl}
  Source: ${a.sourceUrl}
`).join('\n')}

---
Generated: ${new Date().toISOString()}
`;

    fs.writeFileSync(path.join(IMAGES_DIR, 'ATTRIBUTION.txt'), attributionText);
    console.log('\nAttribution file created: assets/images/ATTRIBUTION.txt');
  }

  console.log('\nDone!');
}

// Run
main().catch(console.error);
