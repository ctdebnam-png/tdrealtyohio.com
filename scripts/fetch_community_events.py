"""Fetch community events and local news from RSS feeds."""

import logging
from datetime import datetime, timedelta

import feedparser

from config import RSS_FEEDS, COMMUNITY_DATA

logger = logging.getLogger(__name__)


def fetch_rss_feed(url: str, timeout: int = 15) -> list[dict]:
    """Parse an RSS feed and return list of entry dicts."""
    try:
        feed = feedparser.parse(url)
        if feed.bozo and not feed.entries:
            logger.warning("Feed error for %s: %s", url, feed.bozo_exception)
            return []

        entries = []
        for entry in feed.entries:
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = datetime(*entry.published_parsed[:6])
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                published = datetime(*entry.updated_parsed[:6])

            entries.append({
                "title": getattr(entry, "title", ""),
                "link": getattr(entry, "link", ""),
                "summary": getattr(entry, "summary", ""),
                "published": published,
                "source": url,
            })
        return entries

    except Exception as exc:
        logger.error("Failed to fetch RSS feed %s: %s", url, exc)
        return []


def get_community_events(community: str, days_ahead: int = 7) -> list[dict]:
    """Fetch events relevant to a community from RSS feeds."""
    display_name = COMMUNITY_DATA.get(community, {}).get("display_name", community.title())
    now = datetime.now()
    cutoff = now + timedelta(days=days_ahead)

    # Determine which feeds to check
    feed_keys = []
    # Community-specific feeds
    community_feed_key = f"{community}_events"
    community_news_key = f"{community}_news"
    if community_feed_key in RSS_FEEDS:
        feed_keys.append(community_feed_key)
    if community_news_key in RSS_FEEDS:
        feed_keys.append(community_news_key)
    # Always include general Columbus feeds
    for key in ["columbus_underground", "experience_columbus"]:
        if key in RSS_FEEDS:
            feed_keys.append(key)

    all_entries = []
    for key in feed_keys:
        url = RSS_FEEDS[key]
        entries = fetch_rss_feed(url)
        all_entries.extend(entries)

    # Filter by relevance: mention of community name, or within date window
    relevant = []
    for entry in all_entries:
        title_lower = entry["title"].lower()
        summary_lower = entry["summary"].lower()
        name_lower = display_name.lower()

        location_match = name_lower in title_lower or name_lower in summary_lower

        date_match = True
        if entry["published"]:
            date_match = entry["published"] >= now - timedelta(days=1) and entry["published"] <= cutoff

        if location_match or date_match:
            relevant.append(entry)

    return deduplicate_events(relevant)


def get_local_news(community: str, max_items: int = 5) -> list[dict]:
    """Get recent news items mentioning the community."""
    display_name = COMMUNITY_DATA.get(community, {}).get("display_name", community.title())
    name_lower = display_name.lower()

    news_feeds = ["columbus_underground", "columbus_dispatch", "nbc4i", "abc6"]
    all_entries = []
    for key in news_feeds:
        url = RSS_FEEDS.get(key)
        if url:
            entries = fetch_rss_feed(url)
            all_entries.extend(entries)

    # Filter for community mentions
    relevant = [
        e for e in all_entries
        if name_lower in e["title"].lower() or name_lower in e["summary"].lower()
    ]

    # Sort by date descending
    relevant.sort(key=lambda e: e["published"] or datetime.min, reverse=True)

    return relevant[:max_items]


def deduplicate_events(events: list[dict]) -> list[dict]:
    """Remove duplicate entries by title similarity."""
    seen_titles: set[str] = set()
    unique = []
    for event in events:
        normalized = event["title"].lower().strip()
        if normalized not in seen_titles:
            seen_titles.add(normalized)
            unique.append(event)
    return unique


def format_event_for_html(event: dict) -> str:
    """Convert event dict to an HTML list item."""
    title = event.get("title", "Untitled Event")
    link = event.get("link", "")
    summary = event.get("summary", "")
    date = event.get("published")

    date_str = ""
    if date:
        date_str = f' <span class="event-date">({date.strftime("%B %d")})</span>'

    if link:
        return f'<li><a href="{link}" target="_blank" rel="noopener noreferrer">{title}</a>{date_str}</li>'
    return f"<li>{title}{date_str}</li>"
