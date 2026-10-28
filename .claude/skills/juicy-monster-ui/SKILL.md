---
name: juicy-monster-ui
description: In-game HUD rules for Cyber Partner: Tournament (arcade theme) — ranch/build dock, partner inspector, hunt visor, battle HUD, shop/codex, evolution surge. Use when laying out, animating or sounding any in-game HUD. Never applies to the title, logo, main menu or opening.
---

# Juicy monster UI — in-game HUD only

Owner direction 2026-10-27. This skill covers HUD that sits over gameplay. It
does **not** cover the title, logo, main menu or opening: those stay exactly as
live main shipped them (`#cm-title` and its descendants). Do not add title
selectors, keys or sounds here; verify with the title zero-diff check below.

## Where things live

| Concern | File |
|---|---|
| Palette tokens (arcade default) | `src/championship/app/ui/tokens.css` |
| Theme skin | `src/championship/app/ui/arcade.css` |
| Layout for every theme (sheets, ranch inspector, hunt split, battle) | `src/championship/app/ui/screenLayout.css` |
| Motion | `src/championship/app/ui/arcadeMotion.css` |
| Sounds + juice (`cm-fx` CustomEvent: purchase, denied, snap, unsnap, open, close, toggle, sparkle, levelup, damage) | `src/championship/app/ui/arcadeFx.js` |
| Toolbar quick dock (`data-quick-id`, never `data-entry-id`) | `src/championship/app/championshipToolbar.js` |
| Ranch camera pitch and plinth | `src/championship/presentation/ranchThreeCoordinates.js` (`ranchViewProjection`), `ranchPlinth.js` |
| Hex world editor | `src/championship/app/hexWorldEditor.js` |

## Spatial rules

1. **Three bands.** Top visor (status, currency, rank) / play field / bottom
   command dock. The play field is centred between the visor's bottom and the
   dock's top, never under either.
2. **Top-right stacks, never overlaps.** Currency and secondary pills sit in a
   flex column with a gap; long values (`9.9M+`, `12,000`) shrink their font
   or abbreviate before they may wrap into the pill below.
3. **Safe areas.** Respect `env(safe-area-inset-*)`; 16 px side gutter at phone
   width; no horizontal page scroll in portrait 390×844, landscape 844×390 or
   desktop 1366×768.
4. **Touch targets** ≥ 44 px; thumb zone (bottom third) holds primary actions.
5. **Drawers, not modals,** for partner inspector and build trays; the field
   stays visible and pannable behind them.

## Button physics

- Press: `translateY(2px)` and the drop shadow shrinks; release springs back
  (≤ 140 ms). Disabled buttons do not move and play `denied`.
- Every display override is guarded with `:not([hidden])`.
- Respect reduced motion (`prefers-reduced-motion` and the in-game setting):
  keep state changes, drop travel and shake.

## Input isolation (no click-through)

- DOM HUD owns its hits. A tap on HUD never reaches the Pixi field; the field
  checks `document.elementFromPoint` before acting on edge drags.
- Drawers and sheets live inside the screen body so footer actions stay
  clickable (a browser gate depends on this).
- Keep every existing `id`, `data-*` hook and event binding the browser
  acceptance tests use; add, never rename.

## Sound

Fire `cm-fx` with an existing kind; `arcadeFx.js` routes it to the sfx bus.
New kinds need a real game event behind them.

## Real events only

Evolution surge, damage numbers, capture and level-up effects are driven by
real game state (`lifecycle.evolution`, battle snapshots, capture results).
No fake damage, no fake evolution buttons, no third-party characters or emoji
in place of game art. Battle rules and AI are unchanged.

## Evolution, cut-in, impact and Dex showcase (Owner 2026-10-28)

| Piece | File |
|---|---|
| Evolution / back-to-egg runner (live + preview) | `src/championship/presentation/juicy/cyberMorphEvolutionRunner.js` |
| Raising hookup (2x native playback, real stat change) | `presentation/juicy/raisingEvolutionCinematic.js`, `app/raisingHomeP1RView.js` |
| Special cut-in strip + skill capsule (DOM) | `presentation/juicy/skillCutIn.js` |
| Impact quartet (Pixi, `juicy` option) | `presentation/battleFx/battleFxLayer.js` |
| Dex motion viewer + preview sandbox | `presentation/juicy/codexShowcaseTheater.js`, `spriteMotionPlayer.js` |
| Copy (five locales) / styles | `text/juicyShowcaseText.js`, `app/ui/juicyShowcase.css` |

- Every theme except `classic` gets these pieces (`juicyPresentationEnabled`);
  `classic` keeps the original sequence, callout and dim.
- **Zero WebGL.** The runner, the cut-in and the Dex sandbox are DOM + Web
  Animations only: no canvas, no renderer, no `requestAnimationFrame`. The
  sandbox is one node per Dex screen, reused; closing cancels its beats and
  animations and drops its images.
- **Native clock owns evolution.** The arcade runner only lays over it; the app
  plays the 272 native frames at 2x (`raisingPresentationRate`), a tap asks for
  6x. Phase counts and the single RNG draw are unchanged. The stat panel shows
  the real before/after from the `EVOLVED` message, never a guess.
- **Cut-ins never block.** `pointer-events: none`, 650 ms, the battle keeps
  stepping. A special's title moves from the Pixi callout to the strip.
- **Hit-stop is drawing only.** 60 ms on heavy hits: the two fighters hold their
  drawn frame and the dressing freezes while `source.tick()` continues.
- **Dex previews are labelled simulations** (`模擬展演`), the one exception to
  "real events only": they read catalogs, never call an intent and never write
  the save. A partner that is not REGISTERED, or a route without a completion
  record, plays as an encrypted signal (cyan outline, hidden names, 🔒 tip).
- Gate: `tests/championship-codex-showcase-browser.cjs` (10 rounds, context
  count, storage unchanged) plus `tests/championship-juicy-showcase-cases.mjs`.

## Ranch camera

The world stays on the 52° layout; the Owner locked the camera at 40°
(`RANCH_DEFAULT_VIEW_PITCH`, 2026-10-27). `?ranchPitch=35|40|45|52` still
compares. The pitch changes only the view: ground scales vertically by
`sin(pitch)/sin(52°)`, heights by `cos(pitch)`, sprites stay upright.
`tests/championship-ranch-view-pitch-cases.mjs` proves camera, Pixi mapping
and picking agree at every pitch; keep it green.

## Facility editor and passages

- One screen, three zones (`hexWorldEditor.js`, `vs4Screens.js`, `ui/screenLayout.css`):
  header + "?" hint, the hex canvas with floating corner keys, size filters and
  a sideways cartridge dock above the footer. No page scroll at any size.
- Land is a count, not fixed cells: sockets glow next to the land, the Lid
  covers empty cells only when no land is left.
- Passages, closed borders and safe exits come from the ranch's own ground
  (`hexWorldPassages.js` → `composeProductRanchGround` / `ranchSafeExits`).
  The 3D ranch dissolves border art only on real passages and lays a
  threshold there (`ranchPlinth.js`). Never draw a passage the walk rule
  did not open.
- Never animate `transform` forever on a button gates click (Playwright waits
  for a stable box); pulse with `filter` or `box-shadow`.

## Verification

- Title zero-diff: compare title / menu / opening computed styles against live
  main in desktop, portrait and landscape (all three must report 0 diff).
- Hex checks: build, merge, walk and save a layout; 100-cell performance.
- `npm run test:ci`; browser gates on the isolated QA port, never 8732.
