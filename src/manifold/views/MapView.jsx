import React, { useMemo, useState } from 'react';
import { supremeIsthmus, distance, transitSeconds, resolveLocation, formatMmSs } from '../../maps/index.js';
import { BAR_MOBILITY } from '../../data/barMobility.js';

const MAP = supremeIsthmus;
const TEAM_COLOR = ['#38bdf8', '#f87171']; // team 0 / team 1
const DEFAULT_PATH_FACTOR = 1.15;

const MOBILE_UNITS = Object.entries(BAR_MOBILITY)
  .filter(([, u]) => u.mobile && u.speed > 0)
  .map(([key, u]) => ({ key, name: u.name, speed: u.speed }))
  .sort((a, b) => a.name.localeCompare(b.name));

const locationOptions = [
  ...Object.keys(MAP.seats).map(id => ({ id, label: `${id} · ${MAP.seats[id].role}` })),
  ...Object.keys(MAP.waypoints ?? {}).map(id => ({ id, label: id })),
];

const sel = 'bg-slate-900 border border-white/10 rounded px-1.5 py-1 text-[11px] text-slate-200 min-w-0 w-full';
const lbl = 'flex flex-col gap-1 text-[9px] font-black uppercase tracking-widest text-slate-500 min-w-0';

/**
 * Top-down Supreme Isthmus: seats by team/role, waypoints, simulated moves, plus a
 * straight-line transit calculator.
 *
 * Props:
 *   unitsByKey  — unit catalog (a move can only be queued for units in it)
 *   events      — simulation.events (depart events become lines)
 *   onQueueMove — ({ key, from, to, pathFactor }) => void
 */
