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

## 2. The wild Digimon's stamina is never shown — FIXED

*"狩獵場捕捉也看不到他的耐力減少，可是原作有耐力減少"*

The Owner's emulator photographs show a bar under the wild creature that
depletes as it is worn down, with a status word above it (`弱っぱれ！`).

**The data already exists and already reaches the renderer.**
`createHuntFieldPixiPresentation.js:431` and `:506` publish `currentHp` and
`maxHp` per wild creature. Nothing draws them: `onActorFrame` is wired only
under `?presentation=developer`, where it dumps positions into a dataset
attribute for tests (`vs2Screens.js:550`).

So this was a missing presentation, not missing simulation.

**Fixed.** `createHuntFieldPixiPresentation.js` now draws a gauge under each
creature: dark track, fill green while healthy and red once low. It appears
once a creature has actually been worn down, or while it is the one being
worked on — a full gauge over every idle creature is noise, and depletion was
the thing that could not be seen. The gauge cancels the parent node's facing
mirror, so it is not drawn backwards when a creature walks left.

The decision and the placement are a pure exported function, `huntStaminaGauge`,
so the rule is testable without a renderer — 6 cases in
`championship-hunt-stamina-gauge-cases.mjs`, covering visibility, the fraction,
the three colour bands, malformed hit points, the geometry, and a check that
both view producers still publish the fields the gauge reads.

**Not photographed in a live capture, and here is why.** The field currently
binds only two tools, `HAND` and `ROPE`; the shot and bait carried in from the
loadout are among the eight `RAW_SLOT_*` placeholders, so there is no way to
take stamina off a creature yet, and the harness could not get the binding
stroke recognised. The gauge was therefore exercised through its tests and
observed to correctly stay hidden for full-health untethered creatures, but the
filled bar has not been seen on screen. Worth a look during QA: rope a
creature, and the gauge should appear.

The original also shows a status word above the bar (`弱っぱれ！` in the
reference photograph). Not built — it needs the original's wording and its
thresholds, neither of which is established.

---

## 3. Nothing shows the catch being stored to the memory card — CONFIRMED

*"抓到以後收納進記憶卡會有一個飛進記憶卡的特效動畫"*

There is no capture VFX anywhere in the codebase — no absorb, fly-to-card or
equivalent. The state change to `ON_CARD` happens with no animation.

---

## 4. The hunt result does not show what was caught — FIXED

*"原作結束狩獵會看得到抓到的數碼獸的外觀"*

The result screen renders the species **name only**. `vs3Screens.js` builds a
`<p class="cm-vs2-result__species">` and a name field; there is no image,
sprite or canvas element in that view at all.

The original's hunt screen keeps the caught creature's sprite in a panel — it
is visible in the Owner's emulator photograph, top left.

**Fixed.** The screen now draws the catch from `hudArt.getPortrait()` — the
same registered bank the Raising home and the battle result already use, so
this is one art language rather than a second source for the same creature.
`main.js` loads it on demand exactly as `mountBattleResult` does, and a bank
that fails to load leaves the portrait hidden rather than taking down the
screen where the catch is named and saved.

Framed as a slot in the skin's language, and drawn at twice the bank's native
scale: at native scale on a phone it reads as an icon rather than as the answer
to "what did I catch".

**Verified on screen.** `tests/fixtures/championship-hunt-result-review.html`
now renders it — 種子獸 in its frame above the name field.

Two things had to be repaired to get there:

- **The fixture was already broken at HEAD**, before this change. A fresh tamer
  holds 0 bits and the first gate reads `GATE_LOCKED` at rank 3, so
  `confirmGate()` never left `GATE_SELECT` and `beginHunt()` produced no
  runtime. It now applies the same `applyQaUnlock` grant `?qa=unlock` uses —
  admission still runs and still decides, only the prerequisites are supplied —
  and throws with the admission reason if it still cannot enter, so the next
  rule change fails loudly instead of silently.
- The fixture also loaded only `vs2Styles.css`. It now loads all ten
  stylesheets in the shipped order, so what it shows is what ships.

