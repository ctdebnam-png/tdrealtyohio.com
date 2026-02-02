"""Site-wide optimization engine driven by GSC performance data.

Reads GSC reports, identifies underperforming pages, and applies targeted
optimizations across all page types: core, area, blog, compare, and landing pages.

Unlike autofix.py (which applies static structural fixes), the optimizer uses
live GSC metrics to prioritize and target specific pages that need attention.

Usage:
    python -m gsc.optimizer                    # full optimization pass
    python -m gsc.optimizer --dry-run          # preview changes
    python -m gsc.optimizer --strategy <name>  # run specific strategy
"""

import argparse
import json
import re
from datetime import date, datetime
from pathlib import Path

SITE_ROOT = Path(".")
SITE_URL = "https://tdrealtyohio.com"
OUTPUT_DIR = Path("output/gsc-reports")

# ── Complete site inventory ──────────────────────────────────────────

SITE_SECTIONS = {
    "core": [
        "sellers", "buyers", "1-percent-commission", "pre-listing-inspection",
        "home-value", "affordability", "sell-and-buy", "sell-only-2-percent",
        "about", "contact", "agents", "testimonials", "faq", "referrals",
        "privacy", "terms", "fair-housing",
    ],
    "areas": [],   # populated dynamically from filesystem
    "blog": [],    # populated dynamically from filesystem
    "compare": [], # populated dynamically from filesystem
    "landing": ["lp/buy-home-columbus", "lp/sell-home-columbus",
                "lp/sell-home-westerville"],
    "hub": ["areas", "blog", "compare", "sitemap-page"],
}


class OptimizationResult:
    """Track all optimizations applied in a run."""

    def __init__(self):
        self.actions = []

    def add(self, page: str, strategy: str, action: str, detail: str):
        self.actions.append({
            "page": page,
            "strategy": strategy,
            "action": action,
            "detail": detail,
        })
        print(f"  [{strategy}] {page}: {action} — {detail}")

    def summary(self) -> dict:
        by_strategy = {}
        for a in self.actions:
            by_strategy.setdefault(a["strategy"], []).append(a)
        return {
            "total_actions": len(self.actions),
            "by_strategy": {k: len(v) for k, v in by_strategy.items()},
            "details": self.actions,
        }


# ── Site discovery ───────────────────────────────────────────────────

def discover_all_pages() -> list[dict]:
    """Discover every page on the site with its path and category."""
    pages = []

    # Homepage
    root = SITE_ROOT / "index.html"
    if root.exists():
        pages.append({"path": "/", "file": root, "category": "homepage",
                       "slug": "homepage"})

    # Core pages
    for slug in SITE_SECTIONS["core"]:
        f = SITE_ROOT / slug / "index.html"
        if f.exists():
            pages.append({"path": f"/{slug}/", "file": f,
                          "category": "core", "slug": slug})

    # Area pages (dynamic)
    areas_dir = SITE_ROOT / "areas"
    if areas_dir.exists():
        for area in sorted(areas_dir.iterdir()):
            idx = area / "index.html"
            if area.is_dir() and idx.exists():
                pages.append({"path": f"/areas/{area.name}/", "file": idx,
                              "category": "area", "slug": area.name})

    # Area hub
    area_hub = SITE_ROOT / "areas" / "index.html"
    if area_hub.exists():
        pages.append({"path": "/areas/", "file": area_hub,
                       "category": "hub", "slug": "areas"})

    # Blog posts (dynamic)
    blog_dir = SITE_ROOT / "blog"
    if blog_dir.exists():
        for post in sorted(blog_dir.iterdir()):
            idx = post / "index.html"
            if post.is_dir() and idx.exists():
                pages.append({"path": f"/blog/{post.name}/", "file": idx,
                              "category": "blog", "slug": post.name})
        blog_hub = blog_dir / "index.html"
        if blog_hub.exists():
            pages.append({"path": "/blog/", "file": blog_hub,
                           "category": "hub", "slug": "blog"})

    # Compare pages (dynamic)
    compare_dir = SITE_ROOT / "compare"
    if compare_dir.exists():
        for comp in sorted(compare_dir.iterdir()):
            idx = comp / "index.html"
            if comp.is_dir() and idx.exists():
                pages.append({"path": f"/compare/{comp.name}/", "file": idx,
                              "category": "compare", "slug": comp.name})
        compare_hub = compare_dir / "index.html"
        if compare_hub.exists():
            pages.append({"path": "/compare/", "file": compare_hub,
                           "category": "hub", "slug": "compare"})

    # Landing pages
    for lp_path in SITE_SECTIONS["landing"]:
        f = SITE_ROOT / lp_path / "index.html"
        if f.exists():
            pages.append({"path": f"/{lp_path}/", "file": f,
                          "category": "landing", "slug": lp_path})

    # Sitemap page
    sp = SITE_ROOT / "sitemap-page" / "index.html"
    if sp.exists():
        pages.append({"path": "/sitemap-page/", "file": sp,
                       "category": "hub", "slug": "sitemap-page"})

    return pages


