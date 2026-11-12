"""Layout of the BM05 battle canvas: the scenery ring around the unchanged play area.

Everything is authored in **base pixels**: the pixel grid of the live play-area
picture (bm05-southpole-polish-r2/base.webp, 1664x1088 = native 416x272 at 4x),
so (0, 0) is the play area's top-left corner and the canvas spans
X -320..1984, Y -576..1664 (native 576x560, play area at native offset 80,144).

Screen and ground share one coordinate system: a point on a level surface is
written by where it shows on screen.  Height lifts a point up the screen by
LIFT pixels per world unit (locked 52 degree orthographic camera, 16 native
pixels per unit).

Shapes that the play-area picture cuts at its edge are continued from measured
points on that edge (``fix_water`` / ``fix_cap``); the rest is new scenery.
Pure data plus small helpers: imported by Blender (build_scene.py) and by plain
Python (sea_map.py, compose.py).
"""
import math
import random

SCALE = 4
NATIVE_CANVAS = (576, 560)
NATIVE_OFFSET = (80, 144)
BASE_W, BASE_H = 1664, 1088
OX, OY = NATIVE_OFFSET[0] * SCALE, NATIVE_OFFSET[1] * SCALE          # 320, 576
CANVAS_W, CANVAS_H = NATIVE_CANVAS[0] * SCALE, NATIVE_CANVAS[1] * SCALE  # 2304, 2240
X0, Y0, X1, Y1 = -OX, -OY, CANVAS_W - OX, CANVAS_H - OY                # -320, -576, 1984, 1664

ELEVATION = math.radians(52)
SIN_E, COS_E = math.sin(ELEVATION), math.cos(ELEVATION)
UNIT = 16
LIFT = COS_E * UNIT * SCALE          # base pixels a point rises per world unit of height (39.40)
H_LAND = 0.8                         # the snow shelf stands this high above the sea

# Sun as in the R1 arenas (the play-area picture's fence shadows agree with it).
SUN_FROM = (80.0, -40.0, 18.0)       # native x, native y, world z
SUN_AT = (175.0, 70.0)

# --------------------------------------------------------------------------- land

# Top edge of the snow shelf, clockwise on screen.  Inside the play area the outline is hidden.
LAND = [
    (-360, 150), (-250, 174), (-160, 160), (-70, 168), (0, 148),            # north shore, left margin
    (300, 200), (1300, 200), (1664, 60),                                      # hidden behind the play area
    (1740, 42), (1830, 78), (1920, 52), (2030, 70),                          # north shore, right margin
    (2030, 1500),
    (1880, 1474), (1760, 1502), (1640, 1540), (1500, 1522), (1360, 1492),     # south shelf edge
    (1220, 1506), (1080, 1540), (940, 1526), (800, 1492), (660, 1482),
    (520, 1500), (380, 1534), (240, 1520), (100, 1482), (-40, 1472),
    (-180, 1500), (-360, 1530),
]
SOUTH_EDGE = (12, 30)                # LAND[12..29] is the shelf edge that faces the camera

# --------------------------------------------------------------------------- ice (bergs and crags)

