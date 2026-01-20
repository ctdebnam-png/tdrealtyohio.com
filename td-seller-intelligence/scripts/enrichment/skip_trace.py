"""
Skip Trace Integration for TD Realty Seller Intelligence

Integrates with skip tracing services to find owner contact information
(phone numbers, emails) for leads that need outreach.

Supported Services:
- BatchSkipTracing: https://batchskiptracing.com/
- PropStream (backup): https://www.propstream.com/

Note: API keys are required for these services. Configure in Config tab
or environment variables.
"""

import logging
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from scripts.sync.sheets_sync import SheetsClient, get_sheets_client

logger = logging.getLogger(__name__)


class SkipTraceResult:
    """Container for skip trace results."""

    def __init__(
        self,
        parcel_id: str,
        owner_name: str,
        phones: List[str] = None,
        emails: List[str] = None,
        confidence: str = 'UNKNOWN',
        source: str = '',
        raw_data: Dict = None
    ):
        self.parcel_id = parcel_id
        self.owner_name = owner_name
        self.phones = phones or []
        self.emails = emails or []
        self.confidence = confidence
        self.source = source
        self.raw_data = raw_data or {}
        self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            'parcel_id': self.parcel_id,
            'owner_name': self.owner_name,
            'phone_1': self.phones[0] if self.phones else '',
            'phone_2': self.phones[1] if len(self.phones) > 1 else '',
            'email_1': self.emails[0] if self.emails else '',
            'email_2': self.emails[1] if len(self.emails) > 1 else '',
            'skip_trace_status': self.confidence,
            'skip_trace_date': self.timestamp,
            'skip_trace_source': self.source
        }


class BaseSkipTraceProvider(ABC):
    """Abstract base class for skip trace providers."""

    PROVIDER_NAME = 'Base'

    @abstractmethod
    def trace_single(self, name: str, address: str, city: str, state: str, zip_code: str) -> Optional[SkipTraceResult]:
        """Trace a single individual."""
        pass

    @abstractmethod
    def trace_batch(self, records: List[Dict]) -> List[SkipTraceResult]:
        """Trace a batch of records."""
        pass


