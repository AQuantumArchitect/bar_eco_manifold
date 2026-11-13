# Portfolio handoff: bar-eco-manifold (movement update)

For The Broadcaster, to update `/fleet/bar-eco-manifold`. Filing the-broadcast issue (`portfolio: bar-eco-manifold (movement update)`) is Hobby Hub's job, not the builder's.

## Pitch

ROI Manifold is an interactive map of the economy in Beyond All Reason, the open-source RTS: it draws the payback time of every economy building across build power, income, map and time. The movement update adds distance: queued units now take time to travel, so you can see when a forward factory beats walking, and replay a whole Supreme Isthmus plan on a map and a waterfall.

## Links

- Live: https://bar.lukespooner.com
- Repo: https://github.com/AQuantumArchitect/bar_eco_manifold

## What changed

- **Movement & distance:** the build queue has `build` at a location, `move` along a route, and `reclaim` steps. A unit that has to travel is not available until it arrives; a lab built at the destination lands units with no transit. Reclaim returns metal only, in one lump when it completes. The waterfall draws depart/arrive/reclaim markers.
- **Map view:** Supreme Isthmus with all 16 start seats, a few named waypoints and a transit calculator (distance and travel time per unit).
- **Pond amphibious Turtle push (showcase):** one button in the intro loads a scenario where an Armada support seat builds a lab at the landlocked crater lake, walks amphibious Turtles across the north-west sea and builds a forward Amphibious Complex on the enemy beach. Non-amphibious ships are blocked from leaving the lake.

## Screenshots

These predate the UI feedback pass in #25 (step labels, T1.5 mex removal, Reset defaults, views open at the start of the tape); no `m9-*` set existed when this was written. Swap them if #25 ships screenshots first.

- `docs/screenshots/m6-pond-map-desktop.png`: Map view, the Pond Turtle route with the transit calculator
- `docs/screenshots/m6-pond-waterfall-desktop.png`: waterfall for the push, with movement markers
- `docs/screenshots/m6-intro-desktop.png`: intro panel with the showcase button

Mobile variants of each exist as `*-mobile.png`.

## Data attribution

- Unit stats and mobility data (speed, movement class, build power, water depth) come from the [Beyond All Reason](https://github.com/beyond-all-reason/Beyond-All-Reason) unit definitions, GPL-2.0. `src/data/barStats.js` and `src/data/barMobility.js` are GPL-2.0; the rest of the code is MIT.
- Supreme Isthmus seat positions come from [beyond-all-reason/maps-metadata](https://github.com/beyond-all-reason/maps-metadata) (Apache-2.0); `src/maps/supremeIsthmus.js` is generated from that data.
- No BAR models, textures, artwork, icons, music or sounds are used.

## Honest limits

- Transit is straight-line distance × a 1.15 path factor ÷ unit speed. It is **not** real pathing; real routes bend around terrain and water.
- Waypoints were placed by eye from the public minimap, so they are approximate.
- The Pond scenario is a scenario, not a result: no combat losses are modelled. Needs Luke, all unconfirmed: seat P4, tidal output 20 E/s each, metal income 15 M/s, commander build power 300, start resources 1000 M / 1000 E. These are scenario inputs, not sourced values.
- Only Supreme Isthmus is modelled.
- Stats are a snapshot from the last scrape and may not match the current balance patch.
- No performance or usage numbers are claimed.
