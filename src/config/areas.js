/**
 * Area pages: one entry per community the /areas/ page says TD Realty Ohio
 * serves. src/config/routes.js turns each into a route at /areas/<slug>/.
 *
 * counties and sameAs feed the page's Service block (its areaServed City).
 * Every fact on an area page cites a public source in the page's Sources list;
 * nothing here is market data, and none of it describes who lives anywhere.
 */

const AREAS = [
  {
    slug: 'westerville',
    name: 'Westerville',
    title: 'Westerville Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Westerville, Ohio, where TD Realty Ohio is based. Broker Travis Debnam works each sale from pricing through closing.',
    counties: [
      'Franklin County',
      'Delaware County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Westerville,_Ohio'
  },
  {
    slug: 'columbus',
    name: 'Columbus',
    title: 'Columbus, Ohio Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Columbus, Ohio, from Clintonville to German Village. Direct broker representation from TD Realty Ohio.',
    counties: [
      'Franklin County',
      'Delaware County',
      'Fairfield County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Columbus,_Ohio'
  },
  {
    slug: 'dublin',
    name: 'Dublin',
    title: 'Dublin, Ohio Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Dublin, Ohio, a city that spans four counties. TD Realty Ohio checks county, school district and HOA records on every sale.',
    counties: [
      'Franklin County',
      'Delaware County',
      'Union County',
      'Madison County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Dublin,_Ohio'
  },
  {
    slug: 'gahanna',
    name: 'Gahanna',
    title: 'Gahanna Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Gahanna, Ohio, along Big Walnut Creek near John Glenn Columbus International Airport. Broker-led service from TD Realty Ohio.',
    counties: [
      'Franklin County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Gahanna,_Ohio'
  },
  {
    slug: 'new-albany',
    name: 'New Albany',
    title: 'New Albany, Ohio Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in New Albany, Ohio, across Franklin and Licking counties. TD Realty Ohio reviews association and parcel records with you.',
    counties: [
      'Franklin County',
      'Licking County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/New_Albany,_Ohio'
  },
  {
    slug: 'worthington',
    name: 'Worthington',
    title: 'Worthington, Ohio Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Worthington, Ohio, from the Village Green to Linworth. Direct broker representation from TD Realty Ohio.',
    counties: [
      'Franklin County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Worthington,_Ohio'
  },
  {
    slug: 'upper-arlington',
    name: 'Upper Arlington',
    title: 'Upper Arlington Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Upper Arlington, Ohio, from Old Arlington to the neighborhoods north of Lane Avenue. Broker-led service from TD Realty Ohio.',
    counties: [
      'Franklin County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Upper_Arlington,_Ohio'
  },
  {
    slug: 'hilliard',
    name: 'Hilliard',
    title: 'Hilliard, Ohio Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Hilliard, Ohio, from Old Hilliard to the Heritage Rail Trail. Direct broker representation from TD Realty Ohio.',
    counties: [
      'Franklin County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Hilliard,_Ohio'
  },
  {
    slug: 'powell',
    name: 'Powell',
    title: 'Powell, Ohio Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Powell, Ohio, in Delaware County between the Scioto and Olentangy rivers. Broker-led service from TD Realty Ohio.',
    counties: [
      'Delaware County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Powell,_Ohio'
  },
  {
    slug: 'delaware',
    name: 'Delaware',
    title: 'Delaware, Ohio Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Delaware, Ohio, the Delaware County seat and home of Ohio Wesleyan University. Broker-led service from TD Realty Ohio.',
    counties: [
      'Delaware County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Delaware,_Ohio'
  },
  {
    slug: 'pickerington',
    name: 'Pickerington',
    title: 'Pickerington Real Estate Agent | TD Realty Ohio',
    description: 'Buying or selling a home in Pickerington, Ohio, across Fairfield and Franklin counties off I-70. Direct broker representation from TD Realty Ohio.',
    counties: [
      'Fairfield County',
      'Franklin County'
    ],
    sameAs: 'https://en.wikipedia.org/wiki/Pickerington,_Ohio'
  }
];

module.exports = { AREAS };
