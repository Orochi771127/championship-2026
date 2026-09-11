# Championship 2026 — Technical Debt Register

Reviewed 2026-09-11 against implementation, Claude handoff, original evidence and a real-browser screenshot pass over Raising, Gate, Shop and Database. See [the review](research/CHARACTER_BEHAVIOR_REVIEW_2026-09-11.md). Full character restoration remains open in its stage contract.

Priority = (Impact + Risk) x (6 - Effort), inputs 1–5. Closed items remain recorded to prevent regression.

| Debt | Impact / Risk / Effort | Score | Disposition |
|---|---|---:|---|
| Untraced steering escapes the Hunt ticker | 5 / 5 / 3 | 30 | Crash contained: explicit pause, tools/clock stop, completed card entries survive normal exit. Exact source producer remains unknown; no constant heap address substituted. |
| Tutorial cursor changes omitted from Save | 4 / 4 / 1 | 40 | Fixed: begin/advance/skip dirty and publish the existing save. Valid older cursors outside the new subset are preserved and reported unavailable. |
| Championship cursor accepts missing/future results or play after loss | 4 / 4 / 1 | 40 | Fixed: exact flag count, terminal loss, malformed progress rejected before RNG. |
| Championship pool initializer overlooked | 4 / 4 / 3 | 24 | Resolved for selection: 28 teams, 824 original selector cases, channel 0. Full tournament flow still open. |
| Hand browser timer and latched input | 5 / 4 / 2 | 36 | Native classifier/release integrated; blur/navigation/resize/context loss cancel input. Normal hatch/stroke/carry/save accepted. |
| Browser QA overwrites committed reports | 3 / 4 / 1 | 35 | Fixed: shared helper stages under .tmp/browser-qa, deliberate export remains available. |
| Raising gate assumes eggs support adult dragging | 4 / 3 / 2 | 28 | Fixed: ordinary egg taps, hatch, stroke, hold, move, landing and Save/Continue using readonly rendered hit centers. |
| VS3 capture races frame sampling and targets | 3 / 4 / 3 | 21 | Fixed for the acceptance gate: per-render readonly coordinates (previously stale at DOM cadence), fixed startup clock input, twelve sampled circle points, inside-body press, observed native control-frame increments for every sample, actual overlap-selected rope target, blank-ground panning, target-following tether and native slack/durability recovery. Final acceptance is in the validation receipt; earlier artifact failure is retained there. |
| Five screens never joined the bright treatment | 4 / 3 / 2 | 28 | Fixed: Database, Digimon list, Schedule, Help and Tamer info stayed dark because each bright rule named its screens one by one and these were never added. The rule now reads "bright unless Hunt claims it", so the next screen cannot be forgotten. The four list sheets were four copies of one design with their own literals; they now share one token set and hold no literal colours. |
| Bright mobile screens carry three palettes | 3 / 4 / 2 | 28 | Fixed for text, structure, signal and type: Hunt, Shop/Cage/Battle and Raising drew from three drifted light palettes and two type families, now one shared set. Each screen keeps its own scene background, as the original gives each mode its own scene while sharing one chrome. Remaining: colours still sit inline across the other sheets, and `--vs2-gold-bright` still serves both as on-dark text and as a bright fill. |
| Status-bar day number vanished on bright screens | 4 / 3 / 1 | 35 | Fixed: it was the one status-bar part recoloured per screen instead of with its bar, so Hunt and Shop kept the dark bar's near-white on a bright bar. It now follows its own bar. Found by screenshotting the four screens, not by reading CSS. |
| Stale completion claims | 5 / 5 / 2 | 40 | Current review supersedes historical claims; stage rows and validation receipt retain proof limits. Arbitrary prose is not automatically regenerated. |

## Existing infrastructure

Node 22 CI, manually dispatched hash-checked public Pages playtest, reuse inventory and architecture documents already exist. Cage effects/assembly and the capture/card/result/Home transaction are implemented with bounded evidence. Older statements describing these as entirely missing are obsolete; complete original equivalence remains governed by subsystem contracts.

## Open restoration obligations

- Raising: evolution hints, original audio, scene peer ordering and full species/condition/visual comparisons.
- Hunt: encounter-specific steering scratch producer and remaining AI/tool/all-species ordinary capture comparisons. Recovery is not original movement parity.
- Championship: normal entry/schedule/round transitions, owned party/result/save and presentation integration.
- Tutorial: cartridge advance predicates and normal UI/event binding; inferred action names are proposals.
- Battle/cross-scene: remaining caller/ending/per-move visual timing, individual transitions and physical-device acceptance.
- Presentation: the celebration platter, cake and the toolbar icons are still authored art with no original counterpart promoted; spoiled food, waste and the sweep now use the original cells.

Public playtest permission is recorded. Commercial rights, complete original parity and device acceptance are separate open gates, not made true by fixing debt or pushing main.
