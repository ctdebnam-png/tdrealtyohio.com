"""CLI report generator for Google Search Console data.

Usage:
    python -m gsc.reports --report all --days 28
    python -m gsc.reports --report performance --days 7
    python -m gsc.reports --report indexing
    python -m gsc.reports --report sitemap
"""

import argparse
import json
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path

from .client import GSCClient

OUTPUT_DIR = Path("output/gsc-reports")
SITEMAP_PATH = Path("sitemap.xml")


def _ensure_output_dir():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _write_outputs(name: str, data: dict, markdown: str):
    """Write both JSON and markdown report files."""
    _ensure_output_dir()
    timestamp = date.today().isoformat()
    json_path = OUTPUT_DIR / f"{name}_{timestamp}.json"
    md_path = OUTPUT_DIR / f"{name}_{timestamp}.md"
    json_path.write_text(json.dumps(data, indent=2, default=str))
    md_path.write_text(markdown)
    print(f"  -> {json_path}")
    print(f"  -> {md_path}")

    # Write a latest file for easy programmatic access
    latest_json = OUTPUT_DIR / f"{name}_latest.json"
    latest_json.write_text(json.dumps(data, indent=2, default=str))


def _load_previous_report(name: str) -> dict | None:
    """Load the most recent previous report for diff comparison."""
    latest = OUTPUT_DIR / f"{name}_latest.json"
    if not latest.exists():
        return None
    try:
        return json.loads(latest.read_text())
    except (json.JSONDecodeError, OSError):
        return None


# ── Sitemap URL extraction ────────────────────────────────────────────

def get_sitemap_urls() -> list[str]:
    """Parse sitemap.xml and return all URLs."""
    if not SITEMAP_PATH.exists():
        print("Warning: sitemap.xml not found, using empty URL list")
        return []
    tree = ET.parse(SITEMAP_PATH)
    root = tree.getroot()
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [loc.text for loc in root.findall(".//s:loc", ns) if loc.text]


# ── Local HTML checks ─────────────────────────────────────────────────

def _check_page_html(url: str) -> dict:
    """Check a page's local HTML for SEO issues that block indexing."""
    path = url.replace("https://tdrealtyohio.com", "").strip("/")
    if not path:
        html_path = Path("index.html")
    else:
        html_path = Path(path) / "index.html"

    if not html_path.exists():
        return {"html_exists": False}

    html = html_path.read_text(errors="replace")
    checks = {"html_exists": True}

    # Check for noindex
    checks["has_noindex"] = bool(
        re.search(r'<meta[^>]+noindex', html, re.I)
    )

    # Check canonical tag
    canonical_match = re.search(
        r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']', html, re.I
    )
    if not canonical_match:
        canonical_match = re.search(
            r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']canonical["\']', html, re.I
        )
    checks["canonical"] = canonical_match.group(1) if canonical_match else None
    checks["canonical_mismatch"] = (
        checks["canonical"] is not None and checks["canonical"] != url
    )

    # Check meta description
    checks["has_meta_description"] = bool(
        re.search(r'<meta\s+name=["\']description["\']', html, re.I)
    )

    # Check title tag
    title_match = re.search(r'<title>([^<]+)</title>', html, re.I)
    checks["title"] = title_match.group(1).strip() if title_match else None

    # Check for thin content (strip tags, count words)
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.S | re.I)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.S | re.I)
    text = re.sub(r'<[^>]+>', ' ', text)
    word_count = len(text.split())
    checks["word_count"] = word_count
    checks["thin_content"] = word_count < 300

    return checks


# ── Performance Report ────────────────────────────────────────────────

def _categorize_page(path: str) -> str:
    """Assign a page to a category based on its URL path."""
    if path in ("/", ""):
        return "homepage"
    if path.startswith("/blog/") and path != "/blog/":
        return "blog"
    if path.startswith("/areas/") and path != "/areas/":
        return "area"
    if path.startswith("/compare/") and path != "/compare/":
        return "compare"
    return "core"


