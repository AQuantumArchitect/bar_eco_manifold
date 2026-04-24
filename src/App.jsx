import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area
} from 'recharts';
import { Waves, Wind, Hammer, Zap, Move, Activity, Pickaxe,
         GitCommit, Trash2, TrendingUp, AlertTriangle, LayoutList } from 'lucide-react';
import { BAR_STATS, TAGS } from './data/barStats.js';
import { simulateBuildQueue } from './econ/simulateBuildQueue.js';
import { getIncomeStreams } from './econ/income.js';
import { correctedSimpleROI } from './econ/debugLegacyROI.js';
import { evaluateCandidates } from './econ/evaluateCandidate.js';
import EconCandidateTable from './components/EconCandidateTable.jsx';

const CYCLE = { null: 'yes', yes: 'no', no: null };

const passesFilter = (unit, tagFilters) =>
  Object.entries(tagFilters).every(([tag, state]) => {
    if (!state) return true;
    return state === 'yes' ? unit.tags.includes(tag) : !unit.tags.includes(tag);
  });

const M_TO_E = 70;
const MIN_BP = 80;
const MAX_BP = 40000;
const MAX_ROI_SLICE = 600;

const M_INC_MIN = 0.1,  M_INC_MAX = 1000;
const E_INC_MIN = 1,    E_INC_MAX = 100000;
const logToMInc = v => v <= 0 ? 0 : Math.exp(Math.log(M_INC_MIN) + (v/100)*(Math.log(M_INC_MAX)-Math.log(M_INC_MIN)));
const mIncToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(M_INC_MIN,v))-Math.log(M_INC_MIN))/(Math.log(M_INC_MAX)-Math.log(M_INC_MIN));
const logToEInc = v => v <= 0 ? 0 : Math.exp(Math.log(E_INC_MIN) + (v/100)*(Math.log(E_INC_MAX)-Math.log(E_INC_MIN)));
const eIncToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(E_INC_MIN,v))-Math.log(E_INC_MIN))/(Math.log(E_INC_MAX)-Math.log(E_INC_MIN));

const M_STORE_MIN = 100,    M_STORE_MAX = 50000;
const E_STORE_MIN = 100,    E_STORE_MAX = 1000000;
const logToMStore = v => v <= 0 ? 0 : Math.exp(Math.log(M_STORE_MIN) + (v/100)*(Math.log(M_STORE_MAX)-Math.log(M_STORE_MIN)));
const mStoreToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(M_STORE_MIN,v))-Math.log(M_STORE_MIN))/(Math.log(M_STORE_MAX)-Math.log(M_STORE_MIN));
const logToEStore = v => v <= 0 ? 0 : Math.exp(Math.log(E_STORE_MIN) + (v/100)*(Math.log(E_STORE_MAX)-Math.log(E_STORE_MIN)));
const eStoreToLog = v => v <= 0 ? 0 : 100*(Math.log(Math.max(E_STORE_MIN,v))-Math.log(E_STORE_MIN))/(Math.log(E_STORE_MAX)-Math.log(E_STORE_MIN));

// Strategy parameter sliders
const H_MIN = 30, H_MAX = 1200;
const logToHorizon = v => Math.round(Math.exp(Math.log(H_MIN) + (v/100)*(Math.log(H_MAX)-Math.log(H_MIN))));
const horizonToLog = v => Math.round(100*(Math.log(Math.max(H_MIN,v))-Math.log(H_MIN))/(Math.log(H_MAX)-Math.log(H_MIN)));

// Unit classification (O(1), no simulation needed)
const LABEL_COLORS = {
  eco:             'text-emerald-400',
  'build-power':   'text-purple-400',
  'factory-bp':    'text-orange-400',
  storage:         'text-blue-400',
  'geo-transition':'text-red-400',
  strategic:       'text-slate-500',
  infeasible:      'text-slate-700',
};

const labelUnit = (unit, env) => {
  const { metalIncome, energyIncome } = getIncomeStreams(unit, env);
  if (energyIncome > 0 || metalIncome > 0) return 'eco';
  if ((unit.bp ?? 0) > 0) return unit.tags?.includes('factory') ? 'factory-bp' : 'build-power';
  if ((unit.mStore ?? 0) > 0 || (unit.eStore ?? 0) > 0) return 'storage';
  if (unit.tags?.includes('georeq')) return 'geo-transition';
  return 'strategic';
};

