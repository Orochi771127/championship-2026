# Championship 2026 — Current Product Status

Status date: 2026-08-30

Evidence baseline: VS3 enclosure plus memory-card capacity gate; runtime tests see `npm test`

Product authority: standalone `championship-2026` repository

## Executive status

The project is not an empty plan. Claude Code and Codex have already produced a reusable browser-game foundation plus three playable vertical slices:

- VS1 Raising Home is integrated and accepted as the baseline;
- VS2 Gate Select → Hunt Loadout → Hunt exploration → Return Home is integrated;
- VS2-R1 adds a bounded Three.js Gate presentation over the same Gate state, with a 2D fallback;
- VS2-R2 reconstructs the Hunt Loadout runtime contract and read-only presentation seam;
- VS3 adds Hunt enclosure (original stroke grammar + Hunt Result) without a Capture button;
- VS3 also applies the original memory-card capacity *compare* (sum vs max 32/64/96) after enclose; per-species G-cost stays product unit 1;
- VS4 Shop: 118-row catalog, Bits wallet, visibility, purchases, and a Home → Shop screen;
- VS4 Database: 224 encyclopedia slots (8 eggs + 216 regular), Home → DATA, starter-only registration at New Game;
- VS4 Cage Edit: 36 original cage identities on a 14–20 hex ranch (one cage per slot); Home → CAGE;
- presentation packs exist so Option A HD and later skins can bind without forking simulation;
- deterministic runtime/policy tests: see `npm test`;
- real-browser QA evidence exists for VS1, VS2 and VS2-R1; VS3 enclosure has a dedicated browser gate.

The next gameplay work is remaining original *system* translation (Cage editor structure, Battle resolver for known formulas), not a visual lock. Rope VFX and HD map runtime promotion stay on the art pack line.

## Integrated playable flow

```text
Boot / New Game / Continue
  -> Raising Home
     -> select and directly manipulate residents
     -> care reaction (no unverified original stat mutation)
     -> relocate between temporary Cage regions
     -> save / reload / restore
  -> Shop
     -> Bits wallet, original purchase rules, mapped Hunt SKUs
  -> Database
     -> 224 encyclopedia slots; REGISTERED vs UNDISCOVERED only
     -> opening partner registers one species; Hunt instances join that species
  -> Cage Edit
     -> 36 original cage identities (35 shop + Waiting Room)
     -> hex ranch, one cage per slot, 14 slots at rank 0 (unlocks 16/18/20 with rank)
     -> CONFIRM keeps the layout; Home SAVE writes it
  -> Gate Select
     -> 2D accessible fallback or bounded Three.js world
  -> Hunt Loadout
     -> five equipment classes and four plugin positions
  -> Hunt Field
     -> deterministic 128×128 modular world
     -> camera, collision and bounded wild wandering
     -> touch a wild and draw a circle (original stroke grammar)
     -> empty ground still moves the tamer
  -> Hunt Result
     -> BROUGHT HOME; collection instance written
     -> return to Raising Home
```

## Runtime boundaries already established

| Boundary | Integrated state |
|---|---|
| Application authority | one `championshipStandaloneApp` |
| Navigation | one Championship screen stack / mode authority |
| Save | one product save key and persistent writer |
| 2D renderer | one shared PixiJS Application/ticker |
| 3D renderer | bounded to Gate Select presentation |
| UI | DOM owns menus, panels, toolbar and text |
| Research firewall | runtime imports no Nexus or research path |
| Assets | runtime declarations resolve below `assets/production/` |
| Mobile format | portrait 9:16, touch-first with mouse/keyboard/gamepad compatibility |

## Current maturity by slice

| Slice | Status | What is actually usable | Major remaining work |
|---|---|---|---|
| Boot / Continue | `INTEGRATED_REUSABLE` | New Game, Continue detection, save recovery | final original title/branding/UI |
| Raising Home | `INTEGRATED_BOUNDED` | direct select/care reaction/relocate/save/restore, DOM + Pixi seam | exact care effects, final habitat, full Cage system |
| Gate Select | `INTEGRATED_BOUNDED` | shared selection state, 2D fallback, Three.js presentation | exact original camera/input/node behavior remains partial |
| Hunt Loadout | `INTEGRATED_BOUNDED` | five gear classes, four plugin positions, inventory validation, derived HUD capabilities, owned max G readout | equipment effects remain untraced |
| Hunt Field | `INTEGRATED_BOUNDED` | 128×128 world, camera, collision, deterministic exploration, enclosure gesture, memory-card capacity gate | original spawn/AI, per-species G-cost table, rope VFX conversion |
| Hunt Result | `INTEGRATED_BOUNDED` | enclosure writes a collection instance and returns Home | original success odds on other paths, Home presentation polish |
| Modular Cage | `INTEGRATED_BOUNDED` | 36 definitions, Shop ownership, 14–20 hex slots, Home → CAGE, confirm/revert/save | training numbers, rank writes, exact hex pixel layout, OVL15 tap grammar |
| Shop | `INTEGRATED_BOUNDED` | 118-row catalog, Bits wallet (start 0, cap 9,999,999), visibility 0/1/2, atomic buy, Cage ownership, mapped Hunt grants, Home → Shop DOM | ROM display names, care-item consumption, battle income, type-3 unlock |
| Database | `INTEGRATED_BOUNDED` | 224-slot book, Home → DATA, starter + collection projection, instance rename | original names/art, unlock/filter writers (untraced), 216 remaining live species |
| Battle | `PLANNED` | research contracts and field references only | deterministic product resolver, UI, result writes |
| Progression / Championship | `PLANNED` | roadmap and data references | complete product progression and long-save integration |
| Public original content | `PLANNED` | replaceable-content strategy and temporary original assets | final IP, roster, environments, UI, VFX, audio and localization |

## Current Owner decisions

- One human Owner + AI builds the complete functional game first.
- Runtime IDs and presentation records remain IP-neutral and replaceable; visual packs can swap over the same simulation.
- Default public skin is licensed faithful remake (Option A). Alternate anatomy packs are later skins, not a second game.
- Final public content must use original-created or properly licensed names, characters, art, text and audio.
- The Cage/Training system must preserve shape-aware spatial assembly and terrain-based stat effects; it cannot become a decorative background selector.
- Exact unverified parity values stay neutral or explicitly product-authored until traced.

## Verification baseline

- `npm test`: 182 pass / 0 fail.
- Browser commands:
  - `npm run test:browser`
  - `npm run test:browser:vs2`
  - `npm run test:browser:vs2-r1`
  - `npm run test:browser:vs3`
- Required portrait viewports include 360×800, 390×844, 393×852, 412×915 and 430×932; 375×812 is supplementary.

## Historical-document warning

Several files under `docs/coordination/` were valid synchronization snapshots before VS2, VS2-R1 and VS2-R2 landed. Statements such as “VS2 not started”, “not pushed”, or “Owner GO required” describe those earlier checkpoints and are not current execution status. Preserve them for provenance, but use this file plus current source/tests for the integrated state.