def load_gsc_data() -> dict:
    """Load the latest GSC performance data if available.

    Returns dict mapping URL -> {clicks, impressions, ctr, position}.
    """
    # Try feedback_latest.json first (has page-level GSC data)
    feedback_file = OUTPUT_DIR / "feedback_latest.json"
    if feedback_file.exists():
        try:
            data = json.loads(feedback_file.read_text())
            return {p["url"]: p.get("gsc", {}) for p in data.get("pages", [])}
        except (json.JSONDecodeError, KeyError):
            pass

    # Try performance report
    perf_files = sorted(OUTPUT_DIR.glob("performance_*.json"), reverse=True)
    for pf in perf_files:
        if "latest" in pf.name:
            continue
        try:
            data = json.loads(pf.read_text())
            pages = data.get("pages", [])
            return {p["page"]: p for p in pages}
        except (json.JSONDecodeError, KeyError):
            continue

    return {}


# ── Strategy 1: Title tag optimization ───────────────────────────────

def strategy_title_optimization(pages: list[dict], gsc: dict,
                                 dry_run: bool, result: OptimizationResult):
    """Optimize title tags for pages with impressions but low CTR.

    If GSC shows a page gets impressions but <2% CTR, the title/description
    may not be compelling enough.
    """
    print("\n=== Strategy: Title Tag Optimization ===")

    for page in pages:
        url = f"{SITE_URL}{page['path']}"
        metrics = gsc.get(url, {})
        impressions = metrics.get("impressions", 0)
        ctr = metrics.get("ctr", 0)

        # Only optimize pages with meaningful impressions but low CTR
        if impressions < 50 or ctr >= 0.02:
            continue

        html = page["file"].read_text()

        # Check if title could be improved
        title_match = re.search(r"<title>([^<]+)</title>", html, re.I)
        if not title_match:
            continue

        title = title_match.group(1)
        improvements = []

        # Title length check (optimal: 50-60 chars)
        if len(title) > 65:
            improvements.append("title too long (truncated in SERP)")
        elif len(title) < 30:
            improvements.append("title too short (wasting SERP space)")

        # Check for action words
        action_words = ["save", "free", "get", "find", "compare", "how"]
        if not any(w in title.lower() for w in action_words):
            improvements.append("missing action/benefit word in title")

        # Check meta description
        desc_match = re.search(
            r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']',
            html, re.I)
        if desc_match:
            desc = desc_match.group(1)
            if len(desc) > 160:
                improvements.append("meta description too long")
            elif len(desc) < 100:
                improvements.append("meta description too short")
        else:
            improvements.append("missing meta description")

        if improvements:
            result.add(
                page["path"], "title_optimization", "audit_flag",
                f"CTR={ctr:.1%} on {impressions} impressions. Issues: "
                + "; ".join(improvements)
            )


# ── Strategy 2: Thin content detection ───────────────────────────────

def strategy_thin_content(pages: list[dict], gsc: dict,
                          dry_run: bool, result: OptimizationResult):
    """Identify pages with thin content that may hurt indexing."""
    print("\n=== Strategy: Thin Content Detection ===")

    for page in pages:
        html = page["file"].read_text()
        # Strip HTML tags to get text content
        text = re.sub(r"<script[^>]*>.*?</script>", "", html,
                       flags=re.DOTALL | re.I)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text,
                       flags=re.DOTALL | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        words = text.split()
        word_count = len(words)

        # Thresholds by category
        min_words = {
            "core": 300, "area": 400, "blog": 600,
            "compare": 500, "landing": 200, "hub": 100, "homepage": 200,
        }
        threshold = min_words.get(page["category"], 300)

        if word_count < threshold:
            url = f"{SITE_URL}{page['path']}"
            metrics = gsc.get(url, {})
            impressions = metrics.get("impressions", 0)

            result.add(
                page["path"], "thin_content", "needs_content",
                f"{word_count} words (minimum: {threshold}). "
                f"Impressions: {impressions}"
            )


