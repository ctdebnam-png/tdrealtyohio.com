"""
Franklin County Property Data Ingester

Fetches residential property data from Franklin County Auditor's office
and syncs it to Google Sheets.

Data sources (tried in order):
1. Franklin County GIS Open Data Portal
2. Franklin County Auditor Property Search
3. Direct web scraping with rate limiting

Target ZIP codes for Columbus metro area suburbs:
- Westerville: 43081, 43082
- Dublin: 43016, 43017
- Powell: 43065
- Gahanna: 43230
- New Albany: 43054
- Hilliard: 43026
- Upper Arlington: 43220, 43221
- Worthington: 43085
- Grove City: 43123
- Pickerington: 43147
- Blacklick: 43004
- Clintonville: 43202, 43214
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Generator
from urllib.parse import urljoin, urlencode

import requests
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.utils import (
    format_property_record,
    validate_property_record,
    parse_currency,
    parse_int,
    parse_date,
    RateLimiter,
)
from scripts.sheets_sync import (
    SheetsClient,
    get_sheets_client,
    MASTER_PROPERTIES_COLUMNS,
    TAB_MASTER_PROPERTIES,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Franklin County configuration
FRANKLIN_COUNTY_CONFIG = {
    'name': 'Franklin County',
    'auditor_url': 'https://apps.franklincountyauditor.com/',
    'gis_url': 'https://gis.franklincountyauditor.com/arcgis/rest/services/',
    'search_url': 'https://apps.franklincountyauditor.com/Properties/Search',
    'target_zips': [
        '43081', '43082',  # Westerville
        '43016', '43017',  # Dublin
        '43065',           # Powell
        '43230',           # Gahanna
        '43054',           # New Albany
        '43026',           # Hilliard
        '43220', '43221',  # Upper Arlington
        '43085',           # Worthington
        '43123',           # Grove City
        '43147',           # Pickerington
        '43004',           # Blacklick
        '43202', '43214',  # Clintonville
    ],
    'residential_classes': ['R', 'RESIDENTIAL', 'SINGLE FAMILY', 'CONDO', 'R1', 'R2', 'R3', 'R4'],
}

# Rate limiter - 1 request per second to be respectful
rate_limiter = RateLimiter(requests_per_second=1.0)

# Session for connection pooling
session = requests.Session()
session.headers.update({
    'User-Agent': 'TD Realty Property Research Bot (https://tdrealtyohio.com)',
    'Accept': 'application/json, text/html',
})


class FranklinCountyIngester:
    """Ingester for Franklin County property data."""

    def __init__(self, sheets_client: Optional[SheetsClient] = None):
        """
        Initialize the ingester.

        Args:
            sheets_client: Optional pre-configured SheetsClient.
        """
        self.sheets_client = sheets_client
        self.config = FRANKLIN_COUNTY_CONFIG
        self.processed = 0
        self.errors = []
        self.market_value_multiplier = 1.1  # Default, will be updated from config

    def load_config(self) -> None:
        """Load configuration from Google Sheets."""
        if self.sheets_client:
            try:
                config = self.sheets_client.get_config()
                self.market_value_multiplier = config.get('market_value_multiplier', 1.1)
                logger.info(f"Loaded config: market_value_multiplier={self.market_value_multiplier}")
            except Exception as e:
                logger.warning(f"Could not load config from Sheets, using defaults: {e}")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def fetch_gis_data(self, zip_code: str, offset: int = 0, limit: int = 100) -> Dict[str, Any]:
        """
        Fetch property data from Franklin County GIS ArcGIS REST API.

        Args:
            zip_code: Target ZIP code.
            offset: Result offset for pagination.
            limit: Number of records to fetch.

        Returns:
            Dictionary with 'features' list and pagination info.
        """
        rate_limiter.wait()

        # ArcGIS REST API endpoint for property data
        # Note: This URL pattern is typical for Ohio county GIS; actual endpoint may vary
        base_url = f"{self.config['gis_url']}Parcels/PropertyData/MapServer/0/query"

        params = {
            'where': f"ZIPCODE = '{zip_code}' AND CLASSCODE LIKE 'R%'",
            'outFields': '*',
            'returnGeometry': 'false',
            'f': 'json',
            'resultOffset': offset,
            'resultRecordCount': limit,
        }

        try:
            response = session.get(base_url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"GIS API request failed for ZIP {zip_code}: {e}")
            raise

    @retry(stop=after_attempt=3, wait=wait_exponential(multiplier=1, min=2, max=10))
    def fetch_property_search(self, zip_code: str, page: int = 1) -> List[Dict[str, Any]]:
        """
        Fetch property data by scraping the auditor's search page.

        This is a fallback method if the GIS API isn't available.

        Args:
            zip_code: Target ZIP code.
            page: Page number for pagination.

        Returns:
            List of property dictionaries.
        """
        rate_limiter.wait()

        search_url = f"{self.config['search_url']}"
        params = {
            'zip': zip_code,
            'propertyClass': 'R',  # Residential
            'page': page,
        }

        try:
            response = session.get(search_url, params=params, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'lxml')
            properties = self.parse_search_results(soup)
            return properties

        except requests.exceptions.RequestException as e:
            logger.error(f"Property search failed for ZIP {zip_code}: {e}")
            raise

    def parse_search_results(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        Parse property search results from HTML.

        Args:
            soup: BeautifulSoup object of search results page.

        Returns:
            List of property dictionaries.
        """
        properties = []

        # Look for property result table/cards
        # Note: This is a generic pattern; actual HTML structure may vary
        results = soup.find_all('div', class_=['property-result', 'property-card', 'search-result'])

        if not results:
            # Try table format
            results = soup.find_all('tr', class_=['property-row'])

        for result in results:
            try:
                property_data = self.parse_property_element(result)
                if property_data:
                    properties.append(property_data)
            except Exception as e:
                logger.warning(f"Failed to parse property element: {e}")
                continue

        return properties

    def parse_property_element(self, element: BeautifulSoup) -> Optional[Dict[str, Any]]:
        """
        Parse a single property element from search results.

        Args:
            element: BeautifulSoup element containing property data.

        Returns:
            Property dictionary or None if parsing fails.
        """
        # Generic parsing - actual implementation depends on page structure
        # This is a template that should be adjusted based on actual HTML

        def get_text(selector):
            el = element.select_one(selector)
            return el.get_text(strip=True) if el else ''

        parcel_id = get_text('[data-field="parcel"], .parcel-id, .parcel')
        address = get_text('[data-field="address"], .address, .property-address')

        if not parcel_id and not address:
            return None

        return {
            'parcel_id': parcel_id,
            'address': address,
            'city': get_text('[data-field="city"], .city'),
            'zip': get_text('[data-field="zip"], .zip'),
            'owner_name': get_text('[data-field="owner"], .owner-name'),
            'owner_mailing': get_text('[data-field="mailing"], .mailing-address'),
            'transfer_date': get_text('[data-field="transfer-date"], .sale-date'),
            'transfer_price': get_text('[data-field="transfer-price"], .sale-price'),
            'assessed_value': get_text('[data-field="assessed"], .assessed-value'),
            'beds': get_text('[data-field="beds"], .bedrooms'),
            'baths': get_text('[data-field="baths"], .bathrooms'),
            'sqft': get_text('[data-field="sqft"], .square-feet'),
            'year_built': get_text('[data-field="year-built"], .year-built'),
            'property_class': get_text('[data-field="class"], .property-class'),
        }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def fetch_property_detail(self, parcel_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch detailed property information by parcel ID.

        Args:
            parcel_id: The parcel identifier.

        Returns:
            Property detail dictionary or None.
        """
        rate_limiter.wait()

        detail_url = f"{self.config['auditor_url']}Properties/{parcel_id}"

        try:
            response = session.get(detail_url, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'lxml')
            return self.parse_property_detail(soup, parcel_id)

        except requests.exceptions.RequestException as e:
            logger.warning(f"Failed to fetch details for {parcel_id}: {e}")
            return None

    def parse_property_detail(self, soup: BeautifulSoup, parcel_id: str) -> Dict[str, Any]:
        """
        Parse property detail page.

        Args:
            soup: BeautifulSoup object of detail page.
            parcel_id: The parcel identifier.

        Returns:
            Property detail dictionary.
        """
        def get_value(labels: List[str]) -> str:
            """Find value by label text."""
            for label in labels:
                label_el = soup.find(string=lambda t: t and label.lower() in t.lower())
                if label_el:
                    # Look for adjacent value element
                    parent = label_el.find_parent(['tr', 'div', 'dl'])
                    if parent:
                        value_el = parent.find(['td', 'span', 'dd'], class_=['value', 'data'])
                        if value_el:
                            return value_el.get_text(strip=True)
                        # Try next sibling
                        next_el = label_el.find_next(['td', 'span', 'dd'])
                        if next_el:
                            return next_el.get_text(strip=True)
            return ''

        return {
            'parcel_id': parcel_id,
            'address': get_value(['Property Address', 'Site Address', 'Location']),
            'city': get_value(['City', 'Municipality']),
            'zip': get_value(['Zip', 'ZIP Code', 'Postal Code']),
            'owner_name': get_value(['Owner Name', 'Owner', 'Property Owner']),
            'owner_mailing': get_value(['Mailing Address', 'Owner Address']),
            'transfer_date': get_value(['Transfer Date', 'Sale Date', 'Last Sale']),
            'transfer_price': get_value(['Transfer Price', 'Sale Price', 'Sale Amount']),
            'assessed_value': get_value(['Assessed Value', 'Total Value', 'Market Value']),
            'beds': get_value(['Bedrooms', 'Beds', 'BR']),
            'baths': get_value(['Bathrooms', 'Baths', 'BA', 'Full Baths']),
            'sqft': get_value(['Square Feet', 'Sq Ft', 'Living Area', 'Total Sq Ft']),
            'year_built': get_value(['Year Built', 'Built', 'Year']),
            'property_class': get_value(['Property Class', 'Class', 'Use Code']),
        }

    def transform_property(self, raw_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Transform raw property data to Master Properties schema.

        Args:
            raw_data: Raw property data from scraping/API.

        Returns:
            Transformed property record or None if invalid.
        """
        try:
            # Handle both GIS API format and scraping format
            if 'attributes' in raw_data:
                # GIS ArcGIS format
                attrs = raw_data['attributes']
                record = format_property_record(
                    parcel_id=attrs.get('PARCELID', attrs.get('PIN', '')),
                    address=attrs.get('ADDRESS', attrs.get('SITEADDR', '')),
                    city=attrs.get('CITY', ''),
                    zip_code=attrs.get('ZIPCODE', attrs.get('ZIP', '')),
                    county='Franklin',
                    owner_name=attrs.get('OWNER', attrs.get('OWNERNAME', '')),
                    owner_mailing_address=attrs.get('MAILADDR', attrs.get('MAILINGADDRESS', '')),
                    purchase_date=attrs.get('TRANSFERDATE', attrs.get('SALEDATE', '')),
                    purchase_price=parse_currency(attrs.get('TRANSFERPRICE', attrs.get('SALEPRICE', 0))),
                    assessed_value=parse_currency(attrs.get('TOTALVALUE', attrs.get('MARKETVALUE', 0))),
                    beds=parse_int(attrs.get('BEDROOMS', attrs.get('BEDS'))),
                    baths=parse_int(attrs.get('BATHROOMS', attrs.get('BATHS'))),
                    sqft=parse_int(attrs.get('SQFT', attrs.get('LIVINGAREA'))),
                    year_built=parse_int(attrs.get('YEARBUILT', attrs.get('YEAR'))),
                    property_class=attrs.get('CLASSCODE', attrs.get('USECODE', '')),
                    market_value_multiplier=self.market_value_multiplier,
                )
            else:
                # Web scraping format
                record = format_property_record(
                    parcel_id=raw_data.get('parcel_id', ''),
                    address=raw_data.get('address', ''),
                    city=raw_data.get('city', ''),
                    zip_code=raw_data.get('zip', ''),
                    county='Franklin',
                    owner_name=raw_data.get('owner_name', ''),
                    owner_mailing_address=raw_data.get('owner_mailing', ''),
                    purchase_date=raw_data.get('transfer_date', ''),
                    purchase_price=parse_currency(raw_data.get('transfer_price', '0')),
                    assessed_value=parse_currency(raw_data.get('assessed_value', '0')),
                    beds=parse_int(raw_data.get('beds')),
                    baths=parse_int(raw_data.get('baths')),
                    sqft=parse_int(raw_data.get('sqft')),
                    year_built=parse_int(raw_data.get('year_built')),
                    property_class=raw_data.get('property_class', ''),
                    market_value_multiplier=self.market_value_multiplier,
                )

            # Validate
            is_valid, errors = validate_property_record(record)
            if not is_valid:
                logger.warning(f"Invalid record for {record.get('parcel_id')}: {errors}")
                return None

            return record

        except Exception as e:
            logger.error(f"Failed to transform property data: {e}")
            return None

    def fetch_all_properties(self) -> Generator[Dict[str, Any], None, None]:
        """
        Fetch all properties from target ZIP codes.

        Yields:
            Property records one at a time.
        """
        for zip_code in self.config['target_zips']:
            logger.info(f"Fetching properties for ZIP {zip_code}...")

            try:
                # Try GIS API first
                offset = 0
                limit = 100
                total_for_zip = 0

                while True:
                    try:
                        data = self.fetch_gis_data(zip_code, offset, limit)
                        features = data.get('features', [])

                        if not features:
                            break

                        for feature in features:
                            record = self.transform_property(feature)
                            if record:
                                yield record
                                total_for_zip += 1

                        # Check if there are more results
                        if len(features) < limit:
                            break

                        offset += limit

                    except Exception as e:
                        logger.warning(f"GIS API failed, falling back to web scraping: {e}")
                        # Fall back to web scraping
                        for record in self.fetch_via_scraping(zip_code):
                            yield record
                            total_for_zip += 1
                        break

                logger.info(f"Fetched {total_for_zip} properties for ZIP {zip_code}")

            except Exception as e:
                error_msg = f"Failed to fetch ZIP {zip_code}: {e}"
                logger.error(error_msg)
                self.errors.append(error_msg)

    def fetch_via_scraping(self, zip_code: str) -> Generator[Dict[str, Any], None, None]:
        """
        Fetch properties via web scraping as fallback.

        Args:
            zip_code: Target ZIP code.

        Yields:
            Property records.
        """
        page = 1
        max_pages = 100  # Safety limit

        while page <= max_pages:
            try:
                properties = self.fetch_property_search(zip_code, page)

                if not properties:
                    break

                for prop in properties:
                    record = self.transform_property(prop)
                    if record:
                        yield record

                page += 1

            except Exception as e:
                logger.error(f"Scraping failed for ZIP {zip_code} page {page}: {e}")
                break

    def run(self, dry_run: bool = False) -> Dict[str, Any]:
        """
        Run the full ingestion process.

        Args:
            dry_run: If True, don't write to Sheets, just log.

        Returns:
            Summary of the run.
        """
        start_time = datetime.now()
        logger.info("Starting Franklin County property ingestion...")

        # Initialize Sheets client if not provided
        if not self.sheets_client and not dry_run:
            self.sheets_client = get_sheets_client()

        # Load configuration
        self.load_config()

        # Collect all properties
        properties = []
        for record in self.fetch_all_properties():
            properties.append(record)
            self.processed += 1

            # Log progress every 100 records
            if self.processed % 100 == 0:
                logger.info(f"Processed {self.processed} properties...")

        logger.info(f"Total properties collected: {len(properties)}")

        # Write to Google Sheets
        if properties and not dry_run:
            try:
                # Convert to rows format
                rows = [MASTER_PROPERTIES_COLUMNS]  # Header
                for prop in properties:
                    row = [prop.get(col, '') for col in MASTER_PROPERTIES_COLUMNS]
                    # Convert booleans to strings for Sheets
                    row = [str(v) if isinstance(v, bool) else v for v in row]
                    rows.append(row)

                # Use update_rows to merge with existing data
                result = self.sheets_client.update_rows(
                    TAB_MASTER_PROPERTIES,
                    properties,
                    'parcel_id',
                    MASTER_PROPERTIES_COLUMNS
                )
                logger.info(f"Sheets sync complete: {result}")

            except Exception as e:
                error_msg = f"Failed to write to Sheets: {e}"
                logger.error(error_msg)
                self.errors.append(error_msg)

        # Log the run
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        status = 'success' if not self.errors else ('partial' if properties else 'error')
        error_summary = '; '.join(self.errors[:5])  # First 5 errors

        if self.sheets_client and not dry_run:
            self.sheets_client.log_run(
                'ingest_franklin.py',
                status,
                len(properties),
                error_summary
            )

        summary = {
            'status': status,
            'records_processed': len(properties),
            'duration_seconds': duration,
            'errors': self.errors,
        }

        logger.info(f"Ingestion complete: {summary}")
        return summary


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Ingest Franklin County property data')
    parser.add_argument('--dry-run', action='store_true', help='Run without writing to Sheets')
    parser.add_argument('--zip', type=str, help='Process only a specific ZIP code')
    args = parser.parse_args()

    ingester = FranklinCountyIngester()

    if args.zip:
        ingester.config['target_zips'] = [args.zip]

    result = ingester.run(dry_run=args.dry_run)

    # Exit with error code if failed
    if result['status'] == 'error':
        sys.exit(1)


if __name__ == '__main__':
    main()
