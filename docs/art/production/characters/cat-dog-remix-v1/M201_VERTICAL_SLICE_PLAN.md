# M201 Motion-Compatible Remix Vertical Slice

Status: `TECHNICAL_RUNTIME_REVIEW_ACTIVE / 14_OF_47_UNIQUE_VISUALS / NOT_RUNTIME_ELIGIBLE`

This is the first end-to-end production proof for the 224-slot licensed remix
pack. It keeps the stable entity ID `m201_agumon` and every verified original
animation contract while replacing only the presentation artwork with the A1
dog-led design direction.

## Why M201 is first

- It is one of the eight A1 character-direction references.
- A1 panel 01 explicitly maps its third design to `CHARACTER:M201` and `DOG`.
- Its source set stresses locomotion, four attacks, Raising reactions,
  restraint states, training, victory, knockout, Main/Sub banks, and both
  single-frame and multi-frame playback.
- The ROM and converted runtime contract have already been compared exactly:
  Main is 65 cells / 40 sequences and Sub is 18 cells / 13 sequences, with no
  cell, duration-tick, playback-mode, or ordering mismatch.

## Locked sources

- ROM SHA-256:
  `8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1`
- Visual direction:
  `docs/art/proposals/a1-character-direction/a1-character-direction-panel-01.png`
  (SHA-256
  `AA4592703FE0FCD79CAEE5FBD04B191993AC85024892399FD8E8184F6693A75A`).
- Motion contract:
  `docs/art/production/characters/faithful-hd224/batch-02/m201_agumon/runtime.json`.
- Source-pose witnesses: the Main/Sub atlas cells and manifests under the same
  `m201_agumon` directory.

The A1 board supplies identity, breed language, palette family, hand-drawn
finish, and surface design. It is not scaled or cropped into the game.

## Non-negotiable runtime geometry

- logical canvas: `384 x 352` RGBA;
- ground line: `y = 320`;
- anchor: `(0.5, 0.9090909090909091)`;
- facing, limb topology, foot contact, action origin, and pose intent match the
  source cell;
- all 65 Main and 18 Sub cell keys remain stable;
- all 40 Main and 13 Sub sequences retain original cell order, duration ticks,
  and playback mode;
- left-facing presentation mirrors around the anchor instead of creating a
  second conflicting animation set.

Do not convert source ticks to a fixed FPS animation strip. The exact tick
values remain authoritative; the wall-clock tick rate stays configurable until
the executable timing trace closes the current provisional 60 Hz assumption.

## Effective production sequence

### Gate 0 — evidence lock (complete)

ROM identity, file family, Main/Sub cell counts, sequences, duration ticks,
playback modes, atlases, alpha, and anchor have passed deterministic validation.

### Gate 1 — approved seed cell

Redraw Main cell 000 using the A1 third design while keeping the source pose and
ground contact. The seed must be a true transparent `384 x 352` master, not a
large square concept render. Review at native game scale and 4x inspection.

Exit checks:

- recognizable as the A1 dog-led identity;
- source major yellow/cream palette family retained;
- exact canvas, alpha, anchor, facing, limb count, and foot positions;
- no background, label, shadow baked into the sprite, or source pixel paste.

### Gate 2 — twelve high-risk key poses

Create one controlled strip for each related motion family rather than
generating unrelated frames. The first review set uses Main cells:

| Cell | Source action role |
| ---: | --- |
| 000 | idle identity seed |
| 004 | walk |
| 006 | run |
| 009 | hurt |
| 011 | attack 1 |
| 015 | attack 3 |
| 023 | sleep |
| 049 | happy |
| 053 | victory |
| 056 | training |
| 062 | knocked out |
| 063 | jump/hit action |

Exit checks include shared scale, unchanged ground contact where the action
requires it, stable head/body volume, readable paws and face at in-game size,
and no frame-to-frame identity drift.

### Gate 3 — complete the 83-cell master

Expand from approved motion families in this order:

1. Main 000–010: idle, locomotion, alert, and hit reactions;
2. Main 011–018: four attack families;
3. Main 019–043: flee, tired, sleep, eat, rest, and restrained variants;
4. Main 044–064: zap, emotions, victory, guard, training, shout, knockout;
5. Sub 000–017: preserve raw slot IDs without inventing unsupported labels.

Every cell is drawn on the same logical canvas. Cosmetic ear, fur, and tail
extensions may exceed the source silhouette, but feet, hands, attack endpoints,
and interaction-critical extremities must remain within the approved tolerance
overlay. If a design cannot satisfy the motion, simplify the design; never move
the original gameplay pose to fit the concept art.

### Gate 4 — atlas and animation contract

- pack RGBA masters into PixiJS v8 atlases no larger than `2048 x 2048`;
- preserve stable texture keys and Main/Sub separation;
- copy the original NANR sequence data without timing normalization;
- validate all frame references, hashes, alpha boundaries, logical canvas,
  anchor, and atlas-page dimensions;
- create native-scale, 4x, and checkerboard contact sheets.

Technical review checkpoint: a non-promotable hybrid atlas now proves all 83
keys and 53 timelines with 44 candidate-backed slots and 39 faithful fallbacks.
The final all-remix atlas remains blocked on the other 27 unique visual redraws
and visual landmark approval.

### Gate 5 — duration-aware PixiJS playback

Use the single Championship Pixi ticker. The character player must keep
`AnimatedSprite.autoUpdate = false` or use a small presentation controller that
advances frames from each frame's own duration ticks. It must support playback
mode, Main/Sub switching, left/right anchor mirroring, pause, reduced motion,
lazy loading, and atlas unloading without creating a second ticker or store.

### Gate 6 — in-game 9:16 proof

Test M201 in Raising, Hunt, and battle-scale presentations at `390 x 844` plus
desktop-browser resize. Verify idle continuity, locomotion, attack endpoints,
hurt, sleep, victory, knockout, selection, drag-and-drop, mirroring, clipping,
texture load failure fallback, and memory release.

Technical review checkpoint: Raising and Hunt pass real Chromium loading and
placement at `390 x 844` behind `?characterArtReview=m201`. Battle presentation
and identity-continuous full-animation review remain pending.

Motion-family closure 01 completes canonical Cells 001, 005, 012, 050 and 054;
the verified source reuse map also covers Main Cells 007 and 016 plus their Sub
matches. Motion-family closure 02 completes canonical Cells 002, 003, 008, 013,
014 and 024 and propagates them into eight additional verified reuse slots.
Main now has 18 fully remixed sequences, three partial sequences and 19
fallback-only sequences; Sub is 8/0/5. These candidates remain visual and
landmark review-gated.

## Promotion and rollout

M201 becomes the template only after the Owner accepts the in-game proof. Then:

1. complete the other seven A1 identities through the same gates;
2. run the first 32-slot production batch;
3. reassess identity drift, atlas size, workload, and runtime performance;
4. repeat seven batches until all 224 stable slots are covered.

Concept approval never promotes a sprite. `READY_FOR_RUNTIME` requires the full
83-cell M201 pack, duration-aware playback, and in-engine QA. `SHIPPING_READY`
remains a separate human, rights, replacement-completeness, and runtime-QA gate.
