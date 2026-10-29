# Characters, anchors, facing and cameras

## Pixel characters

- Original grid pixel art, chosen by the Owner over HD hand-drawn art
  (OWNER_DIRECTION 2026-09-06). Editable indexed masters, one shared normal
  palette of at most 15 visible colours plus transparency. Plan and queue:
  `docs/art/production/characters/appearance-refresh-v1/pixel-v2/`.
- Native size comes from each character's record; scale only by whole numbers
  with nearest-neighbour sampling (`image-rendering: pixelated` in DOM,
  `scaleMode: 'nearest'` in Pixi). Never resample to a fractional size.
- Roster and runtime folders: `src/championship/presentation/completedOriginalCharacterCatalog.js`
  and the species catalogs under `src/data/championship/catalogs/`. Read the
  count from the catalog; do not hard-code it.

## Frames, anchors and facing

- Draw one frame at a time through the existing loaders (Pixi textures with a
  frame rectangle, or the DOM sprite players in `presentation/juicy/`). Never
  show a whole strip or sheet on screen.
- Anchors are data: `anchor`, `pivot`, `nativeAnchorX/Y` in the character and
  manifest JSON, `escapeAnchor` pairs in hunt maps. Do not invent new anchor
  names; extend the existing records and their tests.
- Facing gate: every reviewed General (Main/Sub) clip and Data Arena clip
  (headings L R UL UR DL DR, drawn with the game's mirror policy) keeps each
  frame facing with its neighbours. Masks are pinned to manifest hashes:
  after any art change rerun `scripts/build-reviewed-action-masks.py`, review
  contact sheets with `node scripts/review-reviewed-actions.mjs`, and keep
  `tests/championship-reviewed-action-facing-cases.mjs` and
  `tests/championship-reviewed-general-facing-cases.mjs` green.
- Cut-in and showcase framing: `presentation/juicy/skillCutIn.js`,
  `codexShowcaseTheater.js` (see juicy-monster-ui). A role without its own
  motion keeps a still or the documented fallback; it never shows a broken or
  empty frame.

## Cameras and ground ratios

| Scene | Camera | Source |
|---|---|---|
| Ranch | World laid out at 52° (`RANCH_ELEVATION`); view locked at 40° (`RANCH_DEFAULT_VIEW_PITCH`, Owner 2026-10-27) | `presentation/ranchThreeCoordinates.js` |
| Hunt | 3D map, 2D characters; elevation is per map, from the manifest's `projection.elevationDegrees` (currently 51°, 52° or 55°) | `presentation/vs2/huntThree/projection.mjs` (`projectionForManifest`); 55° maps use `hm02Projection.mjs`, which rejects any other angle |

- Changing the ranch pitch only changes the view: ground scales vertically by
  `sin(pitch) / sin(52°)`, heights by `cos(pitch)`, sprites stay upright.
  `tests/championship-ranch-view-pitch-cases.mjs` must stay green.
- Ranch contact shadow (PR #131): an ellipse behind the nearest foot (40% of
  its depth in front), depth = half width × sin(40°) × 0.86, capped at 0.35 of
  the drawn height; hovering frames keep a smaller, lighter shadow on the
  ground. Per-species lower-body centre and width:
  `src/data/championship/raising-contact-footprints.v1.json`; code:
  `presentation/intRh2/raisingFootprintShadow.js`.
- Ground marks (shadows, selection or team rings) are drawn under the
  character: shadow, then ring, then sprite. A ring never covers the body.

## Item and portrait art in UI

Eggs, items and portraits shown in DOM cards keep their own pixels: no CSS
filters that recolour the art, no stretching, whole-number scaling for pixel
art. Frames and backgrounds come from the theme tokens (visual-language.md).
