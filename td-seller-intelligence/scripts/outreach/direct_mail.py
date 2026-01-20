"""
Direct Mail Integration for TD Realty Seller Intelligence

Integrates with Lob.com API to send personalized direct mail
(letters, postcards) to motivated sellers.

Features:
- Personalized letter/postcard templates
- Address verification
- Bulk mailing support
- Delivery tracking
"""

import logging
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from string import Template

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from scripts.sync.sheets_sync import SheetsClient, get_sheets_client

logger = logging.getLogger(__name__)


# Default letter templates
LETTER_TEMPLATES = {
    'life_event_divorce': """
Dear $owner_first_name,

I hope this letter finds you well during what I understand may be a challenging time.

My name is Travis Debnam, and I'm a local real estate agent with TD Realty Ohio. I specialize in helping homeowners in $neighborhood navigate property transitions with minimal stress and maximum value.

If you're considering selling your home at $address, I'd like to offer a complimentary, no-obligation home valuation. As a 1% commission brokerage, we can help you keep more of your equity while providing full-service representation.

Current market conditions in $city are favorable for sellers, and I'd be happy to discuss your options at your convenience.

Feel free to reach me at (614) 555-1234 or travis@tdrealtyohio.com.

Wishing you all the best,

Travis Debnam
TD Realty Ohio
""",

    'life_event_probate': """
Dear $owner_first_name,

I'm writing to express my sincere condolences during this difficult time.

My name is Travis Debnam with TD Realty Ohio. I understand that managing an inherited property can be overwhelming, especially when dealing with other estate matters.

If the property at $address is something you're considering selling, I specialize in helping families through property transitions with care and efficiency. As a 1% commission brokerage, we help you preserve more of the estate's value.

I'm available to provide a free property evaluation and discuss your options with no pressure or obligation.

Please don't hesitate to reach out when you're ready: (614) 555-1234 or travis@tdrealtyohio.com.

With sympathy,

Travis Debnam
TD Realty Ohio
""",

    'life_event_foreclosure': """
Dear $owner_first_name,

I'm reaching out because I may be able to help with your property at $address.

My name is Travis Debnam with TD Realty Ohio. I work with homeowners who need to sell quickly to avoid foreclosure, often helping them preserve equity that would otherwise be lost at auction.

Time is often critical in these situations, and I can:
• Provide a same-day market analysis
• List your home immediately
• Connect you with buyers ready to close fast
• Help you explore all your options

As a 1% commission brokerage, we keep more money in your pocket.

Please call me confidentially at (614) 555-1234.

Here to help,

Travis Debnam
TD Realty Ohio
""",

    'high_equity_long_term': """
Dear $owner_first_name,

I hope this letter finds you enjoying your home at $address!

I'm Travis Debnam with TD Realty Ohio, and I wanted to share some exciting news about your neighborhood.

Home values in $neighborhood have appreciated significantly, and based on recent sales, your home may be worth substantially more than when you purchased it. Many of my clients have been pleasantly surprised by their equity gains.

If you've ever thought about:
• Downsizing to a lower-maintenance lifestyle
• Upgrading to a larger home
• Relocating closer to family
• Cashing out your equity

I'd be happy to provide a free, confidential home valuation.

As a 1% commission brokerage, we help you keep more of what you've earned.

Curious about your home's value? Call me at (614) 555-1234.

Best regards,

Travis Debnam
TD Realty Ohio
"""
}


