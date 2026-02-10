/**
 * publish-post.mjs
 *
 * Generates and publishes a new blog post from the content backlog.
 * Follows the existing blog format conventions exactly:
 * - Pure HTML files in blog/<slug>/index.html
 * - Same header/footer/nav as existing posts
 * - Article schema + FAQPage schema + BreadcrumbList schema
 * - Consistent CSS/JS references
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BLOG_DIR = join(ROOT, 'blog');

/**
 * Publish a new blog post from a backlog topic.
 *
 * @param {object} options
 * @param {object} options.topic - Topic from content-backlog
 * @param {string} options.clusterId - Cluster ID
 * @param {string} options.pillarPath - Cluster pillar path
 * @param {object[]} options.blogPosts - Existing posts from blog-discovery
 * @param {string[]} options.rankIntentRoutes - For validating link targets
 * @param {object} options.seoDefaults - From seo-defaults.json
 * @returns {{ success: boolean, slug: string, filePath: string, routePath: string, filesCreated: string[], wordsAdded: number, reason: string }}
 */
export function publishPost({
  topic,
  clusterId,
  pillarPath,
  blogPosts = [],
  rankIntentRoutes = [],
  seoDefaults = {},
}) {
  if (!topic || !topic.topicId) {
    return { success: false, slug: '', filePath: '', routePath: '', filesCreated: [], wordsAdded: 0, reason: 'no_topic' };
  }

  // Derive slug from topicId
  let slug = topic.topicId.replace(/_/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase();

  // Ensure uniqueness
  const existingSlugs = new Set(blogPosts.map(p => p.slug));
  if (existingSlugs.has(slug)) {
    slug = slug + '-guide';
  }
  if (existingSlugs.has(slug)) {
    slug = slug + '-2';
  }

  const routePath = `/blog/${slug}/`;
  const postDir = join(BLOG_DIR, slug);
  const filePath = join(postDir, 'index.html');

  if (existsSync(filePath)) {
    return { success: false, slug, filePath, routePath, filesCreated: [], wordsAdded: 0, reason: 'file_already_exists' };
  }

  // Generate the post content
  const html = generatePostHtml({
    slug,
    routePath,
    topic,
    clusterId,
    pillarPath,
    rankIntentRoutes,
    seoDefaults,
  });

  const wordCount = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

  // Ensure minimum word count
  const minWords = 900;
  if (wordCount < minWords) {
    // This shouldn't happen with our template, but guard against it
    console.warn(`[publish-post] Generated ${wordCount} words, below minimum ${minWords}`);
  }

  // Write the file
  mkdirSync(postDir, { recursive: true });
  writeFileSync(filePath, html, 'utf-8');

  return {
    success: true,
    slug,
    filePath,
    routePath,
    filesCreated: [filePath],
    wordsAdded: wordCount,
    reason: 'published',
  };
}

/**
 * Generate the full HTML for a blog post.
 */
function generatePostHtml({
  slug,
  routePath,
  topic,
  clusterId,
  pillarPath,
  rankIntentRoutes,
  seoDefaults,
}) {
  const title = generateTitle(topic);
  const metaDescription = generateMetaDescription(topic);
  const today = new Date().toISOString().slice(0, 10);
  const monthYear = formatMonthYear(new Date());
  const baseUrl = seoDefaults.baseUrl || 'https://tdrealtyohio.com';
  const canonicalUrl = `${baseUrl}${routePath}`;
  const ogImage = `${baseUrl}/assets/images/og-default.jpg`;
  const keywords = (topic.targetQueryHints || []).join(', ');

  const sections = topic.requiredSections || [];
  const internalLinksTo = topic.internalLinksTo || [];
  const queryHints = topic.targetQueryHints || [];
  const primaryHint = queryHints[0] || topic.topicId.replace(/-/g, ' ');

  // Derive short breadcrumb name
  const breadcrumbName = title.length > 40 ? title.slice(0, 37) + '...' : title;

  // Generate FAQ items
  const faqItems = generateFaqItems(topic, primaryHint);

  // Generate article body sections
  const articleSections = generateArticleSections(sections, topic, internalLinksTo, rankIntentRoutes, pillarPath);

  // Generate FAQ schema JSON-LD
  const faqSchemaEntries = faqItems.map(f => `      {
        "@type": "Question",
        "name": ${JSON.stringify(f.question)},
        "acceptedAnswer": {
          "@type": "Answer",
          "text": ${JSON.stringify(f.answer)}
        }
      }`).join(',\n');

  // Build the dataTopic from cluster
  const dataTopic = clusterId === 'buyer-process' ? 'buyer' : 'seller';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)} | TD Realty Ohio</title>
  <meta name="description" content="${escAttr(metaDescription)}">
  <meta name="keywords" content="${escAttr(keywords)}">

  <link rel="canonical" href="${canonicalUrl}">
  <meta property="article:modified_time" content="${today}">

  <meta property="og:type" content="article">
  <meta property="og:title" content="${escAttr(title)} | TD Realty Ohio">
  <meta property="og:description" content="${escAttr(metaDescription)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${ogImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:site_name" content="TD Realty Ohio">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escAttr(title)}">
  <meta name="twitter:description" content="${escAttr(metaDescription)}">
  <meta name="twitter:image" content="${ogImage}">

  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <meta name="theme-color" content="#1a2e44">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" href="/assets/css/styles.css?v=20260210" as="style">
  <link rel="preload" href="/assets/js/main.js" as="script">
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/styles.css?v=20260210">
  <!-- Google tag (gtag.js) -->
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    if (localStorage.getItem('cookie-consent') !== 'declined') {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17866418952';
      document.head.appendChild(s);
      gtag('js', new Date());
      gtag('config', 'AW-17866418952');
    }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": ${JSON.stringify(title)},
    "description": ${JSON.stringify(metaDescription)},
    "author": {
      "@type": "Person",
      "name": "Travis Debnam",
      "jobTitle": "Broker",
      "worksFor": {
        "@type": "Organization",
        "name": "TD Realty Ohio, LLC"
      }
    },
    "publisher": {
      "@type": "Organization",
      "name": "TD Realty Ohio, LLC",
      "url": "${baseUrl}"
    },
    "datePublished": "${today}",
    "dateModified": "${today}",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${canonicalUrl}"
    },
    "image": "${ogImage}",
    "keywords": ${JSON.stringify(topic.targetQueryHints || [])}
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
${faqSchemaEntries}
    ]
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "${baseUrl}/" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "${baseUrl}/blog/" },
      { "@type": "ListItem", "position": 3, "name": ${JSON.stringify(breadcrumbName)} }
    ]
  }
  </script>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <span class="logo-mark">TD</span>
        <span>Realty Ohio</span>
      </a>

      <nav class="nav" id="main-nav" aria-label="Main navigation">
        <a href="/sellers/" class="nav-link">For Sellers</a>
        <a href="/buyers/" class="nav-link">For Buyers</a>
        <a href="/areas/" class="nav-link">Service Areas</a>
        <a href="/about/" class="nav-link">About</a>
        <div class="nav-more">
          <button class="nav-more-toggle" aria-expanded="false">More <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></button>
          <div class="nav-more-dropdown">
            <div class="nav-section-header">Services</div>
            <a href="/pre-listing-inspection/" class="nav-link">Pre-Listing Inspection</a>
            <a href="/home-value/" class="nav-link">Free Home Value</a>
            <a href="/affordability/" class="nav-link">Affordability Calculator</a>
            <a href="/referrals/" class="nav-link">Referral Credit</a>
            <a href="/compare/" class="nav-link">Compare Options</a>
            <div class="nav-section-header">Company</div>

            <a href="/blog/" class="nav-link">Blog</a>
            <a href="/agents/" class="nav-link">Agent Opportunities</a>
            <a href="/faq/" class="nav-link">FAQ</a>
          </div>
        </div>
        <a href="/contact/" class="btn btn-primary nav-cta">Contact</a>
      </nav>

      <a href="tel:6143928858" class="mobile-phone-btn" aria-label="Call (614) 392-8858">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </a>
      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

  </header>

  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <div class="container">
        <ol class="breadcrumb-list">
          <li><a href="/">Home</a></li>
          <li><a href="/blog/">Blog</a></li>
          <li aria-current="page">${escHtml(breadcrumbName)}</li>
        </ol>
      </div>
    </nav>

    <article class="section blog-article" data-topic="${dataTopic}">
      <div class="container" style="max-width: 800px;">
        <header class="article-header">
          <h1>${escHtml(title)}</h1>
          <p class="post-meta">TD Realty Ohio | ${monthYear}</p>
        </header>

        <div class="article-content">
