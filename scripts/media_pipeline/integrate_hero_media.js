#!/usr/bin/env node

/**
 * TD Realty Ohio - Hero Media Integration
 *
 * Updates HTML pages to use hero media from manifest
 * - Adds hero video if available (muted, looping, autoplay)
 * - Adds hero image with responsive srcset
 * - Preserves existing page structure and CSS
 */

const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');

const MANIFEST_FILE = 'assets/media/manifest.json';
const CONFIG_FILE = 'media-sources.json';

/**
 * Load manifest
 */
async function loadManifest() {
  try {
    const data = await fs.readFile(MANIFEST_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ No manifest found. Run build_manifest.js first.');
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
 * Generate hero HTML for a page
 */
function generateHeroHTML(pageMedia, pageFile) {
  let heroHTML = '';

  const pathPrefix = pageFile.includes('areas/') ? '../' : '';

  // Add video if available
  if (pageMedia.hero_video) {
    const videoPath = pageMedia.hero_video.local_path.replace('assets/', pathPrefix + 'assets/');
    heroHTML += `
    <div class="hero-video-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; z-index: 0;">
      <video class="hero-video" autoplay muted loop playsinline style="width: 100%; height: 100%; object-fit: cover;">
        <source src="${videoPath}" type="video/mp4">
      </video>
    </div>`;
  }

  // Add image
  if (pageMedia.hero_image) {
    const imagePath = pageMedia.hero_image.local_path.replace('assets/', pathPrefix + 'assets/');
    const optimizedPaths = pageMedia.hero_image.optimized_paths || {};

    let srcset = '';
    if (optimizedPaths.sizes) {
      const srcsetParts = [];
      for (const [width, sizePath] of Object.entries(optimizedPaths.sizes)) {
        const adjustedPath = sizePath.replace('assets/', pathPrefix + 'assets/');
        srcsetParts.push(`${adjustedPath} ${width}w`);
      }
      srcset = srcsetParts.join(', ');
    }

    const imgSrc = optimizedPaths.webp
      ? optimizedPaths.webp.replace('assets/', pathPrefix + 'assets/')
      : imagePath;

    const alt = `${pageMedia.hero_image.attribution_text}`;

    if (srcset) {
      heroHTML += `
    <picture class="hero-image" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: ${pageMedia.hero_video ? '1' : '0'}; display: ${pageMedia.hero_video ? 'none' : 'block'};">
      <source srcset="${srcset}" sizes="(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1600px" type="image/webp">
      <img src="${imagePath}" alt="${alt}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
    </picture>`;
    } else {
      heroHTML += `
    <img class="hero-image" src="${imgSrc}" alt="${alt}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: ${pageMedia.hero_video ? '1' : '0'}; display: ${pageMedia.hero_video ? 'none' : 'block'};" loading="lazy">`;
    }

    // Add fallback script for video
    if (pageMedia.hero_video) {
      heroHTML += `
    <script>
      // Show image as fallback if video fails
      document.addEventListener('DOMContentLoaded', function() {
        var video = document.querySelector('.hero-video');
        var image = document.querySelector('.hero-image');
        if (video && image) {
          video.addEventListener('error', function() {
            image.style.display = 'block';
          });
        }
      });
    </script>`;
    }
  }

  return heroHTML;
}

/**
 * Update a single HTML file
 */
async function updateHTMLFile(pageKey, pageMedia, pageFile) {
  console.log(`\n📄 Updating ${pageFile}...`);

  try {
    const htmlContent = await fs.readFile(pageFile, 'utf8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Find the .page-hero section
    const heroSection = document.querySelector('.page-hero');
    if (!heroSection) {
      console.log('  ⚠ No .page-hero section found, skipping');
      return false;
    }

    // Check if hero media already integrated
    if (heroSection.querySelector('.hero-video-container') || heroSection.querySelector('.hero-image')) {
      console.log('  ⊘ Hero media already integrated, skipping');
      return false;
    }

    // Make hero section position relative if not already
    const currentStyle = heroSection.getAttribute('style') || '';
    if (!currentStyle.includes('position:') && !currentStyle.includes('position :')) {
      heroSection.setAttribute('style', currentStyle + ' position: relative; overflow: hidden;');
    }

    // Generate hero HTML
    const heroHTML = generateHeroHTML(pageMedia, pageFile);

    // Insert at beginning of hero section
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = heroHTML;

    while (tempDiv.firstChild) {
      heroSection.insertBefore(tempDiv.firstChild, heroSection.firstChild);
    }

    // Ensure hero content has proper z-index
    const container = heroSection.querySelector('.container');
    if (container) {
      const containerStyle = container.getAttribute('style') || '';
      if (!containerStyle.includes('position:')) {
        container.setAttribute('style', containerStyle + ' position: relative; z-index: 10;');
      }
    }

    // Write back to file
    const updatedHTML = dom.serialize();
    await fs.writeFile(pageFile, updatedHTML, 'utf8');

    console.log('  ✓ Updated successfully');
    return true;

  } catch (error) {
    console.error(`  ✗ Error updating file: ${error.message}`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 TD Realty Ohio - Hero Media Integration\n');
  console.log('📝 Updating HTML pages with hero media...');

  const manifest = await loadManifest();
  const config = await loadConfig();

  let updatedCount = 0;

  for (const [pageKey, pageMedia] of Object.entries(manifest.pages)) {
    const pageConfig = config.pages[pageKey];
    if (!pageConfig) {
      console.log(`\n⚠ No config found for ${pageKey}, skipping`);
      continue;
    }

    const pageFile = pageConfig.page_file;

    const updated = await updateHTMLFile(pageKey, pageMedia, pageFile);
    if (updated) {
      updatedCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Integration complete!`);
  console.log(`   Pages updated: ${updatedCount}`);
  console.log(`   Total pages in manifest: ${Object.keys(manifest.pages).length}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
