const { BROKERAGE_FACTS } = require('../../src/content/brokerage.js');

function scriptTag(schemaObject) {
  return `  <script type="application/ld+json">\n${JSON.stringify(schemaObject, null, 2)}\n  </script>`;
}

function organizationAndAgentGraph() {
  return scriptTag({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://tdrealtyohio.com/#organization',
        name: BROKERAGE_FACTS.legalName,
        url: 'https://tdrealtyohio.com/',
        telephone: BROKERAGE_FACTS.phone,
        email: BROKERAGE_FACTS.email,
        image: 'https://tdrealtyohio.com/assets/images/og-default.jpg',
        address: {
          '@type': 'PostalAddress',
          addressLocality: BROKERAGE_FACTS.addressLocality,
          addressRegion: BROKERAGE_FACTS.addressRegion,
          addressCountry: BROKERAGE_FACTS.addressCountry
        }
      },
      {
        '@type': 'RealEstateAgent',
        '@id': 'https://tdrealtyohio.com/#agent',
        name: BROKERAGE_FACTS.legalName,
        url: 'https://tdrealtyohio.com/',
        telephone: BROKERAGE_FACTS.phone,
        email: BROKERAGE_FACTS.email,
        image: 'https://tdrealtyohio.com/assets/images/og-default.jpg',
        description: BROKERAGE_FACTS.primaryMessage,
        areaServed: { '@type': 'AdministrativeArea', name: BROKERAGE_FACTS.serviceArea },
        parentOrganization: { '@id': 'https://tdrealtyohio.com/#organization' }
      }
    ]
  });
}

function breadcrumbSchema(items) {
  return scriptTag({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item
    }))
  });
}

function webApplicationSchema({ name, description, url, areaServed }) {
  return scriptTag({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    provider: { '@id': 'https://tdrealtyohio.com/#agent' },
    ...(areaServed ? { areaServed } : {})
  });
}

function collectionPageSchema({ name, description, url }) {
  return scriptTag({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url,
    isPartOf: {
      '@type': 'WebSite',
      name: BROKERAGE_FACTS.brandName,
      url: 'https://tdrealtyohio.com/'
    },
    about: { '@id': 'https://tdrealtyohio.com/#agent' }
  });
}

module.exports = {
  organizationAndAgentGraph,
  breadcrumbSchema,
  webApplicationSchema,
  collectionPageSchema
};
