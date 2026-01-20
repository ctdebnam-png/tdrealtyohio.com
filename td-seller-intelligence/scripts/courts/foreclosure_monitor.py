"""
Foreclosure Court Monitor for TD Realty Seller Intelligence

Monitors Franklin County Common Pleas Court for foreclosure filings.
Homeowners in foreclosure may want to sell before the sheriff sale to
preserve equity and avoid the credit damage of a foreclosure.

Data Sources:
- Franklin County Common Pleas: https://www.fccourts.org/
- Franklin County Sheriff Sales: https://sheriff.franklincountyohio.gov/
"""

import logging
import re
from datetime import date, datetime
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup

from scripts.courts.base_monitor import BaseCourtMonitor, LifeEvent, extract_address_from_text

logger = logging.getLogger(__name__)


class ForeclosureMonitor(BaseCourtMonitor):
    """
    Monitor Franklin County for foreclosure activity.

    Tracks:
    - New foreclosure filings (Common Pleas Court)
    - Sheriff sale listings
    - Pre-foreclosure notices

    Pre-foreclosure homeowners have 3-12 months to sell before the
    sheriff sale, making them highly motivated sellers.
    """

    EVENT_TYPE = 'FORECLOSURE'
    COURT_NAME = 'Franklin County Common Pleas'

    # Court and sheriff sale endpoints
    COURT_URL = 'https://www.fccourts.org'
    SHERIFF_URL = 'https://sheriff.franklincountyohio.gov/Sales/Real-Estate'

    # Case type codes for foreclosure
    CASE_TYPES = ['FC', 'CV']  # Foreclosure, Civil (some foreclosures filed as CV)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def fetch_new_cases(self, start_date: date, end_date: date) -> List[LifeEvent]:
        """
        Fetch new foreclosure filings and sheriff sale listings.

        Args:
            start_date: Start of date range.
            end_date: End of date range.

        Returns:
            List of LifeEvent objects for foreclosure activity.
        """
        events = []

        # Fetch from court records
        try:
            court_events = self._fetch_court_filings(start_date, end_date)
            events.extend(court_events)
        except Exception as e:
            logger.warning(f"Court filing fetch failed: {e}")

        # Fetch upcoming sheriff sales (these have property addresses!)
        try:
            sheriff_events = self._fetch_sheriff_sales()
            events.extend(sheriff_events)
        except Exception as e:
            logger.warning(f"Sheriff sale fetch failed: {e}")

        # Deduplicate by case number
        seen = set()
        unique_events = []
        for event in events:
            if event.case_number not in seen:
                seen.add(event.case_number)
                unique_events.append(event)

        return unique_events

    def _fetch_court_filings(self, start_date: date, end_date: date) -> List[LifeEvent]:
        """
        Fetch foreclosure filings from Common Pleas Court.
        """
        events = []

        # Franklin County Common Pleas case search
        search_url = f"{self.COURT_URL}/CaseSearch"

        try:
            params = {
                'caseType': 'FORECLOSURE',
                'filedFrom': start_date.strftime('%m/%d/%Y'),
                'filedTo': end_date.strftime('%m/%d/%Y')
            }

            logger.info(f"Searching foreclosure filings from {start_date} to {end_date}")

            response = self.session.get(search_url, params=params, timeout=30)

            if response.status_code == 200:
                events = self._parse_court_results(response.text)
                logger.info(f"Found {len(events)} foreclosure court filings")

        except Exception as e:
            logger.error(f"Court search failed: {e}")

        return events

    def _parse_court_results(self, html: str) -> List[LifeEvent]:
        """Parse foreclosure court search results."""
        events = []
        soup = BeautifulSoup(html, 'lxml')

        case_rows = soup.select('tr.case-row, .case-result, [class*="foreclosure"]')

        for row in case_rows:
            try:
                event = self._parse_foreclosure_case(row)
                if event:
                    events.append(event)
            except Exception as e:
                logger.debug(f"Failed to parse case: {e}")

        return events

    def _parse_foreclosure_case(self, elem) -> Optional[LifeEvent]:
        """Parse a single foreclosure case."""
        case_num_elem = elem.select_one('.case-number, a[href*="case"], td:first-child')
        if not case_num_elem:
            return None

        case_number = case_num_elem.get_text(strip=True)

        # Extract parties (Bank vs Homeowner)
        parties_elem = elem.select_one('.parties, .case-parties, td:nth-child(2)')
        parties = parties_elem.get_text(strip=True) if parties_elem else ''

        # Extract homeowner from "vs" format
        if ' vs ' in parties.lower() or ' v. ' in parties.lower():
            parts = re.split(r'\s+(?:vs\.?|v\.)\s+', parties, flags=re.I)
            if len(parts) >= 2:
                # Homeowner is usually the defendant (second party)
                parties = parts[1].strip()

        # Extract filing date
        date_elem = elem.select_one('.file-date, .filed, td:nth-child(3)')
        date_str = date_elem.get_text(strip=True) if date_elem else ''
        event_date = self._parse_date(date_str) or date.today()

        # Look for property address
        full_text = elem.get_text()
        address = extract_address_from_text(full_text)

        return LifeEvent(
            event_type=self.EVENT_TYPE,
            event_date=event_date,
            case_number=case_number,
            court=self.COURT_NAME,
            parties=parties,
            address=address,
            source_url=None,
            raw_data={
                'source': 'court_filing',
                'text': full_text[:500]
            }
        )

    def _fetch_sheriff_sales(self) -> List[LifeEvent]:
        """
        Fetch upcoming sheriff sale listings.

        Sheriff sales are goldmines because they include the full property
        address and are scheduled weeks in advance.
        """
        events = []

        try:
            logger.info("Fetching sheriff sale listings...")

            response = self.session.get(self.SHERIFF_URL, timeout=30)

            if response.status_code == 200:
                events = self._parse_sheriff_sales(response.text)
                logger.info(f"Found {len(events)} sheriff sale listings")

        except Exception as e:
            logger.error(f"Sheriff sale fetch failed: {e}")

        return events

    def _parse_sheriff_sales(self, html: str) -> List[LifeEvent]:
        """Parse sheriff sale listings page."""
        events = []
        soup = BeautifulSoup(html, 'lxml')

        # Sheriff sales typically list properties in a table or list format
        sale_items = soup.select('.sale-item, .property-listing, tr.sale-row, .auction-item')

        for item in sale_items:
            try:
                event = self._parse_sheriff_sale(item)
                if event:
                    events.append(event)
            except Exception as e:
                logger.debug(f"Failed to parse sheriff sale: {e}")

        return events

    def _parse_sheriff_sale(self, elem) -> Optional[LifeEvent]:
        """Parse a single sheriff sale listing."""
        # Sheriff sales prominently display the property address
        address_elem = elem.select_one('.address, .property-address, strong, h3')
        if not address_elem:
            return None

        address = address_elem.get_text(strip=True)

        # Extract case number
        case_elem = elem.select_one('.case-number, .case-no')
        case_number = case_elem.get_text(strip=True) if case_elem else f"SS-{address[:20]}"

        # Extract sale date
        date_elem = elem.select_one('.sale-date, .auction-date')
        sale_date_str = date_elem.get_text(strip=True) if date_elem else ''
        event_date = self._parse_date(sale_date_str) or date.today()

        # Extract defendant/owner name
        owner_elem = elem.select_one('.defendant, .owner, .party')
        parties = owner_elem.get_text(strip=True) if owner_elem else ''

        # Extract appraisal value if available
        appraisal = None
        appraisal_elem = elem.select_one('.appraisal, .value, .min-bid')
        if appraisal_elem:
            appraisal_text = appraisal_elem.get_text(strip=True)
            match = re.search(r'\$?([\d,]+)', appraisal_text)
            if match:
                appraisal = float(match.group(1).replace(',', ''))

        return LifeEvent(
            event_type=self.EVENT_TYPE,
            event_date=event_date,
            case_number=case_number,
            court='Franklin County Sheriff',
            parties=parties,
            address=address,
            source_url=self.SHERIFF_URL,
            raw_data={
                'source': 'sheriff_sale',
                'appraisal_value': appraisal,
                'sale_type': 'sheriff_sale'
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
            '%B %d, %Y',
            '%b %d, %Y',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue

        return None


def run_foreclosure_monitor(
    lookback_days: int = 7,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run the foreclosure monitor.

    Args:
        lookback_days: Days to look back for new filings.
        dry_run: If True, don't write to Sheets.

    Returns:
        Summary of the monitoring run.
    """
    monitor = ForeclosureMonitor(lookback_days=lookback_days, dry_run=dry_run)
    return monitor.run()


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Monitor Franklin County foreclosures')
    parser.add_argument('--lookback', type=int, default=7, help='Days to look back')
    parser.add_argument('--dry-run', action='store_true', help='Do not write to Sheets')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_foreclosure_monitor(
        lookback_days=args.lookback,
        dry_run=args.dry_run
    )

    print(f"\nForeclosure Monitor Results:")
    print(f"  Events found: {result['events_found']}")
    print(f"  Events matched: {result['events_matched']}")
    print(f"  Events saved: {result['events_saved']}")
    if result.get('errors'):
        print(f"  Errors: {result['errors']}")