${articleSections}

          <h2>Frequently Asked Questions</h2>
          <div class="faq-list" style="margin-top: 1.5rem;">
${faqItems.map(f => `            <div class="faq-item">
              <button class="faq-question" aria-expanded="false">
                ${escHtml(f.question)}
                <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div class="faq-answer">
                <p>${escHtml(f.answer)}</p>
              </div>
            </div>`).join('\n')}
          </div>

          <h2>Next Steps</h2>
          <p>If you have questions about ${primaryHint} or any other aspect of buying or selling a home in Central Ohio, TD Realty Ohio is here to help. We provide full-service real estate representation at reduced commission rates, helping you keep more of your equity.</p>

          <div style="margin: 2rem 0; padding: 2rem; background: var(--color-primary); color: white; border-radius: 8px; text-align: center;">
            <h3 style="color: white; margin-top: 0;">Get Expert Guidance</h3>
            <p style="margin-bottom: 1.5rem; opacity: 0.9;">Contact TD Realty Ohio for personalized advice about your real estate goals.</p>
            <a href="/contact/" class="btn btn-accent btn-lg" style="margin-right: 0.5rem;">Contact Us</a>
            <a href="tel:6143928858" class="btn btn-outline-white btn-lg">(614) 392-8858</a>
          </div>
        </div>
      </div>
    </article>

    <section class="section cta-section">
      <div class="container">
        <h2>Ready to Take the Next Step?</h2>
        <p>Contact TD Realty Ohio for a free consultation. Full-service representation at 1-2% commission.</p>
        <div class="hero-buttons flex-center">
          <a href="/contact/" class="btn btn-primary btn-lg">Schedule Consultation</a>
          <a href="tel:6143928858" class="btn btn-outline-white btn-lg">(614) 392-8858</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-main">
        <div class="footer-brand">
          <div class="footer-logo">
            <span class="logo-mark">TD</span>
            <span>Realty Ohio</span>
          </div>
          <p>Full-service real estate. Lower commission.</p>
        </div>

        <div>
          <h3 class="footer-title">Services</h3>
          <ul class="footer-links" data-footer-nav="services">
            <li><a href="/sellers/">For Sellers</a></li>
            <li><a href="/buyers/">For Buyers</a></li>
            <li><a href="/pre-listing-inspection/">Pre-Listing Inspection</a></li>
            <li><a href="/areas/">Service Areas</a></li>
            <li><a href="/home-value/">Free Home Value</a></li>
            <li><a href="/affordability/">Affordability Calculator</a></li>
            <li><a href="/referrals/">Referral Credit</a></li>
            <li><a href="/compare/">Compare Options</a></li>
          </ul>
        </div>

        <div>
          <h3 class="footer-title">Company</h3>
          <ul class="footer-links" data-footer-nav="company">
            <li><a href="/about/">About</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/agents/">Agent Opportunities</a></li>
            <li><a href="/faq/">FAQ</a></li>
          </ul>
        </div>

        <div>
          <h3 class="footer-title">Contact</h3>
          <div class="footer-contact-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <a href="tel:6143928858" data-phone>(614) 392-8858</a>
          </div>
          <div class="footer-contact-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <a href="mailto:info@tdrealtyohio.com" data-email>info@tdrealtyohio.com</a>
          </div>
          <div class="footer-contact-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span data-location>3600 Tremont Rd Ste 250, Columbus, OH 43221</span>
          </div>
        </div>
      </div>

      <div class="footer-compliance-logos">
        <a href="https://www.hud.gov/program_offices/fair_housing_equal_opp" target="_blank" rel="noopener noreferrer" title="Equal Housing Opportunity" aria-label="Equal Housing Opportunity - opens in new tab">
          <img src="/media/compliance/equal-housing.svg" alt="Equal Housing Opportunity" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.nar.realtor/" target="_blank" rel="noopener noreferrer" title="National Association of REALTORS\u00ae" aria-label="National Association of REALTORS - opens in new tab">
          <img src="/media/compliance/realtor.svg" alt="REALTOR\u00ae" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.columbusrealtors.com/" target="_blank" rel="noopener noreferrer" title="Columbus REALTORS\u00ae" aria-label="Columbus REALTORS - opens in new tab">
          <img src="/media/compliance/columbus-realtors.svg" alt="Columbus REALTORS\u00ae" height="45" width="120" loading="lazy">
        </a>
        <a href="https://www.ohiorealtors.org/" target="_blank" rel="noopener noreferrer" title="Ohio REALTORS\u00ae" aria-label="Ohio REALTORS - opens in new tab">
          <img src="/media/compliance/ohio-realtors.svg" alt="Ohio REALTORS\u00ae" height="45" width="120" loading="lazy">
        </a>
      </div>

      <div class="footer-bottom">
        <div class="footer-legal">
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Service</a>
          <a href="/fair-housing/">Fair Housing</a>
          <a href="/sitemap-page/">Site Map</a>
        </div>
      </div>

      <div class="footer-license">
        TD Realty Ohio, LLC | Broker: Travis Debnam | Broker License #2023006467 | Brokerage License #2023006602<br>
      </div>
    </div>
  </footer>

  <script src="/assets/js/nav.js?v=20260210"></script>
  <script src="/assets/js/main.js?v=20260210"></script>
