"""Generate blog content using Claude API."""

import logging
from datetime import datetime

import anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, MAX_TOKENS, BROKERAGE, COMMUNITY_DATA
from utils import (
    format_price,
    format_percent,
    community_display_name,
    iso_date,
    month_year,
    week_of_date,
    escape_html,
)

logger = logging.getLogger(__name__)

client = None


def get_client() -> anthropic.Anthropic:
    global client
    if client is None:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return client


def call_claude(prompt: str, system_prompt: str) -> str:
    """Call Claude API and return the text response."""
    c = get_client()
    message = c.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

MARKET_SYSTEM_PROMPT = """\
You are a real estate market analyst writing for TD Realty Ohio, a discount brokerage \
in Central Ohio. Write in a professional but approachable tone. Be specific with \
numbers - always reference the actual data provided. Avoid generic filler phrases. \
Focus on what the data means for real buyers and sellers in this specific community.

Do not make up statistics. Only reference data explicitly provided in the user prompt. \
If data is missing, acknowledge the limitation.

The brokerage's key differentiators:
- 1% listing commission (vs typical 3%) when clients buy and sell
- 2% for sell-only transactions
- Free seller home inspection
- 1% cashback for first-time buyers

Mention these naturally in the CTA section, not throughout the article.

Output ONLY the article body HTML (no <html>, <head>, or <body> tags). Use <h2> for \
major sections and <h3> for subsections. Use <p> tags for paragraphs. Include at least \
one internal link to another tdrealtyohio.com page (e.g. /contact/, /sellers/, \
/sellers/, /areas/). Include at least one external link to a data source.
"""

EVENTS_SYSTEM_PROMPT = """\
You are a local community writer for TD Realty Ohio covering Central Ohio \
neighborhoods. Write warmly about the community - highlight what makes it a great \
place to live. When listing events, be practical (include dates, times, locations \
when available).

Keep the real estate angle subtle - this is community content first, lead generation \
second. One brief mention of TD Realty Ohio at the end is sufficient.

Output ONLY the article body HTML (no <html>, <head>, or <body> tags). Use <h2> for \
major sections. Use <p> tags for paragraphs. Use <ul> for event lists.
"""

RATES_SYSTEM_PROMPT = """\
You are a real estate market analyst writing about mortgage rates for TD Realty Ohio. \
Be factual and helpful. Explain what rate changes mean in practical terms for \
homebuyers in Central Ohio. Do not give financial advice - clearly state that you are \
not a lender.

Output ONLY the article body HTML (no <html>, <head>, or <body> tags). Use <h2> for \
major sections. Use <p> tags for paragraphs.
"""


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

