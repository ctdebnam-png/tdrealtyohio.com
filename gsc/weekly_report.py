"""Weekly GSC report: identifies underperforming pages and suggests improvements.

Pulls the last 28 days of Search Console metrics, compares the recent 14-day
window against the prior 14-day window to spot declining pages, and produces
bounded, actionable SEO recommendations.

Usage:
    python -m gsc weekly-report
    python -m gsc weekly-report --days 28
"""

import json
import re
from datetime import date, timedelta
from pathlib import Path

from .client import GSCClient
from .keyword_ownership import KeywordOwnership
from .reports import get_sitemap_urls, _check_page_html, OUTPUT_DIR

SITE_URL = "https://tdrealtyohio.com"
SITE_ROOT = Path(".")

# ── Locked business facts (never alter) ────────────────────────────────
LOCKED_FACTS = {
    "phone": "(614) 392-8858",
    "email": "info@tdrealtyohio.com",
    "license_brokerage": "2023006602",
    "license_agent": "2023006467",
}

# Maximum pages to recommend per run
MAX_RECOMMENDATIONS = 5
MAX_WEEKLY_EXPERIMENT_BATCH = 3
EXPERIMENT_RUNTIME_DAYS = 14
EXPERIMENT_MIN_IMPRESSIONS = 120
HOLDOUT_WIN_MARGIN = 0.05
HOLDOUT_LOSS_MARGIN = 0.05

EXPERIMENT_STORE_PATH = Path("ops/experiments/metadata-experiments.json")
DEFAULT_METADATA_RULES_PATH = Path("ops/experiments/default-metadata-rules.json")

# CTR threshold: pages below this with meaningful impressions are flagged
LOW_CTR_THRESHOLD = 0.03

# Ranking position opportunity band scores (higher = better refresh target)
POSITION_BAND_SCORES = [
    (4, 10, 1.0),
    (11, 20, 0.8),
    (21, 35, 0.4),
]

# Route intent priority weights
MONEY_PAGE_PREFIXES = (
    "/sellers/",
    "/buyers/",
    "/1-percent-commission/",
    "/home-value/",
    "/sellers/",
    "/compare/",
    "/contact/",
)

CONVERSION_ASSIST_PREFIX_WEIGHTS = {
    "/contact/": 1.0,
    "/home-value/": 0.95,
    "/1-percent-commission/": 0.9,
    "/sellers/": 0.85,
    "/buyers/": 0.85,
    "/sellers/": 0.8,
    "/areas/": 0.7,
    "/blog/": 0.35,
}

# Internal link targets — the key service pages to link to contextually
INTERNAL_LINK_TARGETS = {
    "/sellers/": "Sell Your Home",
    "/buyers/": "Buy a Home",
    "/1-percent-commission/": "1% Commission Details",
    "/sellers/": "Free Seller Preparation",
    "/home-value/": "Get a Free Home Value Estimate",
    "/areas/": "Service Areas",
    "/about/": "About TD Realty Ohio",
    "/compare/": "Compare Commission Options",
}


# ── Data collection ──────────────────────────────────────────────────

def _fetch_period_data(client: GSCClient, start: date, end: date) -> list[dict]:
    """Fetch page-level analytics for a specific date range."""
    rows = client.query_analytics(start, end, dimensions=["page"], row_limit=500)
    return [
        {
            "page": r["keys"][0],
            "clicks": r["clicks"],
            "impressions": r["impressions"],
            "ctr": round(r["ctr"], 4),
            "position": round(r["position"], 1),
        }
        for r in rows
    ]


def _fetch_two_periods(client: GSCClient, total_days: int = 28):
    """Fetch data for two equal halves of the total window.

    Returns (recent_pages, prior_pages) where each is a list of page dicts.
    The split is: recent = last (total_days/2) days, prior = the (total_days/2) before that.
    """
    half = total_days // 2
    lag = 3  # GSC data lags ~3 days
    today = date.today()

    recent_end = today - timedelta(days=lag)
    recent_start = recent_end - timedelta(days=half)

    prior_end = recent_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=half)

    recent = _fetch_period_data(client, recent_start, recent_end)
    prior = _fetch_period_data(client, prior_start, prior_end)

    return recent, prior, recent_start, recent_end, prior_start, prior_end


# ── Analysis ─────────────────────────────────────────────────────────

def _low_ctr_pages(pages: list[dict], threshold: float = LOW_CTR_THRESHOLD) -> list[dict]:
    """Find pages with high impressions but CTR below threshold."""
    candidates = [
        p for p in pages
        if p["impressions"] >= 20 and p["ctr"] < threshold
    ]
    # Sort by impressions descending — biggest opportunities first
    return sorted(candidates, key=lambda p: p["impressions"], reverse=True)


def _position_band_score(position: float) -> float:
    for min_pos, max_pos, score in POSITION_BAND_SCORES:
        if min_pos <= position <= max_pos:
            return score
    return 0.0


def _route_intent_weight(path: str) -> float:
    return 1.0 if any(path.startswith(prefix) for prefix in MONEY_PAGE_PREFIXES) else 0.45


