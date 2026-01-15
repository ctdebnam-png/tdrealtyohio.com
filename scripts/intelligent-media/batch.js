#!/usr/bin/env node

/**
 * Batch Processing Script - Process all pages at once
 */

const IntelligentMediaManager = require('./index');
const categories = require('./categories.json');
require('dotenv').config();

async function batchProcessAll() {
  console.log('\n' + '═'.repeat(80));
  console.log('📦 INTELLIGENT MEDIA MANAGEMENT - FULL BATCH PROCESSING');
  console.log('═'.repeat(80) + '\n');

  const manager = new IntelligentMediaManager({
    autoApprove: true, // Auto-approve high-scoring images
    dryRun: false
  });

  await manager.init();

  // Build selection list from all categories
  const selections = [];

  // Hero pages
  if (categories.categories.hero && categories.categories.hero.pages) {
    Object.keys(categories.categories.hero.pages).forEach(page => {
      selections.push({ category: 'hero', page });
    });
  }

  // Neighborhoods
  if (categories.categories.neighborhood && categories.categories.neighborhood.locations) {
    Object.keys(categories.categories.neighborhood.locations).forEach(page => {
      selections.push({ category: 'neighborhood', page });
    });
  }

  // Blog topics
  if (categories.categories.blog && categories.categories.blog.topics) {
    Object.keys(categories.categories.blog.topics).forEach(page => {
      selections.push({ category: 'blog', page });
    });
  }

  // Trust types
  if (categories.categories.trust && categories.categories.trust.types) {
    Object.keys(categories.categories.trust.types).forEach(page => {
      selections.push({ category: 'trust', page });
    });
  }

  // Icon types
  if (categories.categories.icons && categories.categories.icons.types) {
    Object.keys(categories.categories.icons.types).forEach(page => {
      selections.push({ category: 'icons', page });
    });
  }

  console.log(`Processing ${selections.length} pages across all categories...\n`);

  try {
    const result = await manager.batchProcess(selections);

    // Generate artifacts
    if (result.allImages.length > 0) {
      await manager.generateArtifacts(result.allImages);
    }

    // Display summary
    console.log('\n' + '═'.repeat(80));
    console.log('✅ BATCH PROCESSING COMPLETE');
    console.log('═'.repeat(80));
    console.log(`   Pages Processed: ${result.summary.successfulPages}/${result.summary.totalPages}`);
    console.log(`   Total Images: ${result.summary.totalImages}`);
    console.log(`   Success Rate: ${(result.summary.successfulPages / result.summary.totalPages * 100).toFixed(1)}%`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

batchProcessAll();
