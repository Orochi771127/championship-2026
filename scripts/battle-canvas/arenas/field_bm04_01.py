"""BM04 island arena: a shallow lagoon between sandy, palm-grown shores.

The play-area picture is the lagoon; it cuts a beach at the top-left, a sand bluff with rocks
at the top-right and a palm point at the bottom-right.  The ring makes each of those the tip of
its own shore and lets the lagoon open to deeper sea to the north, west and south.
"""
import math

import canvaslib as C

FIELD_ID = 'field_bm04_01'


def _is_water(rgb):
    return (rgb[..., 2] > 118) & (rgb[..., 1] > 105) & (rgb[..., 0] < 132)


JOIN = {'weld': 22.0, 'soften': .7, 'clash': 80.0, 'water_name': 'water-mask-canvas.webp',
        'classes': [(_is_water, None), (lambda rgb: rgb[..., 0] > -1, 28.0)]}

# The three shores (screen, base pixels).  Each starts from where the play area cuts it.
LAND_NW = [(-900, -580), (640, -580), (700, -380), (760, -150), (770, 0), (0, 0), (0, 300), (-200, 362), (-420, 330),
           (-640, 404), (-900, 384)]
LAND_NE = [(1420, -580), (1300, -420), (1180, -200), (1110, 0), (1664, 0), (1664, 450), (1800, 522), (1990, 470),
           (2200, 560), (2570, 500), (2570, -580)]
LAND_SE = [(1664, 870), (1800, 822), (2000, 862), (2250, 800), (2570, 830), (2570, 1670), (1090, 1670), (1180, 1420),
           (1300, 1200), (1350, 1088), (1664, 1088)]
# Roughly where the same shores lie inside the play area (hidden there; they keep the beach from wrapping its edge).
INSIDE = [[(0, 0), (770, 0), (520, 50), (340, 90), (130, 215), (0, 300)],
          [(1110, 0), (1664, 0), (1664, 450), (1560, 210), (1420, 190), (1160, 90)],
          [(1664, 870), (1500, 930), (1350, 1088), (1664, 1088)]]
PALMS = [(-260, 200, 1.0), (-560, 250, .9), (-760, 120, 1.1), (-420, -120, 1.0), (-80, -260, .95), (300, -330, 1.05),
         (520, -200, .9), (-700, -380, 1.0), (1500, -330, 1.0), (1760, -180, 1.1), (2050, -300, .95), (2330, -80, 1.0),
         (1900, 300, .9), (2240, 330, 1.05), (2480, 180, .9), (1840, 1010, 1.0), (2120, 1080, 1.1), (2400, 1000, .95),
         (1500, 1380, 1.0), (1820, 1420, .9), (2180, 1460, 1.05), (1300, 1560, .95), (2450, 1380, 1.0)]
SEAM_PALMS = [(262, 40, 1.0), (1456, 30, .85)]       # crowns that carry on the canopies the top edge cuts
KEEPOUT = (-60, -40, C.BASE_W + 60, C.BASE_H + 40)


def paint(G, work):
    import cv2
    import numpy as np
    from groundlib import Ground
    land = np.clip(sum(G.mask(shape, 0) for shape in (LAND_NW, LAND_NE, LAND_SE, *INSIDE)), 0, 1)
    land = (cv2.GaussianBlur(land, (0, 0), 14.0) > .5).astype(np.float32)          # round the shore's corners
    sea = 1 - land
    out_to_sea = cv2.distanceTransform((sea > .5).astype(np.uint8), cv2.DIST_L2, 5)
    inland = cv2.distanceTransform((land > .5).astype(np.uint8), cv2.DIST_L2, 5)

    # Water: the lagoon's own texture, teal in the shallows, bluer and darker out to sea.
    water = G.quilt([G.patch(500, 400, 1100, 800)], block=170, overlap=56, seed=41)
    depth = np.clip(out_to_sea / 300.0, 0, 1) ** .8
    far = np.clip((out_to_sea - 300.0) / 500.0, 0, 1)
    tone = (np.array([90, 182, 172], np.float32) * (1 - depth[..., None]) + np.array([62, 136, 178], np.float32) * depth[..., None])
    tone = tone * (1 - far[..., None]) + np.array([40, 108, 170], np.float32) * far[..., None]
    water = water - G.tone(water).astype(np.float32) + tone
    water = G.shade(water, .05 * G.noise(200, seed=42))

    # Land: beach by the water, grass behind it.  The grass texture is the grass arena's, in this arena's green.
    sand = G.shade(G.flat((188, 168, 110)), .07 * G.noise(90, seed=43, octaves=2) + .025 * G.noise(3, seed=44))
    meadow = Ground('field_bm02_01')
    grass = G.quilt([meadow.patch(380, 940, 590, 1085)], block=120, overlap=40, seed=45)
    grass = G.set_tone(grass, (112, 152, 64))
    grass = G.shade(grass, .09 * G.noise(200, seed=46, octaves=2))
    beach = np.clip((150 + 70 * G.noise(160, seed=47) - inland) / 40.0, 0, 1)        # 1 on the beach, 0 inland
    ground_land = G.mix(grass, sand, beach)
    wet = np.clip(1 - inland / 16.0, 0, 1)
    ground_land = G.shade(ground_land, -.16 * wet)
    foam = np.clip(1 - np.abs(out_to_sea - 4.0) / 4.0, 0, 1) * (.55 + .45 * (G.noise(30, seed=48) > -.2))
    water = G.mix(water, G.flat((226, 244, 240)), foam.astype(np.float32) * .8)
    ground = G.mix(water, ground_land, cv2.GaussianBlur(land, (0, 0), 1.0))

    return {'ground': ground, 'water': cv2.GaussianBlur(sea, (0, 0), 1.0)}


