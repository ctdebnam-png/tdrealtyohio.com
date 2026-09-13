import { z } from 'zod';
import { provenance, nullableText, nullableNumber, requireSourceWhenSourced } from './provenance.js';

export const regulatoryRequirement = provenance
  .extend({
    requirement: z.string().min(1),
    /** The rule or statute, e.g. "ORC 4733.16" or "OAC 3745-300". */
    citation: z.string().min(1),
    agency: z.string().min(1),
    url: z.string().url().nullable(),
    applies_to: z.string().min(1),
    /** Fee in USD, or null when no fee is published. Never guessed. */
    fee: nullableNumber,
    /** True when the requirement stops the firm selling work today. */
    blocking: z.boolean(),
    summary: z.string().min(1),
    fee_note: nullableText.default(null),
  })
  .superRefine(requireSourceWhenSourced);

export type RegulatoryRequirement = z.infer<typeof regulatoryRequirement>;
export const regulatory = z.array(regulatoryRequirement);
