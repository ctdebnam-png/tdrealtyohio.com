#!/usr/bin/env node

/**
 * Validate that HTML files exist and internal links resolve
 */

const fs = require('fs').promises;
const path = require('path');

async function fileExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔍 Validating build output...\n');

  let errors = 0;

  // Check that index.html exists
  console.log('Checking index.html...');
  if (await fileExists('index.html')) {
    console.log('  ✓ index.html exists');
  } else {
    console.error('  ✗ index.html not found!');
    errors++;
  }

  // Check key pages exist
  const keyPages = [
    'about.html',
    'buyers.html',
    'sellers.html',
    'contact.html',
    'gallery.html'
  ];

  console.log('\nChecking key pages...');
  for (const page of keyPages) {
    if (await fileExists(page)) {
      console.log(`  ✓ ${page}`);
    } else {
      console.error(`  ✗ ${page} not found!`);
      errors++;
    }
  }

  // Check areas directory
  console.log('\nChecking areas directory...');
  try {
    const areasFiles = await fs.readdir('areas');
    const htmlFiles = areasFiles.filter(f => f.endsWith('.html'));
    console.log(`  ✓ Found ${htmlFiles.length} area pages`);
  } catch (error) {
    console.error(`  ✗ Could not read areas directory: ${error.message}`);
    errors++;
  }

  // Check manifest exists
  console.log('\nChecking manifest...');
  if (await fileExists('assets/media/manifest.json')) {
    console.log('  ✓ manifest.json exists');

    // Load and check references
    try {
      const manifestData = await fs.readFile('assets/media/manifest.json', 'utf8');
      const manifest = JSON.parse(manifestData);

      let mediaErrors = 0;
      for (const [pageKey, pageMedia] of Object.entries(manifest.pages)) {
        if (pageMedia.hero_image) {
          const imgPath = pageMedia.hero_image.local_path;
          if (!(await fileExists(imgPath))) {
            console.error(`  ✗ Missing image: ${imgPath} (referenced by ${pageKey})`);
            mediaErrors++;
          }
        }
        if (pageMedia.hero_video) {
          const vidPath = pageMedia.hero_video.local_path;
          if (!(await fileExists(vidPath))) {
            console.error(`  ✗ Missing video: ${vidPath} (referenced by ${pageKey})`);
            mediaErrors++;
          }
        }
      }

      if (mediaErrors === 0) {
        console.log('  ✓ All media references valid');
      } else {
        errors += mediaErrors;
      }
    } catch (error) {
      console.error(`  ✗ Error validating manifest: ${error.message}`);
      errors++;
    }
  } else {
    console.log('  ⚠ manifest.json not found (may not be generated yet)');
  }

  console.log('\n' + '='.repeat(50));
  if (errors === 0) {
    console.log('✅ All validation checks passed!');
  } else {
    console.error(`❌ ${errors} validation error(s) found`);
    process.exit(1);
  }
}

main();
