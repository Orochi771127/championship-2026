#!/usr/bin/env python3
"""Build deterministic A1 Hunt/Cage technical review assets from approved boards."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "docs/art/proposals/a1-golden-slice"
OUTPUT_DIR = ROOT / "docs/art/technical/a1-map-tech"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def output_hashes() -> dict[str, str]:
    return {
        path.relative_to(OUTPUT_DIR).as_posix(): sha256(path)
        for path in sorted(OUTPUT_DIR.rglob("*"))
        if path.is_file()
    }


def save_crop(source: Image.Image, box: tuple[int, int, int, int], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    source.crop(box).save(destination, format="PNG", optimize=False, compress_level=9)


def extract_edge_connected_background(source: Image.Image) -> tuple[Image.Image, dict[str, int | list[int]]]:
    """Remove only warm-white pixels connected to the canvas edge.

    The approved board is flattened on an off-white presentation background.
    Flooding only edge-connected near-background pixels avoids erasing enclosed
    snow, lab highlights, paper walls, or other light details inside a module.
    """

    rgba = source.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    corner_samples = [pixels[0, 0][:3], pixels[width - 1, 0][:3], pixels[0, height - 1][:3], pixels[width - 1, height - 1][:3]]
    background = tuple(int(median(channel)) for channel in zip(*corner_samples))
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def distance(x: int, y: int) -> int:
        red, green, blue, _ = pixels[x, y]
        return max(abs(red - background[0]), abs(green - background[1]), abs(blue - background[2]))

    def enqueue(x: int, y: int) -> None:
        offset = y * width + x
        if not visited[offset] and distance(x, y) <= 30:
            visited[offset] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    transparent = partial = opaque = edge_opaque = 0
    for y in range(height):
        for x in range(width):
            red, green, blue, _ = pixels[x, y]
            if visited[y * width + x]:
                delta = distance(x, y)
                alpha = max(0, min(255, round((delta - 5) * 255 / 23)))
            else:
                alpha = 255
            pixels[x, y] = (red, green, blue, alpha)
            if alpha == 0:
                transparent += 1
            elif alpha == 255:
                opaque += 1
            else:
                partial += 1
            if (x in (0, width - 1) or y in (0, height - 1)) and alpha != 0:
                edge_opaque += 1

    alpha = rgba.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("Background extraction removed the entire module")
    padded = (
        max(0, bounds[0] - 8),
        max(0, bounds[1] - 8),
        min(width, bounds[2] + 8),
        min(height, bounds[3] + 8),
    )
    trimmed = rgba.crop(padded)
    master = Image.new("RGBA", (trimmed.width + 16, trimmed.height + 16), (0, 0, 0, 0))
    master.alpha_composite(trimmed, (8, 8))
    metrics: dict[str, int | list[int]] = {
        "backgroundRgb": list(background),
        "sourceAlphaBounds": list(bounds),
        "trimmedSourceBounds": list(padded),
        "transparentPixels": transparent,
        "partialAlphaPixels": partial,
        "opaquePixels": opaque,
        "edgeOpaquePixels": edge_opaque,
        "transparentCanvasPadding": 8,
        "outputEdgeOpaquePixels": 0,
    }
    return master, metrics


def save_visual_silhouette(source: Image.Image, destination: Path) -> None:
    alpha = source.getchannel("A")
    mask = Image.new("RGBA", source.size, (255, 255, 255, 0))
    mask.putalpha(alpha.point(lambda value: 255 if value >= 24 else 0))
    destination.parent.mkdir(parents=True, exist_ok=True)
    mask.save(destination, format="PNG", optimize=False, compress_level=9)


def checkerboard(size: tuple[int, int], step: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, (232, 236, 240, 255))
    pixels = image.load()
    for y in range(size[1]):
        for x in range(size[0]):
            shade = 208 if (x // step + y // step) % 2 else 236
            pixels[x, y] = (shade, shade, shade, 255)
    return image


def main() -> None:
    cage_source_path = SOURCE_DIR / "cage-12-module-direction.png"
    hunt_source_path = SOURCE_DIR / "hunt-hm01-hm09-direction.png"

    cage_source = Image.open(cage_source_path).convert("RGBA")
    hunt_source = Image.open(hunt_source_path).convert("RGBA")

    if cage_source.size != (1330, 1183):
        raise ValueError(f"Unexpected Cage board size: {cage_source.size}")
    if hunt_source.size != (1774, 887):
        raise ValueError(f"Unexpected Hunt board size: {hunt_source.size}")

    cage_roles = (
        "WOODLAND_CLEARING",
        "TIMBER_TRAINING_RING",
        "AGILITY_LANE",
        "TATAMI_ROOM",
        "STRENGTH_GYM",
        "RESEARCH_LAB",
        "VOLCANIC_FIELD",
        "FLOWER_MEADOW",
        "DESERT_OASIS",
        "STONE_BRIDGE",
        "POND_BANK",
        "SNOW_RUINS",
    )
    # Hand-audited gutters from the approved 3x4 presentation board. These are
    # intentionally per-module rather than equal grid cells because the art has
    # soft shadows and several silhouettes extend unevenly within their slots.
    cage_boxes = (
        (35, 20, 430, 310),
        (445, 15, 875, 310),
        (885, 15, 1325, 310),
        (25, 315, 435, 590),
        (455, 315, 875, 585),
        (880, 315, 1330, 585),
        (25, 590, 440, 850),
        (455, 590, 885, 850),
        (895, 590, 1325, 850),
        (25, 850, 450, 1183),
        (455, 850, 890, 1183),
        (890, 860, 1330, 1183),
    )

    modules = []
    for index, role in enumerate(cage_roles):
        box = cage_boxes[index]
        module_id = f"A1_CAGE_MOD_{index + 1:02d}"
        relative_file = Path("cage/modules") / f"{module_id.lower()}.png"
        destination = OUTPUT_DIR / relative_file
        save_crop(cage_source, box, destination)
        transparent_relative = Path("cage/transparent") / f"{module_id.lower()}-transparent.png"
        transparent_destination = OUTPUT_DIR / transparent_relative
        transparent, alpha_metrics = extract_edge_connected_background(Image.open(destination))
        transparent_destination.parent.mkdir(parents=True, exist_ok=True)
        transparent.save(transparent_destination, format="PNG", optimize=False, compress_level=9)
        silhouette_relative = Path("cage/masks") / f"{module_id.lower()}-visual-silhouette.png"
        silhouette_destination = OUTPUT_DIR / silhouette_relative
        save_visual_silhouette(transparent, silhouette_destination)
        modules.append(
            {
                "assetId": module_id,
                "visualRole": role,
                "file": relative_file.as_posix(),
                "sha256": sha256(destination),
                "sourceCrop": {"x": box[0], "y": box[1], "width": box[2] - box[0], "height": box[3] - box[1]},
                "transparentFile": transparent_relative.as_posix(),
                "transparentSha256": sha256(transparent_destination),
                "visualSilhouetteFile": silhouette_relative.as_posix(),
                "visualSilhouetteSha256": sha256(silhouette_destination),
                "canvasSize": list(transparent.size),
                "alphaMetrics": alpha_metrics,
                "anchor": {
                    "policy": "BOTTOM_CENTER_TECHNICAL_ANCHOR",
                    "normalized": [0.5, 1.0],
                    "pixel": [transparent.width // 2, transparent.height],
                },
                "sourceState": "TRANSPARENT_FLATTENED_APPROVED_DIRECTION_MASTER",
                "gameplayFootprint": "UNKNOWN_REQUIRES_VERIFIED_SHAPE_MASK",
                "raisingEffects": "UNKNOWN_REQUIRES_TRACE",
                "runtimeEligible": False,
            }
        )

    hunt_outputs = (
        ("A1_HUNT_HM01_BRIGHT_STANDARD", "HM01_BRIGHT_GRASSLAND", (0, 0, 887, 887), "hunt/hm01-bright-standard.png"),
        ("A1_HUNT_HM09_DARK_STANDARD", "HM09_DARK_MINE", (887, 0, 1774, 887), "hunt/hm09-dark-standard.png"),
    )
    hunt_standards = []
    for asset_id, role, box, relative_name in hunt_outputs:
        destination = OUTPUT_DIR / relative_name
        save_crop(hunt_source, box, destination)
        hunt_standards.append(
            {
                "assetId": asset_id,
                "visualRole": role,
                "file": relative_name,
                "sha256": sha256(destination),
                "sourceCrop": {"x": box[0], "y": box[1], "width": box[2] - box[0], "height": box[3] - box[1]},
                "sourceState": "FLATTENED_APPROVED_DIRECTION_STANDARD",
                "worldTopology": "128_X_128_PRESERVE_SOURCE_STRUCTURE_TARGET",
                "runtimeEligible": False,
            }
        )

    manifest = {
        "schemaVersion": 1,
        "batchId": "ART-A1-MAP-TECH-2026-08-29",
        "status": "TRANSPARENT_TECHNICAL_MASTERS_COMPLETE_NATIVE_LAYER_SEPARATION_PENDING",
        "ownerApproval": {
            "date": "2026-08-29",
            "scope": ["CAGE_12_MODULE_VISUAL_DIRECTION", "HUNT_HM01_HM09_VISUAL_DIRECTION"],
            "meaning": "APPROVED_FOR_TECHNICALIZATION_NOT_RUNTIME_PROMOTION",
        },
        "rights": {
            "reportedByOwner": "FULL_LICENSE_ACQUIRED",
            "promotionState": "BLOCKED_PENDING_LINKED_LICENSE_DOCUMENT_REFERENCE",
        },
        "runtimeEligible": False,
        "shippingReady": False,
        "sourceBoards": [
            {
                "file": "../../proposals/a1-golden-slice/cage-12-module-direction.png",
                "sha256": sha256(cage_source_path),
                "size": [1330, 1183],
            },
            {
                "file": "../../proposals/a1-golden-slice/hunt-hm01-hm09-direction.png",
                "sha256": sha256(hunt_source_path),
                "size": [1774, 887],
            },
        ],
        "cage": {
            "moduleCount": 12,
            "reviewGrid": {"columns": 3, "rows": 4},
            "modules": modules,
            "requiredNativeLayers": ["CORE_FIELD_TILES", "OBJECT_BUNDLE"],
            "requiredExternalData": ["ATR_RAW_CLASSES", "COL_RAW_CLASSES"],
            "bindingRule": "VISUAL_MODULE_ID_MUST_BIND_TO_VERIFIED_EXTERNAL_SHAPE_MASK_AND_RAISING_DATA; ART_MUST_NOT_INVENT_SEMANTICS",
            "transparentMasterState": "COMPLETE_FLATTENED_ALPHA_EXTRACTION_NOT_NATIVE_LAYERED_SOURCE",
            "maskWarning": "VISUAL_SILHOUETTES_ARE_ALPHA_QA_ONLY_AND_MUST_NOT_BE_USED_AS_GAMEPLAY_SHAPE_MASKS",
            "nextGate": "BUILD_CM01_CM10_CLEAN_ROOM_CORE_TILE_KITS_AND_SEPARATE_OBJECT_BUNDLES_THEN_RUN_SEAM_SHAPE_OCCLUSION_QA",
        },
        "hunt": {
            "standardCount": 2,
            "standards": hunt_standards,
            "requiredNativeLayers": [
                "AMBIENCE",
                "BASE_TERRAIN",
                "TERRAIN_TRANSITIONS",
                "MACRO_CLUSTERS",
                "PATHS_AND_DECALS",
                "PROPS",
                "ACTORS_AND_EFFECTS",
                "FOREGROUND_AND_WEATHER",
            ],
            "cameraTarget": "PORTRAIT_9_16_OVER_128_X_128_WORLD",
            "palettePolicy": "PRESERVE_ORIGINAL_MAJOR_PALETTE_FAMILY; HM01_BRIGHT; HM09_DARK_WITH_READABLE_WALKABLE_MIDTONES",
            "bindingRule": "COLLISION_ATR_ESC_AND_SPAWN_DATA_REMAIN_EXTERNAL_GAMEPLAY_AUTHORITY",
            "nextGate": "BUILD_LAYERED_MACRO_TILE_KITS_AND_RUN_SEAM_COLLISION_OCCLUSION_PERFORMANCE_QA",
        },
        "qa": {
            "deterministicCrop": True,
            "sourceHashLocked": True,
            "visualRegeneration": False,
            "requiredBeforeRuntime": [
                "LINKED_LICENSE_EVIDENCE",
                "NATIVE_LAYERED_MASTERS",
                "SEAM_QA",
                "COLLISION_ALIGNMENT_QA",
                "OCCLUSION_QA",
                "MOBILE_PERFORMANCE_QA",
            ],
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    preview = checkerboard((1536, 1152), 24)
    for index, module in enumerate(modules):
        transparent = Image.open(OUTPUT_DIR / module["transparentFile"]).convert("RGBA")
        column = index % 3
        row = index // 3
        cell_left = column * 512
        cell_top = row * 288
        scale = min(440 / transparent.width, 244 / transparent.height, 1.0)
        if scale < 1:
            transparent = transparent.resize((round(transparent.width * scale), round(transparent.height * scale)), Image.Resampling.LANCZOS)
        x = cell_left + (512 - transparent.width) // 2
        y = cell_top + 264 - transparent.height
        preview.alpha_composite(transparent, (x, y))
    preview_path = OUTPUT_DIR / "cage/transparent-qa-checker.png"
    preview.save(preview_path, format="PNG", optimize=False, compress_level=9)
    manifest["cage"]["alphaQaPreview"] = {
        "file": "cage/transparent-qa-checker.png",
        "sha256": sha256(preview_path),
        "background": "CHECKERBOARD_FOR_ALPHA_INSPECTION_NOT_ASSET_CONTENT",
    }
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--verify-determinism",
        action="store_true",
        help="build twice and fail if any output hash changes",
    )
    args = parser.parse_args()
    main()
    if args.verify_determinism:
        first = output_hashes()
        main()
        second = output_hashes()
        if first != second:
            raise RuntimeError("A1 map technical output is not deterministic")
        print(f"Deterministic A1 map technical build passed: {len(second)} files")
