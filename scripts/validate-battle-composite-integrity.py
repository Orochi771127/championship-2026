#!/usr/bin/env python3
"""Composite-integrity gate for battle field art batches.

The existing batch tests check provenance and geometry — batch status, image
dimensions, dependency hashes, object-layer separation, layout bands, runtime
absence. All of those can pass while the delivered art is visibly broken, because
none of them looks at the composite.

This gate looks at the composite. It exists because the R5 batch passed 12/12 of
its own tests while shipping a white matte halo on every silhouette edge and four
of the six canonical combat slots painted onto scenery.

Six checks, each measuring one failure mode observed in review:

  1 MATTE      the shared layer's soft edge must carry the layer's own colour.
               An un-keyed cutout keeps its authoring backdrop and haloes over
               every dark field.
  2 HALO       the same defect measured through the composite, per field, so a
               layer fix is confirmed where it actually matters.
  3 SLOTS      all six canonical standing positions must sit on continuous
               combat floor. This one is gameplay, not taste: a slot on scenery
               puts a character inside a wall.
  4 ADAPTATION the shared layer must be graded per scene. A ring that is
               byte-identical in every field cannot be lit by any of them.
  5 GROUNDING  a structure standing on ground occludes light near its base.
               A flat luminance profile outward from the silhouette means the
               ring is floating.
  6 CHROMA     saturation must stay close to the original's, measured against
               ROM-derived per-field statistics rather than taste.

Thresholds are stated as constants below with the reasoning for each.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageFilter

# --- thresholds ------------------------------------------------------------
# A correctly keyed soft edge interpolates toward the layer's own body colour,
# so the residual should be small. R5's edge ran +77.8 over its body.
MATTE_EDGE_EXCESS_MAX = 12.0
# Composite-side halo. R5 measured +59.6 (BM08) down to +10.6 (BM09).
HALO_MAX = 12.0
# Slot interior vs arena-centre floor. R5's failures ran 22.8-35.6; a slot on
# genuinely varied ground (lava cracks, worn sand) stays well under 20.
SLOT_FLOOR_DE_MAX = 20.0
# Spread of the composited ring's mean Lab across the batch. Zero means the same
# bitmap was pasted into every scene.
ADAPTATION_MIN_SPREAD = 3.0
# Luminance drop from the far band to the band nearest the silhouette.
GROUNDING_MIN_DROP = 4.0
# Fraction of the original field's mean saturation the rebuild must retain.
# R5 held 0.60 overall and 0.28 on BM11.
CHROMA_RATIO_MIN = 0.80

LUMA = np.array([0.2126, 0.7152, 0.0722])


# --- helpers ---------------------------------------------------------------
def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    image = Image.fromarray((mask * 255).astype(np.uint8))
    return np.array(image.filter(ImageFilter.MaxFilter(2 * radius + 1))) > 127


def box_mean(values: np.ndarray, mask: np.ndarray, radius: int) -> np.ndarray:
    """Mean of `values` over masked pixels in a (2r+1) box, via integral images."""
    weighted = np.where(mask, values, 0.0)
    counts = mask.astype(np.float64)

    def integral(a: np.ndarray) -> np.ndarray:
        return np.pad(a, ((1, 0), (1, 0))).cumsum(0).cumsum(1)

    si, ci = integral(weighted), integral(counts)
    h, w = values.shape
    y0 = np.clip(np.arange(h) - radius, 0, h)
    y1 = np.clip(np.arange(h) + radius + 1, 0, h)
    x0 = np.clip(np.arange(w) - radius, 0, w)
    x1 = np.clip(np.arange(w) + radius + 1, 0, w)

    def window(acc: np.ndarray) -> np.ndarray:
        return (acc[np.ix_(y1, x1)] - acc[np.ix_(y0, x1)]
                - acc[np.ix_(y1, x0)] + acc[np.ix_(y0, x0)])

    total, count = window(si), window(ci)
    return np.where(count > 0, total / np.maximum(count, 1e-9), np.nan)


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def saturation_percent(rgb: np.ndarray) -> float:
    rgb = rgb.astype(np.float64)
    high, low = rgb.max(-1), rgb.min(-1)
    return float((np.where(high > 0, (high - low) / np.maximum(high, 1), 0.0) * 100).mean())


def find_slots(alpha: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Locate the canonical standing circles: soft strokes inside the ring."""
    h, w = alpha.shape
    interior = np.zeros_like(alpha, bool)
    interior[int(h * 0.32):int(h * 0.70), int(w * 0.19):int(w * 0.85)] = True
    candidate = (alpha > 0) & (alpha < 250) & interior
    seen = np.zeros(alpha.shape, bool)
    boxes = []
    for sy, sx in zip(*np.where(candidate)):
        if seen[sy, sx]:
            continue
        queue, pixels = deque([(sy, sx)]), []
        seen[sy, sx] = True
        while queue:
            y, x = queue.popleft()
            pixels.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        if len(pixels) > 400:
            p = np.array(pixels)
            boxes.append((int(p[:, 1].min()), int(p[:, 0].min()), int(p[:, 1].max()), int(p[:, 0].max())))
    boxes.sort(key=lambda b: ((b[1] + b[3]) // 120, b[0]))
    return boxes


# --- checks ----------------------------------------------------------------
def check_matte(shared_rgb: np.ndarray, alpha: np.ndarray) -> dict[str, Any]:
    solid, edge = alpha >= 250, (alpha > 0) & (alpha < 250)
    luma = shared_rgb @ LUMA
    body = box_mean(luma, solid, 12)
    excess = luma[edge] - body[edge]
    excess = excess[~np.isnan(excess)]
    value = float(excess.mean())
    return {
        "check": "MATTE",
        "metric": "edge luma minus local body luma",
        "value": round(value, 1),
        "threshold": MATTE_EDGE_EXCESS_MAX,
        "passed": bool(value <= MATTE_EDGE_EXCESS_MAX),
        "detail": (
            f"edge luma {luma[edge].mean():.1f} vs local body {np.nanmean(body[edge]):.1f}. "
            "A positive excess means the cutout kept a lighter authoring backdrop."
        ),
    }


def check_per_field(shared_rgb, alpha, composites, backgrounds, baseline) -> list[dict[str, Any]]:
    solid, edge = alpha >= 250, (alpha > 0) & (alpha < 250)
    beyond = dilate(alpha > 0, 12) & ~dilate(alpha > 0, 4)
    near_band = dilate(alpha > 0, 8) & ~(alpha > 0)
    far_band = dilate(alpha > 0, 70) & ~dilate(alpha > 0, 40)
    slots = find_slots(alpha)
    ring_labs, results = {}, []

    for field, composite in sorted(composites.items()):
        c = composite.astype(np.float64)
        luma = c @ LUMA
        row: dict[str, Any] = {"field": field, "checks": []}

        halo = float(luma[edge].mean() - luma[beyond].mean())
        row["checks"].append({
            "check": "HALO", "metric": "edge band luma minus background beyond",
            "value": round(halo, 1), "threshold": HALO_MAX, "passed": bool(abs(halo) <= HALO_MAX),
        })

        ring_labs[field] = srgb_to_lab(c[solid]).mean(axis=0)

        bg = backgrounds.get(field)
        if bg is not None and slots:
            b = bg.astype(np.float64)
            h, w = luma.shape
            reference = srgb_to_lab(b[int(h * 0.58):int(h * 0.68), int(w * 0.45):int(w * 0.59)].reshape(-1, 3)).mean(0)
            worst, offenders = 0.0, []
            for index, (x0, y0, x1, y1) in enumerate(slots, start=1):
                patch = srgb_to_lab(b[y0:y1 + 1, x0:x1 + 1].reshape(-1, 3)).mean(0)
                delta = float(np.sqrt(((patch - reference) ** 2).sum()))
                if delta > SLOT_FLOOR_DE_MAX:
                    offenders.append(f"slot{index} dE {delta:.1f}")
                worst = max(worst, delta)
            row["checks"].append({
                "check": "SLOTS", "metric": f"worst of {len(slots)} slots, dE to arena-centre floor",
                "value": round(worst, 1), "threshold": SLOT_FLOOR_DE_MAX,
                "passed": not offenders,
                "detail": "; ".join(offenders) or "all slots on continuous floor",
            })

        drop = float(luma[far_band].mean() - luma[near_band].mean())
        row["checks"].append({
            "check": "GROUNDING", "metric": "far-band luma minus near-band luma",
            "value": round(drop, 1), "threshold": GROUNDING_MIN_DROP, "passed": bool(drop >= GROUNDING_MIN_DROP),
        })

        original = baseline.get("fields", {}).get(field)
        if original and bg is not None:
            ratio = saturation_percent(bg) / max(original["meanSaturationPercent"], 1e-6)
            row["checks"].append({
                "check": "CHROMA", "metric": "saturation as a fraction of the original field",
                "value": round(ratio, 2), "threshold": CHROMA_RATIO_MIN, "passed": bool(ratio >= CHROMA_RATIO_MIN),
                "detail": f"rebuild {saturation_percent(bg):.1f}% vs original {original['meanSaturationPercent']:.1f}%",
            })
        results.append(row)

    if len(ring_labs) > 1:
        stacked = np.stack(list(ring_labs.values()))
        spread = float(np.sqrt(((stacked - stacked.mean(0)) ** 2).sum(1)).mean())
        results.append({"field": "(batch)", "checks": [{
            "check": "ADAPTATION", "metric": "mean dE of the composited ring from its cross-field average",
            "value": round(spread, 2), "threshold": ADAPTATION_MIN_SPREAD,
            "passed": bool(spread >= ADAPTATION_MIN_SPREAD),
            "detail": "Zero means one bitmap was pasted into every scene with no per-scene grading.",
        }]})
    return results


# --- driver ----------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--batch", type=Path, default=Path("docs/art/production/battle/human-paint-static-r5"))
    parser.add_argument("--baseline", type=Path, default=Path("docs/art/BATTLE_FIELD_ORIGINAL_COLOR_BASELINE.json"))
    parser.add_argument("--report", type=Path, default=None, help="write the findings as JSON")
    arguments = parser.parse_args()

    manifest = json.loads((arguments.batch / "manifest.json").read_text(encoding="utf-8"))
    baseline = json.loads(arguments.baseline.read_text(encoding="utf-8")) if arguments.baseline.is_file() else {}

    shared_path = Path(manifest["sharedLayer"]["file"])
    shared = np.array(Image.open(shared_path).convert("RGBA"))
    shared_rgb, alpha = shared[..., :3].astype(np.float64), shared[..., 3]

    composites, backgrounds = {}, {}
    for asset in manifest["assets"]:
        field = asset["fieldId"].replace("field_", "").replace("_01", "")
        composites[field] = np.array(Image.open(Path(asset["composites"][0]["file"])).convert("RGB"))
        backgrounds[field] = np.array(Image.open(Path(asset["background"]["file"])).convert("RGB"))

    findings = [check_matte(shared_rgb, alpha)]
    per_field = check_per_field(shared_rgb, alpha, composites, backgrounds, baseline)

    print(f"Composite-integrity gate — {manifest['batchId']}")
    print(f"shared layer: {shared_path}\n")
    matte = findings[0]
    print(f"[{'PASS' if matte['passed'] else 'FAIL'}] MATTE       {matte['value']:+7.1f}  "
          f"(max {matte['threshold']:.0f})  {matte['detail']}\n")

    print(f"{'field':<9}{'HALO':>9}{'SLOTS':>9}{'GROUND':>9}{'CHROMA':>9}   notes")
    failures = 0 if matte["passed"] else 1
    for row in per_field:
        by_name = {c["check"]: c for c in row["checks"]}
        cells, notes = [], []
        for name in ("HALO", "SLOTS", "GROUNDING", "CHROMA"):
            c = by_name.get(name)
            if not c:
                cells.append(f"{'-':>9}")
                continue
            failures += 0 if c["passed"] else 1
            cells.append(f"{c['value']:>8.1f}{'' if c['passed'] else '!'}")
            if not c["passed"] and c.get("detail"):
                notes.append(c["detail"])
        if "ADAPTATION" in by_name:
            c = by_name["ADAPTATION"]
            failures += 0 if c["passed"] else 1
            print(f"\n[{'PASS' if c['passed'] else 'FAIL'}] ADAPTATION  {c['value']:+7.2f}  "
                  f"(min {c['threshold']:.0f})  {c['detail']}")
            continue
        print(f"{row['field']:<9}{''.join(cells)}   {'; '.join(notes)}")
    print("\n'!' marks a value outside its threshold.")

    report = {
        "batchId": manifest["batchId"],
        "sharedLayer": str(shared_path).replace("\\", "/"),
        "thresholds": {
            "matteEdgeExcessMax": MATTE_EDGE_EXCESS_MAX, "haloMax": HALO_MAX,
            "slotFloorDeMax": SLOT_FLOOR_DE_MAX, "adaptationMinSpread": ADAPTATION_MIN_SPREAD,
            "groundingMinDrop": GROUNDING_MIN_DROP, "chromaRatioMin": CHROMA_RATIO_MIN,
        },
        "shared": findings,
        "perField": per_field,
        "failures": failures,
        "passed": failures == 0,
    }
    if arguments.report:
        arguments.report.parent.mkdir(parents=True, exist_ok=True)
        with arguments.report.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(f"report: {arguments.report}")

    if failures:
        print(f"\nFAILED — {failures} check(s) outside threshold.")
        return 1
    print("\nPASSED — composite integrity within thresholds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
