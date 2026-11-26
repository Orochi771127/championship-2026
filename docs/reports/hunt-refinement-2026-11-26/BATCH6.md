# Batch 6 — hm14 裂岩地帶: the extension plateaus as rounded mesas, built in Blender, with the original area's boulders

2026-11-26. Last batch of `PLAN.md` (item 5). Modelled and rendered in Blender, as the Owner asked
(「你都用blender來做啦 比較統一風格」).

## What changed

The extension plateaus of hm14 (2026-11-25) were per-tile boxes: stair-stepped edges, flat tops
with only bushes. Now:

1. **Rounded mesas, built in Blender.** The same per-column rule as before decides where a plateau
   stands and how high it is, so the picture still covers the blocked tiles. Its outline is
   smoothed (stair steps become curves) and wobbles a little like rock; towards the rim the height
   falls on a quarter circle: a steep wall with a round lip; the top stays flat at 1.96.
   Blender merges the flat tops (Decimate, planar), triangulates, and the mesh is written into the
   GLB in place of the old plateau primitive: 32,712 vertices instead of 35,720.
   Flat-top corners keep their own normal and one plain colour; wall corners are smoothed among
   wall faces, with strata bands and a brighter lip.
2. **The original area's own boulders on the tops.** 158 copies (155 along the rims, 3 across the
   tops) of small grey `HM14 source props` clusters from the original ridges, turned and scaled a
   little, each far enough in that it does not hang over the edge, none on or next to what already
   stands there.
3. What stood on the old plateaus (57 bushes, statues, lamps) is set down on the new surface.
4. **Fallback pictures re-rendered in Blender** (Cycles, the same camera and lights as every other
   hm10-hm14 fallback), day and night. WebP quality 94 as before.

GLB 6.04 → 6.80 MB (hm14 was 6.64 MB before batch 4). Folder `hm14-three-c4-20261126`.

## What did not change

- Walkability: not a single tile.
- Ground heights of walkable tiles: all 22,678 are identical (pinned by a digest in the test).
  Only the 1,224 blocked tiles under the mesas have new heights.
- The original 128 x 128 area, every other primitive (they keep their Draco bytes), materials.

## Tools (in `hunt-expansion-20261125/scripts/`)

- `hm14_mesa_prep.py` — the rounded shape as a height picture (3 px cells).
- `hm14_mesa_build.py` — Blender: mesh, planar decimate, colours, GLB primitive, props set down,
  ground heights re-cast, coverage report.
- `hm14_rim_rocks.py` — the boulders.
- `render_fallback_stamp.py` — Blender Cycles render. It now uses the GPU denoiser, 512 px tiles
  and no persistent data: with the CPU denoiser a 2880 px frame took free RAM to 81 MB and the
  guard stopped it twice; with these settings the lowest free RAM was 0.9-1.4 GB.

## Checks

- `tests/championship-hunt-hm14-plateau-rocks-cases.mjs`: pinned hashes; the mesas are lighter
  than the boxes and their picture covers 95.2 % of the blocked tiles they stand for, 3.6 % of it
  outside (an over-estimate: bounding-box fill); walkable ground heights unchanged (digest);
  every rock's screen tile is in the extension and blocked, day and night; rocks 1.2 units apart.
- `tests/championship-hunt-slim-attributes-cases.mjs` still holds for the new file.
- Browser, hm14 in phone portrait / phone landscape / desktop: Three active, no errors, capture
  succeeded (`batch6-browser-check.json`).
- `npm run test:ci`, `npm run build:playtest`.

## Pictures

- `batch6-before-after.jpg`: Blender render before / after.
- `batch6-in-game.jpg`: the south-east extension in the game (night field).

## A step that was dropped

Before the Owner's instruction, the Blender render had been stopped twice by the low-memory guard
and I painted the new rocks onto the shipped picture with a small home-made painter instead. That
version was never committed; the pictures here are full Blender renders.
