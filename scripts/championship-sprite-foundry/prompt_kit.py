#!/usr/bin/env python3
"""Tool D: native pixel snapshot -> base plate + measured, structured image prompt.

Inputs: the native pixel frame (research reference) and, optionally, the HD
design reference of the character. Outputs:

* PLATE_TRANSPARENT.png - the native frame scaled by a whole number (nearest
  neighbour, sprite-pipeline's build_sprite_edit_canvas rule) and placed so its
  root and ground line sit at fixed canvas points.
* PLATE_KEY.png - the same on the chosen chroma key: the image to give the
  generator.
* PLATE_GUIDES.png - plate + frame box, ground line and root cross, for your
  own overlay review (do not send it: generators copy guide lines).
* analysis.json - every number used in the prompt.
* PROMPT.md - the prompt to paste, plus the 4x4 eight-direction A/B variant.

Measured, not guessed: bounding box, lean of the principal axis, mass centre,
ground contact, extremities, detached components (a flying crown is a separate
component) and the palette. Expression, mood and story beats are NOT inferred
from pixels: pass them with --notes and they are quoted verbatim.

The chroma key is the colour among magenta, green, cyan, blue and orange that
is farthest from every colour in the native frame and design reference, so
keying never touches the character (white fur, purple cape, gold crown...).

    python prompt_kit.py --native NATIVE008.png --design UL33_DESIGN.png --out-dir OUT \
        --role UL33 --action "normal hitback" --event "Native008, 7 ticks" \
        --notes "crown knocked off and flying up-right; surprised face, eyes wide"
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import foundry_common as fc
import foundry_matte as fm

KEY_CANDIDATES = {"magenta": (255, 0, 255), "green": (0, 255, 0), "cyan": (0, 255, 255),
                  "blue": (0, 0, 255), "orange": (255, 128, 0)}


def palette(rgba: np.ndarray, count: int = 12) -> list[tuple[tuple[int, int, int], float]]:
    opaque = rgba[rgba[..., 3] > 127][:, :3]
    if opaque.size == 0:
        return []
    image = Image.fromarray(opaque.reshape(1, -1, 3).astype(np.uint8), "RGB").quantize(colors=count, method=Image.Quantize.MEDIANCUT)
    counts = sorted(image.getcolors(), reverse=True)
    raw = image.getpalette()
    total = sum(c for c, _ in counts)
    return [(tuple(raw[i * 3:i * 3 + 3]), c / total) for c, i in counts]


def choose_key(colours: list[tuple[int, int, int]]) -> tuple[str, tuple[int, int, int], float]:
    best = None
    for name, key in KEY_CANDIDATES.items():
        distance = min((max(abs(k - c) for k, c in zip(key, colour)) for colour in colours), default=255)
        if best is None or distance > best[2]:
            best = (name, key, distance)
    return best


def analyse(native: np.ndarray) -> dict:
    mask = native[..., 3] > 127
    ys, xs = np.nonzero(mask)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    w, h = x1 - x0, y1 - y0

    def rel(x, y):
        return [round((x - x0) / w, 3), round((y - y0) / h, 3)]

    cy, cx = ndimage.center_of_mass(mask)
    coords = np.stack([xs - cx, ys - cy])
    eigvals, eigvecs = np.linalg.eigh(np.cov(coords))
    major = eigvecs[:, int(np.argmax(eigvals))]
    if major[1] > 0:
        major = -major  # point "up" the body
    lean = math.degrees(math.atan2(major[0], -major[1]))  # 0 = upright, + = top leans right
    depth = ndimage.distance_transform_edt(ndimage.binary_fill_holes(mask))
    core = depth >= 0.55 * depth.max()
    ry, rx = ndimage.center_of_mass(core)
    labels, count = ndimage.label(mask, structure=np.ones((3, 3), bool))
    sizes = ndimage.sum(mask, labels, index=np.arange(1, count + 1)) if count else []
    body = int(np.argmax(sizes)) + 1 if count else 0
    detached = []
    for index in range(1, count + 1):
        if index == body or sizes[index - 1] < max(4, 0.01 * mask.sum()):
            continue
        py, px = np.nonzero(labels == index)
        detached.append({"bbox_rel": rel(px.min(), py.min()) + rel(px.max() + 1, py.max() + 1),
                         "centre_rel": rel(px.mean(), py.mean()), "area_share": round(float(sizes[index - 1] / mask.sum()), 3)})
    extremes = {
        "top": rel(xs[np.argmin(ys)], ys.min()), "bottom": rel(xs[np.argmax(ys)], ys.max()),
        "left": rel(xs.min(), ys[np.argmin(xs)]), "right": rel(xs.max(), ys[np.argmax(xs)]),
    }
    left_mass = float((xs < cx).mean())
    return {
        "native_size": [int(native.shape[1]), int(native.shape[0])],
        "bbox": [int(x0), int(y0), int(x1), int(y1)], "bbox_size": [int(w), int(h)], "aspect_w_over_h": round(w / h, 3),
        "mass_centre_rel": rel(cx, cy), "root_core_rel": rel(rx, ry),
        "lean_deg": round(lean, 1), "ground_row_rel": 1.0,
        "mass_left_share": round(left_mass, 3), "extremities_rel": extremes,
        "detached_components": detached,
    }


def build_plates(native: np.ndarray, info: dict, canvas: tuple[int, int], frame: tuple[int, int], key: tuple[int, int, int]):
    x0, y0, x1, y1 = info["bbox"]
    sprite = native[y0:y1, x0:x1]
    w, h = sprite.shape[1], sprite.shape[0]
    scale = max(1, int(min(frame[0] / w, frame[1] / h)))
    scaled = Image.fromarray(sprite, "RGBA").resize((w * scale, h * scale), Image.Resampling.NEAREST)
    cw, ch = canvas
    root_x = cw // 2
    ground_y = (ch + frame[1]) // 2
    left = root_x - int(round(info["root_core_rel"][0] * scaled.width))
    top = ground_y - scaled.height
    transparent = Image.new("RGBA", canvas, (0, 0, 0, 0))
    transparent.alpha_composite(scaled, (left, top))
    keyed = Image.new("RGBA", canvas, key + (255,))
    keyed.alpha_composite(scaled, (left, top))
    guides = keyed.copy()
    draw = ImageDraw.Draw(guides)
    fx0, fy0 = root_x - frame[0] // 2, ground_y - frame[1]
    draw.rectangle((fx0, fy0, fx0 + frame[0], ground_y), outline=(255, 255, 255, 255), width=2)
    draw.line((0, ground_y, cw, ground_y), fill=(255, 220, 0, 255), width=2)
    root_y = top + int(round(info["root_core_rel"][1] * scaled.height))
    draw.line((root_x - 14, root_y, root_x + 14, root_y), fill=(255, 40, 60, 255), width=2)
    draw.line((root_x, root_y - 14, root_x, root_y + 14), fill=(255, 40, 60, 255), width=2)
    layout = {"canvas": list(canvas), "frame_box": [fx0, fy0, fx0 + frame[0], ground_y], "ground_y": ground_y,
              "root_xy": [root_x, root_y], "native_scale": scale, "sprite_box": [left, top, left + scaled.width, ground_y]}
    return transparent, keyed, guides, layout


def describe(info: dict) -> list[str]:
    lines = []
    lean = info["lean_deg"]
    if abs(lean) < 8:
        lines.append(f"Body axis close to upright ({lean:+.0f} deg).")
    else:
        lines.append(f"Body axis leans {abs(lean):.0f} deg with the top toward the {'right' if lean > 0 else 'left'} of the frame.")
    lines.append(f"Pose box is {info['aspect_w_over_h']:.2f} times as wide as tall.")
    mx, my = info["mass_centre_rel"]
    lines.append(f"Mass centre at {mx:.0%} across, {my:.0%} down the pose box; "
                 f"{info['mass_left_share']:.0%} of the silhouette is left of it.")
    rx, ry = info["root_core_rel"]
    lines.append(f"Torso (thickest part) centred at {rx:.0%} across, {ry:.0%} down.")
    for side, (ex, ey) in info["extremities_rel"].items():
        lines.append(f"{side.title()}-most point at {ex:.0%} across, {ey:.0%} down.")
    for number, part in enumerate(info["detached_components"], start=1):
        cx, cy = part["centre_rel"]
        lines.append(f"Detached piece {number} (separate from the body, {part['area_share']:.0%} of the area) "
                     f"centred at {cx:.0%} across, {cy:.0%} down, with clear space between it and the body.")
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--native", required=True, help="native pixel frame (transparent, or on a flat background)")
    parser.add_argument("--native-region", help="x0,y0,x1,y1 if the native frame is one panel of a board")
    parser.add_argument("--design", action="append", default=[], help="HD design reference image(s) of the character")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--role", default="ROLE")
    parser.add_argument("--action", default="action")
    parser.add_argument("--event", default="", help="timing label, e.g. 'Native008, 7 ticks' or 'event 1/6'")
    parser.add_argument("--direction", default="", help="facing, e.g. S or SE")
    parser.add_argument("--notes", default="", help="your semantic notes (expression, props, story); quoted verbatim")
    parser.add_argument("--canvas", default="1254,1254")
    parser.add_argument("--frame", default="900,900", help="target character box inside the canvas")
    parser.add_argument("--key", default="auto", help="auto or #RRGGBB")
    args = parser.parse_args()

    native = fc.load_rgba(args.native)
    if args.native_region:
        x0, y0, x1, y1 = fc.parse_numbers(args.native_region, 4, int)
        native = native[y0:y1, x0:x1]
    native, matte_stats = fm.matte(native, tol=6, soft=7, min_area=2)  # pixel art: exact colours, hard edge
    info = analyse(native)
    colours = [c for c, _ in palette(native)]
    design_palettes = []
    for path in args.design:
        design, _ = fm.matte(fc.load_rgba(path))
        design_palette = palette(design, 16)
        design_palettes.append({"file": path, "colours": [fc.hex_color(c) for c, _ in design_palette]})
        colours += [c for c, _ in design_palette]
    if args.key == "auto":
        key_name, key, key_distance = choose_key(colours)
    else:
        key = fc.parse_color(args.key)
        key_name, key_distance = "custom", min(max(abs(k - c) for k, c in zip(key, colour)) for colour in colours)
    canvas = tuple(fc.parse_numbers(args.canvas, 2, int))
    frame = tuple(fc.parse_numbers(args.frame, 2, int))
    transparent, keyed, guides, layout = build_plates(native, info, canvas, frame, key)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    transparent.save(out_dir / "PLATE_TRANSPARENT.png")
    keyed.convert("RGB").save(out_dir / "PLATE_KEY.png")
    guides.convert("RGB").save(out_dir / "PLATE_GUIDES.png")
    analysis = {
        "tool": "championship-sprite-foundry/prompt_kit.py", "native": str(Path(args.native).resolve()),
        "native_matte": matte_stats, "geometry": info, "layout": layout,
        "native_palette": [{"hex": fc.hex_color(c), "share": round(s, 3)} for c, s in palette(native)],
        "design_palettes": design_palettes,
        "key": {"name": key_name, "hex": fc.hex_color(key), "min_distance_to_character_colours": int(key_distance)},
        "rights": "Native frame is ROM-derived RESEARCH_ONLY reference: use it for pose and timing only; "
                  "never trace or ship it. " + fc.RESEARCH_ONLY_NOTE,
    }
    fc.write_json(out_dir / "analysis.json", analysis)

    key_hex = fc.hex_color(key)
    pose_lines = "\n".join(f"- {line}" for line in describe(info))
    notes = f'\nArt-direction notes from the owner (follow exactly):\n- "{args.notes}"\n' if args.notes else ""
    fx0, fy0, fx1, fy1 = layout["frame_box"]
    title = " ".join(part for part in (args.role, args.direction, args.action, args.event and f"({args.event})") if part)
    prompt = f"""# {title} - image prompt

