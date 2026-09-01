# Licensed Cat/Dog Remix Creature Pack V1

This is a motion-compatible licensed remix presentation pack for the 224 stable
Championship creature slots. It does not replace the faithful internal
baseline and it must not change evolution, battle, capture, Raising,
progression, economy, or save truth.

## Owner direction

- Redesign all 224 slots by substantially remixing the corresponding original
  creature while preserving animation compatibility.
- Cats and dogs are the majority visual vocabulary.
- Valuable bird, fish, insect, plant, machine, spirit, and giant-creature
  silhouettes remain in the roster.
- Preserve a lightly hand-drawn character and a bright, readable presentation.

## Locked roster mix

| Class | Count |
| --- | ---: |
| Cat | 72 |
| Dog | 64 |
| Other creature | 80 |
| Egg | 8 |
| **Total** | **224** |

The regular-form stage quota is:

| Stage group | Slots | Cat | Dog | Other |
| --- | ---: | ---: | ---: | ---: |
| Baby I | 12 | 4 | 4 | 4 |
| Baby II | 14 | 5 | 4 | 5 |
| Rookie | 38 | 13 | 11 | 14 |
| Champion | 65 | 22 | 19 | 24 |
| Ultimate | 50 | 16 | 15 | 19 |
| Mega | 37 | 12 | 11 | 14 |

## Motion-compatible remix boundary

This pack is not made by merely attaching ears or tails. Each slot receives a
new cat-, dog-, or retained-other-species treatment across the face, muzzle,
ears, coat, tail, markings, surface detail, and selected ornaments. The source
creature remains the licensed motion and identity base, so this is classified
as a derivative remix rather than a clean-room original character.

The following source properties stay locked because they make thousands of
existing animation cells reusable:

- limb count and joint topology;
- body-facing direction and ground contact;
- Main/Sub logical canvas, anchor, and alpha safety margin;
- source frame count, playback order, and duration;
- attack-origin, hit, sleep, victory, defeat, and interaction pose intent;
- gameplay collision and selection bounds.

The redraw may expand fur, ears, tail, and ornaments beyond the old silhouette,
but action-critical extremities remain inside the recorded safety envelope.
No ROM pixels are pasted into the remix output; each frame is redrawn over the
motion guide.

Every evolution edge should preserve at least two lineage tokens, selected from
ear geometry, tail grammar, face mask, paw/foot construction, recurring charm,
coat motif, elemental material, or movement posture. A node with multiple
parents uses bridge traits that can plausibly inherit from every incoming
family; it must not become a collage of the source characters.

## Evolution evidence state

The repository currently has all 224 visual slots but does not yet contain a
ROM-verified canonical evolution graph with resolver priority, tie behaviour,
life-history fallback, and egg-reversion rules. A 2008 community evolution
guide supplies a useful static edge/requirement cross-check, but it is not
runtime authority:

- <https://gamefaqs.gamespot.com/ds/943756-digimon-world-championship/faqs/54306>

Until the graph is reconciled with ROM evidence, generated concepts remain
`ART_PROPOSAL` and may not be bound to gameplay evolution outcomes.

## Current bounded style pilot

- [Cat/dog evolution style pilot](style-pilot/cat-dog-evolution-pilot-v1.png)
- Two original six-stage lineages, one cat and one dog.
- `ART_PROPOSAL / BROAD_STYLE_REFERENCE_ONLY`.
- This sheet tests mood, breed vocabulary, and hand-drawn finish. It does not
  demonstrate the required source-pose compatibility and locks neither the 224
  identities nor runtime sprites.

## Source-pose pilot result

- [M201 idle remix concept](source-pose-pilot/m201-idle-remix-v1.png)
- Source motion guide:
  `faithful-hd224/batch-02/m201_agumon/cell-000-main-hd4x.png`.
- Visual identity result: `CONCEPT_PASS`.
- Pixel-frame compatibility result: `FAIL_REQUIRES_CONTROLLED_OVERDRAW`.
- Source frame is `192x216 RGBA`; the generated concept is `1254x1254 RGB`
  and has no true alpha channel.

The generated concept preserves the broad facing and action intent, but it
changes the exact limb angles, feet, silhouette envelope, canvas size, and
ground anchor. It is therefore a character-design reference only and must not
be packed into a runtime atlas. Production frames require a controlled
overdraw workflow that locks the source alpha mask, extremity landmarks,
ground line, and output canvas before any batch is promoted.

For every production frame the export gate therefore requires the exact source
logical canvas, a true alpha channel, unchanged ground anchor, matching facing,
the same action-critical extremity landmarks, and an approved silhouette-delta
mask. A large square concept render never satisfies this gate by itself.

The next pilot is a source-pose overdraw test on a small representative set:
idle, locomotion, sleep, hit, attack, victory, and defeat. Once the Owner
accepts the anatomy treatment and the automatic frame-transfer QA passes,
production proceeds in seven batches of 32, with each batch returning
character masters, pose sheets, transparent sprite masters, animation reuse
mapping, anchors, atlases, manifests, and contact sheets.

