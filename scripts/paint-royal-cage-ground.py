"""Paint the ground texture of a royal map in field-native space (4 texels per native px).

python scripts/paint-royal-cage-ground.py ROYAL_RANCH|STELLAR_ZOO out.png [walk_overlay.png]
"""
import math, sys
import numpy as np
from PIL import Image, ImageDraw
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import royal_cage_layout as L

EDITION, OUT = sys.argv[1], sys.argv[2]
OVERLAY = sys.argv[3] if len(sys.argv) > 3 else None
SCALE = 4
H, W = L.FIELD_H * SCALE, L.FIELD_W * SCALE
py, px = np.mgrid[0:H, 0:W].astype(np.float64)
nx, ny = (px + 0.5) / SCALE, (py + 0.5) / SCALE
u, w = nx / 16.0, ny / (16.0 * L.S52)          # world units on the ground
rng = np.random.default_rng(20261103 if EDITION == 'ROYAL_RANCH' else 20261104)


def hexcol(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float64) / 255.0


def mix(img, mask, color):
    m = np.clip(mask, 0, 1)[..., None]
    return img * (1 - m) + color * m


def smooth(d, width):
    """1 inside (d < 0), 0 outside, antialiased over `width` world units."""
    return np.clip(0.5 - d / width, 0, 1)


def noise(scale, seed):
    r = np.random.default_rng(seed)
    acc = np.zeros_like(u)
    for k in range(5):
        fx, fy, ph = r.uniform(0.6, 1.6, 3) * (k + 1) / scale
        acc += np.sin(u * fx * 6.283 + ph * 10) * np.cos(w * fy * 6.283 + ph * 7) / (k + 1)
    return acc / 2.3


def seg_field(a, b):
    """World distance from every texel to the segment a-b (native points)."""
    au, aw = L.to_world(*a); bu, bw = L.to_world(*b)
    du, dw = bu - au, bw - aw
    t = np.clip(((u - au) * du + (w - aw) * dw) / (du * du + dw * dw), 0, 1)
    return np.hypot(u - au - t * du, w - aw - t * dw)


def circ(c):
    cu, cw = L.to_world(*c)
    return np.hypot(u - cu, w - cw)


