"""
Utility Functions for TD Realty Seller Intelligence

Helper functions for address normalization, date parsing, scoring calculations,
and other common operations.
"""

import re
import logging
from datetime import datetime, date
from typing import Optional, Tuple
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

# Neighborhood mapping based on city/ZIP combinations
# Maps (city, zip) or just zip to neighborhood name
NEIGHBORHOOD_MAP = {
    # Franklin County
    '43081': 'Westerville',
    '43082': 'Westerville',
    '43016': 'Dublin',
    '43017': 'Dublin',
    '43065': 'Powell',  # Can be Delaware or Franklin
    '43230': 'Gahanna',
    '43054': 'New Albany',
    '43026': 'Hilliard',
    '43220': 'Upper Arlington',
    '43221': 'Upper Arlington',
    '43085': 'Worthington',
    '43123': 'Grove City',
    '43147': 'Pickerington',
    '43004': 'Blacklick',
    '43202': 'Clintonville',
    '43214': 'Clintonville',
    # Delaware County
    '43015': 'Delaware',
    '43035': 'Lewis Center',
    '43074': 'Sunbury',
}

# Primary service area ZIPs
PRIMARY_SERVICE_ZIPS = set(NEIGHBORHOOD_MAP.keys())

# Adjacent area ZIPs (within service region but not primary targets)
ADJACENT_AREA_ZIPS = {
    '43201', '43203', '43204', '43205', '43206', '43207', '43209',
    '43210', '43211', '43212', '43213', '43215', '43217', '43219',
    '43222', '43223', '43224', '43227', '43228', '43229', '43231',
    '43232', '43235', '43240'
}

# Address normalization mappings
STREET_TYPE_MAP = {
    'avenue': 'AVE', 'ave': 'AVE', 'av': 'AVE',
    'boulevard': 'BLVD', 'blvd': 'BLVD',
    'circle': 'CIR', 'cir': 'CIR',
    'court': 'CT', 'ct': 'CT',
    'drive': 'DR', 'dr': 'DR', 'drv': 'DR',
    'highway': 'HWY', 'hwy': 'HWY',
    'lane': 'LN', 'ln': 'LN',
    'parkway': 'PKWY', 'pkwy': 'PKWY', 'pky': 'PKWY',
    'place': 'PL', 'pl': 'PL',
    'road': 'RD', 'rd': 'RD',
    'square': 'SQ', 'sq': 'SQ',
    'street': 'ST', 'st': 'ST', 'str': 'ST',
    'terrace': 'TER', 'ter': 'TER', 'terr': 'TER',
    'trail': 'TRL', 'trl': 'TRL',
    'way': 'WAY',
}

DIRECTION_MAP = {
    'north': 'N', 'n': 'N',
    'south': 'S', 's': 'S',
    'east': 'E', 'e': 'E',
    'west': 'W', 'w': 'W',
    'northeast': 'NE', 'ne': 'NE',
    'northwest': 'NW', 'nw': 'NW',
    'southeast': 'SE', 'se': 'SE',
    'southwest': 'SW', 'sw': 'SW',
}


def normalize_address(address: str) -> str:
    """
    Standardize address format for matching.

    Normalizes:
    - Uppercase everything
    - Standardize street types (Street -> ST, Avenue -> AVE)
    - Standardize directions (North -> N)
    - Remove extra whitespace
    - Remove apartment/unit numbers (for comparison purposes)

    Args:
        address: Raw address string.

    Returns:
        Normalized address string.
    """
    if not address:
        return ''

    # Convert to uppercase
    addr = address.upper().strip()

    # Remove common punctuation
    addr = re.sub(r'[.,#]', ' ', addr)

    # Split into words
    words = addr.split()

    # Process each word
    normalized_words = []
    skip_next = False

    for i, word in enumerate(words):
        if skip_next:
            skip_next = False
            continue

        word_lower = word.lower()

        # Check if it's a direction
        if word_lower in DIRECTION_MAP:
            normalized_words.append(DIRECTION_MAP[word_lower])
        # Check if it's a street type
        elif word_lower in STREET_TYPE_MAP:
            normalized_words.append(STREET_TYPE_MAP[word_lower])
        # Skip apartment/unit indicators and their values
        elif word_lower in ['apt', 'apartment', 'unit', 'suite', 'ste', '#', 'lot']:
            skip_next = True  # Skip the next word (unit number)
            continue
        else:
            normalized_words.append(word)

    return ' '.join(normalized_words)


