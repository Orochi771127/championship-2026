# Championship Master Sync

> **Historical synchronization snapshot.** This file records syncRevision 3 and the 2026-08-27 migration state. VS2, VS2-R1 and VS2-R2 were integrated by later commits. Use `docs/CURRENT_PRODUCT_STATUS.md` for current `main`; retain this file for cross-agent provenance.

Canonical root: `.` (`CHAMPIONSHIP_2026_PRODUCT_SSOT`).  
All external pre-migration locations have been replaced by the repo-relative provenance index at `docs/migration/PRE_MIGRATION_PROVENANCE.md`.

syncRevision: **3** (approved cross-agent baseline; this docs-only product reset
does not silently open SYNC-4)
Product direction revision: **CHAMPIONSHIP_2026_RESET_1**
Last reconciled: **2026-08-27**
Round: **Post-SYNC-3 — Championship 2026 standalone repository migration / Owner review gate**
Merge writer: **Codex (coordination responsibility only)**

This file is an evidence index. Owner direction, agent-owned STATUS/DELTA files,
source reports, contracts, manifests, tests, and Git state remain authoritative.

## Product state

<!-- record-id: CHAMPIONSHIP_2026_REPOSITORY -->
- `.` is now the independent `CHAMPIONSHIP_2026_PRODUCT_SSOT` on branch `main`.
- The clean history begins with foundation checkpoint `efb397a`; VS1 is the only playable slice admitted by migration.
- Runtime, production assets, tests, and npm dependencies resolve entirely inside this repository after `npm install`.
- VS2 remains not authorized. The pre-migration repositories are external read-only provenance, not runtime dependencies.

<!-- record-id: PRODUCT_SCOPE -->
- The current product is `DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD`: a
  standalone, web-first, mobile-first, portrait 9:16, touch-first game with
  desktop-browser compatibility.
- The former plan to keep Championship as a bounded NexusLink domain is
  `SUPERSEDED_FOR_CURRENT_PRODUCT`. Nexus Link integration is
  `FROZEN / OUT_OF_CURRENT_PRODUCT_SCOPE`; historical Nexus decisions remain
  preserved in this repository and decision log.
- INT-RH2 Raising Home is the first accepted Championship 2026 playable
  baseline. Current environment and creature visuals remain temporary.
- O2 Original Character Master Catalog remains Owner-approved at local
  checkpoint `732775486665b21508ac51c1eea0b723db0f7744`. Original decoded art
  remains ROM-copyrighted research reference and separate from 2026 production
  assets.

<!-- record-id: CHAMPIONSHIP_2026_GAMEPLAY_POLICY -->
- `ROM_VERIFIED` behavior is `DEFAULT_PRESERVE`.
- `PARTIAL` preserves its known structure; `UNKNOWN_REQUIRES_TRACE` remains
  neutral and must not be invented.
- `OWNER_APPROVED_ADAPTATION` is the only authority for an intentional gameplay
  change. Modernization may change presentation technology and delivery, not
  silently redesign auto battle, Hunt tether/circle capture, contextual
  toolbar behavior, or Raising systems.

## Claude runtime state

<!-- record-id: CLAUDE_CHECKPOINT -->
- Local recovery checkpoint root:
  d7a66b102e95ae6c19b0820cfa93092651c060d8.
- Current verified HEAD:
  2632ddffac6da82525ed2e9089799e42fbffc25c, following a1b74f4, b2a46cd, and the bounded toolbar closure at 2632ddf.
  The checkpoint root and current HEAD are intentionally distinct.
- Branch claude/evidence-taxonomy-m1 remains local-only, not pushed and not
  merged. INT-RH2 runtime is checkpointed at `2671db12`; P1R presentation/QA is
  checkpointed at `bb61d18`. The implementation worktree is clean. The original
  recovery root remains d7a66b1.

<!-- record-id: CLAUDE_TEST_BASELINE -->
- Pre-INT-RH2 QA baseline: **471 pass / 3 expected / 0 unexpected**. INT-RH2
  focused QA adds P1R 4/4, runtime/Pixi 6/6 and Phase 1 standalone 21/21;
  final aggregate and browser evidence are recorded in the INT-RH2 report.
