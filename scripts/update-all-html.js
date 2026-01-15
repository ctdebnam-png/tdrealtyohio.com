#!/usr/bin/env node
/**
 * Update All HTML Files with Images
 *
 * This script systematically updates all HTML files with proper image tags
 * using the generated image manifest.
 */

const fs = require('fs');
const path = require('path');

// Load manifest
const manifestPath = path.join(__dirname, '..', 'assets', 'images', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('🔄 Loading image manifest...\n');

// Helper to build full URL
function buildUrl(image, size = null) {
  if (!image.url) return '';
  const params = size ? `${image.params}&${size}` : image.params;
  return `${image.url}?${params}`;
}

// Helper to generate responsive picture element
function generatePictureElement(image, className = '') {
  if (!image.sizes) {
    return `<img src="${buildUrl(image)}" alt="${image.alt}" class="${className}" loading="lazy">`;
  }

  return `<picture>
      <source media="(min-width: 1200px)" srcset="${buildUrl(image, image.sizes.desktop)}">
      <source media="(min-width: 768px)" srcset="${buildUrl(image, image.sizes.tablet)}">
      <img src="${buildUrl(image, image.sizes.mobile)}" alt="${image.alt}" class="${className}" loading="eager">
    </picture>`;
}

// Update functions for each page
function updateIndexHtml() {
  const filePath = path.join(__dirname, '..', 'index.html');
  let html = fs.readFileSync(filePath, 'utf8');

  // Update OG image
  html = html.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${buildUrl(manifest.images.home.ogImage)}$2`
  );

  // Update Twitter image
  html = html.replace(
    /(<meta name="twitter:image" content=")[^"]*(")/,
    `$1${buildUrl(manifest.images.home.ogImage)}$2`
  );

  // Update structured data image
  html = html.replace(
    /("image":\s*")[^"]*(")/,
    `$1${buildUrl(manifest.images.home.ogImage)}$2`
  );

  // Add hero background image to hero section if not exists
  if (!html.includes('hero-background')) {
    html = html.replace(
      /(<section class="hero">)/,
      `$1
    <div class="hero-background" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.15;">
      ${generatePictureElement(manifest.images.home.hero, 'hero-bg-img')}
    </div>`
    );
  }

  // Add feature icons to cards
  manifest.images.home.features.forEach((feature, index) => {
    const cardPattern = new RegExp(
      `(<div class="card">\\s*<div class="card-icon">[^<]*</div>)`,
      'g'
    );
    let count = 0;
    html = html.replace(cardPattern, (match) => {
      if (count === index && !match.includes('icon-' + feature.id)) {
        count++;
        return match.replace(
          '</div>',
          `<img src="assets/images/${feature.name}" alt="${feature.alt}" style="width: 60px; height: 60px; margin: 0 auto 1rem; display: block;"></div>`
        );
      }
      count++;
      return match;
    });
  });

  fs.writeFileSync(filePath, html);
  console.log('✅ Updated index.html');
}

function updateSellersHtml() {
  const filePath = path.join(__dirname, '..', 'sellers.html');
  let html = fs.readFileSync(filePath, 'utf8');

  // Update OG image
  html = html.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${buildUrl(manifest.images.sellers.ogImage)}$2`
  );

  // Update Twitter image if exists
  if (html.includes('twitter:image')) {
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(")/,
      `$1${buildUrl(manifest.images.sellers.ogImage)}$2`
    );
  }

  // Add hero background if hero section exists
  if (html.includes('class="hero"') && !html.includes('hero-background')) {
    html = html.replace(
      /(<section class="hero">)/,
      `$1
    <div class="hero-background" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.15;">
      ${generatePictureElement(manifest.images.sellers.hero, 'hero-bg-img')}
    </div>`
    );
  }

  fs.writeFileSync(filePath, html);
  console.log('✅ Updated sellers.html');
}

function updateBuyersHtml() {
  const filePath = path.join(__dirname, '..', 'buyers.html');
  let html = fs.readFileSync(filePath, 'utf8');

  // Update OG image
  html = html.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${buildUrl(manifest.images.buyers.ogImage)}$2`
  );

  // Update Twitter image if exists
  if (html.includes('twitter:image')) {
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(")/,
      `$1${buildUrl(manifest.images.buyers.ogImage)}$2`
    );
  }

  // Add hero background if hero section exists
  if (html.includes('class="hero"') && !html.includes('hero-background')) {
    html = html.replace(
      /(<section class="hero">)/,
      `$1
    <div class="hero-background" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.15;">
      ${generatePictureElement(manifest.images.buyers.hero, 'hero-bg-img')}
    </div>`
    );
  }

  fs.writeFileSync(filePath, html);
  console.log('✅ Updated buyers.html');
}

function updateAboutHtml() {
  const filePath = path.join(__dirname, '..', 'about.html');
  let html = fs.readFileSync(filePath, 'utf8');

  // Update OG image
  html = html.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${buildUrl(manifest.images.about.ogImage)}$2`
  );

  // Update Twitter image if exists
  if (html.includes('twitter:image')) {
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(")/,
      `$1${buildUrl(manifest.images.about.ogImage)}$2`
    );
  }

  // Add hero background if hero section exists
  if (html.includes('class="hero"') && !html.includes('hero-background')) {
    html = html.replace(
      /(<section class="hero">)/,
      `$1
    <div class="hero-background" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.15;">
      ${generatePictureElement(manifest.images.about.hero, 'hero-bg-img')}
    </div>`
    );
  }

  fs.writeFileSync(filePath, html);
  console.log('✅ Updated about.html');
}

