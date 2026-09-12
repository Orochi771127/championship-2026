# UI style ownership and dimension evidence

Date: 2026-09-12. Base: `b42ead6f9ab420d548df1f8cd363f2de9b2569f5`.

## Owner decisions

- Keep the new UI skin and automatic portrait/landscape layout.
- Keep the QA grant; restoration of normal progression is deferred to the Owner.
- Keep original calendar/content distinctions and paper letters. Unify their
  surrounding frames, type and controls. This was explicitly confirmed during
  this review; a pale content material is not automatically obsolete theme.
- The supplied private art pack is reference evidence, not a runtime import.

## Dimensions: which source answers which question

| Question | Current authority | Meaning / restriction |
|---|---|---|
| Original display size | Art pack `01_UI/use-ready-hd4x-scenes/scenes/52-today-window-calendar-main-scene-nxr.json`, `sourceScreen` | 256 × 192 per screen. Stacked screens are 256 × 384, **2:3**, not 9:16. |
| HD witness size | Art pack `01_UI/use-ready-hd4x-scenes/README.md` | Nearest-neighbour 4× witnesses aid inspection; their PNG pixel dimensions are not CSS dimensions. |
| Earlier portrait reference layout | Same README / per-scene `portraitContract` | 1080 × 1920, 1080 × 810 semantic zones, scale 4.21875, y=150/960. This is a reference composition, not original game geometry or a requirement to stretch the current ranch. |
| Missing original placement | Scene 57 `training/mail_win_scene.nxr`, `sourceScreen.role` | `UNKNOWN_REQUIRES_TRACE` stays unknown. Do not invent a source-screen assignment from its current Web location. |
| Ranch coordinate transform | `src/championship/presentation/intRh2/raisingFieldViewport.js` | Existing world dimensions and native scale; Q12 positions divide by 4096. The camera fits a 256-native-pixel window where applicable. Art and pointer conversion share the transform. Never replace this with CSS panel size. |
| Portrait shell width | `intRh2Styles.css`, `.int-rh2-shell` | `width: min(100%, 430px)` is a Web layout choice. It is not a source-world width. |
| Ranch outer frame | `nativeUiSkin.css`, `.int-rh2-root .int-rh2-field-frame` | 4:3 is the current presentation frame. At max-height 700px it becomes flexible; landscape overrides also use `aspect-ratio: auto`. Do not force the game world into 4:3. |
| Automatic landscape | `nativeUiSkin.css`, `(orientation: landscape) and (max-height: 600px)` | Existing Owner-approved mobile layout. Tablet/desktop retain their existing treatment. |
| Short title screen | Same file, `(max-height: 550px)` | Keeps the repaired title controls clear of the notice. |
| Battle field shape | `vs5Styles.css` and `presentation/vs5/createBattleFieldPixiPresentation.js` | 9:16 Web shell and 37.5% band accommodate current 3:2 art. These are authored presentation proportions, not proof of original arena/camera geometry. Preserve fitting and letterboxing. |
| Shared bars / safe area | Existing shared status bar/toolbar and `--cm-status-bar-height`, `--cm-toolbar-height` | Measure mounted controls through the existing authority. Do not create a second hard-coded reservation for every screen. |
| Button hit areas | Existing contracts / per-component CSS | Keep current minima and verify actual rectangles. This pass checks letter acknowledgement at 86 × 44 CSS px; it does not claim every control is 44px. |

The private reference root is
`R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK`.
Relevant scene records include 52 (calendar), 57 (mail), 58/59 (schedule), and
89 (shared info bar). Inspected witnesses include
`today_window__today_window_obj_sub__cells.png` and
`training__schedule_obj_main__cells.png`. Their seasonal labels / date material
support preserving distinctions; they do not prove the current entire CSS
calendar is pixel-identical to the original.

## Shared appearance

`nativeUiSkin.css` owns the new palette and reusable window/action materials:

- `--ds-window-fill`, `--ds-window-frame`: common panel fill and gold/dark frame.
- `--ds-action-fill`, `--ds-action-ink`: existing gold action treatment.
- `--ds-calendar-date`: retained grey date material.
- `--ds-paper*`: retained paper, ink and ruling; content-specific, not fallback UI.
- Existing `--ds-slot*`, `--ds-rim`, `--ds-text*`, `--ds-font` remain authoritative.

