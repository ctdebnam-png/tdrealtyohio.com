/**
 * TD Realty Ohio – Canonical Contact & License Info
 * ─────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for phone, email, and license numbers.
 * Every page template, schema block, and build script must use
 * these values. If you need to change contact details, change
 * them HERE and re-deploy.
 *
 * Runtime (browser): assets/js/main.js TD_CONFIG.contact mirrors
 * these values and populates data-phone / data-email attributes.
 *
 * Build-time (Node): require/import this file in scripts.
 */

const CONTACT = {
  phone_display: '(614) 392-8858',
  phone_raw: '6143928858',
  phone_e164: '+16143928858',
  phone_href: 'tel:+16143928858',
  email: 'info@tdrealtyohio.com',
  email_href: 'mailto:info@tdrealtyohio.com',
  location: 'Westerville, Ohio',
  address: {
    street: '3600 Tremont Rd Ste 250',
    city: 'Columbus',
    state: 'OH',
    zip: '43221',
    country: 'US',
  },
};

const LICENSES = {
  broker: '2023006467',
  brokerage: '2023006602',
  broker_name: 'Travis Debnam',
  company_name: 'TD Realty Ohio, LLC',
};

// Values that must NEVER appear in public site output
const BANNED_CONTACT = {
  old_phone: '614-956-8656',
  old_phone_variants: ['(614) 956-8656', '6149568656', '614.956.8656'],
  personal_email: 'travisdrealtor@gmail.com',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONTACT, LICENSES, BANNED_CONTACT };
}
