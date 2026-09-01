#!/usr/bin/env python3
"""Build and validate a motion-locked character remix seed workspace.

This tool never invents animation data.  It reconstructs one faithful-HD atlas
cell on its recorded logical canvas, emits non-shipping QA guides, and can
normalize one transparent redraw candidate onto the same ground anchor.
"""

from __future__ import annotations

import argparse
from collections import deque
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageOps


ENTITY_ID = "m201_agumon"
FRAME_KEY = f"{ENTITY_ID}/main/cell_000"
SOURCE_DIRECTORY = Path(
    "docs/art/production/characters/faithful-hd224/batch-02/m201_agumon"
)
OUTPUT_DIRECTORY = Path(
    "docs/art/production/characters/cat-dog-remix-v1/m201-seed"
)
REVIEW_RUNTIME_DIRECTORY = Path(
    "assets/production/internal-character-review/m201-remix-v1"
)
GROUND_Y = 320
EXPECTED_SOURCE_SIZE = (384, 352)
ATLAS_MAX_SIZE = 2048
ATLAS_PADDING = 8
HIGH_RISK_CELLS = (0, 4, 6, 9, 11, 15, 23, 49, 53, 56, 62, 63)
MOTION_CLOSURE_01_CELLS = (1, 5, 12, 50, 54)
PROJECT_ROOT = Path.cwd().resolve()
SOURCE_FACING = "LEFT"
SOURCE_FACING_BY_KEY_CELL = {
    0: "LEFT",
    4: "LEFT",
    6: "LEFT",
    9: "RIGHT_RECOIL",
    11: "LEFT",
    15: "LEFT",
    23: "LEFT_HORIZONTAL",
    49: "LEFT",
    53: "LEFT",
    56: "LEFT_LOW",
    62: "RIGHT_COLLAPSED",
    63: "LEFT",
}


def serialize(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def project_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return f"external-reference/{resolved.name}"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def next_multiple(value: int, multiple: int = 4) -> int:
    return max(multiple, math.ceil(value / multiple) * multiple)


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def extract_connected_neutral_background(image: Image.Image) -> tuple[Image.Image, int]:
    """Remove a bright neutral checkerboard only when it connects to an edge."""

    output = image.convert("RGBA")
    pixels = output.load()
    width, height = output.size
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        red, green, blue, _alpha = pixels[x, y]
        return min(red, green, blue) >= 220 and max(red, green, blue) - min(red, green, blue) <= 22

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index] or not is_background(x, y):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    removed = 0
    while queue:
        x, y = queue.popleft()
        red, green, blue, _alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        removed += 1
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    return output, removed


def load_source_cell(
    source_directory: Path,
    cell_id: int,
    *,
    require_ground: bool = False,
) -> tuple[Image.Image, dict[str, Any]]:
    frame_key = f"{ENTITY_ID}/main/cell_{cell_id:03d}"
    atlas_path = None
    atlas_data = None
    frame_record = None
    for candidate in sorted(source_directory.glob("main-atlas-*.json")):
        candidate_data = json.loads(candidate.read_text(encoding="utf-8"))
        if frame_key in candidate_data["frames"]:
            atlas_path = candidate.with_suffix(".png")
            atlas_data = candidate_data
            frame_record = candidate_data["frames"][frame_key]
            break
    require(frame_record is not None and atlas_data is not None and atlas_path is not None,
            f"Missing source cell: {frame_key}")
    source_size = (
        int(frame_record["sourceSize"]["w"]),
        int(frame_record["sourceSize"]["h"]),
    )
    require(source_size == EXPECTED_SOURCE_SIZE, f"Unexpected source size: {source_size}")
    require(frame_record["anchor"] == {"x": 0.5, "y": GROUND_Y / source_size[1]}, "Anchor drift")

    atlas = Image.open(atlas_path).convert("RGBA")
    frame = frame_record["frame"]
    crop = atlas.crop(
        (
            int(frame["x"]),
            int(frame["y"]),
            int(frame["x"] + frame["w"]),
            int(frame["y"] + frame["h"]),
        )
    )
    logical = Image.new("RGBA", source_size, (0, 0, 0, 0))
    placement = frame_record["spriteSourceSize"]
    logical.alpha_composite(crop, (int(placement["x"]), int(placement["y"])))
    require(alpha_bounds(logical) is not None, "Source cell is blank")
    if require_ground:
        require(alpha_bounds(logical)[3] == GROUND_Y, "Source cell does not meet the recorded ground line")
    return logical, frame_record


def load_source_frame(source_directory: Path) -> tuple[Image.Image, dict[str, Any]]:
    return load_source_cell(source_directory, 0, require_ground=True)


def load_source_side_cells(
    source_directory: Path,
    side_name: str,
) -> dict[int, tuple[Image.Image, dict[str, Any]]]:
    require(side_name in {"main", "sub"}, f"Unsupported side: {side_name}")
    records: dict[int, tuple[Image.Image, dict[str, Any]]] = {}
    prefix = f"{ENTITY_ID}/{side_name}/cell_"
    for atlas_json_path in sorted(source_directory.glob(f"{side_name}-atlas-*.json")):
        atlas_data = json.loads(atlas_json_path.read_text(encoding="utf-8"))
        atlas = Image.open(atlas_json_path.with_suffix(".png")).convert("RGBA")
        for frame_key, frame_record in atlas_data["frames"].items():
            require(frame_key.startswith(prefix), f"Unexpected frame key: {frame_key}")
            cell_id = int(frame_key.removeprefix(prefix))
            source_size = (
                int(frame_record["sourceSize"]["w"]),
                int(frame_record["sourceSize"]["h"]),
            )
            require(source_size == EXPECTED_SOURCE_SIZE, f"Unexpected source size: {source_size}")
            frame = frame_record["frame"]
            crop = atlas.crop((
                int(frame["x"]),
                int(frame["y"]),
                int(frame["x"] + frame["w"]),
                int(frame["y"] + frame["h"]),
            ))
            logical = Image.new("RGBA", source_size, (0, 0, 0, 0))
            placement = frame_record["spriteSourceSize"]
            logical.alpha_composite(crop, (int(placement["x"]), int(placement["y"])))
            records[cell_id] = (logical, frame_record)
    return records


