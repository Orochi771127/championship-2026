"""Join the live play-area picture and the rendered scenery ring into the BM05 canvas.

    python -X utf8 scripts/battle-canvas-bm05/compose.py --work <work dir> --out <field dir> [--evidence <dir>]

The centre 1664x1088 is the live picture's own pixels (never repainted).  The
ring comes from build_scene.py and is fitted to the centre in three steps, all
of which touch ring pixels only:

1. tone match: a smooth offset (screened Poisson, quarter size) that equals the
   colour gap at the seam and fades with distance, so sea and snow meet level;
2. weld: for a few pixels outside the seam the centre's edge colours are carried
   outward and faded into the ring, so facet edges cross the seam unbroken;
3. grain: the centre has fine film grain; the ring gets the same amount.

Writes canvas.png (lossless master, to the work dir), frame-00.webp, the outer
sea mask and canvas.json; with --evidence also a contact sheet and seam strips.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import splu

sys.path.insert(0, str(Path(__file__).resolve().parent))
import layout as L  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BASE_REL = 'assets/production/battle/bm05-southpole-polish-r2/base.webp'
FIELD_ID = 'field_bm05_01'
CELL = 4            # tone match is solved on native pixels (4 canvas pixels)
REACH = 44.0        # cells over which the tone offset fades (176 canvas pixels)
TONE_CAP = 32.0     # largest tone offset (8-bit levels) applied to anything but sea
WELD = 32.0         # canvas pixels over which the centre's edge colours fade into the ring
WELD_SHORT = 9.0    # ... cut to this where ring and centre disagree strongly
SLOPE_DEPTH = 8     # rows between the two bands that measure how lines cross an edge
SLOPE_MAX = 12      # largest drift looked for between those bands (1.5 pixels per pixel)
SLOPE_WINDOW = 5    # half width of the block matched along the edge
GRAIN_SEED = 20261112


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def sha_text(path):
    """Hash of a text file with LF line ends, so a CRLF checkout gives the same value."""
    return hashlib.sha256(Path(path).read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def seam_fields():
    """For every canvas pixel: the nearest play-area pixel and the distance to it."""
    yy, xx = np.mgrid[0:L.CANVAS_H, 0:L.CANVAS_W]
    cx = np.clip(xx, L.OX, L.OX + L.BASE_W - 1)
    cy = np.clip(yy, L.OY, L.OY + L.BASE_H - 1)
    dist = np.hypot(xx - cx, yy - cy).astype(np.float32)
    return cx, cy, dist


def is_sea(rgb):
    return (rgb[..., 0] < 70) & (rgb[..., 2] > 110)


def diffuse_offset(gap, pinned_cells, inside):
    """Screened Poisson on the ring: equals ``gap`` on the pinned seam cells, fades over REACH."""
    h, w = inside.shape
    free = (~inside) & (~pinned_cells)
    n = int(free.sum())
    index = -np.ones((h, w), dtype=np.int64)
    index[free] = np.arange(n)
    rows, cols, vals = [], [], []
    diagonal = np.full(n, 1.0 / (REACH * REACH))
    rhs = np.zeros((n, 3))
    ys, xs = np.nonzero(free)
    me = index[ys, xs]
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ny, nx = ys + dy, xs + dx
        ok = (ny >= 0) & (ny < h) & (nx >= 0) & (nx < w)
        ny, nx = np.clip(ny, 0, h - 1), np.clip(nx, 0, w - 1)
        ok &= ~inside[ny, nx]
        diagonal[me[ok]] += 1
        pinned = ok & pinned_cells[ny, nx]
        np.add.at(rhs, me[pinned], gap[ny[pinned], nx[pinned]])
        linked = ok & free[ny, nx]
        rows.append(me[linked])
        cols.append(index[ny[linked], nx[linked]])
        vals.append(-np.ones(int(linked.sum())))
    rows.append(np.arange(n))
    cols.append(np.arange(n))
    vals.append(diagonal)
    matrix = coo_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))), shape=(n, n))
    solver = splu(matrix.tocsc())
    out = np.where(pinned_cells[..., None], gap, 0.0)
    for c in range(3):
        out[..., c][free] = solver.solve(rhs[:, c])
    return cv2.resize(out.astype(np.float32), (L.CANVAS_W, L.CANVAS_H), interpolation=cv2.INTER_CUBIC)


def tone_offset(ring, edge, dist, sea):
    """Smooth colour offset for the ring: equals (centre edge - ring) beside the seam, fades outward.

    Sea and everything else are matched apart, each from the seam cells where centre and ring agree
    on what is there: the sea's shading by the shore differs a lot along the seam and must not tint
    ice, and a facet that sits a few pixels off must not tint its neighbours (non-sea gaps are
    capped at TONE_CAP; larger differences are left to the weld).
    """
    h, w = L.CANVAS_H // CELL, L.CANVAS_W // CELL
    cells = lambda a: a.reshape(h, CELL, w, CELL, -1).mean(axis=(1, 3))
    gap = cells(edge - ring)
    d = dist.reshape(h, CELL, w, CELL).max(axis=(1, 3))
    inside = d == 0
    seam = (~inside) & (d <= CELL)                      # the cells that touch the seam
    edge_sea = cells(is_sea(edge)[..., None].astype(np.float32))[..., 0]
    ring_sea = cells(sea[..., None])[..., 0]
    fields = []
    for wanted, cap in ((True, None), (False, TONE_CAP)):
        agree = seam & ((edge_sea > .8) & (ring_sea > .8) if wanted else (edge_sea < .2) & (ring_sea < .2))
        values = np.where(agree[..., None], gap, np.nan)
        smooth = np.zeros_like(gap)
        for y, x in zip(*np.nonzero(agree)):             # median along the seam removes single spikes
            window = values[max(0, y - 3):y + 4, max(0, x - 3):x + 4].reshape(-1, 3)
            smooth[y, x] = np.nanmedian(window, axis=0)
        if cap is not None:
            smooth = np.clip(smooth, -cap, cap)
        fields.append(diffuse_offset(smooth, agree, inside))
    share = sea[..., None]
    return fields[0] * share + fields[1] * (1 - share)


def edge_slopes(inner, far):
    """Sideways drift, per pixel of depth, of the picture's lines where they meet an edge.

    ``inner`` and ``far`` are two thin bands of the play area along one edge (N x 3), ``far`` lying
    SLOPE_DEPTH pixels deeper.  A facet edge that crosses the seam at a slant sits a little further
    along in the deeper band; block matching finds by how much.
    """
    n = len(inner)
    shifts = np.arange(-SLOPE_MAX, SLOPE_MAX + 1)
    cost = np.zeros((len(shifts), n), dtype=np.float32)
    kernel = np.ones(2 * SLOPE_WINDOW + 1, dtype=np.float32)
    idx = np.arange(n)
    for k, s in enumerate(shifts):
        moved = far[np.clip(idx + s, 0, n - 1)]
        err = np.abs(moved - inner).sum(axis=1).astype(np.float32)
        cost[k] = np.convolve(err, kernel, mode='same') + 2.0 * abs(int(s))      # flat areas prefer no drift
    best = shifts[np.argmin(cost, axis=0)].astype(np.float32)
    # Neighbouring columns must drift together, or the carried colours comb: median, then smooth.
    best = cv2.medianBlur(best.reshape(1, -1), 5).ravel()
    best = cv2.GaussianBlur(best.reshape(1, -1), (0, 0), 5.0).ravel()
    return best / SLOPE_DEPTH


def weld(ring, base, dist):
    """Carry the centre's edge colours a short way outward along the lines that cross the seam.

    Each ring pixel near an edge takes the colour of the edge pixel it would meet if the picture's
    own lines (facet edges, outlines) ran on straight; that colour fades into the ring over WELD.
    Corners take the corner pixel.
    """
    fb = base.astype(np.float32)
    carried = ring.copy()
    d0, d1 = 0, SLOPE_DEPTH
    bands = {
        'top': (fb[d0:d0 + 3].mean(axis=0), fb[d1:d1 + 3].mean(axis=0), fb[0]),
        'bottom': (fb[L.BASE_H - 3 - d0:L.BASE_H - d0].mean(axis=0), fb[L.BASE_H - 3 - d1:L.BASE_H - d1].mean(axis=0), fb[-1]),
        'left': (fb[:, d0:d0 + 3].mean(axis=1), fb[:, d1:d1 + 3].mean(axis=1), fb[:, 0]),
        'right': (fb[:, L.BASE_W - 3 - d0:L.BASE_W - d0].mean(axis=1), fb[:, L.BASE_W - 3 - d1:L.BASE_W - d1].mean(axis=1), fb[:, -1]),
    }
    reach = int(WELD) + 1
    for side, (inner, far, line) in bands.items():
        slope = edge_slopes(inner, far)            # drift per pixel going deeper into the play area
        n = len(line)
        along = np.arange(n, dtype=np.float32)
        for d in range(1, reach + 1):
            # d pixels outside the edge the line has drifted the other way by slope * d
            src = np.clip(along + slope * d, 0, n - 1)
            lo = np.floor(src).astype(int)
            hi = np.minimum(lo + 1, n - 1)
            t = (src - lo)[:, None]
            colours = line[lo] * (1 - t) + line[hi] * t
            if side == 'top':
                carried[L.OY - d, L.OX:L.OX + L.BASE_W] = colours
            elif side == 'bottom':
                carried[L.OY + L.BASE_H - 1 + d, L.OX:L.OX + L.BASE_W] = colours
            elif side == 'left':
                carried[L.OY:L.OY + L.BASE_H, L.OX - d] = colours
            else:
                carried[L.OY:L.OY + L.BASE_H, L.OX + L.BASE_W - 1 + d] = colours
    for (cy, cx, sy, sx) in ((0, 0, -1, -1), (0, L.BASE_W - 1, -1, 1), (L.BASE_H - 1, 0, 1, -1), (L.BASE_H - 1, L.BASE_W - 1, 1, 1)):
        ys = slice(L.OY + cy - reach, L.OY + cy) if sy < 0 else slice(L.OY + cy + 1, L.OY + cy + 1 + reach)
        xs = slice(L.OX + cx - reach, L.OX + cx) if sx < 0 else slice(L.OX + cx + 1, L.OX + cx + 1 + reach)
        carried[ys, xs] = fb[cy, cx]
    # Where the carried colour and the ring disagree strongly (an outline a few pixels off) a long
    # fade would leave a ghost, so the fade is cut short there.
    clash = cv2.GaussianBlur(np.abs(carried - ring).max(axis=2), (0, 0), 3.0)
    span = WELD - (WELD - WELD_SHORT) * np.clip((clash - 118.0) / 40.0, 0, 1)
    t = np.clip(1 - dist / span, 0, 1)
    weight = (t * t * (3 - 2 * t))[..., None]
    return carried * weight + ring * (1 - weight)


def grain_like(base, shape):
    """Fine luminance grain with the centre's own strength (measured on its quiet snow)."""
    quiet = base[420:820, 500:1200].mean(axis=2)
    high = quiet - cv2.GaussianBlur(quiet, (0, 0), 1.2)
    strength = float(high.std())
    rng = np.random.default_rng(GRAIN_SEED)
    noise = rng.normal(0, 1, shape).astype(np.float32)
    noise = noise - cv2.GaussianBlur(noise, (0, 0), 1.2)
    noise *= strength / float(noise.std())
    return noise, strength


