"""
Probate Court Monitor for TD Realty Seller Intelligence

Monitors Franklin County Probate Court for estate filings.
Inherited properties are frequently sold by heirs who don't want to manage them.

Data Sources:
- Franklin County Probate Court: https://probate.franklincountyohio.gov/
- Ohio Probate Court Records
"""

import logging
import re
from datetime import date, datetime
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup

from scripts.courts.base_monitor import (
    BaseCourtMonitor,
    LifeEvent,
    extract_address_from_text,
    parse_name_from_case_title
)

logger = logging.getLogger(__name__)


class ProbateMonitor(BaseCourtMonitor):
    """
    Monitor Franklin County Probate Court for estate filings.

    Tracks:
    - Estate administration (decedent estates)
    - Trusts (when property is involved)
    - Land sales through probate

    Inherited properties often sell within 12 months of probate filing.
    """

    EVENT_TYPE = 'PROBATE'
    COURT_NAME = 'Franklin County Probate Court'

    # Franklin County Probate Court endpoints
    BASE_URL = 'https://probate.franklincountyohio.gov'
    SEARCH_URL = 'https://probate.franklincountyohio.gov/CaseSearch'

    # Case type codes for probate
    CASE_TYPES = ['EST', 'TRU', 'GDN']  # Estate, Trust, Guardianship

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def fetch_new_cases(self, start_date: date, end_date: date) -> List[LifeEvent]:
        """
        Fetch new probate filings from Franklin County Probate Court.

        Args:
            start_date: Start of date range.
            end_date: End of date range.

        Returns:
            List of LifeEvent objects for new filings.
        """
        events = []

        try:
            # Try direct probate court search
            events = self._fetch_from_probate_court(start_date, end_date)
        except Exception as e:
            logger.warning(f"Probate court fetch failed: {e}")
            try:
                # Try alternative data source
                events = self._fetch_from_obituaries(start_date, end_date)
            except Exception as e2:
                logger.error(f"Alternative fetch also failed: {e2}")

        return events

    def _fetch_from_probate_court(self, start_date: date, end_date: date) -> List[LifeEvent]:
        """
        Fetch from Franklin County Probate Court public portal.
        """
        events = []

        try:
            # Search for estate cases
            search_params = {
                'caseType': 'EST',
                'filedFrom': start_date.strftime('%m/%d/%Y'),
                'filedTo': end_date.strftime('%m/%d/%Y')
            }

            logger.info(f"Searching Probate Court from {start_date} to {end_date}")

            response = self.session.get(
                self.SEARCH_URL,
                params=search_params,
                timeout=30
            )

            if response.status_code == 200:
                events = self._parse_probate_results(response.text)
                logger.info(f"Found {len(events)} probate cases")
            else:
                logger.warning(f"Probate search returned status {response.status_code}")

        except requests.RequestException as e:
            logger.error(f"Probate court request failed: {e}")
            raise

        return events

    def _parse_probate_results(self, html: str) -> List[LifeEvent]:
        """Parse probate court search results."""
        events = []
        soup = BeautifulSoup(html, 'lxml')

        # Look for case listings
        case_elements = soup.select('.case-row, .probate-case, tr[class*="case"]')

        for elem in case_elements:
            try:
                event = self._parse_probate_case(elem)
                if event:
                    events.append(event)
            except Exception as e:
                logger.debug(f"Failed to parse probate case: {e}")

        return events

    def _parse_probate_case(self, elem) -> Optional[LifeEvent]:
        """Parse a single probate case element."""
        # Extract case number
        case_num = elem.select_one('.case-number, .caseNo, a[href*="case"]')
        if not case_num:
            return None

        case_number = case_num.get_text(strip=True)

        # Extract decedent name (parties)
        name_elem = elem.select_one('.decedent, .party-name, .case-title')
        if name_elem:
            parties = name_elem.get_text(strip=True)
            # Clean up "IN RE: ESTATE OF" prefix
            parties = re.sub(r'^IN RE:?\s*(ESTATE OF\s*)?', '', parties, flags=re.I)
        else:
            parties = ''

        # Extract filing date
        date_elem = elem.select_one('.filed-date, .date, td:nth-child(3)')
        date_str = date_elem.get_text(strip=True) if date_elem else ''
        event_date = self._parse_date(date_str) or date.today()

        # Look for property address in case details
        address = None
        full_text = elem.get_text()
        address = extract_address_from_text(full_text)

        # Check for real property indicators
        has_real_property = any(keyword in full_text.lower() for keyword in [
            'real estate', 'real property', 'land', 'house', 'residence', 'property'
        ])

        # Build source URL
        link = case_num.get('href') if case_num.name == 'a' else None
        source_url = f"{self.BASE_URL}{link}" if link and link.startswith('/') else link

        return LifeEvent(
            event_type=self.EVENT_TYPE,
            event_date=event_date,
            case_number=case_number,
            court=self.COURT_NAME,
            parties=parties,
            address=address,
            source_url=source_url,
            raw_data={
                'has_real_property': has_real_property,
                'case_type': 'EST',
                'text_snippet': full_text[:500]
            }
        )

    def _fetch_from_obituaries(self, start_date: date, end_date: date) -> List[LifeEvent]:
        """
        Alternative: Cross-reference with local obituaries.

        Obituaries often list the deceased's residence, which can be
        matched to property records before probate is even filed.

        Note: This is a supplementary source, not a replacement for
        court records.
        """
        events = []

        # Obituary sources for Columbus area
        obit_sources = [
            'https://www.legacy.com/obituaries/dispatch/',
            'https://www.dispatch.com/obituaries/'
        ]

        # This would scrape obituaries and extract:
        # - Deceased name
        # - City/neighborhood of residence
        # - Age (for demographic analysis)
        # - Date of death

        logger.info("Obituary scraping not implemented - requires specific site parsing")

        return events

    def _parse_date(self, date_str: str) -> Optional[date]:
        """Parse date from court records."""
        if not date_str:
            return None

        formats = [
            '%m/%d/%Y',
            '%m-%d-%Y',
            '%Y-%m-%d',
            '%B %d, %Y',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue

        return None


def run_probate_monitor(
    lookback_days: int = 7,  # Probate filings are less frequent, check weekly
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run the probate court monitor.

    Args:
        lookback_days: Days to look back for new filings.
        dry_run: If True, don't write to Sheets.

    Returns:
        Summary of the monitoring run.
    """
    monitor = ProbateMonitor(lookback_days=lookback_days, dry_run=dry_run)
    return monitor.run()


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Monitor Franklin County Probate Court')
    parser.add_argument('--lookback', type=int, default=7, help='Days to look back')
    parser.add_argument('--dry-run', action='store_true', help='Do not write to Sheets')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_probate_monitor(
        lookback_days=args.lookback,
        dry_run=args.dry_run
    )

    print(f"\nProbate Monitor Results:")
    print(f"  Events found: {result['events_found']}")
    print(f"  Events matched: {result['events_matched']}")
    print(f"  Events saved: {result['events_saved']}")
    if result.get('errors'):
        print(f"  Errors: {result['errors']}")
