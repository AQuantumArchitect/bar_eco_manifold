import { useState, useMemo, useEffect } from 'react';

/**
 * Manages chart cursor state and derives picker values from it.
 *
 * The cursor is a { x, axis } hover position on a 2D slice chart.
 * When hovering a time/queue axis, the cursor snaps to econSnapshot states.
 * All "picker" values feed the sidebar, ConstructionPicker, and currentStats.
 *
 * @param {Object} params
 * @param {Object|null} params.simulation   - simulateBuildQueue result
 * @param {string}      params.sliceAxis    - current slice axis key
 * @param {string[]}    params.buildOrder   - current build order (to detect empty queue)
 * @param {Object}      params.liveState    - { bp, mInc, eInc, wind, tidal, spotValue } at queue end
 * @param {Object}      params.axesByKey    - axis config map (for cursorLabel fmt)
 *
 * @returns {{
 *   cursorState, setCursorState,
 *   gameTime, setGameTime,
 *   effectiveSliceAxis,
 *   pickerBP, pickerWind, pickerTidal, pickerSpot, pickerMInc, pickerEInc,
 *   cursorLabel,
 * }}
 */
export function useCursor({ simulation, sliceAxis, buildOrder, liveState, axesByKey }) {
  const [cursorState, setCursorState] = useState(null);
  const [gameTime, setGameTime]       = useState(0);

  // Reset cursor when slice axis changes.
  useEffect(() => { setCursorState(null); }, [sliceAxis]);

  // Interpolate econSnapshot at the hovered x position.
  const cursorSnap = useMemo(() => {
    if (!cursorState || (cursorState.axis !== 'queue' && cursorState.axis !== 'time') || !simulation) return null;
    let snap = simulation.econSnapshots[0];
    for (const s of simulation.econSnapshots) { if (s.atTime <= cursorState.x) snap = s; else break; }
    return snap;
  }, [cursorState, simulation]);

  // Sticky snap driven by the gameTime slider (persists when not hovering).
  const timeSnap = useMemo(() => {
    if (!simulation) return null;
    let snap = simulation.econSnapshots[0];
    for (const s of simulation.econSnapshots) { if (s.atTime <= gameTime) snap = s; else break; }
    return snap;
  }, [gameTime, simulation]);

  // Keep gameTime in sync with chart hover on time/queue axes.
  useEffect(() => {
    if (cursorState?.axis === 'time' || cursorState?.axis === 'queue') {
      setGameTime(cursorState.x);
    }
  }, [cursorState]);

  const effectiveSliceAxis = sliceAxis === 'queue' && buildOrder.length === 0 ? 'bp' : sliceAxis;
  const isTimeAxis = effectiveSliceAxis === 'time';

  const { bp: liveBP, mInc: liveMInc, eInc: liveEInc, wind, tidal, spotValue } = liveState;

  const pickerBP = cursorState?.axis === 'bp'    ? cursorState.x
    : cursorState?.axis === 'queue'  ? (cursorSnap?.bp   ?? liveBP)
    : cursorState?.axis === 'time'   ? (cursorSnap?.bp   ?? liveBP)
    : isTimeAxis && simulation       ? (timeSnap?.bp     ?? liveBP)
    : liveBP;

  const pickerWind  = cursorState?.axis === 'wind'  ? cursorState.x : wind;
  const pickerTidal = cursorState?.axis === 'tidal' ? cursorState.x : tidal;
  const pickerSpot  = cursorState?.axis === 'spot'  ? cursorState.x : spotValue;

  const pickerMInc = cursorState?.axis === 'mInc'   ? cursorState.x
    : cursorState?.axis === 'queue'  ? (cursorSnap?.mInc ?? liveMInc)
    : cursorState?.axis === 'time'   ? (cursorSnap?.mInc ?? liveMInc)
    : isTimeAxis && simulation       ? (timeSnap?.mInc   ?? liveMInc)
    : liveMInc;

  const pickerEInc = cursorState?.axis === 'eInc'   ? cursorState.x
    : cursorState?.axis === 'queue'  ? (cursorSnap?.eInc ?? liveEInc)
    : cursorState?.axis === 'time'   ? (cursorSnap?.eInc ?? liveEInc)
    : isTimeAxis && simulation       ? (timeSnap?.eInc   ?? liveEInc)
    : liveEInc;

  const cursorLabel = cursorState
    ? axesByKey[cursorState.axis]?.fmt?.(cursorState.x)
    : isTimeAxis && gameTime > 0
      ? `t=${Math.round(gameTime)}s`
      : null;

  return {
    cursorState, setCursorState,
    gameTime, setGameTime,
    effectiveSliceAxis,
    pickerBP, pickerWind, pickerTidal, pickerSpot, pickerMInc, pickerEInc,
    cursorLabel,
  };
}
