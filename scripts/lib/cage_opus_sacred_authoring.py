"""Original sacred family for the opus round: shrine (cm13), cemetery (cm14), temple (cm24).

Field intent, from local research only:

* cm13 shrine: a pale marble hall of light raised on a podium, columns, two
  braziers and a grand stair descending toward the viewer.
* cm14 cemetery: a night graveyard crossed by a winding stone path, mixed
  grave markers, a hooded statue, a dead tree and an iron gate in a low wall.
* cm24 temple: a timber hall with a large seated statue on an altar, two red
  pillars and candle stands.

What makes them distinct is the silhouette, not a palette swap: columns and a
stair, low steles and a gnarled tree, a seated figure between red pillars.

The previous drafts failed containment in their *core*: straight paths and
daises crossed the gaps between hexes.  Here every core surface is either
clipped to the hex union (podium, path) or placed inside it with measured
margins, and the containment module refuses any core geometry that leaves it.

Research rasters were viewed locally only; none is loaded, traced or exported.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment as containment
from . import cage_opus_facility_authoring as fx


FIELDS = ('field_cm13_01', 'field_cm14_01', 'field_cm24_01')
SURFACES = {'field_cm13_01': 'sc-marble-floor', 'field_cm14_01': 'sc-night-grass',
            'field_cm24_01': 'sc-plank-floor'}
DEPENDENCIES = ('cage_opus_facility_authoring',)
CONTRACTS = {}
U, V = fx.U, fx.V

PALETTE = {
    'sc-marble': ((.86, .87, .88), .30, .0, 0),
    'sc-marble-shade': ((.62, .66, .72), .34, .0, 0),
    'sc-gold': ((.86, .62, .20), .28, .90, 0),
    'sc-bronze': ((.42, .24, .10), .36, .80, 0),
    'sc-fire': ((1.0, .38, .04), .40, .0, 6.0),
    'sc-fire-core': ((1.0, .82, .30), .40, .0, 8.0),
    'sc-light-orb': ((1.0, .93, .70), .20, .0, 7.0),
    'sc-carpet': ((.10, .16, .42), .80, .0, 0),
    'sc-carpet-edge': ((.80, .62, .22), .50, .30, 0),
    'sc-stone': ((.30, .34, .40), .78, .0, 0),
    'sc-stone-light': ((.46, .50, .56), .74, .0, 0),
    'sc-moss': ((.10, .22, .18), .90, .0, 0),
    'sc-iron': ((.05, .06, .07), .45, .70, 0),
    'sc-dead-wood': ((.20, .17, .15), .88, .0, 0),
    'sc-wisp': ((.55, .95, 1.0), .20, .0, 4.0),
    'sc-lantern': ((1.0, .70, .30), .30, .0, 4.0),
    'sc-lacquer': ((.62, .07, .04), .34, .0, 0),
    'sc-lacquer-dark': ((.30, .03, .02), .40, .0, 0),
    'sc-wood': ((.42, .24, .11), .62, .0, 0),
    'sc-wood-dark': ((.20, .11, .05), .66, .0, 0),
    'sc-statue': ((.20, .22, .24), .70, .10, 0),
    'sc-statue-hi': ((.34, .37, .40), .66, .10, 0),
    'sc-wax': ((.92, .88, .76), .55, .0, 0),
    'sc-cushion': ((.40, .08, .20), .80, .0, 0),
    'sc-incense': ((.75, .72, .66), .40, .0, 0),
}

FLOORS = {
    'sc-marble-floor': ((.74, .77, .82), (.56, .60, .68), 1.0, .030),
    'sc-night-grass': ((.06, .10, .13), (.06, .10, .13), 4.0, .0),
    'sc-cobble': ((.24, .27, .33), (.13, .15, .19), .5, .070),
    'sc-plank-floor': ((.40, .24, .12), (.24, .13, .06), 1.0, .030),
}


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    for name, (tile, joint, period, width) in FLOORS.items():
        if name not in d.M:
            fx._floor_material(d, name, tile, joint, period, width)


# --------------------------------------------------------------------------- new geometry

def vertical_slab(d, name, cx, cy, axis, profile, thickness, mat, bevel=.006):
    """A slab standing in a vertical plane through (cx, cy).

    ``axis`` ('U' or 'V') is the direction the slab faces across; ``profile`` is
    a closed outline of (s, z) points in that plane, s in native px, z in world
    units.  Grave markers, gate leaves and sign boards are all this one shape.
    """
    # 'X' faces the camera squarely: halos and signs that must read head-on.
    along = {'U': U, 'V': V, 'X': (1.0, 0.0)}[axis]
    across = {'U': V, 'V': U, 'X': (0.0, 1.0)}[axis]
    half = thickness / 2
    verts = []
    for t in (-half, half):
        for s, z in profile:
            verts.append(d.world(cx + s * along[0] + t * across[0], cy + s * along[1] + t * across[1], z))
    n = len(profile)
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return fx._object(d, name, verts, faces, mat, bevel)


def arch_profile(width, height, top_ratio=.32, steps=10):
    """A rectangle with a round top: the classic stele silhouette."""
    half = width / 2
    shoulder = height * (1 - top_ratio)
    pts = [(-half, 0.0), (half, 0.0), (half, shoulder)]
    for i in range(1, steps):
        angle = math.pi * i / steps
        pts.append((half * math.cos(angle), shoulder + height * top_ratio * math.sin(angle)))
    pts.append((-half, shoulder))
    return pts


def flame(d, name, x, y, z, size, phase):
    """A layered flame whose lean and height change with the animation phase."""
    lean = (-.5, .2, .6, -.1)[phase % 4] * size * .3
    tall = (1.0, 1.18, .92, 1.08)[phase % 4]
    fx.lathe(d, name + '-outer', x + lean * .5, y, [(z, size * .55), (z + .10 * size * tall, size * .62),
                                                   (z + .22 * size * tall, .02)], 'sc-fire', 12)
    fx.lathe(d, name + '-core', x + lean, y, [(z, size * .30), (z + .06 * size * tall, size * .34),
                                              (z + .15 * size * tall, .02)], 'sc-fire-core', 10)


def ribbon(points, width):
    """A closed ground polygon around a polyline (miter-free, for gentle curves)."""
    left, right = [], []
    for i, (x, y) in enumerate(points):
        px, py = points[max(0, i - 1)]
        nx_, ny_ = points[min(len(points) - 1, i + 1)]
        dx, dy = nx_ - px, ny_ - py
        length = math.hypot(dx, dy) or 1.0
        ox, oy = -dy / length * width / 2, dx / length * width / 2
        left.append((x + ox, y + oy))
        right.append((x - ox, y - oy))
    return left + right[::-1]


def smooth_path(control, samples=10):
    """Catmull-Rom through control points; every sample stays between them."""
    pts = [control[0]] + list(control) + [control[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(samples):
            t = k / samples
            t2, t3 = t * t, t * t * t
            out.append(tuple(.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                   + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(control[-1])
    return out


def headroom(footprint, x0, x1, ground_y, margin=1.4, step=.5):
    """Screen pixels free straight above a ground line before the field's outline.

    Uses the exact distance to the union's outer boundary, so a shared seam
    between hexes never cuts the measurement short.  Tall props are designed to
    this height instead of being drawn too tall and shrunk afterwards.
    """
    import numpy as np
    xs = np.linspace(x0, x1, 9)
    y = ground_y
    while y > ground_y - 120:
        points = np.stack([xs, np.full_like(xs, y)], axis=1)
        if containment._union_depth(points, footprint).min() < margin:
            break
        y -= step
    return ground_y - y


def clipped_prism(d, name, polygon, footprint, z0, z1, mat, inset=1.0):
    """Clip a ground polygon to the hex union (height-aware) and extrude each piece."""
    made = []
    for index, piece in enumerate(fit.clip_to_footprint(polygon, footprint, inset, z1)):
        made.append(fx.prism(d, f'{name}-{index:02d}', piece, z0, z1, mat, 0))
    return made


# --------------------------------------------------------------------------- shrine (cm13)

PODIUM = .45
UPPER_OUTLINE = [(0, 24), (48, 0), (96, 24), (144, 0), (192, 24), (192, 88), (144, 112), (96, 88),
                 (48, 112), (0, 88)]


def shrine_core(d, footprint):
    """Raised marble podium over the upper hall, a grand stair into the lower hex."""
    clipped_prism(d, 'shrine-podium', UPPER_OUTLINE, footprint, 0, PODIUM, 'sc-marble', 1.0)
    # Light font on the podium between the braziers: stepped dais and an orb.
    for k, (half, z) in enumerate(((10.0, .10), (7.5, .20), (5.0, .30))):
        fx.box(d, f'shrine-dais-{k}', 96, 50, half, half * .6, PODIUM, PODIUM + z, 'sc-marble-shade', .010)
    fx.lathe(d, 'shrine-font', 96, 50, [(PODIUM + .30, 3.4), (PODIUM + .42, 3.8), (PODIUM + .52, 2.6),
                                         (PODIUM + .62, 1.2)], 'sc-gold', 24)
    fx.ball(d, 'shrine-light-orb', 96, 50, PODIUM + 1.05, 3.2, 'sc-light-orb')
    # Processional carpet from the font toward the stair.
    fx.box(d, 'shrine-carpet', 96, 72, 2.4, 2.4, PODIUM, PODIUM + .012, 'sc-carpet', 0)
    carpet = [(91, 60), (101, 60), (101, 88), (91, 88)]
    fx.prism(d, 'shrine-carpet-run', carpet, PODIUM, PODIUM + .012, 'sc-carpet', 0)
    # Grand stair: screen-facing treads descending toward the viewer.
    steps = 6
    for k in range(steps):
        top = PODIUM * (1 - (k + 1) / (steps + 1))
        y0 = 90 + k * 9.5
        tread = [(72, y0), (120, y0), (120, y0 + 10.5), (72, y0 + 10.5)]
        fx.prism(d, f'shrine-stair-{k}', tread, 0, top, 'sc-marble' if k % 2 == 0 else 'sc-marble-shade', .004)
        runner = [(91, y0 + .5), (101, y0 + .5), (101, y0 + 10), (91, y0 + 10)]
        fx.prism(d, f'shrine-stair-runner-{k}', runner, top, top + .01, 'sc-carpet', 0)
    for side, x0 in (('left', 67.5), ('right', 120)):
        for k in range(steps):
            top = PODIUM * (1 - k / (steps + 1)) + .12
            y0 = 92 + k * 9.5
            fx.prism(d, f'shrine-balustrade-{side}-{k}', [(x0, y0), (x0 + 4.5, y0), (x0 + 4.5, y0 + 9.5),
                                                          (x0, y0 + 9.5)], 0, top, 'sc-marble-shade', .006)
    return ['raised-marble-podium', 'grand-stair', 'light-font-on-dais', 'marble-columns']


def column(d, name, rect, footprint, base_z=PODIUM):
    x, y, w, h = rect
    r = min(w / 2 - 1.2, 6.0)
    cx, cy = x + w / 2, y + h - 1.2 - r / 2
    room = min(headroom(footprint, cx - r, cx + r, cy), cy - (y + 1.0)) - r / 2 - .6
    zt = max(base_z + 1.5, min(room / fx.lift(d, 1), base_z + 5.2))
    # A 2:1 box spans 2(a+b) on screen; a = b = r/2 matches the shaft's 2r width.
    fx.box(d, name + '-plinth', cx, cy, r * .55, r * .55, 0 if base_z == 0 else base_z, base_z + .16,
           'sc-marble-shade', .010)
    fx.lathe(d, name + '-base', cx, cy, [(base_z + .16, r * .86), (base_z + .30, r * .80), (base_z + .36, r * .66)],
             'sc-marble', 24)
    profile = [(base_z + .36, r * .62)]
    for i in range(1, 6):
        profile.append((base_z + .36 + (zt - base_z - .9) * i / 5, r * (.62 - .05 * i / 5)))
    fx.lathe(d, name + '-shaft', cx, cy, profile, 'sc-marble', 16)
    fx.lathe(d, name + '-capital', cx, cy, [(zt - .54, r * .58), (zt - .30, r * .80), (zt - .22, r * .88)],
             'sc-marble', 24)
    fx.box(d, name + '-abacus', cx, cy, r * .52, r * .52, zt - .22, zt, 'sc-marble-shade', .010)
    fx.cylinder(d, name + '-gilt', cx, cy, r * .64, zt - .58, zt - .52, 'sc-gold', 24)
    return (cx, cy)


def brazier(d, name, rect, phase, base_z=PODIUM):
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 2.4
    for i in range(3):
        angle = i * math.tau / 3 + .5
        fx.pipe(d, f'{name}-leg-{i}', [(cx + math.cos(angle) * 2.6, cy + .5 * math.sin(angle) * 2.6, base_z),
                                       (cx, cy, base_z + .32)], .05, 'sc-bronze')
    fx.lathe(d, name + '-bowl', cx, cy, [(base_z + .28, .6), (base_z + .33, 2.6), (base_z + .44, 3.1),
                                         (base_z + .46, 2.8)], 'sc-bronze', 20)
    flame(d, name + '-flame', cx, cy, base_z + .44, 2.4, phase)
    return (cx, cy)


def winged_statue(d, name, rect):
    """Guardian figure with folded wings on a pedestal (original, simplified)."""
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 3.0
    fx.box(d, name + '-pedestal', cx, cy, 4.2, 4.2, 0, .55, 'sc-marble-shade', .012)
    fx.lathe(d, name + '-robe', cx, cy, [(.55, 3.0), (1.05, 2.6), (1.55, 1.7), (1.75, 1.2)], 'sc-marble', 20)
    fx.ball(d, name + '-head', cx, cy, 1.95, 1.5, 'sc-marble')
    for sign in (-1, 1):
        wing = [(0, 1.0), (2.2 * sign, 1.25), (4.6 * sign, 1.95), (3.4 * sign, 1.55), (1.6 * sign, 1.30)]
        wing = [(s, z) for s, z in wing] + [(0, 1.6)]
        pts = [(s, z) for s, z in wing]
        if sign < 0:
            pts = pts[::-1]
        vertical_slab(d, f'{name}-wing-{"l" if sign < 0 else "r"}', cx + sign * .6, cy - .4, 'V', pts, .9, 'sc-marble')
    return (cx, cy)


def shrine_object(d, record, rect, footprint, phase, phases, contract_object, cell_id):
    seq = record['sequenceId']
    name = f"shrine-{record['order']:02d}"
    if seq in (2, 3):
        return 'brazier', brazier(d, name + '-brazier', rect, phase)
    if seq == 0:
        return 'marble-column', column(d, name + '-column', rect, footprint)
    return 'winged-statue', winged_statue(d, name + '-statue', rect)


# --------------------------------------------------------------------------- cemetery (cm14)

PATH_CONTROL = [(10, 74), (40, 64), (78, 70), (112, 60), (150, 62), (178, 82), (194, 112), (198, 150),
                (192, 186)]


def cemetery_core(d, footprint):
    path = smooth_path(PATH_CONTROL, 8)
    clipped_prism(d, 'cemetery-path', ribbon(path, 15.0), footprint, 0, .012, 'sc-cobble', 1.2)
    clipped_prism(d, 'cemetery-path-edge', ribbon(path, 17.5), footprint, 0, .006, 'sc-stone-light', 1.2)
    for i, (x, y, r) in enumerate(((30, 96, 5.5), (126, 40, 6.5), (60, 40, 4.5), (214, 172, 5.0),
                                   (160, 30, 4.0))):
        fx.lathe(d, f'cemetery-moss-{i}', x, y, [(0, r), (.03, r * .8)], 'sc-moss', 14)
    for i, (x, y) in enumerate(((52, 92), (98, 86), (148, 92), (184, 54), (226, 140))):
        for k in range(4):
            angle = k * 1.6 + i
            fx.pipe(d, f'cemetery-grass-{i}-{k}', [(x, y, 0), (x + math.cos(angle) * 1.2, y - 1.0, .22)], .025,
                    'sc-moss')
        fx.ball(d, f'cemetery-pebble-{i}', x + 2.5, y + .8, .05, .9, 'sc-stone-light')
    return ['winding-cobble-path', 'mixed-grave-markers', 'dead-tree', 'iron-gate-in-low-wall']


def grave_marker(d, name, rect, kind):
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 3.0
    fx.box(d, name + '-base', cx, cy, 3.8, 2.2, 0, .14, 'sc-stone', .010)
    if kind == 'cross':
        profile = [(-.7, .14), (.7, .14), (.7, 1.0), (1.9, 1.0), (1.9, 1.24), (.7, 1.24), (.7, 1.62),
                   (-.7, 1.62), (-.7, 1.24), (-1.9, 1.24), (-1.9, 1.0), (-.7, 1.0)]
    elif kind == 'obelisk':
        profile = [(-1.6, .14), (1.6, .14), (1.2, 1.55), (0, 1.85), (-1.2, 1.55)]
    elif kind == 'tablet':
        profile = [(-2.6, .14), (2.6, .14), (2.6, .90), (2.0, 1.02), (-2.0, 1.02), (-2.6, .90)]
    else:
        profile = [(s, z + .14) for s, z in arch_profile(5.0, 1.30)]
    vertical_slab(d, name + '-stone', cx, cy, 'U', profile, 1.6, 'sc-stone-light')
    fx.box(d, name + '-moss', cx - 1.2 * U[0], cy - 1.2 * U[1], 1.6, .9, .14, .17, 'sc-moss', 0)
    return (cx, cy)


def hooded_statue(d, name, rect):
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 3.0
    fx.box(d, name + '-plinth', cx, cy, 3.6, 3.6, 0, .32, 'sc-stone', .012)
    fx.lathe(d, name + '-robe', cx, cy, [(.32, 2.8), (.9, 2.4), (1.5, 1.6), (1.7, 1.3)], 'sc-stone-light', 20)
    fx.lathe(d, name + '-hood', cx, cy, [(1.65, 1.5), (1.95, 1.6), (2.15, 1.1), (2.25, .4)], 'sc-stone-light', 20)
    fx.ball(d, name + '-face-shadow', cx, cy + .6, 1.90, .9, 'sc-iron')
    return (cx, cy)


def dead_tree(d, name, rect):
    x, y, w, h = rect
    cx, cy = x + w * .45, y + h - 3.5
    top = min(2.4, (h - 7.0) / fx.lift(d, 1))
    fx.pipe(d, name + '-trunk', [(cx, cy, 0), (cx + .8, cy - .3, top * .45), (cx - .4, cy - .8, top * .78)],
            .30, 'sc-dead-wood')
    branches = [((cx - .4, cy - .8, top * .78), (cx - 7.0, cy - 2.5, top * .98), .12),
                ((cx + .5, cy - .5, top * .62), (cx + 8.0, cy - 1.0, top * .90), .11),
                ((cx - .3, cy - .9, top * .80), (cx + 2.5, cy - 4.0, top), .10),
                ((cx - 4.0, cy - 1.8, top * .90), (cx - 9.5, cy - .5, top * .74), .06),
                ((cx + 5.0, cy - .8, top * .84), (cx + 10.0, cy - 3.0, top * .96), .06)]
    for i, (a, b, r) in enumerate(branches):
        mid = ((a[0] + b[0]) / 2 + .8, (a[1] + b[1]) / 2 - .4, (a[2] + b[2]) / 2 + .05)
        fx.pipe(d, f'{name}-branch-{i}', [a, mid, b], r, 'sc-dead-wood')
    return (cx, cy)


def lantern_post(d, name, rect, phase=0):
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 2.5
    top = min(1.9, (h - 6.0) / fx.lift(d, 1))
    fx.box(d, name + '-foot', cx, cy, 1.4, 1.4, 0, .10, 'sc-stone', .006)
    fx.pipe(d, name + '-post', [(cx, cy, .10), (cx, cy, top * .78), (cx + 1.4, cy - .7, top * .86)], .07, 'sc-iron')
    fx.box(d, name + '-lantern', cx + 1.4, cy - .7, .9, .9, top * .62, top * .84, 'sc-iron', .004)
    fx.ball(d, name + '-glow', cx + 1.4, cy - .7, top * .73, 1.0, 'sc-lantern')
    return (cx, cy)


def roots(d, name, rect):
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 2.0
    for i, (dx, dy) in enumerate(((-9, 1.5), (-5, 2.5), (6, 2.0), (10, .5), (1, 3.0))):
        fx.pipe(d, f'{name}-root-{i}', [(cx, cy - 1.0, .05), (cx + dx * .6, cy + dy * .5, .08), (cx + dx, cy + dy * .7, .02)],
                .09, 'sc-dead-wood')
    return (cx, cy)


def low_wall(d, name, rect, posts=True):
    x, y, w, h = rect
    span = min(w / 2 - 2.0, 13.0)
    cx, cy = x + w / 2, y + h - 3.0 - span * .5
    fx.box(d, name + '-footing', cx, cy, span, 1.6, 0, .18, 'sc-stone', .010)
    fx.box(d, name + '-wall', cx, cy, span, 1.2, .18, .62, 'sc-stone-light', .012)
    fx.box(d, name + '-coping', cx, cy, span * 1.02, 1.5, .62, .70, 'sc-stone', .010)
    if posts:
        for sign in (-1, 1):
            px, py = cx + sign * span * U[0], cy + sign * span * U[1]
            fx.box(d, f'{name}-post-{sign}', px, py, 1.6, 1.6, 0, .98, 'sc-stone', .012)
            fx.ball(d, f'{name}-finial-{sign}', px, py, 1.10, 1.1, 'sc-stone-light')
    return (cx, cy)


def gate_leaf(d, name, rect, phase, phases):
    """Wrought-iron gate leaf hinged on a post; swings between two rests."""
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 3.0
    swing = (0.0, .55, 1.0)[min(phase, 2)] if phases > 1 else 0.0
    hinge = (cx - 4.0 * U[0], cy - 4.0 * U[1])
    fx.box(d, name + '-hinge-post', hinge[0], hinge[1], 1.0, 1.0, 0, 1.45, 'sc-stone', .008)
    angle = swing * .9
    ax = (math.cos(angle) * U[0] + math.sin(angle) * V[0], math.cos(angle) * U[1] + math.sin(angle) * V[1])
    bars = 5
    for i in range(bars + 1):
        s = .8 + i * 1.5
        px, py = hinge[0] + ax[0] * s, hinge[1] + ax[1] * s
        fx.pipe(d, f'{name}-bar-{i}', [(px, py, .08), (px, py, 1.18)], .03, 'sc-iron')
        fx.lathe(d, f'{name}-spear-{i}', px, py, [(1.18, .35), (1.36, .02)], 'sc-iron', 6)
    end = (hinge[0] + ax[0] * (.8 + bars * 1.5), hinge[1] + ax[1] * (.8 + bars * 1.5))
    for k, z in enumerate((.20, .78, 1.10)):
        fx.pipe(d, f'{name}-rail-{k}', [(hinge[0] + ax[0] * .8, hinge[1] + ax[1] * .8, z), (end[0], end[1], z)],
                .035, 'sc-iron')
    return hinge


def cemetery_object(d, record, rect, footprint, phase, phases, contract_object, cell_id):
    seq = record['sequenceId']
    name = f"cemetery-{record['order']:02d}"
    kinds = {8: 'arch', 9: 'cross', 10: 'obelisk', 11: 'tablet'}
    if seq in kinds:
        return 'grave-marker', grave_marker(d, name + '-grave', rect, kinds[seq])
    if seq == 3:
        return 'hooded-statue', hooded_statue(d, name + '-statue', rect)
    if seq in (0, 1):
        return 'low-wall', low_wall(d, name + '-wall', rect)
    if seq == 4:
        return 'gate-leaf', gate_leaf(d, name + '-gate', rect, phase, phases)
    if seq == 5:
        return 'dead-tree', dead_tree(d, name + '-tree', rect)
    if seq == 6:
        return 'lantern-post', lantern_post(d, name + '-lantern', rect)
    return 'tree-roots', roots(d, name + '-roots', rect)


# --------------------------------------------------------------------------- temple (cm24)

def temple_core(d, footprint):
    """Altar platform under the statue, offering box, cushion and incense."""
    fx.box(d, 'temple-altar', 48, 44, 13.0, 5.5, 0, .30, 'sc-wood-dark', .012)
    fx.box(d, 'temple-altar-top', 48, 44, 13.4, 5.9, .30, .36, 'sc-wood', .008)
    fx.face_panel(d, 'temple-altar-band', 48, 44, 13.0, 5.5, .10, .24, 'sc-gold', 'front-left', .08, .5)
    fx.box(d, 'temple-offering-box', 48, 72, 5.0, 3.0, 0, .55, 'sc-wood', .012)
    for k in range(5):
        t = -1 + (2 * k + 1) / 5
        fx.box(d, f'temple-offering-slat-{k}', 48 + t * 4.2 * U[0], 72 + t * 4.2 * U[1], .35, 2.6, .55, .60,
               'sc-wood-dark', 0)
    fx.lathe(d, 'temple-incense-burner', 48, 60, [(0, 1.8), (.16, 2.4), (.34, 2.2), (.38, 1.6)], 'sc-bronze', 18)
    for k in range(3):
        fx.pipe(d, f'temple-incense-stick-{k}', [(47 + k, 60, .30), (47 + k + .2, 60 - .4, .62)], .015, 'sc-incense')
    fx.lathe(d, 'temple-cushion', 48, 86, [(0, 4.2), (.10, 4.6), (.18, 4.0), (.20, 1.0)], 'sc-cushion', 24)
    return ['seated-statue-on-altar', 'red-lacquer-pillars', 'candle-stands', 'timber-floor']


def seated_statue(d, name, rect):
    """Original seated sage in dark stone on a lotus pedestal, with a halo."""
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 3.0
    fx.lathe(d, name + '-pedestal', cx, cy, [(0, 7.0), (.20, 7.2), (.36, 6.0), (.50, 6.8), (.58, 6.2)],
             'sc-gold', 28)
    fx.lathe(d, name + '-lap', cx, cy, [(.58, 6.2), (.80, 6.4), (1.00, 5.4), (1.06, 3.8)], 'sc-statue', 28)
    fx.lathe(d, name + '-torso', cx, cy - 1.0, [(1.0, 4.0), (1.55, 3.8), (2.05, 3.0), (2.25, 1.6)], 'sc-statue', 24)
    fx.ball(d, name + '-head', cx, cy - 1.2, 2.62, 2.3, 'sc-statue-hi')
    fx.lathe(d, name + '-crown', cx, cy - 1.2, [(2.86, 1.2), (3.02, .9), (3.10, .2)], 'sc-statue', 16)
    ring = [(s, z) for s, z in arch_profile(10.0, 1.6, .55)]
    vertical_slab(d, name + '-halo', cx, cy - 3.6, 'X', [(s, z + 1.55) for s, z in ring], .5, 'sc-gold')
    fx.box(d, name + '-hands', cx, cy + .6, 1.4, .8, 1.32, 1.52, 'sc-statue-hi', .010)
    return (cx, cy)


def red_pillar(d, name, rect, footprint):
    x, y, w, h = rect
    r = min(w / 2 - 1.5, 6.0)
    cx, cy = x + w / 2, y + h - 1.5 - r / 2
    room = min(headroom(footprint, cx - r, cx + r, cy), cy - (y + 1.0)) - r / 2 - .6
    zt = max(1.4, min(3.2, room / fx.lift(d, 1)))
    fx.lathe(d, name + '-base', cx, cy, [(0, r * 1.05), (.18, r * 1.05), (.26, r * .86)], 'sc-statue', 24)
    fx.cylinder(d, name + '-shaft', cx, cy, r * .80, .26, zt - .2, 'sc-lacquer', 24)
    for k, z in enumerate((.50, zt - .55)):
        fx.cylinder(d, f'{name}-band-{k}', cx, cy, r * .84, z, z + .10, 'sc-gold', 24)
    fx.box(d, name + '-bracket', cx, cy, r * .52, r * .52, zt - .2, zt, 'sc-lacquer-dark', .010)
    return (cx, cy)


def candle_stand(d, name, rect, phase):
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 2.5
    top = min(1.55, (h - 7.0) / fx.lift(d, 1))
    fx.lathe(d, name + '-foot', cx, cy, [(0, 2.4), (.06, 2.4), (.12, .8)], 'sc-iron', 16)
    fx.cylinder(d, name + '-stem', cx, cy, .35, .12, top * .70, 'sc-iron', 10)
    fx.lathe(d, name + '-dish', cx, cy, [(top * .70, .6), (top * .74, 2.0), (top * .78, 2.0)], 'sc-iron', 16)
    fx.cylinder(d, name + '-candle', cx, cy, .9, top * .78, top * .96, 'sc-wax', 12)
    flame(d, name + '-flame', cx, cy, top * .96, 2.4, phase)
    return (cx, cy)


def temple_object(d, record, rect, footprint, phase, phases, contract_object, cell_id):
    seq = record['sequenceId']
    name = f"temple-{record['order']:02d}"
    if seq == 1:
        return 'seated-statue', seated_statue(d, name + '-statue', rect)
    if seq == 0:
        return 'candle-stand', candle_stand(d, name + '-candle', rect, phase)
    return 'red-pillar', red_pillar(d, name + '-pillar', rect, footprint)


# --------------------------------------------------------------------------- entry point

CORES = {'field_cm13_01': shrine_core, 'field_cm14_01': cemetery_core, 'field_cm24_01': temple_core}
OBJECTS = {'field_cm13_01': shrine_object, 'field_cm14_01': cemetery_object, 'field_cm24_01': temple_object}


def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_SACRED_FIELD:' + field_id)
    footprint = d.field_footprint(d.ROOT, field)
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = CORES[field_id](d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        decision = containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        role, anchor = OBJECTS[field_id](d, record, decision['window'], footprint, phase, phases,
                                         contract[record['order']], cell_id)
        containment.register_anchor(field_id, record['order'], anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = record['order']
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = record['sequenceId']
            obj['sourceCellId'] = cell_id
            obj['objectRole'] = role
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': record['sequenceId'], 'role': role,
                        'anchorNative': record['placement'], 'phase': phase, 'phases': phases})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
