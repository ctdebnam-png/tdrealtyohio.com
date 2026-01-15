/**
 * Intelligent Media Management System - Main Orchestrator
 * Coordinates all components for automated image selection, optimization, and management
 */

const ImageSelector = require('./image-selector');
const SEOOptimizer = require('./seo-optimizer');
const Database = require('./database');
const SitemapGenerator = require('./sitemap-generator');
const fs = require('fs').promises;
const path = require('path');

class IntelligentMediaManager {
  constructor(options = {}) {
    this.selector = new ImageSelector();
    this.optimizer = new SEOOptimizer(options.outputDir || './assets/media/intelligent');
    this.db = new Database(options.dbPath || './data/intelligent-media.db');
    this.sitemap = new SitemapGenerator(options.baseUrl || 'https://tdrealtyohio.com');

    this.options = {
      autoApprove: options.autoApprove !== undefined ? options.autoApprove : false,
      dryRun: options.dryRun !== undefined ? options.dryRun : false,
      ...options
    };
  }

  /**
   * Initialize the system
   */
  async init() {
    console.log('\n' + '═'.repeat(80));
    console.log('🚀 INTELLIGENT MEDIA MANAGEMENT SYSTEM');
    console.log('═'.repeat(80));
    console.log('   TD Realty Ohio - Automated Media Pipeline');
    console.log('   Version 1.0.0\n');

    // Initialize database
    await this.db.init();

    // Ensure output directories exist
    await this.ensureDirectories();

    console.log('✅ System initialized\n');
  }

