#!/usr/bin/env python3
"""Build the research-gated faithful HD UI/HUD scene contract for all 96 NXR scenes.

This produces deterministic 4x nearest-neighbour reference witnesses and scene
composition JSON.  It deliberately does not copy these ROM-derived pixels into
assets/production; a licensed, human-approved replacement can retain the same
stable scene/resource IDs later.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
from collections import defaultdict
from pathlib import Path

from PIL import Image


REPO = Path(__file__).resolve().parents[1]


def required_source_path(variable: str) -> Path:
    value = os.environ.get(variable)
    if not value:
        raise SystemExit(f"Set {variable} to the decoded research input directory")
    return Path(value)


ANALYSIS = required_source_path("CHAMPIONSHIP_UI_ANALYSIS_ROOT")
REFERENCE = required_source_path("CHAMPIONSHIP_UI_REFERENCE_ROOT")
OUTPUT = REPO / "docs" / "art" / "production" / "ui" / "faithful-hd96"

SCALE = 4
SOURCE_WIDTH = 256
SOURCE_HEIGHT = 192
PORTRAIT_WIDTH = 1080
PORTRAIT_HEIGHT = 1920
ZONE_SCALE = PORTRAIT_WIDTH / SOURCE_WIDTH
ZONE_HEIGHT = SOURCE_HEIGHT * ZONE_SCALE
MAIN_Y = 150
SUB_Y = 960


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def screen_role(file_name: str) -> str:
    stem = Path(file_name).stem.lower()
    if any(token in stem for token in ("sub", "under", "bottom")):
        return "SUB"
    if any(token in stem for token in ("main", "top")):
        return "MAIN"
    return "UNKNOWN_REQUIRES_TRACE"


def upscale_inventory(
    rows: list[dict[str, str]],
    source_dir: Path,
    output_dir: Path,
    path_column: str,
    identity_column: str,
) -> tuple[list[dict], dict[str, dict]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    by_identity: dict[str, dict] = {}
    for row in rows:
        if row.get("status") != "OK":
            continue
        source = source_dir / row["png"]
        if not source.is_file():
            raise FileNotFoundError(source)
        destination = output_dir / row["png"]
        with Image.open(source) as image:
            rgba = image.convert("RGBA")
            enlarged = rgba.resize((rgba.width * SCALE, rgba.height * SCALE), Image.Resampling.NEAREST)
            enlarged.save(destination, format="PNG", optimize=False)
            source_size = [rgba.width, rgba.height]
            output_size = [enlarged.width, enlarged.height]
        record = {
            "id": row[identity_column],
            "sourceEvidence": row[path_column],
            "sourcePng": str(source),
            "outputPng": destination.relative_to(REPO).as_posix(),
            "sourceSize": source_size,
            "outputSize": output_size,
            "scale": SCALE,
            "filter": "NEAREST",
            "sourceSha256": sha256(source),
            "outputSha256": sha256(destination),
            "maturity": "FUNCTIONAL_PIXEL_FAITHFUL_HD_REFERENCE",
            "runtimeEligible": False,
        }
        records.append(record)
        by_identity[row[identity_column]] = record
    return records, by_identity


def number(value: str) -> int | float:
    parsed = float(value)
    return int(parsed) if parsed.is_integer() else parsed


def optional_int(value: str) -> int | None:
    return int(value) if value.strip() else None


def main() -> None:
    scene_rows = read_csv(ANALYSIS / "NXR_SCENE_REGISTRY_96.csv")
    node_rows = read_csv(ANALYSIS / "NXR_NODE_TABLE_1369.csv")
    link_rows = read_csv(ANALYSIS / "NXR_LINKED_ASSET_MAP_96.csv")
    background_rows = read_csv(REFERENCE / "UI_BACKGROUND_INVENTORY.csv")
    sprite_rows = read_csv(REFERENCE / "UI_SPRITE_BUNDLE_INVENTORY.csv")

    if len(scene_rows) != 96:
        raise ValueError(f"Expected 96 NXR scenes, found {len(scene_rows)}")
    if len(node_rows) != 1369:
        raise ValueError(f"Expected 1369 NXR nodes, found {len(node_rows)}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    backgrounds, background_by_nscr = upscale_inventory(
        background_rows,
        REFERENCE / "ui_backgrounds",
        OUTPUT / "background-witnesses-4x",
        "source_nscr",
        "source_nscr",
    )
    sprites, sprite_by_ncer = upscale_inventory(
        sprite_rows,
        REFERENCE / "ui_sprite_cells",
        OUTPUT / "sprite-cell-witnesses-4x",
        "source_ncer",
        "source_ncer",
    )

    nodes_by_scene: dict[str, list[dict[str, str]]] = defaultdict(list)
    links_by_scene: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in node_rows:
        nodes_by_scene[row["scene_path"]].append(row)
    for row in link_rows:
        links_by_scene[row["scene_path"]].append(row)

    scenes_dir = OUTPUT / "scenes"
    scenes_dir.mkdir(parents=True, exist_ok=True)
    scene_index: list[dict] = []
    assigned_roles = defaultdict(int)
    linked_backgrounds = 0
    linked_sprites = 0

    for scene in scene_rows:
        path = scene["scene_path"]
        role = screen_role(scene["file_name"])
        assigned_roles[role] += 1
        zone_y = MAIN_Y if role == "MAIN" else SUB_Y if role == "SUB" else None
        resources = []
        for link in links_by_scene[path]:
            sprite = sprite_by_ncer.get(link["ncer"])
            background = background_by_nscr.get(link["nscr"])
            linked_sprites += int(sprite is not None)
            linked_backgrounds += int(background is not None)
            resources.append({
                "resourceIndex": int(link["resource_index"]),
                "resourceName": link["resource_name"],
                "cellCount": optional_int(link["cell_count"]),
                "hasRenderBundle": link["has_render_bundle"] == "True",
                "source": {key: link[key] or None for key in ("ncer", "nanr", "ncgr", "ncbr", "nclr", "nscr")},
                "spriteWitness": sprite["outputPng"] if sprite else None,
                "backgroundWitness": background["outputPng"] if background else None,
                "confidence": link["confidence"],
            })

        nodes = []
        for raw in nodes_by_scene[path]:
            source_x = number(raw["x"])
            source_y = number(raw["y"])
            projection = None
            if zone_y is not None:
                projection = {
                    "x": round(float(source_x) * ZONE_SCALE, 4),
                    "y": round(zone_y + float(source_y) * ZONE_SCALE, 4),
                }
            nodes.append({
                "nodeIndex": int(raw["node_index"]),
                "name": raw["name"],
                "resourceIndex": int(raw["resource_index"]),
                "cellIndex": int(raw["cell_index"]),
                "sourcePosition": {"x": source_x, "y": source_y},
                "portraitProjection": projection,
                "params": [number(raw[f"param{i}_f32"]) for i in range(4, 8)],
                "colorModulationRaw": raw["color_modulation_raw"],
                "cellLinkValidated": raw["cell_index_validated"] == "YES",
            })

        scene_id = int(scene["scene_id"])
        filename = f"{scene_id:02d}-{slug(path)}.json"
        contract = {
            "schemaVersion": 1,
            "sceneId": scene_id,
            "scenePath": path,
            "category": scene["category"],
            "overlayOwner": scene["overlay_owner"],
            "sourceEvidence": {
                "fileId": int(scene["file_id"]),
                "fileName": scene["file_name"],
                "sha256": scene["sha256"],
                "overlayMappingConfidence": scene["overlay_mapping_confidence"],
            },
            "renderer": "DOM_UI_REFERENCE_COMPOSITION",
            "sourceScreen": {
                "width": SOURCE_WIDTH,
                "height": SOURCE_HEIGHT,
                "role": role,
                "roleEvidence": "FILENAME_HEURISTIC" if role != "UNKNOWN_REQUIRES_TRACE" else "UNKNOWN_REQUIRES_TRACE",
            },
            "portraitContract": {
                "canvas": {"width": PORTRAIT_WIDTH, "height": PORTRAIT_HEIGHT, "aspect": "9:16"},
                "mainZone": {"x": 0, "y": MAIN_Y, "width": PORTRAIT_WIDTH, "height": ZONE_HEIGHT},
                "subZone": {"x": 0, "y": SUB_Y, "width": PORTRAIT_WIDTH, "height": ZONE_HEIGHT},
                "safeBands": {"top": MAIN_Y, "middle": SUB_Y - (MAIN_Y + ZONE_HEIGHT), "bottom": PORTRAIT_HEIGHT - (SUB_Y + ZONE_HEIGHT)},
                "sourceToPortraitScale": ZONE_SCALE,
                "touchTargetMinimumCssPx": 44,
            },
            "resources": resources,
            "nodes": nodes,
            "dynamicVirtualNodeCount": int(scene["dynamic_virtual_nodes"]),
            "rightsStatus": "LICENSED_OWNER_REPORTED_DOCUMENT_LINK_PENDING",
            "humanApproved": False,
            "runtimeEligible": False,
            "shippingReady": False,
        }
        destination = scenes_dir / filename
        destination.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        scene_index.append({
            "sceneId": scene_id,
            "scenePath": path,
            "category": scene["category"],
            "screenRole": role,
            "nodeCount": len(nodes),
            "resourceCount": len(resources),
            "contract": destination.relative_to(REPO).as_posix(),
            "sha256": sha256(destination),
        })

    manifest = {
        "schemaVersion": 1,
        "id": "CHAMPIONSHIP_UI_FAITHFUL_HD96_V1",
        "generatedBy": "scripts/build-ui-faithful-hd96.py",
        "artifactMaturity": "FUNCTIONAL_PIXEL_FAITHFUL_HD_REFERENCE_AND_SCENE_CONTRACT_NOT_FINAL_HAND_REDRAW",
        "counts": {
            "scenes": len(scene_index),
            "nodes": len(node_rows),
            "linkedResources": len(link_rows),
            "backgroundWitnesses": len(backgrounds),
            "spriteCellWitnesses": len(sprites),
            "linkedBackgroundWitnesses": linked_backgrounds,
            "linkedSpriteWitnesses": linked_sprites,
            "screenRoles": dict(sorted(assigned_roles.items())),
        },
        "portraitContract": {
            "canvas": [PORTRAIT_WIDTH, PORTRAIT_HEIGHT],
            "originalScreen": [SOURCE_WIDTH, SOURCE_HEIGHT],
            "mainZone": [0, MAIN_Y, PORTRAIT_WIDTH, ZONE_HEIGHT],
            "subZone": [0, SUB_Y, PORTRAIT_WIDTH, ZONE_HEIGHT],
            "sourceToPortraitScale": ZONE_SCALE,
            "ownership": "DOM_UI; PixiJS remains the sole playable 2D field renderer",
        },
        "rightsStatus": "LICENSED_OWNER_REPORTED_DOCUMENT_LINK_PENDING",
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "backgrounds": backgrounds,
        "spriteCellWitnesses": sprites,
        "scenes": scene_index,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Built {len(scene_index)} UI scene contracts, {len(backgrounds)} backgrounds, "
        f"{len(sprites)} sprite witnesses and {len(node_rows)} nodes."
    )


if __name__ == "__main__":
    main()
