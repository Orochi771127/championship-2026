"""Original pasture family for the opus round: zoo (cm25), ranch (cm26), forest (cm11).

Batch E made these cages fit by shrinking their props; this round redesigns
them instead, following the walkable tiles of the product's raising-ground
catalog (tall scenery only on blocked tiles).

* cm25 zoo: a stone-paved animal enclosure.  Black iron bar fencing along the
  back edges (the source objects: panels and corner posts, each built inside
  its own window) and along the front (core, on the blocked front band, with
  a plain plaque).  A stone-rimmed pool whose rippling water surface is the
  three-frame source object, a pile of pale boulders, log feeding posts, hay.
* cm26 ranch: a green pasture with a red-roofed barn, a silo and a water
  trough on the blocked farmyard tiles, hay and dirt patches, rustic rail
  fences along the front (source objects) and swaying flower clumps.
* cm11 forest: broadleaf trees (source objects) fitted into their windows,
  round bushes at the front, a mossy floor with a worn path where residents
  walk, and a dense thicket and more trees on the blocked tiles.

Research rasters were viewed locally only; nothing is loaded or traced.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_remaining_authoring as kit
from . import cage_opus_highland_authoring as hl
from . import cage_opus_garden_authoring as gd


FIELDS = ('field_cm11_01', 'field_cm25_01', 'field_cm26_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm11_01': 'pa-ground-11', 'field_cm25_01': 'pa-ground-25', 'field_cm26_01': 'pa-ground-26'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones',
                'cage_opus_highland_authoring', 'cage_opus_garden_authoring')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
STUDS = []
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35
NATIVE = {'field_cm11_01': (240, 200), 'field_cm25_01': (192, 112), 'field_cm26_01': (240, 200)}

PALETTE = {
    'pa-iron': ((.07, .07, .08), .40, .60, 0),
    'pa-plaque': ((.86, .82, .70), .60, .0, 0),
    'pa-plaque-ink': ((.18, .14, .10), .70, .0, 0),
    'pa-rock-pale': ((.80, .79, .74), .80, .0, 0),
    'pa-rock-pale-dark': ((.62, .61, .57), .82, .0, 0),
    'pa-bark': ((.36, .24, .13), .85, .0, 0),
    'pa-log-end': ((.80, .62, .36), .70, .0, 0),
    'pa-log-ring': ((.55, .38, .20), .75, .0, 0),
    'pa-hay': ((.86, .70, .30), .85, .0, 0),
    'pa-hay-dark': ((.66, .50, .20), .85, .0, 0),
    'pa-stone-rim': ((.56, .56, .54), .82, .0, 0),
    'pa-water-bed': ((.05, .16, .18), .30, .0, 0),
    'pa-water': ((.08, .30, .34), .08, .0, .25),
    'pa-ripple': ((.55, .80, .82), .20, .0, .60),
    'pa-wall': ((.92, .88, .80), .75, .0, 0),
    'pa-timber': ((.36, .22, .12), .80, .0, 0),
    'pa-roof': ((.78, .20, .10), .65, .0, 0),
    'pa-roof-edge': ((.55, .12, .06), .70, .0, 0),
    'pa-door': ((.30, .18, .10), .80, .0, 0),
    'pa-window': ((.20, .30, .38), .30, .0, .20),
    'pa-silo': ((.82, .80, .74), .55, .25, 0),
    'pa-silo-band': ((.50, .52, .54), .40, .50, 0),
    'pa-trough': ((.20, .42, .72), .45, .20, 0),
    'pa-trough-water': ((.30, .62, .80), .10, .0, .20),
    'pa-leaf': ((.14, .38, .10), .75, .0, 0),
    'pa-leaf-light': ((.24, .50, .14), .75, .0, 0),
    'pa-leaf-dark': ((.08, .26, .07), .78, .0, 0),
    'pa-fern': ((.16, .42, .12), .65, .0, 0),
}


# --------------------------------------------------------------------------- tiles and grounds

def tiles(field_id):
    import json
    spec = json.loads((gz.WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
    data = json.loads((gz.ROOT / 'src/data/championship/catalogs/raising-ground.r1.json').read_text(encoding='utf8'))
    entry = next(f for f in data['fields'] if f['definitionIndex'] == spec['definitionIndex'])
    cells = [value for count, *value in entry['runs'] for _ in range(count)]
    width = entry['width']
    return {(i % width, i // width): (kind if owner == 1 else None) for i, (owner, kind, _) in enumerate(cells)}


def walk_values(field_id):
    kinds = tiles(field_id)
    w, h = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
    return {(tx, ty): (1.0 if kinds.get((tx, ty)) is not None else 0.0) for tx in range(w) for ty in range(h)}


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in {**PALETTE, **gd.PALETTE}.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'pa-ground-25' not in d.M:
        flags = hl._slab_material(d, 'pa-flagstone', (.56, .55, .52), (.42, .41, .39), (.26, .25, .24), 1.9, .03)
        gravel = kit._noise_mix(d, 'pa-gravel', (.36, .35, .33), (.44, .43, .40), 3.4, .50, .2,
                                spots=((.58, .57, .54), 7.0, .06))
        gz.zone_ground(d, 'pa-ground-25', 'field_cm25_01', NATIVE['field_cm25_01'], walk_values('field_cm25_01'),
                       [(gravel, 0, 0), (flags, .45, .58)], .2)
    if 'pa-ground-26' not in d.M:
        pasture = kit._noise_mix(d, 'pa-pasture', (.15, .42, .07), (.21, .50, .09), 2.0, .50, .18,
                                 spots=((.95, .92, .40), 9.0, .03))
        yard = kit._noise_mix(d, 'pa-yard', (.09, .29, .06), (.13, .35, .07), 2.0, .50, .16,
                              spots=((.30, .26, .12), 5.0, .05))
        gz.zone_ground(d, 'pa-ground-26', 'field_cm26_01', NATIVE['field_cm26_01'], walk_values('field_cm26_01'),
                       [(yard, 0, 0), (pasture, .38, .62)], .3)
    if 'pa-ground-11' not in d.M:
        path = kit._noise_mix(d, 'pa-forest-path', (.30, .36, .14), (.40, .34, .18), 1.8, .50, .16,
                              spots=((.36, .26, .12), 4.0, .08))
        moss = kit._noise_mix(d, 'pa-forest-floor', (.07, .20, .06), (.12, .28, .08), 1.6, .50, .14,
                              spots=((.26, .18, .08), 3.4, .09))
        gz.zone_ground(d, 'pa-ground-11', 'field_cm11_01', NATIVE['field_cm11_01'], walk_values('field_cm11_01'),
                       [(moss, 0, 0), (path, .45, .62)], .3)


# --------------------------------------------------------------------------- shared helpers

def depth(points, footprint):
    return containment._union_depth(points, footprint)


def inside(points, footprint, window, margin=DESIGN_MARGIN):
    return kit.inside(points, footprint, window, margin)


def scr(d, x, y, z):
    return (x, y - fx.lift(d, z))


def boundary_y(footprint, x, top=True):
    """Screen y of the field's outer boundary straight above (top) or below a column x."""
    import numpy as np
    ys = np.linspace(-20, 220, 961)
    pts = np.stack([np.full_like(ys, x), ys], axis=1)
    inside_mask = depth(pts, footprint) > 0
    if not inside_mask.any():
        return None
    idx = np.nonzero(inside_mask)[0]
    return float(ys[idx[0]] if top else ys[idx[-1]])


