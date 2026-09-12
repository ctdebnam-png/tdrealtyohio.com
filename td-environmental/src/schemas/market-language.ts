import { z } from 'zod';
import { provenance, isoDate, requireSourceWhenSourced } from './provenance.js';

/**
 * How competitors in this market organise and name their offer. Menu headings
 * are recorded verbatim from the firm's own site so that our own service names
 * can be checked against the language buyers already read.
 */
export const marketLanguageEntry = provenance
  .extend({
    firm_name: z.string().min(1),
    city: z.string().min(1),
    url: z.string().url().nullable(),
    menu_headings: z.array(z.string().min(1)).default([]),
    organizing_principle: z.string().min(1),
    observed_at: isoDate.nullable(),
  })
  .superRefine(requireSourceWhenSourced);

export type MarketLanguageEntry = z.infer<typeof marketLanguageEntry>;
export const marketLanguage = z.array(marketLanguageEntry);
