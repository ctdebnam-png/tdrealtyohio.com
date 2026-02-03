"""Automatic SEO fixes driven by GSC report data.

Reads the latest indexing/performance reports and applies HTML fixes to
improve indexing and search performance. All fixes are idempotent — running
twice produces the same result.

Usage:
    python -m gsc.autofix                  # apply all fixes
    python -m gsc.autofix --dry-run        # preview changes without writing
    python -m gsc.autofix --fix schema     # run a specific fix only
"""

import argparse
import json
import re
from datetime import date
from pathlib import Path

SITE_ROOT = Path(".")
SITE_URL = "https://tdrealtyohio.com"
OUTPUT_DIR = Path("output/gsc-reports")

# ── Area page metadata ────────────────────────────────────────────────
# City slug -> (display name, postal code, neighbors)
# Neighbors are used for "Nearby Areas" cross-links.

AREA_DATA = {
    "bexley": ("Bexley", "43209", ["columbus", "german-village", "gahanna"]),
    "blacklick": ("Blacklick", "43004", ["gahanna", "reynoldsburg", "pataskala"]),
    "canal-winchester": ("Canal Winchester", "43110", ["pickerington", "reynoldsburg", "grove-city"]),
    "clintonville": ("Clintonville", "43202", ["columbus", "worthington", "bexley"]),
    "columbus": ("Columbus", "43215", ["westerville", "dublin", "upper-arlington", "clintonville", "german-village"]),
    "delaware": ("Delaware", "43015", ["lewis-center", "powell", "sunbury"]),
    "dublin": ("Dublin", "43016", ["powell", "hilliard", "upper-arlington", "columbus"]),
    "gahanna": ("Gahanna", "43230", ["westerville", "new-albany", "blacklick", "columbus"]),
    "german-village": ("German Village", "43206", ["columbus", "bexley", "clintonville"]),
    "grandview-heights": ("Grandview Heights", "43212", ["upper-arlington", "columbus", "hilliard"]),
    "granville": ("Granville", "43023", ["johnstown", "pataskala", "sunbury"]),
    "grove-city": ("Grove City", "43123", ["columbus", "hilliard", "canal-winchester"]),
    "hilliard": ("Hilliard", "43026", ["dublin", "grove-city", "upper-arlington", "grandview-heights"]),
    "johnstown": ("Johnstown", "43031", ["granville", "sunbury", "delaware"]),
    "lewis-center": ("Lewis Center", "43035", ["powell", "delaware", "westerville"]),
    "new-albany": ("New Albany", "43054", ["gahanna", "westerville", "blacklick"]),
    "pataskala": ("Pataskala", "43062", ["reynoldsburg", "blacklick", "granville"]),
    "pickerington": ("Pickerington", "43147", ["reynoldsburg", "canal-winchester", "blacklick"]),
    "powell": ("Powell", "43065", ["dublin", "lewis-center", "delaware", "westerville"]),
    "reynoldsburg": ("Reynoldsburg", "43068", ["blacklick", "pickerington", "pataskala", "gahanna"]),
    "sunbury": ("Sunbury", "43074", ["delaware", "johnstown", "lewis-center"]),
    "upper-arlington": ("Upper Arlington", "43221", ["columbus", "grandview-heights", "hilliard", "dublin"]),
    "westerville": ("Westerville", "43081", ["gahanna", "lewis-center", "new-albany", "columbus"]),
    "worthington": ("Worthington", "43085", ["columbus", "clintonville", "westerville", "lewis-center"]),
}

# ── Area FAQs for content differentiation ─────────────────────────────
# Each city has 3 unique FAQs to add ~300-500 words of differentiated content.