def bar_run(d, name, footprint, x0, x1, base, height, window=None, spacing=2.4, post_every=0):
    """Iron bars on a base line ``base(x)``: two rails and vertical bars; optional posts."""
    xs = []
    n = max(2, int((x1 - x0) / spacing))
    for i in range(n + 1):
        xs.append(x0 + (x1 - x0) * i / n)
    for k, z in enumerate((.10, height - .06)):
        pts = [(x, base(x), z) for x in xs]
        fx.pipe(d, f'{name}-rail-{k}', pts, .03, 'pa-iron')
    for i, x in enumerate(xs):
        fx.pipe(d, f'{name}-bar-{i}', [(x, base(x), .0), (x, base(x), height + .06)], .016, 'pa-iron')
        fx.ball(d, f'{name}-tip-{i}', x, base(x), height + .1, .45, 'pa-iron')
    if post_every:
        for i, x in enumerate(xs[::post_every]):
            fx.box(d, f'{name}-post-{i}', x, base(x), .9, .9, 0, height + .18, 'pa-iron', .006)


def fitted_height(d, footprint, window, xs, base, tallest, margin=DESIGN_MARGIN):
    height = tallest
    while height > .25:
        pts = []
        for x in xs:
            pts += [(x - .8, base(x) + .5), (x + .8, base(x) + .5), scr(d, x, base(x), height + .2)]
        if (window and inside(pts, footprint, window, margin)) or (not window and kit.core_inside(pts, footprint, margin)):
            return height
        height -= .04
    raise ValueError(f'BARS_DO_NOT_FIT:{window}')