def generate_performance_report(client: GSCClient, days: int) -> dict:
    """Generate full-site performance report with per-page query breakdowns."""
    print(f"Generating full-site performance report ({days} days)...")

    sitemap_urls = get_sitemap_urls()
    all_pages = client.top_pages(days=days, limit=500)
    all_queries = client.top_queries(days=days, limit=100)
    daily = client.performance_by_date(days=days)
    devices = client.performance_by_device(days=days)

    totals = {
        "clicks": sum(d["clicks"] for d in daily),
        "impressions": sum(d["impressions"] for d in daily),
    }
    if totals["impressions"] > 0:
        totals["avg_ctr"] = round(totals["clicks"] / totals["impressions"], 4)
    else:
        totals["avg_ctr"] = 0
    if daily:
        totals["avg_position"] = round(
            sum(d["position"] for d in daily) / len(daily), 1
        )
    else:
        totals["avg_position"] = 0

    # Build a lookup of GSC data by URL
    gsc_by_url = {p["page"]: p for p in all_pages}

    # Per-page query breakdowns for every page that has impressions
    page_breakdowns = {}
    pages_with_data = [p for p in all_pages if p["impressions"] > 0]
    for i, p in enumerate(pages_with_data):
        print(f"  Fetching queries for [{i + 1}/{len(pages_with_data)}] {p['page']}")
        try:
            queries = client.page_query_breakdown(p["page"], days=days)
            page_breakdowns[p["page"]] = queries
        except Exception as e:
            print(f"    Error: {e}")
            page_breakdowns[p["page"]] = []

    # Categorize pages
    categories = {}
    for url in sitemap_urls:
        path = url.replace("https://tdrealtyohio.com", "")
        cat = _categorize_page(path)
        if cat not in categories:
            categories[cat] = []
        gsc_data = gsc_by_url.get(url, {
            "page": url, "clicks": 0, "impressions": 0, "ctr": 0, "position": 0,
        })
        categories[cat].append({**gsc_data, "path": path})

    # Pages in GSC but not in sitemap
    sitemap_set = set(sitemap_urls)
    unsitemaped = [p for p in all_pages if p["page"] not in sitemap_set]

    # Zero-impression pages (on sitemap but invisible to Google)
    zero_impression_pages = [
        url for url in sitemap_urls if url not in gsc_by_url or gsc_by_url[url]["impressions"] == 0
    ]

    data = {
        "report": "performance",
        "generated": datetime.utcnow().isoformat(),
        "days": days,
        "totals": totals,
        "devices": devices,
        "sitemap_url_count": len(sitemap_urls),
        "pages_with_impressions": len(pages_with_data),
        "zero_impression_pages": zero_impression_pages,
        "all_pages": all_pages,
        "all_queries": all_queries,
        "daily": daily,
        "categories": {cat: sorted(pages, key=lambda x: x["clicks"], reverse=True)
                       for cat, pages in categories.items()},
        "page_breakdowns": page_breakdowns,
        "unsitemaped_pages": unsitemaped,
    }

    # Build markdown
    md = [f"# GSC Performance Report — {date.today().isoformat()}"]
    md.append(f"\n**Period:** {days} days | **Sitemap URLs:** {len(sitemap_urls)} "
              f"| **With impressions:** {len(pages_with_data)}\n")

    md.append("## Summary\n")
    md.append("| Metric | Value |")
    md.append("|--------|-------|")
    md.append(f"| Total clicks | {totals['clicks']:,} |")
    md.append(f"| Total impressions | {totals['impressions']:,} |")
    md.append(f"| Avg CTR | {totals['avg_ctr']:.2%} |")
    md.append(f"| Avg position | {totals['avg_position']} |")
    md.append(f"| Pages with data | {len(pages_with_data)}/{len(sitemap_urls)} |")

    # Device breakdown
    if devices:
        md.append("\n## Device Breakdown\n")
        md.append("| Device | Clicks | Impressions | CTR | Pos |")
        md.append("|--------|--------|-------------|-----|-----|")
        for d in devices:
            md.append(
                f"| {d['device']} | {d['clicks']} | {d['impressions']} "
                f"| {d['ctr']:.2%} | {d['position']} |"
            )

    # Performance by category
    md.append("\n## Performance by Category\n")
    for cat in ["homepage", "core", "area", "blog", "compare"]:
        pages = categories.get(cat, [])
        if not pages:
            continue
        cat_clicks = sum(p["clicks"] for p in pages)
        cat_impr = sum(p["impressions"] for p in pages)
        md.append(f"### {cat.title()} ({len(pages)} pages — {cat_clicks} clicks, {cat_impr:,} impressions)\n")
        md.append("| Page | Clicks | Impressions | CTR | Pos |")
        md.append("|------|--------|-------------|-----|-----|")
        for p in sorted(pages, key=lambda x: x["clicks"], reverse=True):
            md.append(
                f"| {p['path']} | {p['clicks']} | {p['impressions']} "
                f"| {p['ctr']:.2%} | {p['position']} |"
            )
        md.append("")

    # Top queries site-wide
    md.append("## Top Queries (Site-wide)\n")
    md.append("| Query | Clicks | Impressions | CTR | Pos |")
    md.append("|-------|--------|-------------|-----|-----|")
    for q in all_queries[:50]:
        md.append(
            f"| {q['query']} | {q['clicks']} | {q['impressions']} | {q['ctr']:.2%} | {q['position']} |"
        )

    # Per-page query breakdowns
    if page_breakdowns:
        md.append("\n## Per-Page Query Breakdowns\n")
        for page_url in sorted(page_breakdowns.keys()):
            queries = page_breakdowns[page_url]
            if not queries:
                continue
            path = page_url.replace("https://tdrealtyohio.com", "")
            md.append(f"### {path}\n")
            md.append("| Query | Clicks | Impressions | CTR | Pos |")
            md.append("|-------|--------|-------------|-----|-----|")
            for q in queries[:10]:
                md.append(
                    f"| {q['query']} | {q['clicks']} | {q['impressions']} "
                    f"| {q['ctr']:.2%} | {q['position']} |"
                )
            md.append("")

    # Zero-impression pages
    if zero_impression_pages:
        md.append("## Zero-Impression Pages\n")
        md.append("These pages are in sitemap.xml but have zero search impressions:\n")
        for url in zero_impression_pages:
            path = url.replace("https://tdrealtyohio.com", "")
            md.append(f"- {path}")
        md.append("")

    # Unsitemaped pages showing in GSC
    if unsitemaped:
        md.append("## Pages in GSC but Not in Sitemap\n")
        for p in unsitemaped:
            md.append(f"- {p['page']} ({p['clicks']} clicks, {p['impressions']} impressions)")
        md.append("")

    _write_outputs("performance", data, "\n".join(md) + "\n")
    return data


