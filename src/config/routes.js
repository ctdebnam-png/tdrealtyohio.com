/**
 * TD Realty Ohio - Canonical Route Registry
 * Single source of truth for all routes, sitemap, robots.txt, and canonical URLs.
 *
 * Every route on the site MUST be registered here. The build step uses this
 * registry to generate sitemap.xml, robots.txt, and validate canonical tags.
 */

const SITE_URL = 'https://tdrealtyohio.com';

// Page types for schema generation
const PAGE_TYPES = {
  HOME: 'home',
  SERVICE: 'service',
  AREA: 'area',
  ZIP: 'zip',
  BLOG: 'blog',
  BLOG_INDEX: 'blog_index',
  COMPARISON: 'comparison',
  TOOL: 'tool',
  HUB: 'hub',
  FAQ: 'faq',
  LEGAL: 'legal',
  CONTACT: 'contact',
  ABOUT: 'about',
  LANDING: 'landing',
  CALCULATOR: 'calculator',
  REVIEWS: 'reviews',
  CREDENTIALS: 'credentials',
};

/**
 * Route definition schema:
 * {
 *   path: string,           // URL path with trailing slash
 *   title: string,          // <title> tag
 *   description: string,    // meta description
 *   pageType: string,       // from PAGE_TYPES
 *   priority: string,       // sitemap priority 0.0-1.0
 *   changefreq: string,     // sitemap changefreq
 *   noindex: boolean,       // if true, excluded from sitemap + gets noindex
 *   canonical: string|null, // override canonical (null = self-referential)
 *   ogTitle: string,        // Open Graph title
 *   ogDescription: string,  // Open Graph description
 *   ogImage: string,        // Open Graph image path
 *   schema: string[],       // schema types to include
 *   parent: string|null,    // parent route path for breadcrumbs
 *   hubLinks: string[],     // internal links to hub pages
 *   siblingLinks: string[], // internal links to sibling pages
 * }
 */

