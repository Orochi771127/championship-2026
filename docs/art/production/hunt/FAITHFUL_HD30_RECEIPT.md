# Hunt 30-variant exact-original HD baseline receipt

Date: 2026-08-29

Status: `30/30 CORE + OBJECT + ATR + ESC / 13 ANIMATED VARIANTS / 28 ANIMATION FRAMES`

## Correction applied

The red blocks in the earlier Hunt archive are diagnostic uncovered regions,
not finished playable terrain. They occur where the static core was shown
without the native BSAR animated terrain. The production builder now uses the
original presentation order `BSAR animated terrain -> void-masked core ->
OPM/NCER/NCBR objects`. HM01 therefore restores both bodies of water instead
of displaying red blocks, while HM15 keeps its grey volcanic land above the
animated lava bed instead of becoming an all-lava image.

## Delivered

- All 30 source variants: HM00, sixteen selected biome representatives and
  thirteen alternate variants.
- Exact 1024x1024 native assembly plus deterministic 2048x2048 nearest-neighbour
  frame-0 HD output for every variant, retaining the original palette.
- All 13 native BSAR bundles, totaling 28 animation-layer frames and 28 complete
  composites. Frame order and raw durations are preserved.
- Direct-14-bit NBS core tilemaps, original OPM coordinates/whole-cell flips,
  NCER + linear NCBR object cells, ATR raw classes and ESC raw classes.
- The sixteen archived representative static diagnostic composites compare at
  zero differing RGBA pixels before the missing animation layer is restored.
- A 30-field frame-0 contact sheet with no remaining pure-red diagnostic blocks.

The 2x output is an exact pixel-art enlargement baseline. It is not presented
as a hand-redrawn or resolution-independent master. Runtime semantics of raw ATR,
ESC and animation tick units are not invented, and the packet is not promoted
to runtime or shipping.

## Rebuild

Run `scripts/build-hunt-faithful-hd30.py` with the read-only O3-C archive and
raw Field roots. `--verify-determinism` rebuilds all 466 files in a clean
temporary directory and compares every SHA-256.
