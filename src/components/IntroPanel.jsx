import React, { useEffect } from 'react';
import { X, Github } from 'lucide-react';

export const REPO_URL = 'https://github.com/AQuantumArchitect/bar_eco_manifold';
const STORAGE_KEY = 'roi-manifold:intro-dismissed';

export const introDismissed = () => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};

const ROWS = [
  ['Y axis',   'Payback time in seconds — how long a building takes to earn back its cost. Lower is better.'],
  ['X axis',   'The variable being swept: build power, wind, tidal, metal spot, income, game time or planning horizon. Pick it under “2D X Axis”.'],
  ['Cursor',   'Hover or tap the chart to probe a point. The queue strip above it re-sorts by payback at that point.'],
  ['Sliders',  'Set the map (wind, tidal, metal spot) and your economy (build power, income, storage).'],
  ['Queue',    'Click a card to queue it. Waterfall simulates the queue over time; 3D Manifold adds build power as a second axis (drag to orbit).'],
  ['Map',      'Supreme Isthmus with every seat and a transit calculator. Build and move steps in the queue take walking time, so a forward lab can beat a long march.'],
  ['Filters',  'Unit chips cycle include ✓ → exclude ✗ → any.'],
];

/**
 * First-visit explainer. Dismissal is remembered in localStorage;
 * the header "About" button reopens it.
 */
export default function IntroPanel({ onClose, onLoadPreset }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* private mode */ }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={close} role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90svh] overflow-y-auto bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-5">
        <button onClick={close} aria-label="Close"
          className="absolute top-3 right-3 p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors">
          <X size={14} />
        </button>

        <h2 id="intro-title" className="text-lg font-black italic tracking-tighter uppercase bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent">
          ROI Manifold
        </h2>
        <p className="text-[11px] text-slate-400 mt-1 mb-4 leading-relaxed">
          An explorer for the economy of <span className="text-slate-200">Beyond All Reason</span>:
          which building pays for itself fastest, and how that answer shifts as the map and your economy change.
          Each curve is one unit. It also models movement: how long units take to cross a real map, shown in the Pond Turtle showcase.
        </p>

        <dl className="space-y-2">
          {ROWS.map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-14 shrink-0 text-[9px] font-black uppercase tracking-widest text-blue-400 pt-0.5">{k}</dt>
              <dd className="text-[11px] text-slate-300 leading-snug">{v}</dd>
            </div>
          ))}
        </dl>

        {onLoadPreset && (
          <button onClick={onLoadPreset}
            className="w-full mt-4 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest text-indigo-300 transition-colors">
            Try the showcase: Pond Turtle push (Supreme Isthmus)
          </button>
        )}

        <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-white/5">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">
            <Github size={12} /> Source on GitHub
          </a>
          <button onClick={close}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white transition-colors">
            Explore
          </button>
        </div>
      </div>
    </div>
  );
}