def generate_market_update(community: str, market_data: dict) -> str:
    """Generate a full HTML blog post for a market update."""
    display = market_data.get("display_name", community_display_name(community))
    now = datetime.now()
    date_str = iso_date(now)
    my = month_year(now)

    # Build data summary for the prompt
    data_lines = []
    if market_data.get("median_sale_price") is not None:
        data_lines.append(f"Median Sale Price: {format_price(market_data['median_sale_price'])}")
    if market_data.get("prev_median_sale_price") is not None:
        data_lines.append(f"Previous Period Median: {format_price(market_data['prev_median_sale_price'])}")
    if market_data.get("price_change_pct") is not None:
        data_lines.append(f"Price Change: {format_percent(market_data['price_change_pct'])}")
    if market_data.get("homes_sold") is not None:
        data_lines.append(f"Homes Sold: {market_data['homes_sold']}")
    if market_data.get("prev_homes_sold") is not None:
        data_lines.append(f"Previous Period Homes Sold: {market_data['prev_homes_sold']}")
    if market_data.get("days_on_market") is not None:
        data_lines.append(f"Median Days on Market: {market_data['days_on_market']}")
    if market_data.get("prev_days_on_market") is not None:
        data_lines.append(f"Previous Period DOM: {market_data['prev_days_on_market']}")
    if market_data.get("inventory") is not None:
        data_lines.append(f"Active Inventory: {market_data['inventory']}")
    if market_data.get("prev_inventory") is not None:
        data_lines.append(f"Previous Period Inventory: {market_data['prev_inventory']}")
    if market_data.get("sale_to_list") is not None:
        data_lines.append(f"Sale-to-List Ratio: {market_data['sale_to_list']:.3f}")
    data_lines.append(f"Data as of: {market_data.get('period_end', date_str)}")

    data_block = "\n".join(data_lines)

    school_district = COMMUNITY_DATA.get(community, {}).get("school_district", "")

    prompt = f"""\
Write a market update blog post for {display}, Ohio for {my}.

Here is the current market data:
{data_block}

School district: {school_district}

Requirements:
- Title should be: "{display} Real Estate Market Update - {my}"
- Include a data table with current vs previous period metrics
- Write a buyer analysis section and a seller analysis section
- Include a CTA paragraph mentioning TD Realty Ohio's services
- Minimum 600 words, maximum 1200 words
- Cite Redfin Data Center as the data source
- Include an internal link to /contact/ or /sellers/
"""

    article_body = call_claude(prompt, MARKET_SYSTEM_PROMPT)

    title = f"{display} Real Estate Market Update - {my}"
    description = (
        f"{display} housing market statistics for {my}. "
        f"Median prices, days on market, and what it means for buyers and sellers."
    )
    sources = [
        {"name": "Redfin Data Center", "url": "https://www.redfin.com/news/data-center/"},
        {"name": "Columbus REALTORS", "url": "https://www.columbusrealtors.com/news/market-statistics/"},
    ]

    return _wrap_in_page(
        title=title,
        description=description,
        date_str=date_str,
        article_body=article_body,
        categories=["Market Updates", display],
        sources=sources,
        slug=f"{community}-market-update-{now.strftime('%B-%Y').lower()}",
    )


def generate_events_roundup(community: str, events: list[dict], news: list[dict]) -> str:
    """Generate a weekly events roundup HTML blog post."""
    display = community_display_name(community)
    now = datetime.now()
    date_str = iso_date(now)
    wod = week_of_date(now)

    # Build events list for prompt
    events_text = ""
    if events:
        event_items = []
        for e in events[:15]:
            date_part = ""
            if e.get("published"):
                date_part = f" ({e['published'].strftime('%B %d')})"
            link_part = f" - {e['link']}" if e.get("link") else ""
            event_items.append(f"- {e['title']}{date_part}{link_part}")
        events_text = "\n".join(event_items)
    else:
        events_text = "No specific events found this week."

    news_text = ""
    if news:
        news_items = []
        for n in news[:5]:
            link_part = f" - {n['link']}" if n.get("link") else ""
            news_items.append(f"- {n['title']}{link_part}")
        news_text = "\n".join(news_items)
    else:
        news_text = "No recent community-specific news items found."

    school_district = COMMUNITY_DATA.get(community, {}).get("school_district", "")

    prompt = f"""\
Write a weekly events and community roundup for {display}, Ohio for the week of {wod}.

Events found:
{events_text}

Local news:
{news_text}

School district: {school_district}

Requirements:
- Title: "What's Happening in {display} - Week of {wod}"
- List events with dates and links where available
- Summarize any relevant news
- Include a brief section on why {display} is a great place to live
- Subtle TD Realty Ohio mention at the end only
- Include an internal link to /areas/
- Minimum 600 words
"""

    article_body = call_claude(prompt, EVENTS_SYSTEM_PROMPT)

    title = f"What's Happening in {display} - Week of {wod}"
    description = f"Upcoming events, community news, and things to do in {display}, Ohio this week."

    source_urls = set()
    for e in events + news:
        if e.get("source"):
            source_urls.add(e["source"])

    sources = [{"name": "Local RSS feeds", "url": url} for url in list(source_urls)[:5]]

    return _wrap_in_page(
        title=title,
        description=description,
        date_str=date_str,
        article_body=article_body,
        categories=["Community", display],
        sources=sources,
        slug=f"{community}-events-{now.strftime('%Y-%m-%d')}",
    )


