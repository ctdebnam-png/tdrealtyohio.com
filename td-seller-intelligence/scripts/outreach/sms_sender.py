"""
SMS Outreach Integration for TD Realty Seller Intelligence

Integrates with Twilio API to send personalized SMS messages
to motivated sellers who have phone numbers from skip tracing.

Features:
- Personalized SMS templates
- Opt-out handling
- Delivery status tracking
- Compliance with TCPA regulations

IMPORTANT: SMS marketing requires proper consent. This module is designed
for follow-up with leads who have shown interest, not cold outreach.
"""

import logging
import os
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from string import Template

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from scripts.sync.sheets_sync import SheetsClient, get_sheets_client

logger = logging.getLogger(__name__)


# SMS templates (keep under 160 chars for single SMS)
SMS_TEMPLATES = {
    'intro': """Hi $owner_first_name! This is Travis from TD Realty. I help homeowners in $neighborhood sell for top dollar at just 1% commission. Interested in a free home value estimate? Reply YES or call (614) 555-1234""",

    'followup': """Hi $owner_first_name, following up on your home at $address. Market conditions are great for sellers right now. Want to know what it's worth? Reply YES - Travis, TD Realty""",

    'life_event': """Hi $owner_first_name, I'm Travis with TD Realty. I help homeowners navigate property transitions smoothly. If you're considering selling your $city home, I'd love to help. Free consultation: (614) 555-1234""",

    'high_equity': """$owner_first_name - your $neighborhood home may have gained significant equity! Curious what it's worth? I can provide a free valuation. Reply YES or call (614) 555-1234 - Travis, TD Realty"""
}

# Opt-out keywords
OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'opt out', 'optout', 'quit', 'end']