def palm(K, name, x, y, size, seed, frond, bark, trunk=True):
    h = 2.7 * size
    lean = (C.hash01(seed, 'l') - .5) * 50 * size
    top = (x + lean, y)
    if trunk:
        K.pole(f'{name}-trunk', [(x, y, 0), (x + lean * .35, y, h * .4), (x + lean * .8, y, h * .8), (top[0], y, h)], .17 * size, bark, taper=.6)
    count = 10
    for k in range(count):
        a = (k + C.hash01(seed, k, 'a') * .6) * math.tau / count
        length = (112 + 30 * C.hash01(seed, k, 'len')) * size
        droop = .55 + .5 * C.hash01(seed, k, 'd')
        ca, sa = math.cos(a), math.sin(a) * .78
        spine = [(0.0, h), (.35, h + .32 * size), (.7, h + .12 * size), (1.0, h - droop * size)]
        width = 21 * size
        verts, faces = [], []
        for i, (t, z) in enumerate(spine):
            w = width * (1 - .78 * t) * (1.0 if i else .35)
            px, py = top[0] + ca * length * t, top[1] + sa * length * t
            verts += [K_GP((px - sa * w, py + ca * w * .78), z), K_GP((px, py), z + .10 * size * (1 - t)), K_GP((px + sa * w, py - ca * w * .78), z)]
        for i in range(len(spine) - 1):
            b = i * 3
            faces += [(b, b + 1, b + 4, b + 3), (b + 1, b + 2, b + 5, b + 4)]
        K.mesh(f'{name}-frond-{k}', verts, faces, frond)


def build(K):
    global K_GP
    from kit import GP as K_GP
    frond = K.ramp('palm-frond', (26, 84, 40), (124, 182, 72), ramp=(-.3, .8), mottle=.10, scale=5.0, grain=.03, own=.55, share=.5)
    bark = K.ramp('palm-bark', (62, 44, 26), (150, 118, 76), ramp=(-.2, .7), mottle=.10, scale=9.0)
    stone = K.ramp('shore-rock', (110, 100, 86), (212, 202, 178), ramp=(-.1, .8), mottle=.08, scale=4.0)
    for k, (x, y, size) in enumerate(PALMS):
        palm(K, f'palm-{k}', x, y, size, k, frond, bark)
    for k, (x, y, size) in enumerate(SEAM_PALMS):
        palm(K, f'seam-palm-{k}', x, y, size, 100 + k, frond, bark, trunk=False)
    # Boulders along the three shores and scattered on the beaches.
    shores = [LAND_NW[6:11], LAND_NE[5:10], LAND_SE[0:5], LAND_SE[6:10], LAND_NW[1:5], LAND_NE[0:4]]
    n = 0
    for s, line in enumerate(shores):
        for (ax, ay), (bx, by) in zip(line, line[1:]):
            steps = max(1, round(math.hypot(bx - ax, by - ay) / 95))
            for i in range(steps):
                if C.hash01('rk', s, n) < .45:
                    n += 1
                    continue
                x, y = C.lerp((ax, ay), (bx, by), (i + C.hash01('rt', n)) / steps)
                r = 22 + 26 * C.hash01('rr', n)
                K.lump(f'rock-{n}', x + (C.hash01('rx', n) - .5) * 40, y + (C.hash01('ry', n) - .5) * 30, r, r * .75, r / 34 * .7, stone, seed=n, jag=.3)
                n += 1