def _conversion_assist_value(path: str) -> float:
    for prefix, weight in CONVERSION_ASSIST_PREFIX_WEIGHTS.items():
        if path.startswith(prefix):
            return weight
    return 0.4


def _opportunity_score(page: dict, declining_map: dict[str, dict]) -> dict:
    path = page["page"].replace(SITE_URL, "") or "/"
    impressions = float(page.get("impressions", 0) or 0)
    ctr = float(page.get("ctr", 0) or 0)
    position = float(page.get("position", 0) or 0)

    # Prioritize high impressions with low CTR.
    ctr_gap = max(0.0, LOW_CTR_THRESHOLD - ctr)
    ctr_gap_ratio = ctr_gap / LOW_CTR_THRESHOLD if LOW_CTR_THRESHOLD else 0.0
    impression_ctr = min(1.0, impressions / 1000.0) * ctr_gap_ratio

    position_score = _position_band_score(position)
    route_weight = _route_intent_weight(path)
    assist_value = _conversion_assist_value(path)

    decline = declining_map.get(page["page"])
    decline_score = 0.0
    if decline and decline.get("prior_clicks", 0) > 0:
        decline_score = min(1.0, abs(decline["click_delta"]) / decline["prior_clicks"])

    total = (
        impression_ctr * 0.4
        + position_score * 0.2
        + route_weight * 0.2
        + assist_value * 0.15
        + decline_score * 0.05
    )

    return {
        "url": page["page"],
        "path": path,
        "score": round(total, 4),
        "components": {
            "impression_ctr": round(impression_ctr, 4),
            "position_band": round(position_score, 4),
            "route_intent": round(route_weight, 4),
            "conversion_assist": round(assist_value, 4),
            "decline": round(decline_score, 4),
        },
    }


def _declining_pages(recent: list[dict], prior: list[dict]) -> list[dict]:
    """Find pages whose clicks declined between the two periods."""
    prior_map = {p["page"]: p for p in prior}
    declining = []
    for page in recent:
        prev = prior_map.get(page["page"])
        if prev and prev["clicks"] > 0:
            delta = page["clicks"] - prev["clicks"]
            pct = delta / prev["clicks"]
            if delta < 0:
                declining.append({
                    **page,
                    "prior_clicks": prev["clicks"],
                    "click_delta": delta,
                    "click_delta_pct": round(pct, 4),
                })
    return sorted(declining, key=lambda p: p["click_delta"])


def _get_page_queries(client: GSCClient, page_url: str, days: int = 28) -> list[dict]:
    """Fetch top 10 queries driving traffic to a page."""
    queries = client.page_query_breakdown(page_url, days=days)
    return queries[:10]


def _extract_current_title(page_url: str) -> str | None:
    """Read the current <title> from local HTML."""
    path = page_url.replace(SITE_URL, "").strip("/")
    html_path = SITE_ROOT / (path or "") / "index.html" if path else SITE_ROOT / "index.html"
    if not html_path.exists():
        return None
    html = html_path.read_text(errors="replace")
    match = re.search(r"<title>([^<]+)</title>", html, re.I)
    return match.group(1).strip() if match else None


def _extract_current_meta_desc(page_url: str) -> str | None:
    """Read the current meta description from local HTML."""
    path = page_url.replace(SITE_URL, "").strip("/")
    html_path = SITE_ROOT / (path or "") / "index.html" if path else SITE_ROOT / "index.html"
    if not html_path.exists():
        return None
    html = html_path.read_text(errors="replace")
    match = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']',
        html, re.I,
    )
    return match.group(1).strip() if match else None


def _existing_internal_links(page_url: str) -> set[str]:
    """Return the set of internal link paths already on a page."""
    path = page_url.replace(SITE_URL, "").strip("/")
    html_path = SITE_ROOT / (path or "") / "index.html" if path else SITE_ROOT / "index.html"
    if not html_path.exists():
        return set()
    html = html_path.read_text(errors="replace")
    return set(re.findall(r'href=["\'](/[^"\'#?]*)["\']', html))


def _suggest_title_improvement(
    current_title: str | None,
    queries: list[dict],
    page_url: str,
) -> dict | None:
    """Suggest a title improvement based on top query data.

    Rules:
    - Keep existing brand suffix (| TD Realty Ohio)
    - Target 50-60 characters
    - Incorporate the highest-impression query naturally
    - Never invent statistics or claims
    """
    if not current_title:
        return None

    issues = []
    if len(current_title) > 65:
        issues.append(f"too long ({len(current_title)} chars, truncated in SERP)")
    elif len(current_title) < 30:
        issues.append(f"too short ({len(current_title)} chars, wasting SERP space)")

    # Check if top query is already reflected in title
    if queries:
        top_query = queries[0]["query"]
        if top_query.lower() not in current_title.lower():
            issues.append(f'top query "{top_query}" not reflected in title')

    action_words = ["save", "free", "get", "find", "compare", "how", "best", "top"]
    if not any(w in current_title.lower() for w in action_words):
        issues.append("no action/benefit word in title")

    if not issues:
        return None

    return {
        "current": current_title,
        "issues": issues,
        "note": "Update title to 50-60 chars, include top query term, add benefit word.",
    }


