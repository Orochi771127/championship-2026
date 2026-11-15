"""Shared build for the two stadium arenas (BM10 clay stadium, BM11 dome).

Both play-area pictures are a pitch on a concrete apron with the north stand along the top.
The pitch itself ends inside the picture; what runs off its edges is the apron (left, right,
bottom) and the stand (top, and at both sides of the top band).  The ring therefore lays the
apron on, repeats the stand's own picture sideways and its roof or seat rows upward, and builds
the rest of the bowl: a west and an east stand, boards along the south touchline, floodlight
masts, the rim and the dark ground outside.
"""
import canvaslib as C

STAND_FOOT = 215                      # the north stand's band ends here; below it is apron
FLOOR = (-850, -530, 2514, 1600)      # the stadium floor inside the rim (screen, base pixels)


def paint(G, work, cfg):
    import cv2
    import numpy as np
    # Apron concrete from this arena's own clear strips, or (the dome has none wide enough: its roof
    # tubes cross them) from the sister stadium's, set to this arena's tone.
    source = G if not cfg.get('apron_from') else type(G)(cfg['apron_from'])
    apron = G.quilt([source.patch(*rect) for rect in cfg['apron']], block=34, overlap=12, seed=cfg['seed'])
    apron = G.set_tone(apron, cfg['apron_tone'])
    apron = G.shade(apron, .06 * G.noise(180, seed=cfg['seed'] + 1, octaves=2))
    yy = (np.arange(G.h) + C.Y0)[:, None] * np.ones((1, G.w))
    xx = (np.arange(G.w) + C.X0)[None, :] * np.ones((G.h, 1))
    ground = apron
    # The stand's band, repeated sideways from its own picture.
    side = G.grid(*cfg['side_tile'])
    ground = np.where(((yy >= 0) & (yy < STAND_FOOT))[..., None], side, ground)
    # Above the play area: the roof or the upper seat rows, each repeated upward in its own stretch.
    for x0, x1, tile in cfg['top_zones']:
        zone = (yy < 0) & (xx >= x0) & (xx < x1)
        ground = np.where(zone[..., None], G.grid(*tile, level=cfg.get('top_level')), ground)
    # The rim and the ground outside the stadium.
    fx0, fy0, fx1, fy1 = FLOOR
    inside = G.mask([(fx0, fy0), (fx1, fy0), (fx1, fy1), (fx0, fy1)], 0)
    outside = G.shade(G.flat(cfg['exterior']), .10 * G.noise(140, seed=cfg['seed'] + 2, octaves=2) + .02 * G.noise(3, seed=cfg['seed'] + 3))
    rim = np.clip(cv2.GaussianBlur(inside, (0, 0), 9) * 2 - 1, -1, 1)
    ground = G.mix(outside, ground.astype(np.float32), inside)
    ground = G.mix(ground, G.flat(cfg['rim']), (np.abs(rim) < .75).astype(np.float32))
    for tube in cfg.get('tubes', ()):      # roof tubes that cross the picture run on to their anchors
        ground = G.mix(ground, G.flat(cfg['tube_dark']), G.band(tube, 22, feather=1.0))
        ground = G.mix(ground, G.flat(cfg['tube_lit']), G.band([(x - 2, y) for x, y in tube], 8, feather=1.6) * .9)
    return {'ground': ground}


def build(K, cfg):
    concrete = K.ramp('concrete', (64, 72, 70), (148, 156, 150), ramp=(-.2, .7), mottle=.06, scale=5.0)
    concrete_top = K.ramp('concrete-top', (96, 104, 100), (150, 158, 152), ramp=(.4, .92), mottle=.06, scale=5.0)
    seats = [K.ramp(f'seat-{i}', tuple(int(v * .55) for v in rgb), rgb, ramp=(.3, .9), mottle=.10, scale=22.0, grain=.05)
             for i, rgb in enumerate(cfg['seats'])]
    board = [K.matte(f'board-{i}', rgb) for i, rgb in enumerate(cfg['boards'])]
    steel = K.ramp('steel', (58, 72, 78), (176, 190, 194), ramp=(-.2, .7), mottle=.04, scale=8.0)
    lamp = K.glow('lamp', (240, 248, 255), 1.6)
    # West and east stands: rows rising away from the pitch, in seat blocks with aisles between.
    blocks = [(250, 440), (470, 690), (720, 940), (970, 1150)]
    for side, sign, edge in (('west', -1, -150), ('east', 1, C.BASE_W + 150)):
        for row in range(9):
            x = edge + sign * (22 + 44 * row)
            top = .3 + .29 * row
            for b, (y0, y1) in enumerate(blocks):
                colour = seats[(row // 2 + b + (0 if sign < 0 else 1)) % len(seats)]
                K.prism(f'{side}-stand-{row}-{b}', [(x - 22, y0), (x + 22, y0), (x + 22, y1), (x - 22, y1)], 0.0, top, concrete, colour)
        back = edge + sign * (22 + 44 * 9 + 10)
        K.prism(f'{side}-stand-back', [(back - 14, 236), (back + 14, 236), (back + 14, 1164), (back - 14, 1164)], 0.0, 3.3, concrete, concrete_top)
        for b, (y0, y1) in enumerate(blocks[:-1]):          # aisle steps between the blocks
            K.prism(f'{side}-aisle-{b}', [(min(edge, back), y1), (max(edge, back), y1), (max(edge, back), blocks[b + 1][0]), (min(edge, back), blocks[b + 1][0])],
                    0.0, .12, concrete, concrete_top)
    # South stand: rows rising toward the camera, seen from behind and above.
    spans = [(-560, -120), (-90, 380), (410, 820), (850, 1260), (1290, 1750), (1780, 2220)]
    for row in range(7):
        y = 1300 + 40 * row
        top = .3 + .27 * row
        for b, (x0, x1) in enumerate(spans):
            K.prism(f'south-stand-{row}-{b}', [(x0, y - 20), (x1, y - 20), (x1, y + 20), (x0, y + 20)], 0.0, top, concrete, seats[(row // 2 + b) % len(seats)])
    K.prism('south-stand-back', [(-574, 1562), (2234, 1562), (2234, 1586), (-574, 1586)], 0.0, 2.3, concrete, concrete_top)
    # Boards along the south touchline, then the masts at the corners of the wider floor.
    x = -560
    k = 0
    while x < 2220:
        K.box(f'south-board-{k}', x + 62, 1244, 118, 10, 0.0, .34, board[k % len(board)])
        x += 126
        k += 1
    for k, (x, y) in enumerate(((-720, 1250), (2384, 1250), (-720, 230), (2384, 230))):
        K.box(f'mast-{k}-foot', x, y, 44, 34, 0.0, .3, concrete, concrete_top)
        K.pole(f'mast-{k}', [(x, y, .3), (x, y, 5.6)], .09, steel)
        K.box(f'mast-{k}-head', x, y, 96, 26, 5.5, 5.95, steel)
        K.box(f'mast-{k}-lamps', x, y + 14, 84, 6, 5.56, 5.9, lamp)
    for k, (x, y) in enumerate(cfg.get('anchors', ())):
        K.box(f'tube-anchor-{k}', x, y, 70, 50, 0.0, .5, concrete, concrete_top)
