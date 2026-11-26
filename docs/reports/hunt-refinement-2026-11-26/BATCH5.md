# Batch 5 — the JS copy of map geometry goes once it is on the GPU (all 16 maps)

2026-11-26. Follow-up to batch 4 (`PLAN.md`, item 4b).

## What changed

three.js keeps every vertex and index array in JS after uploading it to the GPU. For a hunt map
that is 1-32 MB that nothing reads again:

- the map never re-uploads: a lost context or a retired renderer ends the Three map and the hunt
  continues on its 2D fallback (`lifecycle.mjs`);
- nothing ray-casts or edits the map's geometry; partners, shadows, ground contact, water and
  ambient layers have their own small meshes and are not touched.

`src/championship/presentation/vs2/huntThree/geometryRelease.mjs` hooks each map attribute's own
upload callback and drops the array the moment its GL buffer exists. Bounds for culling are made
first (GLTFLoader already sets them from the accessor min/max). Geometry with morph data or
interleaved buffers is left alone (the maps have neither).

## Result

JS heap + array buffers held by the hunt (hunt minus ranch), Chromium, phone portrait, DPR 2:

| Map | Before batch 4 | After batch 4 | After batch 5 |
| --- | --- | --- | --- |
| hm18 臨界遺跡 | 73.5 MB | 57.0 MB | 24.3 MB |
| hm14 裂岩地帶 | 66.8 MB | 52.6 MB | 25.4 MB |
| hm15 岩漿山脈 | 45.4 MB | 36.4 MB | 20.8 MB |
| hm17 澄澈綠洲 | 40.8 MB | 32.8 MB | 19.9 MB |
| hm16 灼熱沙漠 | 35.5 MB | 30.0 MB | 20.1 MB |

Released on entry, all 16 maps (the game's own counter, `threePilot.geometry.releasedBytes`):
ruins 32.1, crag 27.0, sewer 25.3, factory 17.4, ice 16.8, mine 15.6, volcano 15.6, oasis 12.5,
desert 10.5, grass 10.0, canyon 5.0, seaside 4.0, jungle 3.5, savanna 2.9, damp 2.4, forest 0.9 MB.
GL buffers are unchanged (the data is on the GPU, once).

## Checks

- `tests/championship-hunt-geometry-release-cases.mjs`: arrays go only on their own upload;
  bounds exist first; counts survive; shared geometry and attributes are hooked once; instance
  matrices stay; an earlier upload callback still runs; morph and interleaved data are left alone;
  the map hooks after loading and before the renderer lease; three's `createBuffer` reads the
  array before the callback and not after.
- Browser, all 16 maps: enter, pan across the whole map (13 drags), leave. Three active before and
  after panning, no page or shader errors, no cleanup errors, GL buffers back to the ranch level
  after leaving (`batch5-browser-*.json`). Pictures after panning: `batch5-after-pan.jpg`.
- Not measured on a real phone.
