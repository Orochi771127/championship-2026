# Assembled evolution art: bounded source binding

Date: 2026-09-13. Product base: `main@d0e58dcce79421b17e31ed644c3f3847fee63cab`.

This records display-resource and draw-clock evidence, not new evolution rules. The existing native actor already owns form selection, elapsed counters, RNG and the final Home-record update.

## Evidence and method

The Championship Evidence MCP located existing Raising evolution and Hunt capture material. The installed Championship Ghidra MCP then read the existing `/OVL18` and `/ARM9` analyses. Literal strings were cross-checked in the existing private original ROM, SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`. No ROM or emulator-state payload is added to this change.

Resource chain:

1. OVL18 `0211CD54` initializes the Raising common bank with `e001_ikusei` and calls ARM9 `02065E28` for the evolution bank.
2. ARM9 `02065D3C` replaces pool `+0x110` with the requested resource. `02065DF4` binds a sprite to pool `+0x110`.
3. OVL18 `02111124` initializes actor child `+0x40` with `02065DF4`. It therefore uses the Raising common bank, not the similarly named `common/evolution` directory.
4. ARM9 `02065E28` resolves literals at `02065E74` and `02065E78` to `common` and `e001_evolution_all`, and stores the resource at pool `+0x114`. `02065E7C` binds that resource to the global evolution sprites.
5. OVL18 literals at `0211AF78`, `0211AF7C`, `0211AF80` resolve to `02128E78` (ring), `02128F4C` (burst), `02129020` (backdrop). Initialization at `0211CD54` and rendering at `0211B3A8` use the same objects.

## Selected sequences

| Object | Resource and selection | Evidence |
|---|---|---|
| Ring | `common/e001_evolution_all`, sequence 1 frame 5, cell 18 | `0211A338` initializes at the phase 1 to 2 boundary; no 2x scale call on this sprite |
| Green emitter | `common/e001_ikusei`, sequence 15, cells 115–124 | `0211A338` sets actor `+0x40` sequence `0xF` and scale `0x2000` |
| Blue burst | `common/e001_evolution_all`, sequence 0, cells 0–12 | `0211A338` sets global burst sequence 0 and scale `0x2000` |
| Moving text | `common/e001_evolution_all`, sequence 1 frames 0, 1 and 4 | Original selector uses these variants; the existing six-row portrait composition remains an adaptation |

`0211B3A8` draws the ring before phase 7. It advances the green child only in phase 3, and the blue burst in phases 5–7. `0211DF10` calls `02047A08(sprite, 0x1000)` only when its second argument requests animation, before submitting the sprite. Therefore sampling at elapsed zero uses one native draw tick for these two emitters. The local implementation samples the existing phase counters; it adds no independent timer.

`0211A338` raises ring opacity by 8/31 during phase 2, raises burst opacity by 8/31 during phase 6, and subtracts 3/31 after phase 7 elapsed 15. The burst advances while still transparent in phase 5. The existing white transition remains above emitters; the floor ring is below the body.

## Pixel integrity and limits

`scripts/build-assembled-ui-reference.py` selects original sequence/frame IDs from `08_FULL_FAMILY_CONVERSION` metadata, then copies only the corresponding complete cells from `YDIJ_ART_PACK_ASSEMBLED`. Raw NANR durations and playback modes are retained. OAM extents define the PNG dimensions and origin; NCER preview padding does not change the assembled cell size. Cage definition 5 is a concrete example: the assembled OAM width is 96, while its padded NCER box is 104.

The local browser review reaches natural evolution through new-game, food and day-change commands, then steps the existing lifecycle. It verifies green/burst presentation, visible target form and completion to species 21 with no active evolution, at 390- and 320-pixel field widths. It does not establish every original form or physical-device visual parity.

Capture-storage and recovery artwork remain unresolved. A `digicach` filename or a star-like cell is insufficient evidence for a runtime event. Recovery sequence 32 includes cell 154 and totals 63 native ticks; equating it with the current 420 ms video-informed pulse would invent timing. Existing capture-storage and recovery presentation remains in place.
