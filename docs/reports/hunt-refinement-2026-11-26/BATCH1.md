# Batch 1 — landmarks in the empty extensions (hm16, hm17, hm18)

2026-11-26. First batch of `PLAN.md`.

## What changed

The 2026-10 extension strips of 灼熱沙漠 (hm16), 澄澈綠洲 (hm17) and 臨界遺跡 (hm18) were almost
empty sand. Each map now carries copies of **its own** landmarks there:

| Map | Copies | Kinds | New blocked tiles | GLB |
| --- | --- | --- | --- | --- |
| hm16 | 16 (15 landmarks) | rock piles, fenced posts, chair, crate | 658 | 3.56 → 3.91 MB |
| hm17 | 16 (16 landmarks) | palms on rocks, rock outcrops, flags, hut, crate | 301 | 4.30 → 4.46 MB |
| hm18 | 18 (18 landmarks) | ruin blocks with columns, wall, pillars, flags, sign posts, 3 rocks | 1,304 | 9.36 → 9.65 MB |

Rules the tool keeps (`hunt-expansion-20261125/scripts/stamp_landmarks.py`):

- A landmark is a small isolated group of blocked tiles plus every prop piece standing on it.
- A copy is a move by a whole number of tiles, no rotation, so the blocked shape matches the art
  exactly and the baked shading stays right. Vertices, UVs, vertex colours and materials are the
  source's own. Primitives that receive no copy keep their original Draco bytes.
- Only onto open extension tiles, at least 3 tiles from the map edge, with a clear margin, at
  least 13 tiles between copies, never on the hm18 paved road, never on water.
- No open region may be cut off. The original 128 x 128 area is not touched.
- The tiles under each copy are terrain 1, day and night
  (`scripts/data/hunt-extension-landmark-blocks-20261126.json`, applied by
  `scripts/build-hunt-expansion-four-20261125.mjs`).

Folders: `hm16-three-v7-20261126`, `hm17-three-v5-20261126`, `hm18-three-v4-20261126`
(ground heights unchanged).

## Fallback pictures

The shipped fallback pictures of these maps are screenshots of the game's own Three render, so a
Cycles re-render does not match them (duller sand and water). They are now made from the shipped
pictures themselves (`composite_fallback.py`): a copy is a move by whole tiles (16 px), so its
pixels are taken from the source place inside the copy's silhouette, and its shadow darkens the
destination ground by the same amount. Everything else keeps the shipped look. WebP quality 94,
as before.

## Checks

- `tests/championship-hunt-landmark-stamps-cases.mjs`: pinned bytes, copies in the extension and
  off the edge, spacing, blocked day and night, core terrain unchanged, same number of open
  regions with and without the copies, extension still more than 70 % open.
- Static audit (`scripts/qa/hunt-map-static-audit.mjs`): 16 maps, no problems.
- Behaviour simulation (`scripts/qa/hunt-behaviour-audit.mjs Desert,Oasis,Ruins`): 6 sessions,
  49,735 samples, 0 on blocked tiles, 0 exits through the east/south edges. The 6 short stalls are
  the known inner wall corners of the original area (Desert night 101,120; Ruins day 26,117-119),
  none at a copy.
- Browser, the three maps x phone portrait / phone landscape / desktop: Three active, no page
  errors, capture succeeded on all three (`batch1-browser-check.json`).

## Pictures

- `batch1-hm16-before-after.jpg`, `batch1-hm17-before-after.jpg`, `batch1-hm18-before-after.jpg`:
  fallback picture before / after; the yellow line is the old map edge.
- `batch1-in-game-desktop.jpg`, `batch1-in-game-portrait.jpg`: the south-east corner in the game.

## Notes

- hm18 names one material "…unified stone sand foliage"; a word match on "sand" first treated all
  its plants, flags and pebbles as ground. The tool now excludes that material from the ground rule.
- A Cycles render of hm18 shows a 1 px line where the core and extension sand meshes meet (both at
  height 0). It is in the shipped GLB too, is a ray-tracing artefact, and does not show in the game.
- hm18 is the heaviest map (333k triangles, 9.65 MB); batch 4 (flat ground as one textured
  surface) is where it gets lighter.
