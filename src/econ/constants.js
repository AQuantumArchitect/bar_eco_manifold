export const DEFAULT_M_TO_E = 70;
export const EPS = 1e-9;
export const DEFAULT_TIME_STEP = 1;
export const DEFAULT_HORIZON_SECONDS = 300;

// UI sliders may have a minimum visible BP, but simulation math does not
// force stalled economies back up to a fake minimum. Display-only.
export const DISPLAY_MIN_BP = 80;
export const DEFAULT_MAX_BP = 40000;

export const DEFAULT_AXIS_RANGES = {
  wind:          { label: 'Wind',            range: [0, 20],       scale: 'linear', unit: 'E/s' },
  tidal:         { label: 'Tidal',           range: [0, 30],       scale: 'linear', unit: 'E/s' },
  spotValue:     { label: 'Metal Spot',      range: [0, 10],       scale: 'linear', unit: 'M/s' },
  buildPower:    { label: 'Build Power',     range: [1, 40000],    scale: 'log',    unit: 'BP' },
  metalIncome:   { label: 'Metal Income',    range: [0.1, 1000],   scale: 'log',    unit: 'M/s' },
  energyIncome:  { label: 'Energy Income',   range: [1, 100000],   scale: 'log',    unit: 'E/s' },
  metalStored:   { label: 'Stored Metal',    range: [0, 50000],    scale: 'linear', unit: 'M' },
  energyStored:  { label: 'Stored Energy',   range: [0, 1000000],  scale: 'linear', unit: 'E' },
  metalStorage:  { label: 'Metal Storage',   range: [100, 50000],  scale: 'log',    unit: 'M cap' },
  energyStorage: { label: 'Energy Storage',  range: [100, 1000000],scale: 'log',    unit: 'E cap' },
  horizonSeconds:{ label: 'Planning Horizon',range: [30, 1200],    scale: 'log',    unit: 's' },
  metalToEnergy: { label: 'M→E Value',       range: [10, 200],     scale: 'log',    unit: 'E/M' },
};

export function finiteOr(value, fallback = Infinity) {
  return Number.isFinite(value) ? value : fallback;
}

export function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

export function safeDiv(numerator, denominator, fallback = Infinity) {
  return Math.abs(denominator) <= EPS ? fallback : numerator / denominator;
}
