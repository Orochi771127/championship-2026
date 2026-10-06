"""Original authoring for the last three FAIL fields of the opus round.

* cm27 ring: a raised boxing ring.  The ring is drawn smaller than the old
  candidate so its corner posts clear the hex outline; ropes are continuous 3D
  lines split at the source windows by ``partition_segment`` (each span owned
  by exactly one object, uncovered spans stay core), lighting rigs stand behind.
* cm12 jungle: palms and banana plants are whole trees (trunk + crown) designed
  into each 64x48 window; the core is a mossy floor with ferns, a rafflesia,
  and rock faces along the two vertical outer edges.
* cm01 vacant lot: packed dirt with grass margins, a stack of concrete pipes,
  a tree and plank fences at the back edge.

Every prop is fitted into its own window and inside the hex union at design
time (exact union distance), so containment verifies rather than moves.
Research rasters were viewed locally only; nothing is loaded or traced, and the
original ring logo is not used.
"""
import json
import math
from pathlib import Path

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from .cage_authoring_coordinates import partition_segment


FIELDS = ('field_cm01_01', 'field_cm12_01', 'field_cm27_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm01_01': 'vl-dirt', 'field_cm12_01': 'jg-floor', 'field_cm27_01': 'ar-floor'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_authoring_coordinates')
CONTRACTS = {}
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35
CROP_Y = 24.0
ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']

PALETTE = {
    'ar-apron': ((.05, .16, .42), .55, .0, 0),
    'ar-trim': ((.86, .88, .90), .40, .0, 0),
    'ar-canvas': ((.18, .52, .72), .45, .0, 0),
    'ar-canvas-edge': ((.10, .36, .56), .50, .0, 0),
    'ar-gold': ((.92, .70, .22), .40, .30, 0),
    'ar-post': ((.10, .11, .13), .40, .45, 0),
    'ar-pad-red': ((.80, .08, .06), .50, .0, 0),
    'ar-pad-blue': ((.08, .22, .80), .50, .0, 0),
    'ar-pad-white': ((.88, .88, .86), .50, .0, 0),
    'ar-rope': ((.92, .92, .90), .45, .0, 0),
    'ar-rope-red': ((.82, .10, .08), .45, .0, 0),
    'ar-step': ((.62, .64, .66), .55, .10, 0),
    'ar-stool': ((.07, .07, .08), .50, .0, 0),
    'ar-glove': ((.78, .06, .05), .35, .0, 0),
    'ar-glove-cuff': ((.92, .92, .90), .50, .0, 0),
    'ar-truss': ((.55, .58, .60), .35, .70, 0),
    'ar-lamp': ((.10, .10, .11), .45, .30, 0),
    'ar-lens': ((1.0, .92, .72), .20, .0, 6.0),
    'jg-trunk': ((.36, .26, .16), .80, .0, 0),
    'jg-trunk-ring': ((.25, .17, .10), .85, .0, 0),
    'jg-frond': ((.07, .33, .08), .55, .0, 0),
    'jg-frond-light': ((.17, .48, .12), .55, .0, 0),
    'jg-banana': ((.16, .46, .10), .50, .0, 0),
    'jg-bush': ((.05, .26, .06), .60, .0, 0),
    'jg-bush-light': ((.13, .40, .09), .60, .0, 0),
    'jg-vine': ((.10, .34, .08), .70, .0, 0),
    'jg-coconut': ((.30, .20, .08), .70, .0, 0),
    'jg-fern': ((.13, .40, .12), .60, .0, 0),
    'jg-fern-light': ((.26, .52, .16), .60, .0, 0),
    'jg-petal': ((.72, .16, .10), .55, .0, 0),
    'jg-petal-spot': ((.94, .86, .78), .60, .0, 0),
    'jg-flower-core': ((.30, .08, .06), .70, .0, 0),
    'jg-rock': ((.34, .25, .17), .88, .0, 0),
    'jg-rock-dark': ((.22, .16, .11), .90, .0, 0),
    'jg-moss': ((.14, .34, .09), .90, .0, 0),
    'jg-root': ((.30, .22, .13), .80, .0, 0),
    'vl-pipe': ((.70, .71, .70), .80, .0, 0),
    'vl-pipe-inner': ((.30, .30, .29), .85, .0, 0),
    'vl-plank': ((.56, .36, .18), .75, .0, 0),
    'vl-plank-dark': ((.40, .25, .12), .80, .0, 0),
    'vl-trunk': ((.32, .22, .13), .80, .0, 0),
    'vl-leaf': ((.18, .46, .14), .65, .0, 0),
    'vl-leaf-light': ((.30, .58, .18), .65, .0, 0),
    'vl-pebble': ((.62, .60, .56), .80, .0, 0),
    'vl-grass': ((.24, .50, .14), .70, .0, 0),
}


# --------------------------------------------------------------------------- materials

def _noise_mix(d, name, base, other, scale, threshold, soft=.08, roughness=.85, spots=None):
    """Ground material: two colours mixed by noise patches, optional small spots."""
    mat = d.material(name, base, roughness, .0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry = nodes.new('ShaderNodeNewGeometry')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 4.0
    links.new(geometry.outputs['Position'], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = threshold - soft
    ramp.color_ramp.elements[0].color = (*base, 1)
    ramp.color_ramp.elements[1].position = threshold + soft
    ramp.color_ramp.elements[1].color = (*other, 1)
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    colour = ramp.outputs['Color']
    if spots:
        spot_colour, spot_scale, spot_size = spots
        cells = nodes.new('ShaderNodeTexVoronoi')
        cells.inputs['Scale'].default_value = spot_scale
        links.new(geometry.outputs['Position'], cells.inputs['Vector'])
        mask = nodes.new('ShaderNodeMath')
        mask.operation = 'LESS_THAN'
        mask.inputs[1].default_value = spot_size
        links.new(cells.outputs['Distance'], mask.inputs[0])
        mix = nodes.new('ShaderNodeMixRGB')
        links.new(mask.outputs[0], mix.inputs[0])
        links.new(colour, mix.inputs[1])
        mix.inputs[2].default_value = (*spot_colour, 1)
        colour = mix.outputs[0]
    fine = nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = scale * 9
    links.new(geometry.outputs['Position'], fine.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .25
    bump.inputs['Distance'].default_value = .02
    links.new(fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs[0], shader.inputs['Normal'])
    links.new(colour, shader.inputs['Base Color'])
    return mat


def walk_mask_image(d, field_id, native_size, blur=3.0, per_tile=4):
    """Blurred walkable-tile mask as a Blender image (1 = residents walk here)."""
    import bpy
    import numpy as np
    name = f'opus-walk-mask-{field_id}'
    if name in bpy.data.images:
        return bpy.data.images[name]
    width, height = native_size[0] // 8, native_size[1] // 8
    tiles = walk_tiles(field_id)
    grid = np.zeros((height * per_tile, width * per_tile), dtype=np.float32)
    for tx, ty in tiles:
        grid[ty * per_tile:(ty + 1) * per_tile, tx * per_tile:(tx + 1) * per_tile] = 1.0
    radius = int(blur * 3)
    kernel = np.exp(-.5 * (np.arange(-radius, radius + 1) / blur) ** 2)
    kernel /= kernel.sum()
    padded = np.pad(grid, radius, mode='edge')
    rows = np.apply_along_axis(lambda r: np.convolve(r, kernel, mode='valid'), 1, padded)
    soft = np.apply_along_axis(lambda c: np.convolve(c, kernel, mode='valid'), 0, rows)
    image = bpy.data.images.new(name, width=soft.shape[1], height=soft.shape[0], alpha=False, float_buffer=True)
    rgba = np.repeat(soft[::-1, :, None], 4, axis=2)
    rgba[..., 3] = 1.0
    image.pixels = rgba.ravel().tolist()
    image.pack()
    return image


def walk_mask_socket(d, nodes, links, field_id, native_size):
    """Shader value: walkable mask at this floor point, from its world position."""
    geometry = nodes.new('ShaderNodeNewGeometry')
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(geometry.outputs['Position'], split.inputs[0])
    k = d.UNIT / math.sqrt(2)

    def math_node(op, a, b):
        node = nodes.new('ShaderNodeMath')
        node.operation = op
        for socket, value in ((node.inputs[0], a), (node.inputs[1], b)):
            if isinstance(value, (int, float)):
                socket.default_value = value
            else:
                links.new(value, socket)
        return node.outputs[0]
    sx = math_node('MULTIPLY', math_node('ADD', split.outputs['X'], split.outputs['Y']), k)
    sy = math_node('MULTIPLY', math_node('SUBTRACT', split.outputs['X'], split.outputs['Y']), k * d.S)
    u = math_node('DIVIDE', sx, float(native_size[0]))
    v = math_node('SUBTRACT', 1.0, math_node('DIVIDE', sy, float(native_size[1])))
    join = nodes.new('ShaderNodeCombineXYZ')
    links.new(u, join.inputs['X'])
    links.new(v, join.inputs['Y'])
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = walk_mask_image(d, field_id, native_size)
    texture.interpolation = 'Cubic'
    texture.extension = 'EXTEND'
    links.new(join.outputs[0], texture.inputs['Vector'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2.2
    noise.inputs['Detail'].default_value = 3.0
    links.new(geometry.outputs['Position'], noise.inputs['Vector'])
    broken = math_node('ADD', texture.outputs['Color'], math_node('MULTIPLY', math_node('SUBTRACT', noise.outputs['Fac'], .5), .55))
    ramp = nodes.new('ShaderNodeMapRange')
    ramp.inputs['From Min'].default_value = .38
    ramp.inputs['From Max'].default_value = .62
    links.new(broken, ramp.inputs['Value'])
    return ramp.outputs['Result']


def mask_ground(d, name, field_id, native_size, walk_mat, wild_mat):
    """Mix two existing ground materials' colours by the walkable mask."""
    import bpy
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes.get('Principled BSDF'))
    output = nodes.get('Material Output')
    mix = nodes.new('ShaderNodeMixShader')
    links.new(walk_mask_socket(d, nodes, links, field_id, native_size), mix.inputs['Fac'])
    for index, source in enumerate((wild_mat, walk_mat), start=1):
        copied = _copy_shader(nodes, links, source)
        links.new(copied, mix.inputs[index])
    links.new(mix.outputs[0], output.inputs['Surface'])
    d.M[name] = mat
    return mat


def _copy_shader(nodes, links, source):
    """Copy a material's node tree into ``nodes``; return its BSDF output socket."""
    mapping = {}
    for node in source.node_tree.nodes:
        if node.type == 'OUTPUT_MATERIAL':
            continue
        copy = nodes.new(node.bl_idname)
        for attr in ('operation', 'feature', 'blend_type', 'data_type', 'interpolation', 'extension'):
            if hasattr(node, attr):
                try:
                    setattr(copy, attr, getattr(node, attr))
                except (AttributeError, TypeError):
                    pass
        if node.bl_idname == 'ShaderNodeValToRGB':
            elements = node.color_ramp.elements
            target = copy.color_ramp.elements
            while len(target) < len(elements):
                target.new(0.5)
            for a, b in zip(elements, target):
                b.position, b.color = a.position, a.color
        if node.bl_idname == 'ShaderNodeTexImage':
            copy.image = node.image
        for index, socket in enumerate(node.inputs):
            if hasattr(socket, 'default_value') and index < len(copy.inputs):
                try:
                    copy.inputs[index].default_value = socket.default_value
                except (AttributeError, TypeError, ValueError):
                    pass
        mapping[node.name] = copy
    shader = None
    for link in source.node_tree.links:
        if link.to_node.type == 'OUTPUT_MATERIAL':
            shader = mapping[link.from_node.name].outputs[link.from_socket.identifier]
            continue
        a = mapping[link.from_node.name].outputs[link.from_socket.identifier]
        b = mapping[link.to_node.name].inputs[link.to_socket.identifier]
        links.new(a, b)
    return shader


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'ar-floor' not in d.M:
        lit = fx._floor_material(d, 'ar-floor-lit', (.15, .165, .18), (.08, .09, .10), 1.0, .035)
        dark = fx._floor_material(d, 'ar-floor-dark', (.075, .082, .092), (.045, .05, .056), 1.0, .035)
        mask_ground(d, 'ar-floor', 'field_cm27_01', (192, 200), lit, dark)
    if 'jg-floor' not in d.M:
        trail = _noise_mix(d, 'jg-floor-trail', (.20, .26, .09), (.27, .22, .11), 1.8, .50, .14,
                           spots=((.30, .22, .11), 3.6, .08))
        wild = _noise_mix(d, 'jg-floor-wild', (.030, .11, .030), (.06, .17, .045), 1.6, .50, .12,
                          spots=((.16, .11, .05), 3.2, .09))
        mask_ground(d, 'jg-floor', 'field_cm12_01', (240, 200), trail, wild)
    if 'vl-dirt' not in d.M:
        dirt = _noise_mix(d, 'vl-dirt-bare', (.44, .32, .19), (.36, .25, .14), 1.3, .50, .12,
                          spots=((.66, .63, .58), 4.5, .045))
        weeds = _noise_mix(d, 'vl-weeds', (.17, .36, .10), (.27, .46, .14), 2.6, .50, .16,
                           spots=((.40, .30, .17), 3.0, .10))
        mask_ground(d, 'vl-dirt', 'field_cm01_01', (96, 112), dirt, weeds)


# --------------------------------------------------------------------------- walkability

_WALK = {}


def walk_tiles(field_id):
    """Walkable 8-px tiles of a cage, from the product's own raising-ground catalog.

    Tall scenery (dense bushes, cliffs, grass margins) goes on the other tiles,
    so residents never appear to stand on top of it.
    """
    if field_id not in _WALK:
        spec = json.loads((WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
        data = json.loads((ROOT / 'src/data/championship/catalogs/raising-ground.r1.json').read_text(encoding='utf8'))
        entry = next(f for f in data['fields'] if f['definitionIndex'] == spec['definitionIndex'])
        cells = [value for count, *value in entry['runs'] for _ in range(count)]
        width = entry['width']
        _WALK[field_id] = {(i % width, i // width) for i, value in enumerate(cells) if value[0] == 1}
    return _WALK[field_id]


def walkable(field_id, x, y):
    return (int(x // 8), int(y // 8)) in walk_tiles(field_id)


def hash01(*values):
    h = math.sin(sum(v * k for v, k in zip(values, (12.9898, 78.233, 37.719)))) * 43758.5453
    return h - math.floor(h)


# --------------------------------------------------------------------------- fitting

def depth(points, footprint):
    return containment._union_depth(points, footprint)


def inside(points, footprint, window, margin=DESIGN_MARGIN):
    import numpy as np
    pts = np.asarray(points, dtype=float).reshape(-1, 2)
    x, y, w, h = window
    edge = .12
    if (pts[:, 0].min() < x + edge or pts[:, 0].max() > x + w - edge
            or pts[:, 1].min() < y + edge or pts[:, 1].max() > y + h - edge):
        return False
    return bool(depth(pts, footprint).min() >= margin)


def core_inside(points, footprint, margin=1.0):
    import numpy as np
    return bool(depth(np.asarray(points, dtype=float).reshape(-1, 2), footprint).min() >= margin)


def screen(d, x, y, z):
    """Screen position of a point standing above ground (x, y) at height z."""
    return (x, y - fx.lift(d, z))


def ring(d, name, cx, cy, r, z, radius, mat, n=24):
    points = [d.world(cx + r * math.cos(i * math.tau / n), cy + .5 * r * math.sin(i * math.tau / n), z)
              for i in range(n)]
    return d.curve(name, points, radius, mat, cyclic=True)


def strip(d, name, rows, mat):
    """A mesh strip through rows of (left, centre, right) world points."""
    verts = [p for row in rows for p in row]
    faces = []
    for k in range(len(rows) - 1):
        a, b = 3 * k, 3 * (k + 1)
        faces += [(a, a + 1, b + 1, b), (a + 1, a + 2, b + 2, b + 1)]
    return fx._object(d, name, verts, faces, mat, 0.0, range(len(faces)))


# --------------------------------------------------------------------------- cm27 ring

RING = {'L': (28.0, 116.0), 'T': (96.0, 82.0), 'R': (164.0, 116.0), 'B': (96.0, 150.0)}
DECK, CANVAS = .28, .32
ROPES = (.66, .96, 1.26)
POST_TOP = 1.45
POST_OWNER = {'L': 0, 'R': 5, 'T': 6, 'B': 9}
PADS = {'L': 'ar-pad-red', 'R': 'ar-pad-blue', 'T': 'ar-pad-white', 'B': 'ar-pad-white'}
ROPE_ORDER = (0, 5, 6, 9, 1, 2, 3, 4, 7, 8)


def ring_core(d, footprint, field):
    L, T, R, B = RING['L'], RING['T'], RING['R'], RING['B']
    deck = [L, T, R, B]
    fx.prism(d, 'ring-apron', deck, 0, DECK - .03, 'ar-apron', .012)
    fx.prism(d, 'ring-apron-trim', deck, DECK - .03, DECK, 'ar-trim', .006)
    centre = (96.0, 116.0)
    inner = [(centre[0] + (px - centre[0]) * .97, centre[1] + (py - centre[1]) * .97) for px, py in deck]
    fx.prism(d, 'ring-canvas', inner, DECK, CANVAS, 'ar-canvas', .004)
    edge = [(centre[0] + (px - centre[0]) * .985, centre[1] + (py - centre[1]) * .985) for px, py in deck]
    for k, (a, b) in enumerate(zip(edge, edge[1:] + edge[:1])):
        fx.pipe(d, f'ring-canvas-edge-{k}', [(a[0], a[1], CANVAS + .005), (b[0], b[1], CANVAS + .005)], .03,
                'ar-canvas-edge')
    # Original centre mark: a gold eight-point star inside a double ring.
    star = []
    for i in range(16):
        r = 15.0 if i % 2 == 0 else 7.0
        a = i * math.tau / 16 + math.pi / 16
        star.append((centre[0] + r * math.cos(a), centre[1] + .5 * r * math.sin(a)))
    fx.prism(d, 'ring-star', star, CANVAS, CANVAS + .008, 'ar-gold', 0)
    for k, r in enumerate((19.0, 21.0)):
        ring(d, f'ring-mark-{k}', centre[0], centre[1], r, CANVAS + .006, .02, 'ar-gold', 48)
    # Access steps on the two front sides, near the outer corners.
    for side, (corner, outward) in (('left', (L, (-V[0], -V[1]))), ('right', (R, U))):
        along = ((B[0] - corner[0]), (B[1] - corner[1]))
        length = math.hypot(*along)
        ax, ay = along[0] / length, along[1] / length
        base = (corner[0] + ax * length * .34, corner[1] + ay * length * .34)
        width = 7.5
        ox, oy = outward
        on = math.hypot(ox, oy)
        ox, oy = ox / on, oy / on
        for k in range(3):
            near, far = .35 + 2.6 * k, .35 + 2.6 * (k + 1)
            pts = [(base[0] - ax * width + ox * near, base[1] - ay * width + oy * near),
                   (base[0] + ax * width + ox * near, base[1] + ay * width + oy * near),
                   (base[0] + ax * width + ox * far, base[1] + ay * width + oy * far),
                   (base[0] - ax * width + ox * far, base[1] - ay * width + oy * far)]
            top = DECK * (3 - k) / 3
            fx.prism(d, f'ring-step-{side}-{k}', pts, 0, top, 'ar-step', .006)
    # Corner stools and a pair of gloves on the arena floor.
    for k, (sx, sy) in enumerate(((13.0, 142.0), (179.0, 142.0))):
        fx.cylinder(d, f'arena-stool-seat-{k}', sx, sy, 3.2, .42, .50, 'ar-stool', 16)
        for j in range(3):
            a = j * math.tau / 3 + .4
            fx.pipe(d, f'arena-stool-leg-{k}-{j}', [(sx + math.cos(a) * 2.4, sy + .5 * math.sin(a) * 2.4, 0),
                                                    (sx + math.cos(a) * 1.4, sy + .5 * math.sin(a) * 1.4, .44)],
                    .03, 'ar-stool')
    for k, (gx, gy) in enumerate(((146.0, 178.0), (153.0, 181.0))):
        d.sphere(f'arena-glove-{k}', d.world(gx, gy, .18), (.22, .16, .16), 'ar-glove')
        fx.cylinder(d, f'arena-glove-cuff-{k}', gx - 2.2, gy + .6, 1.4, .05, .26, 'ar-glove-cuff', 12)
    # Ropes: three continuous lines per side, each span owned by one source window.
    cells = [(i, field['objects'][i]) for i in ROPE_ORDER]
    chain = []
    corners = [('L', L), ('T', T), ('R', R), ('B', B)]
    for level, z in enumerate(ROPES):
        for side, ((na, a), (nb, b)) in enumerate(zip(corners, corners[1:] + corners[:1])):
            aa, bb = screen(d, a[0], a[1], z), screen(d, b[0], b[1], z)
            pieces = partition_segment(aa, bb, cells, margin=1.3)
            for k, piece in enumerate(pieces):
                owner = piece['owner']
                d.LAYER = 'base' if owner is None else 'decor'
                pa, pb = piece['a'], piece['b']
                obj = d.curve(f'ring-rope-{level}-{side}-{k}', [d.world(pa[0], pa[1] + fx.lift(d, z), z),
                                                                d.world(pb[0], pb[1] + fx.lift(d, z), z)],
                              .032, 'ar-rope-red' if level == 1 else 'ar-rope')
                if owner is not None:
                    record = field['objects'][owner]
                    obj['sourceObjectOrdinal'] = owner
                    obj['sourceAnchorNative'] = record['placement']
                    obj['objectSequenceId'] = record['sequenceId']
                    obj['objectRole'] = 'ring-rope-section'
            chain.append({'level': level, 'side': side, 'z': z,
                          'pieces': [{k: v for k, v in p.items()} for p in pieces]})
    d.LAYER = 'base'
    return ['raised-boxing-ring', 'partitioned-continuous-ropes', 'corner-posts', 'lighting-rigs',
            'original-star-centre-mark'], chain


def corner_post(d, name, corner):
    px, py = RING[corner]
    fx.cylinder(d, name + '-post', px, py, 1.25, 0, POST_TOP, 'ar-post', 12)
    fx.cylinder(d, name + '-cap', px, py, 1.45, POST_TOP, POST_TOP + .05, 'ar-post', 12)
    for k, z in enumerate(ROPES):
        fx.cylinder(d, f'{name}-pad-{k}', px, py, 1.75, z - .08, z + .08, PADS[corner], 14)
    return (px, py)


def light_rig(d, name, record, window, footprint):
    """Floor-standing lighting rig behind the ring: two stands, a bar, three lamps."""
    x, y, w, h = window
    base_y = y + h - 4.5
    left, right = x + 7.0, x + w - 7.0
    zh = 2.2
    while zh > 1.0:
        pts = [(left, base_y + 1), (right, base_y + 1), screen(d, left, base_y, zh + .12),
               screen(d, right, base_y, zh + .12)]
        pts += [(px + dx, py) for px, py in pts for dx in (-1.6, 1.6)]
        if inside(pts, footprint, window):
            break
        zh -= .1
    for k, sx in enumerate((left, right)):
        fx.box(d, f'{name}-foot-{k}', sx, base_y, 1.6, 1.6, 0, .06, 'ar-truss', .004)
        fx.pipe(d, f'{name}-stand-{k}', [(sx, base_y, .06), (sx, base_y, zh)], .05, 'ar-truss')
    for k, z in enumerate((zh, zh - .22)):
        fx.pipe(d, f'{name}-bar-{k}', [(left, base_y, z), (right, base_y, z)], .04 if k == 0 else .025, 'ar-truss')
    for k in range(3):
        lx = left + (right - left) * (k + 1) / 4
        fx.pipe(d, f'{name}-yoke-{k}', [(lx, base_y, zh - .22), (lx, base_y, zh - .42)], .02, 'ar-truss')
        d.sphere(f'{name}-lamp-{k}', d.world(lx, base_y, zh - .55), (.16, .16, .14), 'ar-lamp')
        d.sphere(f'{name}-lens-{k}', d.world(lx, base_y + 1.1, zh - .62), (.11, .11, .09), 'ar-lens')
    return ((left + right) / 2, base_y)


def ring_object(d, record, window, footprint, field):
    seq, ordinal = record['sequenceId'], record['order']
    name = f"ring-{ordinal:02d}"
    if seq == 0:
        return 'lighting-rig', light_rig(d, name + '-rig', record, window, footprint)
    corner = next((c for c, owner in POST_OWNER.items() if owner == ordinal), None)
    if corner:
        return 'ring-corner-post', corner_post(d, name + '-corner', corner)
    return 'ring-rope-section', None


# --------------------------------------------------------------------------- cm12 jungle

def frond_rows(d, crown, angle, length, rise, droop, width, fold=.06):
    cx, cy, cz = crown
    gx, gy = math.cos(angle), .5 * math.sin(angle)
    px, py = -math.sin(angle), .5 * math.cos(angle)
    rows = []
    for k in range(8):
        s = k / 7
        ox, oy = cx + gx * length * s, cy + gy * length * s
        z = cz + rise * s - droop * s * s
        half = width * math.sin(math.pi * min(1.0, .15 + s * .95)) * (1 - .35 * s)
        rows.append(((ox - px * half, oy - py * half, z - fold), (ox, oy, z), (ox + px * half, oy + py * half, z - fold)))
    return rows


def palm_points(d, base, height, fronds, length, rise, droop, width, lean):
    """Screen silhouette points of a palm before it is built (for fitting)."""
    bx, by = base
    crown = (bx + lean, by, height)
    pts = [(bx - 2, by + 1), (bx + 2, by + 1), screen(d, *crown)]
    for k in range(fronds):
        angle = k * math.tau / fronds + .35
        for row in frond_rows(d, crown, angle, length * (1 + .12 * math.sin(k * 2.1)), rise, droop, width):
            pts += [screen(d, *p) for p in (row[0], row[2])]
    return pts


_PALMS = {}


def palm_layout(d, record, window, footprint, kind):
    key = (footprint['fieldId'], record['order'])
    if key in _PALMS:
        return _PALMS[key]
    x, y, w, h = window
    ax, ay = record['placement']
    best = None
    spec = {'tall': (2.9, 12, 19.0, .55, 1.55, 3.9), 'short': (2.1, 11, 21.0, .45, 1.45, 4.2),
            'banana': (0.0, 5, 14.0, 2.6, 1.5, 5.6)}[kind]
    height0, fronds, length0, rise, droop, width = spec
    # Smallest trunk drift first, at the largest crown that fits.
    offsets = sorted(((dx, dy) for dx in range(-12, 13, 3) for dy in range(0, -17, -2)),
                     key=lambda o: (math.hypot(*o), o))
    for scale in [1 - .05 * i for i in range(13)]:
        for dx, dy in offsets:
            base = (ax + dx, min(ay + dy, y + h - 2.0))
            height = height0 * scale if kind != 'banana' else 0.0
            length = length0 * scale
            pts = palm_points(d, base, height, fronds, length, rise * scale, droop * scale, width, 1.2)
            if inside(pts, footprint, window):
                best = (base, height, length, scale)
                break
        if best:
            break
    if best is None:
        raise ValueError(f"PALM_DOES_NOT_FIT:{footprint['fieldId']}:{record['order']}")
    _PALMS[key] = {'base': best[0], 'height': best[1], 'length': best[2], 'scale': best[3], 'kind': kind,
                   'fronds': fronds, 'rise': rise * best[3], 'droop': droop * best[3], 'width': width}
    return _PALMS[key]


def palm(d, name, lay):
    bx, by = lay['base']
    height, length, kind = lay['height'], lay['length'], lay['kind']
    lean = 1.2
    crown = (bx + lean, by, height)
    if kind != 'banana':
        mid = (bx + lean * .25, by, height * .5)
        fx.pipe(d, name + '-trunk-low', [(bx, by, 0.0), mid], .11, 'jg-trunk')
        fx.pipe(d, name + '-trunk-high', [mid, crown], .085, 'jg-trunk')
        for k in range(1, 6):
            t = k / 6
            rx = bx + lean * t * t
            fx.cylinder(d, f'{name}-ring-{k}', rx, by, 2.05 - .45 * t, height * t, height * t + .05, 'jg-trunk-ring', 10)
        d.sphere(name + '-crown', d.world(crown[0], crown[1], crown[2]), (.14, .14, .12), 'jg-frond')
        if kind == 'tall':
            for k in range(3):
                a = k * math.tau / 3 + .8
                d.sphere(f'{name}-coconut-{k}', d.world(crown[0] + math.cos(a) * 1.2,
                                                         crown[1] + .5 * math.sin(a) * 1.2, crown[2] - .16),
                         (.075, .075, .075), 'jg-coconut')
    for k in range(lay['fronds']):
        angle = k * math.tau / lay['fronds'] + .35
        rows = frond_rows(d, crown, angle, length * (1 + .12 * math.sin(k * 2.1)), lay['rise'], lay['droop'],
                          lay['width'])
        world_rows = [tuple(d.world(*p) for p in row) for row in rows]
        mat = ('jg-banana' if kind == 'banana' else ('jg-frond' if k % 2 else 'jg-frond-light'))
        strip(d, f'{name}-frond-{k}', world_rows, mat)
    return (bx, by)


def rock_mesh(d, name, cx, cy, r, hz, mat, seed):
    """Irregular rock that never leaves its fitted ellipse."""
    n = 14
    levels = [(0.0, 1.0), (.35, .96), (.70, .80), (.90, .52), (1.0, .18)]
    verts = []
    for k, (t, scale) in enumerate(levels):
        for i in range(n):
            a = i * math.tau / n
            wobble = 1.0 - .16 * (.5 + .5 * math.sin(seed * 2.7 + i * 1.9 + k * 1.1))
            rr = r * scale * wobble
            verts.append(d.world(cx + rr * math.cos(a), cy + .5 * rr * math.sin(a), hz * t))
    faces = []
    for k in range(len(levels) - 1):
        a, b = k * n, (k + 1) * n
        faces += [(a + i, a + (i + 1) % n, b + (i + 1) % n, b + i) for i in range(n)]
    smooth = range(len(faces))
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range((len(levels) - 1) * n, len(levels) * n)))
    return fx._object(d, name, verts, faces, mat, 0.0, smooth)


def bush(d, name, cx, cy, size, height, leaves, seed, mats):
    for f in range(leaves):
        angle = f * math.tau / leaves + seed * 6.0
        length = size * (.78 + .22 * math.sin(seed * 9 + f * 2.3))
        rows = frond_rows(d, (cx, cy, .04), angle, length, height * 1.6, height * 1.0, size * .30, .03)
        strip(d, f'{name}-{f}', [tuple(d.world(*p) for p in row) for row in rows], mats[f % len(mats)])


def jungle_core(d, footprint):
    import numpy as np
    fid = footprint['fieldId']
    tiles = walk_tiles(fid)
    # Earthy rock walls along the two vertical outer edges, with moss and hanging roots.
    for k, (x0, y0, y1) in enumerate(((191.0, 30.0, 86.0), (239.0, 116.0, 174.0))):
        y, j = y0, 0
        while y < y1:
            r = 5.8 + (j * 7 % 3) * .7
            hz = .95 + (j * 5 % 4) * .12
            cx = x0 - r - 1.0
            pts = [(cx + r * math.cos(a), y + .5 * r * math.sin(a) - t * fx.lift(d, hz * 1.05))
                   for a in np.linspace(0, math.tau, 16) for t in (0, .5, 1)]
            if core_inside(pts, footprint, 1.2):
                rock_mesh(d, f'jungle-cliff-{k}-{j}', cx, y, r, hz, 'jg-rock' if j % 2 else 'jg-rock-dark', j + 3 * k)
                fx.lathe(d, f'jungle-cliff-moss-{k}-{j}', cx - r * .1, y, [(hz * .80, r * .62), (hz * 1.0, r * .30),
                                                                        (hz * 1.04, r * .08)], 'jg-moss', 12)
                if j % 2 == 0:
                    fx.pipe(d, f'jungle-root-{k}-{j}', [(cx - r * .7, y + 1.0, hz * .85), (cx - r * 1.3, y + 2.2, hz * .4),
                                                        (cx - r * 1.5, y + 2.8, .03)], .035, 'jg-root')
                    fx.pipe(d, f'jungle-vine-{k}-{j}', [(cx - r * .2, y + 1.2, hz * .95), (cx - r * .5, y + 1.8, hz * .45),
                                                        (cx - r * .4, y + 2.4, .10)], .025, 'jg-vine')
            y += 4.2
            j += 1
    # Rafflesia: five fleshy petals lying on the floor.
    fx_x, fx_y = 24.0, 64.0
    for k in range(5):
        a = k * math.tau / 5 - math.pi / 2
        px, py = fx_x + math.cos(a) * 4.6, fx_y + .5 * math.sin(a) * 4.6
        fx.lathe(d, f'jungle-rafflesia-petal-{k}', px, py, [(0, 3.2), (.10, 3.0), (.16, 1.8)], 'jg-petal', 14)
        for j in range(2):
            sa = a + (j - .5) * .7
            d.sphere(f'jungle-rafflesia-spot-{k}-{j}', d.world(px + math.cos(sa) * 1.4, py + .5 * math.sin(sa) * 1.4, .16),
                     (.035, .035, .02), 'jg-petal-spot')
    fx.lathe(d, 'jungle-rafflesia-core', fx_x, fx_y, [(0, 2.6), (.22, 2.4), (.24, 1.6), (.12, 1.4)], 'jg-flower-core', 18)
    # Dense broad-leaf thicket on every non-walkable tile inside the field;
    # only low ferns where residents walk.
    k = 0
    for ty, tx, layer in ((ty, tx, layer) for ty in range(25) for tx in range(30) for layer in (0, 1)):
            if layer and (tx, ty) in tiles:
                continue
            px = tx * 8 + 2 + 4 * layer + (hash01(tx, ty, 1 + layer) - .5) * 3
            py = ty * 8 + 4 - 2 * layer + (hash01(tx, ty, 2 + layer) - .5) * 3
            r = hash01(tx, ty, 3 + layer)
            if (tx, ty) in tiles:
                if r > .30 or math.dist((px, py), (fx_x, fx_y)) < 10:
                    continue
                size, lift_z, leaves, mats = 3.0 + r * 5, .20, 5, ('jg-fern', 'jg-fern-light')
            else:
                size, lift_z, leaves, mats = 7.0 + r * 4.0, .50 + .40 * r, 7, ('jg-bush', 'jg-bush-light', 'jg-banana')
            top = .04 + (lift_z * 1.6) ** 2 / (4 * lift_z)
            pts = [(px + size * math.cos(a), py + .5 * size * math.sin(a) - t * fx.lift(d, top))
                   for a in np.linspace(0, math.tau, 12) for t in (0, 1)]
            if not core_inside(pts, footprint, 1.3):
                continue
            bush(d, f'jungle-plant-{k:03d}', px, py, size, lift_z, leaves, r, mats)
            k += 1
    return ['palm-trees-with-crowns', 'banana-plants', 'thicket-on-blocked-tiles', 'fern-floor', 'rafflesia',
            'earth-rock-walls']


def jungle_object(d, record, window, footprint):
    kind = {0: 'tall', 1: 'short', 2: 'banana'}[record['sequenceId']]
    lay = palm_layout(d, record, window, footprint, kind)
    role = {'tall': 'tall-coconut-palm', 'short': 'short-palm', 'banana': 'banana-plant'}[kind]
    return role, palm(d, f"jungle-{record['order']:02d}-{kind}", lay)


# --------------------------------------------------------------------------- cm01 vacant lot

def lot_core(d, footprint):
    fid = footprint['fieldId']
    tiles = walk_tiles(fid)
    # Weedy grass on the tiles residents do not walk; the walked lot stays bare dirt.
    k = 0
    for ty in range(14):
        for tx in range(12):
            if (tx, ty) in tiles:
                continue
            cx, cy = tx * 8 + 4, ty * 8 + 4
            k += 1
            if hash01(tx, ty, 5) < .55:
                gx, gy = cx + (hash01(tx, ty, 6) - .5) * 4, cy + (hash01(tx, ty, 7) - .5) * 3
                if core_inside([(gx - 3, gy), (gx + 3, gy), (gx, gy - fx.lift(d, .34))], footprint, 1.2):
                    for f in range(6):
                        a = f * math.tau / 6 + tx
                        fx.pipe(d, f'lot-tuft-{tx}-{ty}-{f}',
                                [(gx, gy, 0.0), (gx + math.cos(a) * 2.2, gy + .5 * math.sin(a) * 2.2, .30)],
                                .022, 'vl-grass')
    stones = ((36, 70), (48, 78), (22, 82), (64, 66), (40, 96), (74, 84), (18, 60), (56, 92), (30, 50), (60, 52))
    for k, (sx, sy) in enumerate(stones):
        r = 1.2 + (k % 3) * .4
        if core_inside([(sx - r, sy), (sx + r, sy)], footprint, 1.2):
            fx.lathe(d, f'lot-pebble-{k}', sx, sy, [(0, r), (.06, r * .8), (.09, r * .3)], 'vl-pebble', 10)
    return ['concrete-pipe-stack', 'back-tree', 'plank-fences', 'bare-dirt-lot-with-weedy-margins']


def pipe_stack(d, name, record, window, footprint):
    """Three concrete pipes along V, open ends toward the viewer: two on the ground, one on top."""
    x, y, w, h = window
    best = None
    for scale in [1 - .04 * i for i in range(16)]:
        r = 5.6 * scale          # native px radius of one pipe's circular end
        length = 30.0 * scale    # native px along V
        for cy in [y + h - 4 - j * 1.5 for j in range(16)]:
            for cx in [x + w / 2 + i for i in (0, -3, 3, -6, 6, -9, 9)]:
                pts = []
                for a, b in pipe_axes(d, cx, cy, r, length):
                    for px, py, pz in (a, b):
                        sx, sy = screen(d, px, py, pz)
                        pts += [(sx + r * math.cos(t), sy + r * math.sin(t)) for t in [i * math.tau / 12 for i in range(12)]]
                if inside(pts, footprint, window):
                    best = (cx, cy, r, length)
                    break
            if best:
                break
        if best:
            break
    cx, cy, r, length = best
    radius = r / d.UNIT
    for k, (a, b) in enumerate(pipe_axes(d, cx, cy, r, length)):
        fx.pipe(d, f'{name}-pipe-{k}', [a, b], radius, 'vl-pipe')
        # Dark bore: a short, slightly narrower tube just proud of the front end.
        ux, uy = -V[0] * .25, -V[1] * .25
        d.curve(f'{name}-bore-{k}', [d.world(a[0] - ux * .2, a[1] - uy * .2, a[2]),
                                     d.world(a[0] + ux, a[1] + uy, a[2])], radius * .74, 'vl-pipe-inner')
    return (cx, cy)


def pipe_axes(d, cx, cy, r, length):
    """Ground axes of the three pipes; ``r`` is the end radius in native px."""
    radius = r / d.UNIT
    offset = r * 1.02                         # native px between neighbours, along U
    across = offset * .0740 * .904            # world distance between parallel axes
    top = radius + math.sqrt(max(0.0, (2 * radius) ** 2 - across ** 2))
    half = length / 2
    out = []
    for shift, z in ((-offset, radius), (offset, radius), (0.0, top)):
        ox, oy = shift * U[0], shift * U[1]
        a = (cx - half * V[0] + ox, cy - half * V[1] + oy, z)
        b = (cx + half * V[0] + ox, cy + half * V[1] + oy, z)
        out.append((a, b))
    return out


def plank_fence(d, name, record, window, footprint, planks=5):
    """Weathered planks standing along the hex's back-right edge direction (U)."""
    x, y, w, h = window
    best = None
    for span in (9.0, 8.0, 7.0, 6.0, 5.0):
        for cy in [y + h - 2.5 - j * .75 for j in range(60)]:
            for cx in [x + w / 2 + i for i in (0, -2, 2, -4, 4, -6, 6, -8, 8)]:
                bases = [(cx + t * span * U[0], cy + t * span * U[1]) for t in (-1, 0, 1)]
                foot = [(bx + dx, by + dy) for bx, by in bases for dx, dy in ((-1.6, 0), (1.6, 0), (0, .8))]
                if not inside(foot, footprint, window):
                    continue
                room = min(min(headroom(footprint, bx - 1.6, bx + 1.6, by), by - (y + .6)) for bx, by in bases)
                if room > 8:
                    best = (span, cx, cy, room)
                    break
            if best:
                break
        if best:
            break
    span, cx, cy, room = best
    zt = max(.6, min(2.0, (room - 1.2) / fx.lift(d, 1)))
    for k in range(planks):
        t = -1 + 2 * (k + .5) / planks
        px, py = cx + t * span * U[0], cy + t * span * U[1]
        top = zt * (1 - .08 * ((k * 5) % 3))
        fx.box(d, f'{name}-plank-{k}', px, py, span / planks * .92, .35, 0, top,
               'vl-plank' if k % 2 else 'vl-plank-dark', .006)
    for k, z in enumerate((zt * .25, zt * .72)):
        a = (cx - span * U[0], cy - span * U[1] + .9)
        b = (cx + span * U[0], cy + span * U[1] + .9)
        fx.pipe(d, f'{name}-rail-{k}', [(a[0], a[1], z), (b[0], b[1], z)], .05, 'vl-plank-dark')
    return (cx, cy)


def headroom(footprint, x0, x1, ground_y, margin=DESIGN_MARGIN, step=.5):
    import numpy as np
    xs = np.linspace(x0, x1, 9)
    y = ground_y
    while y > ground_y - 160:
        if depth(np.stack([xs, np.full_like(xs, y)], axis=1), footprint).min() < margin:
            break
        y -= step
    return ground_y - y


def lot_tree(d, name, record, window, footprint):
    """A small round-crowned tree at the back corner; its crown fits the hex's top."""
    x, y, w, h = window
    best = None
    for scale in [1 - .05 * i for i in range(14)]:
        crown_r = 11.0 * scale
        trunk = 1.6 * scale
        for by in [y + h - 2.0 - j * .75 for j in range(20)]:
            for bx in [x + w / 2 + i for i in (0, -2, 2, -4, 4)]:
                cz = trunk + crown_r * .55 / 16 / .616
                centre = screen(d, bx, by, cz)
                pts = [(bx - 1.5, by + .8), (bx + 1.5, by + .8)]
                pts += [(centre[0] + crown_r * math.cos(t), centre[1] + crown_r * .92 * math.sin(t))
                        for t in [i * math.tau / 16 for i in range(16)]]
                if inside(pts, footprint, window):
                    best = (bx, by, crown_r, trunk, cz)
                    break
            if best:
                break
        if best:
            break
    bx, by, crown_r, trunk, cz = best
    fx.pipe(d, name + '-trunk', [(bx, by, 0.0), (bx + .4, by, trunk + .2)], .12, 'vl-trunk')
    for k, (ox, oz, s) in enumerate(((0, 0, .86), (-.36, -.14, .58), (.38, -.10, .60), (.06, .26, .52),
                                     (-.22, .16, .50), (.24, .18, .48))):
        r = crown_r * s / d.UNIT
        d.sphere(f'{name}-crown-{k}', d.world(bx + ox * crown_r, by, cz + oz * crown_r / 9.85), (r, r, r * .92),
                 'vl-leaf' if k % 2 == 0 else 'vl-leaf-light')
    return (bx, by)


def lot_object(d, record, window, footprint):
    seq = record['sequenceId']
    name = f"lot-{record['order']:02d}"
    if seq == 1:
        return 'concrete-pipe-stack', pipe_stack(d, name + '-pipes', record, window, footprint)
    if seq == 0:
        return 'back-tree', lot_tree(d, name + '-tree', record, window, footprint)
    return 'plank-fence', plank_fence(d, name + '-fence', record, window, footprint, 5 if seq == 3 else 4)


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_REMAINING_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    chain = None
    if field_id == 'field_cm27_01':
        features, chain = ring_core(d, footprint, field)
        bpy.context.scene['ringRopePartition'] = json.dumps(chain)
    elif field_id == 'field_cm12_01':
        features = jungle_core(d, footprint)
    else:
        features = lot_core(d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        source = containment.source_window(record)
        decision = containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        if field_id == 'field_cm27_01':
            role, anchor = ring_object(d, record, source, footprint, field)
        elif field_id == 'field_cm12_01':
            role, anchor = jungle_object(d, record, source, footprint)
        else:
            role, anchor = lot_object(d, record, source, footprint)
        owned = [o for o in bpy.context.scene.objects if o.get('sourceObjectOrdinal') == record['order']]
        if anchor is None:
            pts = [p for o in owned for p in containment._points(d, [o]).tolist()]
            anchor = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) if pts else \
                tuple(record['placement'])
        containment.register_anchor(field_id, record['order'], anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = record['order']
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = record['sequenceId']
            obj['sourceCellId'] = cell_id
            obj['objectRole'] = role
        for obj in owned:
            obj['sourceCellId'] = cell_id
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': record['sequenceId'], 'role': role,
                        'anchorNative': record['placement'], 'phase': phase, 'phases': phases,
                        'authoringWindowReduced': decision['reduced']})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
