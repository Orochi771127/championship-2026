# Batch 4 — the five heaviest maps drop the vertex data nothing reads (hm14-hm18)

2026-11-26. Fourth batch of `PLAN.md`, re-planned from measurements.

## Why the plan changed

The plan was "flat ground as one baked textured surface". Before building it I measured:

- Lossless welding (sharing identical vertices) gains almost nothing: 85-100 % of the vertices
  are unique, because every face carries its own colour (`weld_probe.py`).
- A baked ground texture would replace about 15 MB of vertex buffers with an 8-33 MB texture and
  soften the faceted look: little gain, real risk to the picture.
- What the five heaviest maps do carry is vertex data that **nothing reads**:
  - UV sets on vertex-colour materials that have no texture (997k vertices on hm14, 614k on hm18);
  - a second colour set, which three.js never shades with;
  - colours held as 12-byte floats although the Draco stream already quantized them to 8 bits.

Dropping that is the same model with less to download, decode, keep in JS and keep on the GPU.

## Result

| Map | GLB download | Vertex data per copy | In the hunt: GL buffers | In the hunt: JS heap + array buffers |
| --- | --- | --- | --- | --- |
| hm14 裂岩地帶 | 6.64 → 6.04 MB | 43.9 → 27.9 MB | 46.1 → 28.3 MB | 66.8 → 52.6 MB |
| hm15 岩漿山脈 | 6.26 → 4.59 MB | 23.2 → 14.5 MB | 23.0 → 14.7 MB | 45.4 → 35.6 MB |
| hm16 灼熱沙漠 | 3.91 → 2.90 MB | 17.3 → 11.0 MB | 15.5 → 9.5 MB | 35.5 → 30.0 MB |
| hm17 澄澈綠洲 | 4.46 → 3.07 MB | 19.5 → 13.0 MB | 17.8 → 11.6 MB | 40.8 → 32.8 MB |
| hm18 臨界遺跡 | 9.65 → 6.08 MB | 47.1 → 33.6 MB | 46.4 → 33.5 MB | 73.5 → 57.0 MB |

Together: 30.9 → 22.7 MB of downloads; in the hunt each map holds 11-32 MB less
(GL buffers + JS). Hunt entry was 6-19 % quicker in the same run (desktop Chromium).
The last two columns are measured in Chromium, phone portrait, DPR 2: GL buffer bytes from the
call tracker, JS heap from CDP `Runtime.getHeapUsage` (used + backing stores), hunt minus ranch.

## How

`hunt-expansion-20261125/scripts/slim_attributes.py`, per Draco primitive:

- `TEXCOORD_n` is dropped when no texture of the primitive's material reads that set or a higher
  one (glTF wants set numbers consecutive from 0, so a set below one that is read stays);
- `COLOR_1` and above are dropped;
- a float `COLOR_0` within 0..1 becomes unsigned-byte normalized;
- positions, normals, read UVs, indices, materials, nodes, images: kept. Ground heights,
  walkability and the lava phase picture are untouched.

New folders: `hm14-three-c3-20261126`, `hm15-three-v7-20261126`, `hm16-three-v8-20261126`,
`hm17-three-v6-20261126`, `hm18-three-v5-20261126`. Numbers per map: `batch4-slim-attributes.json`.

## Checks

- `verify_slim.py`, every triangle corner of all five maps (3.9 million) matched to the original
  on every kept attribute, both directions: position within 0.0016 units (0.07 px on screen),
  normal within 0.004, colour within 0.003 (less than one 8-bit step), read UVs within 0.002.
  Materials, nodes and textures are byte-identical JSON.
- `tests/championship-hunt-slim-attributes-cases.mjs`: pinned hashes; no unread UV set, no second
  colour set, no float colour; UV sets consecutive; vertex counts kept; a textured material keeps
  the set its textures read; lava phase picture and ground heights untouched.
- Browser, the five maps, old folders against new in the same build (reduced motion): Three
  active, no errors, same picture. Differing pixels: 0.00-0.25 % (the moving partners); the
  volcano's 3.3 % is its own two-phase lava animation caught at different phases.
- Not measured on a real phone.

## Not done here

three.js keeps a CPU copy of every vertex buffer after upload (the "JS heap + array buffers"
column: 30-57 MB still). Releasing it after upload is the next batch.
