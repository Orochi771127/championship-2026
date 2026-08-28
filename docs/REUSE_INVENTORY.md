# Championship 2026 — Reuse Inventory

This inventory answers: “What has already been built, and what can the next slice safely reuse?”

## Reuse immediately

| Capability | Primary paths | Verification | Reuse rule |
|---|---|---|---|
| Standalone application/session | `src/championship/app/championshipStandaloneApp.js` | VS1/VS2 runtime tests | Extend through named app intents; do not create a second store |
| Screen stack | `src/championship/app/championshipScreenStack.js` | screen-stack tests in VS2 suite | Add declared transitions; top screen alone owns input |
| Persistent save/recovery | `ChampionshipPersistentSavePort.js`, `championshipStandaloneSave.js`, `championshipStorageGuard.js` | save, corruption and namespace guards | Extend schema through versioned migration; keep one key/writer |
| Shared Pixi stage | `src/championship/presentation/championshipPixiStage.js` | invariant and presentation tests | Add scenes to the shared stage; never create another global ticker |
| Raising presentation seam | `raisingPresentationSource.js`, `raisingHomeP1RView.js`, `createRaisingFieldPixiPresentation.js` | INT-RH2 tests + browser QA | Reuse getFrame/subscribe/intents; keep unverified effects neutral |
| Gate/Hunt presentation seam | `gateHuntPresentationSource.js` | VS2 and VS2-R1 tests | VS3 must consume this seam rather than own expedition state |
| Field camera/collision | `src/championship/field/` | frozen field invariants + VS2 tests | Reuse for large 2D fields; 9:16 remains a viewport |
| Deterministic Hunt world | `hunt/huntWorld.js`, `hunt/huntRuntime.js` | connected/distinct world and movement tests | Extend with traced spawn/AI/Capture events, not renderer state |
| Hunt Loadout domain | `hunt/loadout/` | VS2-R2 contract/runtime tests | Use for VS3 inventory/capacity; do not invent equipment effects |
| Gate catalog/presentation | `gate/gateCatalog.js`, `createGateSelectThreePresentation.js` | VS2-R1 contracts + browser QA | Keep Three.js presentation-only and retain 2D fallback |
| Evidence taxonomy/firewall | `src/championship/contracts/` | policy, ingest and migration-firewall tests | Every parity claim carries evidence status; research results cannot patch player state |
| Neutral production assets | `assets/production/temporary/` | asset-registry and runtime-path tests | Valid for prototypes only; replace through manifests |

## Reuse with explicit boundaries

| Asset/system | Status | Safe use | Do not do |
|---|---|---|---|
| Temporary residents and environments | `INTEGRATED_BOUNDED` | functional QA and content-swap proof | treat as final IP/launch art |
| Gate Three.js world | `INTEGRATED_BOUNDED` | structural 3D Gate presentation | claim exact original camera/rotation parity |
| Raising Care interaction | `INTEGRATED_BOUNDED` | reaction/feedback and persistence marker | apply guessed original stat gains |
| Hunt equipment numeric labels | `INTEGRATED_BOUNDED` | display recovered vocabulary and owned quantities | consume durability/power without traced rules |
| Coordination status JSON | `HISTORICAL_SNAPSHOT` | provenance and agent-lane history | use alone as current product status |
| Original art/map/character references | `REFERENCE_ONLY` | structure, counts and clean-room design input | load, copy or derive shipping pixels from ROM data |

## Contracts ready for the next slices

| Contract | Consumer |
|---|---|
| `VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT.json` | current Gate/Hunt presentation and future VS3 transition |
| `VS2_GATE_SELECT_3D_RUNTIME_CONTRACT.v1.json` | bounded Gate 3D/fallback maintenance |
| `VS2_HUNT_LOADOUT_RUNTIME_CONTRACT.v1.json` | VS3 Capture capacity and equipment handoff |
| `INT_RH2_RUNTIME_PRESENTATION_CONTRACT.json` | future Raising/Cage work |
| `CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json` | contextual toolbar closure when commands are traced |
| `raising-home-presentation.v1.json` | resident animation/presentation compatibility |

## Work that is not already implemented

- Capture tether/circle interaction and Hunt Result atomic transaction;
- exact Raising care formulas and complete modular Cage editor/effect resolver;
- Shop transaction runtime and Database collection UI/state;
- product Battle setup, deterministic auto-battle runtime and result writes;
- Titles, rank, four-year Championship progression and complete long-save schema;
- final original public IP, creatures, environments, UI, VFX, audio and localization;
- online service replacement.

These belong to the current production backlog; they should extend the reusable foundations above rather than start parallel implementations.
