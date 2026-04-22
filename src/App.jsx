import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, ReferenceLine 
} from 'recharts';
import { 
  Waves, Wind, Hammer, Zap, Move, ShieldCheck, ShieldAlert, 
  Sun, Layers, ChevronRight, Activity 
} from 'lucide-react';

// VERIFIED BAR STATS (Metal, Work/Labor, Output)
const BAR_STATS = {
  Wind: { name: 'Wind Turbine', m: 37, l: 1603, color: 0x4CAF50, hex: '#4CAF50', t: 1 },
  Tidal: { name: 'Tidal Farm', m: 58, l: 1020, color: 0x00BCD4, hex: '#00BCD4', t: 1 },
  Solar: { name: 'Solar Collector', m: 155, l: 2600, o: 20, color: 0xFDD835, hex: '#FDD835', t: 1 },
  AdvSolar: { name: 'Adv. Solar', m: 350, l: 5000, o: 80, color: 0xFF9800, hex: '#FF9800', t: 1 },
  Fusion: { name: 'Fusion Reactor', m: 3350, l: 54000, o: 750, color: 0x2196F3, hex: '#2196F3', t: 2 },
  UWFusion: { name: 'U.W. Fusion', m: 3600, l: 66500, o: 800, color: 0x3F51B5, hex: '#3F51B5', t: 2 },
  AFUS: { name: 'AFUS', m: 9700, l: 312500, o: 3000, color: 0x9C27B0, hex: '#9C27B0', t: 2 },
  UWAFUS: { name: 'U.W. AFUS', m: 10500, l: 340000, o: 3200, color: 0x673AB7, hex: '#673AB7', t: 2 }
};

const M_TO_E = 70; 
const MIN_BP = 80; // Starting at T1 Constructor baseline
const MAX_BP = 40000;
const MAX_ROI_SLICE = 600; // Hard cap for 2D visualization

const logToBp = (val) => Math.exp(Math.log(MIN_BP) + (val / 100) * (Math.log(MAX_BP) - Math.log(MIN_BP)));
const bpToLog = (bp) => 100 * (Math.log(Math.max(MIN_BP, bp)) - Math.log(MIN_BP)) / (Math.log(MAX_BP) - Math.log(MIN_BP));

