# Native UI Skin R1 — original interface language, modernised

Date: 2026-09-12
Scope: **UI/HUD chrome only.** Scene, field and character art untouched.
Owner direction: "把原作的 UI/HUD 做回來，並在此基礎上現代化。"

## 1. The problem this pass fixes

The shipped screens had drifted into a light, generic mobile-dashboard look:
pale mint grounds, white cards, soft shadows, flat pastel buttons. None of it
carries the original's identity, and the Style Bible already names that failure
mode ("not a generic dark dashboard").

The original speaks one interface language and reuses it on every screen.

## 2. The five parts of the original interface

Read off the original's own screens (top screen of Training and Hunt) and the
decoded background/palette records in the research pack:

| Part | What it is |
|---|---|
| Ground | Cyan hexagonal tech mesh over a deep blue field, closing on a flatter blue band |
| Ribbon | A gold bar across the top, cut into angled segments; carries the season tab, the day, the mode name and the clock |
| Window | A gold band between two near-black lines, filled with desaturated dark green; a capsule title sits on its top edge |
| Slot | A readout row: **dark green inside, bright green rim**, a coloured label capsule at the left and the value at the right |
| Rail | Eight icon discs at the bottom — metal at rest, gold when chosen |

**The green rule.** The original is not a green interface. Green appears as
*rim* and as *label*, almost never as fill. Fill is reserved for the few things
you actually press. Getting this backwards is what makes a copy look wrong even
when the palette is right.

## 3. Palette

Sampled from the original's own screens, then nudged for a modern display
(slightly deeper blues, slightly less banded gold, one desaturation step on the
greens so large areas do not vibrate).

```
ground   #0b56e8  #0a68f2  #0b3bbe  #0a4a86      cyan #3ec6ff  #7fe9ff
ink      #061119
gold     #fff6a8  #ffdf46  #ffbe28  #f7931e  #c46a04
window   #2a5744  #1d4132  #10281d
slot     #14492c  #0d3520  #071f13     rim #46d62c
button   #7ae84f  #35b21c  #157c09
label    #6f7dff  #3a3fd6  #23219b
```

## 4. What "modernised" means here

Same palette, same geometry, same information order. What changed:

- two-stop gradients instead of the cartridge's banded ramps;
- one crisp rim instead of three stacked 1px outlines;
- soft ambient glow on rims and readouts, which the hardware could not do;
- real type with a subtle shadow instead of a hard 2px bitmap drop;
- touch-sized targets (44px+) and generous row gaps;
- the hex mesh drawn as two passes — a wide soft pass for the cell body and a
  fine pass for the edge — so it reads as lit glass, not wireframe.

## 5. How it is implemented

One file: `src/championship/app/nativeUiSkin.css`, linked last in
`championship.html`.

- Sections 1–4 are the kit (`.ds-ground`, `.ds-ribbon`, `.ds-panel`, `.ds-slot`,
  `.ds-pill`, `.ds-row`, `.ds-readout`).
- Section 5 re-dresses the class vocabulary the screens already use. **No rule
  adds a class, moves a node, or changes behaviour**, so the skin is one file to
  review and one file to revert.
- Selector weight deliberately mirrors the bright per-screen layers
  (`.cm-status-bar[data-screen]`, `.cm-toolbar[data-mode] .cm-toolbar__cell`,
  `.int-rh2-root .int-rh2-*`) so equal specificity plus later load order wins,
  without resorting to `!important`.

The one JavaScript change is a single attribute in `championshipToolbar.js`:
`button.dataset.icon`, which names the toolbar cell art. The label element stays
in the DOM and is visually hidden, so assistive technology is unaffected.

### Art provenance

- The hex mesh, ribbon, window, slot and capsule treatments are **authored CSS**
  — gradients and one inline SVG path. No ROM, decoded or reconstructed byte is
  loaded or shipped.
- The toolbar icons are the existing approved runtime set,
  `assets/production/toolbar/licensed-runtime-v1/` (`runtimeEligible: true`,
  `humanApproved: true`). They were already in the repository and unused; this
  pass puts them on screen, which is what the original does.
