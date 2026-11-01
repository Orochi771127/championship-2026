#!/usr/bin/env python3
"""Tool C: tween two authored keys into a six-event 60 fps loop.

Keys: A = event 1/6, B = event 4/6 (root-locked by root_lock.py). Events 1 and 4
are the authored pixels, bit for bit. Events 2, 3, 5, 6 are machine tweens for
review, not final art.

Method - pivot sub-part warping:

1. Static core = pixels opaque and alike in both keys (the torso after ROOT
   HOLD). It is never moved, so the root stays put in every tween.
2. Moving parts = opaque regions outside the core (wings, arms, tail), one
   connected component each, matched A<->B by where they join the core.
3. Each matched part gets a pivot (centre of its joint with the core) and a
   similarity transform about it (angle + foreshortening scale), fitted by
   silhouette IoU.
4. Tween at t: A's parts rotated forward by t, B's parts rotated back by
   (1 - t), each over its own key with uncovered pixels filled from the other
   key's static core, then cross-faded with smoothstep over --xfade. Because
   both layers show each part at the same angle, the fade has little ghosting.
5. Optional smear on fast events: a short trail of earlier angles behind the
   sharp part.

Timing follows character-animation's animation-fluidity reference: uneven holds
(anticipation and apex hold about 1.4x, fast snap about 0.7x), converted to
whole 60 fps ticks that always sum to the loop length.

    python tween_events.py --a A.png --b B.png --out-dir OUT [--loop-ms 800 --fps 60]
    python tween_events.py --lock-dir ROOT_LOCK_OUT --out-dir OUT    # all directions
"""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage

import foundry_common as fc
import root_lock

DEFAULT_T = "0,0.3,0.75,1,0.65,0.25"          # fraction toward B for events 1..6
DEFAULT_WEIGHTS = "1.4,0.7,0.7,1.4,0.9,0.9"  # anticipation, fast snap x2, apex hold, settle x2
EDGE_PX = 2


