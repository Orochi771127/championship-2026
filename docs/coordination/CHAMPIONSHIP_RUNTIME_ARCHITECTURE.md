# CHAMPIONSHIP_RUNTIME_ARCHITECTURE

Canonical product repository: `.` (`CHAMPIONSHIP_2026_PRODUCT_SSOT`).  
Migration reconciliation: the prior shared-repository wording below is retained only where it explains historical constraints. The current executable architecture is the standalone boundary defined in `docs/architecture/CHAMPIONSHIP_2026_ARCHITECTURE.md`.

Owner: Claude Code · Last updated: 2026-08-27 · Kind: OWNER PRODUCT RESET reconciliation

Describes the architecture **as it actually is today**, not as planned. Every
layer is marked `IMPLEMENTED`, `PARTIAL`, `PLANNED`, or `FORBIDDEN`.

---

## Product

**DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD.** Standalone. Web-first,
mobile-first, portrait 9:16, touch-first, desktop-browser compatible.

This is the product. It is not a feature of another application.

## Nexus Link — superseded and frozen

Nexus Link integration is **FROZEN / OUT OF CURRENT PRODUCT SCOPE** (Owner
Product Reset, 2026-08-27).

The earlier decisions are kept, not erased, because they explain why the code
looks the way it does:

| Historical decision | Date | Current status |
|---|---|---|
| Standalone-first: Phase 1 must not touch `src/app.js`, Nexus player state, Nexus save queue or Nexus router | 2026-08-26 | **SUPERSEDED** — it was a constraint on a Nexus feature; it is now simply the product's own shape |
| `state.championship` must not be added to Nexus player state | 2026-08-26 | **FROZEN** — still enforced, now because Nexus is out of scope |
| Championship must never write the historical Nexus save namespace | 2026-08-26 | **STILL ENFORCED** by repository-boundary tests; the historical key is not present in product source |
| Nexus emotional-loop contract | — | **MUST NOT** reshape Championship gameplay |

Practical consequence: what used to be described as "path B, the standalone
exception" is now **the only path**. The Nexus bootstrap is no longer part of
this architecture; it is another application that happens to share a repository.

---

## Evidence policy — governs every gameplay decision

| Class | Rule |
|---|---|
| `ROM_VERIFIED` | **DEFAULT_PRESERVE.** Modernisation may change how it is rendered, never whether it exists. |
| `PARTIAL` | Preserve the known structure; the unknown part stays neutral. |
| `UNKNOWN_REQUIRES_TRACE` | Do not invent. Neutral, disabled, or raw id. |
| `OWNER_APPROVED_ADAPTATION` | The only class permitted to intentionally change original gameplay. |
| `NEXUS_ADAPTATION` *(historical)* | R2 prototype mechanics. Frozen for research, excluded from product gameplay. Not a licence to change originals. |

**Modernisation is not redesign.** Renderer, resolution, layout, controls,
loading, save infrastructure, animation technology, asset resolution, VFX,
accessibility, mobile UX, performance and packaging may all be modernised. The
original systems themselves may not be deleted or redesigned to suit a simpler UI.

---

## Entry and shell

```
championship.html                                   IMPLEMENTED
    |
src/championship/app/main.js                        IMPLEMENTED
    |  static JSON import of the product catalog - no network authority
    |
createChampionshipStandaloneApp()                   IMPLEMENTED
    |
createRaisingPresentationSource(app)                IMPLEMENTED   <- the only presentation seam
    |
    +-- raisingHomeP1RView.js        DOM / P1R      IMPLEMENTED   (Codex authority)
    +-- createRaisingFieldPixiPresentation.js       IMPLEMENTED   (Claude authority)
```

`createChampionshipScreenStack.js` exists but is **not mounted**: `PARTIAL`.
The build renders one screen. VS2 is the first slice that needs more.

---

## Renderer architecture

| Renderer | Role | State |
|---|---|---|
| **DOM** | UI, menus, panels, toolbar, text | IMPLEMENTED — P1R system, Codex authority |
| **PixiJS** | 2D gameplay: creatures, fields, sprites, VFX | IMPLEMENTED for the Raising field — one Application, one Application-owned ticker, Claude authority |
| **Three.js** | verified or Owner-approved bounded 3D scenes | PLANNED — not used today |