# Each: ground centre G (screen position of the foot point), wall height hc, apex height ha,
# spokes (angle deg, foot radius, cap radius); angle 0 = screen right, 90 = toward the camera.
# fix_water / fix_cap are screen points the foot outline / cap rim must pass through.
ICE = [
    # --- cut by the top edge
    dict(name='berg-a', z0=0.0, G=(560, 80), hc=1.0, ha=1.28, kind='berg',
         spokes=[(178, 145, 75), (135, 120, 70), (90, 95, 84), (40, 118, 85), (13, 144, 95), (-7, 196, 105),
                 (-60, 150, 72), (-90, 150, 70), (-120, 140, 70)],
         fix_water=[(473, 0), (695, 0)], fix_cap=[(514, 0), (632, 0)]),
    dict(name='berg-b', z0=0.0, G=(865, -70), hc=1.5, ha=1.85, kind='berg',
         spokes=[(180, 165, 85), (-150, 160, 85), (-90, 150, 85), (-30, 170, 88), (0, 175, 90), (60, None, 80),
                 (120, None, 82)],
         fix_water=[(724, 0), (748, 48), (800, 12), (900, 8), (980, 6), (1011, 0)], fix_cap=[]),
    dict(name='berg-c', z0=0.0, G=(1375, 20), hc=1.6, ha=1.95, kind='berg',
         spokes=[(176, 183, 90), (144.6, 153, 90), (130, 132, 88), (99, 125, 85), (53.5, 126, 86), (37, 157, 88),
                 (18, 163, 90), (-45, 160, 86), (-90, 150, 85), (-135, 160, 86)],
         fix_water=[(1204, 0), (1555, 0)], fix_cap=[(1299, 0), (1443, 0)]),
    dict(name='berg-d', z0=0.0, G=(1710, 110), hc=2.2, ha=2.6, kind='berg',
         spokes=[(186, 191, 120), (159, 185, 129), (120, 160, 95), (80, 150, 95), (40, 160, 100), (0, 170, 105),
                 (-45, 175, 100), (-90, 180, 95)],
         fix_water=[(1580, 0)], fix_cap=[(1625, 0)]),
    # --- cut by the left edge
    dict(name='berg-s', z0=0.0, G=(-25, 85), hc=0.6, ha=0.78, kind='berg',
         spokes=[(0, 100, 55), (45, 60, 35), (90, 40, 22), (135, 60, 35), (180, 90, 50), (-135, 70, 38),
                 (-90, 55, 30), (-34, 117, 60)],
         fix_water=[], fix_cap=[]),
    dict(name='crag-l1', z0=H_LAND, G=(22, 382.4), hc=1.15, ha=2.6, kind='crag',
         spokes=[(-85.2, 200, 156.7), (-69.4, 190, 122), (-59.6, 185, 120.8), (-54.6, 182.8, 118), (7.4, 124, 64),
                 (14.6, 126, 65), (38.4, 148, 62), (58.9, 73.5, 58), (82, 70, 57.5),
                 (135, 120, 80), (180, 135, 90), (-135, 170, 110)],
         fix_water=[(0, 221), (0, 433)], fix_cap=[(0, 227), (0, 384)]),
    dict(name='crag-l2', z0=H_LAND, G=(20, 619), hc=1.15, ha=2.9, kind='crag',
         spokes=[(-77, 195, 165), (-63.3, 211.6, 130), (-53.8, 170, 105), (-36, 148.6, 70), (-28.6, 135, 62.7),
                 (-6.4, 102.6, 60), (37.7, 126.5, 70), (57.8, 190, 84), (65.6, 206, 95), (74.2, 172.7, 105),
                 (87.5, 154, 116), (140, 140, 100), (180, 150, 105), (-140, 180, 130)],
         fix_water=[(0, 703)], fix_cap=[(0, 433), (0, 658)], back_water=1.06),
    # --- cut by the right edge
    dict(name='crag-r1', z0=H_LAND, G=(1651, 397), hc=1.6, ha=2.9, kind='crag',
         spokes=[(-130.1, 189, 112), (-122.8, 180, 108.8), (-108.9, 160, 104.7), (-162, 123, 80), (160.3, 140, 71),
                 (150.6, 155, 66), (134.3, 140, 60), (129.6, 136.6, 62), (114.5, 168.8, 80), (100.7, 146, 98),
                 (92.4, 96.5, 85), (45, 95, 70), (0, 100, 72), (-45, 112, 80)],
         fix_water=[(1663, 470)], fix_cap=[(1663, 235), (1663, 396)], back_water=1.1),
    dict(name='crag-r2', z0=H_LAND, G=(1634, 764), hc=2.4, ha=3.4, kind='crag',
         spokes=[(-83.4, 200, 130.8), (-90, 200, 161.7), (-101.8, 205, 161), (-120.8, 210, 117), (-123.8, 212, 112),
                 (-132, 180, 101.5), (-159.8, 106.6, 80), (140.7, 142, 91.4), (135.4, 140, 91.4), (105.2, 175, 125.7),
                 (99.5, 181.4, 122), (93.8, 198.4, 115), (84.7, 237, 110), (82.1, 238, 109.7),
                 (45, 170, 100), (0, 150, 90), (-40, 170, 100)],
         fix_water=[(1663, 952)], fix_cap=[(1663, 602), (1663, 756)]),
    # The lower tier in front of crag-r2: its snow ledge and tall wall are what the right edge cuts at Y 790..952.
    dict(name='crag-r3', z0=H_LAND, G=(1722, 925), hc=2.5, ha=3.5, kind='crag',
         spokes=[(180, 66, 62), (130, 74, 68), (90, 70, 64), (50, 82, 74), (10, 72, 66), (-30, 80, 72),
                 (-70, 68, 62), (-110, 74, 68)],
         fix_water=[(1663, 952)], fix_cap=[(1663, 790), (1663, 853)]),
]