const CITIES = [
  { slug: 'westerville', name: 'Westerville', county: 'Franklin/Delaware', zip: '43081, 43082', medianPrice: 400000, daysOnMarket: 12, schoolDistrict: 'Westerville City Schools', population: '40,000+', commute: '20 min to downtown Columbus via I-270/I-71' },
  { slug: 'new-albany', name: 'New Albany', county: 'Franklin', zip: '43054', medianPrice: 550000, daysOnMarket: 14, schoolDistrict: 'New Albany-Plain Local Schools', population: '12,000+', commute: '25 min to downtown Columbus via SR-161/I-670' },
  { slug: 'gahanna', name: 'Gahanna', county: 'Franklin', zip: '43230', medianPrice: 350000, daysOnMarket: 11, schoolDistrict: 'Gahanna-Jefferson Public Schools', population: '35,000+', commute: '15 min to downtown Columbus via I-670' },
  { slug: 'worthington', name: 'Worthington', county: 'Franklin', zip: '43085', medianPrice: 380000, daysOnMarket: 10, schoolDistrict: 'Worthington Schools', population: '15,000+', commute: '15 min to downtown Columbus via US-23/I-71' },
  { slug: 'lewis-center', name: 'Lewis Center', county: 'Delaware', zip: '43035', medianPrice: 420000, daysOnMarket: 13, schoolDistrict: 'Olentangy Local Schools', population: '30,000+', commute: '30 min to downtown Columbus via US-23/I-71' },
  { slug: 'hilliard', name: 'Hilliard', county: 'Franklin', zip: '43026', medianPrice: 360000, daysOnMarket: 11, schoolDistrict: 'Hilliard City Schools', population: '36,000+', commute: '20 min to downtown Columbus via I-270/I-70' },
  { slug: 'dublin', name: 'Dublin', county: 'Franklin/Delaware', zip: '43016, 43017', medianPrice: 480000, daysOnMarket: 14, schoolDistrict: 'Dublin City Schools', population: '50,000+', commute: '20 min to downtown Columbus via I-270/US-33' },
  { slug: 'powell', name: 'Powell', county: 'Delaware', zip: '43065', medianPrice: 470000, daysOnMarket: 15, schoolDistrict: 'Olentangy Local Schools', population: '14,000+', commute: '25 min to downtown Columbus via US-23/I-270' },
  { slug: 'sunbury', name: 'Sunbury', county: 'Delaware', zip: '43074', medianPrice: 370000, daysOnMarket: 16, schoolDistrict: 'Big Walnut Local Schools', population: '7,000+', commute: '35 min to downtown Columbus via US-36/I-71' },
  { slug: 'galena', name: 'Galena', county: 'Delaware', zip: '43021', medianPrice: 440000, daysOnMarket: 15, schoolDistrict: 'Big Walnut / Olentangy Local Schools', population: '1,000+', commute: '30 min to downtown Columbus via US-36/I-71' },
  { slug: 'columbus', name: 'Columbus', county: 'Franklin', zip: '43201-43232', medianPrice: 280000, daysOnMarket: 10, schoolDistrict: 'Columbus City Schools', population: '900,000+', commute: 'Central Ohio hub' },
  { slug: 'delaware', name: 'Delaware', county: 'Delaware', zip: '43015', medianPrice: 310000, daysOnMarket: 14, schoolDistrict: 'Delaware City Schools', population: '42,000+', commute: '35 min to downtown Columbus via US-23' },
  { slug: 'upper-arlington', name: 'Upper Arlington', county: 'Franklin', zip: '43221', medianPrice: 490000, daysOnMarket: 12, schoolDistrict: 'Upper Arlington Schools', population: '36,000+', commute: '10 min to downtown Columbus via SR-315' },
  { slug: 'pickerington', name: 'Pickerington', county: 'Fairfield', zip: '43147', medianPrice: 340000, daysOnMarket: 11, schoolDistrict: 'Pickerington Local Schools', population: '22,000+', commute: '25 min to downtown Columbus via US-33' },
  { slug: 'grove-city', name: 'Grove City', county: 'Franklin', zip: '43123', medianPrice: 290000, daysOnMarket: 9, schoolDistrict: 'South-Western City Schools', population: '42,000+', commute: '15 min to downtown Columbus via I-71' },
  { slug: 'blacklick', name: 'Blacklick', county: 'Franklin', zip: '43004', medianPrice: 360000, daysOnMarket: 12, schoolDistrict: 'Gahanna-Jefferson / Licking Heights', population: '12,000+', commute: '20 min to downtown Columbus via I-70' },
  { slug: 'clintonville', name: 'Clintonville', county: 'Franklin', zip: '43202, 43214', medianPrice: 320000, daysOnMarket: 8, schoolDistrict: 'Columbus City Schools', population: '30,000+', commute: '10 min to downtown Columbus via High St/I-71' },
  { slug: 'pataskala', name: 'Pataskala', county: 'Licking', zip: '43062', medianPrice: 310000, daysOnMarket: 13, schoolDistrict: 'Southwest Licking Local Schools', population: '16,000+', commute: '30 min to downtown Columbus via I-70' },
  { slug: 'bexley', name: 'Bexley', county: 'Franklin', zip: '43209', medianPrice: 430000, daysOnMarket: 10, schoolDistrict: 'Bexley City Schools', population: '14,000+', commute: '10 min to downtown Columbus via E Broad St' },
  { slug: 'canal-winchester', name: 'Canal Winchester', county: 'Franklin/Fairfield', zip: '43110', medianPrice: 330000, daysOnMarket: 11, schoolDistrict: 'Canal Winchester Local Schools', population: '9,000+', commute: '20 min to downtown Columbus via US-33' },
  { slug: 'german-village', name: 'German Village', county: 'Franklin', zip: '43206', medianPrice: 400000, daysOnMarket: 9, schoolDistrict: 'Columbus City Schools', population: '5,000+', commute: '5 min to downtown Columbus' },
  { slug: 'grandview-heights', name: 'Grandview Heights', county: 'Franklin', zip: '43212', medianPrice: 420000, daysOnMarket: 8, schoolDistrict: 'Grandview Heights Schools', population: '8,000+', commute: '5 min to downtown Columbus via W 5th Ave' },
  { slug: 'granville', name: 'Granville', county: 'Licking', zip: '43023', medianPrice: 380000, daysOnMarket: 18, schoolDistrict: 'Granville Exempted Village Schools', population: '6,000+', commute: '40 min to downtown Columbus via SR-16/I-70' },
  { slug: 'johnstown', name: 'Johnstown', county: 'Licking', zip: '43031', medianPrice: 310000, daysOnMarket: 15, schoolDistrict: 'Johnstown-Monroe Local Schools', population: '5,000+', commute: '35 min to downtown Columbus via SR-62/I-70' },
  { slug: 'reynoldsburg', name: 'Reynoldsburg', county: 'Franklin', zip: '43068', medianPrice: 280000, daysOnMarket: 10, schoolDistrict: 'Reynoldsburg City Schools', population: '40,000+', commute: '15 min to downtown Columbus via I-70' },
];

