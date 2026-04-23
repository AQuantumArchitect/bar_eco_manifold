import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area
} from 'recharts';
import { Waves, Wind, Hammer, Zap, Move, ChevronRight, Activity, Pickaxe,
         GitCommit, Trash2, Plus, TrendingUp, AlertTriangle } from 'lucide-react';

// m: metal cost, e: energy build cost, l: buildtime (ticks), o: fixed E/s output,
// xm: metal extraction ratio vs arm T1 mex (0.001 base); variable units have no o/xm
const BAR_STATS = {
  Wind          : { name: 'Arm. Wind Turbine'        , m: 40    , e: 175   , l: 1600    , color: 0x4CAF50, hex: '#4CAF50', tags: ['t1', 'land', 'variable', 'armada'] },
  CorWind       : { name: 'Cor. Wind Turbine'        , m: 43    , e: 175   , l: 1680    , color: 0xEF9A9A, hex: '#EF9A9A', tags: ['t1', 'land', 'variable', 'cortex'] },
  LegWind       : { name: 'Leg. Wind Turbine'        , m: 45    , e: 175   , l: 1680    , color: 0x80CBC4, hex: '#80CBC4', tags: ['t1', 'land', 'variable', 'legion'] },
  Tidal         : { name: 'Arm. Tidal Generator'     , m: 90    , e: 200   , l: 2190    , color: 0x00BCD4, hex: '#00BCD4', tags: ['t1', 'naval', 'variable', 'armada'] },
  CorTidal      : { name: 'Cor. Tidal Generator'     , m: 85    , e: 250   , l: 2100    , color: 0xFFAB91, hex: '#FFAB91', tags: ['t1', 'naval', 'variable', 'cortex'] },
  LegTidal      : { name: 'Leg. Tidal Generator'     , m: 85    , e: 250   , l: 2100    , color: 0x80DEEA, hex: '#80DEEA', tags: ['t1', 'naval', 'variable', 'legion'] },
  Solar         : { name: 'Arm. Solar Collector'     , m: 155   , e: 0     , l: 2600    , o: 20,   color: 0xFDD835, hex: '#FDD835', tags: ['t1', 'land', 'armada'] },
  CorSolar      : { name: 'Cor. Solar Collector'     , m: 150   , e: 0     , l: 2800    , o: 20,   color: 0xEF5350, hex: '#EF5350', tags: ['t1', 'land', 'cortex'] },
  LegSolar      : { name: 'Leg. Solar Collector'     , m: 155   , e: 0     , l: 2800    , o: 20,   color: 0x26C6DA, hex: '#26C6DA', tags: ['t1', 'land', 'legion'] },
  AdvSolar      : { name: 'Arm. Adv. Solar'          , m: 350   , e: 5000  , l: 7950    , o: 80,   color: 0xFF9800, hex: '#FF9800', tags: ['t1', 'land', 'armada'] },
  CorAdvSolar   : { name: 'Cor. Adv. Solar'          , m: 370   , e: 4000  , l: 8150    , o: 80,   color: 0xE53935, hex: '#E53935', tags: ['t1', 'land', 'cortex'] },
  LegAdvSolar   : { name: 'Leg. Adv. Solar'          , m: 465   , e: 4080  , l: 13580   , o: 100,   color: 0x00ACC1, hex: '#00ACC1', tags: ['t1', 'land', 'legion'] },
  Geo           : { name: 'Arm. Geothermal'          , m: 560   , e: 13000 , l: 13100   , o: 300,   color: 0xE91E63, hex: '#E91E63', tags: ['t1', 'land', 'georeq', 'armada'] },
  CorGeo        : { name: 'Cor. Geothermal'          , m: 540   , e: 13000 , l: 12900   , o: 300,   color: 0xC62828, hex: '#C62828', tags: ['t1', 'land', 'georeq', 'cortex'] },
  LegGeo        : { name: 'Leg. Geothermal'          , m: 560   , e: 13000 , l: 12900   , o: 300,   color: 0x00838F, hex: '#00838F', tags: ['t1', 'land', 'georeq', 'legion'] },
  Fusion        : { name: 'Arm. Fusion Reactor'      , m: 3350  , e: 18000 , l: 54000   , o: 750,   color: 0x2196F3, hex: '#2196F3', tags: ['t2', 'land', 'armada'] },
  CorFusion     : { name: 'Cor. Fusion Reactor'      , m: 3600  , e: 22000 , l: 59000   , o: 850,   color: 0xBF360C, hex: '#BF360C', tags: ['t2', 'land', 'cortex'] },
  LegFusion     : { name: 'Leg. Fusion Reactor'      , m: 4000  , e: 25000 , l: 66000   , o: 950,   color: 0x006064, hex: '#006064', tags: ['t2', 'land', 'legion'] },
  AdvGeo        : { name: 'Arm. Adv. Geothermal'     , m: 1600  , e: 27000 , l: 50000   , o: 1250,   color: 0xF44336, hex: '#F44336', tags: ['t2', 'land', 'georeq', 'armada'] },
  CorAdvGeo     : { name: 'Cor. Adv. Geothermal'     , m: 1500  , e: 27000 , l: 48000   , o: 1250,   color: 0xB71C1C, hex: '#B71C1C', tags: ['t2', 'land', 'georeq', 'cortex'] },
  LegAdvGeo     : { name: 'Leg. Adv. Geothermal'     , m: 1600  , e: 27000 , l: 49950   , o: 1250,   color: 0x004D40, hex: '#004D40', tags: ['t2', 'land', 'georeq', 'legion'] },
  UWFusion      : { name: 'Arm. Naval Fusion'        , m: 5200  , e: 33500 , l: 99900   , o: 1200,   color: 0x3F51B5, hex: '#3F51B5', tags: ['t2', 'naval', 'armada'] },
  CorUWFusion   : { name: 'Cor. Naval Fusion'        , m: 5400  , e: 34000 , l: 105000  , o: 1220,   color: 0x880E4F, hex: '#880E4F', tags: ['t2', 'naval', 'cortex'] },
  AFUS          : { name: 'Arm. Adv. Fusion'         , m: 9700  , e: 69000 , l: 312500  , o: 3000,   color: 0x9C27B0, hex: '#9C27B0', tags: ['t2', 'land', 'armada'] },
  CorAFUS       : { name: 'Cor. Adv. Fusion'         , m: 9700  , e: 48000 , l: 329200  , o: 3000,   color: 0x4A148C, hex: '#4A148C', tags: ['t2', 'land', 'cortex'] },
  LegAFUS       : { name: 'Leg. Adv. Fusion'         , m: 10500 , e: 69000 , l: 340000  , o: 3300,   color: 0x1B5E20, hex: '#1B5E20', tags: ['t2', 'land', 'legion'] },

  Mex           : { name: 'Arm. T1 Mex'              , m: 50    , e: 500   , l: 1800    , xm: 1.0, color: 0xFFD54F, hex: '#FFD54F', tags: ['t1', 'land', 'mex', 'armada'] },
  CorMex        : { name: 'Cor. T1 Mex'              , m: 50    , e: 500   , l: 1870    , xm: 1.0, color: 0xFFCA28, hex: '#FFCA28', tags: ['t1', 'land', 'mex', 'cortex'] },
  LegMex        : { name: 'Leg. T1 Mex'              , m: 50    , e: 500   , l: 1880    , xm: 0.8, o: 7, color: 0xD4E157, hex: '#D4E157', tags: ['t1', 'land', 'mex', 'legion'] },
  LegMexT15     : { name: 'Leg. T1.5 Mex'            , m: 250   , e: 5000  , l: 5000    , xm: 2.0, color: 0xAFB42B, hex: '#AFB42B', tags: ['t1', 'land', 'mex', 'legion'] },
  Moho          : { name: 'Arm. Moho Mex'            , m: 620   , e: 7700  , l: 14900   , xm: 4.0, color: 0xFF8F00, hex: '#FF8F00', tags: ['t2', 'land', 'mex', 'armada'] },
  CorMoho       : { name: 'Cor. Moho Mex'            , m: 640   , e: 8100  , l: 14100   , xm: 4.0, color: 0xF57C00, hex: '#F57C00', tags: ['t2', 'land', 'mex', 'cortex'] },
  LegMoho       : { name: 'Leg. Moho Mex'            , m: 640   , e: 8100  , l: 14100   , xm: 4.0, color: 0x827717, hex: '#827717', tags: ['t2', 'land', 'mex', 'legion'] },
};