# New ice that stands clear of the play area: (name, kind, z0, Gx, Gy, radius, hc, ha, seed).
FREE_ICE = [
    # open sea, north
    ('berg-n1', 'berg', 0.0, 150, -210, 150, 1.0, 1.32, 11),
    ('berg-n2', 'berg', 0.0, -200, -380, 105, 0.8, 1.12, 12),
    ('berg-n3', 'berg', 0.0, 500, -420, 165, 1.2, 1.52, 13),
    ('berg-n4', 'berg', 0.0, 1110, -340, 125, 0.95, 1.27, 14),
    ('berg-n5', 'berg', 0.0, 1770, -380, 150, 1.1, 1.42, 15),
    ('berg-n6', 'berg', 0.0, 1420, -500, 90, 0.7, 1.02, 18),
    # open sea, south
    ('berg-s1', 'berg', 0.0, 330, 1650, 85, 0.6, 0.92, 31),
    ('berg-s2', 'berg', 0.0, 1150, 1668, 95, 0.65, 0.97, 32),
    ('berg-s3', 'berg', 0.0, 1820, 1640, 70, 0.5, 0.82, 33),
    # snow shelf, left
    ('crag-w1', 'crag', H_LAND, -200, 360, 105, 1.2, 2.6, 41),
    ('crag-w2', 'crag', H_LAND, -235, 640, 115, 1.3, 2.9, 42),
    ('crag-w3', 'crag', H_LAND, -215, 1190, 100, 1.1, 2.4, 43),
    # snow shelf, right
    ('crag-e1', 'crag', H_LAND, 1880, 330, 110, 1.3, 2.8, 51),
    ('crag-e2', 'crag', H_LAND, 1895, 640, 100, 1.2, 2.5, 52),
    ('crag-e3', 'crag', H_LAND, 1870, 1120, 110, 1.2, 2.7, 53),
    # snow shelf, south
    ('crag-s1', 'crag', H_LAND, 520, 1370, 90, 1.0, 2.2, 61),
    ('crag-s2', 'crag', H_LAND, 1480, 1380, 100, 1.1, 2.4, 62),
]

# Small flat floes on the sea: (x, y, radius, seed).
FLOES = [
    (-60, -480, 34, 1), (700, -230, 30, 2), (840, -500, 40, 3), (1560, -250, 36, 5),
    (1900, -520, 38, 6), (1250, -180, 22, 8), (700, 1630, 34, 9), (1500, 1650, 30, 10),
    (60, 1640, 28, 11), (-280, -200, 30, 13),
]

# --------------------------------------------------------------------------- snow mounds

# Each mound is a few merged lobes: (Gx, Gy, a, b, c) = ground ellipse half-width a (screen X),
# half-depth b (screen Y) and height c in world units.
MOUNDS = [
    dict(name='mound-ml', z0=H_LAND, lobes=[(-100, 870, 200, 105, 3.4), (-210, 940, 150, 85, 2.6)]),   # cut by the left edge
    dict(name='mound-mr', z0=H_LAND, lobes=[(1545, 183, 175, 70, 2.75), (1700, 205, 110, 55, 1.9)]),  # cut by the right edge
    dict(name='mound-w1', z0=H_LAND, lobes=[(-250, 250, 80, 45, 1.6), (-180, 232, 70, 40, 1.3)]),
    dict(name='mound-e1', z0=H_LAND, lobes=[(1900, 880, 95, 60, 2.2), (1820, 930, 80, 50, 1.6)]),
    dict(name='mound-s1', z0=H_LAND, lobes=[(250, 1280, 150, 75, 2.4), (130, 1320, 110, 60, 1.8)]),
    dict(name='mound-s2', z0=H_LAND, lobes=[(1210, 1300, 160, 80, 2.6), (1340, 1335, 100, 55, 1.7)]),
    dict(name='mound-s3', z0=H_LAND, lobes=[(820, 1360, 120, 60, 1.9)]),
    dict(name='mound-s4', z0=H_LAND, lobes=[(1740, 1330, 120, 65, 2.1), (1860, 1370, 80, 45, 1.4)]),
    dict(name='mound-s5', z0=H_LAND, lobes=[(-160, 1380, 120, 60, 1.9)]),
]

