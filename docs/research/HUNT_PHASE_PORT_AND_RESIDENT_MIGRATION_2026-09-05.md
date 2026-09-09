# Hunt native phase port and resident membership migration

Status: **PARTIAL — bounded numerical/phase ports and canonical resident release pass; normal Gate 01 capture is not accepted.**

Workspace: `R:/Projects/Championship2026/championship-2026`; Git root is the same, branch `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`, with the pre-existing dirty tree preserved. The Owner authorized this continuation. No additional approval is pending. No assets were promoted and no router, store, save key, Pixi Application or global ticker was added.

## Evidence and scope

Read the root AGENTS/README, Owner Direction, architecture, Current Product Status, Dependency Matrix, Blocker Ledger, HUNT_CAPTURE_DATAFLOW contract and the prior live-capture report before implementation. The evidence MCP query for `02110CAC` returned no hits; primary evidence is direct OVL0/ARM9 disassembly and the existing successful DeSmuME touch replay.

`scripts/research/trace-hunt-native-touch.py` now records the target's AI fields, down countdown, movement restriction, actual AI8 query results and random helper outputs, AI10 collision outcomes, hand controller phase/counter, stroke slots and shape result. It reproduces the same original encounter and uses only stylus input; it never writes emulated RAM or forces an animation completion. ROM and emulator states/screenshots remain private. The semantic receipt is [HUNT_NATIVE_PHASE_REPLAY](HUNT_NATIVE_PHASE_REPLAY_2026-09-05.json).

The target remains actual wild index 7, species 10, source/current/max HP 210 on entry. Wild HP first becomes zero at frame 351; hand readiness begins at 367; card count becomes one at 480. Source and copied card HP remain 210. These are observations of one actual input sequence, not normal-entry browser acceptance.

## Implemented native components

| Component | Original function | Port and validation |
| --- | --- | --- |
| Rope stroke samples | OVL0 `02113F8C` | 20 physical slots; native <=5 distance counter, >20 interpolation, signed Q12 rounding, slot wrap and native count behavior. All 18 actual stylus sample calls match. |
| Stroke shape predicate | OVL0 `02114388` | Physical-slot extrema order, original two-distance thresholds and original center calculation match the successful native shape. This does not itself capture or query a target. |
| AI8 pull-event prefix | OVL0 `02110D00..02110E10` | All 207 observed calls match AI+58/+84/+98/+1B0 and W+4FC, including the exact requested stun RNG sequence. Event11 requests movement mode2; otherwise mode3. No invented universal extra damage. |
| Wild random helper | OVL0 `0210B5E4` | Channel0 parity selects B2 or B3; scale by `(max-1)/102`. Existing native RNG is an explicit port. No fresh encounter seed is fabricated. |
| AI10 entry/movement | OVL0 `02111744`, `02111800` | Nitro integer sqrt/division normalization, native recoil and signed velocity halving. All 15 actual moves match against their recorded native collision outcomes. The branch for a blocked candidate retains position and still halves velocity. |
| Down countdown/shake | OVL0 `0210C01C`, `0210BF2C` | All 15 nonzero countdown updates match exact clock, toggle and actor position. |
| Hand/card controller | OVL0 `021171F0` | All 94 pre-insertion updates match controller phase/counter, with a single card insertion at frame480. |

Implementation: `src/championship/hunt/capture/nativeCapturePhases.js`, `nativeRopeStroke.js`, and the existing `wildCaptureFlow.js`/`huntRuntime.js`. Focused native comparison tests are `tests/championship-hunt-native-phases-cases.mjs`.

### Correction to the earlier “animation completion” description

`0210C034` tests **W+11C > 0**, not a sprite/NANR animation completion bit. AI10 entry starts a 15-update countdown with vertical shake. Its decision checks the clock before the wild update decrements it. Entry into AI11 (`02111E8C`) writes hand-ready W+4F8=1. This actual path leaves W+50C=0; the earlier separate `0210CBBC` W+50C path must not be substituted for AI10/AI11.

Collection entry `0211793C` resets controller phase/counter to zero. Phase0 takes41 updates and hides the field actor at counter10; phase1 takes11; flight phase2 takes31 with counter steps of2; insertion phase3 takes11. The phase3 transition copies the source record once. Phase4 is post-insertion presentation.

