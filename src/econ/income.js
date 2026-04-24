import { EPS } from './constants.js';

export function hasTag(unit, tag) {
  return Array.isArray(unit?.tags) && unit.tags.includes(tag);
}

export function normalizeEnv(env = {}) {
  return {
    wind: Number(env.wind ?? 0),
    tidal: Number(env.tidal ?? 0),
    spotValue: Number(env.spotValue ?? env.spot ?? 0),
  };
}

/**
 * Decompose a unit into independent income streams.
 * Variable generators have no hidden output floor — if wind is 0, wind income is 0.
 */
export function getIncomeStreams(unit, env = {}) {
  const e = normalizeEnv(env);
  const metalIncome = unit?.xm != null ? Number(unit.xm) * e.spotValue : 0;

  let energyIncome = 0;
  if (unit?.xm != null) {
    energyIncome = Number(unit.o ?? 0);  // Legion T1 mex bonus energy
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

export function incomeEnergyEquivalent(streams, valueModel) {
  return streams.metalIncome * valueModel.metalToEnergy + streams.energyIncome;
}

export function unitCostEnergyEquivalent(unit, valueModel) {
  return Number(unit?.m ?? 0) * valueModel.metalToEnergy + Number(unit?.e ?? 0);
}

export function unitHasDirectIncome(unit, env, valueModel) {
  const streams = getIncomeStreams(unit, env);
  return incomeEnergyEquivalent(streams, valueModel) > EPS;
}