class TwilioClient:
    """Client for Twilio SMS API."""

    API_BASE = 'https://api.twilio.com/2010-04-01'

    def __init__(
        self,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        from_number: Optional[str] = None
    ):
        self.account_sid = account_sid or os.getenv('TWILIO_ACCOUNT_SID')
        self.auth_token = auth_token or os.getenv('TWILIO_AUTH_TOKEN')
        self.from_number = from_number or os.getenv('TWILIO_FROM_NUMBER')

        if not all([self.account_sid, self.auth_token, self.from_number]):
            logger.warning("Twilio credentials not fully configured")

        self.session = requests.Session()
        self.session.auth = (self.account_sid, self.auth_token) if self.account_sid else None

    def format_phone(self, phone: str) -> str:
        """
        Format phone number to E.164 format for Twilio.

        Args:
            phone: Phone number in various formats.

        Returns:
            Phone number in +1XXXXXXXXXX format.
        """
        # Remove all non-digits
        digits = re.sub(r'\D', '', phone)

        # Handle different lengths
        if len(digits) == 10:
            return f'+1{digits}'
        elif len(digits) == 11 and digits[0] == '1':
            return f'+{digits}'
        elif len(digits) == 12 and digits[:2] == '01':
            return f'+{digits[1:]}'
        else:
            return f'+{digits}'

    def is_valid_phone(self, phone: str) -> bool:
        """Check if phone number appears valid."""
        digits = re.sub(r'\D', '', phone)
        return len(digits) >= 10 and len(digits) <= 15

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def send_sms(
        self,
        to_number: str,
        message: str,
        status_callback: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send an SMS via Twilio.

        Args:
            to_number: Recipient phone number.
            message: SMS message body (max 1600 chars, ideally <160).
            status_callback: URL for delivery status webhooks.

        Returns:
            Result dict with message SID and status.
        """
        if not all([self.account_sid, self.auth_token, self.from_number]):
            return {'success': False, 'error': 'Twilio not configured'}

        if not self.is_valid_phone(to_number):
            return {'success': False, 'error': 'Invalid phone number'}

        formatted_to = self.format_phone(to_number)

        # Truncate message if too long
        if len(message) > 1600:
            message = message[:1597] + '...'

        payload = {
            'To': formatted_to,
            'From': self.from_number,
            'Body': message
        }

        if status_callback:
            payload['StatusCallback'] = status_callback

        try:
            response = self.session.post(
                f'{self.API_BASE}/Accounts/{self.account_sid}/Messages.json',
                data=payload,
                timeout=30
            )

            result = response.json()

            if response.status_code in [200, 201]:
                logger.info(f"SMS sent to {formatted_to}: {result.get('sid')}")
                return {
                    'success': True,
                    'message_sid': result.get('sid'),
                    'status': result.get('status'),
                    'to': formatted_to
                }
            else:
                logger.error(f"SMS send failed: {result}")
                return {
                    'success': False,
                    'error': result.get('message', f"Status {response.status_code}"),
                    'code': result.get('code')
                }

        except requests.RequestException as e:
            logger.error(f"SMS request failed: {e}")
            return {'success': False, 'error': str(e)}

    def get_message_status(self, message_sid: str) -> Dict[str, Any]:
        """Get the delivery status of a sent message."""
        if not self.account_sid:
            return {'error': 'Not configured'}

        try:
            response = self.session.get(
                f'{self.API_BASE}/Accounts/{self.account_sid}/Messages/{message_sid}.json',
                timeout=30
            )
            return response.json()
        except requests.RequestException as e:
            return {'error': str(e)}


class SMSSender:
    """
    Manages SMS campaigns for seller outreach.

    Note: SMS marketing is subject to TCPA regulations. Ensure proper
    consent before sending marketing messages.
    """

    def __init__(
        self,
        sheets_client: Optional[SheetsClient] = None,
        twilio_client: Optional[TwilioClient] = None
    ):
        self.sheets_client = sheets_client or get_sheets_client()
        self.twilio_client = twilio_client or TwilioClient()
        self._opt_out_list: Optional[set] = None

    def get_opt_out_list(self) -> set:
        """Load list of opted-out phone numbers."""
        if self._opt_out_list is None:
            try:
                # Get from Config or dedicated opt-out sheet
                config = self.sheets_client.get_config()
                opt_outs = config.get('sms_opt_outs', '')
                self._opt_out_list = set(
                    self.twilio_client.format_phone(p.strip())
                    for p in opt_outs.split(',') if p.strip()
                )
            except Exception:
                self._opt_out_list = set()
        return self._opt_out_list

    def is_opted_out(self, phone: str) -> bool:
        """Check if a phone number has opted out."""
        formatted = self.twilio_client.format_phone(phone)
        return formatted in self.get_opt_out_list()

    def render_template(self, template_name: str, data: Dict[str, Any]) -> str:
        """
        Render an SMS template with lead data.

        Args:
            template_name: Name of the template.
            data: Lead data for variable substitution.

        Returns:
            Rendered SMS message.
        """
        template_content = SMS_TEMPLATES.get(template_name, SMS_TEMPLATES['intro'])

        owner_name = data.get('owner_name', 'Homeowner')
        name_parts = owner_name.replace(',', ' ').split()
        owner_first_name = name_parts[0] if name_parts else 'Homeowner'

        variables = {
            'owner_name': owner_name,
            'owner_first_name': owner_first_name,
            'address': data.get('address', 'your home'),
            'city': data.get('city', ''),
            'neighborhood': data.get('neighborhood', data.get('city', 'your area')),
        }

        try:
            template = Template(template_content)
            return template.safe_substitute(variables)
        except Exception as e:
            logger.error(f"Template rendering failed: {e}")
            return template_content

    def send_to_lead(
        self,
        lead: Dict[str, Any],
        template_name: str,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Send an SMS to a lead.

        Args:
            lead: Lead data dict.
            template_name: Template to use.
            dry_run: If True, don't actually send.

        Returns:
            Result dict with status and tracking info.
        """
        result = {
            'parcel_id': lead.get('parcel_id'),
            'phone': lead.get('phone_1'),
            'status': 'pending',
            'channel': 'SMS',
            'template': template_name
        }

        phone = lead.get('phone_1')
        if not phone or not self.twilio_client.is_valid_phone(phone):
            result['status'] = 'no_phone'
            result['error'] = 'No valid phone number'
            return result

        # Check opt-out list
        if self.is_opted_out(phone):
            result['status'] = 'opted_out'
            result['error'] = 'Phone number opted out'
            return result

        # Render message
        message = self.render_template(template_name, lead)

        if dry_run:
            result['status'] = 'dry_run'
            result['message'] = message
            return result

        # Send SMS
        send_result = self.twilio_client.send_sms(
            to_number=phone,
            message=message
        )

        if send_result.get('success'):
            result['status'] = 'sent'
            result['message_sid'] = send_result.get('message_sid')
        else:
            result['status'] = 'error'
            result['error'] = send_result.get('error')

        return result

    def process_sms_queue(
        self,
        limit: int = 30,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Process pending SMS items from the outreach queue.

        Args:
            limit: Max items to process.
            dry_run: If True, don't send.

        Returns:
            Summary of processing results.
        """
        summary = {
            'processed': 0,
            'sent': 0,
            'no_phone': 0,
            'opted_out': 0,
            'errors': 0,
            'details': []
        }

        try:
            queue_result = self.sheets_client._call_api('get_outreach_queue', {
                'channel': 'SMS',
                'status': 'PENDING'
            })

            queue = queue_result.get('queue', [])[:limit]

            for item in queue:
                summary['processed'] += 1

                result = self.send_to_lead(
                    lead=item,
                    template_name=item.get('template', 'intro'),
                    dry_run=dry_run
                )

                if result['status'] == 'sent':
                    summary['sent'] += 1
                    if not dry_run:
                        self.sheets_client._call_api('update_outreach_status', {
                            'parcel_id': item.get('parcel_id'),
                            'channel': 'SMS',
                            'status': 'SENT',
                            'sent_date': datetime.now().isoformat(),
                            'tracking_id': result.get('message_sid')
                        })
                elif result['status'] == 'no_phone':
                    summary['no_phone'] += 1
                elif result['status'] == 'opted_out':
                    summary['opted_out'] += 1
                elif result['status'] == 'error':
                    summary['errors'] += 1

                summary['details'].append(result)

        except Exception as e:
            logger.error(f"SMS queue processing failed: {e}")
            summary['error'] = str(e)

        return summary


def run_sms_outreach(
    limit: int = 30,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run SMS outreach processing.

    Args:
        limit: Max SMS to send.
        dry_run: If True, don't send.

    Returns:
        Processing summary.
    """
    sender = SMSSender()
    return sender.process_sms_queue(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Send SMS outreach to leads')
    parser.add_argument('--limit', type=int, default=30, help='Max SMS to send')
    parser.add_argument('--dry-run', action='store_true', help='Do not actually send')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_sms_outreach(limit=args.limit, dry_run=args.dry_run)

    print(f"\nSMS Outreach Results:")
    print(f"  Processed: {result['processed']}")
    print(f"  Sent: {result['sent']}")
    print(f"  No phone: {result['no_phone']}")
    print(f"  Opted out: {result['opted_out']}")
    print(f"  Errors: {result['errors']}")