</body>
</html>
`;
}

/**
 * Generate article body sections from requiredSections.
 */
function generateArticleSections(sections, topic, internalLinksTo, rankIntentRoutes, pillarPath) {
  const primaryHint = (topic.targetQueryHints || [])[0] || topic.topicId.replace(/-/g, ' ');
  const intent = topic.primaryIntent || 'explain';
  const rankSet = new Set(rankIntentRoutes || []);
  const parts = [];

  // Intro paragraph
  parts.push(`          <p>If you are navigating the real estate process in Central Ohio, understanding ${primaryHint} is an important step. Whether you are buying your first home, selling a property, or exploring your options, this guide covers the key points you need to know.</p>`);
  parts.push(``);
  parts.push(`          <p>TD Realty Ohio serves homeowners and buyers throughout the Columbus metro area, including Franklin, Delaware, Licking, and Fairfield counties. We see questions about ${primaryHint} frequently from our clients, and this article provides clear, practical answers based on how real estate transactions work in this area.</p>`);
  parts.push(``);

  // Track where to insert internal links
  let linksInserted = 0;
  const maxLinks = Math.min(internalLinksTo.length, 3);

  const pathLabels = {
    '/sellers/': 'seller services',
    '/buyers/': 'buyer programs',
    '/1-percent-commission/': '1% commission listing',
    '/contact/': 'contact page',
    '/areas/': 'service areas',
    '/pre-listing-inspection/': 'pre-listing inspection',
    '/home-value/': 'free home value estimate',
    '/affordability/': 'affordability calculator',
    '/compare/': 'listing option comparison',
    '/sell-and-buy/': 'sell and buy program',
    '/sell-only-2-percent/': 'sell-only 2% listing',
    '/blog/': 'our blog',
    '/faq/': 'FAQ page',
  };

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (section === 'FAQ') continue; // FAQ is handled separately at the end

    parts.push(`          <h2>${escHtml(section)}</h2>`);
    parts.push(``);

    // Generate content for each section based on the section name and intent
    const sectionContent = generateSectionContent(section, primaryHint, intent, topic);
    parts.push(sectionContent);
    parts.push(``);

    // Insert an internal link after every other section (up to max)
    if (linksInserted < maxLinks && i > 0 && i % 2 === 0) {
      const linkPath = internalLinksTo[linksInserted];
      if (linkPath) {
        const label = pathLabels[linkPath] || linkPath.replace(/\//g, ' ').trim();
        parts.push(`          <p>For more details, visit our <a href="${linkPath}">${label}</a> page.</p>`);
        parts.push(``);
        linksInserted++;
      }
    }
  }

  // Ensure pillar link is included
  if (pillarPath && linksInserted === 0) {
    const label = pathLabels[pillarPath] || pillarPath.replace(/\//g, ' ').trim();
    parts.push(`          <p>Learn more about our <a href="${pillarPath}">${label}</a> to see how TD Realty Ohio can help with your real estate goals.</p>`);
    parts.push(``);
  }

  // Add remaining internal links if not yet inserted
  while (linksInserted < maxLinks) {
    const linkPath = internalLinksTo[linksInserted];
    if (linkPath) {
      const label = pathLabels[linkPath] || linkPath.replace(/\//g, ' ').trim();
      parts.push(`          <p>You may also find our <a href="${linkPath}">${label}</a> helpful as you plan your next steps.</p>`);
      parts.push(``);
    }
    linksInserted++;
  }

  return parts.join('\n');
}

/**
 * Generate content for a specific section.
 */
function generateSectionContent(sectionName, primaryHint, intent, topic) {
  const lower = sectionName.toLowerCase();
  const lines = [];

  if (lower === 'overview' || lower.includes('overview')) {
    lines.push(`          <p>When it comes to ${primaryHint}, Central Ohio homeowners and buyers have several important factors to consider. The Columbus metro area has its own set of local practices, county regulations, and market conditions that influence how transactions are handled.</p>`);
    lines.push(``);
    lines.push(`          <p>This overview covers the essential information you need to make informed decisions. We focus on practical details rather than general advice, because every real estate situation in this area has specific local considerations that matter.</p>`);
    lines.push(``);
    lines.push(`          <p>Understanding these fundamentals before you begin the process helps you set realistic expectations and avoid common surprises. Central Ohio's real estate market continues to attract both local and out-of-state buyers, which means staying informed gives you a meaningful advantage whether you are buying or selling.</p>`);
  } else if (lower.includes('cost') || lower.includes('fee') || lower.includes('reduce')) {
    lines.push(`          <p>Costs are one of the most important considerations for any real estate transaction. In Central Ohio, the specific amounts you pay depend on your county, your property value, and the professionals you choose to work with.</p>`);
    lines.push(``);
    lines.push(`          <p>There are several practical ways to manage and reduce these costs without sacrificing the quality of service you receive. Choosing a low-commission listing agent is one of the most effective strategies. TD Realty Ohio charges 1-2% instead of the traditional 3% listing commission, which can mean thousands of dollars in savings on a typical Columbus-area home.</p>`);
    lines.push(``);
    lines.push(`          <p>Other cost-reduction strategies include getting a pre-listing inspection to prevent costly repair negotiations, pricing your home accurately from the start to avoid extended market time, and working with your agent to negotiate favorable terms on items like title insurance and closing fee allocation.</p>`);
  } else if (lower.includes('timeline') || lower.includes('process') || lower.includes('step')) {
    lines.push(`          <p>The typical timeline for a real estate transaction in Central Ohio varies based on market conditions, financing type, and negotiation complexity. Understanding the general sequence of events helps you plan ahead and avoid delays.</p>`);
    lines.push(``);
    lines.push(`          <p>In the current Columbus-area market, the process generally moves through several key phases: preparation, listing or searching, negotiation, inspection and due diligence, and closing. Each phase has its own timeline and requirements that are specific to Ohio law and local practice.</p>`);
    lines.push(``);
    lines.push(`          <p>Working with an agent who is familiar with the Central Ohio market helps ensure that each phase moves smoothly. At TD Realty Ohio, we coordinate with title companies, inspectors, and lenders throughout the process to keep things on track.</p>`);
  } else if (lower.includes('housing') || lower.includes('commute') || lower.includes('neighborhood')) {
    lines.push(`          <p>Central Ohio offers a wide range of housing options across its many communities. From historic homes in established neighborhoods to new construction in growing suburbs, the area provides choices for nearly every budget and lifestyle preference.</p>`);
    lines.push(``);
    lines.push(`          <p>Each community within the Columbus metro area has its own character, school district boundaries, and commute patterns. These factors significantly influence both property values and day-to-day quality of life, making location research an essential part of any home search.</p>`);
    lines.push(``);
    lines.push(`          <p>Whether you are looking in Westerville, Dublin, Powell, Hilliard, or any of the other communities we serve, understanding the local landscape helps you make a more confident decision about where to buy or how to position your home for sale.</p>`);
  } else if (lower.includes('school') || lower.includes('education')) {
    lines.push(`          <p>School quality is one of the most common factors that influences home buying decisions in Central Ohio. The Columbus metro area includes dozens of school districts, each with its own performance profile, boundaries, and community support.</p>`);
    lines.push(``);
    lines.push(`          <p>Districts like Olentangy, Dublin, Worthington, and Westerville consistently attract families and tend to support strong property values. However, school district boundaries do not always align with city boundaries, so it is important to verify which district a specific property falls within before making a decision.</p>`);
    lines.push(``);
    lines.push(`          <p>Your real estate agent can help you understand how school district assignment works for specific addresses and how district reputation typically affects resale value in different parts of the metro area.</p>`);
  } else if (lower.includes('commission') || lower.includes('paid') || lower.includes('how')) {
    lines.push(`          <p>Understanding how the process works in Central Ohio helps you make better financial decisions. Ohio follows standard real estate practices with some local variations in how fees are structured and who pays for what at the closing table.</p>`);
    lines.push(``);
    lines.push(`          <p>In a typical transaction, certain costs are customarily paid by the seller and others by the buyer, though many items are negotiable. Recent industry changes have also shifted how buyer agent compensation is discussed and structured, giving both buyers and sellers more transparency and flexibility.</p>`);
    lines.push(``);
    lines.push(`          <p>TD Realty Ohio takes a straightforward approach: transparent pricing, clear explanations of every cost, and a commitment to helping clients understand their options before making commitments.</p>`);
  } else if (lower.includes('option') || lower.includes('alternative') || lower.includes('compare')) {
    lines.push(`          <p>When it comes to ${primaryHint}, you have several options available in today's market. Understanding the differences between these options helps you choose the approach that best fits your situation, timeline, and budget.</p>`);
    lines.push(``);
    lines.push(`          <p>Each option comes with its own set of trade-offs in terms of cost, service level, convenience, and risk. The right choice depends on your specific circumstances, including your local market conditions, your experience with real estate transactions, and how much hands-on involvement you want in the process.</p>`);
    lines.push(``);
    lines.push(`          <p>We recommend evaluating each option based on your total costs (not just the commission rate), the services included, and the agent's track record in your specific market area. A lower commission does not have to mean less service when you work with the right brokerage.</p>`);
  } else {
    // Generic section content
    lines.push(`          <p>${escHtml(sectionName)} is an important consideration when dealing with ${primaryHint} in the Central Ohio real estate market. Local practices and regulations can differ from other parts of the state, so understanding how this works in the Columbus metro area is valuable.</p>`);
    lines.push(``);
    lines.push(`          <p>Central Ohio homeowners and buyers benefit from working with professionals who understand these local nuances. Whether you are in Franklin County, Delaware County, or one of the surrounding areas, the specifics can vary in meaningful ways that affect your transaction.</p>`);
    lines.push(``);
    lines.push(`          <p>At TD Realty Ohio, we handle transactions throughout the region and can provide guidance specific to your property's location and your individual circumstances. Our approach focuses on transparent communication and helping clients understand every aspect of their transaction.</p>`);
  }

  return lines.join('\n');
}