# ── Strategy 3: Missing structured data ──────────────────────────────

def strategy_structured_data(pages: list[dict], gsc: dict,
                              dry_run: bool, result: OptimizationResult):
    """Ensure all pages have appropriate structured data."""
    print("\n=== Strategy: Structured Data Audit ===")

    for page in pages:
        html = page["file"].read_text()
        has_breadcrumb = "BreadcrumbList" in html
        has_org = "RealEstateAgent" in html or "Organization" in html
        has_faq = "FAQPage" in html
        has_article = "Article" in html or "BlogPosting" in html
        issues = []

        if not has_breadcrumb and page["category"] not in ("homepage",):
            issues.append("missing BreadcrumbList schema")

        if not has_org and page["category"] in ("core", "area", "landing"):
            issues.append("missing RealEstateAgent/Organization schema")

        if page["category"] == "blog" and not has_article:
            issues.append("missing Article/BlogPosting schema")

        if page["category"] == "area" and not has_faq:
            issues.append("missing FAQPage schema (needed for differentiation)")

        if page["category"] == "compare" and not has_faq:
            issues.append("missing FAQPage schema (good for comparison pages)")

        if issues:
            result.add(
                page["path"], "structured_data", "missing_schema",
                "; ".join(issues)
            )


# ── Strategy 4: Add FAQPage schema to pages that lack it ────────────

def strategy_add_faq_schema(pages: list[dict], gsc: dict,
                             dry_run: bool, result: OptimizationResult):
    """Add FAQPage structured data to compare and core pages that have
    question-like content but no FAQ schema."""
    print("\n=== Strategy: Add FAQ Schema ===")

    for page in pages:
        if page["category"] not in ("compare", "core"):
            continue

        html = page["file"].read_text()
        if "FAQPage" in html:
            continue

        # Look for FAQ-like content (h2/h3 with question marks)
        questions = re.findall(
            r"<h[23][^>]*>\s*([^<]*\?)\s*</h[23]>", html, re.I)
        if len(questions) < 2:
            continue

        # Extract Q&A pairs
        faq_items = []
        for q in questions[:5]:
            q_clean = q.strip()
            # Try to find the answer (next paragraph after the heading)
            pattern = re.escape(q_clean) + r"</h[23]>\s*<p[^>]*>([^<]+)</p>"
            ans_match = re.search(pattern, html, re.I)
            if ans_match:
                faq_items.append({
                    "q": q_clean,
                    "a": ans_match.group(1).strip()
                })

        if len(faq_items) < 2:
            continue

        # Build FAQ schema
        faq_entries = []
        for item in faq_items:
            # Escape quotes for JSON
            q_esc = item["q"].replace('"', '\\"')
            a_esc = item["a"].replace('"', '\\"')
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

        # Insert before </head>
        if "</head>" in html:
            html = html.replace("</head>", faq_schema + "</head>", 1)
            result.add(
                page["path"], "add_faq_schema", "schema_added",
                f"Added FAQPage schema with {len(faq_items)} Q&As"
            )
            if not dry_run:
                page["file"].write_text(html)


# ── Strategy 5: Canonical and meta consistency ───────────────────────

def strategy_canonical_audit(pages: list[dict], gsc: dict,
                              dry_run: bool, result: OptimizationResult):
    """Ensure all pages have correct canonical URLs and consistent meta."""
    print("\n=== Strategy: Canonical & Meta Audit ===")

    for page in pages:
        html = page["file"].read_text()
        issues = []
        expected_url = f"{SITE_URL}{page['path']}"

        # Check canonical
        canon = re.search(
            r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']',
            html, re.I)
        if not canon:
            issues.append("missing canonical tag")
        elif canon.group(1) != expected_url:
            issues.append(f"canonical mismatch: {canon.group(1)} != {expected_url}")

        # Check OG tags
        og_url = re.search(
            r'<meta\s+property=["\']og:url["\']\s+content=["\']([^"\']+)["\']',
            html, re.I)
        if og_url and og_url.group(1) != expected_url:
            issues.append(f"og:url mismatch")

        # Check for noindex (should never be present on production pages)
        if re.search(r'<meta\s+name=["\']robots["\']\s+content=["\'][^"\']*noindex',
                      html, re.I):
            issues.append("has noindex directive!")

        # Check article:modified_time
        if not re.search(r'article:modified_time', html, re.I):
            issues.append("missing article:modified_time")

        if issues:
            result.add(
                page["path"], "canonical_audit", "meta_issue",
                "; ".join(issues)
            )