- `xmlns` inside the data URI is percent-encoded, matching
  `raisingHomeHud.css`. It is an XML namespace name, never fetched, and the
  migration firewall refuses a bare scheme in runtime source.

## 6. Screens covered

| Screen | State |
|---|---|
| Status bar (all screens) | Gold ribbon, pale season tab, amber mode, outlined clock |
| Toolbar (all screens) | Eight icon discs, gold when chosen, stock chip |
| Toolbar submenus | Framed window; entries are slots, only End Day / Save gold |
| Title | Mesh ground, capsule choices |
| Raising Home HUD | Framed companion window, dark vitals slots, gold field frame |
| Digimon roster | Done |
| Schedule / championship board | Done |
| Tamer info | Done |
| Help | Done, with the headings rebuilt as gold bars |
| Cage edit (facility layout) | Done |
| Shop | Done |
| Database / encyclopaedia | Done, on the original's **green** world |
| Gate select | Done, on the original's **green** world with silver chrome |
| Hunt loadout | Done, gold label + green value rows |
| Hunt field HUD | Done, including the hint chips |
| Battle select | Done |
| Battle field HUD | Styled, **not yet seen in a live match** |
| Battle result | Styled, **not yet seen in a live match** |

## 7. Three defects found and fixed along the way

1. **The habitat sat on a pale rectangle.** `createRaisingFieldPixiPresentation`
   painted `0xeaf2df` across the whole stage under the earlier bright
   direction. The stage is transparent (`backgroundAlpha: 0`), so the fill is
   now dropped and the framed mesh behind the canvas reads through. The ranch
   reads as a platform in the digital world, which is what it is.
2. **The opening overlay could leave a stale envelope outside the game.**
   `start()` hid the host but never cleared it, and `.cm-title__panel` was
   `min(100vw, 56.25dvh)` — wider than the 430px game column on a tall window,
   so anything it hosted sat outside the frame the player reads as the game.
   The host now clears on start and the panel is capped at the same 430px.
3. **Per-screen bright layers outranked the skin.** They are written as
   `.cm-status-bar[data-screen="X"]` and `.cm-toolbar[data-mode="1"] .x`. The
   skin now mirrors that weight exactly and wins on load order. No `!important`
   was used anywhere.

## 8. The research pack's scrambled sprite cells are recovered

`01_UI/native-decoded-reference/ui_sprite_cells/` was unusable — every preview a
field of diagonal colour streaks. Two separate decoder mistakes, both fixed.

**The storage layout was ignored.** Every RAHC was read as 8x8 character data,
and **838 of this ROM's 1588 character files are linear bitmaps** (RAHC flags
bit 0 set). Reading a linear bitmap as characters shreds each row into 8-pixel
chunks and walks them down the image.

**A linear file is not one image at one width.** It is the sprite's objects laid
end to end, each stored at the width that object declares. `training_set` holds
8x8, 32x16, 8x16 and 16x16 objects in one file and `menu_main` holds ten sizes,
so no single width can make either legible. The companion NCER has everything
needed instead: `mapping` gives the byte stride of one tile index (64 bytes
here), and each OAM object gives its size, offset, tile index and palette. An
object's pixels start at `tileIndex x 64` bytes and are read at its own width.
Nothing is guessed.

The arithmetic confirms the model: summing every object's pixels lands within 1%
of the character file's pixel count for each family checked.

`tools/decode_nitro_character_graphics.py --cells` (workspace root, outside this
repository, because its output is ROM-derived) cut **24,805 cell banks** from the
art tree. It recovers the eight care-tool icons, the hunt tools, the menu
capsules and digit font, the capture ropes, the facility thumbnails and the save
icon cleanly. Output lives in the research pack and must never enter
`assets/production/`.

## 9. Verification

- `npm test` — 1466/1466 pass, including the migration firewall.
- Every screen above was walked and screenshotted in Chrome at 430x880 by
  `.tmp/ui-walk.cjs` and `.tmp/ui-hunt.cjs`, the latter driving the intro
  through the repository's own `tests/championship-browser-opening.cjs` helper.
