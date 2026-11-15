"""BM06 desert arena: open sand with mesa country round it.

The play-area picture has two groups of sandstone buttes, at its top-left and top-right corners,
both cut by the picture's edge.  The ring carries each group on as a massif that fills its
corner, and spreads lone buttes, boulders and dune shade over the rest of the sand.
"""
import math

import canvaslib as C

FIELD_ID = 'field_bm06_01'
JOIN = {'weld': 24.0, 'soften': .7, 'clash': 55.0}      # a butte top against a wall must not ghost

# Buttes: (x, y, radius, height).  The first rows stand where the picture's own buttes are cut
# (their feet are inside the play area, their tops cross the seam); the rest build the massifs.
MASSIF_NW = [
    (40, 96, 112, 2.8), (236, 84, 118, 2.9), (430, 70, 104, 2.7), (-70, 196, 104, 2.8),        # on the seam
    (-150, 40, 120, 3.1), (120, -70, 126, 3.2), (340, -90, 116, 3.0), (-300, 170, 100, 2.6),
    (-330, -40, 128, 3.3), (-60, -190, 132, 3.4), (190, -230, 120, 3.1), (-480, 90, 96, 2.5),
    (-520, -160, 118, 3.0), (-260, -330, 124, 3.2), (20, -380, 110, 2.9), (560, -150, 92, 2.4),
    (-660, 10, 86, 2.2), (-470, -380, 100, 2.6), (400, -300, 84, 2.2),
]
MASSIF_NE = [
    (1402, 66, 108, 2.8), (1588, 84, 118, 3.0), (1750, 226, 110, 2.9),                           # on the seam
    (1500, -70, 122, 3.1), (1700, -40, 126, 3.2), (1880, 110, 112, 2.9), (1300, -160, 98, 2.5),
    (1620, -220, 128, 3.3), (1860, -150, 120, 3.1), (2040, 20, 104, 2.7), (1960, 250, 94, 2.4),
    (1420, -340, 106, 2.8), (1780, -360, 116, 3.0), (2060, -250, 108, 2.8), (2210, -90, 96, 2.5),
    (2190, 160, 84, 2.2), (2340, -300, 90, 2.3),
]
LONE = [
    (-560, 620, 96, 2.4), (-430, 690, 70, 1.7), (-760, 1040, 110, 2.8), (-300, 1260, 84, 2.1), (-640, 1390, 72, 1.8),
    (260, 1400, 92, 2.3), (980, 1470, 104, 2.6), (1130, 1420, 68, 1.6), (1700, 1360, 88, 2.2),
    (2140, 760, 100, 2.5), (2260, 850, 72, 1.8), (2400, 1280, 108, 2.7), (2010, 1210, 66, 1.6),
    (700, -330, 80, 2.0), (1010, -400, 96, 2.4), (-840, 420, 78, 1.9), (2470, 480, 82, 2.0),
]
KEEPOUT = (-120, -40, C.BASE_W + 120, C.BASE_H + 150)


def paint(G, work):
    sand = G.quilt([G.patch(500, 350, 1100, 800)], block=180, overlap=60, seed=61)       # the one stretch with nothing standing on it
    sand = G.set_tone(sand, (214, 170, 108))
    sand = G.shade(sand, .07 * G.noise(240, seed=62, octaves=2))
    # Dune slip faces: long soft bands of shade, as in the picture.
    for k in range(18):
        x = C.X0 + C.hash01('dune', k, 'x') * C.CANVAS_W
        y = C.Y0 + C.hash01('dune', k, 'y') * C.CANVAS_H
        if KEEPOUT[0] < x < KEEPOUT[2] and KEEPOUT[1] < y < KEEPOUT[3]:
            continue
        band = G.blob(x, y, 150 + 160 * C.hash01('dune', k, 'w'), 20 + 22 * C.hash01('dune', k, 'h'), seed=k, rough=.12, feather=14)
        sand = G.shade(sand, -.13 * band)
    return {'ground': sand}


def build(K):
    wall = K.ramp('sandstone-wall', (108, 58, 2), (170, 108, 26), ramp=(-.2, .6), mottle=.10, scale=2.4, grain=.02)
    top = K.ramp('sandstone-top', (176, 138, 44), (244, 190, 60), ramp=(.45, .9), mottle=.07, scale=2.0, grain=.02)
    boulder = K.ramp('sandstone-boulder', (132, 74, 6), (232, 166, 36), ramp=(-.1, .8), mottle=.08, scale=4.0)
    leaf = K.ramp('agave', (22, 70, 30), (96, 160, 70), ramp=(-.1, .8), mottle=0, grain=0)
    for group, rows in (('nw', MASSIF_NW), ('ne', MASSIF_NE), ('lone', LONE)):
        for k, (x, y, r, h) in enumerate(rows):
            K.butte(f'butte-{group}-{k}', x, y, r, h, wall, top, seed=k, corners=11 + k % 4)
            if r >= 112:       # the largest carry a second, smaller block on their top
                dx, dy = (C.hash01(group, k, 'tx') - .5) * r * .4, (C.hash01(group, k, 'ty') - .5) * r * .3
                K.butte(f'butte-{group}-{k}-tier', x + dx, y + dy, r * .5, h * .34, wall, top, seed=k + 50, corners=9, z0=h + .34)
    for k, (x, y) in enumerate(C.scatter('rock', 34, KEEPOUT, 150)):
        r = 20 + 22 * C.hash01('rockr', k)
        K.lump(f'rock-{k}', x, y, r, r * .72, r / 36 * .7, boulder, seed=k, jag=.3)
    for k, (x, y) in enumerate(C.scatter('agave', 30, KEEPOUT, 170)):
        for i in range(7):     # a small rosette of blades
            a = i * math.tau / 7 + C.hash01('ag', k, i)
            K.pole(f'agave-{k}-{i}', [(x, y, .02), (x + 9 * math.cos(a), y + 6 * math.sin(a), .22), (x + 17 * math.cos(a), y + 11 * math.sin(a), .30)],
                   .035, leaf, taper=.25)
