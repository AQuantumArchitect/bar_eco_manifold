import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

const MAX_ROI_SLICE = 600;

const ROI_FRAME_LABELS = {
  unified: 'Platonic ROI (s)',
  energy:  'E-Payback (s)',
  metal:   'M-Payback (s)',
  economy: 'Economy ROI (s)',
};

/**
 * 1D slice view: sweeps one axis, renders ROI curves for all active units.
 *
 * Props:
 *   unitsByKey    — unit catalog (key → { name, hex, tags, ... })
 *   evaluateFast  — (unit, wind, tidal, spotValue, bp, roiFrame, mInc, eInc) → number
 *   axesByKey     — axis config map (key → { label, range, scale, fmt })
 *   wind, tidal, bp, spotValue, mInc, eInc — current environment/economy values
 *   activeKeys    — Set of unit keys to display
 *   markers       — [ { label, val } ] reference lines on BP axis
 *   roiFrame      — 'unified' | 'energy' | 'metal' | 'economy'
 *   sliceAxis     — which axis is the free (x) axis
 *   initialBP     — when a queue exists, the starting BP (shows 'Start' ref line)
 *   simulation    — simulation result (for queue/time axes)
 *   gameTime      — current game time cursor (for time axis ref line)
 *   onCursorChange — ({ x, axis }) | null — hover callback
 */
export default function SliceChart({
  unitsByKey, evaluateFast, axesByKey,
  wind, tidal, bp, spotValue, mInc, eInc,
  activeKeys, markers = [], roiFrame, sliceAxis,
  initialBP, simulation, gameTime, onCursorChange,
}) {
  const isQueue = sliceAxis === 'queue' && simulation != null;
  const isTime  = sliceAxis === 'time';
  const timeRange  = isTime  ? [0, simulation?.totalTime ?? 1800] : null;
  const queueRange = isQueue ? [0, simulation.totalTime]          : null;

  const baseAxisCfg = axesByKey[sliceAxis] ?? axesByKey.bp;
  const axisCfg = isQueue ? { ...baseAxisCfg, range: queueRange }
                : isTime  ? { ...baseAxisCfg, range: timeRange  }
                : baseAxisCfg;

  const [bpLo, bpHi] = axesByKey.bp?.range ?? [80, 40000];
  const logToBp = t => Math.exp(Math.log(bpLo) + (t / 100) * (Math.log(bpHi) - Math.log(bpLo)));

  const mIncMin = axesByKey.mInc?.range[0] ?? 0.1;
  const eIncMin = axesByKey.eInc?.range[0] ?? 1;

  const data = useMemo(() => {
    const steps = 80;
    if (isQueue || isTime) {
      const econSnaps = simulation?.econSnapshots ?? [];
      const xMax = isTime ? timeRange[1] : simulation.totalTime;
      return Array.from({ length: steps + 1 }, (_, i) => {
        const xVal = (i / steps) * xMax;
        let snap = econSnaps[0] ?? { bp, mInc, eInc };
        for (const s of econSnaps) { if (s.atTime <= xVal) snap = s; else break; }
        const point = { x: xVal };
        activeKeys.forEach(key => {
          if (unitsByKey[key]?.tags?.includes('dance')) { point[key] = MAX_ROI_SLICE + 100; return; }
          const roi = evaluateFast(unitsByKey[key], wind, tidal, spotValue, snap.bp ?? bp, roiFrame, snap.mInc ?? mInc, snap.eInc ?? eInc);
          point[key] = isFinite(roi) ? Math.min(roi, MAX_ROI_SLICE + 100) : MAX_ROI_SLICE + 100;
        });
        return point;
      });
    }

    const [lo, hi] = axisCfg.range;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
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
        if (unitsByKey[key]?.tags?.includes('dance')) { point[key] = MAX_ROI_SLICE + 100; return; }
        const roi = evaluateFast(unitsByKey[key], windC, tidalC, spotC, bpC, roiFrame, mIncC, eIncC);
        point[key] = isFinite(roi) ? Math.min(roi, MAX_ROI_SLICE + 100) : MAX_ROI_SLICE + 100;
      });
      return point;
    });
  }, [wind, tidal, bp, activeKeys, spotValue, roiFrame, sliceAxis, mInc, eInc, simulation, isQueue, isTime, timeRange, unitsByKey, evaluateFast, axesByKey]);

  const yLabel = ROI_FRAME_LABELS[roiFrame] ?? 'ROI (s)';

  const refLineVal = (isQueue || isTime) ? null
    : sliceAxis === 'bp'    ? bp
    : sliceAxis === 'wind'  ? wind
    : sliceAxis === 'tidal' ? tidal
    : sliceAxis === 'spot'  ? spotValue
    : sliceAxis === 'mInc'  ? Math.max(mIncMin, mInc)
    : Math.max(eIncMin, eInc);

  const startRefLine = (sliceAxis === 'bp' && initialBP != null && Math.abs(initialBP - bp) > 1) ? initialBP : null;

  return (
    <div className="w-full h-full p-4 bg-slate-950 flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            onMouseMove={(s) => { if (s?.isTooltipActive && s?.activeLabel != null) onCursorChange?.({ x: Number(s.activeLabel), axis: sliceAxis }); }}
            onMouseLeave={() => onCursorChange?.(null)}>
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
              const u = unitsByKey[key];
              return (
                <Line key={key} type="monotone" dataKey={key} name={u.name} stroke={u.hex}
                  dot={false} strokeWidth={2} activeDot={{ r: 4 }} isAnimationActive={false} />
              );
            })}
            {refLineVal != null && (
              <ReferenceLine x={refLineVal} stroke="#ffffff" strokeDasharray="5 5"
                label={{ value: startRefLine ? 'Now' : 'You', fill: '#fff', fontSize: 10, position: 'top' }} />
            )}
            {startRefLine != null && (
              <ReferenceLine x={startRefLine} stroke="#64748b" strokeDasharray="3 3" strokeWidth={1}
                label={{ value: 'Start', fill: '#64748b', fontSize: 9, position: 'top' }} />
            )}
            {(isQueue || isTime) && simulation?.econSnapshots.slice(1).map((snap, i) => (
              <ReferenceLine key={i} x={snap.atTime} stroke="#1e3a5f" strokeDasharray="2 2"
                label={{ value: unitsByKey[snap.unitKey ?? snap.key]?.name?.split(' ').pop() ?? '', fill: '#334155', fontSize: 7, position: 'top' }} />
            ))}
            {isTime && gameTime > 0 && (
              <ReferenceLine x={gameTime} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2"
                label={{ value: 't', fill: '#818cf8', fontSize: 9, position: 'top' }} />
            )}
            {sliceAxis === 'bp' && markers.map(m => (
              <ReferenceLine key={m.label} x={m.val} stroke="#334155" strokeDasharray="2 2"
                label={{ value: m.label, fill: '#475569', fontSize: 8, position: 'bottom' }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
