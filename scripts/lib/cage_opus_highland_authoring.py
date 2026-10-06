"""Original highland family for the opus round: small mountain (cm37), cave (cm40).

Both cages are core-only (no source objects).  Their look follows the walkable
tiles of the product's raising-ground catalog: residents walk on plateau or
cave floor; every tall piece of scenery stands on the other tiles.

* cm37 small mountain: an open summit plateau above the clouds.  Tiles behind
  the plateau show sky with volumetric clouds below the edge; tiles in front
  and at the sides are scree; a rock rim marks the plateau's back edge, a rock
  ridge runs up the right edge, a cairn and alpine tufts sit on the scree.
  No crater, lava or smoke, so it cannot be read as the small volcano.
* cm40 cave: a cave interior (no cave mouth).  Dark wet rock floor where
  residents walk; the upper right is the cave wall, braced by mine timbers,
  with glowing crystals, stalagmites and a hanging lamp; rubble at the front.

Research rasters were viewed locally only; nothing is loaded or traced.
"""
import json
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_remaining_authoring as kit


FIELDS = ('field_cm37_01', 'field_cm40_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm37_01': 'hl-summit', 'field_cm40_01': 'hl-cave'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_authoring_coordinates')
ART_DIRECTION_INPUTS = kit.ART_DIRECTION_INPUTS
CONTRACTS = {}
U, V = fx.U, fx.V
NATIVE = {'field_cm37_01': (96, 112), 'field_cm40_01': (96, 112)}

PALETTE = {
    'hl-rock': ((.42, .39, .35), .86, .0, 0),
    'hl-rock-dark': ((.29, .27, .25), .88, .0, 0),
    'hl-rock-light': ((.56, .53, .48), .84, .0, 0),
    'hl-grass': ((.30, .46, .16), .75, .0, 0),
    'hl-flower': ((.94, .94, .88), .60, .0, 0),
    'hl-cairn': ((.50, .48, .44), .85, .0, 0),
    'cv-rock': ((.055, .06, .08), .80, .0, 0),
    'cv-rock-mid': ((.085, .09, .115), .78, .0, 0),
    'cv-rock-light': ((.13, .14, .17), .75, .0, 0),
    'cv-timber': ((.34, .21, .10), .80, .0, 0),
    'cv-timber-dark': ((.22, .13, .06), .85, .0, 0),
    'cv-crystal': ((.30, .85, 1.0), .15, .0, 6.0),
    'cv-crystal-violet': ((.62, .40, 1.0), .15, .0, 5.5),
    'cv-lamp': ((1.0, .70, .30), .30, .0, 6.0),
    'cv-iron': ((.12, .12, .13), .45, .50, 0),
    'cv-water': ((.05, .09, .13), .05, .0, .20),
}


# --------------------------------------------------------------------------- zones

def zone_values(field_id):
    """Per-tile zone value: 1 walkable, .5 scree/rubble, 0 sky (summit only)."""
    tiles = kit.walk_tiles(field_id)
    width, height = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
    values = {}
    for ty in range(height):
        for tx in range(width):
            if (tx, ty) in tiles:
                values[(tx, ty)] = 1.0
                continue
            below = any((tx, y) in tiles for y in range(ty + 1, height))
            above = any((tx, y) in tiles for y in range(0, ty))
            behind = below and not above
            values[(tx, ty)] = 0.0 if (field_id == 'field_cm37_01' and (behind or not (below or above))
                                        and tx < width - 1) else .5
    return values


def zone_image(d, field_id, blur=2.6, per_tile=4):
    import bpy
    import numpy as np
    name = f'opus-zone-mask-{field_id}'
    if name in bpy.data.images:
        return bpy.data.images[name]
    width, height = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
    grid = np.zeros((height * per_tile, width * per_tile), dtype=np.float32)
    for (tx, ty), value in zone_values(field_id).items():
        grid[ty * per_tile:(ty + 1) * per_tile, tx * per_tile:(tx + 1) * per_tile] = value
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


def zone_ground(d, name, field_id, layers):
    """Blend ground looks by zone value: ``layers`` = [(material, from, to), ...] low to high."""
    import bpy
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes.get('Principled BSDF'))
    output = nodes.get('Material Output')
    geometry = nodes.new('ShaderNodeNewGeometry')
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(geometry.outputs['Position'], split.inputs[0])
    k = d.UNIT / math.sqrt(2)

    def op(kind, a, b):
        node = nodes.new('ShaderNodeMath')
        node.operation = kind
        for socket, value in ((node.inputs[0], a), (node.inputs[1], b)):
            if isinstance(value, (int, float)):
                socket.default_value = value
            else:
                links.new(value, socket)
        return node.outputs[0]
    w, h = NATIVE[field_id]
    u = op('DIVIDE', op('MULTIPLY', op('ADD', split.outputs['X'], split.outputs['Y']), k), float(w))
    v = op('SUBTRACT', 1.0, op('DIVIDE', op('MULTIPLY', op('SUBTRACT', split.outputs['X'], split.outputs['Y']),
                                            k * d.S), float(h)))
    join = nodes.new('ShaderNodeCombineXYZ')
    links.new(u, join.inputs['X'])
    links.new(v, join.inputs['Y'])
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = zone_image(d, field_id)
    texture.interpolation = 'Cubic'
    texture.extension = 'EXTEND'
    links.new(join.outputs[0], texture.inputs['Vector'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2.4
    noise.inputs['Detail'].default_value = 3.0
    links.new(geometry.outputs['Position'], noise.inputs['Vector'])
    value = op('ADD', texture.outputs['Color'], op('MULTIPLY', op('SUBTRACT', noise.outputs['Fac'], .5), .30))
    current = kit._copy_shader(nodes, links, layers[0][0])
    for material, start, end in layers[1:]:
        ramp = nodes.new('ShaderNodeMapRange')
        ramp.inputs['From Min'].default_value = start
        ramp.inputs['From Max'].default_value = end
        links.new(value, ramp.inputs['Value'])
        mix = nodes.new('ShaderNodeMixShader')
        links.new(ramp.outputs['Result'], mix.inputs['Fac'])
        links.new(current, mix.inputs[1])
        links.new(kit._copy_shader(nodes, links, material), mix.inputs[2])
        current = mix.outputs[0]
    links.new(current, output.inputs['Surface'])
    d.M[name] = mat
    return mat


def _sky_material(d, name):
    """Sky far below the summit: soft blue with drifting cloud patches (slightly emissive)."""
    mat = d.material(name, (.42, .64, .90), .9, .0, .55)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry = nodes.new('ShaderNodeNewGeometry')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.1
    noise.inputs['Detail'].default_value = 5.0
    links.new(geometry.outputs['Position'], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .52
    ramp.color_ramp.elements[0].color = (.40, .62, .90, 1)
    ramp.color_ramp.elements[1].position = .70
    ramp.color_ramp.elements[1].color = (.93, .95, .98, 1)
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    links.new(ramp.outputs['Color'], shader.inputs['Emission Color'])
    return mat


def _slab_material(d, name, light, dark, crack, scale, gap_width=.022):
    """Rock slabs: Voronoi plates with dark cracks and tonal variation."""
    mat = d.material(name, light, .86, .0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry = nodes.new('ShaderNodeNewGeometry')
    plates = nodes.new('ShaderNodeTexVoronoi')
    plates.feature = 'F1'
    edges = nodes.new('ShaderNodeTexVoronoi')
    edges.feature = 'DISTANCE_TO_EDGE'
    for node in (plates, edges):
        node.inputs['Scale'].default_value = scale
        node.inputs['Randomness'].default_value = .9
        links.new(geometry.outputs['Position'], node.inputs['Vector'])
    grey = nodes.new('ShaderNodeRGBToBW')
    links.new(plates.outputs['Color'], grey.inputs[0])
    tone = nodes.new('ShaderNodeValToRGB')
    tone.color_ramp.elements[0].color = (*dark, 1)
    tone.color_ramp.elements[1].color = (*light, 1)
    links.new(grey.outputs[0], tone.inputs[0])
    gap = nodes.new('ShaderNodeMath')
    gap.operation = 'LESS_THAN'
    gap.inputs[1].default_value = gap_width
    links.new(edges.outputs['Distance'], gap.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB')
    links.new(gap.outputs[0], mix.inputs[0])
    links.new(tone.outputs[0], mix.inputs[1])
    mix.inputs[2].default_value = (*crack, 1)
    links.new(mix.outputs[0], shader.inputs['Base Color'])
    relief = nodes.new('ShaderNodeMath')
    relief.operation = 'MINIMUM'
    relief.inputs[1].default_value = .2
    links.new(edges.outputs['Distance'], relief.inputs[0])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .5
    bump.inputs['Distance'].default_value = .05
    links.new(relief.outputs[0], bump.inputs['Height'])
    links.new(bump.outputs[0], shader.inputs['Normal'])
    return mat


def _cloud_volume(d, name):
    import bpy
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes.get('Principled BSDF'))
    output = nodes.get('Material Output')
    volume = nodes.new('ShaderNodeVolumePrincipled')
    volume.inputs['Color'].default_value = (.97, .98, 1.0, 1)
    volume.inputs['Emission Color'].default_value = (.95, .97, 1.0, 1)
    volume.inputs['Emission Strength'].default_value = .35
    coords = nodes.new('ShaderNodeTexCoord')
    radial = nodes.new('ShaderNodeVectorMath')
    radial.operation = 'LENGTH'
    links.new(coords.outputs['Object'], radial.inputs[0])
    falloff = nodes.new('ShaderNodeMapRange')
    falloff.inputs['From Min'].default_value = 1.0
    falloff.inputs['From Max'].default_value = .2
    links.new(radial.outputs['Value'], falloff.inputs['Value'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2.0
    noise.inputs['Detail'].default_value = 3.0
    links.new(coords.outputs['Object'], noise.inputs['Vector'])
    shaped = nodes.new('ShaderNodeMath')
    shaped.operation = 'MULTIPLY'
    links.new(falloff.outputs['Result'], shaped.inputs[0])
    links.new(noise.outputs['Fac'], shaped.inputs[1])
    density = nodes.new('ShaderNodeMath')
    density.operation = 'MULTIPLY'
    density.inputs[1].default_value = 11.0
    links.new(shaped.outputs[0], density.inputs[0])
    links.new(density.outputs[0], volume.inputs['Density'])
    links.new(volume.outputs[0], output.inputs['Volume'])
    d.M[name] = mat
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'hl-summit' not in d.M:
        sky = _sky_material(d, 'hl-sky')
        scree = kit._noise_mix(d, 'hl-scree', (.27, .25, .22), (.34, .31, .27), 2.2, .50, .14,
                               spots=((.50, .47, .42), 4.0, .12))
        plateau = _slab_material(d, 'hl-plateau', (.52, .44, .33), (.31, .26, .19), (.23, .19, .145), 1.45)
        zone_ground(d, 'hl-summit', 'field_cm37_01', [(sky, 0, 0), (scree, .16, .34), (plateau, .66, .84)])
    if 'hl-cave' not in d.M:
        rubble = kit._noise_mix(d, 'hl-cave-rubble', (.035, .04, .055), (.06, .065, .085), 2.6, .50, .14,
                                spots=((.11, .12, .15), 4.2, .10))
        floor = kit._noise_mix(d, 'hl-cave-floor', (.040, .045, .060), (.066, .072, .092), 1.8, .50, .16, .78,
                               spots=((.16, .17, .21), 5.0, .05))
        zone_ground(d, 'hl-cave', 'field_cm40_01', [(rubble, 0, 0), (floor, .66, .84)])
    if 'hl-cloud' not in d.M:
        _cloud_volume(d, 'hl-cloud')


# --------------------------------------------------------------------------- helpers

def zone_tiles(field_id, value):
    return [t for t, v in zone_values(field_id).items() if abs(v - value) < 1e-6]


def edge_tiles(field_id, value):
    """Tiles of zone ``value`` that touch a walkable tile (4-neighbourhood)."""
    walk = kit.walk_tiles(field_id)
    out = []
    for tx, ty in zone_tiles(field_id, value):
        if any((tx + dx, ty + dy) in walk for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            out.append((tx, ty))
    return out


def rock_fits(d, footprint, cx, cy, r, hz, margin=1.3):
    import numpy as np
    pts = [(cx + r * math.cos(a), cy + .5 * r * math.sin(a) - t * fx.lift(d, hz))
           for a in np.linspace(0, math.tau, 16) for t in (0, .5, 1)]
    return kit.core_inside(pts, footprint, margin)


def crag(d, name, cx, cy, r, hz, mat, seed):
    """Faceted, stratified rock: few sides, flat shading, stepped profile."""
    n = 7
    levels = [(0.0, 1.0), (.30, .92), (.34, .84), (.62, .76), (.66, .62), (.90, .44), (1.0, .16)]
    verts = []
    for k, (t, scale) in enumerate(levels):
        for i in range(n):
            a = i * math.tau / n + seed
            wobble = 1.0 - .22 * (.5 + .5 * math.sin(seed * 3.3 + i * 2.6))
            rr = r * scale * wobble
            verts.append(d.world(cx + rr * math.cos(a), cy + .5 * rr * math.sin(a), hz * t))
    faces = []
    for k in range(len(levels) - 1):
        a, b = k * n, (k + 1) * n
        faces += [(a + i, a + (i + 1) % n, b + (i + 1) % n, b + i) for i in range(n)]
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range((len(levels) - 1) * n, len(levels) * n)))
    return fx._object(d, name, verts, faces, mat, 0.0, ())


def place_rock(d, name, footprint, cx, cy, r, hz, mat, seed, maker=None):
    """A rock shrunk (never moved) until it fits inside the field."""
    for _ in range(8):
        if rock_fits(d, footprint, cx, cy, r, hz):
            (maker or kit.rock_mesh)(d, name, cx, cy, r, hz, mat, seed)
            return True
        r *= .85
        hz *= .85
    return False


# --------------------------------------------------------------------------- cm37 summit

def summit_core(d, footprint):
    fid = footprint['fieldId']
    # Rock rim along the plateau's back edge (sky side), silhouetted against the sky.
    k = 0
    for tx, ty in sorted(edge_tiles(fid, 0.0)):
        for j in range(1):
            cx = tx * 8 + 4 + (kit.hash01(tx, ty, j) - .5) * 3
            cy = ty * 8 + 5 + (kit.hash01(ty, tx, j) - .5) * 2
            r = 3.0 + kit.hash01(tx, ty, 9 + j) * 2.0
            hz = .28 + kit.hash01(tx, ty, 11 + j) * .34
            if place_rock(d, f'summit-rim-{k:02d}', footprint, cx, cy, r, hz,
                          ('hl-rock', 'hl-rock-dark', 'hl-rock-light')[k % 3], k):
                k += 1
    # Rock ridge up the right edge (scree side).
    for j, cy in enumerate(range(30, 92, 6)):
        r = 4.4 + (j * 5 % 3) * .7
        hz = .9 + (j * 7 % 4) * .18
        place_rock(d, f'summit-ridge-{j:02d}', footprint, 96 - r - 1.4, cy, r, hz,
                   'hl-rock-dark' if j % 2 else 'hl-rock', j + 40)
    # Scree: loose stones on the front and side tiles.
    s = 0
    for tx, ty in zone_tiles(fid, .5):
        if kit.hash01(tx, ty, 21) < .5:
            cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 22) - .5) * 5, ty * 8 + 4 + (kit.hash01(tx, ty, 23) - .5) * 4
            r = 1.4 + kit.hash01(tx, ty, 24) * 1.6
            if place_rock(d, f'summit-scree-{s:02d}', footprint, cx, cy, r, .18 + r * .04, 'hl-rock-light', s + 60):
                s += 1
    # Cairn on the scree near the front left: stacked flat stones.
    cairn = (14.0, 82.0)
    if rock_fits(d, footprint, cairn[0], cairn[1], 3.6, 1.2):
        z = 0.0
        for j, (r, t) in enumerate(((3.6, .22), (3.0, .20), (2.4, .18), (1.8, .16), (1.2, .14))):
            fx.lathe(d, f'summit-cairn-{j}', cairn[0] + (j % 2) * .3, cairn[1] - j * .15,
                     [(z, r * .92), (z + t * .5, r), (z + t, r * .78)], 'hl-cairn', 14)
            z += t
    # Weathered summit post beside the cairn (no text).
    post = (24.0, 88.0)
    if kit.core_inside([(post[0], post[1] - fx.lift(d, 1.25)), (post[0] - 2, post[1]), (post[0] + 2, post[1])],
                       footprint, 1.4):
        fx.box(d, 'summit-post', post[0], post[1], .45, .45, 0, 1.15, 'cv-timber', .004)
        fx.face_panel(d, 'summit-post-board', post[0], post[1] - .2, 2.2, .45, .78, 1.02, 'cv-timber-dark',
                      'front-left', .05, .4)
    # Alpine tufts and small white flowers on the plateau.
    walk = sorted(kit.walk_tiles(fid))
    for i, (tx, ty) in enumerate(walk):
        h = kit.hash01(tx, ty, 31)
        cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 32) - .5) * 5, ty * 8 + 4 + (kit.hash01(tx, ty, 33) - .5) * 4
        if h < .16:
            for f in range(6):
                a = f * math.tau / 6 + h * 20
                fx.pipe(d, f'summit-tuft-{i}-{f}', [(cx, cy, 0.0), (cx + math.cos(a) * 1.8, cy + .5 * math.sin(a) * 1.8, .22)],
                        .02, 'hl-grass')
        elif h < .26:
            for f in range(3):
                a = f * math.tau / 3 + h * 9
                d.sphere(f'summit-flower-{i}-{f}', d.world(cx + math.cos(a) * 1.2, cy + .5 * math.sin(a) * 1.2, .05),
                         (.035, .035, .015), 'hl-flower')
        elif h < .34:
            place_rock(d, f'summit-pebble-{i}', footprint, cx, cy, 1.1 + h * 2, .12, 'hl-rock-light', i + 90)
    # Clouds drifting below the edge, over the sky tiles.
    sky = zone_tiles(fid, 0.0)
    for j, (tx, ty) in enumerate(sorted(sky)):
        if kit.hash01(tx, ty, 41) > .45:
            continue
        cx, cy = tx * 8 + 4, ty * 8 + 5
        r = .30 + kit.hash01(tx, ty, 42) * .18
        half_w, half_h = r * d.UNIT * 1.5, r * d.UNIT * .7
        pts = [(cx + dx * half_w, cy - fx.lift(d, .25) + dy * half_h) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
        if kit.core_inside(pts, footprint, 1.4):
            d.sphere(f'summit-cloud-{j}', d.world(cx, cy, .25), (r * 1.5, r * 1.5, r * .55), 'hl-cloud')
    return ['open-summit-plateau', 'sky-and-clouds-beyond-edge', 'rock-rim', 'right-rock-ridge', 'scree', 'cairn',
            'alpine-tufts']


# --------------------------------------------------------------------------- cm40 cave

def cave_light(d, name, x, y, z, color, power):
    """A small local point light (scene lighting only; not an exported part)."""
    import bpy
    light = bpy.data.lights.new(name, 'POINT')
    light.energy = power
    light.color = color
    light.shadow_soft_size = .15
    obj = bpy.data.objects.new(name, light)
    obj.location = d.world(x, y, z)
    obj['cageFieldId'] = d.FIELD_ID     # owned by this field; no cageLayer, so never measured or exported
    bpy.context.collection.objects.link(obj)
    return obj


def cave_core(d, footprint):
    fid = footprint['fieldId']
    walk = kit.walk_tiles(fid)
    rubble = zone_tiles(fid, .5)
    # Cave wall: tall rock masses on rubble tiles above (behind) the floor, tallest at the back.
    k = 0
    for tx, ty in sorted(rubble, key=lambda t: (t[1], t[0])):
        below = any((tx, y) in walk for y in range(ty + 1, 14))
        above = any((tx, y) in walk for y in range(0, ty))
        if not below or above:
            continue
        for j in range(2):
            cx = tx * 8 + 2 + 4 * j + (kit.hash01(tx, ty, j) - .5) * 2
            cy = ty * 8 + 4 + (kit.hash01(ty, tx, j) - .5) * 2
            r = 4.8 + kit.hash01(tx, ty, 5 + j) * 2.4
            room = kit.headroom(footprint, cx - r, cx + r, cy) - r / 2 - 1.5
            hz = max(.4, min(2.6, room / fx.lift(d, 1)))
            if place_rock(d, f'cave-wall-{k:03d}', footprint, cx, cy, r, hz,
                          ('cv-rock', 'cv-rock-mid', 'cv-rock-light')[k % 3], k, crag):
                k += 1
    # Right-hand wall up the vertical edge.
    for j, cy in enumerate(range(26, 92, 5)):
        r = 4.6 + (j * 5 % 3) * .8
        room = kit.headroom(footprint, 96 - 2 * r - 1.4, 95, cy) - r / 2 - 1.5
        hz = max(.4, min(2.2, room / fx.lift(d, 1)))
        place_rock(d, f'cave-side-{j:02d}', footprint, 96 - r - 1.4, cy, r, hz,
                   'cv-rock-mid' if j % 2 else 'cv-rock', j + 50, crag)
    # Front rubble: low broken rock along the front edges.
    for j, (tx, ty) in enumerate(t for t in rubble if any((t[0], y) in walk for y in range(0, t[1]))):
        cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 61) - .5) * 4, ty * 8 + 4
        place_rock(d, f'cave-rubble-{j:02d}', footprint, cx, cy, 2.2 + kit.hash01(tx, ty, 62) * 1.8,
                   .22 + kit.hash01(tx, ty, 63) * .25, 'cv-rock-light', j + 70)
    # Mine timbers bracing the back wall: two posts and a cap beam, with a lamp.
    posts = ((53.0, 29.0), (73.0, 31.0))
    tops = []
    for j, (px, py) in enumerate(posts):
        room = kit.headroom(footprint, px - 1.5, px + 1.5, py) - 2.0
        zt = max(1.0, min(2.4, room / fx.lift(d, 1)))
        fx.box(d, f'cave-timber-post-{j}', px, py, .9, .9, 0, zt, 'cv-timber', .006)
        tops.append((px, py, zt))
    zc = min(t[2] for t in tops)
    fx.pipe(d, 'cave-timber-cap', [(posts[0][0], posts[0][1], zc - .06), (posts[1][0], posts[1][1], zc - .06)],
            .075, 'cv-timber-dark')
    fx.pipe(d, 'cave-timber-brace', [(posts[0][0] + .5, posts[0][1], zc * .55), (posts[1][0] - .5, posts[1][1], zc - .25)],
            .05, 'cv-timber')
    lamp = (posts[1][0] - 2.0, posts[1][1] + 1.0)
    fx.pipe(d, 'cave-lamp-hook', [(lamp[0], lamp[1], zc - .1), (lamp[0], lamp[1], zc - .32)], .012, 'cv-iron')
    d.sphere('cave-lamp-glass', d.world(lamp[0], lamp[1], zc - .45), (.075, .075, .10), 'cv-lamp')
    cave_light(d, 'cave-lamp-light', lamp[0], lamp[1] + 2.0, zc - .5, (1.0, .68, .32), 22.0)
    # Glowing crystal clusters and stalagmites on rubble tiles.
    crystals = ((86.0, 60.0, 'cv-crystal'), (84.0, 82.0, 'cv-crystal-violet'), (14.0, 92.0, 'cv-crystal'),
                (60.0, 100.0, 'cv-crystal-violet'))
    for j, (cx, cy, mat) in enumerate(crystals):
        if (int(cx // 8), int(cy // 8)) in walk:
            continue
        for i in range(5):
            a = i * math.tau / 5 + j
            tip = (cx + math.cos(a) * 1.6, cy + .5 * math.sin(a) * 1.6)
            height = .55 + .30 * ((i + j) % 3)
            if kit.core_inside([(tip[0], tip[1] - fx.lift(d, height + .05)), (tip[0] - 1, tip[1]), (tip[0] + 1, tip[1])],
                               footprint, 1.5):
                fx.lathe(d, f'cave-crystal-{j}-{i}', tip[0], tip[1], [(0, .85), (height * .8, .62), (height, .03)], mat, 6)
        cave_light(d, f'cave-crystal-light-{j}', cx, cy, .6, (.35, .8, 1.0) if mat == 'cv-crystal' else (.65, .45, 1.0), 6.0)
    for j, (cx, cy) in enumerate(((30.0, 96.0), (66.0, 94.0), (8.0, 40.0))):
        if (int(cx // 8), int(cy // 8)) in walk:
            continue
        if rock_fits(d, footprint, cx, cy, 1.8, 1.0):
            fx.lathe(d, f'cave-stalagmite-{j}', cx, cy, [(0, 1.8), (.4, 1.2), (.8, .6), (1.0, .05)], 'cv-rock-light', 10)
    # A few low stones on the walked floor (flat enough to stand beside).
    for j, (tx, ty) in enumerate(sorted(walk)):
        h = kit.hash01(tx, ty, 81)
        if h < .12:
            cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 82) - .5) * 4, ty * 8 + 4 + (kit.hash01(tx, ty, 83) - .5) * 3
            place_rock(d, f'cave-floor-stone-{j:02d}', footprint, cx, cy, 1.2 + h * 8, .10 + h * .4, 'cv-rock-light',
                       j + 120, crag)
    # A still puddle on the walked floor.
    puddle = [(30 + 7 * math.cos(i * math.tau / 14) * (.9 + .1 * math.sin(i * 3)),
               64 + 3.2 * math.sin(i * math.tau / 14)) for i in range(14)]
    for j, piece in enumerate(fit.clip_to_footprint(puddle, footprint, 2.0, .01)):
        fx.prism(d, f'cave-puddle-{j}', piece, .003, .009, 'cv-water', 0)
    return ['cave-interior-no-mouth', 'rock-wall-on-blocked-tiles', 'mine-timbers', 'hanging-lamp',
            'glowing-crystals', 'stalagmites', 'puddle']


# --------------------------------------------------------------------------- entry point

CORES = {'field_cm37_01': summit_core, 'field_cm40_01': cave_core}


def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_HIGHLAND_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    d.LAYER = 'base'
    features = CORES[field_id](d, footprint)
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return []
