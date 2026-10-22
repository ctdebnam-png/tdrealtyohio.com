/**
 * TD Realty Ohio - Centralized JSON-LD Schema Module
 *
 * Single source of truth for structured data across all pages.
 * Every builder reads from TD_SCHEMA_CONFIG so business facts stay
 * consistent site-wide.
 *
 * Usage (browser):
 *   <script src="/assets/js/schema.js"></script>
 *   <script>
 *     const org = buildOrganizationSchema();
 *     const agent = buildRealEstateAgentSchema({ description: '...' });
 *     // inject into <script type="application/ld+json">
 *   </script>
 *
 * Usage (Node / tests):
 *   const { TD_SCHEMA_CONFIG, buildOrganizationSchema, buildRealEstateAgentSchema } = require('./schema');
 */

/*
 * Contact facts come from src/config/contact.js, which declares itself the
 * single source of truth for phone, email and licence numbers. They used to be
 * repeated here as literals, which is how the retired phone number came to sit
 * in four places at once.
 *
 * Guarded, because this file is also loadable in a browser. In Node — the only
 * context that matters now, since JSON-LD is generated at build time — the
 * literals below are replaced by the real thing. check:json-ld asserts the
 * fallbacks still match, so the browser copy cannot drift either.
 */
var TD_CONTACT_SRC = null;
var TD_LICENSE_SRC = null;
if (typeof require === 'function') {
  try {
    var _contact = require('../../src/config/contact.js');
    TD_CONTACT_SRC = _contact.CONTACT;
    TD_LICENSE_SRC = _contact.LICENSES;
  } catch (e) {
    TD_CONTACT_SRC = null;
  }
}

// ===== CONFIGURATION =====
const TD_SCHEMA_CONFIG = {
  name: TD_LICENSE_SRC ? TD_LICENSE_SRC.company_name : 'TD Realty Ohio, LLC',
  url: 'https://tdrealtyohio.com',
  ids: {
    organization: 'https://tdrealtyohio.com/#organization',
    realEstateAgent: 'https://tdrealtyohio.com/#realestateagent'
  },
  telephone: TD_CONTACT_SRC ? TD_CONTACT_SRC.phone_display : '(614) 956-8656',
  email: TD_CONTACT_SRC ? TD_CONTACT_SRC.email : 'info@tdrealtyohio.com',

  address: {
    addressLocality: TD_CONTACT_SRC ? TD_CONTACT_SRC.address.city : 'Westerville',
    addressRegion: TD_CONTACT_SRC ? TD_CONTACT_SRC.address.state : 'OH',
    addressCountry: TD_CONTACT_SRC ? TD_CONTACT_SRC.address.country : 'US',
    /*
     * streetAddress is held behind includeStreetAddress (below) and stays off.
     * The address of record is residential; publishing it in structured data on
     * every page is a different decision from recording it in contact.js, and
     * it is not one this file makes on its own.
     */
    streetAddress: TD_CONTACT_SRC ? TD_CONTACT_SRC.address.street : null
  },

  /*
   * No geo coordinates. The pages name the town and nothing finer, and the
   * pair that used to sit here (40.0417, -83.0804) was west of Columbus, not
   * in Westerville. Structured data says only what the pages say.
   */

  // "Broker: Travis Debnam" in the footer of every page.
  broker: {
    name: TD_LICENSE_SRC ? TD_LICENSE_SRC.broker_name : 'Travis Debnam',
    jobTitle: 'Broker'
  },

  // The service area as the pages name it (BROKERAGE_FACTS.serviceArea).
  areaServed: 'Central Ohio',

  licenses: {
    broker: TD_LICENSE_SRC ? TD_LICENSE_SRC.broker : '2023006467',
    brokerage: TD_LICENSE_SRC ? TD_LICENSE_SRC.brokerage : '2023006602'
  },

  // When false, streetAddress is omitted from every PostalAddress block.
  includeStreetAddress: false
};

// ===== HELPERS =====

/**
 * Build a Schema.org PostalAddress object from the config.
 * Respects the includeStreetAddress flag.
 */
function _buildPostalAddress() {
  var addr = {
    '@type': 'PostalAddress',
    addressLocality: TD_SCHEMA_CONFIG.address.addressLocality,
    addressRegion: TD_SCHEMA_CONFIG.address.addressRegion,
    addressCountry: TD_SCHEMA_CONFIG.address.addressCountry
  };

  if (TD_SCHEMA_CONFIG.includeStreetAddress && TD_SCHEMA_CONFIG.address.streetAddress) {
    addr.streetAddress = TD_SCHEMA_CONFIG.address.streetAddress;
  }

  return addr;
}

/**
 * A licence as the footer of every page shows it: "Broker License #..." and
 * "Brokerage License #...".
 */
function _buildLicense(name, number) {
  return {
    '@type': 'EducationalOccupationalCredential',
    credentialCategory: 'license',
    name: name,
    identifier: number
  };
}

/**
 * The broker, with the broker licence the footer shows beside his name.
 */
function _buildBroker() {
  return {
    '@type': 'Person',
    name: TD_SCHEMA_CONFIG.broker.name,
    jobTitle: TD_SCHEMA_CONFIG.broker.jobTitle,
    hasCredential: _buildLicense('Broker License', TD_SCHEMA_CONFIG.licenses.broker)
  };
}

// ===== BUILDERS =====