- The same walk dumps a duplication census (status bars, season chips, toolbar
  rails and cells) on every screen. All fifteen report exactly 1/1/1/8, so the
  doubled text seen in an Owner screenshot was a stale tab, not a build defect.
- `ui-skin-review.html` at the repository root renders the kit and six screen
  mocks for side-by-side review against the original.

## 10. Known gaps

1. The battle field HUD and the battle result screen are styled from the same
   tokens as everything verified, but a live match needs game progression that
   the review harness does not yet drive. They should be eyeballed once a match
   is reachable.
2. The ranch does not fill its frame. The fitted viewport is width-limited by
   the original's 256-native-pixel camera window, so it cannot be scaled up
   without cropping, and the ranch grows into the space as facilities are added.
   The space is now the mesh ground rather than blank white.
3. Nothing outstanding on the decoder: the OAM cell cut covers every family,
   including the three that mix object sizes.

---

# R2 — measured review, and the defects it found

Date: 2026-09-12
Owner direction: review every screen for proportion, size and highlight state,
then fix what the review finds.

## 1. How it was reviewed

Eyeballing screenshots does not catch a 30px touch target or a highlight that
never repaints. `.tmp/ui-review.cjs` walks all fourteen screens and **measures**:

- **proportion** — any element wider than the 430px game column, and any text
  whose `scrollWidth` exceeds the box it was given;
- **size** — every interactive element under 40px tall or 24px wide;
- **highlight** — it clicks a row that is *not* already chosen and compares the
  computed `background-image / background-color / box-shadow / color` before and
  after, so a state that is marked in the DOM but never painted still fails.

Three of the first run's findings were the harness being wrong, not the UI, and
each was fixed in the harness before anything was changed in the product:
visually hidden labels are 1px by design; a horizontal scroller is meant to hold
wider content; and a row that is already the chosen one proves nothing when
clicked.

## 2. What the review found, and what was done

| Finding | Verdict | Fix |
|---|---|---|
| Schedule: 61 fixture buttons at 30px | real | 40px, day cells to 76px; eight days still fit four columns |
| Help: 68 topic pills at 34px | real | 40px |
| `cube?.dispose is not a function`, 12× per visit to Battle Select | real, **not a skin issue** | see §3 |
| Shop drew a second, painted icon set | real (Owner chose to unify) | see §4 |
| Hunt field showed tools as words, not icons | real (Owner asked to unify) | see §4 |
| Encyclopaedia exit read only "返回" | real | named "返回牧場" like its neighbours |
| Save button still drew from the painted set | real | authored glyph, §4 |
| `.cm-cage-facility` never highlights | harness wrong | it is a "take this back" action, not a choice; press feedback added |
| Battle Select mode faces never highlight | correct | all four are disabled — "模式選擇尚未開放" |

## 3. The Three.js cube was leaking on every visit

`main.js` injects `mountBattleSelectThreePresentation` as a **lazily-imported
async wrapper**, so it returns a promise. `vs5Screens.js` stored that promise
directly and called `cube?.dispose()` on close. `?.` guards `cube` being null,
not `dispose` being absent, so every exit threw — and the renderer, its
textures, its geometry and its pointer listeners were never released. The Gate
screen does `await mountWorld(...)`; this one simply did not.

`createBattleSelectView` could not be made `async`: a test pins its export as
`/export function createBattleSelectView/`. The fix keeps it synchronous and
normalises instead — a thenable resolves into `cube`, anything else assigns
straight through, and a mount that lands *after* `dispose()` disposes itself on
arrival. A regression test covers all three orders.

After the fix the review run reports **0 page errors**, down from 12.

## 4. One icon language

The product was speaking two at once: pixel cells on the care rail, painted
illustrations one screen away. Owner direction 2026-09-12 is one language.

