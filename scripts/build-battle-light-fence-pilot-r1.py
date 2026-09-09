#!/usr/bin/env python3
"""Build the BM08/BM10 lightweight-fence Battle art pilot.

The image model owns only the opaque environment plates. This deterministic
builder owns the 2026 presentation geometry: six standing-slot markers, a low
metal sports fence, per-field light adaptation, and contact shadows. The batch
is internal review evidence only and never writes to a runtime path.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "light-fence-pilot-r1"
GENERATED = WORKSPACE / "generated"
REVIEW = WORKSPACE / "review"
SIZE = (1536, 1024)
SLOTS = [
    (351, 365, 574, 424),
    (961, 365, 1184, 424),
    (291, 450, 555, 535),
    (980, 450, 1255, 535),
    (291, 568, 559, 683),
    (975, 568, 1289, 683),
]
FIELDS = {
    "08": {
        "function": "BATTLE_HELL",
        "ambient": (176, 52, 24),
        "rail": (255, 171, 47),
        "post": (142, 119, 89),
        "object": ROOT / "assets" / "production" / "internal-battle-review" / "hardening-r2" / "field-bm08-01-objects.png",
        "sourceFloorY": 372,
        "slotCorrection": 0.75,
        "markerAlpha": 60,
        "markerFill": (34, 20, 18),
    },
    "10": {
        "function": "BATTLE_STADIUM",
        "ambient": (36, 134, 149),
        "rail": (205, 226, 66),
        "post": (190, 207, 196),
        "object": None,
        "sourceFloorY": 474,
        "slotCorrection": 0.0,
        "markerAlpha": 82,
        "markerFill": None,
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load(path: Path, mode: str) -> Image.Image:
    if not path.is_file():
        raise SystemExit(f"Missing pilot input: {path}")
    image = Image.open(path).convert(mode)
    if image.size != SIZE:
        raise SystemExit(f"{path}: expected {SIZE}, got {image.size}")
    return image


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def mix(a: tuple[int, int, int], b: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(round(x * (1 - amount) + y * amount) for x, y in zip(a, b))


def draw_segment(draw: ImageDraw.ImageDraw, points, color, width: int) -> None:
    # Dark base, flat midtone, and one broken highlight: three value steps only.
    dark = tuple(max(0, c - 62) for c in color) + (255,)
    mid = color + (255,)
    high = tuple(min(255, c + 42) for c in color) + (255,)
    draw.line(points, fill=dark, width=width + 8, joint="curve")
    draw.line(points, fill=mid, width=width, joint="curve")
    if len(points) == 2:
        (x0, y0), (x1, y1) = points
        draw.line(((x0 + (x1-x0)*0.08, y0 + (y1-y0)*0.08 - 2),
                   (x0 + (x1-x0)*0.42, y0 + (y1-y0)*0.42 - 2)), fill=high, width=max(2, width // 5))


def build_layer(post: tuple[int, int, int], rail: tuple[int, int, int], marker_alpha: int = 2,
                marker_fill: tuple[int, int, int] | None = None) -> Image.Image:
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    # Low, discontinuous sports-fence boundary. It frames the pitch without
    # becoming a stone arena or blocking the playable centre.
    back_left = [(116, 351), (315, 319), (556, 304), (704, 301)]
    back_right = [(832, 301), (980, 304), (1221, 319), (1420, 351)]
    side_left = [(116, 351), (75, 438), (62, 548), (82, 662), (145, 757)]
    side_right = [(1420, 351), (1461, 438), (1474, 548), (1454, 662), (1391, 757)]
    for points in (back_left, back_right, side_left, side_right):
        draw_segment(draw, points, rail, 8)

    posts = [(116, 351, 28, 84), (315, 319, 22, 68), (556, 304, 18, 58),
             (980, 304, 18, 58), (1221, 319, 22, 68), (1420, 351, 28, 84),
             (75, 438, 25, 82), (62, 548, 28, 92), (82, 662, 31, 102),
             (1461, 438, 25, 82), (1474, 548, 28, 92), (1454, 662, 31, 102)]
    dark = tuple(max(0, c - 58) for c in post)
    high = tuple(min(255, c + 40) for c in post)
    for x, y, width, height in posts:
        draw.polygon([(x-width//2, y+8), (x-width//3, y-height),
                      (x+width//3, y-height-5), (x+width//2, y+8)], fill=dark + (255,))
        draw.polygon([(x-width//3+5, y+2), (x-width//5+4, y-height+4),
                      (x+width//4, y-height), (x+width//3-3, y+2)], fill=post + (255,))
        draw.line((x-width//5+5, y-height+8, x+width//5, y-height+4), fill=high + (255,), width=3)

    # Six quiet 2026 presentation markers. Their coordinates are not claimed
    # as ROM-authored; they stay deterministic and separate from generated art.
    marker = mix(rail, post, 0.32)
    marker_dark = marker_fill or tuple(max(0, c - 42) for c in post)
    for box in SLOTS:
        draw.ellipse(box, fill=marker_dark + (marker_alpha,), outline=tuple(max(0, c-18) for c in marker) + (255,), width=3)

    return layer


def contact_shadow(layer: Image.Image) -> Image.Image:
    alpha = layer.getchannel("A").point(lambda value: 255 if value > 100 else 0)
    # Standing marks are painted floor guides, not raised structures.
    alpha_array = np.asarray(alpha).copy()
    alpha_array[350:710, 240:1310] = 0
    alpha = Image.fromarray(alpha_array, "L")
    # Shadows fall just below/right of fence and markers. A blurred footprint
    # produces contact occlusion while the visible metal stays crisp.
    shifted = Image.new("L", SIZE, 0)
    shifted.paste(alpha, (0, 8))
    blurred = shifted.filter(ImageFilter.GaussianBlur(9))
    values = np.asarray(blurred, dtype=np.float32)
    values = np.clip(values * 0.86, 0, 176).astype(np.uint8)
    return Image.fromarray(values, "L")


def apply_shadow(background: Image.Image, shadow: Image.Image) -> Image.Image:
    rgb = np.asarray(background, dtype=np.float32)
    factor = 1.0 - np.asarray(shadow, dtype=np.float32)[..., None] / 255.0 * 0.72
    return Image.fromarray(np.clip(rgb * factor, 0, 255).astype(np.uint8), "RGB")


def enforce_floor_boundary(background: Image.Image, source_floor_y: int) -> Image.Image:
    """Move the generated plate's floor boundary to the contract's y=301.

    The model sometimes leaves seating or rocks below the required boundary.
    A two-band perspective remap fixes the whole composition, rather than
    painting six conspicuous corrections underneath individual slots.
    """
    top = background.crop((0, 0, SIZE[0], source_floor_y)).resize((SIZE[0], 301), Image.Resampling.LANCZOS)
    floor = background.crop((0, source_floor_y, SIZE[0], SIZE[1])).resize((SIZE[0], SIZE[1]-301), Image.Resampling.LANCZOS)
    corrected = Image.new("RGB", SIZE)
    corrected.paste(top, (0, 0))
    corrected.paste(floor, (0, 301))
    return corrected


def stabilize_slot_material(background: Image.Image, amount: float) -> Image.Image:
    if amount <= 0:
        return background
    source = np.asarray(background, dtype=np.float32)
    reference = source[594:697, 691:906].mean(axis=(0, 1))
    mask = Image.new("L", SIZE, 0)
    draw = ImageDraw.Draw(mask)
    for box in SLOTS:
        draw.rounded_rectangle(box, radius=28, fill=round(255 * amount))
    blend = np.asarray(mask.filter(ImageFilter.GaussianBlur(14)), dtype=np.float32)[..., None] / 255.0
    target = source * 0.35 + reference * 0.65
    return Image.fromarray(np.clip(source * (1-blend) + target * blend, 0, 255).astype(np.uint8), "RGB")


def layout_preview(image: Image.Image, field_id: str) -> Path:
    canvas = Image.new("RGB", (360, 640), "#15303B")
    draw = ImageDraw.Draw(canvas)
    bands = [(0, 32, "#1D5963", "CLOCK"), (32, 96, "#34717B", "OPPONENT HUD"),
             (336, 515, "#2E6570", "PLAYER HUD"), (515, 640, "#214C58", "EVENT LOG")]
    for top, bottom, color, label in bands:
        draw.rectangle((0, top, 359, bottom-1), fill=color)
        draw.text((10, top+8), label, fill="#E6F3D4")
    canvas.paste(image.resize((360, 240), Image.Resampling.LANCZOS), (0, 96))
    output = REVIEW / "layout" / f"{field_id.replace('_', '-')}-battle-layout-360x640.png"
    save(canvas, output)
    return output


def main() -> None:
    neutral = build_layer((182, 194, 184), (196, 212, 70))
    neutral_path = REVIEW / "layers" / "field-bm00-00-light-metal-fence-neutral.png"
    save(neutral, neutral_path)
    records = []
    contact = Image.new("RGB", (1536, 1024 * len(FIELDS)), "#10181C")

    for row, (key, config) in enumerate(FIELDS.items()):
        field_id = f"field_bm{key}_01"
        input_path = GENERATED / f"{field_id.replace('_', '-')}-background-light-fence-pilot.png"
        background = enforce_floor_boundary(load(input_path, "RGB"), config["sourceFloorY"])
        background = stabilize_slot_material(background, config["slotCorrection"])
        background_path = REVIEW / key / input_path.name
        save(background, background_path)

        adapted = build_layer(config["post"], config["rail"], marker_alpha=config["markerAlpha"], marker_fill=config["markerFill"])
        adapted_path = REVIEW / "layers" / f"field-bm00-00-light-metal-fence-bm{key}.png"
        save(adapted, adapted_path)
        shadow = contact_shadow(adapted)
        shadow_path = REVIEW / "layers" / f"field-bm00-00-contact-shadow-bm{key}.png"
        save(shadow, shadow_path)

        composite = apply_shadow(background, shadow).convert("RGBA")
        objects = []
        if config["object"]:
            object_layer = load(config["object"], "RGBA")
            composite = Image.alpha_composite(composite, object_layer)
            objects.append({"file": config["object"].relative_to(ROOT).as_posix(), "sha256": sha256(config["object"])})
        composite = Image.alpha_composite(composite, adapted).convert("RGB")
        composite_path = REVIEW / key / f"{field_id.replace('_', '-')}-composite.png"
        save(composite, composite_path)
        preview = layout_preview(composite, field_id)
        contact.paste(composite, (0, row * 1024))

        records.append({
            "assetId": f"art:battle:light-fence-pilot-r1:{field_id.replace('_', '-')}",
            "fieldId": field_id,
            "function": config["function"],
            "background": {"file": background_path.relative_to(ROOT).as_posix(), "sha256": sha256(background_path), "mode": "RGB"},
            "sharedLayer": adapted_path.relative_to(ROOT).as_posix(),
            "adaptedFence": {"file": adapted_path.relative_to(ROOT).as_posix(), "sha256": sha256(adapted_path)},
            "contactShadow": {"file": shadow_path.relative_to(ROOT).as_posix(), "sha256": sha256(shadow_path)},
            "objectLayers": objects,
            "composites": [{"frameIndex": 0, "file": composite_path.relative_to(ROOT).as_posix(), "sha256": sha256(composite_path), "durationRawTicks": None}],
            "layoutPreview": {"file": preview.relative_to(ROOT).as_posix(), "sha256": sha256(preview)},
            "geometryAuthority": "PRODUCT_AUTHORED_2026_SLOT_CONTRACT_AND_DETERMINISTIC_LIGHT_FENCE",
        })

    contact_path = REVIEW / "light-fence-pilot-r1-contact-sheet.png"
    save(contact, contact_path)
    manifest = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-LIGHT-FENCE-PILOT-R1-2026-09-02",
        "family": "BATTLE",
        "status": "OWNER_DIRECTION_IMPLEMENTED_INTERNAL_REVIEW",
        "ownerDecision": "CANCEL_HEAVY_STONE_RING_USE_LIGHT_METAL_FENCE",
        "assetHumanApproved": False,
        "rightsStatus": "ORIGINAL_CREATED_AI_ASSISTED_TERMS_LINK_PENDING",
        "referencePixelsInOutputs": False,
        "runtimeMutation": False,
        "replacementPerformed": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "sharedLayer": {"assetId": "art:battle:light-fence-pilot-r1:neutral-fence", "file": neutral_path.relative_to(ROOT).as_posix(), "sha256": sha256(neutral_path)},
        "assets": records,
        "geometryConstraint": {
            "file": "docs/art/BATTLE_FIELD_GEOMETRY_CONSTRAINT.json",
            "floorTopY": 301,
            "slotBoxes": [list(box) for box in SLOTS],
            "claim": "PRODUCT_AUTHORED_2026_PRESENTATION_CONTRACT_NOT_ROM_VERIFIED_SLOT_GEOMETRY",
        },
        "contactSheet": {"file": contact_path.relative_to(ROOT).as_posix(), "sha256": sha256(contact_path)},
        "promotionGate": "OWNER_VISUAL_REVIEW_THEN_FULL_FAMILY_REBUILD_AND_RUNTIME_LICENSE_GATE",
    }
    receipt = {
        "schemaVersion": 1,
        "batchId": manifest["batchId"],
        "tool": "BUILT_IN_IMAGEGEN_ENVIRONMENT_PLATES_PLUS_DETERMINISTIC_PIL_GEOMETRY",
        "generatedBackgroundCount": 2,
        "deterministicFenceVariants": 2,
        "sourcePolicy": "NO_ROM_PIXELS_IN_OUTPUTS",
        "compositionOrder": ["background", "contact_shadow", "verified_object_layer_when_present", "adapted_light_metal_fence"],
        "imageModelOwns": ["OPAQUE_ENVIRONMENT_PIXELS"],
        "imageModelDoesNotOwn": ["SLOT_GEOMETRY", "FENCE_GEOMETRY", "CONTACT_SHADOW", "OBJECT_LAYER_GEOMETRY"],
        "outputs": records,
    }
    for name, payload in (("manifest.json", manifest), ("receipt.json", receipt)):
        path = WORKSPACE / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
