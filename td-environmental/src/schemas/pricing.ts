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
    /**
     * ISO 4217, uppercase. Intl.NumberFormat throws a RangeError on any other
     * three-character string, which would fail the whole build over one
     * internal-only row.
     */
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'currency must be a three-letter uppercase ISO 4217 code, e.g. USD')
      .default('USD'),
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
    // A date is not a citation. A sourced figure needs somewhere it can be
    // read: a URL, or a source_note substantial enough to retrace.
    if (
      record.basis === 'sourced' &&
      hasFigure &&
      !record.source_url &&
      record.source_note.trim().length < 20
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_url'],
        message:
          'a sourced figure must carry a source_url, or a source_note naming the document it was read in (source_date alone is not a citation)',
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
