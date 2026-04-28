import { getIncomeStreams } from './income.js';

const M_TO_E = 70;

/**
 * Fast analytical ROI for live chart rendering.
 * Four frames: unified (platonic), energy-only, metal-only, economy (income-capped BP).
 * Does not simulate stalls or overflow — use evaluateCandidate for accuracy.
 */
export function computeROI(s, wind, tidal, spotValue, bp, roiFrame, mInc = 0, eInc = 0) {
  const nomBP = Math.max(1, bp);
  const { metalIncome, energyIncome } = getIncomeStreams(s, { wind, tidal, spotValue });

  if (roiFrame === 'economy') {
    const sustM  = (s.m > 0 && mInc > 0) ? mInc * s.l / s.m : nomBP;
    const sustE  = (s.e > 0 && eInc > 0) ? eInc * s.l / s.e : nomBP;
    const effBP  = Math.max(1, Math.min(nomBP, sustM, sustE));
    const buildT = s.l / effBP;
    const income = metalIncome * M_TO_E + energyIncome;
    return income < 0.01 ? Infinity : buildT + (s.m * M_TO_E + s.e) / income;
  }

  const buildT = s.l / nomBP;
  switch (roiFrame) {
    case 'unified': {
      const income = metalIncome * M_TO_E + energyIncome;
      return income < 0.01 ? Infinity : buildT + (s.m * M_TO_E + s.e) / income;
    }
    case 'energy':
      return energyIncome < 0.01 ? Infinity : buildT + s.e / energyIncome;
    case 'metal':
      return metalIncome < 0.01 ? Infinity : buildT + s.m / metalIncome;
    default: return Infinity;
  }
}
