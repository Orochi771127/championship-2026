#!/usr/bin/env python3
"""Validate the faithful HD96 UI/HUD research package."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "docs" / "art" / "production" / "ui" / "faithful-hd96"


def sha256(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest


def main() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    counts = manifest["counts"]
    assert counts["scenes"] == 96
    assert counts["nodes"] == 1369
    assert counts["backgroundWitnesses"] == 87
    assert counts["spriteCellWitnesses"] == 193
    assert len(manifest["scenes"]) == 96
    assert manifest["runtimeEligible"] is False
    assert manifest["shippingReady"] is False
    assert manifest["portraitContract"]["canvas"] == [1080, 1920]

    scene_ids = set()
    node_total = 0
    for item in manifest["scenes"]:
        scene_ids.add(item["sceneId"])
        path = REPO / item["contract"]
        assert path.is_file()
        assert sha256(path) == item["sha256"]
        scene = json.loads(path.read_text(encoding="utf-8"))
        assert scene["runtimeEligible"] is False
        assert scene["portraitContract"]["canvas"] == {"width": 1080, "height": 1920, "aspect": "9:16"}
        node_total += len(scene["nodes"])
        for node in scene["nodes"]:
            if node["portraitProjection"] is not None:
                assert scene["sourceScreen"]["role"] in {"MAIN", "SUB"}
    assert scene_ids == set(range(96))
    assert node_total == 1369

    for family in ("backgrounds", "spriteCellWitnesses"):
        for asset in manifest[family]:
            path = REPO / asset["outputPng"]
            assert path.is_file()
            assert sha256(path) == asset["outputSha256"]
            with Image.open(path) as image:
                assert [image.width, image.height] == asset["outputSize"]
            assert asset["outputSize"] == [value * 4 for value in asset["sourceSize"]]

    print(
        f"UI faithful HD96 validation passed: {counts['scenes']} scenes, "
        f"{counts['nodes']} nodes, {counts['backgroundWitnesses']} backgrounds, "
        f"{counts['spriteCellWitnesses']} sprite witnesses."
    )


if __name__ == "__main__":
    main()