The day-end prompt and system mail use the common window material. Paper mail
keeps its contents; its acknowledgement shares the real Raising system-button
rule, including disabled/focus/hover treatment. The calendar retains all four
season states and its today/count markers, with the shared outer framing.

The shared mode label no longer receives three competing old backgrounds.
Layout padding/reserved border width stays in the existing layout sheets.
Registered/won schedule states now live beside the base/selected schedule
appearance in the skin. Selection still takes precedence when a row is selected.
The Gate host uses the existing green/dark palette; no earth model, camera,
selection mapping, fee or world coordinate was changed.

## What the earlier measurement cannot prove

`.tmp/css-deadweight.cjs` is a useful search aid, not a deletion authority:

1. It treats the last matched declaration with an identical property name as
   the winner. That does not evaluate shorthand resets/longhand interactions,
   `!important`, inherited declarations, inline styles, or pseudo-element rules.
2. Its key is selector text + property, so separate rule occurrences and media
   contexts collide. It is not a source declaration identity.
3. Only matched declarations are counted; unseen components are not a complete
   denominator. Visit labels are appended without verifying the destination,
   and navigation failures are caught and ignored.
4. The actual harness has 11 visits × 4 sizes = 44 labels, not 14 × 4.
5. Even exact pixels at sampled states do not prove unseen states are safe.
   A transparent reset or an inherited colour can be necessary. Old-file
   ownership alone does not make a colour obsolete.

No removal was made from its 1,136-candidate list as such.

## Conservative deletion rule used here

For every removed declaration, every selector-list branch must have an identical
selector and property in a later rule, under the same conditional context or
unconditionally. Important and custom declarations are excluded. No selector
containment guesses, viewport coverage guesses, or shorthand-to-longhand
equivalence guesses are used. The existing production load order is an explicit
precondition. Historical fixtures loading only one old stylesheet are not full
product appearance baselines.

This establishes 280 redundant declarations across eight files. A separate
cleanup removes six empty rules. Geometry declarations and media conditions
remain. See `UI_THEME_PRUNE_RECEIPT_2026-09-12.json` for source-position witnesses.

The isolated deletion stage compared all computed standard CSS properties,
element rectangles and `::before`/`::after` styles on seven frozen real DOM
states at 390×844, 360×640, 740×360 and 844×390: 28 comparisons, zero differences.
Frozen DOM excludes live canvas pixels and timing. Subsequent intentional
frame/theme edits are reviewed separately and are not claimed pixel-identical.

Use raw Git CSS for baselines. In this browser, serializing CSSOM `cssText`
lost a `font` shorthand containing a custom property; that initially produced
four artificial stock-badge differences. Switching to the actual Git source
removed them. Do not use the broken serialization as a new product baseline.

## Repeatable state review

The fixture `tests/fixtures/championship-ui-state-review.html` renders the real
Raising DOM view with controlled presentation inputs and no save/app/renderer:

- `?case=calendar&season=0` through `season=3`: eight days, today, registration counts.
- `?case=mail`, `?case=system-mail`, `?case=mail-wait`: paper/system/waiting variants.
- `?case=confirm`, `?case=save-error`: day confirmation and failed-save display.

These are appearance cases, not evidence that their input conditions occur in
the original game. Acknowledgement controls call the existing view intents.

## Remaining debt / migration rule

The whole cascade is **not flattened** by this bounded pass. Root-qualified skin
overrides and legacy fallback declarations still exist. Do not drop their
specificity until their matching contexts have been audited. For each next
component, put default/selected/disabled/focus/error states under one appearance
owner, remove replaced declarations, then compare affected states and media
branches. Unknown or unsampled rules remain; do not pursue a zero legacy-colour
counter by erasing valid content materials or structural fallbacks.

Do not delete `intRh2Styles.css`, `vs2Styles.css` or the other files wholesale.
The source evidence, game rules, Web geometry, and UI material have separate
authorities. This document resolves their ownership; it does not claim full
original parity, physical-device acceptance, or publication.
