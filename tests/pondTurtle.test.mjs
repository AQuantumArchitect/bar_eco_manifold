import assert from 'node:assert/strict';
import test from 'node:test';
import { runPondTurtle } from '../src/scenarios/pondTurtle.js';

// Pinned within +-10 s so any simulator / data change shows up here.
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 10, `${actual} not within 10 s of ${expected}`);

test('Pond Turtle push key times (defaults: P8, 50% tidal given)', () => {
  const { sim, report } = runPondTurtle();
  const done = (key, at) => sim.events.filter(e => e.type === 'complete' && e.unitKey === key && e.at === at).map(e => e.t);

  near(done('armamsub', 'home')[0], 197);          // Amphibious Complex at the lake
  near(done('armcroc', 'home')[0], 268);           // first Turtle starts walking
  near(report.landings[0].t, 498);                 // first Turtle on the beach
  near(report.landings[2].t, 669);                 // third home-built Turtle on the beach
  near(sim.events.find(e => e.type === 'reclaim_complete').t, 448);
  near(report.forwardLab, 799);                    // forward lab done
  assert.equal(report.landings.length, 7);
  assert.equal(report.landings.filter(l => l.forward).length, 3);
  assert.ok(report.energyStallSeconds > 0 && report.metalStallSeconds > 0);
  assert.match(report.text, /first Turtle lands at 8:18/);
});

test('giving away less tidal energy lands Turtles sooner', () => {
  const base = runPondTurtle().report.landings[0].t;
  const richer = runPondTurtle({ shareGiven: 0.25 }).report.landings[0].t;
  assert.ok(richer < base);
});
