# Battle menu cube — four-panel production v1

Date: 2026-09-05. Owner request: 繼續開工立方體的四面美術跟貼圖。
Repository: championship-2026, branch main, baseline HEAD d0c48f340baac61cf399bf5bd5922ce58f3d38c7.

The four original-created Chinese panels are integrated into the existing bounded Battle Select Three.js presenter. This batch is implemented and browser-verified; human visual approval and shipping approval remain pending. No commit, push, merge or deployment was performed.

## Delivered artwork

| Face ID | Label | Authored motif | Runtime texture |
|---|---|---|---|
| CHAMPIONSHIP | 冠軍賽 | Gold crown | championship.png |
| TITLE_MATCH | 頭銜賽 | Copper shield and star | title-match.png |
| FREE_BATTLE | 自由對戰 | Cyan crossed emblem | free-battle.png |
| LINK_BATTLE | 通訊對戰 | Green linked rings | link-battle.png |

Runtime root: `assets/production/battle/menu-cube-v1/`. Each texture is 512 × 512 PNG, sRGB. Total encoded size: 644,968 bytes; budget: 768,000 bytes. Four RGBA textures including mipmaps consume approximately 5.33 MiB before renderer overhead. Device pixel ratio is capped at 2, anisotropy at 4.

This directory contains twelve editable SVG layers (background, emblem, label for each face), four composite SVG masters, and `contact-sheet.png`. The repository-native UI builder rasterizes them using Chromium and the installed Microsoft JhengHei font; no font binary is redistributed. Rebuilding on another OS/font/Chromium version may alter rasterization and hashes. The manifest records each output hash and size.

Asset ID: `art:battle-select:menu-cube:v1`. The canonical production index registers the manifest. The A0 generator preserves this entry on rebuild and propagates explicit runtime eligibility from manifests. The launcher13 crosswalk record has a `boundedRuntimeReplacement` link; the complete source record remains unresolved because this panel pack covers only the requested subset.

## Evidence boundary

Research source: decoded structure of `battle_menu/launcher13.nsbmd`, source SHA-256 `ea0cb0f6da5998d94b5ef870899ff149777de1bbad487dcd5975f7a5ac6e7157`.

The source contains `_02_champ`, `_03_title`, `_04_free`, and `_05_tushin` material groups. It ALSO contains `_06_password` and `_07_rensyu`; the current four-panel delivery does not establish that the original menu has only four identities. Original face orientation and the meanings of `_l`/`_u` remain UNKNOWN_REQUIRES_TRACE.

The palette, motifs, proportions, Chinese translations, background/emblem/label split and face orientation are PRODUCT_AUTHORED. No source pixels, textures, geometry or font payloads are copied. The runtime imports production assets only and has no research-path dependency. This is not an exact-original-visual-parity claim.

## Integration and lifecycle

- Existing app route: Raising Home → system menu → Battle.
- `main.js` injects `BATTLE_MENU_LABELS` into the existing DOM view; `vs5Screens.js` retains its dependency-free view boundary.
- The existing Three.js presenter loads four textures asynchronously and draws only when loading, dragging, keyboard rotation, resize or context restoration requires it. There is no animation loop or additional ticker.
- Dragging and left/right arrow keys rotate the cube. Chinese DOM controls remain at least 44 CSS pixels high.
- A failed texture retains the colored face and DOM label. If WebGL construction fails, the four production panels appear as DOM image buttons.
- Exit disconnects resize observation, removes event listeners, disposes textures/materials/geometry/renderer, and removes the canvas. Late texture resolutions dispose themselves; late failures cannot restore a disposed host attribute.
- Existing selection callback and `available` set remain authoritative. The actual app currently supplies an empty available set, so the four mode buttons are disabled. The existing available-match list remains usable. No mode filtering, save state, rewards or gameplay rules were added.

## Localization status

The whole game is NOT fully localized. This batch adds Chinese battle-menu headings, guidance, return label and all four face labels/art. The existing cage names/effect text and gate translations are partial coverage, not a global localization completion claim.

Confirmed remaining examples: shared status strings such as SPRING / DAY / BATTLE, source match titles such as MATCH 00 from `battleRuntime.js`, English battle feedback in `vs5Screens.js`, and untranslated source Japanese species/help data. No global percentage is reported because a complete visible-string inventory has not been performed.

## Validation

- Focused battle/art/text tests: 35 passed, 0 failed.
- Full regression: 835 passed, 0 failed, 0 skipped.
- A0 generation/validation: 1,248 source records; 19 registered runtime bundles; 95 complete-source records ready for runtime; zero shipping-ready bundles. The new partial cube replacement does not falsely increment complete-source readiness.
- Browser QA: Chrome desktop emulation at 360×800, 390×844, 393×852, 412×915 and 430×932, DPR 2; all four textures ready, no horizontal overflow, controls at least 44 pixels.
- Passed: keyboard rotation, pointer drag, injected selection callback, blocked texture fallback, late-success/late-failure disposal race, WebGL-unavailable fallback, real app entry/exit/reentry, no duplicate cube canvas and no uncaught page errors.
- Manual screenshot inspection: all four face directions show upright Chinese labels; contact sheet and real app screenshot checked.
- Physical-device performance and human visual approval: not performed.

Browser evidence and machine report: `docs/reports/battle-cube-v1/`; full regression output: `regression-tests.log` in that directory.

## Reproduce

From the repository root, with dependencies installed and Chrome available:

```powershell
npm run art:battle:cube:build
npm run art:a0:build
npm run art:a0:validate
node --test --test-reporter=spec tests/championship-battle-cube-art-cases.mjs tests/championship-battle-runtime-cases.mjs tests/championship-battle-field-scene-cases.mjs tests/championship-zh-hant-text-cases.mjs
node --test --test-reporter=spec tests/*.mjs
```

Browser QA expects the existing local server at `http://127.0.0.1:8732`. Set `CHAMPIONSHIP_QA_ORIGIN` if using another port; set `CHAMPIONSHIP_CHROME` if Chrome is installed elsewhere.

```powershell
npm run test:browser:battle-cube
git diff --check
```

Next safe work: inventory visible untranslated strings and translate through existing text injection boundaries; separately trace original battle menu mode-to-match bindings before enabling those mode buttons.
