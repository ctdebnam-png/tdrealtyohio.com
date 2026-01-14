# Images Needed for TD Realty Ohio Website

## REQUIRED

### 1. Your Headshot
Location: `/assets/images/`
File: `travis-headshot.jpg`
Size: 400x500px minimum (3:4 ratio)
Used on: About page

### 2. Open Graph Image (for social media sharing)
Location: `/assets/images/`
File: `og-image.jpg`
Size: 1200x630px (required for proper display)
Content: Your logo + "TD Realty Ohio" + tagline
Used when: Anyone shares your site on Facebook, LinkedIn, Twitter, etc.

This is referenced on every page. Without it, social shares will show a generic preview.

---

## OPTIONAL (but recommended)

### 3. Enhanced Favicon (browser tab icon)
An SVG favicon has been added at `/assets/images/favicon.svg`. For broader browser support, you can also add:
Location: `/assets/images/logos/`
Files needed:
- `favicon.ico` (16x16 and 32x32 combined)
- `apple-touch-icon.png` (180x180 for iOS)

### 3. Logo Image (if you want an image instead of styled text)
Location: `/assets/images/logos/`
Files:
- `td-realty-logo.svg` (preferred) or `td-realty-logo.png`
- `td-realty-logo-white.svg` (for dark backgrounds/footer)

### 4. Hero Background (homepage)
Location: `/assets/images/`
File: `hero-bg.jpg`
Size: 1920x800px minimum
Content: Columbus skyline, nice home exterior, or abstract

### 5. Open Graph Image (for social media sharing)
Location: `/assets/images/`
File: `og-image.jpg`
Size: 1200x630px
Content: Your logo + "TD Realty Ohio" text

---

## FILE NAMING CONVENTION
- All lowercase
- Hyphens instead of spaces
- Descriptive names

## AFTER ADDING IMAGES

You'll need to add these lines to your HTML <head> sections:

```html
<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="assets/images/logos/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="assets/images/logos/favicon-32x32.png">
<link rel="apple-touch-icon" href="assets/images/logos/apple-touch-icon.png">

<!-- Open Graph (social sharing) -->
<meta property="og:image" content="https://tdrealtyohio.com/assets/images/og-image.jpg">
```

For the About page headshot, replace the placeholder div with:
```html
<img src="assets/images/travis-headshot.jpg" alt="Travis Debnam, Broker" class="about-image">
```
