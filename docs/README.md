# Championship 2026 Documentation Hub

This is the single documentation entry point for the standalone repository.
Do not infer current implementation state from one historical coordination file.

## Start here

| Need | Canonical entry |
|---|---|
| What works on current `main` | [Current Product Status](CURRENT_PRODUCT_STATUS.md) |
| What Claude Code / Codex already built and can be reused | [Reuse Inventory](REUSE_INVENTORY.md) |
| Original-game art coverage and replacement scope | [Art Master Inventory](art/ART_MASTER_INVENTORY.md) |
| Machine-readable original-art registry | [Art Asset Registry](art/ART_ASSET_REGISTRY.json) |
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