- **Shop goods** sell exactly the four care items the rail already draws, under
  the same four ids, so `shopGoodsUiArt.js` now binds to the approved toolbar
  cells in their rest pose. No new art; the rights gate keeps its shape. The
  test that pinned the old atlas offset now pins the exact cell instead, which
  is the stronger guard.
- **Hunt tools** take the rail's hexagon plate and its green chosen state.
  `HAND` uses the approved cell. `ROPE`, `SHOT`, `WIRE`, `ENTRAP` and
  `DAMAGE_TRAP` have no approved art, so they are **authored** in the skin as
  SVG silhouettes — the reference decode stays research-only.
- **Save** is the same story: no approved save glyph exists, so it is authored.

The hexagon plate itself is now one `:root` definition used by both rails, so
they cannot drift apart.

## 5. Still open

1. **Battle field HUD and Battle Result have not been seen in a live match.**
   Reaching one needs real progression — a fresh save has no eligible fighter
   (the starter is still an egg) and no open fixture, so the review harness
   cannot get there. They are styled from the tokens every other screen was
   verified with; they should be eyeballed once a match is reachable.
2. **The ranch does not fill its frame.** The fitted viewport is width-limited
   by the original's 256-native-pixel camera window, so it cannot be scaled up
   without cropping. The space is the mesh ground, and it shrinks as the player
   adds facilities.

## 6. Verification

- `npm test` — **1467/1467** pass (one new regression test).
- Real release audit — `technical.ok = true`, 0 issues.
- Review walk — 14/14 screens: 0 overflow, 0 clipped text, 0 undersized
  targets, 0 page errors; every real chooser repaints when chosen.

---

# R3 — one icon language, and the habitat frame

Date: 2026-09-12
Owner direction: the cage rail and the hunt rail must speak one icon language;
find a better answer for the empty band around the ranch.

## 1. One icon language

R2 left the hunt rail mixing approved 16×16 pixel cells with hand-drawn vector
line glyphs, which is exactly the patchwork the Owner called out. The approved
cells turn out to follow a strict grammar, and rest → chosen is a **pure palette
swap**, not a redraw:

| tone | rest | chosen |
|---|---|---|
| highlight | `#c5ffff` | `#ffffac` |
| light | `#9c9c9c` | `#ffe600` |
| mid | `#6a6a6a` | `#ffac00` |
| shade | `#413939` | `#a44a00` |
| outline | `#292929` | `#5a1800` |

The six cells with no approved art — `ROPE`, `SHOT`, `WIRE`, `ENTRAP`,
`DAMAGE_TRAP` and the save control — are now authored on the same 16×16 grid in
that grammar, by `.tmp/hunt_glyphs.py`: a silhouette is drawn as an ASCII mask,
then shaded automatically (outline on the boundary, highlight on the
upper-left edge, shade on the lower-right, body split on the diagonal). Both
palettes come out of one cell, so a rest and a chosen glyph can never drift.

`WIRE` was drawn twice: the first attempt read as the letter H. It is a cable
spool now, which cannot be confused with the rope coil beside it.

Nothing is written under `assets/production/`. Promoting an asset is the
Owner's decision, and these are chrome, so they live in the skin as data URIs —
the same footing as the hexagon plate. The plate itself is one `:root`
definition both rails read.

## 2. The habitat frame

Measured on a 430×880 phone:

| | |
|---|---|
| frame | 426 × 519 — portrait, aspect **0.82** |
| ranch drawn | 414 × 365 — landscape, aspect **1.13** |
| fills | 97% of the width, **70% of the height** |
| empty | **154px**, inside a gold window |
| original's habitat screen | 256 × 192 — aspect **1.33** |

The cause is not the ranch. It is that landscape content was given a portrait
box. Four answers were built and looked at:

- **Zoom to fill.** Needs 1.42×, hides 28% of the ranch width behind a pan.
  Rejected: this screen exists to see your residents at a glance. It also cannot
  be done with a CSS transform — `raisingFieldViewport` is the single rectangle
  that art, actor positions **and drop targets** all resolve through, so scaling
  the host in CSS would move the art away from where a drag lands.
