/**
 * Enhanced Multi-Source API Fetcher
 * Queries Pexels, Pixabay, and Unsplash simultaneously with intelligent rate limiting
 */

const axios = require('axios');
const config = require('./config.json');

class APIFetcher {
  constructor() {
    this.config = config.api;
    this.rateLimiters = {
      pexels: new RateLimiter(this.config.pexels.rateLimit),
      pixabay: new RateLimiter(this.config.pixabay.rateLimit),
      unsplash: new RateLimiter(this.config.unsplash.rateLimit)
    };

    // API keys from environment
    this.apiKeys = {
      pexels: process.env.PEXELS_API_KEY,
      pixabay: process.env.PIXABAY_API_KEY,
      unsplash: process.env.UNSPLASH_ACCESS_KEY
    };

    // Validate API keys
    this.validateApiKeys();
  }

  /**
   * Validate that all required API keys are present
   */
  validateApiKeys() {
    const missing = [];
    for (const [service, key] of Object.entries(this.apiKeys)) {
      if (!key) {
        missing.push(service.toUpperCase());
      }
    }

    if (missing.length > 0) {
      console.warn(`⚠️  Missing API keys for: ${missing.join(', ')}`);
      console.warn('   Set these environment variables:');
      missing.forEach(service => {
        console.warn(`   - ${service}_API_KEY`);
      });
    }
  }

  /**
   * Main fetch function - queries all 3 sources simultaneously
   * @param {string} query - Search query
   * @param {Object} options - Fetch options
   * @returns {Promise<Array>} Combined results from all sources
   */
  async fetchFromAllSources(query, options = {}) {
    const {
      perPage = config.scoring.candidatesPerSource,
      orientation = 'landscape',
      category = 'general'
    } = options;

    console.log(`\n🔍 Fetching images for: "${query}"`);
    console.log(`   Target: ${perPage} images per source (${perPage * 3} total)`);

    const promises = [];

    // Fetch from Pexels
    if (this.apiKeys.pexels) {
      promises.push(
        this.fetchFromPexels(query, { perPage, orientation })
          .catch(err => {
            console.error('❌ Pexels error:', err.message);
            return { source: 'pexels', images: [], error: err.message };
          })
      );
    }

    // Fetch from Pixabay
    if (this.apiKeys.pixabay) {
      promises.push(
        this.fetchFromPixabay(query, { perPage, orientation })
          .catch(err => {
            console.error('❌ Pixabay error:', err.message);
            return { source: 'pixabay', images: [], error: err.message };
          })
      );
    }

    // Fetch from Unsplash
    if (this.apiKeys.unsplash) {
      promises.push(
        this.fetchFromUnsplash(query, { perPage, orientation })
          .catch(err => {
            console.error('❌ Unsplash error:', err.message);
            return { source: 'unsplash', images: [], error: err.message };
          })
      );
    }

    // Wait for all promises to resolve
    const results = await Promise.all(promises);

    // Combine results
    const allImages = [];
    const summary = {
      total: 0,
      bySource: {}
    };

    results.forEach(result => {
      if (result.images && result.images.length > 0) {
        allImages.push(...result.images);
        summary.bySource[result.source] = result.images.length;
        summary.total += result.images.length;
      }
    });

    console.log(`✅ Fetched ${summary.total} total images:`);
    Object.entries(summary.bySource).forEach(([source, count]) => {
      console.log(`   - ${source}: ${count} images`);
    });

    return allImages;
  }

  /**
   * Fetch from Pexels API
   */
  async fetchFromPexels(query, options = {}) {
    await this.rateLimiters.pexels.waitIfNeeded();

    const { perPage = 20, orientation = 'landscape' } = options;

    const response = await this.makeRequestWithRetry(
      `${this.config.pexels.baseUrl}/search`,
      {
        headers: {
          'Authorization': this.apiKeys.pexels
        },
        params: {
          query,
          per_page: perPage,
          orientation
        },
        timeout: this.config.pexels.timeout
      }
    );

    const images = response.data.photos.map(photo => this.normalizePexelsImage(photo));

    return {
      source: 'pexels',
      images,
      totalAvailable: response.data.total_results
    };
  }

  /**
   * Fetch from Pixabay API
   */
  async fetchFromPixabay(query, options = {}) {
    await this.rateLimiters.pixabay.waitIfNeeded();

    const { perPage = 20, orientation = 'landscape' } = options;

    const response = await this.makeRequestWithRetry(
      this.config.pixabay.baseUrl,
      {
        params: {
          key: this.apiKeys.pixabay,
          q: query,
          per_page: perPage,
          orientation,
          image_type: 'photo',
          safesearch: 'true'
        },
        timeout: this.config.pixabay.timeout
      }
    );

    const images = response.data.hits.map(hit => this.normalizePixabayImage(hit));

    return {
      source: 'pixabay',
      images,
      totalAvailable: response.data.total
    };
  }

