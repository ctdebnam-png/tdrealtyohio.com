# Media Integration Guide

This document explains how to use the R2 media pipeline integration on the TD Realty Ohio website.

## Overview

The media integration system consists of three components:

1. **Build-time injection** - Automatically injects hero images into HTML pages
2. **Client-side component** - Dynamic image rendering via JavaScript
3. **Credits page** - Auto-generated attribution page

## Build Process

Run the full build process:

```bash
npm run build
```

This executes:
1. `media:sync` - Downloads images from Openverse/Wikimedia Commons
2. `media:inject` - Injects hero images into HTML pages
3. `media:credits` - Generates image-credits.html page

### Individual Commands

```bash
# Download and process images
npm run media:sync

# Inject hero images into HTML
npm run media:inject

# Generate credits page
npm run media:credits

# Verify manifest integrity
npm run media:verify
```

## Hero Image Injection

The `inject-media.ts` script automatically injects hero images into these pages:

- `index.html` → topic: "hero"
- `about.html` → topic: "hero"
- `buyers.html` → topic: "buyers"
- `sellers.html` → topic: "sellers"

The script:
- Finds `<section class="hero">` elements
- Inserts a `<picture>` element with WebP image
- Adds proper styling for background coverage
- Ensures content has proper z-index layering

## Client-Side Component

For dynamic image rendering, use the `data-legal-image` attribute:

```html
<div data-legal-image="hero"></div>
```

### Attributes

- `data-legal-image="topic"` - Required. The image topic (hero, sellers, buyers, neighborhoods)
- `data-slot="0"` - Optional. Specific image index (0, 1, 2...)
- `data-class="my-class"` - Optional. CSS class for the picture element
- `data-show-credit` - Optional. Shows attribution link below image

### Example Usage

```html
<!-- Random hero image -->
<div data-legal-image="hero"></div>

<!-- Specific neighborhood image -->
<div data-legal-image="neighborhoods" data-slot="0"></div>

<!-- With custom class and credit -->
<div data-legal-image="sellers" data-class="featured-image" data-show-credit></div>
```

The component loads `/media/manifest.json` and renders images as `<picture>` elements with WebP sources.

## Image Topics

Defined in `media/topics.json`:

- **hero** - Columbus skyline, downtown, Ohio real estate
- **sellers** - For sale signs, house exteriors
- **buyers** - Family homes, keys, new homeowners
- **neighborhoods** - Dublin, Worthington, Hilliard, Westerville

## Image Credits Page

The `generate-credits.ts` script creates `image-credits.html` with:

- Table of all images from manifest
- Preview thumbnails
- Creator attribution
- License information
- Links to source pages
- Statistics (total images, topics, last updated)

The page is automatically regenerated on every build.

## Manifest Structure

`public/media/manifest.json` contains an array of image metadata:

```json
[
  {
    "id": "openverse_12345",
    "topic": "hero",
    "cdnUrl": "https://media.tdrealtyohio.com/image.webp",
    "sourceUrl": "https://openverse.org/image/12345",
    "license": "cc0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "creator": "John Doe",
    "attribution": "Photo by John Doe - CC0",
    "width": 1920,
    "height": 1080,
    "retrievedAt": "2026-01-14T12:00:00.000Z"
  }
]
```

## Local Development

Without R2 configuration, the pipeline still works:
- Images download and convert to WebP
- Manifest uses source URLs instead of CDN URLs
- All features work normally with direct source links

## Production Deployment

On Cloudflare Pages with R2 configured:
- Images upload to R2 bucket
- Manifest uses CDN URLs (e.g., `https://media.tdrealtyohio.com/...`)
- All images served from your domain
- No hotlinking to external sources

## Adding New Pages

To add hero image injection to a new page:

1. Edit `scripts/inject-media.ts`
2. Add page to `PAGES_TO_UPDATE` array
3. Map page filename to appropriate topic
4. Run `npm run media:inject`

## Adding New Topics

To add new image categories:

1. Edit `media/topics.json`
2. Add topic with search queries
3. Run `npm run media:sync`
4. Update client-side code to use new topics

## Troubleshooting

### No images appearing

1. Check manifest exists: `cat public/media/manifest.json`
2. Verify manifest has images: `npm run media:verify`
3. Check browser console for errors
4. Ensure `legal-image.js` is loaded

### Hero images not injected

1. Verify page has `<section class="hero">` element
2. Run `npm run media:inject` manually
3. Check script output for errors

### Credits page empty

1. Ensure manifest exists with images
2. Run `npm run media:credits` manually
3. Check for generation errors

## License Compliance

All images are sourced from:
- **Openverse** (CC0, PDM, CC-BY, CC-BY-SA)
- **Wikimedia Commons** (CC0, PDM, CC-BY, CC-BY-SA)

Attribution is provided for all images, even when not legally required (CC0, PDM), for transparency and respect to creators.
