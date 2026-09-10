# ART MASTER TASK — PHASE 1 REPORT

Date: 2026-09-01

Scope completed: Task A — Art Planner; Task B — ROM / Registry Research; Task C — Art Architecture

Production performed after Phase 1 review: BM00/BM01 Battle review candidate only; no runtime promotion

Current update, 2026-09-01: the Owner authorized generator repair and direct start of the Battle pilot. All generator entry defects listed in this report are now fixed and covered by tests. BM00 exists once as a transparent canonical layer, BM01 references it, and five portrait review frames are available under `docs/art/production/battle/bm00-bm01-pilot/`. Historical findings below describe the Phase 1 pre-repair snapshot.

## REGISTRY

- Expected: 1,248 decision units after `752 audited + 496 ROM-derived` reconciliation.
- Verified: 1,248 unique registry asset IDs and 1,248 unique crosswalk reference IDs; missing 0, extra 0.
- ROM census: 6,317 art payloads in 1,705 families.
- Recovered correction: 716 families, 496 units, 2,687 files; recovered UI evidence is 118 files across nine directories.
- Lifecycle: 0 runtime-ready; 0 shipping-ready.

## AUTHORITATIVE FILES

- `docs/art/ART_ROM_RECONCILIATION.md` — read; 2026-09-01 reconciliation accepted.
- `docs/art/ART_ASSET_REGISTRY.json` — read and parsed; 1,248 assets.
- `docs/art/ART_PRODUCTION_CROSSWALK.json` — read and parsed; 1,248 records.
- `docs/art/ROM_ART_CENSUS.json` — read and parsed; ROM structural ground truth.
- Protected files and their two generator scripts were not modified.
- Supplied ROM SHA-256 independently matches `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`; no art media was extracted.

## FAMILY BREAKDOWN

| Family | Units |
|---|---:|
| UI | 449 |
| Character | 448 |
| VFX | 213 |
| Character animation | 60 |
| Cage | 40 |
| Hunt | 17 |
| Battle | 12 |
| 3D | 6 |
| Field unattributed | 3 |
| **Total** | **1,248** |

## READY TO AUTHOR

991 units have no explicit trace/partial-semantic blocker and may be considered for original, semantics-neutral authoring after Owner approval and Task D entry-gate repair:

- Character: 448
- UI: 447
- Cage: 40, visual-only and subject to scope-level restrictions
- VFX: 26
- Hunt: 16
- Battle: 10
- 3D: 4

“Ready to author” is not runtime or shipping readiness. Every record still lacks a production master, human approval, and runtime QA.

## BLOCKED

257 units have explicit trace/partial-semantic blockers:

- VFX: 187 — 2D sprite caller, trigger, and timing unknown.
- Character animation: 60 — raw slot meanings unknown.
- Field unattributed: 3 — consumer unknown.
- 3D: 2 — Gate camera/input trace incomplete.
- UI: 2 — Battle Main/Sub NXR node semantics partial.
- Battle: 2 — BM03/BM04 animated-layer binding unresolved.
- Hunt: 1 — HM00 identity and terrain effects unknown.

Additional scope blockers not fully projected into generated records: Cage terrain shapes, assembly rules, and stat bonuses; Gate-node-to-HM-field mapping.

Task D is also blocked by generated-view defects:

1. 224 duplicate `productionAssetId` groups affect all 448 gameplay/database character records.
2. All 1,248 registry dependency arrays are empty despite confirmed dependency edges.
3. Trace blockers do not propagate completely into the production crosswalk.
4. Current A1 character membership omits database partners and includes two trace-blocked Gate assets.

These must be repaired in the generators and rebuilt. The generated JSON views must not be hand-edited.

## SHARED DECISIONS

- 224 original palette decisions are shared across the 448 gameplay/database character records; the complete tier packages remain separate.
- Main and Sub character deliverables remain separate because bitmap and tiled source roles are structurally different.
- Hunt keeps base, optional animation, and optional object layers separate.
- Battle creates `field_bm00_00` once canonically for ten dependent arenas; BM07 is the exception.
- UI shares a 9:16 touch-first visual system while retaining Main/Sub source-role provenance.
- Provenance, technical frame, asset naming, and the three promotion gates are global shared contracts.

## PRODUCTION CONTRACTS CREATED

`ART_PRODUCTION_CONTRACTS_PHASE1.md` defines:

1. Gameplay Character Master Contract
2. Database Character Contract
3. Character Animation Contract
4. Hunt Field Contract
5. Battle Field Contract
6. Cage Contract
7. UI Contract
8. VFX Contract
9. Typography Contract
10. Bounded 3D Contract
11. Field-Unattributed Hold Contract

The shared envelope locks DOM/Pixi/Three ownership, 390×844 reference composition, five required viewports, production-path boundaries, atlas/provenance requirements, and independent licence/human/runtime gates.

## PILOT BATCH RECOMMENDATION

Recommended two-unit pilot:

- `art:battle-field:field-bm00-00:shared-layer-reference`
- `art:battle-field:battle-normal:arena-reference` (`field_bm01_01`)

BM00 is authored once as the canonical original shared layer. BM01 references it through a manifest dependency and carries only its arena-specific original replacement art.

This pair is small, avoids all 257 explicit semantic blockers and all character-ID collisions, and tests the complete Research → Architecture → Original Replacement → Export → QA → registry-validation flow. It does not require or authorize a Battle UI, gameplay semantics, VFX timing, animation-slot naming, HM00 identity, Gate mapping, Cage rules, or unattributed-field assignment.

Task D may begin only after generator repair, rebuilt validation, visual-target approval, and explicit Owner authorization.

## RISKS

- Existing validators pass while missing production-ID uniqueness, dependency-edge, and blocker-propagation defects.
- `ART_PRODUCTION_BATCH_PLAN.md` still contains 752-record and sixteen-Hunt assumptions; it is historical, not the active Phase 1 authority.
- `assets/production/` contains 2,571 files at the audit snapshot, but only three indexed runtime bundles and zero shipping-ready bundles. Internal faithful baselines, ROM conversions, review atlases, and temporary presentations are not original-replacement proof.
- Existing converted/enlarged reference media must not be used as production master input.
- Rights remain unknown in all 1,248 crosswalk records. Licence evidence, human visual approval, and runtime QA remain separate decisions.
- Concurrent lane changes remain in the worktree and were preserved.

## FILES MODIFIED

- `docs/art/ART_PRODUCTION_MASTER_PLAN_PHASE1.md`
- `docs/art/ART_SOURCE_CONTRACT_REPLACEMENT_CROSSWALK.md`
- `docs/art/ART_PRODUCTION_CONTRACTS_PHASE1.md`
- `docs/art/ART_PHASE1_REPORT.md`

No artwork, production manifest, runtime asset, registry, census, crosswalk, reconciliation, generator, `CLAUDE_*`, contract, or runtime trace was modified.

## VALIDATION

- `art:a0`: PASS — 1,248 crosswalk records, three non-shipping runtime bundles, zero promotions.
- `art:reconcile`: PASS — generated art registry views are current.
- `npm test`: PASS — 493 tests passed, 0 failed.
- Phase 1 document whitespace, identifier, and protected-path checks: PASS.

## FINAL STATUS

**READY FOR OWNER REVIEW**

Task D — Production Builder remains blocked pending Owner approval and generator-entry-gate repair.
