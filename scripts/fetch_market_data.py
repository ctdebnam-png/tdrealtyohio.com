"""Fetch real estate market data from Redfin and FRED."""

import gzip
import io
import csv
import json
import logging
from datetime import datetime, timedelta

import requests

from config import (
    FRED_API_KEY,
    FRED_API_BASE,
    FRED_SERIES,
    REDFIN_DATA_URL,
    REDFIN_CITY_NAMES,
    COMMUNITY_DATA,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redfin
# ---------------------------------------------------------------------------

def fetch_redfin_data() -> list[dict]:
    """Download and parse Redfin city market tracker TSV for Ohio cities."""
    logger.info("Downloading Redfin market data...")
    resp = requests.get(REDFIN_DATA_URL, timeout=120)
    resp.raise_for_status()

    raw = gzip.decompress(resp.content)
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8")), delimiter="\t")

    target_cities = set(REDFIN_CITY_NAMES.values())
    rows: list[dict] = []
    for row in reader:
        # Filter to Ohio + target city names
        state = row.get("state_code", "")
        city = row.get("region", "")
        if state == "OH" and city in target_cities:
            rows.append(row)

    logger.info("Redfin: found %d rows for Central Ohio cities", len(rows))
    return rows


def get_market_snapshot(community: str, redfin_rows: list[dict] | None = None) -> dict | None:
    """Return dict with current + previous period metrics for a community.

    Returns None if data is not available for the community.
    """
    city_name = REDFIN_CITY_NAMES.get(community)
    if not city_name:
        logger.warning("No Redfin mapping for community: %s", community)
        return None

    if redfin_rows is None:
        redfin_rows = fetch_redfin_data()

    city_rows = [r for r in redfin_rows if r.get("region") == city_name]
    if not city_rows:
        logger.warning("No Redfin data for %s", city_name)
        return None

    # Sort by period_end descending
    def parse_date(row):
        try:
            return datetime.strptime(row.get("period_end", ""), "%Y-%m-%d")
        except ValueError:
            return datetime.min

    city_rows.sort(key=parse_date, reverse=True)

    current = city_rows[0] if city_rows else None
    previous = city_rows[1] if len(city_rows) > 1 else None

    if not current:
        return None

    def safe_float(val):
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    def safe_int(val):
        try:
            return int(float(val))
        except (TypeError, ValueError):
            return None

    def pct_change(cur, prev):
        if cur is not None and prev is not None and prev != 0:
            return round((cur - prev) / prev * 100, 1)
        return None

    snapshot = {
        "community": community,
        "display_name": COMMUNITY_DATA.get(community, {}).get("display_name", city_name),
        "period_end": current.get("period_end", ""),
        "median_sale_price": safe_float(current.get("median_sale_price")),
        "median_ppsf": safe_float(current.get("median_ppsf")),
        "homes_sold": safe_int(current.get("homes_sold")),
        "inventory": safe_int(current.get("inventory")),
        "days_on_market": safe_int(current.get("median_dom")),
        "sale_to_list": safe_float(current.get("avg_sale_to_list")),
    }

    if previous:
        snapshot["prev_median_sale_price"] = safe_float(previous.get("median_sale_price"))
        snapshot["prev_homes_sold"] = safe_int(previous.get("homes_sold"))
        snapshot["prev_days_on_market"] = safe_int(previous.get("median_dom"))
        snapshot["prev_inventory"] = safe_int(previous.get("inventory"))

        snapshot["price_change_pct"] = pct_change(
            snapshot["median_sale_price"], snapshot["prev_median_sale_price"]
        )
        snapshot["sold_change_pct"] = pct_change(
            snapshot["homes_sold"], snapshot["prev_homes_sold"]
        )
        snapshot["inventory_change_pct"] = pct_change(
            snapshot["inventory"], snapshot["prev_inventory"]
        )
        dom_cur = snapshot["days_on_market"]
        dom_prev = snapshot["prev_days_on_market"]
        if dom_cur is not None and dom_prev is not None:
            snapshot["dom_change"] = dom_cur - dom_prev
        else:
            snapshot["dom_change"] = None
    else:
        for k in [
            "prev_median_sale_price", "prev_homes_sold",
            "prev_days_on_market", "prev_inventory",
            "price_change_pct", "sold_change_pct",
            "inventory_change_pct", "dom_change",
        ]:
            snapshot[k] = None

    return snapshot


# ---------------------------------------------------------------------------
# FRED
# ---------------------------------------------------------------------------

def fetch_fred_data(series_id: str, limit: int = 10) -> list[dict]:
    """Fetch recent observations from FRED API."""
    if not FRED_API_KEY:
        logger.error("FRED_API_KEY not set")
        return []

    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "sort_order": "desc",
        "limit": limit,
    }
    resp = requests.get(FRED_API_BASE, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("observations", [])


def get_mortgage_rates() -> dict | None:
    """Return current and previous week mortgage rate data."""
    obs = fetch_fred_data(FRED_SERIES["mortgage_30yr"], limit=4)
    if not obs:
        return None

    def safe_float(val):
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    current = safe_float(obs[0].get("value"))
    previous = safe_float(obs[1].get("value")) if len(obs) > 1 else None

    if current is None:
        return None

    result = {
        "rate_30yr": current,
        "date": obs[0].get("date", ""),
        "prev_rate_30yr": previous,
    }

    if previous is not None:
        result["wow_change"] = round(current - previous, 2)
        result["rate_direction"] = "Rising" if current > previous else "Falling" if current < previous else "Steady"
    else:
        result["wow_change"] = None
        result["rate_direction"] = "Current"

    return result


def get_data_freshness(redfin_rows: list[dict]) -> str:
    """Return the most recent period_end date across all rows."""
    dates = []
    for row in redfin_rows:
        try:
            dates.append(datetime.strptime(row.get("period_end", ""), "%Y-%m-%d"))
        except ValueError:
            pass
    if dates:
        return max(dates).strftime("%Y-%m-%d")
    return "unknown"
