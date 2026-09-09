# One-stage playable Raising feeding

Owner continuation: 「OK 開始吧 一個階段就請你做好完成」. This accepts the immediately proposed Home position / Cage membership / actor-state -> food -> approach/eating -> individual/inventory Save slice. This document closes that playable feeding scope. Full Raising, training, adult evolution and the complete game remain PARTIAL.

Repository checked at start: `R:\Projects\Championship2026\championship-2026`, branch `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. The shared worktree was already extensively dirty; the pre-existing deleted `entities.r1.json` was preserved. No commit, push, merge, deployment or release was performed.

## Original evidence and translation

Private inputs: verified YDIJ ROM SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`; `R:\Projects\Championship2026\_archive\raising-completion-2026-09-08\trace02\latest.ram`; art reference pack `R:\Projects\Championship2026\YDIJ_PRIVATE_ROM_ART_PACK`. The existing ROM/video audit is continued; no new claim of watching the complete Bilibili movie is made in this implementation record.

The evidence MCP was queried before additional tracing. An address search returned an OVL0 entry at the same address as the OVL18 food handler; it was not treated as Raising evidence. The exact OVL18 disassembly, live RAM and complete original CPU calls below supplied the mechanical evidence.

| Original boundary | Implementation and evidence |
| --- | --- |
| `020502D8`, existing ranch compositor | Original Cage origin, upper-row crop, wrap and actual ground ownership. Numeric terrain/clearance/owner writes match the existing tile compositor at all four ranch sizes. No render tile IDs enter the functional catalog. |
| `02111124`, `02117C4C` | Physical Home pool index, two initialization draws on channel `0x26 + slot`, followed by the adult idle draw. Positions and RNG are initialized by the app, not by a frame read. |
| `020500BC` | Original source-clearance spawn, rejection draws and threshold reduction: 72 complete CPU cases. |
| `02112408`, `02111480..0211155C` | Blocked adult entry correction: original search order, central row restriction and fallback RNG. 32 complete CPU cases include the fallback path. Starting-Cage probes across 30 seeds now avoid blocked terrain. |
| `0207C9E8`, `0207CC24` | Raising terrain uses query mode 1, wrapping both indices. Clearance is separately bounded. CPU boundary tests exposed and corrected an earlier bounded-terrain assumption. |
| `0210D8E8`, `0210DB80` | Feed and Protein use the same ten-slot food pool; accepted placement debits one unit in the existing inventory. Inclusive object hitbox prevents a second placement at the same point. |
| `0210B834`, `0210BA54` | Sixteen portions, freshness 1440, Cage-relative Q12 save coordinates, restore into the committed Cage. Station occupancy and animation remain transient. |
| `0210B6E4`, `0210C09C` | Original food fall/bounce, landing notification and 30-frame fresh-food notification. The observed food body lands on its 22nd update. |
| `021154F8`, `0210BD5C` | Illness/full-belly guard, nearest food in the actor's Cage, allowed quadrants and free-station selection. 400 complete CPU station cases cover ties and occupancy. |
| `02111A40`, `021122CC` | Food approach modes 0/1 and obstruction recovery. 64 complete original CPU movement calls cover state, slow/fast and terrain variants; other Raising motion modes are not claimed. |
| `0211837C`, `02115660` | Native walk/eat animation, individually rounded Q12 distance terms, station claim and eviction, frame-1 bite latch. Existing 168-case CPU bite writer now has a normal gameplay caller. |
| `021188C4`, `02116448` | Full-belly exit increments individual `020` by 2 with 0..100 clamp, then writes `00c = trunc(178 / 10) * 8`. Both are applied once on exit. |
| `0210C188`, clean command `82` / notification `8A` | Clean removes remaining food and interrupts its consumers without refund. Spoiled-food presentation is retained; broader spoiled-food reaction broadcasts and environmental AI remain outside this slice. |
| `02119280..021192A0` | Valid hand drops write the settled Cage membership and position, and release an active food target. Complete carry/throw/bounce and subsequent Cage effect programs are not represented as complete. |