def parse_date(date_string: str) -> Optional[date]:
    """
    Parse various date formats from county data.

    Handles:
    - MM/DD/YYYY
    - YYYY-MM-DD
    - MM-DD-YYYY
    - Month DD, YYYY

    Args:
        date_string: Date string in various formats.

    Returns:
        date object or None if parsing fails.
    """
    if not date_string or date_string in ['', 'N/A', 'None', 'null']:
        return None

    # Clean up the string
    date_string = str(date_string).strip()

    # List of formats to try
    formats = [
        '%m/%d/%Y',      # 01/15/2020
        '%Y-%m-%d',      # 2020-01-15
        '%m-%d-%Y',      # 01-15-2020
        '%B %d, %Y',     # January 15, 2020
        '%b %d, %Y',     # Jan 15, 2020
        '%Y/%m/%d',      # 2020/01/15
        '%d-%b-%Y',      # 15-Jan-2020
        '%m/%d/%y',      # 01/15/20
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_string, fmt).date()
        except ValueError:
            continue

    logger.warning(f"Could not parse date: {date_string}")
    return None


def calculate_years_owned(purchase_date: Optional[date]) -> float:
    """
    Calculate years owned from purchase date.

    Args:
        purchase_date: Date of purchase.

    Returns:
        Float representing years owned, or 0 if date is invalid.
    """
    if not purchase_date:
        return 0.0

    if isinstance(purchase_date, str):
        purchase_date = parse_date(purchase_date)
        if not purchase_date:
            return 0.0

    today = date.today()
    delta = today - purchase_date
    years = delta.days / 365.25

    return round(max(0, years), 2)


def is_owner_occupied(
    property_address: str,
    mailing_address: str,
    threshold: float = 0.85
) -> bool:
    """
    Determine if property is owner-occupied by comparing addresses.

    Uses fuzzy matching to handle minor variations in address formatting.

    Args:
        property_address: The property's physical address.
        mailing_address: The owner's mailing address.
        threshold: Similarity threshold (0-1) for considering a match.

    Returns:
        True if owner occupied, False otherwise.
    """
    if not property_address or not mailing_address:
        return False

    norm_property = normalize_address(property_address)
    norm_mailing = normalize_address(mailing_address)

    # Exact match
    if norm_property == norm_mailing:
        return True

    # Extract just the street address (first line) for comparison
    # This handles cases where mailing includes city/state but property doesn't
    prop_street = norm_property.split(',')[0].strip()
    mail_street = norm_mailing.split(',')[0].strip()

    if prop_street == mail_street:
        return True

    # Fuzzy match for minor variations
    similarity = SequenceMatcher(None, prop_street, mail_street).ratio()
    return similarity >= threshold


def map_city_to_neighborhood(city: str, zip_code: str) -> str:
    """
    Map city and ZIP code to a neighborhood name.

    Args:
        city: City name.
        zip_code: ZIP code.

    Returns:
        Neighborhood name.
    """
    # Clean up inputs
    zip_code = str(zip_code).strip()[:5] if zip_code else ''
    city = str(city).strip().title() if city else ''

    # First try ZIP code lookup
    if zip_code in NEIGHBORHOOD_MAP:
        return NEIGHBORHOOD_MAP[zip_code]

    # Fall back to city name
    if city:
        return city

    return 'Unknown'


