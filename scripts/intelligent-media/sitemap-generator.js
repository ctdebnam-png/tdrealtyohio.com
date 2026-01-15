/**
 * Image Sitemap Generator
 * Creates XML sitemap for Google Images SEO
 */

const fs = require('fs').promises;
const path = require('path');

class SitemapGenerator {
  constructor(baseUrl = 'https://tdrealtyohio.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate image sitemap XML
   * @param {Array} images - Array of optimized image objects
   * @returns {string} XML sitemap content
   */
  generateSitemap(images) {
    const header = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

    const footer = `</urlset>`;

    // Group images by page
    const imagesByPage = this.groupImagesByPage(images);

    // Generate URL entries
    const urlEntries = [];

    for (const [pageUrl, pageImages] of Object.entries(imagesByPage)) {
      const imageEntries = pageImages.map(img => this.generateImageEntry(img)).join('\n    ');

      urlEntries.push(`
  <url>
    <loc>${this.baseUrl}${pageUrl}</loc>
    ${imageEntries}
  </url>`);
    }

    return header + urlEntries.join('') + '\n' + footer;
  }

  /**
   * Generate individual image entry
   */
  generateImageEntry(image) {
    // Use the largest WebP variant
    const imageUrl = this.baseUrl + image.localPaths.variants.sizes[0].webp.url;

    // Escape XML special characters
    const escape = (str) => {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    return `<image:image>
      <image:loc>${escape(imageUrl)}</image:loc>
      <image:caption>${escape(image.seo.altText)}</image:caption>
      <image:title>${escape(image.seo.titleAttr)}</image:title>
      <image:license>${escape(image.attribution.sourceUrl)}</image:license>
    </image:image>`;
  }

  /**
   * Group images by page URL
   */
  groupImagesByPage(images) {
    const grouped = {};

    images.forEach(img => {
      const pageUrl = this.getPageUrl(img.context);

      if (!grouped[pageUrl]) {
        grouped[pageUrl] = [];
      }

      grouped[pageUrl].push(img);
    });

    return grouped;
  }

  /**
   * Get page URL from context
   */
  getPageUrl(context) {
    if (!context) return '/';

    const { category, page } = context;

    // Map category/page to actual URLs
    if (category === 'hero') {
      const pageMap = {
        'homepage': '/',
        'services-selling': '/selling.html',
        'services-buying': '/buyers.html',
        'pre-listing-inspection': '/pre-listing-inspection.html',
        'calculator': '/calculator.html'
      };
      return pageMap[page] || '/';
    }

    if (category === 'neighborhood') {
      return `/areas/${page}.html`;
    }

    if (category === 'blog') {
      return `/blog/${page}.html`;
    }

    return '/';
  }

  /**
   * Save sitemap to file
   */
  async saveSitemap(images, outputPath = './images-sitemap.xml') {
    const xml = this.generateSitemap(images);

    await fs.writeFile(outputPath, xml, 'utf8');

    console.log(`✅ Image sitemap saved to: ${outputPath}`);
    console.log(`   Contains ${images.length} images`);

    return outputPath;
  }

  /**
   * Generate robots.txt entry
   */
  generateRobotsTxtEntry(sitemapUrl) {
    return `\n# Image Sitemap\nSitemap: ${sitemapUrl}\n`;
  }

  /**
   * Update robots.txt with sitemap reference
   */
  async updateRobotsTxt(sitemapUrl, robotsTxtPath = './robots.txt') {
    try {
      let content = '';

      // Read existing robots.txt if it exists
      try {
        content = await fs.readFile(robotsTxtPath, 'utf8');
      } catch (error) {
        // File doesn't exist, create new
        content = '# Robots.txt\n';
      }

      // Check if sitemap already referenced
      if (!content.includes(sitemapUrl)) {
        content += this.generateRobotsTxtEntry(sitemapUrl);
        await fs.writeFile(robotsTxtPath, content, 'utf8');
        console.log(`✅ Updated robots.txt with sitemap reference`);
      } else {
        console.log(`ℹ️  robots.txt already contains sitemap reference`);
      }

    } catch (error) {
      console.error(`❌ Error updating robots.txt:`, error.message);
    }
  }

  /**
   * Generate HTML sitemap page for human viewing
   */
  generateHTMLSitemap(images) {
    const imagesByCategory = {};

    images.forEach(img => {
      const category = img.context?.category || 'other';

      if (!imagesByCategory[category]) {
        imagesByCategory[category] = [];
      }

      imagesByCategory[category].push(img);
    });

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Gallery - TD Realty Ohio</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1 { color: #333; }
        h2 {
            color: #666;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-top: 40px;
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .image-card {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .image-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .image-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }
        .image-info {
            padding: 15px;
        }
        .image-title {
            font-weight: 600;
            color: #333;
            margin: 0 0 8px 0;
        }
        .image-meta {
            font-size: 0.85em;
            color: #666;
            line-height: 1.5;
        }
        .score {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-top: 8px;
        }
        .attribution {
            font-size: 0.75em;
            color: #999;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <h1>📸 Image Gallery - TD Realty Ohio</h1>
    <p>Intelligent media management system - all images optimized for SEO and performance</p>
`;

    for (const [category, categoryImages] of Object.entries(imagesByCategory)) {
      html += `\n    <h2>${this.capitalize(category)} (${categoryImages.length})</h2>`;
      html += `\n    <div class="image-grid">`;

      categoryImages.forEach(img => {
        const imageUrl = img.localPaths.variants.sizes[img.localPaths.variants.sizes.length - 1].webp.url;
        const score = img.scoring?.total || 0;

        html += `
        <div class="image-card">
            <img src="${imageUrl}" alt="${img.seo.altText}" loading="lazy">
            <div class="image-info">
                <div class="image-title">${img.seo.titleAttr}</div>
                <div class="image-meta">
                    <div>${img.metadata.width}×${img.metadata.height}px</div>
                    <div>Source: ${img.source}</div>
                    <span class="score">Score: ${score.toFixed(1)}/100</span>
                </div>
                <div class="attribution">${img.attribution.attributionHtml}</div>
            </div>
        </div>`;
      });

      html += `\n    </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Save HTML sitemap
   */
  async saveHTMLSitemap(images, outputPath = './image-gallery.html') {
    const html = this.generateHTMLSitemap(images);

    await fs.writeFile(outputPath, html, 'utf8');

    console.log(`✅ HTML image gallery saved to: ${outputPath}`);

    return outputPath;
  }

  /**
   * Capitalize string
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = SitemapGenerator;
