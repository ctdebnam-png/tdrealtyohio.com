# TD Realty Ohio - Modern Homepage Build

## What I Built

A clean, modern homepage using your tdro-ui.css design system with:

✅ **Hero carousel** - rotating property images with dots/arrows
✅ **First-time homebuyer 1% cash back** - prominently featured with gold highlight
✅ **Commission calculator** - interactive tool showing savings
✅ **Clean value propositions** - no bullshit, just clear benefits
✅ **Central Ohio coverage** - general, not city-specific
✅ **Modern dark theme** - professional and cohesive

## Files to Upload

### 1. index.html
**Location:** Root of your repo (replaces current index.html)
**What it does:** Your new general homepage

### 2. carousel.js
**Location:** `/assets/js/carousel.js`
**What it does:** Powers the hero image carousel

### 3. tdro-ui.css
**Location:** `/assets/css/tdro-ui.css` (replaces current tdro-ui.css)
**What it does:** Updated stylesheet with carousel styles added

## How to Deploy

### Option 1: GitHub Web Interface (Easiest)
1. Go to https://github.com/ctdebnam-png/tdrealtyohio.com
2. Upload `index.html` to root (replace existing)
3. Navigate to `/assets/js/` and upload `carousel.js`
4. Navigate to `/assets/css/` and upload `tdro-ui.css` (replace existing)
5. Commit changes

### Option 2: Command Line
```bash
# If you have the repo cloned locally
cp index.html /path/to/repo/
cp carousel.js /path/to/repo/assets/js/
cp tdro-ui.css /path/to/repo/assets/css/
git add .
git commit -m "Modern homepage with carousel and first-time buyer benefit"
git push origin main
```

## What's Next

After you get this deployed:

1. **Test the carousel** - make sure images rotate and controls work
2. **Test the calculator** - verify the math is correct
3. **Check mobile** - everything should be responsive
4. **Update your other pages** to use the tdro-ui.css system (sellers, buyers, etc.)
5. **Kill main.css** once everything uses tdro-ui.css

## Notes

- No more Westerville-specific content on homepage
- All email/phone populated by tdro-ui.js automatically
- CloudFlare email obfuscation is OFF (you already did this)
- Carousel pauses on hover and supports keyboard navigation
- First-time buyer benefit is highlighted in gold to stand out

This gives you a solid foundation to build from. Everything is ONE design system now.
