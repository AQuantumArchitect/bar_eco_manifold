import assert from 'node:assert/strict';
import test from 'node:test';
import { distance, formatMmSs, pathLength, resolveLocation, supremeIsthmus, transitSeconds } from '../src/maps/index.js';

const { seats } = supremeIsthmus;

test('Supreme Isthmus has 16 seats, 8 per team, with spot-checked coords', () => {
  assert.equal(Object.keys(seats).length, 16);
  for (const t of [0, 1]) {
    assert.equal(Object.values(seats).filter((s) => s.team === t).length, 8);
  }
  assert.deepEqual(supremeIsthmus.sizeElmos, { x: 12288, z: 12288 });
  assert.deepEqual(seats.P1, { x: 711, z: 7218, team: 0, role: 'sea' });
  assert.deepEqual(seats.P8, { x: 4814, z: 11077, team: 0, role: 'sea' });
  assert.deepEqual(seats.P9, { x: 11579, z: 5063, team: 1, role: 'sea' });
  assert.deepEqual(seats.P16, { x: 7492, z: 1220, team: 1, role: 'sea' });
  assert.equal(seats.P7.role, 'front/tech');
  assert.deepEqual(Object.keys(supremeIsthmus.waypoints), ['pondExit', 'midSea', 'enemyBeach']);
});

test('distance P1->P9 matches Pythagoras on stored coords', () => {
  const dx = seats.P9.x - seats.P1.x;
  const dz = seats.P9.z - seats.P1.z;
  assert.ok(Math.abs(distance(seats.P1, seats.P9) - Math.sqrt(dx * dx + dz * dz)) < 1e-9);
});

test('pathLength sums segments', () => {
  assert.equal(pathLength([]), 0);
  assert.equal(pathLength([{ x: 0, z: 0 }]), 0);
  assert.equal(pathLength([{ x: 0, z: 0 }, { x: 3, z: 4 }, { x: 3, z: 10 }]), 11);
});

test('transitSeconds: 6144 elmos at speed 54 is ~113.8 s; pathFactor scales', () => {
  const line = [{ x: 0, z: 0 }, { x: 6144, z: 0 }];
  assert.ok(Math.abs(transitSeconds(line, 54) - 113.78) < 0.01);
  assert.ok(Math.abs(transitSeconds(line, 54, 1.5) - 113.78 * 1.5) < 0.02);
  assert.throws(() => transitSeconds(line, 0));
});

test('resolveLocation handles seat names, "x,z" keys and points; formatMmSs pads', () => {
  assert.deepEqual(resolveLocation(supremeIsthmus, 'P1'), { x: 711, z: 7218 });
  assert.deepEqual(resolveLocation(supremeIsthmus, '100,250.5'), { x: 100, z: 250.5 });
  assert.deepEqual(resolveLocation(supremeIsthmus, { x: 1, z: 2 }), { x: 1, z: 2 });
  assert.equal(resolveLocation(supremeIsthmus, 'nowhere'), null);
  assert.equal(formatMmSs(65.4), '1:05');
  assert.equal(formatMmSs(9), '0:09');
});
