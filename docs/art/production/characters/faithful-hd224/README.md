# Faithful HD 224 Character Baseline

This directory contains the deterministic 4x faithful-HD baseline for all 224
Original Championship entities: eight eggs and 216 regular characters.

## What is complete

- Seven batches of 32 entities, in original manifest order.
- Main and Sub PixiJS v8 atlas pages for every entity.
- All 17,235 decoded Main/Sub cells represented, including intentional blank
  transition cells.
- All 11,480 original NANR animation sequences represented with the original
  cell references, duration ticks and playback modes.
- Original major palettes and silhouettes are unchanged.
- Transparent trimming, a common logical canvas and a shared bottom-centre
  anchor are recorded in each atlas.
- A deterministic builder and validator live in `scripts/`.

## Maturity boundary

This is a functional pixel-faithful HD baseline, not a smooth hand-redrawn art
pass. It intentionally uses exact 4x nearest-neighbour reconstruction so no
identity, palette or animation pose can drift. A later hand-redraw can replace
the cells behind the same atlas keys and timelines.

The Owner reports that the remake is licensed. Runtime and shipping promotion
remain closed until the linked licence evidence, human visual approval and
in-game runtime QA are recorded. Therefore these files remain in the art
production workspace rather than `assets/production`.

## Commands

```text
npm run art:characters:all:build
npm run art:characters:all:validate
```

The build consumes decoded research references outside the runtime tree. No ROM
binary or Nitro payload is copied into this directory.
