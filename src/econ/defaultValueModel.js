import { DEFAULT_HORIZON_SECONDS, DEFAULT_M_TO_E, DEFAULT_TIME_STEP } from './constants.js';

export const DEFAULT_VALUE_MODEL = Object.freeze({
  metalToEnergy: DEFAULT_M_TO_E,
  horizonSeconds: DEFAULT_HORIZON_SECONDS,
  timeStep: DEFAULT_TIME_STEP,

  // After the visible horizon ends, how much should persistent income/capacity be worth?
  terminalIncomeSeconds: 120,
  terminalStoredResourceWeight: 1.0,
  terminalStorageFillValue: 0.02,

  // Build power has no direct resource income, but has option value in RTS.
  // Set to 0 if you want to exclude BP from scoring.
  buildPowerEnergyValuePerBP: 5,

  // Must a build complete inside the horizon to count as feasible?
  requireCompletionForPayback: true,
});

export function makeValueModel(overrides = {}) {
  return { ...DEFAULT_VALUE_MODEL, ...overrides };
}
