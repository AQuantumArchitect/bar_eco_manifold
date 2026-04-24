import { clamp } from './constants.js';

export function normalizeState(state = {}) {
  const metalStorage = Math.max(0, Number(state.metalStorage ?? state.mStore ?? 1000));
  const energyStorage = Math.max(0, Number(state.energyStorage ?? state.eStore ?? 1000));

  return {
    time: Number(state.time ?? 0),
    buildPower: Math.max(0, Number(state.buildPower ?? state.bp ?? 0)),
    metalIncome: Math.max(0, Number(state.metalIncome ?? state.mInc ?? 0)),
    energyIncome: Math.max(0, Number(state.energyIncome ?? state.eInc ?? 0)),
    metalStored: clamp(Number(state.metalStored ?? state.metal ?? metalStorage), 0, metalStorage),
    energyStored: clamp(Number(state.energyStored ?? state.energy ?? energyStorage), 0, energyStorage),
    metalStorage,
    energyStorage,
  };
}

export function cloneState(state) {
  return { ...normalizeState(state) };
}

export function applyCompletedUnitToState(state, unit, incomeStreams) {
  const next = { ...state };
  next.metalIncome += incomeStreams.metalIncome;
  next.energyIncome += incomeStreams.energyIncome;
  next.buildPower += Number(unit?.bp ?? 0);
  next.metalStorage += Number(unit?.mStore ?? 0);
  next.energyStorage += Number(unit?.eStore ?? 0);
  next.metalStored = Math.min(next.metalStored, next.metalStorage);
  next.energyStored = Math.min(next.energyStored, next.energyStorage);
  return next;
}

export function stateEnergyEquivalent(state, valueModel) {
  const s = normalizeState(state);
  return s.metalStored * valueModel.metalToEnergy + s.energyStored;
}

export function terminalStateValue(state, valueModel) {
  const s = normalizeState(state);
  const storedValue = stateEnergyEquivalent(s, valueModel) * valueModel.terminalStoredResourceWeight;
  const incomeValue =
    (s.metalIncome * valueModel.metalToEnergy + s.energyIncome) * valueModel.terminalIncomeSeconds;
  const bpValue = s.buildPower * valueModel.buildPowerEnergyValuePerBP;
  const storageOptionValue =
    (s.metalStorage * valueModel.metalToEnergy + s.energyStorage) * valueModel.terminalStorageFillValue;
  return storedValue + incomeValue + bpValue + storageOptionValue;
}
