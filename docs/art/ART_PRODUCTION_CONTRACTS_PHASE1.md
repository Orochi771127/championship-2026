# Championship 2026 — Art Production Contracts, Phase 1

Status: `TASK C COMPLETE / BATTLE PILOT AT OWNER VISUAL REVIEW GATE`

Depends on: Task A `ART_PRODUCTION_MASTER_PLAN_PHASE1.md` and Task B `ART_SOURCE_CONTRACT_REPLACEMENT_CROSSWALK.md`

Artwork generated: 3 original review sources; 2 layered deliverable candidates; 0 runtime promotions

Task C does not reinterpret Task A/B evidence. It turns the verified counts, relationships, and blockers into authoring, export, QA, and promotion contracts.

## Task D entry gates

Update, 2026-09-01: entry gates 1–7 below are closed by explicit Owner authorization, generator rebuild, and passing validation. The BM00/BM01 pilot has begun and now waits at the independent Owner visual-target approval gate before runtime registration and isolated Pixi QA.

Task D must not begin until all are closed:

1. Fix the crosswalk generator so gameplay and database character records receive distinct tier-qualified production IDs.
2. Represent the 224 shared palette decisions as dependencies, not complete-package aliases.
3. Populate confirmed dependency edges and propagate trace blockers into generated production records.
4. Replace stale A1 membership that omits database partners and includes trace-blocked Gate assets.
5. Add validation for unique `productionAssetId`, 448 character deliverables, 224 gameplay/database pairs, 224 palette-decision relationships, blocker propagation, and canonical Battle shared-layer references.
6. Rebuild the generated views through their generators. Never patch registry or crosswalk JSON manually.
7. Obtain Owner approval for Tasks A, B, and C.

The 224 production-ID collisions are a global Task D entry blocker even though the proposed pilot contains no collided character record.

## Shared production envelope

- DOM/CSS owns application UI.
- The existing single PixiJS v8 Application owns playable 2D presentation. Art integration creates no second application, ticker, router, store, or save authority.
- Three.js stays bounded to explicitly approved Three scenes. A 3D effect does not convert its containing scene to 3D.
- Reference viewport: 390×844 CSS px.
- Contract viewports: 360×800, 390×844, 393×852, 412×915, and 430×932.
- Portrait 9:16 is a functional recomposition, not two DS screens stacked vertically and not literal NXR coordinates.
- Runtime-loadable files may exist only below `assets/production/`.
- Editable masters, contact sheets, provenance evidence, review material, and ROM evidence stay outside runtime bundles.
- ROM pixels, palettes, tiles, cells, textures, and geometry are prohibited production inputs.
- Runtime exports use sRGB unless a documented data texture requires otherwise; alpha, bleed, filtering, compression, and mipmaps are selected deliberately and verified in the real renderer.
- Mobile atlas pages normally stay at or below 2048×2048. Exceptions require a measured memory/performance receipt.
- Every runtime export has a stable manifest ID, source-master receipt, import settings, renderer owner, contract version, QA receipt, and independent promotion states.

Recommended separation, subject to Owner approval before Task D:

```text
docs/art/production/original-replacement/<family>/<unit-id>/
  masters/
  previews/
  provenance/
  qa/

assets/production/<family>/<tier-or-role>/<unit-id>/
  manifest.json
  runtime exports only
```

## Provenance and promotion contract

Every production record must retain:

- stable reference ID, tier-qualified production ID, repository path, family, role, and contract version;
- creator/source, source URL or order reference, acquisition/generation date, tool/model/version, prompt or source record, and edit history;
- licence name/version, terms evidence location, attribution, restrictions, and reviewer;
- technical dimensions, alpha, frames, anchor/pivot, filtering, colour space, atlas or texture budget, and renderer owner;
- native-scale review, in-engine review, technical checks, human approver, runtime-QA verdict, and output hashes;
- shared-decision links such as `paletteDecisionId` and canonical-layer dependencies.

Promotion has three independent gates:

1. `LICENCE_EVIDENCE`
2. `HUMAN_VISUAL_APPROVAL`
3. `RUNTIME_QA`

A pass in one gate never mutates or implies either other gate. After all three pass, final promotion still requires explicit Owner approval. File presence below `assets/production/` is not a gate result.

## 1. Gameplay Character Master Contract

