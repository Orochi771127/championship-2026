"""White-safe background removal for generated character art.

Method (all local):

1. Estimate the background colour from the image border.
2. Flood the background from the border only, through pixels within `tol`
   (Chebyshev RGB distance) of that colour. Whites and creams inside a dark
   outline are never reached, so armour, fur and highlights stay opaque.
   This is the border-sampled key from character-sprite-maker's
   normalize_chroma_source.py, made connectivity-aware so it cannot eat
   interior colours that resemble the key.
3. Optional U^2-Net shape prior (karem505/character-animation-skill
   remove_bg_ml.py, same model and normalisation): it only *decides* the two
   ambiguous cases - background-coloured pockets enclosed by the character, and
   white body pixels the flood reached on a white background. It never sets the
   edge, so its 320 px mask cannot blur the outline.
4. Edge ring only: soft alpha from colour distance and colour decontamination
   C = (I - (1 - a) * bg) / a, so no grey or key-colour halo remains.
"""

from __future__ import annotations

import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
from scipy import ndimage

U2NET_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"
U2NET_MIN_BYTES = 150_000_000
U2NET_MEAN = (0.485, 0.456, 0.406)
U2NET_STD = (0.229, 0.224, 0.225)


def u2net_candidates() -> list[Path]:
    paths = []
    if os.environ.get("FOUNDRY_U2NET_MODEL"):
        paths.append(Path(os.environ["FOUNDRY_U2NET_MODEL"]))
    home = Path.home()
    paths += [home / ".u2net" / "u2net.onnx", home / ".config" / "character-animation" / "u2net.onnx"]
    return paths


def find_u2net() -> Path | None:
    for path in u2net_candidates():
        if path.is_file() and path.stat().st_size >= U2NET_MIN_BYTES:
            return path
    return None


def download_u2net() -> Path:
    """One-time ~176 MB download into ~/.u2net (shared with rembg)."""
    target = Path.home() / ".u2net" / "u2net.onnx"
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".part")
    sys.stderr.write(f"Downloading U^2-Net (~176 MB) -> {target}\n")
    urllib.request.urlretrieve(U2NET_URL, tmp)
    if tmp.stat().st_size < U2NET_MIN_BYTES:
        tmp.unlink(missing_ok=True)
        raise SystemExit("U^2-Net download failed (file too small)")
    tmp.replace(target)
    return target


