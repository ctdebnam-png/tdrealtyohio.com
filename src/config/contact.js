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
  phone_display: '(614) 956-8656',
  phone_raw: '6149568656',
  phone_e164: '+16149568656',
  phone_href: 'tel:+16149568656',
  email: 'info@tdrealtyohio.com',
  email_href: 'mailto:info@tdrealtyohio.com',
  location: 'Westerville, Ohio',
  address: {
    street: '242 Apache Cir',
    city: 'Westerville',
    state: 'OH',
    zip: '43081',
    country: 'US',
  },
};

const LICENSES = {
  broker: '2023006467',
  brokerage: '2023006602',
  broker_name: 'Travis Debnam',
  company_name: 'TD Realty Ohio, LLC',
};

// Values that must NEVER appear in public site output.
//
// (614) 392-8858 is the retired brokerage line. It was replaced by the number
// in CONTACT above, and it is banned here so it cannot come back through a
// copied template or a restored generator.
const BANNED_CONTACT = {
  old_phone: '614-392-8858',
  old_phone_variants: ['(614) 392-8858', '6143928858', '614.392.8858'],
  personal_email: 'travisdrealtor@gmail.com',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONTACT, LICENSES, BANNED_CONTACT };
}
