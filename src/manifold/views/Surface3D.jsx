import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 3D surface manifold view using Three.js.
 * One plane mesh per unit; vertices displaced by evaluateFast score.
 * Y axis = build power (log scale); X axis = freeAxis (configurable).
 *
 * Props:
 *   unitsByKey   — unit catalog (key → { color, ... })
 *   evaluateFast — (unit, wind, tidal, spotValue, bp, roiFrame, mInc, eInc) → number
 *   axesByKey    — axis config map (key → { range, scale })
 *   wind, tidal, bp, spotValue, mInc, eInc — current values
 *   activeKeys   — Set of unit keys to render
 *   roiFrame     — 'unified' | 'energy' | 'metal' | 'economy'
 *   freeAxis     — which axis is swept on X
 *   simulation   — simulation result (for time axis support)
 *   gameTime     — current game time (marker position when freeAxis='time')
 */
export default function Surface3D({
  unitsByKey, evaluateFast, axesByKey,
  wind, tidal, bp, spotValue, mInc, eInc,
  activeKeys, roiFrame, freeAxis,
  simulation, gameTime,
}) {
  const mountRef = useRef(null);
  const propsRef = useRef({ wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, mInc, eInc, simulation, gameTime, unitsByKey, evaluateFast, axesByKey });

  useEffect(() => {
    propsRef.current = { wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, mInc, eInc, simulation, gameTime, unitsByKey, evaluateFast, axesByKey };
  }, [wind, tidal, bp, activeKeys, spotValue, roiFrame, freeAxis, mInc, eInc, simulation, gameTime, unitsByKey, evaluateFast, axesByKey]);

  useEffect(() => {
    if (!mountRef.current) return;
    const width  = mountRef.current.clientWidth;
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

    // Meshes are created from unitsByKey snapshot at mount time.
    // Visibility and Z-height are updated every frame from propsRef.
    const { unitsByKey: ukInit } = propsRef.current;
    Object.entries(ukInit).forEach(([key, u]) => {
      const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
      const material = new THREE.MeshPhongMaterial({
        color: u.color ?? 0x6366f1, side: THREE.DoubleSide, transparent: true, opacity: 0.35, shininess: 40,
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
      const {
        wind: wVal, tidal: tVal, bp: bpVal, activeKeys: ak,
        spotValue: sv, roiFrame: frame, freeAxis: fa,
        mInc: mI, eInc: eI, simulation: sim, gameTime: gt,
        unitsByKey: uk, evaluateFast: evalFn, axesByKey: axes,
      } = propsRef.current;

      const bpRange = axes.bp?.range ?? [80, 40000];
      const [bpLo, bpHi] = bpRange;

      const isTimeAxis = fa === 'time';
      const totalTime  = sim?.totalTime ?? 0;
      const econSnaps  = sim?.econSnapshots ?? [];

      const getSnapAt = (t) => {
        let snap = econSnaps[0] ?? { bp: bpVal, mInc: mI, eInc: eI };
        for (const s of econSnaps) { if (s.atTime <= t) snap = s; else break; }
        return snap;
      };

      // Determine X axis range and interpolators.
      const axisCfg = axes[fa];
      let xRange, freeAxisToVal, valToFreeAxis;
      if (isTimeAxis) {
        xRange = totalTime || 1;
        freeAxisToVal = t => t * xRange;
        valToFreeAxis = v => v / xRange;
      } else if (axisCfg?.scale === 'log') {
        const [lo, hi] = axisCfg.range;
        xRange = 1;
        freeAxisToVal = t => Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)));
        valToFreeAxis = v => (Math.log(Math.max(lo, v)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
      } else {
        xRange = axisCfg?.range[1] ?? 20;
        freeAxisToVal = t => t * xRange;
        valToFreeAxis = v => v / xRange;
      }

      Object.entries(surfaces).forEach(([key, mesh]) => {
        const u = uk[key];
        mesh.visible = ak.has(key);
        if (!mesh.visible) return;

        const positions = mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          const xPos = positions[i];
          const yPos = positions[i + 1];
          const curBP = Math.exp(((yPos + 10) / 20) * (Math.log(bpHi) - Math.log(bpLo)) + Math.log(bpLo));
          let windC = wVal, tidalC = tVal, spotC = sv, mIncC = mI, eIncC = eI;
          if (isTimeAxis) {
            const t = ((xPos + 10) / 20) * xRange;
            const snap = getSnapAt(t);
            mIncC = snap.mInc ?? mI;
            eIncC = snap.eInc ?? eI;
          } else {
            const xVal = freeAxisToVal((xPos + 10) / 20);
            if (fa === 'wind')  windC  = xVal;
            if (fa === 'tidal') tidalC = xVal;
            if (fa === 'spot')  spotC  = xVal;
            if (fa === 'mInc')  mIncC  = xVal;
            if (fa === 'eInc')  eIncC  = xVal;
          }
          const roi = evalFn(u, windC, tidalC, spotC, curBP, frame, mIncC, eIncC);
          positions[i + 2] = 10 - Math.min((isFinite(roi) ? roi : 1300) / 50, 25);
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      });

      let mX, mYPos;
      if (isTimeAxis) {
        const markerT  = Math.min(gt ?? 0, xRange);
        mX             = (markerT / xRange) * 20 - 10;
        const snap     = getSnapAt(markerT);
        const markerBP = Math.max(bpLo, snap.bp ?? bpVal);
        mYPos          = ((Math.log(markerBP) - Math.log(bpLo)) / (Math.log(bpHi) - Math.log(bpLo))) * 20 - 10;
      } else {
        const markerAxisVal = fa === 'wind' ? wVal : fa === 'tidal' ? tVal
          : fa === 'spot' ? sv : fa === 'mInc' ? mI : fa === 'eInc' ? eI : sv;
        mX    = valToFreeAxis(markerAxisVal) * 20 - 10;
        const bpForMapping = Math.max(bpLo, bpVal);
        mYPos = ((Math.log(bpForMapping) - Math.log(bpLo)) / (Math.log(bpHi) - Math.log(bpLo))) * 20 - 10;
      }

      let bestROI = Infinity;
      const snapNow = isTimeAxis ? getSnapAt(gt ?? 0) : null;
      ak.forEach(k => {
        const u = uk[k];
        const mIncNow = snapNow?.mInc ?? mI;
        const eIncNow = snapNow?.eInc ?? eI;
        const bpNow   = Math.max(bpLo, isTimeAxis ? (snapNow?.bp ?? bpVal) : bpVal);
        const r = evalFn(u, wVal, tVal, sv, bpNow, frame, mIncNow, eIncNow);
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
}
