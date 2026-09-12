import { z } from 'zod';
import { provenance, nullableText, nullableNumber, requireSourceWhenSourced } from './provenance.js';
import { credentialHolder } from './credentials.js';

/**
 * Team records back /about/team/. The page follows the central Ohio
 * convention: photo, role, years of experience, a narrative paragraph of real
 * project work, then three labelled lists.
 *
 * This file is not one of the seven research domains; it exists because the
 * team page cannot be rendered from the research data alone and nothing on it
 * may be invented. Every field is nullable for the same reason: a person with
 * no photo yet renders without one rather than with a stand-in.
 */
export const teamMember = provenance
  .extend({
    /** Matches credentials.yaml holder, so certifications can be joined. */
    id: credentialHolder.exclude(['firm']),
    name: z.string().min(1),
    role: z.string().min(1),
    photo: nullableText,
    photo_alt: nullableText,
    years_experience: nullableNumber,
    /** A paragraph of real project work. Never a generic biography. */
    narrative: nullableText,
    /** Shown as-is; license numbers belong here where they exist. */
    certifications: z.array(z.string().min(1)).default([]),
    education: z.array(z.string().min(1)).default([]),
    expertise: z.array(z.string().min(1)).default([]),
    order: z.number().int().default(0),
  })
  .superRefine(requireSourceWhenSourced);

export type TeamMember = z.infer<typeof teamMember>;
export const team = z.array(teamMember);