def build_all83_source_reuse(source_directory: Path, output_directory: Path) -> dict[str, Any]:
    sides = {
        "main": load_source_side_cells(source_directory, "main"),
        "sub": load_source_side_cells(source_directory, "sub"),
    }
    require(len(sides["main"]) == 65, "M201 Main cell count drift")
    require(len(sides["sub"]) == 18, "M201 Sub cell count drift")

    groups_by_hash: dict[str, dict[str, Any]] = {}
    slots = []
    for side_name in ("main", "sub"):
        for cell_id, (logical, _frame_record) in sorted(sides[side_name].items()):
            pixel_hash = hashlib.sha256(logical.tobytes()).hexdigest().upper()
            group = groups_by_hash.setdefault(pixel_hash, {
                "decodedPixelSha256": pixel_hash,
                "canonical": {"side": side_name, "cell": cell_id},
                "members": [],
            })
            member = {"side": side_name, "cell": cell_id}
            group["members"].append(member)
            slots.append({
                **member,
                "decodedPixelSha256": pixel_hash,
                "canonical": group["canonical"],
            })

    sub_reused_from_main = sum(
        1 for slot in slots
        if slot["side"] == "sub" and slot["canonical"]["side"] == "main"
    )
    geometry_groups_by_alpha: dict[str, dict[str, Any]] = {}
    for group in groups_by_hash.values():
        canonical = group["canonical"]
        canonical_logical, _frame_record = sides[canonical["side"]][canonical["cell"]]
        alpha_hash = hashlib.sha256(canonical_logical.getchannel("A").tobytes()).hexdigest().upper()
        geometry_group = geometry_groups_by_alpha.setdefault(alpha_hash, {
            "decodedAlphaSha256": alpha_hash,
            "geometryCanonical": canonical,
            "visualCanonicals": [],
        })
        geometry_group["visualCanonicals"].append(canonical)
        group["decodedAlphaSha256"] = alpha_hash
        group["geometryCanonical"] = geometry_group["geometryCanonical"]

    technical_candidate_count = 0
    canonical_guide_directory = output_directory / "all83-source-guides"
    canonical_guide_directory.mkdir(parents=True, exist_ok=True)
    for group in groups_by_hash.values():
        canonical = group["canonical"]
        canonical_logical, canonical_frame_record = sides[canonical["side"]][canonical["cell"]]
        canonical_source_path = canonical_guide_directory / (
            f"source-{canonical['side']}-cell-{canonical['cell']:03d}.png"
        )
        canonical_guide_path = canonical_guide_directory / (
            f"source-{canonical['side']}-cell-{canonical['cell']:03d}-guide.png"
        )
        canonical_logical.save(canonical_source_path, optimize=True)
        make_guide(canonical_logical, canonical_frame_record).save(canonical_guide_path, optimize=True)
        group["sourceLogical"] = project_path(canonical_source_path)
        group["sourceGuide"] = project_path(canonical_guide_path)
        candidate_path = output_directory / (
            f"m201-{canonical['side']}-cell-{canonical['cell']:03d}-remix-candidate.png"
        )
        if candidate_path.exists():
            technical_candidate_count += 1
            group["candidateState"] = "TECHNICAL_CANDIDATE_AVAILABLE_VISUAL_REVIEW_REQUIRED"
            group["candidate"] = project_path(candidate_path)
            group["candidateSha256"] = sha256_file(candidate_path)
        else:
            group["candidateState"] = "PENDING_CONTROLLED_REDRAW"
            group["candidate"] = None
            group["candidateSha256"] = None

    panel_width, panel_height = 128, 117
    label_height = 23
    columns = 8
    rows = (len(groups_by_hash) + columns - 1) // columns
    contact_sheet = Image.new(
        "RGBA",
        (panel_width * columns, (panel_height + label_height) * rows),
        (245, 243, 236, 255),
    )
    contact_draw = ImageDraw.Draw(contact_sheet)
    for index, group in enumerate(groups_by_hash.values()):
        canonical = group["canonical"]
        canonical_logical, canonical_frame_record = sides[canonical["side"]][canonical["cell"]]
        guide = make_guide(canonical_logical, canonical_frame_record)
        column = index % columns
        row = index // columns
        x = column * panel_width
        y = row * (panel_height + label_height)
        contact_sheet.alpha_composite(
            guide.resize((panel_width, panel_height), Image.Resampling.NEAREST),
            (x, y),
        )
        ready = group["candidateState"].startswith("TECHNICAL_CANDIDATE")
        border = (38, 170, 102, 255) if ready else (222, 141, 42, 255)
        contact_draw.rectangle((x, y, x + panel_width - 1, y + panel_height - 1), outline=border, width=2)
        status = "READY" if ready else "PENDING"
        contact_draw.text(
            (x + 4, y + panel_height + 5),
            f"{canonical['side'][0].upper()}{canonical['cell']:03d} {status}",
            fill=(28, 37, 43, 255),
        )
    canonical_contact_path = output_directory / "m201-47-unique-source-production-queue.png"
    contact_sheet.save(canonical_contact_path, optimize=True)
    result = {
        "schemaVersion": 1,
        "entityId": ENTITY_ID,
        "state": "ROM_DECODED_CELL_REUSE_LOCKED",
        "slotCounts": {"main": 65, "sub": 18, "total": 83},
        "uniqueDecodedVisualCount": len(groups_by_hash),
        "uniqueGeometryCount": len(geometry_groups_by_alpha),
        "mainUniqueDecodedVisualCount": len({
            slot["decodedPixelSha256"] for slot in slots if slot["side"] == "main"
        }),
        "subUniqueDecodedVisualCount": len({
            slot["decodedPixelSha256"] for slot in slots if slot["side"] == "sub"
        }),
        "subSlotsReusedFromMain": sub_reused_from_main,
        "allSubSlotsReuseMain": sub_reused_from_main == 18,
        "technicalCandidateUniqueCount": technical_candidate_count,
        "pendingUniqueCount": len(groups_by_hash) - technical_candidate_count,
        "canonicalSourceContactSheet": project_path(canonical_contact_path),
        "canonicalSourceContactSheetSha256": sha256_file(canonical_contact_path),
        "productionPolicy": "DRAW_EACH_CANONICAL_VISUAL_ONCE_REUSE_FOR_EVERY_PIXEL_IDENTICAL_SOURCE_SLOT",
        "geometryVariantPolicy": "DRAW_EACH_ALPHA_GEOMETRY_ONCE_KEEP_INTERIOR_EXPRESSION_AND_PALETTE_VARIANTS_INSIDE_THE_LOCKED_MASK",
        "slots": slots,
        "reuseGroups": list(groups_by_hash.values()),
        "geometryFamilies": list(geometry_groups_by_alpha.values()),
        "runtimeEligible": False,
        "shippingReady": False,
    }
    (output_directory / "m201-all83-source-reuse.json").write_text(
        serialize(result), encoding="utf-8"
    )
    return result


