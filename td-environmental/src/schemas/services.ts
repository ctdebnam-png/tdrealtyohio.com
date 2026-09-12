import { z } from 'zod';
import { provenance, nullableText, requireSourceWhenSourced } from './provenance.js';
import { buyerSegment } from './buyers.js';
import { PROHIBITED_TERM_PATTERN } from '../lib/prohibited-terms.js';

/**
 * delivery:
 *   "in_house"      the firm performs it today
 *   "subcontracted" the firm sells it and a subcontractor performs it
 *   "blocked"       the firm cannot sell it yet; blocker says why.
 *
 * Blocked services render on /internal/services/ only. They are never built as
 * a public page and never appear in the sitemap.
 */
export const serviceDelivery = z.enum(['in_house', 'subcontracted', 'blocked']);
export type ServiceDelivery = z.infer<typeof serviceDelivery>;

export const service = provenance
  .extend({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
    name: z
      .string()
      .min(1)
      .refine((value) => !PROHIBITED_TERM_PATTERN.test(value), {
        message:
          'service name contains a term prohibited by ORC 4733.16 (engineer/engineering/surveyor/surveying)',
      }),
    category: z.string().min(1),
    description: z.string().min(1),
    /** The standard or program the work runs under: E1527-21, E1903, VAP, BUSTR, RCRA. */
    standard: nullableText,
    delivery: serviceDelivery,
    /** Required when delivery is "blocked", e.g. "requires Ohio COA". */
    blocker: nullableText,
    typical_buyer_segments: z.array(buyerSegment).default([]),
    deliverable: z.string().min(1),
  })
  .superRefine(requireSourceWhenSourced)
  .superRefine((record, ctx) => {
    if (record.delivery === 'blocked' && !record.blocker) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocker'],
        message: 'a blocked service must name its blocker',
      });
    }
    if (record.delivery !== 'blocked' && record.blocker) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocker'],
        message: 'blocker is only meaningful when delivery is "blocked"',
      });
    }
  });

export type Service = z.infer<typeof service>;
export const services = z.array(service);

/** Services that may be built as public pages. */
export const isPublicService = (s: Service): boolean => s.delivery !== 'blocked';
