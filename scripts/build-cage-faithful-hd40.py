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


REPO = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = REPO / "docs/art/production/cage/faithful-hd40"
CROSSWALK = REPO / "docs/art/technical/a1-cage-original-structure/CM40_ORIGINAL_STRUCTURE_CROSSWALK.csv"
FIELD_IDS = [f"field_cm{i:02d}_01" for i in range(1, 41)]
PARTIAL_FIELDS = {"field_cm12_01", "field_cm18_01"}
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
        cell_id, x, y, raw_flags, raw_float_a, raw_float_b = struct.unpack_from("<HHHHff", data, cursor + index * 16)
        placements.append({
            "ordinal": index,
            "cellId": cell_id,
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


def parse_nbs(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"NBSR":
        raise ValueError(f"Unsupported NBS header: {path.name}")
    version, width, height, layer_count = struct.unpack_from("<IIII", data, 4)
    entries = list(struct.unpack_from(f"<{width * height}H", data, 20))
    if len(data) != 20 + width * height * 2:
        raise ValueError(f"NBS cell count mismatch: {path.name}")
    cells = [{
        "raw": value,
        "tileIndex": value & 0x03FF,
        "horizontalFlip": bool(value & 0x0400),
        "verticalFlip": bool(value & 0x0800),
        "paletteBank": (value >> 12) & 0x0F,
    } for value in entries]
    return {
        "format": "YDIJ_NBSR_TILEMAP_V2",
        "sourceSha256": sha256(path),
        "version": version,
        "width": width,
        "height": height,
        "layerCount": layer_count,
        "cellOrder": "ROW_MAJOR",
        "cells": cells,
    }


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

        source_image = Image.open(native_path).convert("RGBA")
        original_out = field_dir / "native-original.png"
        shutil.copyfile(native_path, original_out)
        hd = source_image.resize((source_image.width * SCALE, source_image.height * SCALE), Image.Resampling.NEAREST)
        hd_out = field_dir / "faithful-hd4x.png"
        hd.save(hd_out, optimize=True)
        if hd.resize(source_image.size, Image.Resampling.NEAREST).tobytes() != source_image.tobytes():
            raise ValueError(f"{field_id} HD round-trip differs from original pixels")

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
        placement["quarantined"] = field_id in PARTIAL_FIELDS
        placement["authority"] = "ORIGINAL_PLACEMENT_REFERENCE" if field_id not in PARTIAL_FIELDS else "ORIGINAL_OBJECT_INDEX_CONFLICT_DO_NOT_BIND"
        placement_out = field_dir / "object-placement.json"
        write_json(placement_out, placement)

        payloads = {}
        for extension in ("nbs", "ncgr", "nclr", "atr", "col", "opm"):
            payload = raw_root / f"{field_id}.{extension}"
            payloads[extension] = {"present": payload.exists(), "sha256": sha256(payload) if payload.exists() else None}
        row = rows[field_id]
        records.append({
            "assetId": f"art:cage:{field_id}:faithful-hd4x-baseline",
            "fieldId": field_id,
            "ordinal": int(row["ordinal"]),
            "nameEn": row["name_en"],
            "nameJp": row["name_jp"],
            "compositionConfidence": metadata["composition_confidence"],
            "originalDimensions": metadata["dimensions"],
            "layoutCells": metadata["layout_cells"],
            "nativeOriginal": {"file": f"fields/{field_id}/native-original.png", "sha256": sha256(original_out), "width": source_image.width, "height": source_image.height},
            "faithfulHd4x": {"file": f"fields/{field_id}/faithful-hd4x.png", "sha256": sha256(hd_out), "width": hd.width, "height": hd.height, "scale": SCALE, "filter": "NEAREST", "downsampleRoundTripEqualsOriginal": True},
            "coreTilemap": {"file": f"fields/{field_id}/core-tilemap.json", "sha256": sha256(tilemap_out), "sourceSha256": tilemap["sourceSha256"]},
            "collision": {"file": f"fields/{field_id}/collision-raw-classes.json", "sha256": sha256(collision_out), "sourceSha256": col["sourceSha256"], "classSemantics": col["classSemantics"]},
            "attribute": {"file": f"fields/{field_id}/attribute-raw-classes.json", "sha256": sha256(attribute_out), "sourceSha256": atr["sourceSha256"], "classSemantics": atr["classSemantics"]},
            "objectPlacement": {"file": f"fields/{field_id}/object-placement.json", "sha256": sha256(placement_out), "sourceSha256": placement["sourceSha256"], "count": placement["placementCount"], "authority": placement["authority"]},
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
        "fullCompositionConfidenceCount": 38,
        "partialObjectConflictFields": sorted(PARTIAL_FIELDS),
        "ownerDirection": "PRESERVE_ORIGINAL_ART_COMPOSITION_PLACEMENT_COLLISION_AND_ART_CODE_100_PERCENT_ONLY_UPSCALE_TO_HD",
        "visualPolicy": "BYTE_IDENTICAL_NATIVE_BASELINE_PLUS_4X_NEAREST_NO_RELAYOUT_NO_RECOLOR_NO_REDESIGN",
        "dataPolicy": "COL_ATR_NBS_OPM_RAW_VALUES_PRESERVED_WITHOUT_SEMANTIC_REINTERPRETATION",
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
            "objectPlacementRelayoutPerformed": False,
            "unknownClassSemanticsInvented": False,
            "cm12Cm18ObjectConflictBound": False,
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
