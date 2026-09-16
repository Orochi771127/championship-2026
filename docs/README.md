# Championship 2026 Documentation Hub

Latest Raising lifecycle stage: [進化、排泄、睡眠與換日整合](research/RAISING_LIFECYCLE_STAGE_2026-09-08.md) · [same-stage contract and remaining original branches](contracts/championship/RAISING_LIFECYCLE_STAGE.v1.json). Core flow is integrated; full original stage remains open.

Latest Raising correction: [自主活動、肉／維他命與清潔圖像修正](research/RAISING_ACTIVITY_CARE_FIX_2026-09-08.md), with [validation receipt](reports/parity-audit/2026-09-08/activity-care-validation.json).

This is the single documentation entry point for the standalone repository.
Do not infer current implementation state from one historical coordination file.

## Start here

| Need | Canonical entry |
|---|---|
| Current original-content priority: characters and existing cages first | [2026-09-15 原創角色與棲地籠子優先](planning/ORIGINAL_CHARACTER_CAGE_FIRST_2026-09-15.md) · [concept and cost work packet](art/production/original-character-cage-r1/README.md) |
| Post-parity modernization / Astra visual POC candidates (planned, not implementation authorization) | [Championship Post-Parity Modernization Plan](planning/CHAMPIONSHIP_POST_PARITY_MODERNIZATION_PLAN_ZH_TW.md) |
| What works on current `main` | [Current Product Status](CURRENT_PRODUCT_STATUS.md) |
| 最近 repo／本地遊戲收束、目前發布與可重跑驗收 | [2026-09-16 收束回條](reports/repo-consolidation-2026-09-16/README_ZH_TW.md) · [驗證紀錄](reports/repo-consolidation-2026-09-16/validation.json) |
| Agent task instructions and instruction-maintenance evidence | [Reusable task prompt](coordination/CODEX_TASK_PROMPT_TEMPLATE_ZH_TW.md) · [2026-09-14 instruction and skills report](reports/instruction-audit/2026-09-14/IMPLEMENTATION_ZH_TW.md) |
| Current battle effect pictures and original impact continuation | [R12 supplied original effects](art/production/battle-effect-r12/IMPLEMENTATION_2026-09-08.md) · [R11 impact continuation](art/production/battle-effect-r11/IMPLEMENTATION_2026-09-08.md) · [Local art contract](contracts/championship/battle-original-effect-preview.v1.json) |
| Current battle normal approach/launch, three slots, attack lock and R8 integration | [Battle normal flow R9](art/production/battle-normal-flow-r9/IMPLEMENTATION_2026-09-07.md) · [Remaining work](planning/BATTLE_REMAINING_WORK_AND_R9_PLAN_2026-09-07.md) |
| Battle remaining native bodies, exact direction math and controlled attack motion | [Battle native motion R6](art/production/battle-native-motion-r6/IMPLEMENTATION_2026-09-07.md) |
| 224 character appearance refresh workflow and first four A/B concepts | [Appearance refresh implementation](art/production/characters/appearance-refresh-v1/IMPLEMENTATION_REPORT.md) · [Concept review](art/production/characters/appearance-refresh-v1/batch-01/review.html) |
| Latest Hunt A history/modifier return and original save/load lifecycle | [Hunt history lifecycle](research/HUNT_HISTORY_LIFECYCLE_2026-09-06.md) |
| Latest Hunt A generation comparison and remaining normal-entry dependencies | [Hunt generation/source progress](research/HUNT_GENERATION_SOURCE_PROGRESS_2026-09-06.md) |
| Current original-parity inventory, remaining work and SKILL execution plan | [2026-09-06 原作符合度盤點與完成計畫](planning/CHAMPIONSHIP_ORIGINAL_PARITY_STATUS_AND_SKILL_PLAN_2026-09-06.md) |
| What Claude Code / Codex already built and can be reused | [Reuse Inventory](REUSE_INVENTORY.md) |
| Original-game art coverage and replacement scope | [Art Master Inventory](art/ART_MASTER_INVENTORY.md) |
| Start with consolidated original-game UI, behavior and ROM evidence | [Original Video Evidence Index 2026-09-03 (繁體中文)](research/ORIGINAL_VIDEO_EVIDENCE_INDEX_2026-09-03.md) |
| Original video UI, interactions and gameplay evidence | [BV13u411B7BK Video Analysis (繁體中文)](research/video-BV13u411B7BK/ANALYSIS_ZH_TW.md) |
| Rope capture, 3D Gate Select and early-game video supplement | [BV1RQ4y1B7up Supplement (繁體中文)](research/video-BV1RQ4y1B7up/ANALYSIS_ZH_TW.md) |
| Cursor live-watch notes for those two videos (coarse; do not override frame indexes) | [Cursor Live Watch 2026-09-03](research/video-cursor-live-watch-2026-09-03/CURSOR_LIVE_WATCH_ZH_TW.md) |
| Codex prompt: consolidate video evidence + Claude audit (docs only) | [Codex Video Evidence Consolidation Prompt](coordination/CODEX_VIDEO_EVIDENCE_CONSOLIDATION_PROMPT.md) |
| Machine-readable original-art registry | [Art Asset Registry](art/ART_ASSET_REGISTRY.json) |
| Historical licensed-remake visual specification; new original batch follows the dated priority above | [Licensed Remake Style Bible](art/CHAMPIONSHIP_2026_LICENSED_REMAKE_STYLE_BIBLE.md) |
| Art batch order and A1 work packet | [Art Production Batch Plan](art/ART_PRODUCTION_BATCH_PLAN.md) |
| Reference-to-production mapping | [Art Production Crosswalk](art/ART_PRODUCTION_CROSSWALK.json) |
| Complete production direction | [Master Game Production Plan](planning/CHAMPIONSHIP_2026_MASTER_GAME_PRODUCTION_PLAN.md) |
| Solo + AI execution order | [Solo AI Parity-First Plan](planning/CHAMPIONSHIP_2026_SOLO_AI_PARITY_FIRST_PLAN_ZH_TW.md) |
| Modular Cage requirement | [Modular Cage System Spec](planning/CHAMPIONSHIP_2026_MODULAR_CAGE_SYSTEM_SPEC_ZH_TW.md) |
| Prioritized cleanup work | [Technical Debt Register](TECH_DEBT_REGISTER.md) |
| Repository/document organization decision | [ADR-0001](adr/ADR-0001-CANONICAL-REPOSITORY-AND-DOCUMENTATION.md) |

