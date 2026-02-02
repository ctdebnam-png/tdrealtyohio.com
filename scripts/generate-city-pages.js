#!/usr/bin/env node
/**
 * Generate individual city landing pages from areas data
 */

const fs = require('fs');
const path = require('path');

const cities = [
  {
    slug: 'columbus',
    name: 'Columbus',
    state: 'Ohio',
    postalCode: '43215',
    cityWebsite: 'https://www.columbus.gov/',
    schoolWebsite: 'https://www.ccsoh.us/',
    schoolName: 'Columbus City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/columbus-franklin-oh/',
    nicheRating: 'A',
    medianPrice: 275000,
    population: '906K',
    daysOnMarket: 18,
    description: 'Columbus is Ohio\'s capital and largest city, offering diverse neighborhoods from historic German Village to the trendy Short North Arts District. The market provides options at every price point. Columbus City Schools is the state\'s largest district, while many Columbus addresses also feed into suburban districts like Westerville, Dublin, and Hilliard.',
    county: 'Franklin',
    neighbors: ['westerville', 'dublin', 'upper-arlington', 'gahanna', 'grove-city'],
    faqs: [
      { q: 'What neighborhoods in Columbus have the best resale value?', a: 'Short North, German Village, Clintonville, and Grandview Heights consistently show strong appreciation. Newer developments in Franklinton are also gaining value rapidly.' },
      { q: 'How does the Columbus market compare to other Ohio cities?', a: 'Columbus has outpaced Cincinnati and Cleveland in home price appreciation over the past decade, driven by job growth from tech companies, healthcare, and Ohio State University.' },
      { q: 'What are property taxes like in Columbus?', a: 'Franklin County\'s effective property tax rate is approximately 1.6-2.0% of market value. Rates vary by school district—Columbus City Schools areas tend to be on the higher end.' },
    ]
  },
  {
    slug: 'westerville',
    name: 'Westerville',
    state: 'Ohio',
    postalCode: '43081',
    cityWebsite: 'https://www.westerville.org/',
    schoolWebsite: 'https://www.westerville.k12.oh.us/',
    schoolName: 'Westerville City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/westerville-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 400000,
    population: '42K',
    daysOnMarket: 12,
    description: 'Westerville combines small-town charm with suburban convenience. The historic Uptown district offers local shops and restaurants, while newer developments provide modern housing options. Westerville City Schools consistently ranks among Ohio\'s top districts. The city is home to Otterbein University and offers extensive parks and recreation programs.',
    county: 'Franklin',
    neighbors: ['gahanna', 'lewis-center', 'new-albany', 'columbus'],
    faqs: [
      { q: 'Is Westerville a good place to raise a family?', a: 'Westerville is consistently rated one of Ohio\'s best family communities. The school district ranks in the top 10 statewide, and the city offers over 50 parks, a community center, and numerous youth sports programs.' },
      { q: 'What is the Westerville housing market like?', a: 'Westerville homes typically sell within 12 days. The market is competitive with strong demand from families drawn to the school district. Homes range from $250K condos to $800K+ estates.' },
      { q: 'What are Westerville\'s most popular neighborhoods?', a: 'Heritage District near Uptown is prized for walkability. Blendon Chase and Spring Creek offer newer construction. Huber Village and Hometowne areas provide more affordable options.' },
    ]
  },
  {
    slug: 'dublin',
    name: 'Dublin',
    state: 'Ohio',
    cityWebsite: 'https://dublinohiousa.gov/',
    schoolWebsite: 'https://www.dublinschools.net/',
    schoolName: 'Dublin City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/dublin-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 550000,
    population: '51K',
    daysOnMarket: 14,
    description: 'Dublin is one of Central Ohio\'s premier communities, known for excellent schools, corporate headquarters, and the annual Dublin Irish Festival. The Bridge Street District offers urban-style living, while established neighborhoods feature larger lots and mature landscaping. Dublin City Schools is consistently ranked among Ohio\'s best.',
    county: 'Franklin',
    postalCode: '43016',
    neighbors: ['powell', 'hilliard', 'upper-arlington', 'columbus'],
    faqs: [
      { q: 'What are the most sought-after neighborhoods in Dublin, Ohio?', a: 'Muirfield Village, home to the Memorial Tournament golf course, remains one of Dublin\'s most prestigious communities. Ballantrae and Tartan Fields also attract buyers seeking upscale homes with excellent Dublin City Schools access. The Bridge Street District appeals to those wanting walkable, urban-style living.' },
      { q: 'How does Dublin City Schools rank for families considering a move?', a: 'Dublin City Schools consistently ranks in the top 5% of Ohio districts, with three comprehensive high schools and a strong STEM curriculum. The district offers International Baccalaureate programs and has graduation rates exceeding 96%.' },
      { q: 'What is the commute like from Dublin to downtown Columbus?', a: 'Dublin to downtown Columbus is roughly 20-25 minutes via I-270 and SR-315 outside rush hour, though peak commute times can extend to 35-45 minutes. Many Dublin residents work locally at corporate campuses for Wendy\'s, Cardinal Health, and other Fortune 500 companies headquartered in the area.' },
    ]
  },
  {
    slug: 'powell',
    name: 'Powell',
    state: 'Ohio',
    cityWebsite: 'https://cityofpowell.us/',
    schoolWebsite: 'https://www.olentangy.k12.oh.us/',
    schoolName: 'Olentangy Local Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/powell-delaware-oh/',
    nicheRating: 'A+',
    medianPrice: 550000,
    population: '14K',
    daysOnMarket: 11,
    description: 'Powell offers small-town charm with easy access to Columbus. The historic downtown features local shops and restaurants. Olentangy Local Schools—one of Ohio\'s highest-rated districts—is the primary draw for families, with multiple elementary, middle, and high school options.',
    county: 'Delaware',
    postalCode: '43065',
    neighbors: ['dublin', 'westerville', 'delaware'],
    faqs: [
      { q: 'What makes the Powell housing market unique in Central Ohio?', a: 'Powell commands premium prices due to the Olentangy Local Schools district, one of Ohio\'s top-rated. Homes in neighborhoods like Wedgewood, Scioto Reserve, and Olentangy Falls often sell within days. The combination of a walkable historic downtown and newer luxury developments drives consistent demand.' },
      { q: 'How are the schools in Powell compared to surrounding areas?', a: 'Olentangy Local Schools serves most Powell addresses and is regularly ranked among the top 3 districts in Ohio. The district operates multiple elementary, middle, and high schools and is known for strong AP and extracurricular programs.' },
      { q: 'Is Powell affordable compared to Dublin or New Albany?', a: 'Powell\'s median home price is comparable to Dublin, with both communities centering around $550K. However, Powell offers more inventory in the $350K-$450K range through older neighborhoods, making it slightly more accessible than New Albany\'s higher entry point.' },
    ]
  },
  {
    slug: 'new-albany',
    name: 'New Albany',
    state: 'Ohio',
    cityWebsite: 'https://newalbanyohio.org/',
    schoolWebsite: 'https://www.napls.us/',
    schoolName: 'New Albany-Plain Local Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/new-albany-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 650000,
    population: '12K',
    daysOnMarket: 15,
    description: 'New Albany is a master-planned community known for its Georgian architecture, extensive trail system, and top-ranked schools. New Albany-Plain Local Schools consistently ranks among Ohio\'s elite districts, drawing families from across the region.',
    county: 'Franklin',
    postalCode: '43054',
    neighbors: ['gahanna', 'westerville', 'blacklick'],
    faqs: [
      { q: 'Why are New Albany home prices higher than surrounding communities?', a: 'New Albany\'s master-planned design with strict architectural standards, top-ranked schools, and the presence of Intel\'s massive semiconductor facility nearby have driven premium pricing. The community\'s extensive trail system, country club amenities, and cohesive Georgian aesthetic create strong long-term value.' },
      { q: 'What school options are available for families in New Albany?', a: 'New Albany-Plain Local Schools is consistently ranked among Ohio\'s top 10 districts, featuring a learning campus model that clusters grade levels together. The district is known for strong academics, arts programs, and competitive athletics with a student-to-teacher ratio well below state averages.' },
      { q: 'How does New Albany\'s cost of living compare to other premium suburbs?', a: 'New Albany\'s property tax rate in Franklin County is competitive with Dublin and Upper Arlington. However, the higher median home price of around $650K means annual tax bills are larger in absolute terms. The trade-off is strong appreciation—New Albany homes have gained value at roughly 5-7% annually.' },
    ]
  },
  {
    slug: 'gahanna',
    name: 'Gahanna',
    state: 'Ohio',
    cityWebsite: 'https://www.gahanna.gov/',
    schoolWebsite: 'https://www.gahanna.k12.oh.us/',
    schoolName: 'Gahanna-Jefferson Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/gahanna-franklin-oh/',
    nicheRating: 'A',
    medianPrice: 375000,
    population: '36K',
    daysOnMarket: 13,
    description: 'Gahanna—the "Herb Capital of Ohio"—offers a balance of suburban living and community character. Creekside, the city\'s entertainment district along Big Walnut Creek, hosts events and festivals year-round. Gahanna-Jefferson City Schools provides quality education.',
    county: 'Franklin',
    postalCode: '43230',
    neighbors: ['westerville', 'new-albany', 'blacklick', 'columbus'],
    faqs: [
      { q: 'What neighborhoods in Gahanna offer the best value for buyers?', a: 'Royal Manor and Havens Corners provide solid mid-range options in the $300K-$400K range with mature trees and larger lots. The Creekside area commands premiums for walkability to shops and restaurants. Newer communities like Brookfield Village offer modern construction starting in the upper $300Ks.' },
      { q: 'How does Gahanna-Jefferson Schools perform for families?', a: 'Gahanna-Jefferson Schools earns an A rating from Niche with Lincoln High School as the district\'s flagship. The district offers a strong mix of AP courses, vocational programs through Eastland-Fairfield Career Center, and competitive athletics. Class sizes are manageable with good teacher retention.' },
      { q: 'What is the commute from Gahanna to major Columbus employers?', a: 'Gahanna\'s location along I-270 provides 15-20 minute access to downtown Columbus, Easton Town Center, and Polaris. Port Columbus International Airport is actually within Gahanna\'s borders, making it ideal for frequent business travelers.' },
    ]
  },
  {
    slug: 'hilliard',
    name: 'Hilliard',
    state: 'Ohio',
    cityWebsite: 'https://hilliardohio.gov/',
    schoolWebsite: 'https://www.hilliardschools.org/',
    schoolName: 'Hilliard City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/hilliard-franklin-oh/',
    nicheRating: 'A',
    medianPrice: 425000,
    population: '37K',
    daysOnMarket: 12,
    description: 'Hilliard is one of Central Ohio\'s fastest-growing communities, with a revitalized Old Hilliard downtown and extensive new development. Hilliard City Schools serves over 16,000 students across three high schools.',
    county: 'Franklin',
    postalCode: '43026',
    neighbors: ['dublin', 'grove-city', 'upper-arlington'],
    faqs: [
      { q: 'Is Hilliard a good investment for homebuyers right now?', a: 'Hilliard has seen steady appreciation of 4-6% annually, driven by ongoing commercial development along Cemetery Road and the revitalized Old Hilliard district. The combination of three high schools and relatively affordable pricing compared to Dublin makes Hilliard attractive to growing families.' },
      { q: 'What are the school options in Hilliard?', a: 'Hilliard City Schools operates three high schools—Davidson, Darby, and Bradley—serving over 16,000 students. The district is known for strong STEM programs, performing arts, and competitive sports. All three high schools consistently rank well on state report cards.' },
      { q: 'How do Hilliard property taxes compare to neighboring communities?', a: 'Hilliard\'s effective property tax rate falls in the mid-range for Franklin County, typically lower than Upper Arlington or Dublin. On a $425K home, expect annual property taxes around $7,500-$8,500, which includes the Hilliard City Schools levy.' },
    ]
  },
  {
    slug: 'upper-arlington',
    name: 'Upper Arlington',
    state: 'Ohio',
    cityWebsite: 'https://upperarlingtonoh.gov/',
    schoolWebsite: 'https://www.uaschools.org/',
    schoolName: 'Upper Arlington Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/upper-arlington-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 600000,
    population: '36K',
    daysOnMarket: 10,
    description: 'Upper Arlington is an established, tree-lined community adjacent to Ohio State University. Known for excellent schools and strong property values, UA features a mix of classic mid-century homes and newer construction. Upper Arlington City Schools is highly regarded.',
    county: 'Franklin',
    postalCode: '43221',
    neighbors: ['columbus', 'hilliard', 'dublin'],
    faqs: [
      { q: 'Why do Upper Arlington homes sell so quickly?', a: 'Upper Arlington averages just 10 days on market—among the fastest in Central Ohio. The combination of a walkable layout, proximity to Ohio State University and Grandview, top-rated schools, and limited new construction creates persistent demand that outstrips supply.' },
      { q: 'What makes Upper Arlington Schools stand out for families?', a: 'Upper Arlington City Schools is perennially ranked in Ohio\'s top 10 districts. The single high school model means all students attend UA High School, fostering strong community bonds. The district recently completed a major facilities upgrade with new buildings across all grade levels.' },
      { q: 'Are there affordable options in Upper Arlington\'s housing market?', a: 'While UA\'s median price is around $600K, condos and townhomes near Lane Avenue and Kingsdale start in the $250K-$350K range. Smaller ranch homes in the southern neighborhoods occasionally list under $450K, though they attract multiple offers quickly.' },
    ]
  },
  {
    slug: 'worthington',
    name: 'Worthington',
    state: 'Ohio',
    cityWebsite: 'https://worthington.org/',
    schoolWebsite: 'https://www.worthington.k12.oh.us/',
    schoolName: 'Worthington Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/worthington-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 425000,
    population: '15K',
    daysOnMarket: 11,
    description: 'Worthington is one of Ohio\'s oldest communities, with a charming downtown on the National Register of Historic Places. The village green hosts farmers markets and community events. Worthington City Schools ranks highly statewide.',
    county: 'Franklin',
    postalCode: '43085',
    neighbors: ['columbus', 'westerville', 'powell'],
    faqs: [
      { q: 'What types of homes are available in Worthington?', a: 'Worthington offers a distinctive mix of charming 1920s-1950s colonials near the historic village green and mid-century ranches in established neighborhoods. Colonial Hills and Worthington Estates are popular for families, while newer condos along High Street attract downsizers and young professionals.' },
      { q: 'How does the Worthington school district compare to Westerville and Dublin?', a: 'Worthington Schools ranks among Ohio\'s top 15 districts with Thomas Worthington and Worthington Kilbourne as its two high schools. While slightly smaller than Westerville or Dublin, the district offers strong gifted programs, competitive athletics, and a close-knit community feel that larger districts sometimes lack.' },
      { q: 'What are the advantages of living in Worthington versus Columbus proper?', a: 'Worthington offers a distinct small-city identity with its own police, schools, and community events while being just minutes from Polaris, Crosswoods, and downtown Columbus via I-71 or High Street. Property values hold strong due to the school district, and the village green area provides a walkable downtown with local restaurants and shops.' },
    ]
  },
  {
    slug: 'grove-city',
    name: 'Grove City',
    state: 'Ohio',
    cityWebsite: 'https://www.grovecityohio.gov/',
    schoolWebsite: 'https://www.swcsd.us/',
    schoolName: 'South-Western City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/grove-city-franklin-oh/',
    nicheRating: 'A-',
    medianPrice: 300000,
    population: '42K',
    daysOnMarket: 14,
    description: 'Grove City offers affordable suburban living with a revitalized Town Center and strong community identity. The city hosts popular events like Arts in the Alley and provides extensive parks and recreation programs.',
    county: 'Franklin',
    postalCode: '43123',
    neighbors: ['columbus', 'hilliard', 'canal-winchester'],
    faqs: [
      { q: 'Is Grove City a good area for first-time homebuyers?', a: 'Grove City is one of the most accessible suburbs in the Columbus metro for first-time buyers, with a median price around $300K—well below Dublin or Upper Arlington. The revitalized Town Center, expanding retail along Stringtown Road, and proximity to I-71 and I-270 add convenience without the premium price tag.' },
      { q: 'What schools serve the Grove City area?', a: 'South-Western City Schools is the primary district serving Grove City, operating multiple high schools including Grove City High School. The district has invested heavily in facilities upgrades and career-technical programs. Some southern Grove City addresses may fall in the Hamilton Local School District.' },
      { q: 'How far is Grove City from downtown Columbus and major job centers?', a: 'Grove City is approximately 15 minutes from downtown Columbus via I-71 and about 20 minutes from the Rickenbacker logistics hub, a major employer in the region. The opening of additional retail and medical facilities along Stringtown Road means many residents can work and shop locally.' },
    ]
  },
  {
    slug: 'delaware',
    name: 'Delaware',
    state: 'Ohio',
    cityWebsite: 'https://www.delawareohio.net/',
    schoolWebsite: 'https://www.dcs.k12.oh.us/',
    schoolName: 'Delaware City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/delaware-delaware-oh/',
    nicheRating: 'A-',
    medianPrice: 350000,
    population: '42K',
    daysOnMarket: 16,
    description: 'Delaware is the county seat of Delaware County, Ohio\'s fastest-growing county. The city combines historic charm around its downtown square with new development. Home to Ohio Wesleyan University, Delaware offers cultural amenities alongside small-town living.',
    county: 'Delaware',
    postalCode: '43015',
    neighbors: ['powell', 'sunbury', 'johnstown'],
    faqs: [
      { q: 'Is Delaware, Ohio a good place to buy a home right now?', a: 'Delaware County has been Ohio\'s fastest-growing county for over a decade, and the city of Delaware benefits from that momentum. The $350K median price offers significant savings versus Powell or Dublin while still providing access to some Olentangy district addresses. Historic downtown properties and newer subdivisions both show strong appreciation.' },
      { q: 'What are the school district options in Delaware?', a: 'Delaware City Schools serves most addresses within the city limits, offering solid academics anchored by Hayes High School. Some outer Delaware addresses feed into Olentangy or Big Walnut districts. Ohio Wesleyan University also provides cultural and educational enrichment opportunities for the community.' },
      { q: 'What is the commute like from Delaware to Columbus?', a: 'Delaware to downtown Columbus is about 30-40 minutes via US-23 or I-71, depending on traffic. Many residents commute to Polaris or Powell-area employers in just 15-20 minutes. The planned improvements to US-23 corridor are expected to ease congestion in coming years.' },
    ]
  },
  {
    slug: 'pickerington',
    name: 'Pickerington',
    state: 'Ohio',
    cityWebsite: 'https://www.pickerington.net/',
    schoolWebsite: 'https://www.pickerington.k12.oh.us/',
    schoolName: 'Pickerington Local Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/pickerington-fairfield-oh/',
    nicheRating: 'A',
    medianPrice: 375000,
    population: '23K',
    daysOnMarket: 14,
    description: 'Pickerington is a growing community in Fairfield County known for its excellent schools and family-friendly atmosphere. Pickerington Local Schools serves two high schools and consistently earns high marks. The city offers a mix of established neighborhoods and new construction.',
    county: 'Fairfield',
    postalCode: '43147',
    neighbors: ['canal-winchester', 'gahanna', 'pataskala'],
    faqs: [
      { q: 'What makes Pickerington attractive to homebuyers from Columbus?', a: 'Pickerington offers newer construction and larger lots than many inner-ring suburbs at a lower price point. The Violet Township area surrounding Pickerington has seen rapid growth with modern subdivisions, while the historic downtown retains small-town character. Strong schools and easy I-270 access seal the deal for many families.' },
      { q: 'How does Pickerington Local Schools compare to other Fairfield County districts?', a: 'Pickerington Local Schools is by far the highest-rated district in Fairfield County, earning an A from Niche. The district operates two high schools—Central and North—and is known for nationally competitive marching band programs, strong AP offerings, and robust athletics.' },
      { q: 'What should buyers know about property taxes in Pickerington?', a: 'Pickerington falls in Fairfield County, which generally has lower property tax rates than Franklin County. However, the Pickerington Local Schools levy means overall tax bills are moderate. Expect to pay roughly $6,000-$7,500 annually on a $375K home, which is competitive compared to similar-quality school districts in Franklin County.' },
    ]
  },
  {
    slug: 'pataskala',
    name: 'Pataskala',
    state: 'Ohio',
    cityWebsite: 'https://www.cityofpataskala.com/',
    schoolWebsite: 'https://www.lickingvalley.k12.oh.us/',
    schoolName: 'Licking Valley Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/pataskala-licking-oh/',
    nicheRating: 'B+',
    medianPrice: 325000,
    population: '18K',
    daysOnMarket: 18,
    description: 'Pataskala offers affordable housing options on the eastern edge of the Columbus metro area. The city has seen significant growth with new residential developments while maintaining its rural character. Multiple school districts serve the area including Licking Valley and Southwest Licking.',
    county: 'Licking',
    postalCode: '43062',
    neighbors: ['pickerington', 'gahanna', 'granville'],
    faqs: [
      { q: 'Why are homebuyers increasingly looking at Pataskala?', a: 'Pataskala offers some of the most affordable new construction in the Columbus metro, with homes starting in the mid-$200Ks in developments like Watkins Park and Summit Road corridors. The city has added commercial amenities along Broad Street while maintaining a semi-rural feel with larger lots that are hard to find closer to Columbus.' },
      { q: 'What school districts serve Pataskala families?', a: 'Pataskala is served by multiple districts including Licking Valley, Southwest Licking, and Licking Heights. Southwest Licking has seen the most growth and offers newer facilities, while Licking Heights has become one of Ohio\'s most diverse districts. Families should verify which district serves a specific address before purchasing.' },
      { q: 'How does the cost of living in Pataskala compare to western Columbus suburbs?', a: 'Pataskala\'s cost of living is significantly lower than western suburbs like Dublin or Hilliard. Licking County property tax rates are generally below Franklin County, and the $325K median home price buys considerably more square footage. The trade-off is a longer commute to western employment centers, though eastside employers along I-70 are easily accessible.' },
    ]
  },
  {
    slug: 'sunbury',
    name: 'Sunbury',
    state: 'Ohio',
    cityWebsite: 'https://sunburyoh.org/',
    schoolWebsite: 'https://www.bfrsd.net/',
    schoolName: 'Big Walnut Local Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/sunbury-delaware-oh/',
    nicheRating: 'A',
    medianPrice: 400000,
    population: '7K',
    daysOnMarket: 15,
    description: 'Sunbury is a charming village in Delaware County experiencing rapid growth. Big Walnut Local Schools is highly regarded and draws families to the area. The historic downtown square hosts community events and local businesses.',
    county: 'Delaware',
    postalCode: '43074',
    neighbors: ['delaware', 'johnstown', 'granville'],
    faqs: [
      { q: 'What is driving the housing boom in Sunbury, Ohio?', a: 'Sunbury sits in Delaware County\'s growth corridor with Big Walnut Local Schools drawing families from across the region. New subdivisions like Meadows at Sunbury and Northstar are adding hundreds of homes. The village\'s charming downtown square and proximity to Alum Creek State Park add lifestyle appeal beyond just the schools.' },
      { q: 'How does Big Walnut Local Schools compare to nearby districts?', a: 'Big Walnut earns an A from Niche and is known for its strong community support and manageable school sizes. The district operates a single high school, which fosters tight-knit student culture. Academic performance is competitive with Olentangy and Delaware City Schools, particularly in math and science.' },
      { q: 'Is Sunbury a practical location for commuting to Columbus?', a: 'Sunbury to downtown Columbus is approximately 30-35 minutes via I-71 or Route 3. Many residents commute to the Polaris or Westerville employment corridors in about 20 minutes. Delaware County\'s ongoing road infrastructure investments are improving commute reliability for northern suburb residents.' },
    ]
  },
  {
    slug: 'granville',
    name: 'Granville',
    state: 'Ohio',
    cityWebsite: 'https://www.granville.oh.us/',
    schoolWebsite: 'https://www.granvilleschools.org/',
    schoolName: 'Granville Exempted Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/granville-licking-oh/',
    nicheRating: 'A',
    medianPrice: 425000,
    population: '6K',
    daysOnMarket: 20,
    description: 'Granville is a picturesque New England-style village home to Denison University. Known for its historic architecture, tree-lined streets, and excellent schools, Granville offers a unique small-town atmosphere with easy access to Columbus. Granville Exempted Village Schools is highly rated.',
    county: 'Licking',
    postalCode: '43023',
    neighbors: ['johnstown', 'sunbury', 'pataskala'],
    faqs: [
      { q: 'What type of buyer does Granville attract?', a: 'Granville appeals to buyers seeking a distinctive New England village character rare in Ohio. Historic homes along Broadway and Prospect Street attract preservation-minded buyers, while newer developments on the village outskirts draw families wanting Granville schools without renovation work. Denison University faculty and staff also sustain steady housing demand.' },
      { q: 'How does Granville Exempted Village Schools perform?', a: 'Granville schools earn an A from Niche with particularly strong marks in college preparation and teacher quality. The small district size means individual attention for students, and Granville High School sends a high percentage of graduates to four-year universities. The performing arts and athletics programs punch well above the school\'s size.' },
      { q: 'What should buyers know about Granville\'s location and commute options?', a: 'Granville is about 35 minutes east of Columbus via SR-161 and I-70, making it one of the farther commutes in the metro area. However, the village is just 5 minutes from Newark and its employment base. Buyers who work remotely or in eastern Franklin County find Granville\'s quality of life well worth the distance trade-off.' },
    ]
  },
  {
    slug: 'johnstown',
    name: 'Johnstown',
    state: 'Ohio',
    cityWebsite: 'https://johnstownohio.org/',
    schoolWebsite: 'https://www.johnstown.k12.oh.us/',
    schoolName: 'Johnstown-Monroe Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/johnstown-licking-oh/',
    nicheRating: 'A-',
    medianPrice: 350000,
    population: '5K',
    daysOnMarket: 16,
    description: 'Johnstown is a growing village in Licking County with a small-town feel and strong community identity. New development surrounds the historic village center. Johnstown-Monroe Local Schools serves the area with solid academic programs.',
    county: 'Licking',
    postalCode: '43031',
    neighbors: ['granville', 'sunbury', 'delaware'],
    faqs: [
      { q: 'What is attracting new residents to Johnstown?', a: 'Johnstown offers rural character with growing suburban amenities at prices well below the Columbus average. New subdivisions are bringing modern homes in the $300K-$400K range on larger lots than you\'d find in Westerville or Gahanna. The village\'s position between Delaware and Licking counties gives residents access to multiple employment corridors.' },
      { q: 'How is Johnstown-Monroe Local Schools regarded by families?', a: 'Johnstown-Monroe earns an A- from Niche and is valued for its small-district advantages: manageable class sizes, strong teacher-student relationships, and a community that actively supports school levies. The district operates a single K-12 campus, making transitions seamless for students and convenient for parents.' },
      { q: 'What are property taxes and overall costs like in Johnstown?', a: 'Licking County property taxes are notably lower than Franklin or Delaware counties, making Johnstown one of the more tax-friendly options in the greater Columbus area. On a $350K home, annual taxes typically run $5,000-$6,500. Combined with lower home prices and no city income tax, Johnstown offers real savings for budget-conscious buyers.' },
    ]
  },
  {
    slug: 'blacklick',
    name: 'Blacklick',
    state: 'Ohio',
    cityWebsite: 'https://www.gahanna.gov/',
    schoolWebsite: 'https://www.gahanna.k12.oh.us/',
    schoolName: 'Gahanna-Jefferson Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/blacklick-estates-franklin-oh/',
    nicheRating: 'B+',
    medianPrice: 350000,
    population: '10K',
    daysOnMarket: 14,
    description: 'Blacklick is an unincorporated community primarily within the Gahanna and Columbus areas. It offers a mix of established neighborhoods and newer developments with convenient access to I-270 and Easton. Most Blacklick addresses feed into Gahanna-Jefferson or Columbus City Schools.',
    county: 'Franklin',
    postalCode: '43004',
    neighbors: ['gahanna', 'new-albany', 'pickerington'],
    faqs: [
      { q: 'What should buyers know about purchasing a home in Blacklick?', a: 'Blacklick is unincorporated, so buyers should pay close attention to which school district, township, and tax jurisdiction applies to a specific address. Properties can fall in Gahanna-Jefferson, Columbus City, or even Licking Heights school districts. Neighborhoods like Jefferson Country Club Estates and Woodstream East offer established communities, while areas near New Albany are seeing new luxury construction.' },
      { q: 'Which school districts serve Blacklick addresses?', a: 'Most central Blacklick addresses feed into Gahanna-Jefferson Schools, which earns an A from Niche. However, eastern Blacklick near the Licking County line may fall into Licking Heights, and some southwestern addresses are in Columbus City Schools. Always verify the exact district assignment before making an offer.' },
      { q: 'How convenient is Blacklick for commuting and daily errands?', a: 'Blacklick\'s location along I-270 between Easton Town Center and New Albany makes it one of the most convenient eastside communities. Easton\'s shopping and dining is minutes away, and downtown Columbus is a 20-minute drive. The Blacklick Creek Greenway trail also provides recreational amenities for residents.' },
    ]
  },
  {
    slug: 'canal-winchester',
    name: 'Canal Winchester',
    state: 'Ohio',
    cityWebsite: 'https://www.canalwinchesterohio.gov/',
    schoolWebsite: 'https://www.cwls.k12.oh.us/',
    schoolName: 'Canal Winchester Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/canal-winchester-franklin-oh/',
    nicheRating: 'A-',
    medianPrice: 350000,
    population: '10K',
    daysOnMarket: 14,
    description: 'Canal Winchester is a charming city in southeastern Franklin County with a historic downtown and strong community identity. The city hosts popular events like the Labor Day Festival and Blues & Ribfest. Canal Winchester Local Schools serves the community with quality education and a small-town feel.',
    county: 'Franklin',
    postalCode: '43110',
    neighbors: ['pickerington', 'grove-city', 'gahanna'],
    faqs: [
      { q: 'What makes Canal Winchester appealing to homebuyers?', a: 'Canal Winchester combines small-town charm with modern amenities at an accessible price point. The historic downtown along Waterloo Street features local shops, restaurants, and community events like Blues & Ribfest. New developments on the city\'s edges offer contemporary homes while maintaining the community\'s character.' },
      { q: 'How does Canal Winchester Local Schools serve the community?', a: 'Canal Winchester Schools earns an A- from Niche and operates a compact, community-focused district with one high school. The district is known for strong parent involvement, competitive athletics, and academic programs that regularly outperform state averages. The single-campus model means families stay connected throughout their children\'s education.' },
      { q: 'How does Canal Winchester\'s location affect commute times and daily life?', a: 'Canal Winchester sits along US-33 with easy access to I-270, putting downtown Columbus about 20 minutes away. The Rickenbacker area and Obetz employment centers are even closer at 10-15 minutes. The city has invested in expanding local retail and dining, reducing the need to travel for everyday errands.' },
    ]
  },
  {
    slug: 'bexley',
    name: 'Bexley',
    state: 'Ohio',
    postalCode: '43209',
    cityWebsite: 'https://www.bexley.org/',
    schoolWebsite: 'https://www.bexleyschools.org/',
    schoolName: 'Bexley City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/bexley-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 550000,
    population: '14K',
    daysOnMarket: 14,
    description: 'Bexley is one of Central Ohio\'s most prestigious communities, known for its historic homes, tree-lined streets, and excellent schools. This compact city is completely surrounded by Columbus but maintains its own distinct identity with a walkable downtown, independent shops, and strong community spirit. Bexley City Schools consistently ranks among Ohio\'s top districts, and Capital University adds a college-town element. The housing stock ranges from stately Tudor and Colonial Revival homes to mid-century gems, attracting buyers who value character, location, and community.',
    county: 'Franklin',
    neighbors: ['columbus', 'gahanna'],
    faqs: [
      { q: 'What types of historic homes can buyers find in Bexley?', a: 'Bexley\'s housing stock spans stately Tudor Revival and Colonial Revival estates along Drexel and Cassingham to charming 1920s-1940s bungalows and Cape Cods on tree-lined side streets. Many homes feature original hardwood floors, leaded glass windows, and plaster crown molding. Buyers should budget for maintenance on older homes but benefit from strong appreciation in this established market.' },
      { q: 'How does Bexley City Schools compare to other Franklin County districts?', a: 'Bexley City Schools is one of the top-performing small districts in Ohio, with a single elementary, middle, and high school campus. The compact size means strong community engagement, small class sizes, and high per-pupil spending. Graduation rates exceed 95%, and the district sends a high proportion of students to competitive four-year universities.' },
      { q: 'What is the cost of living like in Bexley compared to Upper Arlington?', a: 'Bexley and Upper Arlington are similarly priced with medians around $550K-$600K. Bexley\'s compact footprint (1.6 square miles) means walkability is exceptional—most residents can walk to Main Street shops, restaurants, and Capital University events. Property taxes are comparable, though Bexley\'s smaller district means more predictable levy cycles.' },
    ]
  },
  {
    slug: 'clintonville',
    name: 'Clintonville',
    state: 'Ohio',
    postalCode: '43202',
    cityWebsite: 'https://www.clintonvilleareacommission.org/',
    schoolWebsite: 'https://www.ccsoh.us/',
    schoolName: 'Columbus City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/n/clintonville-columbus-oh/',
    nicheRating: 'A',
    medianPrice: 350000,
    population: '35K',
    daysOnMarket: 10,
    description: 'Clintonville is one of Columbus\'s most beloved neighborhoods, known for its walkable streets, diverse architecture, and strong sense of community. Located just north of the Ohio State University campus, this urban neighborhood features everything from charming 1920s bungalows to mid-century ranches. The Whetstone Park of Roses, Olentangy Trail, and vibrant High Street corridor make Clintonville attractive to young professionals, families, and longtime residents alike.',
    county: 'Franklin',
    neighbors: ['columbus', 'worthington', 'upper-arlington'],
    faqs: [
      { q: 'What makes Clintonville different from other Columbus neighborhoods?', a: 'Clintonville has a village-within-the-city feel that\'s increasingly rare in Columbus. The neighborhood\'s active area commission, walkable High Street corridor, and strong block-by-block community identity set it apart. Unlike newer suburbs, Clintonville offers character homes from the 1920s-1950s at prices well below Bexley or Upper Arlington while providing similar walkability and community engagement.' },
      { q: 'Are Clintonville homes in Columbus City Schools or a different district?', a: 'All Clintonville addresses fall within Columbus City Schools. While CCS as a whole rates lower than suburban districts, Clintonville families often utilize CCS magnet and choice programs. Whetstone High School and Clinton Elementary are neighborhood schools. Many families also consider private options like Columbus Academy or the Wellington School, both nearby.' },
      { q: 'What should buyers know about home prices and competition in Clintonville?', a: 'Clintonville is one of Columbus\'s hottest markets with homes averaging just 10 days on market. The $350K median buys a 1,400-1,800 sq ft bungalow or ranch. Updated homes on premium streets like Brevoort or Kelso regularly exceed $450K. Buyers should be prepared for multiple-offer situations, especially on homes priced under $375K.' },
    ]
  },
  {
    slug: 'german-village',
    name: 'German Village',
    state: 'Ohio',
    postalCode: '43206',
    cityWebsite: 'https://www.germanvillage.com/',
    schoolWebsite: 'https://www.ccsoh.us/',
    schoolName: 'Columbus City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/n/german-village-columbus-oh/',
    nicheRating: 'A+',
    medianPrice: 475000,
    population: '5K',
    daysOnMarket: 16,
    description: 'German Village is Columbus\'s crown jewel of historic preservation—a 233-acre neighborhood just south of downtown featuring beautifully restored 19th-century brick homes, brick-lined streets, and gas lamp-style lighting. Originally settled by German immigrants in the mid-1800s, the neighborhood is one of the largest privately-funded historic districts in the United States. The Book Loft, Schmidt\'s Sausage Haus, and Schiller Park anchor a thriving community of restaurants, boutiques, and annual events.',
    county: 'Franklin',
    neighbors: ['columbus', 'bexley'],
    faqs: [
      { q: 'What should buyers know about purchasing a historic home in German Village?', a: 'German Village homes are subject to the German Village Commission\'s architectural review for exterior changes, which preserves the neighborhood\'s character but limits renovation freedom. Many homes are 150+ years old with brick construction, meaning buyers should invest in thorough inspections covering foundation, tuckpointing, and older mechanical systems. The payoff is owning a piece of Columbus history in one of its most walkable neighborhoods.' },
      { q: 'How does the German Village housing market compare to nearby Short North?', a: 'German Village and Short North are both premium Columbus neighborhoods, but German Village skews toward single-family brick homes ($400K-$800K+) while Short North offers more condos and townhomes. German Village provides a quieter residential feel with Schiller Park as its centerpiece. Short North is more nightlife and retail-oriented. Both appreciate strongly due to their proximity to downtown.' },
      { q: 'Is German Village practical for families or better suited for young professionals?', a: 'German Village has a growing family presence, with Schiller Park offering a playground and community events. The neighborhood is within Columbus City Schools, so many families use private or charter school options. The walkability to downtown, restaurants, and Book Loft makes it popular with professionals and empty nesters too. Street parking can be challenging, which is worth considering for multi-car families.' },
    ]
  },
  {
    slug: 'grandview-heights',
    name: 'Grandview Heights',
    state: 'Ohio',
    postalCode: '43212',
    cityWebsite: 'https://www.grandviewheights.org/',
    schoolWebsite: 'https://www.grandviewschools.org/',
    schoolName: 'Grandview Heights Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/grandview-heights-franklin-oh/',
    nicheRating: 'A',
    medianPrice: 425000,
    population: '8K',
    daysOnMarket: 11,
    description: 'Grandview Heights is a compact, walkable suburb just west of downtown Columbus that punches well above its weight in terms of dining, entertainment, and community character. Grandview Avenue serves as the main commercial strip, lined with locally-owned restaurants, breweries, and shops. Housing ranges from charming 1920s bungalows to newer infill construction, attracting young professionals and families who want urban convenience with small-town community feel.',
    county: 'Franklin',
    neighbors: ['upper-arlington', 'columbus', 'hilliard'],
    faqs: [
      { q: 'What is the housing market like in Grandview Heights?', a: 'Grandview Heights has one of the tightest markets in Central Ohio, with homes averaging just 11 days on market. The compact city (1 square mile) means inventory is always limited. Expect to pay $375K-$500K for a renovated bungalow and $500K+ for newer infill construction. Original 1920s homes needing work occasionally list under $350K but attract fierce competition.' },
      { q: 'How does Grandview Heights Schools compare to nearby districts?', a: 'Grandview Heights Schools operates a single elementary, middle, and high school on a connected campus. The district\'s small size means class sizes are manageable and community involvement is high. While smaller than Upper Arlington or Dublin, Grandview Schools consistently performs well on state metrics and benefits from strong property tax support from commercial development along Grandview Avenue.' },
      { q: 'What makes Grandview Heights popular with young professionals and families?', a: 'Grandview\'s walkable restaurant and bar scene along Grandview Avenue rivals Short North without the parking hassle. The Grandview Hop arts festival and active community association create engagement. Families appreciate the small school district and safe, walkable streets. Downtown Columbus is a 10-minute drive or bike ride, and Fifth Avenue provides direct access to Upper Arlington and OSU campus.' },
    ]
  },
  {
    slug: 'lewis-center',
    name: 'Lewis Center',
    state: 'Ohio',
    postalCode: '43035',
    cityWebsite: 'https://www.co.delaware.oh.us/',
    schoolWebsite: 'https://www.olentangy.k12.oh.us/',
    schoolName: 'Olentangy Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/lewis-center-delaware-oh/',
    nicheRating: 'A',
    medianPrice: 475000,
    population: '35K',
    daysOnMarket: 18,
    description: 'Lewis Center is one of Central Ohio\'s fastest-growing communities, located in southern Delaware County along the US-23 corridor. This unincorporated area offers newer construction, excellent Olentangy Schools, and convenient access to both Delaware and Columbus. Neighborhoods range from established subdivisions to brand-new developments with modern amenities. The Polaris area\'s retail and entertainment options are nearby, while Alum Creek State Park provides outdoor recreation.',
    county: 'Delaware',
    neighbors: ['powell', 'delaware', 'westerville'],
    faqs: [
      { q: 'What are the advantages of buying in Lewis Center versus Powell?', a: 'Lewis Center and Powell share the Olentangy Local Schools district, which is the primary draw for both. Lewis Center typically offers more newer construction and slightly lower prices than Powell\'s established neighborhoods. The US-23 and Polaris Parkway corridors provide strong retail access. For buyers who want a newer home in a top school district without Powell\'s premium, Lewis Center is the strategic choice.' },
      { q: 'Which Olentangy schools serve Lewis Center students?', a: 'Lewis Center addresses feed into various Olentangy elementary and middle schools depending on subdivision. Most Lewis Center students attend either Olentangy Liberty or Olentangy Berlin high schools. The district\'s growth has led to ongoing construction of new school buildings, meaning facilities are modern. Olentangy consistently ranks in Ohio\'s top 5 districts across all metrics.' },
      { q: 'What is the commute from Lewis Center to Columbus employers?', a: 'Lewis Center to downtown Columbus is 25-30 minutes via I-71 or US-23, though Polaris-area employment is just 5-10 minutes away. The Polaris corridor is one of Central Ohio\'s largest employment centers with medical facilities, corporate offices, and retail. Delaware County\'s investment in US-23 interchange improvements is easing congestion for southbound commuters.' },
    ]
  },
  {
    slug: 'reynoldsburg',
    name: 'Reynoldsburg',
    state: 'Ohio',
    postalCode: '43068',
    cityWebsite: 'https://www.ci.reynoldsburg.oh.us/',
    schoolWebsite: 'https://www.reyn.org/',
    schoolName: 'Reynoldsburg City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/reynoldsburg-franklin-oh/',
    nicheRating: 'B+',
    medianPrice: 285000,
    population: '40K',
    daysOnMarket: 15,
    description: 'Reynoldsburg, known as the "Birthplace of the Tomato," offers affordable housing and convenient access to downtown Columbus via I-70. This east-side suburb has experienced steady growth and revitalization, with new retail and dining options along Main Street. The diverse housing stock ranges from established neighborhoods with mature trees to newer developments. For buyers priced out of closer-in suburbs, Reynoldsburg offers excellent value with a reasonable commute.',
    county: 'Franklin',
    neighbors: ['blacklick', 'pickerington', 'pataskala', 'gahanna'],
    faqs: [
      { q: 'Is Reynoldsburg a good option for buyers on a budget?', a: 'Reynoldsburg offers some of the best value in the Columbus metro, with a $285K median price that\'s roughly half of Dublin or Upper Arlington. Buyers can find move-in-ready 3-bedroom homes in the $250K-$325K range. The city\'s I-70 location puts downtown Columbus 15-20 minutes away, and the ongoing Main Street revitalization is improving the city\'s commercial appeal.' },
      { q: 'How is Reynoldsburg City Schools performing?', a: 'Reynoldsburg City Schools has invested significantly in facilities and programs, opening the new eSTEM Academy and Summit Road campus. The district is one of the most diverse in Central Ohio, which the administration leverages through cultural programming. While rated B+ overall, the district\'s trajectory is positive with improving test scores and increased extracurricular offerings.' },
      { q: 'What developments are changing the Reynoldsburg housing market?', a: 'Main Street revitalization is bringing new restaurants and retail to the city center. Several new residential developments are adding modern housing stock. The proximity to Blacklick Woods Metro Park adds recreational value. Intel\'s New Albany facility is expected to create positive spillover demand for Reynoldsburg homes given the shorter commute from the east side.' },
    ]
  }
];

