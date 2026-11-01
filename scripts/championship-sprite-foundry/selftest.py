#!/usr/bin/env python3
"""Self-test with synthetic art whose right answers are known.

A 4x4 sheet on a grey backdrop (like the MA28 review boards): a pure-white
armoured body with a dark outline, a cream wing that turns 50 degrees between
A and B, a detached gold crown, text labels above and below every cell, and
every B drawn with a known sub-pixel offset of (+2.375, -1.625) px.

Checks, end to end through the command-line tools:
  A  16 frames, label rows fully transparent, every white body pixel opaque
  B  ROOT HOLD recovers the offset within 0.1 px in all 8 directions
  C  event 1 and 4 are the keys bit for bit, 48 ticks = 800 ms, torso drift < 0.5 px
  E  proposed ticks refused; authored ticks kept verbatim; frames carry only the handoff fields, one shared origin
  C2 hitback finds the crown, which rises and then falls
  D  plate + prompt written, key colour far from the character palette
  U2 U^2-Net session runs (skipped if the model is not downloaded)

    python scripts/championship-sprite-foundry/selftest.py [--keep DIR]
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import foundry_common as fc  # noqa: E402
import foundry_matte as fm  # noqa: E402

CELL_W, CELL_H, SS = 200, 220, 8
BACKDROP = (230, 232, 232)
OFFSET_B = (2.375, -1.625)


def draw_character(wing_deg: float, offset=(0.0, 0.0)) -> Image.Image:
    """Supersampled so a fractional offset is drawn exactly."""
    big = Image.new("RGB", (CELL_W * SS, CELL_H * SS), BACKDROP)
    d = ImageDraw.Draw(big)
    ox, oy = offset

    def p(x, y):
        return ((x + ox) * SS, (y + oy) * SS)

    pivot = (118, 112)
    angle = math.radians(wing_deg)
    wing = [(0, 0), (52, -10), (60, 14), (8, 14)]
    pts = [p(pivot[0] + x * math.cos(angle) + y * math.sin(angle), pivot[1] - x * math.sin(angle) + y * math.cos(angle)) for x, y in wing]
    d.polygon(pts, fill=(246, 236, 214), outline=(30, 34, 44), width=3 * SS)
    d.ellipse([*p(70, 92), *p(130, 150)], fill=(255, 255, 255), outline=(30, 34, 44), width=3 * SS)
    d.ellipse([*p(92, 110), *p(108, 126)], fill=(250, 170, 20), outline=(30, 34, 44), width=2 * SS)
    d.polygon([p(84, 70), p(90, 56), p(100, 66), p(110, 56), p(116, 70)], fill=(232, 176, 40), outline=(30, 34, 44), width=2 * SS)
    return big.resize((CELL_W, CELL_H), Image.Resampling.BOX)


def build_sheet(path: Path) -> None:
    sheet = Image.new("RGB", (CELL_W * 4, CELL_H * 4), BACKDROP)
    directions = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"]
    for row in range(4):
        pose = "A" if row < 2 else "B"
        for col in range(4):
            direction = directions[(row % 2) * 4 + col]
            cell = draw_character(0 if pose == "A" else 50, (0, 0) if pose == "A" else OFFSET_B)
            d = ImageDraw.Draw(cell)
            d.text((4, 3), f"SYN {direction} | {pose} | event{1 if pose == 'A' else 4}/6 | 8/60s | ROOT HOLD", fill=(32, 51, 61))
            d.text((4, CELL_H - 14), "DRAFT | 800ms / 60fps | E pivot HOLD", fill=(32, 51, 61))
            sheet.paste(cell, (col * CELL_W, row * CELL_H))
    sheet.save(path)


def run(*args: str) -> str:
    result = subprocess.run([sys.executable, *args], cwd=HERE, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(f"FAILED: {' '.join(args)}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep", help="write outputs here instead of a temp folder")
    args = parser.parse_args()
    work = Path(args.keep) if args.keep else Path(tempfile.mkdtemp(prefix="sprite-foundry-selftest-"))
    work.mkdir(parents=True, exist_ok=True)
    results = []

    def check(name: str, ok: bool, detail: str) -> None:
        results.append((name, ok, detail))
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")

    sheet = work / "synthetic_sheet.png"
    build_sheet(sheet)

    # A
    run("split_sheet.py", str(sheet), "--out-dir", str(work / "split"), "--u2net", "off")
    manifest = json.loads((work / "split" / "split_manifest.json").read_text(encoding="utf-8"))
    frames = list((work / "split").glob("*/[AB].png"))
    label_rows_clear = all(
        (fc.load_rgba(f)[:16, :, 3] == 0).all() and (fc.load_rgba(f)[-16:, :, 3] == 0).all() for f in frames)
    check("A split", len(frames) == 16 and manifest["summary"]["label_bands_removed"] == 32 and label_rows_clear,
          f"{len(frames)} frames, {manifest['summary']['label_bands_removed']} label bands removed, label rows transparent={label_rows_clear}")
    white_ok = manifest["summary"]["worst_white_kept_ratio"] == 1.0
    centre = fc.load_rgba(work / "split" / "S" / "A.png")[140, 100]  # inside the white body, clear of the gold gem
    check("A white armour", white_ok and centre[3] == 255 and centre[:3].min() >= 250,
          f"worst white kept ratio {manifest['summary']['worst_white_kept_ratio']}, body pixel {centre.tolist()}")

    # B
    run("root_lock.py", "--split-dir", str(work / "split"), "--out-dir", str(work / "lock"))
    summary = json.loads((work / "lock" / "root_lock_summary.json").read_text(encoding="utf-8"))
    errors = {d: math.hypot(s["shift_applied_px"][0] + OFFSET_B[0], s["shift_applied_px"][1] + OFFSET_B[1]) for d, s in summary.items()}
    check("B ROOT HOLD", len(errors) == 8 and max(errors.values()) < 0.1 and all(s["root_hold_pass"] for s in summary.values()),
          f"offset recovery error max {max(errors.values()):.4f} px over {len(errors)} directions")

    # C
    run("tween_events.py", "--a", str(work / "lock" / "S" / "A.png"), "--b", str(work / "lock" / "S" / "B.png"), "--out-dir", str(work / "tween"))
    timeline = json.loads((work / "tween" / "timeline.json").read_text(encoding="utf-8"))
    a = fc.load_rgba(work / "lock" / "S" / "A.png")
    b = fc.load_rgba(work / "lock" / "S" / "B.png")
    keys_exact = (np.array_equal(fc.load_rgba(work / "tween" / "event_1.png"), a)
                  and np.array_equal(fc.load_rgba(work / "tween" / "event_4.png"), b))
    ticks = sum(e["ticks"] for e in timeline["events"])
    drift = max(e["root_drift_px"] or 0 for e in timeline["events"])
    check("C tween", keys_exact and ticks == 48 and drift < 0.5 and len(timeline["parts"]) >= 1,
          f"keys bit-exact={keys_exact}, ticks={ticks}, max torso drift {drift} px, parts {len(timeline['parts'])}")

    # E
    run("tween_events.py", "--a", str(work / "lock" / "S" / "A.png"), "--b", str(work / "lock" / "S" / "B.png"),
        "--out-dir", str(work / "tween_authored"), "--ticks", "6,4,6,6,4,6")
    refused = subprocess.run([sys.executable, "export_handoff.py", "--timeline", str(work / "tween" / "timeline.json"),
                              "--out-dir", str(work / "refused"), "--id-prefix", "x", "--clip-id", "x", "--action", "x",
                              "--native-body-height", "20"], cwd=HERE, capture_output=True, text=True).returncode != 0
    run("export_handoff.py", "--timeline", str(work / "tween_authored" / "timeline.json"), "--out-dir", str(work / "handoff"),
        "--id-prefix", "syn_S", "--clip-id", "handoff:arena:S:test", "--action", "test", "--direction", "S", "--native-body-height", "20")
    handoff = json.loads((work / "handoff" / "handoff.frames-clips.json").read_text(encoding="utf-8"))
    allowed = {"id", "image", "sha256", "frame", "trim", "sourceSize", "origin", "density", "sampling", "mirrorX"}
    fields_ok = all(set(f) <= allowed and f.get("sampling") == "smooth" for f in handoff["frames"])
    origins = {tuple(f["origin"]) for f in handoff["frames"]}
    durations = [round(s["durationMs"] * 60 / 1000) for s in handoff["clips"][0]["frames"]]
    check("E handoff export", refused and fields_ok and len(origins) == 1 and durations == [6, 4, 6, 6, 4, 6],
          f"proposed ticks refused={refused}, frame fields allowed only={fields_ok}, shared origin={len(origins) == 1}, ticks kept {durations}")

    # C2
    run("hitback_props.py", "--frame", str(work / "split" / "S" / "A.png"), "--out-dir", str(work / "hitback"),
        "--ticks", "7", "--extend", "9", "--min-prop-area", "50")
    hit = json.loads((work / "hitback" / "hitback_timeline.json").read_text(encoding="utf-8"))
    ys = [t["props"][0]["centre_xy"][1] for t in hit["ticks"]] if hit["props"] else []
    rises_falls = bool(ys) and min(ys) < ys[0] and ys[-1] > min(ys)
    check("C2 hitback crown", len(hit["props"]) == 1 and len(hit["ticks"]) == 16 and rises_falls,
          f"props {len(hit['props'])}, ticks {len(hit['ticks'])}, crown y {ys[0] if ys else None} -> {min(ys) if ys else None} -> {ys[-1] if ys else None}")

    # D
    native = draw_character(0).resize((50, 55), Image.Resampling.NEAREST)
    native.save(work / "native.png")
    run("prompt_kit.py", "--native", str(work / "native.png"), "--out-dir", str(work / "prompt"), "--role", "SYN", "--action", "test", "--frame", "400,400", "--canvas", "600,600")
    analysis = json.loads((work / "prompt" / "analysis.json").read_text(encoding="utf-8"))
    files_ok = all((work / "prompt" / n).is_file() for n in ("PROMPT.md", "PLATE_KEY.png", "PLATE_TRANSPARENT.png", "PLATE_GUIDES.png"))
    check("D prompt kit", files_ok and analysis["key"]["min_distance_to_character_colours"] >= 100,
          f"files={files_ok}, key {analysis['key']['hex']} distance {analysis['key']['min_distance_to_character_colours']}, "
          f"detached pieces {len(analysis['geometry']['detached_components'])}")

    # U2
    model = fm.find_u2net()
    if model:
        probability = fm.U2Net(model).probability(np.asarray(draw_character(0)))
        check("U2 U^2-Net", probability.shape == (CELL_H, CELL_W) and 0 <= probability.min() <= probability.max() <= 1,
              f"model {model.name}, probability range {probability.min():.2f}-{probability.max():.2f}")
    else:
        print("[SKIP] U2 U^2-Net: model not downloaded (python -c \"import foundry_matte as m; m.download_u2net()\")")

    failed = [name for name, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed; outputs in {work}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
