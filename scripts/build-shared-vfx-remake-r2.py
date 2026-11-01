#!/usr/bin/env python3
"""Original remade cells for eleven shared battle-effect banks (remake r2).

Owner direction 2026-11-01 (VFX_FIVE_LAYER_20261101): remake the most used
shared banks that the 210-cell pack does not cover yet, plus the three banks no
move record names (seed00, snowcrystal00, blacksmoke04) so the presentation
fallback draws original cells.

Production rule: NO image input of any kind. Every pixel is drawn here from
numpy shape fields and a banded five-tone palette with a dark rim, the same
finish as the 210-cell pack (4 raster px per native px, 2 px steps). The only
inputs are numbers: each cell's native size, anchor and blank state from the
public battle-effects descriptor, and the sequence table (which cells play in
which sequence, for how many ticks) from battleEffectProfiles.json. Native
timing is unchanged; the battle's effect VM still moves, scales and fades the
cells exactly as before.

Usage: python -I scripts/build-shared-vfx-remake-r2.py [--check]
Writes assets/production/vfx/original-shared-remake-r2-20261101/{effects.png,manifest.json}
"""
import hashlib, json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = 'assets/production/vfx/original-shared-remake-r2-20261101'
DESCRIPTOR = 'assets/production/public-runtime/battle-effects.render.v1.json'
PROFILES = 'src/data/championship/battleEffectProfiles.json'
DENSITY = 4          # raster px per native px (as the 210-cell pack)
GRID = 2             # samples per native px; upscaled x2 -> 2 px steps
ATLAS_WIDTH = 1024

# Five tones per bank: rim, edge, main, light, core (0xRRGGBB).
PALETTES = {
    'water':  [0x0b2a6b, 0x1f5fd6, 0x3fb8ff, 0x9fe6ff, 0xffffff],
    'toxic':  [0x26103a, 0x6a3a8a, 0x8fc23a, 0xcfeb7a, 0xf4ffd0],
    'light':  [0x6a3a00, 0xe09a2a, 0xffd86a, 0xfff2c0, 0xffffff],
    'thorn':  [0x1e1408, 0x5a4422, 0x9a8048, 0xd6c48a, 0xfff6d8],
    'wind':   [0x0d3b33, 0x3f9f86, 0x9fe6d0, 0xd8fff2, 0xffffff],
    'rock':   [0x24160a, 0x6e4a2a, 0xa87848, 0xd8a868, 0xfff0d0],
    'seed':   [0x0f2a10, 0x2f7f32, 0x6cc840, 0xb8ec78, 0xf0ffd0],
    'ice':    [0x0e2c66, 0x3f8fd0, 0x8fdcff, 0xd2f6ff, 0xffffff],
    'smoke':  [0x08050e, 0x21162e, 0x433452, 0x6e5e82, 0xa898bc],
    'flame':  [0x5a1405, 0xd0380f, 0xff8a1c, 0xffd27a, 0xfff6d0],
}
THRESH = [0.08, 0.27, 0.48, 0.70, 0.88]
BAND_ALPHA = [1.0, 0.9, 1.0, 1.0, 1.0]

# bank id -> (family, effect id, title, palette)
BANKS = {
    6:   ('e003_bubble00', 'proj_bubble_spheres', '泡沫連珠（泡泡投射物）', 'water'),
    32:  ('e003_walaser00', 'proj_tide_lance', '潮線水槍（水雷射）', 'water'),
    8:   ('e003_unchi00', 'proj_bog_core', '沼核毒漿（毒泥核）', 'toxic'),
    78:  ('e003_lightball02', 'proj_corona_orb', '日冕大光球（大型光球）', 'light'),
    53:  ('e003_toge00', 'proj_bramble_spike', '荊棘尖刺（尖刺投射物）', 'thorn'),
    33:  ('e003_tatumaki00', 'wind_cyclone_funnel', '旋風漏斗（龍捲風）', 'wind'),
    24:  ('e003_rock00', 'proj_quarry_stone', '碎岩石彈（岩石）', 'rock'),
    25:  ('e003_seed00', 'proj_sprout_seed', '萌芽種子（種子）', 'seed'),
    26:  ('e003_snowcrystal00', 'ice_hex_snowflake', '六角雪晶（雪晶）', 'ice'),
    13:  ('e003_beam01', 'beam_ember_lance', '焰芯射線（火焰光束段）', 'flame'),
    121: ('e003_blacksmoke04', 'smoke_umbral_plume', '暗影煙柱（黑煙）', 'smoke'),
}