def pack_review_side(
    side_name: str,
    frames: list[dict[str, Any]],
    output_directory: Path,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Pack full-canvas review frames without changing logical placement."""

    pages: list[dict[str, Any]] = []
    frame_manifest: dict[str, dict[str, Any]] = {}
    pending = list(frames)
    page_index = 0
    while pending:
        placements: list[tuple[dict[str, Any], int, int]] = []
        remaining: list[dict[str, Any]] = []
        x = ATLAS_PADDING
        y = ATLAS_PADDING
        row_height = 0
        max_right = 0
        max_bottom = 0
        for record in pending:
            image = record["trimmedImage"]
            require(
                image.width + ATLAS_PADDING * 2 <= ATLAS_MAX_SIZE
                and image.height + ATLAS_PADDING * 2 <= ATLAS_MAX_SIZE,
                f"Review frame exceeds atlas page: {record['textureKey']}",
            )
            if x + image.width + ATLAS_PADDING > ATLAS_MAX_SIZE:
                x = ATLAS_PADDING
                y += row_height + ATLAS_PADDING
                row_height = 0
            if y + image.height + ATLAS_PADDING > ATLAS_MAX_SIZE:
                remaining.append(record)
                continue
            placements.append((record, x, y))
            max_right = max(max_right, x + image.width + ATLAS_PADDING)
            max_bottom = max(max_bottom, y + image.height + ATLAS_PADDING)
            x += image.width + ATLAS_PADDING
            row_height = max(row_height, image.height)

        require(bool(placements), f"Review atlas packing stalled: {side_name}")
        page_width = next_multiple(max_right)
        page_height = next_multiple(max_bottom)
        page_image = Image.new("RGBA", (page_width, page_height), (0, 0, 0, 0))
        atlas_frames: dict[str, Any] = {}
        for record, frame_x, frame_y in placements:
            image = record["trimmedImage"]
            page_image.alpha_composite(image, (frame_x, frame_y))
            bounds = record["alphaBounds"]
            frame_record = {
                "frame": {"x": frame_x, "y": frame_y, "w": image.width, "h": image.height},
                "rotated": False,
                "trimmed": True,
                "spriteSourceSize": {
                    "x": bounds[0],
                    "y": bounds[1],
                    "w": image.width,
                    "h": image.height,
                },
                "sourceSize": {"w": EXPECTED_SOURCE_SIZE[0], "h": EXPECTED_SOURCE_SIZE[1]},
                "anchor": {"x": 0.5, "y": GROUND_Y / EXPECTED_SOURCE_SIZE[1]},
            }
            atlas_frames[record["textureKey"]] = frame_record
            frame_manifest[record["textureKey"]] = {
                "page": page_index,
                "cell": record["cell"],
                "side": side_name,
                "artSource": record["artSource"],
                "canonicalCandidate": record["canonicalCandidate"],
                "logicalRgbaSha256": record["logicalRgbaSha256"],
                **frame_record,
            }

        image_name = f"{side_name}-review-atlas-{page_index:02d}.png"
        data_name = f"{side_name}-review-atlas-{page_index:02d}.json"
        image_path = output_directory / image_name
        data_path = output_directory / data_name
        page_image.save(image_path, optimize=True)
        data_path.write_text(serialize({
            "frames": atlas_frames,
            "meta": {
                "app": "Championship2026 M201 remix review atlas builder",
                "version": "1.0",
                "image": image_name,
                "format": "RGBA8888",
                "size": {"w": page_width, "h": page_height},
                "scale": "1",
                "reviewOnly": True,
            },
        }), encoding="utf-8")
        pages.append({
            "page": page_index,
            "image": image_name,
            "data": data_name,
            "width": page_width,
            "height": page_height,
            "frameCount": len(atlas_frames),
            "imageSha256": sha256_file(image_path),
            "dataSha256": sha256_file(data_path),
        })
        pending = remaining
        page_index += 1
    return pages, frame_manifest


def build_review_runtime(
    source_directory: Path,
    output_directory: Path,
    reuse: dict[str, Any],
) -> dict[str, Any]:
    """Build an 83-slot review runtime with faithful fallbacks for missing art."""

    output_directory.mkdir(parents=True, exist_ok=True)
    source_sides = {
        "main": load_source_side_cells(source_directory, "main"),
        "sub": load_source_side_cells(source_directory, "sub"),
    }
    group_by_slot: dict[tuple[str, int], dict[str, Any]] = {}
    for group in reuse["reuseGroups"]:
        for member in group["members"]:
            group_by_slot[(member["side"], member["cell"])] = group

    side_outputs: dict[str, Any] = {}
    candidate_slots = 0
    fallback_slots = 0
    for side_name in ("main", "sub"):
        review_frames: list[dict[str, Any]] = []
        for cell_id, (source_logical, _source_frame) in sorted(source_sides[side_name].items()):
            group = group_by_slot[(side_name, cell_id)]
            canonical = group["canonical"]
            if group["candidate"]:
                candidate_path = PROJECT_ROOT / group["candidate"]
                logical = Image.open(candidate_path).convert("RGBA")
                require(logical.size == EXPECTED_SOURCE_SIZE, f"Candidate canvas drift: {candidate_path}")
                art_source = "REMIX_TECHNICAL_CANDIDATE"
                canonical_candidate = canonical
                candidate_slots += 1
            else:
                logical = source_logical
                art_source = "FAITHFUL_HD_FALLBACK"
                canonical_candidate = None
                fallback_slots += 1
            bounds = alpha_bounds(logical)
            require(bounds is not None, f"Blank review frame: {side_name}/{cell_id}")
            review_frames.append({
                "textureKey": f"{ENTITY_ID}/{side_name}/cell_{cell_id:03d}",
                "cell": cell_id,
                "alphaBounds": bounds,
                "trimmedImage": logical.crop(bounds),
                "artSource": art_source,
                "canonicalCandidate": canonical_candidate,
                "logicalRgbaSha256": hashlib.sha256(logical.tobytes()).hexdigest().upper(),
            })
        pages, frame_manifest = pack_review_side(side_name, review_frames, output_directory)
        side_outputs[side_name] = {"atlasPages": pages, "frameManifest": frame_manifest}

    source_runtime = json.loads((source_directory / "runtime.json").read_text(encoding="utf-8"))
    review_runtime = json.loads(json.dumps(source_runtime))
    review_runtime["artProfile"] = {
        **source_runtime["artProfile"],
        "style": "M201_DOG_REMIX_TECHNICAL_CANDIDATES_WITH_FAITHFUL_HD_FALLBACKS",
        "palettePolicy": "SOURCE_MAJOR_YELLOW_CREAM_FAMILY",
        "reviewOnly": True,
        "runtimeEligible": False,
    }
    for side_name in ("main", "sub"):
        review_runtime["sides"][side_name]["atlases"] = [
            {"image": page["image"], "data": page["data"]}
            for page in side_outputs[side_name]["atlasPages"]
        ]
    runtime_path = output_directory / "runtime.review.json"
    runtime_path.write_text(serialize(review_runtime), encoding="utf-8")

    all_texture_keys = {
        texture_key
        for side in side_outputs.values()
        for texture_key in side["frameManifest"]
    }
    referenced_texture_keys = {
        frame["texture"]
        for side_name in ("main", "sub")
        for animation in review_runtime["sides"][side_name]["animations"]
        for frame in animation["frames"]
    }
    require(all_texture_keys == referenced_texture_keys, "Review atlas/runtime texture-key mismatch")

    sequence_coverage: dict[str, Any] = {}
    for side_name in ("main", "sub"):
        records = []
        counts = {"FULL_REMIX": 0, "PARTIAL_REMIX": 0, "FAITHFUL_FALLBACK_ONLY": 0}
        frame_manifest = side_outputs[side_name]["frameManifest"]
        for animation in review_runtime["sides"][side_name]["animations"]:
            art_sources = [frame_manifest[frame["texture"]]["artSource"] for frame in animation["frames"]]
            remix_frames = art_sources.count("REMIX_TECHNICAL_CANDIDATE")
            if remix_frames == len(art_sources):
                state = "FULL_REMIX"
            elif remix_frames > 0:
                state = "PARTIAL_REMIX"
            else:
                state = "FAITHFUL_FALLBACK_ONLY"
            counts[state] += 1
            records.append({
                "id": animation["id"],
                "name": animation["name"],
                "semanticAlias": animation["semanticAlias"],
                "state": state,
                "remixFrameReferences": remix_frames,
                "frameReferenceCount": len(art_sources),
            })
        sequence_coverage[side_name] = {"counts": counts, "animations": records}

    manifest = {
        "schemaVersion": 1,
        "entityId": ENTITY_ID,
        "state": "COMPLETE_MOTION_PREVIEW_REVIEW_ONLY",
        "purpose": "EXERCISE_ORIGINAL_53_SEQUENCES_WITH_PARTIAL_REMIX_ART_BEFORE_VISUAL_APPROVAL",
        "slotCounts": {"main": 65, "sub": 18, "total": 83},
        "sequenceCounts": {"main": 40, "sub": 13, "total": 53},
        "candidateSlotCount": candidate_slots,
        "faithfulFallbackSlotCount": fallback_slots,
        "technicalCandidateUniqueCount": reuse["technicalCandidateUniqueCount"],
        "pendingUniqueCount": reuse["pendingUniqueCount"],
        "runtime": project_path(runtime_path),
        "runtimeSha256": sha256_file(runtime_path),
        "sides": side_outputs,
        "sequenceCoverage": sequence_coverage,
        "sourceTicksAndPlaybackPreserved": True,
        "stableTextureKeysPreserved": True,
        "mixedArtWarning": "DO_NOT_PROMOTE_THIS_REVIEW_ATLAS_AS_THE_FINISHED_REMIX_PACK",
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
    }
    manifest_path = output_directory / "manifest.json"
    manifest_path.write_text(serialize(manifest), encoding="utf-8")
    return manifest


def make_guide(source: Image.Image, frame_record: dict[str, Any]) -> Image.Image:
    guide = Image.new("RGBA", source.size, (246, 244, 236, 255))
    checker = ImageDraw.Draw(guide)
    tile = 16
    for y in range(0, source.height, tile):
        for x in range(0, source.width, tile):
            fill = (226, 226, 220, 255) if (x // tile + y // tile) % 2 == 0 else (244, 244, 240, 255)
            checker.rectangle((x, y, x + tile - 1, y + tile - 1), fill=fill)
    guide.alpha_composite(source)
    draw = ImageDraw.Draw(guide)
    source_box = alpha_bounds(source)
    if source_box:
        draw.rectangle(source_box, outline=(0, 184, 212, 255), width=2)
    draw.line((0, GROUND_Y, source.width - 1, GROUND_Y), fill=(245, 66, 66, 255), width=2)
    anchor_x = round(frame_record["anchor"]["x"] * source.width)
    draw.line((anchor_x, GROUND_Y - 10, anchor_x, GROUND_Y + 10), fill=(255, 196, 0, 255), width=2)
    return guide


def build_key_pose_workspace(source_directory: Path, output_directory: Path) -> dict[str, Any]:
    runtime = json.loads((source_directory / "runtime.json").read_text(encoding="utf-8"))
    usage: dict[int, list[dict[str, Any]]] = {cell: [] for cell in HIGH_RISK_CELLS}
    for animation in runtime["sides"]["main"]["animations"]:
        for frame_index, frame in enumerate(animation["frames"]):
            if frame["cell"] in usage:
                usage[frame["cell"]].append({
                    "actionId": animation["id"],
                    "action": animation["name"],
                    "semanticAlias": animation["semanticAlias"],
                    "semanticConfidence": animation["semanticConfidence"],
                    "frameIndex": frame_index,
                    "ticks": frame["ticks"],
                    "playback": animation["playback"],
                })

    key_pose_directory = output_directory / "key-pose-guides"
    key_pose_directory.mkdir(parents=True, exist_ok=True)
    records = []
    panels = []
    canonical_by_pixel_hash: dict[str, int] = {}
    reuse_groups: dict[int, list[int]] = {}
    for cell_id in HIGH_RISK_CELLS:
        source, frame_record = load_source_cell(source_directory, cell_id)
        pixel_hash = hashlib.sha256(source.tobytes()).hexdigest().upper()
        canonical_cell = canonical_by_pixel_hash.setdefault(pixel_hash, cell_id)
        reuse_groups.setdefault(canonical_cell, []).append(cell_id)
        logical_path = key_pose_directory / f"source-main-cell-{cell_id:03d}.png"
        guide_path = key_pose_directory / f"source-main-cell-{cell_id:03d}-guide.png"
        source.save(logical_path, optimize=True)
        guide = make_guide(source, frame_record)
        guide.save(guide_path, optimize=True)
        panels.append((cell_id, guide))
        records.append({
            "cell": cell_id,
            "logicalImage": project_path(logical_path),
            "logicalImageSha256": sha256_file(logical_path),
            "decodedPixelSha256": pixel_hash,
            "canonicalSourceCell": canonical_cell,
            "reuseOf": canonical_cell if canonical_cell != cell_id else None,
            "guide": project_path(guide_path),
            "alphaBounds": list(alpha_bounds(source)),
            "usedBy": usage[cell_id],
        })

    panel_width, panel_height = 192, 176
    label_height = 28
    board = Image.new("RGBA", (panel_width * 4, (panel_height + label_height) * 3), (245, 243, 236, 255))
    draw = ImageDraw.Draw(board)
    for index, (cell_id, guide) in enumerate(panels):
        column = index % 4
        row = index // 4
        x = column * panel_width
        y = row * (panel_height + label_height)
        board.alpha_composite(guide.resize((panel_width, panel_height), Image.Resampling.NEAREST), (x, y))
        aliases = [entry["semanticAlias"] for entry in usage[cell_id] if entry["semanticAlias"]]
        label = aliases[0] if aliases else "raw action slot"
        canonical_cell = next(record["canonicalSourceCell"] for record in records if record["cell"] == cell_id)
        if canonical_cell != cell_id:
            label = f"reuse Cell {canonical_cell:03d}"
        draw.text((x + 6, y + panel_height + 6), f"Cell {cell_id:03d} | {label}", fill=(28, 37, 43, 255))

    board_path = output_directory / "m201-main-12-high-risk-source-guides.png"
    board.save(board_path, optimize=True)
    result = {
        "schemaVersion": 1,
        "entityId": ENTITY_ID,
        "side": "main",
        "state": "SOURCE_GUIDES_READY_REQUIRES_APPROVED_SEED_BEFORE_REDRAW",
        "requestedPoseSlotCount": len(HIGH_RISK_CELLS),
        "uniqueDecodedSourcePoseCount": len(reuse_groups),
        "sourceReuseGroups": [
            {"canonicalCell": canonical, "cells": cells}
            for canonical, cells in reuse_groups.items()
        ],
        "cells": records,
        "contactSheet": project_path(board_path),
        "contactSheetSha256": sha256_file(board_path),
        "runtimeEligible": False,
        "shippingReady": False,
    }
    (output_directory / "m201-main-12-high-risk-source-guides.json").write_text(
        serialize(result), encoding="utf-8"
    )
    return result


def build_candidate_contact_sheet(source_directory: Path, output_directory: Path) -> dict[str, Any] | None:
    candidate_paths = {
        cell_id: output_directory / f"m201-main-cell-{cell_id:03d}-remix-candidate.png"
        for cell_id in HIGH_RISK_CELLS
    }
    if not all(path.exists() for path in candidate_paths.values()):
        return None

    panel_width, panel_height = 192, 176
    label_height = 28
    board = Image.new("RGBA", (panel_width * 4, (panel_height + label_height) * 3), (245, 243, 236, 255))
    draw = ImageDraw.Draw(board)
    records = []
    for index, cell_id in enumerate(HIGH_RISK_CELLS):
        candidate = Image.open(candidate_paths[cell_id]).convert("RGBA")
        _source, frame_record = load_source_cell(source_directory, cell_id)
        guide = make_guide(candidate, frame_record)
        column = index % 4
        row = index // 4
        x = column * panel_width
        y = row * (panel_height + label_height)
        board.alpha_composite(guide.resize((panel_width, panel_height), Image.Resampling.LANCZOS), (x, y))
        facing = SOURCE_FACING_BY_KEY_CELL[cell_id]
        draw.text((x + 6, y + panel_height + 6), f"Cell {cell_id:03d} | {facing}", fill=(28, 37, 43, 255))
        qa_path = output_directory / f"m201-main-cell-{cell_id:03d}-remix-candidate-qa.json"
        records.append({
            "cell": cell_id,
            "candidate": project_path(candidate_paths[cell_id]),
            "candidateSha256": sha256_file(candidate_paths[cell_id]),
            "qa": project_path(qa_path),
            "sourceFacing": facing,
        })

    board_path = output_directory / "m201-main-12-high-risk-remix-candidates.png"
    board.save(board_path, optimize=True)
    result = {
        "schemaVersion": 1,
        "entityId": ENTITY_ID,
        "side": "main",
        "state": "TWELVE_OF_TWELVE_TECHNICAL_CANDIDATES_VISUAL_LANDMARK_REVIEW_REQUIRED",
        "poseSlotCount": len(HIGH_RISK_CELLS),
        "uniqueDecodedSourcePoseCount": 9,
        "contactSheet": project_path(board_path),
        "contactSheetSha256": sha256_file(board_path),
        "cells": records,
        "runtimeEligible": False,
        "shippingReady": False,
    }
    (output_directory / "m201-main-12-high-risk-remix-candidates.json").write_text(
        serialize(result), encoding="utf-8"
    )
    return result


def build_motion_closure_contact_sheet(
    source_directory: Path,
    output_directory: Path,
) -> dict[str, Any] | None:
    candidate_paths = {
        cell_id: output_directory / f"m201-main-cell-{cell_id:03d}-remix-candidate.png"
        for cell_id in MOTION_CLOSURE_01_CELLS
    }
    if not all(path.exists() for path in candidate_paths.values()):
        return None

    panel_width, panel_height = 256, 235
    label_height = 28
    board = Image.new(
        "RGBA",
        (panel_width * len(MOTION_CLOSURE_01_CELLS), panel_height + label_height),
        (245, 243, 236, 255),
    )
    draw = ImageDraw.Draw(board)
    records: list[dict[str, Any]] = []
    for column, cell_id in enumerate(MOTION_CLOSURE_01_CELLS):
        candidate = Image.open(candidate_paths[cell_id]).convert("RGBA")
        _source, frame_record = load_source_cell(source_directory, cell_id)
        guide = make_guide(candidate, frame_record)
        left = column * panel_width
        board.alpha_composite(
            guide.resize((panel_width, panel_height), Image.Resampling.LANCZOS),
            (left, 0),
        )
        draw.text((left + 8, panel_height + 8), f"Main Cell {cell_id:03d}", fill=(28, 37, 43, 255))
        qa_path = output_directory / f"m201-main-cell-{cell_id:03d}-remix-candidate-qa.json"
        records.append({
            "cell": cell_id,
            "candidate": project_path(candidate_paths[cell_id]),
            "candidateSha256": sha256_file(candidate_paths[cell_id]),
            "qa": project_path(qa_path),
        })

    board_path = output_directory / "m201-motion-family-closure-01-candidates.png"
    board.save(board_path, optimize=True)
    result = {
        "schemaVersion": 1,
        "entityId": ENTITY_ID,
        "side": "main",
        "batch": "MOTION_FAMILY_CLOSURE_01",
        "canonicalCellCount": len(MOTION_CLOSURE_01_CELLS),
        "cells": records,
        "contactSheet": project_path(board_path),
        "contactSheetSha256": sha256_file(board_path),
        "state": "TECHNICAL_CANDIDATES_VISUAL_AND_LANDMARK_REVIEW_REQUIRED",
        "runtimeEligible": False,
        "shippingReady": False,
    }
    (output_directory / "m201-motion-family-closure-01-candidates.json").write_text(
        serialize(result), encoding="utf-8"
    )
    return result


def build_workspace(source_directory: Path, output_directory: Path) -> dict[str, Any]:
    output_directory.mkdir(parents=True, exist_ok=True)
    source, frame_record = load_source_frame(source_directory)
    source_path = output_directory / "source-cell-000-logical.png"
    edit_target_path = output_directory / "source-cell-000-edit-target-4x.png"
    guide_path = output_directory / "source-cell-000-qa-guide.png"
    source.save(source_path, optimize=True)
    source.resize((source.width * 4, source.height * 4), Image.Resampling.NEAREST).save(
        edit_target_path,
        optimize=True,
    )
    make_guide(source, frame_record).save(guide_path, optimize=True)

    candidate_path = output_directory / "m201-main-cell-000-remix-candidate.png"
    contract = {
        "schemaVersion": 1,
        "workPacketId": "CHARACTER_REMIX_M201_CELL_000_SEED_V1",
        "state": (
            "TECHNICAL_CANDIDATE_AVAILABLE_VISUAL_LANDMARK_REVIEW_REQUIRED"
            if candidate_path.exists()
            else "SOURCE_WORKSPACE_READY_CANDIDATE_REQUIRED"
        ),
        "entityId": ENTITY_ID,
        "side": "main",
        "cell": 0,
        "frameKey": FRAME_KEY,
        "source": {
            "atlasImage": project_path(source_directory / "main-atlas-00.png"),
            "atlasData": project_path(source_directory / "main-atlas-00.json"),
            "logicalImage": project_path(source_path),
            "logicalImageSha256": sha256_file(source_path),
            "editTarget4x": project_path(edit_target_path),
            "editTarget4xSha256": sha256_file(edit_target_path),
            "alphaBounds": list(alpha_bounds(source)),
        },
        "geometry": {
            "logicalCanvas": {"width": source.width, "height": source.height},
            "groundY": GROUND_Y,
            "anchor": frame_record["anchor"],
            "spriteSourceSize": frame_record["spriteSourceSize"],
            "format": "RGBA",
        },
        "visualDirection": {
            "file": "docs/art/proposals/a1-character-direction/a1-character-direction-panel-01.png",
            "slot": 3,
            "class": "DOG",
            "palette": "SOURCE_MAJOR_YELLOW_CREAM_FAMILY",
            "sourceFacing": SOURCE_FACING,
        },
        "outputs": {
            "qaGuide": project_path(guide_path),
            "normalizedCandidate": project_path(candidate_path),
            "candidateQa": project_path(output_directory / "m201-main-cell-000-remix-candidate-qa.json"),
        },
        "runtimeEligible": False,
        "shippingReady": False,
    }
    contract_path = output_directory / "seed-contract.json"
    contract_path.write_text(serialize(contract), encoding="utf-8")
    build_key_pose_workspace(source_directory, output_directory)
    build_motion_closure_contact_sheet(source_directory, output_directory)
    reuse = build_all83_source_reuse(source_directory, output_directory)
    build_review_runtime(
        source_directory,
        REVIEW_RUNTIME_DIRECTORY.resolve(),
        reuse,
    )
    return contract


def normalize_candidate(
    candidate_path: Path,
    source_directory: Path,
    output_directory: Path,
    *,
    cell_id: int = 0,
    mirror_candidate: bool = False,
) -> dict[str, Any]:
    require(cell_id in range(65), f"M201 Main cell is out of range: {cell_id}")
    source, frame_record = load_source_cell(
        source_directory,
        cell_id,
        require_ground=cell_id == 0,
    )
    candidate = Image.open(candidate_path).convert("RGBA")
    background_extraction = "SOURCE_ALPHA"
    removed_background_pixels = 0
    if candidate.getchannel("A").getextrema()[0] == 255:
        candidate, removed_background_pixels = extract_connected_neutral_background(candidate)
        background_extraction = "EDGE_CONNECTED_BRIGHT_NEUTRAL_CHECKERBOARD"
    else:
        alpha = candidate.getchannel("A")
        faint_alpha_pixels = sum(1 for value in alpha.get_flattened_data() if 0 < value < 8)
        if faint_alpha_pixels:
            candidate.putalpha(alpha.point(lambda value: 0 if value < 8 else value))
            removed_background_pixels = faint_alpha_pixels
            background_extraction = "SOURCE_ALPHA_THRESHOLD_8"
    bounds = alpha_bounds(candidate)
    require(bounds is not None, "Candidate has no visible alpha content")
    require(candidate.getchannel("A").getextrema()[0] == 0, "Candidate has no transparent background")
    cutout = candidate.crop(bounds)
    if mirror_candidate:
        cutout = ImageOps.mirror(cutout)

    source_box = alpha_bounds(source)
    require(source_box is not None, "Source cell is blank")
    target_width = source_box[2] - source_box[0]
    target_height = source_box[3] - source_box[1]
    scale = min(target_width / cutout.width, target_height / cutout.height)
    normalized_size = (
        max(1, round(cutout.width * scale)),
        max(1, round(cutout.height * scale)),
    )
    normalized = cutout.resize(normalized_size, Image.Resampling.LANCZOS)
    normalized_bounds = alpha_bounds(normalized)
    require(normalized_bounds is not None, "Resized candidate is blank")
    normalized = normalized.crop(normalized_bounds)
    logical = Image.new("RGBA", EXPECTED_SOURCE_SIZE, (0, 0, 0, 0))
    source_center_x = (source_box[0] + source_box[2]) / 2
    x = round(source_center_x - normalized.width / 2)
    y = source_box[3] - normalized.height
    logical.alpha_composite(normalized, (x, y))

    output_path = output_directory / f"m201-main-cell-{cell_id:03d}-remix-candidate.png"
    logical.save(output_path, optimize=True)
    output_bounds = alpha_bounds(logical)
    require(output_bounds is not None, "Normalized candidate is blank")

    checker = make_guide(Image.new("RGBA", EXPECTED_SOURCE_SIZE, (0, 0, 0, 0)), frame_record)
    source_panel = checker.copy()
    source_panel.alpha_composite(source)
    candidate_panel = checker.copy()
    candidate_panel.alpha_composite(logical)
    overlay_panel = checker.copy()
    source_tint = Image.new("RGBA", EXPECTED_SOURCE_SIZE, (0, 194, 220, 0))
    source_tint.putalpha(source.getchannel("A").point(lambda alpha: round(alpha * 0.58)))
    candidate_tint = Image.new("RGBA", EXPECTED_SOURCE_SIZE, (238, 62, 155, 0))
    candidate_tint.putalpha(logical.getchannel("A").point(lambda alpha: round(alpha * 0.58)))
    overlay_panel.alpha_composite(source_tint)
    overlay_panel.alpha_composite(candidate_tint)
    review_board = Image.new("RGBA", (EXPECTED_SOURCE_SIZE[0] * 3, EXPECTED_SOURCE_SIZE[1] + 32), (245, 243, 236, 255))
    review_board.alpha_composite(source_panel, (0, 32))
    review_board.alpha_composite(candidate_panel, (EXPECTED_SOURCE_SIZE[0], 32))
    review_board.alpha_composite(overlay_panel, (EXPECTED_SOURCE_SIZE[0] * 2, 32))
    review_draw = ImageDraw.Draw(review_board)
    review_draw.text((8, 9), "ROM source", fill=(28, 37, 43, 255))
    review_draw.text((EXPECTED_SOURCE_SIZE[0] + 8, 9), "Remix candidate", fill=(28, 37, 43, 255))
    review_draw.text((EXPECTED_SOURCE_SIZE[0] * 2 + 8, 9), "Overlay: cyan source / magenta remix", fill=(28, 37, 43, 255))
    review_kind = "seed" if cell_id == 0 else "pose"
    review_board_path = output_directory / f"m201-main-cell-{cell_id:03d}-{review_kind}-review.png"
    review_board.save(review_board_path, optimize=True)

    qa = {
        "schemaVersion": 1,
        "entityId": ENTITY_ID,
        "side": "main",
        "cell": cell_id,
        "candidateInput": project_path(candidate_path),
        "output": project_path(output_path),
        "outputSha256": sha256_file(output_path),
        "reviewBoard": project_path(review_board_path),
        "reviewBoardSha256": sha256_file(review_board_path),
        "checks": {
            "canvas384x352": logical.size == EXPECTED_SOURCE_SIZE,
            "rgba": logical.mode == "RGBA",
            "trueAlpha": logical.getchannel("A").getextrema()[0] == 0,
            "sourceVerticalPlacementPreserved": output_bounds[3] == source_box[3],
            "bottomMeetsGroundY320": output_bounds[3] == GROUND_Y if cell_id == 0 else None,
            "sourceFacingVisualReviewRequired": True,
            "footAndHandLandmarkReviewRequired": True,
            "a1IdentityReviewRequired": True,
        },
        "sourceAlphaBounds": list(source_box),
        "candidateAlphaBounds": list(output_bounds),
        "normalizationScale": scale,
        "sourceFacing": SOURCE_FACING_BY_KEY_CELL.get(cell_id, "SOURCE_CELL_VISUAL_REVIEW_REQUIRED"),
        "candidateMirroredToSourceFacing": mirror_candidate,
        "backgroundExtraction": background_extraction,
        "removedBackgroundPixels": removed_background_pixels,
        "state": "TECHNICAL_CANVAS_PASS_VISUAL_AND_LANDMARK_REVIEW_REQUIRED",
        "runtimeEligible": False,
        "shippingReady": False,
    }
    qa_path = output_directory / f"m201-main-cell-{cell_id:03d}-remix-candidate-qa.json"
    qa_path.write_text(serialize(qa), encoding="utf-8")
    build_candidate_contact_sheet(source_directory, output_directory)
    build_motion_closure_contact_sheet(source_directory, output_directory)
    return qa


def normalize_candidate_strip(
    candidate_path: Path,
    source_directory: Path,
    output_directory: Path,
    strip_cells: list[int | None],
    *,
    mirror_candidate: bool = False,
) -> dict[str, Any]:
    """Split one identity-locked strip and normalize selected slots.

    A ``None`` cell keeps an approved/anchor slot out of the redraw import.  The
    strip width may not divide evenly, so rounded boundaries preserve every
    source pixel exactly once.
    """

    require(strip_cells, "Candidate strip has no declared slots")
    strip = Image.open(candidate_path).convert("RGBA")
    require(strip.getchannel("A").getextrema()[0] == 0,
            "Candidate strip must contain genuine transparent alpha")
    slot_directory = output_directory / "motion-family-normalization-inputs"
    slot_directory.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    for slot_index, cell_id in enumerate(strip_cells):
        left = round(slot_index * strip.width / len(strip_cells))
        right = round((slot_index + 1) * strip.width / len(strip_cells))
        require(right > left, f"Candidate strip slot {slot_index} is empty")
        if cell_id is None:
            results.append({"slot": slot_index, "cell": None, "state": "ANCHOR_SLOT_SKIPPED"})
            continue
        require(cell_id in range(65), f"M201 Main cell is out of range: {cell_id}")
        slot = strip.crop((left, 0, right, strip.height))
        require(alpha_bounds(slot) is not None, f"Candidate strip slot {slot_index} is blank")
        slot_path = slot_directory / f"{candidate_path.stem}-slot-{slot_index:02d}-cell-{cell_id:03d}.png"
        slot.save(slot_path, optimize=True)
        qa = normalize_candidate(
            slot_path,
            source_directory,
            output_directory,
            cell_id=cell_id,
            mirror_candidate=mirror_candidate,
        )
        results.append({
            "slot": slot_index,
            "cell": cell_id,
            "state": qa["state"],
            "normalizationInput": project_path(slot_path),
            "output": qa["output"],
            "outputSha256": qa["outputSha256"],
        })

    receipt = {
        "schemaVersion": 1,
        "entityId": ENTITY_ID,
        "candidateStrip": project_path(candidate_path),
        "candidateStripSha256": sha256_file(candidate_path),
        "slotCount": len(strip_cells),
        "slots": results,
        "state": "TECHNICAL_CANVAS_PASS_VISUAL_AND_LANDMARK_REVIEW_REQUIRED",
        "runtimeEligible": False,
        "shippingReady": False,
    }
    receipt_path = output_directory / f"{candidate_path.stem}-normalization-receipt.json"
    receipt_path.write_text(serialize(receipt), encoding="utf-8")
    return receipt


def parse_strip_cells(value: str) -> list[int | None]:
    cells: list[int | None] = []
    for token in value.split(","):
        normalized = token.strip().lower()
        if normalized in {"-", "skip", "anchor"}:
            cells.append(None)
        else:
            cells.append(int(normalized))
    return cells


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-directory", type=Path, default=SOURCE_DIRECTORY)
    parser.add_argument("--output-directory", type=Path, default=OUTPUT_DIRECTORY)
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--cell", type=int, default=0)
    parser.add_argument(
        "--strip-cells",
        type=parse_strip_cells,
        help="Comma-separated Main cell IDs in strip order; use 'anchor' to skip a locked slot.",
    )
    parser.add_argument("--mirror-candidate", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    source_directory = arguments.source_directory.resolve()
    output_directory = arguments.output_directory.resolve()
    if arguments.candidate is None:
        result = build_workspace(source_directory, output_directory)
        print(serialize(result))
    elif arguments.strip_cells:
        result = normalize_candidate_strip(
            arguments.candidate.resolve(),
            source_directory,
            output_directory,
            arguments.strip_cells,
            mirror_candidate=arguments.mirror_candidate,
        )
        print(serialize(result))
    else:
        result = normalize_candidate(
            arguments.candidate.resolve(),
            source_directory,
            output_directory,
            cell_id=arguments.cell,
            mirror_candidate=arguments.mirror_candidate,
        )
        print(serialize(result))
