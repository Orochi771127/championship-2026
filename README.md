# DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD

**Standalone product repository.**

**2026-09-09 checkpoint:** See the [current unfinished-work inventory](docs/reports/commercial-readiness/2026-09-09/MAIN_CHECKPOINT_ZH_TW.md). `npm run test:ci` runs explicitly classified repository-contained tests; `npm test` retains full local reference/art acceptance. Main pushes run CI; public Pages deployment requires explicit dispatch and release approval checks.

**Target:** Web-first / mobile-first / portrait 9:16 / touch-first, with desktop-browser compatibility.

**Nexus Link integration:** `FROZEN / OUT_OF_CURRENT_PRODUCT_SCOPE`. This repository does not import from or depend on a Nexus Link application, router, store, save system, gameplay system, or asset tree.

**Original decoded assets:** `ROM_COPYRIGHTED_REFERENCE / RESEARCH_ONLY / NOT_SHIPPING_READY`. The private source pack is not fetched by the game. Only the explicitly registered, Owner-authorized battle reference bundles may run in the loopback research preview; the public build excludes them. This exception does not grant shipping acceptance.

**2026 runtime art:** every runtime-loadable image lives under `assets/production/`. Runtime registration and shipping readiness are separate; the current index includes temporary, reviewed, licensed and explicitly scoped loopback research bundles.

**Current implementation (2026-09-08):** normal Hunt generation/tools/capture/return and individual-field persistence are integrated. New Game constructs the original starter; native time/short-touch hatching preserves its identity and form through Save/Continue. The corrected 216-entry encyclopedia retains registrations. The one-stage Feeding slice is playable: original ground/actor initialization, food/protein placement and stock, approach/eating, Clean and remaining-food/individual Save/Continue. Normal 9:16 browser flow and full1326/1326 regression pass. Gate fees, rank/match unlocks, battle wallet transactions, Shop and Cage have working slices. Full Raising AI/training/treatment, adult evolution/lifetime, player-owned battle teams, long-term progression, replacement art/audio and device/shipping acceptance remain partial. See [Feeding completion and limits](docs/research/RAISING_FEEDING_STAGE_2026-09-08.md), [the two-stage work record](docs/reports/parity-audit/2026-09-08/TWO_STAGE_IMPLEMENTATION.md) and [current product status](docs/CURRENT_PRODUCT_STATUS.md).

**Latest correction:** autonomous Raising activity, corrected meat/capsule art, visible Clean tools and active-Home calendar continuation are now integrated. See [the correction record](docs/research/RAISING_ACTIVITY_CARE_FIX_2026-09-08.md) for validation and remaining overnight/lifecycle limits.

## Install and run

On Windows, double-click `START_CHAMPIONSHIP.cmd`. Keep its server window open
while playing. Do not open `championship.html` directly: browsers block the
game's JavaScript modules under the `file://` protocol.

Or start it from PowerShell:

```powershell
npm install
npm run serve
```

Open `http://127.0.0.1:8732/championship.html`.

## Internal review and public builds

Formal licence verification is deferred until the final public-release gate.
Internal engineering can continue using the explicit input list in
`docs/contracts/championship/WEB_BUILD_INPUTS.v1.json` and the existing approved
local sources. This list selects files; it does not promote art or grant rights.

```powershell
npm run audit:build
npm run build:internal
npm run validate:internal
$env:CHAMPIONSHIP_PORT = '8764'
npm run serve:internal
```

Open `http://127.0.0.1:8764/championship.html` to review the snapshot on a separate
browser origin. Internal output is loopback-only and is not for uploading to a
static host. The validator checks exact file lists, hashes and module closure.
Rebuilding requires the listed local inputs; the current Git HEAD alone does
not contain every private or uncommitted input.

The GitHub Actions workflow uses `build:pages` and `validate:pages` for public
output. Both enforce the release boundary. Pending rights, undeclared release
scope, private dependencies or unapproved asset files reject the candidate.
The current product has not passed those gates. A failed preflight preserves
the previous output. Saves remain in each player's browser.

```powershell
npm run build:pages
npm run validate:pages
npm run battle:catalogs:build -- --rom "C:\\path\\to\\original.nds"
```

```powershell
npm test
npm run test:browser
npm run test:browser:vs2
npm run test:browser:vs2-r1
```

The browser gates exercise the required 360×800, 390×844, 393×852, 412×915, and 430×932 contract viewports, plus 375×812 as supplementary coverage. The repository is intentionally self-contained after `npm install`; runtime does not load PixiJS from a CDN or another project.

## Product architecture

| Layer | Authority |
|---|---|
| DOM | screen UI, menus, panels, toolbar, and text |
| PixiJS | playable 2D field, creatures, sprites, and 2D VFX |
| Three.js | bounded 3D only when verified or explicitly approved; currently unmounted |

There is one standalone application, one Championship mode authority, one domain session, one save repository/key, and one PixiJS Application/ticker. Historical Nexus decisions remain in coordination history as superseded or frozen facts, not dependencies.

## Evidence firewall

- `assets/production/` — runtime-loadable product art only.
- `research/original-evidence/` — evidence policy and external archive index only; no runtime imports.
- `docs/coordination/` — `CHAMPIONSHIP_2026_PRODUCT_SSOT` coordination snapshots.
- `docs/migration/` — checkpoint provenance and migration verification.

## Documentation

Start at [docs/README.md](docs/README.md). It separates current integrated truth from historical Claude/Codex coordination snapshots.

The original-game art audit starts at [docs/art/ART_MASTER_INVENTORY.md](docs/art/ART_MASTER_INVENTORY.md); ROM graphics and reconstruction galleries remain external under `R:\NEXUS LINK\原作\research-only`.

- [Current product status](docs/CURRENT_PRODUCT_STATUS.md)
- [Reusable implementation inventory](docs/REUSE_INVENTORY.md)
- [Production plan](docs/planning/CHAMPIONSHIP_2026_MASTER_GAME_PRODUCTION_PLAN.md)
- [Technical debt register](docs/TECH_DEBT_REGISTER.md)

## Roadmap gate

| Slice | Scope | State |
|---|---|---|
| VS1 | Raising Home: boot → select → care → relocate → save → real reload → continue → restore | accepted baseline; migrated and revalidated |
| VS2 | Gate Select → Hunt Loadout → Hunt Field → Explore → Return Home, including bounded Gate 3D and the recovered Loadout runtime | integrated bounded baseline |
| VS3 | Native capture → hand/card → Hunt Result → Home/save | normal application path integrated; browser success/device parity still pending |
| VS4–VS7 | daily systems, battle, progression and production finish | multiple integrated slices; complete raising, own-party battle, progression, art and device acceptance remain partial |

The normal application now includes Capture, Hunt Result, Battle, Shop and Database surfaces. Historical exploration fixtures retain their narrower scope. The Hunt world is a 128×128 modular field traversed by a camera: 9:16 is the viewport, never the world.
