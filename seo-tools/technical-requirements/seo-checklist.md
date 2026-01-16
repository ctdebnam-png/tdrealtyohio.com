# Technical SEO Checklist for TD Realty Ohio

This checklist covers all technical SEO requirements for tdrealtyohio.com to rank #1.

---

## Phase 1: Critical Technical Foundation

### ✅ Meta Tags (Every Page)

**Homepage:**
```html
<title>TD Realty Ohio | 1% Listing Fee Columbus | Full-Service Real Estate</title>
<meta name="description" content="Sell your Central Ohio home for just 1% commission. Full-service real estate brokerage serving Columbus since 2017. Save thousands. Email info@tdrealtyohio.com">
<link rel="canonical" href="https://tdrealtyohio.com/">
```

**Sellers Page:**
```html
<title>Sell Your Home for 1% Commission | Columbus Ohio Realtor</title>
<meta name="description" content="List your Columbus home for 1% when you buy with us. Full MLS listing, professional photography, marketing. Licensed broker. Email info@tdrealtyohio.com">
<link rel="canonical" href="https://tdrealtyohio.com/sellers.html">
```

**Buyers Page:**
```html
<title>Columbus Home Buyers | Free Buyer Representation | TD Realty Ohio</title>
<meta name="description" content="Buy your Central Ohio home with TD Realty Ohio. Expert representation, local market knowledge. Combine with selling for 1% listing fee. Email info@tdrealtyohio.com">
<link rel="canonical" href="https://tdrealtyohio.com/buyers.html">
```

**Pre-Listing Inspection:**
```html
<title>Pre-Listing Home Inspection Columbus | TD Realty Ohio</title>
<meta name="description" content="Get a pre-listing inspection in Columbus before selling. Price accurately, avoid surprises, close faster. Part of our full-service 1% listing. Email info@tdrealtyohio.com">
<link rel="canonical" href="https://tdrealtyohio.com/pre-listing-inspection.html">
```

**About Page:**
```html
<title>About TD Realty Ohio | Licensed Columbus Broker Since 2017</title>
<meta name="description" content="Meet Travis Debnam, licensed Ohio broker #2023006467. Serving Central Ohio with 1% commission real estate since 2017. Member Columbus REALTORS®. Email info@tdrealtyohio.com">
<link rel="canonical" href="https://tdrealtyohio.com/about.html">
```

**Contact Page:**
```html
<title>Contact TD Realty Ohio | Columbus Real Estate</title>
<meta name="description" content="Schedule a free consultation with TD Realty Ohio. Serving Westerville, Columbus, and Central Ohio. Licensed broker, 1% commission. Email info@tdrealtyohio.com">
<link rel="canonical" href="https://tdrealtyohio.com/contact.html">
```

---

### ✅ Schema Markup

**LocalBusiness Schema (Add to every page in <head>):**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "name": "TD Realty Ohio, LLC",
  "image": "https://tdrealtyohio.com/images/td-realty-logo.png",
  "description": "Full-service real estate brokerage serving Central Ohio with transparent 1% listing fees",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "",
    "addressLocality": "Westerville",
    "addressRegion": "OH",
    "postalCode": "43081",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 40.1262,
    "longitude": -82.9291
  },
  "email": "info@tdrealtyohio.com",
  "url": "https://tdrealtyohio.com",
  "priceRange": "1% Commission",
  "areaServed": [
    "Columbus, OH",
    "Westerville, OH",
    "Dublin, OH",
    "Gahanna, OH",
    "New Albany, OH",
    "Powell, OH",
    "Lewis Center, OH",
    "Delaware, OH",
    "Central Ohio"
  ],
  "founder": {
    "@type": "Person",
    "name": "Travis Debnam",
    "jobTitle": "Broker",
    "additionalName": "License #2023006467"
  },
  "memberOf": [
    {
      "@type": "Organization",
      "name": "Columbus REALTORS®"
    },
    {
      "@type": "Organization",
      "name": "National Association of REALTORS®"
    }
  ],
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday"
    ],
    "opens": "09:00",
    "closes": "17:00"
  }
}
</script>
```

**Service Schema (Add to sellers.html):**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "serviceType": "Real Estate Listing Services",
  "provider": {
    "@type": "RealEstateAgent",
    "name": "TD Realty Ohio, LLC"
  },
  "areaServed": {
    "@type": "City",
    "name": "Columbus",
    "containedIn": {
      "@type": "State",
      "name": "Ohio"
    }
  },
  "description": "Full-service real estate listing for 1% commission in Central Ohio",
  "offers": {
    "@type": "Offer",
    "price": "1.00",
    "priceCurrency": "USD",
    "description": "1% commission when you buy and sell with us, 2% for sell-only"
  }
}
</script>
```

