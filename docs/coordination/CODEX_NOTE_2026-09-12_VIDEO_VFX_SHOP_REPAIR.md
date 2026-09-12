# Codex handoff: owner-video VFX and Shop repair

Date: 2026-09-12  
Base after concurrent Hunt work: `1630c91e38b0127cc5bf6300c3c9e8eb4dbd0472`  
Lane: Claude owns Hunt stamina/result; Codex owns capture-storage VFX, passive infirmary VFX, and Shop.

## Completed implementation

### Capture-storage VFX

- `nativeHuntFieldControls` now publishes the active native hand controller's existing phase/counter and last target position as presentation-only `captureEffects`.
- The Hunt Pixi presenter draws a cyan-white condensation, lift, curved flight, and arrival/card flash on a screen-space layer.
- The hidden target remains hidden; there is no duplicate actor and no new capture state.
- Timing authority remains `NATIVE_HAND_CONTROLLER`; art is `ORIGINAL_CREATED_VECTOR`.

### Mini-infirmary recovery VFX

- `getRaisingActorFrame()` now projects the canonical native profile's current/max HP for presentation reads.
- The existing Raising Pixi scene starts a 420 ms cyan/green pulse only when canonical HP increases and the resident is in a verified `RECOVER_HP_STRESS` cage.
- It does not heal, schedule a heal, consume an item, or reuse the separate active-treatment trigger.
- It uses the existing shared Pixi Application ticker and creates no second ticker/bootstrap.

### Shop

- Restored the video-observed selected-item layout: top detail panel, category strip, lower horizontal product shelf, arrows, one Buy action, and Back.
- All 118 existing listings continue through the canonical Shop runtime. Prices, unlocks, quantities, wallet, purchase intents, and save authority are unchanged.
- Added a separate `shopOriginalVideo.css` loaded after the shared native skin. This avoids overwriting Claude's concurrent `nativeUiSkin.css` work.
- Selected product uses the Owner-directed green rim/label over a dark card, not a green fill.
- Superseded on 2026-09-13: the referenced catalog exists at `R:\NEXUS LINK\原作\YDIJ_RAW_RESEARCH_EVIDENCE\SHOP_REVERSE_CATALOG_118.csv`. Correct CSV parsing gives 118 records with complete Japanese names and descriptions. All 118 identity/price/unlock rows match the product catalog; independently written Traditional Chinese descriptions now use the same record indices without adding a runtime dependency on the research tree.

## Rights and evidence

- Formal observations: `docs/research/ORIGINAL_VIDEO_VFX_SHOP_OBSERVATIONS_2026-09-12.md`.
- `common/e002_hunt_digicach` is a strong capture-family visual match.
- Only a cyan-star sub-sequence of `common/e001_ikusei` matches the recovery feedback; do not label the whole family as healing.
- Both registry entries require replacement. No ROM pixels, decoded cells, or video frames were copied into runtime.

## Files owned by this lane

- `championship.html`
- `docs/contracts/championship/WEB_BUILD_INPUTS.v1.json`
- `src/championship/app/championshipStandaloneApp.js`
- `src/championship/app/shopOriginalVideo.css`
- `src/championship/app/vs4Screens.js`
- `src/championship/hunt/capture/nativeHuntFieldControls.js`
- `src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js`
- `src/championship/presentation/vfx/captureStorageVfx.js`
- `src/championship/presentation/vfx/recoveryCageVfx.js`
- `src/championship/presentation/vs2/createHuntFieldPixiPresentation.js`
- the six matching focused/runtime-boundary test files

## Validation

- Focused Node suite after final corrections: 45/45 pass.
- Covers the native 94-frame capture clock, capture-effect projection/arc, hidden-actor exclusion, recovery-cage/actual-HP gate, actor HP projection, all 118 Shop listings, single Buy action, and no Shop catalog mutation.
- Full portable CI: 1,269/1,269 pass (`175` portable modules; `27` explicitly local-reference modules are classified separately by the existing CI scope).
- Startup module-preload validation: pass, 179 modules.
- Owner public-playtest build and validation: pass, 6,282 files, identical build ID `5d1e1a43fb76f400160e747cac741b24974c4d7a3e0983a12768344b14380c30`.
- `git diff --check`: pass.
- Interactive system-Chrome inspection is not counted as pass. Chrome is installed/running, but this Codex host has neither the ChatGPT Chrome extension nor its native-host registration, so the supported browser-control path is unavailable. No alternate browser was substituted.
- No commit, push, deploy, merge, rebase, or reset was performed.

## 2026-09-13 follow-up

- Current shared-tree base after Claude's finding-8 withdrawal: `e2b06b24b70ab6a0f701d924c38804e3fab5163d`.
- Finding 8 remains withdrawn as a developer-harness-only false positive. No player-mode Hunt header change was made in this lane.
- Verified the external Shop CSV: 32,654 bytes, SHA-256 `58e5beb04f8c75c388710291c5c5506a560453872743ca34c7c3a7ef2bf1bc28`, 118 parsed rows, 0 empty Japanese names, 0 empty Japanese descriptions, and 0 product-catalog mismatches across record/category/item/stock/price/unlock fields.
- Added 118 product-authored Traditional Chinese names and descriptions keyed by the verified original record indices. Corrected the source-proven `こうざん` / `ミニこうざん` labels from 礦山 / 小礦山 to 高山 / 小高山 because the descriptions and bird-family effect establish the mountain meaning.
- Reproduced the local-only failure in `championship-raising-native-sizing-cases.mjs`: `rays.moveTo is not a function`. Root cause was the test's minimal Pixi `Graphics` substitute missing `moveTo`, `lineTo`, and `star`; the production PixiJS API was not faulty. The substitute now implements the three chainable no-op methods.
- Focused Shop/localization/Raising scene suite after the fix: 25/25 pass.
- Portable CI suite: 1,270/1,270 pass.
- Full local suite, including local-reference tests: 1,487/1,487 pass.
- Module preload check: 179 startup modules pass.
- Owner playtest build and independent validation: 6,282 files, build ID `59243f91f4222e615af638a2c6b78a25b816ec08a4141ab4394707c5dfa5f650`.
- `git diff --check`: pass. No absolute research-tree path or copied Japanese Shop string was added to runtime source.
- No commit, push, deploy, merge, rebase, or reset was performed.

## Still not established

- Exact VFX pixel/frame parity: `PARTIAL`, bounded by video observation and original-created shapes.
- Normal system-Chrome Shop/VFX trigger acceptance: pending because the supported Chrome connection is unavailable.
- Physical-device acceptance: false/pending.
- Full original parity: false.
- Shipping/public-release acceptance: not granted by this work.