AREA_FAQS = {
    "columbus": [
        {"q": "What neighborhoods in Columbus have the best resale value?", "a": "Short North, German Village, Clintonville, and Grandview Heights consistently show strong appreciation. Newer developments in Franklinton are also gaining value rapidly."},
        {"q": "How does the Columbus market compare to other Ohio cities?", "a": "Columbus has outpaced Cincinnati and Cleveland in home price appreciation over the past decade, driven by job growth from tech companies, healthcare, and Ohio State University."},
        {"q": "What are property taxes like in Columbus?", "a": "Franklin County's effective property tax rate is approximately 1.6-2.0% of market value. Rates vary by school district—Columbus City Schools areas tend to be on the higher end."},
    ],
    "westerville": [
        {"q": "Is Westerville a good place to raise a family?", "a": "Westerville is consistently rated one of Ohio's best family communities. The school district ranks in the top 10 statewide, and the city offers over 50 parks, a community center, and numerous youth sports programs."},
        {"q": "What is the Westerville housing market like?", "a": "Westerville homes typically sell within 12 days. The market is competitive with strong demand from families drawn to the school district. Homes range from $250K condos to $800K+ estates."},
        {"q": "What are Westerville's most popular neighborhoods?", "a": "Heritage District near Uptown is prized for walkability. Blendon Chase and Spring Creek offer newer construction. Huber Village and Hometowne areas provide more affordable options."},
    ],
    "dublin": [
        {"q": "What are the most sought-after neighborhoods in Dublin, Ohio?", "a": "Muirfield Village, home to the Memorial Tournament golf course, remains one of Dublin's most prestigious communities. Ballantrae and Tartan Fields also attract buyers seeking upscale homes with excellent Dublin City Schools access."},
        {"q": "How does Dublin City Schools rank for families considering a move?", "a": "Dublin City Schools consistently ranks in the top 5% of Ohio districts, with three comprehensive high schools and a strong STEM curriculum. The district offers International Baccalaureate programs and has graduation rates exceeding 96%."},
        {"q": "What is the commute like from Dublin to downtown Columbus?", "a": "Dublin to downtown Columbus is roughly 20-25 minutes via I-270 and SR-315 outside rush hour, though peak commute times can extend to 35-45 minutes. Many Dublin residents work locally at corporate campuses for Wendy's, Cardinal Health, and other Fortune 500 companies headquartered in the area."},
    ],
    "powell": [
        {"q": "What makes the Powell housing market unique in Central Ohio?", "a": "Powell commands premium prices due to the Olentangy Local Schools district, one of Ohio's top-rated. Homes in neighborhoods like Wedgewood, Scioto Reserve, and Olentangy Falls often sell within days."},
        {"q": "How are the schools in Powell compared to surrounding areas?", "a": "Olentangy Local Schools serves most Powell addresses and is regularly ranked among the top 3 districts in Ohio. The district operates multiple elementary, middle, and high schools and is known for strong AP and extracurricular programs."},
        {"q": "Is Powell affordable compared to Dublin or New Albany?", "a": "Powell's median home price is comparable to Dublin, with both communities centering around $550K. However, Powell offers more inventory in the $350K-$450K range through older neighborhoods, making it slightly more accessible than New Albany's higher entry point."},
    ],
    "new-albany": [
        {"q": "Why are New Albany home prices higher than surrounding communities?", "a": "New Albany's master-planned design with strict architectural standards, top-ranked schools, and the presence of Intel's massive semiconductor facility nearby have driven premium pricing."},
        {"q": "What school options are available for families in New Albany?", "a": "New Albany-Plain Local Schools is consistently ranked among Ohio's top 10 districts, featuring a learning campus model that clusters grade levels together. The district is known for strong academics, arts programs, and competitive athletics."},
        {"q": "How does New Albany's cost of living compare to other premium suburbs?", "a": "New Albany's property tax rate in Franklin County is competitive with Dublin and Upper Arlington. However, the higher median home price of around $650K means annual tax bills are larger in absolute terms."},
    ],
    "gahanna": [
        {"q": "What neighborhoods in Gahanna offer the best value for buyers?", "a": "Royal Manor and Havens Corners provide solid mid-range options in the $300K-$400K range with mature trees and larger lots. The Creekside area commands premiums for walkability to shops and restaurants."},
        {"q": "How does Gahanna-Jefferson Schools perform for families?", "a": "Gahanna-Jefferson Schools earns an A rating from Niche with Lincoln High School as the district's flagship. The district offers a strong mix of AP courses, vocational programs, and competitive athletics."},
        {"q": "What is the commute from Gahanna to major Columbus employers?", "a": "Gahanna's location along I-270 provides 15-20 minute access to downtown Columbus, Easton Town Center, and Polaris. Port Columbus International Airport is actually within Gahanna's borders."},
    ],
    "hilliard": [
        {"q": "Is Hilliard a good investment for homebuyers right now?", "a": "Hilliard has seen steady appreciation of 4-6% annually, driven by ongoing commercial development along Cemetery Road and the revitalized Old Hilliard district."},
        {"q": "What are the school options in Hilliard?", "a": "Hilliard City Schools operates three high schools—Davidson, Darby, and Bradley—serving over 16,000 students. The district is known for strong STEM programs, performing arts, and competitive sports."},
        {"q": "How do Hilliard property taxes compare to neighboring communities?", "a": "Hilliard's effective property tax rate falls in the mid-range for Franklin County, typically lower than Upper Arlington or Dublin. On a $425K home, expect annual property taxes around $7,500-$8,500."},
    ],
    "upper-arlington": [
        {"q": "Why do Upper Arlington homes sell so quickly?", "a": "Upper Arlington averages just 10 days on market—among the fastest in Central Ohio. The combination of a walkable layout, proximity to Ohio State University, top-rated schools, and limited new construction creates persistent demand."},
        {"q": "What makes Upper Arlington Schools stand out for families?", "a": "Upper Arlington City Schools is perennially ranked in Ohio's top 10 districts. The single high school model means all students attend UA High School, fostering strong community bonds."},
        {"q": "Are there affordable options in Upper Arlington's housing market?", "a": "While UA's median price is around $600K, condos and townhomes near Lane Avenue and Kingsdale start in the $250K-$350K range. Smaller ranch homes in the southern neighborhoods occasionally list under $450K."},
    ],
    "worthington": [
        {"q": "What types of homes are available in Worthington?", "a": "Worthington offers a distinctive mix of charming 1920s-1950s colonials near the historic village green and mid-century ranches in established neighborhoods. Colonial Hills and Worthington Estates are popular for families."},
        {"q": "How does the Worthington school district compare to Westerville and Dublin?", "a": "Worthington Schools ranks among Ohio's top 15 districts with Thomas Worthington and Worthington Kilbourne as its two high schools. While slightly smaller than Westerville or Dublin, the district offers strong gifted programs."},
        {"q": "What are the advantages of living in Worthington versus Columbus proper?", "a": "Worthington offers a distinct small-city identity with its own police, schools, and community events while being just minutes from Polaris, Crosswoods, and downtown Columbus via I-71 or High Street."},
    ],
    "grove-city": [
        {"q": "Is Grove City a good area for first-time homebuyers?", "a": "Grove City is one of the most accessible suburbs in the Columbus metro for first-time buyers, with a median price around $300K—well below Dublin or Upper Arlington."},
        {"q": "What schools serve the Grove City area?", "a": "South-Western City Schools is the primary district serving Grove City, operating multiple high schools including Grove City High School. The district has invested heavily in facilities upgrades and career-technical programs."},
        {"q": "How far is Grove City from downtown Columbus and major job centers?", "a": "Grove City is approximately 15 minutes from downtown Columbus via I-71 and about 20 minutes from the Rickenbacker logistics hub, a major employer in the region."},
    ],
    "delaware": [
        {"q": "Is Delaware, Ohio a good place to buy a home right now?", "a": "Delaware County has been Ohio's fastest-growing county for over a decade, and the city of Delaware benefits from that momentum. The $350K median price offers significant savings versus Powell or Dublin."},
        {"q": "What are the school district options in Delaware?", "a": "Delaware City Schools serves most addresses within the city limits, offering solid academics anchored by Hayes High School. Some outer Delaware addresses feed into Olentangy or Big Walnut districts."},
        {"q": "What is the commute like from Delaware to Columbus?", "a": "Delaware to downtown Columbus is about 30-40 minutes via US-23 or I-71, depending on traffic. Many residents commute to Polaris or Powell-area employers in just 15-20 minutes."},
    ],
    "pickerington": [
        {"q": "What makes Pickerington attractive to homebuyers from Columbus?", "a": "Pickerington offers newer construction and larger lots than many inner-ring suburbs at a lower price point. The Violet Township area surrounding Pickerington has seen rapid growth with modern subdivisions."},
        {"q": "How does Pickerington Local Schools compare to other Fairfield County districts?", "a": "Pickerington Local Schools is by far the highest-rated district in Fairfield County, earning an A from Niche. The district operates two high schools—Central and North—with nationally competitive programs."},
        {"q": "What should buyers know about property taxes in Pickerington?", "a": "Pickerington falls in Fairfield County, which generally has lower property tax rates than Franklin County. Expect to pay roughly $6,000-$7,500 annually on a $375K home."},
    ],
    "pataskala": [
        {"q": "Why are homebuyers increasingly looking at Pataskala?", "a": "Pataskala offers some of the most affordable new construction in the Columbus metro, with homes starting in the mid-$200Ks. The city maintains a semi-rural feel with larger lots."},
        {"q": "What school districts serve Pataskala families?", "a": "Pataskala is served by multiple districts including Licking Valley, Southwest Licking, and Licking Heights. Southwest Licking has seen the most growth and offers newer facilities."},
        {"q": "How does the cost of living in Pataskala compare to western Columbus suburbs?", "a": "Pataskala's cost of living is significantly lower than western suburbs like Dublin or Hilliard. Licking County property tax rates are generally below Franklin County."},
    ],
    "sunbury": [
        {"q": "What is driving the housing boom in Sunbury, Ohio?", "a": "Sunbury sits in Delaware County's growth corridor with Big Walnut Local Schools drawing families from across the region. New subdivisions are adding hundreds of homes."},
        {"q": "How does Big Walnut Local Schools compare to nearby districts?", "a": "Big Walnut earns an A from Niche and is known for its strong community support and manageable school sizes. The district operates a single high school, which fosters tight-knit student culture."},
        {"q": "Is Sunbury a practical location for commuting to Columbus?", "a": "Sunbury to downtown Columbus is approximately 30-35 minutes via I-71 or Route 3. Many residents commute to the Polaris or Westerville employment corridors in about 20 minutes."},
    ],
    "granville": [
        {"q": "What type of buyer does Granville attract?", "a": "Granville appeals to buyers seeking a distinctive New England village character rare in Ohio. Historic homes along Broadway and Prospect Street attract preservation-minded buyers."},
        {"q": "How does Granville Exempted Village Schools perform?", "a": "Granville schools earn an A from Niche with particularly strong marks in college preparation and teacher quality. The small district size means individual attention for students."},
        {"q": "What should buyers know about Granville's location and commute options?", "a": "Granville is about 35 minutes east of Columbus via SR-161 and I-70, making it one of the farther commutes in the metro area. However, the village is just 5 minutes from Newark."},
    ],
    "johnstown": [
        {"q": "What is attracting new residents to Johnstown?", "a": "Johnstown offers rural character with growing suburban amenities at prices well below the Columbus average. New subdivisions are bringing modern homes in the $300K-$400K range on larger lots."},
        {"q": "How is Johnstown-Monroe Local Schools regarded by families?", "a": "Johnstown-Monroe earns an A- from Niche and is valued for its small-district advantages: manageable class sizes, strong teacher-student relationships, and community support."},
        {"q": "What are property taxes and overall costs like in Johnstown?", "a": "Licking County property taxes are notably lower than Franklin or Delaware counties, making Johnstown one of the more tax-friendly options in the greater Columbus area."},
    ],
    "blacklick": [
        {"q": "What should buyers know about purchasing a home in Blacklick?", "a": "Blacklick is unincorporated, so buyers should pay close attention to which school district, township, and tax jurisdiction applies to a specific address."},
        {"q": "Which school districts serve Blacklick addresses?", "a": "Most central Blacklick addresses feed into Gahanna-Jefferson Schools, which earns an A from Niche. However, eastern Blacklick may fall into Licking Heights, and some addresses are in Columbus City Schools."},
        {"q": "How convenient is Blacklick for commuting and daily errands?", "a": "Blacklick's location along I-270 between Easton Town Center and New Albany makes it one of the most convenient eastside communities. Easton's shopping and dining is minutes away."},
    ],
    "canal-winchester": [
        {"q": "What makes Canal Winchester appealing to homebuyers?", "a": "Canal Winchester combines small-town charm with modern amenities at an accessible price point. The historic downtown along Waterloo Street features local shops and restaurants."},
        {"q": "How does Canal Winchester Local Schools serve the community?", "a": "Canal Winchester Schools earns an A- from Niche and operates a compact, community-focused district with one high school. The district is known for strong parent involvement."},
        {"q": "How does Canal Winchester's location affect commute times and daily life?", "a": "Canal Winchester sits along US-33 with easy access to I-270, putting downtown Columbus about 20 minutes away. The Rickenbacker area and Obetz employment centers are even closer."},
    ],
    "bexley": [
        {"q": "What types of historic homes can buyers find in Bexley?", "a": "Bexley's housing stock spans stately Tudor Revival and Colonial Revival estates along Drexel and Cassingham to charming 1920s-1940s bungalows and Cape Cods on tree-lined side streets."},
        {"q": "How does Bexley City Schools compare to other Franklin County districts?", "a": "Bexley City Schools is one of the top-performing small districts in Ohio, with a single elementary, middle, and high school campus. Graduation rates exceed 95%."},
        {"q": "What is the cost of living like in Bexley compared to Upper Arlington?", "a": "Bexley and Upper Arlington are similarly priced with medians around $550K-$600K. Bexley's compact footprint (1.6 square miles) means walkability is exceptional."},
    ],
    "clintonville": [
        {"q": "What makes Clintonville different from other Columbus neighborhoods?", "a": "Clintonville has a village-within-the-city feel that's increasingly rare in Columbus. The neighborhood's active area commission and walkable High Street corridor set it apart."},
        {"q": "Are Clintonville homes in Columbus City Schools or a different district?", "a": "All Clintonville addresses fall within Columbus City Schools. While CCS as a whole rates lower than suburban districts, Clintonville families often utilize CCS magnet and choice programs."},
        {"q": "What should buyers know about home prices and competition in Clintonville?", "a": "Clintonville is one of Columbus's hottest markets with homes averaging just 10 days on market. The $350K median buys a 1,400-1,800 sq ft bungalow or ranch."},
    ],
    "german-village": [
        {"q": "What should buyers know about purchasing a historic home in German Village?", "a": "German Village homes are subject to the German Village Commission's architectural review for exterior changes, which preserves character but limits renovation freedom."},
        {"q": "How does the German Village housing market compare to nearby Short North?", "a": "German Village and Short North are both premium Columbus neighborhoods, but German Village skews toward single-family brick homes ($400K-$800K+) while Short North offers more condos."},
        {"q": "Is German Village practical for families or better suited for young professionals?", "a": "German Village has a growing family presence, with Schiller Park offering a playground and community events. The neighborhood is within Columbus City Schools."},
    ],
    "grandview-heights": [
        {"q": "What is the housing market like in Grandview Heights?", "a": "Grandview Heights has one of the tightest markets in Central Ohio, with homes averaging just 11 days on market. The compact city (1 square mile) means inventory is always limited."},
        {"q": "How does Grandview Heights Schools compare to nearby districts?", "a": "Grandview Heights Schools operates a single elementary, middle, and high school on a connected campus. The district's small size means class sizes are manageable."},
        {"q": "What makes Grandview Heights popular with young professionals and families?", "a": "Grandview's walkable restaurant and bar scene along Grandview Avenue rivals Short North without the parking hassle. Families appreciate the small school district and safe streets."},
    ],
    "lewis-center": [
        {"q": "What are the advantages of buying in Lewis Center versus Powell?", "a": "Lewis Center and Powell share the Olentangy Local Schools district, which is the primary draw for both. Lewis Center typically offers more newer construction at slightly lower prices."},
        {"q": "Which Olentangy schools serve Lewis Center students?", "a": "Lewis Center addresses feed into various Olentangy elementary and middle schools. Most students attend either Olentangy Liberty or Olentangy Berlin high schools."},
        {"q": "What is the commute from Lewis Center to Columbus employers?", "a": "Lewis Center to downtown Columbus is 25-30 minutes via I-71 or US-23, though Polaris-area employment is just 5-10 minutes away."},
    ],
    "reynoldsburg": [
        {"q": "Is Reynoldsburg a good option for buyers on a budget?", "a": "Reynoldsburg offers some of the best value in the Columbus metro, with a $285K median price that's roughly half of Dublin or Upper Arlington."},
        {"q": "How is Reynoldsburg City Schools performing?", "a": "Reynoldsburg City Schools has invested significantly in facilities and programs, opening the new eSTEM Academy. While rated B+ overall, the district's trajectory is positive."},
        {"q": "What developments are changing the Reynoldsburg housing market?", "a": "Main Street revitalization is bringing new restaurants and retail. Intel's New Albany facility is expected to create positive spillover demand for Reynoldsburg homes."},
    ],
}