# ----------------------------------------------------------------- raster kit
class Cell:
    """Sample grid around the anchor; coordinates are native px from the anchor."""
    def __init__(self, w, h, ox, oy, margin):
        self.w, self.h, self.ox, self.oy, self.m = w, h, ox, oy, margin
        nx, ny = (w + 2 * margin) * GRID, (h + 2 * margin) * GRID
        xs = (np.arange(nx) + 0.5) / GRID - margin - ox
        ys = (np.arange(ny) + 0.5) / GRID - margin - oy
        self.u, self.v = np.meshgrid(xs, ys)
        self.I = np.zeros_like(self.u)
        self.A = np.ones_like(self.u)

    def add(self, field, alpha=1.0):
        take = field > self.I
        self.I = np.where(take, field, self.I)
        self.A = np.where(take, alpha, self.A)

    def raster(self, palette):
        tones = [((c >> 16) & 255, (c >> 8) & 255, c & 255) for c in palette]
        rgba = np.zeros(self.I.shape + (4,), dtype=np.uint8)
        for i, t in enumerate(THRESH):
            sel = self.I >= t
            rgba[sel, 0], rgba[sel, 1], rgba[sel, 2] = tones[i]
            rgba[sel, 3] = np.clip(BAND_ALPHA[i] * self.A[sel] * 255, 0, 255).astype(np.uint8)
        big = np.repeat(np.repeat(rgba, DENSITY // GRID, axis=0), DENSITY // GRID, axis=1)
        return big


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def noise2(u, v, seed, scale=1.0):
    """Deterministic value noise in [0,1]."""
    rng = np.random.default_rng(seed)
    table = rng.random((64, 64))
    x, y = u * scale + 17.3, v * scale + 9.1
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    g = lambda a, b: table[a % 64, b % 64]
    return (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy


def ball(c, cx, cy, r, hot=(0.0, 0.0), soft=0.7, rim=0.52):
    """A shaded sphere: rim tone at the border, hot core towards `hot` offset."""
    d = np.hypot(c.u - cx, c.v - cy)
    body = smooth(r + soft * 0.5, r - soft * 0.5, d)
    hd = np.hypot(c.u - cx - hot[0] * r, c.v - cy - hot[1] * r) / max(r, 0.01)
    return body * (rim + (1 - rim) * np.clip(1 - hd, 0, 1))


def ring(c, cx, cy, r, width, peak=0.95, sy=1.0):
    d = np.hypot(c.u - cx, (c.v - cy) / sy)
    return np.clip(1 - np.abs(d - r) / max(width, 0.01), 0, 1) * peak


def capsule(c, x0, y0, x1, y1, r, peak=1.0, rim=0.5):
    px, py = c.u - x0, c.v - y0
    dx, dy = x1 - x0, y1 - y0
    t = np.clip((px * dx + py * dy) / max(dx * dx + dy * dy, 1e-6), 0, 1)
    d = np.hypot(px - dx * t, py - dy * t)
    return smooth(r + 0.35, r - 0.35, d) * (rim + (peak - rim) * np.clip(1 - d / max(r, 0.01), 0, 1))


def star(c, cx, cy, ro, ri, n, rot=0.0, peak=1.0):
    a = np.arctan2(c.v - cy, c.u - cx) - rot
    d = np.hypot(c.u - cx, c.v - cy)
    k = np.abs(((a / (2 * math.pi / n)) % 1.0) - 0.5) * 2  # 1 at spoke, 0 between
    rad = ri + (ro - ri) * k ** 2.2
    return smooth(rad + 0.4, rad - 0.4, d) * (0.5 + 0.5 * np.clip(1 - d / max(ro, 0.01), 0, 1)) * peak


def poly(c, pts, peak=1.0, facet=None):
    """Convex polygon with a lit facet gradient (facet = light direction)."""
    inside = np.full(c.u.shape, np.inf)
    n = len(pts)
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        ex, ey = x1 - x0, y1 - y0
        L = math.hypot(ex, ey)
        # signed distance to edge (positive inside for clockwise screen order)
        dist = ((c.u - x0) * ey - (c.v - y0) * ex) / L * -1
        inside = np.minimum(inside, dist)
    body = smooth(-0.35, 0.35, inside)
    if facet is None:
        return body * peak * (0.55 + 0.45 * np.clip(inside / 3, 0, 1))
    fx, fy = facet
    lit = np.clip(0.5 + 0.18 * (-(c.u * fx + c.v * fy)), 0.25, 1)
    return body * peak * np.clip(0.45 + 0.5 * lit * np.clip(inside / 2.2, 0.35, 1), 0, 1)


def dots(c, pts, r=0.6, peak=0.95):
    out = np.zeros_like(c.u)
    for x, y, *rest in pts:
        rr = rest[0] if rest else r
        out = np.maximum(out, smooth(rr + 0.3, rr - 0.3, np.hypot(c.u - x, c.v - y)) * peak)
    return out


def sparkle(c, cx, cy, s, peak=1.0):
    """A four-point twinkle of half-length s."""
    arm = lambda dx, dy: capsule(c, cx - dx, cy - dy, cx + dx, cy + dy, max(0.35, s * 0.16), peak)
    return np.maximum(arm(s, 0), arm(0, s))


# ----------------------------------------------------------------- designs
def bubble(c, k, cell):
    # launch 0-2 grow from the muzzle; body 3-4 wobble; hit 5-7 pop.
    if cell in (0, 1, 2):
        n = cell + 1
        for i in range(n):
            r = 1.2 + 0.7 * cell - 0.4 * i
            x, y = -1.0 + i * 1.8, (-0.9 if i % 2 else 0.6) * min(i, 1)
            c.add(ball(c, x, y, r, hot=(-0.4, -0.4), rim=0.5), 0.8)
            c.add(dots(c, [(x - r * 0.35, y - r * 0.4, 0.45)], peak=1.0))
    elif cell in (3, 4):
        sx, sy = (1.0, 1.0) if cell == 3 else (1.12, 0.88)
        d = np.hypot(c.u / sx, c.v / sy)
        glass = smooth(3.3, 2.7, d) * 0.33
        rimv = np.clip(1 - np.abs(d - 3.0) / 0.75, 0, 1) * 0.62
        c.add(glass, 0.55)
        c.add(rimv)
        c.add(dots(c, [(-1.2 * sx, -1.3 * sy, 0.7), (1.4, 1.2, 0.35)], peak=1.0))
        c.add(ball(c, 3.4 * sx, -2.2 * sy if cell == 3 else -1.6, 0.9, hot=(-0.3, -0.3)), 0.8)
    elif cell == 5:
        c.add(ring(c, 0, 0, 2.6, 0.7, 0.8), 0.9)
        c.add(dots(c, [(-2.6, -2.2, 0.6), (2.4, -2.4, 0.5), (0, -3.4, 0.5), (2.8, 1.6, 0.4)], peak=0.9))
    elif cell == 6:
        c.add(ring(c, 0, 0, 5.4, 1.0, 0.75), 0.75)
        pts = [(math.cos(a) * 6.4, math.sin(a) * 6.4, 0.7 + 0.25 * (i % 2)) for i, a in enumerate(np.linspace(0, 2 * math.pi, 9)[:-1])]
        c.add(dots(c, pts, peak=0.95))
        c.add(sparkle(c, 0, 0, 1.4, 0.7))
    else:
        c.add(dots(c, [(-2.8, -1.4, 0.55), (2.6, -2.0, 0.45), (0.4, 2.4, 0.4), (-1.0, -3.0, 0.35)], peak=0.8), 0.8)


def walaser(c, k, cell):
    if cell == 0:   # muzzle bead, anchor at the right-middle of an 8x16 cell
        c.add(ball(c, -1.0, 0, 2.6, hot=(0.3, -0.3)))
        c.add(dots(c, [(-3.6, -3.0, 0.5), (-3.2, 3.2, 0.5)]))
    elif cell == 1:
        c.add(ball(c, 0, 0, 3.6, hot=(0.3, -0.3)))
        c.add(ring(c, 0, 0, 5.4, 0.7, 0.6, sy=1.4), 0.8)
    elif cell in (2, 3):   # jet head: teardrop pointing right, swirl phase
        ph = 0 if cell == 2 else math.pi
        r = np.hypot(c.u, c.v)
        tail = capsule(c, -6.0, 0, 1.0, 0, 2.6, peak=0.85, rim=0.5)
        head = ball(c, 1.6, 0, 3.6, hot=(0.35, -0.35))
        swirl = np.clip(np.sin(np.arctan2(c.v, c.u) * 3 + r * 1.4 + ph), 0, 1) * smooth(4.2, 2.0, r) * 0.9
        c.add(tail); c.add(head); c.add(swirl * 0.95)
        c.add(dots(c, [(-6.5, -3.0 if cell == 2 else 3.0, 0.5), (-4.5, 3.4 if cell == 2 else -3.4, 0.45)]))
    elif cell in (4, 5, 6):   # splash crown
        s = cell - 4
        crown = 0
        for i in range(7):
            a = -math.pi * (0.1 + 0.8 * i / 6)
            L = 2.4 + 2.2 * s + (i % 2) * 0.8
            c.add(capsule(c, math.cos(a) * 1.0, math.sin(a) * 1.0, math.cos(a) * L, math.sin(a) * L, 0.9 - 0.15 * s, peak=0.9), 0.95 - 0.2 * s)
        c.add(ring(c, 0, 1.0, 2.6 + 2.0 * s, 0.7, 0.7 - 0.15 * s, sy=0.4), 0.85)
        c.add(dots(c, [(math.cos(a) * (5 + 1.5 * s), -abs(math.sin(a)) * (4 + 2 * s), 0.6) for a in np.linspace(0.3, 2.8, 5)], peak=0.9))


def bog_core(c, k, cell):
    if cell in (0, 1):
        n = noise2(c.u, c.v, 81 + cell, 0.55)
        r = np.hypot(c.u, c.v * 1.08) + (n - 0.5) * 2.2
        body = smooth(5.6, 4.8, r) * (0.5 + 0.5 * np.clip(1 - np.hypot(c.u + 1.5, c.v + 1.8) / 5.5, 0, 1))
        c.add(body)
        bubbles = [(-2.0, -1.2, 0.9), (1.8, 1.0, 0.7), (0.6, -2.8, 0.55)] if cell == 0 else [(-1.0, 1.6, 0.8), (2.2, -1.4, 0.75), (-2.6, -2.2, 0.5)]
        for x, y, r0 in bubbles:
            c.add(ring(c, x, y, r0, 0.45, 0.95))
        c.add(dots(c, [(4.6, -4.2 if cell == 0 else -3.4, 0.6), (-5.0, 3.0, 0.45)], peak=0.6))
    else:
        s = cell - 2
        n = noise2(c.u, c.v, 90 + cell, 0.7)
        r = np.hypot(c.u, c.v * 1.7) + (n - 0.5) * 3.0
        c.add(smooth(5.5 + 1.8 * s, 4.4 + 1.5 * s, r) * (0.62 + 0.25 * np.clip(1 - np.hypot(c.u + 1, c.v + 0.5) / 5, 0, 1) - 0.1 * s), 0.95 - 0.15 * s)
        pts = [(math.cos(a) * (5.5 + 2 * s), math.sin(a) * (3.6 + 1.6 * s) - 1.0, 0.9 - 0.2 * s) for a in np.linspace(-2.8, -0.3, 6)]
        c.add(dots(c, pts, peak=0.85))


def corona(c, k, cell):
    if cell in (0, 2):   # charging twinkle
        c.add(sparkle(c, 0, 0, 5.5 if cell == 0 else 6.5))
        c.add(ball(c, 0, 0, 1.8 if cell == 0 else 2.4, rim=0.7))
    elif cell == 1:
        c.add(sparkle(c, 0, 0, 3.0))
    elif cell in (3, 4, 5, 6):
        rot = (cell - 3) * math.pi / 16
        c.add(star(c, 0, 0, 14.5, 9.0, 12, rot, peak=0.62), 0.9)
        c.add(ball(c, 0, 0, 9.0, hot=(-0.25, -0.3), rim=0.55))
        c.add(ring(c, 0, 0, 11.4, 0.7, 0.72), 0.9)
        c.add(sparkle(c, 0, 0, 5.0, 1.0))
    elif cell == 7:   # burst
        c.add(ring(c, 0, 0, 16.0, 1.6, 0.8), 0.9)
        c.add(star(c, 0, 0, 19.0, 7.0, 8, math.pi / 8, peak=0.8), 0.9)
        c.add(ball(c, 0, 0, 6.5, rim=0.7))
    else:             # fading halo
        c.add(ring(c, 0, 0, 13.5, 1.1, 0.6), 0.7)
        c.add(dots(c, [(math.cos(a) * 11, math.sin(a) * 11, 0.9) for a in np.linspace(0, 2 * math.pi, 9)[:-1]], peak=0.85))


def bramble(c, k, cell):
    spike = lambda x0, y0, x1, y1, r: capsule(c, x0, y0, x1, y1, r, peak=0.95, rim=0.5) * smooth(-0.5, 2.0, (c.u - x0) * (x1 - x0) + (c.v - y0) * (y1 - y0) + 2)
    def thorn(x, y, ang, L, w):
        tx, ty = x + math.cos(ang) * L, y + math.sin(ang) * L
        d = np.hypot(c.u - x, c.v - y)
        t = np.clip(((c.u - x) * math.cos(ang) + (c.v - y) * math.sin(ang)) / L, 0, 1)
        off = np.abs(-(c.u - x) * math.sin(ang) + (c.v - y) * math.cos(ang))
        width = w * (1 - t) + 0.25
        body = smooth(width + 0.3, width - 0.3, off) * (t > 0) * (t < 1)
        lit = 0.5 + 0.45 * (1 - t) * (off < width * 0.45)
        return body * lit
    if cell == 0:
        for ang, L in ((-0.5, 5.5), (0.25, 6.5), (0.9, 4.5)):
            c.add(thorn(-2.5, 1.5, ang - 0.3, L + 0.8, 2.2))
        c.add(ball(c, -2.5, 1.5, 1.6, rim=0.45))
    elif cell == 1:
        c.add(thorn(-6.5, 0, 0.0, 14.0, 3.0))
        c.add(thorn(-3.0, 0.4, 2.5, 3.2, 0.8))
        c.add(thorn(-1.0, -0.4, -2.3, 3.0, 0.7))
    else:
        s = cell - 2
        for i, ang in enumerate((-0.6, 0.2, 0.9, 2.6, -2.4)):
            L = 3.0 + 1.2 * s
            x, y = math.cos(ang) * (1.2 + 1.8 * s), math.sin(ang) * (1.2 + 1.8 * s)
            c.add(thorn(x, y, ang, L, 1.1 - 0.2 * s), 1.0 - 0.15 * s)
        c.add(dots(c, [(math.cos(a) * (5 + 1.5 * s), math.sin(a) * (5 + 1.5 * s), 0.5) for a in (0.5, 1.7, 3.4, 4.6)], peak=0.8))


def cyclone(c, k, cell):
    if cell in (0, 1, 2):   # ground swirl (anchor near the bottom of a 16x8 cell)
        s = cell
        for i in range(2 + s):
            c.add(ring(c, 0, -0.8 - i * 0.9, 2.4 + i * 1.6 + s * 0.8, 0.85, 0.88 - 0.1 * i, sy=0.3), 0.9)
        c.add(dots(c, [(-5.5 + s, -1.5, 0.5), (5.0 - s, -2.4, 0.45)], peak=0.7))
    elif cell in (3, 4, 5, 6, 7, 8, 9):
        ph = (cell - 3) * math.pi / 2
        spread = 1.0 if cell <= 6 else 1.0 + 0.35 * (cell - 6)
        fade = 1.0 if cell <= 6 else 1.0 - 0.22 * (cell - 6)
        for j in range(7):
            y = -1.0 - j * 1.9
            rx = (1.6 + j * 0.85) * spread
            sw = math.sin(ph + j * 0.9) * 0.9
            c.add(ring(c, sw, y, rx, 0.95, (0.96 - 0.03 * j) * fade, sy=0.34), 0.95 * fade)
            band = np.clip(1 - np.abs(c.v - y) / 0.9, 0, 1) * smooth(rx + 0.3, rx - 0.6, np.abs(c.u - sw)) * 0.4 * fade
            c.add(band, 0.7)
        c.add(dots(c, [(math.cos(ph + a) * 6.5 * spread, -4 - 3 * a, 0.5) for a in (0.5, 1.6, 2.7)], peak=0.75 * fade))


def quarry(c, k, cell):
    base = [(-4.6, -1.8), (-1.6, -5.0), (3.4, -4.0), (5.4, 0.4), (2.6, 4.6), (-2.6, 4.4), (-5.4, 1.4)]
    if cell == 0:
        c.add(poly(c, base, facet=(0.6, 0.8)))
        c.add(capsule(c, -1.5, -2.5, 2.0, -3.0, 0.45, peak=0.85, rim=0.75))
    elif cell == 1:
        c.add(poly(c, base, facet=(0.6, 0.8)))
        crack = capsule(c, -3.0, -3.0, 0.4, 0.2, 0.35, 1, 1) + capsule(c, 0.4, 0.2, -0.6, 3.6, 0.35, 1, 1) + capsule(c, 0.4, 0.2, 3.8, -0.8, 0.3, 1, 1)
        c.I = np.where(crack > 0.4, np.minimum(c.I, 0.2), c.I)
    else:
        chunks = [[(-6, -3), (-3, -6), (-1, -3), (-3, -1)], [(1, -5), (5, -4), (4, -1), (1, -1.5)], [(-4, 1), (-1, 1.5), (-1.5, 5), (-5, 4)], [(1.5, 1.5), (5.5, 1.0), (4.0, 5.0)]]
        for i, ch in enumerate(chunks):
            off = 1.2
            c.add(poly(c, [(x * 1.15 + (off if x > 0 else -off), y * 1.15 + (off if y > 0 else -off)) for x, y in ch], facet=(0.6, 0.8)))
        c.add(dots(c, [(0, 0, 0.7), (6.5, -6, 0.5), (-6.5, 6, 0.5)], peak=0.6), 0.8)


def sprout(c, k, cell):
    seed = lambda: (ball(c, 0, 0.6, 3.6, hot=(-0.35, -0.4), rim=0.5), capsule(c, -1.6, -1.2, 1.4, 2.0, 0.45, peak=0.9, rim=0.9))
    def leaf(x, y, ang, L, w):
        ca, sa = math.cos(ang), math.sin(ang)
        lu = (c.u - x) * ca + (c.v - y) * sa
        lv = -(c.u - x) * sa + (c.v - y) * ca
        t = np.clip(lu / L, 0, 1)
        width = w * np.sin(t * math.pi)
        body = smooth(width + 0.3, width - 0.3, np.abs(lv)) * (lu > 0) * (lu < L)
        return body * (0.55 + 0.4 * (np.abs(lv) < width * 0.3))
    if cell == 0:
        b, s = seed(); c.add(b)
        c.I = np.where(s > 0.6, np.maximum(c.I, 0.78), c.I)
    else:
        s = cell - 1
        b, _ = seed(); c.add(b * (0.85 - 0.15 * s))
        c.add(capsule(c, 0, -1.0, 0, -3.5 - 2.0 * s, 0.6, peak=0.75, rim=0.6))
        c.add(leaf(0, -3.0 - 2.0 * s, -math.pi * 0.85, 3.2 + 1.4 * s, 1.3 + 0.4 * s))
        c.add(leaf(0, -3.0 - 2.0 * s, -math.pi * 0.15, 3.2 + 1.4 * s, 1.3 + 0.4 * s))
        c.add(dots(c, [(-4.5, -5.5 - s, 0.45), (4.5, -6.0 - s, 0.4)], peak=0.85))


def snowflake(c, k, cell):
    def flake(r, w, branch=True, rot=0.0, peak=1.0):
        out = np.zeros_like(c.u)
        for i in range(6):
            a = rot + i * math.pi / 3
            out = np.maximum(out, capsule(c, 0, 0, math.cos(a) * r, math.sin(a) * r, w, peak, 0.6))
            if branch:
                for sgn in (-1, 1):
                    bx, by = math.cos(a) * r * 0.55, math.sin(a) * r * 0.55
                    b2 = a + sgn * 0.75
                    out = np.maximum(out, capsule(c, bx, by, bx + math.cos(b2) * r * 0.35, by + math.sin(b2) * r * 0.35, w * 0.8, peak * 0.95, 0.6))
        return out
    if cell == 0:
        c.add(flake(3.0, 0.55, branch=False)); c.add(ball(c, 0, 0, 1.2, rim=0.8))
    elif cell == 1:
        c.add(flake(4.6, 0.6)); c.add(ball(c, 0, 0, 1.4, rim=0.8))
    elif cell == 2:
        c.add(flake(6.6, 0.7, rot=math.pi / 12)); c.add(ball(c, 0, 0, 1.8, rim=0.8))
        c.add(ring(c, 0, 0, 2.8, 0.45, 0.6))
    elif cell in (3, 4):
        s = cell - 3
        for i in range(6):
            a = i * math.pi / 3 + math.pi / 12
            d0 = 2.0 + 2.6 * s
            c.add(capsule(c, math.cos(a) * d0, math.sin(a) * d0, math.cos(a) * (d0 + 2.6), math.sin(a) * (d0 + 2.6), 0.65 - 0.1 * s, 0.95, 0.6), 1 - 0.2 * s)
        c.add(sparkle(c, 0, 0, 3.0 - s, 0.9))
    else:   # falling shards under an anchor above the cell
        c.add(dots(c, [(-4.0, 3.0, 0.7), (-0.8, 4.5, 0.6), (2.6, 2.6, 0.55), (5.0, 5.2, 0.45)], peak=0.85), 0.85)


def ember_beam(c, k, cell):
    if cell in (0, 1, 2):   # seamless segment: profile depends on v only (anchor left-middle)
        half = 3.4 if cell < 2 else 6.8
        ph = 0.0 if cell == 0 else math.pi / 2
        wave = 0.18 * np.sin((c.u / 8.0) * 2 * math.pi + ph)          # period = segment width
        prof = np.clip(1 - np.abs(c.v) / half - wave * (np.abs(c.v) / half), 0, 1)
        c.add(np.where(prof > 0, 0.12 + 0.86 * prof ** 0.8, 0))
        flick = np.clip(np.sin((c.u / 8.0) * 4 * math.pi + ph * 2) * 0.5 + 0.5, 0, 1) * smooth(half * 0.9, half * 0.6, np.abs(c.v)) * 0.25
        c.I = np.maximum(c.I, np.where(c.I > 0.3, np.minimum(1, c.I + flick * 0.2), c.I))
    else:   # tip flare / contact bloom
        c.add(star(c, 0, 0, 7.4, 3.2, 8, 0.0, peak=0.8), 0.95)
        c.add(ball(c, 0, 0, 4.2, rim=0.6))
        c.add(dots(c, [(math.cos(a) * 6.8, math.sin(a) * 6.8, 0.6) for a in np.linspace(0.4, 5.9, 5)], peak=0.8))


def umbral(c, k, cell):
    def plume(seed, cx, cy, r, peak=0.85, rise=0.0):
        n = noise2(c.u, c.v + rise, seed, 0.6)
        d = np.hypot(c.u - cx, (c.v - cy) * 1.1) + (n - 0.5) * r * 0.9
        return smooth(r + 0.6, r - 0.8, d) * (0.42 + 0.5 * np.clip(1 - np.hypot(c.u - cx + r * 0.3, c.v - cy + r * 0.35) / r, 0, 1)) * peak
    if cell == 0:
        c.add(plume(1, 0, 0, 2.4))
    elif cell in (1, 2):
        c.add(plume(2 + cell, 0, 0, 3.6 + cell * 0.8))
        c.add(plume(9 + cell, 2.4, -2.6, 1.8, 0.75))
    elif cell in (3, 4, 5, 6):
        ph = cell - 3
        c.add(plume(20 + ph, 0, 0.5, 5.2, rise=ph * 1.3))
        c.add(plume(30 + ph, -2.6 + ph * 0.6, -3.4 - ph * 0.4, 2.6, 0.8))
        c.add(plume(40 + ph, 3.0 - ph * 0.5, -2.0, 2.0, 0.7))
        c.add(dots(c, [(math.cos(ph * 1.6 + a) * 5.6, -4.5 + math.sin(ph + a) * 1.5, 0.45) for a in (0.0, 2.2, 4.2)], peak=0.95))
    else:
        s = cell - 7
        c.add(plume(50 + s, 0, -s * 1.2, 5.0 + s * 1.2, 0.7 - 0.15 * s, rise=s * 2), 0.85 - 0.2 * s)
        c.add(plume(60 + s, -3.2, -3.0 - s, 2.4 + s * 0.6, 0.6 - 0.15 * s), 0.8 - 0.2 * s)


DESIGNS = {6: bubble, 32: walaser, 8: bog_core, 78: corona, 53: bramble, 33: cyclone, 24: quarry, 25: sprout, 26: snowflake, 13: ember_beam, 121: umbral}


# ----------------------------------------------------------------- assembly
def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def build():
    descriptor = json.load(open(os.path.join(ROOT, DESCRIPTOR), encoding='utf8'))
    profiles = json.load(open(os.path.join(ROOT, PROFILES), encoding='utf8'))
    native = {(c['bankId'], c['cell']): c for c in descriptor['cells']}
    rendered, banks = [], []
    for bank_id, (family, effect_id, title, palette_name) in BANKS.items():
        profile = profiles['banks'][bank_id - 1]
        assert profile['id'] == bank_id and profile['name'] == family, bank_id
        played = sorted({f['cell'] for s in profile['sequences'] for f in s['frames']})
        banks.append({'bankId': bank_id, 'family': family, 'effectId': effect_id, 'category': palette_name, 'title': title,
                      'sequences': [s['id'] for s in profile['sequences']], 'cells': played})
        for cell_id in played:
            ref = native[(bank_id, cell_id)]
            w, h = ref['frame'][2], ref['frame'][3]
            ox, oy = ref['origin']
            if ref['blank']:
                rendered.append({'bankId': bank_id, 'cell': cell_id, 'effectId': effect_id, 'blank': True, 'image': None,
                                 'origin': [0, 0], 'nativeSize': [w, h], 'nativeOrigin': [ox, oy]})
                continue
            margin = max(2, int(math.ceil(max(w, h) * 0.22)))
            if bank_id == 13 and cell_id < 3:
                margin = 0            # beam segments tile edge to edge
            cell = Cell(w, h, ox, oy, margin)
            DESIGNS[bank_id](cell, None, cell_id)
            big = cell.raster(PALETTES[palette_name])
            if bank_id == 13 and cell_id < 3:
                # keep the full native width so neighbours butt without a seam
                ys = np.where(big[:, :, 3].max(axis=1) > 0)[0]
                y0, y1 = int(ys.min()), int(ys.max()) + 1
                x0, x1 = 0, big.shape[1]
            else:
                mask = big[:, :, 3] > 0
                ys, xs = np.where(mask)
                y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
            crop = big[y0:y1, x0:x1]
            ax, ay = (margin + ox) * DENSITY, (margin + oy) * DENSITY
            rendered.append({'bankId': bank_id, 'cell': cell_id, 'effectId': effect_id, 'blank': False, 'image': crop,
                             'origin': [ax - x0, ay - y0], 'nativeSize': [w, h], 'nativeOrigin': [ox, oy]})
    # Shelf-pack into one atlas, tallest first; blank cells share one transparent pixel.
    order = sorted([r for r in rendered if not r['blank']], key=lambda r: (-r['image'].shape[0], -r['image'].shape[1]))
    x = y = shelf = 0
    pad = 2
    for r in order:
        hh, ww = r['image'].shape[:2]
        if x + ww + pad > ATLAS_WIDTH:
            x, y, shelf = 0, y + shelf + pad, 0
        r['frame'] = [x, y, ww, hh]
        x += ww + pad
        shelf = max(shelf, hh)
    blank_at = [ATLAS_WIDTH - 1, 0]
    height = y + shelf + pad
    height = int(math.ceil(height / 16) * 16)
    atlas = np.zeros((height, ATLAS_WIDTH, 4), dtype=np.uint8)
    for r in order:
        fx, fy, ww, hh = r['frame']
        atlas[fy:fy + hh, fx:fx + ww] = r['image']
    if atlas[0, ATLAS_WIDTH - 1, 3] != 0:
        raise SystemExit('blank pixel occupied')
    cells = []
    for r in sorted(rendered, key=lambda r: (r['bankId'], r['cell'])):
        if r['blank']:
            frame, data = [blank_at[0], blank_at[1], 1, 1], bytes(4)
        else:
            frame, data = r['frame'], r['image'].tobytes()
        cells.append({'bankId': r['bankId'], 'cell': r['cell'], 'effectId': r['effectId'], 'frame': frame, 'origin': r['origin'],
                      'pixelsPerNativePixel': DENSITY, 'blank': r['blank'], 'rgbaSha256': sha_bytes(data),
                      'nativeSize': r['nativeSize'], 'nativeOrigin': r['nativeOrigin']})
    return atlas, cells, banks


def main():
    check = '--check' in sys.argv
    atlas, cells, banks = build()
    out = os.path.join(ROOT, OUT_DIR)
    os.makedirs(out, exist_ok=True)
    png_path = os.path.join(out, 'effects.png')
    image = Image.fromarray(atlas, 'RGBA')
    tmp = png_path + '.tmp'
    image.save(tmp, format='PNG', optimize=True)
    png = open(tmp, 'rb').read()
    os.remove(tmp)
    manifest = {
        'schemaVersion': 1,
        'assetId': 'art:vfx:original-shared:remake-r2:v1',
        'reviewOnly': True, 'runtimeEligible': True, 'localOnly': True, 'runtimeScope': 'LOOPBACK_REVIEW_ONLY',
        'publicReleasePermitted': False, 'shippingReady': False, 'humanApproved': False,
        'rightsStatus': 'ORIGINAL_CREATED', 'productionStatus': 'ORIGINAL_REVIEW_CANDIDATE',
        'gameplayBinding': 'EXTERNAL_EXISTING_RUNTIME', 'timing': 'NATIVE_SEQUENCES_UNCHANGED', 'finishProfile': 'banded',
        'blend': 'NORMAL_ALPHA', 'pixelsPerNativePixel': DENSITY,
        'image': {'src': f'{OUT_DIR}/effects.png', 'width': int(atlas.shape[1]), 'height': int(atlas.shape[0]),
                  'sha256': sha_bytes(png), 'scaleMode': 'nearest'},
        'nativeTimingSource': {'file': PROFILES, 'policy': 'Sequences, ticks, play modes and boxes are read from this file at runtime; the bundle carries none.'},
        'banks': banks,
        'cells': cells,
        'provenance': {
            'ownerDirection': 'docs/coordination/OWNER_DIRECTION.md#VFX_FIVE_LAYER_20261101',
            'pipeline': 'scripts/build-shared-vfx-remake-r2.py: numpy shape fields + banded five-tone palette + 2 px step finish',
            'imageGeneration': 'NONE (procedural code, no AI image model, no image input)',
            'originalPixelsUsed': False,
            'numericInputs': [DESCRIPTOR + ' (cell size, anchor, blank state)', PROFILES + ' (sequence cells and ticks)'],
            'companion': 'assets/production/vfx/original-shared-review-210-seamfix-r1 (banks not repeated here)'
        }
    }
    text = json.dumps(manifest, ensure_ascii=False, indent=1) + '\n'
    manifest_path = os.path.join(out, 'manifest.json')
    if check:
        same = os.path.exists(png_path) and open(png_path, 'rb').read() == png and open(manifest_path, encoding='utf8').read() == text
        print('remake r2 up to date' if same else 'remake r2 STALE')
        sys.exit(0 if same else 1)
    open(png_path, 'wb').write(png)
    with open(manifest_path, 'w', encoding='utf8', newline='\n') as f:
        f.write(text)
    print(f'{len(cells)} cells ({sum(1 for c in cells if not c["blank"])} drawn) over {len(banks)} banks; atlas {atlas.shape[1]}x{atlas.shape[0]}, {len(png)} bytes')


if __name__ == '__main__':
    main()
