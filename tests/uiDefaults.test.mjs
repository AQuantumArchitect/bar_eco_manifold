import assert from 'node:assert/strict';
import test from 'node:test';
import { BAR_STATS, TAGS } from '../src/data/barStats.js';
import { RESET_FILTERS } from '../src/manifold/filters.js';

test('T1.5 mex is gone, Moho stays', () => {
  assert.equal(BAR_STATS.LegMexT15, undefined);
  for (const [k, u] of Object.entries(BAR_STATS)) assert.ok(!/t1\.5/i.test(u.name), k);
  for (const k of ['Moho', 'CorMoho', 'LegMoho']) assert.ok(BAR_STATS[k], k);
});

const WANT = { cortex: 'yes', t1: 'yes', georeq: 'no' };
test('Reset filters are Cortex, T1, no geo vent', () => {
  for (const k of Object.keys(TAGS)) {
    const want = Object.hasOwn(WANT, k) ? WANT[k] : null;
    assert.equal(RESET_FILTERS[k], want, k);
  }
});
