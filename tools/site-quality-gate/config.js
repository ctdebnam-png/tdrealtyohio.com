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
  excludeDirs: ['node_modules', 'tools', 'reports', '.git', 'templates', 'data'],

  // Required business facts that must appear on every page
  requiredBusinessFacts: {
    phone: '(614) 392-8858',
    email: 'info@tdrealtyohio.com',
    licenses: ['2023006602', '2023006467']
  },

  // First-time buyer program statement (must appear on buyers page)
  firstTimeBuyerStatement: {
    file: 'buyers/index.html',
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

  // Files to exclude from schema validation checks
  excludeFromSchemaCheck: ['/404.html', '/404/', '/lp/'],


  // Centralized inline script policy check
  centralizedInlineScriptCheck: {
    includeGlobs: ['tools/**/*.html']
  },

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

  // CSS usage audit by page-template family
  cssUsage: {
    families: {
      core: ['assets/css/styles.css'],
      areas: ['assets/css/styles.css', 'assets/css/bundles/extended.css'],
      blog: ['assets/css/styles.css', 'assets/css/bundles/extended.css'],
      tools: ['assets/css/styles.css', 'assets/css/bundles/extended.css'],
      'landing-pages': ['assets/css/styles.css', 'assets/css/lp.css']
    }
  },

  // CI asset budgets to catch regressions in critical payloads
  assetBudget: {
    cssFiles: ['assets/css/styles.css', 'assets/css/bundles/extended.css', 'assets/css/lp.css'],
    jsFiles: ['assets/js/main.js'],
    maxCssBytes: 330000,
    maxJsBytes: 140000
  },

  // Reports output directory
  reportsDir: '../../reports/site-quality-gate'
};
