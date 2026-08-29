"""Evidence-bounded YDIJ 2D map decoders used by Cage and Hunt build tools."""

from __future__ import annotations

import struct
from pathlib import Path

from PIL import Image


OAM_SIZES = {
    0: ((8, 8), (16, 16), (32, 32), (64, 64)),
    1: ((16, 8), (32, 8), (32, 16), (64, 32)),
    2: ((8, 16), (8, 32), (16, 32), (32, 64)),
}


def tile_entry_14(value: int) -> dict:
    return {
        "raw": value,
        "tileIndex": value & 0x3FFF,
        "horizontalFlip": bool(value & 0x4000),
        "verticalFlip": bool(value & 0x8000),
    }


def parse_nbs(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"NBSR":
        raise ValueError(f"Unsupported NBS header: {path.name}")
    version, width, height, layer_count = struct.unpack_from("<IIII", data, 4)
    expected = 20 + width * height * 2
    if len(data) != expected:
        raise ValueError(f"NBS cell count mismatch: {path.name}")
    values = struct.unpack_from(f"<{width * height}H", data, 20)
    return {
        "format": "YDIJ_NBSR_DIRECT14_TILEMAP_V2",
        "version": version,
        "width": width,
        "height": height,
        "layerCount": layer_count,
        "cellOrder": "ROW_MAJOR",
        "tileEntrySemantics": "DIRECT_14_BIT_TILE_INDEX_PLUS_HIGH_2_FLIP_FLAGS",
        "cells": [tile_entry_14(value) for value in values],
    }


def decode_nclr(path: Path) -> tuple[list[tuple[int, int, int, int]], dict]:
    data = path.read_bytes()
    if len(data) < 40 or data[:4] != b"RLCN" or data[16:20] != b"TTLP":
        raise ValueError(f"Unsupported NCLR: {path.name}")
    palette_size = struct.unpack_from("<I", data, 32)[0]
    if palette_size % 2 or palette_size > len(data):
        raise ValueError(f"NCLR palette size mismatch: {path.name}")
    raw = data[len(data) - palette_size:]
    colors = []
    for (color,) in struct.iter_unpack("<H", raw):
        colors.append((
            (color & 0x1F) * 255 // 31,
            ((color >> 5) & 0x1F) * 255 // 31,
            ((color >> 10) & 0x1F) * 255 // 31,
            255,
        ))
    return colors, {
        "colorEncoding": "BGR555",
        "colorCount": len(colors),
    }


def decode_ncgr(path: Path) -> tuple[list[bytes], dict]:
    data = path.read_bytes()
    if len(data) < 48 or data[:4] != b"RGCN" or data[16:20] != b"RAHC":
        raise ValueError(f"Unsupported NCGR/NCBR: {path.name}")
    format_code = struct.unpack_from("<I", data, 28)[0]
    graphics_size = struct.unpack_from("<I", data, 40)[0]
    bytes_per_tile = {3: 32, 4: 64}.get(format_code)
    if bytes_per_tile is None or graphics_size % bytes_per_tile or graphics_size > len(data):
        raise ValueError(f"Unsupported NCGR pixel format: {path.name}")
    raw = data[len(data) - graphics_size:]
    tiles = [raw[offset:offset + bytes_per_tile] for offset in range(0, len(raw), bytes_per_tile)]
    return tiles, {
        "formatCode": format_code,
        "pixelFormat": "INDEXED_4BPP" if format_code == 3 else "INDEXED_8BPP",
        "tileSize": "8x8",
        "bytesPerTile": bytes_per_tile,
        "tileCount": len(tiles),
        "transferMode": "LINEAR_TILE_SEQUENCE",
    }


def render_nbs(tilemap: dict, tiles: list[bytes], palette: list[tuple[int, int, int, int]], transparent_index_zero: bool) -> Image.Image:
    width, height = tilemap["width"], tilemap["height"]
    image = Image.new("RGBA", (width * 8, height * 8), (0, 0, 0, 0))
    pixels = image.load()
    for position, entry in enumerate(tilemap["cells"]):
        tile_index = entry["tileIndex"]
        if tile_index >= len(tiles) or len(tiles[tile_index]) != 64:
            raise ValueError("NBS references a missing or non-8bpp core tile")
        tile = tiles[tile_index]
        target_x, target_y = (position % width) * 8, (position // width) * 8
        for y in range(8):
            for x in range(8):
                source_x = 7 - x if entry["horizontalFlip"] else x
                source_y = 7 - y if entry["verticalFlip"] else y
                palette_index = tile[source_y * 8 + source_x]
                color = palette[palette_index]
                # The clean archive removes both palette index 0 and the
                # original engine's BGR555 magenta void marker.  The research
                # render keeps both opaque so void coverage remains auditable.
                if transparent_index_zero and (palette_index == 0 or color[:3] == (246, 0, 246)):
                    color = (0, 0, 0, 0)
                pixels[target_x + x, target_y + y] = color
    return image


def signed_x(value: int) -> int:
    value &= 0x01FF
    return value - 512 if value >= 256 else value


def signed_y(value: int) -> int:
    value &= 0x00FF
    return value - 256 if value >= 128 else value


def parse_ncer(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 48 or data[:4] != b"RECN" or data[16:20] != b"KBEC":
        raise ValueError(f"Unsupported NCER: {path.name}")
    cell_count, bank_type = struct.unpack_from("<HH", data, 24)
    cell_data_offset = 24 + struct.unpack_from("<I", data, 28)[0]
    mapping_type = struct.unpack_from("<I", data, 32)[0]
    record_size = 16
    oam_base = cell_data_offset + cell_count * record_size
    cells = []
    for cell_index in range(cell_count):
        offset = cell_data_offset + cell_index * record_size
        oam_count, raw_cell_attribute, relative_oam_offset, max_x, max_y, min_x, min_y = struct.unpack_from("<HHIhhhh", data, offset)
        oam_entries = []
        for oam_index in range(oam_count):
            attr0, attr1, attr2 = struct.unpack_from("<HHH", data, oam_base + relative_oam_offset + oam_index * 6)
            affine = bool(attr0 & 0x0100)
            disabled = not affine and bool(attr0 & 0x0200)
            shape, size_code = (attr0 >> 14) & 0x03, (attr1 >> 14) & 0x03
            if shape not in OAM_SIZES:
                raise ValueError(f"Unsupported OAM shape in {path.name}")
            width, height = OAM_SIZES[shape][size_code]
            oam_entries.append({
                "ordinal": oam_index,
                "rawAttr0": attr0,
                "rawAttr1": attr1,
                "rawAttr2": attr2,
                "x": signed_x(attr1),
                "y": signed_y(attr0),
                "width": width,
                "height": height,
                "affine": affine,
                "disabled": disabled,
                "horizontalFlip": not affine and bool(attr1 & 0x1000),
                "verticalFlip": not affine and bool(attr1 & 0x2000),
                "tileIndex": attr2 & 0x03FF,
                "priority": (attr2 >> 10) & 0x03,
                "paletteBank": (attr2 >> 12) & 0x0F,
            })
        cells.append({
            "cellIndex": cell_index,
            "rawCellAttribute": raw_cell_attribute,
            "bounds": {"minX": min_x, "minY": min_y, "maxXExclusive": max_x, "maxYExclusive": max_y},
            "oamCount": oam_count,
            "oamEntries": oam_entries,
        })
    return {
        "format": "YDIJ_NCER_CELL_BANK",
        "cellCount": cell_count,
        "bankType": bank_type,
        "mappingType": mapping_type,
        "cells": cells,
    }


def _palette_index(graphics: bytes, byte_offset: int, pixel_offset: int, bytes_per_unit: int, palette_bank: int) -> tuple[int, bool]:
    if bytes_per_unit == 64:
        index = graphics[byte_offset + pixel_offset]
        return index, index == 0
    byte = graphics[byte_offset + pixel_offset // 2]
    index = (byte >> 4) & 0x0F if pixel_offset & 1 else byte & 0x0F
    return palette_bank * 16 + index, index == 0


def draw_object_cell(
    destination: Image.Image,
    cell: dict,
    anchor_x: int,
    anchor_y: int,
    graphics: bytes,
    bytes_per_unit: int,
    mapping_type: int,
    palette: list[tuple[int, int, int, int]],
    cell_horizontal_flip: bool = False,
    cell_vertical_flip: bool = False,
) -> None:
    pixels = destination.load()
    for oam in cell["oamEntries"]:
        if oam["disabled"] or oam["affine"]:
            if oam["affine"]:
                raise ValueError("Affine NCER objects require an explicit transform decoder")
            continue
        width, height = oam["width"], oam["height"]
        x, y = oam["x"], oam["y"]
        horizontal_flip, vertical_flip = oam["horizontalFlip"], oam["verticalFlip"]
        if cell_horizontal_flip:
            x = -x - width
            horizontal_flip = not horizontal_flip
        if cell_vertical_flip:
            y = -y - height
            vertical_flip = not vertical_flip
        byte_offset = oam["tileIndex"] * (bytes_per_unit << mapping_type)
        pixel_count = width * height
        required_bytes = pixel_count if bytes_per_unit == 64 else (pixel_count + 1) // 2
        if byte_offset + required_bytes > len(graphics):
            raise ValueError("NCER OAM references pixels beyond the NCBR transfer buffer")
        for target_y in range(height):
            for target_x in range(width):
                source_x = width - 1 - target_x if horizontal_flip else target_x
                source_y = height - 1 - target_y if vertical_flip else target_y
                pixel_offset = source_y * width + source_x
                palette_index, transparent = _palette_index(
                    graphics, byte_offset, pixel_offset, bytes_per_unit, oam["paletteBank"]
                )
                if transparent:
                    continue
                draw_x, draw_y = anchor_x + x + target_x, anchor_y + y + target_y
                if 0 <= draw_x < destination.width and 0 <= draw_y < destination.height:
                    pixels[draw_x, draw_y] = palette[palette_index]


def render_object_cell(
    cell: dict,
    graphics: bytes,
    bytes_per_unit: int,
    mapping_type: int,
    palette: list[tuple[int, int, int, int]],
) -> tuple[Image.Image, dict]:
    bounds = cell["bounds"]
    width = max(1, bounds["maxXExclusive"] - bounds["minX"])
    height = max(1, bounds["maxYExclusive"] - bounds["minY"])
    anchor_x, anchor_y = -bounds["minX"], -bounds["minY"]
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw_object_cell(image, cell, anchor_x, anchor_y, graphics, bytes_per_unit, mapping_type, palette)
    return image, {
        "anchorX": anchor_x,
        "anchorY": anchor_y,
        "width": width,
        "height": height,
    }


def composite_object_placements(
    base: Image.Image,
    cell_bank: dict,
    graphics: bytes,
    bytes_per_unit: int,
    palette: list[tuple[int, int, int, int]],
    placements: list[dict],
) -> tuple[Image.Image, list[int]]:
    image = base.copy()
    invalid_cell_ids = []
    for placement in placements:
        cell_id = placement["cellId"]
        if cell_id >= cell_bank["cellCount"]:
            invalid_cell_ids.append(cell_id)
            continue
        draw_object_cell(
            image,
            cell_bank["cells"][cell_id],
            placement["sourceX"],
            placement["sourceY"],
            graphics,
            bytes_per_unit,
            cell_bank["mappingType"],
            palette,
            placement["horizontalFlip"],
            placement["verticalFlip"],
        )
    return image, invalid_cell_ids
