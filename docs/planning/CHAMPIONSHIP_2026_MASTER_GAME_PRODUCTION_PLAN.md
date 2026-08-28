# DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD

## Master Game Production Plan

Date: 2026-08-29  
Product state: planning baseline; no runtime slice is authorized by this document alone  
Primary target: phone portrait, 9:16, touch-first  
Secondary target: desktop browser using the same runtime and save model  

## 1. Executive decision

Build one web-first game codebase and ship it in three envelopes:

1. responsive browser game;
2. installable PWA;
3. optional Capacitor mobile package after the web build passes device QA.

Do not create a second mobile implementation. Do not rewrite the existing product in React, Phaser, Unity, or a second engine. Extend the accepted repository architecture:

| Layer | Product authority |
|---|---|
| DOM + CSS | screen stack, menus, panels, text, forms, settings, accessibility |
| One PixiJS v8 Application | playable 2D fields, creatures, sprites, 2D VFX |
| Bounded Three.js | Gate Select globe and other verified or separately approved 3D scenes only |
| Renderer-neutral simulation | care, training, evolution, Hunt, Capture, Battle, progression |
| One save repository | versioned durable product state; renderer objects never enter the save |

The current VS1 and VS2 work is the foundation. It already proves the browser shell, 9:16 viewports, one save authority, one Pixi ticker, Raising Home, Gate Select, Hunt Loadout, Hunt exploration and return flow. Work should continue forward from those contracts.

### Skills applied to this plan

| Skill | Planning contribution |
|---|---|
| `game-studio` | one coherent gameplay, UI, asset and QA roadmap |
| `web-game-foundations` | simulation/render/save/input boundaries |
| `game-ui-frontend` + `game-ui-ux` | protected playfield, safe areas, responsive screen stack |
| `input-systems` | named actions and touch/mouse/keyboard/gamepad parity |
| `sprite-pipeline` | approved seed frame, whole-strip production and stable anchors |
| `championship-art-production` | evidence, rights, renderer and Owner gates |
| `game-feel` | tiered, transient and accessible feedback |
| `audio-design` | bus graph, variation and adaptive music |
| `performance-optimization` | profile-first frame and asset budgets |
| `pixijs-events` + `pixijs-math` | global pointer capture and canonical coordinate transforms |
| `pixijs-assets` + `pixijs-performance` | scene bundles, unload, GPU preparation, culling and pooling |

### Owner capacity and sequencing directive — 2026-08-29

This product is made by one human Owner working with AI. The roadmap therefore prioritizes a complete, testable game over early mass content production.

- First milestone: `FUNCTIONALLY_COMPLETE` — every system and mode works from New Game through Championship using IP-neutral IDs and original temporary presentation.
- Second milestone: `PUBLIC_CONTENT_COMPLETE` — final original brand, creatures, world, art, text and audio replace the temporary content after the functional game is complete.
- The runtime must be replaceable by content manifest from day one. Gameplay code must not depend on Digimon names, images or ROM file identities.
- The 224-entity structure remains a compatibility/research ceiling, not a requirement for the first public original roster.
- The final product does not use `Digimon`, `數碼寶貝`, original creature identities, art, text, music, code or ROM assets.

The detailed solo operating model and IP-neutral boundary are defined in `CHAMPIONSHIP_2026_SOLO_AI_PARITY_FIRST_PLAN_ZH_TW.md`.

## 2. Product promise

The player raises a creature through days and seasons, prepares equipment and a three-creature team, hunts and captures new creatures, develops habitats, enters automatic strategy battles, wins Titles and ultimately reaches the four-year Championship.

The remake preserves the original design DNA:

- creature care affects growth and evolution;
- time, season, location and conditions affect the world;
- Hunt is an explorable field with touch capture, not a menu-only encounter table;
- Battle is preparation plus strategy plus auto battle, not a turn-command JRPG;
- the three-creature team, Title progression and Championship cadence remain central;
- dense information is preserved through progressive disclosure instead of displaying two NDS screens at once.