The existing capture owner now exposes `tickNativeCapturePhases`, projects the hide-field-actor effect, and inserts through the existing card state only after those phases. Once the native phase clock is active, the historical manual completion APIs cannot advance it early. The result fixture now uses16 down steps and94 hand steps instead of manual down-completion and insertion-subphase injection. This fixture still supplies the actual observed encounter and a controlled soft-pull path; it does **not** validate native tool input or normal-entry capture. Full hand/card graphics and native AI10 actor movement are not yet attached to the production renderer.

## Canonical resident release completed

Nested Raising save schema migrates **v4 -> v5** through the existing R2 module. The outer standalone save envelope/key remains unchanged. v1-v4 validate their historical fixed resident set and their historical integrity domains before migration. v5 stores actual remaining resident membership, including an empty pool with `selectedResidentId:null`. Restore instantiates only the residents in the validated document.

Hunt Result can stage release of an initial resident as well as a collection individual. Release, cage/care cleanup, incoming capture and stable-ID high-water mark are persisted in one existing SavePort transaction. Live membership is published only after storage succeeds. Failure preserves live residents and the pending card; retry does not duplicate the capture. Clock, care, selection and lifecycle reentry cannot replace the session during that transaction.

The outer `creature` field remains the historical initial-selection metadata required by the existing envelope. Living membership comes from canonical residents and collection; identity projection excludes this metadata when its resident has been released. It cannot resurrect that individual after Continue.

Tests cover valid v1-v4 migration, exact v4 calendar precision, old-digest corruption, an invalid truncated v4 roster even with a recalculated digest, v5 empty membership, duplicate/unknown IDs, failed-save retry, selected starter release and Continue. This extension does not claim a complete original training profile or Nintendo DS battery serialization.

## Browser validation

The isolated research result fixture was exercised through actual DOM interactions:

1. Full Home (16) plus one card individual displays the capacity error.
2. Rename card individual to `Gate One Phase`.
3. Open initial resident `DIGITAMA_0` release, cancel, reopen and confirm.
4. Force storage failure and attempt Return Home: card and name remain, save-failure alert is visible.
5. Disable failure and retry: Home count16, initial resident absent, canonical R2 resident count0.
6. Click Reload saved Home: same count, same name, initial resident remains absent.

This is result/save UI validation in the connected browser, not physical touch-device or normal-Gate capture verification. No real user save was overwritten; the fixture owns isolated in-memory test storage. Browser outcome is recorded in `docs/reports/parity-audit/2026-09-05/hunt-phase-resident-browser.json`.

## Verification and remaining work

- Native/clock/capture focused suite: **39/39**.
- Full bounded regression: **951/951**. Final full serial regression after lifecycle guards: **951/951**, using `node --v8-pool-size=1 --test --test-concurrency=1 tests/*.mjs` (44.2 seconds). Default-concurrency and a subsequent bounded run encountered native Node process exits; one explicitly reported `Fatal process out of memory: Zone`. The final serial run completes every file without failures or skipped tests.
- Final save lifecycle guards and phase visibility: **25/25** in the capture/native-phase focused suite, followed by the full serial regression above. The broader clock/capture/native-phase suite is39/39.
- `git diff --check` passes; pre-existing line-ending warnings are informational.

Still **UNKNOWN_REQUIRES_TRACE / UNBOUND**:

1. AI8 movement host `0210D8B4` modes2/3, its native direction/attribute grid and collision/escape branches. The pull prefix alone is not a complete AI8 state update.
2. Native stroke slot animation lifetime, tool selection/edge pan, target query and update order through the normal browser pointer/toolbar. The sampler retains explicit variant/expiry inputs; it does not guess their lifetimes.
3. Normal entry encounter/RNG initialization; the successful before-state replay must not become a hardcoded normal encounter.
4. Native motion plus hand/card visual phases in the shared renderer, and one uninterrupted normal New Game/Continue -> Gate01 -> Rope -> hand -> card -> Result -> Home -> Continue touch acceptance.

The next bounded closure is to record the same target's calls into `0210D8B4` (mode2/3) and its attribute/collision reads, compare that movement host numerically, then attach native tool sampling and phase updates through the existing Hunt owner. Original gameplay evidence, rather than a drawing completion callback, determines the moment ownership changes.
