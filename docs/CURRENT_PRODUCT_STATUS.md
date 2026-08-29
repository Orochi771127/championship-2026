# Championship 2026 — Current Product Status

Status date: 2026-08-30

Evidence baseline: VS3 enclosure slice on the existing VS2 expedition; runtime tests 145/145

Product authority: standalone `championship-2026` repository

## Executive status

The project is not an empty plan. Claude Code and Codex have already produced a reusable browser-game foundation plus three playable vertical slices:

- VS1 Raising Home is integrated and accepted as the baseline;
- VS2 Gate Select → Hunt Loadout → Hunt exploration → Return Home is integrated;
- VS2-R1 adds a bounded Three.js Gate presentation over the same Gate state, with a 2D fallback;
- VS2-R2 reconstructs the Hunt Loadout runtime contract and read-only presentation seam;
- VS3 adds Hunt enclosure (tether-distance class + original stroke grammar + Hunt Result) without a Capture button;
- deterministic runtime/policy tests pass 145/145;
- real-browser QA evidence exists for VS1, VS2 and VS2-R1; VS3 enclosure has a dedicated browser gate.

The next gameplay work is VS3 remainder (G-capacity consumption once traced, rope VFX conversion, Home display of enclosed instances) then Shop, Database, Cage editor, Battle, and Championship progression.

## Integrated playable flow

```text
Boot / New Game / Continue
  -> Raising Home
     -> select and directly manipulate residents
     -> care reaction (no unverified original stat mutation)
     -> relocate between temporary Cage regions
     -> save / reload / restore
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
| Hunt Loadout | `INTEGRATED_BOUNDED` | five gear classes, four plugin positions, inventory validation, derived HUD capabilities | equipment effects and Capture capacity consumption in VS3 |
| Hunt Field | `INTEGRATED_BOUNDED` | 128×128 world, camera, collision, deterministic exploration, enclosure gesture, return lifecycle | original spawn/AI closure, G-capacity consumption, rope VFX conversion |
| Hunt Result | `INTEGRATED_BOUNDED` | enclosure writes a collection instance and returns Home | original success odds, Home presentation of new arrivals |
| Modular Cage | `PLANNED` | specification and data/backlog design | original footprints/effects trace and complete VS4 implementation |
| Shop / Database | `PLANNED` | source catalogs and planning only | product transaction/collection runtime and UI |
| Battle | `PLANNED` | research contracts and field references only | deterministic product resolver, UI, result writes |
| Progression / Championship | `PLANNED` | roadmap and data references | complete product progression and long-save integration |
| Public original content | `PLANNED` | replaceable-content strategy and temporary original assets | final IP, roster, environments, UI, VFX, audio and localization |

## Current Owner decisions

- One human Owner + AI builds the complete functional game first.
- Runtime IDs and presentation records remain IP-neutral and replaceable.
- Final public content must use original-created or properly licensed names, characters, art, text and audio.
- The Cage/Training system must preserve shape-aware spatial assembly and terrain-based stat effects; it cannot become a decorative background selector.
- Exact unverified parity values stay neutral or explicitly product-authored until traced.

## Verification baseline

- `npm test`: 145 pass / 0 fail.
- Browser commands:
  - `npm run test:browser`
  - `npm run test:browser:vs2`
  - `npm run test:browser:vs2-r1`
  - `npm run test:browser:vs3`
- Required portrait viewports include 360×800, 390×844, 393×852, 412×915 and 430×932; 375×812 is supplementary.

## Historical-document warning

Several files under `docs/coordination/` were valid synchronization snapshots before VS2, VS2-R1 and VS2-R2 landed. Statements such as “VS2 not started”, “not pushed”, or “Owner GO required” describe those earlier checkpoints and are not current execution status. Preserve them for provenance, but use this file plus current source/tests for the integrated state.
