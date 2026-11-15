"""BM08 hell-ruins arena: a moonlit flagstone court between rock pillars, under a ruined wall.

The play-area picture is the court; its flagstones run off the left, right and bottom edges,
the wall and its boulders are cut by the top edge, and rock pillars by both sides.  The ring
lays the court on in the same courses (the horizontal joints line up with the picture's own
rows), lets it crumble into dark rocky ground, carries the wall across the canvas and stands
pillars behind it and round the court.
"""
import canvaslib as C

FIELD_ID = 'field_bm08_01'
JOIN = {'weld': 16.0, 'soften': .7, 'clash': 60.0, 'tone_cap': 30.0}

# Horizontal joints measured in the play-area picture; courses above and below continue at this pitch.
JOINT_ROWS = [375, 437, 500, 552, 604, 656, 715, 771, 827, 880, 941, 998, 1059]
COURSE = 57
COURT = (-430, -70, 2094, 1430)                   # the paved court (screen, base pixels)
PIT = (1035, 1104, 104, 54)                       # the pit the bottom edge cuts: centre and half-axes
WALL_FOOT = 44
PILLARS = [                                      # (x, y, radius, height): the first rows carry on pillars the edges cut
    (120, 66, 66, 2.6), (330, 60, 62, 2.5), (1110, 62, 64, 2.4), (1415, 64, 62, 2.6), (1585, 70, 66, 2.7),
    (-34, 112, 70, 2.4), (-44, 640, 80, 2.2), (1702, 300, 82, 2.8), (1704, 960, 86, 2.4),
    (-240, 60, 74, 2.8), (-470, 20, 90, 3.2), (620, -80, 84, 3.0), (860, -60, 70, 2.5), (1860, 40, 80, 2.9),
    (2120, 0, 92, 3.3), (-700, 200, 96, 3.0), (-560, 520, 84, 2.6), (-640, 900, 100, 3.1), (-520, 1260, 78, 2.3),
    (2230, 330, 90, 2.9), (2330, 700, 98, 3.2), (2200, 1080, 84, 2.5), (2380, 1340, 90, 2.8),
    (200, -300, 100, 3.3), (520, -360, 90, 3.0), (980, -300, 104, 3.4), (1380, -340, 92, 3.0), (1760, -280, 98, 3.2),
    (-360, -330, 96, 3.1), (-760, -260, 90, 2.9), (2260, -330, 100, 3.3), (2480, -120, 84, 2.7),
    (160, 1560, 90, 2.6), (760, 1580, 84, 2.4), (1400, 1570, 96, 2.8), (1960, 1540, 88, 2.5), (-760, 1500, 92, 2.7),
]


def course_edges():
    rows = list(JOINT_ROWS)
    while rows[0] > C.Y0 - COURSE:
        rows.insert(0, rows[0] - COURSE)
    while rows[-1] < C.Y1 + COURSE:
        rows.append(rows[-1] + COURSE)
    return rows


