# Championship 2026 — Technical Debt Register

Reviewed 2026-09-11 against implementation, Claude handoff, original evidence and a real-browser screenshot pass over Raising, Gate, Shop and Database. See [the review](research/CHARACTER_BEHAVIOR_REVIEW_2026-09-11.md). Full character restoration remains open in its stage contract.

Priority = (Impact + Risk) x (6 - Effort), inputs 1–5. Closed items remain recorded to prevent regression.

| Debt | Impact / Risk / Effort | Score | Disposition |
|---|---|---:|---|
| Untraced steering escapes the Hunt ticker | 5 / 5 / 3 | 30 | Closed. The 2026-09-09 live trace already named both consumed words: the wild actor's object address and the ARM9 02047D5C animation return address. The second is a constant, so one word varies, not two. Sweeping it over all 4MB of main RAM at 256-byte steps — 16,385 addresses — puts the steering target in a 3.37-degree cone, entirely down-right, against a direction table whose own entries are 40 degrees apart: no address the allocator can hand out moves the real target as far as one entry of the vocabulary the original steers in. The port now steers at the output the original was observed producing, which sits inside that cone, and captured replays still get their own words exactly. The pause, the fault flag and the interrupted-hunt notice are removed with it. This is bounded equivalence at finer than the original's own resolution, not an identified heap address. See [the sweep](research/HUNT_DIRECTION_ACTOR_SWEEP_2026-09-11.json). |
| Tutorial cursor changes omitted from Save | 4 / 4 / 1 | 40 | Fixed: begin/advance/skip dirty and publish the existing save. Valid older cursors outside the new subset are preserved and reported unavailable. |
| Championship cursor accepts missing/future results or play after loss | 4 / 4 / 1 | 40 | Fixed: exact flag count, terminal loss, malformed progress rejected before RNG. |
| Championship pool initializer overlooked | 4 / 4 / 3 | 24 | Resolved for selection: 28 teams, 824 original selector cases, channel 0. The run is now wired as well — open, draw each round's opponent, record the verdict, settle. |
| Hand browser timer and latched input | 5 / 4 / 2 | 36 | Native classifier/release integrated; blur/navigation/resize/context loss cancel input. Normal hatch/stroke/carry/save accepted. |
| Browser QA overwrites committed reports | 3 / 4 / 1 | 35 | Fixed: shared helper stages under .tmp/browser-qa, deliberate export remains available. |
| Raising gate assumes eggs support adult dragging | 4 / 3 / 2 | 28 | Fixed: ordinary egg taps, hatch, stroke, hold, move, landing and Save/Continue using readonly rendered hit centers. |
| VS3 capture races frame sampling and targets | 3 / 4 / 3 | 21 | Fixed for the acceptance gate: per-render readonly coordinates (previously stale at DOM cadence), fixed startup clock input, twelve sampled circle points, inside-body press, observed native control-frame increments for every sample, actual overlap-selected rope target, blank-ground panning, target-following tether and native slack/durability recovery. Final acceptance is in the validation receipt; earlier artifact failure is retained there. |
| Five screens never joined the bright treatment | 4 / 3 / 2 | 28 | Fixed: Database, Digimon list, Schedule, Help and Tamer info stayed dark because each bright rule named its screens one by one and these were never added. The rule now reads "bright unless Hunt claims it", so the next screen cannot be forgotten. The four list sheets were four copies of one design with their own literals; they now share one token set and hold no literal colours. |
| Bright mobile screens carry three palettes | 3 / 4 / 2 | 28 | Fixed for text, structure, signal and type: Hunt, Shop/Cage/Battle and Raising drew from three drifted light palettes and two type families, now one shared set. Each screen keeps its own scene background, as the original gives each mode its own scene while sharing one chrome. Remaining: colours still sit inline across the other sheets. `--vs2-gold-bright` serving two roles was checked in Chrome and paints no visible text on either bright theme, so it is not split. |
| Status-bar day number vanished on bright screens | 4 / 3 / 1 | 35 | Fixed: it was the one status-bar part recoloured per screen instead of with its bar, so Hunt and Shop kept the dark bar's near-white on a bright bar. It now follows its own bar. Found by screenshotting the four screens, not by reading CSS. |
| Toolbar icons were authored, not original | 2 / 2 / 4 | 16 | Fixed: the icons come from `ui/training_set`, the bank the toolbar contract names, not the similarly named `UI_Icon_training` I tried first. Its three sequences are banks, not animations: labels, then the same eight icons in gold and in grey. The game plays grey and lights only the selected slot gold, so both banks ship and drive rest against aria-pressed/aria-expanded. Slot mapping stays UNKNOWN_REQUIRES_TRACE in the contract; six drawings name their own tool and the open book and door are the seventh and eighth icons in the original's own toolbar (video t030). That is observation, recorded as such, not a trace. |
| Stale completion claims | 5 / 5 / 2 | 40 | Current review supersedes historical claims; stage rows and validation receipt retain proof limits. Arbitrary prose is not automatically regenerated. |

## Existing infrastructure

Node 22 CI, manually dispatched hash-checked public Pages playtest, reuse inventory and architecture documents already exist. Cage effects/assembly and the capture/card/result/Home transaction are implemented with bounded evidence. Older statements describing these as entirely missing are obsolete; complete original equivalence remains governed by subsystem contracts.

## Open restoration obligations

- Raising: evolution hints, original audio, scene peer ordering and full species/condition/visual comparisons.
- Hunt: remaining AI/tool/all-species ordinary capture comparisons. The steering branch is closed to a swept bound; which address a given encounter allocates is still not predicted.
- Championship: the board is reachable from the battle menu, as ui/conference_list_item.nxr is in the original, and it opens, draws, records and settles a run that survives Save/Continue. Each round is still reported rather than fought through the battle runtime, and the board does not yet price entry the way battle_menu/titlematch_top_sub_scene.nxr does. Whether the original's own save carries a run is untraced — see [the receipt](research/CHAMPIONSHIP_RUN_PERSISTENCE_2026-09-11.json).
- Tutorial: cartridge advance predicates and normal UI/event binding; inferred action names are proposals.
- Battle/cross-scene: remaining caller/ending/per-move visual timing, individual transitions and physical-device acceptance.
- Presentation: the celebration platter, cake and the toolbar icons are still authored art with no original counterpart promoted; spoiled food, waste and the sweep now use the original cells.

Public playtest permission is recorded. Commercial rights, complete original parity and device acceptance are separate open gates, not made true by fixing debt or pushing main.
