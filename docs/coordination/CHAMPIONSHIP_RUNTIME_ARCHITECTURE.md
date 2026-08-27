# CHAMPIONSHIP_RUNTIME_ARCHITECTURE

Canonical product repository: `.` (`CHAMPIONSHIP_2026_PRODUCT_SSOT`).  
Migration reconciliation: the prior shared-repository wording below is retained only where it explains historical constraints. The current executable architecture is the standalone boundary defined in `docs/architecture/CHAMPIONSHIP_2026_ARCHITECTURE.md`.

Owner: Claude Code · Last updated: 2026-08-28 · Kind: VS2-PREP hardening + CL-012 owned-documentation reconciliation

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
PLAY_CHAMPIONSHIP.bat        repo-local launcher    IMPLEMENTED
    |  npm run serve -> scripts/serve.mjs; loopback by default, LAN opt-in
    |
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

The build renders **one screen**, mounted directly by `main.js`. There is no
screen stack in this repository: the pre-migration `createChampionshipScreenStack.js`
was never migrated, and earlier revisions of this document describing it as
present-but-unmounted were external-provenance drift (CL-012).

VS2 is the first slice that needs more than one screen. It must therefore
introduce the screen stack **and** a shared Pixi stage host, because a second
`new PIXI.Application()` would break the single-bootstrap invariant.

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
                 -> guardChampionshipStorage()             forbidden-key policy
                 -> localStorage["championshipModernSave:v1"]
```

Single authority. `ChampionshipSavePortR2` stays zero-write; the persistent port
declares `persistentWrite: true` precisely so the R2 assertion still rejects it.
Restore seeds a fresh memory-only R2 port and reuses the existing restore path.

Every key crossing that boundary is checked against
`app/championshipStorageGuard.js`, a pure policy leaf that imports nothing and
touches no Storage. It is the one file allowed to name the historical save
namespace of the application Championship used to be a feature of, because a
deny-list cannot block a name it may not write down. Historical data already
present in a browser profile is neither read, written, nor deleted: out of scope
means untouched.

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

The pre-migration `docs/qa/**` gate tree was not migrated. The gates that govern
**this** repository are:

| Gate | Governs |
|---|---|
| `tests/championship-migration-firewall-cases.mjs` | external repository / CDN / research imports; the single-namer allowance for the storage guard; VS1 source-family bounds; asset firewall; one save key, one durable writer, one Pixi bootstrap, no second ticker |
| `tests/championship-frozen-runtime-invariants-cases.mjs` | zero-write R2 ports; one durable authority across a real interaction; the 128×128 Hunt bound; the bounded HM collision rule; camera-window-over-world |
| `tests/championship-storage-guard-cases.mjs` | the forbidden storage key policy at the durable boundary |
| `tests/championship-vs1-runtime-cases.mjs` | the VS1 loop: new game, select, care, relocate, save, fresh continue, restore |
| `tests/championship-int-rh2-*-cases.mjs` | the presentation seam and the P1R contract |
| `tests/championship-int-rh2-browser.cjs` | real Chromium reload / continue / restore across the contract viewports |

Baseline at this reconciliation: **35 pass / 0 expected / 0 unexpected**, plus the
browser gate at `viewports=6 required=5 saveReload=true`. The historical
481 / 3 / 0 figure belongs to the pre-migration research tree and its `docs/qa`
suite, neither of which exists here (CL-012).

Positive controls re-verified at VS2-PREP: emptied deny-list **CAUGHT**, dropped
write guard **CAUGHT**, namespace leaked into another `src` file **CAUGHT**, Hunt
field shrunk below 128×128 **CAUGHT**, unknown collision bits made passable
**CAUGHT**.