class LobClient:
    """Client for Lob.com direct mail API."""

    API_BASE = 'https://api.lob.com/v1'

    def __init__(self, api_key: Optional[str] = None, test_mode: bool = False):
        """
        Initialize Lob client.

        Args:
            api_key: Lob API key. Falls back to LOB_API_KEY env var.
            test_mode: If True, uses Lob test environment.
        """
        self.api_key = api_key or os.getenv('LOB_API_KEY')
        if not self.api_key:
            logger.warning("Lob API key not configured")

        self.test_mode = test_mode or os.getenv('LOB_TEST_MODE', 'false').lower() == 'true'

        self.session = requests.Session()
        self.session.auth = (self.api_key, '') if self.api_key else None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def verify_address(self, address: Dict[str, str]) -> Dict[str, Any]:
        """
        Verify and standardize a mailing address.

        Args:
            address: Dict with line1, city, state, zip.

        Returns:
            Verified address dict with deliverability info.
        """
        if not self.api_key:
            return {'deliverability': 'unverified', 'original': address}

        payload = {
            'primary_line': address.get('line1', ''),
            'city': address.get('city', ''),
            'state': address.get('state', ''),
            'zip_code': address.get('zip', '')
        }

        try:
            response = self.session.post(
                f'{self.API_BASE}/us_verifications',
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response.json()

        except requests.RequestException as e:
            logger.error(f"Address verification failed: {e}")
            return {'deliverability': 'error', 'error': str(e), 'original': address}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def send_letter(
        self,
        to_address: Dict[str, str],
        from_address: Dict[str, str],
        content: str,
        description: str = '',
        color: bool = False,
        double_sided: bool = False
    ) -> Dict[str, Any]:
        """
        Send a letter via Lob.

        Args:
            to_address: Recipient address dict.
            from_address: Sender address dict.
            content: Letter content (HTML supported).
            description: Internal description for tracking.
            color: Print in color.
            double_sided: Print double-sided.

        Returns:
            Lob letter response with tracking info.
        """
        if not self.api_key:
            logger.error("No Lob API key configured")
            return {'error': 'No API key'}

        # Format addresses for Lob API
        to_addr = {
            'name': to_address.get('name', 'Current Resident'),
            'address_line1': to_address.get('line1', ''),
            'address_city': to_address.get('city', ''),
            'address_state': to_address.get('state', ''),
            'address_zip': to_address.get('zip', '')
        }

        from_addr = {
            'name': from_address.get('name', 'TD Realty Ohio'),
            'address_line1': from_address.get('line1', ''),
            'address_city': from_address.get('city', ''),
            'address_state': from_address.get('state', ''),
            'address_zip': from_address.get('zip', '')
        }

        # Wrap content in basic HTML if not already HTML
        if not content.strip().startswith('<'):
            content = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: Georgia, serif; font-size: 12pt; line-height: 1.6; }}
                    .letter {{ max-width: 6in; margin: 0 auto; }}
                </style>
            </head>
            <body>
                <div class="letter">
                    {content.replace(chr(10), '<br>')}
                </div>
            </body>
            </html>
            """

        payload = {
            'to': to_addr,
            'from': from_addr,
            'file': content,
            'description': description,
            'color': color,
            'double_sided': double_sided
        }

        try:
            response = self.session.post(
                f'{self.API_BASE}/letters',
                json=payload,
                timeout=60
            )
            response.raise_for_status()

            result = response.json()
            logger.info(f"Letter sent: {result.get('id')} to {to_address.get('line1')}")
            return result

        except requests.RequestException as e:
            logger.error(f"Letter send failed: {e}")
            return {'error': str(e)}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def send_postcard(
        self,
        to_address: Dict[str, str],
        from_address: Dict[str, str],
        front_content: str,
        back_content: str,
        description: str = '',
        size: str = '4x6'
    ) -> Dict[str, Any]:
        """
        Send a postcard via Lob.

        Args:
            to_address: Recipient address dict.
            from_address: Sender address dict.
            front_content: Front side content (HTML).
            back_content: Back side content (HTML).
            description: Internal description.
            size: Postcard size ('4x6' or '6x9').

        Returns:
            Lob postcard response.
        """
        if not self.api_key:
            return {'error': 'No API key'}

        to_addr = {
            'name': to_address.get('name', 'Current Resident'),
            'address_line1': to_address.get('line1', ''),
            'address_city': to_address.get('city', ''),
            'address_state': to_address.get('state', ''),
            'address_zip': to_address.get('zip', '')
        }

        payload = {
            'to': to_addr,
            'front': front_content,
            'back': back_content,
            'description': description,
            'size': size
        }

        try:
            response = self.session.post(
                f'{self.API_BASE}/postcards',
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            return response.json()

        except requests.RequestException as e:
            logger.error(f"Postcard send failed: {e}")
            return {'error': str(e)}


class DirectMailSender:
    """
    Manages direct mail campaigns for seller outreach.
    """

    def __init__(
        self,
        sheets_client: Optional[SheetsClient] = None,
        lob_client: Optional[LobClient] = None
    ):
        self.sheets_client = sheets_client or get_sheets_client()
        self.lob_client = lob_client or LobClient()

        # From address for all mailings
        self.from_address = {
            'name': os.getenv('COMPANY_NAME', 'TD Realty Ohio'),
            'line1': os.getenv('COMPANY_ADDRESS', '123 Main St'),
            'city': os.getenv('COMPANY_CITY', 'Columbus'),
            'state': os.getenv('COMPANY_STATE', 'OH'),
            'zip': os.getenv('COMPANY_ZIP', '43215')
        }

    def render_template(self, template_name: str, data: Dict[str, Any]) -> str:
        """
        Render a letter template with lead data.

        Args:
            template_name: Name of the template.
            data: Lead data for variable substitution.

        Returns:
            Rendered template content.
        """
        template_content = LETTER_TEMPLATES.get(template_name, LETTER_TEMPLATES['high_equity_long_term'])

        # Prepare template variables
        owner_name = data.get('owner_name', 'Homeowner')
        name_parts = owner_name.replace(',', ' ').split()
        owner_first_name = name_parts[0] if name_parts else 'Homeowner'

        variables = {
            'owner_name': owner_name,
            'owner_first_name': owner_first_name,
            'address': data.get('address', ''),
            'city': data.get('city', ''),
            'neighborhood': data.get('neighborhood', data.get('city', '')),
            'equity': f"${data.get('estimated_equity', 0):,.0f}",
            'years_owned': data.get('years_owned', ''),
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
        Send a direct mail piece to a lead.

        Args:
            lead: Lead data dict.
            template_name: Template to use.
            dry_run: If True, don't actually send.

        Returns:
            Result dict with status and tracking info.
        """
        result = {
            'parcel_id': lead.get('parcel_id'),
            'address': lead.get('address'),
            'status': 'pending',
            'channel': 'MAIL',
            'template': template_name
        }

        # Build recipient address
        to_address = {
            'name': lead.get('owner_name', 'Current Resident'),
            'line1': lead.get('owner_mailing_address') or lead.get('address', ''),
            'city': lead.get('city', ''),
            'state': 'OH',
            'zip': lead.get('zip', '')
        }

        # Verify address first
        if not dry_run:
            verification = self.lob_client.verify_address(to_address)
            if verification.get('deliverability') == 'undeliverable':
                result['status'] = 'undeliverable'
                result['error'] = 'Address not deliverable'
                return result

        # Render content
        content = self.render_template(template_name, lead)

        if dry_run:
            result['status'] = 'dry_run'
            result['content_preview'] = content[:200]
            return result

        # Send letter
        description = f"TD Realty - {template_name} - {lead.get('parcel_id', 'unknown')}"
        lob_result = self.lob_client.send_letter(
            to_address=to_address,
            from_address=self.from_address,
            content=content,
            description=description
        )

        if 'error' in lob_result:
            result['status'] = 'error'
            result['error'] = lob_result['error']
        else:
            result['status'] = 'sent'
            result['lob_id'] = lob_result.get('id')
            result['expected_delivery'] = lob_result.get('expected_delivery_date')

        return result

    def process_mail_queue(
        self,
        limit: int = 20,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Process pending mail items from the outreach queue.

        Args:
            limit: Max items to process.
            dry_run: If True, don't send.

        Returns:
            Summary of processing results.
        """
        summary = {
            'processed': 0,
            'sent': 0,
            'errors': 0,
            'details': []
        }

        try:
            # Get queue items for mail channel
            queue_result = self.sheets_client._call_api('get_outreach_queue', {
                'channel': 'MAIL',
                'status': 'PENDING'
            })

            queue = queue_result.get('queue', [])[:limit]

            for item in queue:
                summary['processed'] += 1

                result = self.send_to_lead(
                    lead=item,
                    template_name=item.get('template', 'high_equity_long_term'),
                    dry_run=dry_run
                )

                if result['status'] == 'sent':
                    summary['sent'] += 1
                    # Update queue status
                    if not dry_run:
                        self.sheets_client._call_api('update_outreach_status', {
                            'parcel_id': item.get('parcel_id'),
                            'channel': 'MAIL',
                            'status': 'SENT',
                            'sent_date': datetime.now().isoformat(),
                            'tracking_id': result.get('lob_id')
                        })
                elif result['status'] == 'error':
                    summary['errors'] += 1

                summary['details'].append(result)

        except Exception as e:
            logger.error(f"Mail queue processing failed: {e}")
            summary['error'] = str(e)

        return summary


def run_direct_mail(
    limit: int = 20,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run direct mail processing.

    Args:
        limit: Max items to send.
        dry_run: If True, don't send.

    Returns:
        Processing summary.
    """
    sender = DirectMailSender()
    return sender.process_mail_queue(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Send direct mail to leads')
    parser.add_argument('--limit', type=int, default=20, help='Max items to send')
    parser.add_argument('--dry-run', action='store_true', help='Do not actually send')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_direct_mail(limit=args.limit, dry_run=args.dry_run)

    print(f"\nDirect Mail Results:")
    print(f"  Processed: {result['processed']}")
    print(f"  Sent: {result['sent']}")
    print(f"  Errors: {result['errors']}")
