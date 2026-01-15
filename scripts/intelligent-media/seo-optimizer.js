/**
 * SEO-Optimized Image Processing
 * Handles file naming, alt text, WebP conversion, EXIF metadata, and structured data
 */

const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config.json');
const categories = require('./categories.json');

class SEOOptimizer {
  constructor(outputDir = './assets/media/intelligent') {
    this.outputDir = outputDir;
    this.metadata = categories.metadata;
  }

  /**
   * Main optimization function - processes an image with all SEO enhancements
   * @param {Object} image - Image object from API
   * @param {Object} context - Context (category, page, keywords)
   * @returns {Promise<Object>} Processed image data
   */
  async optimizeImage(image, context) {
    console.log(`\n🔧 Optimizing image: ${image.id}`);

    // 1. Generate SEO-optimized filename
    const filename = this.generateSEOFilename(image, context);
    console.log(`   📝 Filename: ${filename}`);

    // 2. Download original image
    const originalPath = path.join(this.outputDir, 'original', filename + '.jpg');
    await this.downloadImage(image.url, originalPath);

    // 3. Generate alt text
    const altText = this.generateAltText(image, context);
    console.log(`   📝 Alt text: ${altText}`);

    // 4. Generate title attribute
    const titleAttr = this.generateTitleAttribute(context);
    console.log(`   📝 Title: ${titleAttr}`);

    // 5. Create responsive sizes and WebP versions
    const variants = await this.createResponsiveVariants(originalPath, filename, context);
    console.log(`   ✅ Created ${variants.length} variants`);

    // 6. Generate structured data
    const structuredData = this.generateStructuredData(image, context, variants);

    // 7. Create attribution data
    const attribution = this.generateAttribution(image);

    return {
      id: image.id,
      source: image.source,
      originalUrl: image.url,
      filename,
      localPaths: {
        original: originalPath,
        variants
      },
      seo: {
        altText,
        titleAttr,
        filename
      },
      structuredData,
      attribution,
      metadata: {
        width: image.width,
        height: image.height,
        photographer: image.photographer,
        photographerUrl: image.photographerUrl,
        license: image.license
      }
    };
  }

  /**
   * Generate SEO-optimized filename
   * Pattern: [primary-keyword]-[secondary-keyword]-[location]-[descriptor]-[photographer-name]
   */
  generateSEOFilename(image, context) {
    const parts = [];

    // Primary keywords from metadata
    const primaryKeywords = this.metadata.primaryKeywords[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    parts.push(primaryKeywords);

    // Page-specific keywords
    if (context.page) {
      const pageSlug = context.page
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      parts.push(pageSlug);
    }

    // Location
    const location = 'columbus-ohio';
    parts.push(location);

    // Descriptor from category
    if (context.category) {
      parts.push(context.category);
    }

    // Photographer name (cleaned)
    if (image.photographer) {
      const photographerSlug = image.photographer
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 20); // Limit length
      parts.push(photographerSlug);
    }

    // Combine and clean
    const filename = parts.join('-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100); // Limit total length

    return filename;
  }

  /**
   * Generate comprehensive alt text for SEO
   * Format: "[Primary keyword] - [Image description] - [Location if relevant] | TD Realty Ohio"
   */
  generateAltText(image, context) {
    const parts = [];

    // Primary keyword
    parts.push(this.metadata.primaryKeywords[0]);

    // Image description
    let description = image.description || image.alt || '';

    // If no good description, generate one from context
    if (!description || description.length < 20) {
      description = this.generateDescriptionFromContext(context);
    }

    // Clean and add description
    description = description
      .replace(/[|]/g, '-')
      .substring(0, 100);
    parts.push(description);

    // Location
    parts.push(this.metadata.location);

    // Brand
    const altText = `${parts.join(' - ')} | ${this.metadata.siteName}`;

    // Ensure it's not too long (max 125 chars for accessibility)
    return altText.substring(0, 125);
  }

  /**
   * Generate title attribute
   * Format: "[Keyword] in [Location] - TD Realty Ohio"
   */
  generateTitleAttribute(context) {
    const keyword = context.page ?
      context.page.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) :
      'Real Estate';

    return `${keyword} in ${this.metadata.location} - ${this.metadata.siteName}`;
  }

  /**
   * Generate description from context when image has none
   */
  generateDescriptionFromContext(context) {
    const templates = {
      hero: 'Professional real estate photography',
      neighborhood: `Beautiful homes in ${context.page || 'Columbus neighborhood'}`,
      blog: 'Real estate insights and tips',
      trust: 'Happy homeowners and satisfied clients',
      icons: 'Real estate service icon'
    };

    return templates[context.category] || 'Professional real estate image';
  }

