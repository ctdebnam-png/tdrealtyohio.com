#!/usr/bin/env python3
"""
Weekly SEO Audit for TD Realty Ohio
Scans tdrealtyohio.com and provides actionable SEO improvements
"""

import anthropic
import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def fetch_website_pages():
    """Fetch and analyze main pages from tdrealtyohio.com"""
    
    base_url = "https://tdrealtyohio.com"
    pages = [
        {"path": "/", "name": "Homepage"},
        {"path": "/sellers.html", "name": "Sellers Page"},
        {"path": "/buyers.html", "name": "Buyers Page"},
        {"path": "/pre-listing-inspection.html", "name": "Pre-Listing Inspection"},
        {"path": "/about.html", "name": "About Page"},
        {"path": "/contact.html", "name": "Contact Page"}
    ]
    
    page_data = {}
    
    print("🔍 Fetching website pages...")
    
    for page in pages:
        url = base_url + page['path']
        print(f"   Analyzing {page['name']}...")
        
        try:
            response = requests.get(url, timeout=15)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract key SEO elements
            title_tag = soup.find('title')
            meta_desc = soup.find('meta', {'name': 'description'})
            h1_tags = soup.find_all('h1')
            h2_tags = soup.find_all('h2')
            images = soup.find_all('img')
            links = soup.find_all('a')
            
            # Check for schema markup
            schema_scripts = soup.find_all('script', {'type': 'application/ld+json'})
            
            page_data[page['name']] = {
                "url": url,
                "title": title_tag.text.strip() if title_tag else "❌ MISSING",
                "title_length": len(title_tag.text.strip()) if title_tag else 0,
                "meta_description": meta_desc['content'] if meta_desc else "❌ MISSING",
                "meta_desc_length": len(meta_desc['content']) if meta_desc else 0,
                "h1_count": len(h1_tags),
                "h1_text": [h1.get_text().strip() for h1 in h1_tags],
                "h2_count": len(h2_tags),
                "word_count": len(soup.get_text().split()),
                "images_total": len(images),
                "images_without_alt": len([img for img in images if not img.get('alt')]),
                "internal_links": len([link for link in links if 'tdrealtyohio.com' in link.get('href', '') or link.get('href', '').startswith('/')]),
                "external_links": len([link for link in links if link.get('href', '').startswith('http') and 'tdrealtyohio.com' not in link.get('href', '')]),
                "has_schema": len(schema_scripts) > 0,
                "schema_types": [s.get_text()[:50] for s in schema_scripts] if schema_scripts else []
            }
            
        except Exception as e:
            print(f"   ⚠️  Error fetching {page['name']}: {e}")
            page_data[page['name']] = {
                "url": url,
                "error": str(e)
            }
    
    return page_data

def analyze_with_claude(page_data):
    """Use Claude to analyze SEO issues and provide recommendations"""
    
    prompt = f"""You are an SEO expert analyzing tdrealtyohio.com for technical SEO issues.

WEBSITE: TD Realty Ohio (Columbus, Ohio real estate brokerage)
TARGET: Rank #1 for "Columbus 1% commission realtor" and similar local searches
COMPETITION: Need to outrank sellfor1percent.com and similar competitors

PAGE ANALYSIS DATA:
{json.dumps(page_data, indent=2)}

ANALYZE AND PROVIDE:

1. 🚨 CRITICAL ISSUES (fix immediately - these hurt rankings now)
   - Missing or poor meta tags
   - Missing alt text on images
   - Multiple H1 tags or missing H1
   - Missing schema markup
   - Any broken or problematic elements

2. ⚡ QUICK WINS (easy fixes, high impact)
   - Simple improvements that boost rankings fast
   - Low-effort, high-return optimizations

3. 📈 CONTENT OPPORTUNITIES
   - Pages that are too thin (under 300 words)
   - Missing keyword optimization
   - Areas to add more valuable content

4. 🔧 TECHNICAL IMPROVEMENTS
   - Schema markup additions needed
   - Internal linking opportunities
   - Page structure improvements

For EACH issue you identify:
- State the specific page
- Explain the problem clearly
- Provide the EXACT fix with code examples
- Explain the SEO impact

Be specific and actionable. Provide copy-paste ready code fixes.

Format as clean markdown with clear sections."""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return message.content[0].text
        
    except Exception as e:
        print(f"❌ Error analyzing with Claude: {e}")
        return f"Error during analysis: {e}"

