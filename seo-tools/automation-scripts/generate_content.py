#!/usr/bin/env python3
"""
Weekly Content Generator for TD Realty Ohio
Uses Claude API to generate SEO-optimized blog posts and city pages
"""

import anthropic
import json
import os
from datetime import datetime

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def load_market_data():
    """Load latest market data"""
    try:
        with open('data/market_data.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("⚠️  Market data not found. Run scrape_market.py first.")
        return {}

def generate_blog_post(topic, market_data):
    """Generate SEO-optimized blog post using Claude"""
    
    topic_configs = {
        "market_update": {
            "title": f"Columbus Real Estate Market Update - {datetime.now().strftime('%B %Y')}",
            "keywords": "Columbus real estate market, Columbus home prices, Central Ohio housing market",
            "focus": "Current market conditions with data"
        },
        "savings": {
            "title": "How Much You'll Save with 1% Commission in Columbus",
            "keywords": "1% commission Columbus, save on realtor fees, Columbus discount realtor",
            "focus": "Commission savings calculator and comparisons"
        },
        "guide": {
            "title": "Complete Guide to Selling Your Columbus Home in 2026",
            "keywords": "sell home Columbus Ohio, Columbus home selling tips, selling process",
            "focus": "Step-by-step selling process guide"
        },
        "pre_listing": {
            "title": "Why Columbus Sellers Should Get a Pre-Listing Inspection",
            "keywords": "pre-listing inspection Columbus, home inspection before selling",
            "focus": "Benefits of pre-listing inspections"
        }
    }
    
    config = topic_configs.get(topic, topic_configs["market_update"])
    
    prompt = f"""Write a comprehensive SEO-optimized blog post for TD Realty Ohio's website.

BUSINESS CONTEXT:
- Company: TD Realty Ohio, LLC
- Offer: 1% commission when you buy AND sell with us (2% for sell-only)
- Licensed since 2017, serving Central Ohio
- Broker: Travis Debnam (#2023006467)
- Member: Columbus REALTORS® and NAR

TARGET AUDIENCE: Homeowners in Columbus considering selling their home

BLOG POST DETAILS:
Title: {config['title']}
Target Keywords: {config['keywords']}
Focus: {config['focus']}

CURRENT MARKET DATA:
{json.dumps(market_data, indent=2)}

REQUIREMENTS:
1. Length: 1000-1200 words
2. Use ACTUAL data from the market data provided above
3. Include these sections with H2 headings:
   - Introduction (hook with current market stat)
   - Main content (2-3 H2 sections based on topic)
   - Commission Savings Calculator (show real examples)
   - FAQ section (3-5 Q&As)
   - Conclusion with CTA
4. Natural keyword integration (don't over-optimize)
5. Include specific Columbus neighborhoods and cities
6. Add internal links:
   - Link to /sellers.html when mentioning seller services
   - Link to /buyers.html when mentioning buying
   - Link to /pre-listing-inspection.html when relevant
7. Professional tone but conversational and helpful
8. Use HTML5 semantic tags
9. Add data-updated attribute to article tag

OUTPUT FORMAT:
Provide complete HTML for the article content only (not full page):
- Wrap in <article data-updated="YYYY-MM-DD">
- Use proper heading hierarchy (H2, H3)
- Include id attributes on headings for anchor links
- Well-structured paragraphs and lists

Write the blog post now. Output only the HTML, no preamble."""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return message.content[0].text
        
    except Exception as e:
        print(f"❌ Error generating blog post: {e}")
        return None

def generate_city_page(city, market_data):
    """Generate location-specific landing page"""
    
    city_data = market_data.get('cities', {}).get(city, {})
    median_price = city_data.get('median_price', 350000)
    
    prompt = f"""Create a complete location-specific landing page for TD Realty Ohio.

BUSINESS CONTEXT:
- TD Realty Ohio, LLC - 1% commission brokerage
- 1% when you buy AND sell with us, 2% for sell-only
- Licensed since 2017, serving Central Ohio
- Broker: Travis Debnam (#2023006467)
        - Email: info@tdrealtyohio.com

TARGET LOCATION: {city}, Ohio
MEDIAN HOME PRICE: ${median_price:,}

PAGE PURPOSE: Rank for "{city} real estate agent 1% commission" and similar local searches

REQUIRED CONTENT STRUCTURE:

1. Hero Section:
   - H1: "1% Commission Real Estate Agent in {city}, Ohio"
   - Compelling subheadline about savings
   
2. Why Choose TD Realty for Your {city} Home Sale (H2)
   - 3-4 key benefits specific to {city}
   
3. {city} Real Estate Market Overview (H2)
   - Current median price: ${median_price:,}
   - Market trends
   - Why it's a good time to sell
   
4. Commission Savings Calculator for {city} (H2)
   - Show comparison: traditional 3% vs our 1%
   - Use actual {city} median price
   - Calculate real dollar savings
   
5. Areas We Serve in {city} (H2)
   - List 4-6 neighborhoods/subdivisions in {city}
   
6. Our Full-Service Approach (H2)
   - What's included in our 1% service
   
7. FAQ Section (H2)
   - 3-5 common questions about 1% commission in {city}
   
8. Contact CTA Section
   - Strong call-to-action
   - Email: info@tdrealtyohio.com
   - Link to contact form

TECHNICAL REQUIREMENTS:
- Meta title (in HTML comment): "{city} Real Estate Agent | 1% Commission | TD Realty Ohio"
   - Meta description (in HTML comment): "Sell your {city} home for just 1% commission. Full-service real estate with huge savings. Licensed broker serving {city} since 2017. Contact us via email at info@tdrealtyohio.com"
- Schema markup in <script type="application/ld+json"> for:
  - LocalBusiness
  - Service
  - FAQPage
- Internal links to /sellers.html, /buyers.html, /pre-listing-inspection.html, /contact.html
- Use {city}-specific language throughout

OUTPUT: Complete HTML page structure ready to deploy as {city.lower().replace(' ', '-')}.html

Write it now."""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=6000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return message.content[0].text
        
    except Exception as e:
        print(f"❌ Error generating city page: {e}")
        return None

def main():
    """Generate weekly content"""
    
    print("📝 Starting content generation...")
    
    # Load market data
    market_data = load_market_data()
    if not market_data:
        print("❌ Cannot generate content without market data")
        return
    
    # Create drafts directory
    os.makedirs('drafts', exist_ok=True)
    
    # Generate 2 blog posts per week
    print("\n📄 Generating blog posts...")
    topics = ["market_update", "savings"]
    
    for topic in topics:
        print(f"   Generating {topic} post...")
        content = generate_blog_post(topic, market_data)
        
        if content:
            date_str = datetime.now().strftime('%Y%m%d')
            filename = f"blog_{topic}_{date_str}.html"
            filepath = f'drafts/{filename}'
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"   ✅ Created: {filename}")
        else:
            print(f"   ⚠️  Failed to generate {topic}")
    
    # Generate 1 city page per week (rotate through cities)
    cities = [
        "Westerville", "Dublin", "Gahanna", "New Albany", "Powell",
        "Lewis Center", "Delaware", "Galena", "Sunbury", "Columbus",
        "Blacklick", "Pataskala", "Pickerington", "Hilliard",
        "Upper Arlington", "Worthington", "Clintonville"
    ]
    
    # Use week number to determine which city
    week_num = datetime.now().isocalendar()[1]
    city = cities[week_num % len(cities)]
    
    print(f"\n🏙️  Generating city page for {city}...")
    city_content = generate_city_page(city, market_data)
    
    if city_content:
        filename = f"{city.lower().replace(' ', '-')}.html"
        filepath = f'drafts/{filename}'
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(city_content)
        
        print(f"   ✅ Created: {filename}")
    else:
        print(f"   ⚠️  Failed to generate {city} page")
    
    print("\n✅ Content generation complete!")
    print("\nNext steps:")
    print("1. Review drafts/ folder")
    print("2. Approve content via Pull Request")
    print("3. Deploy to website")

if __name__ == "__main__":
    main()
