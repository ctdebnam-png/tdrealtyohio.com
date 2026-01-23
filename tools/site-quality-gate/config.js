/**
 * Site Quality Gate Configuration
 * TD Realty Ohio - tdrealtyohio.com
 */

module.exports = {
  // Site root directory (relative to this tool's location)
  siteRoot: '../../',

  // HTML files to check
  htmlGlob: '**/*.html',

  // Directories to exclude from checks
  excludeDirs: ['node_modules', 'tools', 'reports', '.git'],

  // Required business facts that must appear on every page
  requiredBusinessFacts: {
    phone: '(614) 392-8858',
    email: 'info@tdrealtyohio.com',
    licenses: ['2023006602', '2023006467']
  },

  // First-time buyer program statement (must appear on buyers.html)
  firstTimeBuyerStatement: {
    file: 'buyers.html',
    pattern: /first[- ]?time\s+(home)?buyer/i
  },

  // Required SEO tags for each page
  requiredSeoTags: [
    'title',
    'meta[name="description"]',
    'link[rel="canonical"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:url"]',
    'meta[property="og:type"]'
  ],

  // Files to exclude from SEO tag checks (error pages, etc.)
  excludeFromSeoCheck: ['404.html'],

  // Sitemap file location
  sitemapFile: 'sitemap.xml',

  // Base URL for the site
  baseUrl: 'https://tdrealtyohio.com',

  // External link check settings
  externalLinks: {
    // Skip checking these domains (known-good or rate-limited)
    skipDomains: [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdnjs.cloudflare.com',
      'www.googletagmanager.com',
      'www.google-analytics.com'
    ],
    // Timeout for external link checks (ms)
    timeout: 10000
  },

  // Reports output directory
  reportsDir: '../../reports/site-quality-gate'
};