# --------------------------------------------------------------------------- rocks

# Dark slate lumps with snow on top: (x, y, radius, height, seed).
ROCKS = [
    (992, 1094, 32, 0.5, 1),             # continues the rock the bottom edge cuts
    (-120, 500, 30, 0.6, 2), (-270, 820, 34, 0.7, 3), (-60, 1150, 26, 0.5, 4), (1790, 560, 30, 0.6, 5),
    (1940, 1010, 32, 0.65, 6), (1760, 1180, 26, 0.5, 7), (420, 1190, 30, 0.6, 8), (700, 1230, 24, 0.5, 9),
    (1040, 1400, 34, 0.7, 10), (1600, 1230, 28, 0.55, 11), (-300, 1300, 30, 0.6, 12), (1960, 1420, 28, 0.55, 13),
]

# The dark flat slab the bottom edge cuts (screen outline, level with the snow).
SLAB = [(893, 1084), (1044, 1084), (1062, 1100), (1040, 1126), (990, 1140), (930, 1136), (896, 1116)]


# --------------------------------------------------------------------------- helpers

def hash01(*keys):
    """Deterministic 0..1 value (a string seed, so it does not depend on PYTHONHASHSEED)."""
    return random.Random(repr(keys)).random()


def spoke_point(G, theta_deg, r):
    """Screen position of the foot point at angle/radius around ground centre G."""
    t = math.radians(theta_deg)
    return (G[0] + r * math.cos(t), G[1] + SIN_E * r * math.sin(t))


def polar(G, point):
    dx, dy = point[0] - G[0], (point[1] - G[1]) / SIN_E
    return math.degrees(math.atan2(dy, dx)), math.hypot(dx, dy)


def _fill(values, angles):
    """Fill None entries by circular linear interpolation over angle."""
    n = len(values)
    known = [i for i, v in enumerate(values) if v is not None]
    out = list(values)
    for i in range(n):
        if out[i] is not None:
            continue
        prev = max((k for k in known if k < i), default=known[-1])
        nxt = min((k for k in known if k > i), default=known[0])
        a0, a1, a = angles[prev], angles[nxt], angles[i]
        if prev > i:
            a0 -= 360
        if nxt < i:
            a1 += 360
        t = 0.5 if a1 == a0 else (a - a0) / (a1 - a0)
        out[i] = values[prev] + (values[nxt] - values[prev]) * t
    return out


def resolve_ice(item):
    """Spokes sorted by angle with every radius filled: [(theta, r_water, r_cap)]."""
    G, hc = item['G'], item['hc']
    rows = [[a % 360, rw, rc] for a, rw, rc in item['spokes']]
    for p in item.get('fix_water', ()):
        a, r = polar(G, p)
        rows.append([a % 360, r, None])
    for p in item.get('fix_cap', ()):
        a, r = polar(G, (p[0], p[1] + LIFT * hc))
        rows.append([a % 360, None, r])
    rows.sort(key=lambda row: row[0])
    angles = [row[0] for row in rows]
    water = _fill([row[1] for row in rows], angles)
    cap = _fill([row[2] for row in rows], angles)
    grow = item.get('back_water')
    if grow:
        water = [max(w, c * grow) if 180 < a < 360 else w for a, w, c in zip(angles, water, cap)]
    return list(zip(angles, water, cap))


def free_ice(row):
    """Expand a FREE_ICE row to the same dict shape as ICE."""
    name, kind, z0, gx, gy, radius, hc, ha, seed = row
    berg = kind == 'berg'
    count = (9 if berg else 14) + int(hash01(seed, 'n') * 4)
    spokes = []
    for k in range(count):
        a = (k + hash01(seed, k, 'a') * .6) * 360 / count
        if berg:      # wide gentle skirt, cap well inside it
            rw = radius * (.78 + .5 * hash01(seed, k, 'w'))
            rc = rw * (.42 + .2 * hash01(seed, k, 'c'))
        else:         # a ragged wall with the snow cone reaching its rim
            rw = radius * (.62 + .76 * hash01(seed, k, 'w'))
            rc = rw * (.84 + .14 * hash01(seed, k, 'c'))
        spokes.append((a, rw, rc))
    return dict(name=name, kind=kind, z0=z0, G=(gx, gy), hc=hc, ha=ha, spokes=spokes, fix_water=[], fix_cap=[])


def all_ice():
    return list(ICE) + [free_ice(row) for row in FREE_ICE]
