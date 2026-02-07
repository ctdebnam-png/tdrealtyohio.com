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

// ===== CONFIGURATION =====
const TD_SCHEMA_CONFIG = {
  name: 'TD Realty Ohio, LLC',
  url: 'https://tdrealtyohio.com',
  telephone: '(614) 392-8858',
  email: 'info@tdrealtyohio.com',

  address: {
    addressLocality: 'Westerville',
    addressRegion: 'OH',
    addressCountry: 'US'
    // NO streetAddress — avoids implying a physical office location
  },

  geo: {
    latitude: 40.0417,
    longitude: -83.0804
  },

  broker: {
    name: 'Travis Debnam',
    jobTitle: 'Broker/Owner'
  },

  licenses: {
    broker: '2023006467',
    brokerage: '2023006602'
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
    }
  };

  if (opts.description) {
    schema.description = opts.description;
  }

  if (opts.areaServed) {
    schema.areaServed = opts.areaServed;
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

// ===== EXPORTS =====
if (typeof module !== 'undefined') {
  module.exports = {
    TD_SCHEMA_CONFIG: TD_SCHEMA_CONFIG,
    buildOrganizationSchema: buildOrganizationSchema,
    buildRealEstateAgentSchema: buildRealEstateAgentSchema
  };
}