const ZIPS = [
  { zip: '43081', city: 'Westerville', focus: 'Established Westerville neighborhoods south of Schrock Road', schoolDistrict: 'Westerville City Schools', typicalPrice: '$300K-$500K', housingStock: 'Mix of 1960s-1990s ranch homes, split-levels, and newer builds', sellerNote: 'Homes in 43081 sell quickly due to proximity to Uptown Westerville shops and restaurants', buyerNote: 'First-time buyers find starter homes here in the $300K range with access to top-rated Westerville schools' },
  { zip: '43082', city: 'Westerville', focus: 'Northern Westerville and Genoa Township neighborhoods', schoolDistrict: 'Westerville City Schools', typicalPrice: '$350K-$600K', housingStock: 'Newer construction from 2000s-present, planned communities with amenities', sellerNote: 'Larger homes in 43082 attract move-up buyers and families relocating for Westerville schools', buyerNote: 'Buyers here get newer construction, community pools, and walking trails within Westerville school boundaries' },
  { zip: '43035', city: 'Lewis Center', focus: 'Lewis Center and southern Delaware County', schoolDistrict: 'Olentangy Local Schools', typicalPrice: '$350K-$550K', housingStock: 'Predominantly newer construction from late 1990s-present', sellerNote: 'Olentangy school district consistently drives buyer demand; pricing should reflect school premium', buyerNote: 'Olentangy schools rank among the top in Ohio, making 43035 one of the most sought-after ZIP codes in Central Ohio' },
  { zip: '43054', city: 'New Albany', focus: 'New Albany and surrounding country club communities', schoolDistrict: 'New Albany-Plain Local Schools', typicalPrice: '$400K-$800K+', housingStock: 'Upscale planned communities, executive homes, estate lots', sellerNote: 'New Albany homes command premium pricing; professional staging and photography maximize returns', buyerNote: 'New Albany offers a small-town feel with upscale amenities, top schools, and proximity to Intel development' },
  { zip: '43021', city: 'Galena', focus: 'Galena village and rural Delaware County', schoolDistrict: 'Big Walnut / Olentangy Local Schools', typicalPrice: '$350K-$550K', housingStock: 'Mix of newer subdivisions and acreage properties', sellerNote: 'Rural character with school access drives interest from families wanting space with good schools', buyerNote: 'Galena offers larger lots and a quieter pace while still within 30 minutes of Columbus employers' },
  { zip: '43065', city: 'Powell', focus: 'Powell proper and Liberty Township', schoolDistrict: 'Olentangy Local Schools', typicalPrice: '$400K-$650K', housingStock: 'Established neighborhoods with mature trees, newer planned communities', sellerNote: 'Powell consistently ranks as one of the most desirable suburbs; 1% commission saves $4K-$6K here', buyerNote: 'Powell combines Olentangy schools with a walkable downtown, parks, and strong community events' },
  { zip: '43016', city: 'Dublin', focus: 'Historic Dublin and Bridge Street District', schoolDistrict: 'Dublin City Schools', typicalPrice: '$350K-$600K', housingStock: 'Mix of 1970s-1990s colonials and new mixed-use development near Bridge Street', sellerNote: 'Historic Dublin homes have character appeal; newer Bridge Street condos attract young professionals', buyerNote: 'Dublin 43016 puts you near the Scioto River, Bridge Park, and Dublin schools with shorter commutes' },
  { zip: '43017', city: 'Dublin', focus: 'Northern Dublin and Jerome Township', schoolDistrict: 'Dublin City Schools', typicalPrice: '$400K-$700K', housingStock: 'Executive homes, golf course communities, newer planned developments', sellerNote: 'Northern Dublin attracts relocating executives; professional marketing reaches national buyers', buyerNote: 'Larger lots, newer builds, and access to Dublin Jerome and Dublin Coffman high schools' },
  { zip: '43004', city: 'Blacklick', focus: 'Blacklick and Jefferson Township', schoolDistrict: 'Gahanna-Jefferson / Licking Heights', typicalPrice: '$300K-$450K', housingStock: 'Newer subdivisions from 2000s-present, some established neighborhoods', sellerNote: 'Blacklick offers strong value compared to neighboring New Albany; marketing should highlight the price advantage', buyerNote: 'Blacklick provides newer homes near New Albany amenities at lower price points, plus easy I-70 access' },
  { zip: '43240', city: 'Westerville/Columbus', focus: 'Polaris area and northern Columbus', schoolDistrict: 'Westerville / Olentangy / Columbus', typicalPrice: '$250K-$450K', housingStock: 'Condos, townhomes, and single-family near Polaris shopping', sellerNote: 'Polaris area appeals to first-time buyers and young professionals; fast turnover when priced right', buyerNote: 'Convenient location near Polaris shopping, restaurants, and I-71 corridor for commuters' },
];