# --------------------------------------------------------------------------- cm25 zoo

POOL = (65.0, 61.0)


def zoo_core(d, footprint):
    fid = footprint['fieldId']
    # Pool basin: stone rim and dark bed; the water surface is the animated object.
    px, py = POOL
    fx.lathe(d, 'zoo-pool-rim', px, py, [(0, 27.5), (.16, 27.0), (.20, 25.6), (.14, 24.4), (.02, 24.0)], 'pa-stone-rim', 48)
    fx.lathe(d, 'zoo-pool-bed', px, py, [(.012, 24.2), (.014, 2.0)], 'pa-water-bed', 48)
    # Front iron fence on the blocked front band, with a plain plaque in the middle.
    lower = lambda x: (boundary_y(footprint, x, top=False) or 100.0) - 6.5
    for k, (x0, x1) in enumerate(((3.0, 45.0), (51.0, 93.0), (99.0, 141.0), (147.0, 189.0))):
        xs = [x0 + (x1 - x0) * i / 8 for i in range(9)]
        height = fitted_height(d, footprint, None, xs, lower, 1.0)
        bar_run(d, f'zoo-front-fence-{k}', footprint, x0, x1, lower, height, post_every=8)
    pxm, pym = 96.0, lower(96.0) - 1.0
    fx.box(d, 'zoo-plaque-post', pxm, pym, .5, .5, 0, .62, 'pa-iron', .004)
    fx.face_panel(d, 'zoo-plaque', pxm, pym, 3.2, .6, .58, 1.0, 'pa-plaque', 'front-left', .0, .35)
    for k, (dx, dz) in enumerate(((-1.0, .74), (0.0, .80), (1.0, .74))):
        fx.ball(d, f'zoo-plaque-paw-{k}', pxm + dx, pym + .9, dz + .02, .35, 'pa-plaque-ink')
    fx.ball(d, 'zoo-plaque-paw-pad', pxm, pym + .9, .66, .55, 'pa-plaque-ink')
    # Hay on the paving; log feeding posts on blocked tiles.
    for k, (hx, hy, r) in enumerate(((44.0, 38.0, 6.0), (150.0, 74.0, 7.0))):
        fx.lathe(d, f'zoo-hay-{k}', hx, hy, [(0, r), (.18, r * .85), (.32, r * .45), (.36, .2)], 'pa-hay', 18)
        for j in range(7):
            a = j * math.tau / 7 + k
            fx.pipe(d, f'zoo-hay-straw-{k}-{j}', [(hx + math.cos(a) * r * .5, hy + .5 * math.sin(a) * r * .5, .25),
                                                  (hx + math.cos(a) * r * 1.05, hy + .5 * math.sin(a) * r * 1.05, .04)],
                    .02, 'pa-hay-dark')
    for k, (lx, ly) in enumerate(((14.0, 76.0), (180.0, 70.0))):
        if kit.core_inside([(lx - 4, ly), (lx + 4, ly), (lx, ly - fx.lift(d, 1.1))], footprint, 1.4):
            log_cluster(d, f'zoo-logs-{k}', lx, ly, ((0, 0, 3.0, 1.0), (4.2, -1.0, 2.4, .7)))
    return ['stone-paved-enclosure', 'iron-bar-fencing', 'rippling-pool', 'pale-boulder-pile', 'log-feeding-posts',
            'hay', 'plain-plaque']


