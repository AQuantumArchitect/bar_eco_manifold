import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Waves, Wind, Hammer, Zap, Move, Activity, Pickaxe,
         GitCommit, Trash2, TrendingUp, AlertTriangle, LayoutList } from 'lucide-react';

import { BAR_STATS, TAGS } from '../data/barStats.js';
import { simulateBuildQueue } from '../econ/simulateBuildQueue.js';
import { correctedSimpleROI } from '../econ/debugLegacyROI.js';
import { evaluateCandidates } from '../econ/evaluateCandidate.js';
import { getIncomeStreams } from '../bar/income.js';
import { computeROI } from '../bar/computeROI.js';
import { classifyEvaluation } from '../bar/classify.js';
import { BAR_AXES } from '../bar/driver.js';
import EconCandidateTable from '../components/EconCandidateTable.jsx';

import SliceChart  from './views/SliceChart.jsx';
import Surface3D   from './views/Surface3D.jsx';
import PathChart   from './views/PathChart.jsx';
import { useCursor } from './hooks/useCursor.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CYCLE = { null: 'yes', yes: 'no', no: null };

const passesFilter = (unit, tagFilters) =>
  Object.entries(tagFilters).every(([tag, state]) => {
    if (!state) return true;
    return state === 'yes' ? unit.tags.includes(tag) : !unit.tags.includes(tag);
  });

const MIN_BP = 80;
const MAX_BP = 40000;

const M_INC_MIN = 0.1,  M_INC_MAX = 1000;
const E_INC_MIN = 1,    E_INC_MAX = 100000;
const logToMInc = v => v <= 0 ? 0 : Math.exp(Math.log(M_INC_MIN) + (v/100)*(Math.log(M_INC_MAX)-Math.log(M_INC_MIN)));
const mIncToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(M_INC_MIN,v))-Math.log(M_INC_MIN))/(Math.log(M_INC_MAX)-Math.log(M_INC_MIN));
const logToEInc = v => v <= 0 ? 0 : Math.exp(Math.log(E_INC_MIN) + (v/100)*(Math.log(E_INC_MAX)-Math.log(E_INC_MIN)));
const eIncToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(E_INC_MIN,v))-Math.log(E_INC_MIN))/(Math.log(E_INC_MAX)-Math.log(E_INC_MIN));

const M_STORE_MIN = 100,  M_STORE_MAX = 50000;
const E_STORE_MIN = 100,  E_STORE_MAX = 1000000;
const logToMStore = v => v <= 0 ? 0 : Math.exp(Math.log(M_STORE_MIN) + (v/100)*(Math.log(M_STORE_MAX)-Math.log(M_STORE_MIN)));
const mStoreToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(M_STORE_MIN,v))-Math.log(M_STORE_MIN))/(Math.log(M_STORE_MAX)-Math.log(M_STORE_MIN));
const logToEStore = v => v <= 0 ? 0 : Math.exp(Math.log(E_STORE_MIN) + (v/100)*(Math.log(E_STORE_MAX)-Math.log(E_STORE_MIN)));
const eStoreToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(E_STORE_MIN,v))-Math.log(E_STORE_MIN))/(Math.log(E_STORE_MAX)-Math.log(E_STORE_MIN));

const H_MIN = 30, H_MAX = 1200;
const logToHorizon = v => Math.round(Math.exp(Math.log(H_MIN) + (v/100)*(Math.log(H_MAX)-Math.log(H_MIN))));
const horizonToLog = v => Math.round(100*(Math.log(Math.max(H_MIN,v))-Math.log(H_MIN))/(Math.log(H_MAX)-Math.log(H_MIN)));

const logToBp = val => Math.exp(Math.log(MIN_BP) + (val / 100) * (Math.log(MAX_BP) - Math.log(MIN_BP)));
const bpToLog = bp  => 100 * (Math.log(Math.max(MIN_BP, bp)) - Math.log(MIN_BP)) / (Math.log(MAX_BP) - Math.log(MIN_BP));