# Distance to the outer rim (positive inside), vectorised.
poly = L.outline()
inside = np.zeros_like(u, bool)
for i in range(len(poly)):
    (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
    cond = ((y0 > ny) != (y1 > ny)) & (nx < (x1 - x0) * (ny - y0) / ((y1 - y0) if y1 != y0 else 1e-9) + x0)
    inside ^= cond
rim = np.min([seg_field(a, b) for a, b in L.outer_edges()], axis=0)
rim = np.where(inside, rim, -rim)
plaza = circ(L.PLAZA)
centres = L.CENTERS

if EDITION == 'ROYAL_RANCH':
    # Manicured lawn: diagonal mowing stripes in two greens, a soft cloud of variation.
    stripe = (np.floor((u + w) / 0.9) % 2)
    img = np.where(stripe[..., None] > 0, hexcol('#5aa83e'), hexcol('#4c9a35'))
    img = img * (1 + 0.07 * noise(3.0, 1)[..., None])
    # A darker border lawn by the balustrade.
    img = mix(img, smooth(rim - 0.75, 0.25), hexcol('#3f8530'))
    # Promenades from the plaza to each hex: cream flagstones with gold edging.
    paths = np.min([seg_field(L.PLAZA, c) for c in centres.values()], axis=0)
    flag = 0.92 + 0.08 * ((np.floor(u / 0.45) + np.floor(w / 0.45)) % 2)
    img = mix(img, smooth(paths - 0.78, 0.04), hexcol('#d6a93a'))
    img = mix(img, smooth(paths - 0.66, 0.04), hexcol('#efe4c8') * flag[..., None])
    # The marble plaza: rings of white and cream, gold bands.
    ring = (np.floor(plaza / 0.32) % 2)
    marble = np.where(ring[..., None] > 0, hexcol('#f4efe4'), hexcol('#e3d9c2'))
    img = mix(img, smooth(plaza - 2.55, 0.04), hexcol('#c9962b'))
    img = mix(img, smooth(plaza - 2.42, 0.04), marble)
    img = mix(img, smooth(np.abs(plaza - 1.9) - 0.05, 0.03), hexcol('#d6a93a'))
    # A crimson carpet from the palace door to the plaza, gold-edged.
    door = (144, 46)
    carpet = seg_field(door, L.PLAZA)
    img = mix(img, smooth(carpet - 0.42, 0.03), hexcol('#d4a531'))
    img = mix(img, smooth(carpet - 0.34, 0.03), hexcol('#a3122a') * (0.95 + 0.05 * noise(0.5, 3))[..., None])
    # The palace forecourt and the pavilion's marble ring.
    pu, pw = L.to_world(144, 30)
    fore = np.maximum(np.abs(u - pu) - 2.3, np.abs(w - pw - 0.35) - 1.45)
    img = mix(img, smooth(fore, 0.04), hexcol('#ece4d0'))
    img = mix(img, smooth(circ((46, 40)) - 1.55, 0.04), hexcol('#e8dfca'))
    # Flower beds along the promenades: dark soil with red, pink, white and gold blooms.
    beds = []
    for name, c in centres.items():
        cu, cw = L.to_world(*c); pu2, pw2 = L.to_world(*L.PLAZA)
        du, dw = cu - pu2, cw - pw2; n = math.hypot(du, dw); du, dw = du / n, dw / n
        for t in (0.42, 0.72):
            mu, mw = pu2 + du * n * t, pw2 + dw * n * t
            for side in (-1, 1):
                beds.append((mu - dw * 1.15 * side, mw + du * 1.15 * side))
    bed_d = np.min([np.hypot(u - bu, w - bw) for bu, bw in beds], axis=0)
    bed = smooth(bed_d - 0.42, 0.04) * (rim > 0.9)
    img = mix(img, bed, hexcol('#2f5a24'))
    dots = rng.random(u.shape)
    palette = [hexcol('#e8304a'), hexcol('#ff8fb1'), hexcol('#fff6e8'), hexcol('#ffc93c')]
    pick = np.floor(rng.random(u.shape) * 4).astype(int)
    for k, col in enumerate(palette):
        img = mix(img, bed * (dots > 0.82) * (pick == k), col)
else:
    # Hull deck: small hex panels in navy with soft lighter seams.
    hu, hw = u / 0.62, w / 0.62
    q = (2 / 3 * hu); r = (-1 / 3 * hu + math.sqrt(3) / 3 * hw)
    x, z = q, r; y = -x - z
    rx, ry, rz = np.round(x), np.round(y), np.round(z)
    dx, dy, dz = np.abs(rx - x), np.abs(ry - y), np.abs(rz - z)
    rx = np.where((dx > dy) & (dx > dz), -ry - rz, rx)
    rz = np.where(~((dx > dy) & (dx > dz)) & ~(dy > dz), -rx - ry, rz)
    edge = np.maximum.reduce([np.abs(rx - x), np.abs(-rx - rz - y), np.abs(rz - z)])
    shade = 0.93 + 0.07 * ((rx * 7 + rz * 13) % 3) / 2
    img = hexcol('#222c50') * shade[..., None] * (1 + 0.05 * noise(2.0, 9)[..., None])
    img = mix(img, np.clip((edge - 0.44) / 0.05, 0, 1) * 0.8, hexcol('#3a4f88'))
    # Alien moss in soft drifts, teal and violet, glowing at the edges, with bright spores.
    moss = noise(1.6, 11) + 0.35 * noise(0.5, 14)
    moss_mask = smooth(-(moss - 0.32), 0.12) * (rim > 0.7) * (plaza > 2.6)
    tone = np.where(noise(1.4, 12)[..., None] > 0, hexcol('#1fa596'), hexcol('#7048d0'))
    img = mix(img, moss_mask * 0.85, tone * (0.85 + 0.2 * noise(0.3, 13)[..., None]))
    img = mix(img, smooth(np.abs(moss - 0.32) - 0.015, 0.02) * (rim > 0.7) * (plaza > 2.6) * 0.7, hexcol('#9ffff0'))
    spores = (rng.random(u.shape) > 0.98) * moss_mask
    img = mix(img, spores, hexcol('#d8fff6'))
    # Light lanes: cyan from the pool to each hex, a ring around the pool.
    lanes = np.min([seg_field(L.PLAZA, c) for c in centres.values()], axis=0)
    img = mix(img, smooth(lanes - 0.5, 0.04), hexcol('#26304f'))
    img = mix(img, smooth(np.abs(lanes - 0.42) - 0.05, 0.03), hexcol('#3ff2ff'))
    img = mix(img, smooth(plaza - 2.5, 0.04), hexcol('#232d4e'))
    img = mix(img, smooth(np.abs(plaza - 2.35) - 0.07, 0.03), hexcol('#3ff2ff'))
    img = mix(img, smooth(np.abs(plaza - 2.0) - 0.03, 0.03), hexcol('#8b6cff'))
    # Launch pad (hex A): yellow-black hazard ring and a white H.
    pad = circ((44, 38))
    hazard = (np.floor((np.arctan2(w - L.to_world(44, 38)[1], u - L.to_world(44, 38)[0]) / 6.283 * 24)) % 2)
    img = mix(img, smooth(pad - 1.55, 0.04), hexcol('#2b2f3a'))
    img = mix(img, smooth(np.abs(pad - 1.38) - 0.12, 0.03), np.where(hazard[..., None] > 0, hexcol('#ffcc33'), hexcol('#20222a')))
    # Observatory apron (hex B) and a teleporter disc (hex C).
    img = mix(img, smooth(circ((150, 30)) - 1.6, 0.04), hexcol('#cfd6e6'))
    tp = circ((70, 150))
    img = mix(img, smooth(tp - 0.95, 0.04), hexcol('#2a2350'))
    img = mix(img, smooth(np.abs(tp - 0.8) - 0.06, 0.03), hexcol('#b98cff'))
    img = mix(img, smooth(np.abs(tp - 0.45) - 0.05, 0.03), hexcol('#3ff2ff'))
    # Star speckles in the dark panels.
    img = mix(img, (rng.random(u.shape) > 0.9965) * (moss_mask < 0.1), hexcol('#ffffff'))
    # Glowing rim strip just inside the edge.
    img = mix(img, smooth(np.abs(rim - 0.22) - 0.035, 0.02), hexcol('#3ff2ff'))

img = np.clip(img, 0, 1)
if EDITION == 'STELLAR_ZOO':
    # The nebula pool's own surface: a spiral galaxy that the map turns slowly (512 x 512).
    N = 512
    gy, gx = np.mgrid[0:N, 0:N].astype(np.float64)
    X, Y = (gx + 0.5) / N * 2 - 1, (gy + 0.5) / N * 2 - 1
    R, A = np.hypot(X, Y), np.arctan2(Y, X)
    arms = 0.5 + 0.5 * np.cos(2 * (A - 3.2 * np.log(R + 0.06)))
    g = np.zeros((N, N, 3))
    g += hexcol('#0c0a2a')
    g = g * (1 - 0) + hexcol('#3b1d8f') * np.clip(1.2 - R, 0, 1)[..., None] * 0.9
    g += hexcol('#d257c8') * (arms ** 3 * np.clip(1 - R, 0, 1))[..., None] * 0.9
    g += hexcol('#59c8ff') * (arms ** 6 * np.clip(0.9 - R, 0, 1))[..., None] * 0.7
    g += hexcol('#fff1c8') * np.exp(-(R / 0.12) ** 2)[..., None]
    sr = np.random.default_rng(7)
    stars = (sr.random((N, N)) > 0.992) * (0.4 + 0.6 * sr.random((N, N)))
    g += stars[..., None] * hexcol('#ffffff')
    g = np.clip(g, 0, 1)
    Image.fromarray((g * 255).astype(np.uint8), 'RGB').save(OUT.replace('.png', '_galaxy.png'))
alpha = np.clip(0.5 + rim / 0.03, 0, 1)
rgba = np.dstack([img, alpha]) * 255
Image.fromarray(rgba.astype(np.uint8), 'RGBA').save(OUT)
print('PAINTED', EDITION, OUT, W, H)

if OVERLAY:
    base = Image.fromarray(rgba.astype(np.uint8), 'RGBA').convert('RGB')
    draw = ImageDraw.Draw(base, 'RGBA')
    grid = L.walk_tiles(EDITION)
    for ty in range(L.TILES_H):
        for tx in range(L.TILES_W):
            box = [tx * 8 * SCALE, ty * 8 * SCALE, (tx + 1) * 8 * SCALE - 1, (ty + 1) * 8 * SCALE - 1]
            if grid[ty][tx]:
                draw.rectangle(box, fill=(40, 255, 90, 90), outline=(20, 120, 40, 160))
            elif L.obstacle_hit(EDITION, tx * 8 + 4, ty * 8 + 4):
                draw.rectangle(box, fill=(255, 60, 60, 90))
    draw.line([(x * SCALE, y * SCALE) for x, y in poly + poly[:1]], fill=(255, 255, 255, 255), width=3)
    base.save(OVERLAY)
    print('OVERLAY', OVERLAY, sum(map(sum, grid)))
