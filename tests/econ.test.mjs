import assert from 'node:assert/strict';
import test from 'node:test';
import {
  correctedSimpleROI,
  evaluateCandidate,
  getIncomeStreams,
  legacyEconomyROI,
  makeValueModel,
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
