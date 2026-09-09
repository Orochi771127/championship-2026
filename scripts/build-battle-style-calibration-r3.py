#!/usr/bin/env python3
"""Build review-only comparison artifacts for the human-paint style pilot."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "style-calibration-r3"
CANDIDATES = WORKSPACE / "candidates"
REVIEW = WORKSPACE / "review"
CURRENT = (
    ROOT / "docs" / "art" / "production" / "battle" / "bm05-bm11-static-r1"
    / "review" / "bm06" / "bm00-bm06-composite-candidate.png"
)
SIZE = (1536, 1024)
FILES = [
    ("CURRENT_R2_REFERENCE", CURRENT),
    ("A_GOUACHE", CANDIDATES / "bm06-human-paint-a-gouache.png"),
    ("B_ANIMATION_BACKGROUND", CANDIDATES / "bm06-human-paint-b-animation-background.png"),
    ("C_RECOMMENDED_REDUCED_MICROTEXTURE", CANDIDATES / "bm06-human-paint-c-recommended.png"),
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def load(path: Path) -> Image.Image:
    if not path.is_file():
        raise SystemExit(f"Missing style-calibration input: {path}")
    result = Image.open(path).convert("RGB")
    if result.size != SIZE:
        raise SystemExit(f"{path}: expected {SIZE}, got {result.size}")
    return result


def portrait_preview(source: Image.Image, target: tuple[int, int]) -> Image.Image:
    width, height = target
    canvas = Image.new("RGB", target, "#191F25")
    rendered_height = round(width * source.height / source.width)
    rendered = source.resize((width, rendered_height), Image.Resampling.LANCZOS)
    y = round((height - rendered_height) * 0.42)
    canvas.paste(rendered, (0, y))
    return canvas


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    loaded = [(label, path, load(path)) for label, path in FILES]
    comparison = Image.new("RGB", SIZE, "#191F25")
    tile_size = (SIZE[0] // 2, SIZE[1] // 2)
    for index, (_, _, source) in enumerate(loaded):
        tile = source.resize(tile_size, Image.Resampling.LANCZOS)
        comparison.paste(tile, ((index % 2) * tile_size[0], (index // 2) * tile_size[1]))
    comparison_path = REVIEW / "bm06-style-comparison-2x2.png"
    comparison.save(comparison_path, optimize=True)

    recommended = loaded[-1][2]
    viewport_records = []
    for target in ((390, 844), (430, 932)):
        output = REVIEW / f"bm06-human-paint-c-viewport-{target[0]}x{target[1]}.png"
        portrait_preview(recommended, target).save(output, optimize=True)
        viewport_records.append({
            "viewport": list(target),
            "file": output.relative_to(ROOT).as_posix(),
            "sha256": sha256(output),
        })

    receipt = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-HUMAN-PAINT-STYLE-CALIBRATION-R3-2026-09-02",
        "status": "OWNER_STYLE_REVIEW_CANDIDATE_NOT_RUNTIME_NOT_SHIPPING",
        "purpose": "CALIBRATE_LESS_UNIFORM_MORE_HUMAN_AUTHORED_MARK_MAKING_BEFORE_REPLACEMENT",
        "runtimeMutation": False,
        "replacementPerformed": False,
        "referencePixelsInCandidates": False,
        "technicalFrame": {"dimensions": list(SIZE), "view": "BATTLE_WIDE_FIXED_CAMERA", "mobileFit": "CONTAIN_0_42"},
        "comparisonLayout": ["TOP_LEFT_CURRENT", "TOP_RIGHT_A", "BOTTOM_LEFT_B", "BOTTOM_RIGHT_C_RECOMMENDED"],
        "inputs": [
            {
                "label": label,
                "file": path.relative_to(ROOT).as_posix(),
                "sha256": sha256(path),
                "role": "EXISTING_COMPOSITION_REFERENCE" if index == 0 else "ORIGINAL_CREATED_STYLE_CANDIDATE",
            }
            for index, (label, path, _) in enumerate(loaded)
        ],
        "comparison": {"file": comparison_path.relative_to(ROOT).as_posix(), "sha256": sha256(comparison_path)},
        "viewportChecks": viewport_records,
        "recommendedCandidate": "C_RECOMMENDED_REDUCED_MICROTEXTURE",
        "approvalGate": "OWNER_VISUAL_STYLE_APPROVAL_BEFORE_ANY_RUNTIME_OR_EXISTING_ASSET_REPLACEMENT",
    }
    (WORKSPACE / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print("WROTE Battle human-paint style calibration review")


if __name__ == "__main__":
    main()
