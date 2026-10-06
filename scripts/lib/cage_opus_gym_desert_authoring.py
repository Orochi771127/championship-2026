"""Original gym pair and desert for the opus round: gym (cm05), small gym (cm34), desert (cm20).

* Gym / small gym: a warm wooden floor.  Treadmills, lockers and a ballet
  barre stand on the blocked back and side tiles; a blue exercise mat lies on
  the walked floor.  Source objects: exercise bikes, a punching-bag stand with
  a kettlebell, and a weight bench with a loaded barbell, each fitted into its
  own window (shrunk only as a whole if a window is cramped).
* Desert: golden sand with wind ripples and low dunes where residents walk,
  sandstone outcrops on the blocked rims, a few cacti, a sun-bleached skull
  and a dry shrub (core only; the cage has no source objects).

Walkability comes from the product's raising-ground catalog.  Research rasters
were viewed locally only; nothing is loaded or traced.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_remaining_authoring as kit
from . import cage_opus_highland_authoring as hl
from . import cage_opus_sports_authoring as sp


FIELDS = ('field_cm05_01', 'field_cm20_01', 'field_cm34_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm05_01': 'gy-floor-05', 'field_cm20_01': 'ds-sand', 'field_cm34_01': 'gy-floor-34'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones',
                'cage_opus_highland_authoring', 'cage_opus_sports_authoring', 'cage_authoring_coordinates')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35
NATIVE = {'field_cm05_01': (240, 200), 'field_cm20_01': (240, 200), 'field_cm34_01': (96, 112)}

PALETTE = {
    'gy-frame': ((.62, .64, .67), .35, .55, 0),
    'gy-frame-dark': ((.16, .17, .19), .40, .40, 0),
    'gy-rubber': ((.04, .04, .045), .80, .0, 0),
    'gy-pad': ((.06, .06, .07), .55, .0, 0),
    'gy-red': ((.78, .06, .05), .40, .0, 0),
    'gy-plate': ((.70, .05, .04), .45, .15, 0),
    'gy-chrome': ((.82, .84, .86), .15, 1.0, 0),
    'gy-screen': ((.10, .70, .85), .20, .0, 1.6),
    'gy-belt': ((.05, .05, .06), .70, .0, 0),
    'gy-locker': ((.66, .72, .78), .40, .35, 0),
    'gy-locker-vent': ((.30, .34, .38), .50, .30, 0),
    'gy-mat': ((.10, .26, .70), .70, .0, 0),
    'gy-mat-edge': ((.05, .14, .42), .75, .0, 0),
    'gy-barre': ((.70, .56, .36), .45, .0, 0),
    'gy-towel': ((.20, .62, .30), .80, .0, 0),
    'ds-rock': ((.66, .46, .26), .85, .0, 0),
    'ds-rock-dark': ((.48, .32, .18), .88, .0, 0),
    'ds-rock-light': ((.78, .60, .38), .82, .0, 0),
    'ds-cactus': ((.24, .46, .20), .70, .0, 0),
    'ds-cactus-dark': ((.16, .34, .14), .75, .0, 0),
    'ds-bone': ((.92, .88, .78), .70, .0, 0),
    'ds-shrub': ((.46, .38, .22), .85, .0, 0),
}


def tiles(field_id):
    import json
    spec = json.loads((gz.WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
    data = json.loads((gz.ROOT / 'src/data/championship/catalogs/raising-ground.r1.json').read_text(encoding='utf8'))
    entry = next(f for f in data['fields'] if f['definitionIndex'] == spec['definitionIndex'])
    cells = [value for count, *value in entry['runs'] for _ in range(count)]
    width = entry['width']
    return {(i % width, i // width): (kind if owner == 1 else None) for i, (owner, kind, _) in enumerate(cells)}


def _dune_sand(d, name):
    """Golden sand with wind ripples (wave bands) and grain."""
    mat = d.material(name, (.86, .66, .34), .90, .0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry = nodes.new('ShaderNodeNewGeometry')
    ripples = nodes.new('ShaderNodeTexWave')
    ripples.wave_type = 'BANDS'
    ripples.bands_direction = 'Y'
    ripples.inputs['Scale'].default_value = 4.5
    ripples.inputs['Distortion'].default_value = 5.0
    ripples.inputs['Detail'].default_value = 3.0
    links.new(geometry.outputs['Position'], ripples.inputs['Vector'])
    tone = nodes.new('ShaderNodeValToRGB')
    tone.color_ramp.elements[0].color = (.58, .34, .09, 1)
    tone.color_ramp.elements[1].color = (.80, .53, .20, 1)
    links.new(ripples.outputs['Fac'], tone.inputs[0])
    links.new(tone.outputs[0], shader.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .35
    bump.inputs['Distance'].default_value = .03
    links.new(ripples.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs[0], shader.inputs['Normal'])
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'gy-floor-05' not in d.M:
        boards = sp._plank_material(d, 'gy-boards', (.62, .40, .20), (.46, .28, .13), (.22, .12, .05))
        dark = sp._plank_material(d, 'gy-boards-dark', (.44, .28, .14), (.32, .19, .09), (.16, .09, .04))
        for field_id in ('field_cm05_01', 'field_cm34_01'):
            kinds = tiles(field_id)
            w, h = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
            values = {(tx, ty): (1.0 if kinds.get((tx, ty)) is not None else 0.0) for tx in range(w) for ty in range(h)}
            gz.zone_ground(d, SURFACES[field_id], field_id, NATIVE[field_id], values, [(dark, 0, 0), (boards, .4, .6)], .2)
    if 'ds-sand' not in d.M:
        _dune_sand(d, 'ds-sand')


# --------------------------------------------------------------------------- helpers

def scr(d, x, y, z):
    return (x, y - fx.lift(d, z))


def fit_group(d, footprint, window, make_points, scales=None):
    """Largest scale and offset at which a prop's outline fits its window and the field."""
    x, y, w, h = window
    offsets = sorted(((dx, dy) for dx in range(-6, 7, 2) for dy in range(0, -9, -2)), key=lambda o: math.hypot(*o))
    for scale in (scales or [1 - .04 * i for i in range(16)]):
        for dx, dy in offsets:
            if kit.inside(make_points(scale, dx, dy), footprint, window, DESIGN_MARGIN):
                return scale, dx, dy
    raise ValueError(f'PROP_DOES_NOT_FIT:{window}')


