/**
 * gsc-deltas.mjs
 *
 * Computes GSC metric deltas between the current run and the prior run.
 * Returns percentage changes for clicks, impressions, CTR, and position.
 */

/**
 * Compute GSC deltas from current totals vs prior run totals.
 *
 * @param {object} current - { totals28, totals7 } from current GSC pull
 * @param {object|null} prior - { gsc: { clicks7, impressions7, ctr7, pos7 } } from prior score-history entry
 * @returns {{ clicks7DeltaPct: number, impressions7DeltaPct: number, ctr7DeltaPct: number, pos7Delta: number, insufficientBaseline: boolean }}
 */
export function computeGscDeltas(current, prior) {
  const result = {
    clicks7DeltaPct: 0,
    impressions7DeltaPct: 0,
    ctr7DeltaPct: 0,
    pos7Delta: 0,
    insufficientBaseline: false,
  };

  if (!current || !current.totals7) {
    result.insufficientBaseline = true;
    return result;
  }

  const curr = current.totals7;

  // Extract prior values
  let priorClicks7 = 0;
  let priorImpressions7 = 0;
  let priorCtr7 = 0;
  let priorPos7 = 0;

  if (prior && prior.gsc) {
    priorClicks7 = prior.gsc.clicks7 || 0;
    priorImpressions7 = prior.gsc.impr7 || 0;
    priorCtr7 = prior.gsc.ctr7 || 0;
    priorPos7 = prior.gsc.pos7 || 0;
  } else {
    result.insufficientBaseline = true;
    return result;
  }

  // Guard against small denominators
  const MIN_DENOMINATOR = 10;

  // Clicks delta (percentage)
  if (priorClicks7 >= MIN_DENOMINATOR) {
    result.clicks7DeltaPct = (curr.clicks - priorClicks7) / priorClicks7;
  } else {
    result.clicks7DeltaPct = 0;
  }

  // Impressions delta (percentage)
  if (priorImpressions7 >= MIN_DENOMINATOR) {
    result.impressions7DeltaPct = (curr.impressions - priorImpressions7) / priorImpressions7;
  } else {
    result.impressions7DeltaPct = 0;
  }

  // CTR delta (percentage change, not absolute difference)
  if (priorCtr7 > 0.001) {
    result.ctr7DeltaPct = (curr.ctr - priorCtr7) / priorCtr7;
  } else {
    result.ctr7DeltaPct = 0;
  }

  // Position delta (lower is better, so negative delta = improvement)
  result.pos7Delta = curr.position - priorPos7;

  return result;
}
