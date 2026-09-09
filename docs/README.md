# Championship 2026 Documentation Hub

Latest Raising lifecycle stage: [進化、排泄、睡眠與換日整合](research/RAISING_LIFECYCLE_STAGE_2026-09-08.md) · [same-stage contract and remaining original branches](contracts/championship/RAISING_LIFECYCLE_STAGE.v1.json). Core flow is integrated; full original stage remains open.

Latest Raising correction: [自主活動、肉／維他命與清潔圖像修正](research/RAISING_ACTIVITY_CARE_FIX_2026-09-08.md), with [validation receipt](reports/parity-audit/2026-09-08/activity-care-validation.json).

This is the single documentation entry point for the standalone repository.
Do not infer current implementation state from one historical coordination file.

## Start here

| Need | Canonical entry |
|---|---|
| What works on current `main` | [Current Product Status](CURRENT_PRODUCT_STATUS.md) |
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
| Licensed remake visual authority | [Licensed Remake Style Bible](art/CHAMPIONSHIP_2026_LICENSED_REMAKE_STYLE_BIBLE.md) |
| Art batch order and A1 work packet | [Art Production Batch Plan](art/ART_PRODUCTION_BATCH_PLAN.md) |
| Reference-to-production mapping | [Art Production Crosswalk](art/ART_PRODUCTION_CROSSWALK.json) |
| Complete production direction | [Master Game Production Plan](planning/CHAMPIONSHIP_2026_MASTER_GAME_PRODUCTION_PLAN.md) |
| Solo + AI execution order | [Solo AI Parity-First Plan](planning/CHAMPIONSHIP_2026_SOLO_AI_PARITY_FIRST_PLAN_ZH_TW.md) |
| Modular Cage requirement | [Modular Cage System Spec](planning/CHAMPIONSHIP_2026_MODULAR_CAGE_SYSTEM_SPEC_ZH_TW.md) |
| Prioritized cleanup work | [Technical Debt Register](TECH_DEBT_REGISTER.md) |
| Repository/document organization decision | [ADR-0001](adr/ADR-0001-CANONICAL-REPOSITORY-AND-DOCUMENTATION.md) |

## Authority order

1. Latest explicit Owner direction.
2. Current `main` source, tests, production manifests and save/runtime contracts.
3. [Current Product Status](CURRENT_PRODUCT_STATUS.md), which indexes current integrated evidence.
4. Current planning and runtime contracts.
5. QA reports from the commit that generated them.
6. Research catalogs and web cross-checks.
7. Coordination/migration snapshots, which preserve history but may predate later slices.

`CURRENT_PRODUCT_STATUS.md` is an index, not a replacement for tests or source.
When it disagrees with executable evidence, fix the index in the same change.

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
| `research/original-evidence/` | Research policy and external archive index only | Never |
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
- ROM/decoded/reconstruction payloads never enter this repository or Git history.
