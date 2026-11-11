import assert from 'node:assert/strict';
import test from 'node:test';
import {
  correctedSimpleROI,
  evaluateCandidate,
  getIncomeStreams,
  legacyEconomyROI,
  makeValueModel,
  RECLAIM_METAL_FRACTION,
  sampleBestCandidateSurface,
  simulateBuildQueue,
} from '../src/econ/index.js';

const Wind  = { key: 'Wind',  name: 'Arm. Wind Turbine',    m: 40,  e: 175,  l: 1600,  tags: ['t1', 'land', 'variable', 'armada'] };
const Solar = { key: 'Solar', name: 'Arm. Solar Collector', m: 155, e: 0,    l: 2600,  o: 20, tags: ['t1', 'land', 'armada'] };
const ConK  = { key: 'ConK',  name: 'Arm. Con. Kbot',       m: 110, e: 1600, l: 3450,  bp: 80, tags: ['t1', 'land', 'constructor', 'armada'] };
const units = { Wind, Solar, ConK };

const richState = {
  buildPower: 300,
  metalIncome: 1000,
  energyIncome: 100000,
  metalStored: 50000,
  energyStored: 1000000,
  metalStorage: 50000,
  energyStorage: 1000000,
};

test('variable wind has no hidden floor at zero wind', () => {
  const streams = getIncomeStreams(Wind, { wind: 0, tidal: 20, spotValue: 2 });
  assert.equal(streams.energyIncome, 0);
});

test('corrected ROI is infinite for zero-output wind', () => {
  const roi = correctedSimpleROI(Wind, { wind: 0, tidal: 20, spotValue: 2 }, 300, makeValueModel());
  assert.equal(roi, Infinity);
});

test('legacy economy ROI falsely collapses to build time at high income', () => {
  const roi = legacyEconomyROI(Wind, { wind: 1, tidal: 20, spotValue: 2 }, 300, 1000, 100000);
  assert.ok(roi < 10, `legacy ROI should collapse toward build time; got ${roi}`);

  const corrected = correctedSimpleROI(Wind, { wind: 1, tidal: 20, spotValue: 2 }, 300);
  assert.ok(corrected > 2900, `corrected ROI should include full cost; got ${corrected}`);
});

test('candidate evaluation preserves full investment cost under high income', () => {
  const ev = evaluateCandidate(Wind, richState, { wind: 1, tidal: 20, spotValue: 2 }, { horizonSeconds: 300 });
  assert.ok(ev.simplePaybackSeconds > 2900);
  assert.ok(ev.completionTime < 10);
});

test('simulator applies completed-unit income and build power effects', () => {
  const sim = simulateBuildQueue(
    { ...richState, buildPower: 100 },
    [Solar, ConK],
    { wind: 10, tidal: 20, spotValue: 2 },
    { horizonSeconds: 120, timeStep: 1 },
  );
  assert.equal(sim.completed.length, 2);
  assert.ok(sim.finalPE >= richState.energyIncome + 20);
  assert.ok(sim.finalBP >= 180);
});

test('continuous manifold returns a complete grid', () => {
  const surface = sampleBestCandidateSurface({
    unitsByKey: units,
    activeKeys: ['Wind', 'Solar'],
    initialState: richState,
    env: { wind: 5, tidal: 20, spotValue: 2 },
    valueModel: { horizonSeconds: 120 },
    xAxis: 'wind',
    yAxis: 'buildPower',
    resolution: 8,
    metric: 'simplePaybackSeconds',
  });
  assert.equal(surface.rows.length, 9);
  assert.equal(surface.rows[0].length, 9);
  assert.equal(surface.vertices.length, 81);
  assert.ok(surface.indices.length > 0);
});

// --- movement: move / build-at-location steps ---
const Turtle = { key: 'armcroc', id: 'armcroc', name: 'Turtle', m: 750, e: 15000, l: 21000, bp: 0 };
const Beaver = { key: 'armbeaver', id: 'armbeaver', name: 'Beaver', m: 150, e: 3100, l: 6700, bp: 80 };
const AmphComplex = { key: 'armamsub', id: 'armamsub', name: 'Amphibious Complex', m: 1200, e: 5500, l: 11100, bp: 300 };
const moveEnv = { wind: 10, tidal: 20, spotValue: 2 };
const A = { x: 0, z: 0 };
const B = { x: 6144, z: 0 };

test('a Turtle finished at t=247 s moving 6144 elmos lands at ~361 s', () => {
  const sim = simulateBuildQueue(
    { ...richState, buildPower: 21000 / 247 },
    [{ type: 'move', unit: Turtle, from: A, to: B }],
    moveEnv,
    { horizonSeconds: 600, timeStep: 1 },
  );
  const depart = sim.events.find((e) => e.type === 'depart');
  const arrive = sim.events.find((e) => e.type === 'arrive');
  assert.ok(Math.abs(depart.t - 247) < 1, `departed at ${depart.t}`);
  assert.ok(Math.abs(arrive.t - 361) < 1, `arrived at ${arrive.t}`);
  assert.ok(Math.abs(arrive.t - depart.t - 6144 / 54) < 0.01);
  // in transit between the two events, then counted at the destination
  const mid = sim.timeline.find((s) => s.event === 'complete');
  assert.equal(mid.inTransit.length, 1);
  assert.equal(sim.inTransit.length, 0);
  assert.equal(sim.finalUnits['6144,0'].armcroc, 1);
});

