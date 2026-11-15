"""BM07 cyberspace arena: a machine deck hanging in a dark data void.

The play-area picture is one platform; its side machinery is cut by the left and right edges
and its under-deck struts by the bottom edge.  The ring is the void round it: the machinery
and struts carried on, and other decks of the same make hanging at a distance, joined to the
main one by walkways.  Nothing in the void catches a shadow.
"""
import math

import canvaslib as C

FIELD_ID = 'field_bm07_01'
JOIN = {'weld': 14.0, 'soften': .6, 'clash': 60.0, 'tone_cap': 34.0}

DECKS = [  # (x, y, radius, seed): satellite decks
    (-560, 250, 190, 1), (-620, 900, 220, 2), (2230, 190, 200, 3), (2280, 980, 230, 4), (420, -370, 170, 5),
    (1290, -390, 180, 6), (300, 1500, 160, 7), (1400, 1500, 170, 8), (-220, -330, 120, 9), (1900, -340, 130, 10),
    (-720, 1500, 140, 11), (2380, 1500, 140, 12), (850, -500, 110, 13),
]
WALKWAYS = [((-380, 262), (-30, 330)), ((-410, 880), (-30, 760)), ((2040, 200), (1700, 330)), ((2060, 960), (1700, 800)),
            ((440, -210), (520, 40)), ((1280, -220), (1180, 40)), ((330, 1350), (420, 1110)), ((1390, 1340), (1300, 1110))]
STRUTS = [230, 410, 590, 850, 1060, 1280, 1420]


def paint(G, work):
    import cv2
    import numpy as np
    void = G.shade(G.flat((20, 28, 62)), .22 * G.noise(300, seed=71, octaves=2))
    glow = G.blob(1950, -250, 760, 520, seed=72, rough=.1, feather=160)          # the violet haze of the picture's top right
    void = void + glow[..., None] * np.array([34, 20, 62], dtype=np.float32)
    low = G.blob(-300, 1250, 700, 420, seed=73, rough=.1, feather=160)            # and the blue one at its bottom left
    void = void + low[..., None] * np.array([18, 30, 44], dtype=np.float32)
    # A faint data grid far below.
    yy, xx = np.mgrid[0:G.h, 0:G.w]
    lines = ((xx + C.X0) % 240 < 2) | ((yy + C.Y0) % 240 < 2)
    void = G.mix(void, G.flat((60, 190, 225)), cv2.GaussianBlur(lines.astype(np.float32), (0, 0), 1.0) * .10)
    return {'ground': void}


def build(K):
    from kit import GP
    K.catcher.hide_render = True
    hull = K.ramp('hull', (14, 16, 42), (62, 66, 114), ramp=(-.2, .7), mottle=.05, scale=6.0)
    deck = K.ramp('deck', (40, 44, 84), (84, 88, 134), ramp=(.4, .92), mottle=.05, scale=6.0)
    panel = K.ramp('panel', (24, 26, 60), (72, 76, 124), ramp=(.2, .9), mottle=.06, scale=8.0)
    cyan = K.glow('neon-cyan', (70, 225, 245), 1.5)
    violet = K.glow('neon-violet', (150, 80, 225), 1.3)

    def beam(name, a, b, width, z0, z1, mat, top=None):
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy) or 1.0
        ox, oy = -dy / n * width / 2, dx / n * width / 2
        K.prism(name, [(a[0] + ox, a[1] + oy), (b[0] + ox, b[1] + oy), (b[0] - ox, b[1] - oy), (a[0] - ox, a[1] - oy)], z0, z1, mat, top)

    def platform(name, x, y, r, seed):
        ring = [(x + r * math.cos(k * math.tau / 8 + .39), y + r * .62 * math.sin(k * math.tau / 8 + .39)) for k in range(8)]
        K.prism(f'{name}-hull', ring, -.7, 0.0, hull, deck)
        for k in range(8):                                   # the neon rim, two sides in three
            if k % 3 == 2:
                continue
            a, b = ring[k], ring[(k + 1) % 8]
            beam(f'{name}-rim-{k}', C.lerp(a, b, .12), C.lerp(a, b, .88), 5, 0.0, .03, cyan)
        for i in range(2 + int(C.hash01(seed, 'n') * 3)):    # machines on the deck
            mx = x + (C.hash01(seed, i, 'mx') - .5) * r * .9
            my = y + (C.hash01(seed, i, 'my') - .5) * r * .5
            w, d = 46 + 60 * C.hash01(seed, i, 'w'), 34 + 34 * C.hash01(seed, i, 'd')
            h = .5 + 1.1 * C.hash01(seed, i, 'h')
            K.box(f'{name}-machine-{i}', mx, my, w, d, 0.0, h, hull, panel)
            beam(f'{name}-machine-{i}-light', (mx - w * .3, my + d * .5 + 1), (mx + w * .3, my + d * .5 + 1), 3, h * .55, h * .62, cyan)
        px, py = x + r * .55, y - r * .2
        K.butte(f'{name}-pylon', px, py, 22, 1.1, hull, panel, seed=seed, corners=6, star=0.0, bevel=.1, crown=.04, flare=1.0)
        K.butte(f'{name}-pylon-core', px, py, 15, .34, violet, violet, seed=seed, corners=6, star=0.0, bevel=.1, crown=.04, z0=1.14, flare=1.0)
        for k in range(3):                                   # struts hanging under the deck
            sx = x + (k - 1) * r * .5
            K.box(f'{name}-strut-{k}', sx, y + r * .5, 22, 16, -3.0 - 1.5 * C.hash01(seed, k, 's'), -.6, hull)

    for x, y, r, seed in DECKS:
        platform(f'deck-{seed}', x, y, r, seed)
    for k, (a, b) in enumerate(WALKWAYS):
        beam(f'walkway-{k}', a, b, 30, -.22, -.08, hull, deck)
        beam(f'walkway-{k}-line', a, b, 3, -.08, -.06, cyan)
    # The machinery the left and right edges cut, and the struts the bottom edge cuts, carried on.
    K.box('machine-west-vents', -134, 452, 252, 216, -.2, 1.4, hull, panel)
    K.box('machine-west-box', -112, 642, 214, 118, 0.0, .9, hull, panel)
    beam('machine-west-line', (-240, 562), (-10, 562), 3, .7, .76, cyan)
    K.box('machine-east-tanks', 1792, 628, 240, 336, 0.0, 1.2, hull, panel)
    for k, y in enumerate((540, 640, 740)):
        K.butte(f'machine-east-drum-{k}', 1770, y, 54, 1.5, hull, panel, seed=k, corners=14, star=0.0, bevel=.1, crown=.05, flare=1.0)
    beam('machine-east-line', (1680, 812), (1904, 812), 3, .5, .56, cyan)
    for k, x in enumerate(STRUTS):
        K.box(f'strut-{k}', x, 1046, 48, 30, -6.0, -.5, hull)
    beam('gantry', (140, 1062), (1520, 1062), 24, -5.2, -4.8, hull, deck)
    beam('gantry-line', (160, 1076), (1500, 1076), 3, -4.8, -4.78, cyan)