// ROI frames:
//   unified  — platonic: full cost vs combined income, nomBP assumed
//   energy   — full E cost vs energy income, nomBP assumed (M budget infinite)
//   metal    — full M cost vs metal income, nomBP assumed (E budget infinite)
//   economy  — income-capped effective BP: your income rate determines max sustainable
//              build speed per unit. Full cost is still repaid from unit output — not
//              discounted by background income during construction (that was the old bug).
const computeROI = (s, wind, tidal, spotValue, bp, roiFrame, mInc = 0, eInc = 0) => {
  const nomBP = Math.max(1, bp);
  const { metalIncome, energyIncome } = getIncomeStreams(s, { wind, tidal, spotValue });

  if (roiFrame === 'economy') {
    const sustM  = (s.m > 0 && mInc > 0) ? mInc * s.l / s.m : nomBP;
    const sustE  = (s.e > 0 && eInc > 0) ? eInc * s.l / s.e : nomBP;
    const effBP  = Math.max(1, Math.min(nomBP, sustM, sustE));
    const buildT = s.l / effBP;
    const income = metalIncome * M_TO_E + energyIncome;
    return income < 0.01 ? Infinity : buildT + (s.m * M_TO_E + s.e) / income;
  }

  const buildT = s.l / nomBP;
  switch (roiFrame) {
    case 'unified': {
      const income = metalIncome * M_TO_E + energyIncome;
      return income < 0.01 ? Infinity : buildT + (s.m * M_TO_E + s.e) / income;
    }
    case 'energy':
      return energyIncome < 0.01 ? Infinity : buildT + s.e / energyIncome;
    case 'metal':
      return metalIncome < 0.01 ? Infinity : buildT + s.m / metalIncome;
    default: return Infinity;
  }
};

// X-axis ranges for the 3D manifold's configurable free axis (linear mapping in 3D).
const AXIS_RANGES = { wind: 20, tidal: 30, spot: 10, mInc: M_INC_MAX, eInc: E_INC_MAX };

const logToBp = (val) => Math.exp(Math.log(MIN_BP) + (val / 100) * (Math.log(MAX_BP) - Math.log(MIN_BP)));
const bpToLog = (bp) => 100 * (Math.log(Math.max(MIN_BP, bp)) - Math.log(MIN_BP)) / (Math.log(MAX_BP) - Math.log(MIN_BP));

const TAG_STYLES = {
  yes: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
  no:  'bg-red-500/20 border-red-500/40 text-red-400 line-through',
  null:'bg-slate-800/60 border-white/10 text-slate-500',
};

