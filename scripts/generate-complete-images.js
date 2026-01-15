#!/usr/bin/env node
/**
 * Complete Image Generation for TD Realty Ohio
 *
 * This script generates a complete image manifest using Unsplash Source URLs
 * and creates SVG icons for all pages. It's designed to work without API keys.
 *
 * Features:
 * - Hero images from Unsplash (free, no API key needed)
 * - SVG icons generated locally (professional, scalable)
 * - Complete manifest for all pages
 * - SEO-optimized alt text
 * - Responsive image sizes
 */

const fs = require('fs');
const path = require('path');

// Image manifest with all required images
const imageManifest = {
  version: '2.0.0',
  generated: new Date().toISOString(),
  images: {
    // HOME PAGE
    home: {
      hero: {
        url: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6',
        params: 'w=1920&h=1080&fit=crop&q=85',
        alt: 'Beautiful Columbus Ohio neighborhood with modern homes, tree-lined streets, and blue sky - TD Realty Ohio 1% commission real estate',
        sizes: {
          desktop: 'w=1920',
          tablet: 'w=1024',
          mobile: 'w=640'
        }
      },
      features: [
        {
          id: 'commission',
          name: 'icon-commission.svg',
          alt: '1% commission rate - save thousands on your home sale',
          svg: true
        },
        {
          id: 'inspection',
          name: 'icon-inspection.svg',
          alt: 'Pre-listing inspection included with every listing',
          svg: true
        },
        {
          id: 'fullservice',
          name: 'icon-fullservice.svg',
          alt: 'Full-service real estate brokerage - not discount service',
          svg: true
        },
        {
          id: 'local',
          name: 'icon-local.svg',
          alt: 'Central Ohio expertise - serving Columbus since 2017',
          svg: true
        }
      ],
      ogImage: {
        url: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6',
        params: 'w=1200&h=630&fit=crop&q=80',
        alt: 'TD Realty Ohio - 1% Commission Real Estate Columbus'
      }
    },

    // SELLERS PAGE
    sellers: {
      hero: {
        url: 'https://images.unsplash.com/photo-1560184897-ae75f418493e',
        params: 'w=1920&h=1080&fit=crop&q=85',
        alt: 'Stunning home exterior for sale in Columbus Ohio - professional real estate photography',
        sizes: {
          desktop: 'w=1920',
          tablet: 'w=1024',
          mobile: 'w=640'
        }
      },
      ogImage: {
        url: 'https://images.unsplash.com/photo-1560184897-ae75f418493e',
        params: 'w=1200&h=630&fit=crop&q=80',
        alt: 'Sell Your Columbus Home for 1% Commission'
      }
    },

    // BUYERS PAGE
    buyers: {
      hero: {
        url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750',
        params: 'w=1920&h=1080&fit=crop&q=85',
        alt: 'Beautiful home interior welcoming new homebuyers in Central Ohio',
        sizes: {
          desktop: 'w=1920',
          tablet: 'w=1024',
          mobile: 'w=640'
        }
      },
      ogImage: {
        url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750',
        params: 'w=1200&h=630&fit=crop&q=80',
        alt: 'Buy Your Columbus Home with Expert Guidance'
      }
    },

    // PRE-LISTING INSPECTION PAGE
    inspection: {
      hero: {
        url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952',
        params: 'w=1920&h=1080&fit=crop&q=85',
        alt: 'Professional home inspector examining property - pre-listing inspection included',
        sizes: {
          desktop: 'w=1920',
          tablet: 'w=1024',
          mobile: 'w=640'
        }
      },
      ogImage: {
        url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952',
        params: 'w=1200&h=630&fit=crop&q=80',
        alt: 'Free Pre-Listing Inspection with Every TD Realty Listing'
      }
    },

    // ABOUT PAGE
    about: {
      hero: {
        url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
        params: 'w=1920&h=1080&fit=crop&q=85',
        alt: 'Professional real estate broker serving Columbus Ohio communities',
        sizes: {
          desktop: 'w=1920',
          tablet: 'w=1024',
          mobile: 'w=640'
        }
      },
      ogImage: {
        url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
        params: 'w=1200&h=630&fit=crop&q=80',
        alt: 'About TD Realty Ohio - Your Central Ohio Real Estate Expert'
      }
    },

    // CONTACT PAGE
    contact: {
      ogImage: {
        url: 'https://images.unsplash.com/photo-1534536281715-e28d76689b4d',
        params: 'w=1200&h=630&fit=crop&q=80',
        alt: 'Contact TD Realty Ohio - (614) 956-8656'
      }
    },

    // AREA PAGES (17 cities)
    areas: {
      columbus: {
        url: 'https://images.unsplash.com/photo-1464146072230-91cabc968266',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Columbus Ohio downtown skyline and neighborhoods - real estate market'
      },
      dublin: {
        url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Dublin Ohio suburban homes with award-winning schools'
      },
      westerville: {
        url: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Westerville Ohio uptown charm and residential neighborhoods'
      },
      powell: {
        url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Powell Ohio family-friendly neighborhoods and homes'
      },
      'new-albany': {
        url: 'https://images.unsplash.com/photo-1605146769289-440113cc3d00',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'New Albany Ohio executive homes and upscale communities'
      },
      'upper-arlington': {
        url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Upper Arlington Ohio established community with tree-lined streets'
      },
      hilliard: {
        url: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Hilliard Ohio suburban homes and growing community'
      },
      gahanna: {
        url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Gahanna Ohio creekside homes and neighborhoods'
      },
      worthington: {
        url: 'https://images.unsplash.com/photo-1567496898647-8aa1e0d7d774',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Worthington Ohio historic homes and charming downtown'
      },
      delaware: {
        url: 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Delaware Ohio county homes and growing communities'
      },
      'lewis-center': {
        url: 'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Lewis Center Ohio growing suburban community'
      },
      galena: {
        url: 'https://images.unsplash.com/photo-1576941089067-2de3c901e126',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Galena Ohio rural and suburban homes'
      },
      sunbury: {
        url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Sunbury Ohio residential neighborhoods'
      },
      pickerington: {
        url: 'https://images.unsplash.com/photo-1554995207-c18c203602cb',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Pickerington Ohio homes and family communities'
      },
      pataskala: {
        url: 'https://images.unsplash.com/photo-1592595896551-12b371d546d5',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Pataskala Ohio neighborhood homes'
      },
      blacklick: {
        url: 'https://images.unsplash.com/photo-1598228723793-52759bba239c',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Blacklick Ohio residential area homes'
      },
      clintonville: {
        url: 'https://images.unsplash.com/photo-1575517111478-7f6afd0973db',
        params: 'w=800&h=600&fit=crop&q=85',
        alt: 'Clintonville Columbus neighborhood with historic homes'
      }
    }
  }
};