- Previous 472/2/0 is superseded. The additional expected condition appeared
  because checkpointing made tools/reverse/ydi/** tracked and visible to the
  R2 protected-path gate; this is an additive SUPERSEDED_ON_THIS_BRANCH
  condition, not an unexpected runtime regression.
- Last full mutation sweep remains 61/61 killed (2026-08-26).

<!-- record-id: RUNTIME_COMPLETION -->
- Evidence taxonomy M1-M9.1, FULL_1720 promotion, Phase 1 standalone loop,
  Raising direct manipulation correction, Raising visual cleanup, and the
  cross-agent toolbar contract are complete.
- Raising toolbar delta closed slot N -> buttonN ordering and per-slot
  submenu storage. Per-slot command/icon binding, submenu population, slot 7
  identity, enable mask, and exact care values remain UNKNOWN_REQUIRES_TRACE.
- Hunt, Capture, Battle, Shop, Database, Progression, and Cage Edit product
  runtimes remain not started. Nexus integration remains deliberately absent
  and is no longer a current-product completion target.
- INT-RH2 is `OWNER_APPROVED_INTEGRATION_BASELINE`: Runtime
  `COMPLETE_FOR_INT_RH2`, UI `P1R_BOUND`, Save/Data
  `SAVE_RELOAD_RESTORE_VERIFIED`, and Integration
  `OWNER_APPROVED_INTEGRATION_BASELINE`.
- The current environment and resident visuals remain temporary presentation
  assets; this approval is not final visual production approval.

## Codex art state

<!-- record-id: CODEX_ART_CHECKPOINT -->
- Latest art checkpoint: O2 Character Master Catalog at
  `732775486665b21508ac51c1eea0b723db0f7744`, parent `9d33b9e`.
- O3-D remains recoverable at
  `9d33b9eaa589307a3d6583afe0f319b6fe20bcf9`, parent a4c162d.
- O3-D is OWNER_APPROVED_REFERENCE_BASELINE: 11/11 exact native static Battle
  fields, full static composition confidence, and zero object-link conflicts.
  BM03/BM04 remain ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE.
- All O3-D output stays ROM_COPYRIGHTED_REFERENCE /
  REFERENCE_RECONSTRUCTION / RESEARCH_ONLY / NOT_SHIPPING_READY.

<!-- record-id: ART_COMPLETION -->
- O1 UI: nine evidence-ready families, Owner-approved reference baseline.
- ART-R2R: four-representative fidelity pipeline, Owner-approved reference
  baseline; no 224-entity mass batch.
- O2 Character Master Catalog: 224/224 decoded entities (216 regular, 8
  eggs), 224 Main and 224 Sub sheets; zero new high-resolution redraws. Four
  ART-R2R representatives remain the only fidelity baselines.
- Training/Cage O3-B: 40/40 core and 40/40 full; CM12/CM18 sequence bindings resolved.
- Hunt O3-C: 16/16 biome representatives; 29 variants audited; 13 alternatives
  remain archival backlog.
- Battle O3-D: 11/11 static, Owner-approved reference baseline.
- ART-R4: five-system VFX/3D Owner-approved reference baseline.
- P1R: Owner-approved production standard, not shipping-ready.
- P2/P2R: retained modular environment proof, not a production standard.
- Legacy P3-P6: preserved as historical, `SUPERSEDED_FROZEN`; any future
  production-completion work is governed by separately authorized VS7 batches.

## Newly resolved dependency contracts

<!-- record-id: TOOLBAR_PRESENTATION_CONTRACT -->
Source: 2632ddf:docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json
(v1.1 SHA-256 6398DAF34919DD80249FD5CB6A35C40F2A2792F4E34BF1D7206CCEFBFE597667).

- Existing ROM-verified initializer, 8-slot storage, Training mode 1, Hunt mode
  2, and Cage Edit negative contract remain unchanged.
- `SLOT_TO_NODE_ORDERING`: slot N maps to `buttonN` left-to-right through table
  0x0209F7C4 `[16,15,14,13,12,11,10,9]`: ROM_VERIFIED.
- `SUBMENU_STORAGE_STRUCTURE`: every slot has up to eight submenu entries;
  pointers at toolbar +0xE64 with slot stride 0x20 and counts at +0xF64:
  ROM_VERIFIED.
- Per-slot command/icon binding, submenu population, slot enable mask, slot 7
  identity, and exact care values remain UNKNOWN_REQUIRES_TRACE.

<!-- record-id: RENDERER_AUTHORITY_POLICY -->
- DOM is application/screen UI authority. PixiJS is playable Championship 2D
  field/actor/sprite/2D-VFX presentation authority. Three.js is bounded to
  verified original or explicitly approved 3D presentation. No second global
  renderer authority, ticker, or router is permitted.

<!-- record-id: RAISING_PRESENTATION_CONTRACT -->
- RaisingPresentationContract remains verified at
  b2a46cd:docs/contracts/championship/raising-home-presentation.v1.json.

<!-- record-id: O2_CHARACTER_CATALOG -->
- OriginalCharacterO2Catalog is Owner-approved: 224/224 decoded entities,
  research-only and not shipping-ready. This is catalog approval, not mass
  high-resolution reconstruction approval.

<!-- record-id: INT_RH2_RUNTIME_PRESENTATION_CONTRACT -->
- Claude published the uncommitted contract-first seam at
  `docs/contracts/championship/INT_RH2_RUNTIME_PRESENTATION_CONTRACT.json` while
  holding HEAD `2632ddf`. Codex may bind only through
  `createRaisingPresentationSource(app) -> { getFrame, subscribe, intents }`.
- The Claude-owned producer and single Pixi field bootstrap are now implemented
  locally. Codex P1R consumes only the published seam; no second state, save,
  router, Pixi bootstrap or ticker was introduced.

## Resolved blockers and accepted checkpoint conditions

<!-- record-id: CL-001 -->
- CL-001 is resolved by checkpoint d7a66b1; current verified tip is b2a46cd.
  Nothing has been pushed or merged.

<!-- record-id: CL-007 -->
- CL-007 is mitigated by owned STATUS/DELTA files, Codex-only shared merge,
  stable-ID conflict rejection, base-hash recheck, validated temporary output,
  and atomic replacement.

<!-- record-id: CL-008 -->
- CL-008 is ACCEPTED / NO_ACTION_NOW. Three local commit subjects contain a
  cosmetic @ prefix. Owner does not authorize history rewriting in SYNC-2.

<!-- record-id: CL-009 -->
- CL-009 is ACCEPTED_IN_LOCAL_RECOVERY_CHECKPOINT. Approximately 35 MB under
  tools/reverse/ydi/staging is deterministic intermediate evidence. Do not
  push this branch as-is; prepare a clean integration path before any push.
  SYNC-2 does not delete, reset, rebase, or filter the checkpoint.

## Remaining open cross-agent blockers

<!-- record-id: OPEN_BLOCKERS -->
- CL-002 is `PARTIALLY_CLOSED`: slot ordering and submenu storage are verified;
  command/icon binding, submenu population, enable mask and slot 7 remain open.
- CL-003/CL-004: exact care state changes and Cage capacity/effects remain
  unknown. Exact care values were not directly proven by the bounded trace.
- CX-003: BM03/BM04 animated Battle placement/timing unknown.
- CX-004 is `CLOSED`: CM12/CM18 OPMD sequence IDs resolve through NANR to valid NCER cells.
- CX-005: creature animation semantic names remain blocked at RAW_SLOT_XX.
- CX-006: P2/P2R remains retained proof; legacy P3-P6 is
  `SUPERSEDED_FROZEN`, with production completion moved to the gated VS7 plan.
- CL-010 is `RESOLVED_OWNER_APPROVED_BASELINE` at runtime checkpoint 2671db12
  and presentation checkpoint bb61d18.
- CL-011 keeps VS2 implementation blocked until a separate Owner GO after this
  documentation-only reset. CX-007 records the temporary
  environment/creature production-art boundary.
- CL-012 records that Claude-owned runtime architecture/status documentation
  must adopt the Championship 2026 standalone product authority on its next
  owned update; Codex did not overwrite those files.

## Championship 2026 gameplay-flow verdict and safe next work

<!-- record-id: SYNC_3_FLOW_VERDICT -->
- Playable now: the locally checkpointed standalone flow `BOOT / ENTRY ->
  RAISING HOME -> direct interaction -> neutral toolbar presentation -> SAVE ->
  LOAD`. It consumes P1R DOM and one Pixi field. It is not pushed, merged,
  deployed, or final-art approved; Nexus integration is intentionally outside
  the current product scope rather than a missing completion step.
- Runtime ahead of production integration: Boot/Entry, Raising Home, and
  Save/Load have local runtime behavior but no formally integrated production
  art/UI package.
- Art/reference ahead of runtime: Cage Edit, Shop, Database, Gate/Loadout, Hunt,
  Capture, Hunt Result, Battle Menu, Battle Runtime, Battle Result, and
  Progression are reference-only, research-only, partial, or not started as
  recorded in `CHAMPIONSHIP_REBUILD_INTEGRATION_PLAN_V1.md`.
- INT-RH2 is the accepted VS1 baseline. It must keep unknown toolbar
  commands/care/Cage semantics neutral and preserve the sole router/store/save/
  ticker authorities.
- INT-RH2 is Owner-approved and checkpointed locally. VS2 is defined as Raising
  Home -> Gate Select -> Hunt Loadout -> verified Hunt field -> wild creature ->
  explore -> exit -> Raising Home, but implementation remains hard-gated.
- VS2 reference inputs are ready; Gate/Hunt runtime contracts, bounded wild
  movement, route/return lifecycle and exact temporary asset selection remain
  to be closed after an Owner GO. Capture, Hunt Result, Battle, Shop and Database
  are explicitly outside VS2.
- The legacy P3-P6 roadmap is superseded/frozen for the current product.
  Production art, animation, VFX, audio, and packaging are now planned under
  VS7, but no VS7 implementation or shipping promotion is authorized here.

## Championship 2026 vertical-slice roadmap

<!-- record-id: CHAMPIONSHIP_2026_VERTICAL_SLICE_ROADMAP -->
- `VS1 — Raising Home`: `COMPLETE_BASELINE` through INT-RH2.
- `VS2 — Gate To Hunt Exploration`: Gate Select -> Hunt Loadout -> Hunt Field
  -> Explore -> Return Home. `NEXT_PLANNED / OWNER_GO_REQUIRED`.
- `VS3 — Hunt Capture And Result`: Hunt -> tether/circle Capture -> Result.
  `PLANNED`, preserving verified original behavior.
- `VS4 — Daily Systems`: Training / Care / Cage / Shop / Database. `PLANNED`.
- `VS5 — Battle`: Battle Setup -> Auto Battle -> Battle Result. `PLANNED`;
  auto battle is a preservation constraint.
- `VS6 — Progression And Save`: full progression plus save integration.
  `PLANNED`.
- `VS7 — Production Completion`: production art, animation, VFX, audio, and
  packaging. `PLANNED`; research-source assets remain segregated.

## Product-reset reconciliation receipt

<!-- record-id: CHAMPIONSHIP_2026_RESET_MERGE_RECEIPT -->
- Base SHA-256 values:
  - Master: 438457002B9603D04C67C34E33874C1971C3C384A2A43CCBDED21EFA2ED069F1
  - Dependency Matrix: E8077DE255419FBBF7FCC94CF0ADA6AA026EE3E215760679ACDBC60AA00C65CB
  - Blocker Ledger: 9E181865E314A9D8D64B0198498330C94DA81C8110AABD77856550B395AC1F7F
- Both owned Status/Delta pairs were read. Claude-owned files remained
  read-only. The shared merge adds Owner product-policy records, preserves all
  historical stable IDs, rejects conflicts, and records final hashes in
  Codex-owned status/delta files.

## Frozen work

<!-- record-id: FROZEN_WORK -->
- Nexus Link integration and every Nexus-specific gameplay dependency.
- The legacy P3-P6 art roadmap, Moonlake/Verdant Relay expansion, mass original
  art, unapproved reverse traces, shipping promotion, push, merge, and deploy.
- All VS2-VS7 implementation during this documentation-only reconciliation.