def get_neighborhood_type(zip_code: str) -> str:
    """
    Determine if a ZIP is in primary, adjacent, or other service area.

    Args:
        zip_code: ZIP code to check.

    Returns:
        'primary', 'adjacent', or 'other'.
    """
    zip_code = str(zip_code).strip()[:5] if zip_code else ''

    if zip_code in PRIMARY_SERVICE_ZIPS:
        return 'primary'
    elif zip_code in ADJACENT_AREA_ZIPS:
        return 'adjacent'
    else:
        return 'other'


def parse_currency(value: str) -> float:
    """
    Parse a currency string to float.

    Args:
        value: Currency string (e.g., "$250,000.00" or "250000").

    Returns:
        Float value or 0.0 if parsing fails.
    """
    if not value:
        return 0.0

    try:
        # Remove currency symbols, commas, and whitespace
        cleaned = re.sub(r'[$,\s]', '', str(value))
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0


def parse_number(value: str) -> Optional[float]:
    """
    Parse a numeric string to float.

    Args:
        value: Numeric string.

    Returns:
        Float value or None if parsing fails.
    """
    if not value or str(value).strip() in ['', 'N/A', 'None', 'null', '-']:
        return None

    try:
        cleaned = re.sub(r'[,\s]', '', str(value))
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def parse_int(value: str) -> Optional[int]:
    """
    Parse a string to integer.

    Args:
        value: Numeric string.

    Returns:
        Integer value or None if parsing fails.
    """
    num = parse_number(value)
    return int(num) if num is not None else None


def calculate_equity(market_value: float, purchase_price: float) -> Tuple[float, float]:
    """
    Calculate estimated equity and equity gain percentage.

    Args:
        market_value: Current estimated market value.
        purchase_price: Original purchase price.

    Returns:
        Tuple of (estimated_equity, equity_gain_pct).
    """
    if not market_value or not purchase_price or purchase_price <= 0:
        return (0.0, 0.0)

    equity = market_value - purchase_price
    equity_pct = (equity / purchase_price) * 100

    return (round(equity, 2), round(equity_pct, 2))


def format_property_record(
    parcel_id: str,
    address: str,
    city: str,
    zip_code: str,
    county: str,
    owner_name: str,
    owner_mailing_address: str,
    purchase_date: str,
    purchase_price: float,
    assessed_value: float,
    beds: Optional[int] = None,
    baths: Optional[float] = None,
    sqft: Optional[int] = None,
    year_built: Optional[int] = None,
    property_class: str = '',
    market_value_multiplier: float = 1.1
) -> dict:
    """
    Format raw property data into the Master Properties schema.

    Args:
        parcel_id: Unique parcel identifier.
        address: Property street address.
        city: City name.
        zip_code: ZIP code.
        county: County name.
        owner_name: Property owner name.
        owner_mailing_address: Owner's mailing address.
        purchase_date: Date of last purchase/transfer.
        purchase_price: Purchase price.
        assessed_value: County assessed value.
        beds: Number of bedrooms.
        baths: Number of bathrooms.
        sqft: Square footage.
        year_built: Year the home was built.
        property_class: Property classification.
        market_value_multiplier: Multiplier for market value estimate.

    Returns:
        Dictionary matching Master Properties schema.
    """
    # Parse dates and calculate derived values
    parsed_date = parse_date(purchase_date)
    years_owned = calculate_years_owned(parsed_date)
    estimated_market_value = assessed_value * market_value_multiplier if assessed_value else 0

    # Calculate equity
    equity, equity_pct = calculate_equity(estimated_market_value, purchase_price)

    # Determine neighborhood and owner-occupied status
    neighborhood = map_city_to_neighborhood(city, zip_code)
    owner_occupied = is_owner_occupied(address, owner_mailing_address)

    return {
        'parcel_id': str(parcel_id).strip(),
        'address': address.strip() if address else '',
        'city': city.strip() if city else '',
        'zip': str(zip_code).strip()[:5] if zip_code else '',
        'county': county.strip() if county else '',
        'neighborhood': neighborhood,
        'owner_name': owner_name.strip() if owner_name else '',
        'owner_mailing_address': owner_mailing_address.strip() if owner_mailing_address else '',
        'is_owner_occupied': owner_occupied,
        'purchase_date': parsed_date.isoformat() if parsed_date else '',
        'purchase_price': purchase_price or 0,
        'years_owned': years_owned,
        'assessed_value': assessed_value or 0,
        'estimated_market_value': round(estimated_market_value, 2),
        'estimated_equity': equity,
        'equity_gain_pct': equity_pct,
        'beds': beds,
        'baths': baths,
        'sqft': sqft,
        'year_built': year_built,
        'property_class': property_class.strip() if property_class else '',
        'propensity_score': None,  # Calculated later
        'td_fit_score': None,      # Calculated later
        'priority_tier': None,     # Calculated later
        'last_updated': datetime.now().isoformat(),
    }


