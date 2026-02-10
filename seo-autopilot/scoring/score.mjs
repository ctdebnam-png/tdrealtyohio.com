/**
 * score.mjs
 *
 * Computes a per-run SEO health score (0–100) based on:
 * - GSC metric deltas (clicks, impressions, CTR, position)
 * - Technical audit issues (critical vs other)
 * - Link graph health (orphans, underlinked pillars)
 * - Content signals (thin pages)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCORING_CONFIG_PATH = join(__dirname, '..', 'config', 'scoring.json');

// Critical tech issue codes
const CRITICAL_CODES = new Set([
  'MISSING_CANONICAL',
  'CANONICAL_NOT_ABSOLUTE',
  'CANONICAL_DOMAIN_MISMATCH',
  'NOINDEX_ON_RANK_PAGE',
  'MISSING_TITLE',
  'MISSING_META_DESCRIPTION',
  'BROKEN_INTERNAL_LINK',
]);

/**
 * Classify audit issues into critical and other.
 *
 * @param {object} auditResult - Build audit result with .totals.issueCounts and .pages
 * @param {string[]} rankIntentRoutes - Pages that are rank-intent
 * @returns {{ criticalCount: number, otherCount: number, brokenInternalLinks: number, details: object[] }}
 */
export function classifyIssues(auditResult, rankIntentRoutes = []) {
  const rankSet = new Set(rankIntentRoutes);
  let criticalCount = 0;
  let otherCount = 0;
  let brokenInternalLinks = 0;

  if (!auditResult || !auditResult.totals) {
    return { criticalCount: 0, otherCount: 0, brokenInternalLinks: 0, details: [] };
  }

  const counts = auditResult.totals.issueCounts || {};

  for (const [code, count] of Object.entries(counts)) {
    if (code === 'BROKEN_INTERNAL_LINK') {
      brokenInternalLinks = count;
      criticalCount += count;
    } else if (code === 'MISSING_TITLE' || code === 'MISSING_META_DESCRIPTION') {
      // Only critical on rank-intent pages
      // We count all for simplicity, but could filter by page
      // For now, treat as critical if any exist
      if (count > 0) {
        criticalCount += count;
      }
    } else if (CRITICAL_CODES.has(code)) {
      criticalCount += count;
    } else {
      otherCount += count;
    }
  }

  return { criticalCount, otherCount, brokenInternalLinks, details: [] };
}

/**
 * Count thin pages (pages with very low word count).
 *
 * @param {object[]} blogPosts - Blog posts from blog-discovery
 * @param {number} minWords - Minimum word count threshold (default 300)
 * @returns {number}
 */
export function countThinPages(blogPosts = [], minWords = 300) {
  return blogPosts.filter(p => (p.wordCount || 0) < minWords).length;
}

/**
 * Count underlinked pillar pages from link graph.
 *
 * @param {object} linkGraph - Link graph result
 * @param {number} threshold - In-degree below which a pillar is underlinked
 * @returns {number}
 */
export function countUnderlinkedPillars(linkGraph, threshold = 10) {
  if (!linkGraph || !linkGraph.topUnderlinked) return 0;
  return linkGraph.topUnderlinked.filter(p => p.inDegree < threshold).length;
}

function loadScoringConfig() {
  try {
    return JSON.parse(readFileSync(SCORING_CONFIG_PATH, 'utf-8'));
  } catch {
    return {
      weights: {
        gscClicksDelta: 40,
        gscImpressionsDelta: 20,
        gscCtrDelta: 15,
        gscPosDelta: 10,
        techCriticalIssues: -50,
        techOtherIssues: -10,
        brokenInternalLinks: -20,
        orphanPages: -15,
        underlinkedPillars: -10,
        contentThinPages: -10,
        contentNearDuplicates: -10,
      },
    };
  }
}

/**
 * Compute the overall SEO health score.
 *
 * @param {object} inputs
 * @param {object} inputs.gscDeltas - From gsc-deltas.mjs
 * @param {object} inputs.techClassification - From classifyIssues()
 * @param {object} inputs.linkGraph - Link graph result
 * @param {number} inputs.thinCount - From countThinPages()
 * @param {number} inputs.underlinkedPillarCount - From countUnderlinkedPillars()
 * @param {number} inputs.nearDuplicatePairsCount - From near-duplicates auditor
 * @returns {{ score: number, components: object, rationale: object[] }}
 */