  /**
   * Ensure all output directories exist
   */
  async ensureDirectories() {
    const dirs = [
      path.join(this.optimizer.outputDir, 'original'),
      path.join(this.optimizer.outputDir, 'webp'),
      path.join(this.optimizer.outputDir, 'jpg'),
      path.join(this.optimizer.outputDir, 'placeholders'),
      './data'
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Process a single page - select and optimize images
   */
  async processPage(category, page) {
    console.log('\n' + '─'.repeat(80));
    console.log(`Processing: ${category}/${page}`);
    console.log('─'.repeat(80));

    try {
      // Step 1: Select best images
      const selection = await this.selector.selectImagesForPage(
        category,
        page,
        { autoApprove: this.options.autoApprove, topN: 3 }
      );

      if (selection.selected === 0) {
        console.log('⚠️  No images selected');
        return { category, page, success: false, reason: 'No images found' };
      }

      // Step 2: Optimize selected images
      const optimized = [];

      for (const result of selection.results) {
        if (!this.options.dryRun) {
          try {
            console.log(`\n🔧 Optimizing: ${result.selected.id}...`);

            const context = {
              category,
              page,
              keywords: result.query.split(' ')
            };

            // Add scoring to image object
            result.selected.scoring = result.selected.scoring || {};
            result.selected.context = context;
            result.selected.selectionType = result.selectionType;

            const optimizedImage = await this.optimizer.optimizeImage(
              result.selected,
              context
            );

            // Merge data
            optimizedImage.scoring = result.selected.scoring;
            optimizedImage.context = context;
            optimizedImage.selectionType = result.selectionType;

            optimized.push(optimizedImage);

            // Save to database
            await this.db.saveImage(optimizedImage);

            console.log(`✅ Optimized and saved: ${optimizedImage.filename}`);

          } catch (error) {
            console.error(`❌ Error optimizing ${result.selected.id}:`, error.message);
          }
        } else {
          console.log(`[DRY RUN] Would optimize: ${result.selected.id}`);
          optimized.push(result.selected);
        }
      }

      return {
        category,
        page,
        success: true,
        requested: selection.requested,
        selected: selection.selected,
        optimized: optimized.length,
        images: optimized
      };

    } catch (error) {
      console.error(`❌ Error processing ${category}/${page}:`, error.message);
      return {
        category,
        page,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process multiple pages in batch
   */
  async batchProcess(selections) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📦 BATCH PROCESSING: ${selections.length} pages`);
    console.log(`${'═'.repeat(80)}\n`);

    const results = [];
    const allOptimizedImages = [];

    for (let i = 0; i < selections.length; i++) {
      const { category, page } = selections[i];

      console.log(`\n[${i + 1}/${selections.length}] Processing ${category}/${page}...`);

      const result = await this.processPage(category, page);
      results.push(result);

      if (result.success && result.images) {
        allOptimizedImages.push(...result.images);
      }

      // Small delay between pages
      await this.sleep(2000);
    }

    // Generate summary
    const successful = results.filter(r => r.success).length;
    const totalImages = allOptimizedImages.length;

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`✅ BATCH PROCESSING COMPLETE`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`   Pages processed: ${successful}/${selections.length}`);
    console.log(`   Total images: ${totalImages}`);
    console.log(`${'═'.repeat(80)}\n`);

    return {
      results,
      summary: {
        totalPages: selections.length,
        successfulPages: successful,
        totalImages,
        failedPages: selections.length - successful
      },
      allImages: allOptimizedImages
    };
  }

  /**
   * Generate all output artifacts (sitemaps, manifests, etc.)
   */
  async generateArtifacts(images) {
    console.log('\n' + '═'.repeat(80));
    console.log('📄 GENERATING ARTIFACTS');
    console.log('═'.repeat(80));

    if (this.options.dryRun) {
      console.log('[DRY RUN] Skipping artifact generation');
      return;
    }

    try {
      // 1. Generate XML sitemap
      await this.sitemap.saveSitemap(images, './images-sitemap.xml');

      // 2. Update robots.txt
      await this.sitemap.updateRobotsTxt(
        `${this.sitemap.baseUrl}/images-sitemap.xml`,
        './robots.txt'
      );

      // 3. Generate HTML gallery
      await this.sitemap.saveHTMLSitemap(images, './image-gallery.html');

      // 4. Generate manifest JSON
      await this.generateManifest(images);

      console.log('\n✅ All artifacts generated');

    } catch (error) {
      console.error('❌ Error generating artifacts:', error.message);
    }
  }

  /**
   * Generate manifest JSON file
   */
  async generateManifest(images) {
    const manifest = {
      generated: new Date().toISOString(),
      totalImages: images.length,
      system: 'Intelligent Media Management System v1.0.0',
      images: images.map(img => ({
        id: img.id,
        source: img.source,
        category: img.context?.category,
        page: img.context?.page,
        filename: img.filename,
        score: img.scoring?.total,
        seo: img.seo,
        attribution: img.attribution,
        variants: img.localPaths?.variants?.sizes?.map(v => ({
          width: v.width,
          webp: v.webp.url,
          jpg: v.jpg.url
        }))
      }))
    };

    const manifestPath = path.join(this.optimizer.outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`✅ Manifest saved: ${manifestPath}`);
  }

  /**
   * Get system statistics
   */
  async getStats() {
    return await this.db.getStats();
  }

  /**
   * Get images due for refresh
   */
  async getRefreshQueue() {
    return await this.db.getImagesDueForRefresh();
  }

  /**
   * Refresh an image (replace with new candidate)
   */
  async refreshImage(imageId, reason = 'manual') {
    console.log(`\n🔄 Refreshing image: ${imageId}`);

    // Get old image data
    const oldImage = await this.db.getImage(imageId);

    if (!oldImage) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // Re-select images for this page
    const selection = await this.processPage(oldImage.category, oldImage.page);

    if (selection.success && selection.images.length > 0) {
      const newImage = selection.images[0];

      // Record refresh in history
      await this.db.recordRefresh(
        newImage.id,
        oldImage.id,
        reason,
        'replacement',
        oldImage.score_total,
        newImage.scoring?.total
      );

      console.log(`✅ Image refreshed: ${oldImage.id} -> ${newImage.id}`);
      console.log(`   Score: ${oldImage.score_total.toFixed(1)} -> ${newImage.scoring?.total.toFixed(1)}`);

      return newImage;
    } else {
      throw new Error('Failed to find replacement image');
    }
  }

  /**
   * Run quality checks on all images
   */
  async runQualityChecks() {
    console.log('\n' + '═'.repeat(80));
    console.log('🔍 RUNNING QUALITY CHECKS');
    console.log('═'.repeat(80));

    const images = await this.db.getAllImages();

    console.log(`Checking ${images.length} images...`);

    let passedCount = 0;
    let failedCount = 0;

    for (const image of images) {
      try {
        // Check if files exist
        const checks = [
          { type: 'file-exists', path: image.filename }
        ];

        for (const check of checks) {
          const status = await this.performQualityCheck(check);
          await this.db.recordQualityCheck(image.id, check.type, status ? 'passed' : 'failed');

          if (status) {
            passedCount++;
          } else {
            failedCount++;
            console.log(`❌ Failed: ${image.id} - ${check.type}`);
          }
        }

      } catch (error) {
        console.error(`Error checking ${image.id}:`, error.message);
        failedCount++;
      }
    }

    console.log(`\n✅ Quality checks complete:`);
    console.log(`   Passed: ${passedCount}`);
    console.log(`   Failed: ${failedCount}`);
  }

  /**
   * Perform individual quality check
   */
  async performQualityCheck(check) {
    if (check.type === 'file-exists') {
      try {
        await fs.access(check.path);
        return true;
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Close all connections
   */
  async close() {
    await this.db.close();
    console.log('\n✅ System closed');
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = IntelligentMediaManager;