**FAQPage Schema (Add to any page with FAQs):**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How much does it cost to list with TD Realty Ohio?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Just 1% commission when you both list your home for sale and purchase your next home with us. If you're only selling, the rate is 2%."
      }
    },
    {
      "@type": "Question",
      "name": "Do you provide full MLS listing service?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! We provide complete MLS listing, professional photography, marketing, showing coordination, negotiation, and transaction management. This is full-service real estate at a reduced commission."
      }
    },
    {
      "@type": "Question",
      "name": "What areas do you serve?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We serve all of Central Ohio including Columbus, Westerville, Dublin, Gahanna, New Albany, Powell, Lewis Center, Delaware, and surrounding communities."
      }
    }
  ]
}
</script>
```

---

### ✅ Image Optimization

**All images must have descriptive alt text:**

```html
<!-- Bad -->
<img src="house.jpg">

<!-- Good -->
<img src="house.jpg" alt="Modern home for sale in Westerville Ohio">

<!-- Better -->
<img src="house.jpg" alt="3 bedroom colonial home for sale in Westerville Ohio by TD Realty Ohio 1% commission realtor">
```

**Alt text formula:** [Type of image] + [Location] + [Relevant keyword]

Examples:
- `alt="Columbus Ohio real estate agent Travis Debnam at TD Realty Ohio office"`
- `alt="1% commission savings calculator for Columbus home sellers"`
- `alt="Full-service real estate listing benefits in Central Ohio"`

---

### ✅ Heading Structure

**Every page must have exactly ONE H1:**

Homepage:
```html
<h1>List Your Home for 1% When You Buy With Us</h1>
```

Sellers Page:
```html
<h1>Sell Your Columbus Home for 1% Commission</h1>
```

City Pages:
```html
<h1>1% Commission Real Estate Agent in Westerville, Ohio</h1>
```

**H2 headings should include keywords:**
```html
<h2>Why Choose TD Realty Ohio for Your Columbus Home Sale?</h2>
<h2>How Our 1% Commission Saves You Thousands</h2>
<h2>Full-Service Real Estate in Central Ohio</h2>
```

---

### ✅ Internal Linking

**Every page should link to relevant service pages:**

From homepage:
```html
<a href="/sellers.html">Learn about our seller services</a>
<a href="/buyers.html">Explore buyer representation</a>
<a href="/pre-listing-inspection.html">Pre-listing inspection benefits</a>
```

From blog posts:
```html
When considering <a href="/sellers.html">selling your Columbus home</a>...
Our <a href="/pre-listing-inspection.html">pre-listing inspection service</a>...
```

From city pages:
```html
<a href="/sellers.html">Our full-service seller representation</a>
<a href="/contact.html">Schedule a free consultation</a>
```

**Anchor text best practices:**
- Use descriptive text (not "click here")
- Include keywords naturally
- Link to relevant content only
- 3-5 internal links per page minimum

---

### ✅ Mobile Optimization

**Critical mobile elements:**

1. **Click-to-email everywhere:**

    Use a mailto link to encourage visitors on mobile devices to send an email rather than placing a call.

    ```html
    <a href="mailto:info@tdrealtyohio.com" class="mobile-cta">Email us</a>
    ```

2. **Mobile-friendly forms:**
    - Large input fields (min 44px tap target)
    - Clear labels
    - Minimal required fields
    - Auto-complete attributes

3. **Fast load time:**
- Compress images (use WebP format)
- Minimize JavaScript
- Enable browser caching
- Target under 3 seconds load time

---

### ✅ Open Graph Tags (For Social Sharing)

Add to every page:

```html
<meta property="og:title" content="TD Realty Ohio | 1% Commission Real Estate Columbus">
<meta property="og:description" content="Sell your Central Ohio home for just 1% commission. Full-service real estate since 2017.">
<meta property="og:image" content="https://tdrealtyohio.com/images/td-realty-social.jpg">
<meta property="og:url" content="https://tdrealtyohio.com/">
<meta property="og:type" content="website">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="TD Realty Ohio | 1% Commission Real Estate">
<meta name="twitter:description" content="Sell your Columbus home for 1% commission">
<meta name="twitter:image" content="https://tdrealtyohio.com/images/td-realty-social.jpg">
```

---

### ✅ Page Speed Optimization

**Must-dos:**

1. **Compress images:**
   - Use tools like TinyPNG or ImageOptim
   - Target under 200KB per image
   - Use WebP format where possible

2. **Minify CSS/JS:**
   - Remove unnecessary whitespace
   - Combine files where possible
   - Use async/defer for JavaScript

3. **Enable caching:**
```apache
# .htaccess
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType text/javascript "access plus 1 month"
</IfModule>
```

4. **Use CDN:**
   - Consider Cloudflare (free tier)
   - Improves global load times

---

### ✅ Sitemap & Robots.txt

**sitemap.xml:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tdrealtyohio.com/</loc>
    <lastmod>2026-01-13</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://tdrealtyohio.com/sellers.html</loc>
    <lastmod>2026-01-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <!-- Add all pages -->
</urlset>
```