def log_cluster(d, name, cx, cy, logs):
    for k, (dx, dy, r, h) in enumerate(logs):
        x, y = cx + dx, cy + dy
        fx.cylinder(d, f'{name}-bark-{k}', x, y, r, 0, h, 'pa-bark', 16)
        fx.cylinder(d, f'{name}-end-{k}', x, y, r * .92, h, h + .02, 'pa-log-end', 16)
        kit.ring(d, f'{name}-ring-{k}', x, y, r * .55, h + .025, .015, 'pa-log-ring', 16)


def zoo_back_fence(d, name, record, footprint):
    """One window of the back fence: a bar panel or a corner/end post on an inset base line."""
    window = containment.source_window(record)
    x, y, w, h = window
    top = lambda xx: boundary_y(footprint, xx, top=True)
    base = lambda xx: min((top(xx) or 0.0) + 10.0, y + h - 2.2)
    if record['sequenceId'] in (2, 4):
        x0, x1 = x + 1.6, x + w - 1.6
        xs = [x0 + (x1 - x0) * i / 10 for i in range(11)]
        height = fitted_height(d, footprint, window, xs, base, .95)
        bar_run(d, name + '-panel', footprint, x0, x1, base, height)
        return (x + w / 2, base(x + w / 2))
    cx = x + w / 2
    by = base(cx)
    for tall in [1.2 - .05 * i for i in range(19)]:
        pts = [(cx - 1.2, by + .6), (cx + 1.2, by + .6), scr(d, cx, by, tall + .2)]
        if inside(pts, footprint, window):
            fx.box(d, name + '-post', cx, by, .95, .95, 0, tall, 'pa-iron', .006)
            fx.lathe(d, name + '-finial', cx, by, [(tall, .9), (tall + .12, .3)], 'pa-iron', 8)
            return (cx, by)
    # The window barely touches the field: one small iron stud at its deepest legal point.
    point, best = hl.deepest_point(window, footprint, .7) if hasattr(hl, 'deepest_point') else (None, 0)
    if point is None:
        import numpy as np
        xs = np.linspace(x + .8, x + w - .8, 33)
        ys = np.linspace(y + .8, y + h - .8, 33)
        grid = np.array([(a, b) for a in xs for b in ys])
        values = depth(grid, footprint)
        i = int(values.argmax())
        point, best = (float(grid[i][0]), float(grid[i][1])), float(values[i])
    r = max(.3, min(.8, best - 1.2))
    STUDS.append({'fieldId': footprint['fieldId'], 'ordinal': record['order'], 'window': list(window),
                  'deepestInsideNativePx': round(best, 3), 'reason': 'SOURCE_WINDOW_MOSTLY_OUTSIDE_FIELD',
                  'resolution': 'one small iron stud at the deepest legal point'})
    fx.ball(d, name + '-stud', point[0], point[1] + fx.lift(d, .05), .05, r, 'pa-iron')
    return point


