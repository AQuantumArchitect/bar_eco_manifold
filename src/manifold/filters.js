import { TAGS } from '../data/barStats.js';

const noTags = () => Object.fromEntries(Object.keys(TAGS).map(k => [k, null]));

/** Unit filter chips after Reset: Cortex, T1, no geo vent. */
export const RESET_FILTERS = { ...noTags(), cortex: 'yes', t1: 'yes', georeq: 'no' };