Modernization may improve resolution, layout, accessibility, feedback, loading, save reliability and packaging. It must not silently invent unknown formulas or redesign verified gameplay.

## 3. Scope and non-goals

### In scope

- one 9:16 touch-first interface covering all original game modes;
- responsive mouse, keyboard and gamepad compatibility for the web build;
- offline-first single-player campaign;
- data and simulation capacity for the full catalog structure: 224 entity slots, 16 Hunt biomes, 40 Cage/Training references, 11 Battle fields, Shop, Database, Titles and Championship progression;
- a smaller neutral test roster sufficient to make every system function before final original content production;
- original-created or properly licensed high-definition art and audio;
- a new online layer only after the offline deterministic game is complete.

### Out of scope until separately approved

- an NDS emulator or literal dual-screen layout;
- direct runtime use of ROM, Nitro, decoded graphics, extracted music or direct derivatives;
- Nexus Link integration;
- a second router, store, save, Pixi Application or ticker;
- full-scene Three.js where the original evidence is 2D;
- claims of complete parity while P0 formulas remain unresolved;
- public release, monetization or store submission without IP and privacy review.

## 4. Evidence and rights firewall

Every design or data row must carry both an evidence state and a rights state.

### Evidence states

- `VERIFIED_BINARY`: directly traced in YDIJ data or executable behavior.
- `VERIFIED_CROSSCHECK`: binary evidence corroborated by another primary source.
- `HIGH_CONFIDENCE_STRUCTURE`: structure is proven but its human meaning is incomplete.
- `UNKNOWN_REQUIRES_TRACE`: do not implement a guessed parity rule.
- `OWNER_APPROVED_ADAPTATION`: an intentional 2026 product change.

### Rights states

- `ROM_COPYRIGHTED_REFERENCE`: research-only and forbidden from shipping bundles.
- `LICENSED`: allowed only within the recorded licence scope.
- `ORIGINAL_CREATED`: newly authored production material.
- `UNKNOWN`: blocked from promotion.

The old material supplies system DNA, silhouettes, composition grammar, timing references, palette roles and data relationships. A shipping asset needs licensed or original-created source, human approval and runtime QA. Nearest-neighbour scaling, AI upscaling, filtering or copying ROM pixels is not a high-definition reconstruction.

## 5. Existing data baseline

| Domain | Available baseline | Remaining production blocker |
|---|---:|---|
| ROM and filesystem | 64 MiB, 6,419 NitroFS files, 22 ARM9 overlays | none for availability; semantics remain |
| UI | 96 NXR scenes, 1,369 nodes | runtime-state composition, modern screen mapping |
| Creatures | 224 entities: 216 regular + 8 eggs | HD production art, animation semantics and licence |
| Raising | 40 Cage/Training references | care values, capacity, effects, evolution resolver |
| Hunt | 16 biomes, 49 Hunt items, 30 plugins | spawn logic, wild AI, capture/result writes |
| Battle | 596 actions, 152 teams, 456 presets, 62 Titles, 11 fields | hit/miss, TP, start ties and complete result writes |
| Shop | 118 records | transaction runtime and complete unlock graph |
| Text | 3,197 records | control tags, event callers, localization rewrite |
| Audio | 151 SDAT payloads | caller mapping plus licensed/original replacement |

The data is sufficient to plan the complete product and implement many static catalogs. It is not sufficient to claim complete gameplay parity without targeted tracing.

### Non-negotiable modular Cage / Training system

The Owner confirms that the original Cage system is a spatial construction and training mechanic: players assemble functional terrain pieces with specific shapes, and different terrain functions improve different raising values. The rebuild must therefore preserve a shape-aware modular board, placement validation, Cage ownership, resident assignment, environmental stat effects and durable configuration. It must never reduce Cage Edit to selecting a decorative background.

Exact original shape masks, rotation/mirroring permissions, adjacency rules, numeric gains, tick cadence, stacking and caps remain evidence-gated. The functional sandbox may use clearly labelled `PRODUCT_AUTHORED_NEUTRAL_TUNING`; the parity path must replace those values with traced data rather than guessing. See `CHAMPIONSHIP_2026_MODULAR_CAGE_SYSTEM_SPEC_ZH_TW.md`.