# ── Indexing Report ───────────────────────────────────────────────────

def generate_indexing_report(client: GSCClient) -> dict:
    """Check every page in sitemap against Google's index with diff tracking."""
    print("Generating indexing report...")

    # Load previous report for diff
    previous = _load_previous_report("indexing")
    prev_verdicts = {}
    if previous and "pages" in previous:
        prev_verdicts = {p["url"]: p["verdict"] for p in previous["pages"]}

    urls = get_sitemap_urls()
    if not urls:
        print("  No URLs found in sitemap, skipping.")
        return {"report": "indexing", "pages": [], "summary": {}}

    results = []
    for i, url in enumerate(urls):
        print(f"  Inspecting [{i + 1}/{len(urls)}] {url}")
        try:
            info = client.inspect_url(url)
        except Exception as e:
            info = {
                "url": url,
                "verdict": "ERROR",
                "coverage_state": str(e),
                "indexing_state": "UNKNOWN",
                "last_crawl_time": None,
                "page_fetch_state": "UNKNOWN",
                "robots_txt_state": "UNKNOWN",
                "crawled_as": "UNKNOWN",
                "referring_urls": [],
            }

        # Local HTML checks
        info["html_checks"] = _check_page_html(url)

        # Diff against previous run
        prev = prev_verdicts.get(url)
        if prev is None:
            info["change"] = "new"
        elif prev != info["verdict"]:
            info["change"] = f"{prev} -> {info['verdict']}"
        else:
            info["change"] = "unchanged"

        results.append(info)

    indexed = [r for r in results if r["verdict"] == "PASS"]
    not_indexed = [r for r in results if r["verdict"] not in ("PASS", "ERROR")]
    errors = [r for r in results if r["verdict"] == "ERROR"]
    changes = [r for r in results if r["change"] not in ("unchanged", "new")]
    newly_indexed = [r for r in results if r["change"].endswith("-> PASS")]
    newly_dropped = [r for r in results if r["change"].startswith("PASS ->")]

    summary = {
        "total": len(results),
        "indexed": len(indexed),
        "not_indexed": len(not_indexed),
        "errors": len(errors),
        "index_rate": round(len(indexed) / len(results), 4) if results else 0,
        "changes_since_last_run": len(changes),
        "newly_indexed": len(newly_indexed),
        "newly_dropped": len(newly_dropped),
    }

    # Identify pages with HTML issues that may explain non-indexing
    issues = []
    for r in not_indexed:
        hc = r.get("html_checks", {})
        page_issues = []
        if hc.get("has_noindex"):
            page_issues.append("has noindex tag")
        if hc.get("canonical_mismatch"):
            page_issues.append(f"canonical mismatch: {hc['canonical']}")
        if not hc.get("has_meta_description"):
            page_issues.append("missing meta description")
        if hc.get("thin_content"):
            page_issues.append(f"thin content ({hc.get('word_count', 0)} words)")
        if not hc.get("html_exists"):
            page_issues.append("HTML file not found locally")
        if page_issues:
            issues.append({"url": r["url"], "issues": page_issues})

    data = {
        "report": "indexing",
        "generated": datetime.utcnow().isoformat(),
        "summary": summary,
        "pages": results,
        "html_issues": issues,
    }

    # Build markdown
    md = [f"# GSC Indexing Report — {date.today().isoformat()}"]
    md.append(f"\n**{summary['indexed']}/{summary['total']}** pages indexed "
              f"({summary['index_rate']:.0%})")
    if summary["changes_since_last_run"]:
        md.append(f" | **{summary['changes_since_last_run']} changes** since last run")
    md.append("\n")

    # Diff section
    if newly_indexed:
        md.append("## Newly Indexed\n")
        for r in newly_indexed:
            path = r["url"].replace("https://tdrealtyohio.com", "")
            md.append(f"- {path}")
        md.append("")

    if newly_dropped:
        md.append("## Dropped from Index\n")
        for r in newly_dropped:
            path = r["url"].replace("https://tdrealtyohio.com", "")
            md.append(f"- {path} ({r['change']})")
        md.append("")

    # HTML issues
    if issues:
        md.append("## Potential Indexing Blockers\n")
        md.append("Local HTML issues that may prevent indexing:\n")
        for item in issues:
            path = item["url"].replace("https://tdrealtyohio.com", "")
            md.append(f"- **{path}**: {', '.join(item['issues'])}")
        md.append("")

    if not_indexed:
        md.append("## Not Indexed\n")
        md.append("| URL | Verdict | Coverage State | Robots | Last Crawl | Change |")
        md.append("|-----|---------|---------------|--------|------------|--------|")
        for r in not_indexed:
            path = r["url"].replace("https://tdrealtyohio.com", "")
            crawl = r.get("last_crawl_time", "—") or "—"
            robots = r.get("robots_txt_state", "—")
            md.append(f"| {path} | {r['verdict']} | {r['coverage_state']} "
                       f"| {robots} | {crawl} | {r['change']} |")

    if indexed:
        md.append("\n## Indexed\n")
        md.append("| URL | Last Crawl | Change |")
        md.append("|-----|------------|--------|")
        for r in indexed:
            path = r["url"].replace("https://tdrealtyohio.com", "")
            crawl = r.get("last_crawl_time", "—") or "—"
            md.append(f"| {path} | {crawl} | {r['change']} |")

    if errors:
        md.append("\n## Errors\n")
        for r in errors:
            path = r["url"].replace("https://tdrealtyohio.com", "")
            md.append(f"- **{path}**: {r['coverage_state']}")

    _write_outputs("indexing", data, "\n".join(md) + "\n")
    return data


