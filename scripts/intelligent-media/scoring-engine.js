/**
 * Intelligent Image Scoring Engine
 * Scores images based on quality, relevance, SEO, and engagement factors
 */

const config = require('./config.json');

class ScoringEngine {
  constructor(customWeights = null) {
    this.weights = customWeights || config.scoring.weights;
    this.config = config.scoring;
  }

  /**
   * Main scoring function - calculates total weighted score for an image
   * @param {Object} image - Image object with metadata
   * @param {Object} context - Context including keywords, category, location
   * @returns {Object} Detailed score breakdown
   */
  scoreImage(image, context) {
    const scores = {
      quality: this.scoreQuality(image, context),
      relevance: this.scoreRelevance(image, context),
      seo: this.scoreSEO(image, context),
      engagement: this.scoreEngagement(image, context)
    };

    // Calculate weighted total
    const totalScore =
      (scores.quality * this.weights.quality) +
      (scores.relevance * this.weights.relevance) +
      (scores.seo * this.weights.seo) +
      (scores.engagement * this.weights.engagement);

    return {
      total: Math.max(0, Math.min(100, totalScore)), // Clamp to 0-100
      breakdown: scores,
      weights: this.weights,
      confidence: this.calculateConfidence(scores),
      recommendation: this.getRecommendation(totalScore)
    };
  }

  /**
   * PHASE 1: Quality Scoring (35% weight)
   * Evaluates resolution, aspect ratio, composition, watermarks, focus
   */
  scoreQuality(image, context) {
    let score = 0;
    const maxScore = 100;

    // 1. Resolution Score (40 points)
    const minRes = context.category === 'hero' ?
      this.config.quality.minResolutionHero :
      context.category === 'thumbnail' ?
        this.config.quality.minResolutionThumbnail :
        this.config.quality.minResolutionStandard;

    const width = image.width || 0;
    const height = image.height || 0;

    if (width >= minRes && height >= minRes * 0.5) {
      score += 40;
      // Bonus for higher resolution
      if (width >= minRes * 1.5) score += 10;
      if (width >= minRes * 2) score += 5;
    } else if (width >= minRes * 0.8) {
      score += 25; // Acceptable but not ideal
    } else {
      score += this.config.quality.lowResolutionPenalty;
    }

    // 2. Aspect Ratio Score (25 points)
    const aspectRatio = width / height;
    const preferredRatio = this.config.quality.preferredAspectRatios[context.category] || 1.5;
    const tolerance = this.config.quality.aspectRatioTolerance;

    const ratioDiff = Math.abs(aspectRatio - preferredRatio);
    if (ratioDiff <= tolerance) {
      score += 25;
    } else if (ratioDiff <= tolerance * 2) {
      score += 15;
    } else {
      score += 5;
    }

    // 3. Professional Composition (20 points)
    // Check for indicators of professional quality
    if (image.photographer && image.photographer.toLowerCase() !== 'unknown') {
      score += 5;
    }

    // Higher quality from curated sources
    if (image.source === 'unsplash') {
      score += 8; // Unsplash is highly curated
    } else if (image.source === 'pexels') {
      score += 6; // Pexels is curated
    } else if (image.source === 'pixabay') {
      score += 4; // Pixabay is community-driven
    }

    // Image has description (indicates photographer care)
    if (image.description && image.description.length > 20) {
      score += 7;
    }

    // 4. No Watermarks/Text Overlays (15 points)
    const hasWatermark = this.detectWatermark(image);
    if (!hasWatermark) {
      score += 15;
    } else {
      score += this.config.quality.watermarkPenalty;
    }

    return Math.max(0, Math.min(maxScore, score));
  }