// Tag definitions — label shown in UI, desc for tooltip
const TAGS = {
  armada:   { label: 'Armada',   desc: 'Armada faction' },
  cortex:   { label: 'Cortex',   desc: 'Cortex faction' },
  legion:   { label: 'Legion',   desc: 'Legion faction' },
  t1:       { label: 'T1',       desc: 'Tier 1 structures' },
  t2:       { label: 'T2',       desc: 'Tier 2 structures' },
  land:     { label: 'Land',     desc: 'Buildable on land' },
  naval:    { label: 'Naval',    desc: 'Buildable on water' },
  variable: { label: 'Variable', desc: 'Output depends on map conditions' },
  georeq:   { label: 'Geo Vent', desc: 'Requires a geothermal vent' },
  mex:      { label: 'Mex',      desc: 'Metal extractor (uses spot value slider)' },
};

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

// Decompose unit income into independent metal and energy streams.
// metalIncome: M/s (mexes only); energyIncome: E/s (generators + Legion mex bonus).
const getIncomeStreams = (s, wind, tidal, spotValue) => {
  const metalIncome = s.xm ? s.xm * spotValue : 0;
  let energyIncome;
  if (s.xm != null) {
    energyIncome = s.o ?? 0;                          // Legion T1 mex has a bonus E/s
  } else if (s.tags.includes('variable')) {
    energyIncome = Math.max(0.1, s.tags.includes('naval') ? tidal : wind);
  } else {
    energyIncome = s.o ?? 0;
  }
  return { metalIncome, energyIncome };
};