Generated by championship-sprite-foundry/prompt_kit.py. Numbers come from analysis.json.
Attach: image 1 = PLATE_KEY.png (pose reference){", image 2.. = design reference" if args.design else ""}.
Do not attach PLATE_GUIDES.png. {analysis["rights"]}

## Single frame

```text
Intended use: one production animation frame for a 2D mobile game character, for review.

Image 1 is a low-resolution pose reference placed on a {canvas[0]}x{canvas[1]} canvas. Use it ONLY for pose,
silhouette, limb angles and timing. Do not copy its pixels, palette or pixel-art style.
{"Image 2 is the character design: keep exactly this character - same face, markings, armour, palette, proportions and outfit details." if args.design else "Keep the established character design: same face, markings, armour, palette and proportions."}

Action: {args.action}{f", {args.event}" if args.event else ""}{f", facing {args.direction}" if args.direction else ""}.
Pose (measured from the reference, match it):
{pose_lines}
{notes}
Composition:
- exactly one character, same {canvas[0]}x{canvas[1]} canvas, nothing cropped
- the character fits inside the box x {fx0}-{fx1}, y {fy0}-{fy1}; lowest point on y = {layout["ground_y"]}
- torso centre at x = {layout["root_xy"][0]}, y = {layout["root_xy"][1]} (same place as in image 1)
- background: one flat solid colour {key_hex}, edge to edge, no gradient, no texture, no vignette
- no ground shadow, no glow on the background, no text, no labels, no frame, no grid
- clean dark outline around the whole character and around every detached piece

Style: high-detail hand-painted 2D game sprite matching the design reference, crisp outline, cel shading.
Pure white and cream areas must stay white or cream (do not tint them with {key_hex}).
```