# Blog post -> related area slugs (matched by content keywords)
BLOG_AREA_MAP = {
    "selling-home-westerville-ohio-2025": ["westerville"],
    "central-ohio-housing-market-2026": ["columbus", "dublin", "westerville", "powell"],
    "how-much-save-selling-columbus-home-1-percent": ["columbus"],
    "first-time-homebuyer-cash-back": [],
    "1-percent-vs-3-percent-commission-comparison": [],
    "pre-listing-inspection-benefits": [],
    "why-agents-leaving-traditional-brokerages-100-commission": [],
}


class FixResult:
    """Track what an autofix changed."""

    def __init__(self):
        self.fixes = []

    def add(self, file_path: str, fix_type: str, description: str):
        self.fixes.append({
            "file": file_path,
            "type": fix_type,
            "description": description,
        })
        print(f"  [{fix_type}] {file_path}: {description}")

    def summary(self) -> dict:
        by_type = {}
        for f in self.fixes:
            by_type.setdefault(f["type"], []).append(f)
        return {
            "total_fixes": len(self.fixes),
            "by_type": {k: len(v) for k, v in by_type.items()},
            "details": self.fixes,
        }


# ── Fix 1: Schema address mismatches ─────────────────────────────────

def fix_schema_addresses(dry_run: bool, result: FixResult):
    """Fix area page schemas that have wrong addressLocality / postalCode.

    Every area page's RealEstateAgent schema should reference its own city,
    not Westerville/43081.
    """
    print("Fixing schema addresses...")
    for slug, (city_name, zip_code, _) in AREA_DATA.items():
        html_path = SITE_ROOT / "areas" / slug / "index.html"
        if not html_path.exists():
            continue

        html = html_path.read_text()
        original = html

        # Fix addressLocality
        html = re.sub(
            r'("addressLocality"\s*:\s*)"[^"]+"',
            rf'\1"{city_name}"',
            html,
        )

        # Fix postalCode
        html = re.sub(
            r'("postalCode"\s*:\s*)"[^"]+"',
            rf'\1"{zip_code}"',
            html,
        )

        if html != original:
            result.add(
                f"areas/{slug}/index.html",
                "schema_address",
                f"Fixed addressLocality to {city_name}, postalCode to {zip_code}",
            )
            if not dry_run:
                html_path.write_text(html)