const TagFilter = ({ tagFilters, onToggle }) => (
  <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Unit Filter</p>
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(TAGS).map(([tag, { label, desc }]) => {
        const state = tagFilters[tag] ?? null;
        return (
          <button
            key={tag}
            title={desc}
            onClick={() => onToggle(tag)}
            className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider transition-all duration-150 ${TAG_STYLES[state ?? 'null']}`}
          >
            {state === 'yes' && '✓ '}{state === 'no' && '✗ '}{label}
          </button>
        );
      })}
    </div>
  </div>
);

const ThreeDScene = ({ wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, simulatedBP, mInc, eInc }) => {
  const mountRef = useRef(null);
  const propsRef = useRef({ wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, simulatedBP, mInc, eInc });

  useEffect(() => {
    propsRef.current = { wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, simulatedBP, mInc, eInc };
  }, [wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, simulatedBP, mInc, eInc]);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050810);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(12, 10, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const grid = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
    grid.position.y = 10;
    scene.add(grid);

    const markerSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 })
    );
    scene.add(markerSphere);

    const size = 20;
    const segments = 45;
    const surfaces = {};

    Object.entries(BAR_STATS).forEach(([key, s]) => {
      const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
      const material = new THREE.MeshPhongMaterial({
        color: s.color, side: THREE.DoubleSide, transparent: true, opacity: 0.35, shininess: 40
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      surfaces[key] = mesh;
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 20, 10);
    scene.add(pointLight);

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const { wind: wVal, tidal: tVal, bp: bpVal, activeKeys: ak,
              spotValue: sv, roiFrame: frame, freeAxis: fa, simulatedBP: simBP,
              mInc: mI, eInc: eI } = propsRef.current;
      const markerBP = (simBP && simBP !== bpVal) ? simBP : bpVal;
      const xRange = AXIS_RANGES[fa] ?? 20;
      const freeAxisToVal = t => fa === 'mInc' ? logToMInc(t * 100)
        : fa === 'eInc' ? logToEInc(t * 100)
        : t * xRange;
      const valToFreeAxis = v => fa === 'mInc' ? mIncToLog(v) / 100
        : fa === 'eInc' ? eIncToLog(v) / 100
        : v / xRange;

      Object.entries(surfaces).forEach(([key, mesh]) => {
        const s = BAR_STATS[key];
        mesh.visible = ak.has(key);
        if (!mesh.visible) return;

        const positions = mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          const xPos = positions[i];
          const yPos = positions[i + 1];
          const xVal = freeAxisToVal((xPos + 10) / 20);
          const curBP = Math.exp(((yPos + 10) / 20) * (Math.log(MAX_BP) - Math.log(MIN_BP)) + Math.log(MIN_BP));
          const windC  = fa === 'wind'  ? xVal : wVal;
          const tidalC = fa === 'tidal' ? xVal : tVal;
          const spotC  = fa === 'spot'  ? xVal : sv;
          const mIncC  = fa === 'mInc'  ? xVal : mI;
          const eIncC  = fa === 'eInc'  ? xVal : eI;
          const roi = computeROI(s, windC, tidalC, spotC, curBP, frame, mIncC, eIncC);
          positions[i + 2] = 10 - Math.min((isFinite(roi) ? roi : 1300) / 50, 25);
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      });

      const markerAxisVal = fa === 'wind' ? wVal : fa === 'tidal' ? tVal
        : fa === 'spot' ? sv : fa === 'mInc' ? mI : fa === 'eInc' ? eI : sv;
      const mX = valToFreeAxis(markerAxisVal) * 20 - 10;
      const bpForMapping = Math.max(MIN_BP, markerBP);
      const mYPos = ((Math.log(bpForMapping) - Math.log(MIN_BP)) / (Math.log(MAX_BP) - Math.log(MIN_BP))) * 20 - 10;
      let bestROI = Infinity;
      ak.forEach(k => {
        const r = computeROI(BAR_STATS[k], wVal, tVal, sv, bpForMapping, frame, mI, eI);
        if (isFinite(r) && r < bestROI) bestROI = r;
      });

      markerSphere.position.set(mX, 10 - (bestROI / 50), -mYPos);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full rounded-xl overflow-hidden cursor-crosshair" />;
};

const SLICE_AXIS_CFG = {
  bp:    { label: 'Build Power (BP)',  range: [MIN_BP, MAX_BP],        scale: 'log',    fmt: v => v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v) },
  wind:  { label: 'Wind Speed (m/s)', range: [0, 20],                  scale: 'linear', fmt: v => v.toFixed(0) },
  tidal: { label: 'Tidal Speed (m/s)',range: [0, 30],                  scale: 'linear', fmt: v => v.toFixed(0) },
  spot:  { label: 'Metal Spot (M/s)', range: [0, 10],                  scale: 'linear', fmt: v => v.toFixed(1) },
  mInc:  { label: 'M-Income (M/s)',   range: [M_INC_MIN, M_INC_MAX],  scale: 'log',    fmt: v => v >= 10 ? Math.round(v)+'M/s' : v.toFixed(1) },
  eInc:  { label: 'E-Income (E/s)',   range: [E_INC_MIN, E_INC_MAX],  scale: 'log',    fmt: v => v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v) },
  queue: { label: 'Game Time (s)',     range: [0, 1],                   scale: 'linear', fmt: v => Math.round(v)+'s' },
};

const ROI_FRAME_LABELS = {
  unified: 'Platonic ROI (s)',
  energy:  'E-Payback (s)',
  metal:   'M-Payback (s)',
  economy: 'Economy ROI (s)',
};

const SliceView = ({ wind, tidal, bp, activeKeys, markers, spotValue, roiFrame, sliceAxis, simulatedBP, mInc, eInc, simulation }) => {
  const isQueue = sliceAxis === 'queue' && simulation != null;
  const queueRange = isQueue ? [0, simulation.totalTime] : null;
  const axisCfg = isQueue
    ? { ...SLICE_AXIS_CFG.queue, range: queueRange }
    : SLICE_AXIS_CFG[sliceAxis];

  const data = useMemo(() => {
    const steps = 80;
    if (isQueue) {
      const { econSnapshots, totalTime } = simulation;
      return Array.from({ length: steps + 1 }, (_, i) => {
        const xVal = (i / steps) * totalTime;
        let snap = econSnapshots[0];
        for (const s of econSnapshots) { if (s.atTime <= xVal) snap = s; else break; }
        const point = { x: xVal };
        activeKeys.forEach(key => {
          const roi = computeROI(BAR_STATS[key], wind, tidal, spotValue, snap.bp, roiFrame, snap.mInc, snap.eInc);
          point[key] = isFinite(roi) ? Math.min(roi, MAX_ROI_SLICE + 100) : MAX_ROI_SLICE + 100;
        });
        return point;
      });
    }
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const [lo, hi] = axisCfg.range;
      const xVal = sliceAxis === 'bp' ? logToBp(t * 100)
        : axisCfg.scale === 'log' ? Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)))
        : lo + t * (hi - lo);
      const windC  = sliceAxis === 'wind'  ? xVal : wind;
      const tidalC = sliceAxis === 'tidal' ? xVal : tidal;
      const spotC  = sliceAxis === 'spot'  ? xVal : spotValue;
      const bpC    = sliceAxis === 'bp'    ? xVal : bp;
      const mIncC  = sliceAxis === 'mInc'  ? xVal : mInc;
      const eIncC  = sliceAxis === 'eInc'  ? xVal : eInc;
      const point  = { x: xVal };
      activeKeys.forEach(key => {
        const roi = computeROI(BAR_STATS[key], windC, tidalC, spotC, bpC, roiFrame, mIncC, eIncC);
        point[key] = isFinite(roi) ? Math.min(roi, MAX_ROI_SLICE + 100) : MAX_ROI_SLICE + 100;
      });
      return point;
    });
  }, [wind, tidal, bp, activeKeys, spotValue, roiFrame, sliceAxis, mInc, eInc, simulation, isQueue]);

  const yLabel = ROI_FRAME_LABELS[roiFrame] ?? 'ROI (s)';

  const refLineVal = isQueue ? null
    : sliceAxis === 'bp'    ? bp
    : sliceAxis === 'wind'  ? wind
    : sliceAxis === 'tidal' ? tidal
    : sliceAxis === 'spot'  ? spotValue
    : sliceAxis === 'mInc'  ? Math.max(M_INC_MIN, mInc)
    : Math.max(E_INC_MIN, eInc);
  const simRefLine = (sliceAxis === 'bp' && simulatedBP && simulatedBP !== bp) ? simulatedBP : null;

  return (
    <div className="w-full h-full p-4 bg-slate-950 flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="x" type="number"
              domain={axisCfg.range} scale={axisCfg.scale} stroke="#64748b"
              label={{ value: axisCfg.label, position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }}
              tick={{ fontSize: 10 }} tickFormatter={axisCfg.fmt}
            />
            <YAxis
              reversed domain={[0, MAX_ROI_SLICE]} allowDataOverflow stroke="#64748b"
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              tick={{ fontSize: 10 }} ticks={[0, 100, 200, 300, 400, 500, 600]}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              labelFormatter={(v) => `${axisCfg.label}: ${axisCfg.fmt(v)}`}
              itemStyle={{ fontSize: '11px' }}
              formatter={(value) => [value > MAX_ROI_SLICE ? '∞' : value.toFixed(1) + 's', yLabel]}
            />
            <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '20px' }} />
            {[...activeKeys].map(key => {
              const s = BAR_STATS[key];
              return (
                <Line key={key} type="monotone" dataKey={key} name={s.name} stroke={s.hex}
                  dot={false} strokeWidth={2} activeDot={{ r: 4 }} isAnimationActive={false} />
              );
            })}
            {refLineVal != null && (
              <ReferenceLine x={refLineVal} stroke="#ffffff" strokeDasharray="5 5"
                label={{ value: simRefLine ? 'Now' : 'You', fill: '#fff', fontSize: 10, position: 'top' }} />
            )}
            {simRefLine && (
              <ReferenceLine x={simRefLine} stroke="#34d399" strokeWidth={2}
                label={{ value: 'After', fill: '#34d399', fontSize: 10, position: 'top' }} />
            )}
            {isQueue && simulation.econSnapshots.slice(1).map((snap, i) => (
              <ReferenceLine key={i} x={snap.atTime} stroke="#1e3a5f" strokeDasharray="2 2"
                label={{ value: BAR_STATS[snap.key]?.name.split(' ').pop() ?? '', fill: '#334155', fontSize: 7, position: 'top' }} />
            ))}
            {sliceAxis === 'bp' && markers.map(m => (
              <ReferenceLine key={m.label} x={m.val} stroke="#334155" strokeDasharray="2 2"
                label={{ value: m.label, fill: '#475569', fontSize: 8, position: 'bottom' }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Horizontal scrolling unit picker — sorted by corrected simple payback, labeled by class.
// Uses correctedSimpleROI (full cost / own income, no background income discount).
const ConstructionPicker = ({ activeKeys, wind, tidal, spotValue, bp, horizonSeconds, metalToEnergy, buildOrder, addToBuildOrder, setBuildOrder }) => {
  const sorted = useMemo(() => {
    const env = { wind, tidal, spotValue };
    const vm = { metalToEnergy, horizonSeconds };
    return [...activeKeys].map(key => {
      const s = BAR_STATS[key];
      const buildTime = s.l / Math.max(1, bp);
      const feasible = buildTime <= horizonSeconds;
      const label = feasible ? labelUnit(s, env) : 'infeasible';
      const payback = correctedSimpleROI(s, env, bp, vm);
      return { key, ...s, buildTime, feasible, label, payback };
    }).sort((a, b) => (isFinite(a.payback) ? a.payback : Infinity) - (isFinite(b.payback) ? b.payback : Infinity));
  }, [activeKeys, wind, tidal, spotValue, bp, metalToEnergy, horizonSeconds]);

  const shortName = name => name
    .replace(/^(?:Arm\.|Cor\.|Leg\.)\s*/, '')
    .replace(/^Adv\.\s*/, '+ ');

  return (
    <div className="shrink-0 border-b border-white/5 bg-slate-950 backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-2 pb-0.5">
        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
          <Zap size={8} className="text-yellow-700" /> Build Queue · Payback Sort
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

// Simulation computed at App level; drag-and-drop reorder via HTML5 DnD API.
const WaterfallView = ({ buildOrder, simulation, removeStep, reorderBuildOrder, onApplyToManifold }) => {
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

      {/* ── Simulation ─────────────────────────────────────────────── */}
      {!simulation ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <GitCommit size={36} className="text-slate-700 mb-3 animate-pulse" />
          <p className="text-slate-600 text-xs max-w-xs leading-relaxed italic">
            Use the <span className="text-slate-400 font-bold not-italic">+</span> buttons in the Payback Velocity list to queue units — the simulation tracks resource flow and stall risk.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-slate-900/50 rounded-2xl border border-white/5 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2 flex-wrap">
              <TrendingUp size={12} /> Resource Flow
              <span className="font-mono text-slate-600 normal-case tracking-normal">
                · {simulation.totalTime}s · BP&nbsp;<span className="text-purple-400">{simulation.finalBP}</span>
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
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
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
                <Area type="monotone" dataKey="metal" stroke="#94a3b8" fill="url(#gradM)"
                  name="Metal" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="energy" stroke="#fbbf24" fill="url(#gradE)"
                  name="Energy" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Step queue (drag-to-reorder) ─────────────────────────── */}
      {buildOrder.length > 0 && (
        <div className="h-[80px] flex gap-2 overflow-x-auto shrink-0 py-1" style={{ scrollbarWidth: 'none' }}
          onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>
          {buildOrder.map((step, idx) => {
            const s = BAR_STATS[step.key];
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
                    : 'bg-slate-900 border border-white/10'}`}
              >
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Step {idx + 1}</span>
                <span className="text-[9px] font-black uppercase truncate leading-tight" style={{ color: s.hex }}>{s.name}</span>
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
};

const App = () => {
  const [wind, setWind] = useState(8);
  const [bp, setBP] = useState(300);
  const [tidal, setTidal] = useState(20);
  const [spotValue, setSpotValue] = useState(1.8);
  const [viewMode, setViewMode] = useState('2d');
  const [roiFrame, setRoiFrame] = useState('unified');
  const [freeAxis3d, setFreeAxis3d] = useState('wind');
  const [sliceAxis, setSliceAxis] = useState('bp');
  const [tagFilters, setTagFilters] = useState(Object.fromEntries(Object.keys(TAGS).map(k => [k, null])));

  // Waterfall / build order state
  const [buildOrder, setBuildOrder] = useState([]);
  const [mInc, setMInc] = useState(2.0);
  const [eInc, setEInc] = useState(25);
  const [mMax, setMMax] = useState(1000);
  const [eMax, setEMax] = useState(1000);
  const [mStart, setMStart] = useState(1000);
  const [eStart, setEStart] = useState(1000);
  const [horizonSeconds, setHorizonSeconds] = useState(300);
  const [metalToEnergy, setMetalToEnergy] = useState(70);
  const nextBOId = useRef(0);

  const addToBuildOrder = (key) => {
    setBuildOrder(prev => [...prev, { key, id: nextBOId.current++ }]);
  };
  const removeFromBuildOrder = (idx) => {
    setBuildOrder(prev => prev.filter((_, i) => i !== idx));
  };
  const reorderBuildOrder = (newOrder) => setBuildOrder(newOrder);

  const toggleTag = (tag) =>
    setTagFilters(prev => ({ ...prev, [tag]: CYCLE[prev[tag] ?? 'null'] }));

  const DEFAULT_FILTERS = Object.fromEntries(Object.keys(TAGS).map(k => [k, null]));
  const resetAll = () => {
    setWind(8); setTidal(20); setSpotValue(1.8); setBP(300);
    setRoiFrame('unified'); setFreeAxis3d('wind'); setSliceAxis('bp');
    setTagFilters(DEFAULT_FILTERS);
    setBuildOrder([]);
    setMInc(2.0); setEInc(25); setMMax(1000); setEMax(1000); setMStart(1000); setEStart(1000);
    setHorizonSeconds(300); setMetalToEnergy(70);
  };

  const activeKeys = useMemo(() =>
    new Set(Object.keys(BAR_STATS).filter(k => passesFilter(BAR_STATS[k], tagFilters))),
    [tagFilters]
  );

  // Simulation backed by the econ engine's simulateBuildQueue.
  // Stalling and overflow are captured naturally by the physics — no penalty multipliers.
  const simulation = useMemo(() => {
    if (buildOrder.length === 0) return null;

    const initialState = {
      buildPower: bp,
      metalIncome: mInc,
      energyIncome: eInc,
      metalStored: Math.min(mStart, mMax),
      energyStored: Math.min(eStart, eMax),
      metalStorage: mMax,
      energyStorage: eMax,
    };
    const queue = buildOrder.map(step => ({ key: step.key, ...BAR_STATS[step.key] }));
    const env = { wind, tidal, spotValue };

    const sim = simulateBuildQueue(initialState, queue, env, { horizonSeconds: 1800, timeStep: 1 });

    const lastCompletion = sim.completed.length > 0
      ? sim.completed[sim.completed.length - 1].completedAt
      : 0;

    const points = sim.timeline
      .filter(t => t.event !== 'coast')
      .map(t => ({
        time: parseFloat(t.atTime.toFixed(1)),
        metal: parseFloat(t.metalStored.toFixed(1)),
        energy: parseFloat(t.energyStored.toFixed(1)),
      }));

    const econSnapshots = sim.econSnapshots.map(s => ({
      atTime: s.atTime,
      bp: s.buildPower,
      mInc: s.metalIncome,
      eInc: s.energyIncome,
      key: s.unitKey ?? null,
    }));

    return {
      points,
      hadStall: sim.hadStall,
      totalTime: Math.ceil(lastCompletion),
      econSnapshots,
      finalBP: sim.finalState.buildPower,
      finalMMax: sim.finalState.metalStorage,
      finalEMax: sim.finalState.energyStorage,
      finalM: sim.finalState.metalStored,
      finalE: sim.finalState.energyStored,
      finalPM: sim.finalState.metalIncome,
      finalPE: sim.finalState.energyIncome,
    };
  }, [buildOrder, wind, tidal, bp, spotValue, mInc, eInc, mMax, eMax, mStart, eStart]);

  // Live economy — always reflects the current end-state of the build queue.
  // When no queue, these equal the slider values (initial conditions).
  const liveBP      = simulation?.finalBP  ?? bp;
  const liveMInc    = simulation?.finalPM  ?? mInc;
  const liveEInc    = simulation?.finalPE  ?? eInc;
  const liveMMax    = simulation?.finalMMax ?? mMax;
  const liveEMax    = simulation?.finalEMax ?? eMax;
  const liveMStored = simulation?.finalM   ?? Math.min(mStart, mMax);
  const liveEStored = simulation?.finalE   ?? Math.min(eStart, eMax);

  const valueModel = useMemo(() => ({ metalToEnergy, horizonSeconds }), [metalToEnergy, horizonSeconds]);

  // State object for the econ engine's evaluators.
  const evalState = useMemo(() => ({
    buildPower: liveBP,
    metalIncome: liveMInc,
    energyIncome: liveEInc,
    metalStored: liveMStored,
    energyStored: liveEStored,
    metalStorage: liveMMax,
    energyStorage: liveEMax,
  }), [liveBP, liveMInc, liveEInc, liveMStored, liveEStored, liveMMax, liveEMax]);

  // Commit build queue: make final state the new initial conditions, clear queue.
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

  // Payback Velocity — sorted by current ROI frame, enriched with unit classification.
  const currentStats = useMemo(() => {
    const env = { wind, tidal, spotValue };
    return [...activeKeys].map(key => {
      const s = BAR_STATS[key];
      const roi = computeROI(s, wind, tidal, spotValue, liveBP, roiFrame, liveMInc, liveEInc);
      const label = labelUnit(s, env);
      return { key, ...s, roi, label };
    }).sort((a, b) => (isFinite(a.roi) ? a.roi : Infinity) - (isFinite(b.roi) ? b.roi : Infinity));
  }, [activeKeys, wind, tidal, spotValue, liveBP, roiFrame, liveMInc, liveEInc]);

  // Full netHorizonEV evaluation — only computed when the Analysis view is shown.
  const evaluations = useMemo(() => {
    if (viewMode !== 'table') return [];
    return evaluateCandidates(BAR_STATS, [...activeKeys], evalState, { wind, tidal, spotValue }, valueModel, 'netHorizonEV');
  }, [viewMode, activeKeys, evalState, wind, tidal, spotValue, valueModel]);

  // If the build queue is cleared, fall back from queue axis automatically.
  const effectiveSliceAxis = sliceAxis === 'queue' && buildOrder.length === 0 ? 'bp' : sliceAxis;

  const markers = [
    { label: 'T1 Bot', val: 80 },
    { label: 'Commander', val: 300 },
    { label: '4 Nanos', val: 800 },
    { label: 'T2 Trans', val: 3000 },
    { label: 'Peak Ind.', val: 20000 },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans">
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="w-full lg:w-80 bg-slate-900 border-r border-white/10 px-4 py-4 flex flex-col gap-3 overflow-y-auto z-20 shadow-2xl">

          {/* Header */}
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
                { id: '2d',        icon: <Activity size={12} />,    label: '2D Slice' },
                { id: 'waterfall', icon: <GitCommit size={12} />,   label: 'Waterfall' },
                { id: '3d',        icon: <Move size={12} />,        label: '3D Manifold' },
                { id: 'table',     icon: <LayoutList size={12} />,  label: 'Analysis' },
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
                  { id: 'unified', label: 'Infinite' },
                  { id: 'energy',  label: 'E∞' },
                  { id: 'metal',   label: 'M∞' },
                  { id: 'economy', label: 'Economy' },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setRoiFrame(id)}
                    title={{ unified:'Platonic ROI — full cost vs output, infinite resources assumed', energy:'Energy cost & income only (infinite metal budget)', metal:'Metal cost & income only (infinite energy budget)', economy:'Income-capped effective BP: your M/E income rate sets max sustainable build speed. Full cost still repaid from unit output.' }[id]}
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
                  ? [{ id: 'wind', l: 'Wind' }, { id: 'tidal', l: 'Tidal' }, { id: 'spot', l: 'Spot' }, { id: 'mInc', l: 'M/s' }, { id: 'eInc', l: 'E/s' }]
                  : [
                      { id: 'bp',    l: 'BP' },
                      { id: 'wind',  l: 'Wind' },
                      { id: 'tidal', l: 'Tidal' },
                      { id: 'spot',  l: 'Spot' },
                      { id: 'mInc',  l: 'M/s' },
                      { id: 'eInc',  l: 'E/s' },
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
                <span className="font-mono text-[11px] text-white">
                  {horizonSeconds >= 60 ? (horizonSeconds/60).toFixed(0)+'m' : horizonSeconds+'s'}
                </span>
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
          </div>

          {/* Map Conditions */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Map Conditions</p>
            {[
              { label: 'Wind',       icon: <Wind size={11}/>,    val: wind,      set: setWind,      min:0, max:20, step:1,   fmt: v => v+' m/s',         color:'text-emerald-400', accent:'accent-emerald-500' },
              { label: 'Tidal',      icon: <Waves size={11}/>,   val: tidal,     set: setTidal,     min:0, max:30, step:1,   fmt: v => v+' m/s',         color:'text-cyan-400',    accent:'accent-cyan-500' },
              { label: 'Metal Spot', icon: <Pickaxe size={11}/>, val: spotValue, set: setSpotValue, min:0, max:10, step:0.1, fmt: v => v.toFixed(1)+' M/s', color:'text-amber-400',   accent:'accent-amber-500' },
            ].map(({ label, icon, val, set, min, max, step, fmt, color, accent }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className={`flex items-center gap-1.5 ${color}`}>{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
                  <span className="font-mono text-[11px] text-white">{fmt(val)}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => set(Number(e.target.value))}
                  className={`w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer ${accent}`} />
              </div>
            ))}
          </div>

          {/* Player Economy */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Player Economy</p>
            {/* Build Power */}
            <div>
              <div className="flex justify-between items-center mb-1.5 text-purple-400">
                <div className="flex items-center gap-1.5"><Hammer size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">Build Power</span></div>
                <span className="font-mono text-[11px] text-white">{Math.round(bp)} BP</span>
              </div>
              <div className="relative h-5 flex items-center mb-5 mt-2">
                <input type="range" min="0" max="100" step="0.1"
                  value={bpToLog(bp)} onChange={e => setBP(logToBp(Number(e.target.value)))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 z-10" />
                {markers.map(m => (
                  <div key={m.label} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${bpToLog(m.val)}%` }}>
                    <div className="w-px h-full bg-white/20" />
                    <span className="absolute -bottom-4 left-0 -translate-x-1/2 text-[6px] text-slate-600 font-bold whitespace-nowrap">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* M-Income */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5 text-amber-400"><Pickaxe size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">M-Income</span></div>
                <span className="font-mono text-[11px] text-white">{mInc <= 0 ? '0' : mInc >= 10 ? Math.round(mInc) : mInc.toFixed(1)} M/s</span>
              </div>
              <input type="range" min="0" max="100" step="0.5" value={mIncToLog(mInc)}
                onChange={e => setMInc(logToMInc(Number(e.target.value)))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
            </div>
            {/* E-Income */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5 text-yellow-400"><Zap size={11}/><span className="text-[10px] font-bold uppercase tracking-wider">E-Income</span></div>
                <span className="font-mono text-[11px] text-white">{eInc <= 0 ? '0' : eInc >= 1000 ? (eInc/1000).toFixed(1)+'k' : Math.round(eInc)} E/s</span>
              </div>
              <input type="range" min="0" max="100" step="0.5" value={eIncToLog(eInc)}
                onChange={e => setEInc(logToEInc(Number(e.target.value)))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
            </div>
          </div>

          {/* Starting Resources */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Starting Resources</p>
            {/* Metal */}
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
            {/* Energy */}
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

          {/* Current Economy — live state after build queue */}
          {simulation && (
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/20 space-y-2">
              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Current Economy</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'BP', val: Math.round(liveBP), color: 'text-purple-400' },
                  { label: 'M/s', val: liveMInc >= 10 ? Math.round(liveMInc) : liveMInc.toFixed(1), color: 'text-amber-400' },
                  { label: 'E/s', val: liveEInc >= 1000 ? (liveEInc/1000).toFixed(1)+'k' : Math.round(liveEInc), color: 'text-yellow-400' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-slate-900/60 rounded-lg p-1.5 text-center">
                    <p className="text-[7px] text-slate-600 uppercase tracking-widest">{label}</p>
                    <p className={`font-mono text-[11px] font-bold ${color}`}>{val}</p>
                  </div>
                ))}
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

        {/* ── Viewport ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Unit filter */}
          <div className="shrink-0 px-4 pt-3 pb-2 bg-slate-950/90 border-b border-white/5 backdrop-blur">
            <TagFilter tagFilters={tagFilters} onToggle={toggleTag} />
          </div>

          {/* Construction picker — horizontal scrolling, always economy-sorted by live economy */}
          <ConstructionPicker
            activeKeys={activeKeys} wind={wind} tidal={tidal} spotValue={spotValue}
            bp={liveBP} horizonSeconds={horizonSeconds} metalToEnergy={metalToEnergy}
            buildOrder={buildOrder} addToBuildOrder={addToBuildOrder} setBuildOrder={setBuildOrder}
          />

          {/* Main view — all manifold components use live economy (simulation final state when queue exists) */}
          <div className="flex-1 overflow-hidden">
            {viewMode === '3d' && (
              <ThreeDScene wind={wind} tidal={tidal} bp={liveBP} activeKeys={activeKeys}
                spotValue={spotValue} roiFrame={roiFrame} freeAxis={freeAxis3d}
                simulatedBP={null} mInc={liveMInc} eInc={liveEInc} />
            )}
            {viewMode === '2d' && (
              <SliceView wind={wind} tidal={tidal} bp={liveBP} activeKeys={activeKeys}
                markers={markers} spotValue={spotValue} roiFrame={roiFrame} sliceAxis={effectiveSliceAxis}
                simulatedBP={null} mInc={liveMInc} eInc={liveEInc} simulation={simulation} />
            )}
            {viewMode === 'waterfall' && (
              <WaterfallView
                buildOrder={buildOrder} simulation={simulation}
                removeStep={removeFromBuildOrder} reorderBuildOrder={reorderBuildOrder}
                onApplyToManifold={applyToManifold}
              />
            )}
            {viewMode === 'table' && (
              <div className="w-full h-full overflow-auto p-4 bg-slate-950">
                <EconCandidateTable
                  evaluations={evaluations}
                  onPick={addToBuildOrder}
                  horizonSeconds={horizonSeconds}
                  metalToEnergy={metalToEnergy}
                />
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default App;
