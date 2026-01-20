"""
Email Outreach Integration for TD Realty Seller Intelligence

Integrates with SendGrid API to send personalized email campaigns
to motivated sellers who have email addresses from skip tracing.

Features:
- Personalized email templates
- HTML and plain text support
- Open/click tracking
- Unsubscribe handling
- Drip campaign support
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


# Email templates
EMAIL_TEMPLATES = {
    'life_event_intro': {
        'subject': 'A note about your home at $address',
        'html': """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #2c5282; }
        .cta-button {
            display: inline-block;
            background: #2c5282;
            color: white !important;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
        }
        .footer { font-size: 12px; color: #666; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <h2 class="header">Hello $owner_first_name,</h2>

        <p>I hope this email finds you well. My name is Travis Debnam, and I'm a local real estate
        professional with TD Realty Ohio.</p>

        <p>I wanted to reach out personally because I specialize in helping homeowners in
        <strong>$neighborhood</strong> navigate property decisions with care and expertise.</p>

        <p>If you've ever wondered what your home at <strong>$address</strong> might be worth in
        today's market, I'd be happy to provide a free, no-obligation home valuation.</p>

        <p>As a <strong>1% commission brokerage</strong>, we help you keep more of your hard-earned
        equity while still providing full-service representation.</p>

        <a href="https://tdrealtyohio.com/valuation?ref=$parcel_id" class="cta-button">
            Get Your Free Home Valuation
        </a>

        <p>Feel free to reply to this email or call me directly at <strong>(614) 555-1234</strong>.</p>

        <p>Best regards,<br>
        <strong>Travis Debnam</strong><br>
        TD Realty Ohio</p>

        <div class="footer">
            <p>TD Realty Ohio | Columbus, OH</p>
            <p><a href="https://tdrealtyohio.com/unsubscribe?email=$email">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
""",
        'text': """
Hello $owner_first_name,

I hope this email finds you well. My name is Travis Debnam, and I'm a local real estate professional with TD Realty Ohio.

I wanted to reach out personally because I specialize in helping homeowners in $neighborhood navigate property decisions with care and expertise.

If you've ever wondered what your home at $address might be worth in today's market, I'd be happy to provide a free, no-obligation home valuation.

As a 1% commission brokerage, we help you keep more of your hard-earned equity while still providing full-service representation.

Get your free valuation: https://tdrealtyohio.com/valuation?ref=$parcel_id

Feel free to reply to this email or call me directly at (614) 555-1234.

Best regards,
Travis Debnam
TD Realty Ohio

---
To unsubscribe: https://tdrealtyohio.com/unsubscribe?email=$email
"""
    },

    'high_equity_followup': {
        'subject': 'Your $neighborhood home value update',
        'html': """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .highlight { background: #f0f4f8; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .cta-button {
            display: inline-block;
            background: #2c5282;
            color: white !important;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Hi $owner_first_name,</h2>

        <p>Great news for homeowners in <strong>$neighborhood</strong>!</p>

        <div class="highlight">
            <p>📈 Home values in your area have seen significant appreciation recently.
            Based on comparable sales, your home at <strong>$address</strong> may have
            gained substantial equity.</p>
        </div>

        <p>Whether you're thinking about:</p>
        <ul>
            <li>Downsizing to simplify your life</li>
            <li>Upgrading to a larger home</li>
            <li>Relocating for work or family</li>
            <li>Cashing out your equity gains</li>
        </ul>

        <p>I'm here to help you understand your options.</p>

        <p style="text-align: center;">
            <a href="https://tdrealtyohio.com/valuation?ref=$parcel_id" class="cta-button">
                See What Your Home Is Worth
            </a>
        </p>

        <p>Questions? Just reply to this email.</p>

        <p>Travis Debnam<br>TD Realty Ohio<br>(614) 555-1234</p>
    </div>
</body>
</html>
""",
        'text': """
Hi $owner_first_name,

Great news for homeowners in $neighborhood!

Home values in your area have seen significant appreciation recently. Based on comparable sales, your home at $address may have gained substantial equity.

Whether you're thinking about:
- Downsizing to simplify your life
- Upgrading to a larger home
- Relocating for work or family
- Cashing out your equity gains

I'm here to help you understand your options.

See what your home is worth: https://tdrealtyohio.com/valuation?ref=$parcel_id

Questions? Just reply to this email.

Travis Debnam
TD Realty Ohio
(614) 555-1234
"""
    }
}


class SendGridClient:
    """Client for SendGrid email API."""

    API_BASE = 'https://api.sendgrid.com/v3'

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('SENDGRID_API_KEY')
        if not self.api_key:
            logger.warning("SendGrid API key not configured")

        self.from_email = os.getenv('FROM_EMAIL', 'travis@tdrealtyohio.com')
        self.from_name = os.getenv('FROM_NAME', 'Travis Debnam - TD Realty Ohio')

        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        })

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def send_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
        text_content: str = '',
        categories: List[str] = None,
        custom_args: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Send an email via SendGrid.

        Args:
            to_email: Recipient email address.
            to_name: Recipient name.
            subject: Email subject line.
            html_content: HTML email body.
            text_content: Plain text email body.
            categories: SendGrid categories for analytics.
            custom_args: Custom tracking arguments.

        Returns:
            Result dict with status and message ID.
        """
        if not self.api_key:
            return {'success': False, 'error': 'No API key configured'}

        if not to_email or '@' not in to_email:
            return {'success': False, 'error': 'Invalid email address'}

        payload = {
            'personalizations': [{
                'to': [{'email': to_email, 'name': to_name}],
                'subject': subject
            }],
            'from': {
                'email': self.from_email,
                'name': self.from_name
            },
            'content': [
                {'type': 'text/plain', 'value': text_content or 'Please view this email in HTML format.'},
                {'type': 'text/html', 'value': html_content}
            ],
            'tracking_settings': {
                'click_tracking': {'enable': True},
                'open_tracking': {'enable': True}
            }
        }

        if categories:
            payload['categories'] = categories

        if custom_args:
            payload['personalizations'][0]['custom_args'] = custom_args

        try:
            response = self.session.post(
                f'{self.API_BASE}/mail/send',
                json=payload,
                timeout=30
            )

            if response.status_code in [200, 201, 202]:
                message_id = response.headers.get('X-Message-Id', '')
                logger.info(f"Email sent to {to_email}: {message_id}")
                return {
                    'success': True,
                    'message_id': message_id,
                    'status_code': response.status_code
                }
            else:
                error = response.json() if response.text else {'error': f'Status {response.status_code}'}
                logger.error(f"Email send failed: {error}")
                return {'success': False, 'error': error}

        except requests.RequestException as e:
            logger.error(f"Email request failed: {e}")
            return {'success': False, 'error': str(e)}


class EmailSender:
    """
    Manages email campaigns for seller outreach.
    """

    def __init__(
        self,
        sheets_client: Optional[SheetsClient] = None,
        sendgrid_client: Optional[SendGridClient] = None
    ):
        self.sheets_client = sheets_client or get_sheets_client()
        self.sendgrid_client = sendgrid_client or SendGridClient()

    def render_template(self, template_name: str, data: Dict[str, Any]) -> Dict[str, str]:
        """
        Render an email template with lead data.

        Args:
            template_name: Name of the template.
            data: Lead data for variable substitution.

        Returns:
            Dict with 'subject', 'html', and 'text' keys.
        """
        template = EMAIL_TEMPLATES.get(template_name, EMAIL_TEMPLATES['life_event_intro'])

        # Prepare variables
        owner_name = data.get('owner_name', 'Homeowner')
        name_parts = owner_name.replace(',', ' ').split()
        owner_first_name = name_parts[0] if name_parts else 'Homeowner'

        variables = {
            'owner_name': owner_name,
            'owner_first_name': owner_first_name,
            'address': data.get('address', ''),
            'city': data.get('city', ''),
            'neighborhood': data.get('neighborhood', data.get('city', '')),
            'parcel_id': data.get('parcel_id', ''),
            'email': data.get('email_1', ''),
            'equity': f"${data.get('estimated_equity', 0):,.0f}",
        }

        try:
            return {
                'subject': Template(template['subject']).safe_substitute(variables),
                'html': Template(template['html']).safe_substitute(variables),
                'text': Template(template['text']).safe_substitute(variables)
            }
        except Exception as e:
            logger.error(f"Template rendering failed: {e}")
            return template

    def send_to_lead(
        self,
        lead: Dict[str, Any],
        template_name: str,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Send an email to a lead.

        Args:
            lead: Lead data dict.
            template_name: Template to use.
            dry_run: If True, don't actually send.

        Returns:
            Result dict with status and tracking info.
        """
        result = {
            'parcel_id': lead.get('parcel_id'),
            'email': lead.get('email_1'),
            'status': 'pending',
            'channel': 'EMAIL',
            'template': template_name
        }

        email = lead.get('email_1')
        if not email or '@' not in email:
            result['status'] = 'no_email'
            result['error'] = 'No valid email address'
            return result

        # Render template
        rendered = self.render_template(template_name, lead)

        if dry_run:
            result['status'] = 'dry_run'
            result['subject'] = rendered['subject']
            return result

        # Send email
        send_result = self.sendgrid_client.send_email(
            to_email=email,
            to_name=lead.get('owner_name', ''),
            subject=rendered['subject'],
            html_content=rendered['html'],
            text_content=rendered['text'],
            categories=['td_realty', 'seller_outreach', template_name],
            custom_args={'parcel_id': lead.get('parcel_id', '')}
        )

        if send_result.get('success'):
            result['status'] = 'sent'
            result['message_id'] = send_result.get('message_id')
        else:
            result['status'] = 'error'
            result['error'] = send_result.get('error')

        return result

    def process_email_queue(
        self,
        limit: int = 50,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Process pending email items from the outreach queue.

        Args:
            limit: Max items to process.
            dry_run: If True, don't send.

        Returns:
            Summary of processing results.
        """
        summary = {
            'processed': 0,
            'sent': 0,
            'no_email': 0,
            'errors': 0,
            'details': []
        }

        try:
            queue_result = self.sheets_client._call_api('get_outreach_queue', {
                'channel': 'EMAIL',
                'status': 'PENDING'
            })

            queue = queue_result.get('queue', [])[:limit]

            for item in queue:
                summary['processed'] += 1

                result = self.send_to_lead(
                    lead=item,
                    template_name=item.get('template', 'life_event_intro'),
                    dry_run=dry_run
                )

                if result['status'] == 'sent':
                    summary['sent'] += 1
                    if not dry_run:
                        self.sheets_client._call_api('update_outreach_status', {
                            'parcel_id': item.get('parcel_id'),
                            'channel': 'EMAIL',
                            'status': 'SENT',
                            'sent_date': datetime.now().isoformat(),
                            'tracking_id': result.get('message_id')
                        })
                elif result['status'] == 'no_email':
                    summary['no_email'] += 1
                elif result['status'] == 'error':
                    summary['errors'] += 1

                summary['details'].append(result)

        except Exception as e:
            logger.error(f"Email queue processing failed: {e}")
            summary['error'] = str(e)

        return summary


def run_email_outreach(
    limit: int = 50,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run email outreach processing.

    Args:
        limit: Max emails to send.
        dry_run: If True, don't send.

    Returns:
        Processing summary.
    """
    sender = EmailSender()
    return sender.process_email_queue(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Send email outreach to leads')
    parser.add_argument('--limit', type=int, default=50, help='Max emails to send')
    parser.add_argument('--dry-run', action='store_true', help='Do not actually send')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_email_outreach(limit=args.limit, dry_run=args.dry_run)

    print(f"\nEmail Outreach Results:")
    print(f"  Processed: {result['processed']}")
    print(f"  Sent: {result['sent']}")
    print(f"  No email: {result['no_email']}")
    print(f"  Errors: {result['errors']}")