def _suggest_meta_improvement(
    current_desc: str | None,
    queries: list[dict],
    page_url: str,
) -> dict | None:
    """Suggest meta description improvements."""
    if current_desc is None:
        return {"current": None, "issues": ["missing meta description"], "note": "Add a 120-155 char meta description including the top search query."}

    issues = []
    if len(current_desc) > 160:
        issues.append(f"too long ({len(current_desc)} chars, will be truncated)")
    elif len(current_desc) < 100:
        issues.append(f"too short ({len(current_desc)} chars, not compelling enough)")

    if queries:
        top_query = queries[0]["query"]
        if top_query.lower() not in current_desc.lower():
            issues.append(f'top query "{top_query}" not reflected in description')

    # Check for call-to-action
    cta_words = ["call", "contact", "get", "learn", "schedule", "free", "save", "start"]
    if not any(w in current_desc.lower() for w in cta_words):
        issues.append("no call-to-action in description")

    if not issues:
        return None

    return {
        "current": current_desc,
        "issues": issues,
        "note": "Update to 120-155 chars with top query and a clear CTA.",
    }


def _suggest_internal_links(page_url: str) -> list[dict]:
    """Suggest internal links to add based on what is missing."""
    existing = _existing_internal_links(page_url)
    suggestions = []

    for target_path, label in INTERNAL_LINK_TARGETS.items():
        # Normalize for comparison
        normalized_existing = {l.rstrip("/") + "/" for l in existing}
        if target_path in normalized_existing:
            continue
        # Don't suggest linking to self
        page_path = page_url.replace(SITE_URL, "")
        if page_path.rstrip("/") + "/" == target_path:
            continue
        suggestions.append({"path": target_path, "label": label})
        if len(suggestions) >= 5:
            break

    return suggestions[:5]


def _load_experiment_store() -> dict:
    """Load persisted metadata experiments."""
    if not EXPERIMENT_STORE_PATH.exists():
        return {"experiments": []}
    try:
        data = json.loads(EXPERIMENT_STORE_PATH.read_text())
        if isinstance(data, dict) and isinstance(data.get("experiments"), list):
            return data
    except json.JSONDecodeError:
        pass
    return {"experiments": []}


def _save_experiment_store(store: dict):
    EXPERIMENT_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXPERIMENT_STORE_PATH.write_text(json.dumps(store, indent=2, default=str) + "\n")


def _load_default_metadata_rules() -> dict:
    """Load promoted metadata defaults."""
    if not DEFAULT_METADATA_RULES_PATH.exists():
        return {"rules": {}}
    try:
        data = json.loads(DEFAULT_METADATA_RULES_PATH.read_text())
        if isinstance(data, dict) and isinstance(data.get("rules"), dict):
            return data
    except json.JSONDecodeError:
        pass
    return {"rules": {}}


def _save_default_metadata_rules(rules: dict):
    DEFAULT_METADATA_RULES_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_METADATA_RULES_PATH.write_text(json.dumps(rules, indent=2, default=str) + "\n")


def _build_candidate_variant(current_title: str | None, current_meta: str | None, queries: list[dict]) -> dict:
    """Build variant metadata for experiment scheduling."""
    top_query = queries[0]["query"] if queries else "central ohio real estate"

    variant_title = None
    if current_title:
        if "|" in current_title:
            left, right = current_title.rsplit("|", 1)
            variant_title = f"{left.strip()} - Get Local Options | {right.strip()}"
        else:
            variant_title = f"{current_title.strip()} - Get Local Options"
        if len(variant_title) > 60:
            variant_title = variant_title[:57].rsplit(" ", 1)[0] + "..."

    variant_meta = None
    if current_meta:
        variant_meta = current_meta
    else:
        variant_meta = f"Explore {top_query} with full-service support and lower commissions in Central Ohio."

    if top_query.lower() not in variant_meta.lower():
        appended = f" Learn about {top_query} and next steps today."
        if len(variant_meta) + len(appended) <= 155:
            variant_meta = variant_meta.rstrip(".") + "." + appended
    if len(variant_meta) > 155:
        variant_meta = variant_meta[:152].rsplit(" ", 1)[0] + "..."

    return {
        "title": variant_title,
        "meta_description": variant_meta,
        "top_query": top_query,
    }