export default function MapView({ unitsByKey, events, onQueueMove }) {
  const [unitKey, setUnitKey] = useState(MOBILE_UNITS.find(u => u.key === 'ConV')?.key ?? MOBILE_UNITS[0].key);
  const [from, setFrom] = useState('P5');
  const [to, setTo] = useState('P13');
  const [pathFactor, setPathFactor] = useState(DEFAULT_PATH_FACTOR);

  const unit = MOBILE_UNITS.find(u => u.key === unitKey);
  const a = resolveLocation(MAP, from);
  const b = resolveLocation(MAP, to);
  const straight = a && b ? distance(a, b) : 0;
  const secs = unit && a && b ? transitSeconds([a, b], unit.speed, pathFactor) : 0;

  const trips = useMemo(() => events
    .filter(e => e.type === 'depart')
    .map(e => ({ ...e, pts: [e.from, ...(e.path ?? []), e.to].map(l => resolveLocation(MAP, l)) }))
    .filter(e => e.pts.every(Boolean)), [events]);

  const { x: W, z: H } = MAP.sizeElmos;
  const r = W * 0.012;

  return (
    <div className="w-full h-full overflow-y-auto p-4 bg-slate-950 flex flex-col lg:flex-row gap-4">
      <div className="w-full lg:flex-1 min-w-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[70svh] lg:max-h-full aspect-square bg-slate-900 border border-white/10 rounded-xl"
          role="img" aria-label={`${MAP.springName} top-down map`}>
          <defs>
            <marker id="mv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#fbbf24" />
            </marker>
          </defs>
          {[1, 2, 3].map(i => (
            <g key={i} stroke="#1e293b" strokeWidth={W * 0.002}>
              <line x1={(W * i) / 4} y1={0} x2={(W * i) / 4} y2={H} />
              <line x1={0} y1={(H * i) / 4} x2={W} y2={(H * i) / 4} />
            </g>
          ))}
          {trips.map((t, i) => {
            // Label sits on the middle waypoint so it stays on the route, not beside it.
            const mid = t.pts[Math.floor(t.pts.length / 2)];
            return (
              <g key={i}>
                <polyline points={t.pts.map(p => `${p.x},${p.z}`).join(' ')} fill="none" stroke="#fbbf24"
                  strokeWidth={W * 0.004} strokeDasharray={`${W * 0.012} ${W * 0.008}`} strokeLinejoin="round" markerEnd="url(#mv-arrow)">
                  <title>{`${t.unitKey}: ${[t.from, ...(t.path ?? []), t.to].join(' → ')}, depart ${formatMmSs(t.t)}, arrive ${formatMmSs(t.arriveAt)}`}</title>
                </polyline>
                <text x={mid.x} y={mid.z - r} fill="#fbbf24" fontSize={W * 0.022}
                  textAnchor="middle" fontFamily="monospace" stroke="#0f172a" strokeWidth={W * 0.005} paintOrder="stroke">
                  {formatMmSs(t.t)}→{formatMmSs(t.arriveAt)}
                </text>
              </g>
            );
          })}
          {Object.entries(MAP.waypoints ?? {}).map(([name, p]) => (
            <g key={name}>
              <rect x={p.x - r * 0.7} y={p.z - r * 0.7} width={r * 1.4} height={r * 1.4} fill="none" stroke="#a78bfa" strokeWidth={W * 0.003} />
              <text x={p.x} y={p.z - r * 1.2} fill="#a78bfa" fontSize={W * 0.02} textAnchor="middle">{name}</text>
            </g>
          ))}
          {Object.entries(MAP.seats).map(([id, s]) => (
            <g key={id}>
              <circle cx={s.x} cy={s.z} r={r} fill={TEAM_COLOR[s.team]} stroke="#0f172a" strokeWidth={W * 0.003}>
                <title>{`${id} · ${s.role} · team ${s.team}`}</title>
              </circle>
              <text x={s.x} y={s.z + r * 2.4} fill="#cbd5e1" fontSize={W * 0.02} textAnchor="middle"
                stroke="#0f172a" strokeWidth={W * 0.004} paintOrder="stroke">{id} {s.role}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
        <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-2.5">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Transit calculator</p>
          <label className={lbl}>Unit
            <select className={sel} value={unitKey} onChange={e => setUnitKey(e.target.value)}>
              {MOBILE_UNITS.map(u => <option key={u.key} value={u.key}>{u.name} ({u.speed} e/s)</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={lbl}>From
              <select className={sel} value={from} onChange={e => setFrom(e.target.value)}>
                {locationOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className={lbl}>To
              <select className={sel} value={to} onChange={e => setTo(e.target.value)}>
                {locationOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <label className={lbl}>
            <span className="flex justify-between"><span>pathFactor</span><span className="font-mono text-slate-300">{pathFactor.toFixed(2)}</span></span>
            <input type="range" min="1" max="2" step="0.05" value={pathFactor}
              onChange={e => setPathFactor(Number(e.target.value))} className="w-full h-1 accent-indigo-500" />
          </label>
          <div className="flex items-baseline justify-between gap-2 font-mono">
            <span className="text-xl font-black text-white">{formatMmSs(secs)}</span>
            <span className="text-[11px] text-slate-400">{secs.toFixed(1)} s · {Math.round(straight)} elmos</span>
          </div>
          <p className="text-[10px] leading-snug text-slate-500 italic">
            Straight-line distance × pathFactor, not true pathing: real routes bend around terrain and water.
          </p>
          <button
            disabled={!onQueueMove || !unitsByKey[unitKey] || from === to}
            onClick={() => onQueueMove({ key: unitKey, from, to, pathFactor })}
            className="w-full py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-black uppercase text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed">
            Build &amp; send (add to queue)
          </button>
        </div>

        <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-1.5">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Simulated moves</p>
          {trips.length === 0 && <p className="text-[10px] text-slate-600 italic">None queued.</p>}
          {trips.map((t, i) => (
            <p key={i} className="text-[10px] font-mono text-slate-300">
              {t.unitKey} {[t.from, ...(t.path ?? []), t.to].join('→')} · dep {formatMmSs(t.t)} · arr {formatMmSs(t.arriveAt)}
            </p>
          ))}
          <div className="flex gap-3 pt-1 text-[9px] text-slate-500">
            <span><span style={{ color: TEAM_COLOR[0] }}>●</span> team 0</span>
            <span><span style={{ color: TEAM_COLOR[1] }}>●</span> team 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
