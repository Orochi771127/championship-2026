# Championship 2026 — Technical Debt Register

Reviewed 2026-09-11 against implementation, Claude handoff and original evidence. See [the review](research/CHARACTER_BEHAVIOR_REVIEW_2026-09-11.md). Full character restoration remains open in its stage contract.

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
| Stale completion claims | 5 / 5 / 2 | 40 | Current review supersedes historical claims; stage rows and validation receipt retain proof limits. Arbitrary prose is not automatically regenerated. |

## Existing infrastructure

Node 22 CI, manually dispatched hash-checked public Pages playtest, reuse inventory and architecture documents already exist. Cage effects/assembly and the capture/card/result/Home transaction are implemented with bounded evidence. Older statements describing these as entirely missing are obsolete; complete original equivalence remains governed by subsystem contracts.

## Open restoration obligations

- Raising: evolution hints, original audio, scene peer ordering and full species/condition/visual comparisons.
- Hunt: encounter-specific steering scratch producer and remaining AI/tool/all-species ordinary capture comparisons. Recovery is not original movement parity.
- Championship: normal entry/schedule/round transitions, owned party/result/save and presentation integration.
- Tutorial: cartridge advance predicates and normal UI/event binding; inferred action names are proposals.
- Battle/cross-scene: remaining caller/ending/per-move visual timing, individual transitions and physical-device acceptance.

Public playtest permission is recorded. Commercial rights, complete original parity and device acceptance are separate open gates, not made true by fixing debt or pushing main.
