"""Original variable-window family for the opus round: hot spring (cm19), power plant (cm22).

Both fields have an object whose animation frames carry their own size and
pivot, so every object is built per cell from the bound frame geometry and
contained with ``cage_opus_containment_v2`` (each frame inside its own window).

Field intent, from local research only (see each VISUAL_BRIEF.md):

* cm19 hot spring: an open-air bath.  A dark, clear pool fills the two middle
  bays on a cobbled floor; mossy boulders and a slab-stone ledge sit at the
  back, small mossy rocks in and around the water, wooden tubs, a stool, two
  stone lanterns, bamboo screens at both ends, and a wooden spring box whose
  bamboo spout pours into the pool.  The pool-wide object alternates a full
  frame with an almost empty one; here that is ripples and steam over the
  water, then a single small wisp.
* cm22 power plant: a substation yard on asphalt.  Lattice towers and gantry
  breaker bays with insulator bushings; a striped storage tank at the back and
  switchgear cabinets in the lower bay.  Each arc object strikes the bay it is
  paired with (the nearest bay anchor): two bright bolt frames, one breaking
  frame, then a long-held small spark at the bay's foot.

Every prop is fitted into its own source window and inside the hex union at
design time, with the exact union distance, so the containment pass verifies
rather than moves it.  Research rasters were viewed locally only; none is
loaded, traced, sampled or exported.
"""
import json
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx


FIELDS = ('field_cm19_01', 'field_cm22_01')
VARIABLE_WINDOW_FIELDS = FIELDS
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm19_01': 'hs-cobble', 'field_cm22_01': 'pw-asphalt'}
DEPENDENCIES = ('cage_opus_facility_authoring',)
CONTRACTS = {}
CONFLICTS = []
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35     # native px kept inside the union (containment needs 1.0)
CROP_Y = 24.0            # the cage board hides native rows above this line
LANTERN_HEIGHT = 1.05    # one height for every lantern instance (same source sequence)

PALETTE = {
    # name: (base colour, roughness, metallic, emission strength)
    'pw-steel': ((.66, .70, .72), .38, .55, 0),
    'pw-steel-dark': ((.18, .20, .22), .45, .40, 0),
    'pw-insulator': ((.80, .74, .62), .28, .0, 0),
    'pw-insulator-cap': ((.36, .38, .40), .40, .30, 0),
    'pw-tank-red': ((.72, .07, .05), .40, .05, 0),
    'pw-tank-white': ((.88, .89, .88), .36, .05, 0),
    'pw-breaker': ((.42, .50, .50), .44, .25, 0),
    'pw-fin': ((.26, .32, .32), .50, .25, 0),
    'pw-cabinet': ((.62, .78, .84), .40, .10, 0),
    'pw-cabinet-vent': ((.30, .40, .44), .50, .10, 0),
    'pw-concrete': ((.56, .56, .54), .82, .0, 0),
    'pw-line': ((.84, .82, .72), .70, .0, 0),
    'pw-trench': ((.07, .075, .08), .75, .0, 0),
    'pw-wire': ((.08, .08, .09), .60, .0, 0),
    'pw-arc': ((.86, .98, 1.0), .20, .0, 16.0),
    'pw-arc-glow': ((.16, .74, 1.0), .20, .0, 6.0),
    'pw-led-amber': ((1.0, .55, .06), .30, .0, 4.0),
    'hs-rock': ((.24, .27, .26), .82, .0, 0),
    'hs-rock-light': ((.36, .39, .37), .80, .0, 0),
    'hs-moss': ((.24, .42, .20), .90, .0, 0),
    'hs-slab': ((.40, .42, .40), .78, .0, 0),
    'hs-bamboo': ((.74, .62, .30), .55, .0, 0),
    'hs-bamboo-light': ((.84, .74, .42), .55, .0, 0),
    'hs-binding': ((.22, .13, .07), .80, .0, 0),
    'hs-wood': ((.70, .46, .20), .60, .0, 0),
    'hs-wood-dark': ((.36, .20, .08), .70, .0, 0),
    'hs-wood-light': ((.86, .70, .40), .60, .0, 0),
    'hs-stone': ((.52, .52, .48), .84, .0, 0),
    'hs-stone-dark': ((.34, .34, .32), .86, .0, 0),
    'hs-lantern-light': ((1.0, .62, .22), .30, .0, 5.0),
    'hs-stream': ((.62, .90, .92), .10, .0, 1.6),
    'hs-ripple': ((.26, .50, .49), .20, .0, .45),
    'hs-pipe': ((.36, .58, .22), .50, .0, 0),
}

FLOORS = {
    # Substation yard: large asphalt plates with pale expansion joints.
    'pw-asphalt': ((.060, .064, .068), (.20, .20, .19), 3.0, .012),
}


# --------------------------------------------------------------------------- materials