**robots.txt:**
```
User-agent: *
Allow: /
Sitemap: https://tdrealtyohio.com/sitemap.xml
```

---

## Phase 2: Content Optimization

### ✅ Minimum Word Counts

- Homepage: 500+ words
- Service pages: 800+ words
- City pages: 600+ words
- Blog posts: 1000+ words
- About page: 400+ words

### ✅ Keyword Density

Target 1-2% keyword density (natural usage):
- Primary keywords appear 3-5 times per page
- In H1, at least one H2, meta description, first paragraph, and naturally throughout

### ✅ Content Freshness

- Update blog 2x per week minimum
- Refresh city pages quarterly with new data
- Update market stats monthly

---

## Verification & Tracking

### ✅ Google Search Console Setup

1. Verify site ownership
2. Submit sitemap
3. Monitor for errors weekly
4. Track keyword rankings

### ✅ Google Analytics 4

1. Set up GA4 property
2. Track these events:
   - Form submissions
   - Phone clicks
   - Button clicks (Schedule Consultation)
   - Page scrolls
3. Set up conversion goals

### ✅ Google Business Profile

1. Claim/verify profile
2. Add photos (10+ high quality)
3. Post weekly updates
4. Respond to reviews
5. Add services and attributes

---

## Monthly Maintenance Checklist

- [ ] Check all pages for broken links
- [ ] Review and update meta descriptions if needed
- [ ] Add 8+ new blog posts
- [ ] Update market data on city pages
- [ ] Monitor page speed (target under 3 seconds)
- [ ] Check mobile usability
- [ ] Review Search Console for errors
- [ ] Analyze traffic and rankings
- [ ] Get 2-4 new client reviews

---

## Quick Implementation Priority

**Week 1 (Critical):**
1. Add meta tags to all pages
2. Add schema markup
3. Fix any images without alt text
4. Verify one H1 per page
5. Submit sitemap to Google

**Week 2 (High Priority):**
1. Optimize page speed
2. Add internal links
3. Set up Google Business Profile
4. Install Google Analytics

**Week 3-4 (Ongoing):**
1. Start blog content
2. Create city pages
3. Build local citations
4. Get client reviews

---

**Goal:** Complete Phase 1 in 2 weeks, then maintain with weekly content.