/**
 * Build a JSON-LD object for the Organization (the brokerage itself).
 *
 * @returns {Object} Schema.org Organization
 */
function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': TD_SCHEMA_CONFIG.ids.organization,
    name: TD_SCHEMA_CONFIG.name,
    url: TD_SCHEMA_CONFIG.url,
    telephone: TD_SCHEMA_CONFIG.telephone,
    email: TD_SCHEMA_CONFIG.email,
    address: _buildPostalAddress(),
    employee: _buildBroker()
  };
}

/**
 * Build a JSON-LD object for a RealEstateAgent page.
 *
 * @param {Object} [options]
 * @param {string}              [options.description]      - Free-text business description.
 * @param {string|string[]}     [options.areaServed]       - City / region name(s).
 * @param {Object}              [options.aggregateRating]   - { ratingValue, reviewCount }.
 * @param {Object}              [options.hasOfferCatalog]   - Full Schema.org OfferCatalog object.
 * @returns {Object} Schema.org RealEstateAgent
 */
function buildRealEstateAgentSchema(options) {
  var opts = options || {};

  var schema = {
    '@context': 'https://schema.org',
    // RealEstateAgent is already a kind of LocalBusiness in schema.org; both
    // are named so a reader looking only for LocalBusiness finds it.
    '@type': ['RealEstateAgent', 'LocalBusiness'],
    '@id': TD_SCHEMA_CONFIG.ids.realEstateAgent,
    name: TD_SCHEMA_CONFIG.name,
    url: TD_SCHEMA_CONFIG.url,
    telephone: TD_SCHEMA_CONFIG.telephone,
    email: TD_SCHEMA_CONFIG.email,
    address: _buildPostalAddress(),
    areaServed: {
      '@type': 'AdministrativeArea',
      name: TD_SCHEMA_CONFIG.areaServed
    },
    hasCredential: _buildLicense('Brokerage License', TD_SCHEMA_CONFIG.licenses.brokerage),
    // `broker` is not a RealEstateAgent property (validator.schema.org warns
    // on it); `employee` is.
    employee: _buildBroker(),
    parentOrganization: {
      '@id': TD_SCHEMA_CONFIG.ids.organization
    }
  };

  if (opts.description) {
    schema.description = opts.description;
  }

  if (opts.areaServed) {
    schema.areaServed = opts.areaServed;
  }

  if (opts.serviceRegion) {
    schema.serviceArea = {
      '@type': 'AdministrativeArea',
      name: opts.serviceRegion
    };
  }

  if (opts.aggregateRating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: opts.aggregateRating.ratingValue,
      reviewCount: opts.aggregateRating.reviewCount
    };
  }

  if (opts.hasOfferCatalog) {
    schema.hasOfferCatalog = opts.hasOfferCatalog;
  }

  return schema;
}

/**
 * Build a BreadcrumbList from a route's path and its parent chain.
 *
 * `trail` is an ordered array of { name, path } ending with the page itself.
 * A single-item trail is not emitted by the generator: a breadcrumb list
 * containing only the current page describes no path and is noise.
 */
function buildBreadcrumbListSchema(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(function (crumb, index) {
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: TD_SCHEMA_CONFIG.url + crumb.path
      };
    })
  };
}

/**
 * Build a Service for a service or area page, provided by the brokerage.
 *
 * `place` is optional. Given { name, counties, sameAs }, areaServed becomes
 * that City, inside its counties and Ohio; otherwise it is the service area
 * the pages name (Central Ohio). No price, rating or offer: the pages state
 * none, so the structured data states none.
 *
 * @param {Object} opts
 * @param {string} opts.name
 * @param {string} opts.serviceType
 * @param {string} opts.description
 * @param {string} opts.path        - page path, e.g. '/areas/westerville/'
 * @param {Object} [opts.place]
 * @returns {Object} Schema.org Service
 */
function buildServiceSchema(opts) {
  var areaServed = {
    '@type': 'AdministrativeArea',
    name: TD_SCHEMA_CONFIG.areaServed
  };

  if (opts.counties) {
    areaServed = opts.counties.map(function (county) {
      return {
        '@type': 'AdministrativeArea',
        name: county,
        containedInPlace: { '@type': 'State', name: 'Ohio' }
      };
    });
  } else if (opts.place) {
    areaServed = {
      '@type': 'City',
      name: opts.place.name,
      containedInPlace: opts.place.counties.map(function (county) {
        return {
          '@type': 'AdministrativeArea',
          name: county,
          containedInPlace: { '@type': 'State', name: 'Ohio' }
        };
      }),
      sameAs: opts.place.sameAs
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    serviceType: opts.serviceType,
    description: opts.description,
    url: TD_SCHEMA_CONFIG.url + opts.path,
    provider: {
      '@type': ['RealEstateAgent', 'LocalBusiness'],
      '@id': TD_SCHEMA_CONFIG.ids.realEstateAgent,
      name: TD_SCHEMA_CONFIG.name
    },
    areaServed: areaServed
  };
}

// ===== EXPORTS =====
if (typeof module !== 'undefined') {
  module.exports = {
    TD_SCHEMA_CONFIG: TD_SCHEMA_CONFIG,
    buildOrganizationSchema: buildOrganizationSchema,
    buildRealEstateAgentSchema: buildRealEstateAgentSchema,
    buildBreadcrumbListSchema: buildBreadcrumbListSchema,
    buildServiceSchema: buildServiceSchema
  };
}
