import { EPS } from './constants.js';
import { makeValueModel } from './defaultValueModel.js';
import { getIncomeStreams } from './income.js';
import { applyCompletedUnitToState, normalizeState } from './state.js';

function normalizeQueue(queue) {
  return queue.map((entry) => {
    if (entry?.unit) return entry.unit;
    return entry;
  }).filter(Boolean);
}

function makeSnapshot(state, extra = {}) {
  return {
    atTime: Number(state.time.toFixed(3)),
    bp: state.buildPower,
    buildPower: state.buildPower,
    mInc: state.metalIncome,
    eInc: state.energyIncome,
    metalIncome: state.metalIncome,
    energyIncome: state.energyIncome,
    metalStored: state.metalStored,
    energyStored: state.energyStored,
    metalStorage: state.metalStorage,
    energyStorage: state.energyStorage,
    ...extra,
  };
}

function accrueIncome(state, dt, totals) {
  const producedM = state.metalIncome * dt;
  const producedE = state.energyIncome * dt;
  totals.grossMetalProduced += producedM;
  totals.grossEnergyProduced += producedE;

  const nextM = state.metalStored + producedM;
  const nextE = state.energyStored + producedE;
  const overflowM = Math.max(0, nextM - state.metalStorage);
  const overflowE = Math.max(0, nextE - state.energyStorage);

  totals.metalOverflow += overflowM;
  totals.energyOverflow += overflowE;
  state.metalStored = Math.min(state.metalStorage, nextM);
  state.energyStored = Math.min(state.energyStorage, nextE);
}

function spendForWork(state, unit, desiredWork) {
  const workTotal = Math.max(EPS, Number(unit.l ?? 0));
  const mPerWork = Number(unit.m ?? 0) / workTotal;
  const ePerWork = Number(unit.e ?? 0) / workTotal;
  const desiredM = mPerWork * desiredWork;
  const desiredE = ePerWork * desiredWork;
  const mFactor = desiredM <= EPS ? 1 : Math.min(1, state.metalStored / desiredM);
  const eFactor = desiredE <= EPS ? 1 : Math.min(1, state.energyStored / desiredE);
  const factor = Math.max(0, Math.min(1, mFactor, eFactor));
  const actualWork = desiredWork * factor;

  state.metalStored = Math.max(0, state.metalStored - desiredM * factor);
  state.energyStored = Math.max(0, state.energyStored - desiredE * factor);

  return {
    actualWork,
    factor,
    metalWanted: desiredM,
    energyWanted: desiredE,
    metalSpent: desiredM * factor,
    energySpent: desiredE * factor,
    metalStalled: factor < 0.999 && mFactor <= eFactor,
    energyStalled: factor < 0.999 && eFactor <= mFactor,
  };
}

/**
 * Simulate sequential construction with continuous resource flow.
 *
 * Income determines whether construction stalls; it never refunds cost.
 */
export function simulateBuildQueue(initialState, queue = [], env = {}, rawValueModel = {}) {
  const valueModel = makeValueModel(rawValueModel);
  const units = normalizeQueue(queue);
  const horizonSeconds = Number(valueModel.horizonSeconds ?? 300);
  const dtBase = Math.max(0.05, Number(valueModel.timeStep ?? 1));
  let state = normalizeState(initialState);

  const totals = {
    grossMetalProduced: 0,
    grossEnergyProduced: 0,
    metalSpent: 0,
    energySpent: 0,
    metalOverflow: 0,
    energyOverflow: 0,
    totalStallTime: 0,
    metalStallSeconds: 0,
    energyStallSeconds: 0,
  };

  const completed = [];
  const timeline = [makeSnapshot(state, { event: 'start' })];
  const econSnapshots = [makeSnapshot(state, { event: 'start' })];
  let hadStall = false;

  for (let queueIndex = 0; queueIndex < units.length && state.time < horizonSeconds - EPS; queueIndex += 1) {
    const unit = units[queueIndex];
    const requiredWork = Math.max(0, Number(unit.l ?? 0));
    let progress = 0;
    const startedAt = state.time;

    timeline.push(makeSnapshot(state, { event: 'start_build', queueIndex, unitKey: unit.key, unitName: unit.name }));

    while (progress < requiredWork - EPS && state.time < horizonSeconds - EPS) {
      const remainingTime = horizonSeconds - state.time;
      const dt = Math.min(dtBase, remainingTime);
      accrueIncome(state, dt, totals);

      const desiredWork = state.buildPower * dt;
      let result;
      if (desiredWork <= EPS || requiredWork <= EPS) {
        result = { actualWork: 0, factor: 0, metalSpent: 0, energySpent: 0, metalStalled: true, energyStalled: true };
      } else {
        result = spendForWork(state, unit, Math.min(desiredWork, requiredWork - progress));
      }

      progress += result.actualWork;
      totals.metalSpent += result.metalSpent;
      totals.energySpent += result.energySpent;

      if (result.factor < 0.999) {
        hadStall = true;
        const stallPart = dt * (1 - result.factor);
        totals.totalStallTime += stallPart;
        if (result.metalStalled) totals.metalStallSeconds += stallPart;
        if (result.energyStalled) totals.energyStallSeconds += stallPart;
      }

      state.time += dt;

      if (timeline.length < 2 || state.time - timeline[timeline.length - 1].atTime >= 1 || progress >= requiredWork - EPS) {
        timeline.push(makeSnapshot(state, {
          event: 'tick',
          queueIndex,
          unitKey: unit.key,
          progress,
          progressFraction: requiredWork <= EPS ? 1 : progress / requiredWork,
        }));
      }
    }

    if (progress >= requiredWork - EPS) {
      const incomeStreams = getIncomeStreams(unit, env);
      state = applyCompletedUnitToState(state, unit, incomeStreams);
      const done = {
        queueIndex,
        unitKey: unit.key,
        unitName: unit.name,
        startedAt,
        completedAt: state.time,
        buildSeconds: state.time - startedAt,
        incomeStreams,
      };
      completed.push(done);
      timeline.push(makeSnapshot(state, { event: 'complete', ...done }));
      econSnapshots.push(makeSnapshot(state, { event: 'complete', ...done }));
    } else {
      timeline.push(makeSnapshot(state, {
        event: 'horizon_reached',
        queueIndex,
        unitKey: unit.key,
        progress,
        progressFraction: requiredWork <= EPS ? 1 : progress / requiredWork,
      }));
      break;
    }
  }

  // Continue accumulating after construction so horizon value captures direct output.
  while (state.time < horizonSeconds - EPS) {
    const dt = Math.min(dtBase, horizonSeconds - state.time);
    accrueIncome(state, dt, totals);
    state.time += dt;
    if (timeline.length < 2 || state.time - timeline[timeline.length - 1].atTime >= 5) {
      timeline.push(makeSnapshot(state, { event: 'coast' }));
    }
  }

  const finalState = normalizeState(state);
  return {
    initialState: normalizeState(initialState),
    finalState,
    completed,
    firstCompletionTime: completed[0]?.completedAt ?? Infinity,
    totalTime: Number(state.time.toFixed(3)),
    finalBP: finalState.buildPower,
    finalPM: finalState.metalIncome,
    finalPE: finalState.energyIncome,
    hadStall,
    ...totals,
    timeline,
    econSnapshots,
  };
}
