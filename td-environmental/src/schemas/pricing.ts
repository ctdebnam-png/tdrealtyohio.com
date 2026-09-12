import { z } from 'zod';
import { provenance, nullableText, nullableNumber, requireSourceWhenSourced } from './provenance.js';

/**
 * basis:
 *   "sourced"     the figure is published at source_url and was read there.
 *   "constructed" the figure was derived. construction_method must explain how,
 *                 in enough detail that someone else could redo the arithmetic.
 *
 * A figure that is neither is not a figure: leave amount_low and amount_high
 * null and set confidence to "unverified".
 */
export const pricingBasis = z.enum(['sourced', 'constructed']);
export type PricingBasis = z.infer<typeof pricingBasis>;

export const priceItem = provenance
  .extend({
    item: z.string().min(1),
    amount_low: nullableNumber,
    amount_high: nullableNumber,
    unit: z.string().min(1),
    currency: z.string().length(3).default('USD'),
    basis: pricingBasis,
    construction_method: nullableText,
    source_date: z.string().nullable().default(null),
    caveat: z.string().default(''),
  })
  .superRefine(requireSourceWhenSourced)
  .superRefine((record, ctx) => {
    const hasFigure = record.amount_low !== null || record.amount_high !== null;
    if (record.basis === 'constructed' && hasFigure && !record.construction_method) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['construction_method'],
        message:
          'a constructed figure must carry a construction_method explaining how it was derived',
      });
    }
    if (record.basis === 'sourced' && hasFigure && !record.source_url && !record.source_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_url'],
        message: 'a sourced figure must carry the source it was read from',
      });
    }
    if (
      record.amount_low !== null &&
      record.amount_high !== null &&
      record.amount_low > record.amount_high
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount_low'],
        message: 'amount_low may not exceed amount_high',
      });
    }
  });

export type PriceItem = z.infer<typeof priceItem>;
export const pricing = z.array(priceItem);
