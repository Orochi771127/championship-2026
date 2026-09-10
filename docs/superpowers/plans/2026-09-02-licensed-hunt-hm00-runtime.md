# Licensed Hunt hm00 Runtime Pilot Implementation Plan

> **For agentic workers:** Execute inline in this session. Later Hunt/VFX/UI batches get their own plans after this pilot proves the promotion gate.

**Goal:** Copy ROM-decoded Hunt tutorial field `field_hm00_01` into `assets/production/`, register it as Owner-declared `LICENSED` runtime art, load it through the existing one-field map-art loader, and keep shipping/QA gates closed.

**Architecture:** Research pack stays outside the server root. Production copies are the only bytes the game may fetch. `ART_PRODUCTION_INDEX.json` is the unique rights authority for runtime. Collision, encounters, and Gate mapping stay in existing Hunt runtime — the art bundle only supplies pixels.

**Tech Stack:** PixiJS 8, existing `runtimeMapArtBundle.js`, `originalMapAnimationTiming.js` (ARM9 `0x0204ED5C` + NDS video clock).

## Global Constraints

- Do not load files from `YDIJ_PRIVATE_ROM_ART_PACK` at runtime.
- Do not copy Nitro binaries (`.ncgr`, `.atr`, `.nsbmd`, …) into `assets/`.
- Do not embed RAW attribute/encounter classes in the art bundle.
- Keep `memoryPolicy = ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT`.
- `runtimeEligible: true`, `shippingReady: false` until visual QA.
- Animation durations must come from `originalMapAnimationTicksToMs`; do not invent 60fps.
- `hm00` is `HUNT_TUTORIAL`, not a 17th Gate biome.
- Do not mount `earth` or Desktop. Do not change battle/raising gameplay.
- Source ROM SHA-256: `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`.

---

### Task 1: Owner rights authority

**Files:**
- Modify: `docs/coordination/OWNER_DIRECTION.md`
- Modify: `scripts/build-art-production-a0.mjs`
- Modify: `tests/championship-art-production-a0-cases.mjs`
- Modify: `scripts/validate-art-production-a0.mjs`

Record the 2026-09-02 Owner directive: production index is the unique runtime rights source (`LICENSED`). Unpromoted crosswalk rows stay empty. Shipping still requires QA.

---

### Task 2: Promote hm00 pixels + runtime manifest

**Files:**
- Create: `scripts/promote-licensed-hunt-hm00.mjs`
- Create: `assets/production/hunt/licensed-hm00-tutorial/frame-00.png`
- Create: `assets/production/hunt/licensed-hm00-tutorial/frame-01.png`
- Create: `assets/production/hunt/licensed-hm00-tutorial/manifest.json`

Copy composites only. Frame 0 uses pack `faithful-hd2x-frame-00.png` (2048² nearest). Frame 1 is 2× nearest of `native-composite-frame-01.png` because the pack has no HD frame 1. Durations: both `durationRawTicks: 20` from the pack, converted with `originalMapAnimationTicksToMs`.

---

### Task 3: Wire Hunt mount without inventing Gate mapping

**Files:**
- Modify: `src/championship/app/main.js`
- Modify: `src/championship/presentation/runtimeMapArtBundle.js`

Load art when `gate.originalFields.dayFieldId` is in the bundle (none of the 16 Gates are `hm00`, so they stay procedural). Preview overlay: `?huntArt=field_hm00_01`. Apply Pixi `nearest` scale so DS tiles do not blur. Hide procedural terrain/objects when `fieldArt` is present (already implemented).

---

### Task 4: Tests and browser proof

**Files:**
- Create: `tests/championship-licensed-hunt-hm00-cases.mjs`
- Modify: `tests/championship-runtime-map-art-bundle-cases.mjs` if nearest helper needs coverage
- Modify: A0 tests for 15 index entries and one promoted crosswalk row

Run `node --test tests/championship-licensed-hunt-hm00-cases.mjs tests/championship-art-production-a0-cases.mjs tests/championship-runtime-map-art-bundle-cases.mjs tests/championship-original-map-bindings-cases.mjs`. Browser: `championship.html?huntArt=field_hm00_01` → Gate → Hunt field.
