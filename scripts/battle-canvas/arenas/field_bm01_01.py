"""BM01 training ground: a dirt yard in a fenced paddock.

The play-area picture is the yard itself: packed dirt that runs off its left and right edges,
a paddock fence, trees and a kerb along the top, grass at the top and at its bottom-left corner.
The ring finishes the yard as a rounded patch of dirt with a soil lip, carries the fence and the
kerb on, and lays pasture with small trees round it.
"""
import canvaslib as C

FIELD_ID = 'field_bm01_01'
JOIN = {'weld': 20.0, 'soften': .7, 'clash': 70.0, 'tone_cap': 12.0}

# The yard's outline where it leaves the play area (screen, base pixels).
YARD_LEFT = [(6, 366), (-110, 392), (-215, 452), (-268, 560), (-276, 760), (-240, 900), (-150, 976), (6, 1002)]
YARD_RIGHT = [(1658, 318), (1790, 340), (1888, 420), (1934, 560), (1940, 800), (1900, 960), (1820, 1052), (1700, 1096),
              (1200, 1102), (700, 1090), (700, 1080), (1658, 1080)]
FENCE_Y = 168          # the paddock fence's foot line in the play area
KERB = [(1664, 222), (1760, 232), (1840, 262), (1890, 318)]
GROVES = [(-620, -250, 5), (-200, -330, 4), (420, -380, 5), (1150, -330, 4), (1900, -300, 5), (2380, -120, 4),
          (-700, 520, 4), (-560, 1150, 5), (-120, 1420, 4), (760, 1440, 5), (1500, 1400, 4), (2300, 720, 5),
          (2240, 1320, 4)]
KEEPOUT = (-330, -60, C.BASE_W + 330, C.BASE_H + 200)


def paint(G, work):
    grass = G.quilt([G.patch(900, 6, 1250, 50), G.patch(6, 1040, 60, 1085), G.patch(700, 6, 880, 46)], block=44, overlap=14, seed=11)
    grass = G.set_tone(grass, (92, 124, 13))
    grass = G.shade(grass, .10 * G.noise(220, seed=12, octaves=2))
    # Dirt from the two stretches of the yard that carry no court line.
    dirt = G.quilt([G.patch(930, 360, 1420, 920), G.patch(240, 660, 740, 920)], block=160, overlap=54, seed=13)
    dirt = G.set_tone(dirt, (164, 116, 38))
    dirt = G.shade(dirt, .05 * G.noise(180, seed=14))
    import cv2
    import numpy as np
    # The yard: both lobes joined through the play area, corners rounded off, then a soil lip round it.
    whole = [YARD_LEFT[0], (6, 300), (C.BASE_W - 6, 300), *YARD_RIGHT[:-2], (C.BASE_W - 6, 1080), (6, 1080), *YARD_LEFT[::-1][:-1]]
    yard = (cv2.GaussianBlur(np.clip(G.mask(YARD_LEFT, 0) + G.mask(YARD_RIGHT, 0) + G.mask([(0, 300), (C.BASE_W, 300), (C.BASE_W, 1084), (0, 1084)], 0), 0, 1),
                             (0, 0), 26.0) > .5).astype(np.float32)
    lip = cv2.GaussianBlur(yard, (0, 0), 3.0)
    ground = G.mix(grass, G.flat((86, 62, 22)), ((lip > .08) & (lip < .92)).astype(np.float32))      # the soil lip round the yard
    ground = G.mix(ground, dirt, cv2.GaussianBlur((lip > .55).astype(np.float32), (0, 0), 1.0))
    # The kerb of flat stones runs a little way on along the yard's upper right edge.
    stones = G.band(KERB, 15, feather=1.2) * (G.noise(9, seed=15) > -.55)
    ground = G.mix(ground, G.shade(G.flat((176, 164, 128)), .10 * G.noise(14, seed=16)), stones.astype(np.float32))
    canopy = G.patch(540, 30, 640, 120, 'reference')
    G.detail_map(canopy, work / 'leaf-detail.png', gain=1.5)
    mean = G.tone(canopy)
    G.notes.update(leafShade=[round(float(v) * .5) for v in mean], leafLit=[round(float(v) * 1.08) for v in mean],
                   canopyRuns=G.edge_runs(G.foliage_alpha()))
    return {'ground': ground}


def build(K):
    notes = K.notes
    leaf = K.ramp('leaf', notes['leafShade'], notes['leafLit'], ramp=(-.1, .9), mottle=.10, scale=1.6, grain=0,
                  own=.55, share=.5, smooth=True, picture=K.work / 'leaf-detail.png', picture_px=150)
    bark = K.ramp('bark', (40, 28, 10), (104, 74, 36), ramp=(-.2, .7), mottle=.10, scale=6.0)
    wood = K.ramp('fence-wood', (48, 36, 8), (112, 84, 36), ramp=(-.2, .7), mottle=.10, scale=8.0)

    # The paddock fence runs on to both sides, then turns down the canvas.
    K.fence('fence-west', [(0, FENCE_Y), (-520, FENCE_Y - 4), (-780, FENCE_Y + 30), (-840, 420), (-850, 1240)], wood)
    K.fence('fence-east', [(C.BASE_W, FENCE_Y), (2160, FENCE_Y - 2), (2420, FENCE_Y + 34), (2476, 430), (2484, 1240)], wood)

    # Small paddock trees: a row behind the fence, and groves out on the pasture.
    row = [(x, FENCE_Y - 26 - 30 * C.hash01('rowy', x)) for x in list(range(-860, -40, 185)) + list(range(1760, 2560, 190))]
    for k, (x, y) in enumerate(row):
        K.tree(f'row-tree-{k}', x + 30 * (C.hash01('rowx', k) - .5), y, .52 + .12 * C.hash01('rows', k), f'row{k}', leaf, bark)
    for g, (gx, gy, count) in enumerate(GROVES):
        for i in range(count):
            x = gx + (C.hash01('gx', g, i) - .5) * 300
            y = gy + (C.hash01('gy', g, i) - .5) * 190
            if KEEPOUT[0] < x < KEEPOUT[2] and KEEPOUT[1] < y < KEEPOUT[3]:
                continue
            K.tree(f'grove-{g}-{i}', x, y, .5 + .22 * C.hash01('gs', g, i), f'g{g}{i}', leaf, bark)
    K.seam_crowns(notes['canopyRuns'], leaf, zc=1.9, piece=120, scale=.55)
    for k, (x, y) in enumerate(C.scatter('bush', 30, KEEPOUT, 220)):
        r = 22 + 18 * C.hash01('bushr', k)
        K.blob(f'bush-{k}', [(x, y, r, r * .7, .42, .2), (x + r * .7, y + 5, r * .7, r * .5, .32, .16)], leaf, voxel=.07, soften=4, bumps=.12, bump_scale=.3)