def validate_property_record(record: dict) -> Tuple[bool, list]:
    """
    Validate a property record has required fields.

    Args:
        record: Property record dictionary.

    Returns:
        Tuple of (is_valid, list of error messages).
    """
    errors = []

    # Required fields
    if not record.get('parcel_id'):
        errors.append("Missing parcel_id")
    if not record.get('address'):
        errors.append("Missing address")
    if not record.get('zip'):
        errors.append("Missing ZIP code")

    # Data quality checks
    if record.get('purchase_price', 0) < 0:
        errors.append("Negative purchase price")
    if record.get('assessed_value', 0) < 0:
        errors.append("Negative assessed value")

    year_built = record.get('year_built')
    if year_built and (year_built < 1800 or year_built > datetime.now().year + 1):
        errors.append(f"Invalid year_built: {year_built}")

    return (len(errors) == 0, errors)


def log_run(
    sheets_client,
    script_name: str,
    status: str,
    records_processed: int,
    errors: str = ""
) -> None:
    """
    Log a script run to the Run Log tab in Google Sheets.

    Args:
        sheets_client: Authenticated SheetsClient instance.
        script_name: Name of the script that ran.
        status: Status of the run ("success", "error", "partial").
        records_processed: Number of records processed.
        errors: Any error messages.
    """
    sheets_client.log_run(script_name, status, records_processed, errors)


class RateLimiter:
    """Simple rate limiter for web scraping."""

    def __init__(self, requests_per_second: float = 1.0):
        """
        Initialize rate limiter.

        Args:
            requests_per_second: Maximum requests per second.
        """
        self.min_interval = 1.0 / requests_per_second
        self.last_request = 0.0

    def wait(self) -> None:
        """Wait if necessary to respect rate limit."""
        import time
        now = time.time()
        elapsed = now - self.last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request = time.time()


if __name__ == "__main__":
    # Test utilities
    print("Testing address normalization:")
    test_addresses = [
        "123 Main Street",
        "456 Oak Avenue, Apt 2B",
        "789 North Elm Blvd",
        "321 SW Park Rd #5",
    ]
    for addr in test_addresses:
        print(f"  {addr} -> {normalize_address(addr)}")

    print("\nTesting date parsing:")
    test_dates = [
        "01/15/2020",
        "2020-01-15",
        "January 15, 2020",
        "15-Jan-2020",
    ]
    for d in test_dates:
        parsed = parse_date(d)
        print(f"  {d} -> {parsed}")

    print("\nTesting owner-occupied detection:")
    test_cases = [
        ("123 Main St", "123 Main Street"),
        ("456 Oak Ave", "789 Elm St"),
        ("100 Park Rd", "100 PARK ROAD"),
    ]
    for prop, mail in test_cases:
        result = is_owner_occupied(prop, mail)
        print(f"  Property: {prop}, Mailing: {mail} -> {result}")

    print("\nTesting neighborhood mapping:")
    test_zips = ['43081', '43016', '43015', '99999']
    for z in test_zips:
        print(f"  {z} -> {map_city_to_neighborhood('', z)} ({get_neighborhood_type(z)})")