/**
 * Generate FAQ items for the post.
 */
function generateFaqItems(topic, primaryHint) {
  return [
    {
      question: `What should I know about ${primaryHint} in Central Ohio?`,
      answer: `In the Columbus metro area, ${primaryHint} is influenced by local market conditions, property values, and county-specific regulations. Franklin and Delaware counties may have different requirements. Working with a local real estate professional ensures you get accurate, current information for your specific situation.`,
    },
    {
      question: `How does ${primaryHint} affect my home sale or purchase?`,
      answer: `Understanding ${primaryHint} can directly impact your net proceeds when selling or your total costs when buying. Homeowners who research this topic before listing or making an offer are typically better prepared to negotiate favorable terms and avoid unexpected costs at closing.`,
    },
    {
      question: `Can TD Realty Ohio help with questions about ${primaryHint}?`,
      answer: `Yes. TD Realty Ohio assists clients throughout Central Ohio with questions about ${primaryHint} and other real estate topics. Call (614) 392-8858 or visit our contact page to schedule a free consultation. We provide straightforward guidance based on your specific situation.`,
    },
    {
      question: `How much can I save by working with a low-commission agent?`,
      answer: `TD Realty Ohio charges 1-2% listing commission instead of the traditional 3%. On a typical Columbus-area home, this can save you thousands of dollars. For example, on a $350,000 home, the difference between a 3% and 1% listing commission is $7,000 in additional net proceeds.`,
    },
    {
      question: `What areas does TD Realty Ohio serve?`,
      answer: `TD Realty Ohio serves the entire Columbus metro area including Westerville, Dublin, Powell, Hilliard, Upper Arlington, Worthington, Gahanna, New Albany, Delaware, Grove City, Pickerington, and surrounding communities in Franklin, Delaware, Licking, and Fairfield counties.`,
    },
  ];
}

/**
 * Generate a title from the topic.
 */
function generateTitle(topic) {
  const hints = topic.targetQueryHints || [];
  const topicId = topic.topicId || '';

  // Build title from the first hint, capitalized properly
  if (hints.length > 0) {
    const base = hints[0]
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const intent = topic.primaryIntent || 'explain';
    if (intent === 'guide') {
      return `${base}: A Guide for Central Ohio`;
    }
    return `${base}: What Central Ohio Homeowners Should Know`;
  }

  // Fallback: derive from topicId
  return topicId
    .replace(/-/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Generate a meta description (70-160 chars).
 */
function generateMetaDescription(topic) {
  const hints = topic.targetQueryHints || [];
  const primary = hints[0] || topic.topicId.replace(/-/g, ' ');

  const desc = `Learn about ${primary} in Central Ohio. Practical guidance for Columbus-area homeowners and buyers from TD Realty Ohio.`;

  // Ensure 70-160 chars
  if (desc.length > 160) {
    return desc.slice(0, 157) + '...';
  }
  return desc;
}

function formatMonthYear(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
