"""Utility helpers for blog generation."""

import re
import html
from datetime import datetime
from pathlib import Path


def generate_slug(title: str) -> str:
    """Convert title to URL-friendly slug."""
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)
    return slug


def format_price(number: float | int) -> str:
    """Format number as currency string."""
    if number >= 1_000_000:
        return f"${number / 1_000_000:,.1f}M"
    return f"${number:,.0f}"


def format_percent(value: float) -> str:
    """Format as percentage with sign."""
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.1f}%"


def community_display_name(slug: str) -> str:
    """Convert slug like 'new_albany' to 'New Albany'."""
    return slug.replace("_", " ").title()


def escape_html(text: str) -> str:
    """HTML-escape a string."""
    return html.escape(text)


def iso_date(dt: datetime | None = None) -> str:
    """Return ISO date string."""
    dt = dt or datetime.now()
    return dt.strftime("%Y-%m-%d")


def month_year(dt: datetime | None = None) -> str:
    """Return 'January 2026' style string."""
    dt = dt or datetime.now()
    return dt.strftime("%B %Y")


def week_of_date(dt: datetime | None = None) -> str:
    """Return 'January 27, 2026' style string."""
    dt = dt or datetime.now()
    return dt.strftime("%B %d, %Y").replace(" 0", " ")


def save_post(content: str, slug: str, output_dir: str = "blog") -> Path:
    """Save HTML content to blog/{slug}/index.html."""
    repo_root = Path(__file__).resolve().parent.parent
    post_dir = repo_root / output_dir / slug
    post_dir.mkdir(parents=True, exist_ok=True)
    out_path = post_dir / "index.html"
    out_path.write_text(content, encoding="utf-8")
    print(f"Saved: {out_path}")
    return out_path


def count_words(html_content: str) -> int:
    """Rough word count stripping HTML tags."""
    text = re.sub(r"<[^>]+>", " ", html_content)
    return len(text.split())


def check_ai_artifacts(text: str) -> list[str]:
    """Return list of detected AI-artifact phrases."""
    patterns = [
        r"[Aa]s an AI",
        r"I don'?t have access",
        r"I cannot browse",
        r"my training data",
        r"as a language model",
        r"I'?m not able to",
    ]
    found = []
    for pat in patterns:
        if re.search(pat, text):
            found.append(pat)
    return found
