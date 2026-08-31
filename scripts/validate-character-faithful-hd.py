#!/usr/bin/env python3
"""Validate faithful character HD output without relying on runtime imports."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate(batch_dir: Path) -> dict[str, int]:
    manifest_path = batch_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(manifest["scope"]["entityCount"] == 32, "Batch must contain exactly 32 entities")
    require(len(manifest["records"]) == 32, "Batch record count must be 32")
    require(len({record["entityId"] for record in manifest["records"]}) == 32, "Duplicate entity IDs")
    require(manifest["runtimeEligible"] is False, "License/visual approval gate must remain closed")
    require(manifest["shippingReady"] is False, "Unapproved batch must not be shipping-ready")
    require(sha256_file(batch_dir / manifest["contactSheet"]) == manifest["contactSheetSha256"], "Contact sheet hash mismatch")

    entity_total = 0
    frame_total = 0
    sequence_total = 0
    for record in manifest["records"]:
        entity_total += 1
        entity_dir = batch_dir / record["entityId"]
        runtime_path = entity_dir / record["runtime"]
        require(runtime_path.exists(), f"Missing runtime for {record['entityId']}")
        require(sha256_file(runtime_path) == record["runtimeSha256"], f"Runtime hash mismatch for {record['entityId']}")
        runtime = json.loads(runtime_path.read_text(encoding="utf-8"))
        require(runtime["renderer"] == "PIXIJS_V8_SPRITESHEET", "Unexpected renderer")
        require(runtime["artProfile"]["anchor"] == {"x": 0.5, "y": 0.9090909090909091}, "Anchor drift")

        for side_name in ("main", "sub"):
            side_record = record[side_name]
            all_frames: dict[str, dict] = {}
            for page in side_record["atlasPages"]:
                image_path = entity_dir / page["image"]
                data_path = entity_dir / page["data"]
                require(image_path.exists() and data_path.exists(), f"Missing atlas page for {record['entityId']}/{side_name}")
                require(sha256_file(image_path) == page["imageSha256"], "Atlas image hash mismatch")
                require(sha256_file(data_path) == page["dataSha256"], "Atlas JSON hash mismatch")
                image = Image.open(image_path).convert("RGBA")
                require(image.size == (page["width"], page["height"]), "Atlas dimensions mismatch")
                atlas = json.loads(data_path.read_text(encoding="utf-8"))
                require(len(atlas["frames"]) == page["frameCount"], "Atlas frame count mismatch")
                all_frames.update(atlas["frames"])

            require(len(all_frames) == side_record["cellCount"], f"Cell count mismatch for {record['entityId']}/{side_name}")
            frame_total += len(all_frames)
            animations = runtime["sides"][side_name]["animations"]
            require(len(animations) == side_record["sequenceCount"], "Sequence count mismatch")
            sequence_total += len(animations)
            for animation in animations:
                require(animation["frames"], "Animation must contain frames")
                for frame in animation["frames"]:
                    require(frame["texture"] in all_frames, f"Missing referenced texture {frame['texture']}")
                    require(frame["ticks"] > 0, "Frame duration must be positive")

            preview = Image.open(entity_dir / record["preview"]).convert("RGBA")
            require(preview.getchannel("A").getextrema() == (0, 255), f"Preview alpha boundary missing for {record['entityId']}")

    batch_number = manifest["scope"]["batchNumber"]
    print(
        f"validated Batch {batch_number:02d}: {entity_total} entities, {frame_total} Main/Sub cells, "
        f"{sequence_total} original animation sequences, PixiJS atlases and shared anchors"
    )
    return {"entities": entity_total, "frames": frame_total, "sequences": sequence_total}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-dir", type=Path, default=Path("docs/art/production/characters/faithful-hd224/batch-01"))
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--root", type=Path, default=Path("docs/art/production/characters/faithful-hd224"))
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.all:
        totals = {"entities": 0, "frames": 0, "sequences": 0}
        for batch_number in range(1, 8):
            result = validate((arguments.root / f"batch-{batch_number:02d}").resolve())
            for key in totals:
                totals[key] += result[key]
        master_path = arguments.root.resolve() / "manifest.json"
        master = json.loads(master_path.read_text(encoding="utf-8"))
        require(master["entityCount"] == 224, "Master roster must contain 224 entities")
        require(master["fullRosterBuilt"] is True, "Master roster must be marked fully built")
        require(len(master["entities"]) == 224, "Master entity index must contain 224 entries")
        require(len({entry["entityId"] for entry in master["entities"]}) == 224, "Master entity IDs must be unique")
        print(
            f"validated full roster: {totals['entities']} entities, {totals['frames']} Main/Sub cells, "
            f"{totals['sequences']} original animation sequences"
        )
    else:
        validate(arguments.batch_dir.resolve())