# ── Sitemap Health Report ─────────────────────────────────────────────

def generate_sitemap_report(client: GSCClient) -> dict:
    """Check sitemap health in GSC."""
    print("Generating sitemap health report...")

    sitemaps = client.list_sitemaps()
    local_urls = get_sitemap_urls()

    data = {
        "report": "sitemap",
        "generated": datetime.utcnow().isoformat(),
        "local_url_count": len(local_urls),
        "sitemaps": sitemaps,
    }

    md = [f"# GSC Sitemap Health Report — {date.today().isoformat()}"]
    md.append(f"\n**Local sitemap.xml:** {len(local_urls)} URLs\n")

    if not sitemaps:
        md.append("*No sitemaps found in Google Search Console.*\n")
    else:
        for s in sitemaps:
            md.append(f"## {s['path']}\n")
            md.append(f"- Last submitted: {s['last_submitted'] or '—'}")
            md.append(f"- Last downloaded: {s['last_downloaded'] or '—'}")
            md.append(f"- Pending: {s['is_pending']}")
            md.append(f"- Warnings: {s['warnings']}")
            md.append(f"- Errors: {s['errors']}")
            if s["contents"]:
                md.append("\n| Type | Submitted | Indexed |")
                md.append("|------|-----------|---------|")
                for c in s["contents"]:
                    md.append(f"| {c['type']} | {c['submitted']} | {c['indexed']} |")
            md.append("")

    _write_outputs("sitemap", data, "\n".join(md) + "\n")
    return data


# ── CLI ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate Google Search Console reports"
    )
    parser.add_argument(
        "--report",
        choices=["performance", "indexing", "sitemap", "all"],
        default="all",
        help="Report type to generate",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=28,
        help="Number of days for performance data (default: 28)",
    )
    args = parser.parse_args()

    client = GSCClient()

    if args.report in ("performance", "all"):
        generate_performance_report(client, args.days)

    if args.report in ("indexing", "all"):
        generate_indexing_report(client)

    if args.report in ("sitemap", "all"):
        generate_sitemap_report(client)

    print("Done.")


if __name__ == "__main__":
    main()
