#!/usr/bin/env node

/**
 * Fetch Central Ohio specific images from Pexels, Unsplash, and Pixabay
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PEXELS_KEY = process.env.PEXELS_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'images', 'photos');
const URLS_FILE = path.join(__dirname, '..', 'image-urls.json');

// Simplified search queries that work better with APIs
const IMAGE_SEARCHES = [
  { id: 'hero-home', queries: ['suburban home', 'house exterior', 'residential neighborhood'] },
  { id: 'columbus-skyline', queries: ['city skyline', 'downtown cityscape', 'urban skyline'] },
  { id: 'westerville', queries: ['small town street', 'tree lined neighborhood', 'suburban street'] },
  { id: 'dublin-ohio', queries: ['luxury home', 'modern house exterior', 'upscale home'] },
  { id: 'powell', queries: ['family home exterior', 'suburban house', 'residential home'] },
  { id: 'gahanna', queries: ['neighborhood park', 'suburban community', 'green neighborhood'] },
  { id: 'new-albany', queries: ['estate home', 'large house', 'mansion exterior'] },
  { id: 'hilliard', queries: ['midwest home', 'brick house', 'family house'] },
  { id: 'delaware', queries: ['historic downtown', 'main street america', 'small town'] },
];

function httpsGet(url, headers = {}) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers,
        timeout: 15000
      };

      const req = https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data: null, raw: data });
          }
        });
      });

      req.on('error', (err) => {
        console.log(`  Network error: ${err.message}`);
        resolve({ status: 0, data: null });
      });

      req.on('timeout', () => {
        req.destroy();
        console.log(`  Request timeout`);
        resolve({ status: 0, data: null });
      });
    } catch (err) {
      console.log(`  URL error: ${err.message}`);
      resolve({ status: 0, data: null });
    }
  });
}

async function searchPexels(query) {
  if (!PEXELS_KEY) {
    console.log(`    Pexels: no API key`);
    return null;
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
  console.log(`    Pexels: searching...`);
  const { status, data } = await httpsGet(url, { Authorization: PEXELS_KEY });

  if (status === 200 && data?.photos?.length > 0) {
    console.log(`    Pexels: found ${data.photos.length} results`);
    return data.photos.map(p => ({
      url: p.src.large2x || p.src.large,
      photographer: p.photographer,
      source: 'Pexels',
      sourceUrl: p.url
    }));
  }
  console.log(`    Pexels: no results (status: ${status})`);
  return null;
}

async function searchUnsplash(query) {
  if (!UNSPLASH_KEY) {
    console.log(`    Unsplash: no API key`);
    return null;
  }

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
  console.log(`    Unsplash: searching...`);
  const { status, data } = await httpsGet(url, { Authorization: `Client-ID ${UNSPLASH_KEY}` });

  if (status === 200 && data?.results?.length > 0) {
    console.log(`    Unsplash: found ${data.results.length} results`);
    return data.results.map(p => ({
      url: p.urls.regular,
      photographer: p.user.name,
      source: 'Unsplash',
      sourceUrl: p.links.html
    }));
  }
  console.log(`    Unsplash: no results (status: ${status})`);
  return null;
}

async function searchPixabay(query) {
  if (!PIXABAY_KEY) {
    console.log(`    Pixabay: no API key`);
    return null;
  }

  const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=3&safesearch=true`;
  console.log(`    Pixabay: searching...`);
  const { status, data } = await httpsGet(url);

  if (status === 200 && data?.hits?.length > 0) {
    console.log(`    Pixabay: found ${data.hits.length} results`);
    return data.hits.map(p => ({
      url: p.largeImageURL,
      photographer: p.user,
      source: 'Pixabay',
      sourceUrl: p.pageURL
    }));
  }
  console.log(`    Pixabay: no results (status: ${status})`);
  return null;
}

async function findBestImage(search) {
  console.log(`\n[${search.id}]`);

  for (const query of search.queries) {
    console.log(`  Query: "${query}"`);

    let results = await searchPexels(query);
    if (results?.length > 0) return { ...results[0], query, searchId: search.id };

    results = await searchUnsplash(query);
    if (results?.length > 0) return { ...results[0], query, searchId: search.id };

    results = await searchPixabay(query);
    if (results?.length > 0) return { ...results[0], query, searchId: search.id };

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`  No results found`);
  return null;
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(filepath); } catch (e) {}
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      try { fs.unlinkSync(filepath); } catch (e) {}
      reject(err);
    });
  });
}

async function main() {
  console.log('='.repeat(50));
  console.log('Central Ohio Image Fetcher');
  console.log('='.repeat(50));
  console.log('');

  console.log('API Keys:');
  console.log(`  PEXELS_API_KEY: ${PEXELS_KEY ? 'SET (' + PEXELS_KEY.slice(0, 8) + '...)' : 'NOT SET'}`);
  console.log(`  UNSPLASH_ACCESS_KEY: ${UNSPLASH_KEY ? 'SET (' + UNSPLASH_KEY.slice(0, 8) + '...)' : 'NOT SET'}`);
  console.log(`  PIXABAY_API_KEY: ${PIXABAY_KEY ? 'SET (' + PIXABAY_KEY.slice(0, 8) + '...)' : 'NOT SET'}`);

  const availableApis = [PEXELS_KEY && 'Pexels', UNSPLASH_KEY && 'Unsplash', PIXABAY_KEY && 'Pixabay'].filter(Boolean);

  if (availableApis.length === 0) {
    console.error('\nERROR: No API keys found!');
    console.error('Set at least one: PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, or PIXABAY_API_KEY');
    process.exit(1);
  }

  console.log(`\nUsing APIs: ${availableApis.join(', ')}`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created: ${OUTPUT_DIR}`);
  }

  const results = {};
  const attributions = [];
  let downloaded = 0;

  for (const search of IMAGE_SEARCHES) {
    const image = await findBestImage(search);

    if (image) {
      results[search.id] = image.url;
      attributions.push({
        id: search.id,
        photographer: image.photographer,
        source: image.source,
        sourceUrl: image.sourceUrl
      });

      const filepath = path.join(OUTPUT_DIR, `${search.id}.jpg`);
      try {
        console.log(`  Downloading...`);
        await downloadImage(image.url, filepath);
        console.log(`  Saved: ${search.id}.jpg`);
        downloaded++;
      } catch (e) {
        console.log(`  Download failed: ${e.message}`);
      }
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Save results
  fs.writeFileSync(URLS_FILE, JSON.stringify(results, null, 2));
  console.log(`\nSaved: image-urls.json`);

  if (attributions.length > 0) {
    const attrFile = path.join(OUTPUT_DIR, 'ATTRIBUTIONS.md');
    const content = `# Image Attributions\n\n${attributions.map(a =>
      `- **${a.id}**: Photo by ${a.photographer} on [${a.source}](${a.sourceUrl})`
    ).join('\n')}\n\nGenerated: ${new Date().toISOString()}\n`;
    fs.writeFileSync(attrFile, content);
    console.log('Saved: ATTRIBUTIONS.md');
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Downloaded ${downloaded} of ${IMAGE_SEARCHES.length} images`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
