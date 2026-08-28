# Championship Rebuild Integration Plan V1

> **Historical pre-VS2 integration snapshot.** Its slice matrix was accurate at 2026-08-27 but predates the integrated VS2, VS2-R1 and VS2-R2 commits. Current status is indexed in `docs/CURRENT_PRODUCT_STATUS.md`; this file remains evidence history and must not be used alone to decide what is implemented.

Canonical product repository: `.`. VS1 is the only migrated playable slice; every later slice remains gated.

Status: **CHAMPIONSHIP 2026 STANDALONE DEVELOPMENT SSOT / VS1 COMPLETE BASELINE / VS2 GO REQUIRED**

Last reconciled: **2026-08-27**

Coordination baseline: **syncRevision 3 approved + 2026 Owner Product Reset reconciled**

## Purpose and counting rules

This plan tracks complete Championship gameplay flow without inventing a
completion percentage. It distinguishes source evidence, local implementation,
art/reference coverage, production assets, UI, persistence, and actual
integration. A local Claude checkpoint is not current formal-repository
integration. An Owner-approved art reference is not production art. A
production standard is not runtime packaging or shipping approval.

The target is now the standalone `DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD`:
web-first, mobile-first, portrait 9:16, touch-first, and desktop-browser
compatible. Nexus Link integration is frozen and outside current product scope;
it is not a missing dependency for completing Championship 2026.

Status vocabulary used below:

- `VERIFIED`: supported by the cited contract, tests, report, or repository
  artifact.
- `LOCAL_UNMERGED`: implemented and tested on the cited local branch, but not
  integrated into the formal repository branch.
- `REFERENCE_BASELINE`: Owner-approved research/reference coverage only.
- `PRODUCTION_STANDARD_AVAILABLE`: approved original-created visual system,
  not yet packaged into the slice.
- `RESEARCH_ONLY`: executable or data-layer research that is not product
  runtime authority.
- `NOT_STARTED`: explicitly reported as not started.
- `NOT_REPORTED`: no owned status or cited repository evidence closes it.
- `UNKNOWN_REQUIRES_TRACE`: exact runtime truth remains unproven.
- `FROZEN`: Owner has prohibited the next implementation or production step.
- `SUPERSEDED_FOR_CURRENT_PRODUCT`: retained historical direction that no
  longer controls Championship 2026.
- `OUT_OF_CURRENT_PRODUCT_SCOPE`: intentionally excluded, not incomplete.

## Renderer authority fixed by Owner

- DOM owns application and screen UI.
- PixiJS owns playable Championship 2D fields, actors, sprites, and 2D VFX
  presentation.
- Three.js is bounded to verified original 3D evidence or separately
  Owner-approved new 3D presentation.
- No all-DOM, all-Pixi, all-Three migration, second global renderer authority,
  second ticker, or second global router is permitted.
- No React rewrite, second store, or second save authority is permitted.

This resolves the former Phase 2 renderer-scope blocker. Owner authorization is
limited in this batch to documentation reconciliation. It does not authorize
VS2 implementation, Nexus integration, production-art expansion, or shipping
promotion.

## Gameplay preservation authority

- `ROM_VERIFIED` -> `DEFAULT_PRESERVE`.
- `PARTIAL` -> preserve the known structure; unknown fields remain neutral.
- `UNKNOWN_REQUIRES_TRACE` -> do not invent.
- `OWNER_APPROVED_ADAPTATION` -> the only category that may intentionally
  change original gameplay.

Modernization may update renderer, resolution, responsive layout, controls,
loading, save infrastructure, animation technology, asset resolution, VFX,
accessibility, mobile UX, performance, and packaging. It does not authorize
turning auto battle into manual-command combat, replacing Hunt tether/circle
capture with a generic button, inventing toolbar commands, or deleting Raising
systems for UI simplicity.

## Slice integration matrix

