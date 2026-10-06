"""Original elemental family for the opus round: volcano (cm07), small volcano (cm35), ice field (cm21).

All three are core-only.  Build with ``build-cage-opus-surface.py``; the cell
id is the surface phase (cm07 and cm21 have two core frames, cm35 one).

* Volcano / small volcano: a basalt plateau.  A lava river runs to a lava sea
  below the plateau's front edge.  Where the river crosses tiles residents walk
  on, it is a cooled crust with glowing cracks; elsewhere it is molten.  The
  lava is one overlay whose plates shift between frames.  Spiky basalt crags
  stand along the plateau edge (blocked tiles), warm lights glow over the
  lava, and a little smoke drifts above the lava sea.
* Ice field: a snow-capped rock cliff on the blocked back tiles, deep snow and
  a sheet of cracked ice where residents walk, icy water with drifting floes
  at the front (floes move between the two frames).

Walkability comes from the product's raising-ground catalog.  Research rasters
were viewed locally only; nothing is loaded or traced.
"""
import json
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_remaining_authoring as kit
from . import cage_opus_highland_authoring as hl


FIELDS = ('field_cm07_01', 'field_cm21_01', 'field_cm35_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm07_01': 'el-ground-07', 'field_cm21_01': 'el-ground-21', 'field_cm35_01': 'el-ground-35'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones',
                'cage_opus_highland_authoring')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
NATIVE = {'field_cm07_01': (240, 200), 'field_cm21_01': (240, 200), 'field_cm35_01': (96, 112)}

# Lava river polylines (screen ground) with half-widths, and lava-sea polygons.
RIVER = {
    'field_cm07_01': ([(98, 2), (96, 28), (102, 50), (110, 72), (112, 92), (102, 110), (86, 124), (80, 142)],
                      (9.0, 8.0, 6.5, 6.0, 6.0, 7.0, 8.5, 10.0)),
    'field_cm35_01': ([(64, 6), (70, 26), (78, 46), (82, 64), (80, 84)], (6.0, 6.0, 5.5, 7.0, 9.0)),
}
LAVA_SEA = {
    'field_cm07_01': [(40, 148), (250, 148), (250, 210), (40, 210)],
    'field_cm35_01': [(-10, 92), (110, 82), (110, 130), (-10, 130)],
}

PALETTE = {
    'el-basalt': ((.12, .11, .11), .85, .0, 0),
    'el-basalt-mid': ((.19, .17, .16), .85, .0, 0),
    'el-basalt-light': ((.28, .25, .23), .82, .0, 0),
    'el-ember': ((1.0, .35, .05), .40, .0, 6.0),
    'el-snow-rock': ((.38, .40, .44), .85, .0, 0),
    'el-snow-rock-dark': ((.25, .27, .31), .88, .0, 0),
    'el-snow': ((.92, .95, 1.0), .70, .0, .15),
    'el-icicle': ((.78, .90, 1.0), .10, .0, .30),
    'el-floe': ((.90, .95, 1.0), .55, .0, .12),
    'el-floe-edge': ((.62, .80, .95), .30, .0, .10),
}


# --------------------------------------------------------------------------- tiles

def tiles(field_id):
    spec = json.loads((gz.WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
    data = json.loads((gz.ROOT / 'src/data/championship/catalogs/raising-ground.r1.json').read_text(encoding='utf8'))
    entry = next(f for f in data['fields'] if f['definitionIndex'] == spec['definitionIndex'])
    cells = [value for count, *value in entry['runs'] for _ in range(count)]
    width = entry['width']
    return {(i % width, i // width): (kind if owner == 1 else None) for i, (owner, kind, _) in enumerate(cells)}


def dist_to_polyline(p, points):
    best = 1e9
    for a, b in zip(points, points[1:]):
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / max(1e-9, dx * dx + dy * dy)))
        best = min(best, math.hypot(p[0] - (ax + dx * t), p[1] - (ay + dy * t)))
    return best


def river_width_at(p, points, widths):
    best, width = 1e9, widths[0]
    for (a, b), (wa, wb) in zip(zip(points, points[1:]), zip(widths, widths[1:])):
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / max(1e-9, dx * dx + dy * dy)))
        d = math.hypot(p[0] - (ax + dx * t), p[1] - (ay + dy * t))
        if d < best:
            best, width = d, wa + (wb - wa) * t
    return best, width


