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

// Central Ohio specific search queries
const IMAGE_SEARCHES = [
  { id: 'hero-home', queries: ['columbus ohio suburban home', 'ohio residential neighborhood', 'midwest family home exterior'], size: 'large' },
  { id: 'columbus-skyline', queries: ['columbus ohio skyline', 'columbus ohio downtown', 'columbus ohio cityscape'], size: 'large' },
  { id: 'westerville', queries: ['westerville ohio', 'uptown westerville', 'ohio small town main street'], size: 'medium' },
  { id: 'dublin-ohio', queries: ['dublin ohio bridge', 'dublin ohio historic', 'ohio suburban community'], size: 'medium' },
  { id: 'powell', queries: ['powell ohio', 'ohio liberty township', 'delaware county ohio homes'], size: 'medium' },
  { id: 'gahanna', queries: ['gahanna ohio creekside', 'gahanna ohio', 'ohio suburban neighborhood fall'], size: 'medium' },
  { id: 'new-albany', queries: ['new albany ohio', 'ohio luxury homes', 'upscale ohio neighborhood'], size: 'medium' },
  { id: 'hilliard', queries: ['hilliard ohio', 'franklin county ohio suburb', 'ohio family neighborhood'], size: 'medium' },
  { id: 'delaware', queries: ['delaware ohio downtown', 'delaware county ohio', 'ohio historic downtown'], size: 'medium' },
  { id: 'short-north', queries: ['short north columbus ohio', 'columbus ohio victorian homes', 'columbus arts district'], size: 'medium' },
  { id: 'german-village', queries: ['german village columbus ohio', 'columbus ohio brick homes', 'historic columbus ohio'], size: 'medium' },
  { id: 'sold-sign', queries: ['home sold sign', 'real estate sold', 'house sold celebration'], size: 'medium' },
  { id: 'keys-handover', queries: ['house keys new home', 'realtor keys handover', 'new homeowner keys'], size: 'medium' },
  { id: 'home-inspection', queries: ['home inspection', 'house inspector', 'property inspection'], size: 'medium' },
];

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function searchPexels(query) {
  if (!PEXELS_KEY) return null;

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    const { status, data } = await httpsGet(url, { Authorization: PEXELS_KEY });

    if (status === 200 && data?.photos?.length > 0) {
      return data.photos.map(p => ({
        url: p.src.large2x || p.src.large,
        thumb: p.src.medium,
        photographer: p.photographer,
        source: 'Pexels',
        sourceUrl: p.url
      }));
    }
  } catch (e) {
    console.error(`Pexels error: ${e.message}`);
  }
  return null;
}

async function searchUnsplash(query) {
  if (!UNSPLASH_KEY) return null;

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    const { status, data } = await httpsGet(url, { Authorization: `Client-ID ${UNSPLASH_KEY}` });

    if (status === 200 && data?.results?.length > 0) {
      return data.results.map(p => ({
        url: p.urls.regular,
        thumb: p.urls.small,
        photographer: p.user.name,
        source: 'Unsplash',
        sourceUrl: p.links.html
      }));
    }
  } catch (e) {
    console.error(`Unsplash error: ${e.message}`);
  }
  return null;
}

async function searchPixabay(query) {
  if (!PIXABAY_KEY) return null;

  try {
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=5`;
    const { status, data } = await httpsGet(url);

    if (status === 200 && data?.hits?.length > 0) {
      return data.hits.map(p => ({
        url: p.largeImageURL,
        thumb: p.previewURL,
        photographer: p.user,
        source: 'Pixabay',
        sourceUrl: p.pageURL
      }));
    }
  } catch (e) {
    console.error(`Pixabay error: ${e.message}`);
  }
  return null;
}

async function findBestImage(search) {
  console.log(`\nSearching for: ${search.id}`);

  for (const query of search.queries) {
    console.log(`  Trying: "${query}"`);

    // Try each API
    let results = await searchPexels(query);
    if (results?.length > 0) {
      console.log(`    Found ${results.length} from Pexels`);
      return { ...results[0], query, searchId: search.id };
    }

    results = await searchUnsplash(query);
    if (results?.length > 0) {
      console.log(`    Found ${results.length} from Unsplash`);
      return { ...results[0], query, searchId: search.id };
    }

    results = await searchPixabay(query);
    if (results?.length > 0) {
      console.log(`    Found ${results.length} from Pixabay`);
      return { ...results[0], query, searchId: search.id };
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`  No results found for ${search.id}`);
  return null;
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('=================================');
  console.log('Central Ohio Image Fetcher');
  console.log('=================================');

  if (!PEXELS_KEY && !UNSPLASH_KEY && !PIXABAY_KEY) {
    console.error('No API keys found. Set PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, or PIXABAY_API_KEY');
    process.exit(1);
  }

  console.log(`APIs available: ${[PEXELS_KEY && 'Pexels', UNSPLASH_KEY && 'Unsplash', PIXABAY_KEY && 'Pixabay'].filter(Boolean).join(', ')}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = {};
  const attributions = [];

  for (const search of IMAGE_SEARCHES) {
    const image = await findBestImage(search);

    if (image) {
      results[search.id] = image.url;
      attributions.push({
        id: search.id,
        photographer: image.photographer,
        source: image.source,
        sourceUrl: image.sourceUrl,
        query: image.query
      });

      // Download the image
      const ext = image.url.includes('.png') ? 'png' : 'jpg';
      const filepath = path.join(OUTPUT_DIR, `${search.id}.${ext}`);

      try {
        console.log(`  Downloading to ${search.id}.${ext}...`);
        await downloadImage(image.url, filepath);
        console.log(`  Saved!`);
      } catch (e) {
        console.error(`  Download failed: ${e.message}`);
      }
    }

    // Rate limiting between searches
    await new Promise(r => setTimeout(r, 500));
  }

  // Save URL mapping
  fs.writeFileSync(URLS_FILE, JSON.stringify(results, null, 2));
  console.log(`\nSaved URL mapping to image-urls.json`);

  // Save attributions
  const attrFile = path.join(OUTPUT_DIR, 'ATTRIBUTIONS.md');
  const attrContent = `# Image Attributions

These images are used under their respective licenses.

| Image | Photographer | Source |
|-------|--------------|--------|
${attributions.map(a => `| ${a.id} | ${a.photographer} | [${a.source}](${a.sourceUrl}) |`).join('\n')}

Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(attrFile, attrContent);
  console.log('Saved attributions to ATTRIBUTIONS.md');

  console.log('\n=================================');
  console.log(`Fetched ${Object.keys(results).length} images`);
  console.log('=================================');
}

main().catch(console.error);
