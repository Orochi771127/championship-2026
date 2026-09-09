#!/usr/bin/env python3
"""Build the bounded Battle human-paint migration review packet.

This builder keeps model-generated pixels out of geometry authority.  BM00
inherits the existing canonical alpha mask, BM07 standing zones are drawn from
fixed coordinates, and BM03/BM04 reuse the verified two-frame timing contract.
All outputs stay under docs/art and are not runtime or shipping assets.
"""

from __future__ import annotations

import colorsys
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "human-paint-migration-r4"
GENERATED = WORKSPACE / "generated"
REVIEW = WORKSPACE / "review"
CANONICAL_BM00 = (
    ROOT / "assets" / "production" / "internal-battle-review" / "bm00-bm01-r1"
    / "field-bm00-00-shared-layer.png"
)
BM04_OBJECTS = (
    ROOT / "assets" / "production" / "internal-battle-review" / "hardening-r2"
    / "field-bm04-01-objects.png"
)
TRACE = ROOT / "docs" / "research" / "BATTLE_BM03_BM04_ANIMATION_TRACE_2026-09-02.json"
STYLE_TARGET = (
    ROOT / "docs" / "art" / "production" / "battle" / "style-calibration-r3"
    / "candidates" / "bm06-human-paint-c-recommended.png"
)
SIZE = (1536, 1024)
RING_CENTERS = [(440, 400), (768, 400), (1096, 400), (440, 632), (768, 632), (1096, 632)]
RING_RADIUS = 96


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def bytes_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def load(path: Path, mode: str = "RGB") -> Image.Image:
    if not path.is_file():
        raise SystemExit(f"Missing migration input: {path}")
    image = Image.open(path).convert(mode)
    if image.size != SIZE:
        raise SystemExit(f"{path}: expected {SIZE}, got {image.size}")
    return image


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def canonical_bm00() -> tuple[Image.Image, dict]:
    generated_path = GENERATED / "field-bm00-00-shared-layer-human-paint.png"
    generated = load(generated_path, "RGB")
    canonical = load(CANONICAL_BM00, "RGBA")
    alpha = canonical.getchannel("A")
    result = generated.convert("RGBA")
    result.putalpha(alpha)
    output = REVIEW / "layers" / "field-bm00-00-shared-layer-human-paint.png"
    save(result, output)
    return result, {
        "assetId": "art:battle:human-paint-r4:field-bm00-00-shared-layer",
        "file": output.relative_to(ROOT).as_posix(),
        "sha256": sha256(output),
        "alphaMaskSha256": bytes_sha256(alpha.tobytes()),
        "canonicalAlphaMaskSha256": bytes_sha256(canonical.getchannel("A").tobytes()),
        "geometryAuthority": "CANONICAL_BM00_ALPHA_MASK_NOT_IMAGE_MODEL",
        "alpha": True,
    }


def add_bm07_zones(background: Image.Image) -> Image.Image:
    base = background.convert("RGBA")
    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    crisp = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    crisp_draw = ImageDraw.Draw(crisp)
    for x, y in RING_CENTERS:
        outer = (x - RING_RADIUS, y - RING_RADIUS, x + RING_RADIUS, y + RING_RADIUS)
        inner_radius = RING_RADIUS - 10
        inner = (x - inner_radius, y - inner_radius, x + inner_radius, y + inner_radius)
        glow_draw.ellipse(outer, outline=(31, 206, 235, 116), width=14)
        crisp_draw.ellipse(outer, outline=(92, 214, 231, 205), width=4)
        crisp_draw.ellipse(inner, outline=(130, 100, 210, 145), width=3)
    return Image.alpha_composite(Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(9))), crisp).convert("RGB")


def effect_mask(image: Image.Image, effect: str) -> Image.Image:
    rgb = image.convert("RGB")
    mask = Image.new("L", SIZE, 0)
    source_pixels = rgb.load()
    mask_pixels = mask.load()
    for y in range(SIZE[1]):
        for x in range(SIZE[0]):
            red, green, blue = source_pixels[x, y]
            hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
            h, s, v = hue * 255, saturation * 255, value * 255
            if effect == "LAVA":
                selected = y >= 250 and (h <= 28 or h >= 248) and s >= 145 and v >= 105
            else:
                selected = y >= 225 and 103 <= h <= 146 and s >= 55 and v >= 78
            if selected:
                mask_pixels[x, y] = 255
    return mask.filter(ImageFilter.GaussianBlur(radius=1.4))


def second_frame(source: Image.Image, mask: Image.Image, effect: str) -> Image.Image:
    offset = (7, 3) if effect == "LAVA" else (5, 0)
    shifted = ImageChops.offset(source, *offset)
    if effect == "LAVA":
        shifted = ImageEnhance.Color(shifted).enhance(1.08)
        shifted = ImageEnhance.Brightness(shifted).enhance(1.05)
    else:
        shifted = ImageEnhance.Color(shifted).enhance(1.035)
        shifted = ImageEnhance.Brightness(shifted).enhance(1.02)
    result = source.copy()
    result.paste(shifted, (0, 0), mask)
    return result


