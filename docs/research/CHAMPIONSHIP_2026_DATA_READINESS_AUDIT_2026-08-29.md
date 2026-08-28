# Championship 2026 — Data Readiness Audit

Date: 2026-08-29  
Product: standalone web/mobile remake  
Current runtime baseline: VS1 accepted; VS2 Gate → Hunt exploration exists and is stopped for review.

## Executive verdict

There is now enough data to build the complete **architecture and screen flow**, and enough verified data to implement
large portions of Hunt loadout, catalogs, shop structure, Title Match metadata and the known Battle resolver.

There is not yet enough evidence to claim full original parity. The remaining blockers are concentrated in runtime
semantics, product/legal decisions and production content—not raw ROM availability.

## What is already available

| Domain | Available evidence |
|---|---|
| ROM/filesystem | Full 64 MiB YDIJ source; 6,419 NitroFS files; ARM9/ARM7; 22 ARM9 overlays; source offsets and SHA-256 |
| UI | 96 NXR scenes / 1,369 nodes; background/cell references; linked resource maps |
| Creatures | 224 entities; complete Main/Sub asset contracts; 40 Main + 13 Sub raw animation slots |
| Locations | 16 Hunt identities, 40 Cage/Training references, 11 Battle fields |
| Hunt | Five equipment classes; 49 Hunt items; 30 plugins; four gear + four plugin positions; analyzer/HUD mapping |
| Battle data | 596 actions; 152 teams; 456 presets; 62 Title Matches; 45 eligibility rules; 11 fields |
| Battle runtime | Damage core, cooldown cadence, status slots/timing, buffs, heal/clear, AI structure, Bits cap/write |
| Shop/economy | 118 records: 4 Training, 49 Hunt, 30 Plugin, 35 Cage; visibility states and unlock structure |
| Text/audio | 3,197 decoded source text records; 151 extracted SDAT payloads and symbol references |
| Web runtime | One state authority, one save repository, one Pixi application; DOM UI; bounded Three.js; responsive browser QA |

## Data still required before feature-complete parity

### P0 — blocks faithful gameplay

1. **Care handlers:** exact mutation, consumption, success/failure and treatment behavior.
2. **Cage/training math:** capacity, occupancy, level scaling, per-cage stat/family/resistance deltas and seasonal modifiers.
3. **Evolution resolver:** complete conditions, priority/ties, hidden values, reset scope, life-history and egg-reversion behavior.
4. **Hunt runtime:** wild AI state meanings, spawn-selection rules, Rope/Shot/Wire/Entrap/Damage-Trap transitions,
   capture capacity and result writes.
5. **Battle P0:** hit/miss, TP/resource consumption/recovery, action-start seeding/ties and Championship endurance writes.
6. **Progression/save:** complete Title/Badge/Rank/Gate/Memory/Cage/Plugin/Licence write graph and durable schema.

### P1 — blocks complete player experience

1. Toolbar command/icon/submenu bindings and enable rules.
2. Text control tags, lookup IDs, mail/event triggers and tutorial sequencing.
3. SDAT file ID → runtime caller → gameplay event/VFX map.
4. Password encoding/validation behavior.
5. Database completion rules and reported one-creature direct-control reward.
6. BM03/BM04 animated layer placement/timing, CM12/CM18 object links and animation-slot semantic names.

### Product decisions that ROM research cannot supply

1. **IP licence or replacement plan.** ROM graphics, names, music and extracted assets are not automatically shippable.
2. **Online scope.** Original Nintendo WFC is gone; choose offline-only, private-room multiplayer, matchmaking or all three.
3. **Modern information policy.** Decide which originally hidden evolution/family values become visible or explainable.
4. **Accessibility and difficulty adaptations.** Touch alternatives, reduced motion, readable text, color-independent status,
   save recovery and optional pacing controls.
5. **Production art/audio.** Original-created creature art, environments, UI, VFX and music with performance budgets.

## Can Codex fill the missing data?

| Gap type | Can be filled? | Method |
|---|---|---|
| Static catalogs, UI flow, mode inventory | Yes, now | ROM tables + NXR/text + cited web cross-check |
| Care/cage/evolution formulas | Likely | ARM9/OVL15/OVL18 static trace, then emulator fixtures |
| Hunt AI and equipment branches | Likely | OVL12/native-call trace + deterministic capture scenarios |
| Battle hit/miss and TP | Likely but high-risk | OVL19/action-script/native/projectile tracing; never infer from guides |
| Progression/save writes | Likely | OVL8/PlayerData reader-writer graph + save diff fixtures |
| Text/audio event mapping | Yes with tracing | Text/SDAT IDs cross-referenced against ARM/overlay callers |
| Original online service | No | Must design and build a new web backend |
| Legal rights and final production assets | No, not from ROM | Owner/licensor decision and original production pipeline |

## Current repository gap

Runtime status, not research readiness:

- Implemented: Raising Home, save/load for the Raising slice, Gate Select, original-structure Hunt Loadout and Hunt
  exploration.
- Not started: Capture, Hunt Result, Shop, Database, Battle Menu, Auto Battle, Battle Result and full progression.
- Partial: Title/Login, Care, Cage/Training, creature status model and production visuals.
- Documentation drift: the older coordination master still says VS2 requires an Owner GO, while the current README and
  runtime show VS2 was built under the 2026-08-28 GO. Reconcile before authorizing VS3.

## Recommended completion order

1. `R0 — Governance reconciliation`: make README, master sync, blocker ledger and roadmap agree on the VS2 baseline.
2. `R1 — Data contracts`: ingest static catalogs without shipping ROM payloads; freeze IDs and evidence levels.
3. `R2 — Raising closure`: care, cage effects, calendar, evolution and durable creature state.
4. `R3 — Hunt closure`: capture recognizer, equipment state machine, result/capacity and spawn rules.
5. `R4 — Economy/database`: Shop transactions, collection/Digipedia and unlock/progression graph.
6. `R5 — Battle`: setup/strategy, hit/TP traces, auto-battle resolver, six modes and result/endurance writes.
7. `R6 — Content/production`: tutorial, localization, audio/VFX mapping, legal replacement assets and accessibility.
8. `R7 — Release`: deterministic simulation, save migrations, browser/device matrix, performance, security and packaging.

Do not begin a later runtime slice merely because its static catalog is available. Each slice still requires its product
gate and a bounded evidence contract.
