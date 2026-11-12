import assert from 'node:assert/strict';
import test from 'node:test';
import { runPondTurtle, pondTurtleQueue, shareGiven } from '../src/scenarios/pondTurtle.js';
import { resolveQueue } from '../src/scenarios/catalog.js';
import { simulateBuildQueue } from '../src/econ/simulateBuildQueue.js';
import { supremeIsthmus } from '../src/maps/index.js';

// Pinned within +-10 s so any simulator / data change shows up here.
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 10, `${actual} not within 10 s of ${expected}`);

test('Pond Turtle push key times (defaults: P4, 6 front + 3 own tidals, lab at the lake)', () => {
  const { sim, report } = runPondTurtle();
  const done = (key, at) => sim.events.filter(e => e.type === 'complete' && e.unitKey === key && e.at === at).map(e => e.t);

  near(done('armsy', 'pond')[0], 90);              // T1 Shipyard at the lake
  near(done('armamsub', 'pond')[0], 166);          // Amphibious Complex at the lake
  near(done('armcroc', 'pond')[0], 416);           // first Turtle starts walking
  near(report.landings[0].t, 551);                 // first Turtle on the beach
  near(sim.events.find(e => e.type === 'reclaim_complete').t, 977);
  near(done('armasy', 'pond')[0], 1129);           // Advanced Shipyard at the lake
  near(report.forwardLab, 1268);                   // forward lab done
  assert.equal(report.landings.length, 4);
  assert.equal(report.landings.filter(l => l.forward).length, 1);
  assert.ok(report.energyStallSeconds > 0);
  assert.equal(shareGiven({ front: 6, own: 3 }), 2 / 3);
  assert.match(report.text, /first Turtle lands at 9:11/);
  assert.ok(!sim.events.some(e => e.type === 'move_blocked'));
});

test('only amphibious units leave the lake; Voyagers stay and assist', () => {
  const moved = pondTurtleQueue().filter(s => s.type === 'move').map(s => s.key);
  assert.deepEqual([...new Set(moved)].sort(), ['armbeaver', 'armcroc']);
  const { sim } = runPondTurtle();
  assert.equal(sim.events.filter(e => e.type === 'complete' && e.unitKey === 'armmls' && e.at === 'pond').length, 2);
});

test('more tidals for the front lands the first Turtle later', () => {
  const base = runPondTurtle().report.landings[0].t;
  const more = runPondTurtle({ front: 9 }).report.landings[0].t;
  const fewer = runPondTurtle({ front: 3 }).report.landings[0].t;
  assert.ok(more > base && fewer < base);
});

test('a ship (Voyager) cannot move out of the landlocked pond; it is skipped with an event', () => {
  const route = { type: 'move', key: 'armmls', at: 'pond', from: 'pond', path: ['seaEntry'], to: 'enemyBeach' };
  const sim = simulateBuildQueue(
    { buildPower: 300, metalIncome: 100, energyIncome: 1000, metalStored: 1000, energyStored: 1000, metalStorage: 1000, energyStorage: 1000 },
    resolveQueue([route, { ...route, key: 'armcroc' }]),
    { map: supremeIsthmus, startAt: 'pond' }, { horizonSeconds: 1800, timeStep: 1 });
  const blocked = sim.events.filter(e => e.type === 'move_blocked');
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].unitKey, 'armmls');
  assert.equal(sim.events.filter(e => e.type === 'depart').map(e => e.unitKey).join(), 'armcroc');
});
