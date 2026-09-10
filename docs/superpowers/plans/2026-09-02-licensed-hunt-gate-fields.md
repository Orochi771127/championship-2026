# Licensed Hunt Gate Fields Implementation Plan

> **For agentic workers:** Execute inline. Extends the hm00 pilot; same promotion gate.

**Goal:** Copy all 30 ROM-decoded Hunt variants (tutorial hm00 + every Gate day/night field from the ARM9 33-entry table) into one production bundle so Gate Select loads original pixels without `?huntArt`.

**Architecture:** One `HUNT` runtime map-art bundle, `memoryPolicy = ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT`. `main.js` already loads `gate.originalFields.dayFieldId` when that id is in the bundle. Night variants are stored, not auto-selected (no traced day/night UI). Collision stays in Hunt runtime.

**Tech Stack:** Existing `runtimeMapArtBundle.js`, `originalMapAnimationTiming.js`, pack `03_MAPS/hunt-30-variants`.

## Global Constraints

- Do not invent a 17th Gate. hm00 remains `HUNT_TUTORIAL`.
- Do not invent a day/night selector. Night fields are in the bundle only.
- Do not copy ATR/encounter/Nitro binaries.
- Animated durations come from pack `durationRawTicks` + `originalMapAnimationTicksToMs`.
- Static fields are one frame with `durationMs: null`.
- `shippingReady` stays false.

---

### Task 1: Promote 30 fields

**Files:**
- Create: `scripts/promote-licensed-hunt-runtime.mjs`
- Create: `assets/production/hunt/licensed-runtime-v1/**`
- Retire: `assets/production/hunt/licensed-hm00-tutorial/` after the new bundle verifies

---

### Task 2: Index, crosswalk, loader URL

**Files:**
- Modify: `scripts/build-art-production-a0.mjs` (promote all 17 hunt crosswalk rows)
- Modify: `src/championship/app/main.js` (manifest URL)
- Modify: tests and `scripts/validate-art-production-a0.mjs`

---

### Task 3: Verify

- Unit tests: 30 field ids, all Gate day/night ids present, one-field policy, no RAW payloads
- Browser: `championship.html` with no huntArt query → Grass → Hunt field shows hm01 pixels
