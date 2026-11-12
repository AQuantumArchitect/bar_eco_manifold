import { simulateBuildQueue } from '../econ/simulateBuildQueue.js';
import { supremeIsthmus, formatMmSs } from '../maps/index.js';
import { resolveQueue } from './catalog.js';

/**
 * Showcase: Armada amphibious Turtle push from the Pond seat on Supreme Isthmus.
 * Opening per Luke's notes: tidals at the lake (some of their energy given to the front
 * players), an Amphibious Complex at the lake, then Turtles walking out to the enemy beach.
 */
export const POND_TURTLE_NAME = 'Pond Turtle push (Supreme Isthmus)';

/** Seats with the `sea` role on Luke's side; map metadata cannot tell which one is at the lake. */
export const POND_SEAT_CHOICES = ['P8', 'P1'];

export const POND_DEFAULTS = {
  seat: 'P8',            // ASSUMPTION: metadata marks P1 and P8 both `sea`; see assumptions below.
  shareGiven: 0.5,       // fraction of tidal energy given to the front players
  tidalCount: 20,
  tidalEPerSec: 20,      // ASSUMPTION: app default tidal strength, not the map's measured value
  pathFactor: 1.15,      // same default as the Map view's transit calculator
};

export const POND_ASSUMPTIONS = [
  'Armada, Pond seat. Map metadata marks both P1 and P8 as `sea`, and the minimap puts the lake about equally far from each, so the seat is an assumption: P8 by default, switchable to P1.',
  'Partner holds the sea, so the transit is uncontested (no losses modelled).',
  'About 20 tidals at 20 E/s each is ~400 E/s gross. The first six feed the front players; the share slider models the whole tidal output given away (default 50%).',
  'Tidal strength (20 E/s) is the app default, not a measured value for this lake. Start is 1000 M / 1000 E with the commander (300 build power) and an assumed 15 M/s metal income.',
  'Transit uses straight lines between waypoints x pathFactor 1.15, not real pathing. Turtle speed 54 elmos/s, Beaver 42 (BAR unit defs).',
  'Waypoints were picked by eye from the public minimap (maps-metadata map_list.yaml): home pond exit, mid-sea, enemy beach.',
  'Plan: tidals, Amphibious Complex, Turtles, reclaim the T1 Shipyard into an Advanced Shipyard (reclaim returns metal only), a Beaver builds a forward Amphibious Complex on the far beach, Voyagers assist both labs.',
];

export function pondTurtleEconomy({ shareGiven = POND_DEFAULTS.shareGiven, tidalEPerSec = POND_DEFAULTS.tidalEPerSec } = {}) {
  return {
    bp: 300, mInc: 15, eInc: 0,
    mStart: 1000, eStart: 1000, mMax: 1000, eMax: 1000,
    tidal: Number((tidalEPerSec * (1 - shareGiven)).toFixed(2)),
  };
}

/** Build-order steps (no ids) for the preset. */
export function pondTurtleQueue({ seat = POND_DEFAULTS.seat, tidalCount = POND_DEFAULTS.tidalCount, pathFactor = POND_DEFAULTS.pathFactor } = {}) {
  const route = { from: seat, path: ['pondExit', 'midSea'], to: 'enemyBeach', pathFactor };
  const turtle = { type: 'move', key: 'armcroc', ...route };
  return [
    ...Array.from({ length: tidalCount }, () => ({ key: 'Tidal' })),
    { key: 'armamsub' },
    turtle,
    { key: 'armsy' },
    turtle,
    { type: 'move', key: 'armbeaver', ...route },
    turtle,
    { type: 'reclaim', key: 'armsy' },
    { key: 'armasy' },
    { type: 'build', key: 'armamsub', at: 'enemyBeach' },
    { type: 'move', key: 'armmls', ...route },
    { key: 'armmls' },
    { type: 'build', key: 'armcroc', at: 'enemyBeach' },
    { type: 'build', key: 'armcroc', at: 'enemyBeach' },
    turtle,
    { type: 'build', key: 'armcroc', at: 'enemyBeach' },
  ].map(s => ({ ...s }));
}

/** Plain-English read-out plus the numbers behind it. */
export function pondReport(sim, { seat = POND_DEFAULTS.seat } = {}) {
  const events = sim.events;
  const landings = [];
  for (const e of events) {
    if (e.unitKey !== 'armcroc') continue;
    if (e.type === 'arrive' && e.to === 'enemyBeach') landings.push({ t: e.t, forward: false });
    if (e.type === 'complete' && e.at === 'enemyBeach') landings.push({ t: e.t, forward: true });
  }
  landings.sort((a, b) => a.t - b.t);
  const waves = [];
  for (const l of landings) {
    const last = waves[waves.length - 1];
    if (last && l.t - last.times[last.times.length - 1] <= 100) last.times.push(l.t);
    else waves.push({ times: [l.t] });
  }
  const forwardLab = events.find(e => e.type === 'complete' && e.unitKey === 'armamsub' && e.at === 'enemyBeach')?.t ?? null;
  const firstDepart = events.find(e => e.type === 'depart' && e.unitKey === 'armcroc');
  const transit = firstDepart?.transitSeconds ?? null;
  const metalStall = sim.metalStallSeconds ?? 0;
  const energyStall = sim.energyStallSeconds ?? 0;

  let text;
  if (landings.length === 0) {
    text = `No Turtles reach the beach within the ${formatMmSs(1800)} horizon.`;
  } else {
    text = `From ${seat}, the first Turtle lands at ${formatMmSs(landings[0].t)}`
      + (transit ? ` after a ${Math.round(transit)} s walk` : '')
      + `; ${landings.length} land in total in ${waves.length} wave${waves.length === 1 ? '' : 's'}.`;
    text += forwardLab != null
      ? ` The forward lab finishes at ${formatMmSs(forwardLab)}, and Turtles built there land with 0 s of transit.`
      : ' The forward lab does not finish inside the horizon.';
    text += ` The build waits ${Math.round(energyStall)} s on energy and ${Math.round(metalStall)} s on metal.`;
  }
  return { landings, waves, forwardLab, metalStallSeconds: metalStall, energyStallSeconds: energyStall, text };
}

/** Run the preset end to end (used by tests; the UI runs the same queue through its own sim memo). */
export function runPondTurtle(opts = {}) {
  const p = { ...POND_DEFAULTS, ...opts };
  const eco = pondTurtleEconomy(p);
  const initial = {
    buildPower: eco.bp, metalIncome: eco.mInc, energyIncome: eco.eInc,
    metalStored: eco.mStart, energyStored: eco.eStart, metalStorage: eco.mMax, energyStorage: eco.eMax,
  };
  const sim = simulateBuildQueue(initial, resolveQueue(pondTurtleQueue(p)),
    { wind: 0, tidal: eco.tidal, spotValue: 0, map: supremeIsthmus }, { horizonSeconds: 1800, timeStep: 1 });
  return { sim, report: pondReport(sim, p) };
}