export function computeScore({
  gscDeltas = {},
  techClassification = {},
  linkGraph = {},
  thinCount = 0,
  underlinkedPillarCount = 0,
  nearDuplicatePairsCount = 0,
}) {
  const config = loadScoringConfig();
  const w = config.weights;
  const rationale = [];

  let score = 50; // baseline

  // GSC deltas (positive = good)
  // Clicks delta
  const clicksPts = clamp(
    (gscDeltas.clicks7DeltaPct || 0) * w.gscClicksDelta,
    -20, 20,
  );
  score += clicksPts;
  rationale.push({ key: 'gscClicksDelta', value: gscDeltas.clicks7DeltaPct || 0, weightApplied: clicksPts });

  // Impressions delta
  const imprPts = clamp(
    (gscDeltas.impressions7DeltaPct || 0) * w.gscImpressionsDelta,
    -10, 10,
  );
  score += imprPts;
  rationale.push({ key: 'gscImpressionsDelta', value: gscDeltas.impressions7DeltaPct || 0, weightApplied: imprPts });

  // CTR delta
  const ctrPts = clamp(
    (gscDeltas.ctr7DeltaPct || 0) * w.gscCtrDelta,
    -10, 10,
  );
  score += ctrPts;
  rationale.push({ key: 'gscCtrDelta', value: gscDeltas.ctr7DeltaPct || 0, weightApplied: ctrPts });

  // Position delta (negative = improvement, so we negate)
  const posPts = clamp(
    -(gscDeltas.pos7Delta || 0) * w.gscPosDelta,
    -5, 5,
  );
  score += posPts;
  rationale.push({ key: 'gscPosDelta', value: gscDeltas.pos7Delta || 0, weightApplied: posPts });

  // Tech penalties
  const critCount = techClassification.criticalCount || 0;
  const critPts = clamp(
    critCount * (w.techCriticalIssues / 10), // scale: -5 per critical issue, capped
    -25, 0,
  );
  score += critPts;
  rationale.push({ key: 'techCriticalIssues', value: critCount, weightApplied: critPts });

  const otherCount = techClassification.otherCount || 0;
  const otherPts = clamp(
    otherCount * (w.techOtherIssues / 20), // scale: -0.5 per other issue, capped
    -10, 0,
  );
  score += otherPts;
  rationale.push({ key: 'techOtherIssues', value: otherCount, weightApplied: otherPts });

  // Broken internal links
  const brokenPts = clamp(
    (techClassification.brokenInternalLinks || 0) * (w.brokenInternalLinks / 5),
    -10, 0,
  );
  score += brokenPts;
  rationale.push({ key: 'brokenInternalLinks', value: techClassification.brokenInternalLinks || 0, weightApplied: brokenPts });

  // Orphan pages
  const orphanPts = clamp(
    (linkGraph.orphanCount || 0) * (w.orphanPages / 5),
    -10, 0,
  );
  score += orphanPts;
  rationale.push({ key: 'orphanPages', value: linkGraph.orphanCount || 0, weightApplied: orphanPts });

  // Underlinked pillars
  const ulPts = clamp(
    underlinkedPillarCount * (w.underlinkedPillars / 5),
    -10, 0,
  );
  score += ulPts;
  rationale.push({ key: 'underlinkedPillars', value: underlinkedPillarCount, weightApplied: ulPts });

  // Thin pages
  const thinPts = clamp(
    thinCount * (w.contentThinPages / 5),
    -10, 0,
  );
  score += thinPts;
  rationale.push({ key: 'contentThinPages', value: thinCount, weightApplied: thinPts });

  // Near-duplicate pages
  const nearDupWeight = w.contentNearDuplicates || -10;
  const nearDupPts = clamp(
    nearDuplicatePairsCount * (nearDupWeight / 3),
    -10, 0,
  );
  score += nearDupPts;
  rationale.push({ key: 'contentNearDuplicates', value: nearDuplicatePairsCount, weightApplied: nearDupPts });

  // Clamp final score
  score = Math.round(clamp(score, 0, 100));

  const components = {
    gsc: {
      clicks7: gscDeltas.clicks7DeltaPct || 0,
      impressions7: gscDeltas.impressions7DeltaPct || 0,
      ctr7: gscDeltas.ctr7DeltaPct || 0,
      pos7: gscDeltas.pos7Delta || 0,
      insufficientBaseline: gscDeltas.insufficientBaseline || false,
    },
    tech: {
      criticalCount: critCount,
      otherCount: otherCount,
      brokenInternalLinks: techClassification.brokenInternalLinks || 0,
    },
    links: {
      orphanCount: linkGraph.orphanCount || 0,
      underlinkedPillars: underlinkedPillarCount,
    },
    content: {
      thinCount: thinCount,
      nearDuplicatePairsCount: nearDuplicatePairsCount,
    },
  };

  return { score, components, rationale };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
