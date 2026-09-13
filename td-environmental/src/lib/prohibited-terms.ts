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

/**
 * Homoglyphs and invisible characters defeat a plain ASCII match: "enginеering"
 * with a Cyrillic е, or "engi<zero-width space>neering", reads identically to a
 * person and passes a naive regex. Every string is folded through this before
 * matching, so the check cannot be walked around by a paste from a word
 * processor or by a deliberate substitution.
 */
const INVISIBLE = /[\u00ad\u200b-\u200f\u2060\ufeff]/g;
const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic
  а: 'a', е: 'e', і: 'i', ѕ: 's', ո: 'n', о: 'o', р: 'p', с: 'c', у: 'y', ԛ: 'q', ѵ: 'v',
  // Greek
  ε: 'e', ι: 'i', ν: 'v', ο: 'o', ρ: 'p', υ: 'u',
  // Fullwidth latin
  ｅ: 'e', ｇ: 'g', ｉ: 'i', ｎ: 'n', ｒ: 'r', ｓ: 's', ｖ: 'v', ｙ: 'y',
};

export const foldForMatching = (value: string): string =>
  value
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/[^\x00-\x7f]/g, (char) => HOMOGLYPHS[char.toLowerCase()] ?? char);

const CORE = /engineer|surveyor|surveying/i;

export const PROHIBITED_TERM_PATTERN = {
  test: (value: string): boolean => CORE.test(foldForMatching(value)),
};

/** Every hit in a string, matched against the folded form. */
export const prohibitedTermMatches = (value: string): string[] =>
  [...foldForMatching(value).matchAll(/[\w-]*(?:engineer|surveyor|surveying)[\w-]*/gi)].map(
    (match) => match[0],
  );

/**
 * Advisory only. ORC 4733.16 reserves "surveyor" and "surveying"; a bare
 * "survey" is lawful and is ordinary Phase I vocabulary ("windshield survey",
 * "site reconnaissance survey"). These are surfaced for a human to confirm
 * they do not read as an offer to practise land surveying — they never fail
 * the build.
 */
export const ADVISORY_TERM_PATTERN = /\bsurvey(s|ed)?\b/i;

export const advisoryTermMatches = (value: string): string[] =>
  [...foldForMatching(value).matchAll(/\bsurvey(?:s|ed)?\b/gi)].map((match) => match[0]);

export const ORC_CITATION = 'ORC 4733.16';