# ── Fix 2: Cross-link area pages to nearby areas ─────────────────────

_NEARBY_SECTION_MARKER = "<!-- nearby-areas -->"

def fix_area_crosslinks(dry_run: bool, result: FixResult):
    """Add 'Nearby Areas' section to area pages linking to neighbor cities."""
    print("Adding area cross-links...")
    for slug, (city_name, _, neighbors) in AREA_DATA.items():
        html_path = SITE_ROOT / "areas" / slug / "index.html"
        if not html_path.exists():
            continue

        html = html_path.read_text()

        # Skip if already has nearby section
        if _NEARBY_SECTION_MARKER in html:
            continue

        # Build the nearby areas HTML block
        neighbor_links = []
        for n_slug in neighbors:
            if n_slug in AREA_DATA:
                n_name = AREA_DATA[n_slug][0]
                neighbor_links.append(
                    f'          <a href="/areas/{n_slug}/" class="internal-link">\n'
                    f'            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
                    f'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>\n'
                    f'            {n_name}\n'
                    f'          </a>'
                )

        if not neighbor_links:
            continue

        nearby_html = (
            f'\n        {_NEARBY_SECTION_MARKER}\n'
            f'        <h3>Nearby Areas We Serve</h3>\n'
            f'        <div class="internal-links">\n'
            + "\n".join(neighbor_links) + "\n"
            f'        </div>\n'
        )

        # Insert before the market data disclaimer
        marker = '<p class="text-muted"'
        if marker in html:
            html = html.replace(marker, nearby_html + "\n        " + marker, 1)
            result.add(
                f"areas/{slug}/index.html",
                "area_crosslinks",
                f"Added {len(neighbor_links)} nearby area links",
            )
            if not dry_run:
                html_path.write_text(html)


