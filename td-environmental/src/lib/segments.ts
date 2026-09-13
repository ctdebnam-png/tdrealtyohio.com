import type { BuyerSegment } from '../schemas/buyers.js';

/**
 * Public copy for /who-we-serve/[segment]/.
 *
 * This is marketing copy, not research. The research records in
 * src/data/buyers.yaml are a prospect list and stay on /internal/buyers/ —
 * naming the firms we intend to call, on a public page, would be a mistake.
 * The segment taxonomy itself comes from the buyers schema, so the two cannot
 * drift apart.
 *
 * Nothing here states a fact about TD Environmental's record, volume, or
 * clients. Those belong in data files, with a source.
 */
export type SegmentCopy = {
  /** Sentence case. Becomes the page h1. */
  title: string;
  /** Meta description and page standfirst. */
  summary: string;
  /** The buyer's problem, in their terms. */
  problem: string[];
  /** What working with the firm looks like for this buyer. */
  working_with_us: string[];
  /** Order on /who-we-serve/. Lower comes first. */
  priority: number;
};

export const SEGMENT_COPY: Record<BuyerSegment, SegmentCopy> = {
  consulting_firm: {
    title: 'Consulting firms',
    summary:
      'Overflow assessment and field support for central Ohio consulting firms, delivered under your contract and your letterhead where your client requires it.',
    problem: [
      'Your backlog moves in waves. A week with four Phase I reports due and one available assessor is a week you either turn work away or deliver late.',
      'Adding a full-time assessor for a peak you cannot forecast is a cost you carry all year.',
    ],
    working_with_us: [
      'We take overflow. Site reconnaissance, records review, interviews, report drafting, and field oversight, scoped to the piece you need rather than the whole file.',
      'We work under your contract and your letterhead where your client requires it. Your client relationship stays yours.',
      'We carry our own professional liability coverage. You are not extending yours to cover our work.',
      'We do not solicit your clients. Not during the engagement, not after it. The property owners and lenders we meet through your file remain your accounts.',
    ],
    priority: 1,
  },
  lender: {
    title: 'Lenders',
    summary:
      'Environmental due diligence for commercial lenders in central Ohio, scoped to the report your credit file needs and dated to your closing.',
    problem: [
      'A loan committee date does not move because a site assessment is late.',
      'A report that does not meet the standard your regulator or secondary-market buyer expects is a report you cannot lend against.',
    ],
    working_with_us: [
      'Scope is agreed against the standard your file has to satisfy, before fieldwork starts.',
      'We tell you what a site needs and what it does not, and we say so before you commission the larger scope.',
    ],
    priority: 2,
  },
  brokerage: {
    title: 'Brokerages',
    summary:
      'Site assessment support for commercial brokers whose transaction turns on an environmental question.',
    problem: [
      'A deal stalls when a buyer, a lender, or a title company raises a question about a former use nobody priced in.',
      'You need to know what the exposure is early enough to renegotiate rather than late enough to lose the transaction.',
    ],
    working_with_us: [
      'An early read on what the property history implies, before a full scope is commissioned.',
      'Findings written so that a buyer, a seller, and a lender can all read the same document.',
    ],
    priority: 4,
  },
  title: {
    title: 'Title companies',
    summary:
      'Assessment work for title companies handling transactions with a recorded environmental encumbrance.',
    problem: [
      'An environmental covenant or a recorded restriction on a parcel raises questions your file has to answer before closing.',
    ],
    working_with_us: [
      'We read the recorded instrument, say what it restricts in practice, and document the basis for that reading.',
    ],
    priority: 7,
  },
  developer: {
    title: 'Developers',
    summary:
      'Site assessment and cleanup-programme support for developers acquiring or repositioning central Ohio property.',
    problem: [
      'Infill land carries a history. What that history costs decides whether the site pencils.',
      'A surprise found after closing is priced entirely on your side of the table.',
    ],
    working_with_us: [
      'Assessment scoped to the decision in front of you: whether to buy, what to hold back, what to require of the seller.',
      'Where a state cleanup programme is the route to a marketable title, we say so early and scope to that programme.',
    ],
    priority: 3,
  },
  attorney: {
    title: 'Attorneys',
    summary:
      'Assessment and document review for attorneys handling transactions, contribution claims, and enforcement matters.',
    problem: [
      'Your matter turns on what a site record actually shows, and on whether the assessment behind it was performed to the standard it claims.',
    ],
    working_with_us: [
      'Findings documented so they survive review by the other side.',
      'Work performed at your direction where privilege matters to the engagement.',
    ],
    priority: 5,
  },
  public_agency: {
    title: 'Public agencies',
    summary:
      'Assessment support for city, county, and township agencies managing publicly held or acquired property.',
    problem: [
      'Property acquired for a public purpose still carries whatever its former use left behind.',
      'Procurement requires a documented scope and a documented basis for the price.',
    ],
    working_with_us: [
      'Scope written to your solicitation, with the deliverable and the standard stated plainly.',
    ],
    priority: 6,
  },
  land_bank: {
    title: 'Land banks',
    summary:
      'Assessment for county land banks deciding what to do with a parcel that has a history.',
    problem: [
      'A parcel taken through foreclosure can carry a former use nobody documented.',
      'Demolition, transfer, and reuse each need a different level of certainty about what is in the ground.',
    ],
    working_with_us: [
      'Assessment scoped to the disposition decision rather than to a standard report template.',
    ],
    priority: 8,
  },
  port_authority: {
    title: 'Port authorities',
    summary:
      'Assessment support for port authorities financing and holding property for redevelopment.',
    problem: [
      'Property taken onto a port authority balance sheet is property whose condition the authority now owns.',
    ],
    working_with_us: [
      'Assessment documented to the level a financing file and a future transferee both require.',
    ],
    priority: 9,
  },
  utility: {
    title: 'Utilities',
    summary:
      'Corridor and facility assessment support for utilities working across central Ohio.',
    problem: [
      'Easements and facility parcels cross ground whose former uses were never catalogued.',
    ],
    working_with_us: [
      'Field assessment scheduled around outage windows and access constraints rather than around ours.',
    ],
    priority: 10,
  },
};
