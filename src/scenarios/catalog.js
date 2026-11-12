import { BAR_STATS } from '../data/barStats.js';
import { BAR_MOBILITY } from '../data/barMobility.js';

/**
 * Unit catalog for queue simulation: BAR_STATS (the picker's units) plus every
 * BAR_MOBILITY entry not already in it (Turtle, Beaver, Voyager, Amphibious Complex, ...),
 * which carry build power (`bp`) and movement `speed`.
 */
export const UNIT_CATALOG = { ...BAR_STATS };
for (const [key, u] of Object.entries(BAR_MOBILITY)) {
  if (UNIT_CATALOG[key]) continue;
  UNIT_CATALOG[key] = {
    name: u.name, m: u.m, e: u.e, l: u.l, bp: u.bp ?? 0, speed: u.speed ?? undefined,
    hex: u.mobile ? '#f59e0b' : '#64748b', tags: [],
  };
}

/**
 * Turn waterfall build-order steps ({ key, type?, at?, from?, to?, path?, count?, ... })
 * into simulateBuildQueue queue entries.
 */
export function resolveQueue(buildOrder) {
  return buildOrder.map(step => {
    const unit = { key: step.key, ...UNIT_CATALOG[step.key], ...(step.l != null ? { l: step.l } : {}) };
    if (step.type === 'move') {
      return { type: 'move', unit, count: step.count, from: step.from, to: step.to, path: step.path, pathFactor: step.pathFactor };
    }
    if (step.type === 'build') return { type: 'build', unit, at: step.at };
    if (step.type === 'reclaim') return { type: 'reclaim', unit, at: step.at };
    return unit;
  });
}
