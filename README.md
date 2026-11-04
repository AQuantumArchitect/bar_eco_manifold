# ROI Manifold

**Live demo → https://bar-eco-manifold-production.up.railway.app/**

An interactive map of the economy in [Beyond All Reason](https://www.beyondallreason.info/) (BAR), the open-source RTS. Every economy building (wind, solar, fusion, mexes, storage, constructors, factories) has a payback time: how long until it has earned back its metal and energy cost, build time included. That time depends on your build power, your income, the map's wind/tidal/metal values and how far ahead you plan. The ROI Manifold treats those inputs as axes of a parameter space and draws payback across it. A 2D slice shows one axis, a 3D surface shows two, and a waterfall replays your queued builds through a resource-flow simulation. **Dance** is an idle step in the queue (wait and bank resources instead of building). Together with the **Time** axis, it shows how the best next build changes as the game goes on.

![2D slice: payback time for every Cortex economy building against build power](docs/slice-bp.png)

| 3D manifold | Waterfall with a build queue and trailing Dance |
|---|---|
| ![3D payback surface for Cortex economy buildings](docs/manifold-3d.png) | ![Resource-flow waterfall for an 8-step Cortex opener followed by a 1.5 minute Dance](docs/waterfall-dance.png) |

## What you can do

- **2D Slice:** payback (y) for every unit in the filter against one free axis (x): build power, wind, tidal, metal spot, M/s, E/s, game time, planning horizon, or position along your queue.
- **3D Manifold:** the same payback values as surfaces over two axes (build power plus a chosen free axis), rendered with Three.js.
- **Waterfall:** click buildings in the payback-sorted strip to queue them. A tick-by-tick simulation then plots metal and energy flow, marks stalls, and feeds the end-of-queue economy back into the charts.
- **ROI frames:** *Infinite* (metal and energy combined at the M→E rate), *E∞* / *M∞* (one resource only), and *Economy* (build power capped by what your income can sustain).
- **Analysis:** a table ranking every candidate by full simulated evaluation over the planning horizon.
- **Filters:** faction (Armada / Cortex / Legion), tech level, terrain and unit role.

## Run it locally

Requires Node 22 (see `engines` in `package.json`).

```bash
npm install
npm run dev        # Vite dev server
npm test           # econ unit tests (node:test, no extra deps)
npm run build      # static production build in dist/
npm run preview    # serve the build
```

There's also a headless-browser smoke check that loads the app and reports runtime errors. It needs `@playwright/test` installed globally:

```bash
./tools/check_app http://localhost:5173
```

## Architecture

The code has three layers. A generic manifold UI sits on top, a BAR-specific driver sits under it, and a pure economics engine sits at the bottom.

```
src/
├── manifold/          generic "parameter space + function" UI
│   ├── Navigator.jsx      app shell: controls, cursor, view switching
│   ├── hooks/useCursor.js single cursor shared by sliders, charts and picker
│   ├── views/             SliceChart (2D), Surface3D (Three.js), PathChart (waterfall)
│   └── types.js           JSDoc interfaces: Manifold, AxisDef, Cursor, Path
├── bar/               BAR driver: plugs the game into the manifold interface
│   ├── driver.js          BAR_AXES and createBarManifold()
│   ├── computeROI.js      fast analytical payback for live charts (4 ROI frames)
│   ├── income.js          wind / tidal / mex / fixed income per unit
│   └── classify.js        ECO / STORAGE / BUILD-POWER / ... labels
├── econ/              economics engine (plain JS, no React)
│   ├── simulateBuildQueue.js  time-stepped queue sim with stalls and storage caps
│   ├── evaluateCandidate.js   full candidate evaluation over a horizon
│   ├── continuousManifold.js  grid sampling of the best candidate across axes
│   └── ...                    state, scoring, value model, explanations
├── data/barStats.js   unit catalogue (costs, build time, output, tags, colours)
└── components/        EconCandidateTable (analysis view)
```

`manifold/` doesn't need to know it's drawing a game. It takes a `Manifold` (axes, evaluators, colour/label encoders and a unit catalogue), and `bar/driver.js` provides one for BAR. `econ/` is what `tests/econ.test.mjs` covers.

## Data

Unit stats in `src/data/barStats.js` come from the game's own Lua unit definitions in [beyond-all-reason/Beyond-All-Reason](https://github.com/beyond-all-reason/Beyond-All-Reason). Thanks to the BAR team and contributors.

- `tools/scrape_bar_units.py` downloads the Armada, Cortex and Legion economy, constructor and factory unit files from that repo's `master` branch and caches them in `tools/cache/` (gitignored).
- `tools/gen_bar_stats.py` turns the cache into the `BAR_STATS` block, adding colours and tags. Neither of those is game data.

```bash
python3 tools/scrape_bar_units.py
python3 tools/gen_bar_stats.py      # prints the generated block and a diff
```

Note: `gen_bar_stats.py --write` still targets the old location (`src/App.jsx`). The catalogue now lives in `src/data/barStats.js`, which also has a hand-added `dance` entry that the generator doesn't produce. Until the script is updated, paste its output in by hand.

The stats are a snapshot from whenever the scraper last ran, so they may not match the current game balance patch.

## Licence

Code: [MIT](LICENSE).

Unit data comes from the Beyond All Reason repository and is covered by that project's own licence terms, not by this repo's MIT licence. Whether redistributing it here is permitted hasn't been checked yet: **DARK**.
