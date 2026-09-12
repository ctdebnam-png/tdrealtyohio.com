/**
 * Ohio Revised Code 4733.16 reserves the words "engineer", "engineering",
 * "surveyor" and "surveying" (and their derivations) for firms holding a
 * certificate of authorization from the Ohio State Board of Registration for
 * Professional Engineers and Surveyors. TD Environmental does not hold one.
 *
 * The words therefore may not appear in:
 *   - the firm name or domain
 *   - any page title or meta description
 *   - any h1
 *   - any service name
 *
 * scripts/check-orc-4733.ts enforces this against the built output and fails
 * the build on a hit. src/schemas/services.ts enforces it on service names at
 * data-validation time, so a bad record is caught before it is ever rendered.
 *
 * No word boundary is used: the intent is to catch compounds such as
 * "bioengineering" and "re-engineered" as well as the bare terms.
 */
export const PROHIBITED_TERMS = ['engineer', 'engineering', 'surveyor', 'surveying'] as const;

export const PROHIBITED_TERM_PATTERN = /engineer|surveyor|surveying/i;

/** Global variant for collecting every hit in a string. Reset lastIndex before use. */
export const prohibitedTermMatches = (value: string): string[] =>
  [...value.matchAll(/[\w-]*(?:engineer|surveyor|surveying)[\w-]*/gi)].map((m) => m[0]);

export const ORC_CITATION = 'ORC 4733.16';
