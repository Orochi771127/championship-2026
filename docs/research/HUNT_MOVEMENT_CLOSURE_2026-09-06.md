# Original Hunt movement host: observed path closure

Status: **PARTIAL — the observed no-follow movement path matches; normal Gate01 capture remains unbound.**

Workspace/Git root: `R:/Projects/Championship2026/championship-2026`, branch `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. The pre-existing dirty worktree is preserved. Owner authorized continuation of Gate01 capture and original emulator operation. No commit, push, shipping asset promotion or additional application/save/ticker authority.

## Original emulator operation

The requested `C:/Users/USER/Downloads/DS/DeSmuME_0.9.13_x64.exe` was already running. Computer Use discovered one DeSmuME window. Its first capture reported minimized; after activation, Windows capture failed with `SetIsBorderRequired: E_NOINTERFACE (0x80004002)`. No successful visual GUI gameplay is claimed. No Win32 screenshot or PowerShell UI automation workaround was used.

The installed research-only py-desmume interface uses the DeSmuME 0.9.12 library and successfully loads the existing 0.9.13 `.ds4` state, as in the prior round. This is an independent emulator session, not remote control of the visible 0.9.13 GUI. The exact owner ROM is copied into the private research directory, its SHA checked, the source state loaded read-only, and the original CPU advanced with stylus inputs. GUI/player save files are not written by this replay. The emulator reports no writable battery save and operates in RAM; this run does not prove original battery-save behavior.

ROM SHA-256: `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`.
Source `.ds4` SHA-256: `3b1a13a0e517722f094d0a6454f773a3b2f55b6f0b0994d4788447b5650940ae`.
Private output: `R:/Projects/Championship2026/_archive/hunt-movement-2026-09-06`.

The original successful touch sequence again reaches wild HP210 -> HP0 -> hand readiness -> card count1. Card species10 retains source HP210/maxHP210. The script reads the target's actual position to aim; it does not pretend these are unassisted human inputs. No DeSmuME RAM writes, injected spawn/HP/RNG values, or forced animation completion occur.

## New read/write chain

`scripts/research/trace-hunt-native-touch.py --movement-out ...` optionally installs `hunt_movement_observer.py`. It observes the selected target only, pairs each `0210D8B4` entry with its actual LR return, and records signed Q12 positions, direction, destination, speed, flags, terrain reads and final actor writes. Scratch obstacle vectors are read only when their writer branch returned1; uninitialized stack bytes are not treated as a vector.

The [actual movement receipt](HUNT_MOVEMENT_REPLAY_2026-09-06.json) contains:

| Observation | Count / result |
| --- | --- |
| AI8 movement, mode3 | 206 calls |
| AI8 movement, mode2 | 1 call |
| AI11 movement, mode2 | 1 call |
| Direction attribute reads | 206; observed bytes7/8/9; grid128x128 |
| Terrain queries | 208; terrain result0 |
| Obstacle / secondary-blocked results | All zero on this actual trajectory |
| Follow flag / target | Both zero throughout this trajectory |

Correction to possible ambiguity: `02111420` is the movement callback for this AI8 path. It selects mode3 when AI+84 is zero and mode2 otherwise. The separate `02110CAC` AI8 logic callback and its event prefix do not themselves implement this movement. The new trace records their actual downstream movement rather than inferring it from a prefix field.

Mode3 reads the direction attribute at the actor's current 8-pixel cell through ARM9 `02088048`, decodes the low-nibble direction and high-bit steering behavior, normalizes with the existing exact Nitro helper, scales by speed and pull13, then evaluates the candidate position. Mode2 uses the destination vector and native three-pixel scale. It does not reuse an arbitrary browser movement speed.

The terrain lookup `0207C9E8` can wrap coordinates when its grid flag is1; its byte decoder `0207CA74` checks bits in order. The movement host separately checks the candidate tile bounds. Direction-grid bytes and terrain-grid bytes are different inputs; neither can be replaced by the prototype seeded collision grid just because both are grids. The producer and update lifetime of the normal direction grid are not established by observing these reads.

## Implemented port and limits

`src/championship/hunt/capture/nativeHuntMovement.js` contains pure modes2/3 movement with:

- Exact direction literals, steering flag precedence and Q12 rounding; reuse of existing Nitro normalization and length helpers.
- Explicit direction/terrain grid readers, signed pixel-to-tile conversion and ordered terrain bit tests.
- Candidate movement, facing/terrain-pose projection, map exit position writes and distance/footstep threshold projection.
- Mandatory terrain and controller result ports. No default prototype collision or guessed clear-path result.
- Rejection of follow targets/flags, unassigned low-nibble12..15 direction branches and unclosed obstacle/controller effects before any caller-state mutation.

All208 observed calls match normalized direction, movement delta, candidate position and the complete recorded final movement snapshot, including position, destination, facing, terrain pose, activation and distance accumulator. This is a **pure port tested against original observations**. It is not yet imported by the normal Hunt owner, does not enable the toolbar, and does not change the normal scene's capture availability. No claim is made that supplying recorded collision results is a complete implementation of those controllers.

The sound event's full sound ID/panning/render binding is not implemented; only its movement-distance threshold is projected. Actual dynamic trap/controller side effects, target-follow paths and unobserved AI transitions remain separate tracing work. The map exit/terrain-block branch structure is translated from instructions but is not exercised by this live trajectory.

## Controlled CPU checks and validation

`scripts/research/check-hunt-movement-cpu.py` performs **synthetic input probes in isolated Unicorn memory**. This is intentionally separate from the untouched DeSmuME touch replay. It verifies the exact source-state SHA, executes original instructions, and asserts that every probe reached its stop/return rather than exhausting its instruction budget.

The [CPU receipt](HUNT_MOVEMENT_CPU_CHECK_2026-09-06.json) contains96 direction combinations (12 low-nibble vectors, four flag combinations, two prior vectors), and32 grid cases checked against both native readers. The JS tests match all96 steering vectors and64 reader results, including negative/outside coordinates, wrap and overlapping bits. Repeating the CPU generator produces an identical SHA-256 receipt.

- Focused movement + native phase tests: **13/13**.
- Full serial regression: **956/956**, no failures/skips/todos, `node --v8-pool-size=1 --test --test-concurrency=1 tests/*.mjs` (54.4 seconds).
- Tests: `tests/championship-hunt-movement-cases.mjs`.
- Validation receipt: [movement validation](../reports/parity-audit/2026-09-06/hunt-movement-validation.json).

## Next dependency and acceptance

The earlier instruction to trace this same target's movement host has now produced a bounded numerical port and actual-position proof. The next work is to attach it through the existing Hunt owner **with a verified direction/terrain/controller source and original update order**, then close normal tool selection, input edges, stroke-slot lifetime and target queries. Normal encounter/RNG initialization beyond the recorded before-state also remains open. The successful capture recording must not be installed as a fixed normal encounter.

Normal Gate01 -> Rope/pull -> HP0/down -> hand -> card -> Result -> Home -> save -> Continue remains the milestone. The previous result/full16/release/save-failure fixture remains useful regression evidence, but it cannot replace that normal-entry acceptance. `normalEntryCapturePlayable` stays false.
