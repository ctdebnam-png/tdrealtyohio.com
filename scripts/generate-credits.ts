#!/usr/bin/env tsx

/**
 * TD Realty Ohio - Image Credits Page Generator
 *
 * Generates image-credits.html from manifest
 */

import fs from 'fs/promises';

const MANIFEST_FILE = 'public/media/manifest.json';
const OUTPUT_FILE = 'image-credits.html';

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
    console.warn('⚠️  Manifest not found');
    return [];
  }
}

/**
 * Format license name
 */
function formatLicense(license: string): string {
  const normalized = license.toLowerCase();
  if (normalized.includes('cc0') || normalized.includes('cc-0')) return 'CC0 1.0 Universal (Public Domain)';
  if (normalized.includes('pdm') || normalized.includes('public domain')) return 'Public Domain Mark';
  if (normalized.includes('cc-by-sa')) return 'CC BY-SA';
  if (normalized.includes('cc-by')) return 'CC BY';
  return license;
}

/**
 * Group images by topic
 */
function groupByTopic(manifest: ImageMetadata[]): Record<string, ImageMetadata[]> {
  const groups: Record<string, ImageMetadata[]> = {};
  for (const image of manifest) {
    if (!groups[image.topic]) {
      groups[image.topic] = [];
    }
    groups[image.topic].push(image);
  }
  return groups;
}

/**
 * Generate HTML
 */
function generateHTML(manifest: ImageMetadata[]): string {
  const groupedImages = groupByTopic(manifest);
  const lastUpdated = manifest.length > 0 ? new Date(manifest[0].retrievedAt).toLocaleDateString() : 'N/A';

  let imageRows = '';
  let index = 1;

  for (const [topic, images] of Object.entries(groupedImages)) {
    imageRows += `
    <tr class="topic-header">
      <td colspan="6"><strong>${topic.charAt(0).toUpperCase() + topic.slice(1)}</strong></td>
    </tr>`;

    for (const image of images) {
      imageRows += `
    <tr>
      <td>${index++}</td>
      <td>
        <a href="${image.cdnUrl}" target="_blank" rel="noopener">
          <img src="${image.cdnUrl}" alt="${image.attribution}" width="120" height="80" style="object-fit: cover; border-radius: 4px;">
        </a>
      </td>
      <td>${image.creator}</td>
      <td>
        <a href="${image.licenseUrl}" target="_blank" rel="noopener">${formatLicense(image.license)}</a>
      </td>
      <td>
        <a href="${image.sourceUrl}" target="_blank" rel="noopener">View Source</a>
      </td>
      <td>${image.width} × ${image.height}</td>
    </tr>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Credits | TD Realty Ohio</title>
    <link rel="icon" type="image/svg+xml" href="assets/images/favicon.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/main.css">
    <style>
        .credits-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        .credits-header {
            margin-bottom: 40px;
        }
        .credits-header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .credits-header p {
            font-size: 1.1rem;
            color: #666;
        }
        .credits-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        .credits-table thead {
            background: #003366;
            color: white;
        }
        .credits-table th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        .credits-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        .credits-table tr:last-child td {
            border-bottom: none;
        }
        .credits-table tr:hover {
            background: #f9f9f9;
        }
        .topic-header td {
            background: #f5f5f5;
            font-weight: 600;
            padding: 15px;
            border-top: 2px solid #ddd;
        }
        .credits-table a {
            color: #003366;
            text-decoration: none;
        }
        .credits-table a:hover {
            text-decoration: underline;
        }
        .stats {
            display: flex;
            gap: 30px;
            margin-bottom: 30px;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .stat-item {
            text-align: center;
        }
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #003366;
        }
        .stat-label {
            font-size: 0.9rem;
            color: #666;
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="container">
            <a href="index.html" class="logo">TD Realty Ohio</a>
            <ul class="nav-links">
                <li><a href="index.html">Home</a></li>
                <li><a href="about.html">About</a></li>
                <li><a href="contact.html">Contact</a></li>
            </ul>
        </div>
    </nav>

    <div class="credits-container">
        <div class="credits-header">
            <h1>Image Credits & Attribution</h1>
            <p>All images on this website are from legally-reusable sources with proper licensing. We respect and acknowledge the work of all photographers and contributors.</p>
        </div>

        <div class="stats">
            <div class="stat-item">
                <div class="stat-number">${manifest.length}</div>
                <div class="stat-label">Total Images</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${Object.keys(groupedImages).length}</div>
                <div class="stat-label">Topics</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${lastUpdated}</div>
                <div class="stat-label">Last Updated</div>
            </div>
        </div>

        <table class="credits-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Preview</th>
                    <th>Creator</th>
                    <th>License</th>
                    <th>Source</th>
                    <th>Dimensions</th>
                </tr>
            </thead>
            <tbody>
${imageRows}
            </tbody>
        </table>

        <div style="margin-top: 40px; padding: 20px; background: #f9f9f9; border-radius: 8px;">
            <h3>License Information</h3>
            <ul>
                <li><strong>CC0 1.0 Universal:</strong> Public domain dedication. No attribution required, but we provide it for transparency.</li>
                <li><strong>Public Domain Mark:</strong> Works that are free of copyright restrictions.</li>
                <li><strong>CC BY:</strong> Attribution required. You're free to use, share, and adapt with proper credit.</li>
                <li><strong>CC BY-SA:</strong> Attribution and ShareAlike required. Derivative works must use the same license.</li>
            </ul>
            <p style="margin-top: 15px; color: #666;">
                All images are sourced from <a href="https://openverse.org" target="_blank">Openverse</a> and
                <a href="https://commons.wikimedia.org" target="_blank">Wikimedia Commons</a> through their official APIs.
            </p>
        </div>
    </div>

    <footer class="footer">
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} TD Realty Ohio, LLC. All rights reserved.</p>
            <p><a href="image-credits.html">Image Credits</a> | <a href="legal/privacy-policy.html">Privacy Policy</a></p>
        </div>
    </footer>
</body>
</html>`;
}

/**
 * Main execution
 */
async function main() {
  console.log('📄 TD Realty Ohio - Generate Image Credits\n');

  const manifest = await loadManifest();

  if (manifest.length === 0) {
    console.log('⚠️  No manifest found, creating empty credits page');
  } else {
    console.log(`📋 Loaded ${manifest.length} images from manifest`);
  }

  const html = generateHTML(manifest);
  await fs.writeFile(OUTPUT_FILE, html);

  console.log(`\n✅ Generated ${OUTPUT_FILE}`);
  console.log(`   Total images: ${manifest.length}`);
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
