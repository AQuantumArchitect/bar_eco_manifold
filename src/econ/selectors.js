import { evaluateCandidates } from './evaluateCandidate.js';
import { compareEvaluations } from './score.js';
import { sampleBestCandidateSurface, sampleUnitSurface } from './continuousManifold.js';

export function getRankedCandidates({ unitsByKey, activeKeys, state, env, valueModel, metric = 'netHorizonEV' }) {
  return evaluateCandidates(unitsByKey, activeKeys, state, env, valueModel, metric).sort(compareEvaluations(metric));
}

export function getTopCandidates(args, limit = 12) {
  return getRankedCandidates(args).slice(0, limit);
}

export function getUnitManifold(args) {
  return sampleUnitSurface(args);
}

export function getBestCandidateManifold(args) {
  return sampleBestCandidateSurface(args);
}

export function summarizeCandidate(ev) {
  return {
    key: ev.unitKey,
    name: ev.unitName,
    label: ev.label,
    feasible: ev.feasible,
    completionTime: ev.completionTime,
    simplePaybackSeconds: ev.simplePaybackSeconds,
    netHorizonEV: ev.netHorizonEV,
    stallSeconds: ev.stallSeconds,
    deltaIncome: ev.deltaIncome,
    deltaCapacity: ev.deltaCapacity,
    reasons: ev.reasons,
  };
}
