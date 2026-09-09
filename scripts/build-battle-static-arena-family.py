#!/usr/bin/env python3
"""Build the BM05/BM06/BM08/BM09/BM10/BM11 internal art-review family.

Every arena owns one opaque background. All six reference the already-built
canonical BM00 shared layer in place, so the shared boundary and standing-ring
geometry have one payload and one hash across the family.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "bm05-bm11-static-r1"
SOURCE = WORKSPACE / "source"
REVIEW = WORKSPACE / "review"
RUNTIME = ROOT / "assets" / "production" / "internal-battle-review" / "bm05-bm11-static-r1"
CANONICAL_SHARED = (
    ROOT / "assets" / "production" / "internal-battle-review" / "bm00-bm01-r1"
    / "field-bm00-00-shared-layer.png"
)
BROWSER_QA = ROOT / "docs" / "reports" / "art" / "battle" / "bm05-bm11-static-r1" / "browser-qa.json"
EXPECTED_SIZE = (1536, 1024)
VIEWPORTS = [(360, 800), (390, 844), (393, 852), (412, 915), (430, 932)]
ARENAS = [
    {"key": "bm05", "fieldId": "field_bm05_01", "function": "BATTLE_SOUTHPOLE", "objectLayer": False},
    {"key": "bm06", "fieldId": "field_bm06_01", "function": "BATTLE_DESERT", "objectLayer": False},
    {"key": "bm08", "fieldId": "field_bm08_01", "function": "BATTLE_HELL", "objectLayer": True},
    {"key": "bm09", "fieldId": "field_bm09_01", "function": "BATTLE_COLOSSEUM", "objectLayer": False},
    {"key": "bm10", "fieldId": "field_bm10_01", "function": "BATTLE_STADIUM", "objectLayer": False},
    {"key": "bm11", "fieldId": "field_bm11_01", "function": "BATTLE_DOMESTADIUM", "objectLayer": True},
]


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


def browser_qa_passed() -> bool:
    if not BROWSER_QA.is_file():
        return False
    report = json.loads(BROWSER_QA.read_text(encoding="utf-8"))
    results = report.get("results", [])
    expected = {(arena["fieldId"], width, height) for arena in ARENAS for width, height in VIEWPORTS}
    observed = {
        (item.get("fieldId"), item.get("viewport", {}).get("width"), item.get("viewport", {}).get("height"))
        for item in results
        if not item.get("problems")
    }
    return (
        report.get("assetId") == "art:battle:bm05-bm11-static-r1:original-review"
        and str(report.get("status", "")).startswith("PASS_INTERNAL_REVIEW")
        and observed == expected
    )


def main() -> None:
    if not CANONICAL_SHARED.is_file():
        raise SystemExit(f"Missing canonical BM00 shared layer: {CANONICAL_SHARED}")
    REVIEW.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    shared = load_image(CANONICAL_SHARED, "RGBA")
    qa_passed = browser_qa_passed()
    arena_receipts = []
    contact_tiles = []

    for arena in ARENAS:
        field_id = arena["fieldId"]
        production_id = f"production:battle:arena:{field_id.replace('_', '-')}"
        source = SOURCE / f"{field_id.replace('_', '-')}-background-generated.png"
        if not source.is_file():
            raise SystemExit(f"Missing arena source: {source}")
        background = load_image(source, "RGB")
        review_dir = REVIEW / arena["key"]
        review_dir.mkdir(parents=True, exist_ok=True)
        review_background = review_dir / f"{field_id.replace('_', '-')}-background-candidate.png"
        review_composite = review_dir / f"bm00-{arena['key']}-composite-candidate.png"
        runtime_background = RUNTIME / f"{field_id.replace('_', '-')}-background.png"
        background.save(review_background, optimize=True)
        background.save(runtime_background, optimize=True)
        composite = Image.alpha_composite(background.convert("RGBA"), shared).convert("RGB")
        composite.save(review_composite, optimize=True)
        contact_tiles.append(composite.resize((768, 512), Image.Resampling.LANCZOS))

        viewport_checks = []
        for width, height in VIEWPORTS:
            output = review_dir / f"viewport-{width}x{height}.png"
            viewport_review(composite, (width, height)).save(output, optimize=True)
            viewport_checks.append({
                "viewport": [width, height],
                "file": output.relative_to(WORKSPACE).as_posix(),
                "sha256": sha256(output),
            })

        runtime_manifest = {
            "schemaVersion": 1,
            "assetId": f"art:battle:{arena['key']}-r1:original-review",
            "family": "BATTLE",
            "artifactMaturity": "INTERNAL_LAYERED_RUNTIME_REVIEW",
            "productionStatus": "BROWSER_QA_PASSED_INTERNAL_REVIEW" if qa_passed else "GENERATED_CANDIDATE_INTERNAL_REVIEW",
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
                "fieldId": field_id,
                "assetId": production_id,
                "dependencies": ["production:battle:shared:field-bm00-00"],
                "gameplayBinding": "EXTERNAL_NOT_MOUNTED",
                "collisionBinding": "NONE_ART_REVIEW_ONLY",
                "uiBinding": "NONE_ART_REVIEW_ONLY",
                "layers": [
                    {
                        "assetId": production_id,
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
            "promotionGate": "OWNER_VISUAL_APPROVAL_LICENSE_TERMS_LINK_AND_FINAL_LAYER_SEPARATION_REQUIRED",
        }
        runtime_manifest_path = RUNTIME / f"runtime.{arena['key']}.review.json"
        runtime_manifest_path.write_text(json.dumps(runtime_manifest, indent=2) + "\n", encoding="utf-8")
        arena_receipts.append({
            "key": arena["key"],
            "fieldId": field_id,
            "originalFunction": arena["function"],
            "assetId": production_id,
            "file": review_background.relative_to(WORKSPACE).as_posix(),
            "sha256": sha256(review_background),
            "runtimeManifest": runtime_manifest_path.relative_to(ROOT).as_posix(),
            "compositeReview": {
                "file": review_composite.relative_to(WORKSPACE).as_posix(),
                "sha256": sha256(review_composite),
            },
            "dependencies": ["production:battle:shared:field-bm00-00"],
            "referenceObjectLayerPresent": arena["objectLayer"],
            "flattenedInternalReviewOnly": True,
            "productionObjectSeparationRequired": arena["objectLayer"],
            "viewportChecks": viewport_checks,
        })

    contact_sheet = Image.new("RGB", (2304, 1024), "#191F25")
    for index, tile in enumerate(contact_tiles):
        contact_sheet.paste(tile, ((index % 3) * 768, (index // 3) * 512))
    contact_sheet_path = REVIEW / "contact-sheet-3x2.png"
    contact_sheet.save(contact_sheet_path, optimize=True)

    receipt = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-BM05-BM11-STATIC-R1-2026-09-02",
        "status": "INTERNAL_PIXI_REVIEW_PASSED_NOT_OWNER_APPROVED_NOT_PROMOTED" if qa_passed else "INTERNAL_PIXI_REVIEW_CANDIDATE_NOT_OWNER_APPROVED_NOT_PROMOTED",
        "dimensions": list(EXPECTED_SIZE),
        "canonicalSharedLayer": {
            "assetId": "production:battle:shared:field-bm00-00",
            "file": CANONICAL_SHARED.relative_to(ROOT).as_posix(),
            "sha256": sha256(CANONICAL_SHARED),
            "copiedIntoFamilyBundle": False,
        },
        "contactSheet": {
            "order": [arena["fieldId"] for arena in ARENAS],
            "file": contact_sheet_path.relative_to(WORKSPACE).as_posix(),
            "sha256": sha256(contact_sheet_path),
        },
        "arenas": arena_receipts,
        "excluded": [
            {"fieldId": "field_bm03_01", "reason": "ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE"},
            {"fieldId": "field_bm04_01", "reason": "ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE"},
            {"fieldId": "field_bm07_01", "reason": "INDEPENDENT_NO_BM00_DEPENDENCY_REQUIRES_SEPARATE_ARCHITECTURE_BATCH"},
        ],
        "promotion": {
            "humanApproved": False,
            "runtimeQaPassed": qa_passed,
            "runtimeQaAuthority": "docs/reports/art/battle/bm05-bm11-static-r1/browser-qa.json",
            "licenseEvidenceLinked": False,
            "readyForRuntime": False,
            "shippingReady": False,
        },
    }
    (WORKSPACE / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(ARENAS)} static Battle arena review candidates at {WORKSPACE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
