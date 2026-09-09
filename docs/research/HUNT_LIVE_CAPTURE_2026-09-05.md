# Actual encounter and native touch capture

Continuation correction: [native phase port and resident migration](HUNT_PHASE_PORT_AND_RESIDENT_MIGRATION_2026-09-05.md) supersedes the fixed-resident release limitation and down-animation interpretation below. The observed down path is an AI10 update countdown followed by AI11 entry; collection ownership follows controller counters. Normal-entry browser capture remains incomplete.

Status: **PARTIAL — native touch capture reproduced; normal browser capture remains unbound.**

Workspace / Git root: `R:\Projects\Championship2026\championship-2026`; branch `main`; HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`, with pre-existing shared changes retained. Owner's current four-item request authorizes this continuation. No commit, push, deployment, other-project product truth, or new ROM-art promotion.

## Actual encounter / RNG

[Encounter receipt](HUNT_LIVE_ENCOUNTER_REPLAY_2026-09-05.json) and [replay script](../../scripts/research/trace-hunt-live-encounter.py).

The Owner's original ROM SHA-256 is `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`. Actual native DeSmuME states were found in `C:\Users\USER\Downloads\DS\StateSlots`:

- Before entry, `.ds3`: SHA-256 `8bbff6d16e4ec9a1334ae3244429b8bab2eaff92e4f85d8127b55267dcd46072`, OVL18.
- In field, `.ds4`: SHA-256 `3b1a13a0e517722f094d0a6454f773a3b2f55b6f0b0994d4788447b5650940ae`, OVL0, native Gate index 0, season 0.

State validation inflates at byte 32, verifies the unique `4,8,24,60,400` fingerprint and ARM9 / overlay bytes, and extracts the ARM9 main RAM. Running the original spawn constructor `0211A568..0211AA44` with the before-entry RNG arrays reproduces **all 15 species and initial HP in order**. There are 236 observed native RNG calls; B7 cursor goes from 100 to 12, matching the field state. The receipt retains all 217 seed/cursor pairs before and after; no guessed B7 result is supplied to the constructor. Native candidate weights, seasonal selection, duplication and individual construction execute under Unicorn.

Boundaries remain explicit: allocation uses isolated scratch RAM, visual/post-constructor `02062C28` is excluded, and the field state supplies already-loaded context/resources. Subsequent actor construction / wandering RNG calls mean the complete post-constructor RNG state is not asserted equal to the later field state. This is a replay from observed entry state, not a reconstructed New Game RNG initializer.

The selected actual target is wild **index 7, species-010**, source address `02130F38`, wild address `0231DB20`, native Q12 position `[1103215,1831310]`. Base HP 200, next rung 280, actual B7 output **81**, initialized HP **210**, G cost **12**. `NATIVE_LIVE_STATE_REPLAY` now binds the actual 15 observed identities/positions in the existing Hunt runtime, validates the gate and record indices, and disables prototype wandering for these observations. The normal generated field remains separate. The old species-008/B7=37 fixture remains a historical numerical regression only.

## Original stylus sequence, without RAM writes

[Native touch receipt](HUNT_NATIVE_TOUCH_REPLAY_2026-09-05.json), [headless replay script](../../scripts/research/trace-hunt-native-touch.py). Requires the research-only `py-desmume` package, whose bundled DeSmuME 0.9.12 library successfully loaded the Owner's 0.9.13 state. The failed Windows screenshot adapter was not used for this validation. Screenshots and emulator snapshots remain under `C:\Users\USER\.codex\visualizations\2026\09\05\championship-hunt-live\replay`; no ROM copy or raw state is added to runtime.

The script loads the real field state, uses only stylus input and frame cycles, and observes RAM/PC through read-only callbacks. It reads the target's live position to aim; every input action, calibrated native touch coordinate, frame, event, HP and position is retained. No HP, RNG, selected tool, bound flag or animation-completion flag is written by the script.

1. Select hand at native stylus `(36,182)` and drag empty ground to pan. Select Rope at `(64,182)`.
2. Draw around the observed target, then **release**. `02114718..0211473C` evaluates shape after touch-up; `021149DC` sends `0x23` only after the ring/spatial-query stage. Target becomes bound in AI state 8.
3. Touch the bound individual and drag to pull. **198 native Rope updates** are compared with `stepNativeRope`; HP, durability and Q12 accumulator match on every invocation, including emitted `0x11` / `0x13`.
4. First HP zero: replay frame **351**, AI8, hand not ready. First hand-ready: frame **367**, AI11. These are observed timeline boundaries, not universal fixed durations to substitute for animation callbacks.
5. Select hand, touch target. Card count first increases at frame **480**, AI12. Wild HP is zero; source record and card HP remain **210/210**. Card contains species index 10.

Important corrections and limits:

- Original input ignores stroke start in the 16-pixel edge zone and can enter camera drag there (`0211D010..0211D048`). Coordinates are native 256x192 touch coordinates; this emulator's calibration often yields API coordinate +1. Do not add that emulator calibration bias to web input.
- `movementBlocked` in the existing Rope numerical API represents **W+4FC**, an original movement-restriction flag; it is not proof of a simple map-collision boolean. AI8 event13 can set a random stun interval (`02110D00..02110D78`).
- Observed dispatch counts: AI8 receives 2 event11 and 179 event13; AI10 receives 15 event13; AI11 receives one event11 and one hand event16. There is also event23 at AI4 and AI8. Counts include dispatch to the observed object; they do not prove every state-handler consequence.
- AI11 event11 invokes `0210C2E8(mode0)` and sets AI+84 / actor+440; AI8 event13 modifies AI+58/+98/+1B0 and W+4FC. A uniform extra-damage rule for all states is wrong. Runtime still rejects an unprovided AI handler before mutating strong-pull state.
- Native animation completion is now observed end to end, but the browser renderer's down/hand/card animation driver is not yet implemented. Normal toolbar, sampler lifetime, movement and the whole AI dispatch table remain unbound.
- No battery-save or normal browser capture acceptance is claimed.

## Result release and atomic Home replacement

ARM9 mode3 list construction places card rows before Home rows (`02056BCC..02056C34`). Confirmed release enters the event0D branch; event0E cancels. `02059AD0..02059BDC` removes a selected card record and compacts subsequent stride-1C8 records; native CPU replay tests first/middle/last, including same-species records with different HP. Home release finds an exact record pointer using `02062024`, then clears that occupied slot through `02061FCC`; do not call its special index -1 path, which clears the pool.

The existing result screen now projects this order, asks for the selected individual to be confirmed or cancelled, and supports:

- Releasing a card individual without creating a Raising ID, writing a Home save, or resurrecting it in the field.
- Staging release of an existing `raising.collection` individual, then atomically saving removal, new capture, cage/care membership and allocator high-water mark together through the existing SavePort.
- Retaining both live Home state and the on-card record when storage fails; retry completes exactly once. Same-species siblings remain intact.
- Scrolling a 16-member list at 390x844, while capacity/save failure messages remain above the fixed Return Home button. Name edits survive opening a release choice.

**Remaining release limitation:** starter/frozen R2 residents cannot yet be released. `raisingHomePersistenceR2.assertResidentSet` requires the fixed resident set and restore reconstitutes it from templates. Those rows are disabled; the app does not hide them with a separate roster/tombstone. Full original replacement support requires a bounded migration of that canonical resident persistence plus selection/actor consumers. No additional Owner authorization is needed for this continuation.

## Verification and next integration gates

- Focused native encounter/Rope/animation observations: **3/3**; capture/save/release cases: **16/16**. Final expanded input/presentation/capture checks: **30/30**.
- Full regression: **940/940** before the final presentation-only alert placement; final focused checks and browser verification cover that placement.
- Browser result fixture: fill name, cancel release, confirm exact Home release, force storage failure, retry, return Home count16 / `Native Seven`. The fixture uses isolated in-memory storage, actual observed encounter data, bounded soft-pull replay and explicit phase inputs. It is labelled research and is never loaded by the product entry.
- Browser normal entry checked separately: New Game -> System/Hunt -> Gate01 list selection -> Loadout -> Begin Hunt -> Return Home. No console errors; all eight Hunt toolbar slots remain disabled. This proves navigation only. Browser actions used the supported mouse/DOM input API at390x844, not physical touch hardware; successful fixture capture is not evidence for normal-entry capture.
- `git diff --check` passes; existing unrelated CRLF warnings are unchanged.

Next work is to port the native tool/sampler/state update path using these reproducible touch vectors, including W+4FC/RNG/AI8 and AI10 behavior; bind each real animation phase completion; migrate the frozen resident-set assumption; then accept one normal Gate0 touch capture-to-Home flow. General encounter initialization and other maps/species remain separate evidence gates.