const LABEL_COLORS = {
  eco:             'text-emerald-400',
  'build-power':   'text-purple-400',
  'factory-bp':    'text-orange-400',
  storage:         'text-blue-400',
  'geo-transition':'text-red-400',
  dance:           'text-indigo-400',
  strategic:       'text-slate-500',
  infeasible:      'text-slate-700',
};

const TAG_STYLES = {
  yes:  'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
  no:   'bg-red-500/20 border-red-500/40 text-red-400 line-through',
  null: 'bg-slate-800/60 border-white/10 text-slate-500',
};

const labelUnit = (unit, env) => {
  if (unit.tags?.includes('dance')) return 'dance';
  const { metalIncome, energyIncome } = getIncomeStreams(unit, env);
  if (energyIncome > 0 || metalIncome > 0) return 'eco';
  if ((unit.bp ?? 0) > 0) return unit.tags?.includes('factory') ? 'factory-bp' : 'build-power';
  if ((unit.mStore ?? 0) > 0 || (unit.eStore ?? 0) > 0) return 'storage';
  if (unit.tags?.includes('georeq')) return 'geo-transition';
  return 'strategic';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const TagFilter = ({ tagFilters, onToggle }) => (
  <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Unit Filter</p>
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(TAGS).map(([tag, { label, desc }]) => {
        const state = tagFilters[tag] ?? null;
        return (
          <button key={tag} title={desc} onClick={() => onToggle(tag)}
            className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider transition-all duration-150 ${TAG_STYLES[state ?? 'null']}`}>
            {state === 'yes' && '✓ '}{state === 'no' && '✗ '}{label}
          </button>
        );
      })}
    </div>
  </div>
);

const ConstructionPicker = ({ activeKeys, wind, tidal, spotValue, bp, horizonSeconds, metalToEnergy, buildOrder, addToBuildOrder, setBuildOrder, cursorLabel, danceSeconds }) => {
  const sorted = useMemo(() => {
    const env = { wind, tidal, spotValue };
    const vm = { metalToEnergy, horizonSeconds };
    return [...activeKeys].map(key => {
      const s = BAR_STATS[key];
      const isDance = s.tags?.includes('dance');
      const buildTime = isDance ? danceSeconds : s.l / Math.max(1, bp);
      const feasible = isDance || buildTime <= horizonSeconds;
      const label = feasible ? labelUnit(s, env) : 'infeasible';
      const payback = isDance ? Infinity : correctedSimpleROI(s, env, bp, vm);
      return { key, ...s, buildTime, feasible, label, payback, isDance };
    }).sort((a, b) => {
      if (a.isDance && !b.isDance) return 1;
      if (!a.isDance && b.isDance) return -1;
      return (isFinite(a.payback) ? a.payback : Infinity) - (isFinite(b.payback) ? b.payback : Infinity);
    });
  }, [activeKeys, wind, tidal, spotValue, bp, metalToEnergy, horizonSeconds, danceSeconds]);

  const shortName = name => name
    .replace(/^(?:Arm\.|Cor\.|Leg\.)\s*/, '')
    .replace(/^Adv\.\s*/, '+ ');

  return (
    <div className="shrink-0 border-b border-white/5 bg-slate-950 backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-2 pb-0.5">
        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
          <Zap size={8} className="text-yellow-700" />
          {cursorLabel
            ? <><span className="text-blue-400">@ {cursorLabel}</span><span className="text-slate-700"> · payback</span></>
            : 'Build Queue · Payback Sort'}
        </span>
        {buildOrder.length > 0 && (
          <button onClick={() => setBuildOrder([])}
            className="text-[8px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 flex items-center gap-1 transition-colors">
            <Trash2 size={8} /> Clear ({buildOrder.length})
          </button>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 px-4 pt-1" style={{ scrollbarWidth: 'none' }}
        onWheel={e => { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaY; }}>
        {sorted.length === 0 ? (
          <p className="text-[9px] text-slate-700 py-2">No units match filters.</p>
        ) : sorted.map((item, i) => {
          const isTop = i === 0 && item.feasible && isFinite(item.payback);
          const labelColor = LABEL_COLORS[item.label] ?? 'text-slate-600';
          const paybackStr = !item.feasible ? '> horizon'
            : item.isDance ? danceSeconds + 's wait'
            : !isFinite(item.payback) ? '∞'
            : Math.round(item.payback) + 's';
          return (
            <button key={item.key}
              onClick={() => addToBuildOrder(item.key)}
              title={`${item.name} · ${item.label} · ${paybackStr} · click to queue`}
              className={`flex-shrink-0 w-[80px] rounded-lg px-2 py-1.5 border text-left transition-all hover:scale-105 active:scale-95
                ${isTop
                  ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  : item.feasible
                    ? 'border-white/8 bg-slate-900/60 hover:border-white/20 hover:bg-slate-800/60'
                    : 'border-white/5 bg-slate-950/60 opacity-40'}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-px" style={{ backgroundColor: item.hex }} />
                <span className="text-[7px] font-black uppercase truncate leading-tight"
                  style={{ color: isTop ? item.hex : '#64748b' }}>
                  {shortName(item.name)}
                </span>
              </div>
              <span className={`text-[7px] font-bold uppercase tracking-wide block leading-tight ${labelColor}`}>
                {item.label}
              </span>
              <span className={`font-mono text-[9px] font-bold block ${isTop ? 'text-emerald-400' : item.feasible ? 'text-slate-500' : 'text-slate-700'}`}>
                {paybackStr}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Navigator ────────────────────────────────────────────────────────────────

export default function Navigator() {
  // ── Game / environment state ──
  const [wind, setWind]           = useState(8);
  const [bp, setBP]               = useState(300);
  const [tidal, setTidal]         = useState(20);
  const [spotValue, setSpotValue] = useState(1.8);
  const [mInc, setMInc]           = useState(2.0);
  const [eInc, setEInc]           = useState(25);
  const [mMax, setMMax]           = useState(1000);
  const [eMax, setEMax]           = useState(1000);
  const [mStart, setMStart]       = useState(1000);
  const [eStart, setEStart]       = useState(1000);

  // ── View / strategy state ──
  const [viewMode, setViewMode]           = useState('2d');
  const [roiFrame, setRoiFrame]           = useState('unified');
  const [freeAxis3d, setFreeAxis3d]       = useState('wind');
  const [sliceAxis, setSliceAxis]         = useState('bp');
  const [horizonSeconds, setHorizonSeconds] = useState(300);
  const [metalToEnergy, setMetalToEnergy] = useState(70);
  const [danceSeconds, setDanceSeconds]   = useState(30);
  const [tagFilters, setTagFilters]       = useState({
    ...Object.fromEntries(Object.keys(TAGS).map(k => [k, null])),
    cortex: 'yes',
  });

  // ── Build queue ──
  const [buildOrder, setBuildOrder] = useState([]);
  const nextBOId = useRef(0);

  const addToBuildOrder = (key) => {
    const extra = key === 'dance' ? { l: Math.round(danceSeconds * Math.max(1, Math.round(bp))) } : {};
    setBuildOrder(prev => [...prev, { key, id: nextBOId.current++, ...extra }]);
  };
  const removeFromBuildOrder = (idx) => setBuildOrder(prev => prev.filter((_, i) => i !== idx));
  const reorderBuildOrder    = (newOrder) => setBuildOrder(newOrder);

  const toggleTag = (tag) => setTagFilters(prev => ({ ...prev, [tag]: CYCLE[prev[tag] ?? 'null'] }));

  const DEFAULT_FILTERS = Object.fromEntries(Object.keys(TAGS).map(k => [k, null]));
  const resetAll = () => {
    setWind(8); setTidal(20); setSpotValue(1.8); setBP(300);
    setRoiFrame('unified'); setFreeAxis3d('wind'); setSliceAxis('bp');
    setTagFilters(DEFAULT_FILTERS);
    setBuildOrder([]);
    setMInc(2.0); setEInc(25); setMMax(1000); setEMax(1000); setMStart(1000); setEStart(1000);
    setHorizonSeconds(300); setMetalToEnergy(70); setDanceSeconds(30);
  };

  // ── Active unit set ──
  const activeKeys = useMemo(() =>
    new Set(Object.keys(BAR_STATS).filter(k => passesFilter(BAR_STATS[k], tagFilters))),
    [tagFilters]
  );

  // ── Simulation ──
  const simulation = useMemo(() => {
    if (buildOrder.length === 0) return null;
    const initialState = {
      buildPower: bp, metalIncome: mInc, energyIncome: eInc,
      metalStored: Math.min(mStart, mMax), energyStored: Math.min(eStart, eMax),
      metalStorage: mMax, energyStorage: eMax,
    };
    const queue = buildOrder.map(step => ({
      key: step.key, ...BAR_STATS[step.key],
      ...(step.l != null ? { l: step.l } : {}),
    }));
    const sim = simulateBuildQueue(initialState, queue, { wind, tidal, spotValue }, { horizonSeconds: 1800, timeStep: 1 });
    const lastCompletion = sim.completed.length > 0 ? sim.completed[sim.completed.length - 1].completedAt : 0;
    return {
      points: sim.timeline.filter(t => t.event !== 'coast').map(t => ({
        time: parseFloat(t.atTime.toFixed(1)),
        metal: parseFloat(t.metalStored.toFixed(1)),
        energy: parseFloat(t.energyStored.toFixed(1)),
      })),
      hadStall: sim.hadStall,
      totalTime: Math.ceil(lastCompletion),
      econSnapshots: sim.econSnapshots.map(s => ({
        atTime: s.atTime, bp: s.buildPower, mInc: s.metalIncome, eInc: s.energyIncome, key: s.unitKey ?? null,
      })),
      finalBP:  sim.finalState.buildPower,
      finalMMax: sim.finalState.metalStorage,
      finalEMax: sim.finalState.energyStorage,
      finalM:   sim.finalState.metalStored,
      finalE:   sim.finalState.energyStored,
      finalPM:  sim.finalState.metalIncome,
      finalPE:  sim.finalState.energyIncome,
    };
  }, [buildOrder, wind, tidal, bp, spotValue, mInc, eInc, mMax, eMax, mStart, eStart]);

  // ── Live economy (end of queue, or initial conditions if no queue) ──
  const liveBP      = simulation?.finalBP  ?? bp;
  const liveMInc    = simulation?.finalPM  ?? mInc;
  const liveEInc    = simulation?.finalPE  ?? eInc;
  const liveMMax    = simulation?.finalMMax ?? mMax;
  const liveEMax    = simulation?.finalEMax ?? eMax;
  const liveMStored = simulation?.finalM   ?? Math.min(mStart, mMax);
  const liveEStored = simulation?.finalE   ?? Math.min(eStart, eMax);

  const valueModel = useMemo(() => ({ metalToEnergy, horizonSeconds }), [metalToEnergy, horizonSeconds]);

  const evalState = useMemo(() => ({
    buildPower: liveBP, metalIncome: liveMInc, energyIncome: liveEInc,
    metalStored: liveMStored, energyStored: liveEStored,
    metalStorage: liveMMax, energyStorage: liveEMax,
  }), [liveBP, liveMInc, liveEInc, liveMStored, liveEStored, liveMMax, liveEMax]);

  // ── Cursor hook ──
  const {
    cursorState, setCursorState,
    gameTime, setGameTime,
    effectiveSliceAxis,
    pickerBP, pickerWind, pickerTidal, pickerSpot, pickerMInc, pickerEInc,
    cursorLabel,
  } = useCursor({
    simulation, sliceAxis, buildOrder,
    liveState: { bp: liveBP, mInc: liveMInc, eInc: liveEInc, wind, tidal, spotValue },
    axesByKey: BAR_AXES,
  });

  // Reset cursor also when switching view modes.
  useEffect(() => { setCursorState(null); }, [viewMode]);

  // ── Commit queue end-state as new initial conditions ──
  const applyToManifold = () => {
    if (!simulation) return;
    setBP(simulation.finalBP);
    setMInc(parseFloat(simulation.finalPM.toFixed(2)));
    setEInc(parseFloat(simulation.finalPE.toFixed(1)));
    setMMax(simulation.finalMMax);
    setEMax(simulation.finalEMax);
    setMStart(Math.round(simulation.finalM));
    setEStart(Math.round(simulation.finalE));
    setBuildOrder([]);
    setRoiFrame('economy');
    setViewMode('2d');
    setSliceAxis('bp');
  };

  // ── Sidebar stats (follows cursor) ──
  const currentStats = useMemo(() => {
    const env = { wind: pickerWind, tidal: pickerTidal, spotValue: pickerSpot };
    return [...activeKeys].map(key => {
      const s = BAR_STATS[key];
      const roi = computeROI(s, pickerWind, pickerTidal, pickerSpot, pickerBP, roiFrame, pickerMInc, pickerEInc);
      const label = labelUnit(s, env);
      return { key, ...s, roi, label };
    }).sort((a, b) => (isFinite(a.roi) ? a.roi : Infinity) - (isFinite(b.roi) ? b.roi : Infinity));
  }, [activeKeys, pickerWind, pickerTidal, pickerSpot, pickerBP, roiFrame, pickerMInc, pickerEInc]);

  // ── Full evaluations (expensive, only on Analysis tab) ──
  const evaluations = useMemo(() => {
    if (viewMode !== 'table') return [];
    return evaluateCandidates(BAR_STATS, [...activeKeys], evalState, { wind, tidal, spotValue }, valueModel, 'netHorizonEV');
  }, [viewMode, activeKeys, evalState, wind, tidal, spotValue, valueModel]);

  const markers = [
    { label: 'T1 Bot', val: 80 }, { label: 'Commander', val: 300 },
    { label: '4 Nanos', val: 800 }, { label: 'T2 Trans', val: 3000 },
    { label: 'Peak Ind.', val: 20000 },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans">
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden">

        {/* ── Sidebar ── */}
        <div className="w-full lg:w-80 bg-slate-900 border-r border-white/10 px-4 py-4 flex flex-col gap-3 overflow-y-auto z-20 shadow-2xl">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black italic tracking-tighter bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent uppercase">
                ROI Manifold
              </h1>
              <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold">Industrial Analysis v8.0</p>
            </div>
            <button onClick={resetAll}
              className="text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 border border-white/10 px-2 py-1 rounded-lg transition-colors">
              Reset
            </button>
          </div>

          {/* View Selection */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">View Selection</p>
            <div className="bg-slate-900/60 border border-white/5 p-1 rounded-lg flex gap-1">
              {[
                { id: '2d',        icon: <Activity size={12} />,   label: '2D Slice' },
                { id: 'waterfall', icon: <GitCommit size={12} />,  label: 'Waterfall' },
                { id: '3d',        icon: <Move size={12} />,       label: '3D Manifold' },
                { id: 'table',     icon: <LayoutList size={12} />, label: 'Analysis' },
              ].map(({ id, icon, label }) => (
                <button key={id} onClick={() => setViewMode(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all text-[9px] font-black uppercase tracking-wider
                    ${viewMode === id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ROI Frame + Axis */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">ROI Frame</p>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'unified', label: 'Infinite' }, { id: 'energy', label: 'E∞' },
                  { id: 'metal',   label: 'M∞' },       { id: 'economy', label: 'Economy' },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setRoiFrame(id)}
                    className={`py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all
                      ${roiFrame === id ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-slate-500 hover:text-slate-300'}`}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                {viewMode === '3d' ? '3D Free Axis' : viewMode === '2d' ? '2D X Axis' : 'Axis'}
              </p>
              <div className="flex flex-wrap gap-1">
                {(viewMode === '3d'
                  ? [
                      { id: 'wind', l: 'Wind' }, { id: 'tidal', l: 'Tidal' }, { id: 'spot', l: 'Spot' },
                      { id: 'mInc', l: 'M/s' },  { id: 'eInc', l: 'E/s' },
                      ...(simulation ? [{ id: 'time', l: 'Time' }] : []),
                    ]
                  : [
                      { id: 'bp',   l: 'BP' },  { id: 'wind',  l: 'Wind' }, { id: 'tidal', l: 'Tidal' },
                      { id: 'spot', l: 'Spot' }, { id: 'mInc',  l: 'M/s' }, { id: 'eInc',  l: 'E/s' },
                      { id: 'time', l: 'Time' },
                      ...(buildOrder.length > 0 ? [{ id: 'queue', l: 'Queue' }] : []),
                    ]
                ).map(({ id, l }) => {
                  const cur = viewMode === '3d' ? freeAxis3d : effectiveSliceAxis;
                  const set = viewMode === '3d' ? setFreeAxis3d : setSliceAxis;
                  return (
                    <button key={id} onClick={() => set(id)}
                      title={id === 'queue' ? 'ROI trajectory along your planned build order' : undefined}
                      className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all
                        ${cur === id
                          ? id === 'queue'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                          : 'border-white/5 text-slate-500 hover:text-slate-300'}`}
                    >{l}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Strategy Parameters */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Strategy Parameters</p>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Horizon</span>
                <span className="font-mono text-[11px] text-white">{horizonSeconds >= 60 ? (horizonSeconds/60).toFixed(0)+'m' : horizonSeconds+'s'}</span>
              </div>
              <input type="range" min="0" max="100" step="1" value={horizonToLog(horizonSeconds)}
                onChange={e => setHorizonSeconds(logToHorizon(Number(e.target.value)))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">M→E Rate</span>
                <span className="font-mono text-[11px] text-white">{metalToEnergy} E/M</span>
              </div>
              <input type="range" min="10" max="200" step="5" value={metalToEnergy}
                onChange={e => setMetalToEnergy(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Dance</span>
                <span className="font-mono text-[11px] text-white">{danceSeconds >= 60 ? (danceSeconds/60).toFixed(1)+'m' : danceSeconds+'s'}</span>
              </div>
              <input type="range" min="5" max="600" step="5" value={danceSeconds}
                onChange={e => setDanceSeconds(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>
          </div>

          {/* Map Conditions */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Map Conditions</p>
            {[
              { label: 'Wind',       icon: <Wind size={11}/>,    val: wind,      pickerVal: pickerWind,  set: setWind,      min:0, max:20, step:1,   fmt: v => v+' m/s',            color:'text-emerald-400', accent:'accent-emerald-500' },
              { label: 'Tidal',      icon: <Waves size={11}/>,   val: tidal,     pickerVal: pickerTidal, set: setTidal,     min:0, max:30, step:1,   fmt: v => v+' m/s',            color:'text-cyan-400',    accent:'accent-cyan-500' },
              { label: 'Metal Spot', icon: <Pickaxe size={11}/>, val: spotValue, pickerVal: pickerSpot,  set: setSpotValue, min:0, max:10, step:0.1, fmt: v => v.toFixed(1)+' M/s', color:'text-amber-400',   accent:'accent-amber-500' },
            ].map(({ label, icon, val, pickerVal, set, min, max, step, fmt, color, accent }) => {
              const isCursor = Math.abs(pickerVal - val) > 0.01;
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className={`flex items-center gap-1.5 ${color}`}>{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
                    <span className={`font-mono text-[11px] ${isCursor ? 'text-blue-300' : 'text-white'}`}>{fmt(pickerVal)}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={pickerVal}
                    onChange={e => { set(Number(e.target.value)); setCursorState(null); }}
                    className={`w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer ${accent}`} />
                </div>
              );
            })}
          </div>

          {/* Player Economy */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Player Economy</p>
            <div>
              <div className="flex justify-between items-center mb-1.5 text-purple-400">
                <div className="flex items-center gap-1.5"><Hammer size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">Build Power</span></div>
                <span className={`font-mono text-[11px] ${cursorState?.axis === 'bp' ? 'text-blue-300' : 'text-white'}`}>{Math.round(pickerBP)} BP</span>
              </div>
              <div className="relative h-5 flex items-center mb-5 mt-2">
                <input type="range" min="0" max="100" step="0.1"
                  value={bpToLog(pickerBP)} onChange={e => { setBP(logToBp(Number(e.target.value))); setCursorState(null); }}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 z-10" />
                {markers.map(m => (
                  <div key={m.label} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${bpToLog(m.val)}%` }}>
                    <div className="w-px h-full bg-white/20" />
                    <span className="absolute -bottom-4 left-0 -translate-x-1/2 text-[6px] text-slate-600 font-bold whitespace-nowrap">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5 text-amber-400"><Pickaxe size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">M-Income</span></div>
                <span className={`font-mono text-[11px] ${cursorState?.axis === 'mInc' ? 'text-blue-300' : 'text-white'}`}>{pickerMInc <= 0 ? '0' : pickerMInc >= 10 ? Math.round(pickerMInc) : pickerMInc.toFixed(1)} M/s</span>
              </div>
              <input type="range" min="0" max="100" step="0.5" value={mIncToLog(pickerMInc)}
                onChange={e => { setMInc(logToMInc(Number(e.target.value))); setCursorState(null); }}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5 text-yellow-400"><Zap size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">E-Income</span></div>
                <span className={`font-mono text-[11px] ${cursorState?.axis === 'eInc' ? 'text-blue-300' : 'text-white'}`}>{pickerEInc <= 0 ? '0' : pickerEInc >= 1000 ? (pickerEInc/1000).toFixed(1)+'k' : Math.round(pickerEInc)} E/s</span>
              </div>
              <input type="range" min="0" max="100" step="0.5" value={eIncToLog(pickerEInc)}
                onChange={e => { setEInc(logToEInc(Number(e.target.value))); setCursorState(null); }}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
            </div>
          </div>

          {/* Starting Resources */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Starting Resources</p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-amber-300"><Pickaxe size={10}/><span className="text-[9px] font-bold uppercase tracking-wider">Metal</span></div>
                <span className="font-mono text-[10px] text-white">
                  {mStart >= 1000 ? (mStart/1000).toFixed(1)+'k' : mStart} / {mMax >= 1000 ? (mMax/1000).toFixed(1)+'k' : mMax} M
                </span>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[7px] text-slate-600 uppercase w-6 shrink-0">cap</span>
                <input type="range" min="0" max="100" step="0.5" value={mStoreToLog(mMax)}
                  onChange={e => { const v = Math.round(logToMStore(Number(e.target.value))); setMMax(v); setMStart(s => Math.min(s, v)); }}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400" />
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[7px] text-slate-600 uppercase w-6 shrink-0">fill</span>
                <input type="range" min="0" max="100" step="0.5" value={mStoreToLog(mStart)}
                  onChange={e => setMStart(Math.min(Math.round(logToMStore(Number(e.target.value))), mMax))}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-300" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-yellow-300"><Zap size={10}/><span className="text-[9px] font-bold uppercase tracking-wider">Energy</span></div>
                <span className="font-mono text-[10px] text-white">
                  {eStart >= 1000 ? (eStart/1000).toFixed(1)+'k' : eStart} / {eMax >= 1000 ? (eMax/1000).toFixed(1)+'k' : eMax} E
                </span>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[7px] text-slate-600 uppercase w-6 shrink-0">cap</span>
                <input type="range" min="0" max="100" step="0.5" value={eStoreToLog(eMax)}
                  onChange={e => { const v = Math.round(logToEStore(Number(e.target.value))); setEMax(v); setEStart(s => Math.min(s, v)); }}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[7px] text-slate-600 uppercase w-6 shrink-0">fill</span>
                <input type="range" min="0" max="100" step="0.5" value={eStoreToLog(eStart)}
                  onChange={e => setEStart(Math.min(Math.round(logToEStore(Number(e.target.value))), eMax))}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-300" />
              </div>
            </div>
          </div>

          {/* Current Economy */}
          {simulation && (
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/20 space-y-2">
              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Current Economy</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'BP',  val: Math.round(liveBP),                                                color: 'text-purple-400' },
                  { label: 'M/s', val: liveMInc >= 10 ? Math.round(liveMInc) : liveMInc.toFixed(1),      color: 'text-amber-400' },
                  { label: 'E/s', val: liveEInc >= 1000 ? (liveEInc/1000).toFixed(1)+'k' : Math.round(liveEInc), color: 'text-yellow-400' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-slate-900/60 rounded-lg p-1.5 text-center">
                    <p className="text-[7px] text-slate-600 uppercase tracking-widest">{label}</p>
                    <p className={`font-mono text-[11px] font-bold ${color}`}>{val}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-400">Game Time</span>
                  <span className="font-mono text-[9px] text-white">{Math.round(gameTime)}s</span>
                </div>
                <input type="range" min="0" max={simulation.totalTime} step="1" value={Math.min(gameTime, simulation.totalTime)}
                  onChange={e => setGameTime(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
              </div>
            </div>
          )}

          {/* Payback Velocity */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-1.5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Zap size={9} className="text-yellow-700" /> Payback Velocity
            </p>
            {currentStats.length === 0 ? (
              <p className="text-[10px] text-slate-700">No units match filters.</p>
            ) : currentStats.map((item, i) => {
              const finite = isFinite(item.roi);
              const isTop = i === 0 && finite;
              return (
                <div key={item.key}
                  className={`flex items-center gap-2 rounded-lg border transition-all
                    ${isTop ? 'bg-white/5 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.06)]' : 'border-white/5 opacity-60'}`}>
                  <div className="flex-1 flex items-center gap-1.5 min-w-0 px-2 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                    <div className="min-w-0 flex-1">
                      <span className={`text-[10px] font-bold truncate block leading-tight ${isTop ? 'text-white' : 'text-slate-500'}`}>{item.name}</span>
                      <span className={`text-[7px] font-bold uppercase tracking-wide ${LABEL_COLORS[item.label] ?? 'text-slate-600'}`}>{item.label}</span>
                    </div>
                  </div>
                  <span className={`font-mono text-[10px] shrink-0 pr-2 ${finite ? (isTop ? 'text-emerald-400' : 'text-slate-500') : 'text-slate-700'}`}>
                    {finite ? Math.round(item.roi)+'s' : '∞'}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

        {/* ── Viewport ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          <div className="shrink-0 px-4 pt-3 pb-2 bg-slate-950/90 border-b border-white/5 backdrop-blur">
            <TagFilter tagFilters={tagFilters} onToggle={toggleTag} />
          </div>

          <ConstructionPicker
            activeKeys={activeKeys} wind={pickerWind} tidal={pickerTidal} spotValue={pickerSpot}
            bp={pickerBP} horizonSeconds={horizonSeconds} metalToEnergy={metalToEnergy}
            buildOrder={buildOrder} addToBuildOrder={addToBuildOrder} setBuildOrder={setBuildOrder}
            cursorLabel={cursorLabel} danceSeconds={danceSeconds}
          />

          <div className="flex-1 overflow-hidden">
            {viewMode === '3d' && (
              <Surface3D
                unitsByKey={BAR_STATS} evaluateFast={computeROI} axesByKey={BAR_AXES}
                wind={wind} tidal={tidal} bp={liveBP} spotValue={spotValue}
                mInc={liveMInc} eInc={liveEInc} activeKeys={activeKeys}
                roiFrame={roiFrame} freeAxis={freeAxis3d}
                simulation={simulation} gameTime={gameTime}
              />
            )}
            {viewMode === '2d' && (
              <SliceChart
                unitsByKey={BAR_STATS} evaluateFast={computeROI} axesByKey={BAR_AXES}
                wind={wind} tidal={tidal} bp={liveBP} spotValue={spotValue}
                mInc={liveMInc} eInc={liveEInc} activeKeys={activeKeys}
                markers={markers} roiFrame={roiFrame} sliceAxis={effectiveSliceAxis}
                initialBP={simulation ? bp : null}
                simulation={simulation} gameTime={gameTime}
                onCursorChange={setCursorState}
              />
            )}
            {viewMode === 'waterfall' && (
              <PathChart
                unitsByKey={BAR_STATS} buildOrder={buildOrder} simulation={simulation} bp={bp}
                removeStep={removeFromBuildOrder} reorderBuildOrder={reorderBuildOrder}
                onApplyToManifold={applyToManifold}
              />
            )}
            {viewMode === 'table' && (
              <div className="w-full h-full overflow-auto p-4 bg-slate-950">
                <EconCandidateTable
                  evaluations={evaluations} onPick={addToBuildOrder}
                  horizonSeconds={horizonSeconds} metalToEnergy={metalToEnergy}
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
