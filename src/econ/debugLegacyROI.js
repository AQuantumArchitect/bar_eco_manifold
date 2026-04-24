import { EPS } from './constants.js';
import { makeValueModel } from './defaultValueModel.js';
import { getIncomeStreams, incomeEnergyEquivalent, unitCostEnergyEquivalent } from './income.js';

/**
 * Reproduces the old economy-ROI bug for comparison panels.
 * The bug: background income during construction is subtracted from cost,
 * making high-income builds falsely appear to pay back in ~build time.
 */
export function legacyEconomyROI(unit, env, buildPower, metalIncome, energyIncome, options = {}) {
  const minBP = Number(options.minBP ?? 80);
  const metalToEnergy = Number(options.metalToEnergy ?? 70);
  const nomBP = Math.max(minBP, buildPower);
  const streams = getIncomeStreams(unit, env);
  const sustM = unit.m > 0 && metalIncome > 0 ? metalIncome * unit.l / unit.m : (unit.m > 0 ? minBP : nomBP);
  const sustE = unit.e > 0 && energyIncome > 0 ? energyIncome * unit.l / unit.e : (unit.e > 0 ? minBP : nomBP);
  const effBP = Math.max(minBP, Math.min(nomBP, sustM, sustE));
  const buildT = unit.l / effBP;
  const netM = Math.max(0, unit.m - metalIncome * buildT);
  const netE = Math.max(0, unit.e - energyIncome * buildT);
  const income = streams.metalIncome * metalToEnergy + streams.energyIncome;
  return income < 0.01 ? Infinity : buildT + (netM * metalToEnergy + netE) / income;
}

/**
 * Correct simple ROI: income determines if construction stalls; cost remains full cost.
 */
export function correctedSimpleROI(unit, env, buildPower, rawValueModel = {}) {
  const valueModel = makeValueModel(rawValueModel);
  const bp = Math.max(EPS, Number(buildPower ?? 0));
  const buildT = Number(unit.l ?? 0) / bp;
  const streams = getIncomeStreams(unit, env);
  const incomeEV = incomeEnergyEquivalent(streams, valueModel);
  if (incomeEV <= EPS) return Infinity;
  return buildT + unitCostEnergyEquivalent(unit, valueModel) / incomeEV;
}

export function describeLegacyBug(unit, env, buildPower, metalIncome, energyIncome, valueModel = {}) {
  const oldROI = legacyEconomyROI(unit, env, buildPower, metalIncome, energyIncome, valueModel);
  const newROI = correctedSimpleROI(unit, env, buildPower, valueModel);
  return {
    unitKey: unit.key,
    oldROI,
    newROI,
    ratio: Number.isFinite(oldROI) && oldROI > 0 ? newROI / oldROI : Infinity,
    message: 'Legacy economy ROI subtracts background income during construction from full cost; corrected ROI does not.',
  };
}
