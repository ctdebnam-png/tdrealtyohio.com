# Pexels Media Pipeline

This repository includes an automated media pipeline that fetches licensed photos from Pexels and maintains a gallery on the website.

## Overview

The media pipeline:
- Fetches high-quality, licensed photos from [Pexels](https://www.pexels.com) using their official API
- Runs daily via GitHub Actions at 3 AM UTC
- Automatically generates thumbnails and updates the photo gallery
- Maintains proper attribution for all photographers
- Supports manual triggering for immediate updates

## Setup Instructions

### 1. Get a Pexels API Key

1. Visit [Pexels API](https://www.pexels.com/api/)
2. Create a free account or log in
3. Generate an API key from your dashboard
4. The free tier allows 200 requests per hour and 20,000 per month (more than sufficient for this use case)

### 2. Configure GitHub Repository Secret

1. Go to your GitHub repository settings
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Name: `PEXELS_API_KEY`
5. Value: Paste your Pexels API key
6. Click **Add secret**

### 3. Customize Search Queries (Optional)

Edit `pexels-config.json` to customize what types of photos to fetch:

```json
{
  "queries": [
    "Columbus Ohio skyline",
    "Ohio suburb homes",
    "real estate agent meeting",
    "home exterior",
    "modern kitchen",
    "sold sign"
  ],
  "imagesPerQuery": 3,
  "orientation": "landscape"
}
```

### 4. Enable GitHub Actions

The workflow is located at `.github/workflows/media-refresh.yml` and will:
- Run automatically daily at 3 AM UTC
- Can be manually triggered from the Actions tab

## Manual Usage

To run the media pipeline locally:

```bash
# Install dependencies
npm install

# Set your Pexels API key
export PEXELS_API_KEY="your-api-key-here"

# Run the media refresh script
npm run refresh-media
```

## How It Works

### Directory Structure

```
assets/stock/
├── photos/          # Full-size photos downloaded from Pexels
├── thumbs/          # Generated thumbnails (400x300)
└── manifest.json    # Metadata for all photos including attribution
```

### Manifest Format

The `manifest.json` file contains metadata for all photos:

```json
{
  "generated": "2026-01-14T17:00:00.000Z",
  "photos": [
    {
      "id": 123456,
      "type": "photo",
      "src": "assets/stock/photos/pexels-123456-photographer.jpg",
      "thumb": "assets/stock/thumbs/pexels-123456-photographer.jpg",
      "photographer": "Photographer Name",
      "photographer_url": "https://www.pexels.com/@photographer",
      "source": "pexels",
      "source_url": "https://www.pexels.com/photo/123456/",
      "width": 4000,
      "height": 3000,
      "alt": "Description of photo",
      "avg_color": "#A5B2C1"
    }
  ],
  "videos": []
}
```

### Gallery Page

The gallery is available at `/gallery.html` and features:
- Responsive grid layout
- Lazy-loaded thumbnails for performance
- Lightbox for full-size viewing
- Proper attribution with links to photographers
- Mobile-friendly design

## GitHub Actions Workflow

The automated workflow (`.github/workflows/media-refresh.yml`):

1. **Triggers**:
   - Scheduled: Daily at 3 AM UTC
   - Manual: Via workflow_dispatch

2. **Process**:
   - Checks out the repository
   - Installs Node.js dependencies
   - Runs the media refresh script
   - Commits and pushes new photos (if any)

3. **Skip Conditions**:
   - Photos already in the library are skipped
   - If no new photos are found, no commit is made
   - Commit messages include `[skip ci]` to prevent workflow loops

## Attribution & Licensing

All photos are sourced from [Pexels](https://www.pexels.com), which provides:
- Free high-quality stock photos
- Photos licensed under the Pexels License
- No attribution required (but we include it anyway)
- Commercial use permitted

The gallery page and manifest.json include:
- Photographer name and profile link
- Link to original photo on Pexels
- Proper credit displayed with each image

## Configuration Options

### Adjust Number of Photos

Edit `pexels-config.json`:
```json
{
  "imagesPerQuery": 5  // Change from 3 to 5 photos per query
}
```

### Change Photo Orientation

Options: `"landscape"`, `"portrait"`, `"square"`
```json
{
  "orientation": "portrait"
}
```

### Modify Thumbnail Size

Edit `scripts/refresh-media.js`:
```javascript
const THUMB_WIDTH = 400;   // Default: 400px
const THUMB_HEIGHT = 300;  // Default: 300px
```

### Change Schedule

Edit `.github/workflows/media-refresh.yml`:
```yaml
schedule:
  - cron: '0 3 * * *'  # Daily at 3 AM UTC
  # - cron: '0 */6 * * *'  # Every 6 hours
  # - cron: '0 0 * * 0'    # Weekly on Sunday
```

## Troubleshooting

### Workflow Not Running

1. Check that `PEXELS_API_KEY` secret is set correctly
2. Verify GitHub Actions are enabled for the repository
3. Check the Actions tab for error messages

### No New Photos Added

This is normal if:
- All configured photos have already been downloaded
- The library has reached the configured limit per query

To force refresh:
1. Delete photos from `assets/stock/photos/` and `assets/stock/thumbs/`
2. Remove corresponding entries from `manifest.json`
3. Manually trigger the workflow

### API Rate Limits

The free Pexels API tier allows:
- 200 requests per hour
- 20,000 requests per month

With default settings (6 queries × 3 photos = 18 photos daily), you'll use approximately 540 requests per month, well within limits.

## Maintenance

### Adding New Search Queries

1. Edit `pexels-config.json`
2. Add new queries to the array
3. Commit and push changes
4. Workflow will automatically fetch photos for new queries

### Removing Photos

1. Delete the photo files from `assets/stock/photos/` and `assets/stock/thumbs/`
2. Remove the entry from `manifest.json`
3. Commit changes

### Updating Dependencies

```bash
npm update
npm audit fix
```

## Future Enhancements

Potential improvements:
- [ ] Video support (storing links, not files)
- [ ] WebP format for smaller file sizes
- [ ] Category/tag filtering in gallery
- [ ] Search functionality
- [ ] Pagination for large galleries
- [ ] Admin panel for managing photos

## Support

For issues or questions:
- Check Pexels API documentation: https://www.pexels.com/api/documentation/
- Review GitHub Actions logs in the Actions tab
- Verify API key is valid and has sufficient quota

## License

The media pipeline code is part of the TD Realty Ohio website. All photos are licensed through Pexels under the Pexels License.
