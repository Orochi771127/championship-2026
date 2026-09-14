# Hunt capture light — bank and state binding (partial)

Date: 2026-09-14. ROM SHA-256 `8ad375ba…c5d1`. Status: `PARTIAL` — the light's bank, sequence and draw loop are `VERIFIED_BINARY`; the flight into the tool rail is `UNKNOWN_REQUIRES_TRACE`. No runtime change.

## Proven

- **Bank.** OVL0 `0211A144` loads the string `e002_hunt` and calls ARM9 `02065D3C`, which replaces the common pool `+0x110` (see `ASSEMBLED_EVOLUTION_ART_BINDING_2026-09-13.md`). In Hunt, the common bank is `common/e002_hunt`, not a tool family such as `e002_hunt_digicach`; the tool families are named only in the ARM9 table at `020C97BC..020C9F60`.
- **Owner object.** An OVL0 Hunt actor class (constructor `02114D24`, vtable `0x02129D90`) initializes animators at `+0x68`, `+0x13C`, `+0x210`, `+0x2EC` and `+0x3C0`. Its setup (`02114E44..02114E58`) registers a 28-entry handler table at `0x02129DA0` through ARM9 `02043E0C`, then `021155C8`, whose `02115628..02115634` binds `+0x3C0` to the common pool with `02065DF4`.
- **Trigger.** Table entry 25 is OVL0 `021160C8`: sound `0x405` (`0203EA30`, volume `0x7F`), flag `+0x41B` = 1, force-start sequence `0x1D` (29) on `+0x3C0`.
- **Draw loop.** OVL0 `02114EA4` runs every update: while `+0x41B` is set, it places `+0x3C0` at the actor's resolved position (`020669B8` → `0210C18C` → `02048164`), advances one tick (`02047A08`, `0x1000`), submits (`0211DC1C`, `0, 0`), and clears `+0x41B` once the animator reports finished (`02047C48`).
- **Pictures.** `common/e002_hunt.nanr` holds 30 sequences; sequence 29 is four frames of five ticks, cells 132–135 (research conversion `YDIJ_PRIVATE_ROM_ART_PACK/08_FULL_FAMILY_CONVERSION/common/e002_hunt/animations.json`; the assembled pack has all 136 cells). About 20 ticks, drawn at the actor.

## Not proven

- Which Hunt actor this class is (wild or hand) is not named by a trace.
- The existing presentation (`src/championship/presentation/vfx/captureStorageVfx.js`) follows the collection controller's phases (condense 30, lift 10, flight 60, arrival 10) as observed in `video3.MOV`. The 20-tick light above cannot account for the lift and flight. A second OVL0 class (constructor `02116110`, vtable `0x02129E88`, animator `+0x3C4`, paired animators at `+0x21C`) is the next candidate; its bank binding and the controller's draw calls are untraced.
- `common/e002_hunt` is not part of `hunt-feedback-v1` (19 tool banks); integrating it would need a new local-reference art registration.

Replacing the observed orb with only the 20-tick light would lose the traced controller timing, so the runtime keeps the current presentation until the flight object is traced.

## Trap recorded

OVL0 and OVL18 both load at `0x0210B300`. A branch or pointer scan across all modules reports false cross-overlay callers: OVL18 `021160C8` (cage condition effect list, `RAISING_NATIVE_CONTINUATION_2026-09-08.md`) is unrelated to OVL0 `021160C8`. Scan one overlay at a time.