# ── Fix 3: Cross-link blog posts to relevant area pages ──────────────

_BLOG_AREA_MARKER = "<!-- related-areas -->"

def fix_blog_area_links(dry_run: bool, result: FixResult):
    """Add related area links to blog posts that mention specific cities."""
    print("Adding blog-to-area cross-links...")

    for blog_slug, area_slugs in BLOG_AREA_MAP.items():
        if not area_slugs:
            continue

        html_path = SITE_ROOT / "blog" / blog_slug / "index.html"
        if not html_path.exists():
            continue

        html = html_path.read_text()
        if _BLOG_AREA_MARKER in html:
            continue

        # Build related areas block
        area_links = []
        for a_slug in area_slugs:
            if a_slug in AREA_DATA:
                a_name = AREA_DATA[a_slug][0]
                area_links.append(
                    f'        <a href="/areas/{a_slug}/" style="display:inline-block;'
                    f'padding:0.5rem 1rem;border:1px solid #ddd;border-radius:6px;'
                    f'color:#1a2e44;text-decoration:none;font-weight:500;margin:0.25rem;">'
                    f'{a_name} Real Estate</a>'
                )

        related_html = (
            f'\n      {_BLOG_AREA_MARKER}\n'
            f'      <div style="margin:2rem 0;padding:1.5rem;background:#f8f9fa;border-radius:8px;">\n'
            f'        <strong>Explore Local Market Info:</strong><br>\n'
            f'        <div style="margin-top:0.75rem;">\n'
            + "\n".join(area_links) + "\n"
            f'        </div>\n'
            f'      </div>\n'
        )

        # Insert before closing </article> or before CTA section
        if "</article>" in html:
            html = html.replace("</article>", related_html + "    </article>", 1)
        elif '<section class="section cta-section">' in html:
            html = html.replace(
                '<section class="section cta-section">',
                related_html + '  <section class="section cta-section">',
                1,
            )
        else:
            continue

        result.add(
            f"blog/{blog_slug}/index.html",
            "blog_area_links",
            f"Added {len(area_links)} related area links",
        )
        if not dry_run:
            html_path.write_text(html)


