# Character native-size and atlas-normalization evidence

Date: 2026-09-06. Product root `R:/Projects/Championship2026/championship-2026`, branch `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. Existing dirty work was preserved. This isolated investigation reads source/raw/production files and writes metadata and this report only. It changes no asset pixels, runtime packs, shared source, tests, save or renderer.

**Result: the uniform 384x352 character canvas is a packing convention, not original creature size. The current atlas enlarges native pixels by 4x, 8x or 12x, depending on entity and sometimes pose. A common screen-size factor cannot preserve native creature-to-creature or creature-to-map proportions.** The existing per-cell audit metadata is usable to remove this normalization, and this pass independently verified it against raw NCER and current atlas pixels for the whole roster.

## Fresh verification and integration candidate

`verify-character-native-scale.py` reuses the existing transfer-aware decoder in `scripts/build-character-appearance-workflow.py`. For every entity and Main/Sub bank it compares decoded metadata to the raw NCER records and raw OAM words, uses the NCER per-cell VRAM transfer with NCBR/NCGR/NCLR, reconstructs each native cell in memory, then compares its visible pixels enlarged with nearest filtering to the current runtime atlas crop. It writes no images or raw arrays.

- 224 entities, 17,235 Main/Sub slots examined.
- 17,182 visible slots match the raw transfer-aware reconstruction exactly; the other 53 are matching blank slots.
- Effective packed scales: 4x in 2,947 slots; 8x in 11,091; 12x in 3,144.
- 171/224 entities use more than one packed scale across their frames. All 224 have more than one packed source-origin placement.
- Raw source OAM affine flags: 0 across the inspected banks. This is static resource evidence, not proof that Raising never changes final OAM/affine state.

`compile-main-zero-scale.py` then verifies all 1,230 current production-manifest file hashes and compares the fresh native findings with the existing generated origin-audit rows. All 224 Main cell_000 and all 224 Sub cell_000 exist, are nonblank, and are the first texture in their raw sequence 0. There are no exceptions. All current atlas resolution values are 1.

Use **`character-main-zero-scale-candidates.json`** for the existing static normal-roster seam. It contains 224 records keyed by `entityId`, with `baselineRuntimeSha256`, source-audit path/hash and Main/Sub metadata: texture key, native cell/alpha bounds, actual native visible size, packed scale, packed trim/source origin, atlas resolution and atlas JSON/PNG hashes. `verifiedPixelMatch:true` means the actual comparison above passed. It is an isolated candidate, not a runtime import or registration.

The complete frame mapping is in `character-native-scale-candidates.json`; summary and decoder/verifier hashes are in `character-native-scale-summary.json`. The complete mapping is deliberately more detailed than the currently static seam requires. Applying only the compact cell_000 scale to future animated frames would reintroduce scale drift for the 171 entities with varying packed scales.

## Actual representative sizes

Canonical egg art identity is **`e000_digitama`**, not `e000_digitama0`. The following values are Main cell_000; alpha size means visible nontransparent support, while cell size includes the native OAM bounds.

| Entity | Native cell | Native visible pixels | Atlas visible pixels | Packed scale | Packed source origin |
|---|---:|---:|---:|---:|---:|
| e000_digitama | 16x24 | 14x18 | 168x216 | 12 | (192,308) |
| m001_zurumon | 24x16 | 19x8 | 228x96 | 12 | (162,308) |
| m201_agumon | 16x24 | 16x18 | 192x216 | 12 | (192,296) |
| m222_tentomon | 32x32 | 24x23 | 192x184 | 8 | (184,296) |
| m226_hagurumon | 32x24 | 19x16 | 152x128 | 8 | (188,352) |
| m228_palmon | 24x32 | 16x22 | 128x176 | 8 | (192,304) |
| m352_peckmon | 24x32 | 22x29 | 176x232 | 8 | (160,304) |
| m431_whamon | 80x40 | 73x34 | 292x136 | 4 | (190,320) |

For example, Whamon's source width is 73/16 = 4.5625 times Agumon's; the packed visible widths are only 292/192 = 1.5208 times. Giving both atlases the same sprite scale preserves the packing ratio rather than native size. The different scale factors explain that discrepancy without resizing or redrawing any files.

M201 also demonstrates per-pose normalization: Main 000 is 12x; Main 023 is 8x; Main 062 is 12x with a substantially different packed source origin. Native Main 062 occupies positive source X rather than a recentered silhouette. These differences must not be mistaken for original shrinking or jumping positions.

## Scale-only integration formula and separate origin issue

Let S be `packedPixelsPerNativePixel`, R be the atlas/Pixi texture resolution, W be world units per native pixel from the map contract, and F be the shared map camera fit. The scale-only conversion is:

`sprite.scale = R / S`

`actorRoot.scale = W * F` (with the existing facing sign applied once)

This makes a native visible width N occupy N*W*F screen units. For the currently contemplated map native-to-world factor 4, W is supplied by that map contract; this character packet does not independently establish the map factor. Hit-area minimums such as 44 CSS pixels belong to the input affordance and should not enlarge the visible sprite.

The installed Pixi source `node_modules/pixi.js/lib/spritesheet/Spritesheet.mjs:24` assigns atlas `meta.scale` to both spritesheet resolution and `texture.source.resolution`; lines 83-110 divide original/trim/frame dimensions by that resolution. Therefore using `texture.source.resolution / S` is consistent with this installed parser. All current baseline atlases have R=1; keep the formula explicit for future replacements.

The current source at `src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js:275` sets `120/352`, then line 378 applies an independent screen-fit clamp. That sequence is evidence of the current mismatch, not a source of original size truth.

**Keep source-origin alignment separate from this scale-only correction.** With packed logical coordinate L and measured packed source origin O, native coordinate is `(L-O)/S`. Setting texture anchor to O/sourceSize would place the NCER source origin at the actor point, but its relation to original gameplay position or actual feet is not yet verified. Preserving the existing anchor during this bounded ratio fix avoids silently claiming that relationship. This can leave historical vertical offsets; do not report source-origin or foot-placement parity based only on correct size.

## Existing M201 origin adapter is a different contract

`src/championship/presentation/characterOriginGeometry.js:30` derives a calibrated first-baseline-frame transform. It is restricted to a separately registered, hash-locked M201 replacement, not a generic baseline normalization service. `sourceScale/baselineScale` becomes atlas resolution; the anchor preserves the baseline source-origin offset from the baseline anchor.

For the documented M201 geometry: baseline source origin (192,296), baseline anchor pixels (192,320), source scale 12; replacement canvas 464x368, source origin (184,268), scale 12 gives replacement anchor (184/464,292/368), resolution 1. The y=268 source origin must not be substituted for the calibrated y=292 anchor. This adapter preserves the former baseline display calibration; by itself it does not establish original creature-to-Cage size.

For a future authored native-grid replacement, use its verified geometry's actual `sourcePixelScaleBySide`, together with actual texture resolution. Do not divide a 1x authored pixel master by the baseline's 12x packing factor a second time. Baseline-compatible and common-origin replacement branches need explicitly separate metadata sources; no existing image or atlas bytes need be changed.

## Original Raising transform evidence boundary

Championship Evidence MCP was queried for character animation, scale, affine and Raising/OAM sources before claims. The character pipeline report documents NCER common-origin pose banks and NANR cell-only frames; the bounded search did not provide a traced Raising final display-scale writer. This is not absence proof. Source files have nonaffine OAM entries, and the native decoder rejects affine cells, but runtime may still rewrite output attributes or choose a scale before drawing. No live emulator OAM/affine matrix sample or complete Raising actor-render call trace was executed by this packet.

Thus **native asset geometry and reversal of atlas normalization are verified; exact original Raising camera/OBJ scale and source-origin-to-foot relationship remain `UNKNOWN_REQUIRES_TRACE`**. A final claim that on-screen Cage-to-character ratio is identical to the original still needs a Raising frame with known actor/species plus final OAM or renderer parameters, and the map camera transform. Root can integrate the verified size metadata while reporting that bounded distinction.

## Reproduction and ownership

Run from product root:

```powershell
python docs/art/production/tooling-pilot-r1/scale-review/verify-character-native-scale.py
python docs/art/production/tooling-pilot-r1/scale-review/compile-main-zero-scale.py
```

Both scripts write only their metadata outputs inside this isolated scale-review folder. The first imports the existing decoder with bytecode writing disabled. No asset payload is copied into these outputs. Existing shared/runtime source, art registration and all unrelated files remain untouched by this packet.