| Gameplay slice | Original Evidence | Runtime Status | Claude Implementation Status | Art Reference Coverage | Production Art Status | UI Status | Save/Data Status | Integration Status | Open Blocker | Next Executable Task |
|---|---|---|---|---|---|---|---|---|---|---|
| BOOT / ENTRY | ARM9 bootstrap and OVL3 boot/logo evidence; O1 Title/Login structure is `REFERENCE_BASELINE`; exact runtime composite remains 0/10 | New Game → Raising and Continue entry are verified on Claude local branch | `COMPLETE_LOCAL_CHECKPOINTED`; `championship.html` + standalone app | O1 Title/Login family | P1R component language is available; no packaged Boot family | Product-authored DOM entry exists locally; not original-parity UI | `championshipModernSave:v1` inspection supports Continue | `CHAMPIONSHIP_2026_LOCAL_BASELINE`; Nexus is `OUT_OF_CURRENT_PRODUCT_SCOPE` | CL-009 clean integration path before push/PR | Preserve during VS2; no product-flow redesign |
| TITLE / LOGIN | O1 Title/Login visual/NXR structure is `REFERENCE_BASELINE`; exact text, values, visibility and input behavior remain unverified | Product entry exists; original Title/Login behavior is not reconstructed | `PARTIAL_LOCAL_CHECKPOINTED` as product-authored New Game/Continue shell | O1 Title/Login | No screen-family production package | DOM shell only; P1R not consumed | Continue detection uses verified standalone save envelope | `PARTIAL_CHAMPIONSHIP_2026` | Runtime-composite and original input behavior not verified | Preserve current entry during VS2; schedule bounded parity review after the playable loop is coherent |
| RAISING HOME | OVL18, O1 Home structure, O3-B 40-field archive, toolbar framework/mode, Cage catalog and tutorial text are indexed | `COMPLETE_FOR_INT_RH2`; direct touch, CARE, relocation and restore are playable; exact Original care/Cage semantics remain unknown | Runtime/producer/Pixi checkpoint `2671db12`; one field-scoped PixiJS v8 Application | O1 Home + O3-B + ART-R2R/O2 character references | Environment `TEMPORARY`; character presentation assets `TEMPORARY`; P2/P2R remains proof only | `P1R_BOUND` at presentation checkpoint `bb61d18`; DOM toolbar has eight neutral disabled RAW slots; five viewports and bounded Pixi fallback pass | `SAVE_RELOAD_RESTORE_VERIFIED`; no second state/save authority; Original Cage configuration persistence remains unknown | `VS1_COMPLETE_BASELINE / OWNER_APPROVED_INTEGRATION_BASELINE` | Toolbar semantic bindings, exact care semantics, final Raising environment, final creature production | Preserve as VS1 while VS2 is separately authorized and built |
| CAGE EDIT | O3-B provides 40/40 field visual reference; dedicated O1 layout composition is insufficient; OVL15 does not use shared toolbar | `NOT_STARTED` product runtime | `NOT_STARTED` | O3-B `REFERENCE_BASELINE`; Cage Edit layout remains insufficient | None | `NOT_STARTED`; no generic-cell invention permitted | Ownership is verified; configuration writer/save/restore remains `UNKNOWN_REQUIRES_TRACE` | `PLANNED_VS4 / NOT_YET_INTEGRATABLE` | CL-004 plus Cage/Home configuration writer and restore chain | VS4 evidence-closure packet before UI/runtime construction |
| SHOP | O1 Shop structure and forensic Shop/Cage records are available | `NOT_STARTED` product runtime | Research transaction/data modules exist; owned status remains `NOT_STARTED` | O1 Shop `REFERENCE_BASELINE` | P1R Shop family is an approved presentation standard, with zero economy authority | Review/mock UI only; not runtime packaged | 118 records are forensic data; purchase/save product writes are not implemented | `PLANNED_VS4 / ART_AHEAD_OF_RUNTIME` | Economy/runtime authority not implemented | Bounded standalone Shop contract in VS4; preserve verified records and do not invent economy truth |
| DATABASE | O1 Database/Encyclopedia structure; generated evidence catalogs; O2 covers 224/224 decoded character entities | `NOT_STARTED` product runtime | `NOT_STARTED` | O1 Database + O2 Character Master Catalog | No Database production-art package | `NOT_STARTED` product UI | Generated catalogs are research/forensic inputs; no player database persistence | `PLANNED_VS4 / REFERENCE_AND_DATA_ONLY` | Runtime navigation, unlock truth and persistence not implemented | Define a read-only Database contract in VS4 from verified catalog fields |
| GATE / LOADOUT | O1 Gate/Hunt Loadout structure; ART-R4 Gate world/earth 3D reference; toolbar Hunt mode verified | `NOT_STARTED` product runtime | Research gate selector exists; product runtime is not started | O1 + ART-R4 `REFERENCE_BASELINE` | P1R Gate/Loadout UI standard available; product assets remain temporary/unselected | Review/mock UI only | No verified product loadout persistence | `NEXT_PLANNED_VS2 / ART_AHEAD_OF_RUNTIME` | Exact Gate flow/input/camera and loadout model unresolved | After Owner GO, publish bounded DOM Gate/Loadout contract; any 3D remains scene-bounded and evidence-gated |
| HUNT FIELD | O3-C 16/16 biome archive; 29 variants audited; 128×128 modular field evidence | `NOT_STARTED` | Research field/hunt modules exist; owned product status is `NOT_STARTED` | O3-C `REFERENCE_BASELINE` | No approved Hunt production biome; temporary original-created technical art is allowed only after batch authorization | Hunt toolbar mode is verified; field UI/runtime not built | No Hunt product save/progression contract | `NEXT_PLANNED_VS2 / REFERENCE_ONLY` | `HuntFieldContract NOT_STARTED`; gameplay/collision/encounter authority absent | After Owner GO and runtime contract, build one Pixi 2D field preserving large world, modular terrain, object placement and hidden grid |
| CAPTURE | Existing reverse/research modules establish a bounded data path, but no Owner-approved complete visual family is indexed | `NOT_STARTED` | Research capture transaction exists; product runtime is `NOT_STARTED` | `PARTIAL / NOT_REPORTED_AS_COMPLETE_FAMILY` | None | `NOT_STARTED` | Capture result persistence not implemented | `PLANNED_VS3 / RUNTIME_AND_ART_NOT_READY` | Tether/circle capture input, success truth, UI and save consequences not closed | VS3 evidence reconciliation and contract; preserve the original tether/circle mechanic |
| HUNT RESULT | OVL4 Tamer-info/Hunt-result identity and OVL18 `/ui/hunt/result` reference exist; no O1 Hunt Result visual family is approved | `NOT_STARTED` | `NOT_STARTED` | `PARTIAL / NOT_REPORTED_AS_COMPLETE_FAMILY` | None | `NOT_STARTED` | Rewards/progression writes not implemented | `PLANNED_VS3 / NOT_STARTED` | Result schema, rewards, UI and save authority absent | Close only with the VS3 capture/result contract; preserve the evidence gap |
| BATTLE MENU | O1 Battle Menu/Setup is `REFERENCE_BASELINE` | `NOT_STARTED` | `NOT_STARTED` product runtime | O1 Battle Menu | P1R language available, no packaged Battle Menu family | `NOT_STARTED` product UI | Loadout/selection persistence not implemented | `PLANNED_VS5 / ART_REFERENCE_ONLY` | Battle runtime contract absent | VS5 Battle Setup state/input contract preserving original auto-battle entry |
| BATTLE RUNTIME | Stage 1–3 reverse evidence and damage core exist; O3-D supplies 11/11 static fields; ART-R4 supplies VFX/3D reference | `NOT_STARTED` product runtime | Research battle modules exist; owned status remains `NOT_STARTED` | O3-D + ART-R4 `REFERENCE_BASELINE` | Legacy P5 is superseded/frozen; VS7 production assets are not authorized | `NOT_STARTED` | Outcome/reward persistence not implemented | `PLANNED_VS5 / RESEARCH_AND_ART_REFERENCE_ONLY` | Battle B02/B03/B05/B06/B09 gaps; BM03/BM04 animated layer unknown | VS5 evidence-bounded auto-battle contract; do not convert to manual-command RPG |
| BATTLE RESULT | OVL8, four `battle_result/*.nxr` scenes, Bits writer evidence, and O1 Battle Result structure | `NOT_STARTED` | Research result envelope/module exists; product runtime is not started | O1 Battle Result | No packaged result family | `NOT_STARTED` product UI | Full result-write graph and progression save path absent | `PLANNED_VS5 / ART_REFERENCE_ONLY` | Battle runtime and B10 full result write graph absent | Define within VS5 only after auto-battle outcome authority exists |
| PROGRESSION | Tamer Info O1 reference and forensic catalogs exist; no complete progression visual/runtime contract is reported | `NOT_STARTED` | `NOT_STARTED` | O1 Tamer Info provides partial visual context | None | `NOT_STARTED` | Progression state, writes and migration not implemented | `PLANNED_VS6 / NOT_STARTED` | Product progression/economy authority absent | VS6 evidence and product contract; do not infer from Tamer/Cage labels |
| SAVE / LOAD | Suspend-save references exist; original PlayerData serializer is not supplied; standalone save contract is verified product evidence | `COMPLETE_FOR_INT_RH2` | Runtime checkpoint `2671db12`; Phase 1 standalone envelope unchanged | No dedicated production family required; O1 system UI may inform later presentation | `P1R_BOUND`; Save/Continue calls the published intent and holds no second state | Real Chromium proved interaction → CARE → relocation → SAVE → page reload → CONTINUE → restored cage/care state; transient selection/reaction did not persist | `SAVE_RELOAD_RESTORE_VERIFIED`; `ChampionshipModernSave:v1`, 8 top-level keys, deny-by-default, no new save fields | `OWNER_APPROVED_INTEGRATION_BASELINE` | Broader slice schemas remain absent; VS2 has no GO | STOP |

