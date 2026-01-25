# TD Realty Ohio Website

A clean, professional real estate website for TD Realty Ohio, LLC. Built with vanilla HTML, CSS, and JavaScript for maximum performance and easy deployment.

## Features

- **Low Commission Focus**: Clear presentation of 1-2% listing rates vs traditional 3%
- **Interactive Calculators**: Real-time savings calculators for sellers and buyers
- **Mobile Responsive**: Fully responsive design for all screen sizes
- **SEO Optimized**: Meta tags, structured data (JSON-LD), and semantic HTML
- **Single CSS/JS Files**: No competing stylesheets, easy to maintain
- **Centralized Configuration**: All contact info in one JavaScript config object

## Pages

All pages use a clean directory structure (e.g., `/sellers/` not `sellers.html`).

| Route | Purpose |
|-------|---------|
| `/` | Homepage with hero, stats, calculator, services, areas |
| `/sellers/` | Seller services, commission paths, process, FAQs |
| `/buyers/` | First-time buyer cash back program, calculator |
| `/1-percent-commission/` | 1% listing commission details |
| `/pre-listing-inspection/` | Free pre-listing inspection benefit |
| `/home-value/` | Home value estimate tool |
| `/affordability/` | Affordability calculator |
| `/contact/` | Contact form and information |
| `/about/` | About Travis Debnam and TD Realty Ohio |
| `/agents/` | Agent referral program |
| `/referrals/` | Client referral program |
| `/areas/` | Service area grid |
| `/blog/` | Blog articles |
| `/fair-housing/` | Fair housing statement |
| `/privacy/` | Privacy policy |
| `/terms/` | Terms of service |
| `/sitemap-page/` | HTML sitemap |
| `/404.html` | Error page |

## Project Structure

```
tdrealtyohio.com/
├── index.html              # Homepage
├── 404.html                # Error page
├── sellers/index.html      # Seller services
├── buyers/index.html       # Buyer services
├── 1-percent-commission/   # Commission details
├── pre-listing-inspection/ # Inspection benefit
├── home-value/             # Home value tool
├── affordability/          # Affordability calculator
├── contact/                # Contact page
├── about/                  # About page
├── agents/                 # Agent referrals
├── referrals/              # Client referrals
├── areas/                  # Service areas
├── blog/                   # Blog articles
├── fair-housing/           # Fair housing
├── privacy/                # Privacy policy
├── terms/                  # Terms of service
├── sitemap-page/           # HTML sitemap
├── assets/
│   ├── css/styles.css      # Single stylesheet
│   ├── js/main.js          # Config, calculators, UI
│   └── images/             # Local images
├── media/compliance/       # Compliance logos (SVG)
├── scripts/                # Build scripts (Node.js)
├── tools/site-quality-gate/ # Automated quality checks
├── docs/                   # Documentation
├── _redirects              # Cloudflare redirects
├── robots.txt              # Search engine rules
├── sitemap.xml             # XML sitemap
└── README.md
```

## Configuration

All business information is centralized in the `TD_CONFIG` object in `assets/js/main.js`:

```javascript
const TD_CONFIG = {
  company: {
    name: 'TD Realty Ohio, LLC',
    broker: 'Travis Debnam'
  },
  contact: {
    phone: '(614) 392-8858',
    email: 'info@tdrealtyohio.com',
    location: 'Westerville, Ohio'
  },
  licenses: {
    broker: '2023006467',
    brokerage: '2023006602'
  },
  rates: {
    traditional: 0.03,
    buyAndSell: 0.01,
    sellOnly: 0.02
  }
  // ... more configuration
};
```

To update contact information, modify this config object. Elements with `data-*` attributes are automatically populated.

## Images

The site uses Unsplash URLs directly in the HTML. Local images are stored in `assets/images/` and compliance logos are in `media/compliance/`.

## Build and Indexing

### Stack
- **Framework**: Plain static HTML (no build step required)
- **Node version**: 22.x (for scripts only)
- **Deploy root**: Repository root (`/`)
- **Hosting**: Cloudflare Pages

### Canonical URL Policy
- **Host**: `https://tdrealtyohio.com` (HTTPS, non-www)
- **Trailing slash**: Yes (e.g., `/sellers/` not `/sellers`)
- **Legacy routes**: `.html` URLs redirect to clean routes via `_redirects`

### Sitemap
- **URL**: `https://tdrealtyohio.com/sitemap.xml`
- Generated with canonical URLs only (no `.html` extensions)
- Update `sitemap.xml` when adding new pages

### Scripts

```bash
# Validate indexing requirements (runs after any changes)
node scripts/indexing-guard.mjs

# Regenerate sitemap from HTML files
node scripts/generate-sitemap.mjs
```

### Indexing Guard Checks
The guard script validates:
- `robots.txt` exists and references sitemap
- `sitemap.xml` exists with canonical URLs
- All HTML files have valid canonical tags
- No old phone number (614-956-8656) in codebase

## Deployment

### Cloudflare Pages

1. Push code to GitHub repository
2. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. Go to **Workers & Pages** > **Create application** > **Pages**
4. Connect your GitHub repository
5. Configure build settings:
   - **Framework preset**: None
   - **Build command**: (leave empty)
   - **Build output directory**: `/` (root)
6. Deploy

### Custom Domain

1. In Cloudflare Pages, go to your project settings
2. Click **Custom domains** > **Set up a custom domain**
3. Enter `tdrealtyohio.com`
4. Follow DNS configuration instructions

### Other Platforms

The site is static HTML/CSS/JS and works on any static hosting:

- **Netlify**: Drag and drop the folder or connect GitHub
- **Vercel**: Import from GitHub
- **GitHub Pages**: Enable in repository settings
- **Any web server**: Upload files via FTP/SFTP

## Development

### Local Development

Open `index.html` directly in a browser, or use a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve

# PHP
php -S localhost:8000
```

### Making Changes

1. **Styles**: Edit `assets/css/styles.css`
2. **JavaScript**: Edit `assets/js/main.js`
3. **Content**: Edit individual HTML files
4. **Contact Info**: Update `TD_CONFIG` in `main.js`

### Design System

| Element | Value |
|---------|-------|
| Primary Color (Navy) | `#1a2e44` |
| Accent Color (Gold) | `#c9a227` |
| Heading Font | Libre Baskerville |
| Body Font | Source Sans 3 |
| Border Radius | 4px (sm), 8px (md), 12px (lg) |
| Max Width | 1200px |

## Compliance

The site includes required real estate compliance elements:

- Equal Housing Opportunity statement
- REALTOR membership mention
- Broker and brokerage license numbers
- Links to Privacy Policy, Terms, Fair Housing, Accessibility
- Buyer representation disclosure on buyer pages

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome for Android)

## License

This website is proprietary to TD Realty Ohio, LLC. All rights reserved.
