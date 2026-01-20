"""
Base Court Monitor for TD Realty Seller Intelligence

Abstract base class for all court monitoring modules. Provides common functionality
for fetching court records, parsing data, and matching to property records.
"""

import abc
import logging
import re
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple
from difflib import SequenceMatcher

from scripts.sync.sheets_sync import SheetsClient, get_sheets_client
from scripts.utils.address_utils import normalize_address

logger = logging.getLogger(__name__)


class LifeEvent:
    """Represents a life event detected from court records."""

    def __init__(
        self,
        event_type: str,
        event_date: date,
        case_number: str,
        court: str,
        parties: str,
        address: Optional[str] = None,
        source_url: Optional[str] = None,
        raw_data: Optional[Dict] = None
    ):
        self.event_type = event_type
        self.event_date = event_date
        self.case_number = case_number
        self.court = court
        self.parties = parties
        self.address = address
        self.source_url = source_url
        self.raw_data = raw_data or {}

        # Matching fields (set after matching)
        self.matched_parcel_id: Optional[str] = None
        self.match_confidence: str = 'UNMATCHED'
        self.owner_name: Optional[str] = None
        self.propensity_score: Optional[float] = None
        self.estimated_equity: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API calls."""
        return {
            'event_type': self.event_type,
            'event_date': self.event_date.isoformat() if self.event_date else '',
            'case_number': self.case_number,
            'court': self.court,
            'parties': self.parties,
            'address': self.address or '',
            'matched_parcel_id': self.matched_parcel_id or '',
            'match_confidence': self.match_confidence,
            'owner_name': self.owner_name or '',
            'propensity_score': self.propensity_score,
            'estimated_equity': self.estimated_equity,
            'source_url': self.source_url or '',
            'raw_data': self.raw_data
        }


class BaseCourtMonitor(abc.ABC):
    """
    Abstract base class for court monitoring modules.

    Each court monitor subclass implements fetching from a specific court
    system and parsing the relevant case types.
    """

    # Event type constant - override in subclasses
    EVENT_TYPE = 'UNKNOWN'
    COURT_NAME = 'Unknown Court'

    def __init__(
        self,
        sheets_client: Optional[SheetsClient] = None,
        lookback_days: int = 1,
        dry_run: bool = False
    ):
        """
        Initialize the court monitor.

        Args:
            sheets_client: SheetsClient instance. Created if not provided.
            lookback_days: Number of days to look back for new filings.
            dry_run: If True, don't write to Sheets.
        """
        self.sheets_client = sheets_client or get_sheets_client()
        self.lookback_days = lookback_days
        self.dry_run = dry_run
        self._property_cache: Optional[List[Dict]] = None

    @abc.abstractmethod
    def fetch_new_cases(self, start_date: date, end_date: date) -> List[LifeEvent]:
        """
        Fetch new case filings from the court system.

        Args:
            start_date: Start of date range to search.
            end_date: End of date range to search.

        Returns:
            List of LifeEvent objects for new filings.
        """
        pass

    def get_property_cache(self) -> List[Dict]:
        """
        Load properties from Master Properties sheet for matching.

        Returns:
            List of property records.
        """
        if self._property_cache is None:
            logger.info("Loading property cache from Master Properties...")
            self._property_cache = self.sheets_client.read_sheet('Master Properties')
            logger.info(f"Loaded {len(self._property_cache)} properties")
        return self._property_cache

    def match_event_to_property(self, event: LifeEvent) -> bool:
        """
        Try to match a life event to a property in the database.

        Uses multiple matching strategies:
        1. Address match (if address is in the filing)
        2. Owner name match (fuzzy matching)

        Args:
            event: LifeEvent to match.

        Returns:
            True if a match was found, False otherwise.
        """
        properties = self.get_property_cache()

        best_match = None
        best_score = 0.0
        match_type = None

        # Strategy 1: Address matching
        if event.address:
            normalized_event_addr = normalize_address(event.address)
            for prop in properties:
                prop_addr = normalize_address(prop.get('address', ''))
                if prop_addr and normalized_event_addr:
                    # Check for exact match
                    if prop_addr == normalized_event_addr:
                        best_match = prop
                        best_score = 1.0
                        match_type = 'ADDRESS_EXACT'
                        break

                    # Check for fuzzy match
                    similarity = SequenceMatcher(None, prop_addr, normalized_event_addr).ratio()
                    if similarity > best_score and similarity >= 0.85:
                        best_match = prop
                        best_score = similarity
                        match_type = 'ADDRESS_FUZZY'

        # Strategy 2: Owner name matching
        if not best_match and event.parties:
            event_parties_lower = event.parties.lower()
            for prop in properties:
                owner_name = prop.get('owner_name', '').lower()
                if not owner_name:
                    continue

                # Extract last name from owner
                owner_parts = owner_name.replace(',', ' ').split()
                for part in owner_parts:
                    if len(part) >= 3 and part in event_parties_lower:
                        # Partial name match - need more confidence
                        similarity = SequenceMatcher(None, owner_name, event_parties_lower).ratio()
                        if similarity > best_score and similarity >= 0.6:
                            best_match = prop
                            best_score = similarity
                            match_type = 'NAME_FUZZY'

        # Apply match results
        if best_match:
            event.matched_parcel_id = best_match.get('parcel_id')
            event.owner_name = best_match.get('owner_name')
            event.propensity_score = best_match.get('propensity_score')
            event.estimated_equity = best_match.get('estimated_equity')

            # Set confidence based on match type and score
            if match_type == 'ADDRESS_EXACT':
                event.match_confidence = 'HIGH'
            elif match_type == 'ADDRESS_FUZZY' and best_score >= 0.95:
                event.match_confidence = 'HIGH'
            elif match_type in ['ADDRESS_FUZZY', 'NAME_FUZZY']:
                event.match_confidence = 'MEDIUM'
            else:
                event.match_confidence = 'LOW'

            logger.info(
                f"Matched event {event.case_number} to property {event.matched_parcel_id} "
                f"({match_type}, confidence: {event.match_confidence}, score: {best_score:.2f})"
            )
            return True

        logger.debug(f"No match found for event {event.case_number}")
        return False

    def save_events(self, events: List[LifeEvent]) -> int:
        """
        Save life events to Google Sheets.

        Args:
            events: List of LifeEvent objects to save.

        Returns:
            Number of events saved.
        """
        if self.dry_run:
            logger.info(f"[DRY RUN] Would save {len(events)} events")
            return 0

        saved = 0
        for event in events:
            try:
                self.sheets_client._call_api('add_life_event', {
                    'event': event.to_dict()
                })
                saved += 1
            except Exception as e:
                logger.error(f"Failed to save event {event.case_number}: {e}")

        return saved

    def run(self) -> Dict[str, Any]:
        """
        Execute the court monitoring workflow.

        Returns:
            Summary of the run with counts and any errors.
        """
        start_time = datetime.now()

        # Calculate date range
        end_date = date.today()
        start_date = end_date - timedelta(days=self.lookback_days)

        logger.info(
            f"Running {self.COURT_NAME} monitor for {self.EVENT_TYPE} "
            f"from {start_date} to {end_date}"
        )

        result = {
            'event_type': self.EVENT_TYPE,
            'court': self.COURT_NAME,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'events_found': 0,
            'events_matched': 0,
            'events_saved': 0,
            'errors': []
        }

        try:
            # Fetch new cases
            events = self.fetch_new_cases(start_date, end_date)
            result['events_found'] = len(events)
            logger.info(f"Found {len(events)} new {self.EVENT_TYPE} events")

            # Match to properties
            for event in events:
                try:
                    if self.match_event_to_property(event):
                        result['events_matched'] += 1
                except Exception as e:
                    logger.error(f"Error matching event {event.case_number}: {e}")
                    result['errors'].append(f"Match error: {e}")

            # Save events
            result['events_saved'] = self.save_events(events)

            # Log run
            duration = (datetime.now() - start_time).total_seconds()
            status = 'success' if not result['errors'] else 'partial'

            if not self.dry_run:
                self.sheets_client.log_run(
                    f"{self.EVENT_TYPE.lower()}_monitor",
                    status,
                    result['events_found'],
                    '; '.join(result['errors'][:3]) if result['errors'] else ''
                )

            result['duration_seconds'] = duration
            result['status'] = status

        except Exception as e:
            logger.exception(f"Court monitor failed: {e}")
            result['status'] = 'error'
            result['errors'].append(str(e))

        return result


def parse_name_from_case_title(title: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract party names from a case title.

    Common formats:
    - "SMITH, JOHN vs SMITH, JANE" (divorce)
    - "IN RE: ESTATE OF JONES, MARY" (probate)
    - "BANK OF AMERICA vs WILLIAMS, ROBERT" (foreclosure)

    Args:
        title: Case title string.

    Returns:
        Tuple of (petitioner, respondent) names, or (None, None) if not parseable.
    """
    if not title:
        return (None, None)

    title = title.upper().strip()

    # Handle "IN RE:" format (probate)
    in_re_match = re.search(r'IN RE:?\s*(?:ESTATE OF\s*)?(.+)', title)
    if in_re_match:
        return (in_re_match.group(1).strip(), None)

    # Handle "vs" or "v." format
    vs_patterns = [' VS ', ' V. ', ' VS. ', ' V ']
    for pattern in vs_patterns:
        if pattern in title:
            parts = title.split(pattern)
            if len(parts) == 2:
                return (parts[0].strip(), parts[1].strip())

    return (title, None)


def extract_address_from_text(text: str) -> Optional[str]:
    """
    Try to extract a street address from free text.

    Args:
        text: Text that may contain an address.

    Returns:
        Extracted address or None.
    """
    if not text:
        return None

    # Common Ohio address patterns
    # Look for number + street name + street type
    pattern = r'\b(\d+\s+[A-Za-z0-9\s]+(?:ST|STREET|AVE|AVENUE|DR|DRIVE|RD|ROAD|LN|LANE|CT|COURT|BLVD|WAY|PL|PLACE|TRL|TRAIL|CIR|CIRCLE))\b'

    match = re.search(pattern, text.upper())
    if match:
        return match.group(1).strip()

    return None
