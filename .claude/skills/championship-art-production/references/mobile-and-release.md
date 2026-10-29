# Mobile budget and release

## Budget

- Quality tiers (`presentation/presentationPreferences.js`, `QUALITY_TIERS`):
  saver / balanced / high set the Pixi resolution cap (1 / 2 / 3), the Three
  pixel-ratio cap, antialiasing, highlight particles, `backdropBlur` and
  `softGlow`. New costly effects get a tier switch the same way instead of a
  hard-coded value. The Pixi stage never exceeds `MAX_DEVICE_RESOLUTION = 2`
  (`championshipPixiStage.js`).
- Ranch 3D: `cappedPixelRatio <= 1.75`, mobile shadow map 1024 (hd2d-cage-world).
- Leaving a Three view depends on who owns the context:
  - **Its own canvas and renderer** (ranch, gate globe, medals, highlight
    burst): `renderer.dispose()`, `renderer.forceContextLoss()`, remove the
    canvas, drop textures.
  - **Hunt shares the Pixi Application's canvas and GL context** through
    `leaseHuntRenderer()` (`presentation/vs2/huntThree/lifecycle.mjs`). Leaving
    Hunt releases the lease and disposes only Hunt's own scene resources
    (`createHuntThreeMap.mjs`). Never call `forceContextLoss()` or remove that
    canvas: it would destroy the one Pixi Application.
  - Either way, the WebGL context count must not grow when a view is opened
    and closed repeatedly. Showcase and juicy pieces use zero WebGL
    (juicy-monster-ui).
- Render loops pause while `document.hidden`; the save flushes on
  `visibilitychange` to hidden (`app/main.js`).
- Saves: one modern save key (`championshipModernSave:v1`) plus the session
  checkpoint (`championshipSessionCheckpoint:v1`). Art and UI work never
  writes either; QA runs on 8761, never 8732.
- Safe areas: `env(safe-area-inset-*)` on every edge-anchored bar; 16 px side
  gutter; 44 px touch targets; no horizontal scroll at 390×844, 844×390,
  1366×768. Real notch insets can be emulated in Playwright with CDP
  `Emulation.setSafeAreaInsetsOverride`.
- Images: WebP for runtime art, a compact and a large variant where the screen
  size differs; the static title already ships `arena-compact.webp`.

## Publication (GitHub Pages)

- `main` pushes deploy only when `docs/contracts/championship/WEB_BUILD_INPUTS.v1.json`
  lists every module with its current hash; dynamic `import()` needs a
  `moduleEntries` entry. The size limit is a running total, so every added
  byte counts.
- `npm run build:pages` then `npm run validate:pages` (or the playtest pair)
  before asking to publish. Hashes are over LF bytes: watch CRLF checkouts.
- Contract conflicts are resolved by replaying the build, never by hand-merging
  hashes.
- Publication of an earlier batch never authorizes the next one.