function formatPrice(price) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);
}

function formatSavings(price) {
  return formatPrice(price * 0.02);
}

// Build a slug->name lookup from the cities array
const cityNameBySlug = {};
cities.forEach(c => { cityNameBySlug[c.slug] = c.name; });

function generateNeighborLinks(city) {
  if (!city.neighbors || city.neighbors.length === 0) return '';
  const links = city.neighbors
    .filter(slug => cityNameBySlug[slug])
    .map(slug => `          <a href="/areas/${slug}/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${cityNameBySlug[slug]}
          </a>`)
    .join('\n');
  return `
        <h3>Nearby Areas We Serve</h3>
        <div class="internal-links">
${links}
        </div>`;
}

function generateFaqSection(city) {
  if (!city.faqs || city.faqs.length === 0) return '';
  const items = city.faqs.map(faq => `          <div class="faq-item">
            <div class="faq-question">${faq.q}</div>
            <div class="faq-answer">${faq.a}</div>
          </div>`).join('\n');
  return `
        <h2>Frequently Asked Questions About ${city.name} Real Estate</h2>
        <div class="faq-list">
${items}
        </div>`;
}

function generateCityPage(city) {
  const savings = city.medianPrice * 0.02;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${city.name}, OH Homes | 1% Listing | TD Realty Ohio</title>
  <meta name="description" content="Selling your home in ${city.name}? Save thousands with TD Realty Ohio's 1% listing commission. ${formatPrice(city.medianPrice)} median home price, ${city.daysOnMarket} days average on market.">
  <meta name="keywords" content="sell home ${city.name} Ohio, ${city.name} real estate agent, 1 percent commission ${city.name}, ${city.name} listing agent">

  <link rel="canonical" href="https://tdrealtyohio.com/areas/${city.slug}/">
  <meta property="article:modified_time" content="${new Date().toISOString().split('T')[0]}">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Sell Your Home in ${city.name}, Ohio | Save with 1% Commission">
  <meta property="og:description" content="Full-service real estate in ${city.name} at 1% listing commission. Save ${formatSavings(city.medianPrice)} on the median ${formatPrice(city.medianPrice)} home.">
  <meta property="og:url" content="https://tdrealtyohio.com/areas/${city.slug}/">
  <meta property="og:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Sell Your Home in ${city.name}, Ohio | 1% Commission">
  <meta name="twitter:description" content="Full-service real estate in ${city.name} at 1% listing commission. Save ${formatSavings(city.medianPrice)} on the median home.">
  <meta name="twitter:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">

  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <meta name="theme-color" content="#1a2e44">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="preload" href="/assets/css/styles.css" as="style">
  <link rel="preload" href="/assets/js/main.js" as="script">
  <link rel="stylesheet" href="/assets/css/styles.css">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17866418952"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'AW-17866418952');
  </script>

  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tdrealtyohio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Areas", "item": "https://tdrealtyohio.com/areas/" },
      { "@type": "ListItem", "position": 3, "name": "${city.name}", "item": "https://tdrealtyohio.com/areas/${city.slug}/" }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "TD Realty Ohio",
    "description": "Full-service real estate agent serving ${city.name}, Ohio with 1% listing commission.",
    "url": "https://tdrealtyohio.com/areas/${city.slug}/",
    "telephone": "(614) 392-8858",
    "email": "info@tdrealtyohio.com",
    "areaServed": {
      "@type": "City",
      "name": "${city.name}",
      "containedInPlace": {
        "@type": "State",
        "name": "Ohio"
      }
    },
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "${city.name}",
      "addressRegion": "OH",
      "postalCode": "${city.postalCode}",
      "addressCountry": "US"
    }
  }
  </script>