def lava_values(field_id):
    """1 molten, .5 crust (walkable river), 0 none — per 8-px tile."""
    kinds = tiles(field_id)
    points, widths = RIVER[field_id]
    sea = LAVA_SEA[field_id]
    w, h = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
    values = {}
    for ty in range(h):
        for tx in range(w):
            c = (tx * 8 + 4, ty * 8 + 4)
            d, width = river_width_at(c, points, widths)
            in_sea = fit.clip_to_half_planes([c, (c[0] + .1, c[1]), (c[0], c[1] + .1)], fit.half_planes(sea))
            walk = kinds.get((tx, ty)) is not None
            if in_sea and not walk:
                values[(tx, ty)] = 1.0
            elif d <= width:
                values[(tx, ty)] = .5 if walk else 1.0
            else:
                values[(tx, ty)] = 0.0
    return values


# --------------------------------------------------------------------------- materials

def _screen_uv(d, nodes, links, native):
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
    u = op('DIVIDE', op('MULTIPLY', op('ADD', split.outputs['X'], split.outputs['Y']), k), float(native[0]))
    v = op('SUBTRACT', 1.0, op('DIVIDE', op('MULTIPLY', op('SUBTRACT', split.outputs['X'], split.outputs['Y']),
                                            k * d.S), float(native[1])))
    join = nodes.new('ShaderNodeCombineXYZ')
    links.new(u, join.inputs['X'])
    links.new(v, join.inputs['Y'])
    return geometry, join.outputs[0], op


