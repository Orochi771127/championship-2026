#!/usr/bin/env python3
"""Build deterministic technical-QA evidence for the faithful Cage/Hunt baselines.

The generated overlays are review-only. They preserve raw class numbers and do
not reinterpret collision, attribute, encounter, or animation timing semantics.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


REPO = Path(__file__).resolve().parents[1]
CAGE_ROOT = REPO / "docs/art/production/cage/faithful-hd40"
HUNT_ROOT = REPO / "docs/art/production/hunt/faithful-hd30"
OUTPUT_ROOT = REPO / "docs/art/production/technical-qa/cage-hunt-exact-baseline"
TILE_NATIVE_PIXELS = 8
CAGE_SCALE = 4
HUNT_REVIEW_CROP = (390, 844)
DIAGNOSTIC_RED = (255, 0, 0)
LARGE_DIAGNOSTIC_COMPONENT_PIXELS = 1024


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_replace_dir(target: Path) -> None:
    expected_parent = (REPO / "docs/art/production/technical-qa").resolve()
    resolved = target.resolve()
    temp_root = Path(tempfile.gettempdir()).resolve()
    allowed = (
        resolved.name == "cage-hunt-exact-baseline"
        and (resolved.parent == expected_parent or temp_root in resolved.parents)
    )
    if not allowed:
        raise RuntimeError(f"Refusing to replace unexpected output directory: {resolved}")
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)


def tree_hashes(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): sha256(path)
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def diagnostic_color(raw_class: int) -> tuple[int, int, int, int]:
    palette = (
        (64, 170, 255, 86),
        (255, 193, 7, 96),
        (244, 67, 54, 96),
        (76, 175, 80, 96),
        (156, 39, 176, 96),
        (0, 188, 212, 96),
        (255, 112, 67, 96),
        (124, 179, 66, 96),
    )
    return palette[raw_class % len(palette)]


def flattened_pixels(image: Image.Image):
    getter = getattr(image, "get_flattened_data", None)
    return getter() if getter is not None else image.getdata()


def collision_overlay(image: Image.Image, classes: dict) -> Image.Image:
    width = int(classes["width"])
    height = int(classes["height"])
    cells = classes["cells"]
    if len(cells) != width * height:
        raise ValueError("Collision cell count does not match declared dimensions")
    if image.size != (width * TILE_NATIVE_PIXELS * CAGE_SCALE, height * TILE_NATIVE_PIXELS * CAGE_SCALE):
        raise ValueError("Collision grid does not align to HD image dimensions")

    cell_pixels = TILE_NATIVE_PIXELS * CAGE_SCALE
    tint = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(tint)
    for index, raw_class in enumerate(cells):
        x = (index % width) * cell_pixels
        y = (index // width) * cell_pixels
        draw.rectangle(
            (x, y, x + cell_pixels - 1, y + cell_pixels - 1),
            fill=diagnostic_color(int(raw_class)),
            outline=(255, 255, 255, 72),
            width=1,
        )
    return Image.alpha_composite(image.convert("RGBA"), tint)


def save_contact_page(items: list[tuple[str, Image.Image]], path: Path, columns: int, thumb: tuple[int, int]) -> None:
    font = ImageFont.load_default()
    label_height = 24
    gap = 12
    rows = (len(items) + columns - 1) // columns
    slot_width = thumb[0] + gap
    slot_height = thumb[1] + label_height + gap
    page = Image.new("RGB", (columns * slot_width + gap, rows * slot_height + gap), (242, 239, 231))
    draw = ImageDraw.Draw(page)
    for index, (label, source) in enumerate(items):
        col = index % columns
        row = index // columns
        x = gap + col * slot_width
        y = gap + row * slot_height
        preview = source.convert("RGBA")
        preview.thumbnail(thumb, Image.Resampling.NEAREST)
        checker = Image.new("RGBA", preview.size, (222, 222, 222, 255))
        checker.alpha_composite(preview)
        page.paste(checker.convert("RGB"), (x + (thumb[0] - preview.width) // 2, y))
        draw.text((x, y + thumb[1] + 4), label, fill=(24, 30, 38), font=font)
    path.parent.mkdir(parents=True, exist_ok=True)
    page.save(path, format="PNG", optimize=False)


def largest_component(mask: list[bool], width: int, height: int) -> int:
    seen = bytearray(len(mask))
    largest = 0
    for start, active in enumerate(mask):
        if not active or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        size = 0
        while queue:
            index = queue.popleft()
            size += 1
            x = index % width
            y = index // width
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < width and 0 <= ny < height:
                    neighbour = ny * width + nx
                    if mask[neighbour] and not seen[neighbour]:
                        seen[neighbour] = 1
                        queue.append(neighbour)
        largest = max(largest, size)
    return largest


def red_component_metrics(image: Image.Image) -> tuple[int, int]:
    rgba = image.convert("RGBA")
    mask = [pixel[3] > 0 and pixel[:3] == DIAGNOSTIC_RED for pixel in flattened_pixels(rgba)]
    return sum(mask), largest_component(mask, rgba.width, rgba.height)


def center_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    if image.width < width or image.height < height:
        raise ValueError("Review crop is larger than source image")
    left = (image.width - width) // 2
    top = (image.height - height) // 2
    return image.crop((left, top, left + width, top + height))


def build(output_root: Path) -> None:
    safe_replace_dir(output_root)
    cage_manifest = json.loads((CAGE_ROOT / "manifest.json").read_text(encoding="utf-8"))
    hunt_manifest = json.loads((HUNT_ROOT / "manifest.json").read_text(encoding="utf-8"))

    cage_records = []
    cage_contacts: list[tuple[str, Image.Image]] = []
    cage_art_contacts: list[tuple[str, Image.Image]] = []
    collision_classes: set[int] = set()
    attribute_classes: set[int] = set()
    for field in cage_manifest["fields"]:
        field_id = field["fieldId"]
        native = Image.open(CAGE_ROOT / field["nativeOriginal"]["file"]).convert("RGBA")
        hd = Image.open(CAGE_ROOT / field["faithfulHd4x"]["file"]).convert("RGBA")
        expected_hd = native.resize(hd.size, Image.Resampling.NEAREST)
        exact_replication = expected_hd.tobytes() == hd.tobytes()

        collision = json.loads((CAGE_ROOT / field["collision"]["file"]).read_text(encoding="utf-8"))
        attribute = json.loads((CAGE_ROOT / field["attribute"]["file"]).read_text(encoding="utf-8"))
        tilemap = json.loads((CAGE_ROOT / field["coreTilemap"]["file"]).read_text(encoding="utf-8"))
        collision_classes.update(map(int, collision["cells"]))
        attribute_classes.update(map(int, attribute["cells"]))
        aligned = (
            collision["width"] == attribute["width"] == tilemap["width"]
            and collision["height"] == attribute["height"] == tilemap["height"]
            and hd.size == (
                collision["width"] * TILE_NATIVE_PIXELS * CAGE_SCALE,
                collision["height"] * TILE_NATIVE_PIXELS * CAGE_SCALE,
            )
        )
        if not aligned or not exact_replication:
            raise RuntimeError(f"Cage technical QA failed for {field_id}")

        overlay = collision_overlay(hd, collision)
        overlay_path = output_root / "cage-collision-overlays" / f"{field_id}.png"
        overlay_path.parent.mkdir(parents=True, exist_ok=True)
        overlay.save(overlay_path, format="PNG", optimize=False)
        alpha_values = list(flattened_pixels(hd.getchannel("A")))
        cage_records.append({
            "fieldId": field_id,
            "exact4xBlockReplication": exact_replication,
            "collisionAttributeTilemapAligned": aligned,
            "gridDimensions": [collision["width"], collision["height"]],
            "hdDimensions": list(hd.size),
            "transparentPixelCount": sum(value == 0 for value in alpha_values),
            "partialAlphaPixelCount": sum(0 < value < 255 for value in alpha_values),
            "objectBindingStatus": field["objectCellBank"]["status"],
            "collisionOverlay": {
                "file": overlay_path.relative_to(output_root).as_posix(),
                "sha256": sha256(overlay_path),
                "classification": "QA_ONLY_RAW_CLASS_OVERLAY_NOT_GAMEPLAY_ART",
            },
        })
        cage_contacts.append((field_id, overlay))
        cage_art_contacts.append((field_id, hd))

    cage_contact_records = []
    for page_index in range(4):
        page_path = output_root / f"cage-collision-contact-{page_index + 1:02d}.png"
        save_contact_page(cage_contacts[page_index * 10:(page_index + 1) * 10], page_path, 5, (190, 210))
        cage_contact_records.append({"file": page_path.name, "sha256": sha256(page_path)})

    cage_master_contact = output_root / "cage-art-master-contact-cm01-cm40.png"
    save_contact_page(cage_art_contacts, cage_master_contact, 8, (160, 175))
    cage_master_contact_record = {"file": cage_master_contact.name, "sha256": sha256(cage_master_contact)}

    hunt_records = []
    hunt_contacts: list[tuple[str, Image.Image]] = []
    hunt_hd_disk_bytes = 0
    hunt_hd_decoded_bytes = 0
    max_single_field_animation_decoded_bytes = 0
    for field in hunt_manifest["fields"]:
        field_id = field["fieldId"]
        hd_path = HUNT_ROOT / field["faithfulHd2x"]["file"]
        hd = Image.open(hd_path).convert("RGBA")
        pure_red_pixels, largest_red_component = red_component_metrics(hd)
        large_red_absent = largest_red_component < LARGE_DIAGNOSTIC_COMPONENT_PIXELS
        if not large_red_absent:
            raise RuntimeError(f"Large diagnostic-red region remains in {field_id}")

        animation_frames = field["animation"].get("frames", [])
        animation_decoded_bytes = 0
        for frame in animation_frames:
            layer = Image.open(HUNT_ROOT / frame["layerFile"])
            composite = Image.open(HUNT_ROOT / frame["compositeFile"])
            if layer.size != (1024, 1024) or composite.size != (1024, 1024):
                raise RuntimeError(f"Unexpected Hunt animation dimensions for {field_id}")
            animation_decoded_bytes += layer.width * layer.height * 4
        max_single_field_animation_decoded_bytes = max(max_single_field_animation_decoded_bytes, animation_decoded_bytes)
        hunt_hd_disk_bytes += hd_path.stat().st_size
        hunt_hd_decoded_bytes += hd.width * hd.height * 4
        crop = center_crop(hd, HUNT_REVIEW_CROP)
        hunt_contacts.append((field_id, crop))
        hunt_records.append({
            "fieldId": field_id,
            "hdDimensions": list(hd.size),
            "pureDiagnosticRedPixelCount": pure_red_pixels,
            "largestPureDiagnosticRedComponentPixels": largest_red_component,
            "largeDiagnosticRedRegionAbsent": large_red_absent,
            "animationFrameCount": len(animation_frames),
            "animationLayerDecodedRgbaBytes": animation_decoded_bytes,
            "reviewCrop": {
                "dimensions": list(HUNT_REVIEW_CROP),
                "policy": "FIXED_CENTER_CROP_NO_SCALE_REVIEW_ONLY_NOT_RUNTIME_CAMERA",
            },
        })

    hunt_contact_records = []
    for page_index in range(3):
        page_path = output_root / f"hunt-portrait-review-contact-{page_index + 1:02d}.png"
        save_contact_page(hunt_contacts[page_index * 10:(page_index + 1) * 10], page_path, 5, (195, 422))
        hunt_contact_records.append({"file": page_path.name, "sha256": sha256(page_path)})

    qa_manifest = {
        "schemaVersion": 1,
        "batch": "ART-A3-A4-EXACT-BASELINE-TECHNICAL-QA",
        "status": "REFERENCE_TECHNICAL_QA_PASSED_WITH_KNOWN_PROMOTION_BLOCKERS",
        "sourceManifests": {
            "cage": {"file": str((CAGE_ROOT / "manifest.json").relative_to(REPO)).replace("\\", "/"), "sha256": sha256(CAGE_ROOT / "manifest.json")},
            "hunt": {"file": str((HUNT_ROOT / "manifest.json").relative_to(REPO)).replace("\\", "/"), "sha256": sha256(HUNT_ROOT / "manifest.json")},
        },
        "cage": {
            "fieldCount": len(cage_records),
            "exact4xBlockReplicationCount": sum(record["exact4xBlockReplication"] for record in cage_records),
            "collisionAttributeTilemapAlignedCount": sum(record["collisionAttributeTilemapAligned"] for record in cage_records),
            "rawCollisionClassesObserved": sorted(collision_classes),
            "rawAttributeClassesObserved": sorted(attribute_classes),
            "objectConflictFields": cage_manifest["partialObjectConflictFields"],
            "master40ArtContact": cage_master_contact_record,
            "contactPages": cage_contact_records,
            "fields": cage_records,
        },
        "hunt": {
            "fieldCount": len(hunt_records),
            "largeDiagnosticRedRegionAbsentCount": sum(record["largeDiagnosticRedRegionAbsent"] for record in hunt_records),
            "animatedVariantCount": sum(record["animationFrameCount"] > 0 for record in hunt_records),
            "animationFrameCount": sum(record["animationFrameCount"] for record in hunt_records),
            "portraitReviewCropPolicy": "390X844_FIXED_CENTER_CROP_NO_SCALE_REVIEW_ONLY",
            "portraitReviewContactPages": hunt_contact_records,
            "performance": {
                "singleHdFieldDecodedRgbaBytes": 2048 * 2048 * 4,
                "all30HdFieldsDecodedRgbaBytes": hunt_hd_decoded_bytes,
                "all30HdPngDiskBytes": hunt_hd_disk_bytes,
                "maxSingleFieldAnimationLayerDecodedRgbaBytes": max_single_field_animation_decoded_bytes,
                "budgetVerdict": "DO_NOT_PRELOAD_30_FULL_RGBA_MAPS_USE_ONE_FIELD_OR_TILED_STREAMING",
                "runtimeMeasurementStatus": "NOT_MEASURED_REFERENCE_PACKET_NOT_RUNTIME_BOUND",
            },
            "fields": hunt_records,
        },
        "boundaries": {
            "visualTransformationPerformed": False,
            "rawClassSemanticsInvented": False,
            "runtimeEligible": False,
            "shippingReady": False,
            "knownBlockers": [
                "CM12_CM18_ORIGINAL_OBJECT_INDEX_CONFLICT",
                "LICENSE_DOCUMENT_LINK_PENDING",
                "GENUINE_HAND_REDRAWN_HD_MASTER_NOT_YET_PRODUCED",
                "RUNTIME_CAMERA_CULLING_AND_DEVICE_PERFORMANCE_NOT_YET_MEASURED",
            ],
        },
    }
    write_json(output_root / "manifest.json", qa_manifest)

    report = f"""# Cage/Hunt exact-baseline technical QA\n\nDate: 2026-08-29\n\nStatus: `REFERENCE TECHNICAL QA PASSED / RUNTIME PROMOTION BLOCKED`\n\n## Result\n\n- Cage: {len(cage_records)}/40 fields preserve exact 4× pixel blocks; {sum(r['collisionAttributeTilemapAligned'] for r in cage_records)}/40 collision, attribute and tilemap grids align to the same 8-pixel native cells.\n- One un-tinted CM01–CM40 master contact sheet proves all forty art fields in a single view; four separate pages retain the collision overlays for enlarged review.\n- Hunt: {len(hunt_records)}/30 variants contain no large connected pure-red diagnostic region; {sum(r['animationFrameCount'] > 0 for r in hunt_records)} animated variants retain {sum(r['animationFrameCount'] for r in hunt_records)} source frames.\n- Portrait review uses a fixed 390×844 centre crop with no scaling. It is a presentation check, not a runtime camera contract.\n- Loading all thirty 2048×2048 RGBA fields at once would consume {hunt_hd_decoded_bytes / 1048576:.0f} MiB before texture overhead. The reference packet therefore requires one-field loading or tile streaming; mass preloading is rejected.\n\n## Boundaries\n\nThe collision colours are diagnostic overlays only. Raw class numbers are preserved and no passability or gameplay meaning is inferred. CM12 and CM18 remain quarantined object-index conflicts. These outputs remain exact enlarged reference baselines, not genuinely redrawn HD masters, runtime assets, or shipping-ready art.\n"""
    (output_root / "TECHNICAL_QA_RECEIPT.md").write_text(report, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-determinism", action="store_true")
    args = parser.parse_args()
    build(OUTPUT_ROOT)
    if args.verify_determinism:
        first = tree_hashes(OUTPUT_ROOT)
        with tempfile.TemporaryDirectory() as directory:
            rebuilt = Path(directory) / "cage-hunt-exact-baseline"
            build(rebuilt)
            second = tree_hashes(rebuilt)
        if first != second:
            raise SystemExit("Technical QA output is not deterministic")
        print(f"Deterministic Cage/Hunt technical QA passed: {len(first)} files")


if __name__ == "__main__":
    main()