${city.faqs ? `  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
${city.faqs.map(faq => `      {
        "@type": "Question",
        "name": "${faq.q}",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "${faq.a}"
        }
      }`).join(',\n')}
    ]
  }
  </script>` : ''}

  <style>
    .city-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
    .city-stat { background: var(--white); border: 1px solid var(--gray-200); padding: 1.5rem; border-radius: var(--radius-lg); text-align: center; }
    .city-stat-value { font-size: 2rem; font-weight: 700; color: var(--navy); font-family: 'Libre Baskerville', serif; }
    .city-stat-label { font-size: 0.875rem; color: var(--gray-600); margin-top: 0.5rem; }
    .resource-links { display: flex; flex-wrap: wrap; gap: 1rem; margin: 2rem 0; }
    .resource-link { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); color: var(--gray-700); text-decoration: none; font-weight: 500; transition: all 0.2s; }
    .resource-link:hover { border-color: var(--navy); color: var(--navy); background: var(--gray-50); }
    .resource-link svg { width: 18px; height: 18px; }
    .savings-card { background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%); color: var(--white); padding: 2.5rem; border-radius: var(--radius-lg); text-align: center; margin: 2rem 0; }
    .savings-amount { font-size: 3rem; font-weight: 700; color: var(--gold); margin: 1rem 0; font-family: 'Libre Baskerville', serif; }
    .city-description { font-size: 1.125rem; line-height: 1.8; color: var(--gray-700); margin: 2rem 0; }
    .internal-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .internal-link { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: var(--gray-50); border-radius: var(--radius-md); color: var(--navy); text-decoration: none; font-weight: 500; transition: all 0.2s; }
    .internal-link:hover { background: var(--gray-100); }
    .internal-link svg { width: 20px; height: 20px; color: var(--gold); }
    .faq-list { margin: 2rem 0; }
    .faq-item { border: 1px solid var(--gray-200); border-radius: var(--radius-md); margin-bottom: 1rem; overflow: hidden; }
    .faq-question { font-weight: 600; padding: 1.25rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: var(--gray-50); }
    .faq-question:hover { background: var(--gray-100); }
    .faq-answer { padding: 0 1.25rem 1.25rem; line-height: 1.7; color: var(--gray-700); }
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><span class="logo-mark">TD</span><span>Realty Ohio</span></a>
      <nav class="nav" id="main-nav">
        <a href="/sellers/" class="nav-link">Sellers</a>
        <a href="/1-percent-commission/" class="nav-link">1% Listing</a>
        <a href="/buyers/" class="nav-link">Buyers</a>
        <a href="/pre-listing-inspection/" class="nav-link">Pre-Listing Inspection</a>
        <a href="/home-value/" class="nav-link">Home Value</a>
        <a href="/affordability/" class="nav-link">Affordability</a>
        <a href="/areas/" class="nav-link active">Areas</a>
        <a href="/blog/" class="nav-link">Blog</a>
        <a href="/about/" class="nav-link">About</a>
        <a href="/contact/" class="btn btn-primary nav-cta">Contact</a>
      </nav>
      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/></svg>
      </button>
    </div>
  </header>

  <main id="main-content">
    <section class="hero hero-sm" style="background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%);">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li><a href="/">Home</a></li>
            <li><a href="/areas/">Areas</a></li>
            <li class="current">${city.name}</li>
          </ol>
        </nav>
        <div class="hero-content">
          <h1 class="hero-title">Sell Your Home in ${city.name}, Ohio</h1>
          <p class="hero-subtitle">Full-service real estate at 1% listing commission. Save thousands when you sell.</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container" style="max-width: 900px;">

        <div class="city-stats">
          <div class="city-stat">
            <div class="city-stat-value">${formatPrice(city.medianPrice)}</div>
            <div class="city-stat-label">Median Home Price</div>
          </div>
          <div class="city-stat">
            <div class="city-stat-value">${city.population}</div>
            <div class="city-stat-label">Population</div>
          </div>
          <div class="city-stat">
            <div class="city-stat-value">${city.daysOnMarket}</div>
            <div class="city-stat-label">Avg Days on Market</div>
          </div>
          <div class="city-stat">
            <div class="city-stat-value">${city.nicheRating}</div>
            <div class="city-stat-label">Niche Rating</div>
          </div>
        </div>

        <div class="savings-card">
          <p style="font-size: 1.125rem; opacity: 0.9;">At the ${formatPrice(city.medianPrice)} median home price, you could save:</p>
          <div class="savings-amount">${formatSavings(city.medianPrice)}</div>
          <p style="opacity: 0.8; margin-bottom: 1.5rem;">with our 1% listing commission vs. traditional 3%</p>
          <a href="/sellers/" class="btn btn-gold btn-lg">Calculate Your Savings</a>
        </div>

        <h2>About ${city.name}</h2>
        <p class="city-description">${city.description}</p>

        <h3>Local Resources</h3>
        <div class="resource-links">
          <a href="${city.cityWebsite}" target="_blank" rel="noopener noreferrer" class="resource-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            City Website
          </a>
          <a href="${city.schoolWebsite}" target="_blank" rel="noopener noreferrer" class="resource-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            ${city.schoolName}
          </a>
          <a href="${city.nicheUrl}" target="_blank" rel="noopener noreferrer" class="resource-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Niche: ${city.nicheRating} Rating
          </a>
        </div>

        <h3>Services in ${city.name}</h3>
        <div class="internal-links">
          <a href="/sellers/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Sell Your ${city.name} Home
          </a>
          <a href="/buyers/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            Buy in ${city.name}
          </a>
          <a href="/home-value/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Free Home Value
          </a>
          <a href="/pre-listing-inspection/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Pre-Listing Inspection
          </a>
        </div>