- **Required inputs:** Unique gameplay-tier ID, entity identity brief, approved visual target, original shared `paletteDecisionId`, raw Main/Sub contract shape, and provenance record.
- **Authored master:** Editable layered raster/vector source with deterministic canvas, baseline, facing, scale, padding, and anchors; Main and Sub compositions remain separate.
- **Runtime export:** PixiJS transparent atlas/image family plus JSON manifest for `gameplay-main` and `gameplay-sub`.
- **ROM relation:** Preserve bitmap-versus-tiled role evidence only. Do not reuse ROM graphics, cells, palette, dimensions, or geometry.
- **Shared decisions:** Identity, silhouette language, materials, and one original palette decision are shared with the database tier.
- **Forbidden shortcuts:** Database alias, Main-to-Sub resize, ROM upscale, palette sampling, independent tier recolouring, or invented animation action names.
- **QA:** Native-scale silhouette, grayscale separation, alpha, baseline/anchor stability, atlas bleed, Pixi filtering, memory, Main/Sub differentiation, and palette-decision parity.
- **Promotion:** Static art enters the three gates only after tier IDs are unique. Animation binding remains raw-slot-only until traced.

## 2. Database Character Contract

- **Required inputs:** Matching gameplay identity contract, distinct database-tier ID, shared `paletteDecisionId`, database Main/Sub evidence, database presentation context, and provenance.
- **Authored master:** Independently composed database Main and Sub sources, designed for database viewing rather than reduced from gameplay art.
- **Runtime export:** Separate `database-main` and `database-sub` Pixi atlases/images and manifest.
- **ROM relation:** Preserve tier independence and shared palette relationship only. Graphics, cells, animation payloads, and scale remain distinct.
- **Shared decisions:** Identity and original palette roles match gameplay; composition, framing, and tier-specific detail remain independent.
- **Forbidden shortcuts:** Resize of gameplay exports, shared atlas-frame alias, collided production ID, or assumption that database slots share gameplay meanings.
- **QA:** Database-scale readability, palette-role parity, independent hashes/paths, correct tier manifest, alpha/padding, and absence of gameplay-frame dependencies.
- **Promotion:** Requires its own human and runtime verdict. Gameplay approval never approves database art.

## 3. Character Animation Contract

- **Required inputs:** Approved tier master, raw tier/screen slot ID, verified sequence count and contract shape, later trace where semantics are needed, anchor rules, and provenance.
- **Authored master:** Editable frame/timeline source keyed only by `rawOriginalSlot`, tier, and screen role until traced.
- **Runtime export:** Pixi atlas plus raw-slot manifest. `modernSemanticAction` remains null until authoritative trace.
- **ROM relation:** Regular contracts remain 40/13/4/3; eggs remain 2/2/1/1. These are counts, not action names or timing evidence.
- **Shared decisions:** Identity, volume, palette, baseline, facing, and costume remain stable.
- **Forbidden shortcuts:** Guessed slot meanings, pose-based naming, copied cells, or inferred cadence.
- **QA:** Sequence count, raw slot ID, frame bounds, volume drift, foot sliding, anchor stability, facing, atlas integrity, and motion review only when timing evidence exists.
- **Promotion:** All 60 semantic contract records remain trace-blocked. Exploration cannot be runtime-bound as a named action.

## 4. Hunt Field Contract

- **Required inputs:** Non-HM00 registry record, variant inventory, base/optional-animation/optional-object structure, camera contract, approved target, and provenance.
- **Authored master:** Separate base tile source, optional animated-terrain source, and optional object/cell source; gameplay data remains external.
- **Runtime export:** Pixi tile/atlas assets with distinct `base`, optional `anim`, and optional `obj` manifest references.
- **ROM relation:** Preserve the three-layer contract and variant identity without copying tiles, palettes, cells, or coordinates.
- **Shared decisions:** Projection, tile scale, palette roles, material language, edge treatment, and playfield value hierarchy.
- **Forbidden shortcuts:** Flattened background, baked 9:16 crop, HM00 biome invention, or Gate-node-to-HM mapping.
- **QA:** Layer toggles, seamless repeat where applicable, object and animation isolation, camera gaps, texture bleed, memory/loading, and all five viewports.
- **Promotion:** HM00 stays blocked. Other variants require all gates and one-field loading or bounded streaming proof.

## 5. Battle Field Contract