- **Give the recovered height to the information panel.** Tried; it traded a
  small empty area for a larger one, because that panel has little to say.
- **A blend of the two.** Kept both problems at half strength.
- **Give the frame the shape its art was drawn for.** Chosen.

The frame is now `aspect-ratio: 4 / 3` and centred, so the leftover height falls
**outside** the gold window. The same pixels that read as a hole inside a frame
read as the digital world the ranch is a platform in — which is what it is. The
fit stays `contain` and the transform is untouched, so hit-testing is unchanged.
The message line below it becomes the framed window the original puts there,
which is where most of the recovered height goes.

**A regression this caught.** `align-self: center` only has a height to centre
because the aspect ratio gives it one. The short-screen media query dropped the
ratio without restoring the stretch, and the frame collapsed to **1px** — the
habitat vanished on a 390×680 phone. Found by measuring the frame at two screen
sizes, not by looking at one.

## 3. Also fixed

- `.claude/` is now in `.gitignore`: a local preview config, not product source.

## 4. Verification

- `npm test` — 1467/1467 pass.
- Real release audit — `technical.ok = true`, 0 issues.
- Measured review — 14/14 screens: 0 overflow, 0 clipped text, 0 undersized
  targets, 0 page errors.
- Raising Home captured and measured at **430×880 and 390×680**; the habitat
  renders at both.

---

# R4 — landscape

Date: 2026-09-12
Owner question: can the game adapt when the phone is turned sideways?

## 1. What it did before

It did not break — a measured walk of all fourteen screens at 844×390 reported
zero overflow, zero clipped text, zero undersized targets and zero page errors.
It was still unusable. Every shell stayed `min(100%, 430px)` and centred, so:

- the habitat was crushed to a ~40px sliver;
- the shop showed one item;
- the schedule was cut off mid-season;
- roughly 200px of window was wasted on each side.

"Nothing is broken" and "this works" are different measurements.

One rule did most of it. `intRh2Styles.css:405` pins the shared status bar and
toolbar to a fixed 430px centred column at `min-width: 431px`. That is a
deliberate frame for a phone column on a desktop; on a phone held sideways it is
the thing making the window unusable.

## 2. The layout, and why this one

The answer is in the hardware. The original is **two 256×192 screens** — an
information screen above a touch screen. Portrait stacks them, which is how the
console is held. Landscape sets them side by side, which is what the console's
own emulators do, and it is the only arrangement that spends the width rather
than padding it away.

| Screen | Landscape |
|---|---|
| Raising Home | information column left, habitat right, full height |
| Gate select | globe left, destination panel and gate list right |
| Battle select | the mode box left, the things you press stacked right |
| Shop, roster, championship, matches | two columns |
| Schedule | a season is one row of eight days, not two rows of four |
| Tamer info | four columns of label/value instead of two |
| Hunt loadout | two columns of slots |
| Title | unchanged — it is a poster, not a working screen |

Gated on `(orientation: landscape) and (max-height: 600px)`, so it reaches a
phone on its side and not a desktop or a tablet, where the centred column is a
deliberate frame. Widening those is a separate decision, not an oversight.

## 3. Two placement defects this found

- **The gate globe looked missing.** It was not: the 3D host is a flex child in
  its own stylesheet and had no height of its own in a grid cell. Measured at
  454×170 after `height: 100%`; the first capture had simply beaten the lazy
  Three.js import.
- **Battle select overflowed.** Its shell children are a flat list, so
  auto-placement pushed the tournament button off the bottom. Each of the six is
  now placed explicitly.

## 4. Verification

- `npm test` — 1467/1467 pass.
- Real release audit — `technical.ok = true`, 0 issues.
- Measured review at **430×880 and 844×390**, fourteen screens each: 0 overflow,
  0 clipped text, 0 undersized targets, 0 page errors in both.

## 5. Not done

Tablet and desktop landscape still show the portrait column centred. That is the
existing deliberate frame; widening it is a design decision, not a bug, and the
media query above is written so it can be relaxed in one place when the Owner
wants it.