## Authority by question

Choose evidence for the question being answered; do not put all source types in one ranking.

| Question | Authority and limits |
|---|---|
| What did the original game do? | Verified ROM/CPU/emulator traces, decoded evidence and provenance, expressed in source-bounded contracts. Current product code, tests, art or Owner preference cannot prove original behavior. |
| What does this checkout implement? | Current source, runtime/save contracts and production manifests, with executed acceptance tied to its commit and environment. A test's existence alone is not a passing result. |
| What may this task intentionally change? | The latest explicit Owner direction applicable to that scope/batch, within host constraints. Record a deliberate departure as `OWNER_APPROVED_ADAPTATION`; never promote it to `ROM_VERIFIED`. |
| What is accepted, licensed or publishable? | Separate source, controlled, normal-path, visual, device, rights and publication records. The production index and applicable build-input/public-playtest policy select the allowed assets and destination; approval of one column does not close another. |
| What did earlier agents report? | Dated coordination, migration and QA snapshots are provenance. `CURRENT_PRODUCT_STATUS.md` is an index of evidence, not a substitute for source or executed checks. |

Resolve contradictions within the relevant question. Retain unknowns, record material conflicts and ask the Owner only for decisions the evidence or current task cannot settle. Do not infer original behavior from implementation or reinterpret approval as proof of rights.

Read the applicable Owner entries for the current task. Historical `Current`, `SYNC ONLY`, VS1-only or arithmetic-only wording applies to its dated batch; later explicit continuation applies to its own scope. Use [the shared-file protocol](coordination/SHARED_FILE_UPDATE_PROTOCOL.md) only when coordinating or writing shared state.

When an index disagrees with newly verified executable evidence, correct the affected index entry in the same change while preserving dated receipts. Do not relabel old test counts as current or rewrite another agent's owned status.

## Directory map

| Directory | Purpose | Runtime allowed? |
|---|---|---:|
| `src/championship/` | Standalone application, simulation and presentation code | Yes |
| `assets/production/` | Original-created runtime-loadable assets | Yes |
| `tests/` | Deterministic and browser verification | Test only |
| `docs/contracts/` | Evidence-bounded runtime/presentation contracts | No direct runtime import |
| `docs/reports/` | Generated QA evidence grouped by slice | No |
| `docs/planning/` | Current production, UI, art and backlog plans | No |
| `docs/research/` | Gameplay/source catalog and readiness audit | No |
| `docs/art/` | Original-art metadata, replacement backlog and pipeline rules | No |
| `reports/art/` | Generated per-domain Art-A matrices | No |
| `research/original-evidence/` | Research policy and external archive index only; no runtime imports | Never |
| `docs/coordination/` | Claude/Codex status history and evidence ledgers | No |
| `docs/migration/` | Repository migration provenance | No |

## Status vocabulary

- `INTEGRATED_REUSABLE`: present on `main`, tested and safe to extend within its contract.
- `INTEGRATED_BOUNDED`: usable, but intentionally temporary, partial or evidence-limited.
- `REFERENCE_ONLY`: useful to understand structure; never a shipping/runtime payload.
- `PLANNED`: approved as scope or sequence, not implemented.
- `HISTORICAL_SNAPSHOT`: preserves a past coordination state and may be stale.
- `UNKNOWN_REQUIRES_TRACE`: do not invent parity behavior.

## Working rules

- New current-state claims go into `CURRENT_PRODUCT_STATUS.md`, not another parallel status memo.
- New reusable systems must be added to `REUSE_INVENTORY.md` with their tests and constraints.
- Slice-specific generated evidence stays under `docs/reports/<slice>/`.
- Historical coordination records remain in place to preserve links; add a stale/superseded banner instead of duplicating or deleting them.
- ROM/decoded/reconstruction material defaults to `RESEARCH_ONLY`. The recorded local-reference and hash-selected public-playtest exceptions in [repository rules](../AGENTS.md) govern only their permitted rendered inputs and destinations; they do not authorize importing the private source archive, raw ROM payloads or commercial shipping.
