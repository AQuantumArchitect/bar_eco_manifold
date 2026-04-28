import { normalizeEnv, hasTag } from '../econ/income.js';

/**
 * BAR-specific income decomposition.
 * Reads unit fields: xm (metal extractor ratio), o (fixed output).
 * Reads BAR tags: 'variable' (wind/tidal generator), 'naval' (tidal vs wind).
 */
export function getIncomeStreams(unit, env = {}) {
  const e = normalizeEnv(env);
  const metalIncome = unit?.xm != null ? Number(unit.xm) * e.spotValue : 0;

  let energyIncome = 0;
  if (unit?.xm != null) {
    energyIncome = Number(unit.o ?? 0);
  } else if (hasTag(unit, 'variable')) {
    energyIncome = hasTag(unit, 'naval') ? e.tidal : e.wind;
  } else {
    energyIncome = Number(unit?.o ?? 0);
  }

  return {
    metalIncome: Math.max(0, metalIncome),
    energyIncome: Math.max(0, energyIncome),
  };
}