def animated_field(key: str, effect: str, shared: Image.Image, trace: dict) -> dict:
    field_id = f"field_bm{key}_01"
    source_path = GENERATED / f"{field_id.replace('_', '-')}-background-human-paint.png"
    source = load(source_path, "RGB")
    mask = effect_mask(source, effect)
    coverage = sum(index * count for index, count in enumerate(mask.histogram())) / 255 / (SIZE[0] * SIZE[1])
    if not 0.04 < coverage < 0.55:
        raise SystemExit(f"{field_id}: implausible {effect} mask coverage {coverage:.4f}")
    terrain = source.convert("RGBA")
    terrain.putalpha(ImageChops.invert(mask))
    frames = [source, second_frame(source, mask, effect)]
    trace_field = next(item for item in trace["fields"] if item["fieldId"] == field_id)
    if trace_field["frameCount"] != 2:
        raise SystemExit(f"{field_id}: verified frame count changed")
    object_layer = load(BM04_OBJECTS, "RGBA") if key == "04" else None
    frame_records = []
    composites = []
    for index, frame in enumerate(frames):
        frame_file = REVIEW / key / f"{field_id.replace('_', '-')}-animation-frame-{index:02d}.png"
        save(frame, frame_file)
        composite = Image.alpha_composite(frame.convert("RGBA"), terrain)
        if object_layer is not None:
            composite = Image.alpha_composite(composite, object_layer)
        composite = Image.alpha_composite(composite, shared).convert("RGB")
        composite_file = REVIEW / key / f"{field_id.replace('_', '-')}-composite-frame-{index:02d}.png"
        save(composite, composite_file)
        frame_records.append({
            "frameIndex": index,
            "file": frame_file.relative_to(ROOT).as_posix(),
            "sha256": sha256(frame_file),
            "durationRawTicks": trace_field["frameDurationsRawTicks"][index],
            "durationMs": trace_field["frameDurationsMs"][index],
        })
        composites.append({
            "frameIndex": index,
            "file": composite_file.relative_to(ROOT).as_posix(),
            "sha256": sha256(composite_file),
        })
    mask_file = REVIEW / key / f"{field_id.replace('_', '-')}-{effect.lower()}-mask.png"
    terrain_file = REVIEW / key / f"{field_id.replace('_', '-')}-terrain-overlay.png"
    save(mask, mask_file)
    save(terrain, terrain_file)
    return {
        "assetId": f"art:battle:human-paint-r4:{field_id.replace('_', '-')}",
        "fieldId": field_id,
        "effect": effect,
        "maskCoverage": round(coverage, 6),
        "frameCount": 2,
        "timingEvidence": trace_field["timingEvidence"],
        "placementEvidence": trace_field["placementEvidence"],
        "frames": frame_records,
        "composites": composites,
        "objectLayer": BM04_OBJECTS.relative_to(ROOT).as_posix() if object_layer else None,
        "geometryAuthority": "VERIFIED_FRAME_COUNT_TIMING_AND_COMPOSITION_PLUS_CANONICAL_BM00",
    }


def layout_preview(image: Image.Image, key: str) -> dict:
    canvas = Image.new("RGB", (360, 640), "#12212B")
    draw = ImageDraw.Draw(canvas)
    bands = [
        (0, 32, "#18313B", "CLOCK"),
        (32, 96, "#203A43", "OPPONENT HUD"),
        (336, 515, "#20343D", "PLAYER HUD"),
        (515, 640, "#182B34", "EVENT LOG"),
    ]
    for top, bottom, color, label in bands:
        draw.rectangle((0, top, 359, bottom - 1), fill=color)
        draw.text((10, top + 8), label, fill="#87A5AD")
    field = image.convert("RGB").resize((360, 240), Image.Resampling.LANCZOS)
    canvas.paste(field, (0, 96))
    for y in (32, 96, 336, 515):
        draw.line((0, y, 359, y), fill="#4C6970")
    output = REVIEW / "layout" / f"{key}-battle-layout-360x640.png"
    save(canvas, output)
    return {"fieldId": key, "file": output.relative_to(ROOT).as_posix(), "sha256": sha256(output), "size": [360, 640]}


def checkerboard(size: tuple[int, int], cell: int = 24) -> Image.Image:
    image = Image.new("RGB", size, "#CCD2CF")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#AEB7B3")
    return image