${generateNeighborLinks(city)}
${generateFaqSection(city)}

        <p class="text-muted" style="font-size: 0.8125rem; margin-top: 2rem;">
          Market data approximate. Based on MLS data and public records.
          <a href="https://www.columbusrealtors.com/" target="_blank" rel="noopener noreferrer" style="color: var(--gold);">Source: Columbus REALTORS</a>
        </p>
      </div>
    </section>

    <section class="section cta-section">
      <div class="container">
        <h2>Ready to Sell in ${city.name}?</h2>
        <p>Get a free consultation and see how much you can save.</p>
        <div class="hero-buttons flex-center">
          <a href="/contact/" class="btn btn-primary btn-lg">Contact Us</a>
          <a href="tel:6143928858" class="btn btn-outline-white btn-lg">(614) 392-8858</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-main">
        <div class="footer-brand">
          <div class="footer-logo"><span class="logo-mark">TD</span><span>Realty Ohio</span></div>
          <p>Full-service real estate. Lower commission.</p>
        </div>
        <div>
          <h4 class="footer-title">Services</h4>
          <ul class="footer-links">
            <li><a href="/sellers/">For Sellers</a></li>
            <li><a href="/buyers/">For Buyers</a></li>
            <li><a href="/pre-listing-inspection/">Pre-Listing Inspection</a></li>
            <li><a href="/areas/">Service Areas</a></li>
            <li><a href="/home-value/">Free Home Value</a></li>
            <li><a href="/affordability/">Affordability Calculator</a></li>
            <li><a href="/referrals/">Referral Credit</a></li>
          </ul>
        </div>
        <div>
          <h4 class="footer-title">Company</h4>
          <ul class="footer-links">
            <li><a href="/about/">About</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/agents/">Agent Opportunities</a></li>
          </ul>
        </div>
        <div>
          <h4 class="footer-title">Contact</h4>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <a href="tel:6143928858" data-phone>(614) 392-8858</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <a href="mailto:info@tdrealtyohio.com" data-email>info@tdrealtyohio.com</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span data-location>Westerville, Ohio</span>
          </div>
        </div>
      </div>
      <div class="footer-compliance-logos">
        <a href="https://www.hud.gov/program_offices/fair_housing_equal_opp" target="_blank" rel="noopener noreferrer" title="Equal Housing Opportunity" aria-label="Equal Housing Opportunity - opens in new tab">
          <img src="/media/compliance/equal-housing.svg" alt="Equal Housing Opportunity" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.nar.realtor/" target="_blank" rel="noopener noreferrer" title="National Association of REALTORS®" aria-label="National Association of REALTORS - opens in new tab">
          <img src="/media/compliance/realtor.svg" alt="REALTOR®" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.columbusrealtors.com/" target="_blank" rel="noopener noreferrer" title="Columbus REALTORS®" aria-label="Columbus REALTORS - opens in new tab">
          <img src="/media/compliance/columbus-realtors.svg" alt="Columbus REALTORS®" height="45" width="120" loading="lazy">
        </a>
        <a href="https://www.ohiorealtors.org/" target="_blank" rel="noopener noreferrer" title="Ohio REALTORS®" aria-label="Ohio REALTORS - opens in new tab">
          <img src="/media/compliance/ohio-realtors.svg" alt="Ohio REALTORS®" height="45" width="120" loading="lazy">
        </a>
      </div>
      <div class="footer-bottom">
        <div class="footer-legal">
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Service</a>
          <a href="/fair-housing/">Fair Housing</a>
          <a href="/sitemap-page/">Site Map</a>
        </div>
      </div>
      <div class="footer-license">
        TD Realty Ohio, LLC | Broker: Travis Debnam | Broker License #2023006467 | Brokerage License #2023006602<br>
        Member of Columbus REALTORS, Ohio REALTORS, and the National Association of REALTORS
      </div>
    </div>
  </footer>
  <script src="/assets/js/main.js"></script>
</body>
</html>`;
}

// Generate all city pages
const areasDir = path.join(__dirname, '..', 'areas');

cities.forEach(city => {
  const cityDir = path.join(areasDir, city.slug);

  // Create directory if it doesn't exist
  if (!fs.existsSync(cityDir)) {
    fs.mkdirSync(cityDir, { recursive: true });
  }

  // Write the page
  const pagePath = path.join(cityDir, 'index.html');
  fs.writeFileSync(pagePath, generateCityPage(city));
  console.log(`Created: /areas/${city.slug}/index.html`);
});

// Generate sitemap entries
console.log('\n--- Sitemap entries to add ---');
cities.forEach(city => {
  console.log(`  <url>
    <loc>https://tdrealtyohio.com/areas/${city.slug}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
});

console.log('\nDone! Created ' + cities.length + ' city pages.');
