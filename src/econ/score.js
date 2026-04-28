import { EPS, finiteOr } from './constants.js';
import { incomeEnergyEquivalent, unitCostEnergyEquivalent } from './income.js';
import { terminalStateValue } from './state.js';

export function simplePaybackSeconds(unit, completionTime, incomeStreams, valueModel) {
  const incomeEV = incomeEnergyEquivalent(incomeStreams, valueModel);
  if (incomeEV <= EPS) return Infinity;
  return finiteOr(completionTime, 0) + unitCostEnergyEquivalent(unit, valueModel) / incomeEV;
}

/**
 * Net realized production: gross income minus overflow (resources that hit the storage cap
 * and were lost). This is the actual resource the economy had access to — no invented penalty,
 * just the correct measurement of what the simulation produced.
 */
export function realizedProductionDeltaEV(candidateSim, baselineSim, valueModel) {
  const candidateNetM = candidateSim.grossMetalProduced - candidateSim.metalOverflow;
  const candidateNetE = candidateSim.grossEnergyProduced - candidateSim.energyOverflow;
  const baselineNetM = baselineSim.grossMetalProduced - baselineSim.metalOverflow;
  const baselineNetE = baselineSim.grossEnergyProduced - baselineSim.energyOverflow;
  return (candidateNetM - baselineNetM) * valueModel.metalToEnergy + (candidateNetE - baselineNetE);
}

export function terminalDeltaEV(candidateSim, baselineSim, valueModel) {
  return terminalStateValue(candidateSim.finalState, valueModel) - terminalStateValue(baselineSim.finalState, valueModel);
}

/**
 * Net horizon EV: how much better off are you at the planning horizon if you build this unit now?
 * = (net production delta) + (terminal state delta) - (cost)
 *
 * Stalling and overflow are already captured naturally by the simulation:
 * stalling → slower completion → less production during horizon;
 * overflow → resources don't enter the pool → reduced net production.
 * No extra penalty terms are applied on top of what the simulation already models.
 */
export function netHorizonEV(unit, candidateSim, baselineSim, valueModel) {
  const costEV = unitCostEnergyEquivalent(unit, valueModel);
  const productionEV = realizedProductionDeltaEV(candidateSim, baselineSim, valueModel);
  const terminalEV = terminalDeltaEV(candidateSim, baselineSim, valueModel);
  return productionEV + terminalEV - costEV;
}

// BAR-specific classification lives in src/bar/classify.js.
// Re-exported here so existing imports in econ/ continue to resolve.
export { classifyEvaluation } from '../bar/classify.js';

export function metricValue(evaluation, metric = 'netHorizonEV') {
  switch (metric) {
    case 'netHorizonEV':         return evaluation.netHorizonEV;
    case 'simplePaybackSeconds': return evaluation.simplePaybackSeconds;
    case 'completionTime':       return evaluation.completionTime;
    case 'stallSeconds':         return evaluation.stallSeconds;
    case 'metalStallSeconds':    return evaluation.metalStallSeconds;
    case 'energyStallSeconds':   return evaluation.energyStallSeconds;
    case 'incomeEV':             return evaluation.deltaIncomeEV;
    case 'buildPowerGain':       return evaluation.deltaCapacity.buildPower;
    case 'score':                return evaluation.score;
    default:                     return evaluation[metric];
  }
}

export function compareEvaluations(metric = 'netHorizonEV') {
  const lowerIsBetter = ['simplePaybackSeconds', 'completionTime', 'stallSeconds', 'metalStallSeconds', 'energyStallSeconds'];
  return (a, b) => {
    const av = metricValue(a, metric);
    const bv = metricValue(b, metric);
    if (lowerIsBetter.includes(metric)) return finiteOr(av) - finiteOr(bv);
    return finiteOr(bv, -Infinity) - finiteOr(av, -Infinity);
  };
}