## 6. Core game loop

```text
Egg / starter
  -> Raising Home: care, time, condition and training
  -> evolution and team development
  -> Gate Select and Hunt Loadout
  -> Hunt exploration and touch capture
  -> Hunt Result, collection and resource changes
  -> Shop, Database and habitat improvement
  -> team setup and strategy
  -> automatic Battle timeline
  -> Result, Title, rank and unlock progression
  -> four-year Championship
  -> continued collection and mastery
```

Session design:

- 30–90 seconds: check status, feed, clean, review a result;
- 3–8 minutes: training or a Hunt expedition;
- 5–12 minutes: team preparation plus a Battle event;
- 20–40 minutes: a Championship session or focused progression run.

These are 2026 pacing targets. Any change to the original calendar rate or reward rate must be labeled `OWNER_APPROVED_ADAPTATION`.

## 7. Runtime architecture

### 7.1 Module boundaries

```text
Input adapters
  -> named player actions / commands
    -> simulation services
      -> transaction + domain events
        -> one versioned save repository
        -> presentation snapshots
          -> DOM / Pixi / bounded Three
```

Simulation modules:

- `raising`: calendar, care, condition, shape-aware Cage board, modular terrain placement, environmental Training effects and evolution;
- `hunt`: loadout, inventory, field, spawn, wild AI, capture, result;
- `shop`: availability, purchases and ownership transactions;
- `database`: collection, seen/captured state and discovery display;
- `battle`: setup, strategy, deterministic timeline, result;
- `progression`: Titles, rank, gates, rewards and Championship calendar;
- `save`: schema migration, validation, recovery and settings.

Presentation subscribes to immutable snapshots or domain events. Pixi sprites and DOM buttons never own HP, inventory, capture result or progression truth.

### 7.2 Technology policy

- Keep ESM and the current buildless Node/browser workflow until a measured need justifies tooling changes.
- Use manifest keys, never asset filenames, as runtime APIs.
- Use Pointer Events for touch, mouse and pen.
- Use Web Audio through a small bus graph.
- Use WebGL2 as the production graphics baseline; provide a simplified Gate list fallback when bounded 3D is unavailable.
- Add a service worker only after asset versioning and save migration tests exist.
- Add PWA installability before considering Capacitor packaging.

Pixi asset bundles should follow play flow rather than one global preload:

- `boot-ui`: shell, fonts and minimum UI;
- `raising-home`: active residents and current environment;
- `gate-select`: lazy-loaded bounded Three scene plus 2D fallback;
- `hunt-{biomeId}`: one biome, resident/wild creature subsets and capture VFX;
- `battle-{fieldId}`: arena, current teams and Battle VFX;
- `results-common`: result plates, reward and progression effects.

Background-load only the next probable bundle. Upload large scene resources to the GPU before reveal when measurements show first-frame hitches. Unload completed scene bundles and stagger large cleanup across frames; the Assets cache must not retain every character and field for the whole session.

### 7.3 Save strategy

- Preserve exactly one product save repository and key authority.
- Add a numeric `schemaVersion`, migrations and checksum/validation.
- Keep player progress separate from presentation state and cache state.
- Autosave at evidence-backed boundaries; keep explicit save/continue behavior where required.
- Write transactions atomically: currency, inventory, ownership and progression either all commit or all roll back.
- Keep a last-known-good recovery snapshot inside the same save authority, not a second independent save system.

Cloud save and account login are later services. They synchronize the same canonical schema and do not become a second local truth.

## 8. 9:16 single-screen system

Reference viewport: `390 × 844 CSS px`. Required contract viewports remain `360×800`, `390×844`, `393×852`, `412×915` and `430×932`.

### Mobile

- game root uses `100dvh`, not a document-height page;
- playable screens do not vertically scroll;
- critical UI is inset by `env(safe-area-inset-*)`;
- scroll is limited to intentional panels such as Database details, Shop lists and Help;
- every primary touch target is at least 44 CSS px, with approximately 9 mm preferred for repeated actions;
- center and lower-middle playfield remain clear during movement, capture and Battle.