  /**
   * Fetch from Unsplash API
   */
  async fetchFromUnsplash(query, options = {}) {
    await this.rateLimiters.unsplash.waitIfNeeded();

    const { perPage = 20, orientation = 'landscape' } = options;

    const response = await this.makeRequestWithRetry(
      `${this.config.unsplash.baseUrl}/search/photos`,
      {
        headers: {
          'Authorization': `Client-ID ${this.apiKeys.unsplash}`
        },
        params: {
          query,
          per_page: perPage,
          orientation
        },
        timeout: this.config.unsplash.timeout
      }
    );

    const images = response.data.results.map(result => this.normalizeUnsplashImage(result));

    return {
      source: 'unsplash',
      images,
      totalAvailable: response.data.total
    };
  }

  /**
   * Make HTTP request with exponential backoff retry logic
   */
  async makeRequestWithRetry(url, options, retryCount = 0) {
    const maxRetries = this.config.retryConfig.maxRetries;
    const initialDelay = this.config.retryConfig.initialDelay;
    const backoffMultiplier = this.config.retryConfig.backoffMultiplier;

    try {
      const response = await axios.get(url, options);
      return response;
    } catch (error) {
      // Check if we should retry
      if (retryCount < maxRetries && this.shouldRetry(error)) {
        const delay = initialDelay * Math.pow(backoffMultiplier, retryCount);
        console.log(`   ⏳ Retry ${retryCount + 1}/${maxRetries} after ${delay}ms...`);

        await this.sleep(delay);
        return this.makeRequestWithRetry(url, options, retryCount + 1);
      }

      // If we've exhausted retries or shouldn't retry, throw the error
      throw error;
    }
  }

  /**
   * Determine if error is retryable
   */
  shouldRetry(error) {
    // Retry on network errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Retry on rate limit errors (429)
    if (error.response && error.response.status === 429) {
      return true;
    }

    // Retry on server errors (5xx)
    if (error.response && error.response.status >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Normalize Pexels image to standard format
   */
  normalizePexelsImage(photo) {
    return {
      id: `pexels-${photo.id}`,
      source: 'pexels',
      url: photo.src.original,
      urlLarge: photo.src.large2x,
      urlMedium: photo.src.large,
      urlSmall: photo.src.medium,
      width: photo.width,
      height: photo.height,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      description: photo.alt || '',
      alt: photo.alt || '',
      avgColor: photo.avg_color,
      tags: [],
      license: 'Pexels License (Free for commercial use)',
      created_at: null // Pexels doesn't provide this
    };
  }

  /**
   * Normalize Pixabay image to standard format
   */
  normalizePixabayImage(hit) {
    return {
      id: `pixabay-${hit.id}`,
      source: 'pixabay',
      url: hit.largeImageURL,
      urlLarge: hit.largeImageURL,
      urlMedium: hit.webformatURL,
      urlSmall: hit.previewURL,
      width: hit.imageWidth,
      height: hit.imageHeight,
      photographer: hit.user,
      photographerUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
      description: hit.tags || '',
      alt: hit.tags || '',
      tags: hit.tags ? hit.tags.split(', ') : [],
      license: 'Pixabay License (Free for commercial use)',
      created_at: null // Pixabay doesn't provide this reliably
    };
  }

  /**
   * Normalize Unsplash image to standard format
   */
  normalizeUnsplashImage(result) {
    return {
      id: `unsplash-${result.id}`,
      source: 'unsplash',
      url: result.urls.raw,
      urlLarge: result.urls.full,
      urlMedium: result.urls.regular,
      urlSmall: result.urls.small,
      width: result.width,
      height: result.height,
      photographer: result.user.name,
      photographerUrl: result.user.links.html,
      description: result.description || result.alt_description || '',
      alt: result.alt_description || '',
      tags: result.tags ? result.tags.map(t => t.title) : [],
      license: 'Unsplash License (Free for commercial use)',
      created_at: result.created_at,
      color: result.color
    };
  }

  /**
   * Sleep utility for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Rate Limiter Class
 * Ensures API rate limits are respected
 */
class RateLimiter {
  constructor(limits) {
    this.requestsPerHour = limits.requestsPerHour;
    this.requestsPerMinute = limits.requestsPerMinute;
    this.hourlyRequests = [];
    this.minuteRequests = [];
  }

  /**
   * Wait if rate limit would be exceeded
   */
  async waitIfNeeded() {
    const now = Date.now();

    // Clean up old requests (older than 1 hour)
    this.hourlyRequests = this.hourlyRequests.filter(time => now - time < 3600000);
    this.minuteRequests = this.minuteRequests.filter(time => now - time < 60000);

    // Check hourly limit
    if (this.hourlyRequests.length >= this.requestsPerHour) {
      const oldestRequest = this.hourlyRequests[0];
      const waitTime = 3600000 - (now - oldestRequest);
      console.log(`   ⏰ Hourly rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await this.sleep(waitTime);
    }

    // Check per-minute limit
    if (this.minuteRequests.length >= this.requestsPerMinute) {
      const oldestRequest = this.minuteRequests[0];
      const waitTime = 60000 - (now - oldestRequest);
      console.log(`   ⏰ Per-minute rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await this.sleep(waitTime);
    }

    // Record this request
    this.hourlyRequests.push(now);
    this.minuteRequests.push(now);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = APIFetcher;
