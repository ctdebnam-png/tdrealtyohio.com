"""Configuration constants for blog generation system."""

import os

# API Keys (loaded from environment)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
FRED_API_KEY = os.environ.get("FRED_API_KEY")

# Claude settings
CLAUDE_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 8000

# Content settings
MIN_WORD_COUNT = 1200
MAX_WORD_COUNT = 1800

# Output paths - site uses plain HTML at /blog/{slug}/index.html
BLOG_OUTPUT_DIR = "blog"
TEMPLATE_DIR = "templates"

# Brokerage info for CTAs
BROKERAGE = {
    "name": "TD Realty Ohio, LLC",
    "broker": "Travis Debnam",
    "broker_first": "Travis",
    "phone": "(614) 392-8858",
    "email": "info@tdrealtyohio.com",
    "website": "https://tdrealtyohio.com",
    "license_broker": "2023006467",
    "license_brokerage": "2023006602",
    "value_props": [
        "1% listing commission when you buy and sell with us",
        "2% listing commission for sell-only clients",
        "Free pre-listing home inspection with every listing",
        "1% cashback for first-time homebuyers at closing",
    ],
}

# Communities to generate content for
ACTIVE_COMMUNITIES = [
    "westerville", "dublin", "powell", "delaware", "new_albany",
    "gahanna", "hilliard", "upper_arlington", "worthington",
    "lewis_center", "pickerington", "grove_city", "columbus",
]

# Redfin city name mapping (how cities appear in Redfin data)
REDFIN_CITY_NAMES = {
    "westerville": "Westerville",
    "dublin": "Dublin",
    "powell": "Powell",
    "delaware": "Delaware",
    "new_albany": "New Albany",
    "gahanna": "Gahanna",
    "hilliard": "Hilliard",
    "upper_arlington": "Upper Arlington",
    "worthington": "Worthington",
    "lewis_center": "Lewis Center",
    "pickerington": "Pickerington",
    "grove_city": "Grove City",
    "blacklick": "Blacklick",
    "clintonville": "Clintonville",
    "granville": "Granville",
    "columbus": "Columbus",
}

# RSS feeds for community events / news
RSS_FEEDS = {
    "columbus_underground": "https://www.columbusunderground.com/feed/",
    "experience_columbus": "https://www.experiencecolumbus.com/events/rss/",
    "columbus_dispatch": "https://www.dispatch.com/arcio/rss/category/lifestyle/",
    "nbc4i": "https://www.nbc4i.com/feed/",
    "abc6": "https://abc6onyourside.com/feed/",
    "westerville_events": "https://www.westerville.org/Home/Components/RssFeeds/RssFeed/View?ctID=79",
    "dublin_events": "https://dublinohiousa.gov/calendar/feed/",
    "powell_news": "https://cityofpowell.us/feed/",
}

# Community data
COMMUNITY_DATA = {
    "westerville": {
        "display_name": "Westerville",
        "city_url": "https://www.westerville.org",
        "school_district": "Westerville City Schools",
        "zip_codes": ["43081", "43082"],
    },
    "dublin": {
        "display_name": "Dublin",
        "city_url": "https://dublinohiousa.gov",
        "school_district": "Dublin City Schools",
        "zip_codes": ["43016", "43017"],
    },
    "powell": {
        "display_name": "Powell",
        "city_url": "https://cityofpowell.us",
        "school_district": "Olentangy Local Schools",
        "zip_codes": ["43065"],
    },
    "delaware": {
        "display_name": "Delaware",
        "city_url": "https://www.delawareohio.net",
        "school_district": "Delaware City Schools",
        "zip_codes": ["43015"],
    },
    "new_albany": {
        "display_name": "New Albany",
        "city_url": "https://newalbanyohio.org",
        "school_district": "New Albany-Plain Local Schools",
        "zip_codes": ["43054"],
    },
    "gahanna": {
        "display_name": "Gahanna",
        "city_url": "https://www.gahanna.gov",
        "school_district": "Gahanna-Jefferson City Schools",
        "zip_codes": ["43230"],
    },
    "hilliard": {
        "display_name": "Hilliard",
        "city_url": "https://hilliardohio.gov",
        "school_district": "Hilliard City Schools",
        "zip_codes": ["43026"],
    },
    "upper_arlington": {
        "display_name": "Upper Arlington",
        "city_url": "https://upperarlingtonoh.gov",
        "school_district": "Upper Arlington City Schools",
        "zip_codes": ["43220", "43221"],
    },
    "worthington": {
        "display_name": "Worthington",
        "city_url": "https://worthington.org",
        "school_district": "Worthington City Schools",
        "zip_codes": ["43085"],
    },
    "lewis_center": {
        "display_name": "Lewis Center",
        "city_url": None,
        "school_district": "Olentangy Local Schools",
        "zip_codes": ["43035"],
    },
    "pickerington": {
        "display_name": "Pickerington",
        "city_url": "https://www.ci.pickerington.oh.us",
        "school_district": "Pickerington Local Schools",
        "zip_codes": ["43147"],
    },
    "grove_city": {
        "display_name": "Grove City",
        "city_url": "https://www.grovecityohio.gov",
        "school_district": "South-Western City Schools",
        "zip_codes": ["43123"],
    },
    "blacklick": {
        "display_name": "Blacklick",
        "city_url": None,
        "school_district": "Gahanna-Jefferson City Schools",
        "zip_codes": ["43004"],
    },
    "clintonville": {
        "display_name": "Clintonville",
        "city_url": None,
        "school_district": "Columbus City Schools",
        "zip_codes": ["43202", "43214"],
    },
    "granville": {
        "display_name": "Granville",
        "city_url": "https://www.granville.oh.us",
        "school_district": "Granville Exempted Village Schools",
        "zip_codes": ["43023"],
    },
    "columbus": {
        "display_name": "Columbus",
        "city_url": "https://www.columbus.gov",
        "school_district": "Columbus City Schools",
        "zip_codes": [
            "43201", "43202", "43203", "43204", "43205", "43206", "43207",
            "43209", "43210", "43211", "43212", "43213", "43214", "43215",
            "43219", "43220", "43221", "43222", "43223", "43224", "43227",
            "43228", "43229", "43230", "43231", "43232",
        ],
    },
}

# Redfin data URL
REDFIN_DATA_URL = (
    "https://redfin-public-data.s3.us-west-2.amazonaws.com/"
    "redfin_market_tracker/city_market_tracker.tsv000.gz"
)

# FRED API
FRED_API_BASE = "https://api.stlouisfed.org/fred/series/observations"
FRED_SERIES = {
    "mortgage_30yr": "MORTGAGE30US",
    "ohio_hpi": "OHSTHPI",
}