  /**
   * Download image from URL
   */
  async downloadImage(url, outputPath) {
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 60000
    });

    await fs.writeFile(outputPath, response.data);
  }

  /**
   * Create responsive variants with WebP optimization
   * Creates multiple sizes: 1920w, 1600w, 1024w, 640w, 400w (depending on category)
   */
  async createResponsiveVariants(originalPath, baseFilename, context) {
    const variants = [];

    // Get sizes for this category
    const categoryConfig = config.optimization.sizes[context.category] ||
                          config.optimization.sizes.standard;

    // Create directories
    const webpDir = path.join(this.outputDir, 'webp');
    const jpgDir = path.join(this.outputDir, 'jpg');

    await fs.mkdir(webpDir, { recursive: true });
    await fs.mkdir(jpgDir, { recursive: true });

    // Process each size
    for (const width of categoryConfig) {
      // WebP version
      const webpPath = path.join(webpDir, `${baseFilename}-${width}w.webp`);
      await sharp(originalPath)
        .resize(width, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({
          quality: config.optimization.quality.webp,
          effort: 6
        })
        .toFile(webpPath);

      // JPG version (fallback)
      const jpgPath = path.join(jpgDir, `${baseFilename}-${width}w.jpg`);
      await sharp(originalPath)
        .resize(width, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({
          quality: config.optimization.quality.jpg,
          progressive: true,
          mozjpeg: true
        })
        .toFile(jpgPath);

      // Get file sizes
      const webpStats = await fs.stat(webpPath);
      const jpgStats = await fs.stat(jpgPath);

      variants.push({
        width,
        webp: {
          path: webpPath,
          size: webpStats.size,
          url: webpPath.replace(this.outputDir, '/assets/media/intelligent')
        },
        jpg: {
          path: jpgPath,
          size: jpgStats.size,
          url: jpgPath.replace(this.outputDir, '/assets/media/intelligent')
        }
      });
    }

    // Generate blur placeholder (20px wide)
    const placeholderPath = path.join(this.outputDir, 'placeholders', `${baseFilename}-placeholder.jpg`);
    await fs.mkdir(path.dirname(placeholderPath), { recursive: true });

    await sharp(originalPath)
      .resize(20, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .blur(2)
      .jpeg({ quality: 50 })
      .toFile(placeholderPath);

    // Convert placeholder to base64
    const placeholderBuffer = await fs.readFile(placeholderPath);
    const placeholderBase64 = `data:image/jpeg;base64,${placeholderBuffer.toString('base64')}`;

    return {
      sizes: variants,
      placeholder: placeholderBase64
    };
  }

  /**
   * Generate ImageObject structured data
   */
  generateStructuredData(image, context, variants) {
    const largestVariant = variants.sizes[0];

    return {
      "@context": "https://schema.org",
      "@type": "ImageObject",
      "contentUrl": largestVariant.webp.url,
      "url": largestVariant.webp.url,
      "description": this.generateAltText(image, context),
      "name": this.generateTitleAttribute(context),
      "author": {
        "@type": "Person",
        "name": image.photographer,
        "url": image.photographerUrl
      },
      "copyrightNotice": `Photo by ${image.photographer} via ${image.source} - Used by ${this.metadata.siteName}`,
      "creditText": `${image.photographer} / ${image.source}`,
      "license": image.license,
      "acquireLicensePage": image.photographerUrl,
      "creator": {
        "@type": "Person",
        "name": image.photographer
      },
      "width": image.width,
      "height": image.height,
      "uploadDate": image.created_at || new Date().toISOString()
    };
  }

  /**
   * Generate attribution data for compliance
   */
  generateAttribution(image) {
    return {
      photographer: image.photographer,
      photographerUrl: image.photographerUrl,
      source: image.source,
      sourceUrl: this.getSourceUrl(image.source),
      license: image.license,
      attributionText: `Photo by ${image.photographer} from ${this.capitalizeFirst(image.source)}`,
      attributionHtml: `Photo by <a href="${image.photographerUrl}" target="_blank" rel="noopener">${image.photographer}</a> from <a href="${this.getSourceUrl(image.source)}" target="_blank" rel="noopener">${this.capitalizeFirst(image.source)}</a>`
    };
  }

  /**
   * Get source platform URL
   */
  getSourceUrl(source) {
    const urls = {
      pexels: 'https://www.pexels.com',
      pixabay: 'https://pixabay.com',
      unsplash: 'https://unsplash.com'
    };
    return urls[source] || '';
  }

  /**
   * Generate srcset string for responsive images
   */
  generateSrcSet(variants, format = 'webp') {
    return variants.sizes
      .map(v => `${v[format].url} ${v.width}w`)
      .join(', ');
  }

  /**
   * Generate sizes attribute
   */
  generateSizesAttribute(context) {
    // Default sizes based on category
    const templates = {
      hero: '100vw',
      neighborhood: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px',
      blog: '(max-width: 768px) 100vw, 700px',
      trust: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px',
      icons: '(max-width: 768px) 100px, 200px'
    };

    return templates[context.category] || '100vw';
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Batch optimize multiple images
   */
  async batchOptimize(images, contexts) {
    console.log(`\n🔧 BATCH OPTIMIZATION: ${images.length} images`);

    const results = [];

    for (let i = 0; i < images.length; i++) {
      try {
        console.log(`\nProcessing ${i + 1}/${images.length}...`);
        const result = await this.optimizeImage(images[i], contexts[i]);
        results.push(result);

        // Small delay to avoid overwhelming the system
        await this.sleep(500);

      } catch (error) {
        console.error(`❌ Error optimizing ${images[i].id}:`, error.message);
        results.push({
          id: images[i].id,
          error: error.message
        });
      }
    }

    console.log(`\n✅ Batch optimization complete: ${results.filter(r => !r.error).length}/${images.length} successful`);

    return results;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SEOOptimizer;
