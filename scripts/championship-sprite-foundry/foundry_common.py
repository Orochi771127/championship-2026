"""Shared helpers for the Championship sprite foundry.

Everything here runs locally (Pillow, numpy, scipy, OpenCV). No paid service,
no network, except the one-time U^2-Net model download in foundry_matte.py.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFont

DIRECTIONS = ("S", "SE", "E", "NE", "N", "NW", "W", "SW")
ART_KINDS = ("painted", "pixel")


def sampling_for(art_kind: str) -> str:
    """Loader sampling to record with the frames: painted art must not be drawn with nearest."""
    return "smooth" if art_kind == "painted" else "nearest"


RESEARCH_ONLY_NOTE = (
    "RESEARCH_ONLY until the asset has an allowed record in "
    "assets/production/ART_PRODUCTION_INDEX.json (championship-art-production)."
)


def load_rgba(path: str | Path) -> np.ndarray:
    with Image.open(path) as image:
        return np.asarray(image.convert("RGBA")).copy()


def save_rgba(array: np.ndarray, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = np.ascontiguousarray(np.clip(array, 0, 255).astype(np.uint8))
    rgba[rgba[..., 3] == 0, :3] = 0
    Image.fromarray(rgba, "RGBA").save(path)
    return path


def sha256_rgba(array: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(array).tobytes()).hexdigest()


def write_json(path: str | Path, data) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def parse_numbers(text: str | None, count: int | None = None, kind=float) -> list | None:
    if text is None or text == "":
        return None
    values = [kind(part) for part in str(text).replace(" ", "").split(",") if part != ""]
    if count is not None and len(values) != count:
        raise SystemExit(f"expected {count} comma-separated numbers, got {text!r}")
    return values


def parse_color(text: str) -> tuple[int, int, int]:
    text = text.strip().lstrip("#")
    if len(text) != 6:
        raise SystemExit(f"invalid colour {text!r}; expected #RRGGBB")
    return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4))


def hex_color(rgb: Sequence[float]) -> str:
    return "#" + "".join(f"{int(round(v)):02X}" for v in rgb[:3])


def alpha_mask(rgba: np.ndarray, threshold: int = 127) -> np.ndarray:
    return rgba[..., 3] > threshold


def alpha_bbox(rgba: np.ndarray, threshold: int = 8) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(rgba[..., 3] > threshold)
    if xs.size == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def premultiply(rgba: np.ndarray) -> np.ndarray:
    out = rgba.astype(np.float32)
    alpha = out[..., 3:4] / 255.0
    out[..., :3] *= alpha
    return out


def unpremultiply(premul: np.ndarray) -> np.ndarray:
    alpha = np.clip(premul[..., 3:4], 0.0, 255.0)
    safe = np.where(alpha > 1e-3, alpha / 255.0, 1.0)
    rgb = np.where(alpha > 1e-3, premul[..., :3] / safe, 0.0)
    out = np.concatenate([np.clip(rgb, 0, 255), alpha], axis=-1)
    return np.round(out).astype(np.uint8)


def over(top: np.ndarray, bottom: np.ndarray) -> np.ndarray:
    """Premultiplied float 'over'."""
    alpha = top[..., 3:4] / 255.0
    return top + bottom * (1.0 - alpha)


def integer_shift(rgba: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """Translate by whole pixels without resampling; uncovered pixels are transparent."""
    height, width = rgba.shape[:2]
    out = np.zeros_like(rgba)
    src_x0, src_x1 = max(0, -dx), min(width, width - dx)
    src_y0, src_y1 = max(0, -dy), min(height, height - dy)
    if src_x1 > src_x0 and src_y1 > src_y0:
        out[src_y0 + dy:src_y1 + dy, src_x0 + dx:src_x1 + dx] = rgba[src_y0:src_y1, src_x0:src_x1]
    return out


def checker(width: int, height: int, tile: int = 16) -> Image.Image:
    yy, xx = np.mgrid[0:height, 0:width]
    light = ((xx // tile + yy // tile) % 2) == 0
    rgb = np.where(light[..., None], np.array([240, 243, 246]), np.array([214, 220, 226]))
    return Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")


def _font(size: int = 14):
    for name in ("arial.ttf", "DejaVuSans.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def contact_sheet(
    images: Sequence[np.ndarray],
    labels: Sequence[str],
    columns: int,
    background: str = "checker",
    max_cell: int = 360,
) -> Image.Image:
    """Review sheet. background: 'checker' or a hex colour ('#202833' shows white halos)."""
    if not images:
        raise ValueError("no images")
    cell_w = max(image.shape[1] for image in images)
    cell_h = max(image.shape[0] for image in images)
    scale = min(1.0, max_cell / max(cell_w, cell_h))
    tw, th = max(1, int(cell_w * scale)), max(1, int(cell_h * scale))
    label_h = 22
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * tw, rows * (th + label_h)), (250, 250, 250, 255))
    draw = ImageDraw.Draw(sheet)
    font = _font(13)
    for index, (image, label) in enumerate(zip(images, labels)):
        col, row = index % columns, index // columns
        x0, y0 = col * tw, row * (th + label_h)
        tile = checker(tw, th) if background == "checker" else Image.new("RGBA", (tw, th), parse_color(background) + (255,))
        sprite = Image.fromarray(image, "RGBA")
        if scale != 1.0:
            sprite = sprite.resize((max(1, int(image.shape[1] * scale)), max(1, int(image.shape[0] * scale))), Image.Resampling.LANCZOS)
        tile.alpha_composite(sprite, ((tw - sprite.width) // 2, (th - sprite.height) // 2))
        sheet.alpha_composite(tile, (x0, y0 + label_h))
        draw.text((x0 + 4, y0 + 4), label, fill=(20, 40, 50, 255), font=font)
    return sheet


def save_gif(frames: Iterable[np.ndarray], durations_ms: Sequence[int], path: str | Path, background=(36, 40, 51)) -> Path:
    """Animated GIF on a flat background (GIF has no real alpha). Browsers clamp delays < 20 ms."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pil_frames = []
    for frame in frames:
        base = Image.new("RGBA", (frame.shape[1], frame.shape[0]), tuple(background) + (255,))
        base.alpha_composite(Image.fromarray(frame, "RGBA"))
        pil_frames.append(base.convert("RGB"))
    pil_frames[0].save(path, save_all=True, append_images=pil_frames[1:], duration=[max(20, int(d)) for d in durations_ms], loop=0, disposal=2)
    return path


def ticks_from_weights(weights: Sequence[float], total_ticks: int) -> list[int]:
    """Largest-remainder rounding so the event ticks always sum to total_ticks."""
    weights = [max(0.0, float(w)) for w in weights]
    if total_ticks < len(weights):
        raise SystemExit(f"{total_ticks} ticks cannot hold {len(weights)} events")
    total = sum(weights) or float(len(weights))
    raw = [total_ticks * w / total for w in weights]
    ticks = [max(1, int(np.floor(r))) for r in raw]
    order = sorted(range(len(raw)), key=lambda i: raw[i] - np.floor(raw[i]), reverse=True)
    i = 0
    while sum(ticks) < total_ticks:
        ticks[order[i % len(order)]] += 1
        i += 1
    while sum(ticks) > total_ticks:
        j = max(range(len(ticks)), key=lambda k: ticks[k])
        ticks[j] -= 1
    return ticks