While verifying, the "GIVEN NAME" label was found sitting on `--vs2-muted`, a
tone chosen for the old pale panel and barely legible on the skin's blue mesh.
Fixed alongside. That is finding 1's family reached from the other direction:
not an overridden state, but a colour only ever readable against the surface it
was written for. Worth sweeping for more.

---

## 5. Digimon walk backwards — FIXED

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

**Evidence gathered, then fixed.** Two independent confirmations:

1. **The art.** `assets/production/internal-faithful-baseline/characters-v1/`
   is the tier both Hunt and Raising draw from. Every one of Agumon's ~70 cells
   faces **left** — snout left, tail right. So facing right is the case that
   must mirror.
2. **Five ROM-traced raising sites all state the opposite polarity to Hunt:**

   | site | rule | meaning |
   |---|---|---|
   | `nativeRaisingMovement.js:44` | `delta[0] < 0 ? 0 : 1` | moving right → 1 |
   | `nativeRaisingActor.js:205` | `velocityQ12[0] >= 0 ? 1 : 0` | moving right → 1 |
   | `nativeRaisingActor.js:301` | actor left of food → 1 | right → 1 |
   | `nativeRaisingActivity.js:72` | actor left of peer → 1 | right → 1 |
   | `nativeRaisingActivity.js:83` | `flipBits === 0 ? -4096 : +4096` | 1 → moves +X |

   `flipBits = 1` means right, consistently, and mirrors the left-authored art
   to face right. Hunt alone returned `facing ? 0 : 1`, the exact inverse.

`nativeWildActor.js:241` now returns `facing ? 1 : 0`. One character, but it
was inverting every wild creature in the field.

The observed-original evidence file `RAISING_HOME_REBUILD_OBSERVED_2026-09-09.json`
does **not** settle this on its own: its `flipBits` values are construction-time
spawn rolls (`nativeRandom % 2`) and do not correlate with `angleQ12`. Checked,
and discarded as evidence, rather than read as agreement.

Regression pinned in `championship-hunt-direction-unassigned-cases.mjs`, which
asserts the hunt polarity *and* reads the two raising rules back out of source,
so the two subsystems cannot drift apart again.

**Ranch was already correct** and did not need changing: the
`resident.facing === "left" ? -1 : 1` fallback in
`createRaisingFieldPixiPresentation.js:520` would be inverted the same way, but
line 616 resets the root scale whenever native frames are active, and the
`flipBits` path then owns the mirroring. The fallback is only reachable without
native geometry. Left alone rather than "fixed" on sight.

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


---

## 8. The hunt field's placeholder slots collide with the header — WITHDRAWN, not a defect

Found while capturing finding 2, not reported by the Owner.

`gateHuntPresentationSource.js:84` states the rule: *"Render RAW_SLOT_0 through
RAW_SLOT_7 in ROM order as neutral disabled placeholders."* Rendering them is
deliberate and correct — they are the original's unimplemented field controls.

Their **layout** is not. At 430x880 the eight hexagons overlap each other in a
cramped row across the top of the field and sit on top of the gate name and the
remaining-time readout, so `南橋峽谷` and `剩餘 07:50` are both partly covered.
Capture: `.tmp/hunt-stamina/S3-hunt-field.png`.

**Withdrawn on 2026-09-13 after measuring player mode.** This was an artifact
of my own harness, which ran with `?presentation=developer`.

`vs2Screens.js:105` appends the `RAW_SLOT_00` text label **only** in developer
mode. That text is what forced each button wide enough to overlap its
neighbours and ride over the header. In player mode the hunt field renders
**zero** `.cm-vs2-slot` elements — measured, not inferred: 0 slots, 0
overlapping pairs, and the capture shows `南橋峽谷` and `剩餘 07:42` fully
legible with only the two live tools on screen
(`.tmp/hunt-stamina/P1-player-field.png`).

No player has ever seen this. Nothing to fix, and the placeholder rule stands
as written.

The lesson is the one that nearly cost a wrong change: a developer-mode capture
is not evidence about the shipped screen. The same check saved the RAW_SLOT
rendering itself from being "fixed" earlier on the same page.
