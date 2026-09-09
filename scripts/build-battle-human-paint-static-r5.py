#!/usr/bin/env python3
"""Build the remaining static Battle human-paint review family.

Image generation supplies opaque environment plates only.  This deterministic
builder owns composition: it reapplies the approved R4 canonical BM00 layer,
keeps BM08/BM11 verified object payloads separate, preserves BM11's two-frame
6/6-tick contract, and emits exact 9:16 review layouts.  Nothing is copied to a
runtime path.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "docs" / "art" / "production" / "battle" / "human-paint-static-r5"
GENERATED = WORKSPACE / "generated"
REVIEW = WORKSPACE / "review"
SHARED = (
    ROOT / "docs" / "art" / "production" / "battle" / "human-paint-migration-r4"
    / "review" / "layers" / "field-bm00-00-shared-layer-human-paint.png"
)
HARDENING = ROOT / "assets" / "production" / "internal-battle-review" / "hardening-r2"
STYLE_TARGET = (
    ROOT / "docs" / "art" / "production" / "battle" / "style-calibration-r3"
    / "candidates" / "bm06-human-paint-c-recommended.png"
)
SIZE = (1536, 1024)

FIELDS = [
    ("01", "BATTLE_NORMAL"),
    ("02", "BATTLE_GRASS"),
    ("05", "BATTLE_SOUTHPOLE"),
    ("08", "BATTLE_HELL"),
    ("09", "BATTLE_COLOSSEUM"),
    ("10", "BATTLE_STADIUM"),
    ("11", "BATTLE_DOMESTADIUM"),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load(path: Path, mode: str) -> Image.Image:
    if not path.is_file():
        raise SystemExit(f"Missing R5 input: {path}")
    image = Image.open(path).convert(mode)
    if image.size != SIZE:
        raise SystemExit(f"{path}: expected {SIZE}, got {image.size}")
    return image


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def object_layers(key: str) -> list[Path]:
    if key == "08":
        return [HARDENING / "field-bm08-01-objects.png"]
    if key == "11":
        return [
            HARDENING / "field-bm11-01-objects-frame-00.png",
            HARDENING / "field-bm11-01-objects-frame-01.png",
        ]
    return []


def layout_preview(image: Image.Image, field_id: str) -> dict:
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
    canvas.paste(image.convert("RGB").resize((360, 240), Image.Resampling.LANCZOS), (0, 96))
    for y in (32, 96, 336, 515):
        draw.line((0, y, 359, y), fill="#4C6970")
    output = REVIEW / "layout" / f"{field_id.replace('_', '-')}-battle-layout-360x640.png"
    save(canvas, output)
    return {
        "fieldId": field_id,
        "file": output.relative_to(ROOT).as_posix(),
        "sha256": sha256(output),
        "size": [360, 640],
        "fieldBand": {"x": 0, "y": 96, "width": 360, "height": 240},
    }


def field_record(key: str, function: str, shared: Image.Image) -> tuple[dict, Image.Image]:
    field_id = f"field_bm{key}_01"
    generated_path = GENERATED / f"{field_id.replace('_', '-')}-background-human-paint.png"
    background = load(generated_path, "RGB")
    background_output = REVIEW / key / generated_path.name
    save(background, background_output)

    layers = object_layers(key)
    if key == "11" and len(layers) != 2:
        raise SystemExit("BM11 must retain exactly two object frames")
    frame_count = len(layers) if layers else 1
    composites = []
    object_records = []
    first_composite = None
    for index in range(frame_count):
        composite = background.convert("RGBA")
        if layers:
            layer_path = layers[index]
            layer = load(layer_path, "RGBA")
            composite = Image.alpha_composite(composite, layer)
            object_records.append({
                "frameIndex": index,
                "file": layer_path.relative_to(ROOT).as_posix(),
                "sha256": sha256(layer_path),
            })
        composite = Image.alpha_composite(composite, shared).convert("RGB")
        suffix = f"-frame-{index:02d}" if frame_count > 1 else ""
        composite_path = REVIEW / key / f"{field_id.replace('_', '-')}-composite{suffix}.png"
        save(composite, composite_path)
        composites.append({
            "frameIndex": index,
            "file": composite_path.relative_to(ROOT).as_posix(),
            "sha256": sha256(composite_path),
            "durationRawTicks": 6 if key == "11" else None,
        })
        if first_composite is None:
            first_composite = composite

    record = {
        "assetId": f"art:battle:human-paint-r5:{field_id.replace('_', '-')}",
        "fieldId": field_id,
        "function": function,
        "background": {
            "file": background_output.relative_to(ROOT).as_posix(),
            "sha256": sha256(background_output),
            "mode": "RGB",
        },
        "dependencies": ["art:battle:human-paint-r4:field-bm00-00-shared-layer"],
        "sharedLayer": SHARED.relative_to(ROOT).as_posix(),
        "objectLayerSeparation": "VERIFIED_EXISTING_LAYER_RETAINED" if layers else "NO_VERIFIED_OBJECT_LAYER",
        "objectLayers": object_records,
        "frameCount": frame_count,
        "frameDurationsRawTicks": [6, 6] if key == "11" else None,
        "composites": composites,
        "geometryAuthority": "R4_CANONICAL_BM00_AND_VERIFIED_EXISTING_OBJECT_LAYERS_NOT_IMAGE_MODEL",
    }
    return record, first_composite


def contact_sheet(items: list[tuple[str, Image.Image]]) -> dict:
    sheet = Image.new("RGB", (2304, 1536), "#121A1F")
    for index, (label, image) in enumerate(items):
        cell = image.convert("RGB").resize((768, 512), Image.Resampling.LANCZOS)
        draw = ImageDraw.Draw(cell)
        draw.rounded_rectangle((12, 12, 230, 44), radius=7, fill=(10, 16, 19))
        draw.text((22, 22), label, fill="#E3ECE8")
        sheet.paste(cell, ((index % 3) * 768, (index // 3) * 512))
    output = REVIEW / "human-paint-static-r5-contact-sheet.png"
    save(sheet, output)
    return {"file": output.relative_to(ROOT).as_posix(), "sha256": sha256(output), "size": [2304, 1536]}


def main() -> None:
    shared = load(SHARED, "RGBA")
    records = []
    contact_items = []
    previews = []
    for key, function in FIELDS:
        record, first_composite = field_record(key, function, shared)
        records.append(record)
        contact_items.append((f"BM{key} {function.removeprefix('BATTLE_')}", first_composite))
        previews.append(layout_preview(first_composite, record["fieldId"]))

    contact = contact_sheet(contact_items)
    shared_record = {
        "assetId": "art:battle:human-paint-r4:field-bm00-00-shared-layer",
        "file": SHARED.relative_to(ROOT).as_posix(),
        "sha256": sha256(SHARED),
    }
    manifest = {
        "schemaVersion": 1,
        "batchId": "ART-BATTLE-HUMAN-PAINT-STATIC-R5-2026-09-02",
        "family": "BATTLE",
        "status": "STATIC_STYLE_MIGRATION_INTERNAL_REVIEW",
        "styleTarget": STYLE_TARGET.relative_to(ROOT).as_posix(),
        "styleDirectionHumanApproved": True,
        "assetHumanApproved": False,
        "rightsStatus": "ORIGINAL_CREATED_AI_ASSISTED_TERMS_LINK_PENDING",
        "referencePixelsInOutputs": False,
        "runtimeMutation": False,
        "replacementPerformed": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "sharedLayer": shared_record,
        "assets": records,
        "promotionGate": "OWNER_ASSET_REVIEW_THEN_RUNTIME_CONTRACT_BINDING_LICENSE_LINK_AND_RUNTIME_QA",
    }
    receipt = {
        "schemaVersion": 1,
        "batchId": manifest["batchId"],
        "tool": "BUILT_IN_IMAGEGEN_PLUS_DETERMINISTIC_PIL_NORMALIZATION",
        "dimensions": list(SIZE),
        "styleApprovalEvidence": "Owner message 2026-09-02: 新的風格我覺得可以",
        "generatedBackgroundCount": len(records),
        "sharedLayer": shared_record,
        "assets": records,
        "layoutPreviews": previews,
        "contactSheet": contact,
        "compositionRules": {
            "imageModelOwns": ["OPAQUE_ENVIRONMENT_PIXELS"],
            "imageModelDoesNotOwn": ["BM00_GEOMETRY", "STANDING_RINGS", "BM08_OBJECTS", "BM11_OBJECT_ANIMATION"],
            "bm11FrameDurationsRawTicks": [6, 6],
        },
    }
    (WORKSPACE / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (WORKSPACE / "receipt.json").write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
