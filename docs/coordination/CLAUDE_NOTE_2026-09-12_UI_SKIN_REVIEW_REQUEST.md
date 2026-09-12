# Review request — interface rebuild and QA grant

Date: 2026-09-12
From: Claude Code
For: whoever reviews art/UI (Codex owns this lane per AGENTS.md)
Owner instruction: review before acceptance testing — bugs, original fidelity,
tech debt.

Two commits are on `main` and deployed:

| commit | what |
|---|---|
| `2ccc1af` | interface rebuilt in the original's language, modernised |
| `a1027c5` | `?qa=unlock` acceptance grant |

Full design record: `docs/art/production/ui/NATIVE_UI_SKIN_R1.md` (R1–R4).
QA grant record: `docs/art/production/ui/QA_UNLOCK.md`.

---

## 1. Please do not re-verify these — they are measured

Re-running them is wasted effort; the numbers are reproducible with the
harnesses named.

| Checked | Result | How |
|---|---|---|
| Whole suite | 1473/1473 | `npm test` |
| Release audit | `technical.ok = true`, 0 issues | `auditWebBuild('.')` |
| Playtest build + validate | 6279 files, ids match | `npm run build:playtest && npm run validate:playtest` |
| 14 screens × portrait 430×880 | 0 overflow, 0 clipped text, 0 targets under 40px, 0 page errors | `.tmp/ui-review.cjs` |
| 14 screens × landscape 844×390 | same, all zero | `UI_W=844 UI_H=390 node .tmp/ui-review.cjs` |
| Highlight state repaints when a row is chosen | pass on every real chooser | same harness |
| Hardest gate under the QA grant | confirm goes disabled → enabled | measured, not asserted |

`.tmp/ui-review.cjs` measures rather than eyeballs: overflow past the game
column, text whose `scrollWidth` exceeds its box, interactive elements under
40px, and whether clicking an **unchosen** row actually changes its computed
paint. Three of its first findings were the harness being wrong, not the UI —
visually hidden labels are 1px by design, a horizontal scroller legitimately
holds wider content, and clicking an already-chosen row proves nothing.

---

## 2. Where I am least confident — best use of your time

### 2.1 Battle field HUD and Battle Result have never been seen

Styled from the same tokens as everything verified, but **not once rendered in a
live match**. A fresh save has no eligible fighter (the starter is an egg) and no
open fixture, so the harness cannot reach them. With `?qa=unlock` a match may now
be reachable — if you can get into one, that is the single highest-value thing to
look at.

### 2.2 `setBattleBadges` interaction with the battle result path

New public seam on `championshipStandaloneApp`, added because gate unlock kind 2
reads a list only a battle result could previously write. I tested it in
isolation. I did **not** test what happens when a real battle result writes
`battleBadgesValue` after the grant has already set it, nor its interaction with
`nativeTitles` / `championshipRun` rollback (`main.js` restores
`beforeBadges` on failure). If the grant and a result can disagree, that is a
correctness bug and I would not have caught it.

### 2.3 The cube dispose fix

`vs5Screens.js` stored the promise returned by the async `mountCube` injector, so
`cube?.dispose()` threw and the Three.js renderer, textures, geometry and pointer
listeners leaked on every exit from Battle Select. Fixed by normalising a
thenable, with a regression test for all three orders (resolve-then-dispose,
dispose-then-resolve, synchronous).

I verified page errors went 12 → 0. I did **not** verify with a WebGL context
counter that the renderer is actually released. Worth a look if you have a way to
measure it.

### 2.4 Landscape is tested at exactly one size

844×390 only. Other phone landscapes (932×430, 740×360) and tablets are
untested. The layout is gated on `(orientation: landscape) and (max-height:
600px)`; tablets and desktop deliberately keep the centred portrait column.

An `aspect-ratio` + `align-self: center` pair already collapsed the habitat frame
to **1px** at 390×680 once — found by measuring two sizes, not by looking at one.
There may be more of that shape.

---

