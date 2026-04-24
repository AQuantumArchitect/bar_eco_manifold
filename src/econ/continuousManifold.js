import { DEFAULT_AXIS_RANGES, clamp, finiteOr } from './constants.js';
import { makeValueModel } from './defaultValueModel.js';
import { evaluateCandidate } from './evaluateCandidate.js';
import { metricValue } from './score.js';

export function interpolateAxis(axisConfig, t) {
  const cfg = typeof axisConfig === 'string' ? DEFAULT_AXIS_RANGES[axisConfig] : axisConfig;
  const [lo, hi] = cfg.range;
  const u = clamp(t, 0, 1);
  if (cfg.scale === 'log') {
    const safeLo = Math.max(1e-9, lo);
    const safeHi = Math.max(safeLo * 1.000001, hi);
    return Math.exp(Math.log(safeLo) + u * (Math.log(safeHi) - Math.log(safeLo)));
  }
  return lo + u * (hi - lo);
}

export function normalizeAxis(axis) {
  if (typeof axis === 'string') return { key: axis, ...DEFAULT_AXIS_RANGES[axis] };
  return { ...DEFAULT_AXIS_RANGES[axis.key], ...axis };
}

function setAxisValue(context, key, value) {
  const next = {
    initialState: { ...context.initialState },
    env: { ...context.env },
    valueModel: { ...context.valueModel },
  };

  if (['wind', 'tidal', 'spotValue'].includes(key)) next.env[key] = value;
  else if (['metalToEnergy', 'horizonSeconds', 'timeStep', 'terminalIncomeSeconds', 'buildPowerEnergyValuePerBP'].includes(key)) next.valueModel[key] = value;
  else if (key === 'buildPower') next.initialState.buildPower = value;
  else if (key === 'metalIncome') next.initialState.metalIncome = value;
  else if (key === 'energyIncome') next.initialState.energyIncome = value;
  else if (key === 'metalStored') next.initialState.metalStored = value;
  else if (key === 'energyStored') next.initialState.energyStored = value;
  else if (key === 'metalStorage') next.initialState.metalStorage = value;
  else if (key === 'energyStorage') next.initialState.energyStorage = value;
  else throw new Error(`Unknown manifold axis: ${key}`);

  return next;
}

export function makeContext(initialState, env, valueModel) {
  return {
    initialState: { ...initialState },
    env: { ...env },
    valueModel: makeValueModel(valueModel),
  };
}

export function evaluateAtPoint({ unit, initialState, env, valueModel, axisValues = {}, metric = 'netHorizonEV' }) {
  let ctx = makeContext(initialState, env, valueModel);
  for (const [key, value] of Object.entries(axisValues)) ctx = setAxisValue(ctx, key, value);
  const ev = evaluateCandidate(unit, ctx.initialState, ctx.env, ctx.valueModel);
  return { evaluation: ev, value: metricValue(ev, metric), context: ctx };
}

export function sampleUnitSurface({
  unit,
  initialState,
  env = {},
  valueModel = {},
  xAxis = 'wind',
  yAxis = 'buildPower',
  resolution = 40,
  metric = 'netHorizonEV',
  zTransform = defaultZTransform(metric),
}) {
  const xCfg = normalizeAxis(xAxis);
  const yCfg = normalizeAxis(yAxis);
  const rows = [];
  const vertices = [];
  const indices = [];
  const values = [];
  const evaluations = [];

  for (let yi = 0; yi <= resolution; yi += 1) {
    const yT = yi / resolution;
    const y = interpolateAxis(yCfg, yT);
    const row = [];
    for (let xi = 0; xi <= resolution; xi += 1) {
      const xT = xi / resolution;
      const x = interpolateAxis(xCfg, xT);
      const { evaluation, value } = evaluateAtPoint({
        unit, initialState, env, valueModel,
        axisValues: { [xCfg.key]: x, [yCfg.key]: y },
        metric,
      });
      const z = zTransform(value, evaluation);
      const point = { xi, yi, x, y, z, value, evaluation };
      row.push(point);
      values.push(value);
      evaluations.push(evaluation);
      vertices.push([xT * 20 - 10, z, yT * 20 - 10]);
    }
    rows.push(row);
  }

  const side = resolution + 1;
  for (let yi = 0; yi < resolution; yi += 1) {
    for (let xi = 0; xi < resolution; xi += 1) {
      const a = yi * side + xi;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      indices.push([a, c, b], [b, c, d]);
    }
  }

  return { kind: 'unitSurface', unitKey: unit.key, unitName: unit.name, metric, xAxis: xCfg, yAxis: yCfg, resolution, rows, vertices, indices, values, evaluations };
}

