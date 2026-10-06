"""Original grassland for the opus round: meadow cm08 (草原).

Intent from the field spec: a wide grassland, clustered shrubs and grassland
rocks.  What separates it from its neighbours is land use and vegetation
density: no trees (forest cm11), no palms (jungle cm12), no barn or fences
(ranch cm26), no beds or paths (gardens cm18/cm32), no bare dirt (vacant lot
cm01) - an open, wind-swept meadow.

* Ground: wild meadow grass with large yellow-green and dark patches where
  residents walk; darker, denser grass on the blocked tiles.
* Tall grass tufts (blade meshes, all leaning with the same wind) and shrub
  clusters on the blocked edges; everything south of a walked tile stays low.
* A rocky ridge on the blocked right edge of the upper hex, a few weathered
  boulders on other blocked tiles, flat stones half sunk in the walked grass.
* Wildflowers scattered as tiny low dots; the two source objects are yellow
  flower clumps whose heads sway between two poses.

Walkability comes from the product's raising-ground catalog.  Research rasters
were viewed locally only; nothing is loaded or traced.
"""
import math

from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_garden_authoring as gd
from . import cage_opus_ground_zones as gz
from . import cage_opus_highland_authoring as hl
from . import cage_opus_remaining_authoring as kit


FIELDS = ('field_cm08_01',)
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm08_01': 'md-ground'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones',
                'cage_opus_garden_authoring', 'cage_opus_highland_authoring', 'cage_authoring_coordinates')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35
NATIVE = (240, 200)
WIND = 1.6

PALETTE = {
    'md-blade': ((.26, .52, .12), .75, .0, 0),
    'md-blade-light': ((.46, .62, .18), .75, .0, 0),
    'md-blade-dry': ((.62, .60, .28), .80, .0, 0),
    'md-shrub': ((.09, .28, .08), .80, .0, 0),
    'md-shrub-light': ((.17, .40, .11), .80, .0, 0),
    'md-rock': ((.52, .52, .48), .85, .0, 0),
    'md-rock-dark': ((.36, .36, .34), .88, .0, 0),
    'md-rock-light': ((.66, .65, .60), .82, .0, 0),
    'md-moss': ((.24, .40, .14), .90, .0, 0),
    'md-flower-white': ((.96, .96, .92), .50, .0, .10),
    'md-flower-yellow': ((1.0, .82, .14), .45, .0, .12),
    'md-flower-violet': ((.62, .42, .90), .50, .0, .10),
}


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for palette in (gd.PALETTE, PALETTE):
        for name, (color, roughness, metal, glow) in palette.items():
            if name not in d.M:
                d.material(name, color, roughness, metal, glow)
    if 'md-ground' not in d.M:
        meadow = kit._noise_mix(d, 'md-meadow', (.14, .37, .09), (.21, .45, .12), 1.3, .50, .20,
                                spots=((.33, .47, .14), 3.6, .06))
        wild = kit._noise_mix(d, 'md-wild', (.10, .29, .08), (.15, .36, .10), 1.6, .50, .16,
                              spots=((.22, .40, .12), 4.0, .08))
        walk = gz.walk_tiles('field_cm08_01')
        w, h = NATIVE[0] // 8, NATIVE[1] // 8
        values = {(tx, ty): (1.0 if (tx, ty) in walk else 0.0) for tx in range(w) for ty in range(h)}
        gz.zone_ground(d, 'md-ground', 'field_cm08_01', NATIVE, values, [(wild, 0, 0), (meadow, .40, .62)], .30)


# --------------------------------------------------------------------------- helpers

def scr(d, x, y, z):
    return (x, y - fx.lift(d, z))


def blocked(field_id):
    walk = gz.walk_tiles(field_id)
    w, h = NATIVE[0] // 8, NATIVE[1] // 8
    return {(tx, ty) for tx in range(w) for ty in range(h) if (tx, ty) not in walk}


def walked_north_of(walk, tx, ty):
    """True when a walked tile lies directly behind (north of) this tile: keep it low."""
    return any((tx + dx, ty - dy) in walk for dx in (-1, 0, 1) for dy in (1, 2))


def tuft(d, name, cx, cy, height, blades, seed, footprint):
    """One mesh of grass blades: each a tapering quad strip leaning with the wind."""
    verts, faces = [], []
    probe = []
    for i in range(blades):
        a = seed * 7.1 + i * 2.39
        ox, oy = math.cos(a) * 1.3, .5 * math.sin(a) * 1.3
        h = height * (.62 + .38 * kit.hash01(seed, i, 3))
        lean = WIND * (.7 + .6 * kit.hash01(seed, i, 4))
        base = (cx + ox * .35, cy + oy * .35, 0.0)
        mid = (cx + ox * .8 + lean * .35, cy + oy * .8, h * .58)
        tip = (cx + ox * 1.1 + lean, cy + oy, h)
        w = .32
        n = len(verts)
        for (x, y, z), half in ((base, w), (mid, w * .6)):
            verts += [d.world(x - half, y, z), d.world(x + half, y, z)]
        verts.append(d.world(*tip))
        faces += [(n, n + 1, n + 3, n + 2), (n + 2, n + 3, n + 4)]
        probe += [scr(d, *tip), (base[0] - w, base[1]), (base[0] + w, base[1])]
    if not kit.core_inside(probe, footprint, 1.3):
        return False
    mat = ('md-blade', 'md-blade-light', 'md-blade-dry')[int(kit.hash01(seed, 9, 9) * 2.999)]
    fx._object(d, name, verts, faces, mat, 0.0)
    return True