## 3. Tech debt I am knowingly introducing

### 3.1 The skin wins by mirrored specificity, not by `!important`

`nativeUiSkin.css` loads last and deliberately mirrors the weight of the bright
per-screen layers — `.cm-status-bar[data-screen]`,
`.cm-toolbar[data-mode] .cm-toolbar__cell`, `.int-rh2-root .int-rh2-*`,
`.cm-vs2-root[data-screen] …`. Equal specificity plus later load order wins.

**This is fragile in one specific way:** if anyone raises the specificity of a
rule in `raisingHomeHud.css`, `intRh2Styles.css`, `huntMobile.css` or
`facilityBattleMobile.css`, my override silently stops winning and the screen
reverts to the pale theme with no error anywhere. The review harness would catch
it visually but nothing fails a test.

If that trade is wrong, the honest fix is to delete the bright layers rather than
to escalate on both sides.

### 3.2 Payload

| file | raw | gzip |
|---|---:|---:|
| `nativeUiSkin.css` | 104 KB | **19 KB** |
| `styles.css` | 35 KB | 8 KB |
| `intRh2Styles.css` | 23 KB | 6 KB |

It roughly doubles render-blocking CSS. 17% is inline pixel art (15 data URIs:
the hex mesh, the hexagon tool plates, and six authored 16×16 cells). Given the
load-time work that just landed, please say if 19 KB is too much — the data URIs
could move to files, and the dead bright-theme rules the skin overrides could be
deleted rather than overridden, which would shrink both files.

### 3.3 Two review artefacts at the repository root

`ui-skin-review.html` follows the existing `battle-art-review.html` convention. If
that convention is unwanted, say so and I will move both.

---

## 4. Original-fidelity questions I could not answer

1. **The ranch does not fill its frame.** The fitted viewport is width-limited by
   the original's 256-native-pixel camera window, so it cannot be scaled up
   without cropping, and `raisingFieldViewport` is also what actor positions and
   drop targets resolve through — a CSS transform there would move the art away
   from where a drag lands. I gave the frame the original's 4:3 so the leftover
   falls outside the gold window as ground. **Is 4:3 right, or does the original
   ranch actually grow to fill a taller area I have not seen?**

2. **The six authored cells.** `ROPE`, `SHOT`, `WIRE`, `ENTRAP`, `DAMAGE_TRAP`
   and the save control have no approved art, so I authored them on the same
   16×16 grid and the same five tones as the approved set (rest → chosen is a
   pure palette swap there, which I matched). **Do these read as the right tools
   to someone who knows the original?** `WIRE` is a cable spool; my first attempt
   read as the letter H.

3. **The shop icon repoint.** `shopGoodsUiArt.js` now binds to the approved
   toolbar cells instead of the painted pilot atlas, because the shop sells
   exactly the four care items the rail draws under the same four ids. The
   painted set is still used for `raising-header-material.webp`. **Was the
   painted atlas the intended direction for shop goods?** Owner chose one icon
   language on 2026-09-12; if that reading is wrong, this is a one-line revert.

4. **The database exit label.** Changed from `uiText("BACK")` → literal
   "返回牧場" to match every neighbouring screen, which all use that literal.
   **Should it have gone through `uiText` with a new key instead?**

---

## 5. What the QA grant does and does not do

`?qa=unlock` grants money, tamer rank and battle badges through seams that
already existed (`creditBits`, `setTamerRank`, plus the new `setBattleBadges`).
**It changes no rule** — gate admission, fee debits, shop caps, cage slot counts
and placement validation all still run and still decide.

Off unless the address says `qa=unlock` by name. One call site, behind the check,
and a test asserts no other file under `src/` references the module.

There is deliberately **no second QA save slot**: AGENTS.md allows exactly one
save key. Saving while unlocked persists the granted state; a new game without
the parameter returns to ordinary progression.

To remove it entirely: `git revert a1027c5`. The approval-record entry is in that
same commit, so the revert leaves no dangling file reference.