// ROI frames:
//   unified  — (m×70 + e) cost vs (metal×70 + energy) income  [current behaviour]
//   energy   — e cost vs energy income only  ("infinite metal" budget)
//   metal    — m cost vs metal income only   ("infinite energy" budget)
//   dual     — both streams independent; binding constraint = max(ePay, mPay).
//              Only units with income on BOTH streams (Legion T1 mex) yield finite ROI.
const computeROI = (s, wind, tidal, spotValue, bp, roiFrame) => {
  const buildT = s.l / Math.max(MIN_BP, bp);
  const { metalIncome, energyIncome } = getIncomeStreams(s, wind, tidal, spotValue);

  switch (roiFrame) {
    case 'unified': {
      const income = metalIncome * M_TO_E + energyIncome;
      return income < 0.01 ? Infinity : buildT + (s.m * M_TO_E + s.e) / income;
    }
    case 'energy':
      return energyIncome < 0.01 ? Infinity : buildT + s.e / energyIncome;
    case 'metal':
      return metalIncome < 0.01 ? Infinity : buildT + s.m / metalIncome;
    case 'dual': {
      const ePay = energyIncome < 0.01 ? Infinity : s.e / energyIncome;
      const mPay = metalIncome  < 0.01 ? Infinity : s.m / metalIncome;
      return (!isFinite(ePay) || !isFinite(mPay)) ? Infinity : buildT + Math.max(ePay, mPay);
    }
    default: return Infinity;
  }
};

// X-axis ranges for the 3D manifold's configurable free axis.
const AXIS_RANGES = { wind: 20, tidal: 30, spot: 10 };

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