// SVG icon templates
const svgIcons = {
  commission: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none">
  <circle cx="200" cy="200" r="180" fill="#EEF2FF" stroke="#4F46E5" stroke-width="4"/>
  <path d="M140 160h120v120h-120z" fill="#4F46E5" opacity="0.1"/>
  <path d="M150 120l100 80-100 80v-160z" fill="#4F46E5"/>
  <text x="200" y="340" font-family="Arial, sans-serif" font-size="60" font-weight="bold" text-anchor="middle" fill="#1E293B">1%</text>
</svg>`,

  inspection: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none">
  <rect x="100" y="60" width="200" height="280" rx="8" fill="#F1F5F9" stroke="#64748B" stroke-width="4"/>
  <line x1="130" y1="100" x2="270" y2="100" stroke="#64748B" stroke-width="3"/>
  <line x1="130" y1="140" x2="270" y2="140" stroke="#64748B" stroke-width="3"/>
  <line x1="130" y1="180" x2="270" y2="180" stroke="#64748B" stroke-width="3"/>
  <line x1="130" y1="220" x2="270" y2="220" stroke="#64748B" stroke-width="3"/>
  <circle cx="140" cy="100" r="8" fill="#10B981"/>
  <circle cx="140" cy="140" r="8" fill="#10B981"/>
  <circle cx="140" cy="180" r="8" fill="#10B981"/>
  <path d="M135 218 l5 5 l10 -12" stroke="#10B981" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`,

  fullservice: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none">
  <circle cx="200" cy="200" r="180" fill="#FEF3C7" stroke="#F59E0B" stroke-width="4"/>
  <path d="M120 220h160v100h-160z" fill="#F59E0B" opacity="0.2"/>
  <path d="M200 100l100 120h-200z" fill="#F59E0B"/>
  <rect x="170" y="240" width="60" height="80" fill="#F59E0B"/>
  <circle cx="200" cy="160" r="8" fill="#FFF"/>
</svg>`,

  local: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none">
  <circle cx="200" cy="200" r="180" fill="#DBEAFE" stroke="#2563EB" stroke-width="4"/>
  <path d="M200 80 l20 60 l60 0 l-50 40 l20 60 l-50 -40 l-50 40 l20 -60 l-50 -40 l60 0 z" fill="#2563EB" opacity="0.8"/>
  <circle cx="200" cy="200" r="60" fill="none" stroke="#2563EB" stroke-width="3"/>
  <circle cx="200" cy="200" r="8" fill="#DC2626"/>
  <text x="200" y="330" font-family="Arial, sans-serif" font-size="40" font-weight="bold" text-anchor="middle" fill="#1E293B">OHIO</text>
</svg>`
};

