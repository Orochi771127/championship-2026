#!/usr/bin/env python3
"""Build a deterministic, PixiJS-ready faithful-HD character batch.

The source PNGs and the large decoded ROM manifest are research references and
remain outside the runtime tree.  This builder extracts the already decoded
cell witnesses, removes only the reference-sheet background, performs an exact
4x nearest-neighbour enlargement, packs trimmed cells into PixiJS atlases, and
copies the original NANR timelines into a neutral JSON runtime contract.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


DEFAULT_OUTPUT_ROOT = Path("docs/art/production/characters/faithful-hd224")

BATCH_SIZE = 32
SCALE = 4
SHEET_COLUMNS = 8
SHEET_CELL_WIDTH = 96
SHEET_CELL_HEIGHT = 104
SHEET_ART_HEIGHT = 88
ATLAS_MAX_SIZE = 2048
ATLAS_PADDING = 8
LOGICAL_WIDTH = SHEET_CELL_WIDTH * SCALE
LOGICAL_HEIGHT = SHEET_ART_HEIGHT * SCALE
GROUND_Y = 80 * SCALE
ANCHOR = {"x": 0.5, "y": GROUND_Y / LOGICAL_HEIGHT}

SEMANTIC_ALIASES = {
    0: ("idle", "HIGH"),
    1: ("idle_blink", "HIGH"),
    2: ("walk", "HIGH"),
    3: ("run", "HIGH"),
    4: ("alert", "MEDIUM_HIGH"),
    5: ("hurt", "VERY_HIGH"),
    6: ("jump_hit_reaction", "HIGH"),
    7: ("attack_1", "MEDIUM"),
    8: ("attack_2", "MEDIUM"),
    9: ("attack_3", "HIGH"),
    10: ("attack_4", "MEDIUM"),
    11: ("flee", "HIGH"),
    12: ("tired_walk", "MEDIUM_HIGH"),
    13: ("sleep", "HIGH"),
    14: ("eat", "HIGH"),
    15: ("rest", "HIGH"),
    16: ("restrained_idle_a", "HIGH"),
    17: ("restrained_idle_b", "HIGH"),
    18: ("restrained_walk", "HIGH"),
    19: ("restrained_run", "HIGH"),
    20: ("restrained_alert", "HIGH"),
    21: ("restrained_flee", "HIGH"),
    22: ("restrained_tired_walk", "HIGH"),
    23: ("restrained_sleep", "HIGH"),
    24: ("restrained_eat", "HIGH"),
    25: ("restrained_rest", "HIGH"),
    26: ("zapped", "VERY_HIGH"),
    27: ("post_zap_transition", "HIGH_RELATIONSHIP_EXACT_LABEL_UNRESOLVED"),
    28: ("happy", "HIGH"),
    29: ("angry", "HIGH"),
    30: ("cheer_victory", "HIGH"),
    31: ("guard", "MEDIUM_HIGH"),
    32: ("train", "VERY_HIGH"),
    33: ("shout", "MEDIUM_HIGH"),
    34: ("guard_variant", "MEDIUM"),
    35: ("shout_continuation", "MEDIUM"),
    36: ("battle_status_unknown", "MEDIUM"),
    37: ("knocked_out", "VERY_HIGH"),
    38: ("jump_hit_action", "HIGH"),
    39: ("training_effect_state", "HIGH_ROLE_EXACT_LABEL_UNRESOLVED"),
}


def serialize(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest().upper()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def next_multiple(value: int, multiple: int = 4) -> int:
    return max(multiple, math.ceil(value / multiple) * multiple)


def batch_slice(entities: list[dict[str, Any]], batch_number: int) -> list[dict[str, Any]]:
    start = (batch_number - 1) * BATCH_SIZE
    end = start + BATCH_SIZE
    selected = entities[start:end]
    if len(selected) != BATCH_SIZE:
        raise ValueError(f"Batch {batch_number} expected 32 entities, found {len(selected)}")
    return selected


def extract_cells(sheet_path: Path, cell_count: int) -> list[dict[str, Any]]:
    sheet = Image.open(sheet_path).convert("RGBA")
    rows = math.ceil(cell_count / SHEET_COLUMNS)
    top_margin = sheet.height - rows * SHEET_CELL_HEIGHT
    if sheet.width != SHEET_COLUMNS * SHEET_CELL_WIDTH or not (0 <= top_margin <= 64):
        raise ValueError(f"Unexpected sheet geometry: {sheet_path} = {sheet.size}, margin={top_margin}")

    background_rgb = sheet.getpixel((0, 0))[:3]
    cells: list[dict[str, Any]] = []
    for cell_id in range(cell_count):
        column = cell_id % SHEET_COLUMNS
        row = cell_id // SHEET_COLUMNS
        left = column * SHEET_CELL_WIDTH
        top = top_margin + row * SHEET_CELL_HEIGHT
        tile = sheet.crop((left, top, left + SHEET_CELL_WIDTH, top + SHEET_ART_HEIGHT))
        pixels = tile.load()
        opaque_points: list[tuple[int, int]] = []
        for y in range(tile.height):
            for x in range(tile.width):
                rgba = pixels[x, y]
                if rgba[:3] == background_rgb:
                    pixels[x, y] = (rgba[0], rgba[1], rgba[2], 0)
                else:
                    opaque_points.append((x, y))
        is_blank = not opaque_points
        if is_blank:
            min_x = 0
            min_y = 0
            max_x = 1
            max_y = 1
            native = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
        else:
            min_x = min(point[0] for point in opaque_points)
            min_y = min(point[1] for point in opaque_points)
            max_x = max(point[0] for point in opaque_points) + 1
            max_y = max(point[1] for point in opaque_points) + 1
            native = tile.crop((min_x, min_y, max_x, max_y))
        hd = native.resize((native.width * SCALE, native.height * SCALE), Image.Resampling.NEAREST)
        cells.append(
            {
                "cellId": cell_id,
                "isBlank": is_blank,
                "native": native,
                "hd": hd,
                "nativeTrim": {"x": min_x, "y": min_y, "w": native.width, "h": native.height},
                "nativeRgbaSha256": sha256_bytes(native.tobytes()),
                "hdRgbaSha256": sha256_bytes(hd.tobytes()),
            }
        )
    return cells


def pack_atlases(
    entity_id: str,
    side_name: str,
    cells: list[dict[str, Any]],
    output_dir: Path,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    pages: list[dict[str, Any]] = []
    frame_lookup: dict[str, dict[str, Any]] = {}
    pending = list(cells)
    page_index = 0

    while pending:
        placements: list[tuple[dict[str, Any], int, int]] = []
        x = ATLAS_PADDING
        y = ATLAS_PADDING
        row_height = 0
        remaining: list[dict[str, Any]] = []
        max_right = 0
        max_bottom = 0

        for cell in pending:
            image = cell["hd"]
            if image.width + ATLAS_PADDING * 2 > ATLAS_MAX_SIZE or image.height + ATLAS_PADDING * 2 > ATLAS_MAX_SIZE:
                raise ValueError(f"Cell is too large for atlas: {entity_id}/{side_name}/{cell['cellId']}")
            if x + image.width + ATLAS_PADDING > ATLAS_MAX_SIZE:
                x = ATLAS_PADDING
                y += row_height + ATLAS_PADDING
                row_height = 0
            if y + image.height + ATLAS_PADDING > ATLAS_MAX_SIZE:
                remaining.append(cell)
                continue
            placements.append((cell, x, y))
            max_right = max(max_right, x + image.width + ATLAS_PADDING)
            max_bottom = max(max_bottom, y + image.height + ATLAS_PADDING)
            x += image.width + ATLAS_PADDING
            row_height = max(row_height, image.height)

        if not placements:
            raise ValueError(f"Atlas packing made no progress for {entity_id}/{side_name}")

        page_width = next_multiple(max_right)
        page_height = next_multiple(max_bottom)
        page_image = Image.new("RGBA", (page_width, page_height), (0, 0, 0, 0))
        page_frames: dict[str, Any] = {}
        for cell, frame_x, frame_y in placements:
            image = cell["hd"]
            page_image.alpha_composite(image, (frame_x, frame_y))
            frame_key = f"{entity_id}/{side_name}/cell_{cell['cellId']:03d}"
            source_x = (LOGICAL_WIDTH - image.width) // 2
            source_y = GROUND_Y - image.height
            if source_y < 0:
                source_y = LOGICAL_HEIGHT - image.height
            frame_record = {
                "frame": {"x": frame_x, "y": frame_y, "w": image.width, "h": image.height},
                "rotated": False,
                "trimmed": True,
                "spriteSourceSize": {"x": source_x, "y": source_y, "w": image.width, "h": image.height},
                "sourceSize": {"w": LOGICAL_WIDTH, "h": LOGICAL_HEIGHT},
                "anchor": ANCHOR,
            }
            page_frames[frame_key] = frame_record
            frame_lookup[frame_key] = {
                "page": page_index,
                "nativeTrim": cell["nativeTrim"],
                "isBlank": cell["isBlank"],
                "nativeRgbaSha256": cell["nativeRgbaSha256"],
                "hdRgbaSha256": cell["hdRgbaSha256"],
                **frame_record,
            }

        image_name = f"{side_name}-atlas-{page_index:02d}.png"
        json_name = f"{side_name}-atlas-{page_index:02d}.json"
        image_path = output_dir / image_name
        json_path = output_dir / json_name
        page_image.save(image_path, optimize=True)
        atlas_json = {
            "frames": page_frames,
            "meta": {
                "app": "Championship2026 faithful character atlas builder",
                "version": "1.0",
                "image": image_name,
                "format": "RGBA8888",
                "size": {"w": page_width, "h": page_height},
                "scale": "1",
            },
        }
        json_path.write_text(serialize(atlas_json), encoding="utf-8")
        pages.append(
            {
                "page": page_index,
                "image": image_name,
                "data": json_name,
                "width": page_width,
                "height": page_height,
                "frameCount": len(page_frames),
                "imageSha256": sha256_file(image_path),
                "dataSha256": sha256_file(json_path),
            }
        )
        pending = remaining
        page_index += 1
    return pages, frame_lookup


def runtime_animations(entity_id: str, side_name: str, animation_bank: dict[str, Any]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for sequence in animation_bank["sequences"]:
        sequence_id = sequence["sequence_id"]
        alias = SEMANTIC_ALIASES.get(sequence_id) if side_name == "main" else None
        output.append(
            {
                "id": sequence_id,
                "name": f"action_{sequence_id:02d}",
                "semanticAlias": alias[0] if alias else None,
                "semanticConfidence": alias[1] if alias else "RAW_SLOT_ONLY",
                "playbackMode": sequence["playback_mode"],
                "playback": sequence["playback_semantics"],
                "frames": [
                    {
                        "texture": f"{entity_id}/{side_name}/cell_{frame['cell_id']:03d}",
                        "cell": frame["cell_id"],
                        "ticks": frame["duration_ticks"],
                        "millisecondsAt60Hz": round(frame["duration_ticks"] * 1000 / 60, 3),
                    }
                    for frame in sequence["frames"]
                ],
            }
        )
    return output


def draw_batch_contact_sheet(records: list[dict[str, Any]], batch_dir: Path, batch_number: int) -> Path:
    columns = 8
    card_width = 240
    card_height = 240
    rows = math.ceil(len(records) / columns)
    canvas = Image.new("RGBA", (columns * card_width, rows * card_height), (246, 248, 251, 255))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for index, record in enumerate(records):
        x = (index % columns) * card_width
        y = (index // columns) * card_height
        preview_path = batch_dir / record["entityId"] / record["preview"]
        preview = Image.open(preview_path).convert("RGBA")
        preview.thumbnail((180, 180), Image.Resampling.NEAREST)
        px = x + (card_width - preview.width) // 2
        py = y + 16 + (180 - preview.height) // 2
        canvas.alpha_composite(preview, (px, py))
        draw.text((x + 12, y + 206), f"{index + 1:02d}  {record['entityId']}", fill=(24, 28, 36, 255), font=font)
    path = batch_dir / f"batch-{batch_number:02d}-contact-sheet.png"
    canvas.save(path, optimize=True)
    return path


def build(args: argparse.Namespace, batch_number: int) -> Path:
    reference_root = args.reference_root.resolve()
    manifest_path = reference_root / "digimon_runtime_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    selected = batch_slice(manifest["entities"], batch_number)
    batch_dir = args.output_root.resolve() / f"batch-{batch_number:02d}"
    batch_dir.mkdir(parents=True, exist_ok=True)

    records: list[dict[str, Any]] = []
    for ordinal, entity in enumerate(selected, start=(batch_number - 1) * BATCH_SIZE + 1):
        entity_id = entity["entity_id"]
        entity_dir = batch_dir / entity_id
        entity_dir.mkdir(parents=True, exist_ok=True)
        side_records: dict[str, Any] = {}
        runtime_sides: dict[str, Any] = {}

        for side_name in ("main", "sub"):
            side = entity["sides"][side_name]
            sheet_path = reference_root / "rendered_character_reference" / f"{side_name}_cells" / f"{entity_id}_{side_name}_cells.png"
            cells = extract_cells(sheet_path, side["cells"]["cell_count"])
            pages, frame_lookup = pack_atlases(entity_id, side_name, cells, entity_dir)
            side_records[side_name] = {
                "sourceSheetSha256": sha256_file(sheet_path),
                "cellCount": len(cells),
                "sequenceCount": side["animations"]["sequence_count"],
                "frameRecordCount": side["animations"]["frame_record_count"],
                "atlasPages": pages,
                "frameManifest": frame_lookup,
            }
            runtime_sides[side_name] = {
                "atlases": [{"image": page["image"], "data": page["data"]} for page in pages],
                "animations": runtime_animations(entity_id, side_name, side["animations"]),
            }

        first_main = Image.open(entity_dir / side_records["main"]["atlasPages"][0]["image"]).convert("RGBA")
        first_frame = side_records["main"]["frameManifest"][f"{entity_id}/main/cell_000"]["frame"]
        preview = first_main.crop(
            (
                first_frame["x"],
                first_frame["y"],
                first_frame["x"] + first_frame["w"],
                first_frame["y"] + first_frame["h"],
            )
        )
        preview_path = entity_dir / "cell-000-main-hd4x.png"
        preview.save(preview_path, optimize=True)

        runtime = {
            "schemaVersion": 1,
            "entityId": entity_id,
            "kind": entity["kind"],
            "renderer": "PIXIJS_V8_SPRITESHEET",
            "artProfile": {
                "style": "ORIGINAL_HAND_DRAWN_PIXEL_ART_FAITHFUL_HD4X",
                "scale": SCALE,
                "filter": "nearest",
                "logicalCanvas": [LOGICAL_WIDTH, LOGICAL_HEIGHT],
                "anchor": ANCHOR,
                "alphaBoundary": "TRANSPARENT",
                "palettePolicy": "ORIGINAL_MAJOR_PALETTE_EXACT",
            },
            "timing": {
                "source": "ORIGINAL_NANR_DURATION_TICKS",
                "tickRateHz": 60,
                "tickRateEvidence": "NDS_VBLANK_BASIS_PROVISIONAL_PENDING_EXECUTABLE_TIMING_TRACE",
            },
            "sides": runtime_sides,
        }
        runtime_path = entity_dir / "runtime.json"
        runtime_path.write_text(serialize(runtime), encoding="utf-8")

        record = {
            "ordinal": ordinal,
            "entityId": entity_id,
            "kind": entity["kind"],
            "preview": preview_path.name,
            "previewSha256": sha256_file(preview_path),
            "runtime": runtime_path.name,
            "runtimeSha256": sha256_file(runtime_path),
            "main": side_records["main"],
            "sub": side_records["sub"],
            "productionStatus": "PIXEL_FAITHFUL_HD4X_FUNCTIONAL_BASELINE",
            "runtimeEligible": False,
            "shippingReady": False,
        }
        (entity_dir / "manifest.json").write_text(serialize(record), encoding="utf-8")
        records.append(record)
        print(f"built {ordinal:03d}/224 {entity_id}")

    contact_sheet_path = draw_batch_contact_sheet(records, batch_dir, batch_number)
    batch_manifest = {
        "schemaVersion": 1,
        "batch": f"CHARACTER_FAITHFUL_HD_BATCH_{batch_number:02d}",
        "scope": {
            "batchNumber": batch_number,
            "batchSize": BATCH_SIZE,
            "firstOrdinal": records[0]["ordinal"],
            "lastOrdinal": records[-1]["ordinal"],
            "totalRoster": len(manifest["entities"]),
            "entityCount": len(records),
        },
        "ownerDirection": "FAITHFUL_HD_DEFAULT_SKIN_ORIGINAL_MAJOR_PALETTE_AND_HAND_DRAWN_FEEL_CAT_DOG_SKINS_LATER",
        "visualPolicy": "EXACT_DECODED_CELL_ART_PLUS_4X_NEAREST_NO_RECOLOR_NO_REDESIGN",
        "animationPolicy": "ORIGINAL_NANR_CELL_REFERENCES_DURATIONS_AND_PLAYBACK_PRESERVED",
        "atlasPolicy": "TRIMMED_RGBA_PIXIJS_V8_ATLAS_SHARED_BOTTOM_CENTER_ANCHOR",
        "sourceManifest": {
            "logicalId": "YDIJ_DIGIMON_RUNTIME_MANIFEST",
            "sha256": sha256_file(manifest_path),
            "romSha256": "8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1",
        },
        "rightsStatus": "LICENSED",
        "licenseEvidenceStatus": "OWNER_REPORTED_LINK_PENDING",
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "artifactMaturity": "FUNCTIONAL_PIXEL_FAITHFUL_HD_BASELINE_NOT_SMOOTH_HAND_REDRAW",
        "contactSheet": contact_sheet_path.name,
        "contactSheetSha256": sha256_file(contact_sheet_path),
        "records": records,
    }
    manifest_output = batch_dir / "manifest.json"
    manifest_output.write_text(serialize(batch_manifest), encoding="utf-8")
    print(f"wrote {manifest_output} with {len(records)} entities")
    return manifest_output


def write_master_manifest(args: argparse.Namespace, batch_manifests: list[Path]) -> Path:
    batches = [json.loads(path.read_text(encoding="utf-8")) for path in batch_manifests]
    records = [record for batch in batches for record in batch["records"]]
    output_root = args.output_root.resolve()
    master = {
        "schemaVersion": 1,
        "catalog": "CHARACTER_FAITHFUL_HD224",
        "entityCount": len(records),
        "batchCount": len(batches),
        "batchSize": BATCH_SIZE,
        "fullRosterBuilt": len(records) == 224,
        "visualPolicy": "EXACT_DECODED_CELL_ART_PLUS_4X_NEAREST_NO_RECOLOR_NO_REDESIGN",
        "animationPolicy": "ORIGINAL_MAIN_SUB_NANR_TIMELINES_PRESERVED",
        "renderer": "PIXIJS_V8_SPRITESHEET",
        "rightsStatus": "LICENSED",
        "licenseEvidenceStatus": "OWNER_REPORTED_LINK_PENDING",
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "artifactMaturity": "FUNCTIONAL_PIXEL_FAITHFUL_HD_BASELINE_NOT_SMOOTH_HAND_REDRAW",
        "batches": [
            {
                "batchNumber": batch["scope"]["batchNumber"],
                "directory": f"batch-{batch['scope']['batchNumber']:02d}",
                "manifest": f"batch-{batch['scope']['batchNumber']:02d}/manifest.json",
                "manifestSha256": sha256_file(batch_manifests[index]),
                "firstOrdinal": batch["scope"]["firstOrdinal"],
                "lastOrdinal": batch["scope"]["lastOrdinal"],
                "entityCount": batch["scope"]["entityCount"],
                "contactSheet": f"batch-{batch['scope']['batchNumber']:02d}/{batch['contactSheet']}",
            }
            for index, batch in enumerate(batches)
        ],
        "entities": [
            {
                "ordinal": record["ordinal"],
                "entityId": record["entityId"],
                "kind": record["kind"],
                "batchNumber": ((record["ordinal"] - 1) // BATCH_SIZE) + 1,
                "runtime": f"batch-{((record['ordinal'] - 1) // BATCH_SIZE) + 1:02d}/{record['entityId']}/{record['runtime']}",
                "preview": f"batch-{((record['ordinal'] - 1) // BATCH_SIZE) + 1:02d}/{record['entityId']}/{record['preview']}",
            }
            for record in records
        ],
    }
    path = output_root / "manifest.json"
    path.write_text(serialize(master), encoding="utf-8")
    print(f"wrote full roster manifest {path} with {len(records)} entities")
    return path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, choices=range(1, 8), default=1)
    parser.add_argument("--all", action="store_true")
    parser.add_argument(
        "--reference-root",
        type=Path,
        default=os.environ.get("CHAMPIONSHIP_CHARACTER_REFERENCE_ROOT"),
        help="Decoded character structure root (or set CHAMPIONSHIP_CHARACTER_REFERENCE_ROOT)",
    )
    parser.add_argument(
        "--o2-root",
        type=Path,
        default=os.environ.get("CHAMPIONSHIP_CHARACTER_O2_ROOT"),
        help="Decoded O2 character catalogue root (or set CHAMPIONSHIP_CHARACTER_O2_ROOT)",
    )
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    arguments = parser.parse_args()
    if arguments.reference_root is None:
        parser.error("--reference-root or CHAMPIONSHIP_CHARACTER_REFERENCE_ROOT is required")
    if arguments.o2_root is None:
        parser.error("--o2-root or CHAMPIONSHIP_CHARACTER_O2_ROOT is required")
    return arguments


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.all:
        manifests = [build(arguments, batch_number) for batch_number in range(1, 8)]
        write_master_manifest(arguments, manifests)
    else:
        build(arguments, arguments.batch)
