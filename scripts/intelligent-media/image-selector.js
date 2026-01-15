/**
 * Intelligent Image Selector
 * Combines API fetching and scoring to automatically select best images
 */

const APIFetcher = require('./api-fetcher');
const ScoringEngine = require('./scoring-engine');
const categories = require('./categories.json');
const config = require('./config.json');

class ImageSelector {
  constructor() {
    this.fetcher = new APIFetcher();
    this.scorer = new ScoringEngine();
    this.categories = categories.categories;
    this.metadata = categories.metadata;
  }

  /**
   * Select best images for a specific category and page
   * @param {string} category - Category name (hero, neighborhood, blog, etc.)
   * @param {string} page - Page identifier
   * @param {Object} options - Selection options
   * @returns {Promise<Object>} Selected images with analysis
   */
  async selectImagesForPage(category, page, options = {}) {
    const {
      autoApprove = false,
      topN = 3
    } = options;

    // Get category configuration
    const categoryConfig = this.categories[category];
    if (!categoryConfig) {
      throw new Error(`Unknown category: ${category}`);
    }

    // Get page configuration within category
    let pageConfig;
    if (categoryConfig.pages) {
      pageConfig = categoryConfig.pages[page];
    } else if (categoryConfig.locations) {
      pageConfig = categoryConfig.locations[page];
    } else if (categoryConfig.topics) {
      pageConfig = categoryConfig.topics[page];
    } else if (categoryConfig.types) {
      pageConfig = categoryConfig.types[page];
    }

    if (!pageConfig) {
      throw new Error(`Unknown page: ${page} in category: ${category}`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📸 INTELLIGENT IMAGE SELECTION`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Category: ${categoryConfig.name}`);
    console.log(`Page: ${page}`);
    console.log(`Target: ${pageConfig.count} image(s)`);
    console.log(`${'='.repeat(80)}\n`);

    const results = [];

    // Process each keyword set
    const keywords = pageConfig.keywords || pageConfig.primary;
    for (let i = 0; i < keywords.length && results.length < pageConfig.count; i++) {
      const query = keywords[i];

      try {
        // Fetch candidates from all sources
        const candidates = await this.fetcher.fetchFromAllSources(query, {
          perPage: config.scoring.candidatesPerSource,
          orientation: this.getOrientation(categoryConfig.aspectRatio),
          category
        });

        if (candidates.length === 0) {
          console.log(`⚠️  No candidates found for "${query}"`);
          continue;
        }

        // Score and rank candidates
        console.log(`\n📊 Scoring ${candidates.length} candidates...`);

        const context = {
          category,
          page,
          keywords: query.split(' '),
          location: this.metadata.location,
          businessType: this.metadata.businessType
        };

        const topCandidates = this.scorer.getTopCandidates(
          candidates,
          context,
          topN
        );

        // Display results
        console.log(`\n🏆 TOP ${topN} CANDIDATES:`);
        console.log(`${'─'.repeat(80)}`);

        topCandidates.candidates.forEach((img, idx) => {
          console.log(`\n${idx + 1}. ${img.source.toUpperCase()} - Score: ${img.scoring.total.toFixed(1)}/100 (${img.scoring.confidence} confidence)`);
          console.log(`   By: ${img.photographer}`);
          console.log(`   Size: ${img.width}x${img.height}px`);
          console.log(`   Breakdown:`);
          console.log(`   - Quality: ${img.scoring.breakdown.quality.toFixed(1)}/100`);
          console.log(`   - Relevance: ${img.scoring.breakdown.relevance.toFixed(1)}/100`);
          console.log(`   - SEO: ${img.scoring.breakdown.seo.toFixed(1)}/100`);
          console.log(`   - Engagement: ${img.scoring.breakdown.engagement.toFixed(1)}/100`);
          console.log(`   Recommendation: ${img.scoring.recommendation}`);
        });

        console.log(`\n${'─'.repeat(80)}`);
        console.log(`📈 Analysis:`);
        console.log(`   - Total Evaluated: ${topCandidates.totalEvaluated}`);
        console.log(`   - Average Score: ${topCandidates.analysis.averageScore.toFixed(1)}`);
        console.log(`   - Top Score: ${topCandidates.analysis.topScore.toFixed(1)}`);
        console.log(`   - Distribution: Excellent(${topCandidates.analysis.scoreDistribution.excellent}) Good(${topCandidates.analysis.scoreDistribution.good}) Fair(${topCandidates.analysis.scoreDistribution.fair}) Poor(${topCandidates.analysis.scoreDistribution.poor})`);

        // Auto-select if confidence is high enough
        if (autoApprove && topCandidates.autoSelectRecommendation) {
          console.log(`\n✅ AUTO-SELECTED: #1 (score ${topCandidates.candidates[0].scoring.total.toFixed(1)} >= ${config.scoring.autoSelectThreshold})`);
          results.push({
            selected: topCandidates.candidates[0],
            query,
            selectionType: 'auto',
            candidates: topCandidates.candidates
          });
        } else {
          console.log(`\n⏸️  MANUAL REVIEW REQUIRED (top score: ${topCandidates.candidates[0].scoring.total.toFixed(1)} < ${config.scoring.autoSelectThreshold})`);
          results.push({
            selected: topCandidates.candidates[0], // Default to top candidate
            query,
            selectionType: 'manual',
            candidates: topCandidates.candidates
          });
        }

      } catch (error) {
        console.error(`❌ Error processing query "${query}":`, error.message);
      }
    }

    // Try fallback keywords if needed
    if (results.length < pageConfig.count && pageConfig.fallbacks) {
      console.log(`\n🔄 Trying fallback keywords...`);

      for (const fallbackQuery of pageConfig.fallbacks) {
        if (results.length >= pageConfig.count) break;

        try {
          const candidates = await this.fetcher.fetchFromAllSources(fallbackQuery, {
            perPage: config.scoring.candidatesPerSource / 2, // Fewer for fallbacks
            orientation: this.getOrientation(categoryConfig.aspectRatio),
            category
          });

          if (candidates.length > 0) {
            const context = {
              category,
              page,
              keywords: fallbackQuery.split(' '),
              location: this.metadata.location,
              businessType: this.metadata.businessType
            };

            const topCandidates = this.scorer.getTopCandidates(candidates, context, 1);

            console.log(`✅ Fallback found: Score ${topCandidates.candidates[0].scoring.total.toFixed(1)}`);

            results.push({
              selected: topCandidates.candidates[0],
              query: fallbackQuery,
              selectionType: 'fallback',
              candidates: [topCandidates.candidates[0]]
            });
          }
        } catch (error) {
          console.error(`❌ Fallback error for "${fallbackQuery}":`, error.message);
        }
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ SELECTION COMPLETE: ${results.length}/${pageConfig.count} images selected`);
    console.log(`${'='.repeat(80)}\n`);

    return {
      category,
      page,
      requested: pageConfig.count,
      selected: results.length,
      results,
      categoryConfig
    };
  }

  /**
   * Batch select images for multiple pages
   * @param {Array} selections - Array of {category, page} objects
   * @param {Object} options - Selection options
   * @returns {Promise<Array>} Array of selection results
   */
  async batchSelectImages(selections, options = {}) {
    console.log(`\n🚀 BATCH IMAGE SELECTION: ${selections.length} pages`);

    const results = [];

    for (const selection of selections) {
      try {
        const result = await this.selectImagesForPage(
          selection.category,
          selection.page,
          options
        );
        results.push(result);

        // Small delay between requests to be nice to APIs
        await this.sleep(1000);

      } catch (error) {
        console.error(`❌ Error selecting images for ${selection.category}/${selection.page}:`, error.message);
        results.push({
          category: selection.category,
          page: selection.page,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get seasonal keywords for current month
   */
  getSeasonalKeywords() {
    const month = new Date().getMonth() + 1; // 1-12

    for (const [season, data] of Object.entries(config.refresh.seasonal)) {
      if (data.months.includes(month)) {
        return data.keywords;
      }
    }

    return [];
  }

  /**
   * Get orientation from aspect ratio
   */
  getOrientation(aspectRatio) {
    if (aspectRatio >= 1.3) return 'landscape';
    if (aspectRatio <= 0.8) return 'portrait';
    return 'landscape'; // Default
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ImageSelector;
