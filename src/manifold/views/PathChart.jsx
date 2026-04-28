import React, { useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
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
export default function PathChart({
  unitsByKey, buildOrder, simulation, bp,
  removeStep, reorderBuildOrder, onApplyToManifold,
}) {
  const dragIdx = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);

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
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9 }} tickFormatter={v => v + 's'} />
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {buildOrder.length > 0 && (
        <div className="h-[80px] flex gap-2 overflow-x-auto shrink-0 py-1"
          style={{ scrollbarWidth: 'none' }}
          onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>
          {buildOrder.map((step, idx) => {
            const u = unitsByKey[step.key];
            const isDance = u?.tags?.includes('dance');
            const buildSecs = isDance && step.l ? Math.round(step.l / Math.max(1, bp)) : null;
            const stepLabel = isDance
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
                className={`flex-shrink-0 w-28 rounded-xl p-2 flex flex-col justify-between relative cursor-grab active:cursor-grabbing select-none transition-all
                  ${isTarget
                    ? 'bg-emerald-500/10 border border-emerald-500/50 scale-105'
                    : isDance
                      ? 'bg-indigo-950/40 border border-indigo-500/20'
                      : 'bg-slate-900 border border-white/10'}`}
              >
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Step {idx + 1}</span>
                <span className="text-[9px] font-black uppercase truncate leading-tight"
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
        </div>
      )}
    </div>
  );
}
