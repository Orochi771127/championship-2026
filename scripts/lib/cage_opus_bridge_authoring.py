"""Original authoring for the high mountain (cm10): two summits joined by a plank bridge.

Same family look as the small mountain (cm37): warm cracked rock where
residents walk and scree around it.  The land of both summits runs down to
the two ends of the bridge; sky and low volumetric clouds fill only the chasm
between the bridge heads, edged by a dark cliff band.  The deck spans the
chasm and rests on the land at both ends; it is walkable ground, so it stays
at floor level.  The back railing is core, the front railing and the posts
are the source objects.  Some source
windows on the right carry the vertical-flip flag and sit lower than their
left-hand counterparts; each is designed into its own window as given (a deck
bollard, a front stake, and a tall mooring post on the right approach).

Research rasters were viewed locally only; nothing is loaded or traced.
"""
import math

from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_highland_authoring as hl
from . import cage_opus_remaining_authoring as kit


FIELDS = ('field_cm10_01',)
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm10_01': 'br-ground'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_highland_authoring',
                'cage_opus_ground_zones', 'cage_authoring_coordinates')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
U, V = fx.U, fx.V
NATIVE = (288, 200)
DECK = (84.0, 204.0, 127.5, 168.5)      # x0, x1, back edge y, front edge y (native ground)
CHASM_TILES = (11, 24, 11)              # tile columns 11..24 (x 88..200) from tile row 11 down
DECK_TOP = .13
RAIL_POSTS = (86.0, 110.0, 134.0, 158.0, 182.0, 202.0)
DESIGN_MARGIN = 1.35

PALETTE = {
    'br-plank': ((.55, .36, .19), .72, .0, 0),
    'br-plank-dark': ((.42, .27, .13), .76, .0, 0),
    'br-beam': ((.26, .16, .08), .80, .0, 0),
    'br-post': ((.36, .22, .11), .78, .0, 0),
    'br-rope': ((.66, .56, .36), .80, .0, 0),
    'br-rock': ((.44, .40, .35), .86, .0, 0),
    'br-rock-dark': ((.31, .28, .25), .88, .0, 0),
    'br-rock-light': ((.58, .54, .48), .84, .0, 0),
    'br-grass': ((.30, .46, .16), .75, .0, 0),
    'br-flower': ((.94, .94, .88), .60, .0, 0),
    'br-cliff': ((.17, .15, .14), .90, .0, 0),
}


def in_chasm(tx, ty):
    return CHASM_TILES[0] <= tx <= CHASM_TILES[1] and ty >= CHASM_TILES[2]


