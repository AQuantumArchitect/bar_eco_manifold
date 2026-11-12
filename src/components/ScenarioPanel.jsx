import React from 'react';
import { Anchor } from 'lucide-react';
import { POND_ASSUMPTIONS, POND_SEAT_CHOICES, POND_TURTLE_NAME, pondReport } from '../scenarios/pondTurtle.js';
import { formatMmSs } from '../maps/index.js';

const btn = 'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[9px] font-black uppercase tracking-wider text-indigo-300 hover:bg-indigo-500/20 transition-colors';

/**
 * Showcase preset: load button, seat + share controls, collapsible assumptions and the
 * arrival / stall read-out. `scenario` is { seat, shareGiven } once loaded, else null.
 */
export default function ScenarioPanel({ scenario, simulation, onLoad, onChange }) {
  if (!scenario) {
    return (
      <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Showcase</p>
        <button onClick={() => onLoad()} className={btn}><Anchor size={12} />{POND_TURTLE_NAME}</button>
      </div>
    );
  }
  const report = simulation ? pondReport({
    events: simulation.events,
    metalStallSeconds: simulation.metalStallSeconds,
    energyStallSeconds: simulation.energyStallSeconds,
  }, scenario) : null;
  return (
    <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-2.5">
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Showcase · {POND_TURTLE_NAME}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
          Pond seat
          <select value={scenario.seat} onChange={e => onChange({ ...scenario, seat: e.target.value })}
            className="bg-slate-900 border border-white/10 rounded px-1.5 py-1 text-[11px] text-slate-200">
            {POND_SEAT_CHOICES.map(s => <option key={s} value={s}>{s}{s === 'P8' ? ' (assumed)' : ''}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
          <span className="flex justify-between"><span>Tidal given</span><span className="font-mono text-slate-300">{Math.round(scenario.shareGiven * 100)}%</span></span>
          <input type="range" min="0" max="1" step="0.05" value={scenario.shareGiven}
            onChange={e => onChange({ ...scenario, shareGiven: Number(e.target.value) })}
            className="w-full h-1 mt-2 accent-indigo-500" />
        </label>
      </div>
      <p className="text-[10px] text-amber-400/90 leading-snug">
        Seat is an assumption: map metadata marks P1 and P8 both as sea.
      </p>

      <details className="group rounded-lg border border-white/5 bg-slate-900/50 px-2 py-1.5">
        <summary className="cursor-pointer text-[9px] font-black uppercase tracking-widest text-slate-400">Assumptions</summary>
        <ul className="mt-1.5 space-y-1 list-disc pl-4">
          {POND_ASSUMPTIONS.map((a, i) => <li key={i} className="text-[10px] text-slate-400 leading-snug">{a}</li>)}
        </ul>
      </details>

      {report && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Turtle arrivals on the beach</p>
          {report.waves.length === 0 && <p className="text-[10px] text-slate-600 italic">None within the horizon.</p>}
          {report.waves.map((w, i) => (
            <p key={i} className="text-[10px] font-mono text-slate-300">
              Wave {i + 1}: {w.times.map(formatMmSs).join(', ')}
            </p>
          ))}
          <p className="text-[10px] font-mono text-slate-300">
            Stalls: energy {Math.round(report.energyStallSeconds)} s · metal {Math.round(report.metalStallSeconds)} s
          </p>
          <p className="text-[11px] text-slate-200 leading-snug">{report.text}</p>
        </div>
      )}
    </div>
  );
}
