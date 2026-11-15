"""BM03 volcano arena: a cracked basalt shelf over a lava lake, under a wall of basalt blocks.

The play-area picture shows the shelf's west cliff and lava lake, a notch of lava at its
south-east corner, and a wall of basalt blocks along the top.  The ring finishes the shelf
(a lobe to the south, a lobe to the east), lets the lake run round it, carries the block wall
up into a basalt massif, and continues the stone beam that lies along the north-west edge.
"""
import canvaslib as C

FIELD_ID = 'field_bm03_01'


def _is_lava(rgb):
    return (rgb[..., 0] > 150) & (rgb[..., 1] > 50) & (rgb[..., 2] < 150) & (rgb[..., 0] - rgb[..., 2] > 70)


JOIN = {'weld': 22.0, 'soften': .7, 'clash': 70.0, 'water_name': 'lava-mask-canvas.webp',
        'classes': [(_is_lava, 40.0), (lambda rgb: rgb[..., 0] > -1, 26.0)]}

# The lava lake as one outline (screen, base pixels); the stretch inside the play area is hidden.
LAVA = [
    (-900, 360), (-700, 400), (-520, 430), (-300, 381), (0, 300), (170, 268), (186, 330), (120, 560), (100, 760),
    (140, 1000), (200, 1088), (270, 1190), (430, 1268), (700, 1310), (1000, 1296), (1320, 1318), (1500, 1250),
    (1560, 1088), (1664, 942), (1700, 990), (1840, 960), (1990, 830), (2040, 600), (2010, 330), (2100, 250),
    (2570, 150), (2570, 1670), (-900, 1670),
]
CLIFF = 38           # the shelf stands this many pixels (0.96 units) above the lava
BEAM = [(-330, 392), (0, 283)]          # the stone beam along the north-west edge, carried on
WALL_ROWS = [        # (ground y, first x, last x, step, radius, height): the block wall and the massif behind it
    (150, 430, 1700, 132, 72, 1.5), (40, 360, 1840, 150, 86, 2.0), (-110, 280, 2000, 168, 100, 2.5),
    (-280, 180, 2160, 186, 112, 3.0), (-450, 60, 2320, 200, 124, 3.5),
]


def inside(polygon, x, y):
    hit = False
    for (x0, y0), (x1, y1) in zip(polygon, polygon[1:] + polygon[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


def paint(G, work):
    import cv2
    import numpy as np
    basalt = G.quilt([G.patch(330, 330, 760, 640), G.patch(1050, 620, 1500, 900), G.patch(420, 840, 780, 960)], block=128, overlap=44, seed=31)
    basalt = G.set_tone(basalt, (54, 46, 54))
    basalt = G.shade(basalt, .12 * G.noise(240, seed=32, octaves=2))
    lava = G.quilt([G.patch(6, 330, 124, 1070)], block=100, overlap=34, seed=33, flatten=False)
    # Out on the open lake the crust is sparser than at the shelf's foot, where the picture samples it.
    lava = .45 * lava + .55 * cv2.GaussianBlur(lava, (0, 0), 7.0)
    lake = G.mask(LAVA, 0)
    land = 1 - lake
    # The cliff: the shelf's edge dropped straight down the screen, in strata.
    kernel = np.zeros((2 * CLIFF + 1, 1), dtype=np.uint8)
    kernel[:CLIFF + 1] = 1                               # a land pixel covers the CLIFF pixels below it
    face = cv2.dilate((land > .5).astype(np.uint8), kernel) - (land > .5).astype(np.uint8)
    depth = cv2.distanceTransform((1 - (land > .5).astype(np.uint8)), cv2.DIST_L2, 3)       # distance below the edge
    strata = .5 + .5 * np.sin(depth * .55 + 6 * G.noise(60, seed=34))
    wall = G.flat((46, 28, 30)) * (1 - strata[..., None]) + G.flat((112, 70, 52)) * strata[..., None]
    wall = G.shade(wall, -.35 * np.clip(depth / CLIFF, 0, 1))         # darker toward the lava
    ground = G.mix(basalt, lava, lake)
    ground = G.mix(ground, wall, cv2.GaussianBlur(face.astype(np.float32), (0, 0), .8))
    # The lava lights the foot of the cliff and the shelf's rim a little.
    glow = cv2.GaussianBlur(lake, (0, 0), 26) * land
    ground = ground + glow[..., None] * np.array([70, 22, 4], dtype=np.float32)
    water = lake * (1 - cv2.GaussianBlur(face.astype(np.float32), (0, 0), .8))
    return {'ground': ground, 'water': water}


def build(K):
    block_wall = K.ramp('basalt-wall', (10, 9, 20), (40, 33, 48), ramp=(-.2, .6), mottle=.12, scale=3.0, own=.45, share=.6)
    block_top = K.ramp('basalt-top', (28, 25, 38), (62, 54, 70), ramp=(.4, .92), mottle=.14, scale=2.4, own=.45, share=.6)
    pile = K.ramp('scoria', (52, 38, 44), (140, 100, 98), ramp=(-.1, .8), mottle=.10, scale=5.0)
    beam = K.ramp('stone-beam', (52, 42, 44), (124, 106, 100), ramp=(.2, .9), mottle=.08, scale=6.0)
    for r, (y, x0, x1, step, radius, height) in enumerate(WALL_ROWS):
        x = x0
        k = 0
        while x <= x1:
            px = x + (C.hash01('wx', r, k) - .5) * step * .4
            py = y + (C.hash01('wy', r, k) - .5) * 70
            rr = radius * (.8 + .45 * C.hash01('wr', r, k))
            hh = height * (.7 + .6 * C.hash01('wh', r, k))
            K.butte(f'block-{r}-{k}', px, py, rr, hh, block_wall, block_top, seed=k, corners=6 + (k + r) % 3, star=.03, bevel=.12, crown=.14)
            if C.hash01('wt', r, k) > .55:
                K.butte(f'block-{r}-{k}-tier', px + rr * .2, py - rr * .1, rr * .52, hh * .4, block_wall, block_top, seed=k + 70,
                        corners=6, star=.03, bevel=.12, crown=.12, z0=hh + .14)
            x += step
            k += 1
    # The beam: a long low block along the shelf's north-west edge, broken off at its far end.
    (ax, ay), (bx, by) = BEAM
    K.prism('beam', [(ax, ay - 16), (bx + 4, by - 16), (bx + 4, by + 12), (ax - 14, ay + 12)], 0.0, .26, beam)
    count = 0
    for k, (x, y) in enumerate(C.scatter('pile', 70, (-40, -40, C.BASE_W + 40, C.BASE_H + 40), 130)):
        if inside(LAVA, x, y) or inside(LAVA, x, y + CLIFF + 30) or (y < 260 and 60 < x < 2400):      # not on the lake, not in the massif
            continue
        for i in range(3 + int(C.hash01('pn', k) * 4)):
            r = 10 + 12 * C.hash01('pr', k, i)
            K.lump(f'pile-{k}-{i}', x + (C.hash01('px', k, i) - .5) * 60, y + (C.hash01('py', k, i) - .5) * 30, r, r * .75, r / 22 * .5, pile, seed=i, jag=.3)
        count += 1
