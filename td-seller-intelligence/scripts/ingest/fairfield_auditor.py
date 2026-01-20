"""
Fairfield County Property Data Ingester for TD Realty Seller Intelligence

Fetches residential property data from the Fairfield County Auditor's website.
Fairfield County is southeast of Franklin County and includes Lancaster and
surrounding areas.

Data Source:
- Fairfield County Auditor: https://www.fairfieldcountyauditor.org/
- Real Estate Search: https://www.fairfieldcountyauditor.org/real-estate/
"""

import logging
import re
import time
from datetime import datetime
from typing import List, Dict, Any, Optional

import requests
from bs4 import BeautifulSoup

from scripts.sync.sheets_sync import SheetsClient, get_sheets_client
from scripts.utils.address_utils import (
    format_property_record,
    validate_property_record,
    parse_currency,
    parse_date,
    parse_int,
    RateLimiter
)

logger = logging.getLogger(__name__)


class FairfieldCountyIngester:
    """
    Ingests residential property data from Fairfield County Auditor.
    """

    COUNTY_NAME = 'Fairfield'

    # Fairfield County endpoints
    BASE_URL = 'https://www.fairfieldcountyauditor.org'
    SEARCH_URL = 'https://www.fairfieldcountyauditor.org/real-estate/search'

    # Target municipalities in our service area
    TARGET_CITIES = [
        'Lancaster', 'Pickerington', 'Canal Winchester', 'Carroll',
        'Baltimore', 'Lithopolis', 'Amanda', 'Rushville', 'Bremen'
    ]

    # Note: Pickerington spans Franklin and Fairfield counties

    # Residential property class codes
    RESIDENTIAL_CODES = ['R', 'RES', '510', '520', '530']

    def __init__(
        self,
        sheets_client: Optional[SheetsClient] = None,
        requests_per_second: float = 0.5
    ):
        self.sheets_client = sheets_client or get_sheets_client()
        self.rate_limiter = RateLimiter(requests_per_second)

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def fetch_properties_by_city(
        self,
        city: str,
        max_results: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Fetch properties for a specific city in Fairfield County.

        Args:
            city: City name to search.
            max_results: Maximum properties to return.

        Returns:
            List of property records.
        """
        properties = []
        logger.info(f"Fetching properties for {city}, Fairfield County")

        try:
            self.rate_limiter.wait()

            # Search by city
            search_params = {
                'city': city,
                'type': 'residential',
                'limit': max_results
            }

            response = self.session.get(
                self.SEARCH_URL,
                params=search_params,
                timeout=60
            )

            if response.status_code == 200:
                properties = self._parse_search_results(response.text, city)
                logger.info(f"Found {len(properties)} properties in {city}")

        except requests.RequestException as e:
            logger.error(f"Failed to fetch {city}: {e}")

        return properties

    def _parse_search_results(self, html: str, city: str) -> List[Dict[str, Any]]:
        """Parse property search results page."""
        properties = []
        soup = BeautifulSoup(html, 'lxml')

        # Find property rows in table
        rows = soup.select('table.property-results tr, .property-card, .search-result')

        for row in rows:
            try:
                # Skip header rows
                if row.find('th'):
                    continue

                prop = self._parse_property_row(row, city)
                if prop:
                    properties.append(prop)
            except Exception as e:
                logger.debug(f"Failed to parse row: {e}")

        return properties

    def _parse_property_row(self, row, city: str) -> Optional[Dict[str, Any]]:
        """Parse a single property row."""
        cells = row.find_all('td')
        if len(cells) < 3:
            # Try alternate selectors
            parcel_elem = row.select_one('.parcel-number, [data-parcel]')
            if not parcel_elem:
                return None
            parcel_id = parcel_elem.get_text(strip=True) or parcel_elem.get('data-parcel', '')
        else:
            parcel_id = cells[0].get_text(strip=True)

        if not parcel_id:
            return None

        # Extract other fields
        address = ''
        owner_name = ''
        assessed_value = '0'

        if len(cells) >= 4:
            address = cells[1].get_text(strip=True)
            owner_name = cells[2].get_text(strip=True)
            assessed_value = cells[3].get_text(strip=True)
        else:
            address_elem = row.select_one('.address, .site-address')
            owner_elem = row.select_one('.owner, .owner-name')
            value_elem = row.select_one('.value, .assessed-value')

            address = address_elem.get_text(strip=True) if address_elem else ''
            owner_name = owner_elem.get_text(strip=True) if owner_elem else ''
            assessed_value = value_elem.get_text(strip=True) if value_elem else '0'

        # Get detailed property info
        detail = self._fetch_property_detail(parcel_id)

        # Extract ZIP from address or detail
        zip_code = detail.get('zip', '')
        if not zip_code:
            zip_match = re.search(r'\b(\d{5})\b', address)
            if zip_match:
                zip_code = zip_match.group(1)

        return format_property_record(
            parcel_id=parcel_id,
            address=detail.get('address', address),
            city=detail.get('city', city),
            zip_code=zip_code,
            county=self.COUNTY_NAME,
            owner_name=detail.get('owner_name', owner_name),
            owner_mailing_address=detail.get('mailing_address', ''),
            purchase_date=detail.get('transfer_date', ''),
            purchase_price=parse_currency(detail.get('sale_price', '0')),
            assessed_value=parse_currency(detail.get('assessed_value', assessed_value)),
            beds=parse_int(detail.get('bedrooms')),
            baths=detail.get('bathrooms'),
            sqft=parse_int(detail.get('sqft')),
            year_built=parse_int(detail.get('year_built')),
            property_class=detail.get('property_class', '')
        )

    def _fetch_property_detail(self, parcel_id: str) -> Dict[str, Any]:
        """
        Fetch detailed property information.

        Args:
            parcel_id: Parcel ID to look up.

        Returns:
            Dict with property details.
        """
        self.rate_limiter.wait()
        detail = {}

        try:
            # Fairfield County property detail URL
            detail_url = f'{self.BASE_URL}/real-estate/parcel/{parcel_id}'

            response = self.session.get(detail_url, timeout=30)

            if response.status_code == 200:
                detail = self._parse_property_detail(response.text)

        except requests.RequestException as e:
            logger.debug(f"Failed to fetch detail for {parcel_id}: {e}")

        return detail

    def _parse_property_detail(self, html: str) -> Dict[str, Any]:
        """Parse property detail page."""
        detail = {}
        soup = BeautifulSoup(html, 'lxml')

        # Common field mappings for Fairfield County
        field_map = {
            'Owner Name': 'owner_name',
            'Owner': 'owner_name',
            'Mailing Address': 'mailing_address',
            'Property Address': 'address',
            'Site Address': 'address',
            'City': 'city',
            'Zip Code': 'zip',
            'Class': 'property_class',
            'Property Class': 'property_class',
            'Year Built': 'year_built',
            'Square Feet': 'sqft',
            'Living Area': 'sqft',
            'Bedrooms': 'bedrooms',
            'Full Baths': 'full_baths',
            'Half Baths': 'half_baths',
            'Total Value': 'assessed_value',
            'Assessed Value': 'assessed_value',
            'Last Sale Date': 'transfer_date',
            'Transfer Date': 'transfer_date',
            'Sale Price': 'sale_price',
            'Last Sale Price': 'sale_price'
        }

        # Parse data tables
        for label_text, field_name in field_map.items():
            # Look for label/value pairs in tables and divs
            label = soup.find(string=re.compile(f'^{re.escape(label_text)}', re.I))
            if label:
                parent = label.find_parent(['tr', 'div', 'dl'])
                if parent:
                    value_elem = parent.find(['td', 'span', 'dd'], class_=lambda x: x != 'label')
                    if value_elem and value_elem != label.parent:
                        detail[field_name] = value_elem.get_text(strip=True)

        # Calculate total bathrooms
        full_baths = parse_int(detail.get('full_baths', '0')) or 0
        half_baths = parse_int(detail.get('half_baths', '0')) or 0
        if full_baths or half_baths:
            detail['bathrooms'] = full_baths + (half_baths * 0.5)

        return detail

    def run_ingestion(
        self,
        cities: List[str] = None,
        max_per_city: int = 500,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Run the property ingestion process.

        Args:
            cities: List of cities to ingest (default: TARGET_CITIES).
            max_per_city: Max properties per city.
            dry_run: If True, don't write to Sheets.

        Returns:
            Summary of ingestion results.
        """
        cities = cities or self.TARGET_CITIES
        start_time = datetime.now()

        result = {
            'county': self.COUNTY_NAME,
            'cities_processed': 0,
            'properties_found': 0,
            'properties_valid': 0,
            'properties_written': 0,
            'errors': []
        }

        all_properties = []

        for city in cities:
            try:
                props = self.fetch_properties_by_city(city, max_per_city)
                result['properties_found'] += len(props)

                for prop in props:
                    is_valid, errors = validate_property_record(prop)
                    if is_valid:
                        all_properties.append(prop)
                        result['properties_valid'] += 1
                    else:
                        logger.debug(f"Invalid property: {errors}")

                result['cities_processed'] += 1

            except Exception as e:
                logger.error(f"Error processing {city}: {e}")
                result['errors'].append(f"{city}: {e}")

        # Write to Google Sheets
        if all_properties and not dry_run:
            try:
                write_result = self.sheets_client.update_rows(
                    'Master Properties',
                    all_properties,
                    'parcel_id',
                    list(all_properties[0].keys())
                )
                result['properties_written'] = (
                    write_result.get('updated', 0) + write_result.get('inserted', 0)
                )

                # Log run
                self.sheets_client.log_run(
                    'fairfield_ingestion',
                    'success' if not result['errors'] else 'partial',
                    result['properties_written'],
                    '; '.join(result['errors'][:3])
                )

            except Exception as e:
                logger.error(f"Failed to write to Sheets: {e}")
                result['errors'].append(f"Sheets write: {e}")

        result['duration_seconds'] = (datetime.now() - start_time).total_seconds()
        return result


def run_fairfield_ingestion(
    cities: List[str] = None,
    max_per_city: int = 500,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run Fairfield County property ingestion.

    Args:
        cities: Cities to process.
        max_per_city: Max properties per city.
        dry_run: If True, don't write.

    Returns:
        Ingestion results.
    """
    ingester = FairfieldCountyIngester()
    return ingester.run_ingestion(cities, max_per_city, dry_run)


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Ingest Fairfield County property data')
    parser.add_argument('--cities', nargs='+', help='Cities to process')
    parser.add_argument('--max-per-city', type=int, default=500)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--verbose', '-v', action='store_true')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_fairfield_ingestion(
        cities=args.cities,
        max_per_city=args.max_per_city,
        dry_run=args.dry_run
    )

    print(f"\nFairfield County Ingestion Results:")
    print(f"  Cities processed: {result['cities_processed']}")
    print(f"  Properties found: {result['properties_found']}")
    print(f"  Properties valid: {result['properties_valid']}")
    print(f"  Properties written: {result['properties_written']}")
    print(f"  Duration: {result['duration_seconds']:.1f}s")
