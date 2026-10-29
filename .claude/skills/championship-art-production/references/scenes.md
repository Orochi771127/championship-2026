# Cage, hunt and battle scenes

## Cages (ranch)

- Look, seams, bridges and shop cards: the [hd2d-cage-world](../../hd2d-cage-world/SKILL.md) skill.
- Ground: [cage ground standard](../../../../docs/art/production/ART_PRODUCTION_CAGE_GROUND_STANDARD_ZH_TW.md).
  GLBs change only through its archived pipeline, never by hand.
- Walkable tiles come from `src/data/championship/catalogs/raising-ground.r1.json`.
  Residents are drawn on top of the scene, so tall scenery sits only on
  non-walkable tiles and floors stay at height 0.
- Structures rest on land: a bridge's ends sit on ground; sky and clouds only
  in the gap a structure spans.
- Ranch hexes tile without gaps; extra boards continue the honeycomb.
- Replacing a cage, battle or hunt picture: follow
  `ART_REFERENCE_LIBRARY/REPLACEMENT_SPEC/README.md` (workspace root) and its
  `SPEC_CAGES.csv` / `SPEC_HUNT.csv` / `SPEC_BATTLE.csv` for exact size, frame
  timing and walkable guide images. The spec is a measurement guide; its
  reference pictures are research only.

## Hunt

- 3D map, 2D characters. The camera elevation belongs to each map: read
  `projection.elevationDegrees` from its manifest (51°, 52° and 55° are all
  in use) and produce art against that angle, never a blanket value.
  `projectionForManifest()` in `presentation/vs2/huntThree/projection.mjs`
  picks the projection.
- Caves are `escapeAnchor` pairs; depth occluders live in the actor layer.
- QA needs the review flag noted in the hunt status record; canvases expose
  `canvas[data-hunt-three]`.

## Blender

- Blender 5.2, headless and scripted: `blender -b --factory-startup --python <producer>.py -- …`.
  Producers live in `scripts/` and `scripts/lib/cage_*_authoring.py`. Use the
  GPU (OptiX) for renders.
- Every scene asset comes from a script that can be rerun; hand edits in the
  Blender UI are for inspection only.
- Lighting stays consistent across a set: one warm key, one cool fill or
  hemisphere, emissive only on materials that glow in the story (lava, neon,
  screens).

## Gates

- `npm run test:ci`, plus the cage and hex tests named in hd2d-cage-world.
- Browser on the isolated port: place, merge, walk and save; confirm
  `passageThresholds` equals `navigationConnections`; no console errors.
