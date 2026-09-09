#!/usr/bin/env python3
"""Build the independent BM07 Cyberspace internal art-review bundle.

BM07 is catalog-proven to have no BM00 dependency, object layer, or animation
bundle. Its six standing-zone rings are therefore composited into the one
opaque arena layer using fixed production coordinates instead of model-drawn
geometry.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "bm07-cyberspace-r1"
SOURCE = WORKSPACE / "source" / "field-bm07-01-background-generated.png"
REVIEW = WORKSPACE / "review"
RUNTIME = ROOT / "assets" / "production" / "internal-battle-review" / "bm07-cyberspace-r1"
BROWSER_QA = ROOT / "docs" / "reports" / "art" / "battle" / "bm07-cyberspace-r1" / "browser-qa.json"
EXPECTED_SIZE = (1536, 1024)
VIEWPORTS = [(360, 800), (390, 844), (393, 852), (412, 915), (430, 932)]
RING_CENTERS = [(440, 400), (768, 400), (1096, 400), (440, 632), (768, 632), (1096, 632)]
RING_RADIUS = 96


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_source() -> Image.Image:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing BM07 generated source: {SOURCE}")
    image = Image.open(SOURCE).convert("RGB")
    if image.size != EXPECTED_SIZE:
        raise SystemExit(f"{SOURCE}: expected {EXPECTED_SIZE}, got {image.size}")
    return image


def add_aligned_standing_zones(background: Image.Image) -> Image.Image:
    base = background.convert("RGBA")
    glow = Image.new("RGBA", EXPECTED_SIZE, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    crisp = Image.new("RGBA", EXPECTED_SIZE, (0, 0, 0, 0))
    crisp_draw = ImageDraw.Draw(crisp)
    for x, y in RING_CENTERS:
        outer = (x - RING_RADIUS, y - RING_RADIUS, x + RING_RADIUS, y + RING_RADIUS)
        inner_radius = RING_RADIUS - 10
        inner = (x - inner_radius, y - inner_radius, x + inner_radius, y + inner_radius)
        glow_draw.ellipse(outer, outline=(31, 222, 255, 180), width=18)
        crisp_draw.ellipse(outer, outline=(72, 231, 255, 235), width=4)
        crisp_draw.ellipse(inner, outline=(143, 92, 255, 185), width=3)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=10))
    return Image.alpha_composite(Image.alpha_composite(base, glow), crisp).convert("RGB")


def viewport_review(composite: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    canvas = Image.new("RGB", size, "#070A18")
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
    observed = {
        (item.get("viewport", {}).get("width"), item.get("viewport", {}).get("height"))
        for item in results if not item.get("problems")
    }
    return (
        report.get("assetId") == "art:battle:bm07-cyberspace-r1:original-review"
        and str(report.get("status", "")).startswith("PASS_INTERNAL_REVIEW")
        and observed == set(VIEWPORTS)
    )


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    background = load_source()
    final = add_aligned_standing_zones(background)
    review_file = REVIEW / "field-bm07-01-independent-layer-candidate.png"
    runtime_file = RUNTIME / "field-bm07-01-independent-layer.png"
    final.save(review_file, optimize=True)
    final.save(runtime_file, optimize=True)

    viewport_checks = []
    for width, height in VIEWPORTS:
        output = REVIEW / f"viewport-{width}x{height}.png"
        viewport_review(final, (width, height)).save(output, optimize=True)
        viewport_checks.append({
            "viewport": [width, height],
            "file": output.relative_to(WORKSPACE).as_posix(),
            "sha256": sha256(output),
        })

    qa_passed = browser_qa_passed()
    runtime_manifest = {
        "schemaVersion": 1,
        "assetId": "art:battle:bm07-cyberspace-r1:original-review",
        "family": "BATTLE",
        "artifactMaturity": "INTERNAL_INDEPENDENT_RUNTIME_REVIEW",
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
            "fieldId": "field_bm07_01",
            "assetId": "production:battle:arena:field-bm07-01",
            "dependencies": [],
            "gameplayBinding": "EXTERNAL_NOT_MOUNTED",
            "collisionBinding": "NONE_ART_REVIEW_ONLY",
            "uiBinding": "NONE_ART_REVIEW_ONLY",
            "standingZoneContract": {
                "count": 6,
                "centers": [list(item) for item in RING_CENTERS],
                "radius": RING_RADIUS,
                "alignment": "THREE_EXACT_COLUMNS_BY_TWO_EXACT_ROWS",
                "bakedIntoIndependentLayer": True,
            },
            "layers": [{
                "assetId": "production:battle:arena:field-bm07-01",
                "role": "ARENA_BACKGROUND",
                "zIndex": 0,
                "src": runtime_file.relative_to(ROOT).as_posix(),
                "sha256": sha256(runtime_file),
                "alpha": False,
            }],
        },
        "promotionGate": "OWNER_VISUAL_APPROVAL_AND_LICENSE_TERMS_LINK_REQUIRED",
    }
    runtime_manifest_path = RUNTIME / "runtime.review.json"
    runtime_manifest_path.write_text(json.dumps(runtime_manifest, indent=2) + "\n", encoding="utf-8")

    status = "INTERNAL_PIXI_REVIEW_PASSED_NOT_OWNER_APPROVED_NOT_PROMOTED" if qa_passed else "INTERNAL_PIXI_REVIEW_CANDIDATE_NOT_OWNER_APPROVED_NOT_PROMOTED"
    manifest = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-BM07-CYBERSPACE-R1-2026-09-02",
        "status": status,
        "artDirectionBrief": "ART_DIRECTION.md",
        "promptRecord": "PROMPTS.md",
        "buildScript": "scripts/build-battle-bm07-cyberspace.py",
        "rights": {
            "sourceKind": "ORIGINAL_AI_ASSISTED_GENERATION_WITH_DETERMINISTIC_GEOMETRY",
            "generator": "OpenAI image generation through Codex imagegen skill",
            "createdAt": "2026-09-02",
            "referencePixelReuse": False,
            "referencePaletteReuse": False,
            "referenceGeometryReuse": False,
            "licenseEvidenceStatus": "GENERATION_RECEIPT_RECORDED_TERMS_LINK_PENDING",
        },
        "referenceEvidence": {
            "fieldId": "field_bm07_01",
            "function": "BATTLE_CYBERSPACE",
            "nativeDimensions": [416, 272],
            "catalogDependencies": [],
            "commonLayer": "NOT_PRESENT_CATALOG",
            "objectLayer": "NOT_PRESENT_CATALOG",
            "animation": "NOT_PRESENT",
            "productionReuse": "STRUCTURAL_FUNCTION_ONLY_NO_ROM_ASSET_REUSE",
        },
        "asset": {
            "id": "production:battle:arena:field-bm07-01",
            "fieldId": "field_bm07_01",
            "function": "BATTLE_CYBERSPACE",
            "sourceFile": SOURCE.relative_to(WORKSPACE).as_posix(),
            "dependencies": [],
            "runtimeManifest": runtime_manifest_path.relative_to(ROOT).as_posix(),
        },
        "reviewPolicy": {
            "independentSingleLayer": True,
            "technicalChecksPassed": True,
            "runtimeQaPassed": qa_passed,
            "runtimeQaReceipt": "docs/reports/art/battle/bm07-cyberspace-r1/browser-qa.json",
            "humanApproved": False,
            "readyForRuntime": False,
            "shippingReady": False,
        },
    }
    (WORKSPACE / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    receipt = {
        "schemaVersion": 1,
        "batchId": manifest["batchId"],
        "status": status,
        "source": {"file": SOURCE.relative_to(WORKSPACE).as_posix(), "sha256": sha256(SOURCE)},
        "output": {"file": review_file.relative_to(WORKSPACE).as_posix(), "sha256": sha256(review_file)},
        "runtime": {"file": runtime_file.relative_to(ROOT).as_posix(), "sha256": sha256(runtime_file)},
        "ringContract": {
            "count": 6,
            "centers": [list(item) for item in RING_CENTERS],
            "radius": RING_RADIUS,
            "columns": [440, 768, 1096],
            "rows": [400, 632],
            "source": "DETERMINISTIC_BUILDER_NOT_IMAGE_MODEL",
        },
        "viewportChecks": viewport_checks,
        "promotion": {
            "humanApproved": False,
            "runtimeQaPassed": qa_passed,
            "licenseEvidenceLinked": False,
            "readyForRuntime": False,
            "shippingReady": False,
        },
    }
    (WORKSPACE / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Built independent BM07 Cyberspace review candidate at {WORKSPACE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
