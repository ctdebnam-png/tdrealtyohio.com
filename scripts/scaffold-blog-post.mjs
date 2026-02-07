#!/usr/bin/env node
/**
 * Blog Post Scaffolder for TD Realty Ohio
 * Reads blog briefs from output/blog-briefs/latest.json and scaffolds
 * SEO-optimized HTML blog post shells ready for content writing.
 *
 * Usage:
 *   node scripts/scaffold-blog-post.mjs              # scaffold top brief
 *   node scripts/scaffold-blog-post.mjs --all        # scaffold all briefs
 *   node scripts/scaffold-blog-post.mjs --index 2    # scaffold brief at index 2
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BRIEFS_PATH = join(ROOT, 'output', 'blog-briefs', 'latest.json');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function generatePostHtml(brief) {
  const slug = slugify(brief.title);
  const date = today();
  const headings = brief.headings || [];
  const internalLinks = brief.internalLinks || [];
  const wordTarget = brief.targetWordCount || 1500;
  const schemaType = brief.recommendedSchema || 'BlogPosting';

  const faqSchema = schemaType === 'FAQPage' ? `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "TODO: Add FAQ question",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "TODO: Add FAQ answer"
        }
      }
    ]
  }
  </script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brief.title} | TD Realty Ohio</title>
  <meta name="description" content="TODO: Write a 150-160 character meta description targeting: ${brief.keyword}">
  <meta name="keywords" content="${brief.keyword}, ${brief.keyword.includes('Columbus') ? '' : 'Columbus Ohio, '}real estate, TD Realty Ohio">

  <link rel="canonical" href="https://tdrealtyohio.com/blog/${slug}/">
  <meta property="article:modified_time" content="${date}">
  <meta property="article:published_time" content="${date}">

  <meta property="og:type" content="article">
  <meta property="og:title" content="${brief.title}">
  <meta property="og:description" content="TODO: Write OG description">
  <meta property="og:url" content="https://tdrealtyohio.com/blog/${slug}/">
  <meta property="og:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${brief.title}">
  <meta name="twitter:description" content="TODO: Write Twitter description">
  <meta name="twitter:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">

  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <meta name="theme-color" content="#1a2e44">

  <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" href="/assets/css/styles.css" as="style">
  <link rel="preload" href="/assets/js/main.js" as="script">
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/styles.css">

  <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17866418952"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'AW-17866418952');
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tdrealtyohio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://tdrealtyohio.com/blog/" },
      { "@type": "ListItem", "position": 3, "name": "${brief.title}", "item": "https://tdrealtyohio.com/blog/${slug}/" }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${brief.title}",
    "description": "TODO: Add article description",
    "author": {
      "@type": "Person",
      "name": "Travis Debnam",
      "jobTitle": "Broker/Owner",
      "worksFor": { "@type": "RealEstateAgent", "name": "TD Realty Ohio, LLC" }
    },
    "publisher": {
      "@type": "Organization",
      "name": "TD Realty Ohio, LLC",
      "url": "https://tdrealtyohio.com"
    },
    "datePublished": "${date}",
    "dateModified": "${date}",
    "mainEntityOfPage": "https://tdrealtyohio.com/blog/${slug}/",
    "wordCount": ${wordTarget}
  }
  </script>${faqSchema}
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><span class="logo-mark">TD</span><span>Realty Ohio</span></a>
      <nav class="nav" id="main-nav" aria-label="Main navigation">
        <div class="nav-section-header">Services</div>
        <a href="/sellers/" class="nav-link">For Sellers</a>
        <a href="/buyers/" class="nav-link">For Buyers</a>
        <a href="/pre-listing-inspection/" class="nav-link">Pre-Listing Inspection</a>
        <a href="/areas/" class="nav-link">Service Areas</a>
        <a href="/home-value/" class="nav-link">Free Home Value</a>
        <a href="/affordability/" class="nav-link">Affordability Calculator</a>
        <a href="/referrals/" class="nav-link">Referral Credit</a>
        <a href="/compare/" class="nav-link">Compare Options</a>
        <div class="nav-section-header">Company</div>
        <a href="/about/" class="nav-link">About</a>
        <a href="/blog/" class="nav-link">Blog</a>
        <a href="/agents/" class="nav-link">Agent Opportunities</a>
        <a href="/faq/" class="nav-link">FAQ</a>
        <a href="/contact/" class="btn btn-primary nav-cta">Contact</a>
      </nav>
      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/></svg>
      </button>
    </div>
  </header>

  <main id="main-content">
    <article class="blog-post">
      <div class="container" style="max-width: 800px;">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li><a href="/">Home</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li class="current">${brief.title}</li>
          </ol>
        </nav>

        <header class="article-header">
          <h1>${brief.title}</h1>
          <p class="post-meta">TD Realty Ohio | ${new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>
        </header>

        <!-- Target: ~${wordTarget} words | Primary keyword: ${brief.keyword} -->
        <!-- Priority score: ${brief.score?.toFixed(2) || 'N/A'} -->

        <p><strong>TODO:</strong> Write introduction paragraph (100-150 words). Hook the reader with the problem or question this post answers. Naturally include "${brief.keyword}" in the first paragraph.</p>

${headings.map(h => `        <h2>${h}</h2>
        <p><strong>TODO:</strong> Write ${Math.round(wordTarget / headings.length)} words for this section.</p>
`).join('\n')}
        <!-- Internal links to include: -->
${internalLinks.map(l => `        <!-- ${l} -->`).join('\n')}

        <h2>Next Steps</h2>
        <p><strong>TODO:</strong> Write conclusion with clear CTA. Link to <a href="/contact/">contact page</a> or <a href="/sellers/">sellers page</a>.</p>

        <div style="margin-top: 3rem; padding: 2rem; background: var(--gray-50); border-radius: var(--radius-lg); text-align: center;">
          <h3>Ready to Get Started?</h3>
          <p>Contact TD Realty Ohio for a free consultation.</p>
          <a href="/contact/" class="btn btn-primary">Contact Us</a>
          <a href="tel:6143928858" class="btn btn-outline" style="margin-left: 0.5rem;">(614) 392-8858</a>
        </div>
      </div>
    </article>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-main">
        <div class="footer-brand">
          <div class="footer-logo"><span class="logo-mark">TD</span><span>Realty Ohio</span></div>
          <p>Full-service real estate. Lower commission.</p>
        </div>
        <div>
          <h3 class="footer-title">Services</h3>
          <ul class="footer-links">
            <li><a href="/sellers/">For Sellers</a></li>
            <li><a href="/buyers/">For Buyers</a></li>
            <li><a href="/pre-listing-inspection/">Pre-Listing Inspection</a></li>
            <li><a href="/areas/">Service Areas</a></li>
            <li><a href="/home-value/">Home Value</a></li>
            <li><a href="/affordability/">Affordability</a></li>
            <li><a href="/referrals/">Referral Credit</a></li>
            <li><a href="/compare/">Compare Options</a></li>
          </ul>
        </div>
        <div>
          <h3 class="footer-title">Company</h3>
          <ul class="footer-links">
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <a href="tel:6143928858" data-phone>(614) 392-8858</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <a href="mailto:info@tdrealtyohio.com" data-email>info@tdrealtyohio.com</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span data-location>Westerville, Ohio</span>
          </div>
        </div>
      </div>
      <div class="footer-compliance-logos">
        <a href="https://www.hud.gov/program_offices/fair_housing_equal_opp" target="_blank" rel="noopener noreferrer" title="Equal Housing Opportunity" aria-label="Equal Housing Opportunity - opens in new tab">
          <img src="/media/compliance/equal-housing.svg" alt="Equal Housing Opportunity" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.nar.realtor/" target="_blank" rel="noopener noreferrer" title="National Association of REALTORS®" aria-label="National Association of REALTORS - opens in new tab">
          <img src="/media/compliance/realtor.svg" alt="REALTOR®" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.columbusrealtors.com/" target="_blank" rel="noopener noreferrer" title="Columbus REALTORS®" aria-label="Columbus REALTORS - opens in new tab">
          <img src="/media/compliance/columbus-realtors.svg" alt="Columbus REALTORS®" height="45" width="120" loading="lazy">
        </a>
        <a href="https://www.ohiorealtors.org/" target="_blank" rel="noopener noreferrer" title="Ohio REALTORS®" aria-label="Ohio REALTORS - opens in new tab">
          <img src="/media/compliance/ohio-realtors.svg" alt="Ohio REALTORS®" height="45" width="120" loading="lazy">
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
        TD Realty Ohio, LLC | Broker: Travis Debnam | Broker License #2023006467 | Brokerage License #2023006602
      </div>
    </div>
  </footer>
  <script src="/assets/js/nav.js"></script>
  <script src="/assets/js/main.js"></script>
</body>
</html>`;
}

async function main() {
  const args = process.argv.slice(2);
  const scaffoldAll = args.includes('--all');
  const indexArg = args.indexOf('--index');
  const targetIndex = indexArg >= 0 ? parseInt(args[indexArg + 1], 10) : 0;

  let briefs;
  try {
    const data = JSON.parse(await readFile(BRIEFS_PATH, 'utf-8'));
    briefs = data.briefs || data;
  } catch (e) {
    console.error(`Could not read briefs from ${BRIEFS_PATH}: ${e.message}`);
    console.log('Run "node scripts/blog-brief-generator.mjs" first to generate briefs.');
    process.exit(1);
  }

  if (!Array.isArray(briefs) || briefs.length === 0) {
    console.log('No briefs found to scaffold.');
    return;
  }

  const toScaffold = scaffoldAll ? briefs : [briefs[targetIndex]];

  for (const brief of toScaffold) {
    if (!brief) continue;
    const slug = slugify(brief.title);
    const postDir = join(ROOT, 'blog', slug);

    if (existsSync(join(postDir, 'index.html'))) {
      console.log(`  SKIP: /blog/${slug}/ (already exists)`);
      continue;
    }

    await mkdir(postDir, { recursive: true });
    await writeFile(join(postDir, 'index.html'), generatePostHtml(brief));
    console.log(`  Created: /blog/${slug}/`);
    console.log(`    Target: ${brief.keyword} | ${brief.targetWordCount || 1500} words | Score: ${brief.score?.toFixed(2) || 'N/A'}`);
  }

  console.log('\nDone. Fill in TODO placeholders with content, then run:');
  console.log('  node scripts/generate-sitemap.mjs');
  console.log('  node scripts/generate-sitemap-page.mjs');
}

main().catch(console.error);
