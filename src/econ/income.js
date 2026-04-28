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

// BAR-specific income logic lives in src/bar/income.js.
// Re-exported here so existing imports in econ/ continue to resolve.
export { getIncomeStreams } from '../bar/income.js';

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
