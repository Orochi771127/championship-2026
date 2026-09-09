#!/usr/bin/env python3
"""Build deterministic review artifacts for the BM00/BM01 Battle art pilot.

The image generator returned the BM00 isolation on a white matte. This script
turns that matte into clean alpha, records transparent RGB as zero, composites
the canonical shared layer over the BM01-specific background, and produces
five UI-free portrait viewport checks. Nothing generated here is promoted to
the runtime production index.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PILOT = ROOT / "docs" / "art" / "production" / "battle" / "bm00-bm01-pilot"
SOURCE = PILOT / "source"
REVIEW = PILOT / "review"
RUNTIME = ROOT / "assets" / "production" / "internal-battle-review" / "bm00-bm01-r1"
EXPECTED_SIZE = (1536, 1024)
VIEWPORTS = [(360, 800), (390, 844), (393, 852), (412, 915), (430, 932)]
RING_CENTER_AXIS_X = 768
RING_ROWS = [
    {"name": "rear", "y": 395, "centerOffsetX": 305, "width": 220, "height": 58},
    {"name": "middle", "y": 493, "centerOffsetX": 350, "width": 272, "height": 84},
    {"name": "front", "y": 626, "centerOffsetX": 365, "width": 310, "height": 114},
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_rgb(name: str) -> Image.Image:
    image = Image.open(SOURCE / name).convert("RGB")
    if image.size != EXPECTED_SIZE:
        raise SystemExit(f"{name}: expected {EXPECTED_SIZE}, got {image.size}")
    return image


def white_matte_to_alpha(image: Image.Image) -> Image.Image:
    """Recover a soft alpha estimate from an RGB image composited over white."""
    rgb = np.asarray(image, dtype=np.float32)
    distance = np.sqrt(np.square(255.0 - rgb).sum(axis=2))
    alpha = np.clip((distance - 18.0) / (62.0 - 18.0), 0.0, 1.0)

    # Undo the white matte at semi-transparent pixels to prevent pale fringes.
    safe_alpha = np.maximum(alpha[..., None], 1.0 / 255.0)
    foreground = 255.0 - ((255.0 - rgb) / safe_alpha)
    foreground = np.clip(foreground, 0.0, 255.0)
    foreground[alpha <= 0.0] = 0.0

    rgba = np.dstack((foreground, alpha[..., None] * 255.0)).astype(np.uint8)
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def checkerboard(size: tuple[int, int], cell: int = 32) -> Image.Image:
    image = Image.new("RGB", size, "#CED5D2")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#AEB9B5")
    return image


def add_aligned_standing_rings(shared: Image.Image) -> Image.Image:
    """Draw exact mirrored ring pairs instead of trusting generated geometry."""
    scale = 4
    layer = Image.new("RGBA", (EXPECTED_SIZE[0] * scale, EXPECTED_SIZE[1] * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for row in RING_ROWS:
        half_width = row["width"] / 2
        half_height = row["height"] / 2
        centers = [
            RING_CENTER_AXIS_X - row["centerOffsetX"],
            RING_CENTER_AXIS_X + row["centerOffsetX"],
        ]
        for center_x in centers:
            box = tuple(
                round(value * scale)
                for value in (
                    center_x - half_width,
                    row["y"] - half_height,
                    center_x + half_width,
                    row["y"] + half_height,
                )
            )
            draw.ellipse(box, outline=(198, 183, 132, 174), width=5 * scale)
    layer = layer.resize(EXPECTED_SIZE, Image.Resampling.LANCZOS)
    return Image.alpha_composite(shared, layer)


def viewport_review(composite: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    canvas = Image.new("RGB", size, "#191F25")
    target_width = width
    target_height = round(target_width * composite.height / composite.width)
    arena = composite.resize((target_width, target_height), Image.Resampling.LANCZOS)
    y = round((height - target_height) * 0.42)
    canvas.paste(arena, (0, y))
    return canvas


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    target = load_rgb("visual-target-composite.png")
    background = load_rgb("bm01-background.png")
    shared = add_aligned_standing_rings(
        white_matte_to_alpha(load_rgb("bm00-frame-only-white-matte-v2.png"))
    )

    target_path = REVIEW / "visual-target-candidate.png"
    background_path = REVIEW / "field-bm01-01-background-candidate.png"
    shared_path = REVIEW / "field-bm00-00-shared-layer-candidate.png"
    composite_path = REVIEW / "bm00-bm01-composite-candidate.png"
    alpha_path = REVIEW / "bm00-alpha-checker-candidate.png"

    target.save(target_path, optimize=True)
    background.save(background_path, optimize=True)
    shared.save(shared_path, optimize=True)
    composite = Image.alpha_composite(background.convert("RGBA"), shared)
    composite.convert("RGB").save(composite_path, optimize=True)
    alpha_check = checkerboard(EXPECTED_SIZE).convert("RGBA")
    alpha_check.alpha_composite(shared)
    alpha_check.convert("RGB").save(alpha_path, optimize=True)

    runtime_shared = RUNTIME / "field-bm00-00-shared-layer.png"
    runtime_background = RUNTIME / "field-bm01-01-background.png"
    shared.save(runtime_shared, optimize=True)
    background.save(runtime_background, optimize=True)

    viewport_files = []
    for viewport in VIEWPORTS:
        output = REVIEW / f"viewport-{viewport[0]}x{viewport[1]}.png"
        viewport_review(composite.convert("RGB"), viewport).save(output, optimize=True)
        viewport_files.append(output)

    alpha = np.asarray(shared)[..., 3]
    receipt = {
        "schemaVersion": 1,
        "pilotId": "ART-BATTLE-BM00-BM01-PILOT-2026-09-01",
        "status": "OWNER_DIRECTED_INTERNAL_PIXI_REVIEW_REGISTERED_NOT_PROMOTED",
        "dimensions": list(EXPECTED_SIZE),
        "sharedLayer": {
            "assetId": "production:battle:shared:field-bm00-00",
            "file": shared_path.relative_to(PILOT).as_posix(),
            "sha256": sha256(shared_path),
            "hasAlpha": True,
            "alphaRange": [int(alpha.min()), int(alpha.max())],
            "transparentRgbZero": bool(np.all(np.asarray(shared)[alpha == 0, :3] == 0)),
            "standingZoneGeometry": {
                "centerAxisX": RING_CENTER_AXIS_X,
                "pairRule": "LEFT_X_PLUS_RIGHT_X_EQUALS_TWO_TIMES_CENTER_AXIS",
                "rows": RING_ROWS,
            },
        },
        "arena": {
            "assetId": "production:battle:arena:field-bm01-01",
            "file": background_path.relative_to(PILOT).as_posix(),
            "sha256": sha256(background_path),
            "dependencies": ["production:battle:shared:field-bm00-00"],
        },
        "visualTarget": {
            "file": target_path.relative_to(PILOT).as_posix(),
            "sha256": sha256(target_path),
        },
        "compositeReview": {
            "file": composite_path.relative_to(PILOT).as_posix(),
            "sha256": sha256(composite_path),
        },
        "viewportChecks": [
            {
                "viewport": [path.width, path.height],
                "file": output.relative_to(PILOT).as_posix(),
                "sha256": sha256(output),
            }
            for path, output in zip((Image.open(item) for item in viewport_files), viewport_files)
        ],
        "promotion": {
            "humanApproved": True,
            "ownerVerdict": "CONTINUE_AFTER_RING_ALIGNMENT",
            "runtimeQaPassed": None,
            "runtimeQaAuthority": "docs/reports/art/battle/bm00-bm01-r1/browser-qa.json",
            "licenseEvidenceLinked": False,
            "readyForRuntime": False,
            "shippingReady": False,
        },
    }
    (PILOT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    runtime_manifest = {
        "schemaVersion": 1,
        "assetId": "art:battle:bm00-bm01-r1:original-review",
        "family": "BATTLE",
        "artifactMaturity": "INTERNAL_LAYERED_RUNTIME_REVIEW",
        "productionStatus": "OWNER_DIRECTED_ALIGNMENT_REVISION_INTERNAL_REVIEW",
        "shippingStatus": "NOT_SHIPPING_READY",
        "humanApproved": True,
        "ownerApproval": {
            "date": "2026-09-01",
            "verdict": "CONTINUE_AFTER_RING_ALIGNMENT",
            "finalArt": False,
            "shippingReady": False,
        },
        "rightsStatus": "ORIGINAL_CREATED_AI_ASSISTED",
        "rights": {
            "status": "ORIGINAL_CREATED_AI_ASSISTED_TERMS_LINK_PENDING",
            "referencePixelReuse": False,
            "referencePaletteReuse": False,
            "referenceGeometryReuse": False,
        },
        "internalReviewEligible": True,
        "runtimeEligible": False,
        "shippingReady": False,
        "sourceDimensions": list(EXPECTED_SIZE),
        "viewportPolicy": {
            "fit": "CONTAIN",
            "verticalAnchor": 0.42,
            "contractViewports": [list(item) for item in VIEWPORTS],
        },
        "arena": {
            "fieldId": "field_bm01_01",
            "assetId": "production:battle:arena:field-bm01-01",
            "dependencies": ["production:battle:shared:field-bm00-00"],
            "gameplayBinding": "EXTERNAL_NOT_MOUNTED",
            "collisionBinding": "NONE_ART_REVIEW_ONLY",
            "uiBinding": "NONE_ART_REVIEW_ONLY",
            "layers": [
                {
                    "assetId": "production:battle:arena:field-bm01-01",
                    "role": "ARENA_BACKGROUND",
                    "zIndex": 0,
                    "src": runtime_background.relative_to(ROOT).as_posix(),
                    "sha256": sha256(runtime_background),
                    "alpha": False,
                },
                {
                    "assetId": "production:battle:shared:field-bm00-00",
                    "role": "CANONICAL_SHARED_LAYER",
                    "zIndex": 10,
                    "src": runtime_shared.relative_to(ROOT).as_posix(),
                    "sha256": sha256(runtime_shared),
                    "alpha": True,
                },
            ],
        },
        "promotionGate": "LICENSE_TERMS_LINK_AND_ISOLATED_PIXI_QA_REQUIRED",
    }
    (RUNTIME / "runtime.review.json").write_text(
        json.dumps(runtime_manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Built BM00/BM01 review candidate at {PILOT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
