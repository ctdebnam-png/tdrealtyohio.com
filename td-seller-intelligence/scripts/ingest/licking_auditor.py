"""
Licking County Property Data Ingester for TD Realty Seller Intelligence

Fetches residential property data from the Licking County Auditor's website.
Licking County is east of Franklin County and includes Newark and surrounding areas.

Data Source:
- Licking County Auditor: https://www.lcounty.com/auditor/
- GIS/Parcel Search: https://lickingcounty.gov/search
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


class LickingCountyIngester:
    """
    Ingests residential property data from Licking County Auditor.
    """

    COUNTY_NAME = 'Licking'

    # Licking County endpoints
    BASE_URL = 'https://www.lcounty.com'
    AUDITOR_URL = 'https://www.lcounty.com/auditor'
    SEARCH_URL = 'https://lickingcounty.gov/search'

    # Target municipalities in our service area
    TARGET_CITIES = [
        'Newark', 'Heath', 'Granville', 'Pataskala', 'Johnstown',
        'Hebron', 'Buckeye Lake', 'Alexandria', 'Utica'
    ]

    # Residential property class codes
    RESIDENTIAL_CODES = ['R', 'RES', '510', '520', '530', '540', '550']

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
        Fetch properties for a specific city in Licking County.

        Args:
            city: City name to search.
            max_results: Maximum properties to return.

        Returns:
            List of property records.
        """
        properties = []
        logger.info(f"Fetching properties for {city}, Licking County")

        try:
            self.rate_limiter.wait()

            # Search by city
            search_params = {
                'city': city,
                'propertyType': 'residential',
                'maxResults': max_results
            }

            response = self.session.get(
                f'{self.SEARCH_URL}/properties',
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

        # Find property rows
        rows = soup.select('.property-row, tr.result, .parcel-item')

        for row in rows:
            try:
                prop = self._parse_property_row(row, city)
                if prop:
                    properties.append(prop)
            except Exception as e:
                logger.debug(f"Failed to parse row: {e}")

        return properties

    def _parse_property_row(self, row, city: str) -> Optional[Dict[str, Any]]:
        """Parse a single property row."""
        # Extract parcel ID
        parcel_elem = row.select_one('.parcel-id, .parcelNumber, td:first-child')
        if not parcel_elem:
            return None

        parcel_id = parcel_elem.get_text(strip=True)

        # Extract address
        address_elem = row.select_one('.address, .propertyAddress, td:nth-child(2)')
        address = address_elem.get_text(strip=True) if address_elem else ''

        # Extract owner
        owner_elem = row.select_one('.owner, .ownerName, td:nth-child(3)')
        owner_name = owner_elem.get_text(strip=True) if owner_elem else ''

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
            assessed_value=parse_currency(detail.get('assessed_value', '0')),
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
            response = self.session.get(
                f'{self.SEARCH_URL}/parcel/{parcel_id}',
                timeout=30
            )

            if response.status_code == 200:
                detail = self._parse_property_detail(response.text)

        except requests.RequestException as e:
            logger.debug(f"Failed to fetch detail for {parcel_id}: {e}")

        return detail

    def _parse_property_detail(self, html: str) -> Dict[str, Any]:
        """Parse property detail page."""
        detail = {}
        soup = BeautifulSoup(html, 'lxml')

        # Common field mappings
        field_map = {
            'Owner': 'owner_name',
            'Mailing Address': 'mailing_address',
            'Site Address': 'address',
            'City': 'city',
            'Zip': 'zip',
            'Property Class': 'property_class',
            'Year Built': 'year_built',
            'Living Area': 'sqft',
            'Bedrooms': 'bedrooms',
            'Bathrooms': 'bathrooms',
            'Total Assessed Value': 'assessed_value',
            'Sale Date': 'transfer_date',
            'Sale Price': 'sale_price'
        }

        # Try to find data in various formats
        for label_text, field_name in field_map.items():
            # Look for label/value pairs
            label = soup.find(string=re.compile(label_text, re.I))
            if label:
                # Value might be in next sibling, parent's next sibling, or a specific element
                value_elem = label.find_next(['td', 'span', 'div'])
                if value_elem:
                    detail[field_name] = value_elem.get_text(strip=True)

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
                    'licking_ingestion',
                    'success' if not result['errors'] else 'partial',
                    result['properties_written'],
                    '; '.join(result['errors'][:3])
                )

            except Exception as e:
                logger.error(f"Failed to write to Sheets: {e}")
                result['errors'].append(f"Sheets write: {e}")

        result['duration_seconds'] = (datetime.now() - start_time).total_seconds()
        return result


def run_licking_ingestion(
    cities: List[str] = None,
    max_per_city: int = 500,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run Licking County property ingestion.

    Args:
        cities: Cities to process.
        max_per_city: Max properties per city.
        dry_run: If True, don't write.

    Returns:
        Ingestion results.
    """
    ingester = LickingCountyIngester()
    return ingester.run_ingestion(cities, max_per_city, dry_run)


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Ingest Licking County property data')
    parser.add_argument('--cities', nargs='+', help='Cities to process')
    parser.add_argument('--max-per-city', type=int, default=500)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--verbose', '-v', action='store_true')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_licking_ingestion(
        cities=args.cities,
        max_per_city=args.max_per_city,
        dry_run=args.dry_run
    )

    print(f"\nLicking County Ingestion Results:")
    print(f"  Cities processed: {result['cities_processed']}")
    print(f"  Properties found: {result['properties_found']}")
    print(f"  Properties valid: {result['properties_valid']}")
    print(f"  Properties written: {result['properties_written']}")
    print(f"  Duration: {result['duration_seconds']:.1f}s")
