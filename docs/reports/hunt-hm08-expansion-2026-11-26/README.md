# hm08 南橋峽谷 to 180x180 (2880), 2026-11-26

hm08 was the last hunt map still at 128x128 (2048). With it, all 16 hunt maps are now 180x180.

## Design (original)

`scripts/data/hunt-hm08-extension-grid-20261126.txt` holds the walkability design for the appended east strip (x 128-179) and south strip (y 128-179):
- mesas that touch the old edge continue across it;
- a mesa rim closes the new outer edge;
- 16 mesa islands with organic outlines;
- 14 ground obstacles (cacti, terminals).

Numbers:
- 62% of the new strips is open sand (the core is 54%).
- Every open tile connects to the core.
- The original 128 grid, its two caves and its night grid are unchanged, and 92 old-edge escape cells are converted to normal steering.

## Art

The authoring masters (day and night) were extended in Blender in the map's own kit; nothing is traced from reference art:
- **Terrain.** One continuous heightfield forms the new canyon floor and the mesas, with rounded slopes like the core's. It shares the core relief's materials *and texture space*, so the procedural sand and rock continue across the seam. The core's mean colour difference against the shipped 2048 frame is 1.7/255.
- **Seam.** The core relief used to run about 40 native px past the old edge (out of frame). That part, and 8 props standing on it, were trimmed. Continued mesas follow the core's own top at the edge and blend into their own height over 48 native px.
- **Props.** All props are copies of the map's own objects: 69 dead trees, 281 rocks, 45 boulders, 200 ridge rocks, 12 cacti, 2 terminals and 4 signal poles.
- **Camera and frames.** The camera keeps its direction and widens to ortho 90 at 2880 px. Day and night were re-rendered (Cycles on GPU), the scenery mask was re-rendered, and the depth GLB was re-exported with the original settings.

Images:
- `hm08-2880-day.jpg` and `hm08-2880-night.jpg`: the full map, with the yellow box marking the old 2048 area.
- `browser-new-strips.jpg`: the game in Chromium after panning into the new strips. Three is active, the dust layer is on, and there are no page errors.

## Files

`assets/production/hunt/hm08-three-r2-20261126/` (1.70 MB, up from 1.05 MB):
- frames: day 508 KB and night 328 KB;
- mask: 48 KB;
- Draco GLB: 637 KB;
- heights: 181 KB.

The 2D fallback (when Three is not available) now uses the same 2880 render as the other expanded maps (`three-fallback-20261023/hm08-{day,night}.webp`).

Masters and scripts are in `R:/Projects/Championship2026/hunt-masters-20261125/` (`blend/hm08-authoring-*-2880-20261126.blend`, `scripts/hm08-2880/`), mirrored on D:.

## Checks

- `npm run test:ci`: 4111/4111 pass.
- `npm run build:playtest`: passes.
- New test: `tests/championship-hunt-hm08-expansion-cases.mjs`.
