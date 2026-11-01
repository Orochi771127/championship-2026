#!/usr/bin/env python3
"""Shared battle-effect web atlas: the 210 remade cells plus 82 new original cells.

Owner direction 2026-11-01 (VFX_FIVE_LAYER_20261101, web atlas round): remake
eleven more shared banks (bubble00, walaser00, unchi00, lightball02, toge00,
dark01, onpu00, tatumaki00, rock00, seed00, snowcrystal00), keep the earlier
remakes of beam01 and blacksmoke04, and pack everything with the 210-cell pack
into ONE power-of-two texture for the web build. 278 + 14 cells with 2 px clear
margins do not fit 1024x2048 (98 % of its area; MaxRects places 203 of 272
drawn cells), so the Owner chose a single 2048x2048 atlas.

Production rule: NO image input of any kind for the new cells. Every new pixel
is drawn here from numpy shape fields and a banded five-tone palette with a dark
rim, the 210-cell pack's finish (4 raster px per native px, 2 px steps). The
210 earlier cells are copied pixel for pixel from their atlas. Inputs are
numbers only: each cell's native size, anchor and blank state (public
battle-effects descriptor) and the sequence table (battleEffectProfiles.json).
Native timing is unchanged; the battle's effect VM still moves, scales and
fades every cell.

Web packing: MaxRects (best short side), at least 2 px of clear margin on every
side of every cell, alpha colour bleeding (transparent pixels take the colour
of the nearest drawn pixel, so linear sampling never pulls in black), and two
files from the same pixels: lossless effects.webp (exact) and optimised
effects.png. render.v1.json is the shared-vfx render descriptor for this
revision; manifest.json carries provenance and per-cell hashes.

Usage: python -I scripts/vfx/build_shared_vfx_web_atlas.py [--check] [--sheet out.png]
"""
import hashlib, io, json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = 'assets/production/vfx/original-shared-review-292-r1'
SOURCE_DIR = 'assets/production/vfx/original-shared-review-210-seamfix-r1'
DESCRIPTOR = 'assets/production/public-runtime/battle-effects.render.v1.json'
PUBLIC_SHARED = 'assets/production/public-runtime/shared-vfx.render.v1.json'
PROFILES = 'src/data/championship/battleEffectProfiles.json'
DENSITY = 4          # raster px per native px (as the 210-cell pack)
GRID = 2             # samples per native px; upscaled x2 -> 2 px steps
ATLAS = (2048, 2048)
MARGIN = 2           # clear px on every side of every cell
BLEED = 4            # px of alpha colour bleeding around drawn pixels

# Five tones per bank: rim, edge, main, light, core (0xRRGGBB).
PALETTES = {
    'water':  [0x0b2a6b, 0x1f5fd6, 0x3fb8ff, 0x9fe6ff, 0xffffff],
    'toxic':  [0x26103a, 0x6a3a8a, 0x8fc23a, 0xcfeb7a, 0xf4ffd0],
    'light':  [0x6a3a00, 0xe09a2a, 0xffd86a, 0xfff2c0, 0xffffff],
    'jade':   [0x0b2618, 0x1f7a52, 0x48c48a, 0xaef2cc, 0xf2fff8],
    'amber':  [0x2a1606, 0x8a5418, 0xd8a040, 0xf6d890, 0xfff6e0],
    'void':   [0x07030f, 0x2c0f4f, 0x6a2cb0, 0xb07cff, 0xf0dcff],
    'neon':   [0x14063a, 0x6a2cd6, 0xff4fd8, 0x8ef6ff, 0xffffff],
    'wind':   [0x0d3b33, 0x3f9f86, 0x9fe6d0, 0xd8fff2, 0xffffff],
    'rock':   [0x24160a, 0x6e4a2a, 0xa87848, 0xd8a868, 0xffc861],
    'seed':   [0x0f2a10, 0x2f7f32, 0x6cc840, 0xb8ec78, 0xf0ffd0],
    'ice':    [0x0e2c66, 0x3f8fd0, 0x8fdcff, 0xd2f6ff, 0xffffff],
    'smoke':  [0x08050e, 0x21162e, 0x433452, 0x6e5e82, 0xa898bc],
    'flame':  [0x5a1405, 0xd0380f, 0xff8a1c, 0xffd27a, 0xfff6d0],
}
THRESH = [0.08, 0.27, 0.48, 0.70, 0.88]
BAND_ALPHA = [1.0, 0.9, 1.0, 1.0, 1.0]

