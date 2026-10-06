"""Original coast family for the opus round: beach (cm09), small beach (cm39).

Both cages have a two-frame core (the original surface animation) and static
source objects; build with ``build-cage-opus-surface.py``.  The cell id is the
surface phase.

* The sea is its own core overlay: deep blue with lighter wave bands,
  sparkles and a foam line at the shore.  Its phase node is set per core
  frame, and its alpha comes from a sea mask so the sand shows through.
* Sand where residents walk on land, shallow sea where they wade (both from
  the product's raising-ground catalog); grass on the blocked inland tiles.
* cm09: two leaning coconut palms (source objects, fitted like the jungle
  palms), a driftwood log, shells and a starfish, pebbles on the blocked shore.
* cm39: a low fan palm at the shore (source object, the window only covers the
  bottom-right corner) and a reef of dark rocks on the blocked outer ring.

Research rasters were viewed locally only; nothing is loaded or traced.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_remaining_authoring as kit


FIELDS = ('field_cm09_01', 'field_cm39_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm09_01': 'cs-ground-09', 'field_cm39_01': 'cs-ground-39'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35
NATIVE = {'field_cm09_01': (288, 200), 'field_cm39_01': (96, 112)}

PALETTE = {
    'cs-wood': ((.46, .36, .26), .85, .0, 0),
    'cs-wood-dark': ((.30, .22, .15), .88, .0, 0),
    'cs-shell': ((.95, .86, .78), .55, .0, 0),
    'cs-star': ((.92, .42, .20), .65, .0, 0),
    'cs-pebble': ((.56, .54, .50), .80, .0, 0),
    'cs-pebble-dark': ((.38, .37, .35), .82, .0, 0),
    'cs-reef': ((.18, .20, .22), .85, .0, 0),
    'cs-reef-moss': ((.20, .36, .26), .85, .0, 0),
    'cs-foam': ((.95, .98, 1.0), .60, .0, .35),
}


# --------------------------------------------------------------------------- zones and materials

def terrain(field_id):
    """Per-tile terrain from the product data: 'sand', 'sea', 'rock' (blocked ring) or None (not this cage)."""
    import json
    spec = json.loads((gz.WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
    data = json.loads((gz.ROOT / 'src/data/championship/catalogs/raising-ground.r1.json').read_text(encoding='utf8'))
    entry = next(f for f in data['fields'] if f['definitionIndex'] == spec['definitionIndex'])
    cells = [value for count, *value in entry['runs'] for _ in range(count)]
    width = entry['width']
    out = {}
    for i, (owner, kind, _) in enumerate(cells):
        out[(i % width, i // width)] = None if owner != 1 else {0: 'sand', 2: 'sea', 1: 'rock'}.get(kind)
    return out


def sea_values(field_id):
    """1 where the sea is drawn: wading tiles, plus non-cage tiles on the sea side of the field."""
    tiles = terrain(field_id)
    w, h = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
    values = {}
    for ty in range(h):
        for tx in range(w):
            kind = tiles.get((tx, ty))
            if kind in ('sea', 'rock'):
                values[(tx, ty)] = 1.0
            elif kind == 'sand':
                values[(tx, ty)] = 0.0
            else:
                # Outside the cage's own tiles: sea if most neighbours are sea.
                near = [tiles.get((tx + dx, ty + dy)) for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2)]
                sea = sum(k in ('sea', 'rock') for k in near)
                land = sum(k == 'sand' for k in near)
                values[(tx, ty)] = 1.0 if sea > land else 0.0
    if field_id == 'field_cm09_01':
        # The right-hand hexes are open sea; the far left stays land.
        for ty in range(h):
            for tx in range(w):
                if tx >= 24:
                    values[(tx, ty)] = 1.0
                if tx <= 1:
                    values[(tx, ty)] = 0.0
    return values


def _sea_material(d, name, field_id):
    """Animated sea: wave bands and sparkles keyed to a 'phase' value; alpha from the sea mask."""
    import bpy
    mat = d.material(name, (.05, .28, .58), .12, .0, .30)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    phase = nodes.new('ShaderNodeValue')
    phase.name = 'opus-sea-phase'
    phase.outputs[0].default_value = 0.0
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
    mask = nodes.new('ShaderNodeTexImage')
    mask.image = gz.zone_image(f'sea-{field_id}', NATIVE[field_id], sea_values(field_id))
    mask.interpolation = 'Cubic'
    mask.extension = 'EXTEND'
    links.new(join.outputs[0], mask.inputs['Vector'])
    wobble = nodes.new('ShaderNodeTexNoise')
    wobble.inputs['Scale'].default_value = 2.6
    links.new(geometry.outputs['Position'], wobble.inputs['Vector'])
    edge = op('ADD', mask.outputs['Color'], op('MULTIPLY', op('SUBTRACT', wobble.outputs['Fac'], .5), .22))
    alpha = nodes.new('ShaderNodeMapRange')
    alpha.inputs['From Min'].default_value = .40
    alpha.inputs['From Max'].default_value = .50
    links.new(edge, alpha.inputs['Value'])
    links.new(alpha.outputs['Result'], shader.inputs['Alpha'])
    # Depth tint: shallow turquoise near the shore, deep blue offshore.
    deep = nodes.new('ShaderNodeMapRange')
    deep.inputs['From Min'].default_value = .5
    deep.inputs['From Max'].default_value = .95
    links.new(edge, deep.inputs['Value'])
    tint = nodes.new('ShaderNodeValToRGB')
    tint.color_ramp.elements[0].color = (.08, .50, .60, 1)
    tint.color_ramp.elements[1].color = (.015, .14, .42, 1)
    links.new(deep.outputs['Result'], tint.inputs['Fac'])
    waves = nodes.new('ShaderNodeTexWave')
    waves.wave_type = 'BANDS'
    waves.bands_direction = 'X'
    waves.inputs['Scale'].default_value = 2.2
    waves.inputs['Distortion'].default_value = 9.0
    waves.inputs['Detail'].default_value = 2.0
    links.new(geometry.outputs['Position'], waves.inputs['Vector'])
    links.new(op('MULTIPLY', phase.outputs[0], 1.0), waves.inputs['Phase Offset'])
    crest = nodes.new('ShaderNodeMapRange')
    crest.inputs['From Min'].default_value = .78
    crest.inputs['From Max'].default_value = .98
    links.new(waves.outputs['Fac'], crest.inputs['Value'])
    sparkle = nodes.new('ShaderNodeTexVoronoi')
    sparkle.voronoi_dimensions = '4D'
    sparkle.inputs['Scale'].default_value = 6.5
    links.new(geometry.outputs['Position'], sparkle.inputs['Vector'])
    links.new(op('MULTIPLY', phase.outputs[0], 1.7), sparkle.inputs['W'])
    glint = op('LESS_THAN', sparkle.outputs['Distance'], .065)
    foam = nodes.new('ShaderNodeMapRange')
    foam.inputs['From Min'].default_value = .46
    foam.inputs['From Max'].default_value = .62
    foam.inputs['To Min'].default_value = 1.0
    foam.inputs['To Max'].default_value = 0.0
    links.new(op('ADD', edge, op('MULTIPLY', op('SUBTRACT', waves.outputs['Fac'], .5), .10)), foam.inputs['Value'])
    light = op('MAXIMUM', op('MULTIPLY', crest.outputs['Result'], .20), op('MAXIMUM', glint, foam.outputs['Result']))
    colour = nodes.new('ShaderNodeMixRGB')
    links.new(light, colour.inputs[0])
    links.new(tint.outputs['Color'], colour.inputs[1])
    colour.inputs[2].default_value = (.92, .97, 1.0, 1)
    links.new(colour.outputs[0], shader.inputs['Base Color'])
    links.new(colour.outputs[0], shader.inputs['Emission Color'])
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    sand = d.M.get('cs-sand') or kit._noise_mix(d, 'cs-sand', (.86, .72, .46), (.80, .65, .40), 3.2, .50, .2,
                                                spots=((.70, .58, .38), 6.0, .05))
    grass = d.M.get('cs-grass') or kit._noise_mix(d, 'cs-grass', (.24, .50, .14), (.32, .58, .18), 2.2, .50, .18)
    for field_id in FIELDS:
        name = SURFACES[field_id]
        if name not in d.M:
            tiles = terrain(field_id)
            sea = sea_values(field_id)
            w, h = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
            values = {}
            for ty in range(h):
                for tx in range(w):
                    land = tiles.get((tx, ty)) == 'sand' or sea[(tx, ty)] == 0.0
                    inland = tiles.get((tx, ty)) is None and sea[(tx, ty)] == 0.0
                    values[(tx, ty)] = 0.0 if inland and field_id == 'field_cm09_01' and tx < 14 else 1.0
            gz.zone_ground(d, name, field_id, NATIVE[field_id], values, [(grass, 0, 0), (sand, .35, .60)], .30)
        if f'cs-sea-{field_id}' not in d.M:
            _sea_material(d, f'cs-sea-{field_id}', field_id)
    for field_id in FIELDS:
        node = d.M[f'cs-sea-{field_id}'].node_tree.nodes.get('opus-sea-phase')
        node.outputs[0].default_value = math.pi * (cell_id % 2)


# --------------------------------------------------------------------------- helpers

def sea_overlay(d, footprint):
    fid = footprint['fieldId']
    w, h = NATIVE[fid]
    whole = [(0, 0), (w, 0), (w, h), (0, h)]
    for i, piece in enumerate(fit.clip_to_footprint(whole, footprint, .6, .02)):
        fx.prism(d, f'coast-sea-{i}', piece, .010, .016, f'cs-sea-{fid}', 0)


def driftwood(d, name, a, b):
    fx.pipe(d, name + '-log', [(a[0], a[1], .16), ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - .5, .19), (b[0], b[1], .15)],
            .16, 'cs-wood')
    fx.pipe(d, name + '-branch', [((a[0] * 2 + b[0]) / 3, (a[1] * 2 + b[1]) / 3, .2),
                                  ((a[0] * 2 + b[0]) / 3 - 2, (a[1] * 2 + b[1]) / 3 - 3, .45)], .05, 'cs-wood-dark')
    for k, t in enumerate((.0, 1.0)):
        p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        d.sphere(f'{name}-end-{k}', d.world(p[0], p[1], .16), (.15, .15, .15), 'cs-wood-dark')


def shells(d, name, footprint, points):
    for k, (x, y) in enumerate(points):
        if not kit.core_inside([(x - 1.5, y), (x + 1.5, y)], footprint, 1.4):
            continue
        if k % 3 == 2:
            for i in range(5):
                a = i * math.tau / 5
                fx.pipe(d, f'{name}-star-{k}-{i}', [(x, y, .03), (x + math.cos(a) * 1.6, y + .5 * math.sin(a) * 1.6, .03)],
                        .03, 'cs-star')
        else:
            fx.lathe(d, f'{name}-shell-{k}', x, y, [(0, .9), (.05, .8), (.09, .3)], 'cs-shell', 10)


def reef(d, footprint):
    tiles = terrain(footprint['fieldId'])
    k = 0
    for (tx, ty), kind in sorted(tiles.items()):
        if kind != 'rock':
            continue
        cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 1) - .5) * 3, ty * 8 + 4 + (kit.hash01(tx, ty, 2) - .5) * 2
        r = 3.0 + kit.hash01(tx, ty, 3) * 1.8
        hz = .25 + kit.hash01(tx, ty, 4) * .3
        pts = [(cx + r * math.cos(a), cy + .5 * r * math.sin(a) - s * fx.lift(d, hz)) for a in
               [i * math.tau / 12 for i in range(12)] for s in (0, 1)]
        if not kit.core_inside(pts, footprint, 1.3):
            continue
        kit.rock_mesh(d, f'coast-reef-{k}', cx, cy, r, hz, 'cs-reef', k)
        fx.lathe(d, f'coast-reef-moss-{k}', cx, cy, [(hz * .7, r * .6), (hz * 1.0, r * .2)], 'cs-reef-moss', 10)
        kit.ring(d, f'coast-reef-foam-{k}', cx, cy, r * 1.08, .03, .03, 'cs-foam', 16)
        k += 1


# --------------------------------------------------------------------------- cores

def beach_core(d, footprint):
    sea_overlay(d, footprint)
    driftwood(d, 'coast-driftwood', (78.0, 156.0), (106.0, 146.0))
    shells(d, 'coast-shells', footprint, ((40.0, 72.0), (58.0, 96.0), (84.0, 120.0), (100.0, 160.0), (20.0, 40.0),
                                          (70.0, 140.0)))
    # Pebbles on the blocked shore tiles at the bottom.
    tiles = terrain(footprint['fieldId'])
    k = 0
    for ty in range(20, 25):
        for tx in range(10, 18):
            if tiles.get((tx, ty)) is not None:
                continue
            for j in range(3):
                x = tx * 8 + 2 + 2 * j + kit.hash01(tx, ty, j) * 2
                y = ty * 8 + 3 + kit.hash01(ty, tx, j) * 3
                r = .9 + kit.hash01(tx, ty, 10 + j) * 1.1
                if kit.core_inside([(x - r, y), (x + r, y), (x, y - fx.lift(d, .12))], footprint, 1.3):
                    fx.lathe(d, f'coast-pebble-{k}', x, y, [(0, r), (.06, r * .85), (.10, r * .35)],
                             'cs-pebble' if k % 2 else 'cs-pebble-dark', 10)
                    k += 1
    return ['animated-sea-with-foam-and-sparkle', 'sandy-shore', 'coconut-palms', 'driftwood', 'shells-and-starfish',
            'pebble-shore', 'grass-inland']


def small_beach_core(d, footprint):
    sea_overlay(d, footprint)
    reef(d, footprint)
    shells(d, 'coast-small-shells', footprint, ((78.0, 50.0), (82.0, 66.0)))
    return ['animated-sea-with-foam-and-sparkle', 'sand-strip', 'reef-on-blocked-ring', 'fan-palm']


def fan_palm(d, name, record, footprint):
    """A low fan palm at the shore; its window only reaches the bottom-right corner."""
    window = containment.source_window(record)
    x, y, w, h = window
    best = None
    for scale in [1 - .05 * i for i in range(14)]:
        for cx in (78.0, 76.0, 80.0, 74.0, 82.0):
            for cy in (84.0, 82.0, 86.0, 80.0, 88.0):
                length, top = 11.0 * scale, .55 * scale
                pts = [(cx - 1.5, cy + .6), (cx + 1.5, cy + .6)]
                for k in range(9):
                    a = k * math.tau / 9 + .3
                    for row in kit.frond_rows(d, (cx, cy, .25), a, length, top, top * .9, 3.0 * scale):
                        pts += [kit.screen(d, *p) for p in (row[0], row[2])]
                if kit.inside(pts, footprint, window):
                    best = (cx, cy, length, top, scale)
                    break
            if best:
                break
        if best:
            break
    if best is None:
        raise ValueError(f'FAN_PALM_DOES_NOT_FIT:{window}')
    cx, cy, length, top, scale = best
    fx.cylinder(d, name + '-stump', cx, cy, 1.4 * scale, 0, .28, 'jg-trunk', 10)
    for k in range(9):
        a = k * math.tau / 9 + .3
        rows = kit.frond_rows(d, (cx, cy, .25), a, length, top, top * .9, 3.0 * scale)
        kit.strip(d, f'{name}-frond-{k}', [tuple(d.world(*p) for p in row) for row in rows],
                  'jg-frond' if k % 2 else 'jg-frond-light')
    return (cx, cy)


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_COAST_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    for name in ('jg-trunk', 'jg-trunk-ring', 'jg-frond', 'jg-frond-light', 'jg-coconut'):
        if name not in d.M:
            color, roughness, metal, glow = kit.PALETTE[name]
            d.material(name, color, roughness, metal, glow)
    d.LAYER = 'base'
    features = (beach_core if field_id == 'field_cm09_01' else small_beach_core)(d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        name = f"coast{field_id[8:10]}-{record['order']:02d}"
        window = containment.source_window(record)
        if field_id == 'field_cm09_01':
            lay = kit.palm_layout(d, record, window, footprint, 'tall')
            role, anchor = 'leaning-coconut-palm', kit.palm(d, name + '-palm', lay)
        else:
            role, anchor = 'shore-fan-palm', fan_palm(d, name + '-fan-palm', record, footprint)
        containment.register_anchor(field_id, record['order'], anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = record['order']
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = record['sequenceId']
            obj['sourceCellId'] = cell_id
            obj['objectRole'] = role
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': record['sequenceId'], 'role': role,
                        'anchorNative': record['placement'], 'phase': phase, 'phases': phases,
                        'surfacePhase': cell_id % 2})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features + [f'surface-phase-{cell_id % 2}'])
    return anchors