class BatchSkipTracingProvider(BaseSkipTraceProvider):
    """
    Integration with BatchSkipTracing.com API.

    BatchSkipTracing specializes in real estate skip tracing with
    high hit rates for property owners.
    """

    PROVIDER_NAME = 'BatchSkipTracing'
    API_BASE = 'https://api.batchskiptracing.com/v1'

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('BATCH_SKIP_TRACE_API_KEY')
        if not self.api_key:
            logger.warning("BatchSkipTracing API key not configured")

        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        })

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def trace_single(
        self,
        name: str,
        address: str,
        city: str,
        state: str,
        zip_code: str,
        parcel_id: str = ''
    ) -> Optional[SkipTraceResult]:
        """
        Skip trace a single property owner.

        Args:
            name: Owner's full name.
            address: Property street address.
            city: City.
            state: State (2-letter code).
            zip_code: ZIP code.
            parcel_id: Parcel ID for tracking.

        Returns:
            SkipTraceResult or None if not found.
        """
        if not self.api_key:
            logger.error("No API key configured for BatchSkipTracing")
            return None

        payload = {
            'full_name': name,
            'street_address': address,
            'city': city,
            'state': state,
            'zip': zip_code
        }

        try:
            response = self.session.post(
                f'{self.API_BASE}/skip/single',
                json=payload,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()

            if data.get('status') == 'success' and data.get('data'):
                result_data = data['data']
                return SkipTraceResult(
                    parcel_id=parcel_id,
                    owner_name=name,
                    phones=self._extract_phones(result_data),
                    emails=self._extract_emails(result_data),
                    confidence=self._assess_confidence(result_data),
                    source=self.PROVIDER_NAME,
                    raw_data=result_data
                )

        except requests.RequestException as e:
            logger.error(f"Skip trace request failed: {e}")

        return None

    def trace_batch(self, records: List[Dict]) -> List[SkipTraceResult]:
        """
        Skip trace a batch of property owners.

        More cost-effective than individual traces for large volumes.

        Args:
            records: List of dicts with name, address, city, state, zip, parcel_id.

        Returns:
            List of SkipTraceResult objects.
        """
        if not self.api_key:
            logger.error("No API key configured for BatchSkipTracing")
            return []

        # Format batch payload
        batch_records = []
        for rec in records:
            batch_records.append({
                'full_name': rec.get('owner_name', ''),
                'street_address': rec.get('address', ''),
                'city': rec.get('city', ''),
                'state': rec.get('state', 'OH'),
                'zip': rec.get('zip', ''),
                'reference_id': rec.get('parcel_id', '')  # For matching results
            })

        try:
            response = self.session.post(
                f'{self.API_BASE}/skip/batch',
                json={'records': batch_records},
                timeout=120
            )
            response.raise_for_status()

            data = response.json()
            results = []

            if data.get('status') == 'success' and data.get('data'):
                for item in data['data']:
                    parcel_id = item.get('reference_id', '')
                    owner_name = item.get('full_name', '')

                    result = SkipTraceResult(
                        parcel_id=parcel_id,
                        owner_name=owner_name,
                        phones=self._extract_phones(item),
                        emails=self._extract_emails(item),
                        confidence=self._assess_confidence(item),
                        source=self.PROVIDER_NAME,
                        raw_data=item
                    )
                    results.append(result)

            return results

        except requests.RequestException as e:
            logger.error(f"Batch skip trace failed: {e}")
            return []

    def _extract_phones(self, data: Dict) -> List[str]:
        """Extract and clean phone numbers from response."""
        phones = []

        # Check common phone fields
        phone_fields = ['phone1', 'phone2', 'phone3', 'mobile', 'landline', 'phones']

        for field in phone_fields:
            value = data.get(field)
            if isinstance(value, str) and value:
                phones.append(self._format_phone(value))
            elif isinstance(value, list):
                for p in value[:3]:  # Max 3 phones
                    if p:
                        phones.append(self._format_phone(str(p)))

        # Deduplicate while preserving order
        seen = set()
        unique_phones = []
        for p in phones:
            if p and p not in seen:
                seen.add(p)
                unique_phones.append(p)

        return unique_phones[:2]  # Return max 2 phones

    def _extract_emails(self, data: Dict) -> List[str]:
        """Extract emails from response."""
        emails = []

        email_fields = ['email1', 'email2', 'email', 'emails']

        for field in email_fields:
            value = data.get(field)
            if isinstance(value, str) and '@' in value:
                emails.append(value.lower())
            elif isinstance(value, list):
                for e in value[:2]:
                    if e and '@' in str(e):
                        emails.append(str(e).lower())

        # Deduplicate
        return list(dict.fromkeys(emails))[:2]

    def _format_phone(self, phone: str) -> str:
        """Format phone number to standard format."""
        import re
        digits = re.sub(r'\D', '', phone)
        if len(digits) == 10:
            return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == '1':
            return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
        return phone

    def _assess_confidence(self, data: Dict) -> str:
        """Assess confidence level of skip trace result."""
        # Check for multiple data points
        has_phone = bool(data.get('phone1') or data.get('phones'))
        has_email = bool(data.get('email1') or data.get('email'))
        verification = data.get('verification_status', '').lower()

        if verification == 'verified':
            return 'HIGH'
        elif has_phone and has_email:
            return 'MEDIUM'
        elif has_phone or has_email:
            return 'LOW'
        else:
            return 'NO_CONTACT'


class PropStreamProvider(BaseSkipTraceProvider):
    """
    Integration with PropStream API.

    PropStream provides property data and owner contact information.
    Used as a backup/supplement to BatchSkipTracing.
    """

    PROVIDER_NAME = 'PropStream'
    API_BASE = 'https://api.propstream.com/v2'

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('PROPSTREAM_API_KEY')
        if not self.api_key:
            logger.warning("PropStream API key not configured")

        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        })

    def trace_single(
        self,
        name: str,
        address: str,
        city: str,
        state: str,
        zip_code: str,
        parcel_id: str = ''
    ) -> Optional[SkipTraceResult]:
        """Skip trace via PropStream."""
        if not self.api_key:
            return None

        try:
            # PropStream uses property-based lookup
            params = {
                'address': address,
                'city': city,
                'state': state,
                'zip': zip_code
            }

            response = self.session.get(
                f'{self.API_BASE}/property/lookup',
                params=params,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()
            if data.get('property'):
                prop = data['property']
                owner_info = prop.get('owner', {})

                return SkipTraceResult(
                    parcel_id=parcel_id,
                    owner_name=owner_info.get('name', name),
                    phones=[owner_info.get('phone', '')] if owner_info.get('phone') else [],
                    emails=[owner_info.get('email', '')] if owner_info.get('email') else [],
                    confidence='MEDIUM',
                    source=self.PROVIDER_NAME,
                    raw_data=data
                )

        except requests.RequestException as e:
            logger.error(f"PropStream request failed: {e}")

        return None

    def trace_batch(self, records: List[Dict]) -> List[SkipTraceResult]:
        """PropStream batch is done sequentially for simplicity."""
        results = []
        for rec in records:
            result = self.trace_single(
                name=rec.get('owner_name', ''),
                address=rec.get('address', ''),
                city=rec.get('city', ''),
                state=rec.get('state', 'OH'),
                zip_code=rec.get('zip', ''),
                parcel_id=rec.get('parcel_id', '')
            )
            if result:
                results.append(result)
        return results


class SkipTraceManager:
    """
    Manages skip tracing across multiple providers.

    Handles provider selection, rate limiting, cost tracking,
    and result storage to Google Sheets.
    """

    def __init__(
        self,
        sheets_client: Optional[SheetsClient] = None,
        primary_provider: str = 'batchskiptracing'
    ):
        self.sheets_client = sheets_client or get_sheets_client()

        # Initialize providers
        self.providers = {}

        if primary_provider == 'batchskiptracing':
            self.providers['primary'] = BatchSkipTracingProvider()
            self.providers['backup'] = PropStreamProvider()
        else:
            self.providers['primary'] = PropStreamProvider()
            self.providers['backup'] = BatchSkipTracingProvider()

    def trace_leads(
        self,
        leads: List[Dict],
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Skip trace a list of leads and update Master Properties.

        Args:
            leads: List of property dicts to skip trace.
            dry_run: If True, don't write results.

        Returns:
            Summary of the skip trace operation.
        """
        result = {
            'total': len(leads),
            'traced': 0,
            'found_contact': 0,
            'no_contact': 0,
            'errors': []
        }

        if not leads:
            return result

        logger.info(f"Skip tracing {len(leads)} leads...")

        # Use batch API for efficiency
        provider = self.providers.get('primary')
        if not provider:
            result['errors'].append("No skip trace provider configured")
            return result

        try:
            trace_results = provider.trace_batch(leads)
            result['traced'] = len(trace_results)

            for tr in trace_results:
                if tr.phones or tr.emails:
                    result['found_contact'] += 1
                else:
                    result['no_contact'] += 1

                # Update Master Properties with contact info
                if not dry_run:
                    self._update_property_contacts(tr)

        except Exception as e:
            logger.error(f"Skip trace failed: {e}")
            result['errors'].append(str(e))

        # Log run
        if not dry_run:
            self.sheets_client.log_run(
                'skip_trace',
                'success' if not result['errors'] else 'partial',
                result['traced'],
                '; '.join(result['errors'][:3])
            )

        return result

    def _update_property_contacts(self, trace_result: SkipTraceResult) -> None:
        """Update Master Properties with skip trace results."""
        try:
            update_data = trace_result.to_dict()
            self.sheets_client.update_rows(
                'Master Properties',
                [update_data],
                'parcel_id',
                list(update_data.keys())
            )
        except Exception as e:
            logger.error(f"Failed to update property {trace_result.parcel_id}: {e}")

    def get_leads_needing_trace(
        self,
        priority: str = 'HOT',
        limit: int = 50
    ) -> List[Dict]:
        """
        Get leads that need skip tracing.

        Args:
            priority: Priority tier to trace ('HOT', 'WARM', 'ALL').
            limit: Maximum number of leads to return.

        Returns:
            List of property dicts needing skip trace.
        """
        properties = self.sheets_client.read_sheet('Master Properties')

        needs_trace = []
        for prop in properties:
            # Skip if already traced recently
            if prop.get('skip_trace_status') in ['HIGH', 'MEDIUM']:
                continue

            # Skip if we already have contact info
            if prop.get('phone_1') or prop.get('email_1'):
                continue

            # Check priority tier
            tier = prop.get('priority_tier', '')
            if priority == 'HOT' and tier != 'HOT':
                continue
            elif priority == 'WARM' and tier not in ['HOT', 'WARM']:
                continue

            needs_trace.append(prop)

            if len(needs_trace) >= limit:
                break

        return needs_trace


def run_skip_trace(
    priority: str = 'HOT',
    limit: int = 50,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run skip tracing for leads needing contact information.

    Args:
        priority: Priority tier to trace ('HOT', 'WARM', 'ALL').
        limit: Maximum leads to trace.
        dry_run: If True, don't write results.

    Returns:
        Summary of the skip trace run.
    """
    manager = SkipTraceManager()

    # Get leads needing trace
    leads = manager.get_leads_needing_trace(priority=priority, limit=limit)
    logger.info(f"Found {len(leads)} leads needing skip trace")

    if not leads:
        return {'total': 0, 'traced': 0, 'found_contact': 0, 'no_contact': 0, 'errors': []}

    # Run skip trace
    return manager.trace_leads(leads, dry_run=dry_run)


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Skip trace leads for contact info')
    parser.add_argument('--priority', choices=['HOT', 'WARM', 'ALL'], default='HOT')
    parser.add_argument('--limit', type=int, default=50, help='Max leads to trace')
    parser.add_argument('--dry-run', action='store_true', help='Do not write results')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_skip_trace(
        priority=args.priority,
        limit=args.limit,
        dry_run=args.dry_run
    )

    print(f"\nSkip Trace Results:")
    print(f"  Total leads: {result['total']}")
    print(f"  Traced: {result['traced']}")
    print(f"  Found contact: {result['found_contact']}")
    print(f"  No contact: {result['no_contact']}")
    if result.get('errors'):
        print(f"  Errors: {result['errors']}")
