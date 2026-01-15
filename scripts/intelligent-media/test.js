#!/usr/bin/env node

/**
 * Test Script - Validates Intelligent Media Management System
 * Tests with ~20 images across different categories
 */

const IntelligentMediaManager = require('./index');
const apiConfig = require('./api-config');

async function runTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 INTELLIGENT MEDIA MANAGEMENT SYSTEM - TEST RUN');
  console.log('═'.repeat(80));
  console.log('   Testing with ~20 images across multiple categories');
  console.log('   This will validate scoring, selection, and optimization');
  console.log('═'.repeat(80) + '\n');

  // Check API keys
  checkAPIKeys();

  // Initialize system
  const manager = new IntelligentMediaManager({
    outputDir: './assets/media/intelligent',
    dbPath: './data/intelligent-media.db',
    baseUrl: 'https://tdrealtyohio.com',
    autoApprove: false, // Require manual review for test
    dryRun: false
  });

  await manager.init();

  // Define test selections (~20 images total)
  const testSelections = [
    // Hero Images (5 pages x 1 image = 5 images)
    { category: 'hero', page: 'homepage' },
    { category: 'hero', page: 'services-selling' },
    { category: 'hero', page: 'services-buying' },
    { category: 'hero', page: 'pre-listing-inspection' },
    { category: 'hero', page: 'calculator' },

    // Neighborhood Images (2 neighborhoods x 5 images = 10 images)
    { category: 'neighborhood', page: 'dublin' },
    { category: 'neighborhood', page: 'worthington' },

    // Blog Images (1 topic x 3 images = 3 images)
    { category: 'blog', page: 'commission-savings' },

    // Trust Images (1 type x 2 images = 2 images)
    { category: 'trust', page: 'reviews' }

    // Total: ~20 images
  ];

  console.log('Test Configuration:');
  console.log(`   Categories: ${new Set(testSelections.map(s => s.category)).size}`);
  console.log(`   Pages: ${testSelections.length}`);
  console.log(`   Expected images: ~20`);
  console.log('');

  try {
    // Run batch processing
    const result = await manager.batchProcess(testSelections);

    // Display detailed results
    displayResults(result);

    // Generate artifacts
    if (result.allImages.length > 0) {
      await manager.generateArtifacts(result.allImages);
    }

    // Display statistics
    const stats = await manager.getStats();
    displayStatistics(stats);

    // Display refresh queue
    const refreshQueue = await manager.getRefreshQueue();
    console.log(`\n📅 Refresh Queue: ${refreshQueue.length} images due for refresh`);

    console.log('\n' + '═'.repeat(80));
    console.log('✅ TEST RUN COMPLETE');
    console.log('═'.repeat(80));
    console.log('\nNext Steps:');
    console.log('   1. Review the selected images in ./image-gallery.html');
    console.log('   2. Check the manifest in ./assets/media/intelligent/manifest.json');
    console.log('   3. View the XML sitemap in ./images-sitemap.xml');
    console.log('   4. Examine scoring details in the database (./data/intelligent-media.db)');
    console.log('   5. If satisfied, integrate images into your HTML pages');
    console.log('');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

/**
 * Check if API keys are configured
 */
function checkAPIKeys() {
  try {
    apiConfig.validateSecrets();
    console.log('');
  } catch (error) {
    console.error('\n❌ API key validation failed');
    console.error('   Run: npm run test:secrets');
    console.error('   To diagnose the issue\n');
    process.exit(1);
  }
}

/**
 * Display processing results
 */
function displayResults(result) {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 PROCESSING RESULTS');
  console.log('═'.repeat(80));

  // Summary
  console.log('\n📈 Summary:');
  console.log(`   Total Pages Processed: ${result.summary.totalPages}`);
  console.log(`   Successful: ${result.summary.successfulPages}`);
  console.log(`   Failed: ${result.summary.failedPages}`);
  console.log(`   Total Images Selected: ${result.summary.totalImages}`);

  // Success rate
  const successRate = (result.summary.successfulPages / result.summary.totalPages * 100).toFixed(1);
  console.log(`   Success Rate: ${successRate}%`);

  // Detailed results
  console.log('\n📋 Detailed Results:');
  console.log('   ' + '─'.repeat(76));
  console.log('   Category         | Page                  | Status  | Images');
  console.log('   ' + '─'.repeat(76));

  result.results.forEach(r => {
    const category = r.category.padEnd(15);
    const page = r.page.padEnd(20);
    const status = r.success ? '✅ Pass' : '❌ Fail';
    const images = r.success ? `${r.optimized}/${r.requested}` : 'N/A';

    console.log(`   ${category} | ${page} | ${status} | ${images}`);
  });

  console.log('   ' + '─'.repeat(76));

  // Image sources breakdown
  if (result.allImages.length > 0) {
    const sources = {};
    result.allImages.forEach(img => {
      sources[img.source] = (sources[img.source] || 0) + 1;
    });

    console.log('\n📸 Image Sources:');
    Object.entries(sources).forEach(([source, count]) => {
      const percentage = (count / result.allImages.length * 100).toFixed(1);
      console.log(`   ${source.charAt(0).toUpperCase() + source.slice(1)}: ${count} (${percentage}%)`);
    });

    // Average scores
    const totalScore = result.allImages.reduce((sum, img) => sum + (img.scoring?.total || 0), 0);
    const avgScore = totalScore / result.allImages.length;

    console.log('\n⭐ Average Scores:');
    console.log(`   Overall: ${avgScore.toFixed(1)}/100`);

    const qualityScore = result.allImages.reduce((sum, img) => sum + (img.scoring?.breakdown.quality || 0), 0) / result.allImages.length;
    const relevanceScore = result.allImages.reduce((sum, img) => sum + (img.scoring?.breakdown.relevance || 0), 0) / result.allImages.length;
    const seoScore = result.allImages.reduce((sum, img) => sum + (img.scoring?.breakdown.seo || 0), 0) / result.allImages.length;
    const engagementScore = result.allImages.reduce((sum, img) => sum + (img.scoring?.breakdown.engagement || 0), 0) / result.allImages.length;

    console.log(`   Quality: ${qualityScore.toFixed(1)}/100`);
    console.log(`   Relevance: ${relevanceScore.toFixed(1)}/100`);
    console.log(`   SEO: ${seoScore.toFixed(1)}/100`);
    console.log(`   Engagement: ${engagementScore.toFixed(1)}/100`);

    // Top 5 images
    const topImages = [...result.allImages]
      .sort((a, b) => (b.scoring?.total || 0) - (a.scoring?.total || 0))
      .slice(0, 5);

    console.log('\n🏆 Top 5 Images:');
    topImages.forEach((img, idx) => {
      console.log(`   ${idx + 1}. ${img.filename}`);
      console.log(`      Score: ${img.scoring?.total.toFixed(1)}/100 | Source: ${img.source} | By: ${img.metadata.photographer}`);
    });
  }
}

/**
 * Display database statistics
 */
function displayStatistics(stats) {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 DATABASE STATISTICS');
  console.log('═'.repeat(80));

  console.log(`\n   Total Images: ${stats.totalImages}`);
  console.log(`   Average Score: ${stats.avgScore.toFixed(1)}/100`);
  console.log(`   Recent Refreshes (30 days): ${stats.recentRefreshes}`);
  console.log(`   Failed Quality Checks (7 days): ${stats.failedQualityChecks}`);

  console.log('\n   By Category:');
  if (stats.byCategory && stats.byCategory.length > 0) {
    stats.byCategory.forEach(cat => {
      console.log(`      ${cat.category}: ${cat.count}`);
    });
  }

  console.log('\n   By Source:');
  if (stats.bySource && stats.bySource.length > 0) {
    stats.bySource.forEach(src => {
      console.log(`      ${src.source}: ${src.count}`);
    });
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
