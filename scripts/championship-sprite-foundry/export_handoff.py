#!/usr/bin/env python3
"""Tool E: registered event frames -> atlas pages + handoff frames/clip JSON.

Matches the character-animation handoff rules (anim-handoff-integration-20261101,
build_handoff_manifests.py):

* Frame entries carry only: id, image, sha256, frame, trim, sourceSize, origin,
  density, and sampling for painted art. No source or provenance field; those
  go to a separate sidecar file that is never published.
* origin is the feet point, shared by every frame of the clip (one point for
  the clip, never fitted or grounded per frame), in stored pixels of sourceSize.
* One scale per clip. Painted art is stored at up to --hd-max times the
  --target-density grid and never above the source pixels; sampling 'smooth'.
  Pixel art keeps whole-number scaling, nearest sampling, no sampling field.
* Ticks are kept verbatim and in order, repeats included; durationMs is only
  derived (ticks x 1000 / fps). Identical images share one frame entry but stay
  separate events. Nothing is mirrored; no hitFrame or emission point is added.
* Atlas pages: shelf packing with 8 px gutters (mip levels do not bleed),
  lossless, file named by its SHA-256.

    python export_handoff.py --timeline RUN/events/S/timeline.json --out-dir OUT \
        --id-prefix fdry20261101_MA28_S --clip-id handoff:arena:S:idle --mode arena --action idle --direction S \
        --native-body-height 30
    python export_handoff.py --event A.png:6 --event B.png:4 --event B.png:6 ... (explicit order and ticks)
"""

from __future__ import annotations

import argparse
import hashlib
import io
from pathlib import Path

import numpy as np
from PIL import Image

import foundry_common as fc

GUTTER = 8
MAX_PAGE = 2048


def load_events(args) -> list[tuple[Path, int]]:
    if args.timeline:
        timeline_path = Path(args.timeline)
        import json
        timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
        if not timeline.get("timing_source", "").startswith("AUTHORED") and not args.accept_proposed_ticks:
            raise SystemExit("timeline ticks are a proposal without source evidence; pass the authored ticks to "
                             "tween_events.py --ticks, or --accept-proposed-ticks for a QA-only build")
        return [(timeline_path.parent / f"event_{i}.png", int(e["ticks"])) for i, e in enumerate(timeline["events"], start=1)]
    events = []
    for spec in args.event:
        path, _, ticks = spec.rpartition(":")
        if not path or not ticks.isdigit() or int(ticks) < 1:
            raise SystemExit(f"--event needs IMAGE:TICKS, got {spec!r}")
        events.append((Path(path), int(ticks)))
    return events