## Eight-direction A/B sheet (4x4)

```text
Same character and rules as above. One image, a 4x4 grid of equal cells, each cell the same size and scale.
Row 1: pose A facing S, SE, E, NE. Row 2: pose A facing N, NW, W, SW.
Row 3: pose B facing S, SE, E, NE. Row 4: pose B facing N, NW, W, SW.
Pose A = event 1/6, pose B = event 4/6 of the same move. In every cell keep the torso at the cell centre
and the same size (ROOT HOLD); only wings, limbs and tail change between A and B.
Background {key_hex} in every cell. Labels are optional; if you add them, keep them to one short line at the
very top and one at the very bottom of each cell, away from the character.
```

## After generation

```bash
python scripts/championship-sprite-foundry/split_sheet.py OUTPUT.png --out-dir RUN/split
python scripts/championship-sprite-foundry/root_lock.py --split-dir RUN/split --out-dir RUN/lock
python scripts/championship-sprite-foundry/tween_events.py --lock-dir RUN/lock --out-dir RUN/events --mp4
```
"""
    (out_dir / "PROMPT.md").write_text(prompt, encoding="utf-8")
    print(f"plate + prompt -> {out_dir}  key {key_name} {key_hex} (min distance {key_distance})  "
          f"lean {info['lean_deg']} deg  detached pieces {len(info['detached_components'])}")


if __name__ == "__main__":
    main()
