# DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD

**Standalone product repository.**

**Target:** Web-first / mobile-first / portrait 9:16 / touch-first, with desktop-browser compatibility.

**Nexus Link integration:** `FROZEN / OUT_OF_CURRENT_PRODUCT_SCOPE`. This repository does not import from or depend on a Nexus Link application, router, store, save system, gameplay system, or asset tree.

**Original decoded assets:** `ROM_COPYRIGHTED_REFERENCE / RESEARCH_ONLY / NOT_SHIPPING_READY`. They are not product assets and are never imported or bundled by runtime code.

**2026 runtime art:** every runtime-loadable image lives under `assets/production/`. VS1 uses a small, explicitly registered temporary presentation set; it is not the final production-art direction.

## Install and run

```powershell
npm install
npm run serve
```

Open `http://127.0.0.1:8732/championship.html`.

```powershell
npm test
npm run test:browser
npm run test:browser:vs2
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

## Roadmap gate

| Slice | Scope | State |
|---|---|---|
| VS1 | Raising Home: boot → select → care → relocate → save → real reload → continue → restore | accepted baseline; migrated and revalidated |
| VS2 | Gate Select → Hunt Loadout → Hunt Field → Explore → Return Home | built under the Owner GO of 2026-08-28; **stopped for Owner review** |
| VS3–VS7 | Capture, support systems, battle, progression, production finish | preserved roadmap; frozen |

VS2 deliberately ships no Capture, Hunt Result, Battle, Shop or Database surface. The Hunt world is a 128×128 modular field traversed by a camera: 9:16 is the viewport, never the world.
