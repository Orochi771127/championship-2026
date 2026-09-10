# BM00/BM01 Battle pilot art direction

Status: **Owner-directed internal Pixi review passed; not runtime or shipping promoted**

## Game frame

- Player fantasy: direct a readable three-versus-three creature battle in a bright, welcoming modern arena.
- Core visual job: keep six combat silhouettes and their VFX legible while the arena retains a distinctive place identity.
- Renderer target: layered PixiJS 2D through the existing application boundary after approval.
- Target platforms: portrait web/mobile.
- Camera: slightly elevated three-quarter view; wide arena framed inside one portrait screen.
- Contract viewports: 360×800, 390×844, 393×852, 412×915, and 430×932.

## Visual system

- Shape language: broad oval playfield, low curved boundary, asymmetric upright stone fins, large quiet central masses.
- Silhouette priority: six actor zones remain low-detail and value-controlled; outer decoration carries the texture.
- Palette roles: sky `#54BCEB`, leaf `#79AD3C`, mint `#B9D878`, warm limestone `#D6CCAA`, sunlit gold `#C49A3C`, cyan energy `#28C7D8`, deep neutral `#191F25`.
- Materials: clean cel-shaped stone and metal masses with restrained hand-painted wear; soft natural grass and distant atmospheric hills.
- Edge treatment: crisp HD antialiasing, slight hand-drawn variation, no pixel stair-stepping.
- Lighting: bright late-morning key from upper left; readable midtones and soft contact shadows.
- Detail hierarchy: distant valley and outer foreground are detailed; the central ground plane remains quiet.
- Explicit exclusions: ROM pixels/palettes/tiles/cells/geometry, Battle UI, text, logos, creatures, people, franchise symbols, photorealism, pixel art, 3D-render appearance, excessive bloom, and invented animation timing.

## Layer contract

| Layer | Production ID | Contents | Must not contain |
|---|---|---|---|
| BM00 canonical shared | `production:battle:shared:field-bm00-00` | reusable arena boundary, foreground plinths, cyan insets, subtle standing rings | grassland backdrop, sky, hills, field-specific scenery |
| BM01 arena | `production:battle:arena:field-bm01-01` | grass floor, valley, hills, shrubs, trees, sky, clouds | copied BM00 payload, UI, actors, VFX |

BM01 depends on BM00 by manifest ID. The shared pixels exist once in the candidate package and are not duplicated into the BM01 file.

## Technical contract

- Review-master dimensions: 1536×1024 (3:2).
- BM00 alpha: straight RGBA PNG; transparent RGB is zero.
- Standing rings: three exact mirrored pairs about `x=768`; rear/middle/front sizes increase through deterministic build coordinates, not generated placement.
- BM01 background: opaque RGB PNG.
- Colour space: sRGB.
- Filtering: linear at runtime; no mipmap decision until isolated Pixi QA.
- Camera framing: fit width inside the five portrait viewports; no baked UI or permanent portrait crop.
- Promotion: requires linked licence evidence, Owner visual approval, and isolated runtime QA as three separate verdicts.

## Visual target

- Candidate: `review/visual-target-candidate.png`.
- Composite check: `review/bm00-bm01-composite-candidate.png`.
- Alpha check: `review/bm00-alpha-checker-candidate.png`.
- Native viewport check: `review/viewport-390x844.png` plus the other four contract viewport files.
- Approval owner/date: Owner directed continuation after ring alignment, 2026-09-01.
- Runtime QA receipt: `docs/reports/art/battle/bm00-bm01-r1/browser-qa.json` — five viewports passed on the existing single Pixi stage.
