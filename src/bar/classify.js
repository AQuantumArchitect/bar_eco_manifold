import { EPS } from '../econ/constants.js';

/**
 * BAR-specific label for a completed evaluation.
 * Checks BAR unit tags ('factory', 'georeq') and income/capacity deltas.
 */
export function classifyEvaluation(evaluation) {
  if (!evaluation.feasible) return 'infeasible';
  const tags = evaluation.unit?.tags ?? [];
  if (evaluation.deltaIncome.energyIncome > EPS || evaluation.deltaIncome.metalIncome > EPS) return 'eco';
  if (evaluation.deltaCapacity.buildPower > EPS) return tags.includes('factory') ? 'factory-bp' : 'build-power';
  if (evaluation.deltaCapacity.metalStorage > EPS || evaluation.deltaCapacity.energyStorage > EPS) return 'storage';
  if (tags.includes('georeq')) return 'geo-transition';
  return evaluation.netHorizonEV >= 0 ? 'strategic' : 'bad';
}
