"""
Facebook Custom Audience Sync for TD Realty Seller Intelligence

Syncs HOT and WARM leads to Facebook Custom Audiences for targeted
advertising campaigns. Enables lookalike audience creation for
broader reach with similar homeowner demographics.

Features:
- Sync leads to Custom Audiences
- Create/manage audience lists
- Hash PII for privacy compliance
- Incremental updates
"""

import logging
import os
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from scripts.sync.sheets_sync import SheetsClient, get_sheets_client

logger = logging.getLogger(__name__)


class FacebookAudienceClient:
    """
    Client for Facebook Marketing API Custom Audiences.

    Custom Audiences allow targeting ads to specific lists of people,
    matched by hashed email, phone, or address data.
    """

    API_VERSION = 'v18.0'
    GRAPH_URL = f'https://graph.facebook.com/{API_VERSION}'

    def __init__(
        self,
        access_token: Optional[str] = None,
        ad_account_id: Optional[str] = None
    ):
        """
        Initialize Facebook client.

        Args:
            access_token: Facebook Marketing API access token.
            ad_account_id: Ad account ID (format: act_XXXXX).
        """
        self.access_token = access_token or os.getenv('FACEBOOK_ACCESS_TOKEN')
        self.ad_account_id = ad_account_id or os.getenv('FACEBOOK_AD_ACCOUNT_ID')

        if not self.access_token:
            logger.warning("Facebook access token not configured")
        if not self.ad_account_id:
            logger.warning("Facebook ad account ID not configured")

        self.session = requests.Session()

    def _hash_value(self, value: str) -> str:
        """
        Hash a value using SHA256 for Facebook privacy compliance.

        Facebook requires all PII to be hashed before upload.

        Args:
            value: Value to hash.

        Returns:
            Lowercase hex SHA256 hash.
        """
        if not value:
            return ''
        # Normalize: lowercase, strip whitespace
        normalized = str(value).lower().strip()
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    def _hash_phone(self, phone: str) -> str:
        """
        Hash phone number after normalizing to digits only.

        Args:
            phone: Phone number in any format.

        Returns:
            SHA256 hash of digits-only phone.
        """
        import re
        if not phone:
            return ''
        digits = re.sub(r'\D', '', phone)
        # Ensure US format without country code
        if len(digits) == 11 and digits[0] == '1':
            digits = digits[1:]
        return self._hash_value(digits)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def create_custom_audience(
        self,
        name: str,
        description: str = '',
        subtype: str = 'CUSTOM'
    ) -> Dict[str, Any]:
        """
        Create a new Custom Audience.

        Args:
            name: Audience name.
            description: Audience description.
            subtype: Audience subtype (CUSTOM, LOOKALIKE, etc.).

        Returns:
            Created audience details including ID.
        """
        if not self.access_token or not self.ad_account_id:
            return {'error': 'Facebook not configured'}

        url = f'{self.GRAPH_URL}/{self.ad_account_id}/customaudiences'

        payload = {
            'name': name,
            'description': description,
            'subtype': subtype,
            'customer_file_source': 'USER_PROVIDED_ONLY',
            'access_token': self.access_token
        }

        try:
            response = self.session.post(url, data=payload, timeout=30)
            result = response.json()

            if 'error' in result:
                logger.error(f"Failed to create audience: {result['error']}")
                return {'error': result['error'].get('message', 'Unknown error')}

            logger.info(f"Created audience: {result.get('id')} - {name}")
            return result

        except requests.RequestException as e:
            logger.error(f"Request failed: {e}")
            return {'error': str(e)}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def add_users_to_audience(
        self,
        audience_id: str,
        users: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Add users to a Custom Audience.

        Args:
            audience_id: Facebook audience ID.
            users: List of user dicts with email, phone, first_name, last_name,
                   city, state, zip, country fields.

        Returns:
            Result with number of users added.
        """
        if not self.access_token:
            return {'error': 'Facebook not configured'}

        url = f'{self.GRAPH_URL}/{audience_id}/users'

        # Prepare hashed user data
        # Facebook schema: https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences
        schema = ['EMAIL', 'PHONE', 'FN', 'LN', 'CT', 'ST', 'ZIP', 'COUNTRY']

        data = []
        for user in users:
            row = [
                self._hash_value(user.get('email', '')),
                self._hash_phone(user.get('phone', '')),
                self._hash_value(user.get('first_name', '')),
                self._hash_value(user.get('last_name', '')),
                self._hash_value(user.get('city', '')),
                self._hash_value(user.get('state', '')),
                self._hash_value(user.get('zip', '')),
                self._hash_value(user.get('country', 'us'))
            ]
            # Only add if we have at least email or phone
            if row[0] or row[1]:
                data.append(row)

        if not data:
            return {'added': 0, 'message': 'No valid users to add'}

        payload = {
            'payload': {
                'schema': schema,
                'data': data
            },
            'access_token': self.access_token
        }

        try:
            response = self.session.post(url, json=payload, timeout=60)
            result = response.json()

            if 'error' in result:
                logger.error(f"Failed to add users: {result['error']}")
                return {'error': result['error'].get('message', 'Unknown error')}

            num_received = result.get('num_received', 0)
            num_invalid = result.get('num_invalid_entries', 0)

            logger.info(f"Added users to audience {audience_id}: {num_received} received, {num_invalid} invalid")

            return {
                'added': num_received - num_invalid,
                'received': num_received,
                'invalid': num_invalid,
                'session_id': result.get('session_id')
            }

        except requests.RequestException as e:
            logger.error(f"Request failed: {e}")
            return {'error': str(e)}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def get_audience(self, audience_id: str) -> Dict[str, Any]:
        """Get audience details."""
        if not self.access_token:
            return {'error': 'Facebook not configured'}

        url = f'{self.GRAPH_URL}/{audience_id}'
        params = {
            'fields': 'id,name,approximate_count,description,subtype',
            'access_token': self.access_token
        }

        try:
            response = self.session.get(url, params=params, timeout=30)
            return response.json()
        except requests.RequestException as e:
            return {'error': str(e)}

    def list_custom_audiences(self) -> List[Dict[str, Any]]:
        """List all custom audiences for the ad account."""
        if not self.access_token or not self.ad_account_id:
            return []

        url = f'{self.GRAPH_URL}/{self.ad_account_id}/customaudiences'
        params = {
            'fields': 'id,name,approximate_count,description',
            'access_token': self.access_token
        }

        try:
            response = self.session.get(url, params=params, timeout=30)
            result = response.json()
            return result.get('data', [])
        except requests.RequestException as e:
            logger.error(f"Failed to list audiences: {e}")
            return []


class FacebookAudienceSync:
    """
    Synchronizes TD Realty leads to Facebook Custom Audiences.
    """

    # Audience names
    HOT_LEADS_AUDIENCE = 'TD Realty - Hot Seller Leads'
    WARM_LEADS_AUDIENCE = 'TD Realty - Warm Seller Leads'
    LIFE_EVENTS_AUDIENCE = 'TD Realty - Life Event Leads'

    def __init__(
        self,
        sheets_client: Optional[SheetsClient] = None,
        fb_client: Optional[FacebookAudienceClient] = None
    ):
        self.sheets_client = sheets_client or get_sheets_client()
        self.fb_client = fb_client or FacebookAudienceClient()
        self._audience_ids: Dict[str, str] = {}

    def _get_or_create_audience(self, name: str, description: str = '') -> Optional[str]:
        """Get existing audience ID or create new one."""
        if name in self._audience_ids:
            return self._audience_ids[name]

        # Check if audience exists
        audiences = self.fb_client.list_custom_audiences()
        for aud in audiences:
            if aud.get('name') == name:
                self._audience_ids[name] = aud['id']
                return aud['id']

        # Create new audience
        result = self.fb_client.create_custom_audience(name, description)
        if 'id' in result:
            self._audience_ids[name] = result['id']
            return result['id']

        return None

    def _lead_to_fb_user(self, lead: Dict[str, Any]) -> Dict[str, str]:
        """Convert a lead to Facebook user format."""
        # Parse owner name
        owner_name = lead.get('owner_name', '')
        name_parts = owner_name.replace(',', ' ').split()

        first_name = lead.get('owner_first_name', '')
        last_name = lead.get('owner_last_name', '')

        if not first_name and name_parts:
            first_name = name_parts[0]
        if not last_name and len(name_parts) > 1:
            last_name = name_parts[-1]

        return {
            'email': lead.get('email_1', ''),
            'phone': lead.get('phone_1', ''),
            'first_name': first_name,
            'last_name': last_name,
            'city': lead.get('city', ''),
            'state': 'OH',
            'zip': lead.get('zip', ''),
            'country': 'us'
        }

    def sync_hot_leads(self, dry_run: bool = False) -> Dict[str, Any]:
        """
        Sync HOT leads to Facebook Custom Audience.

        Args:
            dry_run: If True, don't actually sync.

        Returns:
            Sync result summary.
        """
        result = {
            'audience': self.HOT_LEADS_AUDIENCE,
            'leads_found': 0,
            'users_synced': 0,
            'status': 'pending'
        }

        try:
            # Read HOT leads
            hot_leads = self.sheets_client.read_sheet('Hot Leads')
            result['leads_found'] = len(hot_leads)

            if not hot_leads:
                result['status'] = 'no_leads'
                return result

            # Convert to FB user format
            users = [self._lead_to_fb_user(lead) for lead in hot_leads]
            users = [u for u in users if u['email'] or u['phone']]

            if dry_run:
                result['status'] = 'dry_run'
                result['users_synced'] = len(users)
                return result

            # Get or create audience
            audience_id = self._get_or_create_audience(
                self.HOT_LEADS_AUDIENCE,
                'High-propensity seller leads from TD Realty Intelligence System'
            )

            if not audience_id:
                result['status'] = 'error'
                result['error'] = 'Could not create/find audience'
                return result

            # Sync users
            sync_result = self.fb_client.add_users_to_audience(audience_id, users)

            if 'error' in sync_result:
                result['status'] = 'error'
                result['error'] = sync_result['error']
            else:
                result['status'] = 'success'
                result['users_synced'] = sync_result.get('added', 0)
                result['audience_id'] = audience_id

        except Exception as e:
            logger.error(f"Hot leads sync failed: {e}")
            result['status'] = 'error'
            result['error'] = str(e)

        return result

    def sync_warm_leads(self, dry_run: bool = False) -> Dict[str, Any]:
        """Sync WARM leads to Facebook Custom Audience."""
        result = {
            'audience': self.WARM_LEADS_AUDIENCE,
            'leads_found': 0,
            'users_synced': 0,
            'status': 'pending'
        }

        try:
            warm_leads = self.sheets_client.read_sheet('Warm Leads')
            result['leads_found'] = len(warm_leads)

            if not warm_leads:
                result['status'] = 'no_leads'
                return result

            users = [self._lead_to_fb_user(lead) for lead in warm_leads]
            users = [u for u in users if u['email'] or u['phone']]

            if dry_run:
                result['status'] = 'dry_run'
                result['users_synced'] = len(users)
                return result

            audience_id = self._get_or_create_audience(
                self.WARM_LEADS_AUDIENCE,
                'Medium-propensity seller leads from TD Realty Intelligence System'
            )

            if not audience_id:
                result['status'] = 'error'
                result['error'] = 'Could not create/find audience'
                return result

            sync_result = self.fb_client.add_users_to_audience(audience_id, users)

            if 'error' in sync_result:
                result['status'] = 'error'
                result['error'] = sync_result['error']
            else:
                result['status'] = 'success'
                result['users_synced'] = sync_result.get('added', 0)
                result['audience_id'] = audience_id

        except Exception as e:
            logger.error(f"Warm leads sync failed: {e}")
            result['status'] = 'error'
            result['error'] = str(e)

        return result

    def sync_life_events(self, dry_run: bool = False) -> Dict[str, Any]:
        """Sync leads with life events to dedicated audience."""
        result = {
            'audience': self.LIFE_EVENTS_AUDIENCE,
            'leads_found': 0,
            'users_synced': 0,
            'status': 'pending'
        }

        try:
            # Get life events with matched properties
            life_events = self.sheets_client.read_sheet('Life Events')
            matched_events = [e for e in life_events if e.get('matched_parcel_id')]
            result['leads_found'] = len(matched_events)

            if not matched_events:
                result['status'] = 'no_leads'
                return result

            users = [self._lead_to_fb_user(event) for event in matched_events]
            users = [u for u in users if u['email'] or u['phone']]

            if dry_run:
                result['status'] = 'dry_run'
                result['users_synced'] = len(users)
                return result

            audience_id = self._get_or_create_audience(
                self.LIFE_EVENTS_AUDIENCE,
                'Leads with life events (divorce, probate, foreclosure) from TD Realty'
            )

            if not audience_id:
                result['status'] = 'error'
                result['error'] = 'Could not create/find audience'
                return result

            sync_result = self.fb_client.add_users_to_audience(audience_id, users)

            if 'error' in sync_result:
                result['status'] = 'error'
                result['error'] = sync_result['error']
            else:
                result['status'] = 'success'
                result['users_synced'] = sync_result.get('added', 0)
                result['audience_id'] = audience_id

        except Exception as e:
            logger.error(f"Life events sync failed: {e}")
            result['status'] = 'error'
            result['error'] = str(e)

        return result

    def run_full_sync(self, dry_run: bool = False) -> Dict[str, Any]:
        """
        Run full sync of all audiences.

        Args:
            dry_run: If True, don't actually sync.

        Returns:
            Combined sync results.
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'hot_leads': self.sync_hot_leads(dry_run),
            'warm_leads': self.sync_warm_leads(dry_run),
            'life_events': self.sync_life_events(dry_run),
            'totals': {
                'audiences_synced': 0,
                'total_users': 0
            }
        }

        for key in ['hot_leads', 'warm_leads', 'life_events']:
            if results[key].get('status') == 'success':
                results['totals']['audiences_synced'] += 1
                results['totals']['total_users'] += results[key].get('users_synced', 0)

        # Log run
        if not dry_run:
            self.sheets_client.log_run(
                'facebook_sync',
                'success' if results['totals']['audiences_synced'] > 0 else 'partial',
                results['totals']['total_users'],
                ''
            )

        return results


def run_facebook_sync(dry_run: bool = False) -> Dict[str, Any]:
    """
    Run Facebook Custom Audience sync.

    Args:
        dry_run: If True, don't sync.

    Returns:
        Sync results.
    """
    syncer = FacebookAudienceSync()
    return syncer.run_full_sync(dry_run=dry_run)


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Sync leads to Facebook Custom Audiences')
    parser.add_argument('--dry-run', action='store_true', help='Do not sync')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_facebook_sync(dry_run=args.dry_run)

    print(f"\nFacebook Sync Results:")
    print(f"  Audiences synced: {result['totals']['audiences_synced']}")
    print(f"  Total users: {result['totals']['total_users']}")
    print(f"\n  Hot Leads: {result['hot_leads'].get('users_synced', 0)} users")
    print(f"  Warm Leads: {result['warm_leads'].get('users_synced', 0)} users")
    print(f"  Life Events: {result['life_events'].get('users_synced', 0)} users")
