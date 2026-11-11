import assert from 'node:assert/strict';
import test from 'node:test';
import { BAR_MOBILITY, MOBILITY_BY_ID } from '../src/data/barMobility.js';

test('Turtle row matches the BAR unit defs', () => {
  const t = MOBILITY_BY_ID.armcroc;
  assert.equal(t.name, 'Turtle');
  assert.deepEqual(
    [t.m, t.e, t.l, t.speed, t.movementClass, t.bp],
    [750, 15000, 21000, 54, 'ATANK3', null],
  );
  assert.equal(t.amphibious, true);
  assert.equal(BAR_MOBILITY.armcroc, t);
});

test('naval and builder rows from the issue', () => {
  assert.equal(MOBILITY_BY_ID.armcs.speed, 65.4);
  assert.equal(MOBILITY_BY_ID.armacsub.movementClass, 'UBOAT4');
  assert.equal(MOBILITY_BY_ID.armacsub.canMoveUnderwater, true);
  assert.equal(MOBILITY_BY_ID.armcs.canMoveUnderwater, false);
  assert.equal(MOBILITY_BY_ID.armbeaver.bp, 80);
  assert.equal(MOBILITY_BY_ID.armamsub.speed, null);
  assert.equal(MOBILITY_BY_ID.armasy.bp, 600);
});

test('every mobile unit has speed > 0', () => {
  const mobile = Object.values(BAR_MOBILITY).filter((u) => u.mobile);
  assert.ok(mobile.length >= 5);
  for (const u of mobile) {
    assert.ok(u.speed > 0, `${u.id} speed`); // aircraft have no movement class
  }
});
