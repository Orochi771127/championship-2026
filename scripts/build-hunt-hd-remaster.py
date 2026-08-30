#!/usr/bin/env python3
"""Build bounded Hunt HD remaster candidates from exact original composites.

The exact baseline already reconstructs each frame through BSAR animated terrain,
void-masked core terrain, and OPM/NCER/NCBR objects. This stage enhances the
complete authoritative frame so no object, tile seam, or layer coordinate can
move during high-resolution processing.
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
from PIL import Image, ImageDraw, ImageFont


REPO = Path(__file__).resolve().parents[1]
SOURCE_ROOT = REPO / "docs/art/production/hunt/faithful-hd30"
OUTPUT_ROOT = REPO / "docs/art/production/hunt/hd-remaster-v1"
FIRST_BATCH = ["field_hm00_01", "field_hm01_01", "field_hm01_02", "field_hm02_01", "field_hm02_02"]
SCALE = 2


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_reset(path: Path) -> None:
    expected = OUTPUT_ROOT.resolve()
    temporary = Path(tempfile.gettempdir()).resolve()
    resolved = path.resolve()
    if resolved != expected and temporary not in resolved.parents:
        raise RuntimeError(f"Refusing to replace unexpected Hunt output: {resolved}")
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
        (_equal(left, up) & _different(left, down) & _different(up, right))[..., None], left, center
    )
    output[0::2, 1::2] = np.where(
        (_equal(up, right) & _different(up, left) & _different(right, down))[..., None], right, center
    )
    output[1::2, 0::2] = np.where(
        (_equal(left, down) & _different(left, up) & _different(down, right))[..., None], left, center
    )
    output[1::2, 1::2] = np.where(
        (_equal(down, right) & _different(left, down) & _different(up, right))[..., None], right, center
    )
    return Image.fromarray(output, "RGBA")


def remaster_rgba(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    edge = np.asarray(scale2x_rgba(source), dtype=np.uint8)
    values = np.asarray(source, dtype=np.float32) / 255.0
    alpha = values[..., 3:4]
    premultiplied = values[..., :3] * alpha
    packed = Image.fromarray(
        np.uint8(np.clip(np.concatenate([premultiplied, alpha], axis=2) * 255.0, 0, 255)), "RGBA"
    )
    smooth = np.asarray(packed.resize((source.width * 2, source.height * 2), Image.Resampling.BICUBIC), dtype=np.float32) / 255.0
    smooth_alpha = smooth[..., 3:4]
    smooth_rgb = np.divide(
        np.minimum(smooth[..., :3], smooth_alpha),
        smooth_alpha,
        out=np.zeros_like(smooth[..., :3]),
        where=smooth_alpha > (1.0 / 255.0),
    )
    edge_rgb = edge[..., :3].astype(np.float32) / 255.0
    opaque = edge[..., 3:4] > 0
    # A restrained edge contribution protects small props and tile texture at
    # 2x while bicubic colour avoids the worm artifacts of pure Scale2x.
    rgb = smooth_rgb * 0.82 + edge_rgb * 0.18
    rgb = np.where(opaque, rgb, 0.0)
    output = np.concatenate([np.uint8(np.clip(rgb * 255.0, 0, 255)), edge[..., 3:4]], axis=2)
    return Image.fromarray(output, "RGBA")


def transparent_rgb_is_zero(image: Image.Image) -> bool:
    values = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    transparent = values[..., 3] == 0
    return not np.any(values[..., :3][transparent])


def diagnostic_red_pixel_count(image: Image.Image) -> int:
    """Count the solid-red sentinel used by incomplete reconstruction views."""
    values = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    diagnostic = (
        (values[..., 0] >= 250)
        & (values[..., 1] <= 5)
        & (values[..., 2] <= 5)
        & (values[..., 3] > 0)
    )
    return int(np.count_nonzero(diagnostic))


def rgb_mae_after_downsample(source: Image.Image, remaster: Image.Image) -> float:
    reduced = np.asarray(remaster.resize(source.size, Image.Resampling.LANCZOS).convert("RGBA"), dtype=np.int16)
    original = np.asarray(source.convert("RGBA"), dtype=np.int16)
    opaque = original[..., 3] > 0
    return float(np.abs(original[..., :3][opaque] - reduced[..., :3][opaque]).mean())


def remaster_frame(source_path: Path, output_path: Path, output_root: Path) -> dict:
    source = Image.open(source_path).convert("RGBA")
    remaster = remaster_rgba(source)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    remaster.save(output_path, format="PNG", optimize=True)
    return {
        "sourceFile": source_path.relative_to(SOURCE_ROOT).as_posix(),
        "sourceSha256": sha256(source_path),
        "file": output_path.relative_to(output_root).as_posix(),
        "sha256": sha256(output_path),
        "sourceDimensions": list(source.size),
        "dimensions": list(remaster.size),
        "sourceAlphaBounds": list(source.getchannel("A").getbbox()),
        "alphaBounds": list(remaster.getchannel("A").getbbox()),
        "transparentRgbZero": transparent_rgb_is_zero(remaster),
        "diagnosticRedPixelCount": diagnostic_red_pixel_count(remaster),
        "rgbMaeAfterLanczosDownsample": round(rgb_mae_after_downsample(source, remaster), 4),
    }


def contact_sheet(records: list[dict], output_root: Path, path: Path) -> None:
    cell = 360
    label = 24
    columns = 3
    rows = math.ceil(len(records) / columns)
    sheet = Image.new("RGB", (columns * cell, rows * (cell + label)), (233, 234, 230))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, record in enumerate(records):
        frame = Image.open(output_root / record["frames"][0]["file"]).convert("RGB")
        preview = frame.resize((cell, cell), Image.Resampling.LANCZOS)
        x = (index % columns) * cell
        y = (index // columns) * (cell + label)
        sheet.paste(preview, (x, y))
        draw.text((x + 6, y + cell + 5), record["fieldId"], fill=(28, 34, 31), font=font)
    sheet.save(path, format="JPEG", quality=92, optimize=True)


def build(output_root: Path) -> None:
    safe_reset(output_root)
    source_manifest_path = SOURCE_ROOT / "manifest.json"
    source_manifest = json.loads(source_manifest_path.read_text(encoding="utf-8"))
    source_by_id = {field["fieldId"]: field for field in source_manifest["fields"]}
    records = []

    for field_id in FIRST_BATCH:
        source_field = source_by_id[field_id]
        source_dir = SOURCE_ROOT / "fields" / field_id
        output_dir = output_root / "fields" / field_id
        output_dir.mkdir(parents=True)
        source_frames = source_field["animation"]["frames"] if source_field["animation"]["status"] != "NOT_PRESENT" else [{
            "frameIndex": 0,
            "durationRawTicks": None,
            "compositeFile": f"fields/{field_id}/native-composite-frame-00.png",
        }]
        frames = []
        for frame in source_frames:
            frame_index = frame["frameIndex"]
            metrics = remaster_frame(
                SOURCE_ROOT / frame["compositeFile"],
                output_dir / f"composite-remaster-hd2x-frame-{frame_index:02d}.png",
                output_root,
            )
            metrics.update({"frameIndex": frame_index, "durationRawTicks": frame.get("durationRawTicks")})
            frames.append(metrics)

        placement_path = SOURCE_ROOT / source_field["objectPlacement"]["file"]
        placement = json.loads(placement_path.read_text(encoding="utf-8"))
        attribute_path = SOURCE_ROOT / source_field["attribute"]["file"]
        encounter_path = SOURCE_ROOT / source_field["encounter"]["file"]
        attribute = json.loads(attribute_path.read_text(encoding="utf-8"))
        encounter = json.loads(encounter_path.read_text(encoding="utf-8"))
        if [attribute["width"], attribute["height"]] != [128, 128] or [encounter["width"], encounter["height"]] != [128, 128]:
            raise RuntimeError(f"{field_id} no longer has the original 128x128 Hunt topology")
        records.append({
            "fieldId": field_id,
            "profile": "COMPOSITE_FAITHFUL_BICUBIC_SCALE2X_BLEND_2X_V1",
            "compositionAuthority": "EXACT_BSAR_THEN_VOID_MASKED_CORE_THEN_OPM_NCER_NCBR_COMPOSITE",
            "topologyCells": [128, 128],
            "nativeDimensions": [1024, 1024],
            "remasterDimensions": [2048, 2048],
            "frames": frames,
            "objectPlacement": {
                "sourceFile": source_field["objectPlacement"]["file"],
                "sourceSha256": sha256(placement_path),
                "count": placement["placementCount"],
                "coordinatesChanged": False,
            },
            "objectCellBank": source_field["objectCellBank"],
            "attribute": {"sourceFile": source_field["attribute"]["file"], "sourceSha256": sha256(attribute_path), "changed": False},
            "encounter": {"sourceFile": source_field["encounter"]["file"], "sourceSha256": sha256(encounter_path), "changed": False},
            "animationPreserved": source_field["animation"]["status"] != "NOT_PRESENT",
        })

    contact_path = output_root / "hunt-hm00-hm02-remaster-contact.jpg"
    contact_sheet(records, output_root, contact_path)
    camera_contract_path = REPO / "docs/research/HUNT_FIELD_INPUT_ROM_TRACE_2026-08-29.md"
    manifest = {
        "schemaVersion": 1,
        "batch": "ART_A4_HUNT_HD_REMASTER_V1_HM00_HM02",
        "fieldCount": len(records),
        "plannedFieldCount": 30,
        "completedFields": FIRST_BATCH,
        "scale": SCALE,
        "profile": "COMPOSITE_FAITHFUL_BICUBIC_SCALE2X_BLEND_2X_V1",
        "sourceManifest": {"file": source_manifest_path.relative_to(REPO).as_posix(), "sha256": sha256(source_manifest_path)},
        "compositionOrder": "BSAR_ANIMATED_TERRAIN_THEN_VOID_MASKED_CORE_THEN_OPM_NCER_NCBR_OBJECTS",
        "visualPolicy": "ORIGINAL_PALETTE_FAMILY_TOPOLOGY_TILE_SEAMS_OBJECT_COORDINATES_AND_ANIMATION_PRESERVED",
        "cameraPolicy": "FULL_2048_WORLD_IS_PRESERVED_PORTRAIT_9_16_IS_A_CLAMPED_DRAGGABLE_VIEWPORT_NOT_A_CROP",
        "cameraContract": {"file": camera_contract_path.relative_to(REPO).as_posix(), "sha256": sha256(camera_contract_path)},
        "memoryPolicy": "LOAD_OR_STREAM_ONE_ACTIVE_FIELD_NEVER_PRELOAD_ALL_THIRTY_FULL_RGBA_MAPS",
        "rightsStatus": "LICENSED",
        "licenseEvidenceStatus": "OWNER_REPORTED_LINK_PENDING",
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "contactSheet": {"file": contact_path.name, "sha256": sha256(contact_path)},
        "qa": {
            "allFieldsRemain128x128": all(record["topologyCells"] == [128, 128] for record in records),
            "allFramesAre2048Square": all(frame["dimensions"] == [2048, 2048] for record in records for frame in record["frames"]),
            "allTransparentRgbZero": all(frame["transparentRgbZero"] for record in records for frame in record["frames"]),
            "allDiagnosticRedAbsent": all(frame["diagnosticRedPixelCount"] == 0 for record in records for frame in record["frames"]),
            "objectPlacementRelayoutPerformed": False,
            "worldCroppedToPortrait": False,
            "animationFlattenedToStatic": False,
        },
        "fields": records,
    }
    write_json(output_root / "manifest.json", manifest)


def tree_hashes(root: Path) -> dict[str, str]:
    return {path.relative_to(root).as_posix(): sha256(path) for path in sorted(root.rglob("*")) if path.is_file()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-determinism", action="store_true")
    args = parser.parse_args()
    build(OUTPUT_ROOT)
    if args.verify_determinism:
        first = tree_hashes(OUTPUT_ROOT)
        with tempfile.TemporaryDirectory() as directory:
            rebuilt = Path(directory) / "hd-remaster-v1"
            build(rebuilt)
            second = tree_hashes(rebuilt)
        if first != second:
            raise SystemExit("Hunt HD remaster determinism check failed")
        print(f"Deterministic Hunt HD remaster first batch passed: {len(first)} files")


if __name__ == "__main__":
    main()