def generate_report(page_data, analysis):
    """Generate complete audit report"""
    
    report = f"""# SEO Audit Report - TD Realty Ohio
**Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}  
**Website:** https://tdrealtyohio.com  
**Goal:** Outrank competitors for Columbus 1% commission realtor searches

---

## Executive Summary

This automated audit analyzed {len(page_data)} pages on tdrealtyohio.com.

### Key Metrics:
"""
    
    # Add summary stats
    total_images = sum(p.get('images_total', 0) for p in page_data.values() if 'images_total' in p)
    missing_alt = sum(p.get('images_without_alt', 0) for p in page_data.values() if 'images_without_alt' in p)
    pages_with_schema = sum(1 for p in page_data.values() if p.get('has_schema', False))
    
    report += f"""
- **Pages analyzed:** {len(page_data)}
- **Images without alt text:** {missing_alt} out of {total_images}
- **Pages with schema markup:** {pages_with_schema} out of {len(page_data)}

---

## Detailed Analysis

{analysis}

---

## Page-by-Page Checklist

"""
    
    for page_name, data in page_data.items():
        if 'error' in data:
            report += f"\n### {page_name}\n❌ Error accessing page: {data['error']}\n"
            continue
            
        report += f"""
### {page_name}
**URL:** {data['url']}

- [{'✅' if data.get('title') != '❌ MISSING' else '❌'}] Title tag ({data.get('title_length', 0)} chars) {'✅' if 50 <= data.get('title_length', 0) <= 60 else '⚠️ Length issue'}
- [{'✅' if data.get('meta_description') != '❌ MISSING' else '❌'}] Meta description ({data.get('meta_desc_length', 0)} chars) {'✅' if 120 <= data.get('meta_desc_length', 0) <= 155 else '⚠️ Length issue'}
- [{'✅' if data.get('h1_count') == 1 else '❌'}] H1 tag (found {data.get('h1_count', 0)})
- [{'✅' if data.get('word_count', 0) >= 300 else '⚠️'}] Content length ({data.get('word_count', 0)} words)
- [{'✅' if data.get('images_without_alt', 0) == 0 else '❌'}] Image alt text ({data.get('images_without_alt', 0)} images missing alt)
- [{'✅' if data.get('has_schema') else '❌'}] Schema markup

"""
    
    report += """
---

## Next Steps

1. **Immediate:** Fix all 🚨 Critical Issues
2. **This Week:** Implement ⚡ Quick Wins  
3. **This Month:** Address 📈 Content Opportunities
4. **Ongoing:** Continue 🔧 Technical Improvements

---

## Tracking

Add these items to your project board and track completion.

**Questions?** Contact Travis Debnam at info@tdrealtyohio.com

---

*This report was automatically generated by GitHub Actions. Next audit scheduled for next Friday.*
"""
    
    return report

def main():
    """Run complete SEO audit"""
    
    print("🔍 Starting SEO Audit for tdrealtyohio.com...")
    
    # Fetch and analyze pages
    page_data = fetch_website_pages()
    
    print("\n🤖 Analyzing with Claude AI...")
    analysis = analyze_with_claude(page_data)
    
    print("\n📝 Generating report...")
    report = generate_report(page_data, analysis)
    
    # Save report
    os.makedirs('reports', exist_ok=True)
    
    # Save as latest (for GitHub Issues)
    with open('reports/latest_audit.md', 'w', encoding='utf-8') as f:
        f.write(report)
    
    # Save with date stamp (for historical tracking)
    date_str = datetime.now().strftime('%Y%m%d')
    with open(f'reports/audit_{date_str}.md', 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ Audit complete!")
    print(f"   - reports/latest_audit.md")
    print(f"   - reports/audit_{date_str}.md")
    print("\n📊 Review the report for actionable improvements")

if __name__ == "__main__":
    main()
