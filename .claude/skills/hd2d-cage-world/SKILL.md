---
name: hd2d-cage-world
description: HD-2D look for the 36 ranch cage GLBs, series connectivity between cages, the beach water and edge falls over the data sea, and the shop cage cards. Use when changing how a cage looks or moves in the 3D ranch, which cages join into one area, what is drawn on a shared or outer edge, or the shop's 籠子設施 cards. Never applies to the title, logo, main menu or opening.
---

# HD-2D cage world

Owner direction 2026-10-27. Look enhancements happen at load time in Three.js
memory. Since 2026-10-28 the ground of a cage follows the
[cage ground standard](../../../docs/art/production/ART_PRODUCTION_CAGE_GROUND_STANDARD_ZH_TW.md):
GLBs change only through its archived pipeline, never by hand. The title,
logo, main menu and opening stay exactly as live main shipped them.

## Where things live

| Concern | File |
|---|---|
| Cage GLBs (baked atlas, Draco, ground map) | `assets/production/cage/three-20261021/field_cmXX_01.glb` — rewrite only through the ground pipeline |
| Blender pass that produced them | `R:\Projects\Championship2026\cage-diorama-20261025\` (texel AO + ground repaint, 2026-10-26) |
| Ground pipeline (2026-10-28) | `R:\Projects\Championship2026\cage-ground-20261028\scripts\` (`ground_scan`, `ground_map`, `ground_pack`, `finalize_install.sh`) |
| Ground map at runtime | `src/championship/presentation/cageGroundMap.js` |
| Runtime shader enhancer | `src/championship/presentation/cageHd2dEnhancer.js` |
| Scene wiring, lights, shadows | `src/championship/presentation/ranchThreeScene.js` |
| Series groups (which cages join) | `src/championship/cage/ranchEcology.js` → `RANCH_ECOLOGY_GROUPS` |
| Shared edges and passages | `src/championship/cage/ranchConnections.js` (`ranchSharedBoundaries`) |
| Plinth, closed rims, open seams | `src/championship/presentation/ranchPlinth.js` |
| Edge falls (water, lava, icy water, sand), beach seam strips | `src/championship/presentation/ranchWaterfalls.js` |
| Beach coast pipeline (2026-11-02) | `R:\Projects\Championship2026\cage-coast-20261102\scripts\` (`bake_coast`, `make_groundmap`, `sea_mask`, `pack_coast`, `install_batch`, `cage_falls`, `update_contracts`) |
| 10/06 showcase masters (the deleted 10/06 field art came from these) | `docs/art/production/original-character-cage-r1/cage-base3d-v1/opm-opus-r*/seam-v3/fields/field_cmXX_01/master.blend` (untracked; copy on `D:\Championship2026-backups\cage-opus-masters-20261102\`) |
| Shop cage cards | `src/championship/app/vs4Screens.js` (`decorateShopCageCard`, `cageSeriesLabel`), `ui/screenLayout.css` |
| Shop, editor and location pictures (renders of the 3D cages) | `assets/production/public-runtime/cage-ui-three.v1.json` → `src/championship/presentation/cageUiArt.js` |

## Enhancer rules

- Themes come from the cage definition index (`THEMES_BY_DEFINITION`): lava,
  water, neon (+flicker for the power plant), crystal, snow, fog, foliage,
  sports, spotlight. Masks are read from each texel's own colour, so no new
  texture or geometry is loaded.
- One shared `uHd2dTime` uniform; one program variant per theme set
  (`customProgramCacheKey`). Each material is hooked once
  (`userData.hd2dHooked`), across clones.
- Hooks the scene already installed run first. Materials the scene animates
  itself (authored lava, water, wind) take only the static themes (sports,
  spotlight, fog), so motion is never doubled.
- Saver quality and software GL (SwiftShader, llvmpipe: `canvas[data-software-renderer]`)
  skip the enhancer; reduced motion holds time at 0 (colour and
  glow stay, motion stops). The render loop already pauses while
  `document.hidden`.
- A string with a newline inside shader text must use `\n`, never a raw line
  break: a syntax error drops the whole ranch to the 2D fallback
  (`CHAMPIONSHIP_RANCH_3D_FALLBACK`). Run `node --check` on the file.

## Ground rules (new or changed cages)

- One plate; zones live in the ground map, never in sheets stacked on the plate.
  Markings are their own geometry and never occlude the ground's contact shadow.
- Raised ground (stage, podium, pool rim) has walls, curbs or slopes.
- The ground map hook runs in every quality tier, after every authored hook and
  before the enhancer; `getDiagnostics().groundMapsHooked` must equal the cages
  that declare one.
- A geometry edit keeps kept vertices bit-exact and remaps support triangles
  and `tests/fixtures/ranch-v4/*-triangle-remap.json` by exact position.

## Series and bridges

- Matrix (`RANCH_ECOLOGY_GROUPS`): sports 小運動場/運動場/競技場; gym
  小健身房/健身房/道場/擂台; infirmary 小保健室/保健室/醫院/溫泉; garden
  小花園/花園/寺廟/神殿; volcano 小火山/火山; beach 小海灘/海灘; mountain
  小高山/高山/洞窟; grassland 空地/草原/牧場/動物園; forest 森林/叢林; desert;
  snowfield. Anything else joins only its own kind. Changing a group changes
  walking, the editor's ✨ preview and the shop tag together; update
  `tests/championship-hex-builder-cases.mjs` when you do.
- Owner 2026-11-02 (replaces the 10-27 rule): cages of one series at one
  height join into one map. Their shared edges show no border in the ranch and
  no rim or exit chevron in the facility editor, whether or not a passage
  opened. A border (low rim) stays only between different series or heights.
- Partners still cross only where the walk rule opened a passage (same series,
  same height, safe exits on both sides); the editor's bridges show those.
- On a joined edge the authored rim and fence strip dissolve and nothing else is
  drawn: the two cages' own floors meet. Owner 2026-11-01 removed the painted
  seam-bridge strips (they read as a plaster stuck on the floor); do not add a
  painted strip, patch or threshold back. The only exception is the beach seam
  strip (`createRanchWaterSeam`): it is drawn in the beach's own material, so it
  shows exactly the water around it and closes the joint's hairline gap.
- `canvas.dataset.passageThresholds` counts open passages;
  `navigationConnections` counts the walk rule's passages. They must agree.

## Data sea, beaches and edge falls (Owner 2026-11-02)

- The ranch is islands floating over a data sea: the purple background stays and
  the ranch ambience theme is `datasea` (sideways glints that twinkle, a teal
  glow from below). There is no sea plane at ground height.
- 海灘 and 小海灘 follow their 10/06 showcase masters: the coast lives in the
  ground map's alpha (A = 1 dry land; `water: { h0, edges }` on the spec), and
  the shader paints the showcase sea from it with world-space waves, so two
  beaches' waves run on across a seam. The finest wave bands fade with the
  camera's pixel size (`uCageGroundPixel`), never with derivatives: those jump at
  the floors' millimetre steps and drew a dotted line. 小海灘's island never
  reaches its own edge (`make_groundmap.py --island`).
- Where a cage's water, lava (火山, 小火山), icy water (冰原) or sand (沙漠, a few
  thin streams) reaches a free outer edge facing the camera, it pours over the
  rim, down the cliff and breaks into pixels: one merged mesh and one shader for
  the whole ranch, no texture. Lava, icy water and sand spans are measured on the
  exact GLB (`RANCH_CAGE_FALLS`, keyed by its sha256): a changed GLB pours
  nothing until `cage_falls.py` measures it again.
- 小高山's floor is the 10/06 stone summit again (ground map), not sky.
- Walking is unchanged: a beach's sea tiles were already walkable game data.

## Mobile budget

- `cappedPixelRatio <= 1.75`; mobile shadow map 1024.
- Share materials and geometry; never clone a material per placement just to
  vary a uniform. New textures only as small canvases, disposed with the
  plinth.
- Check `canvas.dataset.drawCalls`, `triangles` and `textureCount` before and
  after a change on a full ranch.

## Shop and editor pictures (Owner 2026-11-02)

- The shop cards and detail, the facility editor board and tray, the empty-land lid
  and the companion location marker all show renders of the 3D cage GLBs: the
  production renderer at the layout view (52°), 4 px per native px, framing each
  field's world rect exactly as the old field art did (no plinth, transparent).
  Thumbnails fit the whole frame into 256×192, centred (the 10/08 shop rule).
- Each row records the GLB sha256 it was rendered from;
  `tests/championship-cage-ui-three-cases.mjs` fails when a GLB changes, so render
  again: `cage-ui-render.html` (local review page, 37 fields) then
  `pack_ui_three.py` (both in `cage-coast-20261102\scripts\`), then restate the
  contracts. The public manifest may not carry `ownerDirection` or other private keys.
- The public `cage-ui` map is projected from the same renders
  (`assets/production/cage/ui-three-20261102/manifest.json`, map recipe role
  `cage-ui`). It is the only cage map role: the 2D ranch (used when the 3D one
  cannot start) loads it on every host. The 10/06 Blender field art, the 10/08
  shop thumbnails and intake, and the 10/19 polish set with its foreground,
  ambient, shared-edge and sports-park layers were deleted on 2026-11-02 (Owner);
  do not bring them back. `tests/fixtures/cage-padded-intake-20261008.manifest.json`
  keeps only the padded-field numbers for the loader tests.

## Shop cage cards

- Keep `.cm-vs2-shop__row`, `[role=option]`, `aria-selected`,
  `data-selected` and the meta line; tests read them. Add, never rename.
- Card adds `data-cage-card`, `data-cells`, a footprint badge
  (`.cm-vs2-shop__cells`), a series tag (`.cm-vs2-shop__series`) and an
  effect capsule (`.cm-vs2-shop__effect`, from `cageUiSummary`, which
  includes 建議 N 隻).
- The list keeps a bottom gutter so 返回牧場 never covers the last row.
- New copy goes through `uiText` with en/ja/th/vi entries.

## Verification

- `npm run test:ci`.
- Browser on the isolated QA port (never 8732): place 小運動場 next to
  運動場 and 小火山 next to 火山 in the facility editor, return to the 40°
  ranch, confirm `passageThresholds` equals `navigationConnections`, no
  console errors, and no rim or line on any same-series seam (also 海灘 next to
  小海灘, where the walk rule keeps some edges closed) at 390×844 zoomed out.
- Shop 籠子設施 tab in desktop 1366×768, portrait 390×844 and landscape
  844×390: no horizontal scroll, last row clear of the footer.
- Title zero-diff against live main.
