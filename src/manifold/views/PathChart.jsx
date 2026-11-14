import React, { useRef, useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts';
import { formatMmSs } from '../../maps/index.js';
import { GitCommit, TrendingUp, AlertTriangle, Activity, Trash2 } from 'lucide-react';

/**
 * Waterfall / path view: resource flow chart + drag-to-reorder build queue.
 *
 * Props:
 *   unitsByKey       — unit catalog (key → { name, hex, tags, ... })
 *   buildOrder       — array of { key, id, ...extraProps }
 *   simulation       — result from simulateBuildQueue (or null)
 *   bp               — current build power (for dance step label)
 *   removeStep       — (idx) => void
 *   reorderBuildOrder — (newOrder) => void
 *   onApplyToManifold — () => void — commit queue end-state as new initial conditions
 */
const MARKER = {
  depart:           { color: '#fbbf24', label: 'depart' },
  arrive:           { color: '#34d399', label: 'arrive' },
  reclaim_complete: { color: '#f472b6', label: 'reclaim' },
};

const markerText = (e) => {
  const t = formatMmSs(e.t);
  if (e.type === 'depart') return `${e.unitKey} departs ${e.from} → ${e.to} at ${t}, arrives ${formatMmSs(e.arriveAt)}`;
  if (e.type === 'arrive') return `${e.unitKey} arrives ${e.to} at ${t} (left ${e.from} at ${formatMmSs(e.departedAt)})`;
  return `${e.unitKey} reclaimed at ${e.at ?? 'home'} at ${t}, +${Math.round(e.metal ?? 0)} metal`;
};

export default function PathChart({
  unitsByKey, buildOrder, simulation, bp,
  removeStep, reorderBuildOrder, onApplyToManifold,
  trailingStep, tapeResetKey,
}) {
  const dragIdx = useRef(null);
  const stripRef = useRef(null);
  useEffect(() => { if (stripRef.current) stripRef.current.scrollLeft = 0; }, [tapeResetKey]);
  const [dropTarget, setDropTarget] = useState(null);
  const markers = (simulation?.events ?? []).filter(e => MARKER[e.type]);
  const lastMarkerT = markers.reduce((m, e) => Math.max(m, e.t), 0);

  const handleDrop = (toIdx) => {
    if (dragIdx.current === null || dragIdx.current === toIdx) return;
    const next = [...buildOrder];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(toIdx, 0, moved);
    reorderBuildOrder(next);
    dragIdx.current = null;
    setDropTarget(null);
  };

  return (
    <div className="w-full h-full p-4 bg-slate-950 flex flex-col gap-3 overflow-hidden">

      {!simulation ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <GitCommit size={36} className="text-slate-700 mb-3 animate-pulse" />
          <p className="text-slate-600 text-xs max-w-xs leading-relaxed italic">
            Use the <span className="text-slate-400 font-bold not-italic">+</span> buttons
            in the Payback Velocity list to queue units — the simulation tracks resource
            flow and stall risk.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-slate-900/50 rounded-2xl border border-white/5 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2 flex-wrap">
              <TrendingUp size={12} /> Resource Flow
              <span className="font-mono text-slate-600 normal-case tracking-normal">
                · {simulation.totalTime}s · BP&nbsp;
                <span className="text-purple-400">{simulation.finalBP}</span>
                · E {simulation.finalPE.toFixed(1)}/s · M {simulation.finalPM.toFixed(2)}/s
              </span>
            </h4>
            <div className="flex items-center gap-2 shrink-0">
              {simulation.hadStall && (
                <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 animate-pulse">
                  <AlertTriangle size={10} />
                  <span className="text-[9px] font-bold uppercase">Stall</span>
                </div>
              )}
              <button onClick={onApplyToManifold}
                className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded text-[9px] font-black uppercase text-emerald-400 hover:bg-emerald-500/20 transition-all">
                <Activity size={10} /> → Manifold
              </button>
            </div>
          </div>
          {markers.length > 0 && (
            <div className="flex gap-3 mb-2 text-[9px] text-slate-500">
              {Object.values(MARKER).map(m => (
                <span key={m.label}><span style={{ color: m.color }}>●</span> {m.label}</span>
              ))}
              <span className="italic text-slate-600">hover a marker</span>
            </div>
          )}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={simulation.points} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" type="number" domain={['dataMin', dMax => Math.max(dMax, lastMarkerT)]} stroke="#64748b" tick={{ fontSize: 9 }} tickFormatter={v => v + 's'} />
                <YAxis stroke="#64748b" tick={{ fontSize: 9 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '10px' }}
                  labelFormatter={v => `t = ${v}s`}
                  formatter={(v, name) => [v.toFixed(0), name]}
                />
                <Area type="monotone" dataKey="metal"  stroke="#94a3b8" fill="url(#gradM)"
                  name="Metal"  strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="energy" stroke="#fbbf24" fill="url(#gradE)"
                  name="Energy" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                {markers.map((e, i) => (
                  <ReferenceDot key={i} x={e.t} y={0} ifOverflow="extendDomain" isFront
                    shape={({ cx, cy }) => (
                      <g>
                        <title>{markerText(e)}</title>
                        <circle cx={cx} cy={cy} r={6} fill="#0f172a" stroke={MARKER[e.type].color} strokeWidth={2} />
                        <circle cx={cx} cy={cy} r={2} fill={MARKER[e.type].color} />
                      </g>
                    )} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(buildOrder.length > 0 || trailingStep) && (
        <div ref={stripRef} className="h-[80px] flex gap-2 overflow-x-auto shrink-0 py-1"
          style={{ scrollbarWidth: 'none' }}
          onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>
          {buildOrder.map((step, idx) => {
            const u = unitsByKey[step.key];
            const isDance = u?.tags?.includes('dance');
            const buildSecs = isDance && step.l ? Math.round(step.l / Math.max(1, bp)) : null;
            const isMove = step.type === 'move';
            const stepLabel = isMove
              ? `${u?.name ?? step.key} ${step.from}→${step.to}`
              : isDance
              ? `Dance ${buildSecs != null ? buildSecs + 's' : ''}`
              : u?.name ?? step.key;
            const isTarget = dropTarget === idx;
            return (
              <div key={step.id}
                draggable
                onDragStart={() => { dragIdx.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); setDropTarget(idx); }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { dragIdx.current = null; setDropTarget(null); }}
                title={`Step ${idx + 1}: ${stepLabel}`}
                className={`flex-shrink-0 w-32 rounded-xl p-2 flex flex-col justify-between relative cursor-grab active:cursor-grabbing select-none transition-all
                  ${isTarget
                    ? 'bg-emerald-500/10 border border-emerald-500/50 scale-105'
                    : isDance
                      ? 'bg-indigo-950/40 border border-indigo-500/20'
                      : 'bg-slate-900 border border-white/10'}`}
              >
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Step {idx + 1}</span>
                <span className="step-label text-[9px] font-black uppercase leading-tight break-words pr-4"
                  style={{ color: u?.hex ?? '#6366f1' }}>{stepLabel}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeStep(idx); }}
                  className="absolute top-1.5 right-1.5 bg-red-500/60 hover:bg-red-500 text-white rounded-full p-0.5 transition-colors"
                >
                  <Trash2 size={7} />
                </button>
              </div>
            );
          })}
          {trailingStep && (() => {
            const idleSecs = Math.round(trailingStep.l / Math.max(1, bp));
            return (
              <div className="flex-shrink-0 w-28 rounded-xl p-2 flex flex-col justify-between
                bg-indigo-950/20 border border-dashed border-indigo-500/25 opacity-60 select-none">
                <span className="text-[8px] font-bold text-slate-700 uppercase tracking-widest">Idle</span>
                <span className="text-[9px] font-black uppercase text-indigo-500 leading-tight">
                  {idleSecs >= 60 ? (idleSecs/60).toFixed(1)+'m' : idleSecs+'s'} dance
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