def strip(image, box, scale=1):
    x0, y0, x1, y1 = box
    crop = Image.fromarray(image[y0:y1, x0:x1])
    if scale != 1:
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.LANCZOS)
    return crop


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--work', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--evidence')
    parser.add_argument('--blend', default=None, help='path of master-canvas.blend recorded in canvas.json')
    parser.add_argument('--quality', type=int, default=92)
    args = parser.parse_args()
    work, out = Path(args.work), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    base = np.array(Image.open(ROOT / BASE_REL).convert('RGB'))
    ring = np.array(Image.open(work / 'ring.png').convert('RGB')).astype(np.float32)
    if base.shape[:2] != (L.BASE_H, L.BASE_W) or ring.shape[:2] != (L.CANVAS_H, L.CANVAS_W):
        raise ValueError('SIZE_MISMATCH')
    cx, cy, dist = seam_fields()
    edge = base[cy - L.OY, cx - L.OX].astype(np.float32)
    sea = np.array(Image.open(work / 'ring-sea.png').convert('L')).astype(np.float32) / 255.0
    toned = ring + tone_offset(ring, edge, dist, sea)
    joined = weld(toned, base, dist)
    noise, strength = grain_like(base.astype(np.float32), (L.CANVAS_H, L.CANVAS_W))
    joined = joined + noise[..., None]
    canvas = np.clip(joined + .5, 0, 255).astype(np.uint8)
    centre = (slice(L.OY, L.OY + L.BASE_H), slice(L.OX, L.OX + L.BASE_W))
    canvas[centre] = base
    Image.fromarray(canvas).save(work / 'canvas.png')
    frame = out / 'frame-00.webp'
    Image.fromarray(canvas).save(frame, 'WEBP', quality=args.quality, method=6)
    decoded = np.array(Image.open(frame).convert('RGB')).astype(np.int16)
    delta = np.abs(decoded[centre] - base.astype(np.int16))
    master_delta = int(np.abs(canvas[centre].astype(np.int16) - base.astype(np.int16)).max())

    outer = (sea * 255 + .5).astype(np.uint8)
    outer[centre] = 0                                     # the play area keeps its own sea mask
    half = Image.fromarray(outer).resize((L.CANVAS_W // 2, L.CANVAS_H // 2), Image.LANCZOS)
    Image.merge('RGBA', [Image.new('L', half.size, 255)] * 3 + [half]).save(out / 'sea-mask-canvas.webp', 'WEBP',
                                                                             lossless=True, method=6)
    sea_rel = 'sea-mask-canvas.webp'

    record = {
        'fieldId': FIELD_ID,
        'canvasNativePx': list(L.NATIVE_CANVAS),
        'playOffsetNativePx': list(L.NATIVE_OFFSET),
        'worldScale': L.SCALE,
        'canvasWorldPx': [L.CANVAS_W, L.CANVAS_H],
        'playOffsetWorldPx': [L.OX, L.OY],
        'frame': {'src': 'frame-00.webp', 'sha256': sha(frame), 'bytes': frame.stat().st_size,
                  'encoding': f'WEBP lossy quality {args.quality}'},
        'centreSource': 'bm05-southpole-polish-r2/base.webp',
        'centreSourceSha256': sha(ROOT / BASE_REL),
        'centreDiff': master_delta,
        'centreDiffNote': 'The lossless master (canvas.png, not committed) carries the live picture\'s pixels unchanged. '
                          'frame-00.webp is lossy, so re-encoding moves centre pixels slightly (centreDiffEncoded); '
                          'drawing base.webp over the centre at playOffsetWorldPx restores them exactly.',
        'centreDiffEncoded': {'mean': round(float(delta.mean()), 4), 'max': int(delta.max())},
        'camera': {'elevationDegrees': 52, 'nativePixelsPerUnit': L.UNIT, 'renderScale': L.SCALE,
                   'orthoScale': L.NATIVE_CANVAS[0] / L.UNIT, 'centreNative': [208, 136]},
        'seaMask': None if not sea_rel else {
            'src': sea_rel, 'sha256': sha(out / sea_rel), 'x': 0, 'y': 0, 'width': L.CANVAS_W, 'height': L.CANVAS_H,
            'note': 'Half size, white with alpha = open sea in the ring only; the play area is empty here and keeps its own mask.'},
        'sourceBlend': args.blend,
        'sourceBlendSha256': sha(ROOT / args.blend) if args.blend and (ROOT / args.blend).exists() else None,
        'producersLfSha256': {p: sha_text(ROOT / p) for p in (
            'scripts/battle-canvas-bm05/layout.py', 'scripts/battle-canvas-bm05/sea_map.py',
            'scripts/battle-canvas-bm05/build_scene.py', 'scripts/battle-canvas-bm05/compose.py')},
        'join': {'toneReachWorldPx': REACH * CELL, 'weldWorldPx': WELD, 'grainStd': round(strength, 3)},
        'rightsStatus': 'PROJECT_ORIGINAL',
        'romDerivedPixels': False,
        'generativeAi': None,
        'status': 'LOCAL_PILOT_NOT_WIRED_NOT_PUBLISHED',
    }
    (out / 'canvas.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf8')
    print('CANVAS_COMPOSED', json.dumps({'bytes': record['frame']['bytes'], 'centreDiff': master_delta,
                                         'centreDiffEncoded': record['centreDiffEncoded'], 'grainStd': strength}))

    if args.evidence:
        ev = Path(args.evidence)
        ev.mkdir(parents=True, exist_ok=True)
        # contact sheet: play area (left) and the whole canvas (right) at the same scale
        s = 2
        play = Image.fromarray(base).resize((L.BASE_W // s, L.BASE_H // s), Image.LANCZOS)
        whole = Image.fromarray(canvas).resize((L.CANVAS_W // s, L.CANVAS_H // s), Image.LANCZOS)
        outline = whole.copy()
        ImageDraw.Draw(outline).rectangle([L.OX // s, L.OY // s, (L.OX + L.BASE_W) // s - 1, (L.OY + L.BASE_H) // s - 1],
                                          outline=(255, 60, 60), width=2)
        sheet = Image.new('RGB', (play.width + whole.width * 2 + 48, whole.height + 24), (24, 26, 32))
        sheet.paste(play, (12, 12 + (whole.height - play.height) // 2))
        sheet.paste(whole, (play.width + 24, 12))
        sheet.paste(outline, (play.width + whole.width + 36, 12))
        sheet.save(ev / 'contact-play-vs-canvas.jpg', quality=88)
        whole.save(ev / 'canvas-half.jpg', quality=90)
        # seam strips at full size: 120 px of ring and 120 px of centre along each edge
        b = 120
        x0, y0, x1, y1 = L.OX, L.OY, L.OX + L.BASE_W, L.OY + L.BASE_H
        strip(canvas, (x0 - 40, y0 - b, x0 + 832, y0 + b)).save(ev / 'seam-top-left.png')
        strip(canvas, (x0 + 832, y0 - b, x1 + 40, y0 + b)).save(ev / 'seam-top-right.png')
        strip(canvas, (x0 - 40, y1 - b, x0 + 832, y1 + b)).save(ev / 'seam-bottom-left.png')
        strip(canvas, (x0 + 832, y1 - b, x1 + 40, y1 + b)).save(ev / 'seam-bottom-right.png')
        strip(canvas, (x0 - b, y0 - 40, x0 + b, y0 + 544)).save(ev / 'seam-left-upper.png')
        strip(canvas, (x0 - b, y0 + 544, x0 + b, y1 + 40)).save(ev / 'seam-left-lower.png')
        strip(canvas, (x1 - b, y0 - 40, x1 + b, y0 + 544)).save(ev / 'seam-right-upper.png')
        strip(canvas, (x1 - b, y0 + 544, x1 + b, y1 + 40)).save(ev / 'seam-right-lower.png')


if __name__ == '__main__':
    main()
