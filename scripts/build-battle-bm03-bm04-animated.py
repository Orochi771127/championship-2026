#!/usr/bin/env python3
"""Build the BM03/BM04 animated Battle internal-review bundles.

The generated scene masters are original-created production inputs. This
builder separates only the visibly animated material, derives a deterministic
second review frame, and composes both below static terrain and the canonical
BM00 shared layer. ROM payloads remain external research evidence only.
"""

from __future__ import annotations

import colorsys
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "bm03-bm04-animated-r1"
SOURCE = WORKSPACE / "source"
REVIEW = WORKSPACE / "review"
RUNTIME = ROOT / "assets" / "production" / "internal-battle-review" / "bm03-bm04-animated-r1"
TRACE = ROOT / "docs" / "research" / "BATTLE_BM03_BM04_ANIMATION_TRACE_2026-09-02.json"
CANONICAL_SHARED = (
    ROOT / "assets" / "production" / "internal-battle-review" / "bm00-bm01-r1"
    / "field-bm00-00-shared-layer.png"
)
BROWSER_QA = ROOT / "docs" / "reports" / "art" / "battle" / "bm03-bm04-animated-r1" / "browser-qa.json"
EXPECTED_SIZE = (1536, 1024)
VIEWPORTS = [(360, 800), (390, 844), (393, 852), (412, 915), (430, 932)]
ARENAS = [
    {
        "key": "bm03",
        "fieldId": "field_bm03_01",
        "function": "BATTLE_VOLCANO",
        "effect": "LAVA",
        "objectLayer": False,
        "offset": (7, 3),
    },
    {
        "key": "bm04",
        "fieldId": "field_bm04_01",
        "function": "BATTLE_ISLAND",
        "effect": "WATER",
        "objectLayer": True,
        "offset": (5, 0),
    },
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_image(path: Path, mode: str) -> Image.Image:
    if not path.is_file():
        raise SystemExit(f"Missing production input: {path}")
    image = Image.open(path).convert(mode)
    if image.size != EXPECTED_SIZE:
        raise SystemExit(f"{path}: expected {EXPECTED_SIZE}, got {image.size}")
    return image


def effect_mask(image: Image.Image, effect: str) -> Image.Image:
    """Select only original-created pixels intended to visually animate."""
    rgb = image.convert("RGB")
    mask = Image.new("L", EXPECTED_SIZE, 0)
    source_pixels = rgb.load()
    mask_pixels = mask.load()
    for y in range(EXPECTED_SIZE[1]):
        for x in range(EXPECTED_SIZE[0]):
            red, green, blue = source_pixels[x, y]
            hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
            h = hue * 255
            s = saturation * 255
            v = value * 255
            selected = False
            if effect == "LAVA":
                selected = y >= 250 and (h <= 28 or h >= 248) and s >= 168 and v >= 112
            elif effect == "WATER":
                selected = y >= 225 and 103 <= h <= 146 and s >= 70 and v >= 88
            if selected:
                mask_pixels[x, y] = 255
    return mask.filter(ImageFilter.GaussianBlur(radius=1.4))


def second_frame(source: Image.Image, mask: Image.Image, arena: dict) -> Image.Image:
    shifted = ImageChops.offset(source, arena["offset"][0], arena["offset"][1])
    if arena["effect"] == "LAVA":
        shifted = ImageEnhance.Color(shifted).enhance(1.12)
        shifted = ImageEnhance.Brightness(shifted).enhance(1.08)
    else:
        shifted = ImageEnhance.Color(shifted).enhance(1.06)
        shifted = ImageEnhance.Brightness(shifted).enhance(1.035)
        highlights = Image.new("RGBA", EXPECTED_SIZE, (0, 0, 0, 0))
        draw = ImageDraw.Draw(highlights)
        for y in range(300, 920, 52):
            phase = (y // 52) % 2 * 28
            for x in range(-60 + phase, EXPECTED_SIZE[0], 140):
                draw.arc((x, y, x + 82, y + 18), 190, 350, fill=(210, 255, 252, 42), width=2)
        shifted = Image.alpha_composite(shifted.convert("RGBA"), highlights).convert("RGB")
    result = source.copy()
    result.paste(shifted, (0, 0), mask)
    return result


def terrain_overlay(source: Image.Image, mask: Image.Image) -> Image.Image:
    overlay = source.convert("RGBA")
    alpha = ImageChops.invert(mask)
    overlay.putalpha(alpha)
    return overlay


def composite(frame: Image.Image, terrain: Image.Image, shared: Image.Image) -> Image.Image:
    return Image.alpha_composite(
        Image.alpha_composite(frame.convert("RGBA"), terrain), shared
    ).convert("RGB")


def viewport_review(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    canvas = Image.new("RGB", size, "#191F25")
    rendered_height = round(width * image.height / image.width)
    arena = image.resize((width, rendered_height), Image.Resampling.LANCZOS)
    y = round((height - rendered_height) * 0.42)
    canvas.paste(arena, (0, y))
    return canvas


def browser_qa_passed() -> bool:
    if not BROWSER_QA.is_file():
        return False
    report = json.loads(BROWSER_QA.read_text(encoding="utf-8"))
    expected = {
        (arena["fieldId"], frame, width, height)
        for arena in ARENAS for frame in (0, 1) for width, height in VIEWPORTS
    }
    observed = {
        (
            item.get("fieldId"), item.get("frameIndex"),
            item.get("viewport", {}).get("width"), item.get("viewport", {}).get("height"),
        )
        for item in report.get("results", []) if not item.get("problems")
    }
    return (
        report.get("assetId") == "art:battle:bm03-bm04-animated-r1:original-review"
        and str(report.get("status", "")).startswith("PASS_INTERNAL_REVIEW")
        and observed == expected
    )


def main() -> None:
    if not TRACE.is_file():
        raise SystemExit(f"Missing trace metadata: {TRACE}")
    if not CANONICAL_SHARED.is_file():
        raise SystemExit(f"Missing canonical BM00 shared layer: {CANONICAL_SHARED}")
    trace = json.loads(TRACE.read_text(encoding="utf-8"))
    if trace.get("result") != "PLACEMENT_TIMING_AND_COMPOSITION_CLOSED_FOR_ORIGINAL_CREATED_REPLACEMENT":
        raise SystemExit("BM03/BM04 trace has not closed the animation evidence gap")
    trace_by_field = {item["fieldId"]: item for item in trace["fields"]}
    shared = load_image(CANONICAL_SHARED, "RGBA")
    REVIEW.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    qa_passed = browser_qa_passed()
    receipts = []

    for arena in ARENAS:
        field_id = arena["fieldId"]
        dashed = field_id.replace("_", "-")
        source_path = SOURCE / f"{dashed}-background-generated.png"
        source = load_image(source_path, "RGB")
        mask = effect_mask(source, arena["effect"])
        selected_pixels = sum(index * count for index, count in enumerate(mask.histogram())) / 255
        coverage = selected_pixels / (EXPECTED_SIZE[0] * EXPECTED_SIZE[1])
        if not 0.04 < coverage < 0.50:
            raise SystemExit(f"{field_id} effect mask coverage is implausible: {coverage:.4f}")
        terrain = terrain_overlay(source, mask)
        frames = [source, second_frame(source, mask, arena)]
        trace_field = trace_by_field[field_id]
        if trace_field["frameCount"] != len(frames):
            raise SystemExit(f"{field_id} generated frame count differs from verified trace")

        review_dir = REVIEW / arena["key"]
        review_dir.mkdir(parents=True, exist_ok=True)
        runtime_terrain = RUNTIME / f"{dashed}-terrain-overlay.png"
        mask_file = review_dir / f"{dashed}-{arena['effect'].lower()}-mask.png"
        terrain_review = review_dir / f"{dashed}-terrain-overlay.png"
        mask.save(mask_file, optimize=True)
        terrain.save(terrain_review, optimize=True)
        terrain.save(runtime_terrain, optimize=True)

        frame_records = []
        composite_records = []
        viewport_checks = []
        for frame_index, frame in enumerate(frames):
            runtime_frame = RUNTIME / f"{dashed}-animation-frame-{frame_index:02d}.png"
            review_frame = review_dir / f"{dashed}-animation-frame-{frame_index:02d}.png"
            composite_file = review_dir / f"{dashed}-composite-frame-{frame_index:02d}.png"
            frame.save(runtime_frame, optimize=True)
            frame.save(review_frame, optimize=True)
            final = composite(frame, terrain, shared)
            final.save(composite_file, optimize=True)
            frame_records.append({
                "src": runtime_frame.relative_to(ROOT).as_posix(),
                "sha256": sha256(runtime_frame),
                "durationRawTicks": trace_field["frameDurationsRawTicks"][frame_index],
                "durationMs": trace_field["frameDurationsMs"][frame_index],
            })
            composite_records.append({
                "frameIndex": frame_index,
                "file": composite_file.relative_to(WORKSPACE).as_posix(),
                "sha256": sha256(composite_file),
            })
            for width, height in VIEWPORTS:
                output = review_dir / f"frame-{frame_index:02d}-viewport-{width}x{height}.png"
                viewport_review(final, (width, height)).save(output, optimize=True)
                viewport_checks.append({
                    "frameIndex": frame_index,
                    "viewport": [width, height],
                    "file": output.relative_to(WORKSPACE).as_posix(),
                    "sha256": sha256(output),
                })

        production_id = f"production:battle:arena:{dashed}"
        animation_id = f"production:battle:animation:{dashed}"
        runtime_manifest = {
            "schemaVersion": 1,
            "assetId": f"art:battle:{arena['key']}-animated-r1:original-review",
            "family": "BATTLE",
            "artifactMaturity": "INTERNAL_ANIMATED_LAYERED_RUNTIME_REVIEW",
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
                "animation": {
                    "frameCount": 2,
                    "timingEvidence": trace_field["timingEvidence"],
                    "placementEvidence": trace_field["placementEvidence"],
                    "compositionOrder": trace_field["compositionOrder"],
                    "compositionEvidence": trace_field["compositionEvidence"],
                    "updateDriver": "CALLER_OWNED_APPLICATION_TICKER",
                    "semanticClaim": trace_field["semanticClaim"],
                },
                "layers": [
                    {
                        "assetId": animation_id,
                        "role": "ANIMATED_TERRAIN_BED",
                        "zIndex": 0,
                        "frames": frame_records,
                        "alpha": False,
                    },
                    {
                        "assetId": production_id,
                        "role": "ARENA_TERRAIN",
                        "zIndex": 10,
                        "src": runtime_terrain.relative_to(ROOT).as_posix(),
                        "sha256": sha256(runtime_terrain),
                        "alpha": True,
                    },
                    {
                        "assetId": "production:battle:shared:field-bm00-00",
                        "role": "CANONICAL_SHARED_LAYER",
                        "zIndex": 20,
                        "src": CANONICAL_SHARED.relative_to(ROOT).as_posix(),
                        "sha256": sha256(CANONICAL_SHARED),
                        "alpha": True,
                    },
                ],
            },
            "promotionGate": "OWNER_VISUAL_APPROVAL_LICENSE_TERMS_LINK_AND_FINAL_OBJECT_SEPARATION_REQUIRED",
        }
        runtime_manifest_path = RUNTIME / f"runtime.{arena['key']}.review.json"
        runtime_manifest_path.write_text(json.dumps(runtime_manifest, indent=2) + "\n", encoding="utf-8")
        receipts.append({
            "key": arena["key"],
            "fieldId": field_id,
            "originalFunction": arena["function"],
            "source": {"file": source_path.relative_to(WORKSPACE).as_posix(), "sha256": sha256(source_path)},
            "runtimeManifest": runtime_manifest_path.relative_to(ROOT).as_posix(),
            "animationFrames": frame_records,
            "terrainOverlay": {"file": runtime_terrain.relative_to(ROOT).as_posix(), "sha256": sha256(runtime_terrain)},
            "mask": {"file": mask_file.relative_to(WORKSPACE).as_posix(), "sha256": sha256(mask_file), "coverage": coverage},
            "compositeFrames": composite_records,
            "viewportChecks": viewport_checks,
            "trace": {
                "traceId": trace["traceId"],
                "sourceEvidence": trace_field["sourceEvidence"],
                "frameDurationsRawTicks": trace_field["frameDurationsRawTicks"],
                "compositionEvidence": trace_field["compositionEvidence"],
            },
            "referenceObjectLayerPresent": arena["objectLayer"],
            "flattenedInternalReviewOnly": True,
            "productionObjectSeparationRequired": arena["objectLayer"],
        })

    status = (
        "INTERNAL_PIXI_ANIMATION_REVIEW_PASSED_NOT_OWNER_APPROVED_NOT_PROMOTED"
        if qa_passed else "INTERNAL_PIXI_ANIMATION_REVIEW_CANDIDATE_NOT_OWNER_APPROVED_NOT_PROMOTED"
    )
    manifest = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-BM03-BM04-ANIMATED-R1-2026-09-02",
        "status": status,
        "artDirectionBrief": "ART_DIRECTION.md",
        "promptRecord": "PROMPTS.md",
        "buildScript": "scripts/build-battle-bm03-bm04-animated.py",
        "trace": TRACE.relative_to(ROOT).as_posix(),
        "rights": {
            "sourceKind": "ORIGINAL_AI_ASSISTED_GENERATION_WITH_DETERMINISTIC_LAYER_SEPARATION",
            "generator": "OpenAI image generation through Codex imagegen skill",
            "createdAt": "2026-09-02",
            "referencePixelReuse": False,
            "referencePaletteReuse": False,
            "referenceGeometryReuse": False,
            "licenseEvidenceStatus": "GENERATION_RECEIPT_RECORDED_TERMS_LINK_PENDING",
        },
        "reviewPolicy": {
            "technicalChecksPassed": True,
            "runtimeQaPassed": qa_passed,
            "runtimeQaReceipt": "docs/reports/art/battle/bm03-bm04-animated-r1/browser-qa.json",
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
        "dimensions": list(EXPECTED_SIZE),
        "canonicalSharedLayer": {
            "assetId": "production:battle:shared:field-bm00-00",
            "file": CANONICAL_SHARED.relative_to(ROOT).as_posix(),
            "sha256": sha256(CANONICAL_SHARED),
            "copiedIntoBundle": False,
        },
        "arenas": receipts,
        "promotion": {
            "humanApproved": False,
            "runtimeQaPassed": qa_passed,
            "licenseEvidenceLinked": False,
            "readyForRuntime": False,
            "shippingReady": False,
        },
    }
    (WORKSPACE / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(ARENAS)} animated Battle review candidates at {WORKSPACE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
