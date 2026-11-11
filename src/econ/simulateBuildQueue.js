import { EPS } from './constants.js';
import { makeValueModel } from './defaultValueModel.js';
import { getIncomeStreams } from './income.js';
import { applyCompletedUnitToState, normalizeState } from './state.js';
import { BAR_MOBILITY, MOBILITY_BY_ID } from '../data/barMobility.js';
import { supremeIsthmus, transitSeconds } from '../maps/index.js';

const HOME = 'home';

/**
 * Fraction of a finished structure's metal cost returned by reclaiming it.
 * BAR gamedata/modrules.lua (master), `reclaim` table: `unitEfficiency = 1`,
 * i.e. 100% of the unit's metal.
 * https://github.com/beyond-all-reason/Beyond-All-Reason/blob/master/gamedata/modrules.lua
 * Energy is deliberately never returned by this model.
 */
export const RECLAIM_METAL_FRACTION = 1;

/**
 * BAR gamedata/modrules.lua (master), `reclaim` table: `unitMethod = 1`, "all reclaimed
 * at end" - a reclaimed unit's metal comes back in one lump when the reclaim completes,
 * not gradually. https://github.com/beyond-all-reason/Beyond-All-Reason/blob/master/gamedata/modrules.lua
 */
export const RECLAIM_UNIT_METHOD = 1;

/**
 * Queue entries:
 *   unit                                   build at home (legacy)
 *   { unit }                               build at home (legacy)
 *   { type: 'build', unit, at }            build at a location; waits for a constructor there
 *   { type: 'move', unit, count?, from, to, path?, pathFactor? }
 *                                          build `count` units (one after another), each
 *                                          departs on completion and arrives after transit
 *   { type: 'reclaim', unit, at? }         remove one finished `unit` at a location; its metal
 *                                          (RECLAIM_METAL_FRACTION, no energy) returns in one lump
 *                                          when the reclaim completes (RECLAIM_UNIT_METHOD); the
 *                                          work takes the remaining constructors' build power
 * A location is a name ('home', a map seat such as 'P4', a waypoint, env.locations key)
 * or an {x, z} point.
 */
function normalizeQueue(queue) {
  const steps = [];
  for (const entry of queue) {
    if (!entry) continue;
    if (entry.type === 'move' && entry.unit) {
      const count = Math.max(1, Math.floor(Number(entry.count ?? 1)));
      for (let i = 0; i < count; i += 1) steps.push({ unit: entry.unit, move: entry });
    } else if (entry.type === 'reclaim' && entry.unit) {
      steps.push({ unit: entry.unit, at: entry.at, reclaim: true });
    } else if (entry.type === 'build' && entry.unit) {
      steps.push({ unit: entry.unit, at: entry.at });
    } else {
      steps.push({ unit: entry.unit ?? entry });
    }
  }
  return steps;
}

function locKey(loc) {
  if (loc == null) return HOME;
  if (typeof loc === 'string') return loc;
  return `${loc.x},${loc.z}`;
}

function makeLocator(env) {
  const map = env.map ?? supremeIsthmus;
  return (loc) => {
    if (loc && typeof loc === 'object') return { x: Number(loc.x), z: Number(loc.z) };
    const hit = env.locations?.[loc] ?? map.waypoints?.[loc] ?? map.seats?.[loc];
    if (!hit) throw new RangeError(`Unknown location: ${String(loc)}`);
    return { x: hit.x, z: hit.z };
  };
}