export function sampleBestCandidateSurface({
  unitsByKey,
  activeKeys = Object.keys(unitsByKey),
  initialState,
  env = {},
  valueModel = {},
  xAxis = 'wind',
  yAxis = 'buildPower',
  resolution = 40,
  metric = 'netHorizonEV',
  zTransform = defaultZTransform(metric),
}) {
  const xCfg = normalizeAxis(xAxis);
  const yCfg = normalizeAxis(yAxis);
  const rows = [];
  const vertices = [];
  const indices = [];
  const winners = [];

  for (let yi = 0; yi <= resolution; yi += 1) {
    const yT = yi / resolution;
    const y = interpolateAxis(yCfg, yT);
    const row = [];
    for (let xi = 0; xi <= resolution; xi += 1) {
      const xT = xi / resolution;
      const x = interpolateAxis(xCfg, xT);
      let best = null;
      for (const key of activeKeys) {
        const unit = { key, ...unitsByKey[key] };
        const sample = evaluateAtPoint({ unit, initialState, env, valueModel, axisValues: { [xCfg.key]: x, [yCfg.key]: y }, metric });
        const value = sample.value;
        const lowerIsBetter = ['simplePaybackSeconds', 'completionTime', 'stallSeconds'].includes(metric);
        const better = !best || (lowerIsBetter ? finiteOr(value) < finiteOr(best.value) : finiteOr(value, -Infinity) > finiteOr(best.value, -Infinity));
        if (better) best = { ...sample, unitKey: key };
      }
      const z = zTransform(best.value, best.evaluation);
      const point = { xi, yi, x, y, z, ...best };
      row.push(point);
      winners.push(best.unitKey);
      vertices.push([xT * 20 - 10, z, yT * 20 - 10]);
    }
    rows.push(row);
  }

  const side = resolution + 1;
  for (let yi = 0; yi < resolution; yi += 1) {
    for (let xi = 0; xi < resolution; xi += 1) {
      const a = yi * side + xi;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      indices.push([a, c, b], [b, c, d]);
    }
  }

  return { kind: 'bestCandidateSurface', metric, xAxis: xCfg, yAxis: yCfg, resolution, rows, vertices, indices, winners };
}

export function sampleVolume({
  unitsByKey,
  activeKeys = Object.keys(unitsByKey),
  initialState,
  env = {},
  valueModel = {},
  axes = ['wind', 'buildPower', 'metalIncome'],
  resolution = 16,
  metric = 'netHorizonEV',
}) {
  const cfgs = axes.map(normalizeAxis);
  const voxels = [];
  for (let zi = 0; zi <= resolution; zi += 1) {
    const z = interpolateAxis(cfgs[2], zi / resolution);
    for (let yi = 0; yi <= resolution; yi += 1) {
      const y = interpolateAxis(cfgs[1], yi / resolution);
      for (let xi = 0; xi <= resolution; xi += 1) {
        const x = interpolateAxis(cfgs[0], xi / resolution);
        const axisValues = { [cfgs[0].key]: x, [cfgs[1].key]: y, [cfgs[2].key]: z };
        let best = null;
        for (const key of activeKeys) {
          const unit = { key, ...unitsByKey[key] };
          const sample = evaluateAtPoint({ unit, initialState, env, valueModel, axisValues, metric });
          const lowerIsBetter = ['simplePaybackSeconds', 'completionTime', 'stallSeconds'].includes(metric);
          const better = !best || (lowerIsBetter ? finiteOr(sample.value) < finiteOr(best.value) : finiteOr(sample.value, -Infinity) > finiteOr(best.value, -Infinity));
          if (better) best = { ...sample, unitKey: key };
        }
        voxels.push({ xi, yi, zi, x, y, z, ...best });
      }
    }
  }
  return { kind: 'bestCandidateVolume', metric, axes: cfgs, resolution, voxels };
}

export function defaultZTransform(metric) {
  if (metric === 'netHorizonEV' || metric === 'score') {
    return (value) => clamp(Math.sign(value) * Math.log10(1 + Math.abs(finiteOr(value, 0))) * 2.0, -12, 12);
  }
  if (metric === 'simplePaybackSeconds' || metric === 'completionTime' || metric === 'stallSeconds') {
    return (value) => 10 - clamp(Math.log10(1 + finiteOr(value, 1e6)) * 4, 0, 24);
  }
  return (value) => clamp(Number(value) || 0, -10, 10);
}

export function flattenSurfaceForRecharts(surface) {
  return surface.rows.flatMap((row) => row.map((p) => ({
    x: p.x,
    y: p.y,
    z: p.z,
    value: p.value,
    unitKey: p.evaluation?.unitKey ?? p.unitKey,
    label: p.evaluation?.label,
  })));
}