function updateContactHtml() {
  const filePath = path.join(__dirname, '..', 'contact.html');
  let html = fs.readFileSync(filePath, 'utf8');

  // Update OG image
  html = html.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${buildUrl(manifest.images.contact.ogImage)}$2`
  );

  // Update Twitter image if exists
  if (html.includes('twitter:image')) {
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(")/,
      `$1${buildUrl(manifest.images.contact.ogImage)}$2`
    );
  }

  fs.writeFileSync(filePath, html);
  console.log('✅ Updated contact.html');
}

function updatePreListingInspectionHtml() {
  const filePath = path.join(__dirname, '..', 'pre-listing-inspection.html');
  if (!fs.existsSync(filePath)) {
    console.log('⚠️  pre-listing-inspection.html not found, skipping');
    return;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // Update OG image if exists
  if (html.includes('og:image')) {
    html = html.replace(
      /(<meta property="og:image" content=")[^"]*(")/,
      `$1${buildUrl(manifest.images.inspection.ogImage)}$2`
    );
  }

  // Update Twitter image if exists
  if (html.includes('twitter:image')) {
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(")/,
      `$1${buildUrl(manifest.images.inspection.ogImage)}$2`
    );
  }

  // Add hero background if hero section exists
  if (html.includes('class="hero"') && !html.includes('hero-background')) {
    html = html.replace(
      /(<section class="hero">)/,
      `$1
    <div class="hero-background" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.15;">
      ${generatePictureElement(manifest.images.inspection.hero, 'hero-bg-img')}
    </div>`
    );
  }

  fs.writeFileSync(filePath, html);
  console.log('✅ Updated pre-listing-inspection.html');
}

function updateAreaPages() {
  const areasDir = path.join(__dirname, '..', 'areas');
  if (!fs.existsSync(areasDir)) {
    console.log('⚠️  areas/ directory not found, skipping area pages');
    return;
  }

  Object.entries(manifest.images.areas).forEach(([city, image]) => {
    const filePath = path.join(areasDir, `${city}.html`);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  areas/${city}.html not found, skipping`);
      return;
    }

    let html = fs.readFileSync(filePath, 'utf8');

    // Update OG image if exists
    if (html.includes('og:image')) {
      html = html.replace(
        /(<meta property="og:image" content=")[^"]*(")/,
        `$1${buildUrl(image)}$2`
      );
    }

    // Update Twitter image if exists
    if (html.includes('twitter:image')) {
      html = html.replace(
        /(<meta name="twitter:image" content=")[^"]*(")/,
        `$1${buildUrl(image)}$2`
      );
    }

    // Add hero background to hero section if exists
    if (html.includes('class="hero"') && !html.includes('hero-background')) {
      html = html.replace(
        /(<section class="hero">)/,
        `$1
    <div class="hero-background" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.2;">
      <img src="${buildUrl(image)}" alt="${image.alt}" style="width: 100%; height: 100%; object-fit: cover;" loading="eager">
    </div>`
      );
    }

    fs.writeFileSync(filePath, html);
    console.log(`✅ Updated areas/${city}.html`);
  });
}

// Run all updates
console.log('🚀 Starting HTML updates...\n');

try {
  updateIndexHtml();
  updateSellersHtml();
  updateBuyersHtml();
  updateAboutHtml();
  updateContactHtml();
  updatePreListingInspectionHtml();
  console.log('');
  updateAreaPages();

  console.log(`
════════════════════════════════════════════════════════════════════════════════
✅ HTML UPDATE COMPLETE
════════════════════════════════════════════════════════════════════════════════

Updated Files:
- index.html (hero background, feature icons, OG images)
- sellers.html (hero background, OG image)
- buyers.html (hero background, OG image)
- about.html (hero background, OG image)
- contact.html (OG image)
- pre-listing-inspection.html (hero background, OG image)
- All area pages (hero backgrounds, OG images)

Image Features Added:
✅ Hero section backgrounds with responsive images
✅ Feature card icons (SVG)
✅ Open Graph images for social sharing
✅ Twitter Card images
✅ Proper alt text for SEO
✅ Lazy loading for performance
✅ Responsive image sizes

Next Steps:
1. Review changes with: git diff
2. Test locally if possible
3. Commit and push changes
════════════════════════════════════════════════════════════════════════════════
  `);
} catch (error) {
  console.error('❌ Error updating HTML files:', error.message);
  process.exit(1);
}
