#!/usr/bin/env python3
"""Build all 30 original Hunt variants with their animated terrain restored."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

from lib.ydij_map_formats import (
    composite_object_placements,
    decode_ncgr,
    decode_nclr,
    parse_bsar,
    parse_nbs,
    parse_ncer,
    render_bsar_frame,
    render_nbs,
    render_object_cell,
)


REPO = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = REPO / "docs/art/production/hunt/faithful-hd30"
HD_SCALE = 2


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
    count = struct.unpack_from("<I", data, cursor)[0]
    cursor += 4
    if version != 4 or len(data) != cursor + count * 16:
        raise ValueError(f"OPM record layout mismatch: {path.name}")
    placements = []
    for ordinal in range(count):
        raw_word, x, y, flags, float_a, float_b = struct.unpack_from("<HHHHff", data, cursor + ordinal * 16)
        placements.append({
            "ordinal": ordinal,
            "rawCellWord": raw_word,
            "cellId": raw_word & 0x3FFF,
            "horizontalFlip": bool(raw_word & 0x8000),
            "verticalFlip": bool(raw_word & 0x4000),
            "sourceX": x,
            "sourceY": y,
            "rawFlags": flags,
            "rawFloatA": float_a,
            "rawFloatB": float_b,
        })
    return {
        "format": "YDIJ_OPMD_RAW_V1",
        "version": version,
        "bundleName": bundle_name,
        "placementCount": count,
        "placements": placements,
        "placementSemantics": "SOURCE_ORDER_COORDINATES_AND_WHOLE_CELL_FLIPS_PRESERVED",
    }


def parse_atr(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 16 or data[:4] != b"DATR":
        raise ValueError(f"Unsupported ATR header: {path.name}")
    version, width, height = struct.unpack_from("<III", data, 4)
    cells = list(data[16:])
    if len(cells) != width * height:
        raise ValueError(f"ATR cell count mismatch: {path.name}")
    return {"format": "YDIJ_DATR_RAW_V2", "version": version, "width": width, "height": height,
            "cells": cells, "classSemantics": "RAW_CLASS_XX_NOT_REINTERPRETED"}


def parse_esc(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 5:
        raise ValueError(f"Unsupported ESC header: {path.name}")
    version, width, height = data[0], struct.unpack_from("<H", data, 1)[0], struct.unpack_from("<H", data, 3)[0]
    cells = list(data[5:])
    if len(cells) != width * height:
        raise ValueError(f"ESC cell count mismatch: {path.name}")
    return {"format": "YDIJ_ESC_RAW_V1", "version": version, "width": width, "height": height,
            "cells": cells, "classSemantics": "RAW_CLASS_XX_NOT_REINTERPRETED"}


def contact_page(images: list[tuple[str, Image.Image]], output: Path) -> None:
    cell_w, cell_h, columns = 256, 280, 5
    rows = (len(images) + columns - 1) // columns
    canvas = Image.new("RGBA", (cell_w * columns, cell_h * rows), (240, 242, 238, 255))
    draw = ImageDraw.Draw(canvas)
    for index, (name, image) in enumerate(images):
        preview = image.resize((256, 256), Image.Resampling.NEAREST)
        x, y = (index % columns) * cell_w, (index // columns) * cell_h
        canvas.alpha_composite(preview, (x, y))
        draw.text((x + 6, y + 260), name, fill=(28, 35, 31, 255))
    canvas.convert("RGB").save(output, quality=92)


def build(archive_root: Path, raw_root: Path, output_root: Path) -> None:
    field_ids = sorted(path.stem for path in raw_root.glob("field_hm??_??.nbs"))
    if len(field_ids) != 30:
        raise ValueError(f"Expected 30 Hunt NBS fields, found {len(field_ids)}")
    if output_root.exists():
        shutil.rmtree(output_root)
    (output_root / "fields").mkdir(parents=True)
    records, previews = [], []

    for field_id in field_ids:
        field_dir = output_root / "fields" / field_id
        field_dir.mkdir()
        tilemap = parse_nbs(raw_root / f"{field_id}.nbs")
        tiles, core_graphics = decode_ncgr(raw_root / f"{field_id}.ncgr")
        palette, core_palette = decode_nclr(raw_root / f"{field_id}.nclr")
        core = render_nbs(tilemap, tiles, palette, transparent_index_zero=False)
        core_with_void_transparent = render_nbs(tilemap, tiles, palette, transparent_index_zero=True)

        placement = parse_opm(raw_root / f"{field_id}_obj.opm")
        cell_bank = parse_ncer(raw_root / f"{field_id}_obj.ncer")
        object_units, object_graphics = decode_ncgr(raw_root / f"{field_id}_obj.ncbr")
        object_bytes = b"".join(object_units)
        object_palette, object_palette_info = decode_nclr(raw_root / f"{field_id}_obj.nclr")
        static_composite, invalid = composite_object_placements(
            core, cell_bank, object_bytes, object_graphics["bytesPerTile"], object_palette, placement["placements"]
        )
        if invalid:
            raise ValueError(f"{field_id} has invalid object cells: {sorted(set(invalid))}")

        archive_dir = archive_root / field_id
        archive_diff = None
        if archive_dir.exists():
            golden = Image.open(archive_dir / "research/native_game_view_void_diagnostic.png").convert("RGBA")
            archive_diff = 0 if static_composite.tobytes() == golden.tobytes() else sum(
                a != b for a, b in zip(static_composite.getdata(), golden.getdata())
            )
            if archive_diff:
                raise ValueError(f"{field_id} static reconstruction differs from archive by {archive_diff} pixels")

        core_out = field_dir / "core-native.png"
        static_out = field_dir / "static-composite-diagnostic.png"
        core.save(core_out, optimize=True)
        static_composite.save(static_out, optimize=True)

        cell_dir = field_dir / "object-cells"
        cell_dir.mkdir()
        rendered_cells = []
        for cell in cell_bank["cells"]:
            image, anchor = render_object_cell(
                cell, object_bytes, object_graphics["bytesPerTile"], cell_bank["mappingType"], object_palette
            )
            out = cell_dir / f"cell-{cell['cellIndex']:03d}.png"
            image.save(out, optimize=True)
            rendered_cells.append({"cellIndex": cell["cellIndex"], "file": str(out.relative_to(output_root)).replace("\\", "/"),
                                   "sha256": sha256(out), **anchor})

        final_frames = []
        bsa_path = raw_root / f"{field_id}_anim.bsa"
        animation_record = {"status": "NOT_PRESENT", "frameCount": 0}
        if bsa_path.exists():
            animation = parse_bsar(bsa_path)
            animation_tiles, animation_graphics = decode_ncgr(raw_root / f"{field_id}_anim.ncgr")
            animation_palette, animation_palette_info = decode_nclr(raw_root / f"{field_id}_anim.nclr")
            layer_records = []
            for frame_index in range(animation["frameCount"]):
                layer = render_bsar_frame(animation, animation_tiles, animation_palette, frame_index)
                # BSAR is the animated terrain bed. Palette-index-zero voids in
                # the core reveal it; opaque core cliffs/land remain above it.
                frame_base = layer.copy()
                frame_base.alpha_composite(core_with_void_transparent)
                frame, frame_invalid = composite_object_placements(
                    frame_base, cell_bank, object_bytes, object_graphics["bytesPerTile"], object_palette,
                    placement["placements"]
                )
                if frame_invalid:
                    raise ValueError(f"{field_id} animation composite skipped object cells")
                layer_out = field_dir / f"animated-layer-frame-{frame_index:02d}.png"
                frame_out = field_dir / f"native-composite-frame-{frame_index:02d}.png"
                layer.save(layer_out, optimize=True)
                frame.save(frame_out, optimize=True)
                final_frames.append(frame)
                layer_records.append({"frameIndex": frame_index,
                                      "durationRawTicks": animation["frameDurationsRawTicks"][frame_index],
                                      "layerFile": str(layer_out.relative_to(output_root)).replace("\\", "/"),
                                      "layerSha256": sha256(layer_out),
                                      "compositeFile": str(frame_out.relative_to(output_root)).replace("\\", "/"),
                                      "compositeSha256": sha256(frame_out)})
            animation_record = {"status": "PRESENT_EXACT_LAYER_COMPOSITED", "frameCount": animation["frameCount"],
                                "timingSemantics": animation["timingSemantics"], "frames": layer_records,
                                "graphics": animation_graphics, "palette": animation_palette_info}
        else:
            final_frames.append(static_composite)
            frame_out = field_dir / "native-composite-frame-00.png"
            static_composite.save(frame_out, optimize=True)

        hd = final_frames[0].resize((2048, 2048), Image.Resampling.NEAREST)
        hd_out = field_dir / "faithful-hd2x-frame-00.png"
        hd.save(hd_out, optimize=True)
        previews.append((field_id, final_frames[0]))

        atr = parse_atr(raw_root / f"{field_id}.atr")
        esc = parse_esc(raw_root / f"{field_id}.esc")
        if (atr["width"], atr["height"]) != (128, 128) or (esc["width"], esc["height"]) != (128, 128):
            raise ValueError(f"{field_id} ATR/ESC dimensions differ from Hunt topology")
        tilemap_out, placement_out = field_dir / "core-tilemap.json", field_dir / "object-placement.json"
        atr_out, esc_out = field_dir / "attribute-raw-classes.json", field_dir / "encounter-raw-classes.json"
        bank_out = field_dir / "object-cell-bank.json"
        cell_bank.update({"graphics": object_graphics, "palette": object_palette_info, "renderedCells": rendered_cells})
        for path, value in ((tilemap_out, tilemap), (placement_out, placement), (atr_out, atr), (esc_out, esc), (bank_out, cell_bank)):
            write_json(path, value)
        records.append({
            "fieldId": field_id,
            "variant": int(field_id[-2:]),
            "selectedArchiveRepresentative": archive_dir.exists(),
            "archiveStaticDiagnosticPixelDiffCount": archive_diff,
            "nativeDimensions": [1024, 1024],
            "faithfulHd2x": {"file": str(hd_out.relative_to(output_root)).replace("\\", "/"), "sha256": sha256(hd_out),
                             "dimensions": [2048, 2048], "scale": HD_SCALE, "filter": "NEAREST"},
            "core": {"file": str(core_out.relative_to(output_root)).replace("\\", "/"), "sha256": sha256(core_out), "graphics": core_graphics, "palette": core_palette},
            "staticDiagnostic": {"file": str(static_out.relative_to(output_root)).replace("\\", "/"), "sha256": sha256(static_out)},
            "objectPlacement": {"file": str(placement_out.relative_to(output_root)).replace("\\", "/"), "sha256": sha256(placement_out), "count": placement["placementCount"]},
            "objectCellBank": {"file": str(bank_out.relative_to(output_root)).replace("\\", "/"), "sha256": sha256(bank_out), "cellCount": cell_bank["cellCount"]},
            "attribute": {"file": str(atr_out.relative_to(output_root)).replace("\\", "/"), "sha256": sha256(atr_out)},
            "encounter": {"file": str(esc_out.relative_to(output_root)).replace("\\", "/"), "sha256": sha256(esc_out)},
            "animation": animation_record,
            "runtimeEligible": False,
            "shippingReady": False,
        })

    contact = output_root / "contact-sheet-frame-00.jpg"
    contact_page(previews, contact)
    manifest = {
        "schemaVersion": 1,
        "batch": "ART_A4_HUNT_EXACT_ORIGINAL_HD30_BASELINE",
        "fieldCount": len(records),
        "representativeArchivePixelExactCount": sum(x["archiveStaticDiagnosticPixelDiffCount"] == 0 for x in records),
        "animatedVariantCount": sum(x["animation"]["status"] != "NOT_PRESENT" for x in records),
        "animationFrameCount": sum(x["animation"]["frameCount"] for x in records),
        "compositionOrder": "BSAR_ANIMATED_TERRAIN_THEN_VOID_MASKED_CORE_THEN_OPM_NCER_NCBR_OBJECTS",
        "visualPolicy": "ORIGINAL_PALETTE_TOPOLOGY_TILE_ORDER_OBJECT_COORDINATES_AND_ANIMATION_PRESERVED",
        "runtimeEligible": False,
        "shippingReady": False,
        "contactSheet": {"file": contact.name, "sha256": sha256(contact)},
        "fields": records,
    }
    write_json(output_root / "manifest.json", manifest)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-root", type=Path, required=True)
    parser.add_argument("--raw-field-root", type=Path, required=True)
    parser.add_argument("--verify-determinism", action="store_true")
    args = parser.parse_args()
    build(args.archive_root, args.raw_field_root, OUTPUT_ROOT)
    if args.verify_determinism:
        with tempfile.TemporaryDirectory() as directory:
            rebuilt = Path(directory) / "faithful-hd30"
            build(args.archive_root, args.raw_field_root, rebuilt)
            left = {p.relative_to(OUTPUT_ROOT): sha256(p) for p in OUTPUT_ROOT.rglob("*") if p.is_file()}
            right = {p.relative_to(rebuilt): sha256(p) for p in rebuilt.rglob("*") if p.is_file()}
            if left != right:
                raise SystemExit("Hunt HD30 determinism check failed")
            print(f"Deterministic faithful Hunt HD30 passed: {len(left)} files")


if __name__ == "__main__":
    main()
