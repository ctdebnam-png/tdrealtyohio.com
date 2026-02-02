"""Feedback loop: compare blog post scores against actual GSC performance.

Identifies which scoring categories correlate with real Google rankings
and outputs rubric adjustment recommendations for the blog engine.

Usage:
    python -m gsc.feedback --days 28
"""

import argparse
import json
import re
from datetime import date, datetime
from pathlib import Path

from .client import GSCClient

OUTPUT_DIR = Path("output/gsc-reports")
BLOG_DIR = Path("blog")

# Scoring categories extracted from blog post meta / content signals.
# The blog engine can produce a scores JSON alongside each post — this module
# reads those if they exist, otherwise derives heuristic scores from HTML.
SCORING_CATEGORIES = [
    "word_count",
    "heading_structure",
    "internal_links",
    "meta_description",
    "keyword_density",
    "schema_markup",
    "image_alt_text",
    "cta_presence",
    "local_relevance",
    "freshness",
]


def _find_blog_posts() -> list[dict]:
    """Discover blog posts and extract basic metadata from HTML."""
    posts = []
    if not BLOG_DIR.exists():
        return posts

    for index_html in sorted(BLOG_DIR.glob("*/index.html")):
        slug = index_html.parent.name
        if slug in (".", ".."):
            continue
        html = index_html.read_text(errors="replace")
        post = {
            "slug": slug,
            "path": f"/blog/{slug}/",
            "url": f"https://tdrealtyohio.com/blog/{slug}/",
            "scores": _score_post(html, index_html.parent),
        }
        posts.append(post)
    return posts


def _score_post(html: str, post_dir: Path) -> dict:
    """Score a blog post across SEO categories.

    If the blog engine has written a scores.json alongside the post,
    use that. Otherwise derive heuristic scores from HTML content.
    """
    scores_file = post_dir / "scores.json"
    if scores_file.exists():
        try:
            return json.loads(scores_file.read_text())
        except (json.JSONDecodeError, OSError):
            pass

    # Heuristic scoring (0-100 per category)
    text = re.sub(r"<[^>]+>", " ", html)
    words = text.split()
    word_count = len(words)

    scores = {}
    # Word count: 800+ is good, 1200+ is great
    scores["word_count"] = min(100, int(word_count / 12))

    # Heading structure: has h1, h2s
    h1s = len(re.findall(r"<h1[ >]", html, re.I))
    h2s = len(re.findall(r"<h2[ >]", html, re.I))
    scores["heading_structure"] = min(100, h1s * 40 + h2s * 15)

    # Internal links
    internal = len(re.findall(r'href=["\']/', html))
    scores["internal_links"] = min(100, internal * 20)

    # Meta description
    has_meta = bool(re.search(r'<meta\s+name=["\']description["\']', html, re.I))
    scores["meta_description"] = 100 if has_meta else 0

    # Keyword density (check for site-relevant terms)
    keywords = ["commission", "realtor", "columbus", "ohio", "home", "sell", "buy"]
    kw_count = sum(text.lower().count(kw) for kw in keywords)
    scores["keyword_density"] = min(100, int(kw_count / max(word_count, 1) * 2000))

    # Schema markup
    has_schema = bool(re.search(r'application/ld\+json', html))
    scores["schema_markup"] = 100 if has_schema else 0

    # Image alt text
    images = re.findall(r"<img[^>]*>", html, re.I)
    with_alt = [img for img in images if 'alt="' in img or "alt='" in img]
    scores["image_alt_text"] = (
        100 if not images else int(len(with_alt) / len(images) * 100)
    )

    # CTA presence
    has_cta = bool(
        re.search(r"(contact|call|schedule|get started|free)", text, re.I)
    )
    scores["cta_presence"] = 100 if has_cta else 0

    # Local relevance
    local_terms = [
        "columbus", "ohio", "westerville", "dublin", "powell",
        "central ohio", "franklin county",
    ]
    local_count = sum(text.lower().count(t) for t in local_terms)
    scores["local_relevance"] = min(100, local_count * 10)

    # Freshness (based on presence of current year)
    current_year = str(date.today().year)
    scores["freshness"] = 100 if current_year in text else 30

    return scores


