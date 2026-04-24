import React from 'react';

function fmtSeconds(v) {
  if (!Number.isFinite(v)) return '∞';
  if (v >= 3600) return `${(v / 3600).toFixed(1)}h`;
  if (v >= 60) return `${(v / 60).toFixed(1)}m`;
  return `${v.toFixed(1)}s`;
}

function fmtEV(v, metalToEnergy) {
  if (!Number.isFinite(v)) return '∞';
  const k = Math.abs(v) >= 1000;
  const formatted = k ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toString();
  return `${v >= 0 ? '+' : ''}${formatted}`;
}

const LABEL_BADGE = {
  eco:             'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'build-power':   'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'factory-bp':    'bg-orange-500/15 text-orange-300 border-orange-500/30',
  storage:         'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'geo-transition':'bg-red-500/15 text-red-300 border-red-500/30',
  strategic:       'bg-slate-500/15 text-slate-400 border-slate-500/30',
  infeasible:      'bg-slate-900/40 text-slate-600 border-slate-700/20',
};

export default function EconCandidateTable({ evaluations, onPick, horizonSeconds = 300, metalToEnergy = 70 }) {
  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
        Computing…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/70 shadow-xl">
      <div className="px-4 py-3 border-b border-white/5 flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-300">
          Net Horizon Analysis
        </h3>
        <span className="text-[9px] text-slate-600 uppercase tracking-widest">
          {horizonSeconds >= 60 ? Math.round(horizonSeconds/60)+'m' : horizonSeconds+'s'} horizon · {metalToEnergy} E/M
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-white/5">
              {['Unit', 'Class', 'Net Horizon EV', 'Payback', 'Build Time', 'Stalls', 'Income Delta', 'First Reason'].map(h => (
                <th key={h} className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evaluations.map((ev, i) => {
              const isTop = i === 0 && ev.feasible && Number.isFinite(ev.netHorizonEV) && ev.netHorizonEV > 0;
              const labelCls = LABEL_BADGE[ev.label] ?? LABEL_BADGE.strategic;
              const evPos = Number.isFinite(ev.netHorizonEV) && ev.netHorizonEV >= 0;
              return (
                <tr key={ev.unitKey}
                  className={`border-b border-white/[0.04] transition-colors ${isTop ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]'}`}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onPick?.(ev.unitKey)}
                      className={`text-[11px] font-bold text-left transition-colors ${isTop ? 'text-emerald-300' : 'text-slate-200 hover:text-emerald-400'}`}
                    >
                      {ev.unitName}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${labelCls}`}>
                      {ev.label}
                    </span>
                  </td>
                  <td className={`px-3 py-2 font-mono text-[11px] font-bold ${evPos ? 'text-emerald-300' : 'text-red-400'}`}>
                    {fmtEV(ev.netHorizonEV, metalToEnergy)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-400 font-mono">
                    {fmtSeconds(ev.simplePaybackSeconds)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-400 font-mono">
                    {ev.feasible ? fmtSeconds(ev.completionTime) : <span className="text-slate-700">&gt; horizon</span>}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-400 font-mono">
                    {ev.stallSeconds > 0.1 ? fmtSeconds(ev.stallSeconds) : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                    {ev.deltaIncome.metalIncome > 0 && `+${ev.deltaIncome.metalIncome.toFixed(2)}M/s `}
                    {ev.deltaIncome.energyIncome > 0 && `+${ev.deltaIncome.energyIncome.toFixed(1)}E/s `}
                    {ev.deltaCapacity.buildPower > 0 && `+${ev.deltaCapacity.buildPower}BP `}
                    {ev.deltaCapacity.metalStorage > 0 && `+${ev.deltaCapacity.metalStorage}Mcap `}
                    {ev.deltaCapacity.energyStorage > 0 && `+${ev.deltaCapacity.energyStorage}Ecap`}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-600 max-w-[220px] truncate">
                    {ev.reasons?.[0]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
