import { z } from 'zod';

/**
 * Provenance is carried by every record in /src/data. It answers three
 * questions about every fact in this repository:
 *
 *   Where did it come from?   source_url + source_note
 *   When was that checked?    verified_at (written by scripts/check-links.ts)
 *   How much weight can it carry?  confidence
 *
 * confidence values:
 *   "sourced"      the fact is stated at source_url, or in the document named
 *                  in source_note, and was read there.
 *   "constructed"  the fact was derived from sourced inputs. The record must
 *                  explain the derivation (pricing.yaml uses
 *                  construction_method for this).
 *   "unverified"   we believe it but have not confirmed it. An unverified
 *                  record may not carry an invented value: unknown fields
 *                  stay null.
 */
export const isoDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/,
    'must be an ISO date (YYYY-MM-DD) or ISO date-time',
  );

export const confidence = z.enum(['sourced', 'constructed', 'unverified']);
export type Confidence = z.infer<typeof confidence>;

export const provenance = z.object({
  source_url: z.string().url().nullable(),
  source_note: z.string().min(1, 'source_note is required: say where the fact came from'),
  verified_at: isoDate.nullable(),
  confidence,
});

export type Provenance = z.infer<typeof provenance>;

/** A record claiming "sourced" has to point at something. */
export const requireSourceWhenSourced = <T extends Provenance>(record: T, ctx: z.RefinementCtx) => {
  if (record.confidence === 'sourced' && !record.source_url && record.source_note.trim().length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confidence'],
      message:
        'confidence "sourced" requires either a source_url or a source_note naming the document the fact was read in',
    });
  }
};

/** Helper: an optional string that must be null rather than "" when unknown. */
export const nullableText = z.string().min(1).nullable();

/** Helper: a number that must be null rather than 0 or a guess when unknown. */
export const nullableNumber = z.number().nullable();