def generate_feedback_report(client: GSCClient, days: int = 28) -> dict:
    """Compare blog scores against GSC performance and find correlations."""
    print(f"Generating feedback report ({days} days)...")

    posts = _find_blog_posts()
    if not posts:
        print("  No blog posts found.")
        return {"report": "feedback", "posts": [], "correlations": {}}

    # Get GSC performance for each blog post
    for post in posts:
        try:
            perf = client.top_pages(days=days, limit=500)
            match = next((p for p in perf if post["url"] in p["page"]), None)
            if match:
                post["gsc"] = match
            else:
                post["gsc"] = {
                    "clicks": 0,
                    "impressions": 0,
                    "ctr": 0,
                    "position": 0,
                }
        except Exception as e:
            print(f"  Error fetching GSC data for {post['slug']}: {e}")
            post["gsc"] = {"clicks": 0, "impressions": 0, "ctr": 0, "position": 0}

    # Calculate correlations between score categories and GSC metrics
    correlations = _calculate_correlations(posts)
    recommendations = _generate_recommendations(correlations, posts)

    data = {
        "report": "feedback",
        "generated": datetime.utcnow().isoformat(),
        "days": days,
        "post_count": len(posts),
        "posts": [
            {
                "slug": p["slug"],
                "url": p["url"],
                "scores": p["scores"],
                "gsc": p["gsc"],
            }
            for p in posts
        ],
        "correlations": correlations,
        "recommendations": recommendations,
    }

    # Build markdown
    md = [f"# GSC Feedback Report — {date.today().isoformat()}"]
    md.append(f"\n**Period:** {days} days | **Posts analyzed:** {len(posts)}\n")

    md.append("## Post Performance\n")
    md.append("| Post | Clicks | Impressions | CTR | Position |")
    md.append("|------|--------|-------------|-----|----------|")
    for p in sorted(posts, key=lambda x: x["gsc"]["clicks"], reverse=True):
        gsc = p["gsc"]
        md.append(
            f"| {p['slug']} | {gsc['clicks']} | {gsc['impressions']} "
            f"| {gsc['ctr']:.2%} | {gsc['position'] or '—'} |"
        )

    md.append("\n## Score vs Performance Correlations\n")
    md.append(
        "Higher correlation means the scoring category better predicts real "
        "Google performance.\n"
    )
    md.append("| Category | Corr. w/ Clicks | Corr. w/ Impressions | Corr. w/ Position |")
    md.append("|----------|-----------------|---------------------|-------------------|")
    for cat in SCORING_CATEGORIES:
        c = correlations.get(cat, {})
        md.append(
            f"| {cat} | {c.get('clicks', 0):+.2f} | "
            f"{c.get('impressions', 0):+.2f} | {c.get('position', 0):+.2f} |"
        )

    md.append("\n## Rubric Adjustment Recommendations\n")
    if recommendations:
        for rec in recommendations:
            md.append(f"- **{rec['category']}**: {rec['recommendation']}")
    else:
        md.append("*Insufficient data for recommendations. Need more indexed posts.*")

    md.append(
        "\n---\n*This data is exported for consumption by the blog content engine.*\n"
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    _write_outputs("feedback", data, "\n".join(md) + "\n")
    return data


def _write_outputs(name: str, data: dict, markdown: str):
    """Write JSON and markdown report files."""
    timestamp = date.today().isoformat()
    json_path = OUTPUT_DIR / f"{name}_{timestamp}.json"
    md_path = OUTPUT_DIR / f"{name}_{timestamp}.md"
    json_path.write_text(json.dumps(data, indent=2, default=str))
    md_path.write_text(markdown)
    print(f"  -> {json_path}")
    print(f"  -> {md_path}")

    # Also write a latest symlink-style file for easy consumption
    latest_json = OUTPUT_DIR / f"{name}_latest.json"
    latest_json.write_text(json.dumps(data, indent=2, default=str))


def _calculate_correlations(posts: list[dict]) -> dict:
    """Calculate simple rank correlations between scores and GSC metrics.

    Uses Spearman-style rank correlation without scipy dependency.
    """
    if len(posts) < 3:
        return {cat: {"clicks": 0, "impressions": 0, "position": 0} for cat in SCORING_CATEGORIES}

    def _rank(values):
        sorted_idx = sorted(range(len(values)), key=lambda i: values[i])
        ranks = [0] * len(values)
        for rank, idx in enumerate(sorted_idx):
            ranks[idx] = rank
        return ranks

    def _corr(a, b):
        n = len(a)
        if n < 3:
            return 0.0
        mean_a = sum(a) / n
        mean_b = sum(b) / n
        cov = sum((a[i] - mean_a) * (b[i] - mean_b) for i in range(n))
        std_a = (sum((x - mean_a) ** 2 for x in a) / n) ** 0.5
        std_b = (sum((x - mean_b) ** 2 for x in b) / n) ** 0.5
        if std_a == 0 or std_b == 0:
            return 0.0
        return round(cov / (n * std_a * std_b), 3)

    clicks = [p["gsc"]["clicks"] for p in posts]
    impressions = [p["gsc"]["impressions"] for p in posts]
    positions = [p["gsc"]["position"] for p in posts]

    click_ranks = _rank(clicks)
    imp_ranks = _rank(impressions)
    pos_ranks = _rank(positions)

    correlations = {}
    for cat in SCORING_CATEGORIES:
        cat_values = [p["scores"].get(cat, 0) for p in posts]
        cat_ranks = _rank(cat_values)
        correlations[cat] = {
            "clicks": _corr(cat_ranks, click_ranks),
            "impressions": _corr(cat_ranks, imp_ranks),
            "position": _corr(cat_ranks, pos_ranks),
        }
    return correlations


def _generate_recommendations(correlations: dict, posts: list[dict]) -> list[dict]:
    """Generate rubric adjustment recommendations based on correlations."""
    recs = []

    # Need enough indexed posts to make meaningful recommendations
    indexed_posts = [p for p in posts if p["gsc"]["impressions"] > 0]
    if len(indexed_posts) < 2:
        return recs

    for cat, corrs in correlations.items():
        click_corr = corrs.get("clicks", 0)
        imp_corr = corrs.get("impressions", 0)

        if click_corr > 0.3 and imp_corr > 0.3:
            recs.append({
                "category": cat,
                "action": "increase_weight",
                "recommendation": (
                    f"Strong positive correlation with clicks ({click_corr:+.2f}) "
                    f"and impressions ({imp_corr:+.2f}). "
                    f"Increase weight in content scoring rubric."
                ),
            })
        elif click_corr < -0.3 and imp_corr < -0.3:
            recs.append({
                "category": cat,
                "action": "decrease_weight",
                "recommendation": (
                    f"Negative correlation with clicks ({click_corr:+.2f}) "
                    f"and impressions ({imp_corr:+.2f}). "
                    f"This category may not reflect what Google values. "
                    f"Consider reducing its weight."
                ),
            })

        # Check for categories where high scores don't match performance
        avg_score = sum(p["scores"].get(cat, 0) for p in posts) / len(posts)
        avg_indexed_score = (
            sum(p["scores"].get(cat, 0) for p in indexed_posts) / len(indexed_posts)
            if indexed_posts
            else 0
        )

        if avg_indexed_score > avg_score + 15:
            recs.append({
                "category": cat,
                "action": "confirmed_important",
                "recommendation": (
                    f"Indexed posts score significantly higher (avg {avg_indexed_score:.0f}) "
                    f"than all posts (avg {avg_score:.0f}). "
                    f"This category appears to matter for indexing."
                ),
            })

    return recs


def main():
    parser = argparse.ArgumentParser(
        description="Generate GSC feedback report comparing blog scores to real performance"
    )
    parser.add_argument("--days", type=int, default=28, help="Days of GSC data")
    args = parser.parse_args()

    client = GSCClient()
    generate_feedback_report(client, args.days)
    print("Done.")


if __name__ == "__main__":
    main()
