#!/usr/bin/env python3
"""Build deterministic internal-review artifacts for the BM02 grass arena.

BM02 owns only its opaque arena background. The composited preview references
the already-built canonical BM00 shared layer in-place; this builder never
copies that payload into the BM02 runtime bundle.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "bm02-r1"
SOURCE = WORKSPACE / "source" / "field-bm02-01-background-generated.png"
REVIEW = WORKSPACE / "review"
RUNTIME = ROOT / "assets" / "production" / "internal-battle-review" / "bm02-r1"
CANONICAL_SHARED = (
    ROOT
    / "assets"
    / "production"
    / "internal-battle-review"
    / "bm00-bm01-r1"
    / "field-bm00-00-shared-layer.png"
)
BROWSER_QA = ROOT / "docs" / "reports" / "art" / "battle" / "bm02-r1" / "browser-qa.json"
EXPECTED_SIZE = (1536, 1024)
VIEWPORTS = [(360, 800), (390, 844), (393, 852), (412, 915), (430, 932)]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_image(path: Path, mode: str) -> Image.Image:
    image = Image.open(path).convert(mode)
    if image.size != EXPECTED_SIZE:
        raise SystemExit(f"{path}: expected {EXPECTED_SIZE}, got {image.size}")
    return image


def viewport_review(composite: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    canvas = Image.new("RGB", size, "#191F25")
    rendered_height = round(width * composite.height / composite.width)
    arena = composite.resize((width, rendered_height), Image.Resampling.LANCZOS)
    y = round((height - rendered_height) * 0.42)
    canvas.paste(arena, (0, y))
    return canvas


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing BM02 source: {SOURCE}")
    if not CANONICAL_SHARED.is_file():
        raise SystemExit(f"Missing canonical BM00 shared layer: {CANONICAL_SHARED}")

    REVIEW.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    background = load_image(SOURCE, "RGB")
    shared = load_image(CANONICAL_SHARED, "RGBA")

    review_background = REVIEW / "field-bm02-01-background-candidate.png"
    review_composite = REVIEW / "bm00-bm02-composite-candidate.png"
    runtime_background = RUNTIME / "field-bm02-01-background.png"
    background.save(review_background, optimize=True)
    background.save(runtime_background, optimize=True)
    composite = Image.alpha_composite(background.convert("RGBA"), shared).convert("RGB")
    composite.save(review_composite, optimize=True)

    viewport_checks = []
    for width, height in VIEWPORTS:
        output = REVIEW / f"viewport-{width}x{height}.png"
        viewport_review(composite, (width, height)).save(output, optimize=True)
        viewport_checks.append(
            {
                "viewport": [width, height],
                "file": output.relative_to(WORKSPACE).as_posix(),
                "sha256": sha256(output),
            }
        )

    runtime_qa_passed = False
    if BROWSER_QA.is_file():
        browser_qa = json.loads(BROWSER_QA.read_text(encoding="utf-8"))
        runtime_qa_passed = (
            browser_qa.get("assetId") == "art:battle:bm02-r1:original-review"
            and str(browser_qa.get("status", "")).startswith("PASS_INTERNAL_REVIEW")
            and len(browser_qa.get("results", [])) == len(VIEWPORTS)
            and all(not item.get("problems") for item in browser_qa.get("results", []))
        )

    receipt = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-BM02-R1-2026-09-02",
        "status": (
            "INTERNAL_PIXI_REVIEW_PASSED_NOT_OWNER_APPROVED_NOT_PROMOTED"
            if runtime_qa_passed
            else "INTERNAL_PIXI_REVIEW_CANDIDATE_NOT_OWNER_APPROVED_NOT_PROMOTED"
        ),
        "dimensions": list(EXPECTED_SIZE),
        "arena": {
            "assetId": "production:battle:arena:field-bm02-01",
            "file": review_background.relative_to(WORKSPACE).as_posix(),
            "sha256": sha256(review_background),
            "dependencies": ["production:battle:shared:field-bm00-00"],
        },
        "canonicalSharedLayer": {
            "assetId": "production:battle:shared:field-bm00-00",
            "file": CANONICAL_SHARED.relative_to(ROOT).as_posix(),
            "sha256": sha256(CANONICAL_SHARED),
            "copiedIntoBm02Bundle": False,
        },
        "compositeReview": {
            "file": review_composite.relative_to(WORKSPACE).as_posix(),
            "sha256": sha256(review_composite),
        },
        "viewportChecks": viewport_checks,
        "promotion": {
            "humanApproved": False,
            "runtimeQaPassed": runtime_qa_passed,
            "runtimeQaAuthority": "docs/reports/art/battle/bm02-r1/browser-qa.json",
            "licenseEvidenceLinked": False,
            "readyForRuntime": False,
            "shippingReady": False,
        },
    }
    (WORKSPACE / "receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
    )

    runtime_manifest = {
        "schemaVersion": 1,
        "assetId": "art:battle:bm02-r1:original-review",
        "family": "BATTLE",
        "artifactMaturity": "INTERNAL_LAYERED_RUNTIME_REVIEW",
        "productionStatus": (
            "BROWSER_QA_PASSED_INTERNAL_REVIEW"
            if runtime_qa_passed
            else "GENERATED_CANDIDATE_INTERNAL_REVIEW"
        ),
        "shippingStatus": "NOT_SHIPPING_READY",
        "humanApproved": False,
        "ownerApproval": None,
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
            "fieldId": "field_bm02_01",
            "assetId": "production:battle:arena:field-bm02-01",
            "dependencies": ["production:battle:shared:field-bm00-00"],
            "gameplayBinding": "EXTERNAL_NOT_MOUNTED",
            "collisionBinding": "NONE_ART_REVIEW_ONLY",
            "uiBinding": "NONE_ART_REVIEW_ONLY",
            "layers": [
                {
                    "assetId": "production:battle:arena:field-bm02-01",
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
                    "src": CANONICAL_SHARED.relative_to(ROOT).as_posix(),
                    "sha256": sha256(CANONICAL_SHARED),
                    "alpha": True,
                },
            ],
        },
        "promotionGate": "OWNER_VISUAL_APPROVAL_LICENSE_TERMS_LINK_AND_ISOLATED_PIXI_QA_REQUIRED",
    }
    (RUNTIME / "runtime.review.json").write_text(
        json.dumps(runtime_manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Built BM02 review candidate at {WORKSPACE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