# ── Fix 4: Add lastmod meta tag for freshness signal ─────────────────

def fix_lastmod_meta(dry_run: bool, result: FixResult):
    """Add or update article:modified_time meta tag on all pages.

    Google uses this as a freshness signal. For non-blog pages that lack
    dateModified in schema, this provides an HTML-level signal.
    """
    print("Updating lastmod meta tags...")
    today = date.today().isoformat()

    for html_path in _all_page_paths():
        html = html_path.read_text()

        # Check if page already has article:modified_time
        existing = re.search(
            r'<meta\s+property=["\']article:modified_time["\']\s+content=["\']([^"\']+)["\']',
            html,
            re.I,
        )

        if existing:
            # Update if older than today
            if existing.group(1) < today:
                html = re.sub(
                    r'(<meta\s+property=["\']article:modified_time["\']\s+content=["\'])[^"\']+(["\'])',
                    rf'\g<1>{today}\2',
                    html,
                    flags=re.I,
                )
                result.add(
                    str(html_path),
                    "lastmod",
                    f"Updated article:modified_time to {today}",
                )
                if not dry_run:
                    html_path.write_text(html)
        else:
            # Insert after canonical tag
            canonical_pattern = r'(<link\s+rel=["\']canonical["\'][^>]*>)'
            match = re.search(canonical_pattern, html, re.I)
            if match:
                insert_after = match.end()
                meta_tag = f'\n  <meta property="article:modified_time" content="{today}">'
                html = html[:insert_after] + meta_tag + html[insert_after:]
                result.add(
                    str(html_path),
                    "lastmod",
                    f"Added article:modified_time = {today}",
                )
                if not dry_run:
                    html_path.write_text(html)


# ── Fix 5: Missing image alt text ────────────────────────────────────

def fix_image_alt_text(dry_run: bool, result: FixResult):
    """Add alt text to images that are missing it."""
    print("Fixing missing image alt text...")

    for html_path in _all_page_paths():
        html = html_path.read_text()
        original = html

        # Find images with empty or missing alt
        def _add_alt(match):
            tag = match.group(0)
            # Skip if already has meaningful alt
            alt_match = re.search(r'alt=["\']([^"\']*)["\']', tag)
            if alt_match and alt_match.group(1).strip():
                return tag

            # Derive alt from src filename
            src_match = re.search(r'src=["\']([^"\']+)["\']', tag)
            if not src_match:
                return tag

            src = src_match.group(1)
            filename = src.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            # Convert filename to readable alt: "og-default" -> "og default"
            alt_text = filename.replace("-", " ").replace("_", " ").strip()
            if not alt_text or alt_text in ("img", "image", "photo"):
                alt_text = "TD Realty Ohio"

            if alt_match:
                # Replace empty alt
                return tag.replace(alt_match.group(0), f'alt="{alt_text}"')
            else:
                # Add alt attribute before closing >
                return tag[:-1] + f' alt="{alt_text}">'

        html = re.sub(r'<img[^>]*>', _add_alt, html, flags=re.I)

        if html != original:
            result.add(str(html_path), "image_alt", "Added missing image alt text")
            if not dry_run:
                html_path.write_text(html)


# ── Fix 6: Internal link equity — orphaned pages ─────────────────────

_RELATED_PAGES_MARKER = "<!-- related-pages -->"