const ThreeDScene = ({ wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis }) => {
  const mountRef = useRef(null);
  const propsRef = useRef({ wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis });

  useEffect(() => {
    propsRef.current = { wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis };
  }, [wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis]);

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
              spotValue: sv, roiFrame: frame, freeAxis: fa } = propsRef.current;
      const xRange = AXIS_RANGES[fa] ?? 20;

      Object.entries(surfaces).forEach(([key, mesh]) => {
        const s = BAR_STATS[key];
        mesh.visible = ak.has(key);
        if (!mesh.visible) return;

        const positions = mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          const xPos = positions[i];
          const yPos = positions[i + 1];
          const xVal = ((xPos + 10) / 20) * xRange;
          const curBP = Math.exp(((yPos + 10) / 20) * (Math.log(MAX_BP) - Math.log(MIN_BP)) + Math.log(MIN_BP));
          const windC  = fa === 'wind'  ? xVal : wVal;
          const tidalC = fa === 'tidal' ? xVal : tVal;
          const spotC  = fa === 'spot'  ? xVal : sv;
          const roi = computeROI(s, windC, tidalC, spotC, curBP, frame);
          positions[i + 2] = 10 - Math.min((isFinite(roi) ? roi : 1300) / 50, 25);
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      });

      // Marker sphere: sit at current slider value on the free axis
      const markerAxisVal = fa === 'wind' ? wVal : fa === 'tidal' ? tVal : sv;
      const mX = (markerAxisVal / xRange) * 20 - 10;
      const bpForMapping = Math.max(MIN_BP, bpVal);
      const mYPos = ((Math.log(bpForMapping) - Math.log(MIN_BP)) / (Math.log(MAX_BP) - Math.log(MIN_BP))) * 20 - 10;
      let bestROI = Infinity;
      ak.forEach(k => {
        const r = computeROI(BAR_STATS[k], wVal, tVal, sv, bpForMapping, frame);
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
  bp:    { label: 'Build Power (BP)', range: [MIN_BP, MAX_BP], scale: 'log',    fmt: v => v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v) },
  wind:  { label: 'Wind Speed (m/s)', range: [0, 20],          scale: 'linear', fmt: v => v.toFixed(0) },
  tidal: { label: 'Tidal Speed (m/s)',range: [0, 30],          scale: 'linear', fmt: v => v.toFixed(0) },
  spot:  { label: 'Metal Spot (M/s)', range: [0, 10],          scale: 'linear', fmt: v => v.toFixed(1) },
};

const ROI_FRAME_LABELS = {
  unified: 'ROI (s)',
  energy:  'E-Payback (s)',
  metal:   'M-Payback (s)',
  dual:    'Dual Payback (s)',
};

const SliceView = ({ wind, tidal, bp, activeKeys, markers, spotValue, roiFrame, sliceAxis }) => {
  const axisCfg = SLICE_AXIS_CFG[sliceAxis];

  const data = useMemo(() => {
    const steps = 60;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const [lo, hi] = axisCfg.range;
      const xVal = sliceAxis === 'bp' ? logToBp(t * 100) : lo + t * (hi - lo);
      const windC  = sliceAxis === 'wind'  ? xVal : wind;
      const tidalC = sliceAxis === 'tidal' ? xVal : tidal;
      const spotC  = sliceAxis === 'spot'  ? xVal : spotValue;
      const bpC    = sliceAxis === 'bp'    ? xVal : bp;
      const point  = { x: xVal };
      activeKeys.forEach(key => {
        const roi = computeROI(BAR_STATS[key], windC, tidalC, spotC, bpC, roiFrame);
        point[key] = isFinite(roi) ? Math.min(roi, MAX_ROI_SLICE + 100) : MAX_ROI_SLICE + 100;
      });
      return point;
    });
  }, [wind, tidal, bp, activeKeys, spotValue, roiFrame, sliceAxis]);

  const yLabel = ROI_FRAME_LABELS[roiFrame] ?? 'ROI (s)';

  const refLineVal = sliceAxis === 'bp' ? bp
    : sliceAxis === 'wind' ? wind
    : sliceAxis === 'tidal' ? tidal : spotValue;

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
            <ReferenceLine x={refLineVal} stroke="#ffffff" strokeDasharray="5 5"
              label={{ value: 'You', fill: '#fff', fontSize: 10, position: 'top' }} />
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

