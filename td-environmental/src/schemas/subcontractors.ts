import { z } from 'zod';
import { provenance, nullableText, requireSourceWhenSourced } from './provenance.js';

export const subcontractorCategory = z.enum([
  'driller',
  'laboratory',
  'surveyor',
  'waste',
  'field_services',
]);
export type SubcontractorCategory = z.infer<typeof subcontractorCategory>;

export const subcontractor = provenance
  .extend({
    category: subcontractorCategory,
    name: z.string().min(1),
    address: nullableText,
    city: nullableText,
    state: nullableText,
    zip: nullableText,
    phone: nullableText,
    email: z.string().email().nullable(),
    url: z.string().url().nullable(),
    capabilities: z.array(z.string().min(1)).default([]),
    published_productivity: nullableText,
    /**
     * No rate data exists yet. This field stays null until a real quote or a
     * published rate sheet is in hand; /internal/subcontractors/ renders it as
     * a blank column to fill.
     */
    rates: z.null(),
    works_with_small_firms: z.boolean().nullable(),
    notes: z.string().default(''),
  })
  .superRefine(requireSourceWhenSourced);

export type Subcontractor = z.infer<typeof subcontractor>;
export const subcontractors = z.array(subcontractor);
