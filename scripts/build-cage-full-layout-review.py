"""Render all 37 candidate fields through the production cage placement plan."""
from __future__ import annotations

import hashlib
import json
import argparse
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "docs/art/production/original-character-cage-r1/cage-base3d-v1"
CATALOG_PATH = WORK / "review/catalog-37/catalog.json"
OUT = WORK / "review/full-layout-v1"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def report_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def load_plan() -> dict:
    process = subprocess.run(
        ["node", "scripts/lib/cage-full-layout-review.mjs"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(process.stdout)


def font(size: int):
    path = Path("C:/Windows/Fonts/msjh.ttc")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def compose(plan: dict, candidates: dict[str, Path]) -> Image.Image:
    image = Image.new("RGBA", (plan["wrapWidthPx"], 704), (0, 0, 0, 0))
    cache: dict[str, Image.Image] = {}
    try:
        for placement in plan["placements"]:
            field_id = placement["fieldId"]
            if field_id not in cache:
                cache[field_id] = Image.open(candidates[field_id]).convert("RGBA")
            source = cache[field_id]
            rect = placement["sourceRect"]
            box = (
                round(rect["x"]),
                round(rect["y"]),
                round(rect["x"] + rect["width"]),
                round(rect["y"] + rect["height"]),
            )
            image.alpha_composite(source.crop(box), (round(placement["x"]), round(placement["y"])))
    finally:
        for source in cache.values():
            source.close()
    return image


def build(overrides: dict[str, Path] | None = None, out: Path = OUT) -> dict:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    rows = catalog["fields"]
    candidates = {row["fieldId"]: ROOT / row["file"] for row in rows}
    candidates.update(overrides or {})
    names = {row["fieldId"]: row["nameZh"] for row in rows}
    batches = {row["fieldId"]: row["batch"] for row in rows}
    plan = load_plan()
    if plan["scenarioCount"] != 37:
        raise ValueError(f"EXPECTED_37_SCENARIOS_GOT_{plan['scenarioCount']}")

    out.mkdir(parents=True, exist_ok=True)
    boards = out / "boards"
    boards.mkdir(parents=True, exist_ok=True)
    title_font, label_font = font(22), font(15)
    cards = []
    records = []

    for scenario in plan["scenarios"]:
        field_id = scenario["fieldId"]
        batch_label = "candidate-override" if overrides and field_id in overrides else batches[field_id]
        board = compose(scenario["plan"], candidates)
        alpha = board.getchannel("A")
        visible_bounds = alpha.getbbox()
        transparent_pixels = board.width * board.height - alpha.histogram()[255]
        board_native = board.resize((board.width // 4, board.height // 4), Image.Resampling.NEAREST)
        canvas = Image.new("RGB", (board_native.width, 226), (14, 23, 31))
        canvas.paste(board_native, (0, 50), board_native)
        draw = ImageDraw.Draw(canvas)
        index = scenario["definitionIndex"]
        label = f"{index:02d}  {field_id}  {names[field_id]}"
        draw.text((12, 7), label, font=title_font, fill=(238, 244, 241))
        slot = "structural lids" if index == 36 else f"slot {scenario['slotIndex']}"
        draw.text((12, 31), f"{batch_label} · {slot} · production crop/wrap", font=label_font, fill=(120, 190, 210))
        output = boards / f"{index:02d}-{field_id}.png"
        canvas.save(output, optimize=True)
        cards.append(canvas)
        records.append({
            "definitionIndex": index,
            "fieldId": field_id,
            "nameZh": names[field_id],
            "batch": batch_label,
            "candidateFile": report_path(candidates[field_id]),
            "slotIndex": scenario["slotIndex"],
            "board": report_path(output),
            "boardSha256": digest(output),
            "visibleBoundsWorldPx": list(visible_bounds) if visible_bounds else None,
            "transparentPixelsWorldBoard": transparent_pixels,
        })
        board.close()
        board_native.close()

    columns = 2
    rows_count = (len(cards) + columns - 1) // columns
    sheet = Image.new("RGB", (cards[0].width * columns, cards[0].height * rows_count), (8, 14, 20))
    for index, card in enumerate(cards):
        sheet.paste(card, ((index % columns) * card.width, (index // columns) * card.height))
        card.close()
    sheet_path = out / "all-37-full-layout-contact-sheet.jpg"
    sheet.save(sheet_path, quality=91, optimize=True)
    sheet.close()

    report = {
        "status": "PASS_FULL_LAYOUT_REVIEW_ARTIFACT_NOT_RUNTIME_ACCEPTANCE",
        "authority": plan["authority"],
        "scenarioCount": len(records),
        "unlockedCount": 20,
        "candidateOverrides": {key: report_path(value) for key, value in (overrides or {}).items()},
        "records": records,
        "contactSheet": report_path(sheet_path),
        "contactSheetSha256": digest(sheet_path),
        "limits": [
            "The board uses production placement/crop/wrap geometry but candidate art remains review-only.",
            "One canonical legal placement per field does not replace the exhaustive placement test matrix.",
            "No runtime eligibility, animation timing, actor occlusion, mobile or shipping claim."
        ],
    }
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "scenarioCount": len(records), "contactSheet": report["contactSheet"]}))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUT)
    parser.add_argument("--candidate-override", action="append", default=[], metavar="FIELD_ID=PATH")
    args = parser.parse_args()
    replacements = {}
    for value in args.candidate_override:
        field_id, separator, path = value.partition("=")
        if not separator:
            raise ValueError(f"INVALID_CANDIDATE_OVERRIDE:{value}")
        replacements[field_id] = Path(path).resolve()
    build(replacements, args.output.resolve())