  /**
   * PHASE 2: Relevance Scoring (30% weight)
   * Evaluates keyword match, context appropriateness, geographic relevance
   */
  scoreRelevance(image, context) {
    let score = 0;
    const maxScore = 100;

    const keywords = context.keywords || [];
    const imageText = [
      image.description || '',
      image.alt || '',
      image.tags ? image.tags.join(' ') : '',
      image.title || ''
    ].join(' ').toLowerCase();

    // 1. Exact Keyword Match (30 points)
    let exactMatches = 0;
    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      if (imageText.includes(keywordLower)) {
        exactMatches++;
      }
    });

    if (exactMatches >= keywords.length * 0.7) {
      score += 30;
    } else if (exactMatches >= keywords.length * 0.5) {
      score += 20;
    } else if (exactMatches >= keywords.length * 0.3) {
      score += 10;
    }

    // 2. Partial Keyword Match (15 points)
    let partialMatches = 0;
    keywords.forEach(keyword => {
      const words = keyword.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.length > 3 && imageText.includes(word)) {
          partialMatches++;
        }
      });
    });

    if (partialMatches >= keywords.length * 2) {
      score += 15;
    } else if (partialMatches >= keywords.length) {
      score += 10;
    } else {
      score += 5;
    }

    // 3. Context Match (25 points)
    // Real estate specific terms
    const realEstateTerms = ['home', 'house', 'property', 'residential', 'real estate',
                              'neighborhood', 'selling', 'buying', 'agent', 'realtor'];
    let contextMatches = 0;
    realEstateTerms.forEach(term => {
      if (imageText.includes(term)) contextMatches++;
    });

    if (contextMatches >= 3) {
      score += 25;
    } else if (contextMatches >= 2) {
      score += 15;
    } else if (contextMatches >= 1) {
      score += 8;
    }

    // 4. Geographic Relevance (20 points)
    const geographicTerms = ['columbus', 'ohio', 'midwest', 'american', 'suburban'];
    let geoMatches = 0;
    geographicTerms.forEach(term => {
      if (imageText.includes(term)) geoMatches++;
    });

    if (geoMatches >= 2) {
      score += 20;
    } else if (geoMatches >= 1) {
      score += 12;
    } else {
      score += 5; // Default if no specific location mentioned
    }

    // 5. Professional Feel Bonus (10 points)
    const professionalTerms = ['professional', 'modern', 'luxury', 'quality', 'beautiful'];
    let profMatches = 0;
    professionalTerms.forEach(term => {
      if (imageText.includes(term)) profMatches++;
    });

    if (profMatches >= 2) {
      score += 10;
    } else if (profMatches >= 1) {
      score += 5;
    }

    return Math.max(0, Math.min(maxScore, score));
  }

  /**
   * PHASE 3: SEO Scoring (20% weight)
   * Evaluates filename quality, metadata, photographer quality, uniqueness
   */
  scoreSEO(image, context) {
    let score = 0;
    const maxScore = 100;

    // 1. Original Filename Quality (20 points)
    const filename = image.url ? image.url.split('/').pop().split('?')[0] : '';
    const hasDescriptiveFilename = filename.length > 10 &&
                                    filename.includes('-') &&
                                    !/^\d+\./.test(filename);

    if (hasDescriptiveFilename) {
      score += 20;
    } else if (filename.length > 5) {
      score += 10;
    }

    // 2. Already Has Good Metadata (25 points)
    if (image.description && image.description.length > 30) {
      score += 10;
    }

    if (image.tags && image.tags.length >= 5) {
      score += 10;
    }

    if (image.alt && image.alt.length > 20) {
      score += 5;
    }

    // 3. Photographer Has Good Portfolio (30 points)
    // Higher-quality platforms = better photographer curation
    if (image.source === 'unsplash') {
      score += 25; // Unsplash photographers are typically high quality
    } else if (image.source === 'pexels') {
      score += 20;
    } else if (image.source === 'pixabay') {
      score += 15;
    }

    // Photographer has profile link (indicates established photographer)
    if (image.photographerUrl) {
      score += 5;
    }

    // 4. Uniqueness Score (25 points)
    // Newer images tend to be less overused
    if (image.created_at) {
      const imageDate = new Date(image.created_at);
      const monthsOld = (Date.now() - imageDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

      if (monthsOld < 6) {
        score += 25; // Very new
      } else if (monthsOld < 12) {
        score += 20; // Recent
      } else if (monthsOld < 24) {
        score += 15; // Relatively new
      } else {
        score += 10; // Older but still acceptable
      }
    } else {
      score += 12; // Default if no date available
    }

    return Math.max(0, Math.min(maxScore, score));
  }

  /**
   * PHASE 4: Engagement Scoring (15% weight)
   * Evaluates human faces, warm tones, professional composition, action elements
   */
  scoreEngagement(image, context) {
    let score = 0;
    const maxScore = 100;

    const imageText = [
      image.description || '',
      image.alt || '',
      image.tags ? image.tags.join(' ') : ''
    ].join(' ').toLowerCase();

    // 1. Human Faces - Emotional Connection (30 points)
    const faceTerms = ['people', 'person', 'man', 'woman', 'couple', 'family', 'face',
                       'portrait', 'smiling', 'happy'];
    let faceMatches = 0;
    faceTerms.forEach(term => {
      if (imageText.includes(term)) faceMatches++;
    });

    if (faceMatches >= 3) {
      score += 30;
    } else if (faceMatches >= 2) {
      score += 20;
    } else if (faceMatches >= 1) {
      score += 10;
    } else {
      score += 5; // Some categories don't need faces
    }

    // 2. Warm, Inviting Feel (25 points)
    const warmTerms = ['warm', 'cozy', 'inviting', 'comfortable', 'welcoming',
                       'bright', 'sunny', 'light', 'natural light'];
    let warmMatches = 0;
    warmTerms.forEach(term => {
      if (imageText.includes(term)) warmMatches++;
    });

    if (warmMatches >= 2) {
      score += 25;
    } else if (warmMatches >= 1) {
      score += 15;
    } else {
      score += 8;
    }

    // 3. Professional But Approachable (25 points)
    const approachableTerms = ['professional', 'modern', 'clean', 'simple',
                               'elegant', 'quality', 'authentic'];
    let approachableMatches = 0;
    approachableTerms.forEach(term => {
      if (imageText.includes(term)) approachableMatches++;
    });

    if (approachableMatches >= 2) {
      score += 25;
    } else if (approachableMatches >= 1) {
      score += 15;
    } else {
      score += 10;
    }

    // 4. Action/Story Elements (20 points)
    const actionTerms = ['moving', 'celebration', 'success', 'achievement', 'keys',
                         'signing', 'handshake', 'working', 'planning'];
    let actionMatches = 0;
    actionTerms.forEach(term => {
      if (imageText.includes(term)) actionMatches++;
    });

    if (actionMatches >= 2) {
      score += 20;
    } else if (actionMatches >= 1) {
      score += 12;
    } else {
      score += 5;
    }

    return Math.max(0, Math.min(maxScore, score));
  }

  /**
   * Watermark Detection (heuristic-based)
   * Checks for common watermark indicators in metadata
   */
  detectWatermark(image) {
    const text = [
      image.description || '',
      image.alt || '',
      image.title || ''
    ].join(' ').toLowerCase();

    // Common watermark indicators
    const watermarkIndicators = [
      'watermark',
      'copyright',
      '©',
      'getty',
      'shutterstock',
      'istockphoto',
      'stock photo',
      'alamy'
    ];

    return watermarkIndicators.some(indicator => text.includes(indicator));
  }

  /**
   * Calculate confidence level based on score consistency
   */
  calculateConfidence(scores) {
    const values = Object.values(scores);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher confidence (scores are consistent)
    if (stdDev < 10) return 'high';
    if (stdDev < 20) return 'medium';
    return 'low';
  }

  /**
   * Get recommendation based on total score
   */
  getRecommendation(totalScore) {
    if (totalScore >= this.config.autoSelectThreshold) {
      return 'auto-select';
    } else if (totalScore >= 70) {
      return 'review-recommended';
    } else if (totalScore >= 50) {
      return 'review-optional';
    } else {
      return 'reject';
    }
  }

  /**
   * Score multiple images and rank them
   */
  scoreAndRank(images, context) {
    const scoredImages = images.map(image => ({
      ...image,
      scoring: this.scoreImage(image, context)
    }));

    // Sort by total score (highest first)
    scoredImages.sort((a, b) => b.scoring.total - a.scoring.total);

    return scoredImages;
  }

  /**
   * Get top N candidates with detailed analysis
   */
  getTopCandidates(images, context, count = 3) {
    const ranked = this.scoreAndRank(images, context);
    const topCandidates = ranked.slice(0, count);

    return {
      candidates: topCandidates,
      totalEvaluated: images.length,
      autoSelectRecommendation: topCandidates[0].scoring.total >= this.config.autoSelectThreshold,
      analysis: {
        averageScore: ranked.reduce((sum, img) => sum + img.scoring.total, 0) / ranked.length,
        topScore: topCandidates[0].scoring.total,
        scoreDistribution: this.getScoreDistribution(ranked)
      }
    };
  }

  /**
   * Get score distribution for analysis
   */
  getScoreDistribution(scoredImages) {
    const distribution = {
      excellent: 0,  // 85+
      good: 0,       // 70-84
      fair: 0,       // 50-69
      poor: 0        // <50
    };

    scoredImages.forEach(img => {
      const score = img.scoring.total;
      if (score >= 85) distribution.excellent++;
      else if (score >= 70) distribution.good++;
      else if (score >= 50) distribution.fair++;
      else distribution.poor++;
    });

    return distribution;
  }
}

module.exports = ScoringEngine;