### Desktop browser

- preserve the same 9:16 gameplay composition inside a centered portrait shell;
- cap the main game column near 540 CSS px unless a screen explicitly supports controlled expansion;
- mouse, keyboard and gamepad map to the same named actions as touch;
- optional side space may hold decorative art or non-critical help, never exclusive gameplay information.

### Semantic zones

```text
safe-area-top
compact status zone
main playfield zone
context / transient action zone
bottom navigation or primary CTA zone
safe-area-bottom
```

The 128×128 Hunt map remains a large logical world. The phone displays a camera window over it; it must never compress the entire map into the 9:16 screen.

Detailed screen contracts are in `CHAMPIONSHIP_2026_9X16_SCREEN_BLUEPRINT.md`.

## 9. Input architecture

Gameplay reads named actions, not raw keys or pointer buttons.

Core action map:

- `navigate`, `confirm`, `cancel`, `back`, `pause`;
- `select-creature`, `open-context`, `care-action`;
- `move-field`, `interact`, `return-home`;
- `capture-start`, `capture-draw`, `capture-release`;
- `tab-next`, `tab-previous`, `list-scroll`;
- `battle-speed`, `battle-detail`, `skip-reveal`.

Touch, mouse, keyboard and gamepad bindings feed the same action layer. Track the last-used device and change prompts automatically.

Capture coordinates must be transformed from browser pixels into canonical field coordinates before simulation. Preserve the existing golden capture fixture boundaries unless later trace supersedes them: ignore very short segments, interpolate long gaps, cap stored points, require enough points to close, enforce minimum span and closure tolerance, and test tether distance deterministically.

In PixiJS v8, capture/drag listens to `globalpointermove`, not ordinary `pointermove`, after `pointerdown`; ordinary move events stop when the pointer leaves the target. The handler must also close or cancel on `pointerup`, `pointerupoutside` and `pointercancel`. Non-interactive field subtrees use `eventMode = 'none'`; capture surfaces use an explicit simple `hitArea`. Convert `event.global` through the capture/world container's `toLocal()` transform and reuse point buffers in the hot path.

Accessibility controls:

- hold versus toggle where meaningful;
- no required multi-touch chord for essential play;
- adjustable gesture tolerance and optional hold-instead-of-mash;
- text scale, contrast, reduced motion, reduced flashing and screen-shake strength;
- full keyboard/gamepad focus, explicit focus neighbours and resettable bindings.

## 10. Screen inventory

Required modern screens:

1. Boot / Title / Continue
2. Raising Home
3. Creature Detail
4. Habitat / Cage Edit
5. Training
6. Database
7. Shop
8. Gate Select
9. Hunt Loadout
10. Hunt Field
11. Capture overlay
12. Hunt Result
13. Battle mode / match select
14. Team and strategy setup
15. Auto Battle
16. Battle Result
17. Championship progression
18. Settings / Accessibility / Help

Each screen must define purpose, primary CTA, visible information, progressive information, entry/exit, loading, empty, error and interrupted states. Screen transitions use the existing stack; only the top screen owns input.

## 11. Art direction and HD reconstruction

Visual direction: a modern high-definition interpretation of the original structure, with deep navy technology surfaces, gold framing, cyan information accents, strong creature silhouettes, readable status gauges and modular natural fields. It must look like a game, not a generic dashboard.

Renderer assignment follows evidence:

- verified 2D UI, maps, characters and effects become layered modern 2D;
- verified 3D Gate globe and approved 3D effects may use bounded Three.js;
- a 3D effect never turns the surrounding 2D scene into a 3D scene;
- missing evidence remains blocked or uses an explicitly approved modern adaptation.

Character production uses approved seed frames and whole-strip generation/redraw. All frames in one animation share silhouette, palette, scale and bottom-center ground anchor. Frame-by-frame independent generation is rejected because it causes identity drift.

