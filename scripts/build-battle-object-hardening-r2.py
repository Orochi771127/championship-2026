#!/usr/bin/env python3
"""Build original-created field-object layers for BM04, BM08 and BM11.

Placement envelopes come from the metadata-only Battle object trace. Source
pixels are original-created production inputs. No research-only image is read.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "hardening-r2"
SOURCE = WORKSPACE / "source"
REVIEW = WORKSPACE / "review"
RUNTIME = ROOT / "assets" / "production" / "internal-battle-review" / "hardening-r2"
TRACE = ROOT / "docs" / "research" / "BATTLE_BM04_BM08_BM11_OBJECT_TRACE_2026-09-02.json"
BROWSER_QA = ROOT / "docs" / "reports" / "art" / "battle" / "hardening-r2" / "browser-qa.json"
SHARED = ROOT / "assets" / "production" / "internal-battle-review" / "bm00-bm01-r1" / "field-bm00-00-shared-layer.png"
ANIMATED_R1 = ROOT / "assets" / "production" / "internal-battle-review" / "bm03-bm04-animated-r1"
STATIC_R1 = ROOT / "assets" / "production" / "internal-battle-review" / "bm05-bm11-static-r1"
SIZE = (1536, 1024)
NATIVE = (416, 272)
VIEWPORTS = [(360, 800), (390, 844), (393, 852), (412, 915), (430, 932)]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def image(path: Path, mode: str = "RGBA", expected: tuple[int, int] | None = None) -> Image.Image:
    if not path.is_file():
        raise SystemExit(f"Missing production input: {path}")
    result = Image.open(path).convert(mode)
    if expected and result.size != expected:
        raise SystemExit(f"{path}: expected {expected}, got {result.size}")
    return result


def alpha_crop(source: Image.Image) -> Image.Image:
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value >= 8 else 0).getbbox()
    if not bounds:
        raise SystemExit("Generated source has no visible alpha content")
    return rgba.crop(bounds)


def tint(source: Image.Image, rgb: tuple[int, int, int], strength: float) -> Image.Image:
    overlay = Image.new("RGBA", source.size, (*rgb, 255))
    blended = Image.blend(source.convert("RGBA"), overlay, strength)
    blended.putalpha(source.getchannel("A"))
    return blended


def place_in_evidence_bounds(
    layer: Image.Image,
    source: Image.Image,
    placement: dict,
    frame: dict,
    *,
    stretch: bool = False,
) -> dict:
    bounds = frame["bounds"]
    scale_x, scale_y = SIZE[0] / NATIVE[0], SIZE[1] / NATIVE[1]
    left = round((placement["sourceX"] + bounds["minX"]) * scale_x)
    top = round((placement["sourceY"] + bounds["minY"]) * scale_y)
    width = max(1, round((bounds["maxXExclusive"] - bounds["minX"]) * scale_x))
    height = max(1, round((bounds["maxYExclusive"] - bounds["minY"]) * scale_y))
    cropped = alpha_crop(source)
    if placement["horizontalFlip"]:
        cropped = cropped.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if placement["verticalFlip"]:
        cropped = cropped.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    if stretch:
        prop = cropped.resize((width, height), Image.Resampling.LANCZOS)
        paste_x, paste_y = left, top
    else:
        fit_scale = min(width / cropped.width, height / cropped.height)
        fitted = (max(1, round(cropped.width * fit_scale)), max(1, round(cropped.height * fit_scale)))
        prop = cropped.resize(fitted, Image.Resampling.LANCZOS)
        paste_x = left + (width - prop.width) // 2
        paste_y = top + height - prop.height
    layer.alpha_composite(prop, (paste_x, paste_y))
    return {
        "ordinal": placement["ordinal"],
        "sequenceId": placement["sequenceId"],
        "cellId": frame["cellId"],
        "sourceAnchor": [placement["sourceX"], placement["sourceY"]],
        "nativeBounds": bounds,
        "productionEnvelope": [left, top, width, height],
        "productionPaste": [paste_x, paste_y, prop.width, prop.height],
    }


def viewport(composite: Image.Image, target: tuple[int, int]) -> Image.Image:
    width, height = target
    canvas = Image.new("RGB", target, "#191F25")
    rendered_height = round(width * SIZE[1] / SIZE[0])
    rendered = composite.convert("RGB").resize((width, rendered_height), Image.Resampling.LANCZOS)
    y = round((height - rendered_height) * 0.42)
    canvas.paste(rendered, (0, y))
    return canvas


def layer_record(asset_id: str, role: str, z: int, path: Path, alpha: bool) -> dict:
    return {
        "assetId": asset_id,
        "role": role,
        "zIndex": z,
        "src": path.relative_to(ROOT).as_posix(),
        "sha256": sha256(path),
        "alpha": alpha,
    }


def frame_layer(asset_id: str, role: str, z: int, paths: list[Path], raw_ticks: list[int]) -> dict:
    clock_hz = 59.8260982880808
    return {
        "assetId": asset_id,
        "role": role,
        "zIndex": z,
        "frames": [
            {
                "src": path.relative_to(ROOT).as_posix(),
                "sha256": sha256(path),
                "durationRawTicks": ticks,
                "durationMs": ticks * 1000 / clock_hz,
            }
            for path, ticks in zip(paths, raw_ticks, strict=True)
        ],
        "alpha": role != "ANIMATED_TERRAIN_BED",
    }


def browser_qa_passed() -> bool:
    if not BROWSER_QA.is_file():
        return False
    report = json.loads(BROWSER_QA.read_text(encoding="utf-8"))
    return (
        report.get("assetId") == "art:battle:object-hardening-r2:original-review"
        and str(report.get("status", "")).startswith("PASS_INTERNAL_REVIEW")
        and len(report.get("results", [])) == 25
        and len(report.get("galleryResults", [])) == 11
        and all(not item.get("problems") for item in [*report.get("results", []), *report.get("galleryResults", [])])
    )


def runtime_manifest(key: str, field_id: str, layers: list[dict], animation: dict | None, qa_passed: bool) -> dict:
    arena_id = f"production:battle:arena:{field_id.replace('_', '-')}"
    arena = {
        "fieldId": field_id,
        "assetId": arena_id,
        "dependencies": ["production:battle:shared:field-bm00-00"],
        "gameplayBinding": "EXTERNAL_NOT_MOUNTED",
        "collisionBinding": "NONE_ART_REVIEW_ONLY",
        "uiBinding": "NONE_ART_REVIEW_ONLY",
        "layers": layers,
    }
    if animation:
        arena["animation"] = animation
    return {
        "schemaVersion": 1,
        "assetId": f"art:battle:{key}-hardening-r2:original-review",
        "family": "BATTLE",
        "artifactMaturity": "INTERNAL_FIELD_OBJECT_LAYER_RUNTIME_REVIEW",
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
        "sourceDimensions": list(SIZE),
        "viewportPolicy": {
            "fit": "CONTAIN",
            "verticalAnchor": 0.42,
            "contractViewports": [list(item) for item in VIEWPORTS],
        },
        "arena": arena,
        "promotionGate": "OWNER_VISUAL_APPROVAL_LICENSE_TERMS_LINK_AND_FINAL_ALIGNMENT_REVIEW_REQUIRED",
    }


def main() -> None:
    trace = json.loads(TRACE.read_text(encoding="utf-8"))
    if trace.get("result") != "OBJECT_PLACEMENT_AND_FRAME_STRUCTURE_CLOSED_FOR_ORIGINAL_CREATED_REPLACEMENT":
        raise SystemExit("Object trace is not closed")
    evidence = {field["fieldId"]: field for field in trace["fields"]}
    shared = image(SHARED, expected=SIZE)
    palm = image(SOURCE / "field-bm04-01-palm-generated.png")
    pylon = image(SOURCE / "field-bm04-01-pylon-generated.png")
    dead_tree = image(SOURCE / "field-bm08-01-dead-tree-generated.png")
    light = image(SOURCE / "field-bm11-01-light-ribbon-generated.png")
    REVIEW.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    qa_passed = browser_qa_passed()
    receipts = []

    # BM04: seven static objects above the already-separated animated water/terrain.
    bm04_layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    bm04_placements = []
    pylon_variants = [pylon, tint(pylon, (255, 188, 94), 0.17), tint(pylon, (94, 236, 222), 0.16)]
    for placement in evidence["field_bm04_01"]["placements"]:
        frame = placement["frames"][0]
        prop = palm if frame["cellId"] == 0 else pylon_variants[min(2, frame["cellId"] - 1)]
        bm04_placements.append(place_in_evidence_bounds(bm04_layer, prop, placement, frame))
    bm04_object = RUNTIME / "field-bm04-01-objects.png"
    bm04_layer.save(bm04_object, optimize=True)
    bm04_frames = [ANIMATED_R1 / f"field-bm04-01-animation-frame-{index:02d}.png" for index in (0, 1)]
    bm04_terrain = ANIMATED_R1 / "field-bm04-01-terrain-overlay.png"
    bm04_layers = [
        frame_layer("production:battle:animation:field-bm04-01", "ANIMATED_TERRAIN_BED", 0, bm04_frames, [20, 20]),
        layer_record("production:battle:arena:field-bm04-01", "ARENA_TERRAIN", 10, bm04_terrain, True),
        layer_record("production:battle:objects:field-bm04-01", "FIELD_OBJECTS", 20, bm04_object, True),
        layer_record("production:battle:shared:field-bm00-00", "CANONICAL_SHARED_LAYER", 30, SHARED, True),
    ]
    bm04_animation = {
        "frameCount": 2,
        "timingEvidence": "VERIFIED_BINARY_PLUS_PLATFORM_VIDEO_CLOCK_ARM9_0x0204ED5C",
        "placementEvidence": "VERIFIED_OPMD_TO_NANR_TO_NCER_METADATA",
        "compositionOrder": "ANIMATED_TERRAIN_BED_THEN_STATIC_TERRAIN_THEN_FIELD_OBJECTS_THEN_BM00_COMMON",
        "compositionEvidence": "HIGH_CONFIDENCE_CROSSCHECK_SHARED_RENDERER_AND_SOURCE_COORDINATES",
        "updateDriver": "CALLER_OWNED_APPLICATION_TICKER",
        "semanticClaim": "FIELD_PRESENTATION_ONLY_NO_GAMEPLAY_MEANING",
    }

    # BM08: one static foreground tree.
    bm08_layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    bm08_p = evidence["field_bm08_01"]["placements"][0]
    bm08_placements = [place_in_evidence_bounds(bm08_layer, dead_tree, bm08_p, bm08_p["frames"][0])]
    bm08_object = RUNTIME / "field-bm08-01-objects.png"
    bm08_layer.save(bm08_object, optimize=True)
    bm08_background = STATIC_R1 / "field-bm08-01-background.png"
    bm08_layers = [
        layer_record("production:battle:arena:field-bm08-01", "ARENA_BACKGROUND", 0, bm08_background, False),
        layer_record("production:battle:objects:field-bm08-01", "FIELD_OBJECTS", 10, bm08_object, True),
        layer_record("production:battle:shared:field-bm00-00", "CANONICAL_SHARED_LAYER", 20, SHARED, True),
    ]

    # BM11: the single light ribbon has two source frames; derive the second
    # original-created state deterministically to avoid cross-frame model drift.
    bm11_p = evidence["field_bm11_01"]["placements"][0]
    bm11_objects = []
    bm11_placements = []
    variants = [light, ImageEnhance.Brightness(ImageEnhance.Color(light).enhance(1.12)).enhance(1.08)]
    for frame_index, (frame, variant) in enumerate(zip(bm11_p["frames"], variants, strict=True)):
        layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
        bm11_placements.append(place_in_evidence_bounds(layer, variant, bm11_p, frame, stretch=True))
        output = RUNTIME / f"field-bm11-01-objects-frame-{frame_index:02d}.png"
        layer.save(output, optimize=True)
        bm11_objects.append(output)
    bm11_background = STATIC_R1 / "field-bm11-01-background.png"
    bm11_layers = [
        layer_record("production:battle:arena:field-bm11-01", "ARENA_BACKGROUND", 0, bm11_background, False),
        frame_layer("production:battle:objects:field-bm11-01", "FIELD_OBJECTS", 10, bm11_objects, [6, 6]),
        layer_record("production:battle:shared:field-bm00-00", "CANONICAL_SHARED_LAYER", 20, SHARED, True),
    ]
    bm11_animation = {
        "frameCount": 2,
        "timingEvidence": "RAW_NANR_TICKS_PLUS_HIGH_CONFIDENCE_PLATFORM_FRAME_CLOCK_CROSSCHECK",
        "placementEvidence": "VERIFIED_OPMD_TO_NANR_TO_NCER_METADATA",
        "compositionOrder": "ARENA_BACKGROUND_THEN_ANIMATED_FIELD_OBJECTS_THEN_BM00_COMMON",
        "compositionEvidence": "VERIFIED_SOURCE_SEQUENCE_AND_PLACEMENT_STRUCTURE",
        "updateDriver": "CALLER_OWNED_APPLICATION_TICKER",
        "semanticClaim": "FIELD_PRESENTATION_ONLY_NO_GAMEPLAY_MEANING",
    }

    builds = [
        ("bm04", "field_bm04_01", bm04_layers, bm04_animation, bm04_placements),
        ("bm08", "field_bm08_01", bm08_layers, None, bm08_placements),
        ("bm11", "field_bm11_01", bm11_layers, bm11_animation, bm11_placements),
    ]
    for key, field_id, layers, animation, placements in builds:
        manifest = runtime_manifest(key, field_id, layers, animation, qa_passed)
        manifest_path = RUNTIME / f"runtime.{key}.review.json"
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        review_dir = REVIEW / key
        review_dir.mkdir(parents=True, exist_ok=True)
        frame_count = animation["frameCount"] if animation else 1
        review_frames = []
        for frame_index in range(frame_count):
            composite = Image.new("RGBA", SIZE, (0, 0, 0, 0))
            for layer in layers:
                if "frames" in layer:
                    source_path = ROOT / layer["frames"][frame_index % len(layer["frames"])]["src"]
                else:
                    source_path = ROOT / layer["src"]
                composite = Image.alpha_composite(composite, image(source_path, expected=SIZE))
            composite_path = review_dir / f"{field_id.replace('_', '-')}-composite-frame-{frame_index:02d}.png"
            composite.convert("RGB").save(composite_path, optimize=True)
            review_frames.append({"frameIndex": frame_index, "file": composite_path.relative_to(WORKSPACE).as_posix(), "sha256": sha256(composite_path)})
            for target in VIEWPORTS:
                output = review_dir / f"frame-{frame_index:02d}-viewport-{target[0]}x{target[1]}.png"
                viewport(composite, target).save(output, optimize=True)
        receipts.append({
            "key": key,
            "fieldId": field_id,
            "runtimeManifest": manifest_path.relative_to(ROOT).as_posix(),
            "layerRoles": [layer["role"] for layer in layers],
            "placements": placements,
            "reviewFrames": review_frames,
        })

    receipt = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-OBJECT-HARDENING-R2-2026-09-02",
        "status": "INTERNAL_PIXI_REVIEW_PASSED_NOT_OWNER_APPROVED_NOT_PROMOTED" if qa_passed else "INTERNAL_REVIEW_CANDIDATE_NOT_OWNER_APPROVED_NOT_PROMOTED",
        "sourcePolicy": "ORIGINAL_CREATED_PIXELS_WITH_METADATA_ONLY_REFERENCE_PLACEMENT",
        "researchPixelsInRuntime": False,
        "dimensions": list(SIZE),
        "sourceInputs": [
            {"file": path.relative_to(ROOT).as_posix(), "sha256": sha256(path), "alpha": True}
            for path in sorted(SOURCE.glob("*.png"))
        ],
        "arenas": receipts,
    }
    (WORKSPACE / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE {len(receipts)} hardened Battle arena bundles")


if __name__ == "__main__":
    main()
