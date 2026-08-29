#!/usr/bin/env python3
"""Build component-faithful Cage HD remaster candidates from the verified baseline.

The remaster never invents objects or placement. Core terrain, animated terrain,
and NCER-derived object cells are enhanced independently, then recomposed with
the verified OPMD -> NANR -> NCER first-frame binding and source coordinates.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


REPO = Path(__file__).resolve().parents[1]
SOURCE_ROOT = REPO / "docs/art/production/cage/faithful-hd40"
OUTPUT_ROOT = REPO / "docs/art/production/cage/hd-remaster-v1"
SCALE = 4
COMPLETED_FIELDS = [f"field_cm{i:02d}_01" for i in range(1, 21)]
NEXT_FIELDS = [f"field_cm{i:02d}_01" for i in range(21, 31)]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_reset(path: Path) -> None:
    expected = (REPO / "docs/art/production/cage/hd-remaster-v1").resolve()
    temporary = Path(tempfile.gettempdir()).resolve()
    resolved = path.resolve()
    if resolved != expected and temporary not in resolved.parents:
        raise RuntimeError(f"Refusing to replace unexpected output: {resolved}")
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)


def _equal(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.all(left == right, axis=2)


def _different(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.any(left != right, axis=2)


def scale2x_rgba(image: Image.Image) -> Image.Image:
    center = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    up = np.concatenate([center[:1], center[:-1]], axis=0)
    down = np.concatenate([center[1:], center[-1:]], axis=0)
    left = np.concatenate([center[:, :1], center[:, :-1]], axis=1)
    right = np.concatenate([center[:, 1:], center[:, -1:]], axis=1)
    output = np.empty((center.shape[0] * 2, center.shape[1] * 2, 4), dtype=np.uint8)
    output[0::2, 0::2] = np.where(
        (_equal(left, up) & _different(left, down) & _different(up, right))[..., None],
        left,
        center,
    )
    output[0::2, 1::2] = np.where(
        (_equal(up, right) & _different(up, left) & _different(right, down))[..., None],
        right,
        center,
    )
    output[1::2, 0::2] = np.where(
        (_equal(left, down) & _different(left, up) & _different(down, right))[..., None],
        left,
        center,
    )
    output[1::2, 1::2] = np.where(
        (_equal(down, right) & _different(left, down) & _different(up, right))[..., None],
        right,
        center,
    )
    return Image.fromarray(output, "RGBA")


def remaster_rgba(image: Image.Image, scale: int = SCALE) -> Image.Image:
    if scale != 4:
        raise ValueError("The locked Cage remaster profile supports exactly 4x")
    source = image.convert("RGBA")
    edge_authority = scale2x_rgba(scale2x_rgba(source))
    edge_pixels = np.asarray(edge_authority, dtype=np.uint8)

    values = np.asarray(source, dtype=np.float32) / 255.0
    alpha = values[..., 3:4]
    premultiplied = values[..., :3] * alpha
    premultiplied_rgba = Image.fromarray(
        np.uint8(np.clip(np.concatenate([premultiplied, alpha], axis=2) * 255.0, 0, 255)),
        "RGBA",
    )
    smooth = premultiplied_rgba.resize(edge_authority.size, Image.Resampling.BICUBIC)
    smooth_values = np.asarray(smooth, dtype=np.float32) / 255.0
    smooth_alpha = smooth_values[..., 3:4]
    smooth_premultiplied = np.minimum(smooth_values[..., :3], smooth_alpha)
    smooth_rgb = np.divide(
        smooth_premultiplied,
        smooth_alpha,
        out=np.zeros_like(smooth_premultiplied),
        where=smooth_alpha > (1.0 / 255.0),
    )

    edge_rgb = edge_pixels[..., :3].astype(np.float32) / 255.0
    opaque_mask = edge_pixels[..., 3:4] > 0
    reliable_smooth = smooth_alpha > 0.08
    final_rgb = np.where(opaque_mask & reliable_smooth, smooth_rgb, edge_rgb)
    final_rgb = np.where(opaque_mask, final_rgb, 0.0)
    final = np.concatenate(
        [np.uint8(np.clip(final_rgb * 255.0, 0, 255)), edge_pixels[..., 3:4]],
        axis=2,
    )
    return Image.fromarray(final, "RGBA")


def alpha_bounds(image: Image.Image) -> list[int] | None:
    bounds = image.getchannel("A").getbbox()
    return list(bounds) if bounds else None


def scaled_bounds(bounds: list[int] | None) -> list[int] | None:
    return [value * SCALE for value in bounds] if bounds else None


def transparent_rgb_is_zero(image: Image.Image) -> bool:
    pixels = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    transparent = pixels[..., 3] == 0
    return not np.any(pixels[..., :3][transparent])


def opaque_rgb_mae_after_downsample(source: Image.Image, remaster: Image.Image) -> float:
    reduced = remaster.resize(source.size, Image.Resampling.LANCZOS).convert("RGBA")
    original_values = np.asarray(source.convert("RGBA"), dtype=np.int16)
    reduced_values = np.asarray(reduced, dtype=np.int16)
    mask = original_values[..., 3] > 0
    if not np.any(mask):
        return 0.0
    return float(np.abs(original_values[..., :3][mask] - reduced_values[..., :3][mask]).mean())


def remaster_component(source_path: Path, output_path: Path, output_root: Path) -> tuple[Image.Image, dict]:
    source = Image.open(source_path).convert("RGBA")
    remaster = remaster_rgba(source)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    remaster.save(output_path, format="PNG", optimize=True)
    source_bounds = alpha_bounds(source)
    remaster_bounds = alpha_bounds(remaster)
    metrics = {
        "sourceFile": source_path.relative_to(SOURCE_ROOT).as_posix(),
        "sourceSha256": sha256(source_path),
        "file": output_path.relative_to(output_root).as_posix(),
        "sha256": sha256(output_path),
        "sourceDimensions": list(source.size),
        "dimensions": list(remaster.size),
        "sourceAlphaBounds": source_bounds,
        "expectedScaledAlphaBounds": scaled_bounds(source_bounds),
        "alphaBounds": remaster_bounds,
        "alphaBoundsPreservedAt4x": remaster_bounds == scaled_bounds(source_bounds),
        "transparentRgbZero": transparent_rgb_is_zero(remaster),
        "opaqueRgbMaeAfterLanczosDownsample": round(opaque_rgb_mae_after_downsample(source, remaster), 4),
    }
    return remaster, metrics


def checker(size: tuple[int, int], step: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, (242, 242, 238, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(220, 222, 218, 255))
    return image


def contained(image: Image.Image, size: tuple[int, int], padding: int = 8) -> Image.Image:
    preview = image.copy()
    preview.thumbnail((size[0] - 2 * padding, size[1] - 2 * padding), Image.Resampling.LANCZOS)
    canvas = checker(size)
    canvas.alpha_composite(preview, ((size[0] - preview.width) // 2, (size[1] - preview.height) // 2))
    return canvas


def save_contact(records: list[dict], path: Path, output_root: Path) -> None:
    cell = (320, 280)
    label_height = 22
    columns = 5
    rows = math.ceil(len(records) / columns)
    sheet = Image.new("RGB", (columns * cell[0], rows * (cell[1] + label_height)), (238, 236, 230))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, record in enumerate(records):
        image = Image.open(output_root / record["frameZero"]["file"]).convert("RGBA")
        x = (index % columns) * cell[0]
        y = (index // columns) * (cell[1] + label_height)
        sheet.paste(contained(image, cell).convert("RGB"), (x, y))
        draw.text((x + 8, y + cell[1] + 4), record["fieldId"], fill=(28, 33, 40), font=font)
    sheet.save(path, format="PNG", optimize=True)


def build(output_root: Path) -> None:
    safe_reset(output_root)
    source_manifest_path = SOURCE_ROOT / "manifest.json"
    source_manifest = json.loads(source_manifest_path.read_text(encoding="utf-8"))
    source_fields = {field["fieldId"]: field for field in source_manifest["fields"]}
    records = []

    for field_id in COMPLETED_FIELDS:
        source_field = source_fields[field_id]
        source_dir = SOURCE_ROOT / "fields" / field_id
        output_dir = output_root / "fields" / field_id
        output_dir.mkdir(parents=True)

        core, core_metrics = remaster_component(
            source_dir / "core-native.png",
            output_dir / "core-remaster-hd4x.png",
            output_root,
        )
        placement = json.loads((source_dir / "object-placement.json").read_text(encoding="utf-8"))
        cell_images: dict[int, tuple[Image.Image, dict]] = {}
        cell_metrics = []
        bank_record = source_field["objectCellBank"]
        if bank_record["status"] != "NOT_PRESENT":
            bank = json.loads((SOURCE_ROOT / bank_record["file"]).read_text(encoding="utf-8"))
            rendered_by_id = {cell["cellIndex"]: cell for cell in bank["renderedCells"]}
            for cell_index, cell in sorted(rendered_by_id.items()):
                image, metrics = remaster_component(
                    SOURCE_ROOT / cell["file"],
                    output_dir / "object-cells-remaster-hd4x" / f"cell-{cell_index:03d}.png",
                    output_root,
                )
                metrics.update({
                    "cellIndex": cell_index,
                    "sourceAnchor": [cell["anchorX"], cell["anchorY"]],
                    "remasterAnchor": [cell["anchorX"] * SCALE, cell["anchorY"] * SCALE],
                })
                cell_images[cell_index] = (image, cell)
                cell_metrics.append(metrics)

        static = core.copy()
        resolved_placements = []
        for item in placement["placements"]:
            cell_id = item["resolvedFirstFrameCellId"]
            image, cell = cell_images[cell_id]
            anchor_x = cell["anchorX"]
            anchor_y = cell["anchorY"]
            transformed = image
            if item["horizontalFlip"]:
                transformed = ImageOps.mirror(transformed)
                anchor_x = cell["width"] - anchor_x
            if item["verticalFlip"]:
                transformed = ImageOps.flip(transformed)
                anchor_y = cell["height"] - anchor_y
            destination = (
                item["sourceX"] * SCALE - anchor_x * SCALE,
                item["sourceY"] * SCALE - anchor_y * SCALE,
            )
            static.alpha_composite(transformed, destination)
            resolved_placements.append({
                "ordinal": item["ordinal"],
                "sequenceId": item["sequenceId"],
                "firstFrameCellId": cell_id,
                "sourceCoordinate": [item["sourceX"], item["sourceY"]],
                "remasterCoordinate": [item["sourceX"] * SCALE, item["sourceY"] * SCALE],
                "destinationTopLeft": list(destination),
                "horizontalFlip": item["horizontalFlip"],
                "verticalFlip": item["verticalFlip"],
            })
        static_path = output_dir / "static-composite-remaster-hd4x.png"
        static.save(static_path, format="PNG", optimize=True)

        animated_frames = []
        animation = source_field["animatedLayer"]
        if animation["status"] == "PRESENT_VERIFIED_ROM_DECODED":
            for frame in animation["layerFrames"]:
                layer, metrics = remaster_component(
                    SOURCE_ROOT / frame["file"],
                    output_dir / f"animated-layer-remaster-frame-{frame['frameIndex']:02d}.png",
                    output_root,
                )
                composite = layer.copy()
                composite.alpha_composite(static)
                composite_path = output_dir / f"composite-remaster-frame-{frame['frameIndex']:02d}.png"
                composite.save(composite_path, format="PNG", optimize=True)
                animated_frames.append({
                    "frameIndex": frame["frameIndex"],
                    "rawDurationTicks": frame["rawDurationTicks"],
                    "layer": metrics,
                    "compositeFile": composite_path.relative_to(output_root).as_posix(),
                    "compositeSha256": sha256(composite_path),
                })
            frame_zero_path = output_dir / "composite-remaster-frame-00.png"
        else:
            frame_zero_path = static_path

        collision = json.loads((SOURCE_ROOT / source_field["collision"]["file"]).read_text(encoding="utf-8"))
        expected_size = (collision["width"] * 8 * SCALE, collision["height"] * 8 * SCALE)
        if core.size != expected_size or Image.open(frame_zero_path).size != expected_size:
            raise RuntimeError(f"{field_id} remaster no longer aligns to the original 8-pixel grid")
        if not core_metrics["transparentRgbZero"] or any(not cell["transparentRgbZero"] for cell in cell_metrics):
            raise RuntimeError(f"{field_id} contains RGB contamination in fully transparent pixels")

        records.append({
            "fieldId": field_id,
            "ordinal": source_field["ordinal"],
            "nameEn": source_field["nameEn"],
            "nameJp": source_field["nameJp"],
            "profile": "COMPONENT_FAITHFUL_EDGE_AWARE_BICUBIC_PMA_4X_V1",
            "sourceAuthority": "FAITHFUL_HD40_RAW_RECOMPOSITION",
            "core": core_metrics,
            "objectCells": cell_metrics,
            "objectPlacements": resolved_placements,
            "staticComposite": {
                "file": static_path.relative_to(output_root).as_posix(),
                "sha256": sha256(static_path),
                "dimensions": list(static.size),
            },
            "animatedFrames": animated_frames,
            "frameZero": {
                "file": frame_zero_path.relative_to(output_root).as_posix(),
                "sha256": sha256(frame_zero_path),
                "dimensions": list(Image.open(frame_zero_path).size),
            },
            "grid": {
                "width": collision["width"],
                "height": collision["height"],
                "nativeCellPixels": 8,
                "remasterCellPixels": 32,
                "aligned": True,
            },
        })

    contact_path = output_root / "cage-cm01-cm20-remaster-contact.png"
    save_contact(records, contact_path, output_root)
    manifest = {
        "schemaVersion": 1,
        "batch": "ART_A3_CAGE_HD_REMASTER_V1_CM11_CM20",
        "completedBatches": [
            {
                "batch": "ART_A3_CAGE_HD_REMASTER_V1_CM01_CM10",
                "fields": [f"field_cm{i:02d}_01" for i in range(1, 11)],
            },
            {
                "batch": "ART_A3_CAGE_HD_REMASTER_V1_CM11_CM20",
                "fields": [f"field_cm{i:02d}_01" for i in range(11, 21)],
            },
        ],
        "fieldCount": len(records),
        "plannedFieldCount": 40,
        "completedFields": COMPLETED_FIELDS,
        "nextFields": NEXT_FIELDS,
        "scale": SCALE,
        "profile": "COMPONENT_FAITHFUL_EDGE_AWARE_BICUBIC_PMA_4X_V1",
        "componentOrder": "ANIMATED_TERRAIN_BEHIND_CORE_THEN_OPMD_NANR_NCER_OBJECTS",
        "sourceManifest": {
            "file": source_manifest_path.relative_to(REPO).as_posix(),
            "sha256": sha256(source_manifest_path),
        },
        "visualPolicy": "ORIGINAL_COMPOSITION_PALETTE_FAMILY_OBJECT_IDENTITY_COORDINATES_AND_FLIPS_PRESERVED",
        "alphaPolicy": "SCALE2X_BINARY_EDGE_AUTHORITY_BICUBIC_PREMULTIPLIED_RGB_TRANSPARENT_RGB_ZERO",
        "gameplayPolicy": "COL_ATR_NBS_AND_PLACEMENT_AUTHORITY_UNCHANGED_NOT_EMBEDDED_IN_ART",
        "rightsStatus": "LICENSED",
        "licenseEvidenceStatus": "OWNER_REPORTED_LINK_PENDING",
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "contactSheet": {
            "file": contact_path.relative_to(output_root).as_posix(),
            "sha256": sha256(contact_path),
        },
        "qa": {
            "allFieldsGridAligned": all(record["grid"]["aligned"] for record in records),
            "allCoreTransparentRgbZero": all(record["core"]["transparentRgbZero"] for record in records),
            "allObjectCellsTransparentRgbZero": all(
                cell["transparentRgbZero"] for record in records for cell in record["objectCells"]
            ),
            "placementRelayoutPerformed": False,
            "newObjectsInvented": False,
            "recolorDirectionApplied": False,
            "humanVisualReviewRequired": True,
        },
        "fields": records,
    }
    write_json(output_root / "manifest.json", manifest)


def tree_hashes(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): sha256(path)
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-determinism", action="store_true")
    args = parser.parse_args()
    build(OUTPUT_ROOT)
    if args.verify_determinism:
        first = tree_hashes(OUTPUT_ROOT)
        with tempfile.TemporaryDirectory() as directory:
            second_root = Path(directory) / "hd-remaster-v1"
            build(second_root)
            second = tree_hashes(second_root)
        if first != second:
            raise SystemExit("Cage HD remaster determinism check failed")
        print(f"Deterministic Cage CM01-CM20 remaster passed: {len(first)} files")


if __name__ == "__main__":
    main()
