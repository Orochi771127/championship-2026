"""Original sports family for the opus round: dojo (cm04), sports ground (cm02).

* cm04 dojo: tatami (mat grid with dark borders) wherever residents walk, plank
  floor elsewhere, a raised tatami dais on the blocked back-left tiles, soft
  window light across the mats.  Source objects: a hanging scroll on a stand
  (original ink-wash mountains and a red seal, no lettering), a dark round
  pillar, and a shoji screen along the back-right edge.  A taiko drum stands on
  the blocked right-hand tiles.
* cm02 sports ground: a red track oval with lane lines around a grass infield,
  hurdles as training gear, hedges on the blocked top-right corner, a goal in
  the lower bay.  The goal frame and its net are continuous 3D lines split at
  the three goal windows by ``partition_segment`` (each span owned by exactly
  one object; spans outside every window stay core).

Research rasters were viewed locally only; the original scroll lettering is
not used.  Walkability comes from the product's raising-ground catalog.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_remaining_authoring as kit
from .cage_authoring_coordinates import partition_segment


FIELDS = ('field_cm02_01', 'field_cm04_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm02_01': 'sp-ground', 'field_cm04_01': 'dj-floor'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones',
                'cage_authoring_coordinates')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35
NATIVE = {'field_cm02_01': (192, 200), 'field_cm04_01': (288, 112)}

PALETTE = {
    'dj-wood': ((.40, .25, .13), .62, .0, 0),
    'dj-wood-dark': ((.20, .12, .06), .66, .0, 0),
    'dj-tatami-top': ((.56, .60, .36), .80, .0, 0),
    'dj-heri': ((.06, .10, .07), .70, .0, 0),
    'dj-paper': ((.94, .92, .84), .70, .0, .25),
    'dj-ink': ((.06, .06, .07), .80, .0, 0),
    'dj-seal': ((.72, .08, .06), .60, .0, 0),
    'dj-mount': ((.20, .26, .22), .70, .0, 0),
    'dj-drum-body': ((.46, .12, .06), .45, .0, 0),
    'dj-drum-skin': ((.86, .78, .62), .70, .0, 0),
    'dj-brass': ((.78, .58, .20), .35, .60, 0),
    'sp-white': ((.95, .95, .93), .40, .0, .30),
    'sp-net': ((.92, .92, .90), .50, .0, .45),
    'sp-bar-red': ((.82, .10, .08), .45, .0, 0),
    'sp-steel': ((.66, .68, .70), .35, .60, 0),
    'sp-hedge': ((.10, .32, .10), .80, .0, 0),
    'sp-hedge-light': ((.18, .44, .14), .80, .0, 0),
    'sp-trunk': ((.32, .22, .13), .80, .0, 0),
}


# --------------------------------------------------------------------------- materials

def _grid_coords(d, nodes, links, period_u, period_v):
    """Two lattice coordinates along the cage grid's U and V axes (in tiles)."""
    geometry = nodes.new('ShaderNodeNewGeometry')
    k = d.UNIT / math.sqrt(2)
    out = []
    for sign, period in ((1, period_u), (-1, period_v)):
        dot = nodes.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        dot.inputs[1].default_value = (k * (1 / 16 + sign * d.S / 8) / period,
                                       k * (1 / 16 - sign * d.S / 8) / period, 0)
        links.new(geometry.outputs['Position'], dot.inputs[0])
        out.append(dot.outputs['Value'])
    return geometry, out


