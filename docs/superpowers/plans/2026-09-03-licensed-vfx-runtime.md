# Licensed VFX 26 Implementation Plan

> **For agentic workers:** Execute inline. Same promotion gate as Hunt/Cage/Battle licensed-runtime-v1.

**Goal:** Copy all 26 original Nitro 3D VFX conversions into one production runtime bundle so the game can load them without fetching the research pack.

**Architecture:** One `VFX` runtime bundle under `assets/production/vfx/licensed-runtime-v1`. Source is the already-converted `docs/art/production/vfx/faithful-reference-26` GLB+PNG set. NSBMD/NSBCA/NSBTA/NSBMA/NSBVA stay out. Hypereffect visibility and spark material JSON sidecars already exist and are copied, not re-decoded. The battle field stays Pixi; a bounded Three.js overlay is only for `?vfxArt=` preview. The presentation layer does not infer hits, Hyper, Spark, or rain.

**Tech Stack:** Existing `faithfulVfxRuntimeBundle.js` playback pattern, `nitroVfxAnimationSidecar.js`, Three.js GLTFLoader, VS5 field host.

## Global Constraints

- Exactly 26 `NITRO_3D_EFFECT_FAMILY` systems. Do not promote sprite-sheet VFX.
- Do not copy Nitro binaries. Do not mount `gate_select/earth`.
- Do not invent battle hit / Hyper / weather callers. Overlay is explicit `?vfxArt=`.
- Preview camera/framing is `PRODUCT_AUTHORED`. Original camera remains untraced.
- Caller-owned ticker only (Pixi Application ticker). No private `requestAnimationFrame`.
- Overlay canvas is `pointer-events: none`. Auto Battle still takes no input.
- `shippingReady` stays false.
- Keep the internal 4-system faithful bundle and its tests working.

---

### Task 1: Promote 26 systems

**Files:**
- Create: `src/championship/presentation/vfx/originalVfxSystemBindings.js`
- Create: `scripts/promote-licensed-vfx-runtime.mjs`
- Create: `assets/production/vfx/licensed-runtime-v1/**`
- Modify: `package.json`

---

### Task 2: Loader, index, battle overlay

**Files:**
- Create: `src/championship/presentation/vfx/licensedVfxRuntimeBundle.js`
- Create: `src/championship/presentation/vs5/createBattleVfxThreeOverlay.js`
- Modify: `scripts/build-art-production-a0.mjs`
- Modify: `src/championship/app/main.js`
- Modify: `src/championship/app/vs5Styles.css`
- Modify: tests and `scripts/validate-art-production-a0.mjs`

Expected A0: 18 runtime bundles, 95 ready-for-runtime (69 + 26).

---

### Task 3: Verify

- Unit tests: 26 system ids, catalog 1:1 with NITRO_3D_EFFECT_FAMILY, hashes, no `.nsbmd`, no Gate Earth, overlay uses caller ticker
- Browser: `?vfxArt=battle-hitspark_big` on a match shows the 3D hit spark over the licensed field
