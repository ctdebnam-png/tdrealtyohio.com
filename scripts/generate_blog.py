"""Main entry point for blog generation."""

import argparse
import logging
import sys
from datetime import datetime

from config import ACTIVE_COMMUNITIES, BLOG_OUTPUT_DIR
from fetch_market_data import fetch_redfin_data, get_market_snapshot, get_mortgage_rates
from fetch_community_events import get_community_events, get_local_news
from content_generator import (
    generate_market_update,
    generate_events_roundup,
    generate_rate_update,
)
from utils import save_post, count_words, check_ai_artifacts
from validate_post import validate_html_post

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Generate blog posts for TD Realty Ohio")
    parser.add_argument("--type", choices=["market", "events", "rates"], required=True)
    parser.add_argument("--community", default=None, help="Specific community slug or omit for defaults")
    parser.add_argument("--dry-run", action="store_true", help="Print output without saving")
    parser.add_argument("--output-dir", default=BLOG_OUTPUT_DIR, help="Output directory")
    args = parser.parse_args()

    now = datetime.now()
    generated = 0

    if args.type == "market":
        communities = [args.community] if args.community else ACTIVE_COMMUNITIES
        logger.info("Fetching Redfin data...")
        redfin_rows = fetch_redfin_data()

        for community in communities:
            logger.info("Generating market update for %s", community)
            data = get_market_snapshot(community, redfin_rows)
            if not data:
                logger.warning("No data for %s, skipping", community)
                continue

            content = generate_market_update(community, data)

            # Validate
            issues = validate_html_post(content)
            if issues:
                logger.warning("Validation issues for %s: %s", community, "; ".join(issues))

            slug = f"{community}-market-update-{now.strftime('%B-%Y').lower()}"
            if args.dry_run:
                print(f"\n--- {slug} ---")
                print(f"Word count: {count_words(content)}")
                print(content[:500] + "...")
            else:
                save_post(content, slug, args.output_dir)
                generated += 1

    elif args.type == "events":
        # Limit to subset to manage API costs
        communities = [args.community] if args.community else ACTIVE_COMMUNITIES[:3]

        for community in communities:
            logger.info("Generating events roundup for %s", community)
            events = get_community_events(community)
            news = get_local_news(community)

            content = generate_events_roundup(community, events, news)

            issues = validate_html_post(content)
            if issues:
                logger.warning("Validation issues for %s: %s", community, "; ".join(issues))

            slug = f"{community}-events-{now.strftime('%Y-%m-%d')}"
            if args.dry_run:
                print(f"\n--- {slug} ---")
                print(f"Word count: {count_words(content)}")
                print(content[:500] + "...")
            else:
                save_post(content, slug, args.output_dir)
                generated += 1

    elif args.type == "rates":
        logger.info("Fetching mortgage rate data...")
        rate_data = get_mortgage_rates()
        if not rate_data:
            logger.error("Could not fetch mortgage rate data")
            sys.exit(1)

        content = generate_rate_update(rate_data)

        issues = validate_html_post(content)
        if issues:
            logger.warning("Validation issues: %s", "; ".join(issues))

        slug = f"mortgage-rates-update-{now.strftime('%Y-%m-%d')}"
        if args.dry_run:
            print(f"\n--- {slug} ---")
            print(f"Word count: {count_words(content)}")
            print(content[:500] + "...")
        else:
            save_post(content, slug, args.output_dir)
            generated += 1

    logger.info("Done. Generated %d post(s).", generated)


if __name__ == "__main__":
    main()
