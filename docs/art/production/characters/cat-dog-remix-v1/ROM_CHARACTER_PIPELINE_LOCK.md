# ROM Character Pipeline Lock

This lock records the character-production facts verified from the Owner-
provided YDIJ ROM before any remix art is promoted to runtime.

## Verified source chain

The original character is not stored as one fixed-grid sprite sheet and is not
animated with a modern bone rig. The observed chain is:

```text
NANR sequence and frame duration
-> NCER cell and OAM piece placement
-> NCBR/NCGR indexed pixels
-> NCLR palette
```

`NANR` selects a reusable pose cell and records how long it remains visible.
`NCER` assembles that pose around one shared origin from one or more OAM
rectangles. The Main graphics use NCBR 4 bpp data; Sub uses NCGR 8 bpp tiled
data. NCLR supplies the palette.

## M201 locked evidence

- Main: 40 sequences and 65 frame records/cells in the converted contract.
- Sub: 13 sequences and 18 frame records/cells in the converted contract.
- Main plus Sub: 53 sequences and 83 runtime cell slots.
- Main Cell 000 logical canvas: `384 x 352 RGBA`.
- Ground line: `y = 320`.
- Shared anchor: `x = 0.5`, `y = 320 / 352`.
- World movement remains separate from pose art.
- Source sequence IDs, cell references, durations, and playback modes remain
  unchanged when faithful or remix art is selected.

## Modern production translation

Each NCER cell is flattened to one transparent RGBA PixiJS texture. The new
cat/dog design is redrawn over that cell's motion guide. Art may change the
character identity, fur, face, ears, tail, markings, and surface treatment,
but it may not move the source foot contact, action-critical hands or mouth,
facing direction, attack origin, canvas, or timing.

The runtime advances textures using each frame's original tick value. It does
not replace the source timing with a single FPS. The current conversion uses a
configurable 60 Hz basis while executable timing trace remains explicitly
provisional.

## Promotion rule

A concept sheet is never a runtime sprite. A character is runtime-eligible
only after the transparent seed, 12 high-risk poses, all Main/Sub cells,
atlas, original-tick timeline, and Raising/Hunt/Battle layout checks pass.
