"""BM09 colosseum arena: sandstone paving under an arcade and its seating tiers.

The play-area picture is a regular floor: paving in courses, an arcade of equal arches along
the top and stone tiers above it.  All three run off the picture's edges, so the ring continues
each on its own grid (the joints, arches and tier lines stay in step across the seams), then
adds what stands on the floor: the ruined side walls the edges cut, and a colonnade round the
wider court.
"""
import canvaslib as C

FIELD_ID = 'field_bm09_01'
JOIN = {'weld': 12.0, 'soften': .6, 'clash': 60.0, 'tone_cap': 30.0}

# Whole periods of the picture's own patterns (base pixels): x0, y0, x1, y1.
PAVING = (151, 477, 1146, 719)       # 8 stones by 4 courses
ARCADE = (450, 150, 1010, 268)       # 4 plain arches with their cornice
TIERS = (340, 31, 780, 106)          # 2 tiers, a stretch without stair blocks
ARCADE_Y = (150, 268)
SIDE_WALL = [(-36, 236, 1.5), (-36, 300, 1.2), (-34, 366, 1.6), (-38, 432, 1.1), (-36, 494, .8),
             (1700, 236, 1.5), (1702, 302, 1.3), (1700, 368, 1.5), (1704, 434, 1.0), (1700, 500, .7)]
RUBBLE_AT = [(-40, 820), (-30, 900), (-50, 980), (-24, 1050), (1702, 830), (1694, 910), (1710, 990), (1690, 1060)]


def columns():
    out = []
    for k, x in enumerate(range(-780, 2470, 196)):
        out.append((x, 1480, 2.5 if C.hash01('cb', k) > .22 else .6 + 1.2 * C.hash01('cbh', k)))
    for k, y in enumerate(range(420, 1400, 176)):
        out.append((-712, y, 2.5 if C.hash01('cl', k) > .22 else .6 + 1.2 * C.hash01('clh', k)))
        out.append((2376, y, 2.5 if C.hash01('cr', k) > .22 else .6 + 1.2 * C.hash01('crh', k)))
    return out


def paint(G, work):
    import numpy as np
    paving = G.grid(*PAVING)
    arcade = G.grid(*ARCADE)
    tiers = G.grid(*TIERS, level='x')
    yy = (np.arange(G.h) + C.Y0)[:, None] * np.ones((1, G.w))
    ground = paving
    ground = np.where((yy < ARCADE_Y[1])[..., None], arcade, ground)
    ground = np.where((yy < ARCADE_Y[0])[..., None], tiers, ground)
    # The picture is lit from its middle; the wider court falls off the same way.
    xx = (np.arange(G.w) + C.X0)[None, :] * np.ones((G.h, 1))
    far = np.hypot(np.clip(np.abs(xx - C.BASE_W / 2) - C.BASE_W / 2 + 200, 0, None),
                   np.clip(np.abs(yy - C.BASE_H / 2) - C.BASE_H / 2 + 200, 0, None))
    ground = G.shade(ground.astype(np.float32), -.22 * np.clip(far / 500.0, 0, 1) + .05 * G.noise(260, seed=91))
    return {'ground': ground}


def build(K):
    stone = K.ramp('sandstone', (112, 92, 58), (214, 188, 138), ramp=(-.2, .7), mottle=.08, scale=4.0)
    cap = K.ramp('sandstone-top', (168, 144, 100), (226, 202, 152), ramp=(.4, .92), mottle=.06, scale=4.0)
    for k, (x, y, h) in enumerate(SIDE_WALL):       # the ruined side walls the play area's edges cut
        K.box(f'side-wall-{k}', x, y, 70, 46, 0.0, h, stone, cap)
    for k, (x, y) in enumerate(RUBBLE_AT):
        for i in range(3):
            r = 16 + 16 * C.hash01('rb', k, i)
            K.lump(f'rubble-{k}-{i}', x + (C.hash01('rbx', k, i) - .5) * 60, y + (C.hash01('rby', k, i) - .5) * 40, r, r * .75, r / 26 * .6, stone, seed=i, jag=.28)
    for k, (x, y, h) in enumerate(columns()):
        tall = h > 2.4
        h = 3.5 if tall else h
        K.box(f'column-{k}-base', x, y, 62, 48, 0.0, .16, stone, cap)
        K.butte(f'column-{k}', x, y, 23, h, stone, cap, seed=k, corners=14, squash=.78, star=0.0, bevel=.1, crown=.05, z0=.16, flare=1.0)
        if tall:
            K.box(f'column-{k}-capital', x, y, 60, 46, .16 + h, .16 + h + .22, stone, cap)
    for k, (x, y) in enumerate(C.scatter('block', 26, (-140, 150, C.BASE_W + 140, C.BASE_H + 120), 260, bounds=(C.X0, 300, C.X1, C.Y1))):
        w = 50 + 50 * C.hash01('bw', k)
        K.box(f'block-{k}', x, y, w, 40, 0.0, .3 + .5 * C.hash01('bh', k), stone, cap)
