"""
Outreach Router for TD Realty Seller Intelligence

Orchestrates multi-channel outreach campaigns, determining which
channels to use based on lead data, preferences, and business rules.

Handles:
- Channel selection based on available contact info
- Outreach sequencing and timing
- Compliance with channel-specific rules
- Campaign coordination
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from scripts.sync.sheets_sync import SheetsClient, get_sheets_client
from scripts.outreach.direct_mail import DirectMailSender
from scripts.outreach.email_sender import EmailSender
from scripts.outreach.sms_sender import SMSSender

logger = logging.getLogger(__name__)


# Outreach rules and timing
OUTREACH_RULES = {
    # Priority tier determines outreach intensity
    'HOT': {
        'channels': ['MAIL', 'EMAIL', 'SMS'],
        'initial_delay_days': 0,
        'followup_delay_days': 7,
        'max_attempts': 5
    },
    'WARM': {
        'channels': ['MAIL', 'EMAIL'],
        'initial_delay_days': 1,
        'followup_delay_days': 14,
        'max_attempts': 3
    },
    'COLD': {
        'channels': ['MAIL'],
        'initial_delay_days': 3,
        'followup_delay_days': 30,
        'max_attempts': 2
    }
}

# Template selection based on life event
TEMPLATE_MAP = {
    'DIVORCE': {
        'MAIL': 'life_event_divorce',
        'EMAIL': 'life_event_intro',
        'SMS': 'life_event'
    },
    'PROBATE': {
        'MAIL': 'life_event_probate',
        'EMAIL': 'life_event_intro',
        'SMS': 'life_event'
    },
    'FORECLOSURE': {
        'MAIL': 'life_event_foreclosure',
        'EMAIL': 'life_event_intro',
        'SMS': 'life_event'
    },
    'HIGH_EQUITY': {
        'MAIL': 'high_equity_long_term',
        'EMAIL': 'high_equity_followup',
        'SMS': 'high_equity'
    },
    'DEFAULT': {
        'MAIL': 'high_equity_long_term',
        'EMAIL': 'life_event_intro',
        'SMS': 'intro'
    }
}


class OutreachRouter:
    """
    Routes leads to appropriate outreach channels based on
    available contact info, lead priority, and business rules.
    """

    def __init__(
        self,
        sheets_client: Optional[SheetsClient] = None
    ):
        self.sheets_client = sheets_client or get_sheets_client()

        # Initialize channel senders lazily
        self._mail_sender = None
        self._email_sender = None
        self._sms_sender = None

    @property
    def mail_sender(self) -> DirectMailSender:
        if self._mail_sender is None:
            self._mail_sender = DirectMailSender(self.sheets_client)
        return self._mail_sender

    @property
    def email_sender(self) -> EmailSender:
        if self._email_sender is None:
            self._email_sender = EmailSender(self.sheets_client)
        return self._email_sender

    @property
    def sms_sender(self) -> SMSSender:
        if self._sms_sender is None:
            self._sms_sender = SMSSender(self.sheets_client)
        return self._sms_sender

    def get_available_channels(self, lead: Dict[str, Any]) -> List[str]:
        """
        Determine which channels are available for a lead based on contact info.

        Args:
            lead: Lead data dict.

        Returns:
            List of available channel names.
        """
        channels = ['MAIL']  # Mail is always available if we have an address

        if not lead.get('address') and not lead.get('owner_mailing_address'):
            channels.remove('MAIL')

        if lead.get('email_1') and '@' in lead.get('email_1', ''):
            channels.append('EMAIL')

        if lead.get('phone_1'):
            channels.append('SMS')

        return channels

    def select_template(self, lead: Dict[str, Any], channel: str) -> str:
        """
        Select the appropriate template based on lead characteristics.

        Args:
            lead: Lead data dict.
            channel: Outreach channel.

        Returns:
            Template name.
        """
        # Check for life events first
        life_event = lead.get('life_event_type', '')
        if life_event in TEMPLATE_MAP:
            return TEMPLATE_MAP[life_event].get(channel, TEMPLATE_MAP['DEFAULT'][channel])

        # Check equity level
        equity = lead.get('estimated_equity', 0)
        if equity and equity > 100000:
            return TEMPLATE_MAP['HIGH_EQUITY'].get(channel, TEMPLATE_MAP['DEFAULT'][channel])

        return TEMPLATE_MAP['DEFAULT'][channel]

    def should_outreach(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determine if a lead should receive outreach and on which channels.

        Args:
            lead: Lead data dict.

        Returns:
            Dict with 'should_outreach' bool and recommended 'channels'.
        """
        result = {
            'should_outreach': False,
            'channels': [],
            'reason': ''
        }

        priority = lead.get('priority_tier', 'COLD')
        rules = OUTREACH_RULES.get(priority, OUTREACH_RULES['COLD'])

        # Check if already contacted too many times
        outreach_count = lead.get('outreach_count', 0)
        if outreach_count >= rules['max_attempts']:
            result['reason'] = 'Max attempts reached'
            return result

        # Check timing since last outreach
        last_outreach = lead.get('last_outreach_date')
        if last_outreach:
            try:
                last_date = datetime.fromisoformat(last_outreach)
                days_since = (datetime.now() - last_date).days
                if days_since < rules['followup_delay_days']:
                    result['reason'] = f'Too soon for followup ({days_since} days)'
                    return result
            except ValueError:
                pass

        # Check initial delay for new leads
        created_date = lead.get('created_date') or lead.get('last_updated')
        if created_date and outreach_count == 0:
            try:
                created = datetime.fromisoformat(created_date)
                days_since = (datetime.now() - created).days
                if days_since < rules['initial_delay_days']:
                    result['reason'] = f'Initial delay not met ({days_since} days)'
                    return result
            except ValueError:
                pass

        # Get available channels that match rules
        available = self.get_available_channels(lead)
        allowed = rules['channels']
        channels = [c for c in allowed if c in available]

        if not channels:
            result['reason'] = 'No channels available'
            return result

        result['should_outreach'] = True
        result['channels'] = channels
        result['reason'] = 'Ready for outreach'
        return result

    def queue_lead_for_outreach(
        self,
        lead: Dict[str, Any],
        channels: List[str] = None,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Add a lead to the outreach queue for specified channels.

        Args:
            lead: Lead data dict.
            channels: Specific channels to queue (or auto-select).
            dry_run: If True, don't actually queue.

        Returns:
            Result dict with queued channels.
        """
        result = {
            'parcel_id': lead.get('parcel_id'),
            'queued_channels': [],
            'skipped_channels': []
        }

        # Determine channels if not specified
        if channels is None:
            outreach_decision = self.should_outreach(lead)
            if not outreach_decision['should_outreach']:
                result['status'] = 'skipped'
                result['reason'] = outreach_decision['reason']
                return result
            channels = outreach_decision['channels']

        for channel in channels:
            template = self.select_template(lead, channel)

            queue_item = {
                'parcel_id': lead.get('parcel_id'),
                'address': lead.get('address'),
                'owner_name': lead.get('owner_name'),
                'channel': channel,
                'template': template,
                'status': 'PENDING',
                'queued_date': datetime.now().isoformat(),
                # Include contact info
                'email_1': lead.get('email_1'),
                'phone_1': lead.get('phone_1'),
                'city': lead.get('city'),
                'neighborhood': lead.get('neighborhood'),
                'owner_mailing_address': lead.get('owner_mailing_address'),
                'estimated_equity': lead.get('estimated_equity'),
                'priority_tier': lead.get('priority_tier'),
                'life_event_type': lead.get('life_event_type')
            }

            if not dry_run:
                try:
                    self.sheets_client._call_api('queue_outreach', {
                        'item': queue_item
                    })
                    result['queued_channels'].append(channel)
                except Exception as e:
                    logger.error(f"Failed to queue {channel} for {lead.get('parcel_id')}: {e}")
                    result['skipped_channels'].append({'channel': channel, 'error': str(e)})
            else:
                result['queued_channels'].append(channel)

        result['status'] = 'queued' if result['queued_channels'] else 'failed'
        return result

    def process_hot_leads(
        self,
        limit: int = 50,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Process HOT leads for multi-channel outreach.

        Args:
            limit: Max leads to process.
            dry_run: If True, don't queue.

        Returns:
            Summary of processing.
        """
        summary = {
            'processed': 0,
            'queued': 0,
            'skipped': 0,
            'details': []
        }

        try:
            # Get HOT leads that need outreach
            hot_leads = self.sheets_client.read_sheet('Hot Leads')[:limit]

            for lead in hot_leads:
                summary['processed'] += 1

                result = self.queue_lead_for_outreach(lead, dry_run=dry_run)
                summary['details'].append(result)

                if result.get('status') == 'queued':
                    summary['queued'] += 1
                else:
                    summary['skipped'] += 1

        except Exception as e:
            logger.error(f"Hot lead processing failed: {e}")
            summary['error'] = str(e)

        return summary

    def run_daily_outreach(
        self,
        mail_limit: int = 20,
        email_limit: int = 50,
        sms_limit: int = 30,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Run daily outreach across all channels.

        Args:
            mail_limit: Max mail pieces.
            email_limit: Max emails.
            sms_limit: Max SMS.
            dry_run: If True, don't send.

        Returns:
            Summary of all outreach.
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'mail': {},
            'email': {},
            'sms': {},
            'totals': {
                'processed': 0,
                'sent': 0,
                'errors': 0
            }
        }

        # Process each channel
        try:
            results['mail'] = self.mail_sender.process_mail_queue(
                limit=mail_limit, dry_run=dry_run
            )
            results['totals']['processed'] += results['mail'].get('processed', 0)
            results['totals']['sent'] += results['mail'].get('sent', 0)
            results['totals']['errors'] += results['mail'].get('errors', 0)
        except Exception as e:
            results['mail'] = {'error': str(e)}

        try:
            results['email'] = self.email_sender.process_email_queue(
                limit=email_limit, dry_run=dry_run
            )
            results['totals']['processed'] += results['email'].get('processed', 0)
            results['totals']['sent'] += results['email'].get('sent', 0)
            results['totals']['errors'] += results['email'].get('errors', 0)
        except Exception as e:
            results['email'] = {'error': str(e)}

        try:
            results['sms'] = self.sms_sender.process_sms_queue(
                limit=sms_limit, dry_run=dry_run
            )
            results['totals']['processed'] += results['sms'].get('processed', 0)
            results['totals']['sent'] += results['sms'].get('sent', 0)
            results['totals']['errors'] += results['sms'].get('errors', 0)
        except Exception as e:
            results['sms'] = {'error': str(e)}

        # Log summary
        if not dry_run:
            self.sheets_client.log_run(
                'daily_outreach',
                'success' if results['totals']['errors'] == 0 else 'partial',
                results['totals']['sent'],
                ''
            )

        return results


def run_outreach_router(
    mail_limit: int = 20,
    email_limit: int = 50,
    sms_limit: int = 30,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Run the daily outreach router.

    Args:
        mail_limit: Max mail to send.
        email_limit: Max emails to send.
        sms_limit: Max SMS to send.
        dry_run: If True, don't send.

    Returns:
        Summary of all outreach.
    """
    router = OutreachRouter()
    return router.run_daily_outreach(
        mail_limit=mail_limit,
        email_limit=email_limit,
        sms_limit=sms_limit,
        dry_run=dry_run
    )


if __name__ == '__main__':
    import argparse
    import sys

    sys.path.insert(0, str(__file__).rsplit('/', 3)[0])

    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description='Run multi-channel outreach')
    parser.add_argument('--mail-limit', type=int, default=20, help='Max mail')
    parser.add_argument('--email-limit', type=int, default=50, help='Max emails')
    parser.add_argument('--sms-limit', type=int, default=30, help='Max SMS')
    parser.add_argument('--dry-run', action='store_true', help='Do not send')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose')

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    result = run_outreach_router(
        mail_limit=args.mail_limit,
        email_limit=args.email_limit,
        sms_limit=args.sms_limit,
        dry_run=args.dry_run
    )

    print(f"\nOutreach Router Results:")
    print(f"  Total Processed: {result['totals']['processed']}")
    print(f"  Total Sent: {result['totals']['sent']}")
    print(f"  Total Errors: {result['totals']['errors']}")
    print(f"\n  Mail: {result['mail'].get('sent', 0)} sent")
    print(f"  Email: {result['email'].get('sent', 0)} sent")
    print(f"  SMS: {result['sms'].get('sent', 0)} sent")
