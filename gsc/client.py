"""Wrapper around the Google Search Console API using a service account.

Auth is loaded from the GSC_SERVICE_ACCOUNT env var (JSON string).
Property URL is loaded from GSC_PROPERTY_URL env var.
"""

import json
import os
import time
from datetime import date, timedelta

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]

# URL Inspection API: 2,000 requests/day, 600 requests/min
_INSPECT_RATE_LIMIT_DELAY = 0.15  # seconds between inspection calls


def _get_credentials():
    """Build credentials from the GSC_SERVICE_ACCOUNT env var."""
    raw = os.environ.get("GSC_SERVICE_ACCOUNT")
    if not raw:
        raise RuntimeError("GSC_SERVICE_ACCOUNT environment variable is not set")
    info = json.loads(raw)
    return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)


def _get_property_url():
    """Return the GSC property URL from env."""
    return os.environ.get("GSC_PROPERTY_URL", "https://tdrealtyohio.com")


def _retry_on_error(func, max_retries=3, base_delay=2.0):
    """Retry a callable with exponential backoff on transient HTTP errors."""
    for attempt in range(max_retries + 1):
        try:
            return func()
        except HttpError as e:
            status = e.resp.status if e.resp else 0
            # Retry on rate limit (429) and server errors (5xx)
            if status in (429, 500, 502, 503) and attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                print(f"    HTTP {status}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(delay)
                continue
            raise


class GSCClient:
    """Google Search Console API client."""

    def __init__(self):
        creds = _get_credentials()
        self._service = build("searchconsole", "v1", credentials=creds)
        self._property = _get_property_url()

    @property
    def property_url(self) -> str:
        return self._property

    # ── Search Analytics ──────────────────────────────────────────────

    def query_analytics(
        self,
        start_date: date,
        end_date: date,
        dimensions: list[str] | None = None,
        dimension_filters: list[dict] | None = None,
        row_limit: int = 1000,
        start_row: int = 0,
    ) -> list[dict]:
        """Run a Search Analytics query and return rows.

        Each row contains 'keys' (dimension values) and metrics:
        clicks, impressions, ctr, position.
        """
        if dimensions is None:
            dimensions = ["page"]

        body = {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "dimensions": dimensions,
            "rowLimit": row_limit,
            "startRow": start_row,
        }
        if dimension_filters:
            body["dimensionFilterGroups"] = [{"filters": dimension_filters}]

        resp = _retry_on_error(
            lambda: self._service.searchanalytics()
            .query(siteUrl=self._property, body=body)
            .execute()
        )
        return resp.get("rows", [])

    def _date_range(self, days: int) -> tuple[date, date]:
        """Return (start, end) date range accounting for GSC data lag."""
        end = date.today() - timedelta(days=3)  # GSC data lags ~3 days
        start = end - timedelta(days=days)
        return start, end

    def top_pages(self, days: int = 28, limit: int = 25) -> list[dict]:
        """Return top pages by clicks over the last N days."""
        start, end = self._date_range(days)
        rows = self.query_analytics(start, end, dimensions=["page"], row_limit=limit)
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

    def top_queries(self, days: int = 28, limit: int = 25) -> list[dict]:
        """Return top queries by clicks over the last N days."""
        start, end = self._date_range(days)
        rows = self.query_analytics(start, end, dimensions=["query"], row_limit=limit)
        return [
            {
                "query": r["keys"][0],
                "clicks": r["clicks"],
                "impressions": r["impressions"],
                "ctr": round(r["ctr"], 4),
                "position": round(r["position"], 1),
            }
            for r in rows
        ]

    def performance_by_date(self, days: int = 28) -> list[dict]:
        """Return daily performance totals."""
        start, end = self._date_range(days)
        rows = self.query_analytics(start, end, dimensions=["date"], row_limit=days)
        return [
            {
                "date": r["keys"][0],
                "clicks": r["clicks"],
                "impressions": r["impressions"],
                "ctr": round(r["ctr"], 4),
                "position": round(r["position"], 1),
            }
            for r in rows
        ]

    def performance_by_device(self, days: int = 28) -> list[dict]:
        """Return performance broken down by device type."""
        start, end = self._date_range(days)
        rows = self.query_analytics(start, end, dimensions=["device"], row_limit=10)
        return [
            {
                "device": r["keys"][0],
                "clicks": r["clicks"],
                "impressions": r["impressions"],
                "ctr": round(r["ctr"], 4),
                "position": round(r["position"], 1),
            }
            for r in rows
        ]

    def page_query_breakdown(self, page_url: str, days: int = 28) -> list[dict]:
        """Return queries driving traffic to a specific page."""
        start, end = self._date_range(days)
        rows = self.query_analytics(
            start,
            end,
            dimensions=["query"],
            dimension_filters=[
                {
                    "dimension": "page",
                    "operator": "equals",
                    "expression": page_url,
                }
            ],
            row_limit=50,
        )
        return [
            {
                "query": r["keys"][0],
                "clicks": r["clicks"],
                "impressions": r["impressions"],
                "ctr": round(r["ctr"], 4),
                "position": round(r["position"], 1),
            }
            for r in rows
        ]

    # ── URL Inspection ────────────────────────────────────────────────

    def inspect_url(self, page_url: str) -> dict:
        """Inspect a URL for indexing status via the URL Inspection API.

        Includes rate-limit pacing to stay within the 600 req/min quota.
        """
        body = {
            "inspectionUrl": page_url,
            "siteUrl": self._property,
        }
        resp = _retry_on_error(
            lambda: self._service.urlInspection()
            .index()
            .inspect(body=body)
            .execute()
        )
        time.sleep(_INSPECT_RATE_LIMIT_DELAY)

        result = resp.get("inspectionResult", {})
        index_status = result.get("indexStatusResult", {})
        return {
            "url": page_url,
            "verdict": index_status.get("verdict", "UNKNOWN"),
            "coverage_state": index_status.get("coverageState", "UNKNOWN"),
            "indexing_state": index_status.get("indexingState", "UNKNOWN"),
            "last_crawl_time": index_status.get("lastCrawlTime"),
            "page_fetch_state": index_status.get("pageFetchState", "UNKNOWN"),
            "robots_txt_state": index_status.get("robotsTxtState", "UNKNOWN"),
            "crawled_as": index_status.get("crawledAs", "UNKNOWN"),
            "referring_urls": index_status.get("referringUrls", []),
        }

    # ── Sitemaps ──────────────────────────────────────────────────────

    def list_sitemaps(self) -> list[dict]:
        """List all sitemaps submitted for the property."""
        resp = _retry_on_error(
            lambda: self._service.sitemaps()
            .list(siteUrl=self._property)
            .execute()
        )
        sitemaps = resp.get("sitemap", [])
        return [
            {
                "path": s.get("path"),
                "last_submitted": s.get("lastSubmitted"),
                "last_downloaded": s.get("lastDownloaded"),
                "is_pending": s.get("isPending", False),
                "warnings": s.get("warnings", 0),
                "errors": s.get("errors", 0),
                "contents": [
                    {
                        "type": c.get("type"),
                        "submitted": c.get("submitted", 0),
                        "indexed": c.get("indexed", 0),
                    }
                    for c in s.get("contents", [])
                ],
            }
            for s in sitemaps
        ]
