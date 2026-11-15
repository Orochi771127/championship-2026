"""BM02 grass arena: the meadow goes on into a broadleaf wood on every side.

The play-area picture is a mown meadow ringed by trees; in the game their leaf canopies are
separate layers, cut at the picture's edge.  The ring continues those canopies over the seam
and fills the canvas with the same wood: rough grass, bare soil patches, boulders, trees.
"""
import canvaslib as C

FIELD_ID = 'field_bm02_01'
JOIN = {'weld': 14.0, 'soften': 1.1}        # leaves and grass are stochastic: a long weld would comb them
LEAVES = 'assets/production/battle/bm02-polish-r2/foliage-0.webp'

# Trees stand on a jittered grid; the play area and a band round it stay clear of trunks.
GRID = (236, 178)
# A crown stands about 240 px above its trunk's foot and 110 px to each side: trunks keep far enough from the play
# area that no crown is cut by it (the canopies the picture itself cuts are continued separately).
CLEAR = (-150, -40, C.BASE_W + 150, C.BASE_H + 285)
GLADES = [(-520, 330, 210, 120), (2180, 900, 230, 130), (760, 1420, 250, 110), (1480, -300, 220, 100),
          (-640, 1290, 200, 110), (2260, 120, 190, 110), (240, -380, 200, 90)]
SOIL = [(-520, 330, 150, 70, 1), (2180, 900, 170, 78, 2), (760, 1425, 175, 66, 3), (1480, -300, 150, 60, 4),
        (-640, 1290, 140, 64, 5), (2260, 120, 130, 60, 6), (240, -380, 140, 52, 7), (1900, 420, 90, 40, 8),
        (-180, 760, 80, 36, 9)]
ROCKS = [(-470, 300, 34, 1), (-590, 372, 24, 2), (2110, 870, 38, 3), (2270, 950, 26, 4), (700, 1380, 30, 5),
         (860, 1452, 40, 6), (1420, -330, 30, 7), (1560, -270, 36, 8), (-700, 1260, 30, 9), (2330, 150, 32, 10),
         (180, -400, 28, 11), (-150, 1190, 26, 12), (1790, 1230, 30, 13), (-860, 700, 34, 14), (2480, 560, 30, 15),
         (1180, 1300, 24, 16), (420, 1240, 26, 17)]


def in_glade(x, y):
    return any(((x - gx) / rx) ** 2 + ((y - gy) / ry) ** 2 < 1 for gx, gy, rx, ry in GLADES)


def tree_sites():
    sites = []
    gx, gy = GRID
    row = 0
    y = C.Y0 - 40
    while y < C.Y1 + 160:
        x = C.X0 - 60 + (gx / 2 if row % 2 else 0)
        col = 0
        while x < C.X1 + 80:
            px = x + (C.hash01('tx', row, col) - .5) * gx * .5
            py = y + (C.hash01('ty', row, col) - .5) * gy * .5
            inside = CLEAR[0] < px < CLEAR[2] and CLEAR[1] < py < CLEAR[3]
            if not inside and not in_glade(px, py) and C.hash01('gap', row, col) > .17:
                sites.append((px, py, .72 + .6 * C.hash01('ts', row, col), row * 100 + col))
            x += gx
            col += 1
        y += gy
        row += 1
    return sites


def paint(G, work):
    rough = [G.patch(380, 940, 590, 1085), G.patch(1612, 470, 1660, 600), G.patch(640, 4, 700, 60)]
    grass = G.quilt(rough, block=120, overlap=40, seed=21)
    grass = G.set_tone(grass, (108, 148, 12))
    grass = G.shade(grass, .10 * G.noise(260, seed=22, octaves=2))
    soil = G.quilt([G.patch(1070, 965, 1215, 1075), G.patch(730, 110, 860, 170)], block=96, overlap=32, seed=23)
    soil = G.shade(soil, .06 * G.noise(120, seed=24))
    ground = grass
    for x, y, rx, ry, seed in SOIL:
        ground = G.mix(ground, soil, G.blob(x, y, rx, ry, seed=seed, rough=.2, feather=5))
    # Leaves: a detail map and two tones from the canopies as the game shows them.
    canopy = G.patch(150, 14, 330, 108, 'reference')
    G.detail_map(canopy, work / 'leaf-detail.png', gain=1.5)
    mean = G.tone(canopy)
    G.notes.update(leafShade=[round(float(v) * .5) for v in mean], leafLit=[round(float(v) * 1.08) for v in mean],
                   canopyRuns=G.edge_runs(G.foliage_alpha()))
    return {'ground': ground}


