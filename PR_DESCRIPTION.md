# Add Automated Pexels Media Pipeline with Photo Gallery

## Summary

This PR implements a complete automated media pipeline that fetches licensed photos from the Pexels API and maintains a beautiful photo gallery on the TD Realty Ohio website.

## What's New

### 🖼️ Photo Gallery
- New `/gallery.html` page showcasing Columbus Ohio real estate photos
- Responsive grid layout with lightbox viewer
- Proper photographer attribution with links to Pexels
- Lazy-loaded images for optimal performance
- Mobile-friendly design matching existing site aesthetic

### 🤖 Automated Pipeline
- Daily automated photo refresh via GitHub Actions
- Runs at 3 AM UTC (10 PM EST / 11 PM EDT)
- Can be manually triggered from the Actions tab
- Intelligent duplicate detection (skips already downloaded photos)
- Automatic thumbnail generation (400×300px)

### 📝 Configuration
- `pexels-config.json` - Customize search queries and limits
- Currently configured with 6 real estate-related queries
- 3 photos per query (18 total photos to start)
- Landscape orientation optimized for real estate

### 📦 Components Added
```
.github/workflows/media-refresh.yml  # GitHub Actions workflow
scripts/refresh-media.js             # Main pipeline script
gallery.html                         # Photo gallery page
pexels-config.json                   # Search configuration
assets/stock/                        # Photos, thumbnails, manifest
  ├── photos/                        # Full-size images
  ├── thumbs/                        # Generated thumbnails
  └── manifest.json                  # Photo metadata & attribution
MEDIA_PIPELINE.md                    # Complete documentation
package.json                         # Node.js dependencies
.gitignore                           # Exclude node_modules
```

### 🔗 Navigation Updates
- Added "Gallery" link to main navigation menu
- Added "Photo Gallery" link to footer Resources section

## 🚀 Setup Instructions

### Step 1: Get Pexels API Key (Free)

1. Visit https://www.pexels.com/api/
2. Create a free account or log in
3. Generate an API key from your dashboard
4. Free tier includes: 200 requests/hour, 20,000/month (more than enough)

### Step 2: Add GitHub Secret

1. Go to **Settings > Secrets and variables > Actions**
2. Click **New repository secret**
3. Name: `PEXELS_API_KEY`
4. Value: Paste your API key
5. Click **Add secret**

### Step 3: Enable and Test

Once the secret is added:
1. The workflow will run automatically daily at 3 AM UTC
2. Or manually trigger it: **Actions tab > Refresh Media from Pexels > Run workflow**
3. First run will download ~18 photos based on configured queries
4. Subsequent runs will only add new photos (no duplicates)

## 📊 How It Works

1. **GitHub Actions triggers** the workflow (scheduled or manual)
2. **Script searches Pexels** using configured queries
3. **Downloads high-quality photos** (large2x resolution)
4. **Generates thumbnails** using Sharp image processing
5. **Updates manifest.json** with photo metadata and attribution
6. **Commits changes** automatically (if new photos found)
7. **Gallery page** reads manifest.json and displays photos

## 🎨 Features

### Photo Gallery
- ✅ Responsive masonry-style grid layout
- ✅ Click to view full-size in lightbox
- ✅ Photographer attribution with profile links
- ✅ Link to original photo on Pexels
- ✅ Mobile-optimized touch interactions
- ✅ Keyboard navigation (ESC to close lightbox)

### Media Pipeline
- ✅ Official Pexels API (no web scraping)
- ✅ Proper licensing and attribution
- ✅ Automatic duplicate detection
- ✅ Configurable search queries
- ✅ Thumbnail generation for performance
- ✅ Comprehensive error handling
- ✅ Daily automated updates

## 📖 Documentation

Complete setup and usage documentation is available in `MEDIA_PIPELINE.md`, including:
- Detailed setup instructions
- Configuration options
- Customization guide
- Troubleshooting tips
- API rate limit information
- Future enhancement ideas

## 🔒 Security & Licensing

- ✅ Uses official Pexels API with authentication
- ✅ No web scraping or terms violations
- ✅ All photos licensed under Pexels License
- ✅ Commercial use permitted
- ✅ Proper attribution included (though not required by Pexels)
- ✅ API key stored securely as GitHub Secret

## 🧪 Testing

After merging:
1. Visit `/gallery.html` to see the gallery page
2. Initially shows "No photos available yet" message
3. After workflow runs, photos will appear automatically
4. Test lightbox by clicking any photo
5. Verify attribution links work correctly

## 🎯 Queries Configured

Current search queries (customizable in `pexels-config.json`):
- Columbus Ohio skyline
- Ohio suburb homes
- real estate agent meeting
- home exterior
- modern kitchen
- sold sign

## 📈 Next Steps

After merging:
1. Add `PEXELS_API_KEY` secret to repository
2. Manually trigger workflow to populate initial photos
3. Visit gallery page to verify everything works
4. (Optional) Customize queries in `pexels-config.json`
5. (Optional) Adjust schedule in workflow file

## 💡 Future Enhancements

Potential improvements for later:
- Video support (embed Pexels videos)
- WebP format for smaller file sizes
- Category/tag filtering
- Search functionality within gallery
- Pagination for large galleries

---

**Ready to merge once `PEXELS_API_KEY` secret is configured!** 🎉

See `MEDIA_PIPELINE.md` for complete documentation.