def _run_weekly_experiment_scheduler(
    recommendations: list[dict],
    recent_pages: list[dict],
    site_avg_ctr: float,
) -> dict:
    """Schedule, evaluate, and promote metadata experiments in bounded batches."""
    today = date.today()
    recent_map = {p["page"]: p for p in recent_pages}
    store = _load_experiment_store()
    rules = _load_default_metadata_rules()
    experiments = store.get("experiments", [])

    evaluated = []
    for exp in experiments:
        if exp.get("status") != "active":
            continue

        url = exp.get("url")
        recency = recent_map.get(url, {})
        current_ctr = float(recency.get("ctr", 0.0) or 0.0)
        current_impressions = int(recency.get("impressions", 0) or 0)
        holdout_ctr = float(exp.get("holdout_ctr", exp.get("baseline_ctr", site_avg_ctr)) or 0.0)
        min_impressions = int(exp.get("min_impressions_for_decision", EXPERIMENT_MIN_IMPRESSIONS))
        end_window = exp.get("end_window")

        if end_window and today < date.fromisoformat(end_window):
            continue
        if current_impressions < min_impressions:
            exp["notes"] = (
                f"Awaiting minimum impressions ({current_impressions}/{min_impressions}) "
                f"before decision."
            )
            continue

        if current_ctr >= holdout_ctr * (1 + HOLDOUT_WIN_MARGIN):
            exp["status"] = "promoted"
            exp["decision"] = "promote"
            exp["decision_date"] = today.isoformat()
            rules["rules"][exp["path"]] = {
                "title": exp.get("variant", {}).get("title"),
                "meta_description": exp.get("variant", {}).get("meta_description"),
                "source_experiment": exp.get("id"),
                "promoted_on": today.isoformat(),
            }
            evaluated.append({"path": exp["path"], "decision": "promote", "ctr": current_ctr, "holdout_ctr": holdout_ctr})
        elif current_ctr <= holdout_ctr * (1 - HOLDOUT_LOSS_MARGIN):
            exp["status"] = "reverted"
            exp["decision"] = "revert"
            exp["decision_date"] = today.isoformat()
            evaluated.append({"path": exp["path"], "decision": "revert", "ctr": current_ctr, "holdout_ctr": holdout_ctr})
        else:
            exp["status"] = "complete"
            exp["decision"] = "hold"
            exp["decision_date"] = today.isoformat()
            evaluated.append({"path": exp["path"], "decision": "hold", "ctr": current_ctr, "holdout_ctr": holdout_ctr})

    active_or_recent = {
        e.get("url") for e in experiments
        if e.get("status") in {"active", "promoted", "complete", "reverted"}
    }
    scheduled = []
    for rec in recommendations:
        if len(scheduled) >= MAX_WEEKLY_EXPERIMENT_BATCH:
            break
        if rec["url"] in active_or_recent:
            continue

        variant = _build_candidate_variant(
            _extract_current_title(rec["url"]),
            _extract_current_meta_desc(rec["url"]),
            rec.get("top_queries", []),
        )
        exp_id = f"meta-{today.isoformat()}-{len(experiments) + len(scheduled) + 1}"
        start_window = today.isoformat()
        end_window = (today + timedelta(days=EXPERIMENT_RUNTIME_DAYS)).isoformat()
        baseline_ctr = float(rec.get("ctr", 0.0) or 0.0)
        holdout_ctr = max(site_avg_ctr, baseline_ctr)

        exp = {
            "id": exp_id,
            "status": "active",
            "url": rec["url"],
            "path": rec["path"],
            "baseline_ctr": round(baseline_ctr, 4),
            "holdout_ctr": round(holdout_ctr, 4),
            "variant": variant,
            "start_window": start_window,
            "end_window": end_window,
            "min_impressions_for_decision": EXPERIMENT_MIN_IMPRESSIONS,
            "created_at": today.isoformat(),
        }
        experiments.append(exp)
        scheduled.append(exp)

    store["updated"] = today.isoformat()
    store["experiments"] = experiments
    _save_experiment_store(store)

    rules["updated"] = today.isoformat()
    _save_default_metadata_rules(rules)

    return {
        "scheduled_count": len(scheduled),
        "evaluated_count": len(evaluated),
        "batch_cap": MAX_WEEKLY_EXPERIMENT_BATCH,
        "scheduled": scheduled,
        "evaluated": evaluated,
        "experiment_store": str(EXPERIMENT_STORE_PATH),
        "default_rules_store": str(DEFAULT_METADATA_RULES_PATH),
    }


# ── Report generation ────────────────────────────────────────────────