The full asset pipeline is in `CHAMPIONSHIP_2026_HD_ASSET_PRODUCTION_PLAN.md`.

## 12. UI art and motion

Use the accepted P1R visual system as the starting production authority:

- CSS variables for palette, spacing, border, gauge, shadow, motion and safe area;
- component families for panel, tech frame, status gauge, equipment slot, creature card, result reveal and modal;
- tabs, bottom sheets and drawers for dense original information;
- event-driven HUD updates instead of per-frame DOM polling;
- strong motion only for state changes, danger, capture, evolution, reward and major Battle events.

Motion tiers:

- small: tap acknowledgement, focus, currency tick;
- medium: item use, successful care, capture contact, normal hit;
- large: evolution, completed capture, critical event, Title win, Championship result.

Shake affects camera/presentation only. It never changes simulated entity positions. All strong feedback returns to rest and respects reduced-motion and reduced-flashing settings.

## 13. Audio plan

Audio graph:

```text
Master
  |- Music
  |- SFX
  |- Ambience
  |- UI
  |- Voice / creature vocals
```

Requirements:

- volume controls operate perceptually and persist through the one settings/save authority;
- leave master headroom and test headphones plus phone speakers;
- repeated footsteps, hits and UI actions use small sample/pitch variation;
- Raising, Hunt and Battle music may use aligned stems and intensity layers;
- transitions occur at beat or bar boundaries when practical;
- important capture, evolution and result stingers duck music briefly;
- extracted SDAT files are mapping references only unless separately licensed.

## 14. Performance and delivery budgets

These are planning targets and must be replaced by measured release-build results.

| Area | High/modern target | Low/fallback target |
|---|---:|---:|
| Frame rate | stable 60 FPS / 16.67 ms | stable 30 FPS / 33.3 ms |
| Steady mobile memory | under 250 MB | under 180 MB |
| Peak mobile memory | under 350 MB | under 250 MB |
| Pixi/mixed draw calls | under 200 measured | under 120 measured |
| Mobile atlas page | max 2048×2048 | max 1024–2048 |
| Boot transfer | ≤ 3 MB compressed | ≤ 2 MB compressed |
| First playable package | ≤ 10 MB compressed | ≤ 6 MB compressed |
| Deferred scene pack | normally ≤ 15 MB | normally ≤ 8 MB |

Quality tiers:

- High: native device scale within a capped DPR, full bounded Gate 3D, richer VFX;
- Medium: reduced render scale, shadows and particles;
- Low: 30 FPS cap, lighter atlases/VFX and Gate list/2D fallback;
- accessibility overrides can independently reduce flashing, shake and camera motion.

Profile a release build on real mid-range Android and iPhone-class hardware. Measure CPU versus GPU before optimizing. Pool particles, damage numbers and audio one-shots; atlas sprites; avoid per-frame object creation; lazy-load scene packs; run a 20-minute thermal soak.

For the 128×128 Hunt world, enable measured viewport culling or spatial chunk activation rather than visiting every object each frame. Group compatible sprite/object types and blend modes to preserve Pixi batching. Use `interactiveChildren = false` and simple hit areas for non-interactive layers. Do not enable high DPR or antialiasing globally without device profiling; resolution 2 renders roughly four times as many pixels as resolution 1.

## 15. Online strategy

The original online service cannot be restored. Treat modern online as a new product:

1. ship deterministic offline single-player first;
2. record simulation seeds and compact Battle replays;
3. add private-room team exchange or asynchronous ghost battles as the lowest-risk online mode;
4. add live matchmaking only after authentication, moderation, anti-cheat, privacy, server cost and regional legal requirements are approved.

Do not let networking become Battle truth. The server validates inputs and outcomes against the same versioned deterministic rules.

## 16. Development roadmap

### R0 — Authority and planning closure, 1–2 weeks

- reconcile README, master sync, blocker ledger and VS2 state;
- approve this master plan, screen blueprint and art pipeline;
- freeze evidence vocabulary, data IDs, rights fields and asset manifest schema;
- adopt an IP-neutral runtime and research/production firewall; defer final original brand and release roster decisions until functional completion.