## Current flow verdict

Only the bounded VS1 path is currently playable, in the local checkpointed
cross-agent worktree:

`BOOT / ENTRY → RAISING HOME → SAVE → LOAD / RESTORE`

That path now consumes the P1R DOM package and one field-scoped PixiJS v8
presentation through the published seam. It passed five viewport checks and a
real save/reload restoration flow and is checkpointed at runtime `2671db12` and
presentation `bb61d18`. It is not pushed, merged, deployed, complete Original
runtime parity, final visual production approval, or shipping approval. Nexus
integration is outside the current product scope and is not required for this
baseline.

All other gameplay slices are either reference-only, research-only, explicitly
not started, or blocked by missing gameplay/save authority. O2 improves Owner
visual coverage and Database/character reference readiness; it creates no
runtime completion.

## Evidence sources

- `CLAUDE_REBUILD_STATUS.json` and `CLAUDE_SYNC_DELTA.json` at the approved
  SYNC-2 baseline.
- `CODEX_ART_STATUS.json` and `CODEX_SYNC_DELTA.json` at the approved SYNC-2
  baseline plus the O2 completion delta.
- `CHAMPIONSHIP_DEPENDENCY_MATRIX.csv` and
  `CHAMPIONSHIP_BLOCKER_LEDGER.csv`.