# ── Strategy 6: Internal linking completeness ────────────────────────

def strategy_internal_linking(pages: list[dict], gsc: dict,
                               dry_run: bool, result: OptimizationResult):
    """Analyze internal linking and flag orphaned or underlinked pages."""
    print("\n=== Strategy: Internal Linking Analysis ===")

    # Build link graph
    inbound_count = {}
    outbound_count = {}
    for page in pages:
        html = page["file"].read_text()
        links = set(re.findall(r'href=["\'](/[^"\'#?]*)["\']', html))
        outbound_count[page["path"]] = len(links)
        for link in links:
            norm = link.rstrip("/") + "/"
            inbound_count[norm] = inbound_count.get(norm, 0) + 1

    # Flag pages with very few inbound links
    for page in pages:
        path = page["path"]
        inbound = inbound_count.get(path, 0)
        outbound = outbound_count.get(path, 0)

        # Homepage and privacy/terms don't need many inbound
        if page["slug"] in ("homepage", "privacy", "terms", "fair-housing"):
            continue

        if inbound < 3 and page["category"] in ("core", "area", "compare"):
            url = f"{SITE_URL}{path}"
            metrics = gsc.get(url, {})
            result.add(
                path, "internal_linking", "underlinked",
                f"Only {inbound} inbound links, {outbound} outbound. "
                f"Impressions: {metrics.get('impressions', 0)}"
            )

        if outbound < 3 and page["category"] not in ("hub",):
            result.add(
                path, "internal_linking", "low_outbound",
                f"Only {outbound} outbound links — adding more would spread link equity"
            )


# ── Strategy 7: Competitor keyword gaps ──────────────────────────────

def strategy_keyword_gaps(pages: list[dict], gsc: dict,
                           dry_run: bool, result: OptimizationResult):
    """Identify high-value keywords the site should target but doesn't.

    Uses GSC query data to find queries with impressions but no clicks,
    or queries where position could improve with on-page optimization.
    """
    print("\n=== Strategy: Keyword Gap Analysis ===")

    # Load query data from performance report
    perf_files = sorted(OUTPUT_DIR.glob("performance_*.json"), reverse=True)
    queries = []
    for pf in perf_files:
        if "latest" in pf.name:
            continue
        try:
            data = json.loads(pf.read_text())
            queries = data.get("top_queries", [])
            break
        except (json.JSONDecodeError, KeyError):
            continue

    if not queries:
        print("  No query data available. Run GSC reports first.")
        return

    # Find high-impression, low-position queries (opportunity keywords)
    for q in queries:
        query_text = q.get("query", "")
        impressions = q.get("impressions", 0)
        position = q.get("position", 0)
        clicks = q.get("clicks", 0)

        # High impressions + poor position = opportunity
        if impressions > 20 and position > 10:
            result.add(
                "site-wide", "keyword_gaps", "opportunity_keyword",
                f'"{query_text}" — {impressions} impressions, '
                f'position {position:.0f}, {clicks} clicks. '
                f'Improve on-page targeting to move to page 1.'
            )
        # Page 1 but low CTR = title/description issue
        elif impressions > 30 and position <= 10 and clicks == 0:
            result.add(
                "site-wide", "keyword_gaps", "low_ctr_keyword",
                f'"{query_text}" — position {position:.0f} with '
                f'{impressions} impressions but 0 clicks. '
                f'Title/description may not match search intent.'
            )


# ── Strategy 8: Landing page optimization ────────────────────────────

def strategy_landing_pages(pages: list[dict], gsc: dict,
                            dry_run: bool, result: OptimizationResult):
    """Ensure landing pages have proper SEO signals and schema."""
    print("\n=== Strategy: Landing Page Optimization ===")

    for page in pages:
        if page["category"] != "landing":
            continue

        html = page["file"].read_text()
        issues = []

        # Landing pages need canonical pointing to themselves (not the main page)
        canon = re.search(
            r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']',
            html, re.I)
        if not canon:
            issues.append("missing canonical tag")

        # Should have noindex if they're paid landing pages,
        # or full SEO if they're organic landing pages
        has_noindex = bool(re.search(r'noindex', html, re.I))

        # Check for conversion elements
        has_form = bool(re.search(r'<form', html, re.I))
        has_cta = bool(re.search(
            r'(contact|call|schedule|get started|free|submit)',
            html, re.I))
        has_phone = bool(re.search(r'614.*392.*8858', html))

        if not has_form and not has_cta:
            issues.append("no form or CTA found")
        if not has_phone:
            issues.append("phone number not prominent")

        # Check for schema
        if "RealEstateAgent" not in html and "LocalBusiness" not in html:
            issues.append("missing business schema")

        if issues:
            result.add(
                page["path"], "landing_pages", "optimization_needed",
                "; ".join(issues)
            )


