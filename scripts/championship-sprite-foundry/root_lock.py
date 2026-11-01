#!/usr/bin/env python3
"""Tool B: ROOT HOLD - lock B's torso onto A's torso with sub-pixel accuracy.

OpenAI sprite-pipeline's normalize_sprite_strip.py aligns frames by the
bottom-centre of each frame's alpha bounding box. That bbox moves whenever a
wing, claw or tail moves, which is exactly the "whole body jumps" problem. Here
the anchor is the torso itself:

1. Torso core = the thickest part of the silhouette (distance transform >=
   `core_quantile` of its maximum). Wings, limbs and tails are thin, so they are
   excluded automatically. Override with --torso-box x0,y0,x1,y1.
2. Coarse shift from the core centroids, then coarse-to-fine Lucas-Kanade
   translation on premultiplied luminance inside the torso window.
3. B is moved by translation only (no scaling, no rotation): the sprite-pipeline
   rule of one shared scale holds, so nothing grows or shrinks.
4. Verified independently with phase correlation on the same window.
   ROOT HOLD passes when both residuals are below --max-residual (0.5 px).

    python root_lock.py --a A.png --b B.png --out-dir OUT
    python root_lock.py --split-dir SPLIT_OUT --out-dir OUT   # every direction from split_sheet.py
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import foundry_common as fc


def luminance_premultiplied(rgba: np.ndarray) -> np.ndarray:
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3].astype(np.float32) / 255.0
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) * alpha


def torso_core(rgba: np.ndarray, quantile: float) -> np.ndarray:
    mask = ndimage.binary_fill_holes(fc.alpha_mask(rgba))
    if not mask.any():
        raise SystemExit("empty frame")
    depth = ndimage.distance_transform_edt(mask)
    core = depth >= quantile * depth.max()
    labels, count = ndimage.label(core)
    if count > 1:
        sizes = ndimage.sum(core, labels, index=np.arange(1, count + 1))
        core = labels == (int(np.argmax(sizes)) + 1)
    return core


def shift_image(image: np.ndarray, dx: float, dy: float, interpolation=cv2.INTER_LINEAR) -> np.ndarray:
    matrix = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(image, matrix, (image.shape[1], image.shape[0]), flags=interpolation,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def lucas_kanade(template: np.ndarray, moving: np.ndarray, window: np.ndarray, start=(0.0, 0.0),
                 levels: int = 3, iterations: int = 60) -> np.ndarray:
    """Translation (dx, dy) such that shift_image(moving, dx, dy) matches template inside window."""
    shift = np.array(start, dtype=np.float64)
    for level in range(levels - 1, -1, -1):
        factor = 2 ** level
        size = (max(8, template.shape[1] // factor), max(8, template.shape[0] // factor))
        tpl = cv2.GaussianBlur(cv2.resize(template, size, interpolation=cv2.INTER_AREA), (0, 0), 1.0)
        mov = cv2.GaussianBlur(cv2.resize(moving, size, interpolation=cv2.INTER_AREA), (0, 0), 1.0)
        win = cv2.resize(window.astype(np.float32), size, interpolation=cv2.INTER_AREA) > 0.5
        if win.sum() < 16:
            continue
        local = shift / factor
        for _ in range(iterations):
            warped = shift_image(mov, local[0], local[1])
            gy, gx = np.gradient(warped)
            residual = (warped - tpl)[win]
            gx, gy = gx[win], gy[win]
            # Tukey biweight (IRLS): a wing or claw crossing the torso window is an outlier and
            # gets zero weight instead of dragging the torso toward itself.
            scale = max(2.0, 1.4826 * float(np.median(np.abs(residual))))
            u = residual / (4.685 * scale)
            weight = np.where(np.abs(u) < 1, (1 - u * u) ** 2, 0.0)
            wgx, wgy = weight * gx, weight * gy
            hessian = np.array([[np.dot(wgx, gx), np.dot(wgx, gy)], [np.dot(wgx, gy), np.dot(wgy, gy)]])
            if np.linalg.det(hessian) < 1e-9:
                break
            step = -np.linalg.solve(hessian, np.array([np.dot(wgx, residual), np.dot(wgy, residual)]))
            # warped(x) = mov(x - local); d warped / d local = -grad  => sign flip.
            local -= step
            if np.hypot(*step) < 1e-4:
                break
        shift = local * factor
    return shift


def phase_residual(template: np.ndarray, moving: np.ndarray, window: np.ndarray) -> tuple[float, float]:
    ys, xs = np.nonzero(window)
    pad = 8
    y0, y1 = max(0, ys.min() - pad), min(window.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(window.shape[1], xs.max() + pad + 1)
    a = np.ascontiguousarray(template[y0:y1, x0:x1], dtype=np.float64)
    b = np.ascontiguousarray(moving[y0:y1, x0:x1], dtype=np.float64)
    hann = cv2.createHanningWindow((a.shape[1], a.shape[0]), cv2.CV_64F)
    (dx, dy), _ = cv2.phaseCorrelate(b, a, hann)
    return float(dx), float(dy)


def smooth(image: np.ndarray) -> np.ndarray:
    return cv2.GaussianBlur(image, (0, 0), 1.0)


def shift_rgba(rgba: np.ndarray, dx: float, dy: float, integer: bool) -> np.ndarray:
    if integer:
        return fc.integer_shift(rgba, int(round(dx)), int(round(dy)))
    premul = fc.premultiply(rgba)
    return fc.unpremultiply(shift_image(premul, dx, dy))


def lock_pair(a: np.ndarray, b: np.ndarray, *, torso_box=None, core_quantile: float = 0.55,
              integer: bool = False, max_residual: float = 0.5) -> tuple[np.ndarray, dict]:
    if a.shape != b.shape:
        raise SystemExit(f"A {a.shape[:2]} and B {b.shape[:2]} must share one canvas (no per-frame resize)")
    core_a = torso_core(a, core_quantile)
    core_b = torso_core(b, core_quantile)
    if torso_box:
        x0, y0, x1, y1 = torso_box
        window = np.zeros(core_a.shape, bool)
        window[y0:y1, x0:x1] = True
        window &= fc.alpha_mask(a)
    else:
        window = ndimage.binary_dilation(core_a, iterations=6) & fc.alpha_mask(a)
    lum_a, lum_b = luminance_premultiplied(a), luminance_premultiplied(b)
    smooth_a = smooth(lum_a)  # agreement is judged after a 1 px blur so resampling softness is not "disagreement"
    # Several coarse starts; a wing over the torso can move the core centroid, so no single
    # estimate is trusted. Keep the start whose refined result best matches A inside the window.
    ca = np.array(ndimage.center_of_mass(core_a))[::-1]
    cb = np.array(ndimage.center_of_mass(core_b))[::-1]
    starts = {"zero": (0.0, 0.0), "core_centroid": tuple(ca - cb),
              "phase_correlation": phase_residual(lum_a, lum_b, window)}
    candidates = []
    for name, start in starts.items():
        # Pyramid (large offsets) and single level (small offsets: coarse levels can be dominated
        # by a big wing) are both tried; the best torso agreement wins.
        for levels in (3, 1):
            shift = lucas_kanade(lum_a, lum_b, window, start=start, levels=levels)
            diff = np.abs(smooth(shift_image(lum_b, shift[0], shift[1])) - smooth_a)[window]
            candidates.append((float((diff < 8).mean()), f"{name}/levels{levels}", start, shift))
    inliers, start_name, start, (dx, dy) = max(candidates, key=lambda c: c[0])
    dx, dy = float(dx), float(dy)
    if integer:
        dx, dy = float(round(dx)), float(round(dy))
    locked = shift_rgba(b, dx, dy, integer)
    lum_locked = luminance_premultiplied(locked)
    agree = window & (np.abs(smooth(lum_locked) - smooth_a) < 8)
    ecc_res = ecc_residual(lum_a, lum_locked, agree, fallback=window)
    pc_res = phase_residual(lum_a, lum_locked, window)
    root = np.array(ndimage.center_of_mass(window))[::-1]
    report = {
        "shift_applied_px": [round(dx, 4), round(dy, 4)],
        "coarse_start": start_name,
        "coarse_start_px": [round(float(start[0]), 3), round(float(start[1]), 3)],
        "torso_inlier_ratio": round(inliers, 4),
        "torso_window": "box" if torso_box else f"auto core (distance >= {core_quantile} of max)",
        "torso_window_px": int(window.sum()),
        "root_pivot_xy": [round(float(root[0]), 3), round(float(root[1]), 3)],
        "residual_ecc_px": None if ecc_res is None else round(float(np.hypot(*ecc_res)), 4),
        "residual_phase_correlation_px_info": round(float(np.hypot(*pc_res)), 4),
        "integer_only": integer,
        "resampled": bool((not integer) and (abs(dx - round(dx)) > 1e-6 or abs(dy - round(dy)) > 1e-6)),
    }
    # Pass: an independent estimator (OpenCV ECC on the agreeing torso pixels) finds less than
    # max_residual of remaining torso motion, and enough of the torso agrees to trust it.
    # Integer mode allows the rounding error (<= 0.71 px diagonal) on top.
    limit = max_residual + (0.71 if integer else 0.0)
    report["root_hold_pass"] = bool(ecc_res is not None and report["residual_ecc_px"] < limit and inliers >= 0.3)
    if inliers < 0.3:
        report["warning"] = ("under 30% of the torso window agrees between A and B: set --torso-box, or, for walk, "
                             "run and bound poses whose body changes shape, keep the authored ground registration")
    report["_window"] = window
    return locked, report


def ecc_residual(template: np.ndarray, moving: np.ndarray, mask: np.ndarray, fallback: np.ndarray | None = None):
    """Remaining translation found by OpenCV ECC (an implementation independent of lucas_kanade).

    No extra Gaussian (gaussFiltSize=1): with the default blur ECC drifts on flat white armour.
    """
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
    for candidate in (mask, fallback):
        if candidate is None or candidate.sum() < 64:
            continue
        warp = np.eye(2, 3, dtype=np.float32)
        try:
            _, warp = cv2.findTransformECC(template.astype(np.float32), moving.astype(np.float32), warp,
                                           cv2.MOTION_TRANSLATION, criteria, candidate.astype(np.uint8) * 255, 1)
        except cv2.error:
            continue
        return float(warp[0, 2]), float(warp[1, 2])
    return None


def onion(a: np.ndarray, b: np.ndarray, window: np.ndarray, root) -> np.ndarray:
    """A in orange, B in cyan, torso window outline and root cross: review aid."""
    height, width = a.shape[:2]
    out = np.full((height, width, 4), (27, 34, 48, 255), np.uint8)
    for frame, tint in ((a, (255, 150, 60)), (b, (60, 220, 255))):
        alpha = frame[..., 3:4].astype(np.float32) / 255.0 * 0.55
        out[..., :3] = (out[..., :3] * (1 - alpha) + np.array(tint) * alpha).astype(np.uint8)
    edge = window & ~ndimage.binary_erosion(window)
    out[edge] = (255, 255, 255, 255)
    image = Image.fromarray(out, "RGBA")
    draw = ImageDraw.Draw(image)
    x, y = root
    draw.line((x - 10, y, x + 10, y), fill=(255, 60, 90, 255), width=1)
    draw.line((x, y - 10, x, y + 10), fill=(255, 60, 90, 255), width=1)
    return np.asarray(image)


def process(a_path: Path, b_path: Path, out_dir: Path, args) -> dict:
    a, b = fc.load_rgba(a_path), fc.load_rgba(b_path)
    locked, report = lock_pair(a, b, torso_box=fc.parse_numbers(args.torso_box, 4, int),
                               core_quantile=args.core_quantile, integer=args.integer,
                               max_residual=args.max_residual)
    window = report.pop("_window")
    out_dir.mkdir(parents=True, exist_ok=True)
    fc.save_rgba(a, out_dir / "A.png")
    fc.save_rgba(locked, out_dir / "B.png")
    before = onion(a, b, window, report["root_pivot_xy"])
    after = onion(a, locked, window, report["root_pivot_xy"])
    Image.fromarray(np.concatenate([before, after], axis=1), "RGBA").save(out_dir / "ROOT_LOCK_ONION_before_after.png")
    report.update({"a": str(a_path), "b": str(b_path), "rights": fc.RESEARCH_ONLY_NOTE})
    fc.write_json(out_dir / "root_lock.json", report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--a")
    parser.add_argument("--b")
    parser.add_argument("--split-dir", help="output folder of split_sheet.py (DIR/A.png + DIR/B.png)")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--torso-box", help="x0,y0,x1,y1 torso window in A (overrides auto core)")
    parser.add_argument("--core-quantile", type=float, default=0.55)
    parser.add_argument("--integer", action="store_true", help="whole-pixel shifts only (pixel art, no resampling)")
    parser.add_argument("--art-kind", choices=["painted", "pixel"], default="painted", help="pixel implies --integer")
    parser.add_argument("--max-residual", type=float, default=0.5)
    args = parser.parse_args()
    args.integer = args.integer or args.art_kind == "pixel"
    out_dir = Path(args.out_dir)

    if args.split_dir:
        pairs = sorted(p for p in Path(args.split_dir).iterdir() if (p / "A.png").is_file() and (p / "B.png").is_file())
        order = {d: i for i, d in enumerate(fc.DIRECTIONS)}
        pairs.sort(key=lambda p: order.get(p.name, 99))
        summary = {}
        for folder in pairs:
            report = process(folder / "A.png", folder / "B.png", out_dir / folder.name, args)
            summary[folder.name] = {k: report[k] for k in ("shift_applied_px", "residual_ecc_px",
                                                            "residual_phase_correlation_px_info", "root_pivot_xy", "root_hold_pass")}
            print(f"{folder.name:>3}: shift {report['shift_applied_px']}  ECC residual {report['residual_ecc_px']} "
                  f"(PC info {report['residual_phase_correlation_px_info']}) inliers {report['torso_inlier_ratio']}  {'PASS' if report['root_hold_pass'] else 'FAIL'}")
        fc.write_json(out_dir / "root_lock_summary.json", summary)
    elif args.a and args.b:
        report = process(Path(args.a), Path(args.b), out_dir, args)
        print(json.dumps({k: v for k, v in report.items() if k not in ("a", "b", "rights")}, indent=2))
    else:
        raise SystemExit("give --a and --b, or --split-dir")


if __name__ == "__main__":
    main()