class U2Net:
    """Lazy ONNX session; CPU by default so results are reproducible."""

    def __init__(self, model: Path, gpu: bool = False, size: int = 320):
        import onnxruntime as ort

        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if gpu else ["CPUExecutionProvider"]
        self.session = ort.InferenceSession(str(model), sess_options=options, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        self.size = size
        self.model = model

    def probability(self, rgb: np.ndarray) -> np.ndarray:
        from PIL import Image

        height, width = rgb.shape[:2]
        image = Image.fromarray(rgb.astype(np.uint8), "RGB").resize((self.size, self.size), Image.Resampling.LANCZOS)
        array = np.asarray(image).astype(np.float32)
        array = array / max(1e-6, float(array.max()))
        for channel in range(3):
            array[..., channel] = (array[..., channel] - U2NET_MEAN[channel]) / U2NET_STD[channel]
        tensor = np.expand_dims(array.transpose(2, 0, 1), 0)
        prediction = self.session.run(None, {self.input_name: tensor})[0][0, 0]
        low, high = float(prediction.min()), float(prediction.max())
        prediction = (prediction - low) / max(1e-6, high - low)
        mask = Image.fromarray((prediction * 255).astype(np.uint8), "L").resize((width, height), Image.Resampling.BILINEAR)
        return np.asarray(mask).astype(np.float32) / 255.0


def load_u2net(mode: str = "auto", gpu: bool = False) -> U2Net | None:
    """mode: 'auto' (use if present), 'on' (download if missing), 'off'."""
    if mode == "off":
        return None
    model = find_u2net()
    if model is None and mode == "on":
        model = download_u2net()
    if model is None:
        return None
    return U2Net(model, gpu=gpu)


def estimate_background(rgb: np.ndarray, band: int = 6) -> tuple[np.ndarray, float]:
    border = np.concatenate([
        rgb[:band].reshape(-1, 3), rgb[-band:].reshape(-1, 3),
        rgb[:, :band].reshape(-1, 3), rgb[:, -band:].reshape(-1, 3),
    ]).astype(np.float32)
    bg = np.median(border, axis=0)
    spread = float(np.percentile(np.abs(border - bg).max(axis=1), 95))
    return bg, spread


def color_distance(rgb: np.ndarray, color: np.ndarray) -> np.ndarray:
    return np.abs(rgb.astype(np.float32) - color.astype(np.float32)).max(axis=-1)


def whiteish(rgb: np.ndarray, floor: int = 215, max_chroma: int = 40) -> np.ndarray:
    rgb = rgb.astype(np.int16)
    return (rgb.min(axis=-1) >= floor) & ((rgb.max(axis=-1) - rgb.min(axis=-1)) <= max_chroma)


EIGHT = np.ones((3, 3), dtype=bool)


def matte(
    image: np.ndarray,
    *,
    tol: float = 12.0,
    soft: float = 60.0,
    u2net: U2Net | None = None,
    min_area: int = 40,
    pocket_min: int = 24,
    blank_rows: list[tuple[int, int]] | None = None,
    force: bool = False,
) -> tuple[np.ndarray, dict]:
    """Return (RGBA uint8, stats). `blank_rows` are painted background first (label bands)."""
    rgba = image if image.shape[-1] == 4 else np.dstack([image, np.full(image.shape[:2], 255, np.uint8)])
    rgba = rgba.astype(np.uint8).copy()
    transparent_share = float((rgba[..., 3] < 8).mean())
    if transparent_share > 0.01 and not force and not blank_rows:
        return rgba, {"mode": "existing-alpha", "transparent_share": round(transparent_share, 4)}

    rgb = rgba[..., :3].copy()
    bg, spread = estimate_background(rgb)
    for y0, y1 in blank_rows or []:
        rgb[y0:y1] = bg.astype(np.uint8)

    distance = color_distance(rgb, bg)
    near = distance <= tol
    labels, _ = ndimage.label(near)
    border_labels = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    border_labels = border_labels[border_labels > 0]
    background = np.isin(labels, border_labels)

    probability = u2net.probability(rgb) if u2net is not None else None
    bg_is_white = bool(whiteish(bg[None, None].astype(np.uint8))[0, 0]) and float(bg.min()) >= 240
    stats = {
        "mode": "flood+u2net" if probability is not None else "flood",
        "background_rgb": [round(float(v), 1) for v in bg],
        "background_border_spread": round(spread, 2),
        "tol": tol,
        "soft": soft,
        "background_is_white": bg_is_white,
    }
    if spread > tol:
        stats["warning"] = f"border colour spread {spread:.1f} > tol {tol}; background may be a gradient"
    if bg_is_white and probability is None:
        stats["warning_white_background"] = (
            "white background without U^2-Net: white armour touching the background cannot be "
            "told apart; rerun with --u2net on or ask for a chroma-key background"
        )

    # 1. Background-coloured pockets enclosed by the character (gaps between wing and tail).
    pocket_labels, pocket_count = ndimage.label(near & ~background)
    pockets_removed = 0
    pockets_kept = 0
    if pocket_count:
        index_range = np.arange(1, pocket_count + 1)
        areas = ndimage.sum(np.ones_like(distance), pocket_labels, index=index_range)
        means = ndimage.mean(probability, pocket_labels, index=index_range) if probability is not None else None
        # Flatness: share of the pocket within 2 levels of the backdrop. A real gap is flat
        # backdrop (0.85-0.97 on the UL33 board); white fur or armour has brush texture (< 0.1).
        flat = ndimage.mean((distance <= 2).astype(np.float32), pocket_labels, index=index_range)
        for index, area in enumerate(areas, start=1):
            if area < pocket_min:
                continue
            if probability is not None:
                is_pocket = means[index - 1] < 0.5 and flat[index - 1] >= 0.6
            else:
                is_pocket = flat[index - 1] >= 0.9
            if is_pocket:
                background |= pocket_labels == index
                pockets_removed += int(area)
            else:
                pockets_kept += int(area)
    stats["pocket_px_removed"] = pockets_removed
    stats["pocket_px_kept"] = pockets_kept

    # 2. White body pixels the flood reached (white background, outline gap).
    restored = 0
    if probability is not None:
        restore = background & (probability >= 0.9) & whiteish(rgb) & (distance > 2)
        if bg_is_white:
            restore = background & (probability >= 0.9) & whiteish(rgb)
        restore = ndimage.binary_opening(restore, iterations=1)
        restored = int(restore.sum())
        background &= ~restore
    stats["white_px_restored_by_u2net"] = restored

    # 3. Specks (stray dots from generation noise).
    foreground = ~background
    speck_labels, speck_count = ndimage.label(foreground, structure=EIGHT)
    specks = 0
    if speck_count:
        areas = ndimage.sum(np.ones_like(distance), speck_labels, index=np.arange(1, speck_count + 1))
        means = ndimage.mean(probability, speck_labels, index=np.arange(1, speck_count + 1)) if probability is not None else None
        for index, area in enumerate(areas, start=1):
            if area < min_area and (means is None or means[index - 1] < 0.5):
                foreground[speck_labels == index] = False
                specks += int(area)
    stats["speck_px_removed"] = specks

    # 4. Edge ring: soft alpha + decontamination.
    alpha = np.where(foreground, 255.0, 0.0)
    ring = foreground & ndimage.binary_dilation(~foreground, structure=EIGHT)
    ramp = np.clip((distance - tol) / max(1.0, soft - tol), 0.0, 1.0)
    alpha[ring] = np.clip(255.0 * ramp[ring], 0, 255)
    alpha[ring & (alpha < 24)] = 0.0
    edge = (alpha > 0) & (alpha < 255)
    out_rgb = rgb.astype(np.float32)
    a = alpha[edge][:, None] / 255.0
    out_rgb[edge] = np.clip((out_rgb[edge] - (1.0 - a) * bg[None]) / np.maximum(a, 1e-3), 0, 255)
    result = np.dstack([out_rgb, alpha]).round().astype(np.uint8)
    result[result[..., 3] == 0, :3] = 0
    stats["edge_px_soft"] = int(edge.sum())

    # White integrity: white/cream body pixels must never become transparent.
    # On a non-white background they are defined by colour; on white, by U^2-Net.
    if bg_is_white:
        # Textured white only (> 2 levels from the backdrop): a flat backdrop-white pixel is
        # indistinguishable from background and U^2-Net's soft mask spills onto it.
        white_source = (whiteish(rgb) & (probability >= 0.5) & (distance > 2)
                        & ndimage.binary_erosion(foreground, structure=EIGHT, iterations=2)) if probability is not None else None
    else:
        # Brighter than the background and at least 2 px inside the outline: excludes the grey
        # anti-aliasing and the light resampling halo (Lanczos ringing) just outside the outline.
        bright = whiteish(rgb, floor=225) & (rgb.astype(np.float32).mean(axis=-1) > float(bg.mean()) + tol)
        white_source = bright & ndimage.binary_erosion(foreground, structure=EIGHT, iterations=2)
        stats["bright_halo_px_removed"] = int((bright & ring & (result[..., 3] == 0)).sum())
    if white_source is None:
        stats["white_body_px"] = None
        stats["white_kept_ratio"] = None
    else:
        out_alpha = result[..., 3]
        removed = int((white_source & (out_alpha == 0)).sum())
        total = int(white_source.sum())
        stats["white_body_px"] = total
        stats["white_px_removed"] = removed
        stats["white_px_edge_soft"] = int((white_source & (out_alpha > 0) & (out_alpha < 255)).sum())
        stats["white_kept_ratio"] = round(1 - removed / total, 6) if total else 1.0
    stats["opaque_px"] = int((result[..., 3] == 255).sum())
    return result, stats
