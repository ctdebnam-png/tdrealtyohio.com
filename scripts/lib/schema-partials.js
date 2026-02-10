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
        name: 'TD Realty Ohio, LLC',
        url: 'https://tdrealtyohio.com/',
        telephone: '(614) 392-8858',
        email: 'info@tdrealtyohio.com',
        image: 'https://tdrealtyohio.com/assets/images/og-default.jpg',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Westerville',
          addressRegion: 'OH',
          addressCountry: 'US'
        }
      },
      {
        '@type': 'RealEstateAgent',
        '@id': 'https://tdrealtyohio.com/#agent',
        name: 'TD Realty Ohio, LLC',
        url: 'https://tdrealtyohio.com/',
        telephone: '(614) 392-8858',
        email: 'info@tdrealtyohio.com',
        image: 'https://tdrealtyohio.com/assets/images/og-default.jpg',
        areaServed: { '@type': 'AdministrativeArea', name: 'Central Ohio' },
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
    applicationCategory: 'FinanceApplication',
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
      name: 'TD Realty Ohio',
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
