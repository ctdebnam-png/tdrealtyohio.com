# Manual Blog Post Generation Prompts

Use these prompts in Claude's web interface if you prefer manual content creation (100% free).

---

## Weekly Blog Post Prompt Template

Copy and paste this into Claude each Monday:

```
I need you to write an SEO-optimized blog post for my real estate website.

BUSINESS INFO:
- Company: TD Realty Ohio, LLC
- Location: Westerville/Columbus, Ohio
- Service: 1% commission when clients buy AND sell with us (2% for sell-only)
- Licensed since 2017
- Broker: Travis Debnam (#2023006467)
- Phone: (614) 956-8656
- Member: Columbus REALTORS® and National Association of REALTORS®

TARGET AUDIENCE: Homeowners in Central Ohio considering selling their home

BLOG POST TOPIC: [Choose one from rotation below]

CURRENT MARKET DATA:
- Columbus median home price: $[current price]
- Inventory: [low/moderate/high]
- Days on market: [number]
- Recent trends: [any notable changes]

REQUIREMENTS:
- 1000-1200 words
- Include H2 and H3 headings
- Target keywords: [relevant keywords for topic]
- Include a commission savings calculator section
- Add FAQ section with 3-5 questions
- Internal links to:
  * /sellers.html (when mentioning seller services)
  * /buyers.html (when mentioning buying)
  * /pre-listing-inspection.html (when relevant)
- End with clear CTA: Call (614) 956-8656 or schedule consultation
- Professional but conversational tone
- Use specific Columbus neighborhoods and cities

OUTPUT FORMAT:
Provide as complete HTML article content (wrapped in <article> tags).

Write the blog post now.
```

---

## Blog Post Topic Rotation

### Week 1: Market Update
**Topic:** "Columbus Real Estate Market Update - [Current Month/Year]"  
**Keywords:** Columbus real estate market, Columbus home prices, Central Ohio housing market  
**Focus:** Current conditions, price trends, inventory levels

### Week 2: Commission Savings
**Topic:** "How Much You'll Save with 1% Commission in Columbus"  
**Keywords:** 1% commission Columbus, save on realtor fees, discount realtor  
**Focus:** Calculator examples, real savings comparisons

### Week 3: Seller Guide
**Topic:** "Complete Guide to Selling Your Columbus Home in 2026"  
**Keywords:** sell home Columbus Ohio, Columbus home selling tips  
**Focus:** Step-by-step process, timeline, what to expect

### Week 4: Pre-Listing Inspection
**Topic:** "Why Columbus Sellers Should Get a Pre-Listing Inspection"  
**Keywords:** pre-listing inspection Columbus, home inspection before selling  
**Focus:** Benefits, ROI, how it helps negotiations

### Week 5: Neighborhood Spotlight
**Topic:** "Selling Your Home in [Westerville/Dublin/etc]: Market Guide"  
**Keywords:** [City] real estate, selling home in [City]  
**Focus:** Local market, schools, recent sales

### Week 6: Pricing Strategy
**Topic:** "How to Price Your Columbus Home to Sell Fast"  
**Keywords:** home pricing strategy Columbus, competitive pricing  
**Focus:** CMA, pricing psychology, market positioning

### Week 7: Home Prep
**Topic:** "Preparing Your Columbus Home for Sale: Worth It or Not?"  
**Keywords:** home staging Columbus, pre-sale improvements  
**Focus:** ROI on improvements, what buyers want

### Week 8: Commission Changes
**Topic:** "Understanding Real Estate Commissions in Columbus After NAR Settlement"  
**Keywords:** real estate commission Columbus 2026, NAR settlement  
**Focus:** Industry changes, what it means for sellers

---

## Quick Prompt for City Landing Pages

Use this when you need a new city page:

```
Create a complete landing page for my real estate business targeting [CITY NAME], Ohio.

BUSINESS: TD Realty Ohio - 1% commission brokerage
CITY: [CITY NAME], Ohio
MEDIAN HOME PRICE: $[price]

Create a page optimized for "[City] real estate agent 1% commission"

INCLUDE:
- H1: "1% Commission Real Estate Agent in [City], Ohio"
- Why choose TD Realty for [City] home sales
- [City] market overview with current data
- Commission savings calculator using [City] median price
- Neighborhoods/areas we serve in [City]
- FAQ section (3-5 questions)
- Contact CTA with phone (614) 956-8656

Add proper meta tags and schema markup in HTML comments.

Output as complete HTML page ready to deploy.
```

---

## Monthly Market Report Prompt

Use on the 1st of each month:

```
Create a comprehensive Columbus real estate market report for [MONTH YEAR].

Include:
- Executive summary of current conditions
- Price trends (median, average, by neighborhood)
- Inventory analysis
- Days on market statistics
- Buyer/seller market assessment
- Predictions for next 30 days
- Impact on sellers (why now is good/bad time to list)
- Our 1% commission advantage in this market

Format as blog post (1200-1500 words) with data visualizations described.
Target keywords: "Columbus real estate market report [Month]"
```

---

## SEO Quick Check Prompt

Use this to manually audit your site:

```
Please visit https://tdrealtyohio.com and analyze it for SEO issues.

Check:
1. Meta titles and descriptions on all pages
2. Image alt text
3. Schema markup
4. Internal linking structure
5. Content quality and length
6. Mobile usability
7. Page speed issues

Provide specific fixes for any problems found.
```

---

## Weekly Workflow (15 minutes)

**Monday Morning:**
1. Open Claude
2. Paste "Weekly Blog Post Prompt" with current week's topic
3. Copy HTML output
4. Save as `blog-[topic]-[date].html`
5. Review for accuracy
6. Upload to website

**First Monday of Month:**
1. Use "Monthly Market Report Prompt"
2. Create comprehensive report
3. Save as featured content

**As Needed:**
1. Use "City Landing Page Prompt" for new locations
2. Cycle through all 17 cities over 17 weeks

---

## Tips for Best Results

1. **Always provide current market data** - Claude needs real numbers
2. **Be specific about your business** - Include license numbers, phone, exact service details
3. **Review and edit** - Claude writes great drafts but you should personalize
4. **Update regularly** - Fresh content is critical for SEO
5. **Track what works** - Note which topics drive traffic

---

## Content Calendar Template

| Week | Blog Topic | City Page | Status |
|------|------------|-----------|--------|
| Jan 13 | Market Update | Westerville | ⏳ Pending |
| Jan 20 | Commission Savings | Dublin | ⏳ Pending |
| Jan 27 | Seller Guide | Gahanna | ⏳ Pending |
| Feb 3 | Pre-Listing | New Albany | ⏳ Pending |

Update this each week to stay organized.

---

## Storage & Organization

Create this folder structure:

```
content-drafts/
├── blog-posts/
│   ├── 2026-01-13-market-update.html
│   ├── 2026-01-20-savings.html
│   └── ...
├── city-pages/
│   ├── westerville.html
│   ├── dublin.html
│   └── ...
└── monthly-reports/
    ├── 2026-01-report.html
    └── ...
```

---

**Cost: $0** (using existing Claude subscription)  
**Time: 15-20 minutes per week**  
**Results: Same as automation, just more hands-on**
