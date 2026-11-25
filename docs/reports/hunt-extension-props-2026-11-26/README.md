# Hunt extension props, 2026-11-26

The 2026-11-25 extension areas of hm10 (杜比工廠) and hm13 (雪之國度) were large empty plains.
They now carry each map's own props, copied from the same GLB (same vertices, UVs, vertex
colours and materials), so the new ground keeps the map's look. Nothing is traced from
reference art.

| Map | Added | Blocks |
|---|---|---|
| hm10 | 12 container yards (some stacked two high), 8 AC-unit rows, 10 street lights | 512 tiles, including 70 under the containers that were already there and let creatures walk through |
| hm13 | 15 snow-capped boulder groups, 9 snow drifts (walkable), 3 signs | 74 tiles |

Rules (scripts in `R:/Projects/Championship2026/hunt-expansion-20261125/scripts/extension_props.py`):
- only on open extension ground (x >= 128 or y >= 128), away from walls, paths, grass lanes and other props;
- tall props block their tiles (`scripts/data/hunt-extension-prop-blocks-20261126.json`, applied by
  `scripts/build-hunt-expansion-four-20261125.mjs`; the night field takes its day blocks);
- no open region is split, and the original 128x128 area is unchanged (tests in
  `tests/championship-hunt-three-c1-maps-cases.mjs`);
- untouched GLB primitives keep their Draco bytes; re-encoded chunks keep their colour format
  (16-bit normalized), position drift < 0.03 px.

GLB size: hm10 4.57 MB -> 4.45 MB, hm13 2.19 MB -> 2.66 MB. Fallback pictures re-rendered
(Cycles, same camera and lights) and re-encoded as WebP q82: hm10-day 498 KB -> 213 KB,
hm13-day 1.29 MB -> 518 KB, hm13-night 950 KB -> 330 KB.
