"""Audit the reassembled cell bank, not only the rendered frame.

``audit-cage-field-footprint`` measures ``frame-00.png``.  That frame is what a
reviewer looks at, but it is not what the production board draws: the board
reassembles the exported core and object cells.  The two can disagree, because a
prop can be hidden from the frame while its cell is still exported at full size.

This second gate measures the reassembly.  A field is only as contained as the
worse of the two numbers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

import importlib.util
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from lib.ydij_map_formats import composite_rendered_object_placements

WORK = ROOT / "docs/art/production/original-character-cage-r1/cage-base3d-v1"
DEFAULT_INPUT = WORK / "review/refinement-batch-d-v1/full-layout/report.json"
DEFAULT_OUTPUT = WORK / "review/field-footprint-audit-v2"

_audit_spec = importlib.util.spec_from_file_location(
    "cage_field_footprint_audit", ROOT / "scripts/audit-cage-field-footprint.py")
audit = importlib.util.module_from_spec(_audit_spec)
_audit_spec.loader.exec_module(audit)


def read(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compose_pack(pack: Path) -> Image.Image:
    """Reassemble one exported pack exactly as the batch reviewers do."""
    manifest = read(pack / "modular-manifest.json")
    scale = manifest["pixelScale"]
    core = Image.open(pack / manifest["core"]["src"]).convert("RGBA")
    objects = []
    try:
        for row in manifest["objects"]:
            objects.append({**row, "image": Image.open(pack / row["src"]).convert("RGBA"),
                            "placement": [v * scale for v in row["placement"]],
                            "pivot": [v * scale for v in row["pivot"]]})
        return composite_rendered_object_placements(core, objects)
    finally:
        core.close()
        for row in objects:
            row["image"].close()


def selection_composites(pack: Path, field_id: str) -> list[Path]:
    """Images the batch reviewer wrote for each manual animation selection."""
    review = pack.parent.parent.parent / "review"
    if not review.is_dir():
        return []
    return sorted(path for path in review.glob(f"{field_id}-*.png")
                  if not path.name.startswith("assembled-"))


def measure(image: Image.Image, footprint: dict) -> dict:
    metrics, overlay = audit.measure_overflow(image, footprint)
    overlay.close()
    return metrics


def build(input_report: Path = DEFAULT_INPUT, output: Path = DEFAULT_OUTPUT) -> dict:
    source = read(input_report)
    output.mkdir(parents=True, exist_ok=True)
    overlays = output / "composite-overlays"
    overlays.mkdir(exist_ok=True)
    records = []

    for row in source["records"]:
        field_id = row["fieldId"]
        pack = (ROOT / row["candidateFile"]).parent
        footprint = read(pack / "render-report.json")["hexFootprint"]
        with Image.open(pack / "frame-00.png") as opened:
            frame = measure(opened.convert("RGBA"), footprint)
        composite = compose_pack(pack)
        metrics, overlay = audit.measure_overflow(composite, footprint)
        composite.close()
        overlay_path = overlays / f"{field_id}.png"
        overlay.save(overlay_path, optimize=True)
        overlay.close()

        selections = []
        for path in selection_composites(pack, field_id):
            with Image.open(path) as opened:
                if opened.size != tuple(v * 4 for v in footprint["nativeSize"]):
                    continue
                selections.append({"file": path.relative_to(ROOT).as_posix(),
                                   **measure(opened.convert("RGBA"), footprint)})

        worst = max([metrics] + selections, key=lambda entry: entry["solidOverflowPixels"])
        records.append({
            "fieldId": field_id, "nameZh": row["nameZh"],
            "pack": pack.relative_to(ROOT).as_posix(),
            "frameSeverity": frame["severity"],
            "frameSolidOverflowPixels": frame["solidOverflowPixels"],
            "compositeSeverity": metrics["severity"],
            "compositeSolidOverflowPixels": metrics["solidOverflowPixels"],
            "compositeVisibleOverflowPixels": metrics["visibleOverflowPixels"],
            "compositeSolidOverflowRatio": metrics["solidOverflowRatio"],
            "overlay": overlay_path.relative_to(ROOT).as_posix(),
            "selectionsChecked": len(selections),
            "worstSeverity": worst["severity"],
            "worstSolidOverflowPixels": worst["solidOverflowPixels"],
            # The gate this audit exists for: a frame that looks clean while the
            # reassembled bank does not.
            "frameHidesCompositeOverflow":
                frame["solidOverflowPixels"] * 4 < metrics["solidOverflowPixels"],
            "selections": selections,
        })

    counts = {key: sum(record["worstSeverity"] == key for record in records)
              for key in ("PASS", "REVIEW", "FAIL")}
    report = {
        "status": "COMPOSITE_FOOTPRINT_AUDIT_COMPLETE_VISUAL_SEMANTIC_REVIEW_REQUIRED",
        "sourceReport": input_report.relative_to(ROOT).as_posix(),
        "fieldCount": len(records),
        "countsByWorstOfFrameAndComposite": counts,
        "framesHidingCompositeOverflow": sorted(
            record["fieldId"] for record in records if record["frameHidesCompositeOverflow"]),
        "records": records,
        "limits": [
            "Reassembly uses the exported manifest placements; it is not a runtime renderer.",
            "Containment only. Semantic identity remains a human visual review.",
            "No runtime eligibility, animation timing or shipping claim.",
        ],
    }
    (output / "composite-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "fieldCount": len(records),
                      "countsByWorstOfFrameAndComposite": counts,
                      "framesHidingCompositeOverflow": report["framesHidingCompositeOverflow"]},
                     ensure_ascii=False))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-report", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    build(args.input_report.resolve(), args.output.resolve())