- Claude local verified HEAD
  `2632ddffac6da82525ed2e9089799e42fbffc25c`.
- Art checkpoints O1 `d01146c`, ART-R2R `48ea64f`, O3-B `eba10bc`, O3-C
  `a4c162d`, O3-D `9d33b9eaa589307a3d6583afe0f319b6fe20bcf9`, ART-R4 `9d03804`,
  and P1R `fbf4deb`.
- O2 catalog manifest and index under
  `reports/art-original/characters/o2-character-catalog/` and
  `docs/art/original-reconstruction/ART_O2_CHARACTER_MASTER_INDEX.csv` in the
  art evidence worktree.

## Championship 2026 vertical-slice development plan

INT-RH2 is `VS1_COMPLETE_BASELINE / OWNER_APPROVED_INTEGRATION_BASELINE`.
Runtime, presentation and coordination checkpoints exist; no push, merge or
deployment follows from that approval.

`VS2 — Gate To Hunt Exploration` is defined but not authorized for
implementation:

`RAISING HOME -> GATE SELECT -> HUNT LOADOUT -> VERIFIED HUNT FIELD -> WILD CREATURE -> EXPLORE -> EXIT -> RETURN RAISING HOME`

Ready inputs: verified Gate/Hunt reference evidence, O1 Gate/Hunt UI reference,
O3-C 16-biome archive, P1R UI system, Hunt toolbar mode 2, the existing
standalone state/save authority, and Owner permission to use original-created
neutral technical field assets.

Open before execution: separate Owner GO, a published Gate/Hunt runtime
presentation contract, exact navigation/return lifecycle without a second
router, a verified-bounds wild-creature movement contract, and explicit asset
selection under the temporary-art rule. Toolbar commands/icons/population,
exact care semantics, final Raising/Hunt environment art and final production
creature art remain unresolved. Capture, Hunt Result, Battle, Shop and Database
are outside VS2.

Subsequent bounded slices:

1. `VS3 — Hunt Capture And Result`: Hunt -> original tether/circle Capture ->
   Result.
2. `VS4 — Daily Systems`: Training / Care / Cage / Shop / Database.
3. `VS5 — Battle`: Battle Setup -> original-preserving Auto Battle -> Battle
   Result.
4. `VS6 — Progression And Save`: complete progression and cross-slice save
   integration.
5. `VS7 — Production Completion`: separate 2026 production art, animation,
   VFX, audio, performance, accessibility, packaging, and final QA.

VS2-VS7 are roadmap order, not blanket implementation authorization. Each must
be bounded, evidence-aware, testable, reversible, and separately gated under
the active Owner delegation. Legacy P3-P6 and Nexus integration decisions are
retained as history but `SUPERSEDED_FOR_CURRENT_PRODUCT / FROZEN`.
