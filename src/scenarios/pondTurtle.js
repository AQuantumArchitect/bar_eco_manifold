import { simulateBuildQueue } from '../econ/simulateBuildQueue.js';
import { supremeIsthmus, formatMmSs } from '../maps/index.js';
import { resolveQueue } from './catalog.js';

/**
 * Showcase: Armada amphibious Turtle push from the Pond seat on Supreme Isthmus.
 * Per Luke (relayed Nov 11): Pond is a lake support seat behind the causeway fronts. It opens
 * with about 6 tidals for the front, a few for itself, then a lab at the lake. The lake is the
 * landlocked crater lake inside team 0's land, so only amphibious units (Turtle, Beaver) can walk
 * out of it; the shipyards and Voyagers stay.
 */
export const POND_TURTLE_NAME = 'Pond Turtle push (Supreme Isthmus)';

/** Seats near the lake, nearest first (distance from the `pond` waypoint, minimap-derived). */
export const POND_SEAT_CHOICES = ['P4', 'P7', 'P2'];

export const POND_DEFAULTS = {
  seat: 'P4',            // ASSUMPTION: nearest seat to the lake; Luke to confirm.
  front: 6,              // tidals whose energy goes to the front players (Luke: "about 6")
  own: 3,                // tidals for the Pond seat itself (Luke: "a few")
  tidalEPerSec: 20,      // NEEDS LUKE: not sourced; scenario input
  metalIncome: 15,       // NEEDS LUKE: not sourced; scenario input
  pathFactor: 1.15,      // same default as the Map view's transit calculator
};

export const POND_ASSUMPTIONS = [
  'Armada, Pond seat: a lake support seat behind the causeway fronts (Luke, relayed Nov 11). The "pond" is the landlocked crater lake inside team 0\'s land (minimap px x 195-365, y 980-1070).',
  'Seat is an assumption: P4 is the nearest seat to the lake (~1.15k elmos, behind the P5 and P6 fronts); P7 (~2.0k) and P2 (~2.1k) are the alternatives. Luke to confirm. The seat only labels the read-out; all building and walking starts at the lake.',
  'Opening: front tidals + own tidals at the lake, then the T1 Shipyard, Amphibious Complex and Advanced Shipyard at the lake ("a lab at the lake"). Front tidals are modelled as income given away: shareGiven = front / (front + own).',
  'Only Turtles and the Beaver (amphibious in BAR unit defs) leave the lake: they walk pond -> seaEntry over land, then cross the north-west sea to enemyBeach. Voyagers (BOAT4) and the shipyards cannot leave a landlocked lake, so Voyagers only assist the lake labs; a Beaver builds the forward Amphibious Complex on the enemy beach.',
  'Partner holds the sea, so the transit is uncontested (no losses modelled). The commander is assumed to start at the lake shore (walking from the seat is not modelled).',
  'Transit uses straight lines between waypoints x pathFactor 1.15, not real pathing. Turtle speed 54 elmos/s, Beaver 42 (BAR unit defs, src/data/barMobility.js).',
  'Waypoints were picked by eye from the public minimap (maps-metadata map_list.yaml photo supreme2.1mini.png); pixels are cited in src/maps/supremeIsthmus.js.',
  'Needs Luke: tidal output (20 E/s each), metal income (15 M/s), commander build power (300) and start resources (1000 M / 1000 E) are not sourced from barStats / barMobility. They are visible scenario inputs, not measured values.',
];

/** Share of tidal output given to the front: front / (front + own). */
export function shareGiven({ front = POND_DEFAULTS.front, own = POND_DEFAULTS.own } = {}) {
  const total = front + own;
  return total > 0 ? front / total : 0;
}

export function pondTurtleEconomy({ front = POND_DEFAULTS.front, own = POND_DEFAULTS.own,
  tidalEPerSec = POND_DEFAULTS.tidalEPerSec, metalIncome = POND_DEFAULTS.metalIncome } = {}) {
  return {
    bp: 300, mInc: metalIncome, eInc: 0,
    mStart: 1000, eStart: 1000, mMax: 1000, eMax: 1000,
    tidal: Number((tidalEPerSec * (1 - shareGiven({ front, own }))).toFixed(2)),
  };
}

/** Simulator env extras for the preset: the commander starts at the lake. */
export const POND_ENV = { startAt: 'pond' };

/** Build-order steps (no ids) for the preset. */
export function pondTurtleQueue({ front = POND_DEFAULTS.front, own = POND_DEFAULTS.own, pathFactor = POND_DEFAULTS.pathFactor } = {}) {
  const at = 'pond';
  const route = { at, from: 'pond', path: ['seaEntry', 'midSea'], to: 'enemyBeach', pathFactor };
  const turtle = { type: 'move', key: 'armcroc', ...route };
  const lake = key => ({ type: 'build', key, at });
  return [
    ...Array.from({ length: front + own }, () => lake('Tidal')),
    lake('armsy'),
    lake('armamsub'),
    turtle,
    turtle,
    { type: 'move', key: 'armbeaver', ...route },
    turtle,
    { type: 'reclaim', key: 'armsy', at },
    lake('armasy'),
    { type: 'build', key: 'armamsub', at: 'enemyBeach' },
    lake('armmls'),
    lake('armmls'),
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
    text = `From the lake (seat ${seat}), the first Turtle lands at ${formatMmSs(landings[0].t)}`
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
    { wind: 0, tidal: eco.tidal, spotValue: 0, map: supremeIsthmus, ...POND_ENV }, { horizonSeconds: 1800, timeStep: 1 });
  return { sim, report: pondReport(sim, p) };
}