def shrub(d, name, cx, cy, r, hz, k, footprint):
    import numpy as np
    pts = [(cx + r * math.cos(a), cy + .5 * r * math.sin(a) - s * fx.lift(d, hz))
           for a in np.linspace(0, math.tau, 12) for s in (0, 1)]
    if not kit.core_inside(pts, footprint, 1.3):
        return False
    d.sphere(name, d.world(cx, cy, hz * .55), (r / 16, r / 16, hz * .5), 'md-shrub' if k % 3 else 'md-shrub-light')
    d.sphere(name + '-top', d.world(cx - r * .25, cy - r * .1, hz * .85), (r * .55 / 16, r * .55 / 16, hz * .32),
             'md-shrub-light' if k % 3 else 'md-shrub')
    return True


# --------------------------------------------------------------------------- core

RIDGE = ((88.5, 34.0, 5.6, 1.00), (88.0, 50.0, 6.2, 1.25), (88.5, 67.0, 5.8, 1.05), (87.5, 82.0, 5.2, .80))
BOULDERS = ((231.0, 138.0, 5.0, .70), (56.0, 128.0, 5.2, .80), (166.0, 108.0, 4.6, .55))
STONES = ((112.0, 150.0, 2.4), (178.0, 140.0, 2.0), (40.0, 58.0, 2.2), (150.0, 160.0, 1.8), (96.0, 126.0, 1.6))


def meadow_core(d, footprint):
    fid = footprint['fieldId']
    walk = gz.walk_tiles(fid)
    blocked_tiles = blocked(fid)
    # Rocky ridge on the blocked right edge of the upper hex, mossy tops.
    for k, (cx, cy, r, hz) in enumerate(RIDGE):
        if hl.place_rock(d, f'meadow-ridge-{k}', footprint, cx, cy, r, hz,
                         ('md-rock', 'md-rock-dark', 'md-rock-light')[k % 3], k + 3, hl.crag):
            fx.lathe(d, f'meadow-ridge-{k}-moss', cx - .6, cy - .4, [(hz * .78, r * .42), (hz * .92, r * .22)],
                     'md-moss', 12)
    for k, (cx, cy, r, hz) in enumerate(BOULDERS):
        hl.place_rock(d, f'meadow-boulder-{k}', footprint, cx, cy, r, hz, ('md-rock-dark', 'md-rock')[k % 2], k + 20)
    # Flat stones half sunk in the walked grass (low, like the original's field stones).
    for k, (cx, cy, r) in enumerate(STONES):
        kit.rock_mesh(d, f'meadow-stone-{k}', cx, cy, r, .10, 'md-rock-light', k + 40)
    # Shrub clusters and tall grass on blocked tiles; low wherever a walked tile is behind.
    s = t = 0
    for tx, ty in sorted(blocked_tiles):
        if not kit.core_inside([(tx * 8 + 4, ty * 8 + 4)], footprint, 3.0):
            continue
        low = walked_north_of(walk, tx, ty)
        roll = kit.hash01(tx, ty, 31)
        cx = tx * 8 + 4 + (kit.hash01(tx, ty, 32) - .5) * 3
        cy = ty * 8 + 4 + (kit.hash01(tx, ty, 33) - .5) * 3
        if roll < .42 and not any(abs(cx - rx) < 8 and abs(cy - ry) < 8 for rx, ry, *_ in RIDGE + BOULDERS):
            r = 3.2 + kit.hash01(tx, ty, 34) * 1.8
            hz = (.32 if low else .50) + kit.hash01(tx, ty, 35) * .18
            if shrub(d, f'meadow-shrub-{s}', cx, cy, r, hz, s, footprint):
                s += 1
                continue
        if roll < .85:
            height = (.30 if low else .52) + kit.hash01(tx, ty, 36) * .2
            if tuft(d, f'meadow-tuft-{t}', cx, cy, height, 7, tx * 31 + ty, footprint):
                t += 1
    # Sparse short tufts and wildflowers on the walked meadow (all low).
    f = 0
    colours = ('md-flower-white', 'md-flower-yellow', 'md-flower-violet')
    for tx, ty in sorted(walk):
        roll = kit.hash01(tx, ty, 41)
        cx = tx * 8 + 4 + (kit.hash01(tx, ty, 42) - .5) * 5
        cy = ty * 8 + 4 + (kit.hash01(tx, ty, 43) - .5) * 5
        if roll < .30:
            if tuft(d, f'meadow-short-{t}', cx, cy, .20 + kit.hash01(tx, ty, 44) * .08, 5, tx * 17 + ty * 3, footprint):
                t += 1
        elif roll < .46:
            colour = colours[int(kit.hash01(tx, ty, 45) * 2.999)]
            for i in range(3):
                a = i * 2.1 + tx
                px, py = cx + math.cos(a) * 1.4, cy + .5 * math.sin(a) * 1.4
                if kit.core_inside([(px, py - 1.5)], footprint, 1.4):
                    d.sphere(f'meadow-flower-{f}-{i}', d.world(px, py, .09 + .03 * i), (.035, .035, .025), colour)
            f += 1
    return ['wild-meadow-grass', 'wind-leaning-tall-grass', 'shrub-clusters', 'rocky-ridge', 'grassland-boulders',
            'field-stones', 'wildflowers', 'yellow-flower-clumps']


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_MEADOW_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = meadow_core(d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        name = f"meadow-{record['order']:02d}"
        anchor = gd.flower_clump(d, name + '-flowers', record, footprint, 'yellow', phase)
        containment.register_anchor(field_id, record['order'], anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = record['order']
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = record['sequenceId']
            obj['sourceCellId'] = cell_id
            obj['objectRole'] = 'yellow-flower-clump'
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': record['sequenceId'],
                        'role': 'yellow-flower-clump', 'anchorNative': record['placement'], 'phase': phase,
                        'phases': phases})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
