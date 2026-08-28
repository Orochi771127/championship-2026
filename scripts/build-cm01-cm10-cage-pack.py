#!/usr/bin/env python3
"""Build the non-runtime CM01-CM10 clean-room Cage art review pack."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import tempfile
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


REPO = Path(__file__).resolve().parents[1]
PACK_ROOT = REPO / "docs/art/production/cage/cm01-cm10"
SOURCE_ROOT = PACK_ROOT / "source-boards"
OUTPUT_ROOT = PACK_ROOT / "packages"
CROSSWALK = REPO / "docs/art/technical/a1-cage-original-structure/CM40_ORIGINAL_STRUCTURE_CROSSWALK.csv"
CORE_BOARD = SOURCE_ROOT / "cm01-cm10-core-field-board.png"
OBJECT_BOARD = SOURCE_ROOT / "cm01-cm10-object-bundle-board.png"
FIELD_IDS = [f"field_cm{i:02d}_01" for i in range(1, 11)]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def grid_crop(image: Image.Image, index: int) -> Image.Image:
    column, row = index % 5, index // 5
    left = round(column * image.width / 5)
    right = round((column + 1) * image.width / 5)
    top = round(row * image.height / 2)
    bottom = round((row + 1) * image.height / 2)
    return image.crop((left, top, right, bottom))


def remove_connected_neutral_background(image: Image.Image, minimum: int) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    def background_candidate(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return min(red, green, blue) >= minimum and max(red, green, blue) - min(red, green, blue) <= 20

    for x in range(width):
        for y in (0, height - 1):
            if background_candidate(x, y):
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if background_candidate(x, y):
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not background_candidate(x, y):
            continue
        visited.add((x, y))
        pixels[x, y] = (255, 255, 255, 0)
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))
    return rgba


def retain_largest_alpha_component(image: Image.Image) -> Image.Image:
    """Drop neighbouring-cell slivers while retaining the field and its connected shadow."""
    alpha = image.getchannel("A")
    source = alpha.load()
    width, height = image.size
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for start_y in range(height):
        for start_x in range(width):
            if source[start_x, start_y] == 0 or (start_x, start_y) in visited:
                continue
            component: list[tuple[int, int]] = []
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            while queue:
                x, y = queue.popleft()
                if (x, y) in visited or source[x, y] == 0:
                    continue
                visited.add((x, y))
                component.append((x, y))
                if x > 0:
                    queue.append((x - 1, y))
                if x + 1 < width:
                    queue.append((x + 1, y))
                if y > 0:
                    queue.append((x, y - 1))
                if y + 1 < height:
                    queue.append((x, y + 1))
            components.append(component)
    keep = set(max(components, key=len))
    cleaned = image.copy()
    cleaned_pixels = cleaned.load()
    for y in range(height):
        for x in range(width):
            if (x, y) not in keep:
                red, green, blue, _ = cleaned_pixels[x, y]
                cleaned_pixels[x, y] = (red, green, blue, 0)
    return cleaned


def split_object_board(image: Image.Image) -> list[Image.Image]:
    """Assign complete disconnected objects to the nearest 5x2 cell by centroid."""
    cleaned = remove_connected_neutral_background(image, 238)
    alpha = cleaned.getchannel("A")
    source = alpha.load()
    width, height = cleaned.size
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for start_y in range(height):
        for start_x in range(width):
            if source[start_x, start_y] == 0 or (start_x, start_y) in visited:
                continue
            component: list[tuple[int, int]] = []
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            while queue:
                x, y = queue.popleft()
                if (x, y) in visited or source[x, y] == 0:
                    continue
                visited.add((x, y))
                component.append((x, y))
                if x > 0:
                    queue.append((x - 1, y))
                if x + 1 < width:
                    queue.append((x + 1, y))
                if y > 0:
                    queue.append((x, y - 1))
                if y + 1 < height:
                    queue.append((x, y + 1))
            if len(component) >= 12:
                components.append(component)

    outputs = [Image.new("RGBA", cleaned.size, (0, 0, 0, 0)) for _ in range(10)]
    source_pixels = cleaned.load()
    output_pixels = [output.load() for output in outputs]
    for component in components:
        center_x = sum(x for x, _ in component) / len(component)
        center_y = sum(y for _, y in component) / len(component)
        column = min(4, max(0, int(center_x * 5 / width)))
        row = min(1, max(0, int(center_y * 2 / height)))
        target = output_pixels[row * 5 + column]
        for x, y in component:
            target[x, y] = source_pixels[x, y]
    return outputs


def normalize(image: Image.Image, canvas_size: tuple[int, int] = (384, 320)) -> tuple[Image.Image, dict]:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError("Generated cell contains no visible pixels")
    cropped = image.crop(bounds)
    max_width, max_height = canvas_size[0] - 24, canvas_size[1] - 20
    scale = min(1.0, max_width / cropped.width, max_height / cropped.height)
    if scale < 1:
        cropped = cropped.resize((round(cropped.width * scale), round(cropped.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    x = (canvas.width - cropped.width) // 2
    y = canvas.height - cropped.height - 10
    canvas.alpha_composite(cropped, (x, y))
    return canvas, {
        "anchor": {"x": canvas.width // 2, "y": canvas.height - 10, "policy": "BOTTOM_CENTER"},
        "visibleBounds": list(canvas.getchannel("A").getbbox()),
        "sourceCellBounds": list(bounds),
        "normalizationScale": round(scale, 6),
    }


def checker(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", size, (246, 246, 242, 255))
    draw = ImageDraw.Draw(image)
    step = 16
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(226, 228, 224, 255))
    return image


def contact_sheet(images: list[Image.Image], output: Path) -> None:
    cell_width, cell_height = images[0].size
    sheet = checker((cell_width * 5, cell_height * 2))
    for index, image in enumerate(images):
        sheet.alpha_composite(image, ((index % 5) * cell_width, (index // 5) * cell_height))
    sheet.convert("RGB").save(output, optimize=True)


def load_crosswalk() -> dict[str, dict[str, str]]:
    with CROSSWALK.open("r", encoding="utf-8-sig", newline="") as handle:
        return {row["field_id"]: row for row in csv.DictReader(handle)}


def build(output_root: Path) -> None:
    if output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True)
    crosswalk = load_crosswalk()
    core_board = Image.open(CORE_BOARD)
    object_board = Image.open(OBJECT_BOARD)
    object_cells = split_object_board(object_board)
    core_outputs: list[Image.Image] = []
    object_outputs: list[Image.Image] = []
    records = []

    for index, field_id in enumerate(FIELD_IDS):
        field_dir = output_root / field_id
        field_dir.mkdir()
        core_raw = retain_largest_alpha_component(remove_connected_neutral_background(grid_crop(core_board, index), 234))
        object_raw = object_cells[index]
        core, core_metrics = normalize(core_raw)
        objects, object_metrics = normalize(object_raw)
        core_path = field_dir / "core-field.png"
        object_path = field_dir / "object-bundle.png"
        core.save(core_path, optimize=True)
        objects.save(object_path, optimize=True)
        core_outputs.append(core)
        object_outputs.append(objects)
        row = crosswalk[field_id]
        records.append({
            "assetId": f"art:cage:{field_id}:clean-room-review-pack",
            "ordinal": int(row["ordinal"]),
            "fieldId": field_id,
            "nameEn": row["name_en"],
            "nameJp": row["name_jp"],
            "originalStructure": {
                "dimensions": row["dimensions"],
                "layoutCells": int(row["layout_cells"]),
                "topologyClass": row["topology_class"],
                "atr": "EXTERNAL_RAW_CLASSES_NOT_INFERRED",
                "col": "EXTERNAL_RAW_CLASSES_NOT_INFERRED",
            },
            "coreField": {"file": f"{field_id}/core-field.png", "sha256": sha256(core_path), **core_metrics},
            "objectBundle": {"file": f"{field_id}/object-bundle.png", "sha256": sha256(object_path), "originalPlacementCountReference": int(row["object_placement_count"]), **object_metrics},
            "rightsStatus": "ORIGINAL_CREATED_CLEAN_ROOM_CANDIDATE",
            "productionStatus": "OWNER_VISUAL_REVIEW_PENDING",
            "runtimeEligible": False,
            "shippingReady": False,
        })

    contact_sheet(core_outputs, output_root / "contact-core-fields.png")
    contact_sheet(object_outputs, output_root / "contact-object-bundles.png")
    manifest = {
        "schemaVersion": 1,
        "batch": "ART_A3_CAGE_CM01_CM10_CLEAN_ROOM_REVIEW_PACK",
        "fieldCount": 10,
        "construction": ["CORE_FIELD_TILES", "OBJECT_BUNDLE", "EXTERNAL_ATR", "EXTERNAL_COL"],
        "sourceBoards": [
            {"file": "../source-boards/cm01-cm10-core-field-board.png", "sha256": sha256(CORE_BOARD), "generationRole": "CORE_FIELD_CLEAN_ROOM_BOARD"},
            {"file": "../source-boards/cm01-cm10-object-bundle-board.png", "sha256": sha256(OBJECT_BOARD), "generationRole": "OBJECT_BUNDLE_CLEAN_ROOM_BOARD_BACKGROUND_CLEANED_DURING_BUILD"},
        ],
        "referencePolicy": "APPROVED_REMAKE_STYLE_BOARD_ONLY_NO_ROM_IMAGE_INPUT_NO_ORIGINAL_PIXELS",
        "palettePolicy": "PRESERVE_ORIGINAL_MAJOR_PALETTE_FAMILY_CHANGE_SHAPES_CONTENT_AND_FINISH",
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "fields": records,
        "qa": {
            "uniqueFieldIds": len({record["fieldId"] for record in records}),
            "separateCoreAndObjectFiles": True,
            "transparentOutputCanvas": True,
            "stableBottomCenterAnchors": True,
            "gameplaySemanticsInferred": False,
        },
    }
    (output_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def tree_hashes(root: Path) -> dict[str, str]:
    return {str(path.relative_to(root)).replace("\\", "/"): sha256(path) for path in sorted(root.rglob("*")) if path.is_file()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-determinism", action="store_true", help="Rebuild in a temporary directory and compare every output hash")
    args = parser.parse_args()
    build(OUTPUT_ROOT)
    if args.verify_determinism:
        with tempfile.TemporaryDirectory() as temp:
            second = Path(temp) / "packages"
            build(second)
            if tree_hashes(OUTPUT_ROOT) != tree_hashes(second):
                raise SystemExit("CM01-CM10 Cage pack determinism check failed")
        print(f"Deterministic CM01-CM10 Cage pack passed: {len(tree_hashes(OUTPUT_ROOT))} files")


if __name__ == "__main__":
    main()