# bank id -> (family, effect id, category, title, palette)
BANKS = {
    6:   ('e003_bubble00', 'proj_crystal_bubble', 'water', '晶鑽能量泡（泡泡投射物）', 'water'),
    32:  ('e003_walaser00', 'proj_spiral_tide_lance', 'water', '螺旋潮線水槍（水雷射）', 'water'),
    8:   ('e003_unchi00', 'proj_miasma_core', 'projectile', '紫綠瘴毒核（毒核）', 'toxic'),
    78:  ('e003_lightball02', 'proj_corona_sun', 'projectile', '聖耀日冕光球（大型光球）', 'light'),
    53:  ('e003_toge00', 'proj_amber_spike', 'projectile', '琥珀晶刺（尖刺投射物；土系底色，木/水名稱由轉色呈現）', 'amber'),
    100: ('e003_dark01', 'dark_void_crescent', 'energy', '黑洞弦月裂紋（暗影衝擊）', 'void'),
    10:  ('e003_onpu00', 'sound_neon_crest', 'energy', '霓虹音波紋章（音波）', 'neon'),
    33:  ('e003_tatumaki00', 'wind_twin_helix', 'energy', '青嵐雙螺旋龍捲（龍捲風）', 'wind'),
    24:  ('e003_rock00', 'proj_amber_vein_rock', 'projectile', '琥珀地脈巨岩（岩石）', 'rock'),
    25:  ('e003_seed00', 'proj_jade_seed', 'projectile', '翡翠能量種子（種子）', 'seed'),
    26:  ('e003_snowcrystal00', 'ice_hex_crystal', 'energy', '六稜冰晶雪花（雪晶）', 'ice'),
    13:  ('e003_beam01', 'beam_ember_lance', 'fire', '焰芯射線（火焰光束段）', 'flame'),
    121: ('e003_blacksmoke04', 'smoke_umbral_plume', 'smoke', '暗影煙柱（黑煙）', 'smoke'),
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


def arc(c, cx, cy, r, a0, a1, width, peak=1.0):
    """A ring segment between angles a0..a1 (radians, screen y down)."""
    a = np.arctan2(c.v - cy, c.u - cx)
    inside = ((a - a0) % (2 * math.pi)) <= ((a1 - a0) % (2 * math.pi))
    return ring(c, cx, cy, r, width, peak) * inside


def void_crescent(c, k, cell):
    # dark01: a black-hole core with a violet event ring, a crescent moon arc
    # and electric cracks. Cell 0 is the burst (launch and hit); 1-4 the loop.
    if cell == 0:
        c.add(ball(c, 0, 0, 3.4, rim=0.16, hot=(0, 0)) * 0.9)
        c.add(ring(c, 0, 0, 4.6, 0.8, 0.92))
        for i in range(6):
            a = i * math.pi / 3 + 0.3
            x0, y0 = math.cos(a) * 4.6, math.sin(a) * 4.6
            x1, y1 = math.cos(a + 0.25) * 6.4, math.sin(a + 0.25) * 6.4
            x2, y2 = math.cos(a - 0.1) * 7.6, math.sin(a - 0.1) * 7.6
            c.add(np.maximum(capsule(c, x0, y0, x1, y1, 0.42, 1.0, 0.95), capsule(c, x1, y1, x2, y2, 0.38, 0.95, 0.9)))
        c.add(dots(c, [(math.cos(a) * 7.2, math.sin(a) * 7.2, 0.5) for a in (1.1, 2.9, 4.4, 5.6)], peak=0.9))
    else:
        rot = (cell - 1) * math.pi / 2
        core = ball(c, 0, 0, 3.6, rim=0.18) * 0.85
        c.add(core)
        c.add(ring(c, 0, 0, 4.4, 0.6, 0.62))
        # Crescent: a disc minus an offset disc, turning a quarter each cell.
        d1 = np.hypot(c.u - math.cos(rot) * 0.6, c.v - math.sin(rot) * 0.6)
        d2 = np.hypot(c.u - math.cos(rot) * 2.6, c.v - math.sin(rot) * 2.6)
        crescent = smooth(6.6, 5.8, d1) * smooth(4.6, 5.4, d2)
        c.add(crescent * (0.72 + 0.26 * np.clip(1 - d1 / 6.6, 0, 1)))
        tip = rot + math.pi + 0.9
        c.add(capsule(c, math.cos(tip) * 5.6, math.sin(tip) * 5.6, math.cos(tip + 0.5) * 7.2, math.sin(tip + 0.5) * 7.2, 0.4, 1.0, 0.95))
        c.add(dots(c, [(math.cos(rot + a) * 7.0, math.sin(rot + a) * 7.0, 0.45) for a in (0.4, 2.0)], peak=0.95))


def neon_crest(c, k, cell):
    # onpu00: a neon note crest (cell 0, anchored low-left) and spreading
    # sound rings around a small note (cells 1-4).
    def note(x, y, s, peak=1.0):
        head = smooth(1.0, 0.0, np.hypot((c.u - x) / (2.0 * s), (c.v - y) / (1.45 * s)) * 2.2 - 1.2)
        stem = capsule(c, x + 1.8 * s, y - 0.4 * s, x + 1.8 * s, y - 8.0 * s, 0.5 * s, 1.0, 0.95)
        flag = arc(c, x + 3.4 * s, y - 6.6 * s, 1.9 * s, -math.pi * 0.95, -math.pi * 0.05, 0.55 * s, 0.95)
        return np.maximum(np.maximum(head * 0.9 * peak, stem * peak), flag * peak)
    if cell == 0:
        c.add(note(0.5, -1.5, 1.0))
        c.add(ring(c, 2.0, -5.0, 6.4, 0.5, 0.42), 0.8)
        c.add(dots(c, [(-3.2, -8.0, 0.5), (6.4, -10.2, 0.45), (6.8, -1.0, 0.4)], peak=0.95))
    else:
        # The hit (sequence 1) grows from a pinpoint to a wide ring over its
        # 500 ms, like the native cells, so the rings scale 1x..3.25x.
        s = cell - 1
        for j in range(3):
            r = (1.4 + j * 1.3) * (1 + 0.75 * s)
            fade = max(0.25, 0.95 - 0.18 * j - 0.1 * s)
            c.add(arc(c, 0, 0, r, -math.pi * 0.42, math.pi * 0.42, 0.6, fade))
            c.add(arc(c, 0, 0, r, math.pi * 0.58, math.pi * 1.42, 0.6, fade * 0.8))
        if 0 < s < 3:
            c.add(note(-0.8, 2.6, 0.55, 0.95))
        c.add(dots(c, [(math.cos(a) * (2.5 + s * 3.2), math.sin(a) * (2.5 + s * 3.2), 0.45) for a in (0.9, 2.4, 4.0, 5.4)], peak=0.9))


DESIGNS = {6: bubble, 32: walaser, 8: bog_core, 78: corona, 53: bramble, 100: void_crescent, 10: neon_crest,
           33: cyclone, 24: quarry, 25: sprout, 26: snowflake, 13: ember_beam, 121: umbral}


# ----------------------------------------------------------------- packing
def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def maxrects(width, height, items):
    """Best-short-side MaxRects. items: [(key, w, h)] -> {key: (x, y)} or raise."""
    free = [(0, 0, width, height)]
    placed = {}
    for key, w, h in sorted(items, key=lambda t: (-max(t[1], t[2]), -t[1] * t[2])):
        best = None
        for fx, fy, fw, fh in free:
            if w <= fw and h <= fh:
                score = (min(fw - w, fh - h), max(fw - w, fh - h), fy, fx)
                if best is None or score < best[0]:
                    best = (score, fx, fy)
        if best is None:
            raise SystemExit(f'ATLAS_FULL at {key} ({w}x{h}); placed {len(placed)} of {len(items)}')
        _, x, y = best
        placed[key] = (x, y)
        split = []
        for fx, fy, fw, fh in free:
            if x >= fx + fw or x + w <= fx or y >= fy + fh or y + h <= fy:
                split.append((fx, fy, fw, fh))
                continue
            if x > fx: split.append((fx, fy, x - fx, fh))
            if x + w < fx + fw: split.append((x + w, fy, fx + fw - x - w, fh))
            if y > fy: split.append((fx, fy, fw, y - fy))
            if y + h < fy + fh: split.append((fx, y + h, fw, fy + fh - y - h))
        free = [a for i, a in enumerate(split) if not any(i != j and a[0] >= b[0] and a[1] >= b[1]
                and a[0] + a[2] <= b[0] + b[2] and a[1] + a[3] <= b[1] + b[3] and (a != b or j < i) for j, b in enumerate(split))]
    return placed


def bleed(rgba, passes):
    """Give transparent pixels near drawn ones the colour of a drawn neighbour."""
    rgb = rgba[:, :, :3].astype(np.int32)
    known = rgba[:, :, 3] > 0
    for _ in range(passes):
        acc = np.zeros_like(rgb)
        count = np.zeros(known.shape, np.int32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not dx and not dy:
                    continue
                k = np.roll(np.roll(known, dy, 0), dx, 1)
                c = np.roll(np.roll(rgb, dy, 0), dx, 1)
                acc += c * k[:, :, None]
                count += k
        grow = (~known) & (count > 0)
        rgb[grow] = acc[grow] // count[grow][:, None]
        known = known | grow
    out = rgba.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def visible_hash(cell_rgba):
    """Hash of what a viewer sees: premultiplied RGB plus alpha."""
    a = cell_rgba[:, :, 3:4].astype(np.uint16)
    pre = (cell_rgba[:, :, :3].astype(np.uint16) * a // 255).astype(np.uint8)
    return sha_bytes(np.concatenate([pre, cell_rgba[:, :, 3:4]], axis=2).tobytes())


def render_new(descriptor, profiles):
    native = {(c['bankId'], c['cell']): c for c in descriptor['cells']}
    rendered, banks, checks = [], [], []
    for bank_id, (family, effect_id, category, title, palette_name) in BANKS.items():
        profile = profiles['banks'][bank_id - 1]
        assert profile['id'] == bank_id and profile['name'] == family, bank_id
        played = sorted({f['cell'] for s in profile['sequences'] for f in s['frames']})
        banks.append({'bankId': bank_id, 'family': family, 'effectId': effect_id, 'category': category, 'title': title,
                      'sequences': [s['id'] for s in profile['sequences']], 'cells': played, 'remake': 'web-atlas-292-r1'})
        for cell_id in played:
            ref = native[(bank_id, cell_id)]
            w, h = ref['frame'][2], ref['frame'][3]
            ox, oy = ref['origin']
            base = {'bankId': bank_id, 'cell': cell_id, 'effectId': effect_id, 'nativeSize': [w, h], 'nativeOrigin': [ox, oy], 'new': True}
            if ref['blank']:
                rendered.append({**base, 'blank': True, 'image': None})
                continue
            seam = bank_id == 13 and cell_id < 3            # beam segments tile edge to edge
            margin = 0 if seam else max(3, int(math.ceil(max(w, h) * 0.45)))
            cell = Cell(w, h, ox, oy, margin)
            DESIGNS[bank_id](cell, None, cell_id)
            big = cell.raster(PALETTES[palette_name])
            alpha = big[:, :, 3] > 0
            clipped = (not seam) and bool(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any())
            if seam:
                ys = np.where(alpha.any(axis=1))[0]
                y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, 0, big.shape[1]
            else:
                ys, xs = np.where(alpha)
                y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
            crop = big[y0:y1, x0:x1]
            ax, ay = (margin + ox) * DENSITY, (margin + oy) * DENSITY
            origin = [ax - x0, ay - y0]
            rendered.append({**base, 'blank': False, 'image': crop, 'origin': origin})
            checks.append({'cell': f'{bank_id}:{cell_id}', 'clipped': clipped,
                           'pivotInside': (0 <= origin[0] <= crop.shape[1] and 0 <= origin[1] <= crop.shape[0])
                           or not (0 <= ox <= w and 0 <= oy <= h),     # native anchor already outside
                           'ratio': round(max(crop.shape[1] / (w * DENSITY), crop.shape[0] / (h * DENSITY)), 3)})
    return rendered, banks, checks


def build():
    descriptor = json.load(open(os.path.join(ROOT, DESCRIPTOR), encoding='utf8'))
    profiles = json.load(open(os.path.join(ROOT, PROFILES), encoding='utf8'))
    source = json.load(open(os.path.join(ROOT, SOURCE_DIR, 'manifest.json'), encoding='utf8'))
    public = json.load(open(os.path.join(ROOT, PUBLIC_SHARED), encoding='utf8'))
    source_atlas = np.array(Image.open(os.path.join(ROOT, SOURCE_DIR, 'effects.png')).convert('RGBA'))
    cells = []
    for c in source['cells']:
        x, y, w, h = c['frame']
        img = None if c['blank'] else source_atlas[y:y + h, x:x + w].copy()
        cells.append({**c, 'image': img, 'new': False, 'sourceVisible': None if c['blank'] else visible_hash(img)})
    new_cells, new_banks, checks = render_new(descriptor, profiles)
    taken = {(c['bankId'], c['cell']) for c in cells}
    clash = [k for k in ((c['bankId'], c['cell']) for c in new_cells) if k in taken]
    if clash:
        raise SystemExit(f'NEW_CELLS_OVERLAP_210: {clash}')
    cells += new_cells
    drawn = [c for c in cells if not c['blank']]
    items = [((c['bankId'], c['cell']), c['image'].shape[1] + 2 * MARGIN, c['image'].shape[0] + 2 * MARGIN) for c in drawn]
    items.append((('blank', 0), 1 + 2 * MARGIN, 1 + 2 * MARGIN))
    placed = maxrects(ATLAS[0], ATLAS[1], items)
    atlas = np.zeros((ATLAS[1], ATLAS[0], 4), dtype=np.uint8)
    for c in drawn:
        px, py = placed[(c['bankId'], c['cell'])]
        h, w = c['image'].shape[:2]
        c['frame'] = [px + MARGIN, py + MARGIN, w, h]
        atlas[py + MARGIN:py + MARGIN + h, px + MARGIN:px + MARGIN + w] = c['image']
    bx, by = placed[('blank', 0)]
    for c in cells:
        if c['blank']:
            c['frame'] = [bx + MARGIN, by + MARGIN, 1, 1]
            c['origin'] = c.get('origin') or [0, 0]
    atlas = bleed(atlas, BLEED)
    used = sum((c['frame'][2] + 2 * MARGIN) * (c['frame'][3] + 2 * MARGIN) for c in drawn)
    return atlas, cells, source, new_banks, checks, public, used


def encode(atlas):
    image = Image.fromarray(atlas, 'RGBA')
    png = io.BytesIO(); image.save(png, format='PNG', optimize=True, compress_level=9)
    webp = io.BytesIO(); image.save(webp, format='WEBP', lossless=True, exact=True, quality=100, method=6)
    back = np.array(Image.open(io.BytesIO(webp.getvalue())).convert('RGBA'))
    if not np.array_equal(back, atlas):
        raise SystemExit('WEBP_NOT_LOSSLESS')
    return png.getvalue(), webp.getvalue()


def review_sheet(atlas, cells, path):
    """New cells, one bank per row, on a checker with frame boxes and pivot marks."""
    from PIL import ImageDraw
    rows = []
    for bank_id in BANKS:
        row = [c for c in cells if c['bankId'] == bank_id and c.get('new') and not c['blank']]
        rows.append((bank_id, sorted(row, key=lambda c: c['cell'])))
    width = 1600
    lines, x, line, lh = [], 150, [], 0
    for bank_id, row in rows:
        x, line, lh = 150, [], 0
        for c in row:
            w, h = c['frame'][2], c['frame'][3]
            if x + w + 24 > width and line:
                lines.append((bank_id, line, lh)); x, line, lh = 150, [], 0
            line.append((c, x)); x += w + 24; lh = max(lh, h)
        lines.append((bank_id, line, lh))
    height = sum(lh + 40 for _, _, lh in lines) + 20
    sheet = Image.new('RGBA', (width, height), (30, 32, 40, 255))
    draw = ImageDraw.Draw(sheet)
    y = 10
    for bank_id, line, lh in lines:
        if line and line[0][0]['cell'] == min(c['cell'] for c in cells if c['bankId'] == bank_id and c.get('new') and not c['blank']):
            draw.text((10, y + 4), f'{bank_id} {BANKS[bank_id][0][5:]}', fill=(255, 230, 140, 255))
        for c, cx in line:
            fx, fy, w, h = c['frame']
            for ty in range(0, h, 8):
                for tx in range(0, w, 8):
                    if (tx // 8 + ty // 8) % 2:
                        draw.rectangle([cx + tx, y + 20 + ty, cx + min(w, tx + 8) - 1, y + 20 + min(h, ty + 8) - 1], fill=(44, 47, 58, 255))
            sheet.alpha_composite(Image.fromarray(atlas[fy:fy + h, fx:fx + w], 'RGBA'), (cx, y + 20))
            draw.rectangle([cx - 1, y + 19, cx + w, y + 20 + h], outline=(90, 200, 255, 255))
            ox, oy = c['origin']
            draw.line([cx + ox - 4, y + 20 + oy, cx + ox + 4, y + 20 + oy], fill=(255, 60, 90, 255))
            draw.line([cx + ox, y + 20 + oy - 4, cx + ox, y + 20 + oy + 4], fill=(255, 60, 90, 255))
            draw.text((cx, y + 4), f'#{c["cell"]} {c["nativeSize"][0]}x{c["nativeSize"][1]}', fill=(200, 210, 220, 255))
        y += lh + 40
    sheet.convert('RGB').save(path)


def main():
    check = '--check' in sys.argv
    atlas, cells, source, new_banks, checks, public, used = build()
    png, webp = encode(atlas)
    out = os.path.join(ROOT, OUT_DIR)
    for c in cells:
        if not c['blank']:
            x, y, w, h = c['frame']
            stored = atlas[y:y + h, x:x + w]
            c['rgbaSha256'] = sha_bytes(stored.tobytes())
            if not c['new'] and visible_hash(stored) != c['sourceVisible']:
                raise SystemExit(f'SOURCE_CELL_CHANGED {c["bankId"]}:{c["cell"]}')
        else:
            c['rgbaSha256'] = sha_bytes(bytes(4))
    keep = ['bankId', 'cell', 'effectId', 'frame', 'origin', 'pixelsPerNativePixel', 'blank', 'rgbaSha256', 'nativeSize', 'nativeOrigin']
    manifest_cells = [{**{k: c[k] for k in keep if k in c}, 'pixelsPerNativePixel': DENSITY, 'remake': 'web-atlas-292-r1' if c['new'] else 'original-shared-review-210-seamfix-r1'}
                      for c in sorted(cells, key=lambda c: (c['bankId'], c['cell']))]
    # Bleed gaps: clear pixels beside a drawn pixel brighter than 8/255 that still hold
    # black (they would darken linear sampling). Drawn black outline pixels in
    # the 210 cells legitimately bleed black, so they are not counted.
    lit = np.pad((atlas[:, :, 3] > 0) & (atlas[:, :, :3].max(axis=2) > 8), 1)
    near_lit = lit[2:, 1:-1] | lit[:-2, 1:-1] | lit[1:-1, 2:] | lit[1:-1, :-2]
    gaps = int(((atlas[:, :, 3] == 0) & (atlas[:, :, :3].max(axis=2) == 0) & near_lit).sum())
    report = {'cells': len(cells), 'drawn': sum(1 for c in cells if not c['blank']), 'newCells': sum(1 for c in cells if c['new']),
              'banks': len({c['bankId'] for c in cells}), 'effects': len(source['banks']) + len(new_banks),
              'sequences': sum(len(b['sequences']) for b in source['banks']) + sum(len(b['sequences']) for b in new_banks),
              'atlas': f'{ATLAS[0]}x{ATLAS[1]}', 'fill': round(used / (ATLAS[0] * ATLAS[1]), 4), 'pngBytes': len(png), 'webpBytes': len(webp),
              'clipped': [k['cell'] for k in checks if k['clipped']], 'pivotOutside': [k['cell'] for k in checks if not k['pivotInside']],
              'maxRatio': max(k['ratio'] for k in checks), 'bleedGapPixels': gaps}
    manifest = {
        'schemaVersion': 1, 'assetId': 'art:vfx:original-shared:review:292-r1',
        'reviewOnly': True, 'runtimeEligible': False, 'localOnly': True, 'runtimeScope': 'LOOPBACK_REVIEW_ONLY',
        'publicReleasePermitted': False, 'shippingReady': False, 'humanApproved': False,
        'rightsStatus': 'ORIGINAL_CREATED', 'productionStatus': 'ORIGINAL_REVIEW_CANDIDATE', 'gameplayBinding': 'EXTERNAL_EXISTING_RUNTIME',
        'timing': 'NATIVE_SEQUENCES_UNCHANGED', 'finishProfile': 'banded', 'blend': 'NORMAL_ALPHA', 'pixelsPerNativePixel': DENSITY,
        'image': {'src': f'{OUT_DIR}/effects.png', 'width': ATLAS[0], 'height': ATLAS[1], 'sha256': sha_bytes(png), 'scaleMode': 'nearest', 'bytes': len(png)},
        'webp': {'src': f'{OUT_DIR}/effects.webp', 'sha256': sha_bytes(webp), 'bytes': len(webp), 'encoding': 'lossless-exact', 'pixelsEqualPng': True},
        'packing': {'algorithm': 'MaxRects best short side', 'marginPx': MARGIN, 'alphaBleedPx': BLEED, 'fill': report['fill'],
                    'why2048': '278+14 cells with 2 px margins need 98 % of 1024x2048; MaxRects placed 203 of 272 drawn cells there (Owner chose one 2048x2048 texture)'},
        'nativeTimingSource': {'file': PROFILES, 'policy': 'Sequences, ticks, play modes and boxes are read from this file at runtime; the bundle carries none.'},
        'banks': source['banks'] + new_banks,
        'cells': manifest_cells,
        'localizedText': source['localizedText'],
        'selfCheck': report,
        'provenance': {
            'ownerDirection': 'docs/coordination/OWNER_DIRECTION.md#VFX_FIVE_LAYER_20261101',
            'pipeline': 'scripts/vfx/build_shared_vfx_web_atlas.py',
            'earlierCells': f'{SOURCE_DIR} (210 cells copied pixel for pixel; visible-pixel hashes verified)',
            'newCells': 'numpy shape fields + banded five-tone palette + 2 px step finish; no image input, no AI image model',
            'originalPixelsUsed': False,
            'numericInputs': [DESCRIPTOR + ' (cell size, anchor, blank state)', PROFILES + ' (sequence cells and ticks)'],
        }
    }
    render = {'schemaVersion': 1, 'kind': 'SHARED_VFX_RENDER_V1', 'assetId': 'art:public:shared-vfx:v1', 'timing': 'NATIVE_SEQUENCES_UNCHANGED',
              'blend': 'NORMAL_ALPHA', 'pixelsPerNativePixel': DENSITY,
              'image': {k: manifest['image'][k] for k in ['src', 'sha256', 'width', 'height', 'scaleMode']},
              'cells': [{k: c[k] for k in ['bankId', 'cell', 'origin', 'frame', 'pixelsPerNativePixel', 'blank', 'rgbaSha256']} for c in manifest_cells],
              'banks': [{k: b[k] for k in ['bankId', 'family', 'sequences', 'cells']} for b in manifest['banks']],
              'localizedText': public['localizedText']}
    texts = {'manifest.json': json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', 'render.v1.json': json.dumps(render, indent=1) + '\n'}
    blobs = {'effects.png': png, 'effects.webp': webp}
    if check:
        same = all(os.path.exists(os.path.join(out, n)) and open(os.path.join(out, n), 'rb').read() == b for n, b in blobs.items()) and \
            all(open(os.path.join(out, n), encoding='utf8').read() == t for n, t in texts.items())
        print('web atlas up to date' if same else 'web atlas STALE')
        sys.exit(0 if same else 1)
    os.makedirs(out, exist_ok=True)
    for name, blob in blobs.items():
        open(os.path.join(out, name), 'wb').write(blob)
    for name, text in texts.items():
        with open(os.path.join(out, name), 'w', encoding='utf8', newline='\n') as f:
            f.write(text)
    if '--sheet' in sys.argv:
        review_sheet(atlas, cells, sys.argv[sys.argv.index('--sheet') + 1])
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
