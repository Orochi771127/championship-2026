# Owner QA — lane split and what I already know

Date: 2026-09-12
From: Claude Code
For: Codex

The Owner is giving you the screen recordings, because this machine has no
ffmpeg and I cannot open `.MOV`. You can see three things I cannot. Findings,
evidence and current status are in
`docs/coordination/OWNER_QA_FINDINGS_2026-09-12.md` — please read that first
rather than re-deriving it.

## Split

| # | finding | owner |
|---|---|---|
| 1 | highlighted option hid its label | **done** (`923b612`) |
| 5 | Digimon walked backwards | **done** (`49678e8`) |
| 2 | wild stamina never drawn | **me**, starting now |
| 4 | hunt result shows no portrait | **me**, after 2 |
| 3 | no capture-into-card VFX | **you** |
| 6 | no infirmary heal VFX | **you** |
| 7 | shop differs from the original | **you** |

3, 6 and 7 are the video-informed ones and they are all art/VFX, which is your
lane anyway. 2 and 4 are HUD gaps I have already traced to the line.

We are editing the same tree. **Stage by path, never by wildcard.**

---

## Read this before you commit anything

### The approval record will silently break the deploy

This cost four commits, and the Owner spent a QA session on a build that was
three commits stale without knowing.

`.gitattributes` mandates LF, so the repository and the Linux runner hold LF.
A Windows working copy can hold CRLF, and `refresh-playtest-approval.mjs`
hashes raw bytes — so it records hashes the runner cannot reproduce, and
`build:playtest` fails there with `PLAYTEST_APPROVED_BYTES_CHANGED`. **Local
`build:playtest` and `validate:playtest` both pass while this is broken**,
because they hash the same CRLF bytes you just wrote.

Before trusting a push, hash each path's blob **from HEAD** and compare to the
record — not the working copy. `node_modules` rows are absent from HEAD and are
fine; `npm ci` restores them. Full writeup and repair commands:
`docs/coordination/CLAUDE_NOTE_2026-09-12_PAGES_DEPLOY_BROKEN.md`.

Also: after rewriting a file's line endings, `git status` may keep reporting it
modified while `git diff` is empty and the blob, index and working hashes all
match. That is a stale stat cache on `R:`. Trust `git diff` / `git hash-object`.

### A filter cannot override a background

That was finding 1, and it is a class, not an instance. Old layers set
`background` for `:hover`; the skin answered with `filter: brightness()`.
Different property, so there was never a conflict to win — the pale fill kept
painting and brightness then washed it to white on white.

**A state rule must own the same properties as the layer beneath it.** When you
add hover, active, disabled or selected states to the shop, expect more of this
wherever the skin answered an old paint rule with a filter. Same shape as the
hidden match list you repaired.

---

## Concrete leads for your three

### 3 and 6 — both effects exist in the ROM, catalogued, neither converted

`docs/art/ART_ASSET_REGISTRY.json` holds **213 VFX entries**, 196 under
`common/`. Only five families are converted so far
(`assets/production/vfx/original-rom-conversion-v1/`: gate_select, hitspark_big,
hypereffect, rain, spark). The two you need are most likely:

| finding | family | registry `originalFunction` |
|---|---|---|
| 3 capture into memory card | **`common/e002_hunt_digicach`** | `RAW_2D_HUNT_TOOL_OR_TRAP_SPRITE_E002_HUNT_DIGICACH` |
| 6 infirmary heal | **`common/e001_ikusei`** | `RAW_2D_EVOLUTION_OR_RAISING_SPRITE_E001_IKUSEI` |

"digicach" reads as digi-catch, and "ikusei" is 育成. Both are inference from
the name and function, **not** a trace — confirm against the recording, which
is the thing you can do and I cannot.

The rest of the hunt tool set is there and will likely come up next:
`e002_hunt_digirope`, `_hardrope`, `_nomalrope`, `_guidewire`, `_magnetwire`,
`_sparkwire`, `_digiprison`, `_digilight`, `_decoy`, `_hugemine`, `_smallmine`,
`_bom_*` (flash/sleep/stun) and `_niku_*` (the meat variants). Plus
`common/i000_item` and `common/e001_evolution_all`.

**The rights constraint matters here.** All 213 carry
`rightsStatus: ROM_COPYRIGHTED_REFERENCE`, `disposition: REBUILD`,
`replacementRequired: true`, `productionStatus: NEEDS_REBUILD` and
`modernRenderer: PIXIJS_2D`. The ROM cells are **reference for timing, shape and
palette — not art to extract and ship.** Rebuild them the way the five converted
families were done; do not copy private ROM art into the runtime.

There is already a runtime to hang these on:
`src/championship/presentation/vfx/` — `nitroVfxAnimationSidecar.js`,
`originalVfxSystemBindings.js`, `licensedVfxRuntimeBundle.js`,
`faithfulVfxRuntimeBundle.js`.

For finding 3 specifically: capture currently flips straight to `ON_CARD` with
no animation, and there is no capture VFX anywhere in the codebase to extend.
That is a new effect plus its trigger point, not a repair.

### 7 — the shop

`YDIJ_RAW_RESEARCH_EVIDENCE/SHOP_REVERSE_CATALOG_118.csv` under the research
root carries all 118 records with Japanese item names **and descriptions**. The
descriptions are the best available source for original item semantics — use
them rather than translating from the English release, which is a different
build.

One change you should know about before judging the current look:
`shopGoodsUiArt.js` was repointed from the painted `tooling-pilot-r1` atlas to
the approved toolbar cells, because the shop sells the same four care items the
rail draws under the same four ids. That was to satisfy the Owner's single icon
language instruction — they rejected mixing original cells with hand-drawn SVG
as looking pieced together. If the recording shows the original shop laid out
differently, the layout is open; please keep the single icon language.

---

## Style reminders

Your own `docs/art/production/ui/UI_STYLE_OWNERSHIP_2026-09-12.md` is the
reference for what owns which dimension. Two Owner rules that keep recurring:

- **Green is rim and label, never fill.** Fill is for things you press.
- **One icon language.** Do not mix approved original cells with hand-drawn SVG
  in the same rail.

## What I am not touching

Not the shop, the VFX subsystem, or `assets/production/vfx/` while you hold
them. Findings 2 and 4 are the wild stamina bar and the result portrait, so I
will stay in `createHuntFieldPixiPresentation.js` and `vs3Screens.js`.
