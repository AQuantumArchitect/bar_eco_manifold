// Data-only map models and straight-line movement helpers (no React, no terrain).
//
// MapModel: { id, springName, sizeElmos: {x, z}, seats: {P1..: {x, z, team, role}},
//             waypoints: {}, source }

export { supremeIsthmus } from './supremeIsthmus.js';

/** Straight-line distance in elmos between two {x, z} points. */
export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** Total length in elmos of a polyline of {x, z} points. */
export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/**
 * Seconds to travel a polyline at speedElmosPerSec. pathFactor (>= 1) inflates
 * the straight-line length to stand in for terrain detours.
 */
export function transitSeconds(points, speedElmosPerSec, pathFactor = 1.0) {
  if (!(speedElmosPerSec > 0)) throw new RangeError('speedElmosPerSec must be > 0');
  return (pathLength(points) * pathFactor) / speedElmosPerSec;
}

/**
 * Resolve a location (seat/waypoint name, "x,z" key as emitted in sim events, or
 * an {x, z} point) to an {x, z} point on `map`. Returns null when unknown.
 */
export function resolveLocation(map, loc) {
  if (loc && typeof loc === 'object') return { x: Number(loc.x), z: Number(loc.z) };
  const hit = map.waypoints?.[loc] ?? map.seats?.[loc];
  if (hit) return { x: hit.x, z: hit.z };
  const m = /^(-?[\d.]+),(-?[\d.]+)$/.exec(String(loc));
  return m ? { x: Number(m[1]), z: Number(m[2]) } : null;
}

/** Seconds as m:ss. */
export function formatMmSs(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