def generate_rate_update(rate_data: dict) -> str:
    """Generate a mortgage rate update HTML blog post."""
    now = datetime.now()
    date_str = iso_date(now)

    direction = rate_data.get("rate_direction", "Current")
    rate_30 = rate_data.get("rate_30yr", 0)
    prev_rate = rate_data.get("prev_rate_30yr")
    wow = rate_data.get("wow_change")

    prompt = f"""\
Write a mortgage rate update blog post for Central Ohio homebuyers.

Current data:
- 30-Year Fixed Rate: {rate_30}%
- Previous Week Rate: {prev_rate}% (if available)
- Week-over-Week Change: {wow} percentage points
- Rate Direction: {direction}
- Data Date: {rate_data.get('date', date_str)}

Requirements:
- Title should reflect the rate direction: "{direction} Rates" theme
- Explain what this means for buying power with a concrete example
  (e.g., monthly payment on a $300,000 home)
- Include a "Should You Wait or Buy Now?" section
- Mention TD Realty Ohio can connect buyers with trusted local lenders
- Clearly state TD Realty Ohio is NOT a mortgage lender
- Include a link to /buyers/ or /contact/
- Minimum 600 words
- Cite Freddie Mac Primary Mortgage Market Survey
"""

    article_body = call_claude(prompt, RATES_SYSTEM_PROMPT)

    headline = f"What {direction} Rates Mean for Central Ohio Homebuyers"
    title = f"Mortgage Rates Update: {headline}"
    description = f"Current mortgage rates and how they affect buying power in Columbus and Central Ohio."

    sources = [
        {"name": "Freddie Mac Primary Mortgage Market Survey", "url": "https://www.freddiemac.com/pmms"},
        {"name": "Federal Reserve Economic Data (FRED)", "url": "https://fred.stlouisfed.org/series/MORTGAGE30US"},
    ]

    return _wrap_in_page(
        title=title,
        description=description,
        date_str=date_str,
        article_body=article_body,
        categories=["Market Updates", "Buying Tips"],
        sources=sources,
        slug=f"mortgage-rates-update-{now.strftime('%Y-%m-%d')}",
    )


# ---------------------------------------------------------------------------
# HTML page wrapper
# ---------------------------------------------------------------------------

