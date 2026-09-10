# Cage native-unit scale review

Read-only source/evidence audit, 2026-09-06. Product root: `R:/Projects/Championship2026/championship-2026`; branch `main`; HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. Relevant presentation files and the runtime Cage manifest are existing dirty/untracked work. This report changes no runtime, asset, save, or gameplay rule.

## Result and correction

Cage maps currently use **4 world pixels per original map pixel**. This is independently supported by all 40 decoded NBS grid dimensions, native image metadata, runtime world dimensions, and actual runtime PNG headers.

Character `artProfile.scale:4` does **not** establish original character pixels to atlas pixels. It records only a later enlargement stage. The initial inference that the egg's atlas trim 168x216 meant 42x54 native is withdrawn. Existing origin-audit data agrees with the character review: egg Main cell 000 is 14x18 raw alpha pixels enlarged to 168x216, effective scale 12. Other cells can have different effective factors. The character lane is responsible for raw decode/hash correspondence.

The conversion must use the effective per-cell character factor and the verified map world factor, then one shared scene/camera scale. Cage arrangement and original spatial anchors remain a separate unresolved question.

## Map source chain

- Evidence MCP was queried first with Cage topic and a bounded CM01 source-manifest read.
- External source: `R:/NEXUS LINK/原作/research-only/YDIJ_ORIGINAL_VISUAL_RECONSTRUCTION_ARCHIVE_2026-08-29/maps/o3b-training-cage/field_cm01_01/source_manifest.json`, lines 22-29 identifies raw `training/field_cm01_01.nbs`, file ID 5696, size 356, SHA-256 `4c3b56d595780499dfcfcefa1fce7ff48f6193a147c8595bbaabf5a087b5eb1d`; lines 95-103 records the 12x14 grid. This run read the provenance and decoded grid; it did not claim a fresh full-ROM decode.
- `scripts/lib/ydij_map_formats.py:80` parses NBSR width/height from the header; `:145-153` renders each map cell as 8x8 native pixels.
- `scripts/build-cage-faithful-hd40.py:431-438` cross-checks NBS, ATR, COL dimensions. `:631-635` enlarges the native composite exactly 4x using NEAREST and checks a native-size round trip.
- `scripts/promote-licensed-cage-runtime.mjs:115-125` copies `faithfulHd4x.width/height` to runtime world dimensions and `nativeOriginal.width/height` to native dimensions. No alternate map-native scaling is inserted here.
- `assets/production/cage/licensed-runtime-v1/manifest.json:29-32` gives CM01 world 384x448 and native 96x112.

The read-only Node check loaded all 40 `core-tilemap.json` files and compared grid*8, runtime native dimensions, runtime world dimensions, and PNG IHDR. All 40 agreed. Representative measurements:

| Field | NBS grid | Native pixels | World / PNG pixels |
| --- | --- | --- | --- |
| CM01 | 12x14 | 96x112 | 384x448 |
| CM02 | 24x25 | 192x200 | 768x800 |
| CM09 | 36x25 | 288x200 | 1152x800 |
| CM16 | 12x14 | 96x112 | 384x448 |
| CM28 | 30x25 | 240x200 | 960x800 |

This proves map-unit sizes; it does not prove original Cage placement, gameplay collision, or a uniform one-hex footprint.

## Current scale mismatch

`src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js:139-154` fits the complete map/composite to the available viewport. `:275` independently scales the character to `120/352`, and `:378-380` adds a viewport-dependent root clamp. Therefore adding cages changes map scale without applying the same factor to characters.

The existing Hunt renderer has a useful architecture at `src/championship/presentation/vs2/createHuntFieldPixiPresentation.js:362-363`: map and actors share one world scale and camera translation. Its `:237` actor factor `0.18` is not native-ratio evidence. `HUNT_CHARACTER_PRESENTATION.v1.json` verifies bounded animation selection and projection, not Cage/character sizes or Raising action binding.

## Required conversion and metadata