# ── Write optimization report ────────────────────────────────────────

def write_optimization_report(result: OptimizationResult, dry_run: bool):
    """Write detailed optimization report."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = result.summary()
    summary["dry_run"] = dry_run
    summary["generated"] = datetime.utcnow().isoformat()

    json_path = OUTPUT_DIR / f"optimizer_{date.today().isoformat()}.json"
    json_path.write_text(json.dumps(summary, indent=2, default=str))

    md = [f"# Site Optimization Report — {date.today().isoformat()}"]
    if dry_run:
        md.append("\n**DRY RUN** — no files were modified.\n")
    md.append(f"\n**Total actions:** {summary['total_actions']}\n")

    if summary["by_strategy"]:
        md.append("## Strategy Summary\n")
        md.append("| Strategy | Actions |")
        md.append("|----------|---------|")
        for strat, count in summary["by_strategy"].items():
            md.append(f"| {strat} | {count} |")

    # Group by page
    by_page = {}
    for action in summary["details"]:
        by_page.setdefault(action["page"], []).append(action)

    md.append("\n## Actions by Page\n")
    for page_path, actions in sorted(by_page.items()):
        md.append(f"\n### {page_path}\n")
        for a in actions:
            md.append(f"- **[{a['strategy']}]** {a['action']}: {a['detail']}")

    md.append(
        "\n---\n*Generated by gsc.optimizer — "
        "couples GSC data with site-wide optimization.*\n"
    )

    md_path = OUTPUT_DIR / f"optimizer_{date.today().isoformat()}.md"
    md_path.write_text("\n".join(md) + "\n")

    # Latest file for consumption
    latest = OUTPUT_DIR / "optimizer_latest.json"
    latest.write_text(json.dumps(summary, indent=2, default=str))

    print(f"\n  -> {json_path}")
    print(f"  -> {md_path}")


# ── Available strategies ─────────────────────────────────────────────

STRATEGIES = {
    "titles": ("Title tag & meta description optimization", strategy_title_optimization),
    "thin_content": ("Thin content detection", strategy_thin_content),
    "structured_data": ("Structured data audit", strategy_structured_data),
    "faq_schema": ("Add FAQ schema where applicable", strategy_add_faq_schema),
    "canonical": ("Canonical & meta consistency", strategy_canonical_audit),
    "linking": ("Internal linking completeness", strategy_internal_linking),
    "keywords": ("Keyword gap analysis from GSC", strategy_keyword_gaps),
    "landing": ("Landing page optimization", strategy_landing_pages),
}


def main():
    parser = argparse.ArgumentParser(
        description="Site-wide optimization engine driven by GSC data"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without writing files")
    parser.add_argument("--strategy",
                        choices=list(STRATEGIES.keys()) + ["all"],
                        default="all",
                        help="Which strategy to run (default: all)")
    args = parser.parse_args()

    print(f"Site-wide optimization — {date.today().isoformat()}")
    if args.dry_run:
        print("DRY RUN — no files will be modified.\n")

    # Discover all pages
    pages = discover_all_pages()
    print(f"Discovered {len(pages)} pages across the site.")

    # Load GSC data
    gsc = load_gsc_data()
    if gsc:
        print(f"Loaded GSC data for {len(gsc)} URLs.")
    else:
        print("No GSC data available — running structural analysis only.")

    result = OptimizationResult()

    strategies = (
        STRATEGIES if args.strategy == "all"
        else {args.strategy: STRATEGIES[args.strategy]}
    )

    for name, (description, func) in strategies.items():
        func(pages, gsc, args.dry_run, result)

    write_optimization_report(result, args.dry_run)

    summary = result.summary()
    print(f"\nDone. {summary['total_actions']} optimization actions identified.")


if __name__ == "__main__":
    main()