Gate: all authorities agree; no ROM payload enters runtime; VS3 work packet is explicitly approved.

### R1 — Core framework hardening, 2–4 weeks

- finalize action mapping, screen stack, safe area, quality tier and perf overlay;
- version save schema and migration tests;
- define deterministic clock, RNG injection, replay/debug fixtures;
- ingest static catalogs through evidence-safe generated data.

Gate: all contract viewports, devices and save migration fixtures pass.

### R2 — Raising and evolution closure, 6–10 weeks

- trace and implement care, condition, consumption and treatment;
- publish the versioned Cage board, module `shapeMask`, placement and Training-effect contracts;
- trace original Cage footprints, orientation rules, capacity, effect channels, numeric gains, cadence, stacking and caps;
- implement calendar, life history, evolution resolver and egg reversion;
- complete Creature Detail and Training screens.

Gate: deterministic multi-day fixtures reproduce verified changes; unknowns remain neutral.

### R3 — Hunt capture vertical slice, 6–10 weeks

- complete spawn selection, wild AI, equipment branches and capacity;
- implement Pointer Event capture stroke/tether state machine;
- build Capture overlay and Hunt Result transaction;
- produce one original-neutral placeholder kit that proves creature/biome/UI/VFX replacement without copying source expression.

Gate: capture golden fixtures, return/save/reload, low-tier performance and touch QA pass.

### R4 — Shop, Database and habitat, 5–8 weeks

- implement 118-record Shop transactions and visibility;
- separate inventory, Cage ownership, collection and seen state;
- complete Database tabs, discovery rules and the 9:16 shape-aware Cage Edit flow;
- validate modular placement, effect preview, atomic confirm/cancel and exact save/reload restoration;
- integrate progression unlock writes that are already proven.

Gate: atomic Shop/ownership tests plus Cage shape, effect, rollback, save and responsive touch QA pass.

### R5 — Battle and result, 8–14 weeks

- implement verified damage, element, field, status, heal, buff, AI and cadence rules;
- trace hit/miss, TP, start seeding/ties and complete result writes before parity sign-off;
- implement team setup, strategy, auto Battle timeline and result reveal;
- validate six Battle modes against evidence, with unavailable online modes clearly adapted.

Gate: Battle golden tests and deterministic replay pass; no renderer writes HP directly.

### R6 — Full progression and Championship, 5–8 weeks

- complete Titles, rank, gates, rewards, calendar and Championship endurance;
- finish tutorials, mail/events, ending and continued-play states;
- run long-form save migration and rollback tests.

Gate: new game to Championship can complete without debug commands.

### R7A — Functional content scaffolding, parallel through R1–R6

- neutral IDs and manifests for the full data capacity;
- 16–24 original-neutral test species covering all mechanical archetypes;
- all 16 Hunt, 40 Cage/Training and 11 Battle slots load and function using modular original temporary kits;
- temporary original UI, VFX and audio sufficient for complete play and QA;
- no source names, source media or research imports in runtime.

Gate: New Game can reach Championship; every content family can be replaced through manifests without gameplay-code changes.

### R7B — Final original IP and HD content, after functional completion

- choose the final product title, world, naming system and launch roster;
- run a trademark clearance search and public-release IP review;
- produce 4–8 final original character representatives and approve the visual pipeline;
- expand final creatures, biomes, Cage/Training treatments, Battle fields, UI, VFX, text and audio in publishable content packs;
- choose 24, 48, 96, 224 or another long-term roster size only after measured production cost is known.

Gate: the selected public-release scope is original-created/licensed, human-approved, visually QA-passed and contains no research payload.

### R8 — Alpha, beta and release, 8–12 weeks

- content completeness, balance and usability playtests;
- PWA/offline caching, update safety and crash recovery;
- device/browser/performance/security/privacy matrices;
- optional Capacitor packaging only after web parity;
- store, licence and release review.

Gate: release candidate passes the documented browser/device matrix with no P0 defect.