- **Required inputs:** Arena record, shared-layer relation, canonical shared-layer ID, known layer order where traced, 2D camera/playfield contract, target, and provenance.
- **Authored master:** One canonical `field_bm00_00` shared-layer master plus separate arena-specific layered masters.
- **Runtime export:** Pixi layered assets. Ten arena manifests reference one canonical shared runtime key; BM07 remains independent.
- **ROM relation:** Preserve eleven arenas plus one shared authored layer. Do not copy tiles, palettes, cells, or arena geometry.
- **Shared decisions:** Perspective, lighting, material language, playfield contrast, and canonical shared-layer appearance.
- **Forbidden shortcuts:** Ten copied shared files, per-arena drift, invented Battle UI, BM07 dependency on bm00, or invented animated-layer timing.
- **QA:** Manifest reference integrity, absence of duplicated shared payloads, layer alignment, playfield readability, texture bleed, responsive camera framing, and isolated Pixi loading.
- **Promotion:** BM03/BM04 animated-layer bindings remain blocked. Other outputs use all three gates.

## 6. Cage Contract

- **Required inputs:** Field ID, verified core/optional-animation/optional-object inventory, externally authoritative geometry/binding contract when available, neutral visual brief, and provenance.
- **Authored master:** Separate visual core field, optional animated terrain, and optional object sources. ATR/COL are not art masters.
- **Runtime export:** Layered Pixi visual manifest; collision, assembly, and stats only reference external runtime authorities.
- **ROM relation:** Preserve confirmed separation without reproducing composites, object cells, terrain shapes, or palette.
- **Shared decisions:** Projection, material language, value structure, decorative density, and object-edge policy.
- **Forbidden shortcuts:** Inferred terrain-shape meaning, assembly rule, stat bonus, passability, collision mask, or Cage binding.
- **QA:** Layer alignment, object isolation, field edges where required, animation isolation, visual/collision separation, viewport readability, and no false navigation cues.
- **Promotion:** Licence and visual gates may be reviewed; runtime QA stays blocked until Cage geometry, assembly, and binding authority exists.

## 7. UI Contract

- **Required inputs:** Non-blocked functional inventory, Main/Sub source roles, screen contract, safe-area/input rules, hierarchy, typography contract, state matrix, and provenance.
- **Authored master:** Responsive vector/9-slice/token sources and separate raster decoration where needed.
- **Runtime export:** DOM/CSS components and tokens; SVG for simple icons; PNG/WebP for raster ornament; optional Pixi decoration only within the renderer boundary.
- **ROM relation:** Main/Sub roles inform hierarchy; NXR coordinates and dual 256×192 placement do not become production layout.
- **Shared decisions:** Semantic palette, typography, focus/pressed/disabled/selected/warning states, corner/edge language, and touch-target rules.
- **Forbidden shortcuts:** Vertical DS stacking, rasterized labels, baked dynamic numbers, literal NXR placement, hidden unknown controls, or second state authority.
- **QA:** Safe areas, touch-first operation, code-native text, accessibility labels/focus, 9-slice scaling, overflow, pointer mapping, protected playfield, and all contract viewports.
- **Promotion:** The two trace-blocked Battle scene-role records remain excluded. Every component still needs all gates.

## 8. VFX Contract

- **Required inputs:** Verified media role, structural inventory, renderer owner, caller-provided trigger/timing contract when available, accessibility limits, target, and provenance.
- **Authored master:** Editable 2D frame/particle source or clean-room 3D DCC source according to verified media role.
- **Runtime export:** Pixi atlas/particle textures with raw frame IDs, or bounded GLB effect bundle. Trigger and schedule remain caller-owned.
- **ROM relation:** May preserve visual role, broad hierarchy, component count, and evidenced sequence order; never source pixels, palettes, cells, textures, or geometry.
- **Shared decisions:** Effect palette, edge softness, blend policy, luminance ceiling, reduced-flash/motion language, and renderer budget.
- **Forbidden shortcuts:** Guessed meaning, caller, trigger, duration, impact frame, loop, combat consequence, or converted-ROM GLB promotion.
- **QA:** Alpha fringes, blend, overdraw, texture budget, frame identity, reduced-motion/flash, native-scale read, and bounded renderer loading.
- **Promotion:** All 187 sprite families remain runtime-binding blocked. The 26 bounded clean-room families wait for the Task D entry gates.

## 9. Typography Contract

