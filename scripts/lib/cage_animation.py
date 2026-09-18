"""Bounded pixel-match reconstruction of the four animated Cage fields.

Four of the forty Cage fields ship a second BG layer (`*_anim.bsa` + its own
NCGR/NCLR): a repeating water or lava sheet the same size as the field. The
first pass composited that sheet strictly *behind* the static core, which is
right for cm09, cm21 and cm39 -- their cores leave holes and the sheet fills
them. It is not the whole rule. cm07 (Volcano) has no hole at all, so its
animation was dropped and both flattened frames came out byte-identical.

The repair also replaces cells whose complete RGBA frame-0 pixels match the
decoded animation layer. cm07's measured evidence in the committed baseline:

  * 16 core cells are pixel-identical to the sheet's frame 0 at the same cell;
  * each of them has 7-8 distinct colours, so they are textured, not flat fill;
  * they use core tile indices 11,12,13,14,35,36,37,60,61,427,446,447,448,
    and those indices appear in exactly those 16 cells and nowhere else.

This is a reconstruction rule, not proof of shared DS VRAM slots. The native
CPU layer/tile binding remains UNKNOWN_REQUIRES_TRACE. It must not be promoted
to a general original-game composition rule based on pixel equality alone.

Both rules run here. Frame 0 is unchanged by the tile rule by construction --
the cells it covers already hold the sheet's frame-0 pixels -- so adopting this
does not move a single pixel of any field's first frame.
"""

from __future__ import annotations

from PIL import Image

TILE = 8
COMPOSITION_ORDER = "ANIMATED_LAYER_BEHIND_STATIC_CORE_AND_OBJECT_LAYER_PLUS_FRAME0_PIXEL_MATCH_REPAINT"
BOUND_CELL_SEMANTICS = "RGBA_EQUAL_FRAME0_TILE_RECONSTRUCTION_NOT_VERIFIED_VRAM_BINDING"
COMPOSITION_EVIDENCE = "PIXEL_MATCH_RECONSTRUCTION_CPU_BINDING_UNKNOWN_REQUIRES_TRACE"


def animation_bound_cells(static_clean: Image.Image, first_layer: Image.Image) -> list[tuple[int, int]]:
    """Pixel-matched reconstruction cells, as (tile_x, tile_y).

    A cell qualifies when the sheet draws there and the core's own pixels are
    already the sheet's frame-0 pixels. Cells the core leaves empty are the
    other rule's business and are not returned here.
    """
    if static_clean.size != first_layer.size:
        raise ValueError("ANIMATED_LAYER_SIZE_MISMATCH")
    width, height = static_clean.size
    if width % TILE or height % TILE:
        raise ValueError("FIELD_NOT_TILE_ALIGNED")
    core = static_clean.load()
    sheet = first_layer.load()
    bound = []
    for tile_y in range(height // TILE):
        for tile_x in range(width // TILE):
            points = [
                (tile_x * TILE + x, tile_y * TILE + y)
                for y in range(TILE)
                for x in range(TILE)
            ]
            if not any(sheet[point][3] for point in points):
                continue
            if all(core[point][3] == 0 for point in points):
                continue
            if all(core[point] == sheet[point] for point in points):
                bound.append((tile_x, tile_y))
    return bound


def compose_animated_field_frames(
    static_clean: Image.Image,
    animation_layers: list[Image.Image],
) -> list[Image.Image]:
    """Flatten one animated field into one finished picture per BSAR frame."""
    if not animation_layers:
        raise ValueError("ANIMATED_LAYER_REQUIRED")
    bound = animation_bound_cells(static_clean, animation_layers[0])
    frames = []
    for layer in animation_layers:
        if layer.size != static_clean.size:
            raise ValueError("ANIMATED_LAYER_SIZE_MISMATCH")
        # Sheet behind the core: it shows wherever the core draws nothing.
        composite = layer.copy()
        composite.alpha_composite(static_clean)
        # Bounded reconstruction: replace only complete frame-0 pixel matches.
        for tile_x, tile_y in bound:
            box = (tile_x * TILE, tile_y * TILE, (tile_x + 1) * TILE, (tile_y + 1) * TILE)
            composite.paste(layer.crop(box), box)
        frames.append(composite)
    return frames
