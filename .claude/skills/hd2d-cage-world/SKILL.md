---
name: hd2d-cage-world
description: HD-2D look for the 36 ranch cage GLBs, series connectivity and seam bridges between cages, and the shop cage cards. Use when changing how a cage looks or moves in the 3D ranch, which cages join into one area, what is drawn on a shared edge, or the shop's 籠子設施 cards. Never applies to the title, logo, main menu or opening.
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
| Themed seam bridges | `src/championship/presentation/ranchSeamBridges.js` |
| Shop cage cards | `src/championship/app/vs4Screens.js` (`decorateShopCageCard`, `cageSeriesLabel`), `ui/screenLayout.css` |

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
- A passage opens only where the walk rule opened it (same series, same
  height, safe exits on both sides). Never draw a bridge the walk rule did
  not open.
- On an open edge the authored rim and fence strip already dissolve; the plinth
  paves it with the series' ground (`ranchSeamBridges.js`): red clay with
  white lanes, a glowing lava vein, sand and shallows, moss, flagstones with
  flowers, gravel, snow, or an indoor mat with a lit guide line. One mesh and
  one 128×64 canvas texture per theme, feathered edges, `depthWrite: false`,
  just above the walk plane. It changes no walk surface, support or picking.
- `canvas.dataset.passageThresholds` counts open edges;
  `navigationConnections` counts the walk rule's passages. They must agree.

## Mobile budget

- `cappedPixelRatio <= 1.75`; mobile shadow map 1024.
- Share materials and geometry; never clone a material per placement just to
  vary a uniform. New textures only as small canvases, disposed with the
  plinth.
- Check `canvas.dataset.drawCalls`, `triangles` and `textureCount` before and
  after a change on a full ranch.

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
  console errors, and the bridge is visible on the seam.
- Shop 籠子設施 tab in desktop 1366×768, portrait 390×844 and landscape
  844×390: no horizontal scroll, last row clear of the footer.
- Title zero-diff against live main.
