"""
Eviction Court Monitor for TD Realty Seller Intelligence

Monitors Franklin County Municipal Court for eviction filings.
Landlords facing problem tenants may be motivated to sell their
investment properties, especially if they're dealing with repeat issues.

Data Sources:
- Franklin County Municipal Court: https://www.fcmcclerk.com/
- Ohio Eviction Records
"""

import logging
import re
from datetime import date, datetime
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup

from scripts.courts.base_monitor import BaseCourtMonitor, LifeEvent, extract_address_from_text

logger = logging.getLogger(__name__)


class EvictionMonitor(BaseCourtMonitor):
    """
    Monitor Franklin County Municipal Court for eviction filings.

    Tracks:
    - Forcible entry and detainer (eviction) cases
    - Property addresses where evictions occur

    Useful for:
    - Identifying stressed landlords who may want to sell
    - Flagging potential investor-owned properties
    - Understanding rental market conditions by neighborhood
    """

    EVENT_TYPE = 'EVICTION'
    COURT_NAME = 'Franklin County Municipal Court'

    # Franklin County Municipal Court endpoints
    BASE_URL = 'https://www.fcmcclerk.com'
    SEARCH_URL = 'https://www.fcmcclerk.com/case/search'

    # Case type for evictions
    CASE_TYPES = ['CVG']  # Civil General - includes evictions

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def fetch_new_cases(self, start_date: date, end_date: date) -> List[LifeEvent]:
        """
        Fetch new eviction filings from Franklin County Municipal Court.

        Args:
            start_date: Start of date range.
            end_date: End of date range.

        Returns:
            List of LifeEvent objects for new eviction filings.
        """
        events = []

        try:
            events = self._fetch_eviction_cases(start_date, end_date)
        except Exception as e:
            logger.warning(f"Eviction case fetch failed: {e}")

        return events

    def _fetch_eviction_cases(self, start_date: date, end_date: date) -> List[LifeEvent]:
        """
        Fetch eviction cases from municipal court.
        """
        events = []

        try:
            # Franklin County Municipal Court case search
            params = {
                'caseType': 'CVG',  # Civil General (includes evictions)
                'caseSubType': 'FED',  # Forcible Entry and Detainer
                'filedFrom': start_date.strftime('%m/%d/%Y'),
                'filedTo': end_date.strftime('%m/%d/%Y')
            }

            logger.info(f"Searching eviction cases from {start_date} to {end_date}")

            response = self.session.get(self.SEARCH_URL, params=params, timeout=30)

            if response.status_code == 200:
                events = self._parse_eviction_results(response.text)
                logger.info(f"Found {len(events)} eviction cases")
            else:
                logger.warning(f"Municipal court search returned status {response.status_code}")

        except Exception as e:
            logger.error(f"Eviction search failed: {e}")

        return events

    def _parse_eviction_results(self, html: str) -> List[LifeEvent]:
        """Parse eviction case search results."""
        events = []
        soup = BeautifulSoup(html, 'lxml')

        # Look for case listings
        case_rows = soup.select('tr.case-row, .search-result, .case-item')

        for row in case_rows:
            try:
                event = self._parse_eviction_case(row)
                if event:
                    events.append(event)
            except Exception as e:
                logger.debug(f"Failed to parse eviction case: {e}")

        return events

    def _parse_eviction_case(self, elem) -> Optional[LifeEvent]:
        """Parse a single eviction case."""
        # Extract case number
        case_num_elem = elem.select_one('.case-number, a[href*="case"], td:first-child')
        if not case_num_elem:
            return None

        case_number = case_num_elem.get_text(strip=True)

        # Skip if it doesn't look like an eviction case
        full_text = elem.get_text().lower()
        eviction_keywords = ['eviction', 'forcible', 'detainer', 'fed', 'possession']
        if not any(kw in full_text for kw in eviction_keywords):
            # May still be eviction, but filter out obvious non-evictions
            if 'small claims' in full_text or 'traffic' in full_text:
                return None

        # Extract parties (Landlord vs Tenant)
        parties_elem = elem.select_one('.parties, .case-parties, td:nth-child(2)')
        parties = parties_elem.get_text(strip=True) if parties_elem else ''

        # For evictions, plaintiff is usually the landlord
        landlord = parties
        if ' vs ' in parties.lower() or ' v. ' in parties.lower():
            parts = re.split(r'\s+(?:vs\.?|v\.)\s+', parties, flags=re.I)
            if len(parts) >= 1:
                landlord = parts[0].strip()  # Plaintiff/landlord is first

        # Extract filing date
        date_elem = elem.select_one('.file-date, .filed-date, td:nth-child(3)')
        date_str = date_elem.get_text(strip=True) if date_elem else ''
        event_date = self._parse_date(date_str) or date.today()

        # Property address - eviction cases often include the rental property address
        address = None
        address_patterns = [
            r'property[:\s]+([^,\n]+)',
            r'premises[:\s]+([^,\n]+)',
            r'located at[:\s]+([^,\n]+)',
        ]
        for pattern in address_patterns:
            match = re.search(pattern, full_text, re.I)
            if match:
                address = match.group(1).strip()
                break

        if not address:
            address = extract_address_from_text(elem.get_text())

        # Build source URL
        link = case_num_elem.get('href') if case_num_elem.name == 'a' else None
        source_url = f"{self.BASE_URL}{link}" if link and link.startswith('/') else link

        return LifeEvent(
            event_type=self.EVENT_TYPE,
            event_date=event_date,
            case_number=case_number,
            court=self.COURT_NAME,
            parties=landlord,  # Store landlord name as main party
            address=address,
            source_url=source_url,
            raw_data={
                'full_parties': parties,  # Keep full parties string
                'case_type': 'FED',
                'text': elem.get_text()[:500]
            }
        )

    def _parse_date(self, date_str: str) -> Optional[date]:
        """Parse date from various formats."""
        if not date_str:
            return None

        formats = [
            '%m/%d/%Y',
            '%m-%d-%Y',
            '%Y-%m-%d',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue

        return None


def run_eviction_monitor(
    lookback_days: int = 7,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run the eviction monitor.

    Args:
        lookback_days: Days to look back for new filings.
        dry_run: If True, don't write to Sheets.

    Returns:
        Summary of the monitoring run.
    """
    monitor = EvictionMonitor(lookback_days=lookback_days, dry_run=dry_run)
    return monitor.run()


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Monitor Franklin County evictions')
    parser.add_argument('--lookback', type=int, default=7, help='Days to look back')
    parser.add_argument('--dry-run', action='store_true', help='Do not write to Sheets')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_eviction_monitor(
        lookback_days=args.lookback,
        dry_run=args.dry_run
    )

    print(f"\nEviction Monitor Results:")
    print(f"  Events found: {result['events_found']}")
    print(f"  Events matched: {result['events_matched']}")
    print(f"  Events saved: {result['events_saved']}")
    if result.get('errors'):
        print(f"  Errors: {result['errors']}")
