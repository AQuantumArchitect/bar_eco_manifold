import { BAR_STATS } from '../data/barStats.js';
import { evaluateCandidate } from '../econ/evaluateCandidate.js';
import { metricValue, compareEvaluations } from '../econ/score.js';
import { computeROI } from './computeROI.js';
import { classifyEvaluation } from './classify.js';
import { getIncomeStreams } from './income.js';

/**
 * Axis definitions for the BAR parameter space.
 * Extend this to add new sliceable dimensions.
 */
export const BAR_AXES = {
  bp:    { key: 'bp',    label: 'Build Power (BP)',  range: [80, 40000],     scale: 'log',    fmt: v => v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v) },
  wind:  { key: 'wind',  label: 'Wind Speed (m/s)',  range: [0, 20],         scale: 'linear', fmt: v => v.toFixed(0) },
  tidal: { key: 'tidal', label: 'Tidal Speed (m/s)', range: [0, 30],         scale: 'linear', fmt: v => v.toFixed(0) },
  spot:  { key: 'spot',  label: 'Metal Spot (M/s)',  range: [0, 10],         scale: 'linear', fmt: v => v.toFixed(1) },
  mInc:  { key: 'mInc',  label: 'M-Income (M/s)',    range: [0.1, 1000],     scale: 'log',    fmt: v => v >= 10 ? Math.round(v)+'M/s' : v.toFixed(1) },
  eInc:  { key: 'eInc',  label: 'E-Income (E/s)',    range: [1, 100000],     scale: 'log',    fmt: v => v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v) },
  queue: { key: 'queue', label: 'Queue Time (s)',     range: [0, 1],          scale: 'linear', fmt: v => Math.round(v)+'s' },
  time:  { key: 'time',  label: 'Game Time (s)',      range: [0, 1800],       scale: 'linear', fmt: v => Math.round(v)+'s' },
};

/**
 * Create a BAR manifold driver.
 *
 * @param {Object} env         - { wind, tidal, spotValue }
 * @param {Object} valueModel  - { metalToEnergy, horizonSeconds }
 * @returns {import('../manifold/types.js').Manifold}
 */
export function createBarManifold(env, valueModel) {
  return {
    axes: BAR_AXES,

    evaluateFast(unit, wind, tidal, spotValue, bp, roiFrame, mInc, eInc) {
      return computeROI(unit, wind, tidal, spotValue, bp, roiFrame, mInc, eInc);
    },

    evaluateFull(unit, state, envOverride) {
      return evaluateCandidate(unit, state, envOverride ?? env, valueModel);
    },

    encode: {
      getColor:  (result) => BAR_STATS[result?.unitKey]?.hex ?? '#6366f1',
      getMetric: (result, key) => metricValue(result, key),
      getLabel:  (result) => classifyEvaluation(result),
      getRank:   (results) => [...results].sort(compareEvaluations('simplePaybackSeconds')),
    },

    getIncomeStreams: (unit, envOverride) => getIncomeStreams(unit, envOverride ?? env),

    unitsByKey: BAR_STATS,
  };
}