def paint(G, work):
    import cv2
    import numpy as np
    h, w = G.h, G.w
    value = np.ones((h, w), dtype=np.float32)
    joint = np.zeros((h, w), dtype=np.float32)
    rows = course_edges()
    for r, (ya, yb) in enumerate(zip(rows, rows[1:])):
        y0, y1 = max(0, ya - C.Y0), min(h, yb - C.Y0)
        if y1 <= y0:
            continue
        line = np.ones(w, dtype=np.float32)
        marks = np.zeros(w, dtype=np.float32)
        x = -int(C.hash01('fx', r) * 120)
        k = 0
        while x < w:
            width = int(58 + 68 * C.hash01('fw', r, k) ** 1.4)
            line[max(0, x):min(w, x + width)] = 1 + .11 * (C.hash01('fv', r, k) - .5)
            if x >= 0:
                marks[x:min(w, x + 3)] = 1
            x += width
            k += 1
        value[y0:y1] = line
        joint[y0:y1] = marks
        joint[y0:min(h, y0 + 3)] = 1
    joint = cv2.GaussianBlur(joint, (0, 0), .9)
    stone = G.flat((56, 84, 130)) * value[..., None]
    detail = G.quilt([G.patch(420, 380, 1180, 440), G.patch(420, 610, 1180, 650)], block=40, overlap=14, seed=81)
    stone = stone + (detail - G.tone(detail).astype(np.float32)) * .7
    stone = G.mix(stone, G.flat((36, 56, 92)), np.clip(joint * 1.3, 0, 1))
    stone = G.shade(stone, .07 * G.noise(200, seed=82, octaves=2))

    earth = G.shade(G.flat((24, 40, 70)), .16 * G.noise(110, seed=83, octaves=3) + .03 * G.noise(3, seed=84))
    x0, y0, x1, y1 = COURT
    court = G.mask([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 0)
    court = cv2.GaussianBlur(court, (0, 0), 46) + .22 * G.noise(70, seed=85, octaves=2)      # a crumbled edge
    court = (court > .5).astype(np.float32)
    ground = G.mix(earth, stone, cv2.GaussianBlur(court, (0, 0), 1.2))
    lip = np.clip(cv2.GaussianBlur(court, (0, 0), 5) * 2 - 1, -1, 1)
    ground = G.shade(ground, -.22 * (1 - np.abs(lip)))                                         # the court's broken rim
    # The court lies under one moon: it darkens away from the play area.
    yy, xx = np.mgrid[0:h, 0:w]
    far = np.hypot(np.clip(np.abs(xx + C.X0 - C.BASE_W / 2) - C.BASE_W / 2, 0, None),
                   np.clip(np.abs(yy + C.Y0 - C.BASE_H / 2) - C.BASE_H / 2, 0, None))
    ground = G.shade(ground, -.26 * np.clip(far / 900.0, 0, 1))
    # The pit the bottom edge cuts goes on below it.
    px, py, rx, ry = PIT
    pit = G.blob(px, py, rx, ry, seed=86, rough=.08, feather=5)
    ground = G.mix(ground, G.flat((4, 10, 24)), pit)
    return {'ground': ground}


def build(K):
    face = K.ramp('ruin-rock-face', (8, 22, 52), (40, 74, 124), ramp=(-.2, .6), mottle=.12, scale=3.0, own=.5, share=.55)
    top = K.ramp('ruin-rock-top', (20, 48, 96), (62, 102, 152), ramp=(.4, .92), mottle=.12, scale=2.4, own=.5, share=.55)
    brick = K.ramp('ruin-wall', (4, 20, 50), (26, 54, 100), ramp=(-.2, .7), mottle=.14, scale=7.0, own=.5, share=.55)
    brick_top = K.ramp('ruin-wall-top', (22, 48, 92), (52, 86, 134), ramp=(.4, .92), mottle=.10, scale=6.0, own=.5, share=.55)
    rubble = K.ramp('ruin-rubble', (16, 34, 70), (64, 98, 146), ramp=(-.1, .8), mottle=.10, scale=5.0, own=.5, share=.55)
    # The wall: in broken lengths across the whole canvas, behind the court's top edge.
    x = C.X0 - 20
    k = 0
    while x < C.X1 + 20:
        length = 220 + 240 * C.hash01('wl', k)
        if not (-10 < x < C.BASE_W and x + length > 0 and False):
            K.prism(f'wall-{k}', [(x, WALL_FOOT - 18), (x + length, WALL_FOOT - 18), (x + length, WALL_FOOT), (x, WALL_FOOT)],
                    0.0, 1.5 + .7 * C.hash01('wh', k), brick, brick_top)
        x += length + (0 if C.hash01('wg', k) < .6 else 60 + 80 * C.hash01('wgg', k))
        k += 1
    for k, (x, y, r, hgt) in enumerate(PILLARS):
        K.butte(f'pillar-{k}', x, y, r, hgt, face, top, seed=k, corners=7 + k % 3, star=.05, bevel=.2, crown=.5)
    # Rubble: by the pit, along the court's rim and scattered over the rocky ground.
    px, py, rx, ry = PIT
    import math
    for k in range(11):
        a = .15 + k * (math.pi - .3) / 10          # the lower half of the pit's rim
        r = 13 + 12 * C.hash01('pr', k)
        K.lump(f'pit-stone-{k}', px + (rx + 12) * math.cos(a), py + (ry + 10) * math.sin(a), r, r * .75, r / 20 * .42, rubble, seed=k, jag=.3)
    for k, (x, y) in enumerate(C.scatter('rubble', 90, (-60, -60, C.BASE_W + 60, C.BASE_H + 60), 120)):
        for i in range(2 + int(C.hash01('rn', k) * 4)):
            r = 10 + 16 * C.hash01('rr', k, i)
            K.lump(f'rubble-{k}-{i}', x + (C.hash01('rx', k, i) - .5) * 70, y + (C.hash01('ry', k, i) - .5) * 36, r, r * .75, r / 22 * .5, rubble, seed=i, jag=.32)