The new private live trace is `R:\Projects\Championship2026\_archive\raising-feeding-stage-2026-09-08`. Starting from the prior food menu state, one touch at (119,67) created a food object at native (125,68), debited stock 45 -> 44, produced the landing callback at tick 22, search calls at ticks 31/61/91 and request 14 at tick 117. The one-tick difference between object updates and global trace ticks is retained in the record. Previous capped-HP samples do not prove positive healing; the heal writer is supported by controlled CPU comparisons.

Reproduction of the new oracle:

```powershell
python scripts/research/check-raising-feeding-cpu.py --rom <private-YDIJ.nds> --ram <private-trace02/latest.ram> --out docs/research/RAISING_FEEDING_CPU_CHECK_2026-09-08.json --ground src/data/championship/catalogs/raising-ground.r1.json
```

The oracle executes the original ARM9/OVL18 mechanical functions. Hardware divide/square-root registers are emulated; audio is stubbed. Spawn/search RNG supplies recorded channel values. No source sprite, palette, map image or binary is installed by this work.

## Normal application and presentation

The existing standalone app owns food, actor state and physical pool slots. Existing `shopRuntime` records 0/1 own stock. The existing natural clock drives Raising; Shop and other paused screens do not advance food or actors. `nativeProfile` remains the individual authority. The optional `raising.nativeHome` child is saved in the existing version-5 envelope and storage key; it does not create another save authority.

The existing DOM tools show Feed/Protein quantities. Short ground taps place food; swipes pan. Clean removes remaining food. Native positions and sequence 14 drive the existing character renderer. Current/max HP replaces the previous maximum-only readout on the existing panel. Food uses independently drawn Pixi shapes for ordinary/protein, four remaining-amount stages, bounce and spoilage. This is functional presentation, not acceptance of a final original-equivalent food art/audio set.

Browser QA found that decorative ranch tiles intercepted events intended for the backdrop. Ground input was moved to the existing scene root, while actor input still stops propagation. The normal click then created food and changed Feed 50 -> 49. There is still one canvas, one Pixi application and its existing ticker.

Adult Continue follows the original Home entry spawn; it does not promise to freeze an adult at its pre-Save screen pixel. The individual, Cage, food coordinates/portions/freshness, inventory and RNG persist. Loading a known native individual advances its original entry channel and correctly makes the save dirty. Historical saves without a native profile remain unknown rather than gaining an invented profile or RNG history.

## Validation and acceptance

Focused tests cover CPU station/movement/spawn/search parity, four ranch sizes, bounce/pulse cadence, New Game/hatching/food/bites/Save/Continue, shared ten-food pool, invalid placement, paused screens, Clean, same-Cage filtering, valid hand relocation, four simultaneous consumers, full-belly writers, malformed food saves, failed writes and retries. Regression expectations now include the verified Home entry RNG calls; legacy fixtures remove post-v4 native fields instead of creating an impossible historical hybrid.

Normal browser QA used `http://127.0.0.1:8876/championship.html`, without fixture state injection: New Game -> Hand short touches -> hatch -> Feed/Protein ground placement -> approach/eating and visible portion reduction -> Save & Quit -> Continue. A previous pass also observed food fully disappear after consumption. Clean was exercised on a restored protein object with quantity remaining 9. The 360 x 640 viewport had document width 360, all eight tools visible and exactly one canvas. This is browser viewport QA, not physical-device acceptance.

Screenshots: `docs/reports/parity-audit/2026-09-08/feeding-mobile-placement.png`, `feeding-mobile-consumed.png`, `feeding-mobile-restored.png`. Exact command results and acceptance flags live in `feeding-stage-validation.json`; raw logs are alongside it.

## Remaining boundaries

The playable feeding slice is complete. Full idle/wander/sleep behavior, peer/environment/infection/training inputs, complete carry/throw and Cage reaction programs, medicine/wound-tool state machines, adult evolution eligibility, lifetime/rebirth, overnight food behavior and non-toolbar kind-2 food remain separate original lifecycle work. The bounded valid-drop writer does not assert that entering a training Cage has all original consequences. Own-party battle entry/writeback, long-term progression and wider game/art/device completion remain governed by the overall status documents.

The original food sprites/sounds, complete food-landing mood overlays, physical touch-device QA and shipping approval are not accepted by this record. Existing art registrations and release boundaries remain unchanged. The pre-existing public build input deletion continues to block public Pages delivery.
