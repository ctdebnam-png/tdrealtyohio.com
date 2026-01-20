"""
Outreach Modules for TD Realty Seller Intelligence

Multi-channel outreach system for contacting motivated sellers:
- Direct mail via Lob
- Email via SendGrid
- SMS via Twilio
- Coordinated campaigns via outreach router
"""

from scripts.outreach.direct_mail import DirectMailSender, run_direct_mail
from scripts.outreach.email_sender import EmailSender, run_email_outreach
from scripts.outreach.sms_sender import SMSSender, run_sms_outreach
from scripts.outreach.outreach_router import OutreachRouter, run_outreach_router

__all__ = [
    'DirectMailSender',
    'EmailSender',
    'SMSSender',
    'OutreachRouter',
    'run_direct_mail',
    'run_email_outreach',
    'run_sms_outreach',
    'run_outreach_router',
]