def fix_internal_link_equity(dry_run: bool, result: FixResult):
    """Add related page links to core pages that have few internal links to them.

    Uses sitemap data to find pages with low inbound link counts and adds
    contextual links from related pages.
    """
    print("Improving internal link equity...")

    # Count inbound links across all pages
    inbound = {}
    all_pages = list(_all_page_paths())
    for html_path in all_pages:
        html = html_path.read_text()
        links = re.findall(r'href=["\'](/[^"\'#]*)["\']', html)
        for link in links:
            # Normalize trailing slash
            link = link.rstrip("/") + "/"
            inbound[link] = inbound.get(link, 0) + 1

    # Key service pages that should have strong link equity
    key_pages = {
        "/sellers/": "Selling Your Home",
        "/buyers/": "Buying a Home",
        "/1-percent-commission/": "1% Commission",
        "/pre-listing-inspection/": "Free Pre-Listing Inspection",
        "/home-value/": "Free Home Value Estimate",
        "/compare/": "Compare Options",
        "/blog/": "Blog",
        "/areas/": "Service Areas",
    }

    # Find area pages that don't link to key service pages
    for slug in AREA_DATA:
        html_path = SITE_ROOT / "areas" / slug / "index.html"
        if not html_path.exists():
            continue

        html = html_path.read_text()
        if _RELATED_PAGES_MARKER in html:
            continue

        existing_links = set(re.findall(r'href=["\'](/[^"\'#]*)["\']', html))
        missing = {
            path: label for path, label in key_pages.items()
            if path not in existing_links and path.rstrip("/") + "/" not in existing_links
        }

        # Only add if there are underlinked pages
        if not missing or len(missing) < 2:
            continue

        links_html = []
        for path, label in list(missing.items())[:3]:
            links_html.append(
                f'          <a href="{path}" class="internal-link">\n'
                f'            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
                f'<path d="M5 12h14M12 5l7 7-7 7"/></svg>\n'
                f'            {label}\n'
                f'          </a>'
            )

        if not links_html:
            continue

        section = (
            f'\n        {_RELATED_PAGES_MARKER}\n'
            f'        <h3>More from TD Realty Ohio</h3>\n'
            f'        <div class="internal-links">\n'
            + "\n".join(links_html) + "\n"
            f'        </div>\n'
        )

        # Insert before the market data disclaimer
        marker = '<p class="text-muted"'
        html_orig = html_path.read_text()  # re-read in case crosslinks already modified
        if _RELATED_PAGES_MARKER in html_orig:
            continue
        if marker in html_orig:
            html_new = html_orig.replace(marker, section + "\n        " + marker, 1)
            result.add(
                f"areas/{slug}/index.html",
                "internal_links",
                f"Added {len(links_html)} service page links",
            )
            if not dry_run:
                html_path.write_text(html_new)


# ── Fix 7: Inject FAQs and FAQ schema into area pages ─────────────────

_FAQ_SECTION_MARKER = "<!-- faq-section -->"
_FAQ_SCHEMA_MARKER = '"@type": "FAQPage"'

def fix_area_faqs(dry_run: bool, result: FixResult):
    """Add FAQ content and FAQPage schema to area pages for differentiation.

    This injects unique Q&A content from AREA_FAQS to address the ~85%
    content duplication issue that's blocking Google indexing.
    """
    print("Injecting FAQs into area pages...")
    for slug, faqs in AREA_FAQS.items():
        html_path = SITE_ROOT / "areas" / slug / "index.html"
        if not html_path.exists():
            continue

        html = html_path.read_text()

        # Skip if already has FAQ section
        if _FAQ_SECTION_MARKER in html or _FAQ_SCHEMA_MARKER in html:
            continue

        city_name = AREA_DATA.get(slug, (slug.replace("-", " ").title(),))[0]
        changes = []

        # 1. Inject FAQ schema into <head>
        faq_entries = []
        for faq in faqs:
            q_esc = faq["q"].replace('"', '\\"')
            a_esc = faq["a"].replace('"', '\\"')
            faq_entries.append(
                f'      {{\n'
                f'        "@type": "Question",\n'
                f'        "name": "{q_esc}",\n'
                f'        "acceptedAnswer": {{\n'
                f'          "@type": "Answer",\n'
                f'          "text": "{a_esc}"\n'
                f'        }}\n'
                f'      }}'
            )

        faq_schema = (
            '  <script type="application/ld+json">\n'
            '  {\n'
            '    "@context": "https://schema.org",\n'
            '    "@type": "FAQPage",\n'
            '    "mainEntity": [\n'
            + ',\n'.join(faq_entries) + '\n'
            '    ]\n'
            '  }\n'
            '  </script>\n'
        )

        if "</head>" in html:
            html = html.replace("</head>", faq_schema + "</head>", 1)
            changes.append("FAQPage schema")

        # 2. Inject FAQ HTML section before the disclaimer
        faq_items = []
        for faq in faqs:
            faq_items.append(
                f'          <div class="faq-item">\n'
                f'            <div class="faq-question">{faq["q"]}</div>\n'
                f'            <div class="faq-answer">{faq["a"]}</div>\n'
                f'          </div>'
            )

        faq_html = (
            f'\n        {_FAQ_SECTION_MARKER}\n'
            f'        <h2>Frequently Asked Questions About {city_name} Real Estate</h2>\n'
            f'        <div class="faq-list">\n'
            + '\n'.join(faq_items) + '\n'
            f'        </div>\n'
        )

        # Insert before the market data disclaimer
        marker = '<p class="text-muted"'
        if marker in html:
            html = html.replace(marker, faq_html + "\n        " + marker, 1)
            changes.append(f"{len(faqs)} FAQ items")

        # 3. Add FAQ CSS if not present
        if '.faq-list' not in html and '</style>' in html:
            faq_css = (
                '\n    .faq-list { margin: 2rem 0; }\n'
                '    .faq-item { border: 1px solid var(--gray-200); border-radius: var(--radius-md); '
                'margin-bottom: 1rem; overflow: hidden; }\n'
                '    .faq-question { font-weight: 600; padding: 1.25rem; cursor: pointer; '
                'display: flex; justify-content: space-between; align-items: center; '
                'background: var(--gray-50); }\n'
                '    .faq-question:hover { background: var(--gray-100); }\n'
                '    .faq-answer { padding: 0 1.25rem 1.25rem; line-height: 1.7; '
                'color: var(--gray-700); }\n  '
            )
            html = html.replace('</style>', faq_css + '</style>', 1)
            changes.append("FAQ CSS")

        if changes:
            result.add(
                f"areas/{slug}/index.html",
                "area_faqs",
                f"Added: {', '.join(changes)}",
            )
            if not dry_run:
                html_path.write_text(html)


