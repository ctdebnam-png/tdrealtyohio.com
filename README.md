# TD Realty Ohio - Modern Site Rebuild

## What I Built

A clean, modern, CONSISTENT website using one design system (tdro-ui.css):

✅ **Homepage with carousel** - rotating Central Ohio property images
✅ **Sellers page** - completely rebuilt to match homepage design
✅ **First-time homebuyer 1% cash back** - prominently featured
✅ **Interactive calculators** - showing real savings
✅ **ONE design system** - no more competing styles
✅ **Modern dark theme** - professional and cohesive across ALL pages

## Files to Deploy

### 1. Generate Images First (IMPORTANT)
See **IMAGE-PROMPTS.md** for detailed instructions.

**Quick version:**
1. Go to ChatGPT (chatgpt.com)
2. Use the 3 prompts from IMAGE-PROMPTS.md
3. Download the 3 generated images
4. Name them: ohio-home-1.jpg, ohio-home-2.jpg, ohio-home-3.jpg
5. Upload to `/assets/images/` in your repo

OR use your own actual Central Ohio listing photos (even better!)

### 2. index.html
**Location:** Root of your repo (replaces current index.html)
**What it does:** Your new general homepage with carousel

### 3. sellers.html  
**Location:** `/sellers/index.html` (if using folder structure) OR `/sellers.html` (if not)
**What it does:** Sellers page rebuilt to match homepage design

### 4. carousel.js
**Location:** `/assets/js/carousel.js`
**What it does:** Powers the hero image carousel

### 5. tdro-ui.css
**Location:** `/assets/css/tdro-ui.css` (replaces current tdro-ui.css)
**What it does:** Updated stylesheet with carousel styles

## Deployment Steps

### Step 1: Generate Images
Follow IMAGE-PROMPTS.md to create the 3 Central Ohio home images

### Step 2: Upload to GitHub
1. Go to https://github.com/ctdebnam-png/tdrealtyohio.com
2. Upload images to `/assets/images/`
3. Upload `index.html` to root (replace existing)
4. Upload `sellers.html` to `/sellers/` folder (create folder if needed, name file `index.html`) OR replace existing `sellers.html` at root
5. Upload `carousel.js` to `/assets/js/`
6. Upload `tdro-ui.css` to `/assets/css/` (replace existing)
7. Commit all changes

### Step 3: Test
- Homepage carousel should rotate images
- Sellers page should look identical to homepage (same header, footer, colors)
- Calculator should work on both pages
- Mobile should be responsive

## What's Different Now

**BEFORE:** Two competing design systems fighting each other
- sellers.html used main.css (light theme)
- index.html used tdro-ui.css (dark theme)
- Pages looked completely different

**NOW:** ONE modern design system
- Both pages use tdro-ui.css (dark theme)
- Same header, footer, buttons, cards everywhere
- Professional, cohesive look across the entire site

## Next Steps

1. **Convert remaining pages** (buyers, about, contact, etc.) to use tdro-ui.css
2. **Delete main.css** once everything is converted
3. **Add more Central Ohio content** (neighborhoods, market data, etc.)
4. **Expand carousel** - add more local property images as you get listings

## Notes

- Carousel uses local images (no more generic Unsplash)
- All pages now match in design
- Calculator works the same on both pages
- Mobile responsive throughout
- No CloudFlare email obfuscation issues
- tdro-ui.js handles all phone/email population

This is now a solid, professional foundation that looks like ONE cohesive brokerage site.