// Second-by-second build order simulation.
// Drains metal and energy while constructing each step in sequence.
// Efficiency drops when storage hits zero and income can't cover drain rate (stall).
// On completion, unit's income (E/s and/or M/s) is added to the running total.
const WaterfallView = ({ buildOrder, wind, tidal, bp, spotValue, removeStep, mInc, eInc, mMax, eMax }) => {
  const simulation = useMemo(() => {
    const effectiveBP = Math.max(MIN_BP, bp);
    let cm = mMax, ce = eMax, time = 0;
    let pM = mInc, pE = eInc;
    let hadStall = false;
    const points = [{ time: 0, metal: parseFloat(cm.toFixed(1)), energy: parseFloat(ce.toFixed(1)) }];

    for (const step of buildOrder) {
      const s = BAR_STATS[step.key];
      const nomDur = s.l / effectiveBP;
      const mdR = nomDur > 0 ? s.m / nomDur : 0;  // M/s drain while building
      const edR = nomDur > 0 ? s.e / nomDur : 0;  // E/s drain while building
      let workRem = s.l;

      while (workRem > 0 && time < 1800) {
        time++;
        let eff = 1.0;
        if (cm <= 0 && mdR > 0 && pM < mdR) eff = Math.min(eff, pM / mdR);
        if (ce <= 0 && edR > 0 && pE < edR) eff = Math.min(eff, pE / edR);
        if (eff < 1.0) hadStall = true;
        cm = Math.max(0, Math.min(mMax, cm + pM - mdR * eff));
        ce = Math.max(0, Math.min(eMax, ce + pE - edR * eff));
        workRem -= effectiveBP * eff;
        if (workRem <= 0) {
          const { metalIncome, energyIncome } = getIncomeStreams(s, wind, tidal, spotValue);
          pM += metalIncome;
          pE += energyIncome;
        }
        if (time % 5 === 0 || workRem <= 0) {
          points.push({ time, metal: parseFloat(cm.toFixed(1)), energy: parseFloat(ce.toFixed(1)), stall: eff < 1.0 });
        }
      }
    }
    return { points, hadStall, totalTime: time };
  }, [buildOrder, wind, tidal, bp, spotValue, mInc, eInc, mMax, eMax]);

  if (buildOrder.length === 0) return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-8 text-center">
      <GitCommit size={48} className="text-slate-700 mb-4 animate-pulse" />
      <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Build Flow Simulation</h3>
      <p className="text-slate-600 text-xs max-w-xs leading-relaxed italic">
        Click <span className="text-slate-400 font-bold not-italic">+</span> on any unit in the payback list to queue it. The chart tracks metal and energy storage during construction and flags stall events.
      </p>
    </div>
  );

  const { points, hadStall, totalTime } = simulation;

  return (
    <div className="w-full h-full p-4 bg-slate-950 flex flex-col gap-3 overflow-hidden">
      <div className="flex-1 min-h-0 bg-slate-900/50 rounded-2xl border border-white/5 p-4 flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
            <TrendingUp size={12} /> Resource Flow
            <span className="font-mono text-slate-600 normal-case">· {totalTime}s total</span>
          </h4>
          {hadStall && (
            <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 animate-pulse">
              <AlertTriangle size={10} />
              <span className="text-[9px] font-bold uppercase">Stall Detected</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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

      {/* Step queue */}
      <div className="h-[72px] flex gap-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
        {buildOrder.map((step, idx) => {
          const s = BAR_STATS[step.key];
          return (
            <div key={step.id}
              className="flex-shrink-0 w-28 bg-slate-900 border border-white/10 rounded-xl p-2 flex flex-col justify-between relative group"
            >
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Step {idx + 1}</span>
              <span className="text-[9px] font-black uppercase truncate leading-tight" style={{ color: s.hex }}>
                {s.name}
              </span>
              <button
                onClick={() => removeStep(idx)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              >
                <Trash2 size={8} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const App = () => {
  const [wind, setWind] = useState(10);
  const [bp, setBP] = useState(300);
  const [tidal, setTidal] = useState(15);
  const [spotValue, setSpotValue] = useState(2.0);
  const [viewMode, setViewMode] = useState('3d');
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
  const nextBOId = useRef(0);

  const addToBuildOrder = (key) => {
    setBuildOrder(prev => [...prev, { key, id: nextBOId.current++ }]);
  };
  const removeFromBuildOrder = (idx) => {
    setBuildOrder(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleTag = (tag) =>
    setTagFilters(prev => ({ ...prev, [tag]: CYCLE[prev[tag] ?? 'null'] }));

  const activeKeys = useMemo(() =>
    new Set(Object.keys(BAR_STATS).filter(k => passesFilter(BAR_STATS[k], tagFilters))),
    [tagFilters]
  );

  const currentStats = useMemo(() => {
    return [...activeKeys].map(key => {
      const s = BAR_STATS[key];
      const roi = computeROI(s, wind, tidal, spotValue, bp, roiFrame);
      return { key, ...s, roi };
    })
    .sort((a, b) => (isFinite(a.roi) ? a.roi : Infinity) - (isFinite(b.roi) ? b.roi : Infinity));
  }, [activeKeys, wind, tidal, bp, spotValue, roiFrame]);

  const markers = [
    { label: 'T1 Bot', val: 80 },
    { label: 'Commander', val: 300 },
    { label: '4 Nanos', val: 800 },
    { label: 'T2 Trans', val: 3000 },
    { label: 'Peak Ind.', val: 20000 },
  ];

  const activeCount = Object.values(tagFilters).filter(Boolean).length;

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans">
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden">

        {/* Sidebar */}
        <div className="w-full lg:w-96 bg-slate-900 border-r border-white/10 p-6 flex flex-col gap-6 overflow-y-auto z-20 shadow-2xl">
          <header className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black italic tracking-tighter bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent uppercase">
                ROI Manifold
              </h1>
              {activeCount > 0 && (
                <button
                  onClick={() => setTagFilters(Object.fromEntries(Object.keys(TAGS).map(k => [k, null])))}
                  className="text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 border border-white/10 px-2 py-1 rounded-lg transition-colors"
                >
                  Clear {activeCount}
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Industrial Analysis v8.0</p>
          </header>

          <div className="space-y-4">
            <TagFilter tagFilters={tagFilters} onToggle={toggleTag} />

            {/* Analysis controls */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-3">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">ROI Frame</p>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'unified', label: 'Unified' },
                    { id: 'energy',  label: 'E∞' },
                    { id: 'metal',   label: 'M∞' },
                    { id: 'dual',    label: 'Dual' },
                  ].map(({ id, label }) => (
                    <button key={id} onClick={() => setRoiFrame(id)}
                      title={{ unified:'M×70+E cost vs unified income', energy:'Energy cost & income only (infinite metal)', metal:'Metal cost & income only (infinite energy)', dual:'Binding constraint: max(E-payback, M-payback)' }[id]}
                      className={`py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all
                        ${roiFrame === id ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-slate-500 hover:text-slate-300'}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  {viewMode === '3d' ? '3D Free Axis' : '2D X Axis'}
                </p>
                <div className="flex gap-1">
                  {(viewMode === '3d'
                    ? [{ id: 'wind', l: 'Wind' }, { id: 'tidal', l: 'Tidal' }, { id: 'spot', l: 'Spot' }]
                    : [{ id: 'bp', l: 'BP' }, { id: 'wind', l: 'Wind' }, { id: 'tidal', l: 'Tidal' }, { id: 'spot', l: 'Spot' }]
                  ).map(({ id, l }) => {
                    const cur = viewMode === '3d' ? freeAxis3d : sliceAxis;
                    const set = viewMode === '3d' ? setFreeAxis3d : setSliceAxis;
                    return (
                      <button key={id} onClick={() => set(id)}
                        className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all
                          ${cur === id ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'border-white/5 text-slate-500 hover:text-slate-300'}`}
                      >{l}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-2 text-emerald-400">
                  <div className="flex items-center gap-2">
                    <Wind size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Wind Speed</span>
                  </div>
                  <span className="font-mono text-xs text-white">{wind} m/s</span>
                </div>
                <input type="range" min="0" max="20" value={wind} onChange={e => setWind(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
              </div>

              <div className="p-4 bg-slate-800/40 rounded-xl border border-white/5 relative">
                <div className="flex justify-between items-center mb-2 text-purple-400">
                  <div className="flex items-center gap-2">
                    <Hammer size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Build Power (Log)</span>
                  </div>
                  <span className="font-mono text-xs text-white">{Math.round(bp)} BP</span>
                </div>
                <div className="relative h-6 flex items-center mb-6 mt-3">
                  <input
                    type="range" min="0" max="100" step="0.1"
                    value={bpToLog(bp)} onChange={e => setBP(logToBp(Number(e.target.value)))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 z-10"
                  />
                  {markers.map(m => (
                    <div key={m.label} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${bpToLog(m.val)}%` }}>
                      <div className="w-px h-full bg-white/20" />
                      <span className="absolute -bottom-5 left-0 -translate-x-1/2 text-[7px] text-slate-500 font-bold whitespace-nowrap bg-black/60 px-0.5 rounded tracking-tighter">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-2 text-cyan-400">
                  <div className="flex items-center gap-2">
                    <Waves size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Tidal Speed</span>
                  </div>
                  <span className="font-mono text-xs text-white">{tidal} m/s</span>
                </div>
                <input type="range" min="0" max="30" value={tidal} onChange={e => setTidal(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>

              <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-2 text-amber-400">
                  <div className="flex items-center gap-2">
                    <Pickaxe size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Metal Spot</span>
                  </div>
                  <span className="font-mono text-xs text-white">{spotValue.toFixed(1)} M/s</span>
                </div>
                <input type="range" min="0" max="10" step="0.1" value={spotValue} onChange={e => setSpotValue(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              </div>
            </div>

            {/* Starting resources for waterfall simulation */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <GitCommit size={10} /> Sim Starting State
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'M-Income', value: mInc, set: v => setMInc(parseFloat(v) || 0), step: '0.5', color: 'text-amber-300' },
                  { label: 'M-Storage', value: mMax, set: v => setMMax(parseInt(v) || 0), step: '100', color: 'text-amber-300' },
                  { label: 'E-Income', value: eInc, set: v => setEInc(parseFloat(v) || 0), step: '5', color: 'text-yellow-300' },
                  { label: 'E-Storage', value: eMax, set: v => setEMax(parseInt(v) || 0), step: '100', color: 'text-yellow-300' },
                ].map(({ label, value, set, step, color }) => (
                  <div key={label} className="bg-slate-900/60 rounded-lg p-2 border border-white/5">
                    <span className="text-[8px] font-bold text-slate-500 block mb-1 uppercase tracking-widest">{label}</span>
                    <input
                      type="number" step={step} min="0" value={value}
                      onChange={e => set(e.target.value)}
                      className={`w-full bg-transparent text-xs font-mono outline-none ${color}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payback velocity list */}
          <div className="mt-auto space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Zap size={10} className="text-yellow-500" /> Payback Velocity
              </h3>
              {buildOrder.length > 0 && (
                <button
                  onClick={() => setBuildOrder([])}
                  className="text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 border border-white/10 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Trash2 size={8} /> BO ({buildOrder.length})
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {currentStats.length === 0 ? (
                <p className="text-[10px] text-slate-600 px-1">No units match current filters.</p>
              ) : currentStats.map((item, i) => {
                const finite = isFinite(item.roi);
                const isTop = i === 0 && finite;
                return (
                  <div key={item.key} className={`p-3 rounded-xl border transition-all duration-500 ${isTop ? 'bg-white/5 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-slate-900/50 border-white/5 opacity-60'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                        <span className={`text-[11px] font-bold tracking-tight truncate ${isTop ? 'text-white' : 'text-slate-400'}`}>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className={`font-mono text-[10px] ${finite ? 'text-white' : 'text-slate-600'}`}>
                          {finite ? Math.round(item.roi) + 's' : '∞'}
                        </span>
                        <button
                          onClick={() => addToBuildOrder(item.key)}
                          title="Add to build order"
                          className="p-1 rounded bg-white/5 hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-all"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          <div className="absolute top-6 left-6 z-10 flex flex-col gap-4 pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur border border-white/10 p-1.5 rounded-xl shadow-2xl flex pointer-events-auto">
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${viewMode === '3d' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Move size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">3D Manifold</span>
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${viewMode === '2d' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Activity size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">2D Slice</span>
              </button>
              <button
                onClick={() => setViewMode('waterfall')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${viewMode === 'waterfall' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <GitCommit size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Waterfall</span>
              </button>
            </div>
          </div>

          <div className="flex-1">
            {viewMode === '3d' && (
              <ThreeDScene wind={wind} tidal={tidal} bp={bp} activeKeys={activeKeys}
                spotValue={spotValue} roiFrame={roiFrame} freeAxis={freeAxis3d} />
            )}
            {viewMode === '2d' && (
              <SliceView wind={wind} tidal={tidal} bp={bp} activeKeys={activeKeys}
                markers={markers} spotValue={spotValue} roiFrame={roiFrame} sliceAxis={sliceAxis} />
            )}
            {viewMode === 'waterfall' && (
              <WaterfallView
                buildOrder={buildOrder} wind={wind} tidal={tidal} bp={bp} spotValue={spotValue}
                removeStep={removeFromBuildOrder} mInc={mInc} eInc={eInc} mMax={mMax} eMax={eMax}
              />
            )}
          </div>

          {/* Bottom HUD */}
          <div className="bg-slate-900/95 border-t border-white/5 p-6 flex items-center justify-between shadow-2xl z-20">
            <div className="flex items-center gap-6">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10" style={{ color: currentStats[0]?.hex ?? '#64748b' }}>
                <Zap size={32} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Peak Efficiency</p>
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-white tracking-tighter italic uppercase">
                    {!currentStats[0] ? 'No Units' : bp < 5 ? 'Stagnation' : currentStats[0].name}
                  </h2>
                  <ChevronRight size={16} className="text-slate-700" />
                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-emerald-500/20">
                    {!currentStats[0] ? '—' : bp < 5 ? '∞ LAG'
                      : !isFinite(currentStats[0]?.roi) ? '∞ NO STREAM'
                      : Math.round(currentStats[0].roi) + 'S PAYBACK'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {buildOrder.length > 0 && viewMode !== 'waterfall' && (
                <button
                  onClick={() => setViewMode('waterfall')}
                  className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg hover:bg-yellow-500/20 transition-all"
                >
                  <GitCommit size={14} className="text-yellow-500" />
                  <span className="text-[9px] font-black uppercase text-yellow-500">Simulate {buildOrder.length} Steps</span>
                </button>
              )}
              <div className="hidden lg:flex items-center gap-3 text-slate-500 font-mono text-[10px]">
                <div className="flex flex-col text-right">
                  <span>W: {wind}m/s</span>
                  <span>T: {tidal}m/s</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col">
                  <span>BP: {Math.round(bp)}</span>
                  <span>Spot: {spotValue.toFixed(1)}M/s</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <span>{activeKeys.size}/{Object.keys(BAR_STATS).length} units</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