const COMPARISONS = [
  { slug: '1-percent-vs-3-percent', title: '1% Listing Fee vs 3% Traditional Commission in Ohio', shortTitle: '1% vs 3% Commission', description: 'Compare a 1% listing commission to the traditional 3% rate. See Ohio-specific math showing exactly how much you save at different home prices.' },
  { slug: 'flat-fee-mls-vs-full-service', title: 'Flat Fee MLS vs Full Service Agent in Ohio', shortTitle: 'Flat Fee MLS vs Full Service', description: 'Compare flat-fee MLS listing services to full-service representation. Understand what you give up, what you keep, and when each option makes sense.' },
  { slug: 'fsbo-vs-1-percent-listing', title: 'FSBO vs 1% Listing Agent in Ohio', shortTitle: 'FSBO vs 1% Listing', description: 'Compare selling your home yourself (FSBO) to using a 1% listing agent. See the real costs, time investment, and typical price differences.' },
  { slug: 'discount-broker-vs-full-service', title: 'Redfin-Style Discount Broker vs TD Realty Ohio', shortTitle: 'Discount Broker vs TD Realty', description: 'Compare national discount brokerages like Redfin to a local 1% brokerage. Understand the difference in local expertise, service level, and actual savings.' },
];

// Build all routes
function buildRoutes() {
  const routes = [];
  const today = new Date().toISOString().split('T')[0];

  // Core pages
  routes.push(
    { path: '/', title: 'TD Realty Ohio | 1\u20132% Commission Real Estate', description: 'Serving Central Ohio. Low-commission options for buyers and sellers.', pageType: PAGE_TYPES.HOME, priority: '1.0', changefreq: 'weekly', schema: ['Organization', 'RealEstateAgent', 'LocalBusiness'], parent: null },
    { path: '/sellers/', title: 'Sell Your Columbus Home for 1-2% Commission | TD Realty Ohio', description: 'List your Central Ohio home for 1-2% commission instead of 3%. Full MLS, pro photos, free inspection included.', pageType: PAGE_TYPES.SERVICE, priority: '0.9', changefreq: 'monthly', schema: ['Service', 'LocalBusiness', 'BreadcrumbList'], parent: '/' },
    { path: '/buyers/', title: 'Buy a Home in Columbus, OH | 1% Cash Back | TD Realty Ohio', description: 'First-time homebuyers get 1% cash back at closing. Full-service buyer representation in Central Ohio.', pageType: PAGE_TYPES.SERVICE, priority: '0.9', changefreq: 'monthly', schema: ['Service', 'LocalBusiness', 'BreadcrumbList'], parent: '/' },
    { path: '/1-percent-commission/', title: '1% Commission Real Estate | Sell + Buy | TD Realty Ohio', description: 'List your home for 1% when you buy and sell with TD Realty Ohio. Full-service representation at a fraction of the cost.', pageType: PAGE_TYPES.SERVICE, priority: '0.9', changefreq: 'monthly', schema: ['Service', 'LocalBusiness', 'BreadcrumbList'], parent: '/' },
    // /sell-only-2-percent/ removed — consolidated into /sellers/#sell-only
    { path: '/sell-and-buy/', title: 'Sell and Buy Together for 1% | TD Realty Ohio', description: 'List for just 1% commission when you buy your next home through TD Realty Ohio.', pageType: PAGE_TYPES.SERVICE, priority: '0.7', changefreq: 'monthly', schema: ['Service', 'BreadcrumbList'], parent: '/' },
    { path: '/pre-listing-inspection/', title: 'Free Pre-Listing Inspection | TD Realty Ohio', description: 'Every listing includes a complimentary pre-listing inspection. Know your home condition before buyers do.', pageType: PAGE_TYPES.SERVICE, priority: '0.8', changefreq: 'monthly', schema: ['Service', 'LocalBusiness', 'BreadcrumbList'], parent: '/sellers/' },
    { path: '/home-value/', title: 'Free Home Value Estimate | TD Realty Ohio', description: 'Get a free, no-obligation estimate of your Central Ohio home value. Compare to Zillow and Redfin estimates.', pageType: PAGE_TYPES.TOOL, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/' },
    { path: '/affordability/', title: 'Affordability Calculator | TD Realty Ohio', description: 'Calculate how much home you can afford in Central Ohio. Factor in income, debts, down payment, and current rates.', pageType: PAGE_TYPES.CALCULATOR, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/buyers/' },
    { path: '/contact/', title: 'Contact TD Realty Ohio | Free Consultation', description: 'Get a free consultation about buying or selling your Central Ohio home. Call (614) 392-8858 or submit the form.', pageType: PAGE_TYPES.CONTACT, priority: '0.8', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/' },
    { path: '/about/', title: 'About TD Realty Ohio | Travis Debnam, Broker', description: 'Selling homes since 2017. Licensed Ohio brokerage since 2023. Full-service real estate at reduced commission rates.', pageType: PAGE_TYPES.ABOUT, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/' },
    { path: '/agents/', title: 'Agent Opportunities | 100% Commission | TD Realty Ohio', description: 'Join TD Realty Ohio and keep 100% of your commission. No desk fees, no splits. Licensed Ohio agents welcome.', pageType: PAGE_TYPES.SERVICE, priority: '0.6', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/referrals/', title: 'Referral Credit Program | TD Realty Ohio', description: 'Refer a friend or family member to TD Realty Ohio and earn a referral credit at closing.', pageType: PAGE_TYPES.SERVICE, priority: '0.5', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/faq/', title: 'Frequently Asked Questions | TD Realty Ohio', description: 'Common questions about 1% commission, the home selling process, buyer cash back, and TD Realty Ohio services.', pageType: PAGE_TYPES.FAQ, priority: '0.7', changefreq: 'monthly', schema: ['FAQPage', 'BreadcrumbList'], parent: '/' },
    { path: '/blog/', title: 'Real Estate Blog | TD Realty Ohio', description: 'Central Ohio real estate insights, market updates, and home buying and selling tips from TD Realty Ohio.', pageType: PAGE_TYPES.BLOG_INDEX, priority: '0.7', changefreq: 'weekly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/areas/', title: 'Service Areas | Central Ohio | TD Realty Ohio', description: 'TD Realty Ohio serves Columbus, Westerville, Dublin, Powell, and 20+ Central Ohio communities.', pageType: PAGE_TYPES.HUB, priority: '0.8', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/' },
    { path: '/compare/', title: 'Compare Real Estate Options | TD Realty Ohio', description: 'Compare commission structures, service levels, and costs. See how 1% listing stacks up against traditional, flat fee, FSBO, and discount brokers.', pageType: PAGE_TYPES.HUB, priority: '0.7', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/reviews/', title: 'Client Reviews | TD Realty Ohio', description: 'Read verified reviews from TD Realty Ohio clients on Zillow and Google. See what buyers and sellers say about their experience.', pageType: PAGE_TYPES.REVIEWS, priority: '0.6', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/' },
    { path: '/credentials/', title: 'Credentials & Disclosures | TD Realty Ohio', description: 'Licensing, brokerage facts, and regulatory disclosures for TD Realty Ohio, LLC. Broker License #2023006467.', pageType: PAGE_TYPES.CREDENTIALS, priority: '0.5', changefreq: 'yearly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/' },
  );

  // Calculator result pages
  routes.push(
    { path: '/tools/seller-net-proceeds/', title: 'Seller Net Proceeds Calculator | TD Realty Ohio', description: 'Estimate your net proceeds from selling your Ohio home. Factor in commission, closing costs, mortgage payoff, and repairs.', pageType: PAGE_TYPES.CALCULATOR, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/sellers/' },
    { path: '/tools/buyer-closing-costs/', title: 'Buyer Closing Costs Calculator | TD Realty Ohio', description: 'Estimate closing costs for buying a home in Ohio. Calculate title fees, lender costs, and prepaid items.', pageType: PAGE_TYPES.CALCULATOR, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/buyers/' },
    { path: '/tools/buyer-credit-estimator/', title: 'First-Time Buyer Credit Estimator | TD Realty Ohio', description: 'Estimate your 1% cash back credit as a first-time buyer with TD Realty Ohio. See how much you could receive at closing.', pageType: PAGE_TYPES.CALCULATOR, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/buyers/' },
  );

  // Tools hub page
  routes.push(
    { path: '/tools/', title: 'Free Real Estate Tools | TD Realty Ohio', description: 'Free interactive tools for Central Ohio home sellers and buyers. Estimate net proceeds, closing costs, and more. No sign-up required.', pageType: PAGE_TYPES.HUB, priority: '0.7', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
  );

  // Additional tool pages
  routes.push(
    { path: '/tools/buyer-offer-readiness/', title: 'Buyer Offer Readiness Pack | TD Realty Ohio', description: 'Are you ready to make an offer on a home? Check your readiness with our free tool. Includes lender questions and tour-to-offer timeline.', pageType: PAGE_TYPES.TOOL, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/tools/' },
    { path: '/tools/move-up-plan/', title: 'Move-Up Plan Generator | TD Realty Ohio', description: 'Planning to sell your current home and buy a bigger one? Get a personalized sequencing plan, financial snapshot, and timeline.', pageType: PAGE_TYPES.TOOL, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/tools/' },
    { path: '/tools/pre-listing-checklist/', title: 'Pre-Listing Inspection Readiness Checklist | TD Realty Ohio', description: 'Get a personalized pre-listing preparation checklist for your home. Know what to fix, clean, and gather before you list for sale.', pageType: PAGE_TYPES.TOOL, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/tools/' },
    { path: '/tools/repair-vs-credit/', title: 'Repair vs Credit Decision Helper | TD Realty Ohio', description: 'Should you repair before selling or offer a buyer credit? Get a balanced decision framework for common repair situations.', pageType: PAGE_TYPES.TOOL, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/tools/' },
    { path: '/tools/sell-buy-timing/', title: 'Sell & Buy Timing Planner | TD Realty Ohio', description: 'Should you sell first or buy first? Compare three sequencing strategies with personalized pros and cons for your situation.', pageType: PAGE_TYPES.TOOL, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/tools/' },
    { path: '/tools/sell-now-vs-wait/', title: 'Sell Now vs Wait Planner | TD Realty Ohio', description: 'Should you sell your home now or wait? Get personalized scenario analysis based on your timeline, flexibility, and goals.', pageType: PAGE_TYPES.TOOL, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/tools/' },
    { path: '/tools/seller-documents/', title: 'Seller Document Organizer | TD Realty Ohio', description: 'Get a customized list of documents you need to sell your Ohio home. Organized by category with timeline guidance.', pageType: PAGE_TYPES.TOOL, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/tools/' },
  );

  // Tool city sub-routes
  const TOOL_CITY_SLUGS = ['columbus', 'delaware', 'dublin', 'gahanna', 'hilliard', 'new-albany', 'powell', 'upper-arlington', 'westerville', 'worthington'];
  const CITY_TOOLS = [
    { slug: 'buyer-offer-readiness', title: 'Buyer Offer Readiness Pack', parent: '/tools/buyer-offer-readiness/' },
    { slug: 'move-up-plan', title: 'Move-Up Plan Generator', parent: '/tools/move-up-plan/' },
    { slug: 'repair-vs-credit', title: 'Repair vs Credit Decision Helper', parent: '/tools/repair-vs-credit/' },
    { slug: 'sell-buy-timing', title: 'Sell & Buy Timing Planner', parent: '/tools/sell-buy-timing/' },
    { slug: 'seller-documents', title: 'Seller Document Organizer', parent: '/tools/seller-documents/' },
  ];
  CITY_TOOLS.forEach(tool => {
    TOOL_CITY_SLUGS.forEach(citySlug => {
      const city = CITIES.find(c => c.slug === citySlug);
      if (!city) return;
      routes.push({
        path: `/tools/${tool.slug}/${citySlug}/`,
        title: `${tool.title} for ${city.name}, OH | TD Realty Ohio`,
        description: `${tool.title} customized for ${city.name}, Ohio home sellers and buyers.`,
        pageType: PAGE_TYPES.TOOL,
        priority: '0.5',
        changefreq: 'monthly',
        schema: ['LocalBusiness', 'BreadcrumbList'],
        parent: tool.parent,
      });
    });
  });

  // City/area pages
  CITIES.forEach(city => {
    routes.push({
      path: `/areas/${city.slug}/`,
      title: `${city.name}, OH Homes | 1% Listing | TD Realty Ohio`,
      description: `Selling your home in ${city.name}? Save thousands with TD Realty Ohio's 1% listing commission. Full-service real estate in ${city.name}, Ohio.`,
      pageType: PAGE_TYPES.AREA,
      priority: '0.6',
      changefreq: 'monthly',
      schema: ['RealEstateAgent', 'Service', 'LocalBusiness', 'BreadcrumbList'],
      parent: '/areas/',
      cityData: city,
    });
  });

  // ZIP intent pages
  ZIPS.forEach(z => {
    routes.push({
      path: `/areas/zip/${z.zip}/`,
      title: `${z.zip} Real Estate | ${z.city}, OH | TD Realty Ohio`,
      description: `Buying or selling in ZIP code ${z.zip} (${z.city}, Ohio)? ${z.typicalPrice} price range. 1% listing commission saves you thousands.`,
      pageType: PAGE_TYPES.ZIP,
      priority: '0.5',
      changefreq: 'monthly',
      schema: ['RealEstateAgent', 'LocalBusiness', 'BreadcrumbList'],
      parent: '/areas/',
      zipData: z,
    });
  });

  // Comparison pages
  COMPARISONS.forEach(comp => {
    routes.push({
      path: `/compare/${comp.slug}/`,
      title: `${comp.title} | TD Realty Ohio`,
      description: comp.description,
      pageType: PAGE_TYPES.COMPARISON,
      priority: '0.7',
      changefreq: 'monthly',
      schema: ['BreadcrumbList'],
      parent: '/compare/',
    });
  });

  // Legal pages
  routes.push(
    { path: '/privacy/', title: 'Privacy Policy | TD Realty Ohio', description: 'TD Realty Ohio privacy policy. How we collect, use, and protect your information.', pageType: PAGE_TYPES.LEGAL, priority: '0.3', changefreq: 'yearly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/terms/', title: 'Terms of Service | TD Realty Ohio', description: 'Terms of service for tdrealtyohio.com.', pageType: PAGE_TYPES.LEGAL, priority: '0.3', changefreq: 'yearly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/fair-housing/', title: 'Fair Housing Statement | TD Realty Ohio', description: 'TD Realty Ohio fair housing commitment and equal opportunity statement.', pageType: PAGE_TYPES.LEGAL, priority: '0.3', changefreq: 'yearly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/sitemap-page/', title: 'Site Map | TD Realty Ohio', description: 'Complete site map for TD Realty Ohio.', pageType: PAGE_TYPES.LEGAL, priority: '0.4', changefreq: 'monthly', schema: [], parent: '/' },
  );

  // Seller funnel pages
  routes.push(
    { path: '/sell/net-sheet/', title: 'Get Your Net Sheet + Savings Estimate | TD Realty Ohio', description: 'Get a personalized net sheet showing your estimated proceeds from selling your Ohio home.', pageType: PAGE_TYPES.SERVICE, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/sellers/' },
    { path: '/sell/pricing-call/', title: 'Book a Pricing Call | TD Realty Ohio', description: 'Book a free pricing call to discuss your home value, pricing strategy, and selling timeline.', pageType: PAGE_TYPES.SERVICE, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/sellers/' },
    { path: '/sell/timeline/', title: 'Plan Your Selling Timeline | TD Realty Ohio', description: 'Plan your selling timeline and coordinate buying and selling your Ohio home.', pageType: PAGE_TYPES.SERVICE, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/sellers/' },
  );

  // Buyer funnel pages
  routes.push(
    { path: '/buy/cash-back/', title: 'Claim Your 1% Cash Back | First-Time Buyer | TD Realty Ohio', description: 'First-time homebuyers get 1% of the purchase price back at closing with TD Realty Ohio.', pageType: PAGE_TYPES.SERVICE, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/buyers/' },
    { path: '/buy/pre-approval/', title: 'Get Pre-Approved to Buy | TD Realty Ohio', description: 'Get connected with local lenders and start your pre-approval process for buying a home in Ohio.', pageType: PAGE_TYPES.SERVICE, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/buyers/' },
    { path: '/buy/consult/', title: 'Free Buyer Consultation | TD Realty Ohio', description: 'Schedule a free buyer consultation to discuss your home search, budget, and neighborhoods.', pageType: PAGE_TYPES.SERVICE, priority: '0.7', changefreq: 'monthly', schema: ['LocalBusiness', 'BreadcrumbList'], parent: '/buyers/' },
  );

  // First-time buyer locality guides
  CITIES.forEach(city => {
    routes.push({
      path: `/buyers/first-time/${city.slug}/`,
      title: `First-Time Homebuyer Guide for ${city.name}, OH | TD Realty Ohio`,
      description: `First-time buyers in ${city.name}, Ohio can receive 1% cash back at closing with TD Realty Ohio. Local guidance on neighborhoods, pricing, and next steps.`,
      pageType: PAGE_TYPES.SERVICE,
      priority: '0.6',
      changefreq: 'monthly',
      schema: ['LocalBusiness', 'BreadcrumbList'],
      parent: '/buyers/',
    });
  });

  ZIPS.forEach(z => {
    routes.push({
      path: `/buyers/first-time/zip-${z.zip}/`,
      title: `First-Time Homebuyer Guide for ZIP ${z.zip} (${z.city}) | TD Realty Ohio`,
      description: `First-time buyers in ZIP ${z.zip} (${z.city}) can receive 1% cash back at closing with TD Realty Ohio. Local guidance for ${z.focus}.`,
      pageType: PAGE_TYPES.SERVICE,
      priority: '0.5',
      changefreq: 'monthly',
      schema: ['LocalBusiness', 'BreadcrumbList'],
      parent: '/buyers/',
    });
  });

  // Thank-you pages (noindex)
  routes.push(
    { path: '/thank-you/seller_net_sheet/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
    { path: '/thank-you/seller_pricing_call/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
    { path: '/thank-you/seller_timeline/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
    { path: '/thank-you/buyer_cash_back/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
    { path: '/thank-you/buyer_pre_approval/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
    { path: '/thank-you/buyer_consult/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
  );

  // Blog posts
  const BLOG_POSTS = [
    { slug: 'how-much-save-selling-columbus-home-1-percent', title: 'How Much Can You Save Selling Your Columbus Home for 1% Commission?' },
    { slug: '1-percent-vs-3-percent-commission-comparison', title: '1% vs 3% Commission: What\'s the Real Difference?' },
    { slug: 'central-ohio-housing-market-2026', title: 'Central Ohio Housing Market Update: February 2026' },
    { slug: 'first-time-homebuyer-cash-back', title: 'First-Time Homebuyers: Get 1% Cash Back at Closing' },
    { slug: 'pre-listing-inspection-benefits', title: 'What Is a Pre-Listing Inspection and Why Should Columbus Sellers Get One?' },
    { slug: 'selling-home-westerville-ohio-2026', title: 'Selling Your Home in Westerville, Ohio in 2026' },
    { slug: 'why-agents-leaving-traditional-brokerages-100-commission', title: 'Why Agents Are Leaving Traditional Brokerages for 100% Commission' },
    { slug: 'closing-costs-columbus-ohio', title: 'Closing Costs When Selling a Home in Central Ohio' },
    { slug: 'home-staging-tips-columbus', title: 'Home Staging Tips That Help Columbus Homes Sell Faster' },
    { slug: 'fsbo-vs-realtor-columbus', title: 'FSBO vs. Realtor in Columbus: Which Option Saves You More?' },
    { slug: 'best-time-sell-house-columbus-ohio', title: 'Best Time to Sell a House in Columbus, Ohio (2026 Data)' },
  ];
  BLOG_POSTS.forEach(post => {
    routes.push({
      path: `/blog/${post.slug}/`,
      title: `${post.title} | TD Realty Ohio`,
      description: '',
      pageType: PAGE_TYPES.BLOG,
      priority: '0.6',
      changefreq: 'monthly',
      schema: ['Article', 'BreadcrumbList'],
      parent: '/blog/',
    });
  });

  // Landing pages (noindex, excluded from sitemap)
  routes.push(
    { path: '/lp/sell-home-columbus/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
    { path: '/lp/sell-home-westerville/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
    { path: '/lp/buy-home-columbus/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
  );

  // Admin pages (noindex)
  routes.push(
    { path: '/admin/profiles/', noindex: true, pageType: PAGE_TYPES.LANDING, priority: '0.0', schema: [] },
  );

  return routes;
}

// Normalize canonical URL: https, trailing slash, no duplicates
function normalizeCanonical(path) {
  let normalized = path;
  // Ensure trailing slash
  if (!normalized.endsWith('/') && !normalized.includes('.')) {
    normalized += '/';
  }
  // Remove double slashes (except protocol)
  normalized = normalized.replace(/([^:])\/\//g, '$1/');
  return `${SITE_URL}${normalized}`;
}

// Get all indexable routes (for sitemap)
function getIndexableRoutes() {
  return buildRoutes().filter(r => !r.noindex);
}

// Get route by path
function getRouteByPath(path) {
  return buildRoutes().find(r => r.path === path);
}

// Get breadcrumb chain for a route
function getBreadcrumbs(path) {
  const routes = buildRoutes();
  const crumbs = [];
  let current = routes.find(r => r.path === path);

  while (current) {
    crumbs.unshift({
      name: current.path === '/' ? 'Home' : current.title.split('|')[0].trim(),
      url: normalizeCanonical(current.path),
    });
    if (current.parent) {
      current = routes.find(r => r.path === current.parent);
    } else {
      break;
    }
  }

  return crumbs;
}

const ROUTES = buildRoutes();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SITE_URL,
    PAGE_TYPES,
    CITIES,
    ZIPS,
    COMPARISONS,
    ROUTES,
    buildRoutes,
    normalizeCanonical,
    getIndexableRoutes,
    getRouteByPath,
    getBreadcrumbs,
  };
}
