# Licensed Cage Fields Implementation Plan

> **For agentic workers:** Execute inline. Same promotion gate as Hunt licensed-runtime-v1.

**Goal:** Copy all 40 original Training/Cage visual fields into one production runtime bundle so Raising Home can show licensed pixels without fetching the research pack.

**Architecture:** One `CAGE` runtime map-art bundle, `memoryPolicy = ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT`. Source is the already-composed `docs/art/production/cage/faithful-hd40` baseline (core + objects + verified animated frames). Runtime copies PNG frames only. Collision, ATR, OPM, and ranch layout stay outside the art bundle. Raising Home still uses the two product-authored drop regions; it loads **one** field at a time.

**Tech Stack:** Existing `runtimeMapArtBundle.js`, `originalMapAnimationTiming.js`, `originalCageVisualBindings.js`.

## Global Constraints

- Do not invent Cage Edit / OVL18 ranch layout. The two VS1 habitat regions stay product-authored drop targets.
- Do not embed ATR/COL/NBS/OPM/Nitro binaries.
- Do not treat cm33/cm36/cm38 as shop cages. Store them; do not auto-select them.
- cm29 is LID, cm28 is Waiting Room. They are stored, not guessed into the two VS1 slots.
- Default preview without `?cageArt` is CageDefinition 0 → `field_cm01_01` (internal licensed preview, not original new-game ranch parity).
- Animated durations come from pack `frameDurationsRawTicks` + `originalMapAnimationTicksToMs`. Four animated fields: cm07, cm09, cm21, cm39.
- CM27 Digimon-mark removal applies to remade art only. This bundle keeps the exact original baseline.
- `shippingReady` stays false.

---

### Task 1: Promote 40 fields

**Files:**
- Create: `scripts/promote-licensed-cage-runtime.mjs`
- Create: `assets/production/cage/licensed-runtime-v1/**`
- Modify: `package.json` (`art:promote:licensed-cage-runtime`)

---

### Task 2: Index, crosswalk, Raising Home loader

**Files:**
- Modify: `scripts/build-art-production-a0.mjs`
- Modify: `src/championship/app/main.js`
- Modify: `src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js`
- Modify: tests and `scripts/validate-art-production-a0.mjs`

---

### Task 3: Verify

- Unit tests: 40 field ids, 36 definition visuals + lid + 3 unreferenced present, one-field policy, no RAW payloads
- Browser: New Game Raising Home shows `field_cm01_01` pixels; `?cageArt=field_cm09_01` overlays the animated beach field
