# Hunt map seams and ambient life, 2026-11-26

## Holds from the 2026-11-25 expansion

| Hold | Finding | Action |
|---|---|---|
| hm13 ice cliffs "stepped along the grid" | The extension plateaus use the core's own cliff style (blue sides, snow tops, steps along the tiles). | None. |
| hm10 / hm11 water joins at the old 2048 edge | Sewer channels and factory lanes run on across the seam with no break (checked on the 2880 renders). | None. |
| hm10 / hm11 drain-phase GLBs (unbound) | Their contract says they hold "exact original BSAR PNGs independently reconstructed": reference-derived pixels. | Never bound or copied. Replaced by an original procedural flow. |

## Drain outlets run (`drainFlow.mjs`)

The outflow ribbons under the drain pipes (3 in hm10, 4 in hm11) carry procedural streaks:
- pixel-stepped streaks run downstream;
- the water churns at the pipe mouth and foams where it meets the floor;
- one mesh per map, a hair above the drawn ribbon;
- the hm10 ribbons are measured from the GLB vertices, the hm11 ones from the map render.

## Ambient life (`ambientLife.mjs`)

Each map gets a light layer of life in its own 3D space, so props in front hide it.

| Maps | Day | Night |
|---|---|---|
| hm01-hm06 (grass and forest) | pollen | fireflies (glow, blink) |
| hm08, hm14, hm16-hm18 | drifting dust | drifting dust |
| hm09, hm11 | faint motes | faint motes |
| hm10 | faint motes | none |
| hm13 | snow | snow |
| hm15 | rising embers | rising embers |

Budget and behaviour:
- one `THREE.Points` draw per map with at most 160 points;
- positions are computed on the GPU from a seed and the time, inside a box that follows the camera, so the count does not grow with the map;
- the layer is off in saver quality and with reduced motion, and so is the drain flow.

## Browser check (Chromium, 1366x768, motion on)

`browser-four-maps.jpg` shows the factory drain, the sewer, the ice field at night (snow) and the grassland by day (pollen).
`browser-two-frames.jpg` shows the same spots 0.7 s apart: the drain streaks and the snow move between the frames.

Results:
- every map reports its layer drawing;
- no page errors.

`npm run test:ci` 4107/4107 and `npm run build:playtest` pass.
