"""CLI report generator for Google Search Console data.

Usage:
    python -m gsc.reports --report all --days 28
    python -m gsc.reports --report performance --days 7
    python -m gsc.reports --report indexing
    python -m gsc.reports --report sitemap
"""

import argparse
import json
import sys
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


# ── Performance Report ────────────────────────────────────────────────

def generate_performance_report(client: GSCClient, days: int) -> dict:
    """Generate full performance report."""
    print(f"Generating performance report ({days} days)...")

    top_pages = client.top_pages(days=days, limit=25)
    top_queries = client.top_queries(days=days, limit=25)
    daily = client.performance_by_date(days=days)

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

    data = {
        "report": "performance",
        "generated": datetime.utcnow().isoformat(),
        "days": days,
        "totals": totals,
        "top_pages": top_pages,
        "top_queries": top_queries,
        "daily": daily,
    }

    # Build markdown
    md = [f"# GSC Performance Report — {date.today().isoformat()}"]
    md.append(f"\n**Period:** {days} days\n")
    md.append("## Summary\n")
    md.append(f"| Metric | Value |")
    md.append(f"|--------|-------|")
    md.append(f"| Total clicks | {totals['clicks']:,} |")
    md.append(f"| Total impressions | {totals['impressions']:,} |")
    md.append(f"| Avg CTR | {totals['avg_ctr']:.2%} |")
    md.append(f"| Avg position | {totals['avg_position']} |")

    md.append("\n## Top Pages\n")
    md.append("| Page | Clicks | Impressions | CTR | Pos |")
    md.append("|------|--------|-------------|-----|-----|")
    for p in top_pages[:15]:
        path = p["page"].replace("https://tdrealtyohio.com", "")
        md.append(
            f"| {path} | {p['clicks']} | {p['impressions']} | {p['ctr']:.2%} | {p['position']} |"
        )

    md.append("\n## Top Queries\n")
    md.append("| Query | Clicks | Impressions | CTR | Pos |")
    md.append("|-------|--------|-------------|-----|-----|")
    for q in top_queries[:15]:
        md.append(
            f"| {q['query']} | {q['clicks']} | {q['impressions']} | {q['ctr']:.2%} | {q['position']} |"
        )

    _write_outputs("performance", data, "\n".join(md) + "\n")
    return data


# ── Indexing Report ───────────────────────────────────────────────────

def generate_indexing_report(client: GSCClient) -> dict:
    """Check every page in sitemap against Google's index."""
    print("Generating indexing report...")

    urls = get_sitemap_urls()
    if not urls:
        print("  No URLs found in sitemap, skipping.")
        return {"report": "indexing", "pages": [], "summary": {}}

    results = []
    for i, url in enumerate(urls):
        print(f"  Inspecting [{i + 1}/{len(urls)}] {url}")
        try:
            info = client.inspect_url(url)
            results.append(info)
        except Exception as e:
            results.append({
                "url": url,
                "verdict": "ERROR",
                "coverage_state": str(e),
                "indexing_state": "UNKNOWN",
                "last_crawl_time": None,
                "page_fetch_state": "UNKNOWN",
                "robots_txt_state": "UNKNOWN",
                "crawled_as": "UNKNOWN",
                "referring_urls": [],
            })

    indexed = [r for r in results if r["verdict"] == "PASS"]
    not_indexed = [r for r in results if r["verdict"] != "PASS"]
    summary = {
        "total": len(results),
        "indexed": len(indexed),
        "not_indexed": len(not_indexed),
        "index_rate": round(len(indexed) / len(results), 4) if results else 0,
    }

    data = {
        "report": "indexing",
        "generated": datetime.utcnow().isoformat(),
        "summary": summary,
        "pages": results,
    }

    # Build markdown
    md = [f"# GSC Indexing Report — {date.today().isoformat()}"]
    md.append(f"\n**{summary['indexed']}/{summary['total']}** pages indexed ({summary['index_rate']:.0%})\n")

    if not_indexed:
        md.append("## Not Indexed\n")
        md.append("| URL | Verdict | Coverage State | Last Crawl |")
        md.append("|-----|---------|---------------|------------|")
        for r in not_indexed:
            path = r["url"].replace("https://tdrealtyohio.com", "")
            crawl = r.get("last_crawl_time", "—") or "—"
            md.append(f"| {path} | {r['verdict']} | {r['coverage_state']} | {crawl} |")

    if indexed:
        md.append("\n## Indexed\n")
        md.append("| URL | Last Crawl |")
        md.append("|-----|------------|")
        for r in indexed:
            path = r["url"].replace("https://tdrealtyohio.com", "")
            crawl = r.get("last_crawl_time", "—") or "—"
            md.append(f"| {path} | {crawl} |")

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
