/**
 * TD Environmental Ohio, LLC — the related entity, and the disclosure.
 * ───────────────────────────────────────────────────────────────────
 * WP-10. A SEPARATE Ohio limited liability company under common ownership.
 * Not a parent, not a subsidiary, not a trade name, not a dba, and not an
 * agent. It does not perform brokerage services and this brokerage does not
 * perform environmental services.
 *
 * `disclosure` is one sentence and it is IDENTICAL, character for character,
 * to RELATED_SITE.disclosure in src/lib/site.ts of the td-environmental repo.
 * That is the point of it: the relationship has to read the same from either
 * direction, and a visitor who follows the link and finds different wording
 * has been told two things about who is liable for what.
 *
 * A gate on each side checks the built pages, not the constant:
 *   here                scripts/check-disclosure.mjs
 *   td-environmental    scripts/check-disclosure.ts
 *
 * The link and the sentence travel together. Footer only, never nav — a nav
 * entry would read as one firm with two departments, which is the precise
 * impression the disclosure exists to prevent.
 */
const RELATED_ENTITY = {
  name: 'TD Environmental Ohio',
  legal_entity: 'TD Environmental Ohio, LLC',
  url: 'https://tdenvironmentalohio.com',
  /** What it does, in the words its own site uses. No brokerage framing. */
  summary: 'environmental site assessment, reporting and technical support',
  disclosure:
    "TD Environmental Ohio, LLC and TD Realty Ohio, LLC are separate Ohio limited liability companies under common ownership. Neither is a subsidiary, a trade name, or an agent of the other, and neither provides the other's services.",
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RELATED_ENTITY };
}
