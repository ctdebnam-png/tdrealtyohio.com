# TD Realty Ohio

**1% Commission Real Estate | Columbus, Ohio**

Website: [tdrealtyohio.com](https://tdrealtyohio.com)

---

## Automated Legal Media Pipeline

This repository includes a fully automated **multi-source legal media pipeline** that continuously improves the site by sourcing photos and videos from multiple legally reusable sources, verifying licenses, and updating the site in a safe, repeatable way.

### Media Sources

All media is sourced from **official APIs** with proper license verification:

1. **Pexels** - Photos + Videos ([Pexels License](https://www.pexels.com/license/))
2. **Pixabay** - Photos + Videos ([Pixabay License](https://pixabay.com/service/license/))
3. **Unsplash** - Photos ([Unsplash License](https://unsplash.com/license))
4. **Wikimedia Commons** - Photos with reuse-friendly licenses (CC0, CC-BY, CC-BY-SA, PD)

**All media usage is license-compliant and properly attributed.**

---

## Quick Start

### 1. Set Up GitHub Secrets

The pipeline requires API keys stored as GitHub repository secrets:

1. Go to **Settings → Secrets and variables → Actions**
2. Add the following secrets:

| Secret Name | Required | Get API Key From |
|------------|----------|------------------|
| `PEXELS_API_KEY` | Yes | [pexels.com/api](https://www.pexels.com/api/) |
| `PIXABAY_API_KEY` | Yes | [pixabay.com/api](https://pixabay.com/api/docs/) |
| `UNSPLASH_ACCESS_KEY` | Yes | [unsplash.com/developers](https://unsplash.com/developers) |

**Note:** Wikimedia Commons requires no API key (public API).

### 2. How the Pipeline Works

The pipeline runs automatically **every Sunday at 3 AM UTC** via GitHub Actions and can be manually triggered anytime.

**Workflow:**
```
Fetch → Verify → Build → Integrate → Validate → Create PR
```

**Stages:**

1. **Fetch** - Downloads media from 4 API sources based on per-page keywords
2. **Verify** - Runs 6 verification gates (license, safety, quality, dedupe, performance, build)
3. **Build** - Creates manifest.json with per-page hero media assignments
4. **Integrate** - Updates HTML pages with hero images/videos
5. **Validate** - Checks manifest schema and verifies all links/files exist
6. **PR** - Opens a pull request with changes (does not auto-merge)

---

## Verification Gates

Every fetched asset passes through **6 automated verification gates**:

### Gate 1: License Verification ✅
- Ensures all assets have valid license information
- Verifies license is from a known, trusted source
- Stores complete attribution data (author, license name, license URL)

### Gate 2: Content Safety 🛡️
- Rejects assets with watermarks or obvious logos
- Heuristic-based detection (filename, metadata analysis)
- Best-effort protection against unlicensed content

### Gate 3: Quality Check 📏
- **Images:** Minimum 1600×900px, prefer landscape orientation
- **Videos:** Minimum 720p resolution, maximum 15 seconds duration
- Rejects low-resolution or oversized assets

### Gate 4: Deduplication 🔍
- **Images:** Perceptual hash comparison (detects near-duplicates)
- **Videos:** SHA-256 checksum comparison
- Prevents duplicate hero media across sources

### Gate 5: Performance Optimization ⚡
- Generates WebP versions of images (85% quality)
- Creates responsive sizes: 640px, 1024px, 1600px widths
- Targets ≤250KB for optimized hero images
- Adds lazy loading and srcset for responsive delivery

### Gate 6: Build Validation 🔧
- Validates manifest.json against JSON schema
- Checks that all HTML files exist
- Verifies internal links resolve
- Ensures media files referenced in manifest exist

---

## R2 Media Ingestion Pipeline

In addition to the existing media pipeline, this repository includes a **new R2-based media ingestion system** that downloads legally-reusable images from Openverse and Wikimedia Commons, converts them to WebP, and uploads them to Cloudflare R2 for CDN delivery.

### Features

- ✅ **Legal compliance:** Only CC0, PDM, CC-BY, CC-BY-SA licenses
- ✅ **No hotlinking:** All images served from your domain via R2
- ✅ **Quality standards:** Minimum 1600px width
- ✅ **Modern formats:** WebP required
- ✅ **Full attribution:** Metadata stored for every image
- ✅ **Local dev fallback:** Works without R2 configuration

### Environment Variables

Configure these in your Cloudflare Pages settings or `.env` file:

| Variable | Required | Description |
|----------|----------|-------------|
| `R2_ACCOUNT_ID` | Yes | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 API access key ID |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 API secret access key |
| `R2_BUCKET` | Yes | R2 bucket name (e.g., `tdrealtyohio-media`) |
| `R2_PUBLIC_BASE_URL` | Yes | Public CDN URL (e.g., `https://media.tdrealtyohio.com`) |
| `OPENVERSE_USER_AGENT` | Optional | User agent for Openverse API (default: `TDRealtyOhio/2.0`) |

### Getting R2 Credentials

1. Go to **Cloudflare Dashboard → R2**
2. Create a new bucket (e.g., `tdrealtyohio-media`)
3. Go to **R2 → Settings → Manage R2 API Tokens**
4. Create a new API token with **Object Read & Write** permissions
5. Copy the credentials to your environment variables

### Setting Up Public Domain for R2

To serve images from your own domain (e.g., `media.tdrealtyohio.com`):

1. In Cloudflare R2, go to your bucket → **Settings**
2. Under **Public Access**, click **Connect Domain**
3. Add your custom domain (e.g., `media.tdrealtyohio.com`)
4. Update `R2_PUBLIC_BASE_URL` environment variable to match

### Usage

#### Run Media Sync

```bash
# Sync media (download, convert, upload to R2)
npm run media:sync
```

This will:
1. Read topics from `media/topics.json`
2. Search Openverse API for each query
3. Fallback to Wikimedia Commons if needed
4. Download images and convert to WebP
5. Upload to R2 (or use source URLs if R2 not configured)
6. Generate `public/media/manifest.json` with attribution
7. Generate `public/media/health.json` with statistics

#### Verify Media

```bash
# Verify manifest has ≥12 images with all required fields
npm run media:verify
```

#### Integrated Build

The pipeline is integrated into the build process:

```bash
npm run build
```

This runs:
1. **prebuild:** `npm run media:sync || true` (continues even if sync fails)
2. **postbuild:** `npm run media:verify` (exits with error if validation fails)

### Customizing Topics

Edit `media/topics.json` to customize search queries:

```json
{
  "hero": [
    "columbus ohio skyline",
    "ohio real estate"
  ],
  "sellers": [
    "home for sale sign",
    "house exterior"
  ]
}
```

Each topic should have 2+ queries to ensure sufficient image diversity.

### Local Development

If R2 environment variables are not set, the pipeline will:
- ✅ Still download and convert images
- ✅ Generate manifest with source URLs instead of CDN URLs
- ⚠️ Log warning: "R2 not configured — using source URLs directly"
- ✅ Allow development without R2 setup

### Manifest Schema

`public/media/manifest.json` contains an array of image metadata:

```json
[
  {
    "id": "openverse_12345",
    "topic": "hero",
    "cdnUrl": "https://media.tdrealtyohio.com/columbus-ohio-skyline-a1b2c3d4.webp",
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

### Health Report

`public/media/health.json` provides pipeline statistics:

```json
{
  "timestamp": "2026-01-14T12:00:00.000Z",
  "totalImages": 15,
  "byTopic": {
    "hero": 6,
    "sellers": 4,
    "buyers": 5
  },
  "r2Configured": true
}
```

---

## Directory Structure

```
tdrealtyohio.com/
├── assets/
│   └── media/
│       ├── images/              # Raw downloaded images
│       ├── videos/              # Raw downloaded videos
│       ├── optimized/           # WebP + responsive sizes
│       ├── attribution/         # Attribution files (JSON + TXT)
│       ├── manifest.json        # Per-page hero media assignments
│       ├── manifest-schema.json # JSON schema for validation
│       ├── fetched_data.json    # Tracking of fetched assets
│       └── verified_data.json   # Verification results + stats
├── public/
│   └── media/
│       ├── manifest.json        # R2 media manifest
│       └── health.json          # R2 pipeline health report
├── media/
│   └── topics.json              # R2 search topics configuration
├── scripts/
│   ├── media_pipeline/
│   │   ├── fetch_media.js       # Fetches from 4 API sources
│   │   ├── verify_media.js      # Runs 6 verification gates
│   │   ├── build_manifest.js    # Builds per-page manifest
│   │   ├── integrate_hero_media.js  # Updates HTML pages
│   │   ├── validate_manifest.js     # Schema validation
│   │   └── validate_links.js        # Build validation
│   ├── media-sync.ts            # R2 media ingestion pipeline
│   └── media-verify.ts          # R2 manifest verification
├── media-sources.json           # Config: keywords per page
├── .github/
│   └── workflows/
│       └── media-pipeline.yml   # GitHub Actions workflow
└── package.json
```

---

## Configuration

### Customize Keywords Per Page

Edit `media-sources.json` to change search keywords for each page:

```json
{
  "pages": {
    "home": {
      "page_file": "index.html",
      "keywords": ["Columbus Ohio skyline", "Columbus downtown"],
      "prefer_video": true,
      "media_count": {
        "images": 2,
        "videos": 1
      }
    },
    "areas/dublin": {
      "page_file": "areas/dublin.html",
      "keywords": ["Dublin Ohio", "upscale neighborhood"],
      "prefer_video": false,
      "media_count": {
        "images": 1,
        "videos": 0
      }
    }
  }
}
```

**Adding a new page:**
1. Add entry to `media-sources.json` under `pages`
2. Specify `page_file`, `keywords`, and `media_count`
3. Run the pipeline (manually or wait for scheduled run)

### Global Settings

Adjust quality/performance settings in `media-sources.json`:

```json
{
  "global_settings": {
    "image_quality": {
      "min_width": 1600,
      "min_height": 900,
      "webp_quality": 85,
      "max_hero_size_kb": 250
    },
    "video_quality": {
      "min_resolution": "720p",
      "max_duration_seconds": 15
    },
    "performance": {
      "generate_responsive_sizes": [640, 1024, 1600],
      "generate_webp": true
    }
  }
}
```

---

## Running Locally

### Prerequisites
- Node.js 18+
- npm

### Install Dependencies
```bash
npm install
```

### Set API Keys
```bash
export PEXELS_API_KEY="your-key-here"
export PIXABAY_API_KEY="your-key-here"
export UNSPLASH_ACCESS_KEY="your-key-here"
```

### Run Full Pipeline
```bash
npm run pipeline:full
```

**Or run stages individually:**
```bash
npm run pipeline:fetch     # Stage 1: Fetch media
npm run pipeline:verify    # Stage 2: Verify media
npm run pipeline:build     # Stage 3: Build manifest
npm run pipeline:integrate # Stage 4: Update HTML pages
```

### Validation
```bash
npm run validate:manifest  # Validate manifest.json against schema
npm run validate:links     # Check build output and links
```

---

## Attribution

All media is properly attributed according to each source's requirements:

- **Pexels & Pixabay:** Attribution not required but included for transparency
- **Unsplash:** Attribution required (always displayed)
- **Wikimedia Commons:** Attribution based on license (CC-BY, CC-BY-SA require it; CC0/PD do not)

### Viewing Attributions

Attribution data is available in multiple formats:

1. **JSON:** `assets/media/attribution/attributions.json`
2. **Text:** `assets/media/attribution/attributions.txt`
3. **Manifest:** `assets/media/manifest.json` (includes attribution for each asset)
4. **Public Page:** See `ATTRIBUTION.md` for a public-facing attribution page

To generate a public attribution page, see the template in `ATTRIBUTION.md`.

---

## Manifest Structure

The `assets/media/manifest.json` file contains per-page hero media assignments:

```json
{
  "version": "1.0.0",
  "generated": "2026-01-14T12:00:00.000Z",
  "pages": {
    "home": {
      "hero_image": {
        "local_path": "assets/media/images/pexels-photo-123456.jpg",
        "optimized_paths": {
          "webp": "assets/media/optimized/pexels-photo-123456.webp",
          "sizes": {
            "640": "assets/media/optimized/pexels-photo-123456-640w.webp",
            "1024": "assets/media/optimized/pexels-photo-123456-1024w.webp",
            "1600": "assets/media/optimized/pexels-photo-123456-1600w.webp"
          }
        },
        "source": "pexels",
        "source_url": "https://www.pexels.com/photo/123456/",
        "author": "John Doe",
        "author_url": "https://www.pexels.com/@john-doe",
        "license_name": "Pexels License",
        "license_url": "https://www.pexels.com/license/",
        "attribution_text": "Photo by John Doe on Pexels",
        "attribution_required": false,
        "fetched_at": "2026-01-14T12:00:00.000Z",
        "checksum": "abc123...",
        "width": 4000,
        "height": 3000
      },
      "hero_video": {
        "local_path": "assets/media/videos/pexels-video-789012.mp4",
        "source": "pexels",
        "duration": 10,
        ...
      }
    }
  }
}
```

---

## Cloudflare Pages Deployment

This site deploys as **static HTML** with no build step required.

**Cloudflare Pages Settings:**
- **Build command:** `exit 0` (or leave blank)
- **Output directory:** `.` (root)

The pipeline runs in GitHub Actions and commits the updated HTML files directly. Cloudflare Pages simply serves the static files.

---

## Troubleshooting

### Pipeline Fails at Fetch Stage

**Cause:** Missing or invalid API keys

**Solution:**
1. Verify all required secrets are set in GitHub: `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `UNSPLASH_ACCESS_KEY`
2. Check that API keys are valid (test them locally first)
3. Ensure you haven't exceeded rate limits (free tiers are generous)

### No New Media Added

**Cause:** All configured media already exists in the library

**Solution:** This is normal behavior (idempotent design). To force refresh:
1. Delete files from `assets/media/images/` and `assets/media/videos/`
2. Delete `assets/media/fetched_data.json`
3. Manually trigger the workflow

### Verification Gate Failures

**Cause:** Fetched media doesn't meet quality/safety standards

**Solution:**
- Check `assets/media/verified_data.json` for rejection reasons
- Adjust quality settings in `media-sources.json` if too strict
- Try different keywords if consistently rejected

### Manifest Validation Fails

**Cause:** Generated manifest doesn't match schema

**Solution:**
1. Check workflow logs for specific validation errors
2. Verify `assets/media/manifest-schema.json` is present
3. Run `npm run validate:manifest` locally to debug

### HTML Integration Issues

**Cause:** HTML pages don't have `.page-hero` section or structure changed

**Solution:**
- Ensure all pages have a `<section class="page-hero">` element
- Check that CSS supports `position: relative` on hero sections
- Review integration script: `scripts/media_pipeline/integrate_hero_media.js`

---

## API Rate Limits

All sources have generous free tiers:

| Source | Requests/Hour | Requests/Month | Notes |
|--------|--------------|----------------|-------|
| **Pexels** | 200 | 20,000 | More than sufficient |
| **Pixabay** | Unlimited | Unlimited | Rate-limited to ~100/min |
| **Unsplash** | 50 | 5,000 | Trigger download endpoint required |
| **Wikimedia** | Unlimited | Unlimited | Public API, no auth |

With default settings (weekly runs, ~25 pages), the pipeline uses approximately:
- **Pexels:** ~50 requests/week = ~200/month
- **Pixabay:** ~50 requests/week = ~200/month
- **Unsplash:** ~25 requests/week = ~100/month
- **Wikimedia:** ~25 requests/week = ~100/month

**All well within free tier limits.**

---

## Maintenance

### Updating Dependencies
```bash
npm update
npm audit fix
```

### Adding New API Sources

To add a new source (e.g., Freepik, Stocksnap):

1. Add source config to `media-sources.json`
2. Implement fetcher in `scripts/media_pipeline/fetch_media.js`
3. Ensure license verification in `scripts/media_pipeline/verify_media.js`
4. Update documentation

### Removing Media

To remove specific media:
1. Delete files from `assets/media/images/` or `assets/media/videos/`
2. Remove optimized versions from `assets/media/optimized/`
3. Update `assets/media/manifest.json` (or re-run build)
4. Commit changes

---

## Security & Privacy

- **No arbitrary web scraping** - Only official APIs
- **License verification enforced** - Every asset validated
- **No personal data collected** - Media is purely decorative
- **API keys secured** - Stored as GitHub secrets, never committed
- **Idempotent operations** - Safe to run multiple times

---

## Support & Issues

For issues or questions:
- Check [GitHub Actions logs](../../actions) for pipeline errors
- Review `assets/media/verified_data.json` for rejection details
- Verify API keys are valid and have sufficient quota
- Consult API documentation:
  - [Pexels API Docs](https://www.pexels.com/api/documentation/)
  - [Pixabay API Docs](https://pixabay.com/api/docs/)
  - [Unsplash API Docs](https://unsplash.com/documentation)
  - [Wikimedia API Docs](https://www.mediawiki.org/wiki/API:Main_page)

---

## License

The media pipeline code is part of the TD Realty Ohio website. All media is licensed through their respective sources (see attribution files).

**Pipeline Code:** MIT License
**Website Content:** © TD Realty Ohio, LLC

---

## Changelog

### Version 2.0.0 (2026-01-14)
- 🎉 Multi-source legal media pipeline
- ✅ 6 automated verification gates
- 🖼️ Hero images + videos for all pages
- ⚡ WebP optimization + responsive sizes
- 📋 JSON schema validation
- 🤖 Full GitHub Actions automation

### Version 1.0.0 (2024)
- Initial Pexels-only pipeline
- Gallery page implementation