def zones(field_id):
    """1 walked summit/approach rock, .5 scree land, 0 the chasm (sky; under the deck too)."""
    walk = gz.walk_tiles(field_id)
    values = {}
    for ty in range(NATIVE[1] // 8):
        for tx in range(NATIVE[0] // 8):
            if in_chasm(tx, ty):
                values[(tx, ty)] = 0.0
            elif (tx, ty) in walk:
                values[(tx, ty)] = 1.0
            else:
                values[(tx, ty)] = .5
    return values


def _sky(d, name):
    mat = d.material(name, (.30, .52, .86), .9, .0, .35)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    geometry = nodes.new('ShaderNodeNewGeometry')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.0
    noise.inputs['Detail'].default_value = 5.0
    links.new(geometry.outputs['Position'], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .58
    ramp.color_ramp.elements[0].color = (.26, .50, .86, 1)
    ramp.color_ramp.elements[1].position = .76
    ramp.color_ramp.elements[1].color = (.90, .93, .97, 1)
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    links.new(ramp.outputs['Color'], shader.inputs['Emission Color'])
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'br-ground' not in d.M:
        sky = _sky(d, 'br-sky')
        scree = kit._noise_mix(d, 'br-scree', (.21, .19, .17), (.27, .25, .22), 2.2, .50, .14,
                               spots=((.40, .37, .33), 4.0, .12))
        summit = hl._slab_material(d, 'br-summit', (.52, .44, .33), (.31, .26, .19), (.23, .19, .145), 1.45)
        cliff = kit._noise_mix(d, 'br-cliff-face', (.13, .12, .11), (.20, .18, .16), 3.0, .50, .16,
                               spots=((.27, .25, .22), 5.0, .08))
        gz.zone_ground(d, 'br-ground', 'field_cm10_01', NATIVE, zones('field_cm10_01'),
                       [(sky, 0, 0), (cliff, .05, .12), (scree, .24, .36), (summit, .66, .84)], .18)
    if 'br-cloud' not in d.M:
        hl._cloud_volume(d, 'br-cloud')


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


def sag(a, b, z, drop, count=6):
    """Points of a rope hanging between two posts (screen-ground x, y with height)."""
    out = []
    for i in range(count + 1):
        t = i / count
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z - drop * 4 * t * (1 - t)))
    return out


def railing(d, name, y, xs, top=1.02, low=.58):
    """Posts, a sagging hand rope, a lower rope and hangers along one deck edge."""
    for i, x in enumerate(xs):
        fx.cylinder(d, f'{name}-post-{i}', x, y, .95, DECK_TOP, top + .08, 'br-post', 10)
        fx.cylinder(d, f'{name}-cap-{i}', x, y, 1.15, top + .08, top + .13, 'br-beam', 10)
    for i, (a, b) in enumerate(zip(xs, xs[1:])):
        upper = sag((a, y), (b, y), top, .12)
        lower = sag((a, y), (b, y), low, .07)
        fx.pipe(d, f'{name}-rope-{i}', upper, .032, 'br-rope')
        fx.pipe(d, f'{name}-rope-low-{i}', lower, .024, 'br-rope')
        steps = max(2, int((b - a) // 4))
        for k in range(1, steps):
            t = k / steps
            x = a + (b - a) * t
            z = top - .12 * 4 * t * (1 - t)
            fx.pipe(d, f'{name}-hanger-{i}-{k}', [(x, y, z), (x, y, DECK_TOP + .01)], .012, 'br-rope')


def post(d, name, x, y, r, height, wraps=True):
    fx.cylinder(d, name + '-shaft', x, y, r, 0, height, 'br-post', 12)
    fx.lathe(d, name + '-top', x, y, [(height, r), (height + .08, r * .7), (height + .12, r * .2)], 'br-beam', 12)
    if wraps:
        for k, z in enumerate((height * .45, height * .7)):
            fx.cylinder(d, f'{name}-wrap-{k}', x, y, r * 1.12, z, z + .07, 'br-rope', 12)
    return (x, y)


def fit_post(d, footprint, window, x, y, r, height):
    """Shrink a post's height (never move it) until it fits its window and the field."""
    while height > .3:
        pts = [(x - r, y), (x + r, y), (x, y + r / 2), (x, y - fx.lift(d, height + .13) - r / 2)]
        if inside(pts, footprint, window):
            return height
        height -= .05
    raise ValueError(f'POST_DOES_NOT_FIT:{window}')


# --------------------------------------------------------------------------- core

def bridge_core(d, footprint):
    import numpy as np
    fid = footprint['fieldId']
    values = zones(fid)
    x0, x1, y0, y1 = DECK
    # Deck: two stringers and planks across the bridge.
    for k, y in enumerate((y0 + .9, y1 - .9)):
        fx.prism(d, f'bridge-stringer-{k}', [(x0, y - .9), (x1, y - .9), (x1, y + .9), (x0, y + .9)], 0.0, .065,
                 'br-beam', .004)
    x, k = x0 + .3, 0
    while x + 3.0 <= x1:
        w = 3.0 + .3 * ((k * 7) % 3) / 2
        j = ((k * 5) % 3 - 1) * .35
        fx.prism(d, f'bridge-plank-{k:03d}', [(x, y0 + j * .5), (x + w, y0 + j * .5), (x + w, y1 + j), (x, y1 + j)],
                 .07, DECK_TOP, 'br-plank' if k % 3 else 'br-plank-dark', .006)
        x += w + .35
        k += 1
    railing(d, 'bridge-back-rail', y0 + 1.0, RAIL_POSTS)
    for k, z in enumerate((1.02, .58)):
        fx.pipe(d, f'bridge-back-tie-{k}', [(RAIL_POSTS[0], y0 + 1.0, z), (73.6, 123.8, z + .25)], .028, 'br-rope')
    # Summit rims: rocks on rim tiles that face the chasm.
    walk = gz.walk_tiles(fid)
    r_id = 0
    for (tx, ty), value in sorted(values.items()):
        if value != .5:
            continue
        near_walk = any((tx + dx, ty + dy) in walk for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        near_sky = any(in_chasm(tx + dx, ty + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if not (near_walk or near_sky) or kit.hash01(tx, ty, 5) > (.75 if near_sky else .40):
            continue
        cx = tx * 8 + 4 + (kit.hash01(tx, ty, 1) - .5) * 4
        cy = ty * 8 + 5 + (kit.hash01(tx, ty, 2) - .5) * 3
        r = (4.2 if near_sky else 2.6) + kit.hash01(tx, ty, 3) * 2.6
        hz = (.45 if near_sky else .22) + kit.hash01(tx, ty, 4) * .45
        if hl.place_rock(d, f'summit-rim-{r_id:03d}', footprint, cx, cy, r, hz,
                         ('br-rock', 'br-rock-dark', 'br-rock-light')[r_id % 3], r_id):
            r_id += 1
    # A tall rock spire at the back of the right summit, crags on the left summit's back.
    for j, (cx, cy, r) in enumerate(((274.0, 52.0, 8.5), (262.0, 40.0, 6.5), (18.0, 50.0, 7.5), (32.0, 38.0, 6.0))):
        room = kit.headroom(footprint, cx - r, cx + r, cy) - r / 2 - 1.5
        hz = max(.5, min(1.5, room / fx.lift(d, 1)))
        hl.place_rock(d, f'summit-spire-{j}', footprint, cx, cy, r, hz, 'br-rock-dark' if j % 2 else 'br-rock', j + 7,
                      hl.crag)
    # Alpine tufts, flowers and pebbles on the walked summit rock (not on the deck).
    for i, (tx, ty) in enumerate(sorted(walk)):
        if values.get((tx, ty)) != 1.0:
            continue
        h = kit.hash01(tx, ty, 31)
        cx, cy = tx * 8 + 4 + (kit.hash01(tx, ty, 32) - .5) * 5, ty * 8 + 4 + (kit.hash01(tx, ty, 33) - .5) * 4
        if h < .14:
            for f in range(6):
                a = f * math.tau / 6 + h * 20
                fx.pipe(d, f'summit-tuft-{i}-{f}', [(cx, cy, 0.0), (cx + math.cos(a) * 1.8, cy + .5 * math.sin(a) * 1.8, .22)],
                        .02, 'br-grass')
        elif h < .22:
            for f in range(3):
                a = f * math.tau / 3 + h * 9
                d.sphere(f'summit-flower-{i}-{f}', d.world(cx + math.cos(a) * 1.2, cy + .5 * math.sin(a) * 1.2, .05),
                         (.035, .035, .015), 'br-flower')
        elif h < .30:
            hl.place_rock(d, f'summit-pebble-{i}', footprint, cx, cy, 1.1 + h * 2, .12, 'br-rock-light', i + 90)
    # Clouds in the chasm, behind and below the deck.
    for j, ((tx, ty), value) in enumerate(sorted(values.items())):
        if not in_chasm(tx, ty) or kit.hash01(tx, ty, 41) > .48:
            continue
        cx, cy = tx * 8 + 4, ty * 8 + 5
        if DECK[0] - 4 <= cx <= DECK[1] + 4 and DECK[2] - 4 <= cy <= DECK[3] + 2:
            continue
        r = .32 + kit.hash01(tx, ty, 42) * .2
        # Projected half-extents of the flattened puff (scale 1.5r, 1.5r, .55r).
        half_w = r * d.UNIT * 1.5
        half_h = d.UNIT * math.hypot(1.5 * r * d.S, .55 * r * d.C)
        pts = [(cx + dx * half_w, cy - fx.lift(d, .25) + dy * half_h) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
        if kit.core_inside(pts, footprint, 1.4):
            d.sphere(f'chasm-cloud-{j}', d.world(cx, cy, .25), (r * 1.5, r * 1.5, r * .55), 'br-cloud')
    return ['twin-summits-land-reaching-both-bridge-ends', 'plank-suspension-bridge', 'cloud-filled-chasm-only',
            'cliff-band-at-chasm-edges', 'rock-rims-and-outcrops', 'alpine-tufts']


# --------------------------------------------------------------------------- objects

def bridge_object(d, record, footprint):
    ordinal = record['order']
    window = containment.source_window(record)
    x, y, w, h = window
    name = f'bridge-{ordinal:02d}'
    if record['sequenceId'] == 1:
        # Front railing along the deck's front edge.
        rail_y = DECK[3] - 1.6
        xs = [px for px in RAIL_POSTS if x + 2 <= px <= x + w - 2]
        railing(d, name + '-front-rail', rail_y, xs)
        fx.pipe(d, name + '-front-guy', [(xs[-1], rail_y, 1.02), (213.4, 150.0, .95)], .026, 'br-rope')
        # Tie the ropes back to the left bridge-head post (ordinal 2, just outside this railing).
        for k, z in enumerate((1.02, .58)):
            fx.pipe(d, f'{name}-front-tie-{k}', [(70.6, rail_y, z + .04), (xs[0], rail_y, z)], .028, 'br-rope')
        return 'bridge-front-railing', (sum(xs) / len(xs), rail_y)
    if ordinal == 4:      # left back bridge-head post
        height = fit_post(d, footprint, window, 72.0, 123.5, 2.0, 2.0)
        return 'bridge-head-post', post(d, name + '-post', 72.0, 123.5, 2.0, height)
    if ordinal == 0:      # anchor stake and rope coil behind it
        height = fit_post(d, footprint, window, 72.0, 112.0, .8, 1.4)
        post(d, name + '-stake', 72.0, 112.0, .8, height, wraps=False)
        kit.ring(d, name + '-coil', 72.0, 114.5, 2.2, .06, .05, 'br-rope', 16)
        return 'anchor-stake', (72.0, 112.0)
    if ordinal == 2:      # left front bridge-head post
        height = fit_post(d, footprint, window, 69.0, 166.0, 2.0, 2.0)
        return 'bridge-head-post', post(d, name + '-post', 69.0, 166.0, 2.0, height)
    if ordinal == 1:      # right front stake
        height = fit_post(d, footprint, window, 214.0, 149.0, .8, 1.5)
        return 'bridge-stake', post(d, name + '-stake', 214.0, 149.0, .8, height, wraps=False)
    if ordinal == 5:      # low rope bollard at the deck's right back corner
        height = fit_post(d, footprint, window, 201.0, 130.5, 1.6, .6)
        return 'deck-bollard', post(d, name + '-bollard', 201.0, 130.5, 1.6, height)
    # ordinal 3: a tall mooring post on the right approach, in front of the bridge head
    height = fit_post(d, footprint, window, 207.0, 189.5, 1.8, 2.25)
    post(d, name + '-post', 207.0, 189.5, 1.8, height, wraps=True)
    return 'mooring-post', (207.0, 189.5)


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_BRIDGE_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = bridge_core(d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        role, anchor = bridge_object(d, record, footprint)
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
