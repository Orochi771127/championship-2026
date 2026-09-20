"""Audit cage candidate art against its own native hex footprint.

This is deliberately stricter than the assembled-board seam checks.  Seam checks
prove that legal placements join; this audit asks whether visible authored content
projects outside the field that owns it and whether the field remains readable at
the native configuration-page scale.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "docs/art/production/original-character-cage-r1/cage-base3d-v1"
DEFAULT_INPUT = WORK / "review/refinement-batch-c-v1/full-layout/report.json"
DEFAULT_OUTPUT = WORK / "review/field-footprint-audit-v1"

# Human-readable identity contracts.  They do not pretend that a pixel metric can
# decide semantics; they tell the reviewer which unmistakable hero read must survive
# at configuration-page scale.
SEMANTIC_CONTRACTS = {
    "field_cm06_01": ["culture pod", "lab workstation"],
    "field_cm15_01": ["conveyor", "production machine"],
    "field_cm17_01": ["hospital bed", "medical monitor"],
    "field_cm22_01": ["reactor or turbine", "power coil"],
    "field_cm23_01": ["sealed tank", "scrubber or pipework"],
    "field_cm25_01": ["animal enclosure", "pool or feeder"],
    "field_cm26_01": ["barn", "paddock or hay"],
    "field_cm35_01": ["luminous crater", "lava fissure"],
    "field_cm37_01": ["raised summit", "snowcap or summit flag"],
    "field_cm40_01": ["black cave mouth", "crystal, lantern or stalagmite"],
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int):
    path = Path("C:/Windows/Fonts/msjh.ttc")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def threshold(channel: Image.Image, minimum: int) -> Image.Image:
    return channel.point(lambda value: 255 if value >= minimum else 0, mode="1").convert("L")


def count_mask(mask: Image.Image) -> int:
    return mask.histogram()[255]


def make_footprint_mask(size: tuple[int, int], outline: list[list[float]], scale: float,
                        tolerance_px: int = 6) -> tuple[Image.Image, Image.Image]:
    exact = Image.new("L", size, 0)
    points = [(round(x * scale), round(y * scale)) for x, y in outline]
    ImageDraw.Draw(exact).polygon(points, fill=255)
    if tolerance_px <= 0:
        return exact, exact.copy()
    expanded = exact.filter(ImageFilter.MaxFilter(tolerance_px * 2 + 1))
    return exact, expanded


def measure_overflow(image: Image.Image, footprint: dict, tolerance_px: int = 6) -> tuple[dict, Image.Image]:
    native_w, native_h = footprint["nativeSize"]
    scale_x = image.width / native_w
    scale_y = image.height / native_h
    if abs(scale_x - scale_y) > 0.01:
        raise ValueError(f"NON_UNIFORM_RENDER_SCALE:{scale_x}:{scale_y}")
    scale = (scale_x + scale_y) / 2
    exact, expanded = make_footprint_mask(image.size, footprint["outline"], scale, tolerance_px)
    outside = ImageOps.invert(expanded)
    alpha = image.getchannel("A")
    visible = threshold(alpha, 32)
    solid = threshold(alpha, 192)
    visible_overflow = ImageChops.multiply(visible, outside)
    solid_overflow = ImageChops.multiply(solid, outside)
    visible_count = count_mask(visible)
    solid_count = count_mask(solid)
    visible_out = count_mask(visible_overflow)
    solid_out = count_mask(solid_overflow)
    solid_ratio = solid_out / max(1, solid_count)
    visible_ratio = visible_out / max(1, visible_count)
    # The Cycles alpha edge and polygon rasterizer can disagree by a fraction of
    # a source pixel even after dilation.  Up to 128 solid / 512 visible pixels
    # in a four-times render is the measured one-cell antialias floor, not a
    # meaningful prop overhang.
    if solid_out <= 128 and visible_out <= 512:
        severity = "PASS"
    elif solid_ratio <= 0.0025 and visible_ratio <= 0.006:
        severity = "REVIEW"
    else:
        severity = "FAIL"

    overlay = image.copy()
    red = Image.new("RGBA", image.size, (255, 28, 45, 0))
    red.putalpha(solid_overflow.point(lambda value: 220 if value else 0))
    overlay.alpha_composite(red)
    draw = ImageDraw.Draw(overlay)
    outline = [(round(x * scale), round(y * scale)) for x, y in footprint["outline"]]
    draw.line(outline + [outline[0]], fill=(0, 238, 255, 255), width=max(2, round(scale)))
    metrics = {
        "renderScale": scale,
        "tolerancePx": tolerance_px,
        "visiblePixels": visible_count,
        "solidPixels": solid_count,
        "visibleOverflowPixels": visible_out,
        "solidOverflowPixels": solid_out,
        "visibleOverflowRatio": round(visible_ratio, 6),
        "solidOverflowRatio": round(solid_ratio, 6),
        "overflowBoundsPx": list(visible_overflow.getbbox()) if visible_overflow.getbbox() else None,
        "severity": severity,
    }
    exact.close()
    expanded.close()
    outside.close()
    visible.close()
    solid.close()
    visible_overflow.close()
    solid_overflow.close()
    return metrics, overlay


def build(input_report: Path = DEFAULT_INPUT, output: Path = DEFAULT_OUTPUT) -> dict:
    source = json.loads(input_report.read_text(encoding="utf-8"))
    output.mkdir(parents=True, exist_ok=True)
    overlays = output / "overlays"
    overlays.mkdir(exist_ok=True)
    records = []
    cards: list[Image.Image] = []
    title = font(20)
    small = font(14)

    for row in source["records"]:
        field_id = row["fieldId"]
        candidate = ROOT / row["candidateFile"]
        render_report = candidate.parent / "render-report.json"
        render = json.loads(render_report.read_text(encoding="utf-8"))
        footprint = render.get("hexFootprint")
        if not footprint:
            raise ValueError(f"MISSING_HEX_FOOTPRINT:{field_id}")
        with Image.open(candidate) as opened:
            image = opened.convert("RGBA")
        metrics, overlay = measure_overflow(image, footprint)
        overlay_path = overlays / f"{field_id}.png"
        overlay.save(overlay_path, optimize=True)

        # Four-times renders become one-times/native review images.  This is the
        # same scale family used by the production placement page, not a hero zoom.
        native = overlay.resize(tuple(footprint["nativeSize"]), Image.Resampling.LANCZOS)
        card = Image.new("RGB", (420, 270), (12, 20, 28))
        x = (card.width - native.width) // 2
        y = 72 + max(0, (165 - native.height) // 2)
        card.paste(native, (x, y), native)
        draw = ImageDraw.Draw(card)
        color = {"PASS": (90, 225, 145), "REVIEW": (255, 193, 71), "FAIL": (255, 80, 94)}[metrics["severity"]]
        draw.text((10, 8), f"{field_id}  {row['nameZh']}", font=title, fill=(238, 244, 241))
        draw.text((10, 36), f"{metrics['severity']}  solid outside {metrics['solidOverflowPixels']} px",
                  font=small, fill=color)
        contract = SEMANTIC_CONTRACTS.get(field_id)
        if contract:
            draw.text((10, 54), "hero: " + " / ".join(contract), font=small, fill=(126, 196, 218))
        cards.append(card)

        records.append({
            "fieldId": field_id,
            "nameZh": row["nameZh"],
            "candidateFile": row["candidateFile"],
            "candidateSha256": sha256(candidate),
            "renderReport": render_report.relative_to(ROOT).as_posix(),
            "overlay": overlay_path.relative_to(ROOT).as_posix(),
            "semanticContract": contract,
            "semanticReviewRequired": bool(contract),
            **metrics,
        })
        image.close()
        overlay.close()
        native.close()

    columns = 2
    sheet = Image.new("RGB", (420 * columns, 270 * ((len(cards) + 1) // columns)), (7, 12, 18))
    for index, card in enumerate(cards):
        sheet.paste(card, ((index % columns) * 420, (index // columns) * 270))
        card.close()
    sheet_path = output / "all-37-field-footprint-and-semantic-review.jpg"
    sheet.save(sheet_path, quality=92, optimize=True)
    sheet.close()

    counts = {key: sum(record["severity"] == key for record in records) for key in ("PASS", "REVIEW", "FAIL")}
    report = {
        "status": "FIELD_FOOTPRINT_AUDIT_COMPLETE_VISUAL_SEMANTIC_REVIEW_REQUIRED",
        "sourceReport": input_report.relative_to(ROOT).as_posix(),
        "fieldCount": len(records),
        "counts": counts,
        "records": records,
        "contactSheet": sheet_path.relative_to(ROOT).as_posix(),
        "contactSheetSha256": sha256(sheet_path),
        "limits": [
            "The pixel audit detects rendered overhang after a six-pixel antialias allowance; it does not infer walkability.",
            "A PASS means containment only. Semantic identity remains a visual review against each hero-object contract.",
            "The review output is not runtime art and does not promote any candidate for shipping.",
        ],
    }
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "fieldCount": len(records), "counts": counts,
                      "contactSheet": report["contactSheet"]}, ensure_ascii=False))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-report", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    build(args.input_report.resolve(), args.output.resolve())