// Create assets/images directory if it doesn't exist
const imagesDir = path.join(__dirname, '..', 'assets', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('✅ Created assets/images directory');
}

// Write SVG icons
console.log('\n📝 Generating SVG icons...\n');
Object.entries(svgIcons).forEach(([name, svg]) => {
  const filePath = path.join(imagesDir, `icon-${name}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`✅ Created icon-${name}.svg`);
});

// Write manifest
const manifestPath = path.join(__dirname, '..', 'assets', 'images', 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(imageManifest, null, 2));
console.log(`\n✅ Created image manifest: ${manifestPath}\n`);

// Helper function to build full image URL
function buildImageUrl(image, size = null) {
  if (!image.url) return '';
  const params = size ? `${image.params}&${size}` : image.params;
  return `${image.url}?${params}`;
}

// Generate image reference documentation
const docsPath = path.join(__dirname, '..', 'IMAGE-URLS.md');
let docs = `# TD Realty Ohio - Image URLs Reference\n\n`;
docs += `Generated: ${new Date().toISOString()}\n\n`;
docs += `## Hero Images\n\n`;

Object.entries(imageManifest.images).forEach(([page, data]) => {
  if (data.hero) {
    docs += `### ${page.toUpperCase()}\n`;
    docs += `**Desktop:** ${buildImageUrl(data.hero, data.hero.sizes.desktop)}\n`;
    docs += `**Tablet:** ${buildImageUrl(data.hero, data.hero.sizes.tablet)}\n`;
    docs += `**Mobile:** ${buildImageUrl(data.hero, data.hero.sizes.mobile)}\n`;
    docs += `**Alt:** ${data.hero.alt}\n\n`;
  }
});

docs += `## Area Images\n\n`;
if (imageManifest.images.areas) {
  Object.entries(imageManifest.images.areas).forEach(([city, image]) => {
    docs += `**${city}:** ${buildImageUrl(image)}\n`;
  });
}

fs.writeFileSync(docsPath, docs);
console.log(`✅ Created image documentation: ${docsPath}\n`);

console.log(`
════════════════════════════════════════════════════════════════════════════════
✅ IMAGE GENERATION COMPLETE
════════════════════════════════════════════════════════════════════════════════

Generated Assets:
- 4 SVG icons (commission, inspection, fullservice, local)
- Complete image manifest with all URLs
- Documentation file with all image references

Image Sources:
- Hero images: Unsplash (free, professional stock photos)
- Icons: SVG (scalable, professional, custom-generated)
- All images have SEO-optimized alt text
- Responsive sizes configured for all devices

Next Steps:
1. Run the HTML update script to inject images into all pages
2. Verify images display correctly
3. Commit and push changes

Image Manifest: ${manifestPath}
Documentation: ${docsPath}
SVG Icons: ${imagesDir}/icon-*.svg
════════════════════════════════════════════════════════════════════════════════
`);