def build(K):
    notes = K.notes
    leaf = K.ramp('leaf', notes['leafShade'], notes['leafLit'], ramp=(-.1, .9), mottle=.10, scale=1.6, grain=0,
                  own=.55, share=.5, smooth=True, picture=K.work / 'leaf-detail.png', picture_px=200)
    bark = K.ramp('bark', (24, 22, 8), (74, 58, 30), ramp=(-.2, .7), mottle=.12, scale=6.0)
    stone = K.ramp('stone', (74, 88, 82), (170, 180, 152), ramp=(-.2, .75), mottle=.10, scale=4.0)

    def crown(name, x, y, size, zc, seed):
        lobes = [(x, y, 104 * size, 80 * size, 1.5 * size, zc)]
        for k in range(4):
            a = k * 1.57 + C.hash01(seed, k, 'a') * 1.2
            r = 62 * size
            lobes.append((x + r * 1.15 * __import__('math').cos(a), y + r * .7 * __import__('math').sin(a),
                          (58 + 22 * C.hash01(seed, k, 'r')) * size, (46 + 16 * C.hash01(seed, k, 'd')) * size,
                          (.95 + .35 * C.hash01(seed, k, 'h')) * size, zc + (C.hash01(seed, k, 'z') - .6) * .7 * size))
        K.blob(name, lobes, leaf, voxel=.09, soften=6, bumps=.32, bump_scale=.42)

    for x, y, size, seed in tree_sites():
        h = 2.3 * size
        K.pole(f'tree-{seed}-trunk', [(x, y, 0), (x + 5 * size, y, h * .5), (x + 2 * size, y, h + .4)], .26 * size, bark, taper=.55)
        for k in range(3):
            a = k * 2.1 + C.hash01(seed, 'b', k) * 1.5
            reach = (58 + 30 * C.hash01(seed, 'c', k)) * size
            K.pole(f'tree-{seed}-branch-{k}', [(x + 3 * size, y, h * .55), (x + reach * .5 * __import__('math').cos(a), y + reach * .2 * __import__('math').sin(a), h * .95),
                                               (x + reach * __import__('math').cos(a), y + reach * .4 * __import__('math').sin(a), h * 1.25)], .09 * size, bark, taper=.4)
        crown(f'tree-{seed}-crown', x, y, size, h + .9 * size, seed)

    # The canopies the play area's edge cuts go on over the seam.
    lift = C.LIFT * 3.2
    for side, runs in notes['canopyRuns'].items():
        for lo, hi in runs:
            pieces = max(1, round((hi - lo) / 170))
            for i in range(pieces):
                mid = lo + (hi - lo) * (i + .5) / pieces
                half = (hi - lo) / pieces / 2 + 30
                size = max(.6, min(1.3, half / 100)) * (.92 + .3 * C.hash01(side, lo, i, 's'))
                out = 20 + 44 * C.hash01(side, lo, i, 'o')        # how far past the seam the crown's centre sits
                if side == 'top':
                    x, y = mid, -out + lift
                elif side == 'bottom':
                    x, y = mid, C.BASE_H + out + lift
                elif side == 'left':
                    x, y = -out, mid + lift
                else:
                    x, y = C.BASE_W + out, mid + lift
                crown(f'seam-crown-{side}-{lo}-{i}', x, y, size, 3.2, f'{side}{lo}{i}')

    for x, y, r, seed in ROCKS:
        K.lump(f'rock-{seed}', x, y, r, r * .7, r / 34 * .62, stone, seed=seed, jag=.34)
    for k in range(26):       # undergrowth at the feet of the wood
        x = C.X0 + C.hash01('bush', k, 'x') * C.CANVAS_W
        y = C.Y0 + C.hash01('bush', k, 'y') * C.CANVAS_H
        if CLEAR[0] - 30 < x < CLEAR[2] + 30 and CLEAR[1] - 30 < y < CLEAR[3] + 30:
            continue
        r = 26 + 22 * C.hash01('bush', k, 'r')
        K.blob(f'bush-{k}', [(x, y, r, r * .7, .5, .22), (x + r * .7, y + 6, r * .7, r * .5, .38, .18)], leaf, voxel=.07, soften=4, bumps=.14, bump_scale=.3)
