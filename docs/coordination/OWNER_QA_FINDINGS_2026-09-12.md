# Owner QA findings — 2026-09-12

Raised by the Owner during acceptance testing of the rebuilt interface, with
photographs of the original running in an emulator as the comparison.

Status key: **FIXED** verified here · **CONFIRMED** reproduced, not yet built ·
**OPEN** needs original evidence before building.

---

## 1. The highlighted option hid its own label — FIXED

*"選中的選項的反白反而看不到字"*

The control under the cursor turned white and its text disappeared, on the
menu and on the icon rail both. On the rail it showed as a white square
behind the hexagon plate.

**Cause.** Three older layers paint a pale fill for `:hover` —
`raisingHomeHud.css` `#d8f2e5` on the entry, `intRh2Styles.css` `#fff3c7` on
the cell, `styles.css` a blue on the cell — and the skin answered each with
`filter: brightness()` alone. A filter cannot override a background: different
property, so there was no conflict to win. The pale fill kept painting and
brightness then washed it out to white on white. The white square appeared
because the hexagon plate is drawn on `::after` and does not reach the
button's corners.

**Fix.** `nativeUiSkin.css` section 15. The rail keeps no fill in any state and
lights the plate itself; the menu keeps its dark slot and marks the choice with
the gold rim, so green stays rim and never fill. The two gold actions stay gold.

**Verified** by driving the real app with the real stylesheet order and forcing
a genuine hover: cell background went `#fff3c7` → transparent with no filter,
entry background went `#d8f2e5` → the dark slot gradient `rgb(20,73,44)` with
white text. Harness `.tmp/hover-check.cjs`, screenshots in `.tmp/hover-check/`.

**The general rule this encodes:** a state rule must own the same properties as
the layer beneath it. This is the same class of defect as the hidden match list
Codex repaired, and more of it likely remains wherever the skin answered an old
paint rule with a filter.

---

## 2. The wild Digimon's stamina is never shown — CONFIRMED

*"狩獵場捕捉也看不到他的耐力減少，可是原作有耐力減少"*

The Owner's emulator photographs show a bar under the wild creature that
depletes as it is worn down, with a status word above it (`弱っぱれ！`).

**The data already exists and already reaches the renderer.**
`createHuntFieldPixiPresentation.js:431` and `:506` publish `currentHp` and
`maxHp` per wild creature. Nothing draws them: `onActorFrame` is wired only
under `?presentation=developer`, where it dumps positions into a dataset
attribute for tests (`vs2Screens.js:550`).

So this is a missing presentation, not missing simulation. Needs the bar drawn
above the actor in the skin's language, plus the original's status word.

---

## 3. Nothing shows the catch being stored to the memory card — CONFIRMED

*"抓到以後收納進記憶卡會有一個飛進記憶卡的特效動畫"*

There is no capture VFX anywhere in the codebase — no absorb, fly-to-card or
equivalent. The state change to `ON_CARD` happens with no animation.

---

## 4. The hunt result does not show what was caught — CONFIRMED

*"原作結束狩獵會看得到抓到的數碼獸的外觀"*

The result screen renders the species **name only**. `vs3Screens.js` builds a
`<p class="cm-vs2-result__species">` and a name field; there is no image,
sprite or canvas element in that view at all.

The original's hunt screen keeps the caught creature's sprite in a panel — it
is visible in the Owner's emulator photograph, top left.

---

## 5. Digimon walk backwards — CONFIRMED, needs ROM evidence to fix safely

*"他們會倒著走，明明面對右邊，可是他卻往左邊走，原作是會轉方向"*

Traced the whole chain:

| step | file | behaviour |
|---|---|---|
| movement | `nativeHuntMovement.js:145` | `facing = delta[0] < 0 ? 0 : 1` — 0 moving left, 1 moving right |
| frame | `nativeWildActor.js:241` | `flipBits: a.facing ? 0 : 1` — moving **right** produces **no** mirror |
| render | `createHuntFieldPixiPresentation.js:316` | `flipX` → `scale.x = -1` |

`createRaisingFieldPixiPresentation.js:618` records that the character art is
**authored facing left**, and mirrors it when the body bit is set. If that also
holds for the hunt art, then this chain is inverted: moving right leaves the
art unmirrored and therefore facing left, which is exactly the report.

**Not changed yet.** The polarity looks wrong by one step, but this is
ROM-traced code and the fix depends on which way the *hunt* character cells are
authored, which the raising-home comment does not establish. Flipping a sign
here on inference could invert every correct case instead. Needs the authored
direction confirmed from the ROM cell data first.

---

## 6. The infirmary has no heal effect — REPORTED, not yet investigated

*"在保健室會有特效vfx表示回血"*

---

## 7. The shop looks materially different from the original — REPORTED

*"這個是商店的樣子，跟現在遊戲裡面的還是很有差別"*

---

## A note on evidence format

Three of these arrived as `.MOV` screen recordings. There is no ffmpeg on this
machine and video cannot be read directly, so those were worked from the
Owner's written description alone. **Still photographs are usable and were
decisive** — the two emulator photographs settled findings 2 and 4 immediately.
Either install ffmpeg so recordings can be sampled, or prefer stills.