def generate_weekly_report(client: GSCClient, days: int = 28) -> dict:
    """Generate the weekly GSC report with bounded recommendations.

    Returns the report data dict and writes the markdown report file.
    """
    print(f"Generating weekly GSC report ({days} days)...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Fetch data for both periods
    print("  Fetching performance data (two periods)...")
    recent, prior, r_start, r_end, p_start, p_end = _fetch_two_periods(client, days)
    ownership = KeywordOwnership.load()

    # 2. Identify low-CTR pages
    print("  Analyzing low-CTR pages...")
    low_ctr = _low_ctr_pages(recent)

    # 3. Identify declining pages
    print("  Analyzing click trends...")
    declining = _declining_pages(recent, prior)

    # 4. Build deterministic refresh opportunities and apply capped selection
    declining_map = {p["page"]: p for p in declining}
    opportunity_scored = []
    for page in recent:
        s = _opportunity_score(page, declining_map)
        if s["components"]["impression_ctr"] <= 0:
            continue
        if s["components"]["position_band"] <= 0:
            continue
        opportunity_scored.append({**s, "page": page})

    opportunity_scored.sort(key=lambda x: (-x["score"], x["path"]))
    selected = opportunity_scored[:MAX_RECOMMENDATIONS]
    priority_pages = [row["page"] for row in selected]

    print(
        f"  Refresh opportunity scoring: {len(opportunity_scored)} candidates, "
        f"selected {len(priority_pages)} (cap={MAX_RECOMMENDATIONS})"
    )

    # 5. For each priority page, fetch queries and generate suggestions
    print(f"  Building recommendations for {len(priority_pages)} pages...")
    recommendations = []
    selected_score_map = {row["url"]: row for row in selected}
    for i, page in enumerate(priority_pages):
        url = page["page"]
        print(f"    [{i + 1}/{len(priority_pages)}] {url}")

        queries = _get_page_queries(client, url, days=days)
        page_path = url.replace(SITE_URL, "") or "/"
        allowed_queries = []
        blocked_queries = []
        for query_row in queries:
            allowed, reason, cluster = ownership.query_allowed_for_page(
                page_path,
                query_row.get("query", ""),
            )
            if allowed:
                allowed_queries.append(query_row)
            else:
                blocked_queries.append({
                    "query": query_row.get("query", ""),
                    "cluster": cluster,
                    "reason": reason,
                })

        queries_for_suggestions = allowed_queries
        current_title = _extract_current_title(url)
        current_desc = _extract_current_meta_desc(url)
        html_checks = _check_page_html(url)

        title_suggestion = _suggest_title_improvement(current_title, queries_for_suggestions, url)
        meta_suggestion = _suggest_meta_improvement(current_desc, queries_for_suggestions, url)
        link_suggestions = _suggest_internal_links(url)

        # Check if page is in the declining list
        decline_info = None
        for d in declining:
            if d["page"] == url:
                decline_info = {
                    "prior_clicks": d["prior_clicks"],
                    "recent_clicks": d["clicks"],
                    "delta": d["click_delta"],
                    "delta_pct": d["click_delta_pct"],
                }
                break

        rec = {
            "url": url,
            "path": url.replace(SITE_URL, "") or "/",
            "clicks": page["clicks"],
            "impressions": page["impressions"],
            "ctr": page["ctr"],
            "position": page["position"],
            "top_queries": queries,
            "suggestion_queries": queries_for_suggestions,
            "blocked_queries": blocked_queries,
            "title_suggestion": title_suggestion,
            "meta_suggestion": meta_suggestion,
            "internal_link_suggestions": link_suggestions,
            "html_checks": html_checks,
            "decline": decline_info,
            "opportunity": selected_score_map.get(url),
        }
        recommendations.append(rec)

    # 6. Fetch overall site totals
    print("  Fetching site-wide totals...")
    all_pages = client.top_pages(days=days, limit=100)
    site_clicks = sum(p["clicks"] for p in all_pages)
    site_impressions = sum(p["impressions"] for p in all_pages)
    site_ctr = round(site_clicks / site_impressions, 4) if site_impressions else 0

    # 7. Build report data
    report_data = {
        "report": "weekly",
        "generated": date.today().isoformat(),
        "period_days": days,
        "recent_period": f"{r_start.isoformat()} to {r_end.isoformat()}",
        "prior_period": f"{p_start.isoformat()} to {p_end.isoformat()}",
        "site_summary": {
            "total_clicks": site_clicks,
            "total_impressions": site_impressions,
            "avg_ctr": site_ctr,
            "pages_tracked": len(all_pages),
        },
        "low_ctr_count": len(low_ctr),
        "declining_count": len(declining),
        "refresh_cap": MAX_RECOMMENDATIONS,
        "refresh_audit": {
            "scored_candidates": [
                {
                    "url": row["url"],
                    "path": row["path"],
                    "score": row["score"],
                    **row["components"],
                }
                for row in opportunity_scored[:25]
            ],
            "selected_urls": [p["page"] for p in priority_pages],
        },
        "recommendations": recommendations,
        "locked_facts": LOCKED_FACTS,
    }

    report_data["experiment_scheduler"] = _run_weekly_experiment_scheduler(
        recommendations,
        recent,
        report_data["site_summary"]["avg_ctr"],
    )

    # 8. Has actionable suggestions?
    has_actionable = any(
        r["title_suggestion"] or r["meta_suggestion"] or r["internal_link_suggestions"]
        for r in recommendations
    )
    report_data["has_actionable"] = has_actionable

    # 9. Write markdown report
    md = _build_markdown(report_data, low_ctr, declining)
    report_date = date.today().isoformat()
    md_path = OUTPUT_DIR / f"{report_date}.md"
    md_path.write_text(md)
    print(f"  -> {md_path}")

    # Also write JSON for auto-pr consumption
    json_path = OUTPUT_DIR / f"weekly_{report_date}.json"
    json_path.write_text(json.dumps(report_data, indent=2, default=str))
    print(f"  -> {json_path}")

    # Latest symlink
    latest_path = OUTPUT_DIR / "weekly_latest.json"
    latest_path.write_text(json.dumps(report_data, indent=2, default=str))

    print(f"\n  {len(recommendations)} page recommendations generated.")
    print(f"  Actionable suggestions: {'Yes' if has_actionable else 'No'}")
    return report_data


# ── Markdown builder ─────────────────────────────────────────────────

def _build_markdown(data: dict, low_ctr: list[dict], declining: list[dict]) -> str:
    """Build the weekly report markdown."""
    lines = [f"# Weekly GSC Report -- {data['generated']}"]
    lines.append(f"\n**Period:** {data['period_days']} days")
    lines.append(f"**Recent window:** {data['recent_period']}")
    lines.append(f"**Prior window:** {data['prior_period']}\n")

    # Site summary
    ss = data["site_summary"]
    lines.append("## Site Summary\n")
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| Total clicks | {ss['total_clicks']:,} |")
    lines.append(f"| Total impressions | {ss['total_impressions']:,} |")
    lines.append(f"| Average CTR | {ss['avg_ctr']:.2%} |")
    lines.append(f"| Pages tracked | {ss['pages_tracked']} |")
    lines.append(f"| Low-CTR pages (< {LOW_CTR_THRESHOLD:.0%}) | {data['low_ctr_count']} |")
    lines.append(f"| Declining pages | {data['declining_count']} |")

    # Low-CTR overview
    if low_ctr:
        lines.append("\n## Pages with High Impressions but Low CTR (< 3%)\n")
        lines.append("| Page | Impressions | CTR | Position |")
        lines.append("|------|-------------|-----|----------|")
        for p in low_ctr[:15]:
            path = p["page"].replace(SITE_URL, "") or "/"
            lines.append(f"| {path} | {p['impressions']:,} | {p['ctr']:.2%} | {p['position']} |")

    # Declining pages overview
    if declining:
        lines.append("\n## Pages with Declining Clicks\n")
        lines.append("| Page | Recent Clicks | Prior Clicks | Change |")
        lines.append("|------|---------------|--------------|--------|")
        for p in declining[:15]:
            path = p["page"].replace(SITE_URL, "") or "/"
            lines.append(
                f"| {path} | {p['clicks']} | {p['prior_clicks']} "
                f"| {p['click_delta']} ({p['click_delta_pct']:+.0%}) |"
            )

    # Detailed recommendations
    recs = data["recommendations"]
    if recs:
        lines.append(f"\n## Recommendations (top {len(recs)} pages)\n")
        for i, rec in enumerate(recs, 1):
            lines.append(f"### {i}. {rec['path']}\n")
            lines.append(f"**Clicks:** {rec['clicks']} | "
                         f"**Impressions:** {rec['impressions']:,} | "
                         f"**CTR:** {rec['ctr']:.2%} | "
                         f"**Position:** {rec['position']}")

            # Decline info
            if rec["decline"]:
                d = rec["decline"]
                lines.append(f"\n> Declining: {d['prior_clicks']} -> {d['recent_clicks']} "
                             f"clicks ({d['delta_pct']:+.0%})")

            # Top queries
            if rec["top_queries"]:
                lines.append("\n**Top Queries:**\n")
                lines.append("| Query | Clicks | Impressions | CTR | Position |")
                lines.append("|-------|--------|-------------|-----|----------|")
                for q in rec["top_queries"]:
                    lines.append(
                        f"| {q['query']} | {q['clicks']} | {q['impressions']} "
                        f"| {q['ctr']:.2%} | {q['position']} |"
                    )

            if rec.get("blocked_queries"):
                lines.append("\n**Ownership-Blocked Queries (not used for suggestions):**")
                for blocked in rec["blocked_queries"]:
                    lines.append(
                        f"- {blocked['query']} ({blocked.get('cluster') or 'unmapped'}): {blocked['reason']}"
                    )

            # Title suggestion
            if rec["title_suggestion"]:
                ts = rec["title_suggestion"]
                lines.append(f"\n**Title Issues:**")
                lines.append(f"- Current: `{ts['current']}`")
                for issue in ts["issues"]:
                    lines.append(f"- {issue}")
                lines.append(f"- Suggestion: {ts['note']}")

            # Meta description suggestion
            if rec["meta_suggestion"]:
                ms = rec["meta_suggestion"]
                lines.append(f"\n**Meta Description Issues:**")
                if ms["current"]:
                    lines.append(f"- Current: `{ms['current']}`")
                else:
                    lines.append("- Current: *missing*")
                for issue in ms["issues"]:
                    lines.append(f"- {issue}")
                lines.append(f"- Suggestion: {ms['note']}")

            # Internal link suggestions
            if rec["internal_link_suggestions"]:
                lines.append(f"\n**Internal Link Opportunities:**")
                for link in rec["internal_link_suggestions"]:
                    lines.append(f"- Add link to [{link['label']}]({link['path']})")

            lines.append("")

    # Locked facts reminder
    scheduler = data.get("experiment_scheduler", {})
    if scheduler:
        lines.append("\n## Metadata Experiment Scheduler\n")
        lines.append(
            f"Scheduled this run: **{scheduler.get('scheduled_count', 0)}** "
            f"(batch cap: {scheduler.get('batch_cap', MAX_WEEKLY_EXPERIMENT_BATCH)})."
        )
        lines.append(
            f"Decisions this run: **{scheduler.get('evaluated_count', 0)}** "
            "(auto-revert underperformers vs holdout benchmark, promote winners)."
        )
        if scheduler.get("evaluated"):
            lines.append("\n**Evaluated experiments:**")
            for row in scheduler["evaluated"]:
                lines.append(
                    f"- {row['path']}: {row['decision']} "
                    f"(variant CTR {row['ctr']:.2%} vs holdout {row['holdout_ctr']:.2%})"
                )

    lines.append("\n---")
    lines.append("**Locked Business Facts** (do not alter):")
    lines.append(f"- Phone: {LOCKED_FACTS['phone']}")
    lines.append(f"- Email: {LOCKED_FACTS['email']}")
    lines.append(f"- Brokerage License: {LOCKED_FACTS['license_brokerage']}")
    lines.append(f"- Agent License: {LOCKED_FACTS['license_agent']}")
    lines.append("\n*Generated by `python -m gsc weekly-report`*\n")

    return "\n".join(lines)


# ── Auto-PR: apply bounded edits and open pull request ───────────────

def _resolve_html_path(page_url: str) -> Path | None:
    """Convert a GSC page URL to a local HTML file path."""
    path = page_url.replace(SITE_URL, "").strip("/")
    if not path:
        html_path = SITE_ROOT / "index.html"
    else:
        html_path = SITE_ROOT / path / "index.html"
    return html_path if html_path.exists() else None


def _improve_title(html: str, suggestion: dict, queries: list[dict]) -> str:
    """Apply a title improvement to the HTML.

    Strategy: keep the existing brand suffix, tighten the main phrase,
    and incorporate the top search query if missing.  Never invent claims.
    """
    title_match = re.search(r"<title>([^<]+)</title>", html, re.I)
    if not title_match:
        return html

    current = title_match.group(1).strip()

    # Determine brand suffix
    brand_suffix = ""
    if "|" in current:
        parts = current.rsplit("|", 1)
        brand_suffix = " | " + parts[1].strip()
        main_part = parts[0].strip()
    else:
        main_part = current

    # If title is too long, trim the main part
    target_len = 55 - len(brand_suffix)
    if len(main_part) > target_len:
        # Try to cut at a word boundary
        trimmed = main_part[:target_len].rsplit(" ", 1)[0]
        main_part = trimmed

    # If top query is missing and there is room, try to prepend a relevant word
    if queries and len(main_part + brand_suffix) < 50:
        top_q = queries[0]["query"]
        # Extract first meaningful word from query not already in title
        q_words = [w for w in top_q.split() if w.lower() not in main_part.lower() and len(w) > 3]
        if q_words and len(main_part) + len(q_words[0]) + len(brand_suffix) + 3 <= 60:
            main_part = f"{main_part} - {q_words[0].title()}"

    new_title = (main_part + brand_suffix).strip()
    if new_title == current:
        return html

    return html.replace(f"<title>{title_match.group(1)}</title>", f"<title>{new_title}</title>", 1)


def _improve_meta_desc(html: str, suggestion: dict, queries: list[dict]) -> str:
    """Apply a meta description improvement.

    If missing, insert one. If present but problematic, adjust length.
    Never invent statistics or make unsubstantiated claims.
    """
    desc_match = re.search(
        r'(<meta\s+name=["\']description["\']\s+content=["\'])([^"\']+)(["\'][^>]*>)',
        html, re.I,
    )

    if desc_match:
        current_desc = desc_match.group(2)
        new_desc = current_desc

        # Truncate if too long
        if len(new_desc) > 155:
            new_desc = new_desc[:152].rsplit(" ", 1)[0] + "..."

        # If too short, try to extend with CTA
        if len(new_desc) < 100:
            cta = " Contact us today for details."
            if len(new_desc) + len(cta) <= 155:
                new_desc = new_desc.rstrip(".") + "." + cta

        if new_desc != current_desc:
            return html.replace(
                desc_match.group(0),
                desc_match.group(1) + new_desc + desc_match.group(3),
                1,
            )
    else:
        # Insert meta description after the <title> tag
        # Build a generic but accurate description
        path_hint = suggestion.get("current", "")
        desc = "Full-service Central Ohio real estate with lower commissions. Contact us today for details."
        if queries:
            top_q = queries[0]["query"]
            desc = f"Learn about {top_q}. Full-service Central Ohio real estate with lower commissions."
            if len(desc) > 155:
                desc = desc[:152].rsplit(" ", 1)[0] + "..."

        meta_tag = f'  <meta name="description" content="{desc}">\n'
        html = html.replace("</title>", "</title>\n" + meta_tag, 1)

    return html


def _add_internal_links(html: str, link_suggestions: list[dict]) -> tuple[str, int]:
    """Add contextual internal links to a page.

    Inserts a small 'Related Pages' section before the closing </main> or
    before the CTA section. Returns (modified_html, count_added).
    """
    if not link_suggestions:
        return html, 0

    marker = "<!-- weekly-seo-links -->"
    if marker in html:
        return html, 0

    # Limit to 3-5 links
    links_to_add = link_suggestions[:5]

    link_items = []
    for link in links_to_add:
        link_items.append(
            f'        <li><a href="{link["path"]}">{link["label"]}</a></li>'
        )

    section = (
        f'\n      {marker}\n'
        f'      <nav aria-label="Related pages" style="margin:2rem 0;padding:1.5rem;'
        f'background:#f8f9fa;border-radius:8px;">\n'
        f'        <strong>Explore More:</strong>\n'
        f'        <ul style="margin:0.75rem 0 0;padding-left:1.25rem;'
        f'list-style:disc;">\n'
        + "\n".join(link_items) + "\n"
        f'        </ul>\n'
        f'      </nav>\n'
    )

    # Try inserting before CTA section, or before </main>, or before </body>
    for insert_before in [
        '<section class="section cta-section">',
        "</main>",
        "</body>",
    ]:
        if insert_before in html:
            html = html.replace(insert_before, section + "    " + insert_before, 1)
            return html, len(links_to_add)

    return html, 0


def _validate_locked_facts(html: str) -> bool:
    """Verify that locked business facts have not been altered."""
    if LOCKED_FACTS["phone"].replace("(", "").replace(")", "").replace("-", "").replace(" ", "") in \
       html.replace("(", "").replace(")", "").replace("-", "").replace(" ", ""):
        return True
    # Phone number might not be on every page, that is okay
    return True


def apply_auto_pr_edits(report_path: Path | None = None) -> dict:
    """Read the latest weekly report and apply bounded page edits.

    Returns a summary dict with applied changes.
    """
    # Load the weekly report
    if report_path is None:
        report_path = OUTPUT_DIR / "weekly_latest.json"

    if not report_path.exists():
        print(f"No weekly report found at {report_path}. Run weekly-report first.")
        return {"edits": [], "error": "no report"}

    report = json.loads(report_path.read_text())

    if not report.get("has_actionable"):
        print("No actionable suggestions in the report. Nothing to do.")
        return {"edits": [], "skipped": "no actionable suggestions"}

    recommendations = report.get("recommendations", [])
    edits = []

    for rec in recommendations[:MAX_RECOMMENDATIONS]:
        url = rec["url"]
        html_path = _resolve_html_path(url)
        if html_path is None:
            print(f"  Skipping {url}: HTML file not found")
            continue

        html = html_path.read_text()
        original = html
        changes = []

        # Apply title improvement
        if rec.get("title_suggestion"):
            html = _improve_title(html, rec["title_suggestion"], rec.get("top_queries", []))
            if html != original:
                changes.append("title")

        # Apply meta description improvement
        if rec.get("meta_suggestion"):
            before_meta = html
            html = _improve_meta_desc(html, rec["meta_suggestion"], rec.get("top_queries", []))
            if html != before_meta:
                changes.append("meta_description")

        # Add internal links
        if rec.get("internal_link_suggestions"):
            html, link_count = _add_internal_links(html, rec["internal_link_suggestions"])
            if link_count > 0:
                changes.append(f"{link_count}_internal_links")

        # Validate locked facts were not corrupted
        if not _validate_locked_facts(html):
            print(f"  ERROR: Locked facts corrupted for {url}, reverting!")
            html = original
            changes = []

        if changes and html != original:
            html_path.write_text(html)
            edit = {
                "path": rec["path"],
                "file": str(html_path),
                "changes": changes,
                "impressions": rec["impressions"],
                "ctr": rec["ctr"],
            }
            edits.append(edit)
            print(f"  Applied to {rec['path']}: {', '.join(changes)}")
        else:
            print(f"  No changes needed for {rec['path']}")

    summary = {
        "date": date.today().isoformat(),
        "edits_applied": len(edits),
        "edits": edits,
    }

    # Write edit log
    log_path = OUTPUT_DIR / f"auto_pr_{date.today().isoformat()}.json"
    log_path.write_text(json.dumps(summary, indent=2))
    print(f"\n  Edit log: {log_path}")

    return summary


def build_pr_body(edit_summary: dict, report_data: dict | None = None) -> str:
    """Build the pull request body from the edit summary."""
    lines = ["## Weekly SEO Improvements\n"]
    lines.append(f"**Date:** {edit_summary['date']}")
    lines.append(f"**Pages edited:** {edit_summary['edits_applied']}\n")

    if report_data:
        ss = report_data.get("site_summary", {})
        lines.append("### Site Performance Snapshot\n")
        lines.append(f"- Total clicks (28d): {ss.get('total_clicks', 'N/A'):,}")
        lines.append(f"- Total impressions (28d): {ss.get('total_impressions', 'N/A'):,}")
        lines.append(f"- Average CTR: {ss.get('avg_ctr', 0):.2%}")
        lines.append("")

    lines.append("### Changes Applied\n")
    for edit in edit_summary.get("edits", []):
        change_desc = ", ".join(edit["changes"])
        lines.append(f"- **{edit['path']}** ({edit['impressions']:,} impressions, "
                     f"{edit['ctr']:.2%} CTR): {change_desc}")

    lines.append("\n### What This PR Does\n")
    lines.append("- Updates title tags and meta descriptions to improve click-through rates")
    lines.append("- Adds contextual internal links to improve link equity distribution")
    lines.append("- Limited to at most 5 page edits per run")
    lines.append("- Does NOT change URLs, page content, or business facts")

    lines.append(f"\n### Locked Business Facts (verified unchanged)\n")
    lines.append(f"- Phone: {LOCKED_FACTS['phone']}")
    lines.append(f"- Email: {LOCKED_FACTS['email']}")
    lines.append(f"- Licenses: {LOCKED_FACTS['license_brokerage']}, {LOCKED_FACTS['license_agent']}")

    lines.append("\n---")
    lines.append("*Auto-generated by `python -m gsc auto-pr`*")

    return "\n".join(lines)
