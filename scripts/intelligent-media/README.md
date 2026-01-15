# Intelligent Media Management System

**Automated media selection, optimization, and management for TD Realty Ohio**

Version 1.0.0

---

## 🚀 Overview

This system provides intelligent, fully-automated image selection across Pexels, Pixabay, and Unsplash with advanced scoring, SEO optimization, and performance tracking.

### Key Features

✅ **Smart Multi-Source Selection** - Fetches 45-60 candidates per query across 3 sources
✅ **Intelligent Scoring Algorithm** - 4-factor weighted scoring (Quality, Relevance, SEO, Engagement)
✅ **SEO-Optimized Processing** - Auto-generated filenames, alt text, structured data
✅ **WebP Optimization** - Responsive images with automatic compression
✅ **Performance Tracking** - SQLite database for metrics and analytics
✅ **Automatic Refresh** - Time-based, performance-based, and seasonal triggers
✅ **Image Sitemap Generation** - Google Images SEO optimization
✅ **Attribution Compliance** - Automatic photographer credits and licensing

---

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Scoring System](#scoring-system)
- [Category Definitions](#category-definitions)
- [Commands](#commands)
- [File Structure](#file-structure)
- [API Rate Limits](#api-rate-limits)
- [Troubleshooting](#troubleshooting)

---

## 🔧 Installation

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `axios` - API requests
- `sharp` - Image optimization
- `sqlite3` - Database
- `dotenv` - Environment variables

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Required API Keys
PEXELS_API_KEY=your_pexels_key_here
PIXABAY_API_KEY=your_pixabay_key_here
UNSPLASH_ACCESS_KEY=your_unsplash_key_here

# Optional R2 Configuration
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET=tdrealtyohio-media
R2_PUBLIC_BASE_URL=https://media.tdrealtyohio.com
```

**Get Your API Keys:**
- **Pexels**: https://www.pexels.com/api/
- **Pixabay**: https://pixabay.com/api/docs/
- **Unsplash**: https://unsplash.com/developers

All three platforms offer free API access for commercial use.

### 3. Create Required Directories

```bash
mkdir -p assets/media/intelligent/{original,webp,jpg,placeholders}
mkdir -p data
```

---

## ⚙️ Configuration

### Scoring Weights

Edit `scripts/intelligent-media/config.json` to adjust scoring weights:

```json
{
  "scoring": {
    "weights": {
      "quality": 0.35,      // 35% - Resolution, aspect ratio, composition
      "relevance": 0.30,    // 30% - Keyword match, context
      "seo": 0.20,          // 20% - Filename, metadata, uniqueness
      "engagement": 0.15    // 15% - Human faces, warm tones, action
    },
    "autoSelectThreshold": 85  // Auto-approve if score >= 85
  }
}
```

### Category Definitions

Edit `scripts/intelligent-media/categories.json` to modify image categories:

```json
{
  "categories": {
    "hero": {
      "minResolution": 1920,
      "aspectRatio": 1.78,
      "pages": {
        "homepage": {
          "keywords": ["Columbus Ohio luxury homes", "modern real estate"],
          "count": 1
        }
      }
    }
  }
}
```

---

## 🚦 Quick Start

### Test Run (~20 Images)

Validate the system with a small batch:

```bash
npm run intelligent:test
```

This will:
1. Select and optimize ~20 images across multiple categories
2. Generate sitemaps and manifests
3. Display detailed scoring analysis
4. Create HTML gallery for review

**Expected Output:**
- `./image-gallery.html` - Visual gallery of selected images
- `./images-sitemap.xml` - XML sitemap for Google
- `./assets/media/intelligent/manifest.json` - Image metadata
- `./data/intelligent-media.db` - SQLite database

### Review Results

Open `image-gallery.html` in your browser to see all selected images with scores and attributions.

---

## 📖 Usage

### 1. Process All Pages (Full Site)

```bash
npm run intelligent:batch
```

Processes all defined pages across all categories:
- 5 hero images (homepage, services, calculator, etc.)
- 40+ neighborhood images (8 neighborhoods × 5 images each)
- 12 blog topic images (4 topics × 3 images each)
- 6 trust/social proof images
- 5 icon images

**Total: ~70 images**

### 2. View Statistics

```bash
npm run intelligent:stats
```

Shows:
- Total images by category and source
- Average scores
- Top-performing images
- Refresh queue status
- Recent refresh history

### 3. Refresh Images

**Process Refresh Queue (images due for update):**
```bash
npm run intelligent:refresh queue
```

**Refresh Specific Image:**
```bash
npm run intelligent:refresh image pexels-12345
```

**Refresh All Images in Category:**
```bash
npm run intelligent:refresh category hero
```

**Refresh Specific Page:**
```bash
npm run intelligent:refresh page hero homepage
```

---

## 🎯 Scoring System

Each image receives a 0-100 score based on four weighted factors:

### 1. Quality Score (35% weight)

**Criteria:**
- ✅ Resolution (1920px+ for hero images)
- ✅ Aspect ratio match (1.78:1 for hero, 1.5:1 for standard)
- ✅ Professional composition
- ✅ No watermarks/text overlays
- ✅ Source quality (Unsplash > Pexels > Pixabay)

**Scoring:**
- 40 points: Resolution
- 25 points: Aspect ratio
- 20 points: Professional composition
- 15 points: No watermarks

### 2. Relevance Score (30% weight)

**Criteria:**
- ✅ Exact keyword matches
- ✅ Partial keyword matches
- ✅ Real estate context terms
- ✅ Geographic relevance (Columbus, Ohio, Midwest)
- ✅ Professional feel

**Scoring:**
- 30 points: Exact keyword matches
- 15 points: Partial matches
- 25 points: Context relevance
- 20 points: Geographic relevance
- 10 points: Professional terminology

### 3. SEO Score (20% weight)

**Criteria:**
- ✅ Descriptive original filename
- ✅ Existing metadata quality
- ✅ Photographer portfolio quality
- ✅ Image uniqueness/freshness

**Scoring:**
- 20 points: Good filename
- 25 points: Quality metadata
- 30 points: Photographer quality
- 25 points: Uniqueness (newer = better)

### 4. Engagement Score (15% weight)

**Criteria:**
- ✅ Human faces (emotional connection)
- ✅ Warm, inviting feel
- ✅ Professional but approachable
- ✅ Action/story elements

**Scoring:**
- 30 points: Human faces
- 25 points: Warm tones
- 25 points: Professional feel
- 20 points: Action elements

### Auto-Selection

Images with **total score ≥ 85** are automatically approved.
Images with **score < 85** are flagged for manual review.

---

## 📁 Category Definitions

### Hero Images
- **Min Resolution:** 1920px
- **Aspect Ratio:** 1.78:1 (16:9)
- **Pages:**
  - Homepage
  - Services - Selling
  - Services - Buying
  - Pre-Listing Inspection
  - Calculator

### Neighborhood Pages
- **Min Resolution:** 1600px
- **Aspect Ratio:** 1.5:1
- **Locations:**
  - Dublin (5 images)
  - Worthington (5 images)
  - Bexley (5 images)
  - Upper Arlington (5 images)
  - Grandview Heights (5 images)
  - German Village (5 images)
  - New Albany (5 images)
  - Powell (5 images)

### Blog Content
- **Min Resolution:** 1200px
- **Aspect Ratio:** 1.5:1
- **Topics:**
  - Commission/Savings (3 images)
  - Market Updates (3 images)
  - Home Tips (3 images)
  - Process (3 images)

### Trust & Social Proof
- **Min Resolution:** 800px
- **Aspect Ratio:** 1.33:1
- **Types:**
  - Reviews (2 images)
  - Professional (2 images)
  - Success (2 images)

### Icons & Supplementary
- **Min Resolution:** 600px
- **Aspect Ratio:** 1:1
- **Types:**
  - Calculator, Savings, Home, Checkmark, Contact icons

---

## 💻 Commands

### Test & Development

```bash
# Test with ~20 images
npm run intelligent:test

# View detailed statistics
npm run intelligent:stats
```

### Production

```bash
# Process all pages
npm run intelligent:batch

# Refresh images due for update
npm run intelligent:refresh queue

# Refresh specific category
npm run intelligent:refresh category hero
```

### Database Queries

```bash
# SQLite CLI
sqlite3 data/intelligent-media.db

# Useful queries:
SELECT * FROM images ORDER BY score_total DESC LIMIT 10;
SELECT category, COUNT(*) FROM images GROUP BY category;
SELECT * FROM refresh_history ORDER BY refreshed_at DESC LIMIT 10;
```

---

## 📂 File Structure

```
scripts/intelligent-media/
├── index.js                 # Main orchestrator
├── api-fetcher.js          # Multi-source API fetcher
├── scoring-engine.js       # Image scoring algorithm
├── image-selector.js       # Selection logic
├── seo-optimizer.js        # SEO processing & WebP optimization
├── database.js             # SQLite database
├── sitemap-generator.js    # XML sitemap generation
├── config.json             # Configuration & weights
├── categories.json         # Category definitions
├── test.js                 # Test script (~20 images)
├── batch.js                # Full batch processing
├── stats.js                # Statistics display
├── refresh.js              # Image refresh utility
└── README.md               # This file

Generated Files:
├── assets/media/intelligent/
│   ├── original/           # Original downloaded images
│   ├── webp/               # WebP optimized images
│   ├── jpg/                # JPG fallback images
│   ├── placeholders/       # Blur-up placeholders
│   └── manifest.json       # Image manifest
├── data/
│   └── intelligent-media.db  # SQLite database
├── images-sitemap.xml      # XML sitemap for Google
└── image-gallery.html      # HTML gallery for review
```

---

## 🔒 API Rate Limits

The system automatically respects API rate limits with exponential backoff:

| Source   | Requests/Hour | Requests/Minute |
|----------|---------------|-----------------|
| Pexels   | 200           | 50              |
| Pixabay  | 5,000         | 100             |
| Unsplash | 50            | 5               |

**Retry Logic:**
- Max 4 retries with exponential backoff (2s, 4s, 8s, 16s)
- Automatic rate limit detection
- Distributed requests across sources to maximize availability

---

## 🔄 Automatic Refresh System

Images are automatically scheduled for refresh based on category:

| Category      | Refresh Interval |
|---------------|------------------|
| Hero          | 90 days          |
| Neighborhood  | 120 days         |
| Blog          | 180 days         |
| Trust         | 240 days         |

### Refresh Triggers

1. **Time-Based** - Automatic refresh when interval expires
2. **Performance-Based** - Refresh if page rankings drop or engagement declines
3. **Seasonal** - Refresh with seasonal keywords (spring, summer, fall, winter)
4. **Manual** - On-demand refresh via CLI

### Seasonal Keywords

- **Spring** (Mar-May): bright, blooming, fresh
- **Summer** (Jun-Aug): sunny, vibrant, outdoor
- **Fall** (Sep-Nov): warm tones, cozy, autumn
- **Winter** (Dec-Feb): snowy, warm interior, holidays

---

## 🔍 SEO Optimization

### File Naming

Pattern: `[primary-keyword]-[secondary-keyword]-[location]-[descriptor]-[photographer].jpg`

Example: `1-percent-commission-realtor-columbus-hero-john-smith.webp`

### Alt Text

Pattern: `"[Primary keyword] - [Description] - [Location] | TD Realty Ohio"`

Example: `"1% commission realtor Columbus - Modern luxury home with sold sign in suburban Ohio neighborhood | TD Realty Ohio"`

### Structured Data

Each image includes ImageObject schema:

```json
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "contentUrl": "https://tdrealtyohio.com/assets/media/...",
  "description": "Full alt text here",
  "author": {
    "@type": "Person",
    "name": "Photographer Name"
  }
}
```

### Image Sitemap

Automatically generates `images-sitemap.xml` with:
- All image URLs
- Captions and titles
- License information
- Auto-updates `robots.txt`

### Responsive Images

Each image generates multiple sizes:
- 1920w, 1600w, 1024w, 640w, 400w (depending on category)
- WebP format (30-50% smaller)
- JPG fallback for compatibility
- Base64 blur-up placeholder

---

## 🛠️ Troubleshooting

### "Missing API keys" Error

**Solution:** Create `.env` file with all three API keys:
```bash
PEXELS_API_KEY=your_key_here
PIXABAY_API_KEY=your_key_here
UNSPLASH_ACCESS_KEY=your_key_here
```

### "Rate limit exceeded" Error

**Solution:** The system auto-retries. If persistent:
1. Wait 1 hour for rate limit reset
2. Reduce `candidatesPerSource` in `config.json`
3. Process fewer pages at once

### "No images found" Warning

**Causes:**
- Keywords too specific
- Low-quality results filtered out
- API temporarily unavailable

**Solution:**
1. Check fallback keywords in `categories.json`
2. Broaden search terms
3. Lower scoring thresholds in `config.json`

### Database Errors

**Solution:**
```bash
# Reset database
rm data/intelligent-media.db
npm run intelligent:test
```

### Sharp Installation Issues

**Solution:**
```bash
npm rebuild sharp
```

---

## 📊 Monitoring & Analytics

### View Current Inventory

```bash
npm run intelligent:stats
```

### Check Database

```bash
sqlite3 data/intelligent-media.db

# View all images
SELECT id, category, page, score_total FROM images;

# View top performers
SELECT filename, score_total FROM images ORDER BY score_total DESC LIMIT 10;

# View refresh queue
SELECT filename, category, julianday('now') - julianday(updated_at) as days_old
FROM images
WHERE days_old > 90;
```

### HTML Gallery

Open `image-gallery.html` to see:
- All selected images
- Scores and breakdowns
- Attribution information
- Organized by category

---

## 🎯 Next Steps

### Integration with HTML Pages

1. **Review Selected Images**
   ```bash
   open image-gallery.html
   ```

2. **Update HTML Pages**

   Use generated image data from `assets/media/intelligent/manifest.json`:

   ```html
   <picture>
     <source srcset="/assets/media/intelligent/webp/image-1920w.webp 1920w,
                     /assets/media/intelligent/webp/image-1024w.webp 1024w,
                     /assets/media/intelligent/webp/image-640w.webp 640w"
             type="image/webp"
             sizes="100vw">
     <img src="/assets/media/intelligent/jpg/image-1920w.jpg"
          alt="Generated alt text from manifest"
          title="Generated title from manifest"
          loading="lazy"
          width="1920"
          height="1080">
   </picture>
   ```

3. **Add Structured Data**

   Include ImageObject schema in page `<head>`:

   ```html
   <script type="application/ld+json">
   {
     "@context": "https://schema.org",
     "@type": "ImageObject",
     "contentUrl": "...",
     "description": "...",
     "author": {...}
   }
   </script>
   ```

4. **Submit Sitemap**

   Submit `images-sitemap.xml` to Google Search Console:
   https://search.google.com/search-console

---

## 📝 License & Attribution

### Image Licenses

All images are sourced under free commercial use licenses:
- **Pexels License** - Free for commercial use
- **Pixabay License** - Free for commercial use
- **Unsplash License** - Free for commercial use

### Attribution

Photographer attribution is automatically generated and stored in:
- Database (`attribution_html` field)
- Manifest JSON (`attribution` object)
- Structured data (`author` field)

Example attribution HTML:
```html
Photo by <a href="photographer-url">Photographer Name</a>
from <a href="source-url">Pexels</a>
```

---

## 🤝 Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/ctdebnam-png/tdrealtyohio.com/issues
- Email: [your-email]

---

## 🎉 Conclusion

You now have a fully automated, intelligent media management system that:

✅ Fetches from 3 sources simultaneously
✅ Scores 45-60 candidates per query
✅ Auto-selects top images based on quality, relevance, SEO, and engagement
✅ Optimizes with WebP, responsive sizes, and blur-up placeholders
✅ Generates SEO-friendly filenames, alt text, and structured data
✅ Tracks performance metrics in SQLite
✅ Auto-refreshes images on schedule
✅ Creates image sitemaps for Google Images SEO
✅ Maintains full attribution compliance

**Set it up once, let it run automatically, and outrank competitors in image search!**

---

**Version:** 1.0.0
**Last Updated:** 2026-01-15
**Author:** TD Realty Ohio Team