def _cobble_material(d, name):
    """Irregular rounded cobbles: Voronoi stones, dark joints, a little relief."""
    mat = d.material(name, (.40, .42, .41), .80, .0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry = nodes.new('ShaderNodeNewGeometry')
    stones = nodes.new('ShaderNodeTexVoronoi')
    stones.feature = 'F1'
    edges = nodes.new('ShaderNodeTexVoronoi')
    edges.feature = 'DISTANCE_TO_EDGE'
    for node in (stones, edges):
        node.inputs['Scale'].default_value = 2.8
        node.inputs['Randomness'].default_value = .85
        links.new(geometry.outputs['Position'], node.inputs['Vector'])
    grey = nodes.new('ShaderNodeRGBToBW')
    links.new(stones.outputs['Color'], grey.inputs[0])
    tone = nodes.new('ShaderNodeValToRGB')
    tone.color_ramp.elements[0].color = (.21, .23, .235, 1)
    tone.color_ramp.elements[1].color = (.37, .385, .38, 1)
    links.new(grey.outputs[0], tone.inputs[0])
    joint = nodes.new('ShaderNodeMath')
    joint.operation = 'LESS_THAN'
    joint.inputs[1].default_value = .055
    links.new(edges.outputs['Distance'], joint.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB')
    mix.blend_type = 'MIX'
    links.new(joint.outputs[0], mix.inputs[0])
    links.new(tone.outputs[0], mix.inputs[1])
    mix.inputs[2].default_value = (.095, .10, .10, 1)
    links.new(mix.outputs[0], shader.inputs['Base Color'])
    relief = nodes.new('ShaderNodeMath')
    relief.operation = 'MINIMUM'
    relief.inputs[1].default_value = .25
    links.new(edges.outputs['Distance'], relief.inputs[0])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .45
    bump.inputs['Distance'].default_value = .04
    links.new(relief.outputs[0], bump.inputs['Height'])
    links.new(bump.outputs[0], shader.inputs['Normal'])
    return mat


def _water_material(d, name):
    """Dark clear spring water: the stone bed shows as a soft caustic network."""
    mat = d.material(name, (.03, .14, .145), .08, .0, .12)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry = nodes.new('ShaderNodeNewGeometry')
    bed = nodes.new('ShaderNodeTexVoronoi')
    bed.feature = 'DISTANCE_TO_EDGE'
    bed.inputs['Scale'].default_value = 1.7
    links.new(geometry.outputs['Position'], bed.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .0
    ramp.color_ramp.elements[0].color = (.058, .19, .19, 1)
    ramp.color_ramp.elements[1].position = .055
    ramp.color_ramp.elements[1].color = (.020, .100, .108, 1)
    links.new(bed.outputs['Distance'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    links.new(ramp.outputs['Color'], shader.inputs['Emission Color'])
    return mat


def _steam_volume(d, name):
    """Soft steam: a volume whose density fades to zero at the puff's surface."""
    import bpy
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes.get('Principled BSDF'))
    output = nodes.get('Material Output')
    volume = nodes.new('ShaderNodeVolumePrincipled')
    volume.inputs['Color'].default_value = (.94, .96, .96, 1)
    volume.inputs['Emission Color'].default_value = (.92, .95, .95, 1)
    volume.inputs['Emission Strength'].default_value = .25
    coords = nodes.new('ShaderNodeTexCoord')
    radial = nodes.new('ShaderNodeVectorMath')
    radial.operation = 'LENGTH'
    links.new(coords.outputs['Object'], radial.inputs[0])
    falloff = nodes.new('ShaderNodeMapRange')
    falloff.inputs['From Min'].default_value = 1.0
    falloff.inputs['From Max'].default_value = .15
    falloff.inputs['To Min'].default_value = 0.0
    falloff.inputs['To Max'].default_value = 1.0
    links.new(radial.outputs['Value'], falloff.inputs['Value'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2.4
    noise.inputs['Detail'].default_value = 3.0
    links.new(coords.outputs['Object'], noise.inputs['Vector'])
    shaped = nodes.new('ShaderNodeMath')
    shaped.operation = 'MULTIPLY'
    links.new(falloff.outputs['Result'], shaped.inputs[0])
    links.new(noise.outputs['Fac'], shaped.inputs[1])
    density = nodes.new('ShaderNodeMath')
    density.operation = 'MULTIPLY'
    density.inputs[1].default_value = 9.0
    links.new(shaped.outputs[0], density.inputs[0])
    links.new(density.outputs[0], volume.inputs['Density'])
    links.new(volume.outputs[0], output.inputs['Volume'])
    d.M[name] = mat
    return mat


def _translucent(d, name, color, alpha, emission):
    mat = d.material(name, color, .60, .0, emission)
    mat.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = alpha
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    for name, (tile, joint, period, width) in FLOORS.items():
        if name not in d.M:
            fx._floor_material(d, name, tile, joint, period, width)
    if 'hs-cobble' not in d.M:
        _cobble_material(d, 'hs-cobble')
    if 'hs-water' not in d.M:
        _water_material(d, 'hs-water')
    if 'hs-steam' not in d.M:
        _translucent(d, 'hs-steam', (.97, .98, .98), .24, .40)
    if 'hs-steam-volume' not in d.M:
        _steam_volume(d, 'hs-steam-volume')
    if 'pw-arc-halo' not in d.M:
        _translucent(d, 'pw-arc-halo', (.30, .80, 1.0), .40, 4.0)


# --------------------------------------------------------------------------- fitting

def depth(points, footprint):
    return containment._union_depth(points, footprint)


def inside(points, footprint, window, margin=DESIGN_MARGIN):
    """Every screen point at least ``margin`` inside the field and inside the window."""
    import numpy as np
    pts = np.asarray(points, dtype=float).reshape(-1, 2)
    x, y, w, h = window
    edge = .12
    if (pts[:, 0].min() < x + edge or pts[:, 0].max() > x + w - edge
            or pts[:, 1].min() < y + edge or pts[:, 1].max() > y + h - edge):
        return False
    return bool(depth(pts, footprint).min() >= margin)


def silhouette(cx, cy, r, rise, n=24):
    """Conservative screen outline of a round prop: its ground ellipse swept up by ``rise``."""
    pts = []
    for i in range(n):
        a = i * math.tau / n
        for t in (0.0, .5, 1.0):
            pts.append((cx + r * math.cos(a), cy + .5 * r * math.sin(a) - t * rise))
    return pts


_FITS = {}


def place_round(d, footprint, window, r_max, height, prefer, r_min=1.6, steps=(1.0, .8, .62, .45)):
    """Largest round footprint (radius, then height) that fits; nearest to ``prefer``.

    Returns ``(cx, cy, r, height)`` or ``None``.  Deterministic, so every cell
    of every pass rebuilds the identical prop.
    """
    key = (footprint['fieldId'], tuple(round(v, 3) for v in window), round(r_max, 3), round(height, 3),
           tuple(round(v, 3) for v in prefer), r_min)
    if key in _FITS:
        return _FITS[key]
    x, y, w, h = window
    result = None
    for scale in steps:
        hz = height * scale
        rise = fx.lift(d, hz)
        r = r_max
        while r >= r_min and result is None:
            best = None
            if w > 2 * r + .4 and h > r + rise + .4:
                for i in range(21):
                    cx = x + r + .2 + (w - 2 * r - .4) * i / 20
                    for j in range(21):
                        cy = y + r / 2 + rise + .2 + (h - r - rise - .4) * j / 20
                        if inside(silhouette(cx, cy, r, rise), footprint, window):
                            score = math.dist((cx, cy), prefer)
                            if best is None or score < best[0]:
                                best = (score, cx, cy)
            if best:
                result = (best[1], best[2], r, hz)
            r *= .9
        if result:
            break
    _FITS[key] = result
    return result


def deepest_point(window, footprint, clearance, samples=33):
    """The point of a window, at least ``clearance`` from its sides, deepest inside the field."""
    import numpy as np
    x, y, w, h = window
    xs = np.linspace(x + clearance, x + w - clearance, samples)
    ys = np.linspace(y + clearance, y + h - clearance, samples)
    grid = np.array([(a, b) for a in xs for b in ys])
    values = depth(grid, footprint)
    index = int(values.argmax())
    return (float(grid[index][0]), float(grid[index][1])), float(values[index])


def headroom(footprint, x0, x1, ground_y, margin=DESIGN_MARGIN, step=.5):
    """Screen pixels free straight above a ground line before the field's outline."""
    import numpy as np
    xs = np.linspace(x0, x1, 9)
    y = ground_y
    while y > ground_y - 160:
        points = np.stack([xs, np.full_like(xs, y)], axis=1)
        if depth(points, footprint).min() < margin:
            break
        y -= step
    return ground_y - y


def pull_inside(point, anchor, footprint, window, margin, extent=0.0):
    """Move a screen point toward ``anchor`` until a feature of half-size ``extent`` fits."""
    x, y, w, h = window
    inner = (x + extent, y + extent, w - 2 * extent, h - 2 * extent)
    px, py = point
    for _ in range(80):
        if inside([(px, py)], footprint, inner, margin):
            return (px, py)
        px, py = px + (anchor[0] - px) * .12, py + (anchor[1] - py) * .12
    return (px, py)


def ring(d, name, cx, cy, r, z, radius, mat, n=24):
    """A closed tube along a ground ellipse at height ``z`` (ripples, hoops, rails)."""
    points = [d.world(cx + r * math.cos(i * math.tau / n), cy + .5 * r * math.sin(i * math.tau / n), z)
              for i in range(n)]
    return d.curve(name, points, radius, mat, cyclic=True)


def boulder(d, name, cx, cy, r, hz, mat, seed, moss=True):
    """Irregular rounded rock on the 2:1 grid; never wider than its fitted ellipse."""
    n = 16
    levels = [(0.0, 1.0), (.30, .97), (.62, .84), (.86, .58), (1.0, .22)]
    verts = []
    for k, (t, scale) in enumerate(levels):
        for i in range(n):
            a = i * math.tau / n
            wobble = 1.0 - .13 * (.5 + .5 * math.sin(seed * 2.3 + i * 1.7 + k * .9))
            rr = r * scale * wobble
            verts.append(d.world(cx + rr * math.cos(a), cy + .5 * rr * math.sin(a), hz * t))
    faces = []
    for k in range(len(levels) - 1):
        a, b = k * n, (k + 1) * n
        faces += [(a + i, a + (i + 1) % n, b + (i + 1) % n, b + i) for i in range(n)]
    smooth = range(len(faces))
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range((len(levels) - 1) * n, len(levels) * n)))
    fx._object(d, name, verts, faces, mat, 0.0, smooth)
    if moss:
        fx.lathe(d, name + '-moss', cx - r * .08, cy, [(hz * .66, r * .74), (hz * .88, r * .50), (hz * .99, r * .16)],
                 'hs-moss', 16)
    return (cx, cy)


# --------------------------------------------------------------------------- hot spring (cm19)

POOL = [(100, 40), (112, 27), (132, 21), (160, 19), (190, 25), (214, 20), (248, 21), (276, 29), (296, 42),
        (302, 58), (294, 74), (274, 86), (250, 92), (226, 90), (206, 84), (188, 82), (168, 83), (148, 81),
        (128, 77), (110, 69), (99, 55)]


def spring_core(d, footprint):
    """Cobbled bath floor, the pool across the middle bays, and its stone rim."""
    import numpy as np
    for index, piece in enumerate(fit.clip_to_footprint(POOL, footprint, 3.0, .02)):
        fx.prism(d, f'spring-pool-{index}', piece, .004, .016, 'hs-water', 0)
    outline = POOL + POOL[:1]
    k = 0
    for a, b in zip(outline, outline[1:]):
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        steps = max(1, int(length // 6.5))
        for i in range(steps):
            t = (i + .5) / steps
            px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            r = 2.6 + ((k * 37) % 5) * .32
            hz = .20 + ((k * 13) % 3) * .05
            if depth(np.array(silhouette(px, py, r, fx.lift(d, hz))), footprint).min() >= 1.2:
                boulder(d, f'spring-rim-{k:02d}', px, py, r, hz, 'hs-rock-light' if k % 3 else 'hs-rock', k,
                        moss=k % 4 == 0)
            k += 1
    return ['steaming-rock-rimmed-pool', 'cobbled-bath-floor', 'bamboo-screens', 'stone-lanterns',
            'wooden-tubs', 'spring-box-spout']


def single_rock(d, name, record, window, footprint, r_max, height, moss=True, seed=1, prefer=None):
    fitted = place_round(d, footprint, window, r_max, height, prefer or tuple(record['placement']), r_min=1.2)
    if fitted is None:
        point, best = deepest_point(window, footprint, 1.6)
        CONFLICTS.append({'fieldId': footprint['fieldId'], 'ordinal': record['order'],
                          'reason': 'ROCK_DID_NOT_FIT_SMALLEST_SIZE', 'window': list(window),
                          'deepestInsideNativePx': round(best, 3)})
        fitted = (point[0], point[1], 1.0, .1)
    cx, cy, r, hz = fitted
    return boulder(d, name, cx, cy, r, hz, 'hs-rock' if seed % 2 else 'hs-rock-light', seed, moss)


def boulder_wall(d, name, record, window, footprint, count=4):
    """A low wall of mossy boulders across a wide window, fitted rock by rock."""
    x, y, w, h = window
    made = []
    for i in range(count):
        x0 = max(x, x + w * i / count - 2)
        x1 = min(x + w, x + w * (i + 1) / count + 2)
        sub = (x0, y, x1 - x0, h)
        fitted = place_round(d, footprint, sub, min(sub[2] / 2 - .6, 11.0), .95, (x0 + sub[2] / 2, y + h), r_min=2.2)
        if fitted:
            cx, cy, r, hz = fitted
            made.append(boulder(d, f'{name}-{i}', cx, cy, r, hz, 'hs-rock' if i % 2 else 'hs-rock-light', i + 3))
    if not made:
        made.append(single_rock(d, name + '-0', record, window, footprint, 6.0, .5))
    return made[len(made) // 2]


def slab_ledge(d, name, record, window, footprint):
    """Flat slab stones stacked into a low ledge."""
    fitted = place_round(d, footprint, window, min(window[2] / 2 - 1, 15.0), .48, tuple(record['placement']))
    if fitted is None:
        return single_rock(d, name, record, window, footprint, 8.0, .4)
    cx, cy, r, hz = fitted
    # Three irregular flat stones, each smaller and set back on the one below;
    # every stone stays inside the fitted footprint (radius + offset <= r).
    layers = ((0.0, 1.0, 0.0, 0.0), (.36, .74, -.16, -.10), (.68, .46, .05, -.20))
    for k, (z0, scale, ox, oy) in enumerate(layers):
        rr = r * scale
        thickness = hz * .34
        stone = (cx + ox * r, cy + oy * r * .5)
        mat = ('hs-rock-light', 'hs-slab', 'hs-rock-light')[k]
        boulder_flat(d, f'{name}-slab-{k}', stone[0], stone[1], rr, hz * z0, thickness, mat, k + 5)
    fx.lathe(d, name + '-moss', cx - r * .05, cy - r * .1, [(hz * 1.0, r * .20), (hz * 1.04, r * .07)], 'hs-moss', 12)
    return (cx, cy)


def boulder_flat(d, name, cx, cy, r, z0, thickness, mat, seed):
    """A flat slab stone with a rounded, irregular rim."""
    n = 18
    levels = [(0.0, .93), (.45, 1.0), (1.0, .90)]
    verts = []
    for k, (t, scale) in enumerate(levels):
        for i in range(n):
            a = i * math.tau / n
            wobble = 1.0 - .12 * (.5 + .5 * math.sin(seed * 1.9 + i * 2.1))
            rr = r * scale * wobble
            verts.append(d.world(cx + rr * math.cos(a), cy + .5 * rr * math.sin(a), z0 + thickness * t))
    faces = []
    for k in range(len(levels) - 1):
        a, b = k * n, (k + 1) * n
        faces += [(a + i, a + (i + 1) % n, b + (i + 1) % n, b + i) for i in range(n)]
    smooth = range(len(faces))
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range((len(levels) - 1) * n, len(levels) * n)))
    return fx._object(d, name, verts, faces, mat, 0.0, smooth)


def tub_shape(d, name, cx, cy, r, hz):
    """Wooden bath tub: flared staves, two bindings and a dark open top."""
    fx.lathe(d, name + '-staves', cx, cy, [(0, r * .86), (hz, r)], 'hs-wood', 24)
    fx.lathe(d, name + '-inside', cx, cy, [(hz + .004, r * .86), (hz + .006, r * .5)], 'hs-wood-dark', 24)
    for k, t in enumerate((.25, .72)):
        ring(d, f'{name}-band-{k}', cx, cy, r * (.86 + .14 * t) + .10, hz * t, .022, 'hs-binding')
    return (cx, cy)


def tub(d, name, record, window, footprint):
    fitted = place_round(d, footprint, window, min(window[2] / 2 - 1.2, 8.0), .48, tuple(record['placement']))
    if fitted is None:
        return single_rock(d, name, record, window, footprint, 4.0, .3, moss=False)
    cx, cy, r, hz = fitted
    return tub_shape(d, name, cx, cy, r - .25, hz)


def tub_stack(d, name, record, window, footprint):
    """Three tubs: two on the floor side by side, one upturned on top."""
    x, y, w, h = window
    fitted = place_round(d, footprint, window, min(w / 2 - 1.0, 15.0), .95, tuple(record['placement']))
    if fitted is None:
        return tub(d, name, record, window, footprint)
    cx, cy, big, hz = fitted
    r = big / 2
    for k, sign in enumerate((-1, 1)):
        tub_shape(d, f'{name}-{k}', cx + sign * r, cy, r - .3, hz * .47)
    fx.lathe(d, name + '-top', cx, cy - .3, [(hz * .49, r * .92), (hz * .93, r * .78)], 'hs-wood-light', 24)
    fx.lathe(d, name + '-top-base', cx, cy - .3, [(hz * .93, r * .78), (hz * .95, r * .55)], 'hs-wood', 24)
    ring(d, name + '-top-band', cx, cy - .3, r * .88, hz * .70, .022, 'hs-binding')
    return (cx, cy)


def stool(d, name, record, window, footprint):
    fitted = place_round(d, footprint, window, min(window[2] / 2 - 1.2, 5.5), .52, tuple(record['placement']))
    cx, cy, r, hz = fitted
    a = r * .52
    fx.box(d, name + '-seat', cx, cy, a, a * .82, hz - .10, hz, 'hs-wood-light', .010)
    for sign in (-1, 1):
        px, py = cx + sign * a * .72 * U[0], cy + sign * a * .72 * U[1]
        fx.box(d, f'{name}-leg-{"l" if sign < 0 else "r"}', px, py, .32, a * .70, 0, hz - .10, 'hs-wood', .004)
    return (cx, cy)


_RECORDS = {}
_SCREENS = {}


def later_limits(record, window, footprint):
    """Ground-y ceilings from props the board draws after this one (larger anchor y).

    Where such a prop's window overlaps this one horizontally, this prop's base
    has to stay behind it; otherwise the 3D render and the runtime draw order
    would disagree about which one is in front.  Water overlays are exempt.
    """
    x, y, w, h = window
    limits = []
    for other in _RECORDS.get(footprint['fieldId'], ()):
        if other['order'] == record['order'] or other['placement'][1] <= record['placement'][1]:
            continue
        if footprint['fieldId'] == 'field_cm19_01' and other['sequenceId'] == 11:
            continue
        ox, oy, ow, oh = containment.source_window(other)
        if ox < x + w and ox + ow > x and oy < y + h and oy + oh > y:
            limits.append((ox - 1.0, ox + ow + 1.0, other['placement'][1] - 3.0))
    return limits


def screen_layout(record, window, footprint, pole):
    """Span and ground line of a bamboo screen: tallest legal screen, kept behind later props."""
    key = (footprint['fieldId'], record['order'])
    if key in _SCREENS:
        return _SCREENS[key]
    x, y, w, h = window
    limits = later_limits(record, window, footprint)
    best = None
    for span in (12.0, 10.0, 8.0, 6.5):
        if 2 * (span + pole) > w - .6:
            continue
        for i in range(17):
            cx = x + pole + span + .3 + (w - 2 * (pole + span) - .6) * i / 16
            for j in range(90):
                cy = y + h - 1.0 - span / 2 - j * .75
                if cy - span / 2 < y + 4:
                    break
                bases = [(cx + t * span * V[0], cy + t * span * V[1]) for t in (-1, -.5, 0, .5, 1)]
                foot = [(bx + dx, by + dy) for bx, by in bases for dx, dy in ((-pole, 0), (pole, 0), (0, .6))]
                if not inside(foot, footprint, window):
                    continue
                if any(lo <= bx <= hi and by > ceiling for bx, by in bases for lo, hi, ceiling in limits):
                    continue
                room = min(min(headroom(footprint, bx - pole, bx + pole, by), by - (y + .6)) for bx, by in bases)
                score = min(room, 26.0) + .8 * span
                if best is None or score > best[0]:
                    best = (score, span, cx, cy, room)
                break
    _SCREENS[key] = best[1:]
    return _SCREENS[key]


def bamboo_screen(d, name, record, window, footprint):
    """A tall screen of tightly packed bamboo poles with two rope bindings."""
    x, y, w, h = window
    pole = 1.05
    span, cx, cy, room = screen_layout(record, window, footprint, pole)
    poles = max(3, int(span * 2 / 2.3))
    bases = [(cx + (-1 + 2 * i / poles) * span * V[0], cy + (-1 + 2 * i / poles) * span * V[1])
             for i in range(poles + 1)]
    room = min(min(headroom(footprint, px - pole, px + pole, py), py - (y + .6)) for px, py in bases)
    zt = max(.8, min(2.5, (room - 1.2) / fx.lift(d, 1)))
    for i, (px, py) in enumerate(bases):
        top = zt * (1.0 - .05 * ((i * 7) % 3) / 2)
        fx.cylinder(d, f'{name}-pole-{i:02d}', px, py, pole, 0, top, 'hs-bamboo' if i % 3 else 'hs-bamboo-light', 10)
        fx.cylinder(d, f'{name}-node-{i:02d}', px, py, pole + .07, top * .48, top * .48 + .03, 'hs-bamboo-light', 10)
    a = (cx - span * V[0], cy - span * V[1])
    b = (cx + span * V[0], cy + span * V[1])
    for k, z in enumerate((zt * .22, zt * .70)):
        fx.pipe(d, f'{name}-binding-{k}', [(a[0] - .4, a[1] + 1.0, z), (b[0] - .4, b[1] + 1.0, z)], .045, 'hs-binding')
    return (cx, cy)


def stone_lantern(d, name, record, window, footprint):
    """Garden stone lantern, low enough to stay below the board's crop line."""
    x, y, w, h = window
    fitted = place_round(d, footprint, window, min(w / 2 - 1.0, 4.4), LANTERN_HEIGHT + .2, (x + w / 2, y + h))
    cx, cy, r, _ = fitted
    zt = LANTERN_HEIGHT
    fx.box(d, name + '-plinth', cx, cy, 2.1, 2.1, 0, zt * .12, 'hs-stone-dark', .010)
    fx.cylinder(d, name + '-post', cx, cy, 1.15, zt * .12, zt * .50, 'hs-stone', 10)
    fx.box(d, name + '-shelf', cx, cy, 1.9, 1.9, zt * .50, zt * .58, 'hs-stone', .006)
    fx.box(d, name + '-firebox', cx, cy, 1.45, 1.45, zt * .58, zt * .80, 'hs-stone', .006)
    for side in ('front-left', 'front-right'):
        fx.face_panel(d, f'{name}-window-{side}', cx, cy, 1.45, 1.45, zt * .62, zt * .76, 'hs-lantern-light',
                      side, .35, .5)
    fx.lathe(d, name + '-roof', cx, cy, [(zt * .80, r * .98), (zt * .86, r), (zt * .92, r * .55), (zt * .97, r * .2)],
             'hs-stone-dark', 4)
    fx.ball(d, name + '-finial', cx, cy, zt * .99 + .02, .9, 'hs-stone')
    return (cx, cy)


def spring_spout(d, name, record, window, footprint, phase):
    """Wooden spring box; a bamboo spout pours into the pool (two poses)."""
    x, y, w, h = window
    sub = (x + w * .36, y, w * .64, h)
    fitted = place_round(d, footprint, sub, 6.2, 1.0, (x + w * .66, y + h * .70), r_min=3.0)
    cx, cy, r, hz = fitted
    a = r * .5
    fx.box(d, name + '-base', cx, cy, a + .3, a + .3, 0, .10, 'hs-stone-dark', .008)
    fx.box(d, name + '-box', cx, cy, a, a, .10, hz * .82, 'hs-wood', .012)
    fx.box(d, name + '-water', cx, cy, a * .78, a * .78, hz * .82 - .03, hz * .82 - .01, 'hs-water', 0)
    fx.box(d, name + '-rim', cx, cy, a * .98, a * .98, hz * .82, hz * .86, 'hs-wood-dark', .004)
    root = (cx - a * 1.1, cy - .2)
    mouth = pull_inside((x + 4.5, cy + 3.0), (cx, cy), footprint, window, 3.2, 2.2)
    zm = hz * .62
    fx.pipe(d, name + '-spout', [(root[0], root[1], hz * .70), (mouth[0], mouth[1], zm)], .10, 'hs-pipe')
    sway = (0.0, .7)[phase % 2]
    drop = [(mouth[0] - .3, mouth[1], zm - .02), (mouth[0] - .6 - sway, mouth[1] + .4, zm * .5),
            (mouth[0] - .8 - sway, mouth[1] + .8, .03)]
    fx.pipe(d, name + '-stream', drop, .045 + .012 * (phase % 2), 'hs-stream')
    ring(d, name + '-splash', mouth[0] - .8 - sway, mouth[1] + .8, 1.6 + 1.0 * (phase % 2), .03, .022, 'hs-ripple')
    return (cx, cy)


def steam_wisp(d, name, sx, sy, height, sway, footprint, window, seed):
    """Three soft volumetric puffs rising and drifting off the water."""
    puffs = []
    for k, (t, radius) in enumerate(((.22, .30), (.58, .23), (.92, .16))):
        px = sx + sway * (.4 + 1.2 * t) * math.sin(seed + k * .9)
        puffs.append((px, sy, .10 + t * height, radius))
    probe = []
    for px, py, pz, radius in puffs:
        half_w, half_h = radius * d.UNIT, radius * d.UNIT * .88
        screen = (px, py - fx.lift(d, pz))
        probe += [(screen[0] + dx * half_w, screen[1] + dy * half_h) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
    if not inside(probe, footprint, window):
        return False
    for k, (px, py, pz, radius) in enumerate(puffs):
        d.sphere(f'{name}-{k}', d.world(px, py, pz), (radius, radius, radius * .72), 'hs-steam-volume')
    return True


def pool_overlay(d, name, record, footprint, phase):
    """Ripples and steam over the water (full frame) or one small wisp (small frame)."""
    x, y, w, h = containment.source_window(record)
    window = (x, y, w, h)
    if w <= 12:
        point, best = deepest_point(window, footprint, .7)
        r = max(.25, min(.75, best - 1.25))
        if best - r < 1.05:
            CONFLICTS.append({'fieldId': 'field_cm19_01', 'ordinal': record['order'],
                              'cell': record.get('boundCellId'), 'sourceWindow': list(window),
                              'deepestInsideNativePx': round(best, 3),
                              'reason': 'SMALL_FRAME_WINDOW_MOSTLY_OUTSIDE_FIELD',
                              'resolution': 'one small wisp at the deepest legal point of the frame window'})
        z = .02
        fx.ball(d, name + '-wisp', point[0], point[1] + fx.lift(d, z), z, r, 'hs-steam')
        return point
    for k, (cx, cy, r) in enumerate(((151, 46, 7.5), (217, 56, 9.8), (150, 46, 10.8))):
        rr = r + (1.2 if phase % 2 else 0)
        if inside(silhouette(cx, cy, rr + .4, 0), footprint, window):
            ring(d, f'{name}-ripple-{k}', cx, cy, rr, .03, .020, 'hs-ripple', 28)
    wisps = ((132, 60, 1.25, 2.4), (170, 48, 1.45, -2.8), (204, 72, 1.30, 2.6), (238, 46, 1.50, -2.4),
             (270, 64, 1.20, 2.2), (190, 36, 1.10, -2.0))
    anchor = None
    for k, (sx, sy, height, sway) in enumerate(wisps):
        if steam_wisp(d, f'{name}-steam-{k}', sx, sy, height, sway, footprint, window, k * 1.7):
            anchor = anchor or (sx, sy)
    return anchor or (x + w / 2, y + h / 2)


def spring_object(d, record, rect, footprint, phase, phases, contract_object, cell_id):
    seq = record['sequenceId']
    name = f"spring-{record['order']:02d}"
    source = containment.source_window(record)
    if seq == 11:
        return 'pool-ripples-and-steam', pool_overlay(d, name + '-overlay', record, footprint, phase)
    if seq == 0:
        return 'mossy-boulder-wall', boulder_wall(d, name + '-boulders', record, source, footprint)
    if seq == 1:
        return 'slab-stone-ledge', slab_ledge(d, name + '-ledge', record, source, footprint)
    if seq == 2:
        return 'mossy-boulder', single_rock(d, name + '-boulder', record, source, footprint, 13.0, 1.25, seed=2)
    if seq == 3:
        return 'small-mossy-rock', single_rock(d, name + '-rock', record, source, footprint, 8.5, .55,
                                               seed=record['order'])
    if seq == 4:
        return 'pebble-rock', single_rock(d, name + '-pebble', record, source, footprint, 5.0, .45,
                                          seed=record['order'])
    if seq == 5:
        return 'spring-box-spout', spring_spout(d, name + '-spout', record, source, footprint, phase)
    if seq == 6:
        return 'bamboo-screen', bamboo_screen(d, name + '-screen', record, source, footprint)
    if seq == 7:
        return 'stone-lantern', stone_lantern(d, name + '-lantern', record, source, footprint)
    if seq == 8:
        return 'tub-stack', tub_stack(d, name + '-tubs', record, source, footprint)
    if seq == 9:
        return 'wooden-tub', tub(d, name + '-tub', record, source, footprint)
    return 'wooden-stool', stool(d, name + '-stool', record, source, footprint)


# --------------------------------------------------------------------------- power plant (cm22)

TANK = (31.0, 47.0, 12.0)


def power_core(d, footprint):
    """Asphalt yard, painted walkways, a striped tank at the back, switchgear in the lower bay."""
    for k, (direction, z0) in enumerate(((U, .000), (V, .004))):
        cx, cy, half = 96.0, 98.0, 120.0
        nx, ny = -direction[1], direction[0]
        length = math.hypot(nx, ny)
        nx, ny = nx / length * .9, ny / length * .9
        a = (cx - direction[0] * half, cy - direction[1] * half)
        b = (cx + direction[0] * half, cy + direction[1] * half)
        line = [(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)]
        for index, piece in enumerate(fit.clip_to_footprint(line, footprint, 2.0, .01)):
            fx.prism(d, f'power-walkway-{k}-{index}', piece, z0, z0 + .006, 'pw-line', 0)
    trench = [(20, 92), (60, 112), (62, 109), (22, 89)]
    for index, piece in enumerate(fit.clip_to_footprint(trench, footprint, 2.0, .02)):
        fx.prism(d, f'power-trench-{index}', piece, .012, .018, 'pw-trench', 0)
    tx, ty, r = TANK
    room = headroom(footprint, tx - r, tx + r, ty) - r / 2 - 1.0
    zt = max(1.4, min(3.2, room / fx.lift(d, 1)))
    bands = 6
    for k in range(bands):
        z0, z1 = zt * k / bands, zt * (k + 1) / bands
        fx.lathe(d, f'power-tank-band-{k}', tx, ty, [(z0, r), (z1, r)],
                 'pw-tank-red' if k % 2 else 'pw-tank-white', 40, 0, (k == 0, False))
    fx.lathe(d, 'power-tank-roof', tx, ty, [(zt, r), (zt + .14, r * .78), (zt + .22, r * .30), (zt + .24, .2)],
             'pw-tank-white', 40)
    ring(d, 'power-tank-rail', tx, ty, r * .82, zt + .30, .03, 'pw-steel', 32)
    fx.pipe(d, 'power-tank-ladder', [(tx + r * .70, ty + r * .36, .05), (tx + r * .70, ty + r * .36, zt + .1)],
            .05, 'pw-steel-dark')
    window = (56, 150, 80, 46)
    vertex, left, right = fx.corner_arms(footprint, window, 1.6, 9.0)
    for side, (s0, s1) in (('left', left), ('right', right)):
        s0, s1 = max(s0, 9.4), min(s1, 31.0)
        if s1 - s0 < 8:
            continue
        fx.edge_box(d, f'power-pad-{side}', vertex, side, s0 - 1.2, s1 + 1.0, 1.0, 10.0, 0, .12, 'pw-concrete', .008)
        units = max(1, int((s1 - s0) // 7.5))
        step = (s1 - s0) / units
        for i in range(units):
            a0, a1 = s0 + i * step + .35, s0 + (i + 1) * step - .35
            fx.edge_box(d, f'power-cabinet-{side}-{i}', vertex, side, a0, a1, 2.4, 8.2, .12, 1.30, 'pw-cabinet', .012)
            # Louvres and a status lamp on the face toward the viewer (the edge side).
            fx.edge_box(d, f'power-cabinet-vent-{side}-{i}', vertex, side, a0 + .9, a1 - .9, 2.05, 2.4, .30, .80,
                        'pw-cabinet-vent', .003)
            fx.edge_box(d, f'power-cabinet-led-{side}-{i}', vertex, side, a1 - 1.6, a1 - .9, 2.0, 2.4, 1.02, 1.14,
                        'pw-led-amber', 0)
    vx, vy = vertex
    corner = [(vx - a * U[0] + b * V[0], vy - a * U[1] + b * V[1])
              for a, b in ((1.0, 1.0), (10.4, 1.0), (10.4, 10.4), (1.0, 10.4))]
    fx.prism(d, 'power-pad-corner', corner, 0, .12, 'pw-concrete', .008)
    inner = [(vx - a * U[0] + b * V[0], vy - a * U[1] + b * V[1])
             for a, b in ((2.4, 2.4), (8.2, 2.4), (8.2, 8.2), (2.4, 8.2))]
    fx.prism(d, 'power-cabinet-corner', inner, .12, 1.30, 'pw-cabinet', .010)
    return ['lattice-towers', 'gantry-breaker-bays', 'striped-storage-tank', 'switchgear-cabinets',
            'lightning-arc-strikes']


def insulator(d, name, x, y, z0, discs=4, radius=1.3, pitch=.10):
    for k in range(discs):
        z = z0 + k * pitch
        fx.lathe(d, f'{name}-{k}', x, y, [(z, radius * .45), (z + pitch * .35, radius), (z + pitch * .8, radius * .42)],
                 'pw-insulator', 12)
    fx.cylinder(d, name + '-cap', x, y, radius * .40, z0 + discs * pitch, z0 + discs * pitch + .05, 'pw-insulator-cap',
                10)
    return z0 + discs * pitch + .05


def lattice_tower(d, name, record, window, footprint):
    """Steel lattice tower: four legs on a screen diamond, bracing, two cross-arms."""
    x, y, w, h = window
    half = min(w / 2 - 1.8, 5.0)
    cx, cy = x + w / 2, y + h - 2.2 - half / 2
    room = min(headroom(footprint, cx - half - 1, cx + half + 1, cy), cy - (y + .8)) - 2.0
    zt = max(2.0, min(5.0, room / fx.lift(d, 1)))
    legs = [(cx - half, cy), (cx, cy + half / 2), (cx + half, cy), (cx, cy - half / 2)]
    waist = .30
    for i, (px, py) in enumerate(legs):
        fx.box(d, f'{name}-footing-{i}', px, py, .55, .55, 0, .08, 'pw-concrete', 0)
        fx.pipe(d, f'{name}-leg-{i}', [(px, py, .06), (cx + (px - cx) * waist, cy + (py - cy) * waist, zt * .80),
                                       (cx, cy, zt)], .045, 'pw-steel')
    levels = (.18, .38, .58, .80)

    def at(i, level):
        px, py = legs[i]
        k = 1 - (1 - waist) * level / .80
        return (cx + (px - cx) * k, cy + (py - cy) * k, zt * level)
    for level in levels:
        fx.pipe(d, f'{name}-ring-{level:.2f}', [at(i % 4, level) for i in range(5)], .020, 'pw-steel')
    for lo, hi in zip((0.02,) + levels[:-1], levels):
        for face, (i, j) in enumerate(((0, 1), (1, 2))):
            fx.pipe(d, f'{name}-brace-{face}-{lo:.2f}', [at(i, lo), at(j, hi)], .016, 'pw-steel')
            fx.pipe(d, f'{name}-brace-{face}-{lo:.2f}-x', [at(j, lo), at(i, hi)], .016, 'pw-steel')
    for k, (z, span) in enumerate(((zt * .62, half * 1.15), (zt * .80, half * .85))):
        fx.pipe(d, f'{name}-arm-{k}', [(cx - span, cy, z), (cx + span, cy, z)], .035, 'pw-steel')
        for side in (-1, 1):
            fx.pipe(d, f'{name}-string-{k}-{side}', [(cx + side * span, cy, z), (cx + side * span, cy, z - .20)],
                    .012, 'pw-wire')
            insulator(d, f'{name}-insulator-{k}-{side}', cx + side * span, cy, z - .42, 2, .75, .09)
    fx.pipe(d, name + '-spire', [(cx, cy, zt), (cx, cy, zt + .18)], .02, 'pw-steel')
    return (cx, cy)


_BAYS = {}


def bay_layout(record, window, footprint):
    """Ground centre and proportions of a gantry bay; shared with the arc that strikes it."""
    key = (footprint['fieldId'], record['order'])
    if key not in _BAYS:
        x, y, w, h = window
        a, b = min(w / 2 - 3.5, 5.6), 3.2
        cx = x + w / 2
        cy = min(y + h - 6.0, record['placement'][1] + 2.0)

        def outline(cy):
            plinth = fx.quad(cx, cy, a + .7, b + .7)
            posts = [(cx + s * (a + 1.2) * U[0] + o, cy + s * (a + 1.2) * U[1]) for s in (-1, 1) for o in (-.9, .9)]
            return plinth + posts
        while not inside(outline(cy), footprint, window) and cy > y + 20:
            cy -= .5
        _BAYS[key] = {'cx': cx, 'cy': cy, 'a': a, 'b': b, 'tank': 1.15, 'portal': 2.45}
    return _BAYS[key]


def bay_bushings(layout):
    """Ground points of the three bushings (where an arc strikes)."""
    cx, cy, a = layout['cx'], layout['cy'], layout['a']
    out = []
    for k in range(3):
        t = -1 + (2 * k + 1) / 3
        out.append((cx + t * a * .62 * U[0], cy + t * a * .62 * U[1]))
    return out


def gantry_bay(d, name, record, window, footprint):
    """Breaker tank with three bushings under a lattice portal gantry."""
    lay = bay_layout(record, window, footprint)
    cx, cy, a, b = lay['cx'], lay['cy'], lay['a'], lay['b']
    zt = lay['tank']
    room = min(headroom(footprint, cx - a - b - 2, cx + a + b + 2, cy), cy - (window[1] + .8)) - 4.0
    zp = max(zt + .9, min(lay['portal'], room / fx.lift(d, 1)))
    fx.box(d, name + '-plinth', cx, cy, a + .7, b + .7, 0, .12, 'pw-concrete', .008)
    fx.box(d, name + '-tank', cx, cy, a, b, .12, zt, 'pw-breaker', .012)
    for k in range(6):
        t = -1 + (2 * k + 1) / 6
        px, py = cx - b * V[0] + t * a * .86 * U[0], cy - b * V[1] + t * a * .86 * U[1]
        fx.box(d, f'{name}-fin-{k}', px - .55 * V[0], py - .55 * V[1], .22, .55, .20, zt - .14, 'pw-fin', 0)
    tops = [insulator(d, f'{name}-bushing-{k}', bx, by, zt, 4, 1.25, .11)
            for k, (bx, by) in enumerate(bay_bushings(lay))]
    posts = [(cx - (a + 1.2) * U[0], cy - (a + 1.2) * U[1]), (cx + (a + 1.2) * U[0], cy + (a + 1.2) * U[1])]
    for i, (px, py) in enumerate(posts):
        for j, ox in enumerate((-.8, .8)):
            fx.pipe(d, f'{name}-post-{i}-{j}', [(px + ox, py, .0), (px + ox * .5, py, zp)], .035, 'pw-steel')
        for z in (zp * .3, zp * .6, zp * .9):
            fx.pipe(d, f'{name}-post-{i}-tie-{z:.2f}', [(px - .7, py, z), (px + .7, py, z)], .016, 'pw-steel')
    fx.pipe(d, name + '-beam', [(posts[0][0], posts[0][1], zp), (posts[1][0], posts[1][1], zp)], .05, 'pw-steel')
    fx.pipe(d, name + '-beam-low', [(posts[0][0], posts[0][1], zp - .22), (posts[1][0], posts[1][1], zp - .22)],
            .03, 'pw-steel')
    for k, ((bx, by), top) in enumerate(zip(bay_bushings(lay), tops)):
        fx.pipe(d, f'{name}-drop-{k}', [(bx, by, top), (bx, by, zp - .24)], .014, 'pw-wire')
    return (cx, cy)


_PAIRS = {}


def pair_bays(field):
    """Arc object -> the gantry bay whose anchor is nearest (they share a column)."""
    bays = [r for r in field['objects'] if r['sequenceId'] == 1]
    for record in field['objects']:
        if record['sequenceId'] in (5, 6, 7, 8):
            _PAIRS[(field['id'], record['order'])] = min(
                bays, key=lambda b: math.dist(b['placement'], record['placement']))


def bolt_path(top, bottom, seed, segments=7, amplitude=4.2):
    jitter = [math.sin(seed * 3.1 + k * 2.4) + .6 * math.sin(seed * 1.3 + k * 4.1) for k in range(segments)]
    points = [top]
    for k in range(1, segments):
        t = k / segments
        sway = amplitude * jitter[k] * (1 - abs(2 * t - 1) * .35)
        points.append((top[0] + (bottom[0] - top[0]) * t + sway, top[1] + (bottom[1] - top[1]) * t))
    points.append(bottom)
    return points


def arc(d, name, record, footprint):
    """Lightning strike on the paired bay (bolt frames) or its idle spark (small frame)."""
    x, y, w, h = containment.source_window(record)
    window = (x, y, w, h)
    cell = record.get('boundCellId')
    bay = _PAIRS[(footprint['fieldId'], record['order'])]
    lay = bay_layout(bay, containment.source_window(bay), footprint)
    if w <= 20:
        target = (lay['cx'] - 2.0, lay['cy'] + lay['b'] * .5 + 1.5)
        point = pull_inside(target, (x + w / 2, y + h / 2), footprint, window, 3.4, 2.6)
        z = .35
        fx.ball(d, name + '-spark', point[0], point[1] + fx.lift(d, z), z, 1.1, 'pw-arc')
        for k in range(5):
            angle = k * math.tau / 5 + .35
            tip = (point[0] + math.cos(angle) * 2.4, point[1] + math.sin(angle) * 1.6)
            fx.pipe(d, f'{name}-crackle-{k}', [(point[0], point[1] + fx.lift(d, z), z),
                                               (tip[0], tip[1] + fx.lift(d, z), z)], .016, 'pw-arc')
        return point
    seed = {5: 1, 6: 2, 7: 3}.get(cell, 1)
    bushings = bay_bushings(lay)
    strike = (bushings[1][0], bushings[1][1] - fx.lift(d, lay['tank'] + .5))
    margin, extent = 3.1, 1.75
    top = (strike[0] + (-5.0, 6.0, -2.0)[seed - 1], y + 2.0)
    while top[1] < strike[1] - 10 and not inside([top], footprint, (x + extent, y + extent, w - 2 * extent,
                                                                    h - 2 * extent), margin):
        top = (top[0], top[1] + .5)
    path = [pull_inside(p, strike, footprint, window, margin, extent) for p in bolt_path(top, strike, seed)]
    z = 1.2
    lifted = [(px, py + fx.lift(d, z), z) for px, py in path]
    front = [(px, py + fx.lift(d, .25), pz + .25) for px, py, pz in lifted]
    if cell == 7:
        # Breaking frame: the channel falls apart into short dashes, no halo.
        for k, (p0, p1) in enumerate(zip(front, front[1:])):
            if k % 2 == 0:
                mid = tuple(p0[j] + (p1[j] - p0[j]) * .6 for j in range(3))
                fx.pipe(d, f'{name}-dash-{k}', [p0, mid], .030, 'pw-arc')
        return strike
    fx.pipe(d, name + '-glow', lifted, .10, 'pw-arc-glow')
    fx.pipe(d, name + '-core', front, .045, 'pw-arc')
    fork_at = path[2 if seed == 1 else 3]
    fork_end = pull_inside((fork_at[0] + (7 if seed == 1 else -7), fork_at[1] + 9), strike, footprint, window,
                           margin, extent)
    fx.pipe(d, name + '-fork', [(fork_at[0], fork_at[1] + fx.lift(d, z), z),
                                (fork_end[0], fork_end[1] + fx.lift(d, z), z)], .035, 'pw-arc')
    halo = 3.6 + 1.2 * (seed - 1)
    zh = lay['tank'] + .3
    centre = pull_inside((strike[0], strike[1] + fx.lift(d, .2)), (lay['cx'], lay['cy'] - 8), footprint, window,
                         halo + 1.4, halo + .2)
    fx.ball(d, name + '-halo', centre[0], centre[1] + fx.lift(d, zh), zh, halo, 'pw-arc-halo')
    for k, (bx, by) in enumerate(bushings):
        glint = (bx, by - fx.lift(d, lay['tank'] + .45))
        if inside([(glint[0] - 1.3, glint[1] - 1.3), (glint[0] + 1.3, glint[1] + 1.3)], footprint, window, 1.5):
            fx.ball(d, f'{name}-bushing-glow-{k}', bx, by, lay['tank'] + .45, 1.2, 'pw-arc')
    return strike


def power_object(d, record, rect, footprint, phase, phases, contract_object, cell_id):
    seq = record['sequenceId']
    name = f"power-{record['order']:02d}"
    source = containment.source_window(record)
    if seq == 0:
        return 'lattice-tower', lattice_tower(d, name + '-tower', record, source, footprint)
    if seq == 1:
        return 'gantry-breaker-bay', gantry_bay(d, name + '-bay', record, source, footprint)
    return 'arc-strike', arc(d, name + '-arc', record, footprint)


# --------------------------------------------------------------------------- entry point

CORES = {'field_cm19_01': spring_core, 'field_cm22_01': power_core}
OBJECTS = {'field_cm19_01': spring_object, 'field_cm22_01': power_object}


def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_VARIABLE_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    _RECORDS[field_id] = field['objects']
    if field_id == 'field_cm22_01':
        pair_bays(field)
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
            obj['boundFrameCellId'] = record.get('boundCellId', cell_id)
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': record['sequenceId'], 'role': role,
                        'anchorNative': record['placement'], 'boundCellId': record.get('boundCellId'),
                        'phase': phase, 'phases': phases})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    conflicts = [c for c in CONFLICTS if c.get('fieldId') == field_id]
    if conflicts:
        features = features + ['source-frame-conflict-reported']
        bpy.context.scene['opusSourceFrameConflicts'] = json.dumps(conflicts[-8:])
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