# --------------------------------------------------------------------------- gym objects

def bike_outline(d, cx, cy, s):
    pts = []
    for px, py, z in ((cx - 7 * s, cy, 0), (cx + 7 * s, cy, 0), (cx - 6 * s, cy, 1.05 * s), (cx + 5 * s, cy, 1.25 * s),
                      (cx, cy + 2.2 * s, 0), (cx, cy - 2.2 * s, 0)):
        sx, sy = scr(d, px, py, z)
        pts += [(sx - 1.6 * s, sy - 1.2 * s), (sx + 1.6 * s, sy + 1.2 * s)]
    return pts


def exercise_bike(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    cx0, cy0 = x + w / 2, y + h - 6.0
    s, dx, dy = fit_group(d, footprint, window, lambda s, dx, dy: bike_outline(d, cx0 + dx, cy0 + dy, s))
    cx, cy = cx0 + dx, cy0 + dy
    fx.box(d, name + '-base', cx, cy, 6.5 * s, 1.6 * s, 0, .10 * s, 'gy-frame-dark', .008)
    fx.lathe(d, name + '-flywheel', cx + 4.2 * s, cy, [(.10 * s, 2.2 * s), (.62 * s, 2.2 * s)], 'gy-frame', 20)
    fx.pipe(d, name + '-frame', [(cx - 5.2 * s, cy, .1 * s), (cx - 4.6 * s, cy, .85 * s), (cx + 1.0 * s, cy, .55 * s),
                                 (cx + 4.4 * s, cy, 1.05 * s)], .05 * s, 'gy-frame')
    fx.box(d, name + '-seat', cx - 4.6 * s, cy, 1.6 * s, 1.0 * s, .85 * s, 1.0 * s, 'gy-pad', .006)
    fx.pipe(d, name + '-bars', [(cx + 4.4 * s, cy - 1.6 * s, 1.15 * s), (cx + 4.4 * s, cy + 1.6 * s, 1.15 * s)], .045 * s,
            'gy-frame-dark')
    fx.box(d, name + '-console', cx + 4.4 * s, cy, .7 * s, .7 * s, 1.15 * s, 1.30 * s, 'gy-screen', .004)
    for side in (-1, 1):
        fx.pipe(d, f'{name}-pedal-{side}', [(cx, cy, .35 * s), (cx + side * .6 * s, cy + side * 1.0 * s, .28 * s)],
                .04 * s, 'gy-rubber')
    return (cx, cy)


def punching_bag(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    cx0, cy0 = x + w / 2 + 2, y + h - 5.0

    def outline(s, dx, dy):
        cx, cy = cx0 + dx, cy0 + dy
        pts = []
        for px, py, z in ((cx - 5 * s, cy, 0), (cx + 4 * s, cy, 0), (cx - 5 * s, cy, 3.1 * s), (cx + 1.5 * s, cy, 3.1 * s),
                          (cx, cy + 3.2 * s, .5 * s), (cx + 7 * s, cy + 1 * s, 0), (cx + 7 * s, cy + 1 * s, .5 * s)):
            sx, sy = scr(d, px, py, z)
            pts += [(sx - 2.4 * s, sy - 1.4 * s), (sx + 2.4 * s, sy + 1.4 * s)]
        return pts
    s, dx, dy = fit_group(d, footprint, window, outline)
    cx, cy = cx0 + dx, cy0 + dy
    fx.box(d, name + '-foot', cx - 4.5 * s, cy, 2.0 * s, 2.0 * s, 0, .10 * s, 'gy-frame-dark', .008)
    fx.pipe(d, name + '-mast', [(cx - 4.5 * s, cy, .1 * s), (cx - 4.5 * s, cy, 3.05 * s)], .07 * s, 'gy-frame-dark')
    fx.pipe(d, name + '-arm', [(cx - 4.5 * s, cy, 3.0 * s), (cx + .8 * s, cy, 3.0 * s)], .06 * s, 'gy-frame-dark')
    fx.pipe(d, name + '-chain', [(cx + .8 * s, cy, 3.0 * s), (cx + .8 * s, cy, 2.55 * s)], .02 * s, 'gy-chrome')
    fx.lathe(d, name + '-bag', cx + .8 * s, cy, [(.55 * s, 1.0 * s), (.62 * s, 2.1 * s), (2.40 * s, 2.1 * s),
                                                 (2.55 * s, 1.2 * s)], 'gy-red', 20)
    fx.cylinder(d, name + '-band', cx + .8 * s, cy, 2.18 * s, 2.0 * s, 2.12 * s, 'gy-pad', 20)
    kx, ky = cx + 6.4 * s, cy + 1.0 * s
    fx.lathe(d, name + '-kettlebell', kx, ky, [(0, 1.0 * s), (.12 * s, 1.5 * s), (.30 * s, 1.4 * s), (.36 * s, .6 * s)],
             'gy-pad', 14)
    fx.pipe(d, name + '-kettle-handle', [(kx - .9 * s, ky, .32 * s), (kx, ky, .55 * s), (kx + .9 * s, ky, .32 * s)],
            .05 * s, 'gy-pad')
    return (cx, cy)


def weight_bench(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    cx0, cy0 = x + w / 2, y + h - 12.0

    def outline(s, dx, dy):
        cx, cy = cx0 + dx, cy0 + dy
        pts = []
        for px, py, z in ((cx - 8 * s, cy + 4 * s, 0), (cx + 8 * s, cy - 4 * s, 0), (cx - 12 * s, cy - 6 * s, 1.4 * s),
                          (cx + 12 * s, cy + 6 * s, 1.4 * s), (cx, cy, 1.5 * s)):
            sx, sy = scr(d, px, py, z)
            pts += [(sx - 2.8 * s, sy - 2.8 * s), (sx + 2.8 * s, sy + 2.8 * s)]
        return pts
    s, dx, dy = fit_group(d, footprint, window, outline)
    cx, cy = cx0 + dx, cy0 + dy
    # Bench along V, uprights at its head, barbell racked across (along U).
    fx.box(d, name + '-pad', cx - 1.5 * s * V[0], cy - 1.5 * s * V[1], 1.6 * s, 6.5 * s, .45 * s, .62 * s, 'gy-pad', .010)
    for k, t in enumerate((-4.5, 1.5)):
        px, py = cx + t * s * V[0], cy + t * s * V[1]
        fx.box(d, f'{name}-leg-{k}', px, py, 1.2 * s, .4 * s, 0, .45 * s, 'gy-frame-dark', .004)
    head = (cx + 3.6 * s * V[0], cy + 3.6 * s * V[1])
    for side in (-1, 1):
        px, py = head[0] + side * 3.6 * s * U[0], head[1] + side * 3.6 * s * U[1]
        fx.pipe(d, f'{name}-upright-{side}', [(px, py, 0.0), (px, py, 1.35 * s)], .06 * s, 'gy-frame')
    a = (head[0] - 9.5 * s * U[0], head[1] - 9.5 * s * U[1])
    b = (head[0] + 9.5 * s * U[0], head[1] + 9.5 * s * U[1])
    fx.pipe(d, name + '-bar', [(a[0], a[1], 1.32 * s), (b[0], b[1], 1.32 * s)], .035 * s, 'gy-chrome')
    for side, (px, py) in ((-1, a), (1, b)):
        for k, (off, radius) in enumerate(((1.4, .060), (2.3, .048))):
            qx, qy = px - side * off * s * U[0], py - side * off * s * U[1]
            ends = [(qx - .35 * s * U[0], qy - .35 * s * U[1], 1.32 * s), (qx + .35 * s * U[0], qy + .35 * s * U[1], 1.32 * s)]
            disc = fx.pipe(d, f'{name}-plate-{side}-{k}', ends, radius * 6 * s, 'gy-plate')
            disc.data.use_fill_caps = True
    return (cx, cy)


# --------------------------------------------------------------------------- cores

def treadmill(d, name, cx, cy, s=1.0):
    fx.box(d, name + '-deck', cx, cy, 5.0 * s, 1.8 * s, 0, .22 * s, 'gy-frame-dark', .008)
    fx.box(d, name + '-belt', cx, cy, 4.4 * s, 1.3 * s, .22 * s, .25 * s, 'gy-belt', 0)
    head = (cx - 4.6 * s * U[0], cy - 4.6 * s * U[1])
    for side in (-1, 1):
        px, py = head[0] + side * 1.6 * s * V[0], head[1] + side * 1.6 * s * V[1]
        fx.pipe(d, f'{name}-post-{side}', [(px, py, .2 * s), (px, py, 1.25 * s)], .05 * s, 'gy-frame')
    fx.box(d, name + '-console', head[0], head[1], .8 * s, 1.9 * s, 1.15 * s, 1.40 * s, 'gy-frame-dark', .006)
    fx.face_panel(d, name + '-screen', head[0], head[1], .8 * s, 1.9 * s, 1.22 * s, 1.36 * s, 'gy-screen',
                  'front-right', .3, .25)


def locker_row(d, name, x0, y0, count, footprint):
    for k in range(count):
        cx, cy = x0 + k * 5.2 * U[0], y0 + k * 5.2 * U[1]
        room = kit.headroom(footprint, cx - 4, cx + 4, cy) - 2.5
        zt = max(.8, min(1.9, room / fx.lift(d, 1)))
        fx.box(d, f'{name}-{k}', cx, cy, 2.4, 1.6, 0, zt, 'gy-locker', .008)
        fx.face_panel(d, f'{name}-vent-{k}', cx, cy, 2.4, 1.6, zt * .70, zt * .86, 'gy-locker-vent', 'front-left', .45, .25)
        fx.face_panel(d, f'{name}-handle-{k}', cx + .9 * U[0], cy + .9 * U[1], .3, 1.6, zt * .45, zt * .55, 'gy-chrome',
                      'front-left', .0, .3)


def gym_core(d, footprint):
    fid = footprint['fieldId']
    small = fid == 'field_cm34_01'
    kinds = tiles(fid)
    if not small:
        for k, (cx, cy) in enumerate(((84.0, 40.0), (108.0, 40.0), (132.0, 40.0))):
            treadmill(d, f'gym-treadmill-{k}', cx, cy)
        locker_row(d, 'gym-locker', 154.0, 30.0, 6, footprint)
        mat = fx.quad(44.0, 150.0, 18.0, 10.0)
        for i, piece in enumerate(fit.clip_to_footprint(mat, footprint, 2.0, .05)):
            fx.prism(d, f'gym-mat-{i}', piece, .004, .05, 'gy-mat', .006)
        barre = [(8.0, 120.0, .7), (8.0, 156.0, .7)]
        fx.pipe(d, 'gym-barre', [(x, y, z) for x, y, z in barre], .05, 'gy-barre')
        for k, (x, y, _) in enumerate(barre):
            fx.pipe(d, f'gym-barre-post-{k}', [(x, y, 0.0), (x, y, .72)], .035, 'gy-frame')
        for rx, ry in ((228.0, 66.0), (226.0, 58.0), (224.0, 74.0)):
            outline = [(rx - 4.2, ry), (rx + 4.2, ry), (rx, ry - fx.lift(d, 1.0) - 2.0), (rx, ry + 2.0)]
            if kit.core_inside(outline, footprint, 1.4):
                fx.box(d, 'gym-towel-rack', rx, ry, .5, 3.0, 0, .9, 'gy-frame-dark', .004)
                fx.face_panel(d, 'gym-towel', rx, ry, .5, 2.2, .45, .85, 'gy-towel', 'front-right', .2, .3)
                break
    else:
        locker_row(d, 'small-gym-locker', 54.0, 22.0, 3, footprint)
        mat = fx.quad(30.0, 72.0, 10.0, 6.0)
        for i, piece in enumerate(fit.clip_to_footprint(mat, footprint, 2.0, .05)):
            fx.prism(d, f'small-gym-mat-{i}', piece, .004, .05, 'gy-mat', .006)
    return ['wooden-gym-floor', 'treadmills-and-lockers' if not small else 'lockers', 'exercise-mat', 'exercise-bikes',
            'punching-bag', 'weight-bench']


def desert_core(d, footprint):
    fid = footprint['fieldId']
    kinds = tiles(fid)
    import numpy as np
    # Low dunes on the walked sand.
    for k, (cx, cy, r) in enumerate(((56.0, 52.0, 16.0), (138.0, 44.0, 14.0), (104.0, 68.0, 11.0), (206.0, 146.0, 13.0))):
        # Long, low wind-shaped dunes: flattened ellipsoids stretched along one ground axis.
        pts = [(cx + 1.9 * r * math.cos(a), cy + .9 * r * math.sin(a) - s * fx.lift(d, .25)) for a in np.linspace(0, math.tau, 16)
               for s in (0, 1)]
        if kit.core_inside(pts, footprint, 1.5):
            d.sphere(f'desert-dune-{k}', d.world(cx, cy, -.02), (r / 16 * 1.7, r / 16 * .75, .22), 'ds-sand')
    # Sandstone outcrops on the blocked rims.
    j = 0
    for (tx, ty), kind in sorted(kinds.items()):
        if kind is not None or kit.hash01(tx, ty, 1) > .55:
            continue
        cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 2) - .5) * 3, ty * 8 + 4
        r = 3.0 + kit.hash01(tx, ty, 3) * 2.6
        room = kit.headroom(footprint, cx - r, cx + r, cy) - r / 2 - 1.5
        hz = max(.3, min(1.4, room / fx.lift(d, 1)))
        if hl.place_rock(d, f'desert-outcrop-{j}', footprint, cx, cy, r * 1.15, min(hz, .75),
                         ('ds-rock', 'ds-rock-dark', 'ds-rock-light')[j % 3], j):
            j += 1
    # Cacti, a skull and a dry shrub on blocked tiles near the walked sand.
    for k, (cx, cy, hz) in enumerate(((12.0, 40.0, 1.3), (180.0, 60.0, 1.1), (232.0, 128.0, 1.2))):
        if not kit.core_inside([(cx - 3, cy), (cx + 3, cy), (cx, cy - fx.lift(d, hz + .2))], footprint, 1.4):
            continue
        fx.lathe(d, f'desert-cactus-{k}', cx, cy, [(0, 1.3), (hz * .9, 1.2), (hz, .7), (hz + .08, .1)], 'ds-cactus', 12)
        for side, (arm_z, arm_up) in ((-1, (hz * .45, hz * .75)), (1, (hz * .55, hz * .85))):
            fx.pipe(d, f'desert-cactus-{k}-arm-{side}', [(cx, cy, arm_z), (cx + side * 1.8, cy, arm_z),
                                                         (cx + side * 1.8, cy, arm_up)], .07, 'ds-cactus-dark')
    sx, sy = 186.0, 172.0
    if kit.core_inside([(sx - 3, sy), (sx + 3, sy)], footprint, 1.4):
        d.sphere('desert-skull', d.world(sx, sy, .12), (.13, .16, .11), 'ds-bone')
        for side in (-1, 1):
            fx.pipe(d, f'desert-skull-horn-{side}', [(sx + side * 1.2, sy, .18), (sx + side * 3.0, sy - .6, .35),
                                                     (sx + side * 3.4, sy - 1.6, .48)], .04, 'ds-bone')
    bx, by = 30.0, 76.0
    for i in range(9):
        a = i * math.tau / 9
        fx.pipe(d, f'desert-shrub-{i}', [(bx, by, .02), (bx + math.cos(a) * 2.6, by + .5 * math.sin(a) * 2.6, .45)], .02,
                'ds-shrub')
    return ['golden-dunes-with-ripples', 'sandstone-outcrops', 'cacti', 'bleached-skull', 'dry-shrub']


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_GYM_DESERT_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = (desert_core if field_id == 'field_cm20_01' else gym_core)(d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        seq, name = record['sequenceId'], f"gym{field_id[8:10]}-{record['order']:02d}"
        if field_id == 'field_cm05_01':
            role, maker = {0: ('punching-bag', punching_bag), 1: ('exercise-bike', exercise_bike),
                           2: ('weight-bench', weight_bench)}[seq]
        else:
            role, maker = {0: ('punching-bag', punching_bag), 1: ('exercise-bike', exercise_bike),
                           3: ('exercise-bike', exercise_bike)}[seq]
        anchor = maker(d, name, record, footprint)
        containment.register_anchor(field_id, record['order'], anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = record['order']
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = seq
            obj['sourceCellId'] = cell_id
            obj['objectRole'] = role
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': seq, 'role': role,
                        'anchorNative': record['placement'], 'phase': phase, 'phases': phases})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