const ThreeDScene = ({ wind, tidal, bp, t2Enabled }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const surfacesRef = useRef({});
  const markerRef = useRef(null);
  const propsRef = useRef({ wind, tidal, bp, t2Enabled });

  useEffect(() => {
    propsRef.current = { wind, tidal, bp, t2Enabled };
  }, [wind, tidal, bp, t2Enabled]);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050810);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(12, 10, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;
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
    markerRef.current = markerSphere;

    const size = 20;
    const segments = 45;

    Object.entries(BAR_STATS).forEach(([key, s]) => {
      const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
      const material = new THREE.MeshPhongMaterial({
        color: s.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
        shininess: 40
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      surfacesRef.current[key] = mesh;
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 20, 10);
    scene.add(pointLight);

    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const { wind: wVal, tidal: tVal, bp: bpVal, t2Enabled: t2Val } = propsRef.current;
      
      Object.entries(surfacesRef.current).forEach(([key, mesh]) => {
        const s = BAR_STATS[key];
        const visible = s.t === 1 || t2Val;
        mesh.visible = visible;

        if (!visible) return;

        const positions = mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          const xPos = positions[i];
          const yPos = positions[i + 1];
          const curW = ((xPos + 10) / 20) * 20; 
          const curBP = Math.exp(((yPos + 10) / 20) * (Math.log(MAX_BP) - Math.log(MIN_BP)) + Math.log(MIN_BP));
          let output = s.o;
          if (key === 'Wind') output = Math.max(0.1, curW);
          if (key === 'Tidal') output = Math.max(0.1, tVal);
          const roi = (s.l / curBP) + (s.m * M_TO_E / output);
          positions[i + 2] = 10 - Math.min(roi / 50, 25); 
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      });

      const mX = (wVal / 20) * 20 - 10;
      const bpForMapping = Math.max(MIN_BP, bpVal);
      const mYPos = ((Math.log(bpForMapping) - Math.log(MIN_BP)) / (Math.log(MAX_BP) - Math.log(MIN_BP))) * 20 - 10;
      let bestROIAtMarker = Infinity;
      Object.keys(BAR_STATS).forEach(k => {
        const s = BAR_STATS[k];
        if (s.t === 2 && !t2Val) return;
        let out = s.o;
        if (k === 'Wind') out = Math.max(0.1, wVal);
        if (k === 'Tidal') out = Math.max(0.1, tVal);
        const r = (s.l / bpForMapping) + (s.m * M_TO_E / out);
        if (r < bestROIAtMarker) bestROIAtMarker = r;
      });

      if (markerRef.current) {
        markerRef.current.position.set(mX, 10 - (bestROIAtMarker / 50), -mYPos);
      }
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
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full rounded-xl overflow-hidden cursor-crosshair" />;
};

const SliceView = ({ wind, tidal, bp, t2Enabled, markers }) => {
  const data = useMemo(() => {
    const points = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const currentBp = logToBp((i / steps) * 100);
      const point = { bp: currentBp };
      Object.keys(BAR_STATS).forEach(key => {
        const s = BAR_STATS[key];
        if (s.t === 2 && !t2Enabled) return;
        let out = s.o;
        if (key === 'Wind') out = Math.max(0.1, wind);
        if (key === 'Tidal') out = Math.max(0.1, tidal);
        // We cap the value in the data to ensure lines don't fly off awkwardly
        const val = (s.l / currentBp) + (s.m * M_TO_E / out);
        point[key] = Math.min(val, MAX_ROI_SLICE + 100); 
      });
      points.push(point);
    }
    return points;
  }, [wind, tidal, t2Enabled]);

  return (
    <div className="w-full h-full p-4 bg-slate-950 flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis 
              dataKey="bp" 
              type="number" 
              domain={[MIN_BP, MAX_BP]} 
              scale="log" 
              stroke="#64748b" 
              label={{ value: 'Build Power (BP)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v)}
            />
            <YAxis 
              reversed 
              domain={[0, MAX_ROI_SLICE]} 
              allowDataOverflow={true} 
              stroke="#64748b" 
              label={{ value: 'ROI Time (Seconds)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              tick={{ fontSize: 10 }}
              ticks={[0, 100, 200, 300, 400, 500, 600]}
            />
            <RechartsTooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              labelFormatter={(v) => `Build Power: ${Math.round(v)}`}
              itemStyle={{ fontSize: '11px' }}
              formatter={(value) => [value > MAX_ROI_SLICE ? '>600s' : value.toFixed(1) + 's', 'ROI']}
            />
            <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '20px' }} />
            {Object.keys(BAR_STATS).map(key => {
              const s = BAR_STATS[key];
              if (s.t === 2 && !t2Enabled) return null;
              return (
                <Line 
                  key={key} 
                  type="monotone" 
                  dataKey={key} 
                  name={s.name} 
                  stroke={s.hex} 
                  dot={false} 
                  strokeWidth={2}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              );
            })}
            <ReferenceLine x={bp} stroke="#ffffff" strokeDasharray="5 5" label={{ value: 'You', fill: '#fff', fontSize: 10, position: 'top' }} />
            {markers.map(m => (
              <ReferenceLine key={m.label} x={m.val} stroke="#334155" strokeDasharray="2 2" label={{ value: m.label, fill: '#475569', fontSize: 8, position: 'bottom' }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const App = () => {
  const [wind, setWind] = useState(10);
  const [bp, setBP] = useState(300); 
  const [tidal, setTidal] = useState(15);
  const [t2Enabled, setT2Enabled] = useState(true);
  const [viewMode, setViewMode] = useState('3d');

  const currentStats = useMemo(() => {
    return Object.keys(BAR_STATS)
      .filter(key => BAR_STATS[key].t === 1 || t2Enabled)
      .map(key => {
        const s = BAR_STATS[key];
        let out = s.o;
        if (key === 'Wind') out = Math.max(0.1, wind);
        if (key === 'Tidal') out = Math.max(0.1, tidal);
        const constTime = s.l / Math.max(MIN_BP, bp);
        const payTime = (s.m * M_TO_E) / out;
        return { key, ...s, constTime, payTime, roi: constTime + payTime };
      }).sort((a, b) => a.roi - b.roi);
  }, [wind, tidal, bp, t2Enabled]);

  const markers = [
    { label: 'T1 Bot', val: 80 },
    { label: 'Commander', val: 300 },
    { label: '4 Nanos', val: 800 },
    { label: 'T2 Trans', val: 3000 },
    { label: 'Peak Ind.', val: 20000 }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans">
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
        
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-96 bg-slate-900 border-r border-white/10 p-6 flex flex-col gap-6 overflow-y-auto z-20 shadow-2xl">
          <header className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black italic tracking-tighter bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent uppercase">
                ROI Manifold
              </h1>
              <button 
                onClick={() => setT2Enabled(!t2Enabled)}
                className={`p-1.5 rounded-lg border transition-all duration-300 ${t2Enabled ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-slate-800 border-white/10 text-slate-500'}`}
              >
                {t2Enabled ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              </button>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Industrial Analysis v3.3</p>
          </header>

          <div className="space-y-4">
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
                    type="range" 
                    min="0" 
                    max="100" 
                    step="0.1"
                    value={bpToLog(bp)} 
                    onChange={e => setBP(logToBp(Number(e.target.value)))} 
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
            </div>

            <button 
              onClick={() => setT2Enabled(!t2Enabled)}
              className={`w-full py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${t2Enabled ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-slate-800 border-white/10 text-slate-500'}`}
            >
              {t2Enabled ? <Layers size={14} /> : <Sun size={14} />}
              {t2Enabled ? 'Hide T2 Structures' : 'Show T2 Structures'}
            </button>
          </div>

          <div className="mt-auto space-y-2">
            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2">
              <Zap size={10} className="text-yellow-500" /> Payback Velocity
            </h3>
            <div className="space-y-1.5">
              {currentStats.slice(0, 7).map((item, i) => (
                <div key={item.key} className={`group relative p-3 rounded-xl border transition-all duration-500 ${i === 0 ? 'bg-white/5 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-slate-900/50 border-white/5 opacity-60'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: item.hex }} />
                      <span className={`text-[11px] font-bold tracking-tight ${i === 0 ? 'text-white' : 'text-slate-400'}`}>{item.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-white">{Math.round(item.roi)}s</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Viewport Content */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          {/* View Mode Switcher */}
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
            </div>
          </div>

          <div className="flex-1">
            {viewMode === '3d' ? (
              <ThreeDScene wind={wind} tidal={tidal} bp={bp} t2Enabled={t2Enabled} />
            ) : (
              <SliceView wind={wind} tidal={tidal} bp={bp} t2Enabled={t2Enabled} markers={markers} />
            )}
          </div>

          {/* Bottom HUD */}
          <div className="bg-slate-900/95 border-t border-white/5 p-6 flex items-center justify-between shadow-2xl z-20">
            <div className="flex items-center gap-6">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10" style={{ color: currentStats[0].hex }}>
                <Zap size={32} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Peak Efficiency</p>
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-white tracking-tighter italic uppercase">
                    {bp < 5 ? "Stagnation" : currentStats[0].name}
                  </h2>
                  <ChevronRight size={16} className="text-slate-700" />
                  <div className="flex flex-col">
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-emerald-500/20">
                      {bp < 5 ? "∞ LAG" : Math.round(currentStats[0].roi) + "S PAYBACK"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-3 text-slate-500 font-mono text-[10px]">
               <div className="flex flex-col text-right">
                  <span>W: {wind}m/s</span>
                  <span>T: {tidal}m/s</span>
               </div>
               <div className="w-px h-6 bg-white/10" />
               <div className="flex flex-col">
                  <span>BP: {Math.round(bp)}</span>
                  <span>{t2Enabled ? 'T2+' : 'T1 ONLY'}</span>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;