def zoo_rock_pile(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    for scale in [1 - .05 * i for i in range(14)]:
        rocks = []
        for k, (dx, dy, r, hz, z0) in enumerate(((-12, 2, 7.5, .8, 0), (0, 4, 8.5, .9, 0), (12, 2, 7.0, .75, 0),
                                                 (-6, -2, 6.5, .7, .55), (6, -2, 6.5, .7, .55), (0, -4, 5.5, .6, 1.05))):
            cx, cy = x + w / 2 + dx * scale, y + h - 6 + dy * scale
            rocks.append((cx, cy, r * scale, hz * scale, z0 * scale))
        pts = []
        for cx, cy, r, hz, z0 in rocks:
            for a in [i * math.tau / 12 for i in range(12)]:
                for t in (0, 1):
                    pts.append((cx + r * math.cos(a), cy + .5 * r * math.sin(a) - fx.lift(d, z0 + t * hz)))
        if inside(pts, footprint, window):
            break
    for k, (cx, cy, r, hz, z0) in enumerate(rocks):
        obj = kit.rock_mesh(d, f'{name}-boulder-{k}', cx, cy, r, hz, 'pa-rock-pale' if k % 2 else 'pa-rock-pale-dark', k)
        obj.location.z += z0
    return (x + w / 2, y + h - 6)


def zoo_logs(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    for scale in [1 - .05 * i for i in range(16)]:
        logs = ((0, 0, 3.4 * scale, 1.3 * scale), (5.5 * scale, 1.5 * scale, 2.8 * scale, .85 * scale),
                (-4.5 * scale, 2.0 * scale, 2.4 * scale, .6 * scale))
        for cx in [x + w / 2 + o for o in (0, -2, 2, -4, 4)]:
            cy = y + h - 4.5
            pts = []
            for dx, dy, r, hh in logs:
                pts += [(cx + dx - r, cy + dy), (cx + dx + r, cy + dy), (cx + dx, cy + dy + r / 2),
                        scr(d, cx + dx, cy + dy - r / 2, hh + .03)]
            if inside(pts, footprint, window):
                log_cluster(d, name, cx, cy, logs)
                return (cx, cy)
    raise ValueError(f'LOGS_DO_NOT_FIT:{window}')


def zoo_pool_water(d, name, record, footprint, phase):
    """The pool's water surface; three poses of expanding ripples."""
    px, py = POOL
    fx.lathe(d, name + '-surface', px, py, [(.10, 21.8), (.105, 1.0)], 'pa-water', 48)
    for k in range(3):
        r = (4.0 + 6.0 * ((k + phase / 3.0) % 3)) * 1.0
        if r < 20.5:
            kit.ring(d, f'{name}-ripple-{k}', px - 4, py + 1, r, .115, .03, 'pa-ripple', 32)
    kit.ring(d, name + '-glint', px + 6 + 2 * phase, py - 3, 2.0, .118, .04, 'pa-ripple', 12)
    return (px, py)


# --------------------------------------------------------------------------- cm26 ranch

def ranch_core(d, footprint):
    fid = footprint['fieldId']
    # Bare farmyard around the barn and silo (the only dirt on the blocked tiles).
    yard = [(150.0, 52.0), (176.0, 40.0), (226.0, 52.0), (232.0, 86.0), (204.0, 96.0), (152.0, 84.0)]
    for i, piece in enumerate(fit.clip_to_footprint(yard, footprint, 2.0, .01)):
        fx.prism(d, f'ranch-yard-{i}', piece, .002, .006, 'gd-path', 0)
    # Barn: plastered walls with timber framing, red gable roof, doors and windows.
    cx, cy, a, b = 184.0, 64.0, 12.0, 8.0
    wall = 1.25
    fx.box(d, 'ranch-barn-walls', cx, cy, a, b, 0, wall, 'pa-wall', .010)
    for s in (-1, 1):
        fx.face_panel(d, f'ranch-barn-frame-{s}', cx + s * a * .5 * U[0], cy + s * a * .5 * U[1], .25, b, .0, wall,
                      'pa-timber', 'front-left', .0, .3)
    fx.face_panel(d, 'ranch-barn-door', cx, cy, 3.0, b, .0, wall * .8, 'pa-door', 'front-left', .0, .35)
    fx.face_panel(d, 'ranch-barn-window', cx + 2.0 * V[0], cy + 2.0 * V[1], 1.4, a, wall * .45, wall * .75, 'pa-window',
                  'front-right', .0, .35)
    ridge = 1.05
    for s in (-1, 1):
        eave_a = (cx - (a + .8) * U[0] + s * (b + .8) * V[0], cy - (a + .8) * U[1] + s * (b + .8) * V[1])
        eave_b = (cx + (a + .8) * U[0] + s * (b + .8) * V[0], cy + (a + .8) * U[1] + s * (b + .8) * V[1])
        ridge_a = (cx - (a + .8) * U[0], cy - (a + .8) * U[1])
        ridge_b = (cx + (a + .8) * U[0], cy + (a + .8) * U[1])
        verts = [d.world(eave_a[0], eave_a[1], wall), d.world(eave_b[0], eave_b[1], wall),
                 d.world(ridge_b[0], ridge_b[1], wall + ridge), d.world(ridge_a[0], ridge_a[1], wall + ridge)]
        fx._object(d, f'ranch-barn-roof-{s}', verts, [(0, 1, 2, 3)], 'pa-roof', 0.0, ())
    for s in (-1, 1):
        end = (cx + s * a * U[0], cy + s * a * U[1])
        tri = [d.world(end[0] - b * V[0], end[1] - b * V[1], wall), d.world(end[0] + b * V[0], end[1] + b * V[1], wall),
               d.world(end[0], end[1], wall + ridge)]
        fx._object(d, f'ranch-barn-gable-{s}', tri, [(0, 1, 2)], 'pa-wall', 0.0, ())
    fx.pipe(d, 'ranch-barn-ridge', [(cx - (a + .8) * U[0], cy - (a + .8) * U[1], wall + ridge + .02),
                                    (cx + (a + .8) * U[0], cy + (a + .8) * U[1], wall + ridge + .02)], .05, 'pa-roof-edge')
    # Silo beside the barn, a water trough and hay bales on the yard.
    sx, sy = 216.0, 76.0
    room = kit.headroom(footprint, sx - 6, sx + 6, sy) - 6.0
    sz = max(1.6, min(3.2, room / fx.lift(d, 1)))
    fx.cylinder(d, 'ranch-silo', sx, sy, 5.6, 0, sz, 'pa-silo', 28)
    fx.lathe(d, 'ranch-silo-dome', sx, sy, [(sz, 5.6), (sz + .25, 4.4), (sz + .42, 1.6), (sz + .46, .2)], 'pa-silo-band', 28)
    for z in (sz * .3, sz * .62):
        fx.cylinder(d, f'ranch-silo-band-{z:.2f}', sx, sy, 5.7, z, z + .06, 'pa-silo-band', 28)
    tx, ty = 148.0, 66.0
    fx.box(d, 'ranch-trough', tx, ty, 6.0, 1.6, 0, .32, 'pa-trough', .010)
    fx.box(d, 'ranch-trough-water', tx, ty, 5.4, 1.1, .26, .30, 'pa-trough-water', 0)
    for k, (hx, hy) in enumerate(((132.0, 80.0), (60.0, 120.0), (116.0, 150.0))):
        fx.lathe(d, f'ranch-hay-{k}', hx, hy, [(0, 6.0), (.20, 5.2), (.34, 2.8), (.38, .3)], 'pa-hay', 18)
    for k, (dx, dy, r) in enumerate(((84.0, 100.0, 7.0), (40.0, 140.0, 6.0), (150.0, 118.0, 6.5))):
        patch = [(dx + r * math.cos(t) * (.85 + .15 * math.sin(t * 3)), dy + .5 * r * math.sin(t)) for t in
                 [i * math.tau / 14 for i in range(14)]]
        for i, piece in enumerate(fit.clip_to_footprint(patch, footprint, 2.0, .01)):
            fx.prism(d, f'ranch-dirt-{k}-{i}', piece, .002, .006, 'gd-path', 0)
    return ['green-pasture', 'red-roof-barn', 'silo', 'water-trough', 'hay', 'rail-fences', 'swaying-flowers']


def ranch_fence(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    regions = [(x + 1.5, x + w - 1.5)] if w <= 16 else [(x + 1.5, x + w / 2 - .5), (x + w / 2 + .5, x + w - 1.5)]
    posts = [gd.fit_post(d, footprint, window, region, 1.0, 1.0) for region in regions]
    height = min(hgt for _, hgt in posts)
    for i, ((px, py), _) in enumerate(posts):
        fx.cylinder(d, f'{name}-post-{i}', px, py, 1.0, 0, height, 'gd-post', 10)
        fx.lathe(d, f'{name}-cap-{i}', px, py, [(height, 1.0), (height + .1, .45)], 'gd-post-dark', 10)
    if len(posts) == 2:
        (ax, ay), (bx, by) = posts[0][0], posts[1][0]
        for z in (height * .40, height * .78):
            fx.pipe(d, f'{name}-rail-{z:.2f}', [(ax, ay, z), (bx, by, z)], .045, 'gd-post')
    return posts[0][0]


def ranch_flowers(d, name, record, footprint, phase):
    """Swaying yellow flowers; a window mostly outside the field gets a smaller clump."""
    try:
        return gd.flower_clump(d, name, record, footprint, 'yellow', phase)
    except ValueError:
        pass
    window = containment.source_window(record)
    x, y, w, h = window
    sway = (-.45, .45)[phase % 2]
    best = None
    for fx_ in [x + w - 2.0 - i * .5 for i in range(int(w * 2))]:
        fy = y + h - 3.0
        head = (fx_ + sway, fy, .45)
        sx, sy = scr(d, *head)
        pts = [(fx_ - .8, fy + .5), (fx_ + .8, fy + .5), (sx - 1.2, sy - 1.2), (sx + 1.2, sy + 1.2)]
        if inside(pts, footprint, window):
            best = (fx_, fy, head)
            break
    if best is None:
        raise ValueError(f'FLOWER_WINDOW_HAS_NO_ROOM:{window}')
    fx_, fy, head = best
    fx.pipe(d, name + '-stem', [(fx_, fy, 0.0), head], .018, 'gd-stem')
    for i in range(5):
        a = i * math.tau / 5
        d.sphere(f'{name}-petal-{i}', d.world(head[0] + math.cos(a) * .7, head[1] + .5 * math.sin(a) * .7, head[2]),
                 (.042, .042, .02), 'gd-yellow')
    return (fx_, fy)


# --------------------------------------------------------------------------- cm11 forest

def tree_points(d, base, height, crowns):
    bx, by = base
    pts = [(bx - 2.2, by + 1), (bx + 2.2, by + 1)]
    for dx, dz, r in crowns:
        cx, cz = bx + dx, height + dz
        sx, sy = scr(d, cx, by, cz)
        pts += [(sx + r * math.cos(a), sy + r * .97 * math.sin(a)) for a in [i * math.tau / 12 for i in range(12)]]
    return pts


CROWNS = ((0.0, .0, 10.0), (-7.0, -.25, 7.0), (7.0, -.2, 7.4), (-3.0, .55, 7.2), (4.0, .5, 6.8), (0.0, .95, 5.6))


def broadleaf_tree(d, name, record, footprint, small=False):
    window = containment.source_window(record)
    x, y, w, h = window
    ax, ay = record['placement']
    base0 = (x + w / 2, min(y + h - 3.0, max(ay, y + h * .6)))
    offsets = sorted(((dx, dy) for dx in range(-9, 10, 3) for dy in range(0, -19, -2)), key=lambda o: math.hypot(*o))
    for scale in [1 - .05 * i for i in range(15)]:
        height = (1.2 if small else 2.0) * scale
        crowns = [(dx * scale, dz * scale, r * scale * (.75 if small else 1.0)) for dx, dz, r in CROWNS]
        for dx, dy in offsets:
            base = (base0[0] + dx, base0[1] + dy)
            if inside(tree_points(d, base, height, crowns), footprint, window):
                bx, by = base
                if not small:
                    fx.pipe(d, name + '-trunk', [(bx, by, 0.0), (bx + .3, by, height * .6), (bx + .2, by, height)], .12 * scale,
                            'pa-bark')
                    for k, a in enumerate((.6, 2.4, 4.3)):
                        fx.pipe(d, f'{name}-root-{k}', [(bx, by, .15), (bx + math.cos(a) * 3 * scale,
                                                                       by + .5 * math.sin(a) * 3 * scale, .0)], .06, 'pa-bark')
                for k, (cdx, cdz, r) in enumerate(crowns):
                    d.sphere(f'{name}-crown-{k}', d.world(bx + cdx, by, height + cdz), (r / 16, r / 16, r / 16 * .92),
                             ('pa-leaf', 'pa-leaf-light', 'pa-leaf-dark')[k % 3])
                return (bx, by)
    raise ValueError(f'TREE_DOES_NOT_FIT:{window}')


def forest_core(d, footprint):
    fid = footprint['fieldId']
    kinds = tiles(fid)
    import numpy as np
    k = 0
    for (tx, ty), kind in sorted(kinds.items()):
        px = tx * 8 + 4 + (kit.hash01(tx, ty, 1) - .5) * 3
        py = ty * 8 + 4 + (kit.hash01(tx, ty, 2) - .5) * 3
        r = kit.hash01(tx, ty, 3)
        if kind is not None:
            if r > .22:
                continue
            for f in range(5):
                rows = kit.frond_rows(d, (px, py, .04), f * math.tau / 5 + r * 9, 3.0 + r * 4, .25, .3, 1.1, .02)
                kit.strip(d, f'forest-fern-{k}-{f}', [tuple(d.world(*p) for p in row) for row in rows], 'pa-fern')
            k += 1
            continue
        size = 5.0 + r * 2.5
        hz = .5 + r * .45
        pts = [(px + size * math.cos(a), py + .5 * size * math.sin(a) - s * fx.lift(d, hz)) for a in np.linspace(0, math.tau, 12)
               for s in (0, 1)]
        if not kit.core_inside(pts, footprint, 1.3):
            continue
        d.sphere(f'forest-bush-{k}', d.world(px, py, hz * .5), (size / 16, size / 16, hz * .55),
                 ('pa-leaf', 'pa-leaf-dark', 'pa-leaf-light')[k % 3])
        k += 1
    # More trees standing on the blocked back tiles of the upper hex.
    t = 0
    for (tx, ty), kind in sorted(kinds.items()):
        if kind is not None or ty > 9 or tx < 18 or kit.hash01(tx, ty, 11) > .30:
            continue
        bx, by = tx * 8 + 4, ty * 8 + 6
        for scale in (1.0, .85, .7, .55):
            height = 1.8 * scale
            crowns = [(dx * scale, dz * scale, r * scale * .9) for dx, dz, r in CROWNS[:4]]
            if kit.core_inside(tree_points(d, (bx, by), height, crowns), footprint, 1.4):
                fx.pipe(d, f'forest-back-trunk-{t}', [(bx, by, 0.0), (bx, by, height)], .10 * scale, 'pa-bark')
                for c, (cdx, cdz, r) in enumerate(crowns):
                    d.sphere(f'forest-back-crown-{t}-{c}', d.world(bx + cdx, by, height + cdz), (r / 16, r / 16, r / 16 * .92),
                             ('pa-leaf-dark', 'pa-leaf')[c % 2])
                t += 1
                break
    return ['broadleaf-trees', 'front-bushes', 'mossy-floor-and-path', 'thicket-on-blocked-tiles', 'back-stand-of-trees',
            'ferns']


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_PASTURE_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = {'field_cm25_01': zoo_core, 'field_cm26_01': ranch_core, 'field_cm11_01': forest_core}[field_id](d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        seq, name = record['sequenceId'], f"pasture{field_id[8:10]}-{record['order']:02d}"
        if field_id == 'field_cm25_01':
            if seq == 16:
                role, anchor = 'pool-water-ripples', zoo_pool_water(d, name + '-water', record, footprint, phase)
            elif seq == 13:
                role, anchor = 'pale-boulder-pile', zoo_rock_pile(d, name + '-rocks', record, footprint)
            elif seq in (14, 15):
                role, anchor = 'log-feeding-posts', zoo_logs(d, name + '-logs', record, footprint)
            else:
                role, anchor = 'iron-bar-fence', zoo_back_fence(d, name + '-fence', record, footprint)
        elif field_id == 'field_cm26_01':
            if seq == 4:
                role, anchor = 'swaying-yellow-flowers', ranch_flowers(d, name + '-flowers', record, footprint, phase)
            else:
                role, anchor = 'rail-fence', ranch_fence(d, name + '-fence', record, footprint)
        else:
            small = seq == 1
            role = 'front-bush' if small else 'broadleaf-tree'
            anchor = broadleaf_tree(d, name + ('-bush' if small else '-tree'), record, footprint, small)
        containment.register_anchor(field_id, record['order'], anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = record['order']
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = record['sequenceId']
            obj['sourceCellId'] = cell_id
            obj['objectRole'] = role
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': seq, 'role': role,
                        'anchorNative': record['placement'], 'phase': phase, 'phases': phases})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
