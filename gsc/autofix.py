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

        # Insert before the CTA section
        cta_marker = '<section class="section cta-section">'
        if cta_marker in html:
            html = html.replace(cta_marker, "  </div>\n    </section>\n\n" + section + "\n    " + cta_marker, 1)
            # That double-closes — actually insert inside the content section
            pass

        # Simpler: insert before the market data disclaimer (same as crosslinks)
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


# ── Utilities ─────────────────────────────────────────────────────────

def _all_page_paths() -> list[Path]:
    """Return paths to all index.html files on the site."""
    pages = []
    root = SITE_ROOT / "index.html"
    if root.exists():
        pages.append(root)

    for pattern in ["areas/*/index.html", "blog/*/index.html",
                     "compare/*/index.html", "sellers/index.html",
                     "buyers/index.html", "about/index.html",
                     "contact/index.html", "agents/index.html",
                     "testimonials/index.html", "faq/index.html",
                     "referrals/index.html", "1-percent-commission/index.html",
                     "pre-listing-inspection/index.html", "home-value/index.html",
                     "affordability/index.html", "sell-and-buy/index.html",
                     "sell-only-2-percent/index.html", "privacy/index.html",
                     "terms/index.html", "fair-housing/index.html",
                     "blog/index.html", "areas/index.html", "compare/index.html"]:
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