def smoothstep(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def largest(mask: np.ndarray) -> np.ndarray:
    labels, count = ndimage.label(mask)
    if count <= 1:
        return mask
    sizes = ndimage.sum(mask, labels, index=np.arange(1, count + 1))
    return labels == (int(np.argmax(sizes)) + 1)


def analyse(a: np.ndarray, b: np.ndarray, diff_threshold: float, min_part_area: int, pivot_search: int) -> dict:
    alpha_a, alpha_b = fc.alpha_mask(a), fc.alpha_mask(b)
    colour = np.abs(a[..., :3].astype(np.int16) - b[..., :3].astype(np.int16)).max(axis=-1)
    same = alpha_a & alpha_b & (colour < diff_threshold)
    core = largest(ndimage.binary_opening(same, iterations=2))
    core_zone = ndimage.binary_dilation(core, iterations=1)

    def parts(alpha: np.ndarray) -> list[dict]:
        labels, count = ndimage.label(alpha & ~core_zone, structure=np.ones((3, 3), bool))
        found = []
        for index in range(1, count + 1):
            mask = labels == index
            area = int(mask.sum())
            if area < min_part_area:
                continue
            contact = ndimage.binary_dilation(mask, iterations=pivot_search) & core
            if contact.any():
                pivot = np.array(ndimage.center_of_mass(contact))[::-1]
            else:
                ys, xs = np.nonzero(core)
                centre = np.array(ndimage.center_of_mass(mask))
                nearest = np.argmin((ys - centre[0]) ** 2 + (xs - centre[1]) ** 2)
                pivot = np.array([xs[nearest], ys[nearest]], float)
            found.append({"mask": mask, "area": area, "pivot": pivot,
                          "centroid": np.array(ndimage.center_of_mass(mask))[::-1]})
        return found

    parts_a, parts_b = parts(alpha_a), parts(alpha_b)
    diagonal = math.hypot(*a.shape[:2])
    pairs, used = [], set()
    for ia, pa in sorted(enumerate(parts_a), key=lambda item: -item[1]["area"]):
        best, best_cost = None, None
        for ib, pb in enumerate(parts_b):
            if ib in used:
                continue
            cost = np.hypot(*(pa["pivot"] - pb["pivot"])) / diagonal + abs(math.log(pa["area"] / pb["area"])) * 0.1
            if best_cost is None or cost < best_cost:
                best, best_cost = ib, cost
        if best is not None and best_cost < 0.25:
            used.add(best)
            pairs.append((ia, best))
    return {"core": core, "parts_a": parts_a, "parts_b": parts_b, "pairs": pairs}


def similarity(pivot: np.ndarray, angle_deg: float, scale: float) -> np.ndarray:
    return cv2.getRotationMatrix2D((float(pivot[0]), float(pivot[1])), angle_deg, scale)


def fit_transform(part_a: dict, part_b: dict) -> dict:
    pivot = (part_a["pivot"] + part_b["pivot"]) / 2
    va, vb = part_a["centroid"] - pivot, part_b["centroid"] - pivot
    # Image y points down; cv2 angles are counter-clockwise on screen.
    angle0 = -math.degrees(math.atan2(vb[1], vb[0]) - math.atan2(va[1], va[0]))
    angle0 = (angle0 + 180) % 360 - 180
    scale0 = float(np.clip(np.hypot(*vb) / max(1e-6, np.hypot(*va)), 0.6, 1.6))
    mask_a = part_a["mask"].astype(np.uint8)
    mask_b = part_b["mask"]
    size = (mask_a.shape[1], mask_a.shape[0])

    def iou(angle: float, scale: float) -> float:
        warped = cv2.warpAffine(mask_a, similarity(pivot, angle, scale), size, flags=cv2.INTER_NEAREST) > 0
        union = (warped | mask_b).sum()
        return float((warped & mask_b).sum() / union) if union else 0.0

    best = (iou(angle0, scale0), angle0, scale0)
    for span, step in ((24, 4), (4, 1)):
        _, centre_angle, centre_scale = best
        for angle in np.arange(centre_angle - span, centre_angle + span + 1e-6, step):
            for scale in (centre_scale * 0.92, centre_scale, centre_scale * 1.08):
                score = iou(float(angle), float(np.clip(scale, 0.5, 2.0)))
                if score > best[0]:
                    best = (score, float(angle), float(np.clip(scale, 0.5, 2.0)))
    return {"pivot": pivot, "angle": best[1], "scale": best[2], "iou": best[0]}


def warp_layer(key: np.ndarray, other: np.ndarray, own_parts: list[dict], other_parts: list[dict],
               transforms: list[tuple[int, dict]], amount: float, smear: int, smear_span: float) -> np.ndarray:
    """Key with its matched parts turned by `amount` of their transform; holes filled from the other key."""
    height, width = key.shape[:2]
    moving = np.zeros((height, width), bool)
    for index, _ in transforms:
        moving |= own_parts[index]["mask"]
    other_moving = np.zeros((height, width), bool)
    for part in other_parts:
        other_moving |= part["mask"]
    # Parts are found at alpha > 127; widen by EDGE_PX so their soft outline goes with them
    # (otherwise a faint outline of the old pose stays behind).
    base = fc.premultiply(key)
    base[ndimage.binary_dilation(moving, iterations=EDGE_PX)] = 0
    fill = fc.premultiply(other)
    fill[ndimage.binary_dilation(other_moving, iterations=EDGE_PX)] = 0
    canvas = fc.over(base, fill)
    for index, transform in transforms:
        part = fc.premultiply(key)
        part[~ndimage.binary_dilation(own_parts[index]["mask"], iterations=EDGE_PX)] = 0
        steps = [(amount, 1.0)]
        if smear > 0:
            steps = [(amount - smear_span * (k / smear), 0.35 * (1 - k / (smear + 1))) for k in range(smear, 0, -1)] + steps
        for value, opacity in steps:
            matrix = similarity(transform["pivot"], transform["angle"] * value, transform["scale"] ** value)
            warped = cv2.warpAffine(part, matrix, (width, height), flags=cv2.INTER_LINEAR,
                                    borderMode=cv2.BORDER_CONSTANT, borderValue=0) * opacity
            canvas = fc.over(warped, canvas)
    return canvas


def tween(a: np.ndarray, b: np.ndarray, info: dict, t: float, xfade: tuple[float, float], smear: int,
          smear_span: float) -> np.ndarray:
    if t <= 0:
        return a.copy()
    if t >= 1:
        return b.copy()
    pairs, transforms = info["pairs"], info["transforms"]
    forward = [(ia, transforms[k]) for k, (ia, _) in enumerate(pairs)]
    backward = [(ib, {**transforms[k], "angle": -transforms[k]["angle"], "scale": 1 / transforms[k]["scale"]})
                for k, (_, ib) in enumerate(pairs)]
    layer_a = warp_layer(a, b, info["parts_a"], info["parts_b"], forward, t, smear, smear_span)
    layer_b = warp_layer(b, a, info["parts_b"], info["parts_a"], backward, 1 - t, smear, smear_span)
    weight = smoothstep((t - xfade[0]) / max(1e-6, xfade[1] - xfade[0]))
    return fc.unpremultiply(layer_a * (1 - weight) + layer_b * weight)


def run(a: np.ndarray, b: np.ndarray, out_dir: Path, args, label: str) -> dict:
    t_values = fc.parse_numbers(args.t)
    weights = fc.parse_numbers(args.weights)
    bobs = fc.parse_numbers(args.bob, kind=int) or [0] * len(t_values)
    smear_events = set(fc.parse_numbers(args.smear_events, kind=int) or [])
    if not (len(t_values) == len(weights) == len(bobs)):
        raise SystemExit("--t, --weights and --bob need the same count")
    if args.art_kind == "pixel" and not args.allow_pixel_warp:
        raise SystemExit("pixel art: rotating parts resamples pixels and breaks the grid; author the in-betweens "
                         "or pass --allow-pixel-warp for a throwaway timing preview")
    if args.ticks:
        # Authored source ticks win, verbatim: no averaging, rounding or conversion to milliseconds.
        ticks = fc.parse_numbers(args.ticks, kind=int)
        if len(ticks) != len(t_values) or min(ticks) < 1:
            raise SystemExit("--ticks needs one positive whole number per event")
        timing_source = "AUTHORED --ticks (kept verbatim)"
    else:
        ticks = fc.ticks_from_weights(weights, round(args.loop_ms * args.fps / 1000))
        timing_source = ("PROPOSED from --weights, no source evidence; replace with the authored ticks "
                         "(--ticks) before any handoff")
    total_ticks = sum(ticks)

    info = analyse(a, b, args.diff_threshold, args.min_part_area, args.pivot_search)
    info["transforms"] = [fit_transform(info["parts_a"][ia], info["parts_b"][ib]) for ia, ib in info["pairs"]]
    xfade = tuple(fc.parse_numbers(args.xfade, 2))

    out_dir.mkdir(parents=True, exist_ok=True)
    events, rows = [], []
    window = ndimage.binary_dilation(info["core"], iterations=4) & fc.alpha_mask(a)
    lum_a = root_lock.luminance_premultiplied(a)
    start_tick = 0
    for number, (t, tick_count, bob) in enumerate(zip(t_values, ticks, bobs), start=1):
        smear = args.smear_samples if number in smear_events else 0
        frame = tween(a, b, info, t, xfade, smear, args.smear_span)
        if bob:
            frame = fc.integer_shift(frame, 0, bob)
        fc.save_rgba(frame, out_dir / f"event_{number}.png")
        events.append(frame)
        drift = root_lock.ecc_residual(lum_a, root_lock.luminance_premultiplied(fc.integer_shift(frame, 0, -bob)), window)
        partial = (frame[..., 3] > 24) & (frame[..., 3] < 230)
        rows.append({
            "event": f"{number}/{len(t_values)}", "t_toward_B": t, "authored": t in (0.0, 1.0),
            "ticks": tick_count, "start_tick": start_tick, "ms_derived": round(tick_count * 1000 / args.fps, 4),
            "bob_px": bob, "smear": bool(smear), "rgba_sha256": fc.sha256_rgba(frame),
            "root_drift_px": None if drift is None else round(float(np.hypot(*drift)), 4),
            "semi_transparent_px": int(partial.sum()),
        })
        start_tick += tick_count

    tick_frames = [events[i] for i, count in enumerate(ticks) for _ in range(count)]
    if args.write_ticks:
        for index, frame in enumerate(tick_frames):
            fc.save_rgba(frame, out_dir / "ticks" / f"tick_{index:03d}.png")
    fc.save_gif(events, [row["ms_derived"] for row in rows], out_dir / "preview_events.gif")
    mp4 = None
    if args.mp4 and shutil.which("ffmpeg"):
        tick_dir = out_dir / "ticks"
        if not args.write_ticks:
            for index, frame in enumerate(tick_frames):
                fc.save_rgba(frame, tick_dir / f"tick_{index:03d}.png")
        mp4 = out_dir / f"{label}_{total_ticks}TICKS_{args.fps}FPS.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(args.fps), "-i", str(tick_dir / "tick_%03d.png"),
                        "-vf", "format=yuva420p,geq=r='r(X,Y)':a='alpha(X,Y)',premultiply=inplace=1,pad=ceil(iw/2)*2:ceil(ih/2)*2:color=#1B2230",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(args.fps), str(mp4)], check=False)
        if not args.write_ticks:
            shutil.rmtree(tick_dir, ignore_errors=True)
    sheet = fc.contact_sheet(events, [f"{label} event {r['event']} {r['ticks']}t" for r in rows], len(events), "#1B2230")
    sheet.save(out_dir / "EVENTS_SHEET.png")

    timeline = {
        "tool": "championship-sprite-foundry/tween_events.py", "label": label,
        "status": "DRAFT machine tweens for review; events with authored=true are the input keys bit for bit",
        "fps": args.fps, "total_ticks": total_ticks, "timing_source": timing_source,
        "art_kind": args.art_kind, "sampling": fc.sampling_for(args.art_kind),
        "mirror": "none: an asymmetric character is never mirrored to fill a direction without Owner approval",
        "weights": weights, "xfade": list(xfade), "events": rows,
        "core_px": int(info["core"].sum()),
        "parts": [{"pivot_xy": [round(float(v), 2) for v in tr["pivot"]], "angle_deg": round(tr["angle"], 2),
                   "scale": round(tr["scale"], 3), "silhouette_iou": round(tr["iou"], 3),
                   "area_a": info["parts_a"][ia]["area"], "area_b": info["parts_b"][ib]["area"]}
                  for (ia, ib), tr in zip(info["pairs"], info["transforms"])],
        "unmatched_parts": {"a": len(info["parts_a"]) - len(info["pairs"]), "b": len(info["parts_b"]) - len(info["pairs"])},
        "mp4": str(mp4) if mp4 else None, "rights": fc.RESEARCH_ONLY_NOTE,
    }
    fc.write_json(out_dir / "timeline.json", timeline)
    return timeline


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--a")
    parser.add_argument("--b")
    parser.add_argument("--lock-dir", help="root_lock.py output (DIR/A.png + DIR/B.png)")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--label", default="tween")
    parser.add_argument("--loop-ms", type=int, default=800)
    parser.add_argument("--fps", type=int, default=60)
    parser.add_argument("--t", default=DEFAULT_T, help="fraction toward B per event")
    parser.add_argument("--weights", default=DEFAULT_WEIGHTS, help="relative hold per event (a proposal; --ticks wins)")
    parser.add_argument("--ticks", help="authored 60 fps ticks per event from the source, e.g. 6,4,6,6,4,6 - kept verbatim")
    parser.add_argument("--art-kind", choices=["painted", "pixel"], default="painted")
    parser.add_argument("--allow-pixel-warp", action="store_true")
    parser.add_argument("--bob", default=None, help="whole-pixel vertical bob per event, e.g. 0,-2,-3,0,2,1 (moves the root on purpose)")
    parser.add_argument("--xfade", default="0.45,0.55", help="t range where the two warped keys cross-fade; outside it each tween warps only the nearer key (no ghosting)")
    parser.add_argument("--smear-events", default="3", help="events that get a motion smear, e.g. 3,6")
    parser.add_argument("--smear-samples", type=int, default=3)
    parser.add_argument("--smear-span", type=float, default=0.18, help="trail length as a fraction of the A->B turn")
    parser.add_argument("--diff-threshold", type=float, default=40)
    parser.add_argument("--min-part-area", type=int, default=150)
    parser.add_argument("--pivot-search", type=int, default=6)
    parser.add_argument("--write-ticks", action="store_true")
    parser.add_argument("--mp4", action="store_true", help="also write a 60 fps MP4 with local ffmpeg")
    args = parser.parse_args()

    if args.lock_dir:
        order = {d: i for i, d in enumerate(fc.DIRECTIONS)}
        folders = sorted((p for p in Path(args.lock_dir).iterdir() if (p / "A.png").is_file() and (p / "B.png").is_file()),
                         key=lambda p: order.get(p.name, 99))
        sheets, names = [], []
        for folder in folders:
            timeline = run(fc.load_rgba(folder / "A.png"), fc.load_rgba(folder / "B.png"), Path(args.out_dir) / folder.name, args, folder.name)
            drift = max((e["root_drift_px"] or 0) for e in timeline["events"])
            print(f"{folder.name:>3}: parts {len(timeline['parts'])}  max root drift {drift} px  ticks {[e['ticks'] for e in timeline['events']]}")
            for number in range(1, 7):
                sheets.append(fc.load_rgba(Path(args.out_dir) / folder.name / f"event_{number}.png"))
                names.append(f"{folder.name} e{number}")
        fc.contact_sheet(sheets, names, 6, "#1B2230", max_cell=220).save(Path(args.out_dir) / "ALL_DIRECTIONS_EVENTS.png")
    elif args.a and args.b:
        timeline = run(fc.load_rgba(args.a), fc.load_rgba(args.b), Path(args.out_dir), args, args.label)
        print({k: timeline[k] for k in ("parts", "unmatched_parts")})
        for event in timeline["events"]:
            print(event)
    else:
        raise SystemExit("give --a and --b, or --lock-dir")


if __name__ == "__main__":
    main()
