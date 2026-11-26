# Hunt map refinement plan, 2026-11-26

Owner: analyse the hunt maps, judge how to refine them (better picture, better fit for a web
game / web app), plan it and build it autonomously. Blender may be used.

## What the analysis found

Measured on the 16 maps as shipped after #308-#316.

**Frame cost** (`frame-cost-16-maps.json`: phone portrait at DPR 3, CPU slowed 4x, desktop GPU)
- 15 maps hold 60 fps at the median; hm13 (ice) sits at 30 fps.
- hm13 is slow because it spawns 20 partners where the others spawn 11, not because of its map art.
- A desktop GPU hides GPU cost, so this says nothing about fill rate on a real phone.

**Triangles** (`triangle-cost-16-maps.json`)
- Five maps spend 35-45% of their triangles on flat ground that only carries vertex colours: hm14 114k of 368k, hm15 85k of 297k, hm18 85k of 333k, hm13 58k of 194k, hm10 100k of 235k.
- The largest downloads are hm18 (9.9 MB), hm01 (8.6 MB), hm14 (7.1 MB), hm11 (6.9 MB) and hm15 (6.6 MB).

**Memory**
- Leaving the hunt releases what it took (see `hunt-exit-memory-2026-11-26`).
- The two pre-baked maps hold the most while in the hunt: hm01 about 105 MB and hm08 about 73 MB of textures. A third to a half of that is the full-resolution coverage mask.

**Picture** (`weak-spots.jpg`, phone portrait)
- hm17 (oasis) and hm18 (ruins): the 2026-10 extension areas are flat, single-colour sand with almost nothing on it.
- hm14 (crag): the extension cliffs are per-tile blocks; from above they read as flat stair-stepped patches, not rock.
- Flat floors (hm10 concrete, hm14 ground, hm17 and hm18 sand) have no surface detail.
- Water is static on hm05, hm06, hm11, hm13 and hm17.
- hm09 (mine), hm15 (volcano), hm01-hm06 and hm08 read well and need no art pass.

## Batches, in order

1. **Dress the empty extensions of hm17 and hm18** with each map's own props (the method used for hm10 and hm13 in #312, adapted to the 52-degree maps). Tall props block their tiles. **Done 2026-11-26 (hm16 too): see `BATCH1.md`.**
2. **Lighter coverage masks for hm01 and hm08**: about 24 MB less texture memory in the hunt for each, same picture. This is the main protection against the phone killing the web app on entry. **Done 2026-11-26: the mask is uploaded as one channel at full resolution instead of at half resolution, so no edge gets coarser; see `BATCH2.md`.**
3. **Water that moves**: a light shader shimmer on the existing water surfaces; no new assets; off with reduced motion and in saver quality. **Done 2026-11-26 on hm05, hm06, hm11, hm13 and hm17: see `BATCH3.md`.**
4. **Flat ground as one textured surface** on hm14, hm15, hm18, hm13 and hm10: the vertex-colour ground becomes a small baked texture on a few large quads. Fewer triangles (35-45% per map), smaller downloads, and the texture can then carry surface detail (ripples, cracks, stains).
5. **hm14 extension cliffs as rounded rock**, built like hm08's new mesas, replacing the per-tile blocks.

Each batch ships as its own PR with before/after pictures, the full tests, a browser check on phone
portrait, phone landscape and desktop, and the enter/leave memory loop where memory is touched.

## Not planned

- KTX2/Basis GPU texture compression: it needs a transcoder (new dependency and download) and the maps hold little texture outside hm01/hm08.
- Lower-resolution textures on hm02-hm06: they are already magnified on a DPR 3 phone.
- Any change to the original 128 x 128 walkability, or tracing reference art.
