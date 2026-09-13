import { z } from 'zod';
import { provenance, nullableText, nullableNumber, requireSourceWhenSourced } from './provenance.js';

export const credentialHolder = z.enum(['travis', 'kwame', 'sam', 'firm']);
export type CredentialHolder = z.infer<typeof credentialHolder>;

/**
 * market_recognition is a judgement about what a credential buys in this market:
 *   "gate"      work cannot be sold without it
 *   "strong"    buyers ask for it by name
 *   "moderate"  it helps in a shortlist
 *   "vanity"    it looks good and moves nothing
 */
export const marketRecognition = z.enum(['gate', 'strong', 'moderate', 'vanity']);
export type MarketRecognition = z.infer<typeof marketRecognition>;

export const credential = provenance
  .extend({
    holder: credentialHolder,
    name: z.string().min(1),
    issuing_body: z.string().min(1),
    url: z.string().url().nullable(),
    prerequisites: z.array(z.string().min(1)).default([]),
    coursework: nullableText,
    exam: nullableText,
    experience_requirement: nullableText,
    cost_initial: nullableNumber,
    cost_maintenance: nullableNumber,
    time_to_earn: nullableText,
    /** True once the credential may be shown on a public page. */
    displayable_on_join: z.boolean(),
    /** Set when the credential is actually held, so it can be published. */
    earned_at: z.string().nullable().default(null),
    /** License or certificate number, where one exists. */
    license_number: z.string().nullable().default(null),
    market_recognition: marketRecognition,
    verdict: z.string().min(1),
    /** Sequencing for /internal/credentials/: 1 = year one, 3 = year three. */
    plan_year: z.union([z.literal(1), z.literal(3)]).nullable().default(null),
  })
  .superRefine(requireSourceWhenSourced);

export type Credential = z.infer<typeof credential>;
export const credentials = z.array(credential);

/** A credential may appear on the public site only if it is displayable or earned. */
export const isPublishable = (c: Credential): boolean =>
  c.displayable_on_join || c.earned_at !== null;
