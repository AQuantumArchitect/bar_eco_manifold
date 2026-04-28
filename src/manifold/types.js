/**
 * Generic manifold types — JSDoc interfaces, no runtime code.
 *
 * A Manifold is a parameter space plus a function defined on it.
 * The BAR economics engine is one instantiation; any evaluation function
 * with bounded parameters can be wrapped in this interface.
 */

/**
 * @typedef {Object} AxisDef
 * @property {string}            key    - parameter key (matches Point property names)
 * @property {string}            label  - human-readable axis name
 * @property {[number, number]}  range  - [min, max] domain
 * @property {'linear'|'log'}    scale  - interpolation scale for sampling
 * @property {string}            [unit] - display unit string
 */

/**
 * @typedef {Object.<string, number>} Point
 * A point in parameter space: { wind: 8, buildPower: 300, metalIncome: 2, ... }
 */

/**
 * @typedef {Object} Encoder
 * @property {(result: any) => string}           getColor  - hex color for a result
 * @property {(result: any, key: string) => number} getMetric - scalar metric from result
 * @property {(result: any) => string}           getLabel  - short label for a result
 * @property {(results: any[]) => any[]}         getRank   - sort results best-first
 */

/**
 * @typedef {Object} Manifold
 * @property {AxisDef[]}                         axes          - the parameter space
 * @property {(unit: any, point: Point) => any}  evaluateFast  - analytical, live (no simulation)
 * @property {(unit: any, point: Point) => any}  evaluateFull  - simulation-backed, accurate
 * @property {Encoder}                           encode        - result → visual mapping
 * @property {Object.<string, any>}              unitsByKey    - unit catalog for this domain
 */

/**
 * @typedef {Object} Cursor
 * A cursor is a Point plus which axis is currently "free" (being swept by a view).
 * @property {Point}   values    - current parameter values at the cursor
 * @property {string}  [freeAxis] - axis currently being varied by the active view
 */

/**
 * @typedef {Object} PathStep
 * @property {string} key  - unit key
 * @property {string} id   - unique step id
 */

/**
 * @typedef {PathStep[]} Path
 * An ordered sequence of units to evaluate sequentially (the build queue).
 * A Path traces a trajectory through the manifold: each step moves the cursor.
 */