`FORBIDDEN`: a second global router, store, save authority, Pixi bootstrap or
ticker. A React rewrite is not authorized.

Verified at the INT-RH2 checkpoint: **1** Pixi Application, **1** save
authority, **0** routers inside `src/championship/`.

---

## Domain and state

| Module | Role | State |
|---|---|---|
| `app/championshipStandaloneApp.js` | product session, lifecycle, intents | IMPLEMENTED |
| `app/championshipRaisingProduction.js` | production Raising state: cage assignment, interaction flags | IMPLEMENTED |
| `app/raisingPresentationSource.js` | read-only frame + four intents | IMPLEMENTED |
| `core/*` | reducer, selectors, state machine, invariants, seeded RNG, transaction | IMPLEMENTED |
| `raising/*`, `kernel/*`, `r2/*`, `presentation/r2/*` | R2 research domain | **FROZEN** — consumed, never modified |

## Save authority

```
runtime snapshot -> projectRaisingHomeDurableStateR2()   frozen R2 contract
                 -> serializeRaisingHomeSaveR2()          canonical string + digest
                 -> championshipStandaloneSave envelope   8 keys, deny-by-default
                 -> ChampionshipPersistentSavePort
                 -> localStorage["championshipModernSave:v1"]
```

Single authority. `ChampionshipSavePortR2` stays zero-write; the persistent port
declares `persistentWrite: true` precisely so the R2 assertion still rejects it.
Restore seeds a fresh memory-only R2 port and reuses the existing restore path.

---

## Target product flow versus what exists

| Screen | Runtime today |
|---|---|
| TITLE / LOGIN | PARTIAL — New Game / Continue only |
| RAISING HOME | **IMPLEMENTED** — VS1 baseline |
| TRAINING / CARE / CAGE | PARTIAL — care is a reaction with no verified effect; 2 product cages against 36 original CageDefinitions |
| GATE SELECT | NOT_STARTED |
| HUNT LOADOUT | NOT_STARTED |
| HUNT FIELD | NOT_STARTED |
| CAPTURE | NOT_STARTED |
| HUNT RESULT | NOT_STARTED |
| SHOP / DATABASE | NOT_STARTED |
| BATTLE MENU | NOT_STARTED |
| AUTO BATTLE | NOT_STARTED — original is largely automatic with pre-battle orders; must not become a manual command RPG |
| BATTLE RESULT | NOT_STARTED |
| PROGRESSION | NOT_STARTED |
| SAVE / LOAD | **IMPLEMENTED** for the Raising slice |

### Preservation debts already on record

These are `DEFAULT_PRESERVE` obligations the current build does not yet meet.
They are debts, not decisions:

1. **Cages.** ROM proves 36 CageDefinitions, 35 shop cages, one non-shop waiting
   cage, and a 16-node cage strip. The build ships **two** product-authored
   regions as a temporary prototype.
2. **Toolbar.** ROM proves eight slots. The build ships all eight as neutral
   disabled `RAW_SLOT` placeholders, which is correct under the evidence policy,
   but the row is not functional until the bindings are traced.
3. **Care.** ROM proves four care items with their own descriptions and the
   select-tool-then-touch grammar. The build performs a reaction only.
4. **Status model.** ROM proves HP / Capacity / Attack / Defense / Intelligence /
   Speed / Family / Generation / Attribute / Personality. No values exist yet, so
   none are shown.
5. **Cage level-up.** ROM proves cages level up, capped by Tamer rank. Not built.

---

## Governance gates

| Gate | Governs |
|---|---|
| `championship-production-boundary-cases.mjs` | production tree, frozen R2 non-modification, no Nexus import path, no forensic adoption, persistence-port honesty. Also scans `presentation/intRh2/`. |
| `championship-taxonomy-boundary-cases.mjs` | CLOSED taxonomy tree; defers production paths to the successor |
| `championship-r1-boundary-cases.mjs` | no ROM payload or binary asset path inside `src/championship/**` |
| `championship-int-rh2-*-cases.mjs` | the presentation seam and the P1R contract |

Baseline at this reconciliation: **481 pass / 3 expected / 0 unexpected**.