- **Required inputs:** One of seven font records, glyph/language needs, UI scale, font-role decision, complete licence or original-design provenance, and fallback policy.
- **Authored master:** Original editable outline/font source or licensed upstream master retained according to its terms.
- **Runtime export:** Subsetted WOFF2, CSS declarations, weight/style metadata, licence/attribution link, and fallback stack.
- **ROM relation:** NFTR proves a font deliverable exists; it does not authorize copying glyph outlines, bitmap strikes, metrics, or presumed role.
- **Shared decisions:** Type scale, numerals, line height, emphasis, fallback, and localization coverage.
- **Forbidden shortcuts:** NFTR conversion, glyph tracing, filename-based role inference, rasterized dynamic text, or unverified “free font” use.
- **QA:** Coverage, missing-glyph detection, shaping, numeral distinction, loading/fallback, reflow, clipping, contrast, text-scale resilience, and all viewports.
- **Promotion:** Licence evidence is mandatory but does not imply visual approval or runtime QA.

## 10. Bounded 3D Contract

- **Required inputs:** Non-blocked scene record, bounded Three consumer contract, camera/scale/axis needs, budgets, fallback requirement, target, and provenance.
- **Authored master:** Clean-room DCC source with deliberate topology, UVs, transforms, pivots, materials, LODs, and simplified collision proxies.
- **Runtime export:** GLB/glTF 2.0 plus bounded Three manifest and required 2D fallback.
- **ROM relation:** Structural role may inform the replacement; Nitro geometry, UVs, materials, textures, and animation cannot become the master.
- **Shared decisions:** Units, axes, channel conventions, texel density, light assumptions, LOD policy, and fallback identity.
- **Forbidden shortcuts:** Converted ROM mesh, topology inferred from a render, render-mesh collision, global Three scene, or Gate-to-Hunt mapping.
- **QA:** Scale/orientation, transforms, normals, manifold state, UVs, colour spaces, material slots, pivot, LOD, collision proxy, draw calls, memory, and real Three import.
- **Promotion:** Both Gate records remain blocked. The other four still require all gates.

## 11. Field-Unattributed Hold Contract

- **Required inputs:** Stable neutral reference ID, raw structural metadata, and authoritative consumer trace.
- **Authored master/runtime export:** None before consumer trace.
- **ROM relation:** Preserve only existence and raw family structure for `battle_01_01`, `battle_08_01`, and `battle_15_01`.
- **Forbidden shortcuts:** Assignment to any family or renderer from filename or appearance.
- **QA:** Record remains unassigned and absent from runtime manifests.
- **Promotion:** Fully blocked. After trace, it restarts the selected family’s full contract and gates.

## Pilot recommendation — canonical Battle shared-layer pair

Use exactly two non-blocked records:

- `art:battle-field:field-bm00-00:shared-layer-reference`
- `art:battle-field:battle-normal:arena-reference` (`field_bm01_01`)

Suggested role-qualified identities for the corrected generator:

```text
production:battle:shared:field-bm00-00
production:battle:arena:field-bm01-01
```

The BM01 manifest must reference the canonical BM00 asset instead of copying it.

This pilot is two units, avoids all 257 explicit trace blockers and all 224 character-ID collisions, and directly tests a non-negotiable dependency. It exercises clean-room research, layered authoring, normalization, Pixi export, manifest linking, native-scale review, provenance, and three independent gates. It requires no animation-slot meaning, HM00 identity, Gate mapping, Cage semantics, VFX timing, unattributed-field classification, or Battle UI invention.

Pilot acceptance:

1. Generator entry defects are fixed and rebuilt first.
2. Owner approves one native-scale visual target before production.
3. BM00 exists once canonically.
4. BM01 references BM00 through a manifest dependency; the shared payload is not duplicated.
5. Both masters are demonstrably original replacements.
6. No ROM palette, tile, cell, texture, or geometry enters a master or export.
7. Pixi loads both manifests through the existing application boundary.
8. An isolated art/runtime harness passes all five contract viewports without adding a Battle UI or gameplay semantics.
9. Licence evidence, human approval, and runtime QA have separate receipts and verdicts.
10. Generator-driven registry/crosswalk validation passes.
11. Owner explicitly authorizes any promotion.

## Task C stop condition

Task C ends with this architecture. No artwork, master, runtime asset, registry patch, manifest, or production code was created. Task D remains blocked by Owner review and the generator entry gates.