def _tatami_material(d, name):
    """Tatami mats (2x1 tiles), rows staggered by half a mat: dark cloth borders on the
    long edges, a fine seam on the short edges, and a weave along each mat."""
    mat = d.material(name, (.54, .58, .34), .78, .0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry, (u, v) = _grid_coords(d, nodes, links, 2.0, 1.0)

    def op(kind, a, b=None):
        node = nodes.new('ShaderNodeMath')
        node.operation = kind
        for socket, value in ((node.inputs[0], a), (node.inputs[1], b)):
            if value is None:
                continue
            if isinstance(value, (int, float)):
                socket.default_value = value
            else:
                links.new(value, socket)
        return node.outputs[0]

    def edge(coordinate, width):
        return op('LESS_THAN', op('PINGPONG', op('FRACT', coordinate), .5), width)
    # Stagger every other row of mats by half a mat length.
    row = op('FLOOR', v)
    shifted = op('ADD', u, op('MULTIPLY', op('FRACT', op('MULTIPLY', row, .5)), 1.0))
    long_border = edge(v, .055)
    short_seam = edge(shifted, .022)
    weave = nodes.new('ShaderNodeTexWave')
    weave.wave_type = 'BANDS'
    weave.inputs['Scale'].default_value = 60.0
    links.new(u, weave.inputs['Vector'])
    tone = nodes.new('ShaderNodeValToRGB')
    tone.color_ramp.elements[0].color = (.48, .53, .30, 1)
    tone.color_ramp.elements[1].color = (.60, .63, .39, 1)
    links.new(weave.outputs['Fac'], tone.inputs[0])
    # Each mat its own slight tone: white noise on the integer mat coordinates.
    cell = nodes.new('ShaderNodeCombineXYZ')
    links.new(op('FLOOR', shifted), cell.inputs['X'])
    links.new(row, cell.inputs['Y'])
    pick = nodes.new('ShaderNodeTexWhiteNoise')
    pick.noise_dimensions = '3D'
    links.new(cell.outputs[0], pick.inputs['Vector'])
    shade = nodes.new('ShaderNodeMapRange')
    shade.inputs['To Min'].default_value = .86
    shade.inputs['To Max'].default_value = 1.08
    links.new(pick.outputs['Value'], shade.inputs['Value'])
    tinted = nodes.new('ShaderNodeMixRGB')
    tinted.blend_type = 'MULTIPLY'
    tinted.inputs[0].default_value = 1.0
    links.new(tone.outputs[0], tinted.inputs[1])
    gray = nodes.new('ShaderNodeCombineXYZ')
    for axis in ('X', 'Y', 'Z'):
        links.new(shade.outputs['Result'], gray.inputs[axis])
    links.new(gray.outputs[0], tinted.inputs[2])
    seam = nodes.new('ShaderNodeMixRGB')
    links.new(short_seam, seam.inputs[0])
    links.new(tinted.outputs[0], seam.inputs[1])
    seam.inputs[2].default_value = (.20, .25, .14, 1)
    border = nodes.new('ShaderNodeMixRGB')
    links.new(long_border, border.inputs[0])
    links.new(seam.outputs[0], border.inputs[1])
    border.inputs[2].default_value = (.05, .09, .06, 1)
    links.new(border.outputs[0], shader.inputs['Base Color'])
    return mat


def _plank_material(d, name, light, dark, joint):
    """Floor boards along U: board joints, staggered butt joints, grain."""
    mat = d.material(name, light, .55, .0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry, (u, v) = _grid_coords(d, nodes, links, 3.0, .5)
    frac = nodes.new('ShaderNodeMath')
    frac.operation = 'FRACT'
    links.new(v, frac.inputs[0])
    pong = nodes.new('ShaderNodeMath')
    pong.operation = 'PINGPONG'
    pong.inputs[1].default_value = .5
    links.new(frac.outputs[0], pong.inputs[0])
    seam = nodes.new('ShaderNodeMath')
    seam.operation = 'LESS_THAN'
    seam.inputs[1].default_value = .045
    links.new(pong.outputs[0], seam.inputs[0])
    row = nodes.new('ShaderNodeMath')
    row.operation = 'FLOOR'
    links.new(v, row.inputs[0])
    shift = nodes.new('ShaderNodeMath')
    shift.operation = 'MULTIPLY'
    shift.inputs[1].default_value = .37
    links.new(row.outputs[0], shift.inputs[0])
    along = nodes.new('ShaderNodeMath')
    along.operation = 'ADD'
    links.new(u, along.inputs[0])
    links.new(shift.outputs[0], along.inputs[1])
    frac2 = nodes.new('ShaderNodeMath')
    frac2.operation = 'FRACT'
    links.new(along.outputs[0], frac2.inputs[0])
    butt = nodes.new('ShaderNodeMath')
    butt.operation = 'LESS_THAN'
    butt.inputs[1].default_value = .012
    links.new(frac2.outputs[0], butt.inputs[0])
    joints = nodes.new('ShaderNodeMath')
    joints.operation = 'MAXIMUM'
    links.new(seam.outputs[0], joints.inputs[0])
    links.new(butt.outputs[0], joints.inputs[1])
    grain = nodes.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 9.0
    grain.inputs['Detail'].default_value = 4.0
    links.new(geometry.outputs['Position'], grain.inputs['Vector'])
    tone = nodes.new('ShaderNodeValToRGB')
    tone.color_ramp.elements[0].color = (*dark, 1)
    tone.color_ramp.elements[1].color = (*light, 1)
    links.new(grain.outputs['Fac'], tone.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB')
    links.new(joints.outputs[0], mix.inputs[0])
    links.new(tone.outputs[0], mix.inputs[1])
    mix.inputs[2].default_value = (*joint, 1)
    links.new(mix.outputs[0], shader.inputs['Base Color'])
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'dj-light' not in d.M:
        light = d.material('dj-light', (1.0, .95, .80), .5, .0, 1.2)
        light.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .11
    if 'dj-floor' not in d.M:
        tatami = _tatami_material(d, 'dj-tatami')
        boards = _plank_material(d, 'dj-boards', (.46, .29, .15), (.32, .19, .09), (.12, .07, .03))
        walk = gz.walk_tiles('field_cm04_01')
        values = {(tx, ty): (1.0 if (tx, ty) in walk else 0.0) for tx in range(36) for ty in range(14)}
        gz.zone_ground(d, 'dj-floor', 'field_cm04_01', NATIVE['field_cm04_01'], values,
                       [(boards, 0, 0), (tatami, .55, .62)], .0)
    if 'sp-ground' not in d.M:
        kit._noise_mix(d, 'sp-ground', (.36, .26, .16), (.31, .22, .13), 1.4, .50, .14,
                       spots=((.46, .37, .26), 4.4, .04))
    if 'sp-track' not in d.M:
        kit._noise_mix(d, 'sp-track', (.58, .20, .12), (.52, .17, .10), 3.0, .50, .2)
    if 'sp-grass' not in d.M:
        kit._noise_mix(d, 'sp-grass', (.18, .44, .14), (.24, .52, .17), 2.4, .50, .2)


# --------------------------------------------------------------------------- helpers

def depth(points, footprint):
    return containment._union_depth(points, footprint)


def inside(points, footprint, window, margin=DESIGN_MARGIN):
    import numpy as np
    pts = np.asarray(points, dtype=float).reshape(-1, 2)
    x, y, w, h = window
    if (pts[:, 0].min() < x + .12 or pts[:, 0].max() > x + w - .12
            or pts[:, 1].min() < y + .12 or pts[:, 1].max() > y + h - .12):
        return False
    return bool(depth(pts, footprint).min() >= margin)


def scr(d, x, y, z):
    return (x, y - fx.lift(d, z))


def check(label, points, footprint, window):
    if not inside(points, footprint, window):
        raise ValueError(f'DESIGN_OUTSIDE_WINDOW_OR_FIELD:{label}')


def quad_along(cx, cy, half, direction, depth_half, normal):
    dx, dy = direction
    nx, ny = normal
    return [(cx - dx * half - nx * depth_half, cy - dy * half - ny * depth_half),
            (cx + dx * half - nx * depth_half, cy + dy * half - ny * depth_half),
            (cx + dx * half + nx * depth_half, cy + dy * half + ny * depth_half),
            (cx - dx * half + nx * depth_half, cy - dy * half + ny * depth_half)]


# --------------------------------------------------------------------------- cm04 dojo

def dojo_core(d, footprint):
    fid = footprint['fieldId']
    walk = gz.walk_tiles(fid)
    # Raised tatami dais on the blocked back-left tiles.
    dais = [(6.0, 33.0), (30.0, 21.0), (46.0, 29.0), (46.0, 47.0), (22.0, 59.0), (6.0, 51.0)]
    for i, piece in enumerate(fit.clip_to_footprint(dais, footprint, 2.0, .4)):
        fx.prism(d, f'dojo-dais-{i}', piece, 0, .30, 'dj-wood-dark', .010)
    top = [(9.0, 33.5), (30.0, 23.0), (43.5, 30.0), (43.5, 46.0), (22.0, 56.5), (9.0, 50.0)]
    for i, piece in enumerate(fit.clip_to_footprint(top, footprint, 3.0, .4)):
        fx.prism(d, f'dojo-dais-mat-{i}', piece, .30, .33, 'dj-tatami-top', .004)
    # Soft window light falling across the mats from the right.
    for k, (x0, y0) in enumerate(((150.0, 30.0), (190.0, 34.0), (230.0, 38.0))):
        shaft = [(x0, y0), (x0 + 15, y0 - 7.5), (x0 - 20, y0 + 37), (x0 - 35, y0 + 44.5)]
        for i, piece in enumerate(fit.clip_to_footprint(shaft, footprint, 3.0, .03)):
            fx.prism(d, f'dojo-light-{k}-{i}', piece, .010 + .002 * k, .012 + .002 * k, 'dj-light', 0)
    # Taiko drum on a stand on the blocked right-hand tiles.
    cx, cy = 279.0, 66.0
    if not any((int(cx // 8), int(cy // 8)) == t for t in walk):
        fx.box(d, 'dojo-drum-stand', cx, cy, 3.2, 3.2, 0, .32, 'dj-wood-dark', .008)
        fx.lathe(d, 'dojo-drum-body', cx, cy, [(.32, 4.2), (.62, 5.0), (.92, 5.0), (1.22, 4.2)], 'dj-drum-body', 28)
        fx.lathe(d, 'dojo-drum-skin', cx, cy, [(1.22, 4.2), (1.24, 3.9)], 'dj-drum-skin', 28)
        for z in (.40, 1.14):
            kit.ring(d, f'dojo-drum-rivets-{z}', cx, cy, 4.5 + (.4 if .5 < z < 1.0 else 0), z, .03, 'dj-brass', 28)
    return ['tatami-where-residents-walk', 'plank-floor', 'raised-tatami-dais', 'hanging-scroll-original-ink',
            'dojo-pillar', 'shoji-screen', 'taiko-drum', 'window-light']


def plane_shape(d, name, cx, cy, shape, push, mat):
    """A flat polygon on a vertical plane along U, pushed toward the viewer (front-left)."""
    nx, ny = -V[0], -V[1]
    length = math.hypot(nx, ny)
    nx, ny = nx / length * push, ny / length * push
    verts = [d.world(cx + s * U[0] + nx, cy + s * U[1] + ny, z) for s, z in shape]
    return fx._object(d, name, verts, [tuple(range(len(verts)))], mat, 0.0, ())


def scroll_stand(d, name, record, footprint):
    window = containment.source_window(record)
    cx, cy = 10.0, 69.0
    zt = 3.2
    half = 3.6
    pts = [scr(d, cx + s * half, cy + s * half * .5, z) for s in (-1, 1) for z in (0, zt + .1)]
    pts += [(cx - half - .6, cy), (cx + half + .6, cy + 2.2)]
    check(name, pts, footprint, window)
    for s in (-1, 1):
        px, py = cx + s * half * U[0], cy + s * half * U[1]
        fx.box(d, f'{name}-foot-{s}', px, py, .45, 1.2, 0, .08, 'dj-wood-dark', .004)
        fx.pipe(d, f'{name}-post-{s}', [(px, py, .08), (px, py, zt)], .035, 'dj-wood-dark')
    fx.pipe(d, name + '-bar', [(cx - half * U[0], cy - half * U[1], zt - .05), (cx + half * U[0], cy + half * U[1], zt - .05)],
            .03, 'dj-wood-dark')
    # The scroll: dark mounting, cream paper, ink mountains, a red seal; faces the viewer.
    panel = (cx, cy - .2)
    fx.face_panel(d, name + '-mount', panel[0], panel[1], 2.9, .4, .55, zt - .12, 'dj-mount', 'front-left', .0, .25)
    fx.face_panel(d, name + '-paper', panel[0], panel[1] + .1, 2.4, .4, .75, zt - .32, 'dj-paper', 'front-left', .0, .35)
    mountains = (((-2.0, 1.25), (-.9, 2.25), (.2, 1.25)), ((-.6, 1.25), (.6, 2.65), (1.9, 1.25)),
                 ((.9, 1.25), (1.5, 1.75), (2.1, 1.25)))
    for k, shape in enumerate(mountains):
        plane_shape(d, f'{name}-ink-{k}', panel[0], panel[1] + .1, shape, .55 + .02 * k, 'dj-ink')
    fx.face_panel(d, name + '-seal', panel[0] + 1.2 * U[0], panel[1] + 1.2 * U[1] + .2, .3, .3, .95, 1.12, 'dj-seal',
                  'front-left', .0, .5)
    fx.pipe(d, name + '-roller', [(cx - 2.8 * U[0], cy - 2.8 * U[1] + .3, .52), (cx + 2.8 * U[0], cy + 2.8 * U[1] + .3, .52)],
            .035, 'dj-wood-dark')
    return (cx, cy)


def dojo_pillar(d, name, record, footprint):
    window = containment.source_window(record)
    cx, cy, r = 25.0, 62.0, 2.6
    room = min(kit.headroom(footprint, cx - r, cx + r, cy), cy - (window[1] + 1.0)) - r / 2 - 1.5
    zt = max(2.0, min(4.6, room / fx.lift(d, 1)))
    check(name, [(cx - r, cy), (cx + r, cy), (cx, cy + r / 2), scr(d, cx, cy - r / 2, zt + .05)], footprint, window)
    fx.box(d, name + '-base-stone', cx, cy, 1.9, 1.9, 0, .10, 'dj-mount', .008)
    fx.cylinder(d, name + '-shaft', cx, cy, r * .82, .10, zt, 'dj-wood-dark', 18)
    for z in (zt * .22, zt * .62):
        fx.cylinder(d, f'{name}-band-{z:.2f}', cx, cy, r * .86, z, z + .06, 'dj-wood', 18)
    return (cx, cy)


def shoji_screen(d, name, record, footprint):
    """Wooden lattice screen with paper panels along the back-right edge (direction U)."""
    window = containment.source_window(record)
    x0, x1, offset = 247.0, 283.0, 23.0
    base = lambda x: (x, (x - 240.0) / 2 + offset)
    zt = 1.9
    pts = []
    for x in (x0, x1):
        bx, by = base(x)
        pts += [(bx - 1, by + .6), (bx + 1, by + .6), scr(d, bx, by, zt + .08)]
    check(name, pts, footprint, window)
    panels = 4
    step = (x1 - x0) / panels
    a, b = base(x0), base(x1)
    for z in (.04, zt):
        fx.pipe(d, f'{name}-rail-{z:.2f}', [(a[0], a[1], z), (b[0], b[1], z)], .045, 'dj-wood-dark')
    for i in range(panels + 1):
        px, py = base(x0 + i * step)
        fx.pipe(d, f'{name}-stile-{i}', [(px, py, 0.0), (px, py, zt)], .045, 'dj-wood-dark')
    for i in range(panels):
        sx0, sx1 = x0 + i * step + .5, x0 + (i + 1) * step - .5
        pa, pb = base(sx0), base(sx1)
        # Paper: a thin slab one tile row in front of the rail line, along U.
        quad = [(pa[0], pa[1] - .15), (pb[0], pb[1] - .15), (pb[0], pb[1] + .15), (pa[0], pa[1] + .15)]
        fx.prism(d, f'{name}-paper-{i}', quad, .08, zt - .05, 'dj-paper', 0)
        for k in range(1, 4):
            z = .08 + (zt - .13) * k / 4
            fx.pipe(d, f'{name}-kumiko-h-{i}-{k}', [(pa[0], pa[1] + .3, z), (pb[0], pb[1] + .3, z)], .012, 'dj-wood-dark')
        mid = base((sx0 + sx1) / 2)
        fx.pipe(d, f'{name}-kumiko-v-{i}', [(mid[0], mid[1] + .3, .08), (mid[0], mid[1] + .3, zt - .05)], .012,
                'dj-wood-dark')
    return base((x0 + x1) / 2)


# --------------------------------------------------------------------------- cm02 sports ground

TRACK = {'cx': 96.0, 'cy': 58.0, 'a': 84.0, 'b': 31.0, 'width': 13.0}


def stadium(cx, cy, a, b, n=72):
    """Track outline: straights along screen x joined by 2:1 half-ellipse ends."""
    straight = max(0.0, a - 2 * b)
    pts = []
    for i in range(n):
        t = i / n * math.tau
        x, y = math.cos(t), math.sin(t)
        pts.append((cx + (straight if x >= 0 else -straight) + 2 * b * x, cy + b * y))
    return pts


def ground_core(d, footprint):
    fid = footprint['fieldId']
    walk = gz.walk_tiles(fid)
    t = TRACK
    outer = stadium(t['cx'], t['cy'], t['a'], t['b'])
    inner = stadium(t['cx'], t['cy'], t['a'] - t['width'] * 2, t['b'] - t['width'])
    for i, piece in enumerate(fit.clip_to_footprint(outer, footprint, 2.0, .02)):
        fx.prism(d, f'ground-track-{i}', piece, .002, .010, 'sp-track', 0)
    for i, piece in enumerate(fit.clip_to_footprint(inner, footprint, 2.0, .02)):
        fx.prism(d, f'ground-infield-{i}', piece, .011, .016, 'sp-grass', 0)
    import numpy as np
    for lane in range(1, 4):
        k = lane / 4
        line = stadium(t['cx'], t['cy'], t['a'] - t['width'] * 2 * k, t['b'] - t['width'] * k, 96)
        segment = []
        for p in line + line[:1]:
            if depth(np.array([p]), footprint)[0] >= 2.5:
                segment.append((p[0], p[1], .014))
            elif len(segment) > 1:
                fx.pipe(d, f'ground-lane-{lane}-{len(segment)}-{p[0]:.0f}', segment, .016, 'sp-white')
                segment = []
            else:
                segment = []
        if len(segment) > 1:
            fx.pipe(d, f'ground-lane-{lane}-end', segment, .016, 'sp-white')
    # Start line across the bottom straight.
    sx = t['cx'] + 6
    fx.pipe(d, 'ground-start-line', [(sx, t['cy'] + t['b'] - t['width'] + .5, .015), (sx, t['cy'] + t['b'] - .5, .015)],
            .02, 'sp-white')
    # Goal area markings in the lower bay.
    box = [(58.0, 150.0), (134.0, 150.0), (134.0, 164.0), (58.0, 164.0)]
    for a, b in zip(box, box[1:]):
        fx.pipe(d, f'ground-goal-line-{a[0]:.0f}-{a[1]:.0f}', [(a[0], a[1], .012), (b[0], b[1], .012)], .016, 'sp-white')
    fx.pipe(d, 'ground-goal-arc', [(96 + 16 * math.cos(a), 150 - 6 * math.sin(a), .012)
                                   for a in np.linspace(0, math.pi, 18)], .016, 'sp-white')
    d.sphere('ground-penalty-spot', d.world(96.0, 140.0, .012), (.03, .03, .006), 'sp-white')
    # Hedges and two small trees on the blocked top-right corner.
    j = 0
    for tx in range(17, 24):
        for ty in range(3, 8):
            if (tx, ty) in walk:
                continue
            cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 1) - .5) * 3, ty * 8 + 4
            r = 4.4 + kit.hash01(tx, ty, 2) * 1.6
            hz = .5 + kit.hash01(tx, ty, 3) * .3
            pts = [(cx + r * math.cos(a), cy + .5 * r * math.sin(a) - s * fx.lift(d, hz)) for a in np.linspace(0, math.tau, 12)
                   for s in (0, 1)]
            if kit.core_inside(pts, footprint, 1.3):
                d.sphere(f'ground-hedge-{j}', d.world(cx, cy, hz * .55), (r / 16, r / 16, hz * .5),
                         'sp-hedge' if j % 2 else 'sp-hedge-light')
                j += 1
    return ['red-track-oval', 'grass-infield', 'hurdles', 'goal-with-net', 'hedges']


def hurdle(d, name, record, footprint, height, bar_mat):
    window = containment.source_window(record)
    x, y, w, h = window
    cx, cy = x + w / 2, y + h - 7.0
    half = 8.0
    pts = []
    for s in (-1, 1):
        px = cx + s * half
        pts += [(px - 1.5, cy + 1), (px + 1.5, cy + 1), scr(d, px, cy, height + .1), (px, cy - 3.4)]
    check(name, pts, footprint, window)
    for s in (-1, 1):
        px = cx + s * half
        fx.pipe(d, f'{name}-foot-{s}', [(px, cy + .6, .03), (px, cy - 3.2, .03)], .04, 'sp-steel')
        fx.pipe(d, f'{name}-leg-{s}', [(px, cy, .03), (px, cy, height)], .035, 'sp-steel')
    stripes = 6
    for k in range(stripes):
        a = cx - half + 2 * half * k / stripes
        b = cx - half + 2 * half * (k + 1) / stripes
        quad = [(a, cy - .25), (b, cy - .25), (b, cy + .25), (a, cy + .25)]
        fx.prism(d, f'{name}-board-{k}', quad, height - .16, height, bar_mat if k % 2 else 'sp-white', .002)
    return (cx, cy)


GOAL = {'mouth': ((60.0, 162.0), (132.0, 162.0)), 'back': ((84.0, 189.0), (108.0, 189.0)), 'h': 1.85, 'hb': 1.25}


def goal_lines(d):
    """Every frame tube and net line of the goal as (a3, b3, radius, material)."""
    (ml, mr), (bl, br) = GOAL['mouth'], GOAL['back']
    h, hb = GOAL['h'], GOAL['hb']
    P = {'ml0': (*ml, .03), 'mr0': (*mr, .03), 'ml1': (*ml, h), 'mr1': (*mr, h),
         'bl0': (*bl, .03), 'br0': (*br, .03), 'bl1': (*bl, hb), 'br1': (*br, hb)}
    frame = [('ml0', 'ml1'), ('mr0', 'mr1'), ('ml1', 'mr1'), ('bl0', 'bl1'), ('br0', 'br1'), ('bl1', 'br1'),
             ('ml1', 'bl1'), ('mr1', 'br1'), ('ml0', 'bl0'), ('mr0', 'br0'), ('bl0', 'br0')]
    lines = [(P[a], P[b], .055, 'sp-white') for a, b in frame]

    def lerp(p, q, t):
        return tuple(p[i] + (q[i] - p[i]) * t for i in range(3))
    faces = [('ml0', 'ml1', 'bl1', 'bl0'), ('mr0', 'mr1', 'br1', 'br0'), ('bl0', 'bl1', 'br1', 'br0'),
             ('ml1', 'mr1', 'br1', 'bl1')]
    for a0, a1, b1, b0 in faces:
        p00, p01, p11, p10 = P[a0], P[a1], P[b1], P[b0]
        width = math.dist(p00[:2], p10[:2]) + math.dist(p01[:2], p11[:2])
        n_u = max(3, int(width / 2 / 3.0))
        for i in range(1, n_u):
            t = i / n_u
            lines.append((lerp(p00, p10, t), lerp(p01, p11, t), .016, 'sp-net'))
        n_v = 5
        for j in range(1, n_v):
            t = j / n_v
            lines.append((lerp(p00, p01, t), lerp(p10, p11, t), .016, 'sp-net'))
    return lines


def goal_core(d, field):
    """Partition every goal line among the three goal windows; the rest stays core."""
    cells = [(i, field['objects'][i]) for i in (0, 1, 2)]
    pieces_out = []
    for n, (a, b, radius, mat) in enumerate(goal_lines(d)):
        sa, sb = scr(d, *a), scr(d, *b)
        for k, piece in enumerate(partition_segment(sa, sb, cells, margin=1.4)):
            pa = tuple(a[i] + (b[i] - a[i]) * piece['t0'] for i in range(3))
            pb = tuple(a[i] + (b[i] - a[i]) * piece['t1'] for i in range(3))
            owner = piece['owner']
            d.LAYER = 'base' if owner is None else 'decor'
            obj = fx.pipe(d, f'goal-line-{n:03d}-{k}', [pa, pb], radius, mat)
            if owner is not None:
                record = field['objects'][owner]
                obj['sourceObjectOrdinal'] = owner
                obj['sourceAnchorNative'] = record['placement']
                obj['objectSequenceId'] = record['sequenceId']
                obj['objectRole'] = 'goal-frame-and-net-section'
            pieces_out.append({'line': n, 'owner': owner, 't0': piece['t0'], 't1': piece['t1']})
    d.LAYER = 'base'
    return pieces_out


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    import json
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_SPORTS_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    if field_id == 'field_cm04_01':
        features = dojo_core(d, footprint)
    else:
        features = ground_core(d, footprint)
        bpy.context.scene['goalLinePartition'] = json.dumps(goal_core(d, field))
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        ordinal, name = record['order'], f"{field_id[6:10]}-{record['order']:02d}"
        if field_id == 'field_cm04_01':
            role, maker = {0: ('hanging-scroll-stand', scroll_stand), 1: ('dojo-pillar', dojo_pillar),
                           2: ('shoji-screen', shoji_screen)}[ordinal]
            anchor = maker(d, name, record, footprint)
        elif ordinal == 3:
            role, anchor = 'low-hurdle', hurdle(d, name + '-hurdle', record, footprint, 1.0, 'sp-bar-red')
        elif ordinal == 4:
            role, anchor = 'tall-hurdle', hurdle(d, name + '-hurdle', record, footprint, 1.25, 'dj-ink')
        else:
            role = 'goal-frame-and-net-section'
            owned = [o for o in bpy.context.scene.objects if o.get('sourceObjectOrdinal') == ordinal]
            pts = [p for o in owned for p in containment._points(d, [o]).tolist()]
            anchor = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
        containment.register_anchor(field_id, ordinal, anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = ordinal
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = record['sequenceId']
            obj['objectRole'] = role
        for obj in bpy.context.scene.objects:
            if obj.get('sourceObjectOrdinal') == ordinal:
                obj['sourceCellId'] = cell_id
        anchors.append({'sourceOrdinal': ordinal, 'sequenceId': record['sequenceId'], 'role': role,
                        'anchorNative': record['placement'], 'phase': phase, 'phases': phases})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
