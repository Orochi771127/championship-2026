#!/usr/bin/env python3
"""Tool A: split a generated review sheet into clean, transparent A/B frames.

Typical input: the MA28-style 4x4 eight-direction sheet (rows: A S..NE, A N..SW,
B S..NE, B N..SW), each cell carrying a top label ("MA28 S | A | event1/6 ...")
and a bottom label ("DRAFT | 800ms /60fps ..."). Also takes a single review
image or one panel of a board via --region.

Every cell keeps its full size: no per-frame cropping or rescaling, so the
shared scale and registration of the sheet survive (sprite-pipeline rule).

    python split_sheet.py SHEET.png --out-dir OUT [--rows 4 --cols 4]
        [--order S,SE,E,NE,N,NW,W,SW] [--pose-rows A,A,B,B]
        [--label-crop auto|none|TOP,BOTTOM] [--u2net auto|on|off]
    python split_sheet.py BOARD.png --out-dir OUT --region 540,60,1800,1100 --name hitback
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from scipy import ndimage

import foundry_common as fc
import foundry_matte as fm


def label_bands(rgb: np.ndarray, bg: np.ndarray, tol: float, max_height: int, edge_fraction: float) -> list[tuple[int, int]]:
    """Rows holding engineering text near the top/bottom of a cell.

    A band is text when it is short, sits in the outer `edge_fraction` of the
    cell, and is made of at least four small glyph components. A detached tail
    tip or crown is one large component, so it is never cropped.
    """
    height = rgb.shape[0]
    ink = fm.color_distance(rgb, bg) > max(2 * tol, 24)
    rows = ink.any(axis=1)
    runs, start, gap = [], None, 0
    for y, filled in enumerate(rows):
        if filled:
            if start is None:
                start = y
            gap = 0
        elif start is not None:
            gap += 1
            if gap > 2:
                runs.append((start, y - gap + 1))
                start, gap = None, 0
    if start is not None:
        runs.append((start, height))
    bands = []
    for y0, y1 in runs:
        if y1 - y0 > max_height:
            continue
        if not (y1 <= height * edge_fraction or y0 >= height * (1 - edge_fraction)):
            continue
        labels, count = ndimage.label(ink[y0:y1], structure=fm.EIGHT)
        if count < 4:
            continue
        slices = ndimage.find_objects(labels)
        tallest = max(s[0].stop - s[0].start for s in slices if s is not None)
        if tallest <= max_height:
            bands.append((max(0, y0 - 2), min(height, y1 + 2)))
    return bands


def cell_names(rows: int, cols: int, order: list[str], pose_rows: list[str]) -> list[tuple[str, str]]:
    names, used = [], {}
    for row in range(rows):
        pose = pose_rows[row] if row < len(pose_rows) else f"R{row}"
        for _ in range(cols):
            index = used.get(pose, 0)
            used[pose] = index + 1
            names.append((order[index] if index < len(order) else f"cell{index}", pose))
    return names


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("sheet")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--order", default=",".join(fc.DIRECTIONS))
    parser.add_argument("--pose-rows", default="A,A,B,B", help="pose of each sheet row")
    parser.add_argument("--region", help="x0,y0,x1,y1: process one panel only (sets rows=cols=1)")
    parser.add_argument("--name", default="frame", help="output name with --region")
    parser.add_argument("--label-crop", default="auto", help="auto | none | TOP,BOTTOM pixels per cell")
    parser.add_argument("--label-max-height", type=int, default=40)
    parser.add_argument("--label-edge-fraction", type=float, default=0.22)
    parser.add_argument("--tol", type=float, default=12.0)
    parser.add_argument("--soft", type=float, default=60.0)
    parser.add_argument("--min-area", type=int, default=40)
    parser.add_argument("--u2net", choices=["auto", "on", "off"], default="auto")
    parser.add_argument("--art-kind", choices=["painted", "pixel"], default="painted",
                        help="pixel: hard edge (no soft alpha) and nearest sampling downstream")
    parser.add_argument("--gpu", action="store_true")
    args = parser.parse_args()

    sheet = fc.load_rgba(args.sheet)
    out_dir = Path(args.out_dir)
    u2net = fm.load_u2net(args.u2net, gpu=args.gpu)
    if args.region:
        x0, y0, x1, y1 = fc.parse_numbers(args.region, 4, int)
        boxes = [(x0, y0, x1, y1)]
        names = [(args.name, "")]
    else:
        height, width = sheet.shape[:2]
        boxes = []
        for row in range(args.rows):
            for col in range(args.cols):
                boxes.append((round(col * width / args.cols), round(row * height / args.rows),
                              round((col + 1) * width / args.cols), round((row + 1) * height / args.rows)))
        names = cell_names(args.rows, args.cols, args.order.split(","), args.pose_rows.split(","))

    manifest = {
        "tool": "championship-sprite-foundry/split_sheet.py",
        "source": str(Path(args.sheet).resolve()),
        "source_size": [int(sheet.shape[1]), int(sheet.shape[0])],
        "u2net_model": str(u2net.model) if u2net else None,
        "art_kind": args.art_kind,
        "sampling": fc.sampling_for(args.art_kind),
        "resolution": "source pixels kept: no downscale, no per-frame crop or resize",
        "rights": fc.RESEARCH_ONLY_NOTE,
        "cells": [],
    }
    previews, labels = [], []
    for (x0, y0, x1, y1), (direction, pose) in zip(boxes, names):
        cell = sheet[y0:y1, x0:x1]
        bg, _ = fm.estimate_background(cell[..., :3])
        if args.label_crop == "none":
            bands = []
        elif args.label_crop == "auto":
            bands = label_bands(cell[..., :3], bg, args.tol, args.label_max_height, args.label_edge_fraction)
        else:
            top, bottom = fc.parse_numbers(args.label_crop, 2, int)
            bands = [(0, top)] + ([(cell.shape[0] - bottom, cell.shape[0])] if bottom else [])
        soft = args.soft if args.art_kind == "painted" else args.tol + 1
        rgba, stats = fm.matte(cell, tol=args.tol, soft=soft, u2net=u2net, min_area=args.min_area, blank_rows=bands)
        target = out_dir / direction / f"{pose}.png" if pose else out_dir / f"{direction}.png"
        fc.save_rgba(rgba, target)
        manifest["cells"].append({
            "direction": direction, "pose": pose, "file": str(target.relative_to(out_dir)).replace("\\", "/"),
            "cell_box": [x0, y0, x1, y1], "label_rows_removed": [list(b) for b in bands],
            "alpha_bbox": fc.alpha_bbox(rgba), "rgba_sha256": fc.sha256_rgba(rgba), "matte": stats,
        })
        previews.append(rgba)
        labels.append(f"{direction} {pose}".strip())

    columns = 1 if args.region else args.cols
    fc.contact_sheet(previews, labels, columns, "checker").save(out_dir / "QA_CHECKER.png")
    fc.contact_sheet(previews, labels, columns, "#1B2230").save(out_dir / "QA_DARK_HALO.png")
    worst = min((c["matte"].get("white_kept_ratio") for c in manifest["cells"] if c["matte"].get("white_kept_ratio") is not None), default=None)
    manifest["summary"] = {
        "cells": len(manifest["cells"]),
        "label_bands_removed": sum(len(c["label_rows_removed"]) for c in manifest["cells"]),
        "worst_white_kept_ratio": worst,
        "warnings": sorted({v for c in manifest["cells"] for k, v in c["matte"].items() if k.startswith("warning")}),
    }
    fc.write_json(out_dir / "split_manifest.json", manifest)
    print(f"{len(manifest['cells'])} frames -> {out_dir}  label bands removed: "
          f"{manifest['summary']['label_bands_removed']}  worst white kept: {worst}")


if __name__ == "__main__":
    main()