Let `M = mapWorldPixels / mapNativePixels` (current Cage M=4), `E[cell] = atlasPhysicalPixels / rawSourcePixels`, `R = Pixi atlas resolution` (physical pixels per Pixi texture unit), and `C = shared camera/scene scale` (screen pixels per world unit).

Then actor local scale in the common world is `M * R / E[cell]`; the final screen scale is that value multiplied by C. If projected in a separate screen-space actor layer, use the identical combined factor and apply it exactly once. With current atlas meta.scale 1 and egg E=12, its local factor is 4/12, not 1. At any viewport, egg width / CM01 map width should equal 14/96, using raw alpha bounds for the egg and map native width; a transparent logical canvas is not the body size.

Per-cell effective scale, raw signed origin, and trim geometry must come from hash-validated origin data. Do not normalize every pose to a constant body height. Do not infer the factor from the 384x352 padded canvas, the label HD4x, devicePixelRatio, or texture dimensions alone.

Map loader advice:

- `validateRuntimeMapArtBundle` currently validates world sizes at lines 90-91 but does not validate native dimensions. For the native-scale path, require positive finite native dimensions and equal X/Y world-per-native ratios.
- `loadRuntimeMapArtTileSet` currently emits composite world bounds and field IDs at lines 290-295, dropping the source-native scale. Preserve a verified `nativePixelWorldScale` from all selected fields; assert compatible uniform ratios before exposing one scalar for the entire set. Do not divide a whole-ranch width by a single tile's native width.
- Texture packing resolution is independent from world geometry. Existing map loading explicitly assigns `displayObject.width/height` to manifest world sizes, so alternate PNG resolution should not alter the world ratio.
- Missing/invalid character native geometry should produce the existing explicit unavailable/technical presentation, not silently fall back to `120/352` while claiming native scale. Missing map metadata cannot substantiate original-size parity. Keep diagnostics explicit.

## Focused verification required for the implementation

1. Real map fixtures: verify all 40 grid*8/native/world sizes; reject zero, missing, NaN, anisotropic, and mixed-ratio fields in the native-scale composite path. A composite must retain its ratio after animated and static tiles are combined and resized.
2. Real character fixtures: egg raw14x18 / atlas168x216 effective12x and character cells with effective8x versus12x. Assert visible raw dimensions are recovered without per-frame normalization; verify signed origins, trim offsets, and flip bits do not move the foot/source anchor incorrectly.
3. Resolution: duplicate geometry fixtures at different texture resolution metadata and DPR 1/2/3. Screen-space ratios stay unchanged. Account for Pixi logical texture units rather than double-applying meta.scale.
4. Viewport and composition: test one CM01, four normal starter cages, and more cages on 360x800, 390x844, 430x932 and a wide viewport. Changing C must scale actors and map together; the egg/CM01 ratio is invariant even if the total ranch is fit smaller.
5. Frame changes: update texture/cell through the actual presenter/controller path. Recompute E only when its source cell changes; blank frames remain blank. Do not invent Raising animation events to exercise the test.
6. Touch targets: after visual shrink, hit areas still select the correct stable resident. Keep any touch-only hit padding independent from visual size, prevent a full transparent canvas from intercepting neighboring actors, and test overlap order. Pointer-to-local conversion, drag/drop targets, mirrored scale, resize and cancel must remain correct.
7. Fallback and lifecycle: missing geometry, invalid hash, absent texture, absent map, reduced motion, scene re-entry and disposal must not crash or introduce another ticker. Native parity diagnostics must remain false where required geometry is unavailable.
8. Normal browser path: use the existing four owned cages through MANAGE/Cage Edit -> placement -> CONFIRM -> BACK -> Save & Quit -> reload -> Continue. Verify the real actor/map ratio in that normal scene, not only a manually constructed composite. Existing source tests are evidence of their own checks only; this report did not rerun browser/device QA.

World-position truth, Cage capacity/training effects, and original action timing are unchanged and outside this size-only correction.
