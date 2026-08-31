# Faithful HD map runtime integration v1

Date: 2026-08-31
ROM evidence SHA-256: `8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1`

## Inventory verdict

The existing HD outputs are complete **art-production candidates**, not current
game bundles:

| Family | Candidate coverage | Runtime cost / shape | Current integration verdict |
|---|---:|---|---|
| Cage | 40/40 visual fields, 336 generated files | 4x component-faithful composites; four animated fields | Art complete. Definition-to-visual binding is unresolved: runtime has 36 CageDefinitions while art has 40 visual fields. |
| Hunt | 30/30 fields, 47 HD composite frames | 2048x2048 per frame; about 16 MiB decoded RGBA each | Art complete. Load exactly one active field. Gate-to-HM binding and animation tick conversion remain unresolved. |

The ROM attachment matches the evidence hash already recorded by the project.
It remains research-only and is not copied into a runtime bundle.

## Implemented integration seam

`src/championship/presentation/runtimeMapArtBundle.js` now provides the bounded
PixiJS runtime seam:

- validates registered production-only image paths;
- loads one explicit field through `PIXI.Assets.load`;
- creates a `Sprite` for static maps or an `AnimatedSprite` with `autoUpdate:
  false` for verified timed sequences;
- advances animation only from the existing Application ticker;
- unloads the exact active textures on field exit or field swap;
- refuses research paths, embedded collision payloads, guessed Gate mapping and
  unresolved animation timing.

`createHuntFieldPixiPresentation` accepts that loaded field-art object. When it
is present, the complete HD composite replaces the procedural terrain and prop
layers while actors and capture strokes remain above it. World dimensions must
match before rendering; otherwise mounting fails rather than stretching a wrong
map over the runtime.

## Evidence gates before actual candidate pixels are registered

1. Link the licence document required by `docs/coordination/OWNER_DIRECTION.md`.
   The ROM file proves source identity; it is not licence evidence.
2. Approve the chosen HD candidate visually. Current Cage and Hunt manifests
   both record `humanApproved: false` and `runtimeEligible: false`.
3. Close Gate-to-field binding. Sixteen Gate biome nodes and thirty HM fields
   are verified independently, but their original relationship is not.
4. Close the raw animation-tick conversion before activating the 13 animated
   Hunt variants or four animated Cage fields. Frame order and raw ticks are
   retained; milliseconds are not yet verified.
5. Bind collision through the existing field runtime, not through the art
   manifest. Raw ATR/ESC/OPM evidence stays out of runtime art bundles.
6. Resolve the 36 CageDefinition-to-40-visual crosswalk before Cage selection
   can show exact visual fields without guessing.

## Safe next promotion batch

After the licence and visual-approval records are linked, promote one **static**
Hunt field as the first browser QA slice. The caller must provide its explicit
`fieldId`; no Gate mapping is inferred. QA then verifies:

- 2048x2048 world is not portrait-cropped;
- 9:16 remains a clamped viewport over the full map;
- only one map texture is resident;
- exit unloads it;
- actors and capture stroke remain above the composite;
- collision and art are checked against the same explicitly selected field.

Animated Hunt fields and Cage fields follow only after their respective timing
and identity crosswalk gates close.
