import { EPS } from './constants.js';

function seconds(n) {
  if (!Number.isFinite(n)) return 'infinite';
  if (n >= 3600) return `${(n / 3600).toFixed(1)}h`;
  if (n >= 60) return `${(n / 60).toFixed(1)}m`;
  return `${n.toFixed(1)}s`;
}

function signed(n, suffix = '') {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Math.round(n).toLocaleString()}${suffix}`;
}

export function explainEvaluation(ev) {
  const reasons = [];

  if (!ev.feasible) {
    reasons.push(`Does not complete within the ${seconds(ev.valueModel.horizonSeconds)} horizon.`);
  } else {
    reasons.push(`Completes in ${seconds(ev.completionTime)} under current BP and resource flow.`);
  }

  if (ev.deltaIncome.metalIncome > EPS || ev.deltaIncome.energyIncome > EPS) {
    reasons.push(`Adds ${ev.deltaIncome.metalIncome.toFixed(2)} M/s and ${ev.deltaIncome.energyIncome.toFixed(1)} E/s.`);
  }

  if (ev.deltaCapacity.buildPower > EPS) {
    reasons.push(`Adds ${ev.deltaCapacity.buildPower.toFixed(0)} BP; this is option value, not direct income.`);
  }

  if (ev.deltaCapacity.metalStorage > EPS || ev.deltaCapacity.energyStorage > EPS) {
    reasons.push(`Adds ${ev.deltaCapacity.metalStorage.toFixed(0)} M storage and ${ev.deltaCapacity.energyStorage.toFixed(0)} E storage.`);
  }

  if (ev.stallSeconds > EPS) {
    reasons.push(`Construction stalls for ${seconds(ev.stallSeconds)} (${seconds(ev.metalStallSeconds)} metal, ${seconds(ev.energyStallSeconds)} energy).`);
  }

  if (!Number.isFinite(ev.simplePaybackSeconds)) {
    reasons.push('Simple payback is infinite: no direct resource income under current map conditions.');
  } else {
    reasons.push(`Simple payback is ${seconds(ev.simplePaybackSeconds)} using full cost.`);
  }

  reasons.push(`Net horizon value: ${signed(ev.netHorizonEV, ' EV')}.`);

  return reasons;
}
