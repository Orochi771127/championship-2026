# Licensed Battle Fields Implementation Plan

> **For agentic workers:** Execute inline. Same promotion gate as Hunt/Cage licensed-runtime-v1. Do not wait for a second confirmation: Owner licensed-pixel runtime already covers this family.

**Goal:** Copy all 11 original Battle static fields into one production runtime bundle so VS5 Auto Battle can show licensed pixels without fetching the research pack.

**Architecture:** One `BATTLE` runtime map-art bundle, `memoryPolicy = ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT`. Source is the pack gallery `clean/native_static_game_view.png` (core + common objects + field objects already flattened). Runtime copies PNG frames only after 4× nearest. Collision, ATR, OPM, NBS, and BM03/BM04 animation stay outside the art bundle. The scene loads **one** field at a time. Shared `field_bm00_00` is not a 12th drawable field: it is baked into the ten arenas that catalog-link it. Cyberspace has no common layer.

**Tech Stack:** Existing `runtimeMapArtBundle.js`, new `originalBattleFieldBindings.js`, VS5 Pixi presenter, `main.js` loader.

## Global Constraints

- Native size is 52×34 cells / 416×272 px (26:17). Do **not** stretch to the 3:2 field-band host. Contain-fit, nearest, small letterbox.
- Do not invent stand positions. PRODUCT_AUTHORED markers stay on top of the pixels.
- Do not invent match → arena mapping. Default `arenaIndex` 0 is `BATTLE_NORMAL` / `field_bm01_01`. `?battleArt=field_bm07_01` overlays any stored field for visual QA.
- Do not place BM03/BM04 BSAR frames. `animationStatus` stays `ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE`. One static frame only.
- Do not embed ATR/COL/NBS/OPM/Nitro binaries. Do not composite the common layer a second time at runtime.
- Keep `internal-battle-review` manifests registered. They are review-only (`runtimeEligible: false`).
- The presentation contract still names **no** file path. Loader lives in `main.js`.
- `shippingReady` stays false.

---

### Task 1: Promote 11 static fields

**Files:**
- Create: `src/championship/presentation/originalBattleFieldBindings.js`
- Create: `scripts/promote-licensed-battle-runtime.mjs`
- Create: `assets/production/battle/licensed-runtime-v1/**`
- Modify: `package.json` (`art:promote:licensed-battle-runtime`)
- Modify: `src/championship/presentation/runtimeMapArtBundle.js` (allow `BATTLE`)

---

### Task 2: Index, loader, battle presenter

**Files:**
- Modify: `scripts/build-art-production-a0.mjs`
- Modify: `src/championship/app/main.js`
- Modify: `src/championship/app/battlePresentationSource.js` (expose `arena.field`)
- Modify: `src/championship/presentation/vs5/createBattleFieldPixiPresentation.js`
- Modify: tests and `scripts/validate-art-production-a0.mjs`

Expected A0: 17 runtime bundles, 69 ready-for-runtime (Hunt 17 + Cage 40 + Battle 12).

---

### Task 3: Verify

- Unit tests: 11 field ids, catalog 1:1, cyberspace has no common, BM03/BM04 still UNKNOWN with one static frame, hashes, no RAW
- Browser: New Game → BATTLE → enter a match shows `field_bm01_01` pixels, not the teal procedural ellipse. `?battleArt=field_bm07_01` overlays Cyberspace.
