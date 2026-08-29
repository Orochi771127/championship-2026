#!/usr/bin/env python3
"""Build the Owner-directed, exact-original Cage HD40 visual/data baseline."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import shutil
import struct
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

from lib.ydij_map_formats import (
    composite_object_placements,
    decode_ncgr as decode_map_ncgr,
    decode_nclr as decode_map_nclr,
    parse_nbs as parse_map_nbs,
    parse_ncer,
    render_nbs,
    render_object_cell,
)


REPO = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = REPO / "docs/art/production/cage/faithful-hd40"
CROSSWALK = REPO / "docs/art/technical/a1-cage-original-structure/CM40_ORIGINAL_STRUCTURE_CROSSWALK.csv"
FIELD_IDS = [f"field_cm{i:02d}_01" for i in range(1, 41)]
PREVIOUSLY_QUARANTINED_FIELDS = {"field_cm12_01", "field_cm18_01"}
ANIMATED_FIELDS = {
    "field_cm07_01",
    "field_cm09_01",
    "field_cm21_01",
    "field_cm39_01",
}
SCALE = 4


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_col(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 3 or data[0] != 1:
        raise ValueError(f"Unsupported COL header: {path.name}")
    width, height = data[1], data[2]
    cells = list(data[3:])
    if len(cells) != width * height:
        raise ValueError(f"COL cell count mismatch: {path.name}")
    return {
        "format": "YDIJ_COL_RAW_V1",
        "sourceSha256": sha256(path),
        "version": data[0],
        "width": width,
        "height": height,
        "cellOrder": "ROW_MAJOR",
        "classSemantics": "RAW_CLASS_XX_NOT_REINTERPRETED",
        "cells": cells,
    }


def parse_atr(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 16 or data[:4] != b"DATR":
        raise ValueError(f"Unsupported ATR header: {path.name}")
    version, width, height = struct.unpack_from("<III", data, 4)
    cells = list(data[16:])
    if len(cells) != width * height:
        raise ValueError(f"ATR cell count mismatch: {path.name}")
    return {
        "format": "YDIJ_DATR_RAW_V2",
        "sourceSha256": sha256(path),
        "version": version,
        "width": width,
        "height": height,
        "cellOrder": "ROW_MAJOR",
        "classSemantics": "RAW_CLASS_XX_NOT_REINTERPRETED",
        "cells": cells,
    }


def align4(value: int) -> int:
    return (value + 3) & ~3


def parse_opm(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 16 or data[:4] != b"OPMD":
        raise ValueError(f"Unsupported OPM header: {path.name}")
    version = struct.unpack_from("<I", data, 4)[0]
    name_length = data[8]
    bundle_name = data[9:9 + name_length].decode("ascii")
    cursor = align4(9 + name_length + 1)
    placement_count = struct.unpack_from("<I", data, cursor)[0]
    cursor += 4
    if version != 4 or len(data) != cursor + placement_count * 16:
        raise ValueError(f"OPM record layout mismatch: {path.name}")
    placements = []
    for index in range(placement_count):
        raw_sequence_word, x, y, raw_flags, raw_float_a, raw_float_b = struct.unpack_from("<HHHHff", data, cursor + index * 16)
        placements.append({
            "ordinal": index,
            "rawSequenceWord": raw_sequence_word,
            "sequenceId": raw_sequence_word & 0x3FFF,
            # OPMD uses the opposite high-bit ordering from the NBS tilemap:
            # bit 14 flips the whole cell vertically; bit 15 horizontally.
            "horizontalFlip": bool(raw_sequence_word & 0x8000),
            "verticalFlip": bool(raw_sequence_word & 0x4000),
            "sourceX": x,
            "sourceY": y,
            "rawFlags": raw_flags,
            "rawFloatA": raw_float_a,
            "rawFloatB": raw_float_b,
            "coordinateAuthority": "VERIFIED_SOURCE_REFERENCE_COORDINATES",
        })
    return {
        "format": "YDIJ_OPMD_RAW_V1",
        "sourceSha256": sha256(path),
        "version": version,
        "bundleName": bundle_name,
        "placementCount": placement_count,
        "placementSemantics": "SOURCE_ORDER_AND_COORDINATES_PRESERVED_NO_VISUAL_RELAYOUT",
        "placements": placements,
    }


def parse_nanr(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 48 or data[:4] != b"RNAN" or data[16:20] != b"KNBA":
        raise ValueError(f"Unsupported NANR header: {path.name}")
    base = 24
    sequence_count, total_frame_count = struct.unpack_from("<HH", data, base)
    sequence_offset, frame_offset, result_offset = struct.unpack_from("<III", data, base + 4)
    sequences = []
    parsed_frame_count = 0
    for sequence_id in range(sequence_count):
        offset = base + sequence_offset + sequence_id * 16
        if offset + 16 > len(data):
            raise ValueError(f"NANR sequence table exceeds payload: {path.name}")
        frame_count, loop_start_frame, raw_word_a, raw_word_b, relative_frame_offset = struct.unpack_from(
            "<HHIII", data, offset
        )
        frames = []
        for frame_index in range(frame_count):
            frame_record_offset = base + frame_offset + relative_frame_offset + frame_index * 8
            if frame_record_offset + 8 > len(data):
                raise ValueError(f"NANR frame table exceeds payload: {path.name}")
            relative_result_offset, raw_duration_ticks, marker = struct.unpack_from(
                "<IHH", data, frame_record_offset
            )
            result_record_offset = base + result_offset + relative_result_offset
            if result_record_offset + 2 > len(data) or marker != 0xBEEF:
                raise ValueError(f"NANR result/marker mismatch: {path.name}")
            frames.append({
                "frameIndex": frame_index,
                "cellId": struct.unpack_from("<H", data, result_record_offset)[0],
                "rawDurationTicks": raw_duration_ticks,
                "rawMarker": marker,
                "relativeResultOffset": relative_result_offset,
            })
        if not frames:
            raise ValueError(f"NANR sequence has no frames: {path.name} sequence {sequence_id}")
        sequences.append({
            "sequenceId": sequence_id,
            "frameCount": frame_count,
            "loopStartFrame": loop_start_frame,
            "rawWordA": raw_word_a,
            "rawWordB": raw_word_b,
            "relativeFrameOffset": relative_frame_offset,
            "frames": frames,
        })
        parsed_frame_count += frame_count
    if parsed_frame_count != total_frame_count:
        raise ValueError(f"NANR total frame count mismatch: {path.name}")
    return {
        "format": "YDIJ_NANR_SEQUENCE_BANK",
        "sourceSha256": sha256(path),
        "sequenceCount": sequence_count,
        "totalFrameCount": total_frame_count,
        "sequenceTableOffset": sequence_offset,
        "frameTableOffset": frame_offset,
        "resultTableOffset": result_offset,
        "timingSemantics": "RAW_TICKS_PRESERVED_NO_RATE_INFERENCE",
        "bindingSemantics": "OPMD_LOW14_SELECTS_NANR_SEQUENCE_THEN_NANR_FRAME_SELECTS_NCER_CELL",
        "sequences": sequences,
    }


def parse_nbs(path: Path) -> dict:
    result = parse_map_nbs(path)
    result["sourceSha256"] = sha256(path)
    return result


def raw_tile_entry(value: int) -> dict:
    return {
        "raw": value,
        "tileIndex": value & 0x03FF,
        "horizontalFlip": bool(value & 0x0400),
        "verticalFlip": bool(value & 0x0800),
        "paletteBank": (value >> 12) & 0x0F,
    }


def parse_bsar(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 28 or data[:4] != b"BSAR":
        raise ValueError(f"Unsupported BSAR header: {path.name}")
    version, unknown_header_word_0, frame_count, unknown_header_word_2 = struct.unpack_from("<IIII", data, 4)
    if version != 2 or frame_count < 1:
        raise ValueError(f"Unsupported BSAR version/frame count: {path.name}")
    cursor = 20
    frame_durations = list(struct.unpack_from(f"<{frame_count}I", data, cursor))
    cursor += frame_count * 4
    width, height = struct.unpack_from("<II", data, cursor)
    cursor += 8
    grid_symbols = list(struct.unpack_from(f"<{width * height}H", data, cursor))
    cursor += width * height * 2
    symbol_count = struct.unpack_from("<I", data, cursor)[0]
    cursor += 4
    expected = cursor + symbol_count * frame_count * 2
    if len(data) != expected or (grid_symbols and max(grid_symbols) >= symbol_count):
        raise ValueError(f"BSAR grid/symbol table mismatch: {path.name}")
    symbols = []
    for symbol_index in range(symbol_count):
        values = struct.unpack_from(f"<{frame_count}H", data, cursor + symbol_index * frame_count * 2)
        symbols.append({
            "symbolIndex": symbol_index,
            "frameTileEntries": [raw_tile_entry(value) for value in values],
        })
    return {
        "format": "YDIJ_BSAR_ANIMATED_TILEMAP_V2",
        "sourceSha256": sha256(path),
        "version": version,
        "unknownHeaderWord0": unknown_header_word_0,
        "frameCount": frame_count,
        "unknownHeaderWord2": unknown_header_word_2,
        "frameDurationsRawTicks": frame_durations,
        "timingSemantics": "RAW_TICKS_PRESERVED_NO_RATE_INFERENCE",
        "width": width,
        "height": height,
        "cellOrder": "ROW_MAJOR",
        "gridSymbols": grid_symbols,
        "symbolCount": symbol_count,
        "symbols": symbols,
    }


def decode_nclr(path: Path) -> tuple[list[tuple[int, int, int, int]], dict]:
    data = path.read_bytes()
    if len(data) < 40 or data[:4] != b"RLCN" or data[16:20] != b"TTLP":
        raise ValueError(f"Unsupported NCLR: {path.name}")
    palette_size = struct.unpack_from("<I", data, 32)[0]
    if palette_size % 2 or palette_size > len(data):
        raise ValueError(f"NCLR palette size mismatch: {path.name}")
    palette_data = data[len(data) - palette_size:]
    colors = []
    for index, (color,) in enumerate(struct.iter_unpack("<H", palette_data)):
        colors.append((
            (color & 0x1F) * 255 // 31,
            ((color >> 5) & 0x1F) * 255 // 31,
            ((color >> 10) & 0x1F) * 255 // 31,
            0 if index == 0 else 255,
        ))
    return colors, {
        "sourceSha256": sha256(path),
        "colorEncoding": "BGR555",
        "colorCount": len(colors),
        "transparentPaletteIndex": 0,
    }


def decode_ncgr_8bpp(path: Path) -> tuple[list[bytes], dict]:
    data = path.read_bytes()
    if len(data) < 48 or data[:4] != b"RGCN" or data[16:20] != b"RAHC":
        raise ValueError(f"Unsupported NCGR: {path.name}")
    format_code = struct.unpack_from("<I", data, 28)[0]
    graphics_size = struct.unpack_from("<I", data, 40)[0]
    if format_code != 4 or graphics_size % 64 or graphics_size > len(data):
        raise ValueError(f"Expected tiled 8bpp NCGR: {path.name}")
    graphics = data[len(data) - graphics_size:]
    tiles = [graphics[offset:offset + 64] for offset in range(0, len(graphics), 64)]
    return tiles, {
        "sourceSha256": sha256(path),
        "formatCode": format_code,
        "pixelFormat": "INDEXED_8BPP",
        "tileSize": "8x8",
        "tileCount": len(tiles),
    }


def render_bsar_frame(animation: dict, tiles: list[bytes], palette: list[tuple[int, int, int, int]], frame_index: int) -> Image.Image:
    width, height = animation["width"], animation["height"]
    image = Image.new("RGBA", (width * 8, height * 8), (0, 0, 0, 0))
    pixels = image.load()
    for position, symbol_index in enumerate(animation["gridSymbols"]):
        entry = animation["symbols"][symbol_index]["frameTileEntries"][frame_index]
        tile_index = entry["tileIndex"]
        if entry["paletteBank"] != 0 or tile_index >= len(tiles):
            raise ValueError("BSAR references an unsupported palette bank or tile index")
        tile = tiles[tile_index]
        target_x, target_y = (position % width) * 8, (position // width) * 8
        for y in range(8):
            for x in range(8):
                source_x = 7 - x if entry["horizontalFlip"] else x
                source_y = 7 - y if entry["verticalFlip"] else y
                pixels[target_x + x, target_y + y] = palette[tile[source_y * 8 + source_x]]
    return image


def checker(size: tuple[int, int], step: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, (246, 246, 242, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(226, 228, 224, 255))
    return image


def contain(image: Image.Image, size: tuple[int, int], padding: int = 12) -> Image.Image:
    scale = min((size[0] - padding * 2) / image.width, (size[1] - padding * 2) / image.height, 1.0)
    if scale < 1:
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, size[1] - padding - image.height))
    return canvas


def pixel_diff_count(left: Image.Image, right: Image.Image) -> int:
    if left.size != right.size:
        raise ValueError("Cannot compare images with different dimensions")
    left_pixels = left.get_flattened_data() if hasattr(left, "get_flattened_data") else left.getdata()
    right_pixels = right.get_flattened_data() if hasattr(right, "get_flattened_data") else right.getdata()
    return sum(a != b for a, b in zip(left_pixels, right_pixels))


def contact_page(images: list[Image.Image], output: Path) -> None:
    cell_size = (384, 320)
    sheet = checker((cell_size[0] * 5, cell_size[1] * 2))
    for index, image in enumerate(images):
        sheet.alpha_composite(contain(image, cell_size), ((index % 5) * cell_size[0], (index // 5) * cell_size[1]))
    sheet.convert("RGB").save(output, optimize=True)


def crosswalk_rows() -> dict[str, dict[str, str]]:
    with CROSSWALK.open("r", encoding="utf-8-sig", newline="") as handle:
        return {row["field_id"]: row for row in csv.DictReader(handle)}


def build(archive_root: Path, raw_root: Path, output_root: Path) -> None:
    archive_manifest = json.loads((archive_root / "O3B_GALLERY_MANIFEST.json").read_text(encoding="utf-8"))
    if archive_manifest["fieldCount"] != 40 or archive_manifest["fullCompositionConfidenceCount"] != 38:
        raise ValueError("Unexpected O3-B archive baseline")
    if output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True)
    rows = crosswalk_rows()
    records = []
    contact_images = []

    for field_id in FIELD_IDS:
        source_dir = archive_root / field_id
        native_path = source_dir / "clean/native_game_view.png"
        metadata_path = source_dir / "technical_metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))["field"]
        field_dir = output_root / "fields" / field_id
        field_dir.mkdir(parents=True)

        archive_static_golden = Image.open(native_path).convert("RGBA")
        animation_record = {"status": "NOT_PRESENT"}
        animation_layers = []
        animation_bsa = raw_root / f"{field_id}_anim.bsa"
        if animation_bsa.exists():
            animation_ncgr = raw_root / f"{field_id}_anim.ncgr"
            animation_nclr = raw_root / f"{field_id}_anim.nclr"
            if not animation_ncgr.exists() or not animation_nclr.exists():
                raise ValueError(f"{field_id} animated layer bundle is incomplete")
            animation = parse_bsar(animation_bsa)
            tiles, graphics_info = decode_ncgr_8bpp(animation_ncgr)
            palette, palette_info = decode_nclr(animation_nclr)
            if (animation["width"] * 8, animation["height"] * 8) != archive_static_golden.size:
                raise ValueError(f"{field_id} animated layer dimensions differ from static field")
            layer_frames = []
            for frame_index in range(animation["frameCount"]):
                layer = render_bsar_frame(animation, tiles, palette, frame_index)
                animation_layers.append(layer)
                layer_out = field_dir / f"animated-layer-frame-{frame_index:02d}.png"
                layer.save(layer_out, optimize=True)
                layer_frames.append({
                    "frameIndex": frame_index,
                    "rawDurationTicks": animation["frameDurationsRawTicks"][frame_index],
                    "file": f"fields/{field_id}/{layer_out.name}",
                    "sha256": sha256(layer_out),
                })
            animation["graphics"] = graphics_info
            animation["palette"] = palette_info
            animation_out = field_dir / "animated-layer.json"
            write_json(animation_out, animation)
            animation_record = {
                "status": "PRESENT_VERIFIED_ROM_DECODED",
                "file": f"fields/{field_id}/animated-layer.json",
                "sha256": sha256(animation_out),
                "sourceSha256": animation["sourceSha256"],
                "graphicsSourceSha256": graphics_info["sourceSha256"],
                "paletteSourceSha256": palette_info["sourceSha256"],
                "frameCount": animation["frameCount"],
                "frameDurationsRawTicks": animation["frameDurationsRawTicks"],
                "timingSemantics": animation["timingSemantics"],
                "layerFrames": layer_frames,
                "compositionOrder": "ANIMATED_LAYER_BEHIND_STATIC_CORE_AND_OBJECT_LAYER",
            }
        elif field_id in ANIMATED_FIELDS:
            raise ValueError(f"Expected animated layer missing: {field_id}")

        col_path = raw_root / f"{field_id}.col"
        atr_path = raw_root / f"{field_id}.atr"
        nbs_path = raw_root / f"{field_id}.nbs"
        col = parse_col(col_path)
        atr = parse_atr(atr_path)
        tilemap = parse_nbs(nbs_path)
        if (col["width"], col["height"]) != (atr["width"], atr["height"]) or (col["width"], col["height"]) != (tilemap["width"], tilemap["height"]):
            raise ValueError(f"{field_id} COL/ATR/NBS dimensions differ")
        collision_out = field_dir / "collision-raw-classes.json"
        attribute_out = field_dir / "attribute-raw-classes.json"
        tilemap_out = field_dir / "core-tilemap.json"
        write_json(collision_out, col)
        write_json(attribute_out, atr)
        write_json(tilemap_out, tilemap)

        opm_path = raw_root / f"{field_id}.opm"
        placement = parse_opm(opm_path) if opm_path.exists() else {
            "format": "YDIJ_OPMD_NOT_PRESENT",
            "sourceSha256": None,
            "bundleName": None,
            "placementCount": 0,
            "placementSemantics": "NO_NATIVE_OBJECT_PLACEMENT_LAYER",
            "placements": [],
        }
        placement["quarantined"] = False
        placement["authority"] = "ORIGINAL_OPMD_SEQUENCE_PLACEMENT_RESOLVED_THROUGH_NANR"

        core_tiles, core_graphics = decode_map_ncgr(raw_root / f"{field_id}.ncgr")
        core_palette, core_palette_info = decode_map_nclr(raw_root / f"{field_id}.nclr")
        core_clean = render_nbs(tilemap, core_tiles, core_palette, transparent_index_zero=True)
        core_research = render_nbs(tilemap, core_tiles, core_palette, transparent_index_zero=False)
        core_out = field_dir / "core-native.png"
        core_clean.save(core_out, optimize=True)

        object_cell_bank_record = {"status": "NOT_PRESENT"}
        object_animation_bank_record = {"status": "NOT_PRESENT"}
        static_clean = core_clean
        static_research = core_research
        object_ncer = raw_root / f"{field_id}_obj.ncer"
        object_ncbr = raw_root / f"{field_id}_obj.ncbr"
        object_nclr = raw_root / f"{field_id}_obj.nclr"
        object_nanr = raw_root / f"{field_id}_obj.nanr"
        if object_ncer.exists() or object_ncbr.exists() or object_nclr.exists():
            if not all(path.exists() for path in (object_ncer, object_ncbr, object_nclr, object_nanr)):
                raise ValueError(f"{field_id} object cell bundle is incomplete")
            cell_bank = parse_ncer(object_ncer)
            animation_bank = parse_nanr(object_nanr)
            object_units, object_graphics = decode_map_ncgr(object_ncbr)
            object_bytes = b"".join(object_units)
            object_palette, object_palette_info = decode_map_nclr(object_nclr)
            invalid_sequence_ids = sorted({
                item["sequenceId"] for item in placement["placements"]
                if item["sequenceId"] >= animation_bank["sequenceCount"]
            })
            invalid_animation_cell_ids = sorted({
                frame["cellId"]
                for sequence in animation_bank["sequences"]
                for frame in sequence["frames"]
                if frame["cellId"] >= cell_bank["cellCount"]
            })
            if invalid_sequence_ids or invalid_animation_cell_ids:
                raise ValueError(
                    f"{field_id} object sequence binding invalid: "
                    f"sequences={invalid_sequence_ids}, cells={invalid_animation_cell_ids}"
                )
            resolved_placements = []
            for item in placement["placements"]:
                sequence = animation_bank["sequences"][item["sequenceId"]]
                first_frame_cell_id = sequence["frames"][0]["cellId"]
                item["resolvedFirstFrameCellId"] = first_frame_cell_id
                item["sequenceFrameCount"] = sequence["frameCount"]
                resolved_placements.append({**item, "cellId": first_frame_cell_id})
            static_clean, compose_invalid = composite_object_placements(
                core_clean,
                cell_bank,
                object_bytes,
                object_graphics["bytesPerTile"],
                object_palette,
                resolved_placements,
            )
            static_research, research_invalid = composite_object_placements(
                core_research,
                cell_bank,
                object_bytes,
                object_graphics["bytesPerTile"],
                object_palette,
                resolved_placements,
            )
            if compose_invalid or research_invalid:
                raise ValueError(f"{field_id} object composition unexpectedly skipped cells")

            cell_dir = field_dir / "object-cells"
            cell_dir.mkdir()
            cell_records = []
            for cell in cell_bank["cells"]:
                cell_image, anchor = render_object_cell(
                    cell,
                    object_bytes,
                    object_graphics["bytesPerTile"],
                    cell_bank["mappingType"],
                    object_palette,
                )
                cell_out = cell_dir / f"cell-{cell['cellIndex']:03d}.png"
                cell_image.save(cell_out, optimize=True)
                cell_records.append({
                    "cellIndex": cell["cellIndex"],
                    "file": f"fields/{field_id}/object-cells/{cell_out.name}",
                    "sha256": sha256(cell_out),
                    **anchor,
                })
            cell_bank["sourcePayloads"] = {
                "ncerSha256": sha256(object_ncer),
                "ncbrSha256": sha256(object_ncbr),
                "nclrSha256": sha256(object_nclr),
                "nanrSha256": sha256(object_nanr),
            }
            cell_bank["graphics"] = object_graphics
            cell_bank["palette"] = object_palette_info
            cell_bank["renderedCells"] = cell_records
            cell_bank["invalidPlacementSequenceIds"] = invalid_sequence_ids
            cell_bank["invalidAnimationCellIds"] = invalid_animation_cell_ids
            cell_bank["placementBindingAuthority"] = "VERIFIED_OPMD_TO_NANR_TO_NCER_BINDING"
            cell_bank_out = field_dir / "object-cell-bank.json"
            write_json(cell_bank_out, cell_bank)
            animation_bank_out = field_dir / "object-animation-bank.json"
            write_json(animation_bank_out, animation_bank)
            object_cell_bank_record = {
                "status": "PRESENT_NANR_SEQUENCE_RESOLVED_EXACTLY_RECOMPOSED",
                "file": f"fields/{field_id}/object-cell-bank.json",
                "sha256": sha256(cell_bank_out),
                "cellCount": cell_bank["cellCount"],
                "renderedCellCount": len(cell_records),
                "invalidPlacementSequenceIds": invalid_sequence_ids,
                "invalidAnimationCellIds": invalid_animation_cell_ids,
                "placementBindingAuthority": cell_bank["placementBindingAuthority"],
            }
            object_animation_bank_record = {
                "status": "PRESENT_VERIFIED_NANR_SEQUENCE_BANK",
                "file": f"fields/{field_id}/object-animation-bank.json",
                "sha256": sha256(animation_bank_out),
                "sourceSha256": animation_bank["sourceSha256"],
                "sequenceCount": animation_bank["sequenceCount"],
                "totalFrameCount": animation_bank["totalFrameCount"],
                "bindingSemantics": animation_bank["bindingSemantics"],
            }

        placement_out = field_dir / "object-placement.json"
        write_json(placement_out, placement)

        research_golden_path = source_dir / "research/native_game_view_void_diagnostic.png"
        research_golden = Image.open(research_golden_path).convert("RGBA")
        clean_archive_diff_count = pixel_diff_count(static_clean, archive_static_golden)
        research_archive_diff_count = pixel_diff_count(static_research, research_golden)
        static_out = field_dir / "static-composite-native.png"
        static_clean.save(static_out, optimize=True)
        exact_assembly_record = {
            "status": "RAW_STATIC_RECOMPOSED_WITH_NANR_SEQUENCE_BINDING",
            "coreFile": f"fields/{field_id}/core-native.png",
            "coreSha256": sha256(core_out),
            "staticCompositeFile": f"fields/{field_id}/static-composite-native.png",
            "staticCompositeSha256": sha256(static_out),
            "cleanGoldenSha256": sha256(native_path),
            "researchGoldenSha256": sha256(research_golden_path),
            "archiveCleanPixelDiffCount": clean_archive_diff_count,
            "archiveResearchPixelDiffCount": research_archive_diff_count,
            "archiveComparisonSemantics": "OLD_DIRECT_CELL_RECONSTRUCTION_IS_DIAGNOSTIC_ONLY_NOT_BINDING",
            "tileEntrySemantics": tilemap["tileEntrySemantics"],
            "coreGraphics": core_graphics,
            "corePalette": core_palette_info,
            "layerOrder": "CORE_THEN_OPMD_NANR_SEQUENCE_FRAME_0_NCER_NCBR_OBJECTS",
        }

        source_image = static_clean
        if animation_layers:
            composite_frames = []
            for layer in animation_layers:
                composite = layer.copy()
                composite.alpha_composite(static_clean)
                composite_frames.append(composite)
            source_image = composite_frames[0]
            alternate_native_out = field_dir / "native-composite-frame-01.png"
            composite_frames[1].save(alternate_native_out, optimize=True)
            alternate_hd = composite_frames[1].resize(
                (composite_frames[1].width * SCALE, composite_frames[1].height * SCALE),
                Image.Resampling.NEAREST,
            )
            alternate_hd_out = field_dir / "faithful-hd4x-frame-01.png"
            alternate_hd.save(alternate_hd_out, optimize=True)
            animation_record["alternateCompositeFrame"] = {
                "file": f"fields/{field_id}/{alternate_native_out.name}",
                "sha256": sha256(alternate_native_out),
            }
            animation_record["alternateFaithfulHd4xFrame"] = {
                "file": f"fields/{field_id}/{alternate_hd_out.name}",
                "sha256": sha256(alternate_hd_out),
                "scale": SCALE,
                "filter": "NEAREST",
            }
        original_out = field_dir / "native-original.png"
        source_image.save(original_out, optimize=True)
        hd = source_image.resize((source_image.width * SCALE, source_image.height * SCALE), Image.Resampling.NEAREST)
        hd_out = field_dir / "faithful-hd4x.png"
        hd.save(hd_out, optimize=True)
        if hd.resize(source_image.size, Image.Resampling.NEAREST).tobytes() != source_image.tobytes():
            raise ValueError(f"{field_id} HD round-trip differs from original pixels")

        payloads = {}
        for extension in ("nbs", "ncgr", "nclr", "atr", "col", "opm"):
            payload = raw_root / f"{field_id}.{extension}"
            payloads[extension] = {"present": payload.exists(), "sha256": sha256(payload) if payload.exists() else None}
        for extension in ("bsa", "ncgr", "nclr"):
            payload = raw_root / f"{field_id}_anim.{extension}"
            payloads[f"anim.{extension}"] = {"present": payload.exists(), "sha256": sha256(payload) if payload.exists() else None}
        row = rows[field_id]
        records.append({
            "assetId": f"art:cage:{field_id}:faithful-hd4x-baseline",
            "fieldId": field_id,
            "ordinal": int(row["ordinal"]),
            "nameEn": row["name_en"],
            "nameJp": row["name_jp"],
            "compositionConfidence": (
                "FULL_COMPOSITION_CONFIDENCE_NANR_SEQUENCE_BINDING_RESOLVED"
                if field_id in PREVIOUSLY_QUARANTINED_FIELDS
                else "FULL_COMPOSITION_CONFIDENCE"
            ),
            "archiveCompositionConfidence": metadata["composition_confidence"],
            "originalDimensions": metadata["dimensions"],
            "layoutCells": metadata["layout_cells"],
            "nativeOriginal": {"file": f"fields/{field_id}/native-original.png", "sha256": sha256(original_out), "width": source_image.width, "height": source_image.height, "staticCoreObjectSourceSha256": sha256(static_out), "composition": "STATIC_CORE_OBJECT_PLUS_ANIMATED_FRAME_0" if animation_bsa.exists() else "STATIC_CORE_OBJECT"},
            "faithfulHd4x": {"file": f"fields/{field_id}/faithful-hd4x.png", "sha256": sha256(hd_out), "width": hd.width, "height": hd.height, "scale": SCALE, "filter": "NEAREST", "downsampleRoundTripEqualsOriginal": True},
            "coreTilemap": {"file": f"fields/{field_id}/core-tilemap.json", "sha256": sha256(tilemap_out), "sourceSha256": tilemap["sourceSha256"]},
            "collision": {"file": f"fields/{field_id}/collision-raw-classes.json", "sha256": sha256(collision_out), "sourceSha256": col["sourceSha256"], "classSemantics": col["classSemantics"]},
            "attribute": {"file": f"fields/{field_id}/attribute-raw-classes.json", "sha256": sha256(attribute_out), "sourceSha256": atr["sourceSha256"], "classSemantics": atr["classSemantics"]},
            "objectPlacement": {"file": f"fields/{field_id}/object-placement.json", "sha256": sha256(placement_out), "sourceSha256": placement["sourceSha256"], "count": placement["placementCount"], "authority": placement["authority"]},
            "objectCellBank": object_cell_bank_record,
            "objectAnimationBank": object_animation_bank_record,
            "exactStaticAssembly": exact_assembly_record,
            "animatedLayer": animation_record,
            "sourcePayloadHashes": payloads,
            "rightsStatus": "LICENSED",
            "licenseEvidenceStatus": "OWNER_REPORTED_LINK_PENDING",
            "productionStatus": "EXACT_ORIGINAL_HD_REFERENCE_BASELINE",
            "runtimeEligible": False,
            "shippingReady": False,
        })
        contact_images.append(hd)

    for page in range(4):
        contact_page(contact_images[page * 10:(page + 1) * 10], output_root / f"contact-page-{page + 1:02d}.png")
    manifest = {
        "schemaVersion": 1,
        "batch": "ART_A3_CAGE_EXACT_ORIGINAL_FAITHFUL_HD40_BASELINE",
        "fieldCount": 40,
        "fullCompositionConfidenceCount": 40,
        "archiveFullCompositionConfidenceCount": 38,
        "partialObjectConflictFields": [],
        "resolvedObjectSequenceBindingFields": sorted(PREVIOUSLY_QUARANTINED_FIELDS),
        "animatedLayerFieldCount": len(ANIMATED_FIELDS),
        "animatedLayerFields": sorted(ANIMATED_FIELDS),
        "ownerDirection": "PRESERVE_ORIGINAL_ART_COMPOSITION_PLACEMENT_COLLISION_AND_ART_CODE_100_PERCENT_ONLY_UPSCALE_TO_HD",
        "visualPolicy": "EXACT_RAW_LAYER_COMPOSITE_PLUS_4X_NEAREST_NO_RELAYOUT_NO_RECOLOR_NO_REDESIGN",
        "dataPolicy": "COL_ATR_NBS_OPMD_NANR_NCER_RAW_VALUES_PRESERVED; OPMD_SEQUENCE_BINDING_RESOLVED_THROUGH_NANR",
        "sourceArchive": {"logicalId": archive_manifest["batch"], "manifestSha256": sha256(archive_root / "O3B_GALLERY_MANIFEST.json")},
        "rightsStatus": "LICENSED",
        "licenseEvidenceStatus": "OWNER_REPORTED_LINK_PENDING",
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "fields": records,
        "qa": {
            "all40NativeImagesImported": len(records) == 40,
            "all40HdRoundTripPixelExact": all(field["faithfulHd4x"]["downsampleRoundTripEqualsOriginal"] for field in records),
            "all40CollisionDimensionsMatchTilemaps": True,
            "all40AttributeDimensionsMatchTilemaps": True,
            "all40CoreAndStaticLayersRecomposedFromRaw": all(
                field["exactStaticAssembly"]["status"] == "RAW_STATIC_RECOMPOSED_WITH_NANR_SEQUENCE_BINDING"
                for field in records
            ),
            "objectCellBanksExactlyRecomposed": sum(
                field["objectCellBank"]["status"] == "PRESENT_NANR_SEQUENCE_RESOLVED_EXACTLY_RECOMPOSED"
                for field in records
            ),
            "objectAnimationBanksDecoded": sum(
                field["objectAnimationBank"]["status"] == "PRESENT_VERIFIED_NANR_SEQUENCE_BANK"
                for field in records
            ),
            "allFourAnimatedLayerBundlesDecoded": sum(field["animatedLayer"]["status"] == "PRESENT_VERIFIED_ROM_DECODED" for field in records) == 4,
            "animatedLayerFramesDecoded": sum(field["animatedLayer"].get("frameCount", 0) for field in records),
            "objectPlacementRelayoutPerformed": False,
            "unknownClassSemanticsInvented": False,
            "cm12Cm18ObjectSequenceBindingResolved": True,
        },
    }
    write_json(output_root / "manifest.json", manifest)


def tree_hashes(root: Path) -> dict[str, str]:
    return {str(path.relative_to(root)).replace("\\", "/"): sha256(path) for path in sorted(root.rglob("*")) if path.is_file()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive-root", type=Path, required=True, help="O3-B archive root containing O3B_GALLERY_MANIFEST.json")
    parser.add_argument("--raw-training-root", type=Path, required=True, help="Read-only original training payload directory")
    parser.add_argument("--verify-determinism", action="store_true")
    args = parser.parse_args()
    build(args.archive_root, args.raw_training_root, OUTPUT_ROOT)
    if args.verify_determinism:
        with tempfile.TemporaryDirectory() as temp:
            second = Path(temp) / "faithful-hd40"
            build(args.archive_root, args.raw_training_root, second)
            if tree_hashes(OUTPUT_ROOT) != tree_hashes(second):
                raise SystemExit("Faithful Cage HD40 determinism check failed")
        print(f"Deterministic faithful Cage HD40 passed: {len(tree_hashes(OUTPUT_ROOT))} files")


if __name__ == "__main__":
    main()
