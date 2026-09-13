import { z } from 'zod';
import { provenance, nullableText, requireSourceWhenSourced } from './provenance.js';

export const buyerSegment = z.enum([
  'consulting_firm',
  'lender',
  'brokerage',
  'title',
  'developer',
  'attorney',
  'public_agency',
  'land_bank',
  'port_authority',
  'utility',
]);
export type BuyerSegment = z.infer<typeof buyerSegment>;

export const buyer = provenance
  .extend({
    segment: buyerSegment,
    name: z.string().min(1),
    city: nullableText,
    phone: nullableText,
    url: z.string().url().nullable(),
    /** Path to the person or intake form to approach, e.g. "RFP inbox" or a named role. */
    contact_path: nullableText,
    /** Credentials this buyer holds or requires, e.g. ["VAP CP189"]. */
    credentials_held: z.array(z.string().min(1)).default([]),
    why_they_buy: z.string().min(1),
  })
  .superRefine(requireSourceWhenSourced);

export type Buyer = z.infer<typeof buyer>;
export const buyers = z.array(buyer);