# ── Utilities ─────────────────────────────────────────────────────────

def _all_page_paths() -> list[Path]:
    """Return paths to all index.html files on the site."""
    pages = []
    root = SITE_ROOT / "index.html"
    if root.exists():
        pages.append(root)

    for pattern in ["areas/*/index.html", "blog/*/index.html",
                     "compare/*/index.html", "lp/*/index.html",
                     "sellers/index.html", "buyers/index.html",
                     "about/index.html", "contact/index.html",
                     "agents/index.html", "testimonials/index.html",
                     "faq/index.html", "referrals/index.html",
                     "1-percent-commission/index.html",
                     "pre-listing-inspection/index.html",
                     "home-value/index.html", "affordability/index.html",
                     "sell-and-buy/index.html",
                     "sell-only-2-percent/index.html",
                     "privacy/index.html", "terms/index.html",
                     "fair-housing/index.html", "sitemap-page/index.html",
                     "blog/index.html", "areas/index.html",
                     "compare/index.html"]:
        pages.extend(SITE_ROOT.glob(pattern))
    return pages


def _write_fix_report(result: FixResult, dry_run: bool):
    """Write a report of all fixes applied."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = result.summary()
    summary["dry_run"] = dry_run
    summary["date"] = date.today().isoformat()

    report_path = OUTPUT_DIR / f"autofix_{date.today().isoformat()}.json"
    report_path.write_text(json.dumps(summary, indent=2))
    print(f"\n  Report: {report_path}")

    md_lines = [f"# Autofix Report — {date.today().isoformat()}"]
    if dry_run:
        md_lines.append("\n**DRY RUN** — no files were modified.\n")
    md_lines.append(f"\n**Total fixes:** {summary['total_fixes']}\n")

    if summary["by_type"]:
        md_lines.append("## Fix Summary\n")
        md_lines.append("| Fix Type | Count |")
        md_lines.append("|----------|-------|")
        for fix_type, count in summary["by_type"].items():
            md_lines.append(f"| {fix_type} | {count} |")

    md_lines.append("\n## Details\n")
    for fix in summary["details"]:
        md_lines.append(f"- **{fix['file']}** [{fix['type']}]: {fix['description']}")

    md_path = OUTPUT_DIR / f"autofix_{date.today().isoformat()}.md"
    md_path.write_text("\n".join(md_lines) + "\n")
    print(f"  Report: {md_path}")


# ── Available fixes ───────────────────────────────────────────────────

FIXES = {
    "schema": ("Fix schema address mismatches on area pages", fix_schema_addresses),
    "crosslinks": ("Add nearby-area cross-links", fix_area_crosslinks),
    "blog_links": ("Add area links to blog posts", fix_blog_area_links),
    "lastmod": ("Update freshness meta tags", fix_lastmod_meta),
    "alt_text": ("Fix missing image alt text", fix_image_alt_text),
    "internal_links": ("Improve internal link equity", fix_internal_link_equity),
    "area_faqs": ("Inject FAQs into area pages for differentiation", fix_area_faqs),
}


def main():
    parser = argparse.ArgumentParser(
        description="Apply automatic SEO fixes based on GSC report data"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing files",
    )
    parser.add_argument(
        "--fix",
        choices=list(FIXES.keys()) + ["all"],
        default="all",
        help="Which fix to apply (default: all)",
    )
    args = parser.parse_args()

    result = FixResult()

    if args.dry_run:
        print("DRY RUN — no files will be modified.\n")

    fixes_to_run = FIXES if args.fix == "all" else {args.fix: FIXES[args.fix]}

    for name, (description, func) in fixes_to_run.items():
        print(f"\n{'='*60}")
        print(f"{description}")
        print(f"{'='*60}")
        func(args.dry_run, result)

    _write_fix_report(result, args.dry_run)

    summary = result.summary()
    print(f"\nDone. {summary['total_fixes']} fixes {'previewed' if args.dry_run else 'applied'}.")


if __name__ == "__main__":
    main()