## First executable work packet

The first bounded vertical slice is M201 because it is present in A1 panel 01
and exercises the complete Main/Sub animation problem. Its staged gates,
geometry, 12-pose review set, all-83-cell expansion, original-tick playback,
PixiJS atlas requirements, 9:16 QA, rollout, and rollback are recorded in:

- [M201 vertical-slice plan](M201_VERTICAL_SLICE_PLAN.md)
- [M201 machine-readable work packet](m201-work-packet.json)
- [ROM character pipeline lock](ROM_CHARACTER_PIPELINE_LOCK.md)

The Cell 000 seed workspace now contains a `384 x 352 RGBA` normalized remix
candidate whose alpha, canvas, shared anchor, and `y = 320` ground line pass
automatic checks. Facing, foot/hand landmarks, and A1 identity still require
visual approval before the seed may unlock the 12 high-risk poses.

The twelve high-risk Main slots now also have transparent technical candidates
and a review contact sheet. ROM pixel comparison proves that Cells 000/004/006
share one decoded drawing and Cells 011/015 share another, so the remix reuses
the same approved HD candidate for those slots instead of redrawing duplicates.
The twelve slots therefore contain nine unique source poses. This batch remains
visual/landmark review-gated and is not yet eligible for a runtime atlas.

- [M201 12-pose remix candidate contact sheet](m201-seed/m201-main-12-high-risk-remix-candidates.png)
- [M201 12-pose machine QA manifest](m201-seed/m201-main-12-high-risk-remix-candidates.json)

The complete ROM-decoded reuse audit also reduces the eventual 83 runtime cell
slots to 47 unique visual drawings. Main has 47 unique decoded visuals across
65 slots, and all 18 Sub slots are exact visual matches to Main cells. Main and
Sub keep their original stable cell keys and timelines, but share approved HD
textures whenever the original decoded pixels are identical.

Those 47 visuals further collapse to 36 unique alpha-mask geometries. The
remaining eleven visual variants change interior expression, palette or status
treatment without changing the outer silhouette. Production therefore locks a
geometry master first, then makes expression/palette variants inside that same
mask.

- [M201 complete 83-slot source reuse map](m201-seed/m201-all83-source-reuse.json)
- [M201 47-unique-pose production queue](m201-seed/m201-47-unique-source-production-queue.png)

## M201 internal runtime review

The repository now also builds a private, review-only PixiJS runtime at
`assets/production/internal-character-review/m201-remix-v1`. It exposes all 83
stable Main/Sub texture keys and all 53 original animation sequences. Twenty
unique technical candidates currently cover 44 runtime slots through verified
source-cell reuse; the other 39 slots deliberately use the faithful-HD art as
a visible fallback. It is activated only with
`?characterArtReview=m201` and is excluded from the public Pages package.

Motion-family closure 01 adds canonical Cells 001, 005, 012, 050 and 054. The
original reuse map also applies Cell 005 to Cell 007 and Cell 012 to Cell 016.
Idle, walk, run, Attack 1, Attack 3, happy and cheer/victory are now complete
remix sequences rather than mixed-identity previews.

Motion-family closure 02 adds canonical Cells 002, 003, 008, 013, 014 and 024.
Their verified reuse also covers Main Cells 017, 018, 020, 021 and 045 plus
Sub Cells 002 and 003. Idle blink, alert, Attack 2, Attack 4 and eat are now
complete; flee and tired walk gain one remixed frame each.

- [Motion-family closure 01 contact sheet](m201-seed/m201-motion-family-closure-01-candidates.png)
- [Motion-family closure 01 manifest](m201-seed/m201-motion-family-closure-01-candidates.json)
- [Motion-family closure 02 contact sheet](m201-seed/m201-motion-family-closure-02-candidates.png)
- [Motion-family closure 02 manifest](m201-seed/m201-motion-family-closure-02-candidates.json)

At the current art boundary, Main animation coverage is 18 fully remixed, 3
partly remixed, and 19 faithful-fallback-only sequences. Sub coverage is 8, 0,
and 5 respectively. The partly remixed animations will visibly switch
identity and is evidence of missing art, not acceptable final animation.

Real Chromium checks at `390 x 844` load the review runtime in both Raising and
Hunt with one shared Pixi canvas, no fallback, no page error and no failed asset
request:

- [Raising 9:16 runtime review](m201-seed/m201-raising-390x844-runtime-review.png)
- [Hunt 9:16 runtime review](m201-seed/m201-hunt-390x844-runtime-review.png)

This proves the atlas, anchor, mirroring, field placement, ticker and unloading
seams. It does not approve anatomy, motion landmarks, identity continuity or
the remaining 27 unique redraws, and remains `runtimeEligible: false`.