def _lava_material(d, name, field_id):
    mat = d.material(name, (1.0, .40, .06), .35, .0, 5.0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    phase = nodes.new('ShaderNodeValue')
    phase.name = 'opus-surface-phase'
    geometry, uv, op = _screen_uv(d, nodes, links, NATIVE[field_id])
    mask = nodes.new('ShaderNodeTexImage')
    mask.image = gz.zone_image(f'lava-{field_id}', NATIVE[field_id], lava_values(field_id), 1.6)
    mask.interpolation = 'Cubic'
    mask.extension = 'EXTEND'
    links.new(uv, mask.inputs['Vector'])
    wobble = nodes.new('ShaderNodeTexNoise')
    wobble.inputs['Scale'].default_value = 3.0
    links.new(geometry.outputs['Position'], wobble.inputs['Vector'])
    value = op('ADD', mask.outputs['Color'], op('MULTIPLY', op('SUBTRACT', wobble.outputs['Fac'], .5), .18))
    alpha = nodes.new('ShaderNodeMapRange')
    alpha.inputs['From Min'].default_value = .22
    alpha.inputs['From Max'].default_value = .30
    links.new(value, alpha.inputs['Value'])
    links.new(alpha.outputs['Result'], shader.inputs['Alpha'])
    molten = nodes.new('ShaderNodeMapRange')
    molten.inputs['From Min'].default_value = .62
    molten.inputs['From Max'].default_value = .78
    links.new(value, molten.inputs['Value'])
    plates = nodes.new('ShaderNodeTexVoronoi')
    plates.voronoi_dimensions = '4D'
    plates.feature = 'DISTANCE_TO_EDGE'
    plates.inputs['Scale'].default_value = 3.2
    links.new(geometry.outputs['Position'], plates.inputs['Vector'])
    links.new(op('MULTIPLY', phase.outputs[0], .35), plates.inputs['W'])
    seam = nodes.new('ShaderNodeMapRange')
    seam.inputs['From Min'].default_value = .0
    seam.inputs['From Max'].default_value = .09
    seam.inputs['To Min'].default_value = 1.0
    seam.inputs['To Max'].default_value = 0.0
    links.new(plates.outputs['Distance'], seam.inputs['Value'])
    # Molten: bright with darker plates; crust: dark with glowing seams.
    hot = nodes.new('ShaderNodeValToRGB')
    hot.color_ramp.elements[0].color = (.30, .035, .01, 1)
    hot.color_ramp.elements[1].color = (1.0, .55, .08, 1)
    links.new(seam.outputs['Result'], hot.inputs['Fac'])
    crust = nodes.new('ShaderNodeMixRGB')
    links.new(seam.outputs['Result'], crust.inputs[0])
    crust.inputs[1].default_value = (.05, .04, .04, 1)
    crust.inputs[2].default_value = (.95, .30, .03, 1)
    colour = nodes.new('ShaderNodeMixRGB')
    links.new(molten.outputs['Result'], colour.inputs[0])
    links.new(crust.outputs[0], colour.inputs[1])
    links.new(hot.outputs['Color'], colour.inputs[2])
    links.new(colour.outputs[0], shader.inputs['Base Color'])
    links.new(colour.outputs[0], shader.inputs['Emission Color'])
    # Emission: molten plates glow dimly, seams brightly; the crust only along its cracks.
    e_molten = op('ADD', .30, op('MULTIPLY', seam.outputs['Result'], 2.0))
    e_crust = op('MULTIPLY', seam.outputs['Result'], 1.3)
    blend = nodes.new('ShaderNodeMix')
    blend.data_type = 'FLOAT'
    links.new(molten.outputs['Result'], blend.inputs['Factor'])
    links.new(e_crust, blend.inputs['A'])
    links.new(e_molten, blend.inputs['B'])
    links.new(blend.outputs['Result'], shader.inputs['Emission Strength'])
    return mat


def _ice_water_material(d, name, field_id, values):
    mat = d.material(name, (.06, .30, .52), .10, .0, .25)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    phase = nodes.new('ShaderNodeValue')
    phase.name = 'opus-surface-phase'
    geometry, uv, op = _screen_uv(d, nodes, links, NATIVE[field_id])
    mask = nodes.new('ShaderNodeTexImage')
    mask.image = gz.zone_image(f'icewater-{field_id}', NATIVE[field_id], values)
    mask.interpolation = 'Cubic'
    mask.extension = 'EXTEND'
    links.new(uv, mask.inputs['Vector'])
    wobble = nodes.new('ShaderNodeTexNoise')
    wobble.inputs['Scale'].default_value = 2.6
    links.new(geometry.outputs['Position'], wobble.inputs['Vector'])
    edge = op('ADD', mask.outputs['Color'], op('MULTIPLY', op('SUBTRACT', wobble.outputs['Fac'], .5), .2))
    alpha = nodes.new('ShaderNodeMapRange')
    alpha.inputs['From Min'].default_value = .40
    alpha.inputs['From Max'].default_value = .50
    links.new(edge, alpha.inputs['Value'])
    links.new(alpha.outputs['Result'], shader.inputs['Alpha'])
    waves = nodes.new('ShaderNodeTexWave')
    waves.wave_type = 'BANDS'
    waves.bands_direction = 'X'
    waves.inputs['Scale'].default_value = 2.4
    waves.inputs['Distortion'].default_value = 8.0
    links.new(geometry.outputs['Position'], waves.inputs['Vector'])
    links.new(phase.outputs[0], waves.inputs['Phase Offset'])
    crest = nodes.new('ShaderNodeMapRange')
    crest.inputs['From Min'].default_value = .80
    crest.inputs['From Max'].default_value = .98
    links.new(waves.outputs['Fac'], crest.inputs['Value'])
    rim = nodes.new('ShaderNodeMapRange')
    rim.inputs['From Min'].default_value = .46
    rim.inputs['From Max'].default_value = .60
    rim.inputs['To Min'].default_value = 1.0
    rim.inputs['To Max'].default_value = 0.0
    links.new(edge, rim.inputs['Value'])
    light = op('MAXIMUM', op('MULTIPLY', crest.outputs['Result'], .25), rim.outputs['Result'])
    colour = nodes.new('ShaderNodeMixRGB')
    links.new(light, colour.inputs[0])
    colour.inputs[1].default_value = (.04, .24, .46, 1)
    colour.inputs[2].default_value = (.86, .95, 1.0, 1)
    links.new(colour.outputs[0], shader.inputs['Base Color'])
    links.new(colour.outputs[0], shader.inputs['Emission Color'])
    return mat


def _cracked_ice(d, name):
    mat = d.material(name, (.74, .86, .94), .18, .0, .10)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry = nodes.new('ShaderNodeNewGeometry')
    cracks = nodes.new('ShaderNodeTexVoronoi')
    cracks.feature = 'DISTANCE_TO_EDGE'
    cracks.inputs['Scale'].default_value = 1.4
    links.new(geometry.outputs['Position'], cracks.inputs['Vector'])
    line = nodes.new('ShaderNodeMath')
    line.operation = 'LESS_THAN'
    line.inputs[1].default_value = .02
    links.new(cracks.outputs['Distance'], line.inputs[0])
    tone = nodes.new('ShaderNodeTexNoise')
    tone.inputs['Scale'].default_value = 3.0
    links.new(geometry.outputs['Position'], tone.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.66, .80, .92, 1)
    ramp.color_ramp.elements[1].color = (.86, .94, 1.0, 1)
    links.new(tone.outputs['Fac'], ramp.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB')
    links.new(line.outputs[0], mix.inputs[0])
    links.new(ramp.outputs[0], mix.inputs[1])
    mix.inputs[2].default_value = (.42, .58, .72, 1)
    links.new(mix.outputs[0], shader.inputs['Base Color'])
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'el-ground-07' not in d.M:
        basalt = kit._noise_mix(d, 'el-basalt-ground', (.065, .06, .058), (.11, .10, .095), 1.6, .50, .16,
                                spots=((.19, .17, .15), 4.6, .06))
        ash = kit._noise_mix(d, 'el-ash', (.14, .13, .125), (.19, .17, .16), 2.2, .50, .16,
                             spots=((.27, .25, .23), 5.0, .08))
        for field_id in ('field_cm07_01', 'field_cm35_01'):
            walk = {t for t, k in tiles(field_id).items() if k is not None}
            w, h = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
            values = {(tx, ty): (1.0 if (tx, ty) in walk else 0.0) for tx in range(w) for ty in range(h)}
            gz.zone_ground(d, SURFACES[field_id], field_id, NATIVE[field_id], values, [(ash, 0, 0), (basalt, .4, .62)])
            _lava_material(d, f'el-lava-{field_id}', field_id)
    if 'el-ground-21' not in d.M:
        kinds = tiles('field_cm21_01')
        snow = kit._noise_mix(d, 'el-snow-ground', (.90, .93, .98), (.80, .86, .94), 1.8, .50, .2,
                              spots=((1.0, 1.0, 1.0), 6.0, .03))
        ice = _cracked_ice(d, 'el-ice-sheet')
        rock = kit._noise_mix(d, 'el-cliff-ground', (.34, .36, .40), (.46, .48, .52), 2.0, .50, .16)
        w, h = 30, 25
        values = {}
        for ty in range(h):
            for tx in range(w):
                k = kinds.get((tx, ty))
                values[(tx, ty)] = {3: 1.0, 0: .5}.get(k, .5 if ty >= 12 else 0.0)
        gz.zone_ground(d, SURFACES['field_cm21_01'], 'field_cm21_01', NATIVE['field_cm21_01'], values,
                       [(rock, 0, 0), (ice, .2, .32), (snow, .68, .82)])
        water = {(tx, ty): (1.0 if (kinds.get((tx, ty)) == 2 or (kinds.get((tx, ty)) is None and ty >= 19)) else 0.0)
                 for tx in range(w) for ty in range(h)}
        _ice_water_material(d, 'el-icewater', 'field_cm21_01', water)
    for name in ('el-lava-field_cm07_01', 'el-lava-field_cm35_01', 'el-icewater'):
        node = d.M[name].node_tree.nodes.get('opus-surface-phase')
        node.outputs[0].default_value = math.pi * (cell_id % 2)


# --------------------------------------------------------------------------- shared pieces

def overlay(d, name, footprint, mat):
    fid = footprint['fieldId']
    w, h = NATIVE[fid]
    for i, piece in enumerate(fit.clip_to_footprint([(0, 0), (w, 0), (w, h), (0, h)], footprint, .6, .02)):
        fx.prism(d, f'{name}-{i}', piece, .010, .016, mat, 0)


def warm_light(d, name, x, y, z, power):
    import bpy
    light = bpy.data.lights.new(name, 'POINT')
    light.energy = power
    light.color = (1.0, .45, .12)
    light.shadow_soft_size = .3
    obj = bpy.data.objects.new(name, light)
    obj.location = d.world(x, y, z)
    obj['cageFieldId'] = d.FIELD_ID
    bpy.context.collection.objects.link(obj)


def edge_crags(d, name, footprint, field_id, mats, rows=None, tall=(1.0, .8)):
    """Spiky crags on blocked tiles that touch walked ground (the plateau's edge)."""
    kinds = tiles(field_id)
    walk = {t for t, k in kinds.items() if k is not None}
    lava = lava_values(field_id) if field_id in RIVER else {}
    k = 0
    for (tx, ty), kind in sorted(kinds.items()):
        if kind is not None or (rows and not rows(ty)) or lava.get((tx, ty), 0) >= 1.0:
            continue
        if not any((tx + dx, ty + dy) in walk for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            continue
        for j in range(2):
            cx = tx * 8 + 2 + 4 * j + (kit.hash01(tx, ty, j) - .5) * 2
            cy = ty * 8 + 4 + (kit.hash01(ty, tx, j) - .5) * 2
            r = 2.4 + kit.hash01(tx, ty, 5 + j) * 2.0
            hz = tall[1] + kit.hash01(tx, ty, 7 + j) * tall[0]
            if hl.place_rock(d, f'{name}-{k:03d}', footprint, cx, cy, r, hz, mats[k % len(mats)], k, hl.crag):
                k += 1


def smoke(d, name, footprint, points, phase):
    for k, (x, y, r) in enumerate(points):
        z = .7 + .2 * (k % 3)
        x2 = x + (1.5 if phase % 2 else 0.0)
        half_w, half_h = r * d.UNIT * 1.4, d.UNIT * math.hypot(1.4 * r * d.S, .9 * r * d.C)
        pts = [(x2 + dx * half_w, y - fx.lift(d, z) + dy * half_h) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
        if kit.core_inside(pts, footprint, 1.4):
            d.sphere(f'{name}-{k}', d.world(x2, y, z), (r * 1.4, r * 1.4, r * .9), 'el-smoke')


# --------------------------------------------------------------------------- cores

def volcano_core(d, footprint, phase):
    fid = footprint['fieldId']
    overlay(d, 'volcano-lava', footprint, f'el-lava-{fid}')
    bottom = 17 if fid == 'field_cm07_01' else 9
    edge_crags(d, 'volcano-crag', footprint, fid, ('el-basalt', 'el-basalt-mid', 'el-basalt-light'))
    # Scattered basalt rocks on the walked plateau.
    kinds = tiles(fid)
    j = 0
    for (tx, ty), kind in sorted(kinds.items()):
        if kind is None or kit.hash01(tx, ty, 21) > .10:
            continue
        cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 22) - .5) * 4, ty * 8 + 4 + (kit.hash01(tx, ty, 23) - .5) * 3
        if lava_values(fid).get((tx, ty), 0) > 0:
            continue
        hl.place_rock(d, f'volcano-rock-{j}', footprint, cx, cy, 1.4 + kit.hash01(tx, ty, 24) * 1.4, .18, 'el-basalt-mid',
                      j + 40, hl.crag)
        j += 1
    # Warm light over the lava, a little smoke above the lava sea.
    points, _ = RIVER[fid]
    for k, p in enumerate(points[::2]):
        warm_light(d, f'volcano-glow-{k}', p[0], p[1], .8, 18.0)
    sea = LAVA_SEA[fid]
    sx = (min(p[0] for p in sea) + max(p[0] for p in sea)) / 2
    warm_light(d, 'volcano-sea-glow', sx, sea[0][1] + 18, 1.0, 40.0)
    if fid == 'field_cm07_01':
        smoke(d, 'volcano-smoke', footprint, ((92.0, 170.0, .35), (196.0, 166.0, .32), (150.0, 182.0, .28)), phase)
    else:
        smoke(d, 'volcano-smoke', footprint, ((60.0, 100.0, .26),), phase)
    return ['basalt-plateau', 'lava-river-molten-and-crust', 'lava-sea', 'edge-crags', 'warm-glow', 'smoke',
            f'surface-phase-{phase}']


def ice_core(d, footprint, phase):
    fid = footprint['fieldId']
    overlay(d, 'ice-water', footprint, 'el-icewater')
    kinds = tiles(fid)
    # Snow-capped rock cliff on the blocked back tiles.
    k = 0
    for (tx, ty), kind in sorted(kinds.items()):
        if kind is not None or ty > 11:
            continue
        for j in range(2):
            cx = tx * 8 + 2 + 4 * j + (kit.hash01(tx, ty, j) - .5) * 2
            cy = ty * 8 + 4 + (kit.hash01(ty, tx, j) - .5) * 2
            r = 3.4 + kit.hash01(tx, ty, 5 + j) * 2.4
            room = kit.headroom(footprint, cx - r, cx + r, cy) - r / 2 - 1.5
            hz = max(.4, min(1.8, room / fx.lift(d, 1)))
            for _ in range(8):
                if hl.rock_fits(d, footprint, cx, cy, r, hz * 1.02):
                    break
                r, hz = r * .85, hz * .85
            else:
                continue
            hl.crag(d, f'ice-cliff-{k:03d}', cx, cy, r, hz, 'el-snow-rock' if k % 2 else 'el-snow-rock-dark', k)
            fx.lathe(d, f'ice-cliff-cap-{k:03d}', cx, cy, [(hz * .74, r * .62), (hz * .92, r * .42), (hz * 1.0, r * .12)],
                     'el-snow', 10)
            k += 1
    # Snow drifts on snow tiles; a few ice crystals on the ice sheet.
    j = 0
    for (tx, ty), kind in sorted(kinds.items()):
        if kind == 3 and kit.hash01(tx, ty, 31) < .14:
            cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 32) - .5) * 4, ty * 8 + 4
            if kit.core_inside([(cx - 4, cy), (cx + 4, cy), (cx, cy - fx.lift(d, .3))], footprint, 1.3):
                fx.lathe(d, f'ice-drift-{j}', cx, cy, [(0, 4.0), (.12, 3.2), (.22, 1.6), (.26, .3)], 'el-snow', 16)
                j += 1
        elif kind == 0 and kit.hash01(tx, ty, 33) < .06:
            cx, cy = tx * 8 + 4, ty * 8 + 4
            for i in range(3):
                a = i * math.tau / 3 + tx
                fx.lathe(d, f'ice-crystal-{j}-{i}', cx + math.cos(a) * 1.2, cy + .5 * math.sin(a) * 1.2,
                         [(0, .5), (.3 + .1 * i, .3), (.45 + .1 * i, .02)], 'el-icicle', 6)
            j += 1
    # Ice floes on the water; they drift a little between the two frames.
    water = [(tx, ty) for (tx, ty), kind in kinds.items() if kind == 2 or (kind is None and ty >= 19)]
    drift = (0.0, 1.2)[phase % 2]
    f = 0
    for (tx, ty) in sorted(water):
        if kit.hash01(tx, ty, 41) > .45:
            continue
        cx = tx * 8 + 4 + (kit.hash01(tx, ty, 42) - .5) * 3 + drift
        cy = ty * 8 + 4 + (kit.hash01(tx, ty, 43) - .5) * 2 + drift * .3
        r = 2.4 + kit.hash01(tx, ty, 44) * 2.4
        n = 6
        poly = [(cx + r * (.8 + .2 * math.sin(i * 2.3 + tx)) * math.cos(i * math.tau / n),
                 cy + .5 * r * (.8 + .2 * math.sin(i * 1.9 + ty)) * math.sin(i * math.tau / n)) for i in range(n)]
        if not kit.core_inside(poly + [(cx, cy - fx.lift(d, .1))], footprint, 1.4):
            continue
        fx.prism(d, f'ice-floe-{f}', poly, .016, .07, 'el-floe', .004)
        f += 1
    return ['snow-capped-rock-cliff', 'deep-snow', 'cracked-ice-sheet', 'icy-water-with-drifting-floes',
            'snow-drifts', 'ice-crystals', f'surface-phase-{phase}']


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_ELEMENTAL_FIELD:' + field_id)
    if 'el-smoke' not in d.M:
        smoke_mat = d.material('el-smoke', (.30, .28, .27), .9, .0, .0)
        smoke_mat.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .30
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    d.LAYER = 'base'
    phase = cell_id % 2
    features = (ice_core if field_id == 'field_cm21_01' else volcano_core)(d, footprint, phase)
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return []