def _wrap_in_page(
    title: str,
    description: str,
    date_str: str,
    article_body: str,
    categories: list[str],
    sources: list[dict],
    slug: str,
) -> str:
    """Wrap article body in a full HTML page matching site structure."""
    esc_title = escape_html(title)
    esc_desc = escape_html(description)
    canonical = f"https://tdrealtyohio.com/blog/{slug}/"
    keywords = ", ".join(categories + ["Central Ohio real estate"])

    sources_html = ""
    if sources:
        items = "\n".join(
            f'            <li><a href="{s["url"]}" target="_blank" rel="noopener noreferrer">{escape_html(s["name"])}</a> (accessed {date_str})</li>'
            for s in sources
        )
        sources_html = f"""
          <h2>Sources</h2>
          <ul>
{items}
          </ul>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc_title} | TD Realty Ohio</title>
  <meta name="description" content="{esc_desc}">
  <meta name="keywords" content="{escape_html(keywords)}">

  <link rel="canonical" href="{canonical}">

  <meta property="og:type" content="article">
  <meta property="og:title" content="{esc_title}">
  <meta property="og:description" content="{esc_desc}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="article:published_time" content="{date_str}">
  <meta property="article:author" content="{BROKERAGE['broker']}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc_title}">
  <meta name="twitter:description" content="{esc_desc}">
  <meta name="twitter:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">

  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#1a2e44">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="preload" href="/assets/css/styles.css" as="style">
  <link rel="preload" href="/assets/js/main.js" as="script">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17866418952"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'AW-17866418952');
  </script>

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "{esc_title}",
    "description": "{esc_desc}",
    "image": "https://tdrealtyohio.com/assets/images/og-default.jpg",
    "author": {{
      "@type": "Person",
      "name": "{BROKERAGE['broker']}",
      "jobTitle": "Broker",
      "worksFor": {{
        "@type": "RealEstateAgent",
        "name": "{BROKERAGE['name']}"
      }}
    }},
    "publisher": {{
      "@type": "Organization",
      "name": "{BROKERAGE['name']}",
      "url": "{BROKERAGE['website']}"
    }},
    "datePublished": "{date_str}",
    "dateModified": "{date_str}",
    "mainEntityOfPage": {{
      "@type": "WebPage",
      "@id": "{canonical}"
    }}
  }}
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
        <a href="/sellers/" class="nav-link">Sellers</a>
        <a href="/1-percent-commission/" class="nav-link">1% Listing</a>
        <div class="nav-dropdown" id="nav-buyers"><button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-controls="buyers-dropdown-menu">Buyers <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="nav-dropdown-menu" id="buyers-dropdown-menu"><a href="/buyers/" class="nav-link">Buy a Home</a><a href="/buy/cash-back/" class="nav-link">1% Cash Back (First-Time Buyers)</a></div></div>
        <a href="/sellers/" class="nav-link">Seller Preparation</a>
        <a href="/home-value/" class="nav-link">Home Value</a>
        <a href="/affordability/" class="nav-link">Affordability</a>
        <a href="/areas/" class="nav-link">Areas</a>
        <a href="/blog/" class="nav-link">Blog</a>
        <a href="/about/" class="nav-link">About</a>
        <a href="/contact/" class="btn btn-primary nav-cta">Contact</a>
      </nav>

      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
          <li aria-current="page">{esc_title}</li>
        </ol>
      </div>
    </nav>

    <article class="section">
      <div class="container" style="max-width: 800px;">
        <header class="article-header">
          <h1>{esc_title}</h1>
          <p class="post-meta">By {BROKERAGE['broker']} | {date_str}</p>
        </header>

        <div class="article-content">
{article_body}
{sources_html}
        </div>
      </div>
    </article>

    <section class="section cta-section">
      <div class="container">
        <h2>Questions About Central Ohio Real Estate?</h2>
        <p>Free consultation. No obligation. Get personalized advice for your situation.</p>
        <div class="hero-buttons flex-center">
          <a href="/contact/" class="btn btn-primary btn-lg">Get in Touch</a>
          <a href="tel:{BROKERAGE['phone'].replace('(', '').replace(') ', '').replace('-', '')}" class="btn btn-outline-white btn-lg">{BROKERAGE['phone']}</a>
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
          <ul class="footer-links">
            <li><a href="/sellers/">For Sellers</a></li>
            <li><a href="/buyers/">For Buyers</a></li>
            <li><a href="/sellers/">Seller Preparation</a></li>
            <li><a href="/areas/">Service Areas</a></li>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <a href="tel:6143928858">{BROKERAGE['phone']}</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <a href="mailto:{BROKERAGE['email']}">{BROKERAGE['email']}</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>Westerville, Ohio</span>
          </div>
        </div>
      </div>

      <div class="footer-compliance-logos">
        <a href="https://www.hud.gov/program_offices/fair_housing_equal_opp" target="_blank" rel="noopener noreferrer" title="Equal Housing Opportunity" aria-label="Equal Housing Opportunity - opens in new tab">
          <img src="/media/compliance/equal-housing.svg" alt="Equal Housing Opportunity" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.nar.realtor/" target="_blank" rel="noopener noreferrer" title="National Association of REALTORS" aria-label="National Association of REALTORS - opens in new tab">
          <img src="/media/compliance/realtor.svg" alt="REALTOR" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.columbusrealtors.com/" target="_blank" rel="noopener noreferrer" title="Columbus REALTORS" aria-label="Columbus REALTORS - opens in new tab">
          <img src="/media/compliance/columbus-realtors.svg" alt="Columbus REALTORS" height="45" width="120" loading="lazy">
        </a>
        <a href="https://www.ohiorealtors.org/" target="_blank" rel="noopener noreferrer" title="Ohio REALTORS" aria-label="Ohio REALTORS - opens in new tab">
          <img src="/media/compliance/ohio-realtors.svg" alt="Ohio REALTORS" height="45" width="120" loading="lazy">
        </a>
      </div>

      <div class="footer-bottom">
        <div class="footer-legal">
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Service</a>
          <a href="/fair-housing/">Fair Housing</a>
        </div>
      </div>

      <div class="footer-license">
        {BROKERAGE['name']} | Broker: {BROKERAGE['broker']} | Broker License #{BROKERAGE['license_broker']} | Brokerage License #{BROKERAGE['license_brokerage']}<br>
      </div>
    </div>
  </footer>

  <script src="/assets/js/main.js"></script>
</body>
</html>
"""