def resample(rgba: np.ndarray, scale: float, art_kind: str) -> np.ndarray:
    if scale == 1:
        return rgba
    size = (max(1, round(rgba.shape[1] * scale)), max(1, round(rgba.shape[0] * scale)))
    if art_kind == "pixel":
        return np.asarray(Image.fromarray(rgba, "RGBA").resize(size, Image.Resampling.NEAREST))
    premul = Image.fromarray(rgba, "RGBA").convert("RGBa").resize(size, Image.Resampling.LANCZOS)
    return np.asarray(premul.convert("RGBA"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--timeline", help="timeline.json from tween_events.py")
    parser.add_argument("--event", action="append", default=[], help="IMAGE:TICKS, in play order (repeat as needed)")
    parser.add_argument("--accept-proposed-ticks", action="store_true")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--id-prefix", required=True)
    parser.add_argument("--clip-id", required=True)
    parser.add_argument("--mode", default="arena")
    parser.add_argument("--action", required=True)
    parser.add_argument("--direction")
    parser.add_argument("--no-loop", action="store_true")
    parser.add_argument("--fps", type=int, default=60, help="tick rate of the source ticks")
    parser.add_argument("--art-kind", choices=["painted", "pixel"], default="painted")
    parser.add_argument("--native-body-height", type=float, help="body height in native px the clip must match (e.g. the current walk's median)")
    parser.add_argument("--target-density", type=float, default=4)
    parser.add_argument("--hd-max", type=float, default=2, help="painted: store at most this many times the target grid")
    parser.add_argument("--density", type=float, help="explicit stored-px-per-native-px instead of --native-body-height (pixel art)")
    parser.add_argument("--origin", help="x,y feet point in source canvas px; default bottom centre of the clip's shared body box")
    args = parser.parse_args()

    events = load_events(args)
    if not events:
        raise SystemExit("no events")
    unique: dict[str, dict] = {}
    order = []
    canvas = None
    for path, ticks in events:
        rgba = fc.load_rgba(path)
        canvas = canvas or rgba.shape[:2]
        if rgba.shape[:2] != canvas:
            raise SystemExit(f"{path}: every event must share one registered canvas {canvas[::-1]}, got {rgba.shape[1::-1]}")
        digest = fc.sha256_rgba(rgba)
        unique.setdefault(digest, {"rgba": rgba, "source": str(path)})
        order.append((digest, ticks))

    boxes = [fc.alpha_bbox(u["rgba"]) for u in unique.values()]
    if any(b is None for b in boxes):
        raise SystemExit("an event frame is empty")
    body_height = float(np.median([b[3] - b[1] for b in boxes]))
    if args.origin:
        origin_src = fc.parse_numbers(args.origin, 2)
    else:
        x0 = min(b[0] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
        origin_src = [(x0 + x1) / 2, float(y1)]

    if args.density:
        density, store = args.density, 1.0
        if args.art_kind == "pixel" and float(density).is_integer() is False:
            raise SystemExit("pixel art needs a whole-number density")
    elif args.native_body_height:
        game = args.target_density * args.native_body_height / body_height      # source px -> density-grid px
        if args.art_kind == "pixel":
            store = 1.0
            density = round(body_height / args.native_body_height)
        else:
            hd = min(args.hd_max, 1 / game)                                      # never above the source pixels
            store = game * hd
            density = args.target_density * hd
    else:
        raise SystemExit("give --native-body-height (one scale for the clip) or --density")

    out_dir = Path(args.out_dir)
    frames, crops = [], []
    for index, (digest, item) in enumerate(unique.items()):
        stored = resample(item["rgba"], store, args.art_kind)
        box = fc.alpha_bbox(stored)
        crop = stored[box[1]:box[3], box[0]:box[2]]
        frames.append({"digest": digest, "id": f"{args.id_prefix}_{index:02d}", "box": box,
                       "sourceSize": [int(stored.shape[1]), int(stored.shape[0])], "crop": crop, "source": item["source"]})

    # Shelf packing, tallest first, GUTTER px around every frame.
    pages, current, x, y, shelf = [], [], GUTTER, GUTTER, 0
    for frame in sorted(frames, key=lambda f: (-f["crop"].shape[0], f["id"])):
        h, w = frame["crop"].shape[:2]
        if w + 2 * GUTTER > MAX_PAGE or h + 2 * GUTTER > MAX_PAGE:
            raise SystemExit(f"{frame['id']} ({w}x{h}) does not fit a {MAX_PAGE} px page")
        if x + w + GUTTER > MAX_PAGE:
            x, y, shelf = GUTTER, y + shelf + GUTTER, 0
        if y + h + GUTTER > MAX_PAGE:
            pages.append(current); current, x, y, shelf = [], GUTTER, GUTTER, 0
        current.append((frame, x, y)); x += w + GUTTER; shelf = max(shelf, h)
    pages.append(current)
    (out_dir / "atlas").mkdir(parents=True, exist_ok=True)
    page_rows = []
    for page in pages:
        width = max(px + f["crop"].shape[1] for f, px, _ in page) + GUTTER
        height = max(py + f["crop"].shape[0] for f, _, py in page) + GUTTER
        sheet = np.zeros((height, width, 4), np.uint8)
        for f, px, py in page:
            sheet[py:py + f["crop"].shape[0], px:px + f["crop"].shape[1]] = f["crop"]
        buffer = io.BytesIO()
        Image.fromarray(sheet, "RGBA").save(buffer, "PNG", optimize=True)
        data = buffer.getvalue()
        digest = hashlib.sha256(data).hexdigest()
        name = f"atlas/{digest}.png"
        (out_dir / name).write_bytes(data)
        page_rows.append({"image": name, "bytes": len(data), "size": [width, height]})
        for f, px, py in page:
            f["placed"] = (name, digest, [px, py, int(f["crop"].shape[1]), int(f["crop"].shape[0])])

    origin = [round(origin_src[0] * store, 2), round(origin_src[1] * store, 2)]
    public_frames = []
    for f in frames:
        x0, y0, x1, y1 = f["box"]
        entry = {"id": f["id"], "image": f["placed"][0], "sha256": f["placed"][1], "frame": f["placed"][2],
                 "trim": [x0, y0, x1 - x0, y1 - y0], "sourceSize": f["sourceSize"], "origin": origin,
                 "density": round(density, 6)}
        if args.art_kind == "painted":
            entry["sampling"] = "smooth"
        public_frames.append(entry)
    ids = {f["digest"]: f["id"] for f in frames}
    clip = {"id": args.clip_id, "mode": args.mode, "action": args.action, "loop": not args.no_loop,
            "frames": [{"assetId": ids[d], "durationMs": t * 1000 / args.fps} for d, t in order]}
    if args.direction:
        clip["direction"] = args.direction
    fc.write_json(out_dir / "handoff.frames-clips.json", {"frames": public_frames, "clips": [clip]})
    fc.write_json(out_dir / "handoff.sidecar.NOT_PUBLIC.json", {
        "tool": "championship-sprite-foundry/export_handoff.py",
        "events": [{"index": i, "assetId": ids[d], "ticks": t} for i, (d, t) in enumerate(order)],
        "totalTicks": sum(t for _, t in order), "fps": args.fps,
        "timebase_note": "durationMs = ticks x 1000 / fps; engine tick rate not verified here",
        "sources": [{"assetId": f["id"], "file": f["source"], "rgbaSha256": f["digest"]} for f in frames],
        "scale": {"sourceBodyHeightPx": body_height, "nativeBodyHeight": args.native_body_height,
                  "storeScale": round(store, 6), "density": round(density, 6), "artKind": args.art_kind},
        "originSourcePx": origin_src, "origin_rule": "explicit --origin" if args.origin else "bottom centre of the shared body box",
        "pages": page_rows, "mirror": None, "hitFrame": None, "projectileOrigin": None,
        "rights": fc.RESEARCH_ONLY_NOTE,
    })
    print(f"{len(order)} events, {len(frames)} frames, {len(pages)} page(s), density {density:.4g}, "
          f"store scale {store:.4g}, origin {origin} -> {out_dir}")


if __name__ == "__main__":
    main()