## 17. Solo + AI capacity and calendar

Assumptions: one human Owner, AI assistance, offline-first, functionality before final IP/content, no live matchmaking in the first release.

### Human Owner responsibilities

- product direction, taste, priority and batch approval;
- playtesting, difficulty and final quality decisions;
- IP/trademark/release decisions and any professional review;
- account, key, store, payment and deployment authority;
- review of AI-generated code, art, text, audio and evidence claims.

### AI-assisted work

- evidence indexing, data conversion, contracts and documentation;
- bounded implementation, unit tests, browser QA, save migrations and debugging;
- neutral prototype content, asset normalization, atlases and manifests;
- performance captures, screenshot comparisons and backlog maintenance;
- proposals only until the human Owner reviews and accepts them.

### Rough schedule

- stabilized VS3 Capture slice: roughly 3–6 months depending on trace closure;
- core Raising/Hunt/Shop/Database/Battle integration: roughly 9–18+ months;
- `FUNCTIONALLY_COMPLETE` internal build: roughly 18–36+ months;
- `PUBLIC_CONTENT_COMPLETE`: decided after functional completion; duration depends on final roster and art quality;
- expanding to 224 final HD original entities remains a multi-year optional content program, not a release blocker.

These are planning ranges, not commitments. Keep one gameplay slice and at most one independent content/tool packet in progress. Trace blockers, save reliability and tested completion take priority over apparent calendar speed.

## 18. QA strategy

Automated:

- unit tests for every formula and transaction;
- deterministic RNG fixtures and Battle replay hashes;
- save schema migration, corruption and rollback tests;
- browser screenshots at all contract viewports;
- touch gesture fixtures and Pointer Event coordinate transformations;
- asset manifest, rights, missing file and bundle-size gates;
- protected architecture tests for one state/save/Pixi authority and no research import.

Manual:

- thumb reach and one-handed play on small and large phones;
- notch, Dynamic Island, home indicator and browser chrome;
- keyboard/gamepad-only navigation and focus restoration;
- reduced-motion, reduced-flashing, text scale and color-independent status;
- 20-minute thermal run and low-memory scene changes;
- repeated capture, evolution, Battle result and interrupted-save scenarios.

Every defect report records reproduction, viewport/device, severity and owning layer: simulation, renderer, frontend, data, asset or packaging.

## 19. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| source expression enters the product while pursuing parity | blocks public release and creates replacement debt | IP-neutral IDs and original placeholders from day one; research-only imports are test-blocked |
| unresolved care/evolution/capture/Battle rules | false parity or rework | bounded binary/runtime trace before each dependent slice |
| treating 224 final characters as an early requirement | prevents a solo developer from finishing the game | full schema capacity, 16–24 test species, final roster decided after functional completion |
| doing a complete copyrighted-art pass before replacement | doubles content work and increases IP risk | complete mechanics first; replace content through manifests after the functional gate |
| dense NDS information on a phone | unreadable UI | semantic zones, tabs/sheets, no dual-screen port |
| mobile GPU/thermal load | unstable FPS | measured quality tiers, atlases, pooling and lazy loading |
| save schema expansion | lost progress | versioned migrations, atomic transactions, recovery fixtures |
| current documentation drift | wrong gate or duplicate work | R0 reconciliation before VS3 |
| new online backend | security, privacy and cost | offline-first; asynchronous/private modes before matchmaking |

## 20. Immediate approved-safe work

This plan does not itself authorize VS3–VS7 runtime or mass art production. The next safe bounded work is:

1. reconcile VS2 governance drift;
2. freeze IP-neutral IDs, content-provider interfaces and the research-import firewall;
3. publish static data contracts and trace work packets for Raising, Hunt and Battle P0 gaps;
4. select one bounded VS3 Capture vertical slice;
5. build one original-neutral replacement proof using a temporary creature, one Hunt biome and related UI/VFX;
6. defer final brand, world and launch-roster decisions until the complete game can reach Championship.

After those gates pass, production can proceed through the roadmap without changing the core architecture.
