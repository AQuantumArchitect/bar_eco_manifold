import { makeValueModel } from './defaultValueModel.js';
import { getIncomeStreams, incomeEnergyEquivalent, unitCostEnergyEquivalent } from './income.js';
import { simulateBuildQueue } from './simulateBuildQueue.js';
import { netHorizonEV, simplePaybackSeconds, classifyEvaluation } from './score.js';
import { explainEvaluation } from './explain.js';

export function evaluateCandidate(unit, initialState, env = {}, rawValueModel = {}) {
  const valueModel = makeValueModel(rawValueModel);
  const baseline = simulateBuildQueue(initialState, [], env, valueModel);
  const candidate = simulateBuildQueue(initialState, [unit], env, valueModel);
  const completed = candidate.completed.find((c) => c.unitKey === unit.key || c.unitName === unit.name) ?? candidate.completed[0];
  const deltaIncome = getIncomeStreams(unit, env);
  const completionTime = completed?.completedAt ?? Infinity;
  const deltaCapacity = {
    buildPower: Number(unit?.bp ?? 0),
    metalStorage: Number(unit?.mStore ?? 0),
    energyStorage: Number(unit?.eStore ?? 0),
  };

  const ev = {
    unit,
    unitKey: unit.key,
    unitName: unit.name,
    valueModel,
    feasible: Boolean(completed),
    completionTime,
    buildSeconds: completed?.buildSeconds ?? Infinity,
    stallSeconds: candidate.totalStallTime,
    metalStallSeconds: candidate.metalStallSeconds,
    energyStallSeconds: candidate.energyStallSeconds,
    costEV: unitCostEnergyEquivalent(unit, valueModel),
    deltaIncome,
    deltaIncomeEV: incomeEnergyEquivalent(deltaIncome, valueModel),
    deltaCapacity,
    simplePaybackSeconds: simplePaybackSeconds(unit, completionTime, deltaIncome, valueModel),
    netHorizonEV: netHorizonEV(unit, candidate, baseline, valueModel),
    baselineSimulation: baseline,
    candidateSimulation: candidate,
  };

  ev.score = ev.netHorizonEV;
  ev.label = classifyEvaluation(ev);
  ev.reasons = explainEvaluation(ev);
  return ev;
}

export function evaluateCandidates(unitsByKey, activeKeys, initialState, env = {}, rawValueModel = {}, metric = 'netHorizonEV') {
  const keys = activeKeys ?? Object.keys(unitsByKey);
  return keys
    .map((key) => evaluateCandidate({ key, ...unitsByKey[key] }, initialState, env, rawValueModel))
    .sort((a, b) => {
      if (metric === 'simplePaybackSeconds' || metric === 'completionTime') return a[metric] - b[metric];
      return (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity);
    });
}
