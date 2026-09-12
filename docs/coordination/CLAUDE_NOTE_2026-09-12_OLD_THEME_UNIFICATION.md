# Handoff — unifying the old theme layers

Date: 2026-09-12
From: Claude Code
For: Codex (art/UI lane)
Base: `f48e7bd`, which carries your review fixes.

Owner's instruction, in their words: **"都用新的取代,如果有舊的 就做出跟新的一樣樣式的UI HUD去取代替換掉"**
— replace, don't merely delete. Where an old style is still on screen, build the
equivalent in the skin's language and swap it in, so the game reads as one style.
And: **"可以參考美術包"** — the art pack is the reference:
`R:\Projects\Championship2026\YDIJ_PRIVATE_ROM_ART_PACK`.

This note exists so you do not re-derive the measurement. It took a 4-viewport
CDP run; the numbers below are reproducible with the harness named.

---

## 1. What was measured, and what it does and does not prove

`.tmp/css-deadweight.cjs` (scratch, not product) walks 11 screens at 4 viewports,
asks Chrome for the matched rules of every element, and for each property keeps
only the **last** rule that sets it — the cascade winner. Output:
`.tmp/css-dead-all/deadweight.json` (44 screen entries, winners unioned).

Run it with `npm run serve` up:

```bash
node .tmp/css-deadweight.cjs .tmp/css-dead-all
```

**Ignore `.tmp/css-dead/`** — that is a superseded single-viewport run. Its
numbers are within a few percent of the correct ones, which is a trap: it means
a single-viewport run *looks* credible while marking every landscape and
short-screen media rule dead. Deleting on those numbers would have silently
removed the Owner's automatic orientation support.

**What the measurement proves:** a declaration never won on the screens and
sizes actually reached.

**What it does not prove:** that nothing needs it. Only reachable states were
walked. A fixture that is registered or won, a calendar on another month, a
battle result variant, an error banner — none were on screen, so every rule that
styles them reads as dead. **Deletion has to be proven by pixel diff, not by
this table.** Portrait and landscape baselines are captured at `.tmp/base_p`
and `.tmp/base_l`.

---

## 2. The two lists are different problems

| stylesheet | never wins | of | % | old colour declarations still winning |
|---|---:|---:|---:|---:|
| `styles.css` | 280 | 377 | 74 | 27 |
| `intRh2Styles.css` | 185 | 284 | 65 | **56** |
| `vs2Styles.css` | 173 | 257 | 67 | 23 |
| `raisingHomeHud.css` | 166 | 211 | 79 | 20 |
| `facilityBattleMobile.css` | 144 | 209 | 69 | 29 |
| `huntMobile.css` | 119 | 183 | 65 | **34** |
| `vs5Styles.css` | 38 | 44 | 86 | 0 |
| `opening.css` | 9 | 68 | 13 | 30 |
| `nativeUiSkin.css` | 22 | 656 | **3** | 403 |
| **total** | **1136** | **2289** | | **219 from old files** |

**List A — 1136 declarations that never win.** Overridden weight. Removing them
is payload and clarity only; the player sees no change *if* the deletion is
correct. This is the part that needs the pixel diff.

**List B — 219 colour declarations from old files that still win.** These are
literally the old theme still on screen. **Deleting them leaves the component
unstyled** — this is the half that needs new UI/HUD built in the skin's language
before anything is removed.

The skin's own 3% dead rate is the control: it is not carrying dead weight.

---

## 3. Where the old theme is still showing (List B, by component)

```
29  .cm-vs2-root              facilityBattleMobile.css
17  .cm-status-bar            intRh2Styles.css
14  .cm-vs2-body--gate        huntMobile.css
11  (bare element rules)      styles.css
 8  .cm-toolbar               intRh2Styles.css
 8  .cm-title__login          opening.css
 6  .int-rh2-day-confirm      intRh2Styles.css
 6  .int-rh2-letter           intRh2Styles.css
 6  .cm-vs2-signal            vs2Styles.css
 5  .int-rh2-calendar         intRh2Styles.css
 5  .int-rh2-letter__ack      intRh2Styles.css
 5  .cm-title__world          opening.css
 4  .cm-schedule-day          styles.css
 4  .cm-schedule-fixture      styles.css
 4  .int-rh2-calendar__date   intRh2Styles.css
 4  .int-rh2-calendar__grid   intRh2Styles.css
 4  .int-rh2-letter__sender   intRh2Styles.css
 4  .int-rh2-mail-icon        intRh2Styles.css
```

Full per-selector lists are in `winList` per file in the JSON.

These concentrate in components the skin never covered, because the harness
never reached them: the **calendar**, the **letter/mail** panel, the
**schedule fixture states** (`[data-registered]`, `[data-won]`), the **gate 3D
host background**, and the **status-bar mode variants**. Those five are the real
work; the rest is mopping up.

---

## 4. The skin's language, so a replacement matches

Five parts, taken from the original and recorded in
`docs/art/production/ui/NATIVE_UI_SKIN_R1.md`:

1. Cyan hexagonal mesh over deep blue — the ground.
2. Gold ribbon — season tab, day, mode, outlined clock.
3. Windows framed by a gold band between two dark lines, over desaturated dark green.
4. Slots — dark inside, bright green rim.
5. A rail of icon discs — metal at rest, gold when chosen.

Tokens are in `nativeUiSkin.css`; use them rather than new literals:

```css
--ds-blue:#0b56e8; --ds-gold:#ffdf46; --ds-ink:#061119;
--ds-panel:#1d4132; --ds-slot:#0d3520; --ds-rim:#46d62c;
```

**The green rule, from the Owner's hardware photos: green is rim and label,
never fill.** Fill is reserved for things you press. My first pass got this
wrong and they corrected it — "綠色的他好像沒有那麼多".

**One icon language.** The Owner rejected mixing approved original cells with
hand-drawn SVGs — "看起來很像拼湊". Approved cells live under the art pack; six
authored cells (`ROPE`, `SHOT`, `WIRE`, `ENTRAP`, `DAMAGE_TRAP`, save) fill the
gaps on the same 16×16 grid and five tones.

---

## 5. The structural question underneath

The skin wins by **mirrored specificity plus later load order**, not
`!important` — it matches the weight of `.cm-status-bar[data-screen]`,
`.cm-toolbar[data-mode] .cm-toolbar__cell`, `.int-rh2-root .int-rh2-*`,
`.cm-vs2-root[data-screen] …`.

That is the debt you already named. Raising the specificity of any rule in an
old file silently un-skins a screen with no test failing. Your fix for the
hidden match list (`#cm-root [hidden]`) is an instance of the same shape.

Deleting List A and rewriting List B removes the *cause*, not just the symptom:
with nothing left to out-rank, the skin stops needing to mirror anything.

Order that keeps the tree green at every step:

1. Build the five never-skinned components in the skin's language (List B).
2. Re-run the harness; List B should fall to near zero.
3. Delete List A per file, pixel-diffing against `.tmp/base_p` / `.tmp/base_l`
   after each file rather than in one commit.
4. Drop the mirrored-specificity selectors once nothing outranks them.

`WEB_BUILD_INPUTS.v1.json` carries a sha256 per file; any stylesheet edit needs
`scripts/refresh-playtest-approval.mjs` or the release audit goes red. Note the
audit in `npm test` runs against synthetic fixtures, so the suite can pass while
the real audit is red — check `auditWebBuild('.')` directly.

---

## 6. Not in scope here

Battle field HUD and battle result are now verified by you in a real match.
Tablet and desktop deliberately keep the centred portrait column; that is a
decision, not an omission.
