"""Join a play-area picture and its painted, propped ring into one canvas (plain Python).

Three steps, all of which touch ring pixels only (the centre stays the live picture's own pixels):

1. props: the Blender render (props and their shadows, RGBA) is laid over the ground picture;
2. tone match: a smooth offset (screened Poisson on native pixels) that equals the colour gap at
   the seam and fades with distance, solved apart for each kind of surface the arena names
   (water must not tint land, and the reverse);
3. weld: for a few pixels outside the seam the centre's edge colours are carried outward along
   the lines that cross the seam and faded into the ring.

"The centre" for steps 2 and 3 is the play area as the game shows it at rest (the picture plus
its still foliage layers), because that is what meets the ring on screen.
"""
import hashlib
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import splu

import canvaslib as C

CELL = 4            # tone match is solved on native pixels (4 canvas pixels)
REACH = 44.0        # cells over which the tone offset fades (176 canvas pixels)
TONE_CAP = 32.0     # largest tone offset (8-bit levels) unless a surface class says otherwise
WELD = 32.0         # canvas pixels over which the centre's edge colours fade into the ring
WELD_SHORT = 9.0    # ... cut to this where ring and centre disagree strongly
SLOPE_DEPTH = 8     # rows between the two bands that measure how lines cross an edge
SLOPE_MAX = 12      # largest drift looked for between those bands (1.5 pixels per pixel)
SLOPE_WINDOW = 5    # half width of the block matched along the edge
SHADOW_TINT = np.array([1.0, .94, .84], dtype=np.float32)   # shadows keep a little sky blue


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def sha_text(path):
    """Hash of a text file with LF line ends, so a CRLF checkout gives the same value."""
    return hashlib.sha256(Path(path).read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def seam_fields():
    """For every canvas pixel: the nearest play-area pixel and the distance to it."""
    yy, xx = np.mgrid[0:C.CANVAS_H, 0:C.CANVAS_W]
    cx = np.clip(xx, C.OX, C.OX + C.BASE_W - 1)
    cy = np.clip(yy, C.OY, C.OY + C.BASE_H - 1)
    dist = np.hypot(xx - cx, yy - cy).astype(np.float32)
    return cx, cy, dist


def lay_props(ground, props):
    """Ground picture with the rendered props and their shadows over it."""
    rgb = props[..., :3].astype(np.float32)
    alpha = props[..., 3:4].astype(np.float32) / 255.0
    solid = (rgb.max(axis=2, keepdims=True) > 6).astype(np.float32)      # a prop; pure black is a caught shadow
    shadow = alpha * (1 - solid)
    out = ground * (1 - shadow * SHADOW_TINT) * (1 - alpha * solid) + rgb * alpha * solid
    return out, alpha[..., 0] * solid[..., 0]


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
    return cv2.resize(out.astype(np.float32), (C.CANVAS_W, C.CANVAS_H), interpolation=cv2.INTER_CUBIC)


def tone_offset(ring, edge, dist, classes=None):
    """Smooth colour offset for the ring: equals (centre edge - ring) beside the seam, fades outward.

    ``classes`` is a list of (test, cap): ``test(rgb)`` marks the pixels of one kind of surface
    (water, say) and ``cap`` limits the offset for it (None = no limit).  Each kind is matched from
    the seam cells where centre and ring agree on what is there, so a facet or trunk that sits a few
    pixels off does not tint its neighbours.  The last class should take everything left over.
    """
    classes = classes or [(lambda rgb: np.ones(rgb.shape[:2], dtype=bool), TONE_CAP)]
    h, w = C.CANVAS_H // CELL, C.CANVAS_W // CELL
    cells = lambda a: a.reshape(h, CELL, w, CELL, -1).mean(axis=(1, 3))
    gap = cells(edge - ring)
    d = dist.reshape(h, CELL, w, CELL).max(axis=(1, 3))
    inside = d == 0
    seam = (~inside) & (d <= CELL)
    out = np.zeros_like(ring)
    taken_edge = np.zeros(edge.shape[:2], dtype=bool)
    taken_ring = np.zeros(ring.shape[:2], dtype=bool)
    for test, cap in classes:
        edge_is = test(edge) & ~taken_edge
        ring_is = test(ring) & ~taken_ring
        taken_edge |= edge_is
        taken_ring |= ring_is
        edge_share = cells(edge_is[..., None].astype(np.float32))[..., 0]
        ring_share = cells(ring_is[..., None].astype(np.float32))[..., 0]
        agree = seam & (edge_share > .8) & (ring_share > .8)
        if not agree.any():
            continue
        values = np.where(agree[..., None], gap, np.nan)
        smooth = np.zeros_like(gap)
        for y, x in zip(*np.nonzero(agree)):             # median along the seam removes single spikes
            window = values[max(0, y - 3):y + 4, max(0, x - 3):x + 4].reshape(-1, 3)
            smooth[y, x] = np.nanmedian(window, axis=0)
        if cap is not None:
            smooth = np.clip(smooth, -cap, cap)
        field = diffuse_offset(smooth, agree, inside)
        share = cv2.GaussianBlur(ring_is.astype(np.float32), (0, 0), 1.5)[..., None]
        out += field * share
    return out


def edge_slopes(inner, far):
    """Sideways drift, per pixel of depth, of the picture's lines where they meet an edge."""
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


def weld(ring, centre, dist, reach_px=WELD, clash_at=118.0):
    """Carry the centre's edge colours a short way outward along the lines that cross the seam."""
    fb = centre.astype(np.float32)
    carried = ring.copy()
    d0, d1 = 0, SLOPE_DEPTH
    bands = {
        'top': (fb[d0:d0 + 3].mean(axis=0), fb[d1:d1 + 3].mean(axis=0), fb[0]),
        'bottom': (fb[C.BASE_H - 3 - d0:C.BASE_H - d0].mean(axis=0), fb[C.BASE_H - 3 - d1:C.BASE_H - d1].mean(axis=0), fb[-1]),
        'left': (fb[:, d0:d0 + 3].mean(axis=1), fb[:, d1:d1 + 3].mean(axis=1), fb[:, 0]),
        'right': (fb[:, C.BASE_W - 3 - d0:C.BASE_W - d0].mean(axis=1), fb[:, C.BASE_W - 3 - d1:C.BASE_W - d1].mean(axis=1), fb[:, -1]),
    }
    reach = int(reach_px) + 1
    for side, (inner, far, line) in bands.items():
        slope = edge_slopes(inner, far)
        n = len(line)
        along = np.arange(n, dtype=np.float32)
        for d in range(1, reach + 1):
            src = np.clip(along + slope * d, 0, n - 1)
            lo = np.floor(src).astype(int)
            hi = np.minimum(lo + 1, n - 1)
            t = (src - lo)[:, None]
            colours = line[lo] * (1 - t) + line[hi] * t
            if side == 'top':
                carried[C.OY - d, C.OX:C.OX + C.BASE_W] = colours
            elif side == 'bottom':
                carried[C.OY + C.BASE_H - 1 + d, C.OX:C.OX + C.BASE_W] = colours
            elif side == 'left':
                carried[C.OY:C.OY + C.BASE_H, C.OX - d] = colours
            else:
                carried[C.OY:C.OY + C.BASE_H, C.OX + C.BASE_W - 1 + d] = colours
    for (cy, cx, sy, sx) in ((0, 0, -1, -1), (0, C.BASE_W - 1, -1, 1), (C.BASE_H - 1, 0, 1, -1), (C.BASE_H - 1, C.BASE_W - 1, 1, 1)):
        ys = slice(C.OY + cy - reach, C.OY + cy) if sy < 0 else slice(C.OY + cy + 1, C.OY + cy + 1 + reach)
        xs = slice(C.OX + cx - reach, C.OX + cx) if sx < 0 else slice(C.OX + cx + 1, C.OX + cx + 1 + reach)
        carried[ys, xs] = fb[cy, cx]
    # Where the carried colour and the ring disagree strongly (an outline a few pixels off) a long
    # fade would leave a ghost, so the fade is cut short there.
    clash = cv2.GaussianBlur(np.abs(carried - ring).max(axis=2), (0, 0), 3.0)
    span = reach_px - (reach_px - WELD_SHORT) * np.clip((clash - clash_at) / 40.0, 0, 1)
    t = np.clip(1 - dist / span, 0, 1)
    weight = (t * t * (3 - 2 * t))[..., None]
    return carried * weight + ring * (1 - weight)


def evidence(canvas, base, folder):
    """Contact sheet (play area beside the whole canvas) and the eight seam strips at full size."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    s = 3
    play = Image.fromarray(base).resize((C.BASE_W // s, C.BASE_H // s), Image.LANCZOS)
    whole = Image.fromarray(canvas).resize((C.CANVAS_W // s, C.CANVAS_H // s), Image.LANCZOS)
    outline = whole.copy()
    ImageDraw.Draw(outline).rectangle([C.OX // s, C.OY // s, (C.OX + C.BASE_W) // s - 1, (C.OY + C.BASE_H) // s - 1],
                                      outline=(255, 60, 60), width=2)
    sheet = Image.new('RGB', (play.width + whole.width * 2 + 48, whole.height + 24), (24, 26, 32))
    sheet.paste(play, (12, 12 + (whole.height - play.height) // 2))
    sheet.paste(whole, (play.width + 24, 12))
    sheet.paste(outline, (play.width + whole.width + 36, 12))
    sheet.save(folder / 'contact-play-vs-canvas.jpg', quality=88)
    Image.fromarray(canvas).resize((C.CANVAS_W // 2, C.CANVAS_H // 2), Image.LANCZOS).save(folder / 'canvas-half.jpg', quality=88)
    b = 120
    x0, y0, x1, y1 = C.OX, C.OY, C.OX + C.BASE_W, C.OY + C.BASE_H
    crop = lambda box: Image.fromarray(canvas[box[1]:box[3], box[0]:box[2]])
    crop((x0 - 40, y0 - b, x0 + 832, y0 + b)).save(folder / 'seam-top-left.png')
    crop((x0 + 832, y0 - b, x1 + 40, y0 + b)).save(folder / 'seam-top-right.png')
    crop((x0 - 40, y1 - b, x0 + 832, y1 + b)).save(folder / 'seam-bottom-left.png')
    crop((x0 + 832, y1 - b, x1 + 40, y1 + b)).save(folder / 'seam-bottom-right.png')
    crop((x0 - b, y0 - 40, x0 + b, y0 + 544)).save(folder / 'seam-left-upper.png')
    crop((x0 - b, y0 + 544, x0 + b, y1 + 40)).save(folder / 'seam-left-lower.png')
    crop((x1 - b, y0 - 40, x1 + b, y0 + 544)).save(folder / 'seam-right-upper.png')
    crop((x1 - b, y0 + 544, x1 + b, y1 + 40)).save(folder / 'seam-right-lower.png')
