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
  phone: '(614) 392-8858',
  phoneRaw: '6143928858',
  phoneHref: 'tel:6143928858',
  email: 'info@tdrealtyohio.com',
  emailHref: 'mailto:info@tdrealtyohio.com',
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
  brokerName: 'Travis Debnam',
  companyName: 'TD Realty Ohio, LLC',
};

// Values that must NEVER appear in public site output
const BANNED_CONTACT = {
  oldPhone: '614-956-8656',
  oldPhoneVariants: ['(614) 956-8656', '6149568656', '614.956.8656'],
  personalEmail: 'travisdrealtor@gmail.com',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONTACT, LICENSES, BANNED_CONTACT };
}
