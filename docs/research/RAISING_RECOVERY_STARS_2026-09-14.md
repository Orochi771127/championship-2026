# Recovery-cage stars — original loop and bank

Date: 2026-09-14. ROM SHA-256 `8ad375ba…c5d1`. Status: control flow `BOUNDED_NATIVE_REPLAY`; bank binding `VERIFIED_BINARY`.

## What the original does

OVL18 `02110FB0..021110D4` runs in the resident update right after the status-icon selector (`02110EC8..02110FAC`).

- **Start** (`02110FC0..0211102C`): when the loop flag `+0x448` is clear, the resident is not in state 6, 7 or 20, and the cage record's definition (`+0x120` → ARM9 `02050028` reads record `+4`) is `0x0F`, `0x12` or `0x1C`, it sets the flag, clears the rest counter `+0x44C`, copies the body position with z + `0x1000` into the effect animator `+0x310`, and force-starts sequence `0x20` (32) through ARM9 `02047904`.
- **Stop** (`02111034..02111040`): with the flag set, only state 6 (carried) clears flag and rest counter.
- **Play** (`02111050..021110B0`): with rest 0, a finished animator (`02047C48`) sets rest to `0x78` (120) and draws nothing that update; otherwise the position is refreshed, the animator advances one tick (`02047A08`, `0x1000`) and the sprite is submitted (`0211DF10`, `0, 0`).
- **Rest** (`021110B4..021110D4`): the counter decrements; on reaching zero it restarts sequence 32.

It reads no HP and heals nothing. The three cages are ミニほけんしつ (15), おんせん (18) and ほけんしつ (28) — exactly the catalog cages whose effect is `RECOVER:HP_AND_STRESS`.

## Which pictures

The resident setup hands the effect-icon animator `+0x23C` and the star animator `+0x310` to the same ARM9 helper `02065DF4`, back to back (OVL18 `02111230..0211124C`), each time with `r0` loaded from `0x020FBA14`. That helper binds the resource at `[r0+0x110]`/`[r0+0xBAA4]` through `020476A0` and starts sequence 0. Both animators therefore use the same bank, which the existing feedback port already reads as `common/e001_ikusei`. Sequence 32 of that bank is seven one-shot frames of nine ticks, cells 148–154 (63 ticks).

The superseded presentation drew an original-created vector pulse for 420 ms whenever HP rose in a recovery cage (`VIDEO_OBSERVED_ON_VERIFIED_HP_WRITE`). Both its trigger and its art are replaced.

## Receipts and implementation

- Replay: `scripts/research/check-raising-recovery-stars-cpu.py` → `docs/research/RAISING_RECOVERY_STARS_CPU_2026-09-14.json`. 901 continuous updates cover start, blocked starts (states 7/20, ordinary cage), carried stop, continuation through 7/20 and a cage change, and restart: 6 starts, 347 submits. The animator/renderer entries are intercepted; the intercepted animator is a one-shot of the catalog's sequence-32 tick total, so the receipt proves control flow, not NANR playback.
- Port: `src/championship/raising/nativeRaisingRecoveryStars.js`, stepped from `stepNativeRaisingActor` after the status selector and projected as `recoveryStars` on the actor frame; drawn by the existing native feedback drawer with cells from `raising-feedback-v1` (loader now includes cell 154).
- Tests: `tests/championship-raising-recovery-stars-cases.mjs` — every replay update; cage list against the catalog; no HP read; and the real application: no stars in the Waiting Room, all seven cells in the mini infirmary with ≥120-update rests, none while carried.

## Boundaries

- Browser observation was not completed: the automation pane was hidden, the Pixi ticker did not run, and a scripted carry could not be driven. The application-clock test stands in for it; physical-device acceptance remains open.
- The `raising-feedback-v1` cells are `LOOPBACK_RESEARCH_ONLY` and are not in the public playtest approval list; the public build shows no stars.
- `+0x344` receives body `+0x34` before submit; its draw meaning is not traced and is not used.
