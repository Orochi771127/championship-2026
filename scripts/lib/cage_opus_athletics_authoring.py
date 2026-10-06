"""Original athletics pair for the opus round: stadium (cm03), small sports ground (cm30).

* cm03 stadium: a blue synthetic running track follows the field's outline
  around striped artificial turf.  The field events sit in the infield: a
  long-jump runway into a sand pit and a throwing circle with its sector lines.
  Low grandstands (one block per top hex, clear of the gaps between hexes) and
  a row of advertising boards line the blocked back row; floodlight masts stand
  on the blocked top corners.  Source objects: a pair of hurdles, a high-jump
  mat with its standards and bar, and four training cones.
* cm30 small sports ground: the small sibling of the sports ground (cm02, r8):
  beige dirt, a small red oval with a grass infield and lane lines, hedges on
  blocked corner tiles.  The source object is a hurdle.

Walkability comes from the product's raising-ground catalog; tall scenery only
stands on blocked tiles.  Research rasters were viewed locally only; nothing is
loaded or traced, and no original lettering or logo is used.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_remaining_authoring as kit
from . import cage_opus_sports_authoring as sp


FIELDS = ('field_cm03_01', 'field_cm30_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm03_01': 'at-turf', 'field_cm30_01': 'sp-ground'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones',
                'cage_opus_sports_authoring', 'cage_authoring_coordinates')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35

PALETTE = {
    'at-sand': ((.84, .70, .44), .95, .0, 0),
    'at-rim': ((.42, .28, .15), .70, .0, 0),
    'at-concrete': ((.60, .61, .63), .80, .0, 0),
    'at-stand': ((.50, .52, .56), .75, .0, 0),
    'at-seat-blue': ((.08, .22, .66), .55, .0, 0),
    'at-seat-white': ((.90, .91, .93), .55, .0, 0),
    'at-board-blue': ((.06, .28, .78), .40, .0, .35),
    'at-board-yellow': ((.96, .74, .08), .40, .0, .35),
    'at-board-red': ((.80, .10, .08), .40, .0, .35),
    'at-board-green': ((.06, .52, .28), .40, .0, .35),
    'at-mat': ((.08, .26, .70), .70, .0, 0),
    'at-mat-top': ((.14, .36, .84), .65, .0, 0),
    'at-cone': ((.96, .34, .04), .50, .0, 0),
    'at-pole': ((.72, .74, .77), .35, .60, 0),
    'at-lamp': ((1.0, .97, .88), .30, .0, 5.0),
    'at-bar': ((.96, .80, .10), .45, .0, 0),
    'at-hurdle-dark': ((.08, .08, .09), .50, .0, 0),
}


# --------------------------------------------------------------------------- materials

def _turf_material(d, name):
    """Artificial turf with mowing stripes along the cage grid's U axis and fine fibre noise."""
    mat = d.material(name, (.09, .30, .11), .88, .0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry, (u, _v) = sp._grid_coords(d, nodes, links, 2.0, 2.0)
    frac = nodes.new('ShaderNodeMath')
    frac.operation = 'FRACT'
    links.new(u, frac.inputs[0])
    band = nodes.new('ShaderNodeMath')
    band.operation = 'LESS_THAN'
    band.inputs[1].default_value = .5
    links.new(frac.outputs[0], band.inputs[0])
    stripes = nodes.new('ShaderNodeMixRGB')
    links.new(band.outputs[0], stripes.inputs[0])
    stripes.inputs[1].default_value = (.07, .27, .09, 1)
    stripes.inputs[2].default_value = (.10, .33, .12, 1)
    fibre = nodes.new('ShaderNodeTexNoise')
    fibre.inputs['Scale'].default_value = 60.0
    fibre.inputs['Detail'].default_value = 3.0
    links.new(geometry.outputs['Position'], fibre.inputs['Vector'])
    shade = nodes.new('ShaderNodeMixRGB')
    shade.blend_type = 'MULTIPLY'
    shade.inputs[0].default_value = .35
    links.new(stripes.outputs[0], shade.inputs[1])
    links.new(fibre.outputs['Fac'], shade.inputs[2])
    links.new(shade.outputs[0], shader.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .20
    bump.inputs['Distance'].default_value = .02
    links.new(fibre.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs[0], shader.inputs['Normal'])
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for palette in (sp.PALETTE, PALETTE):
        for name, (color, roughness, metal, glow) in palette.items():
            if name not in d.M:
                d.material(name, color, roughness, metal, glow)
    # The sports ground (cm02) materials, made with the same parameters as round r8.
    if 'sp-ground' not in d.M:
        kit._noise_mix(d, 'sp-ground', (.36, .26, .16), (.31, .22, .13), 1.4, .50, .14,
                       spots=((.46, .37, .26), 4.4, .04))
    if 'sp-track' not in d.M:
        kit._noise_mix(d, 'sp-track', (.58, .20, .12), (.52, .17, .10), 3.0, .50, .2)
    if 'sp-grass' not in d.M:
        kit._noise_mix(d, 'sp-grass', (.18, .44, .14), (.24, .52, .17), 2.4, .50, .2)
    if 'at-track' not in d.M:
        kit._noise_mix(d, 'at-track', (.07, .22, .52), (.05, .18, .45), 3.0, .50, .2)
    if 'at-turf' not in d.M:
        _turf_material(d, 'at-turf')


# --------------------------------------------------------------------------- helpers

def scr(d, x, y, z):
    return (x, y - fx.lift(d, z))


def check(label, points, footprint, window):
    if not kit.inside(points, footprint, window, DESIGN_MARGIN):
        raise ValueError(f'DESIGN_OUTSIDE_WINDOW_OR_FIELD:{label}')


def closed_spline(points, samples=10):
    """Closed Catmull-Rom curve through ground points (the track centreline)."""
    n = len(points)
    out = []
    for i in range(n):
        p0, p1, p2, p3 = points[(i - 1) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]
        for k in range(samples):
            t = k / samples
            t2, t3 = t * t, t * t * t
            out.append(tuple(.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                   + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    return out


def offset(path, dist):
    """Offset a clockwise closed ground path; positive is outward."""
    n = len(path)
    out = []
    for i in range(n):
        (ax, ay), (bx, by) = path[(i - 1) % n], path[(i + 1) % n]
        tx, ty = bx - ax, by - ay
        length = math.hypot(tx, ty) or 1.0
        out.append((path[i][0] + ty / length * dist, path[i][1] - tx / length * dist))
    return out


def ring_mesh(d, name, outer, inner, z0, z1, mat):
    """One closed solid between two matching closed ground paths (a track ring)."""
    n = len(outer)
    verts = []
    for ring in (outer, inner):
        verts += [d.world(x, y, z0) for x, y in ring]
        verts += [d.world(x, y, z1) for x, y in ring]
    o0, o1, i0, i1 = 0, n, 2 * n, 3 * n
    faces = []
    for k in range(n):
        j = (k + 1) % n
        faces.append((o1 + k, o1 + j, i1 + j, i1 + k))      # top
        faces.append((o0 + k, i0 + k, i0 + j, o0 + j))      # bottom
        faces.append((o0 + k, o0 + j, o1 + j, o1 + k))      # outer wall
        faces.append((i0 + k, i1 + k, i1 + j, i0 + j))      # inner wall
    return fx._object(d, name, verts, faces, mat, 0.0)


def line_on_ground(d, name, points, z, footprint, radius=.016, mat='sp-white', margin=2.5, closed=True):
    """White painted line along a ground path, split wherever it would leave the field."""
    import numpy as np
    pts = list(points) + (list(points[:1]) if closed else [])
    segment, made = [], 0
    for p in pts:
        if containment._union_depth(np.array([p]), footprint)[0] >= margin:
            segment.append((p[0], p[1], z))
            continue
        if len(segment) > 1:
            fx.pipe(d, f'{name}-{made}', segment, radius, mat)
            made += 1
        segment = []
    if len(segment) > 1:
        fx.pipe(d, f'{name}-{made}', segment, radius, mat)


# --------------------------------------------------------------------------- cm03 stadium

TRACK_KEYS = [(144, 40), (210, 40), (250, 42), (268, 52), (272, 66), (262, 82), (244, 92), (232, 104),
              (230, 120), (230, 146), (224, 160), (208, 166), (144, 166), (80, 166), (64, 160), (58, 146),
              (58, 120), (56, 104), (44, 92), (26, 82), (16, 66), (20, 52), (38, 42), (78, 40)]
TRACK_HALF = 6.0
STAND_BLOCKS = ((24.0, 72.0), (120.0, 168.0), (216.0, 264.0))
MASTS = ((5.0, 66.0), (283.0, 66.0))


def stadium_track(d, footprint):
    import numpy as np
    path = closed_spline(TRACK_KEYS, 10)
    outer, inner = offset(path, TRACK_HALF), offset(path, -TRACK_HALF)
    if containment._union_depth(np.array(outer), footprint).min() < 2.0:
        raise ValueError('TRACK_LEAVES_FIELD')
    ring_mesh(d, 'stadium-track', outer, inner, .002, .012, 'at-track')
    for k, dist in enumerate((-TRACK_HALF + .4, -2.0, 2.0, TRACK_HALF - .4)):
        line_on_ground(d, f'stadium-lane-{k}', offset(path, dist), .013, footprint)
    # Finish line across the bottom straight.
    fx.pipe(d, 'stadium-finish-line', [(150.0, 160.2, .013), (150.0, 171.8, .013)], .03, 'sp-white')
    return path


def long_jump(d):
    runway = [(150.0, 56.5), (214.0, 56.5), (214.0, 60.5), (150.0, 60.5)]
    fx.prism(d, 'stadium-runway', runway, .002, .012, 'at-track', 0)
    fx.pipe(d, 'stadium-takeoff-board', [(211.0, 56.6, .014), (211.0, 60.4, .014)], .035, 'sp-white')
    pit = [(216.0, 52.0), (242.0, 52.0), (242.0, 65.0), (216.0, 65.0)]
    fx.prism(d, 'stadium-pit-rim', pit, 0, .06, 'at-rim', .004)
    fx.prism(d, 'stadium-pit-sand', [(217.2, 53.2), (240.8, 53.2), (240.8, 63.8), (217.2, 63.8)], .06, .066,
             'at-sand', 0)


def throwing_circle(d):
    cx, cy, r = 176.0, 100.0, 4.6
    fx.cylinder(d, 'stadium-throw-circle', cx, cy, r, .002, .014, 'at-concrete', 32)
    kit.ring(d, 'stadium-throw-rim', cx, cy, r, .016, .02, 'sp-white', 32)
    fx.lathe(d, 'stadium-stop-board', cx - r - .6, cy, [(.002, 1.0), (.06, 1.0)], 'sp-white', 12)
    for k, angle in enumerate((math.radians(166), math.radians(194))):
        ex, ey = cx + 50 * math.cos(angle), cy + 25 * math.sin(angle)
        sx, sy = cx + (r + 1.2) * math.cos(angle), cy + .5 * (r + 1.2) * math.sin(angle)
        fx.pipe(d, f'stadium-sector-{k}', [(sx, sy, .013), (ex, ey, .013)], .018, 'sp-white')


def grandstands(d, footprint):
    """Low stands per top hex (clear of the gaps between hexes) behind a row of boards."""
    tiers = ((28.0, 30.4, .30, 'at-seat-blue'), (26.0, 28.0, .44, 'at-seat-white'))
    for b, (x0, x1) in enumerate(STAND_BLOCKS):
        fx.prism(d, f'stadium-stand-{b}-back', [(x0, 24.8), (x1, 24.8), (x1, 26.0), (x0, 26.0)], 0, .54,
                 'at-stand', .004)
        for t, (y0, y1, top, seat) in enumerate(tiers):
            fx.prism(d, f'stadium-stand-{b}-tier-{t}', [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 0, top - .05,
                     'at-stand', .004)
            n = int((x1 - x0) // 4)
            for s in range(n):
                sx0 = x0 + .6 + s * (x1 - x0) / n
                sx1 = sx0 + (x1 - x0) / n - 1.0
                fx.prism(d, f'stadium-stand-{b}-seat-{t}-{s}', [(sx0, y0 + .3), (sx1, y0 + .3), (sx1, y1 - .4),
                                                                (sx0, y1 - .4)], top - .05, top, seat, .003)
    colours = ('at-board-blue', 'at-board-yellow', 'at-board-red', 'at-board-green')
    x, k = 4.0, 0
    while x < 284.0:
        x1 = min(284.0, x + 22.0)
        fx.prism(d, f'stadium-board-{k}', [(x, 30.6), (x1 - .5, 30.6), (x1 - .5, 31.8), (x, 31.8)], 0, .26,
                 colours[k % 4], .003)
        x, k = x1, k + 1
    pts = []
    for x0, x1 in STAND_BLOCKS:
        pts += [scr(d, x0, 24.8, .54), scr(d, x1, 24.8, .54)]
    pts += [scr(d, 4.0, 30.6, .26), scr(d, 284.0, 30.6, .26)]
    if not kit.core_inside(pts, footprint, 1.3):
        raise ValueError('STANDS_LEAVE_FIELD')


def floodlights(d, footprint):
    for k, (mx, my) in enumerate(MASTS):
        inward = 1.0 if mx < 144 else -1.0
        top = 2.9
        if not kit.core_inside([scr(d, mx - 3, my, top + .35), scr(d, mx + 3, my, top + .35), (mx - 1, my + 1),
                                (mx + 1, my + 1)], footprint, 1.6):
            raise ValueError(f'FLOODLIGHT_LEAVES_FIELD:{k}')
        fx.cylinder(d, f'stadium-mast-{k}-foot', mx, my, 1.4, 0, .10, 'at-concrete', 16)
        fx.pipe(d, f'stadium-mast-{k}', [(mx, my, .10), (mx, my, top)], .07, 'at-pole')
        fx.box(d, f'stadium-mast-{k}-head', mx + inward * .6, my, 1.1, 1.1, top - .06, top + .30, 'at-pole', .006)
        side = 'front-right' if inward > 0 else 'front-left'
        fx.face_panel(d, f'stadium-mast-{k}-lamps', mx + inward * .6, my, 1.1, 1.1, top, top + .26, 'at-lamp',
                      side, .15, .35)


def stadium_core(d, footprint):
    stadium_track(d, footprint)
    long_jump(d)
    throwing_circle(d)
    grandstands(d, footprint)
    floodlights(d, footprint)
    return ['blue-ring-track-following-outline', 'striped-artificial-turf', 'long-jump-runway-and-sand-pit',
            'throwing-circle-and-sector', 'low-grandstands-per-hex', 'advertising-boards', 'floodlight-masts']


def hurdle_pair(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    spots = ((x + 12.0, y + h - 13.0), (x + 24.0, y + h - 5.4))
    half, height = 6.5, .90
    pts = []
    for cx, cy in spots:
        for s in (-1, 1):
            px = cx + s * half
            pts += [(px - 1.4, cy + .9), (px + 1.4, cy + .9), scr(d, px, cy, height + .1), (px, cy - 3.2)]
    check(name, pts, footprint, window)
    for k, (cx, cy) in enumerate(spots):
        for s in (-1, 1):
            px = cx + s * half
            fx.pipe(d, f'{name}-{k}-foot-{s}', [(px, cy + .6, .03), (px, cy - 3.0, .03)], .04, 'sp-steel')
            fx.pipe(d, f'{name}-{k}-leg-{s}', [(px, cy, .03), (px, cy, height)], .035, 'sp-steel')
        stripes = 5
        for j in range(stripes):
            a = cx - half + 2 * half * j / stripes
            b = cx - half + 2 * half * (j + 1) / stripes
            fx.prism(d, f'{name}-{k}-board-{j}', [(a, cy - .25), (b, cy - .25), (b, cy + .25), (a, cy + .25)],
                     height - .15, height, 'at-hurdle-dark' if j % 2 else 'sp-white', .002)
    return spots[0]


def high_jump(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    cx, cy = x + 16.0, y + 19.0
    a, b, top = 6.0, 3.5, .45
    poles = [(cx + 8 * U[0] + s * 3.5 * V[0], cy + 8 * U[1] + s * 3.5 * V[1]) for s in (1, -1)]
    pole_top = 1.20
    pts = [(px, py) for px, py in fx.quad(cx, cy, a, b)] + [scr(d, px, py, top) for px, py in fx.quad(cx, cy, a, b)]
    pts += [p for px, py in poles for p in ((px - .8, py + .5), scr(d, px, py, pole_top + .05))]
    check(name, pts, footprint, window)
    fx.box(d, name + '-mat', cx, cy, a, b, 0, top - .08, 'at-mat', .02)
    fx.box(d, name + '-mat-top', cx, cy, a - .3, b - .3, top - .08, top, 'at-mat-top', .02)
    for k, (px, py) in enumerate(poles):
        fx.cylinder(d, f'{name}-standard-{k}-foot', px, py, .9, 0, .06, 'at-pole', 12)
        fx.pipe(d, f'{name}-standard-{k}', [(px, py, .06), (px, py, pole_top)], .035, 'at-pole')
    (ax, ay), (bx, by) = poles
    segments = 4
    for j in range(segments):
        p = (ax + (bx - ax) * j / segments, ay + (by - ay) * j / segments, .98)
        q = (ax + (bx - ax) * (j + 1) / segments, ay + (by - ay) * (j + 1) / segments, .98)
        fx.pipe(d, f'{name}-bar-{j}', [p, q], .022, 'at-bar' if j % 2 == 0 else 'at-hurdle-dark')
    return (cx, cy)


def cone(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    cx, cy = x + w / 2, y + h - 4.5
    pts = [(cx - 3.1, cy + 1.6), (cx + 3.1, cy + 1.6), (cx, cy - 1.6), scr(d, cx, cy, .74)]
    check(name, pts, footprint, window)
    fx.box(d, name + '-base', cx, cy, 1.5, 1.5, 0, .05, 'at-cone', .004)
    fx.lathe(d, name + '-body', cx, cy, [(.05, 1.7), (.30, 1.2), (.50, .8), (.72, .25)], 'at-cone', 16)
    fx.lathe(d, name + '-band', cx, cy, [(.32, 1.22), (.44, .98)], 'sp-white', 16, caps=(False, False))
    return (cx, cy)


# --------------------------------------------------------------------------- cm30 small sports ground

MINI = {'cx': 46.0, 'cy': 58.0, 'a': 36.0, 'b': 18.0, 'width': 9.0}


def mini_ground_core(d, footprint):
    import numpy as np
    fid = footprint['fieldId']
    walk = gz.walk_tiles(fid)
    t = MINI
    outer = sp.stadium(t['cx'], t['cy'], t['a'], t['b'], 96)
    inner = sp.stadium(t['cx'], t['cy'], t['a'] - t['width'] * 2, t['b'] - t['width'], 96)
    if not kit.core_inside(outer, footprint, 2.0):
        raise ValueError('MINI_TRACK_LEAVES_FIELD')
    ring_mesh(d, 'mini-track', outer, inner, .002, .010, 'sp-track')
    for i, piece in enumerate(fit.clip_to_footprint(inner, footprint, 2.0, .02)):
        fx.prism(d, f'mini-infield-{i}', piece, .011, .016, 'sp-grass', 0)
    for k, frac in enumerate((.04, .5, .96)):
        line = sp.stadium(t['cx'], t['cy'], t['a'] - t['width'] * 2 * frac, t['b'] - t['width'] * frac, 96)
        line_on_ground(d, f'mini-lane-{k}', line, .017, footprint, radius=.016)
    sx = t['cx'] - 4.0
    fx.pipe(d, 'mini-start-line', [(sx, t['cy'] + t['b'] - t['width'] + .4, .018), (sx, t['cy'] + t['b'] - .4, .018)],
            .022, 'sp-white')
    # Hedges on blocked corner tiles, like the sports ground's hedge corner.
    j = 0
    for tx in range(12):
        for ty in range(14):
            if (tx, ty) in walk or kit.hash01(tx, ty, 4) > .45:
                continue
            cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 1) - .5) * 2, ty * 8 + 4
            r = 3.6 + kit.hash01(tx, ty, 2) * 1.2
            hz = .42 + kit.hash01(tx, ty, 3) * .2
            pts = [(cx + r * math.cos(a), cy + .5 * r * math.sin(a) - s * fx.lift(d, hz))
                   for a in np.linspace(0, math.tau, 12) for s in (0, 1)]
            if kit.core_inside(pts, footprint, 1.4):
                d.sphere(f'mini-hedge-{j}', d.world(cx, cy, hz * .55), (r / 16, r / 16, hz * .5),
                         'sp-hedge' if j % 2 else 'sp-hedge-light')
                j += 1
    return ['red-mini-track', 'grass-infield', 'dirt-training-ground', 'hedges', 'hurdle']


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_ATHLETICS_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = (stadium_core if field_id == 'field_cm03_01' else mini_ground_core)(d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        seq, name = record['sequenceId'], f"ath{field_id[8:10]}-{record['order']:02d}"
        if field_id == 'field_cm03_01':
            role, maker = {0: ('hurdle-pair', hurdle_pair), 1: ('high-jump-mat', high_jump),
                           2: ('training-cone', cone)}[seq]
            anchor = maker(d, name, record, footprint)
        else:
            role = 'hurdle'
            anchor = sp.hurdle(d, name + '-hurdle', record, footprint, 1.0, 'sp-bar-red')
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
