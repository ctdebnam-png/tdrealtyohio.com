"""Validate generated blog posts."""

import re
import sys
import logging
from pathlib import Path

from utils import count_words, check_ai_artifacts

logger = logging.getLogger(__name__)

MIN_WORD_COUNT = 600


def validate_html_post(html_content: str) -> list[str]:
    """Validate a generated HTML blog post. Returns list of issues (empty = valid)."""
    issues = []

    # Check word count
    wc = count_words(html_content)
    if wc < MIN_WORD_COUNT:
        issues.append(f"Word count {wc} is below minimum {MIN_WORD_COUNT}")

    # Check for required meta tags
    if "<title>" not in html_content:
        issues.append("Missing <title> tag")
    if 'name="description"' not in html_content:
        issues.append("Missing meta description")
    if 'rel="canonical"' not in html_content:
        issues.append("Missing canonical link")
    if "og:title" not in html_content:
        issues.append("Missing og:title")

    # Check for exactly one H1
    h1_count = len(re.findall(r"<h1[^>]*>", html_content))
    if h1_count == 0:
        issues.append("Missing <h1> tag")
    elif h1_count > 1:
        issues.append(f"Found {h1_count} <h1> tags, expected 1")

    # Check for at least one H2
    h2_count = len(re.findall(r"<h2[^>]*>", html_content))
    if h2_count == 0:
        issues.append("Missing <h2> sections")

    # Check for internal links
    internal_links = re.findall(r'href="/([\w-]+/)"', html_content)
    # Filter out standard nav/footer links to find article-body links
    if not internal_links:
        issues.append("No internal links found")

    # Check for Article schema
    if '"@type": "Article"' not in html_content and '"@type":"Article"' not in html_content:
        issues.append("Missing Article schema markup")

    # Check for AI artifacts
    artifacts = check_ai_artifacts(html_content)
    if artifacts:
        issues.append(f"AI artifacts detected: {', '.join(artifacts)}")

    # Check for broken structure
    if "<html" not in html_content:
        issues.append("Missing <html> tag")
    if "</html>" not in html_content:
        issues.append("Missing closing </html> tag")
    if "<body" not in html_content:
        issues.append("Missing <body> tag")

    return issues


def validate_file(filepath: str) -> list[str]:
    """Validate an HTML file on disk."""
    path = Path(filepath)
    if not path.exists():
        return [f"File not found: {filepath}"]
    content = path.read_text(encoding="utf-8")
    return validate_html_post(content)


def check_title_uniqueness(new_title: str, blog_dir: str = "blog") -> bool:
    """Check if a title already exists in existing blog posts."""
    repo_root = Path(__file__).resolve().parent.parent
    blog_path = repo_root / blog_dir
    if not blog_path.exists():
        return True

    new_title_lower = new_title.lower().strip()
    for index_file in blog_path.rglob("index.html"):
        content = index_file.read_text(encoding="utf-8")
        title_match = re.search(r"<title>([^<]+)</title>", content)
        if title_match:
            existing = title_match.group(1).lower().strip()
            if new_title_lower in existing or existing in new_title_lower:
                return False
    return True


def main():
    """CLI: validate one or more blog post files."""
    if len(sys.argv) < 2:
        print("Usage: python validate_post.py <path-to-index.html> [...]")
        sys.exit(1)

    exit_code = 0
    for filepath in sys.argv[1:]:
        issues = validate_file(filepath)
        if issues:
            print(f"FAIL: {filepath}")
            for issue in issues:
                print(f"  - {issue}")
            exit_code = 1
        else:
            print(f"OK: {filepath}")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