def contact_sheet(shared: Image.Image, bm07: Image.Image, bm03: Image.Image, bm04: Image.Image) -> dict:
    sheet = Image.new("RGB", SIZE, "#121A1F")
    cells = [(shared, "BM00 SHARED"), (bm07, "BM07 CYBERSPACE"), (bm03, "BM03 VOLCANO"), (bm04, "BM04 ISLAND")]
    for index, (image, label) in enumerate(cells):
        cell = checkerboard((768, 512)) if image.mode == "RGBA" else Image.new("RGB", (768, 512), "#121A1F")
        fitted = image.resize((768, 512), Image.Resampling.LANCZOS)
        if fitted.mode == "RGBA":
            cell.paste(fitted, (0, 0), fitted)
        else:
            cell.paste(fitted, (0, 0))
        draw = ImageDraw.Draw(cell)
        draw.rounded_rectangle((12, 12, 185, 42), radius=7, fill=(10, 16, 19))
        draw.text((22, 21), label, fill="#E3ECE8")
        sheet.paste(cell, ((index % 2) * 768, (index // 2) * 512))
    output = REVIEW / "human-paint-migration-r4-contact-sheet.png"
    save(sheet, output)
    return {"file": output.relative_to(ROOT).as_posix(), "sha256": sha256(output), "size": list(SIZE)}


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    trace = json.loads(TRACE.read_text(encoding="utf-8"))
    if trace.get("result") != "PLACEMENT_TIMING_AND_COMPOSITION_CLOSED_FOR_ORIGINAL_CREATED_REPLACEMENT":
        raise SystemExit("BM03/BM04 animation evidence is not closed")

    shared, shared_record = canonical_bm00()
    bm07_source = load(GENERATED / "field-bm07-01-background-human-paint.png", "RGB")
    bm07 = add_bm07_zones(bm07_source)
    bm07_file = REVIEW / "bm07" / "field-bm07-01-independent-human-paint.png"
    save(bm07, bm07_file)
    bm07_record = {
        "assetId": "art:battle:human-paint-r4:field-bm07-01",
        "fieldId": "field_bm07_01",
        "file": bm07_file.relative_to(ROOT).as_posix(),
        "sha256": sha256(bm07_file),
        "standingZoneContract": {
            "centers": [list(center) for center in RING_CENTERS],
            "radius": RING_RADIUS,
            "source": "DETERMINISTIC_BUILDER_NOT_IMAGE_MODEL",
        },
        "dependencies": [],
        "geometryAuthority": "BM07_INDEPENDENT_BACKGROUND_PLUS_DETERMINISTIC_STANDING_ZONES",
    }

    bm03 = animated_field("03", "LAVA", shared, trace)
    bm04 = animated_field("04", "WATER", shared, trace)
    bm03_image = load(ROOT / bm03["composites"][0]["file"], "RGB")
    bm04_image = load(ROOT / bm04["composites"][0]["file"], "RGB")
    previews = [layout_preview(bm07, "field-bm07-01"), layout_preview(bm03_image, "field-bm03-01"), layout_preview(bm04_image, "field-bm04-01")]
    contact = contact_sheet(shared, bm07, bm03_image, bm04_image)

    manifest = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-HUMAN-PAINT-MIGRATION-R4-2026-09-02",
        "family": "BATTLE",
        "status": "BOUNDED_STYLE_MIGRATION_INTERNAL_REVIEW",
        "styleTarget": STYLE_TARGET.relative_to(ROOT).as_posix(),
        "styleDirectionHumanApproved": True,
        "assetHumanApproved": False,
        "rightsStatus": "ORIGINAL_CREATED_AI_ASSISTED_TERMS_LINK_PENDING",
        "referencePixelsInOutputs": False,
        "runtimeMutation": False,
        "replacementPerformed": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "assets": [shared_record, bm07_record, bm03, bm04],
        "promotionGate": "OWNER_ASSET_REVIEW_THEN_RUNTIME_CONTRACT_BINDING_LICENSE_LINK_AND_RUNTIME_QA",
    }
    receipt = {
        "schemaVersion": 1,
        "batchId": manifest["batchId"],
        "tool": "BUILT_IN_IMAGEGEN_PLUS_DETERMINISTIC_PIL_NORMALIZATION",
        "dimensions": list(SIZE),
        "styleApprovalEvidence": "Owner message 2026-09-02: 新的風格我覺得可以",
        "sharedLayer": shared_record,
        "bm07": bm07_record,
        "animatedFields": [bm03, bm04],
        "layoutPreviews": previews,
        "contactSheet": contact,
        "rejectedCandidate": "rejected/field-bm07-01-independent-human-paint-rings-model-drawn-rejected.png",
        "rejectionReason": "MODEL_DRAWN_STANDING_ZONES_CANNOT_OWN_GAMEPLAY_GEOMETRY",
    }
    (WORKSPACE / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (WORKSPACE / "receipt.json").write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
