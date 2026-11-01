#!/usr/bin/env python3
"""Tool C2: one authored hit frame -> a tick-by-tick hit reaction with a detached prop.

Input: one transparent hit frame (e.g. a hitback with a flying crown and a
surprised face). The tool never redraws the character or the face: it only
moves what is already drawn.

* Body: knock-back shake - a push along --knock-dir that decays as
  amp * exp(-decay * t) * cos(2 pi f t), in whole pixels (no resampling, so
  the drawing stays crisp).
* Detached props (crown, hat, weapon): every separate opaque component except
  the body, or --prop-box. Ballistic path p0 + v0 t + g t^2 / 2, with spin
  that damps, drawn in front of the body (or --prop-behind).

Length: --ticks is the authored hold (e.g. "Native008: 7ticks"); --extend adds
ticks so the prop can finish rising and falling.

    python hitback_props.py --frame HIT.png --out-dir OUT --ticks 7 --extend 11
"""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import foundry_common as fc


def split_props(frame: np.ndarray, prop_box, min_prop_area: int) -> tuple[np.ndarray, list[dict]]:
    alpha = frame[..., 3] > 24
    if prop_box:
        x0, y0, x1, y1 = prop_box
        mask = np.zeros(alpha.shape, bool)
        mask[y0:y1, x0:x1] = alpha[y0:y1, x0:x1]
        masks = [mask]
    else:
        labels, count = ndimage.label(alpha, structure=np.ones((3, 3), bool))
        if count < 2:
            return frame.copy(), []
        sizes = ndimage.sum(alpha, labels, index=np.arange(1, count + 1))
        body = int(np.argmax(sizes)) + 1
        masks = [labels == i for i in range(1, count + 1) if i != body and sizes[i - 1] >= min_prop_area]
    body_frame = frame.copy()
    props = []
    for mask in masks:
        grown = ndimage.binary_dilation(mask, iterations=2) & (frame[..., 3] > 0)
        ys, xs = np.nonzero(grown)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop = frame[y0:y1, x0:x1].copy()
        crop[~grown[y0:y1, x0:x1]] = 0
        body_frame[grown] = 0
        props.append({"image": crop, "box": [int(x0), int(y0), int(x1), int(y1)],
                      "centre": [(x0 + x1) / 2, (y0 + y1) / 2], "area": int(mask.sum())})
    return body_frame, props


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--frame", required=True, help="transparent hit frame (run split_sheet.py --region first if needed)")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--ticks", type=int, default=7, help="authored hold in 60 fps ticks")
    parser.add_argument("--extend", type=int, default=0, help="extra ticks for the prop to land")
    parser.add_argument("--fps", type=int, default=60)
    parser.add_argument("--knock-dir", default="-1,0", help="push direction on screen (x,y)")
    parser.add_argument("--knock-px", type=float, default=10)
    parser.add_argument("--decay", type=float, default=0.35, help="per tick")
    parser.add_argument("--shake-hz", type=float, default=0.18, help="shake cycles per tick")
    parser.add_argument("--prop-box", help="x0,y0,x1,y1 of the prop if it touches the body")
    parser.add_argument("--min-prop-area", type=int, default=200)
    parser.add_argument("--prop-v0", default="1.5,-7", help="px per tick (x,y); y negative = up")
    parser.add_argument("--gravity", type=float, default=1.1, help="px per tick^2")
    parser.add_argument("--spin", type=float, default=-9, help="degrees per tick at the start")
    parser.add_argument("--spin-damp", type=float, default=0.9)
    parser.add_argument("--prop-behind", action="store_true")
    parser.add_argument("--pad", type=int, default=96, help="transparent margin so the prop path stays on canvas")
    parser.add_argument("--mp4", action="store_true")
    args = parser.parse_args()

    frame = fc.load_rgba(args.frame)
    body, props = split_props(frame, fc.parse_numbers(args.prop_box, 4, int), args.min_prop_area)
    if not props:
        print("no detached prop found: body shake only (use --prop-box if the prop touches the body)")
    pad = args.pad
    height, width = frame.shape[:2]
    canvas_size = (width + 2 * pad, height + 2 * pad)
    knock = np.array(fc.parse_numbers(args.knock_dir, 2), float)
    knock /= max(1e-6, np.hypot(*knock))
    v0 = np.array(fc.parse_numbers(args.prop_v0, 2), float)
    out_dir = Path(args.out_dir)
    total = args.ticks + args.extend
    frames, rows = [], []
    for tick in range(total):
        envelope = math.exp(-args.decay * tick) * math.cos(2 * math.pi * args.shake_hz * tick)
        offset = np.round(knock * args.knock_px * envelope).astype(int)
        base = np.zeros((canvas_size[1], canvas_size[0], 4), np.uint8)
        base[pad:pad + height, pad:pad + width] = body
        base = fc.integer_shift(base, int(offset[0]), int(offset[1]))
        image = Image.fromarray(base, "RGBA")
        prop_rows = []
        angle = args.spin * (1 - args.spin_damp ** max(tick, 1e-9)) / (1 - args.spin_damp) if tick else 0.0
        for prop in props:
            position = np.array(prop["centre"]) + v0 * tick + np.array([0, 0.5 * args.gravity * tick * tick])
            sprite = Image.fromarray(prop["image"], "RGBA").rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
            x = int(round(position[0] + pad - sprite.width / 2))
            y = int(round(position[1] + pad - sprite.height / 2))
            layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
            layer.paste(sprite, (x, y), sprite)  # paste accepts off-canvas positions; layer starts empty
            image = Image.alpha_composite(layer, image) if args.prop_behind else Image.alpha_composite(image, layer)
            prop_rows.append({"centre_xy": [round(float(position[0]), 2), round(float(position[1]), 2)], "angle_deg": round(angle, 2)})
        result = np.asarray(image)
        fc.save_rgba(result, out_dir / "ticks" / f"tick_{tick:03d}.png")
        frames.append(result)
        rows.append({"tick": tick, "authored_hold": tick < args.ticks, "body_offset_px": offset.tolist(), "props": prop_rows})

    tick_ms = 1000 / args.fps
    fc.save_gif(frames, [tick_ms] * len(frames), out_dir / "preview_realtime.gif")
    fc.save_gif(frames, [tick_ms * 4] * len(frames), out_dir / "preview_quarter_speed.gif")
    fc.contact_sheet(frames, [f"tick {r['tick']}" for r in rows], min(9, len(frames)), "#1B2230", max_cell=260).save(out_dir / "TICKS_SHEET.png")
    if args.mp4 and shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(args.fps), "-i", str(out_dir / "ticks" / "tick_%03d.png"),
                        "-vf", "premultiply=inplace=1,pad=ceil(iw/2)*2:ceil(ih/2)*2:color=#1B2230", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        str(out_dir / f"HITBACK_{total}TICKS_{args.fps}FPS.mp4")], check=False)
    fc.write_json(out_dir / "hitback_timeline.json", {
        "tool": "championship-sprite-foundry/hitback_props.py", "source": str(Path(args.frame).resolve()),
        "status": "DRAFT motion of an authored frame; the drawing itself is unchanged",
        "fps": args.fps, "authored_ticks": args.ticks, "extend_ticks": args.extend,
        "canvas_padding_px": pad, "source_origin_in_canvas": [pad, pad],
        "props": [{"box": p["box"], "area": p["area"]} for p in props],
        "params": {k: getattr(args, k) for k in ("knock_dir", "knock_px", "decay", "shake_hz", "prop_v0", "gravity", "spin", "spin_damp")},
        "ticks": rows, "rights": fc.RESEARCH_ONLY_NOTE,
    })
    print(f"{total} ticks -> {out_dir}  props: {[p['box'] for p in props]}")


if __name__ == "__main__":
    main()