test('a forward Amphibious Complex cannot start before its Beaver arrives', () => {
  const forward = { x: 6144, z: 0 };
  const sim = simulateBuildQueue(
    { ...richState, buildPower: 100 },
    [
      { type: 'move', unit: Beaver, from: A, to: forward },
      { type: 'build', unit: AmphComplex, at: forward },
    ],
    moveEnv,
    { horizonSeconds: 900, timeStep: 1 },
  );
  const arrive = sim.events.find((e) => e.type === 'arrive');
  assert.ok(Math.abs(arrive.t - (sim.completed[0].completedAt + 6144 / 42)) < 0.01);
  assert.equal(sim.completed.length, 2);
  assert.ok(sim.completed[1].startedAt >= arrive.t - 1e-3);
  // 300 BP complex built by one 80 BP Beaver, not the 100 BP at home
  assert.ok(sim.completed[1].buildSeconds >= 11100 / 80 - 1e-6);
  assert.ok(sim.events.some((e) => e.type === 'wait_for_constructor'));
});

test('a forward build with no constructor never starts', () => {
  const sim = simulateBuildQueue(
    { ...richState, buildPower: 100 },
    [{ type: 'build', unit: AmphComplex, at: 'P4' }],
    moveEnv,
    { horizonSeconds: 60, timeStep: 1 },
  );
  assert.equal(sim.completed.length, 0);
});

// --- reclaim ---
const Shipyard = { key: 'armsy', id: 'armsy', name: 'Shipyard', m: 450, e: 950, l: 5160, bp: 150 };

test('reclaiming a Shipyard returns its metal (no energy) and stops its production', () => {
  const lowStore = { ...richState, buildPower: 100, metalStored: 1000, energyStored: 10000, metalIncome: 0, energyIncome: 0 };
  const env = { wind: 10, tidal: 20, spotValue: 2 };
  const model = { horizonSeconds: 400, timeStep: 1 };
  const built = simulateBuildQueue(lowStore, [Shipyard], env, model);
  const sim = simulateBuildQueue(lowStore, [Shipyard, { type: 'reclaim', unit: Shipyard }], env, model);
  assert.ok(sim.events.some((e) => e.type === 'reclaim_complete'));
  assert.equal(sim.finalUnits.home.armsy, 0);
  assert.ok(Math.abs(sim.metalReclaimed - 450 * RECLAIM_METAL_FRACTION) < 1e-6);
  // metal: spent 450 building, got 450 back; energy only ever goes down
  assert.ok(Math.abs(sim.finalState.metalStored - 1000) < 1e-6);
  assert.ok(Math.abs(sim.finalState.energyStored - (10000 - 950)) < 1e-6);
  // the lab's 150 BP is gone, leaving the original 100 BP
  assert.equal(sim.finalBP, 100);
  assert.equal(built.finalBP, 250);
  // reclaimed at the remaining constructor's 100 BP
  const start = sim.events.find((e) => e.type === 'reclaim_start');
  const end = sim.events.find((e) => e.type === 'reclaim_complete');
  assert.ok(Math.abs(end.t - start.t - 5160 / 100) < 1.01);
});

test('reclaim metal is not returned gradually (unitMethod 1)', () => {
  const st = { ...richState, buildPower: 100, metalStored: 1000, energyStored: 10000, metalIncome: 0, energyIncome: 0 };
  const env = { wind: 10, tidal: 20, spotValue: 2 };
  const sim = simulateBuildQueue(st, [Shipyard, { type: 'reclaim', unit: Shipyard }], env, { horizonSeconds: 400, timeStep: 1 });
  const start = sim.events.find((e) => e.type === 'reclaim_start');
  const end = sim.events.find((e) => e.type === 'reclaim_complete');
  const mid = (start.t + end.t) / 2;
  const startStored = sim.timeline.find((p) => p.event === 'reclaim_start').metalStored;
  const midPoints = sim.timeline.filter((p) => p.t > start.t && p.t <= mid);
  for (const p of midPoints) assert.ok(p.metalStored <= startStored + 1e-6);
  assert.ok(Math.abs(sim.finalState.metalStored - startStored - 450) < 1e-6);
});

test('a reclaim cut off by the horizon returns no metal', () => {
  const st = { ...richState, buildPower: 100, metalStored: 1000, energyStored: 10000, metalIncome: 0, energyIncome: 0 };
  const env = { wind: 10, tidal: 20, spotValue: 2 };
  const sim = simulateBuildQueue(st, [Shipyard, { type: 'reclaim', unit: Shipyard }], env, { horizonSeconds: 100, timeStep: 1 });
  assert.ok(sim.events.some((e) => e.type === 'reclaim_start'));
  assert.ok(!sim.events.some((e) => e.type === 'reclaim_complete'));
  assert.equal(sim.metalReclaimed, 0);
  assert.ok(sim.finalState.metalStored <= 1000 - 450 + 1e-6);
});

test('reclaiming something never built is skipped', () => {
  const sim = simulateBuildQueue(richState, [{ type: 'reclaim', unit: Shipyard }], {}, { horizonSeconds: 30 });
  assert.ok(sim.events.some((e) => e.type === 'reclaim_skipped'));
  assert.equal(sim.metalReclaimed, 0);
});
