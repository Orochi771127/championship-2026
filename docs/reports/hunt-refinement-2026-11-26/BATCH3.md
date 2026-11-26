# Batch 3 — water that moves (hm05, hm06, hm11, hm13, hm17)

2026-11-26. Third batch of `PLAN.md`.

## What changed

The water of five maps was a still picture. It now carries short light dashes that slide slowly
along the screen horizontal and twinkle — the usual drawn-water glint.

| Map | Surface (GLB material) | Style |
| --- | --- | --- |
| hm05 黏滑沼澤 | `Swamp water patch surface` | murk: sparse, slow, pale green |
| hm06 波浪海岸 | `Static water patches` | sea: longer, brighter |
| hm11 下水道路 | `HM11 olive wet surface` | sewer: sparse, slow |
| hm13 雪之國度 | `HM13 blue open water` | cold: sparse, faint |
| hm17 澄澈綠洲 | `HM17 oasis water static source-phase appearance` | clear |

- No new assets, no extra draw call, no texture: the glint is computed in each water material's own
  fragment shader from the world position (`src/championship/presentation/vs2/huntThree/waterShimmer.mjs`).
- The dashes are laid out in world px along the map's own projection, so they are the same size
  and run level on the 55-degree and the 52-degree maps.
- Light is only ever added; with the amount at 0 the picture is exactly the delivered one.
- Off (amount 0, clock stopped) in saver quality and with reduced motion, like the ambient layers.
- Night fields use 60 % of the amount.
- Not touched: hm15 lava (already swaps phase pictures), the pre-baked hm01 and hm08 (their water
  is in the baked frames), and water that is painted into a map's ground texture.
- If a Three build does not have the two shader anchors, the material is left as it is and the
  diagnostics count it as skipped (`threePilot.water`).

## Checks

- `tests/championship-hunt-water-shimmer-cases.mjs` (7 cases): every named material exists exactly
  once in its GLB; the shader patch on the standard, lambert, basic, phong and toon shaders; the
  basis equals the map projection; only the water material is touched and an earlier compile hook
  still runs; saver / reduced motion; night amount; maps without water; wiring and cleanup.
- Browser, Chromium, desktop 1280 x 800 and phone 390 x 844, camera moved onto the water of each
  map: Three active, shader patched on all five (`patched 1, skipped 0`), no page or shader errors.
- Reduced motion (oasis, seaside): `moving false`; two frames 1.4 s apart differ only by the
  partners (1.9 % of pixels, the same as without water in view).
- First attempt, rejected before commit: crossing sine ripples read as polka dots. Replaced by the
  dash pattern.
- Not measured on a real phone. The cost is a few arithmetic operations per water pixel.

## Pictures

- `batch3-phone-five-maps.jpg`: swamp, sewer, oasis, seaside, ice at phone size (night fields
  except sewer and ice). The pale blocks on the ice map are the map's own thin snow, not the glint.
- `batch3-oasis-still-vs-moving.jpg`: reduced motion (left) and normal (right).
