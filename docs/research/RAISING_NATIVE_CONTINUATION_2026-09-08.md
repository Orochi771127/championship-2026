# Raising continuation: original writers and normal opening flow

This is a continuation of the Owner's instruction to finish the open work in the current two-stage scope. The overall scope remains **PARTIAL**. A CPU comparison is evidence for a writer under its stated inputs, not acceptance of an entire playable system.

Product root: `R:/Projects/Championship2026/championship-2026`; `main`; HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`, with shared uncommitted work preserved. Original source SHA-256: `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`. Private ROM, RAM, original screenshots and checkpoints remain under `R:/Projects/Championship2026/_archive/raising-completion-2026-09-08/`. No original payload was copied into a new runtime asset bundle.

## Direct observations and original CPU comparisons

| Evidence | Original path and demonstrated result | Acceptance limit |
| --- | --- | --- |
| Live food placement | Existing original Home checkpoint; Feed selection then ground placement. Food stock 45 → 44. Species 21 consumed 12 one-unit bites; satiety 5 → 8. | HP was already at its 400 cap. This observation does not prove positive HP recovery. Healthy medicine clicks did not consume stock. |
| Care CPU | `0211837C`, `0211490C`, `02116348`: 168 food, 90 condition and 140 treatment cases; complete starter constructor also executed. | Food position/selection/state transitions, tool inventory caller and treatment FX remain separate dependencies. |
| Form merge CPU | `02062DA8`: 1,824 complete merges, 228 source species × 8 cycle counts. | Does not select an adult evolution destination. Includes the native exceptional cycle-99 bonus, inherited values, history and HP/TP refill. |
| Hatch CPU | `0211E194`, `0211C7C4`, `02116DB8`: 80 clock, 288 egg-state and 408 ancestry-selection cases. | Age thresholds, touch ordering, animation completion and scaled channel RNG are covered; full Home actor initialization/idle RNG is not covered. |
| Growth CPU | Complete `02114A10`: 768 original calls. Hunger, sleep/activity, illness, environment timers, condition effects, recovery and warnings match the JS writer. | Explicitly zero actual peer-list scenarios. Movement/state selection, social lists, environmental inputs and normal app binding are not complete. |
| Book CPU | `02116A20` called with old species -1 for all 228 record indices. | 216 regular registrations are proven. The additional old-to-new evolution-branch flag writer is not ported. |

Receipts: `RAISING_CARE_CPU_CHECK_2026-09-08.json`, `RAISING_EVOLUTION_CPU_CHECK_2026-09-08.json`, `RAISING_HATCH_CPU_CHECK_2026-09-08.json`, `RAISING_GROWTH_CPU_CHECK_2026-09-08.json`, `RAISING_BOOK_CPU_CHECK_2026-09-08.json`. Reproducible harnesses are in `scripts/research/check-raising-*-cpu.py`. These research receipts are not shipping assets.

## Implemented normal opening flow

New Game now uses the original species-zero constructor and its native random name and individual fields. The starter writes `140=14`, `1c0=128`, `1c4=120` as in `0206178C`. There is no invented fixed starter HP or stat profile.

The existing application clock advances the child Raising actor. Eggs use the original two-minute age accumulator, threshold strictly greater than 60, and three released short touches. The phase check precedes the new touch count. Native sequence 1 completes before ancestry selection, construction and merge. The individual ID remains stable; the new form/profile is saved inside the same version-5 envelope and storage key. Older saved names remain unchanged.

The existing character roster lazily loads the new form's Main atlas, projects native frames, deduplicates shared entities and waits for pending decode/unload on disposal. It introduces no renderer, ticker, save or asset authority. All appearance/rights gates remain as before.

Normal app tests cover both time-based and three-touch hatching, presentation source updates, same identity, Save/Continue, profile equality and subsequent RNG state. Browser evidence covers visible egg → three Hand clicks → cracked egg → hatched form, Save/Continue and registered book entry. The latest browser run was 1280×720 with a 430-pixel game area; it is not physical-device touch acceptance. The exact hatch completion instant between screenshots was not measured. The older time-based browser receipt separately records the restored HP/TP; the latest immediate Continue click occurred before actor selection and is not claimed as a restored-vitals observation.

## Encyclopedia correction

The old 224-slot book was inferred from the art inventory and was incorrect. OVL16 creates exactly `0xD8` (216) rows at `0210BDAC`; `0210BE74` reads PlayerData `+0x4EE+ordinal`, and `0210BE78` reads the corresponding species from the ARM9 table at `020EF09C`. `02116A20` scans this same 216-entry table when hatching. The original save pack/restore reads and writes these flags at `0206DC88` / `02074124`; initialization clears them at `02067BF8`.

The 216 entries cover species records 8..223 in original book order, not numerical species order. Eggs 0..7 and duplicate records 224..227 are absent. The product now uses this order, separates `bookOrdinal` from `speciesIndex`, accepts high species IDs such as 223, removes the invented egg filter, and retains registration under `progression.registeredSpecies`. Hatching updates it; the existing capture-to-Home save transaction carries newly held species and publishes only after save success. Legacy compatibility retains currently held known regular species; previously lost history and unknown evolution-branch flags are not invented.

## Remaining structural work

**Later same-day update:** The native positions, physical pool slots, actor entry RNG, food/approach/eating/Clean and valid-drop membership subset below is now implemented and accepted as the bounded [Feeding slice](RAISING_FEEDING_STAGE_2026-09-08.md). The following paragraph records the pre-Feeding state; it is superseded for those completed fields. Full peer/environment/training and remaining actor lifecycles are still open.

The renderer still positions Home occupants using product display lanes. `cageBounds` explicitly keeps these lanes in Waiting Room and does not infer original training-module membership. Therefore it is not valid to use those lanes as original food distance, collision, sleep, infection or training inputs. `nativeRaisingGrowth` remains deliberately unbound until those actual callers are implemented.

Concrete original leads for the remaining work:

- `02111124`: actor initialization, physical pool slot, starting facing/direction RNG; `02117C4C`: idle entry and its own RNG draw. Current frame projection must not consume these draws lazily.
- `0211837C`: food approach/eating/interruption/leave states. Request 14 begins within the native distance check; only the animation's frame-1 edge consumes a bite. Food placement and clean removal require their native object lifecycles.
- `0210F0B0` / `0210F324`: wound/illness toolbar callers. Quantity is decremented only for a regular species with an accepted command and the corresponding condition; treatment failure still consumes one. States 9 and 20 reject another treatment.
- `0211BE5C` / `0211BEC0`: treatment state 20 waits for native effect completion or counter >60, then resumes sleep states or the reaction selector. The effect's raw sequences are 4 on success and 3 on failure; this is not a character animation alias.
- `021160C8`: Cage condition effect list construction. `02114A10` also refreshes peer/infection/dirty-environment lists; the zero-peer CPU result cannot stand in for those lists.
- `02112734`: adult evolution eligibility; `021164E4`: lifetime/rebirth decision. Adult form selection, lifetime and removal are not implemented by the tested form-merge helper.
- Physical Home slots must survive holes caused by releases; compact instance enumeration is not sufficient for all per-slot channels.

Own-party ENTRY/eligibility/writeback, natural rank/license progression, carried Hunt entry/AI7, full event visuals/audio, successful browser touch capture, long-running/context recovery, physical devices and approved replacement art remain open as in the two-stage scope. These are implementation/evidence gaps, not a request for renewed implementation authorization.
