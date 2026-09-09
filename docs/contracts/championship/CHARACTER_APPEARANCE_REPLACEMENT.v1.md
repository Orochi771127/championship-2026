# Character appearance replacement v1

Status: implemented optional loader seam and optional content-hashed M201 common-origin adapter; no active replacement. Other entities still require the existing logical canvas and anchor. Geometry support does not approve artwork or register a replacement.

## Existing authority

`licensedCharacterRoster.js` owns species bindings, entity resolution, `createActor`, Main-only scene image residency and disposal. `characterAppearanceReplacement.js` validates an optional whole-entity package. `pixiCharacterRuntimeBundle.js` performs metadata preflight before following image dependencies. No new gameplay state or animation driver is introduced. The current M003 native frame presenter is preserved.

The roster defaults `appearanceReplacements` to `manifest.appearanceReplacements ?? []`, and `baselineMotionContracts` to `manifest.motionContractHashes ?? {}`. Both are empty in the active baseline. An invalid candidate falls back to the whole baseline entity and records `replacementFailures`; no per-frame mixed identity is allowed.

## Registration after completed artwork

Each descriptor is `{entityId, assetId, manifestPath, manifest}`. It must have exactly one production-index entry and one selected descriptor for the entity. Its path is `assets/production/characters/appearance-refresh-v1/<entity>/<version>/manifest.json`; the manifest's relative runtime path must be `runtime.json`.

The embedded manifest and production-index entry must agree on entity, asset ID, design version, manifest path and canonical motion-contract SHA-256. They must explicitly contain `humanApproved:true`, `runtimeEligible:true`, `publicReleasePermitted:false`, `shippingReady:false`, and `qa:{design:"APPROVED",motion:"PASS",technical:"PASS",normalPath:"PASS"}`. These flags record prior checks; the loader cannot confer approval.

The manifest also has Main/Sub cell counts, sequence counts and positive integer `rgbaBytes`. `manifest.motionContractHashes` comes from the generated catalog's actual-file hashes. Research contracts are not fetched by the game.

## Actual-content validation

The loader compares both runtime sides with baseline JSON: source IDs/names/aliases, raw modes, normalized loop start, ordered cells/ticks/texture keys, logical canvas and anchor. Matching declared hashes is insufficient. Both sides' atlas metadata must cover the complete original cell-key set before any candidate PNG loads, although normal scenes only load Main images.

Runtime and atlas JSON are forced through the JSON parser. A runtime document masquerading as a spritesheet is rejected. Paths stay relative to the character directory and cannot contain traversal, schemes, queries or multipack dependencies. `meta.image` must match the registered image; each page is at most 2048 pixels per edge. Atlas and trim rectangles are checked against page and logical-canvas bounds; rotated frames are refused. Failed owned spritesheets are destroyed during cleanup.

## Geometry limitation and completion boundary

The origin audit established that historical atlases fit and align poses independently. New private reference guides preserve one native scale and common source origin. The M201 adapter now derives a calibrated anchor from the first baseline frame while preserving signed native relative displacement across all83 Main/Sub frames. Landmark locks and artwork alignment remain separate from array equality.

For M201: source canvas464×368, origin(184,268), scale12; baseline origin(192,296), anchor pixels(192,320), scale12. The correct replacement anchor is `(184/464,292/368)` and atlas `meta.scale` is1. Taking origin y268 as the anchor would move the baseline pose by24 local pixels. Existing Raising scale120/352 and Hunt scale0.18 remain unchanged; parent actor flips still apply normally.

The optional branch requires manifest `originGeometry` plus `geometryContractSha256`, matching index hash and baseline `originGeometryContractHashes[entityId]`, and `qa.geometry:"PASS"` on both manifest/index. The actual payload is hashed using sorted-key UTF-8 JSON, two spaces and final LF. The payload links source audit, baseline runtime and motion-contract hashes; it validates first-frame references, alpha bounds, measured crop geometry and equal Main/Sub transforms. Only M201 is supported. No game fetch to private source evidence is introduced. Geometry hash participates in the texture cache namespace. Atlas `meta.scale` must be a finite positive number or unambiguous numeric string matching the expected resolution; missing, boolean, null, whitespace and numeric prefixes refuse.

The metadata-only fixture is `tests/fixtures/championship-m201-origin-geometry.v1.json`, hash `9a0b45c72869f1a36653ce6b033a09643fc688f3134cc063f44702e4b141ffca`. This test fixture is not production registration. With no registered geometry, the original canvas/anchor equality guard remains mandatory. New-character browser visual and device QA remain pending.

`normalPath:PASS` covers currently reachable appearance paths. It does not establish all 11,480 source sequences have normal gameplay owners. Native timeline parity, human final visual QA, physical touch-device checks, and shipping readiness retain independent statuses.

## Verification

40 new replacement checks cover approval/registration, real sequence drift, incomplete sides, dependencies, invalid paths/rectangles, whole-entity fallback, cache isolation, disposal and native-presenter preservation. Canonical focused suites passed 71/71; full serial JavaScript regression passed 1,040/1,040 on 2026-09-06. No complete new character package was active during this run.

After Owner selection,28 geometry tests were added: real installed Pixi classes, first-pose baseline bounds, all83 source frames, both scene scales, four parent-flip combinations, doubled source resolution and malformed/undeclared geometry rejection. Combined canonical origin/replacement/roster/native/timeline focused run passed85/85. These are CPU-side Pixi geometry tests, not GPU/browser visual acceptance.