function unitSpeed(unit) {
  const speed = unit.speed
    ?? BAR_MOBILITY[unit.key]?.speed
    ?? MOBILITY_BY_ID[unit.id ?? unit.key]?.speed;
  if (!(speed > 0)) throw new RangeError(`Unit ${unit.key ?? unit.name} has no movement speed`);
  return speed;
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
  const steps = normalizeQueue(queue);
  const locate = makeLocator(env);
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
    metalReclaimed: 0,
  };

  const completed = [];
  const timeline = [];
  const econSnapshots = [];
  let hadStall = false;

  // Per-location tracking. Build power only counts where the constructors are.
  timeline.push(makeSnapshot(state, { event: 'start', units: {}, inTransit: [] }));
  econSnapshots.push(makeSnapshot(state, { event: 'start', units: {}, inTransit: [] }));
  const bpAt = { [HOME]: state.buildPower };
  const unitsAt = {};
  const inTransit = [];
  const events = [];
  const totalBP = () => Object.values(bpAt).reduce((a, b) => a + b, 0);
  const addUnit = (loc, unit) => {
    unitsAt[loc] ??= {};
    unitsAt[loc][unit.key] = (unitsAt[loc][unit.key] ?? 0) + 1;
    bpAt[loc] = (bpAt[loc] ?? 0) + Number(unit.bp ?? 0);
    state.buildPower = totalBP();
  };
  const emit = (type, data) => {
    const ev = { type, t: Number(state.time.toFixed(3)), ...data };
    events.push(ev);
    return ev;
  };
  const snap = (extra) => makeSnapshot(state, {
    ...extra,
    units: Object.fromEntries(Object.entries(unitsAt).map(([k, v]) => [k, { ...v }])),
    inTransit: inTransit.map((u) => ({ ...u })),
  });
  const processArrivals = () => {
    for (let i = inTransit.length - 1; i >= 0; i -= 1) {
      if (inTransit[i].arriveAt > state.time + EPS) continue;
      const [t] = inTransit.splice(i, 1);
      addUnit(t.to, t.unit);
      emit('arrive', { unitKey: t.unitKey, from: t.from, to: t.to, departedAt: t.departedAt });
      timeline.push(snap({ event: 'arrive', unitKey: t.unitKey, at: t.to }));
    }
  };
  // Largest step that does not overshoot the next arrival.
  const stepTo = (dt) => {
    let next = dt;
    for (const t of inTransit) {
      const wait = t.arriveAt - state.time;
      if (wait > EPS) next = Math.min(next, wait);
    }
    return next;
  };

  for (let queueIndex = 0; queueIndex < steps.length && state.time < horizonSeconds - EPS; queueIndex += 1) {
    const { unit, move, reclaim } = steps[queueIndex];
    const at = locKey(steps[queueIndex].at);

    if (reclaim) {
      if (!(unitsAt[at]?.[unit.key] > 0)) {
        emit('reclaim_skipped', { queueIndex, unitKey: unit.key, at });
        continue;
      }
      // The structure stops producing and building the moment reclaim starts.
      const streams = getIncomeStreams(unit, env);
      unitsAt[at][unit.key] -= 1;
      bpAt[at] = Math.max(0, (bpAt[at] ?? 0) - Number(unit.bp ?? 0));
      state.metalIncome = Math.max(0, state.metalIncome - streams.metalIncome);
      state.energyIncome = Math.max(0, state.energyIncome - streams.energyIncome);
      state.metalStorage = Math.max(0, state.metalStorage - Number(unit.mStore ?? 0));
      state.energyStorage = Math.max(0, state.energyStorage - Number(unit.eStore ?? 0));
      state.metalStored = Math.min(state.metalStored, state.metalStorage);
      state.energyStored = Math.min(state.energyStored, state.energyStorage);
      state.buildPower = totalBP();
      emit('reclaim_start', { queueIndex, unitKey: unit.key, at });
      timeline.push(snap({ event: 'reclaim_start', queueIndex, unitKey: unit.key, at }));

      const requiredWork = Math.max(EPS, Number(unit.l ?? 0));
      const metalTotal = Number(unit.m ?? 0) * RECLAIM_METAL_FRACTION;
      let done = 0;
      while (done < requiredWork - EPS && state.time < horizonSeconds - EPS) {
        processArrivals();
        const dt = stepTo(Math.min(dtBase, horizonSeconds - state.time));
        accrueIncome(state, dt, totals);
        const work = Math.min((bpAt[at] ?? 0) * dt, requiredWork - done);
        if (work > 0) {
          done += work;
        }
        state.time += dt;
      }
      // unitMethod 1: metal is only returned on completion. If the horizon arrives
      // first, nothing is returned.
      if (done >= requiredWork - EPS) {
        const next = state.metalStored + metalTotal;
        totals.metalOverflow += Math.max(0, next - state.metalStorage);
        state.metalStored = Math.min(state.metalStorage, next);
        totals.metalReclaimed += metalTotal;
        emit('reclaim_complete', { queueIndex, unitKey: unit.key, at, metal: metalTotal });
        timeline.push(snap({ event: 'reclaim_complete', queueIndex, unitKey: unit.key, at }));
        econSnapshots.push(snap({ event: 'reclaim_complete', queueIndex, unitKey: unit.key, at }));
      } else {
        timeline.push(snap({ event: 'horizon_reached', queueIndex, unitKey: unit.key }));
        break;
      }
      continue;
    }
    const requiredWork = Math.max(0, Number(unit.l ?? 0));
    let progress = 0;

    // A build at a location only starts once a constructor is there.
    if (at !== HOME && (bpAt[at] ?? 0) <= EPS) {
      emit('wait_for_constructor', { queueIndex, unitKey: unit.key, at });
      while ((bpAt[at] ?? 0) <= EPS && state.time < horizonSeconds - EPS) {
        processArrivals();
        if ((bpAt[at] ?? 0) > EPS) break;
        const dt = stepTo(Math.min(dtBase, horizonSeconds - state.time));
        accrueIncome(state, dt, totals);
        state.time += dt;
      }
      if ((bpAt[at] ?? 0) <= EPS) {
        timeline.push(snap({ event: 'horizon_reached', queueIndex, unitKey: unit.key, progress: 0, progressFraction: 0 }));
        break;
      }
    }
    const startedAt = state.time;

    timeline.push(snap({ event: 'start_build', queueIndex, unitKey: unit.key, unitName: unit.name, at }));

    while (progress < requiredWork - EPS && state.time < horizonSeconds - EPS) {
      processArrivals();
      const remainingTime = horizonSeconds - state.time;
      const dt = stepTo(Math.min(dtBase, remainingTime));
      accrueIncome(state, dt, totals);

      const desiredWork = (bpAt[at] ?? 0) * dt;
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
        timeline.push(snap({
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
      // Build power is tracked per location; addUnit/arrival restore it.
      state = applyCompletedUnitToState(state, { ...unit, bp: 0 }, incomeStreams);
      state.buildPower = totalBP();
      const done = {
        queueIndex,
        unitKey: unit.key,
        unitName: unit.name,
        startedAt,
        completedAt: state.time,
        buildSeconds: state.time - startedAt,
        incomeStreams,
        at,
      };
      completed.push(done);
      emit('complete', { queueIndex, unitKey: unit.key, at });
      if (move) {
        const from = move.from ?? HOME;
        const points = [from, ...(move.path ?? []), move.to].map(locate);
        const seconds = transitSeconds(points, unitSpeed(unit), move.pathFactor ?? 1);
        const trip = {
          unit,
          unitKey: unit.key,
          from: locKey(from),
          to: locKey(move.to),
          departedAt: state.time,
          arriveAt: state.time + seconds,
          transitSeconds: seconds,
        };
        inTransit.push(trip);
        emit('depart', { unitKey: trip.unitKey, from: trip.from, to: trip.to, transitSeconds: seconds, arriveAt: Number(trip.arriveAt.toFixed(3)) });
      } else {
        addUnit(at, unit);
      }
      timeline.push(snap({ event: 'complete', ...done }));
      econSnapshots.push(snap({ event: 'complete', ...done }));
    } else {
      timeline.push(snap({
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
    processArrivals();
    const dt = stepTo(Math.min(dtBase, horizonSeconds - state.time));
    accrueIncome(state, dt, totals);
    state.time += dt;
    processArrivals();
    if (timeline.length < 2 || state.time - timeline[timeline.length - 1].atTime >= 5) {
      timeline.push(snap({ event: 'coast' }));
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
    finalUnits: unitsAt,
    inTransit,
    events,
    timeline,
    econSnapshots,
  };
}
