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

  geo: {
    latitude: 40.0417,
    longitude: -83.0804
  },

  broker: {
    name: TD_LICENSE_SRC ? TD_LICENSE_SRC.broker_name : 'Travis Debnam',
    jobTitle: 'Broker/Owner'
  },

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
 * Build a Schema.org GeoCoordinates object from the config.
 */
function _buildGeoCoordinates() {
  return {
    '@type': 'GeoCoordinates',
    latitude: TD_SCHEMA_CONFIG.geo.latitude,
    longitude: TD_SCHEMA_CONFIG.geo.longitude
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
    geo: _buildGeoCoordinates(),
    founder: {
      '@type': 'Person',
      name: TD_SCHEMA_CONFIG.broker.name,
      jobTitle: TD_SCHEMA_CONFIG.broker.jobTitle
    }
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
    '@type': 'RealEstateAgent',
    '@id': TD_SCHEMA_CONFIG.ids.realEstateAgent,
    name: TD_SCHEMA_CONFIG.name,
    url: TD_SCHEMA_CONFIG.url,
    telephone: TD_SCHEMA_CONFIG.telephone,
    email: TD_SCHEMA_CONFIG.email,
    address: _buildPostalAddress(),
    geo: _buildGeoCoordinates(),
    broker: {
      '@type': 'Person',
      name: TD_SCHEMA_CONFIG.broker.name,
      jobTitle: TD_SCHEMA_CONFIG.broker.jobTitle
    },
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

// ===== EXPORTS =====
if (typeof module !== 'undefined') {
  module.exports = {
    TD_SCHEMA_CONFIG: TD_SCHEMA_CONFIG,
    buildOrganizationSchema: buildOrganizationSchema,
    buildRealEstateAgentSchema: buildRealEstateAgentSchema,
    buildBreadcrumbListSchema: buildBreadcrumbListSchema
  };
}
