"""Original garden family for the opus round: garden (cm18), small garden (cm32).

Both gardens are built around round raised flower beds: a low stone ring,
dark soil, red tulips in the centre (core), and swaying flower clumps around
the rim (the source objects; blue on one side, yellow on the other, two poses
each, both poses inside the same window).  The lawn follows the walkable
tiles; shrubs grow only on the other tiles.  The garden (cm18) has two
terraces joined by stone steps, a low retaining wall and rustic fence posts
(source objects) along the terrace edge.

Research rasters were viewed locally only; nothing is loaded or traced.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_remaining_authoring as kit


FIELDS = ('field_cm18_01', 'field_cm32_01')
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm18_01': 'gd-lawn-18', 'field_cm32_01': 'gd-lawn-32'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35
NATIVE = {'field_cm18_01': (144, 200), 'field_cm32_01': (96, 112)}
YELLOW_CELLS, BLUE_CELLS = (2, 3), (0, 1)

PALETTE = {
    'gd-stone': ((.62, .60, .55), .82, .0, 0),
    'gd-stone-dark': ((.44, .42, .38), .85, .0, 0),
    'gd-soil': ((.22, .14, .08), .90, .0, 0),
    'gd-path': ((.62, .50, .32), .88, .0, 0),
    'gd-stem': ((.16, .42, .12), .70, .0, 0),
    'gd-leaf': ((.20, .50, .14), .65, .0, 0),
    'gd-tulip': ((.86, .10, .08), .45, .0, 0),
    'gd-yellow': ((1.0, .80, .10), .45, .0, .15),
    'gd-yellow-eye': ((.95, .45, .05), .50, .0, 0),
    'gd-blue': ((.40, .62, .98), .45, .0, .12),
    'gd-white': ((.95, .96, .98), .50, .0, .10),
    'gd-shrub': ((.10, .30, .09), .80, .0, 0),
    'gd-shrub-light': ((.19, .43, .13), .80, .0, 0),
    'gd-blossom': ((.95, .55, .70), .60, .0, 0),
    'gd-post': ((.40, .26, .14), .80, .0, 0),
    'gd-post-dark': ((.28, .17, .09), .82, .0, 0),
}


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    lawn = d.M.get('gd-lawn') or kit._noise_mix(d, 'gd-lawn', (.24, .52, .15), (.30, .58, .18), 2.2, .50, .18,
                                                spots=((.40, .64, .22), 5.0, .05))
    wild = d.M.get('gd-wild') or kit._noise_mix(d, 'gd-wild', (.11, .33, .09), (.16, .40, .11), 1.8, .50, .16,
                                                spots=((.24, .46, .14), 4.0, .08))
    for field_id in FIELDS:
        name = SURFACES[field_id]
        if name not in d.M:
            walk = gz.walk_tiles(field_id)
            w, h = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
            values = {(tx, ty): (1.0 if (tx, ty) in walk else 0.0) for tx in range(w) for ty in range(h)}
            gz.zone_ground(d, name, field_id, NATIVE[field_id], values, [(wild, 0, 0), (lawn, .40, .62)], .30)


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


def clump_colours(field):
    out = []
    for record in field['objects']:
        if record['sequenceId'] in (0, 1, 6, 7, 8, 9):
            x, y, w, h = containment.source_window(record)
            out.append(((x + w / 2, y + h - 4), 'yellow' if record['sequenceId'] in (1, 8, 9) else 'blue'))
    return out


def bed_layout(field):
    """Bed centre and radius from the flower windows around it (cm18 has two beds)."""
    groups = {}
    for record in field['objects']:
        if record['sequenceId'] in (0, 1, 6, 7, 8, 9):
            x, y, w, h = containment.source_window(record)
            key = 'upper' if field['id'] == 'field_cm18_01' and y + h / 2 < 100 else 'lower'
            groups.setdefault(key, []).append((x + w / 2, y + h - 4))
    beds = {}
    for key, points in groups.items():
        cx = sum(p[0] for p in points) / len(points)
        cy = sum(p[1] for p in points) / len(points) - 2
        r = max(math.hypot(p[0] - cx, (p[1] - cy) * 2) for p in points) + 5
        beds[key] = (cx, cy, r)
    return beds


def bed(d, name, cx, cy, r, footprint, clumps=()):
    """Raised bed: dirt path apron, low stone ring, soil, red tulips in the centre."""
    apron = [(cx + (r + 5) * math.cos(a), cy + .5 * (r + 5) * math.sin(a)) for a in
             [i * math.tau / 40 for i in range(40)]]
    for i, piece in enumerate(fit.clip_to_footprint(apron, footprint, 2.0, .01)):
        fx.prism(d, f'{name}-path-{i}', piece, .003, .008, 'gd-path', 0)
    fx.lathe(d, name + '-ring', cx, cy, [(0, r), (.20, r * .985), (.24, r * .93), (.20, r * .88), (.12, r * .87)],
             'gd-stone', 40)
    fx.lathe(d, name + '-soil', cx, cy, [(.12, r * .875), (.15, r * .80), (.155, r * .2)], 'gd-soil', 40)
    k = 0
    for ring, count in ((0.0, 1), (.15, 6), (.29, 11), (.43, 16)):
        for i in range(count):
            a = i * math.tau / max(count, 1) + ring * 3
            tx, ty = cx + ring * r * math.cos(a), cy + .5 * ring * r * math.sin(a)
            top = .62 + .08 * ((k * 5) % 3)
            fx.pipe(d, f'{name}-tulip-stem-{k}', [(tx, ty, .15), (tx + .2, ty, top)], .02, 'gd-stem')
            fx.lathe(d, f'{name}-tulip-cup-{k}', tx + .2, ty, [(top - .02, .35), (top + .10, .85), (top + .20, .75)],
                     'gd-tulip', 10)
            leaf = [(tx, ty, .16), (tx - 1.2, ty + .3, .38), (tx - .2, ty, .30)]
            fx.pipe(d, f'{name}-tulip-leaf-{k}', leaf, .03, 'gd-leaf')
            k += 1
    # Dense low planting between the tulips and the rim, coloured like the nearest clump.
    j = 0
    for ring, count in ((.56, 22), (.66, 28), (.76, 34)):
        for i in range(count):
            a = i * math.tau / count + ring * 7
            px, py = cx + ring * r * math.cos(a), cy + .5 * ring * r * math.sin(a)
            colour = 'gd-yellow'
            if clumps:
                near = min(clumps, key=lambda c: math.dist(c[0], (px, py)))
                colour = 'gd-yellow' if near[1] == 'yellow' else 'gd-blue'
            d.sphere(f'{name}-mound-{j}', d.world(px, py, .20), (.10, .10, .06), 'gd-leaf' if j % 2 else 'gd-stem')
            for q in range(3):
                b = q * math.tau / 3 + j
                d.sphere(f'{name}-bloom-{j}-{q}', d.world(px + math.cos(b) * .9, py + .5 * math.sin(b) * .9, .29),
                         (.035, .035, .02), colour if (j + q) % 4 else 'gd-white')
            j += 1
    return (cx, cy)


def flower_clump(d, name, record, footprint, colour, pose):
    """Five or six small flowers in one window; ``pose`` 0/1 sways the heads."""
    window = containment.source_window(record)
    x, y, w, h = window
    base_y = y + h - 3.5
    sway = (-.55, .55)[pose % 2]
    spots = ((.25, 0.0, .55), (.48, -1.3, .70), (.70, .2, .60), (.38, 1.2, .48), (.60, -2.4, .78), (.82, -1.0, .50))
    pts = []
    plan = []
    for k, (u, dy, top) in enumerate(spots):
        fx_, fy = x + 2.5 + u * (w - 5), base_y + dy * .6
        head = (fx_ + sway * (1 + .3 * (k % 2)), fy, top)
        plan.append(((fx_, fy), head))
        pts += [(fx_ - .8, fy + .5), (fx_ + .8, fy + .5)]
        sx, sy = scr(d, *head)
        pts += [(sx - 1.4, sy - 1.4), (sx + 1.4, sy + 1.4)]
    if not inside(pts, footprint, window):
        raise ValueError(f'FLOWER_CLUMP_OUTSIDE:{record["order"]}:{window}')
    for k, ((fx_, fy), head) in enumerate(plan):
        fx.pipe(d, f'{name}-stem-{k}', [(fx_, fy, 0.0), (fx_ + (head[0] - fx_) * .5, fy, head[2] * .55), head],
                .018, 'gd-stem')
        fx.pipe(d, f'{name}-leaf-{k}', [(fx_, fy, .02), (fx_ - 1.0, fy + .4, .16)], .028, 'gd-leaf')
        hx, hy, hz = head
        if colour == 'yellow':
            for i in range(5):
                a = i * math.tau / 5 + k
                d.sphere(f'{name}-petal-{k}-{i}', d.world(hx + math.cos(a) * .75, hy + .5 * math.sin(a) * .75, hz),
                         (.045, .045, .022), 'gd-yellow')
            d.sphere(f'{name}-eye-{k}', d.world(hx, hy, hz + .02), (.03, .03, .02), 'gd-yellow-eye')
        else:
            for i in range(4):
                a = i * math.tau / 4 + k
                d.sphere(f'{name}-petal-{k}-{i}', d.world(hx + math.cos(a) * .6, hy + .5 * math.sin(a) * .6, hz),
                         (.04, .04, .02), 'gd-blue')
            d.sphere(f'{name}-eye-{k}', d.world(hx, hy, hz + .015), (.022, .022, .015), 'gd-white')
    return (x + w / 2, base_y)


def shrubs(d, name, footprint, tiles, density=.55, size=(3.6, 2.4)):
    import numpy as np
    k = 0
    for tx, ty in sorted(tiles):
        if kit.hash01(tx, ty, 7) > density:
            continue
        cx = tx * 8 + 4 + (kit.hash01(tx, ty, 8) - .5) * 3
        cy = ty * 8 + 4 + (kit.hash01(tx, ty, 9) - .5) * 3
        r = size[0] + kit.hash01(tx, ty, 10) * size[1]
        hz = .45 + kit.hash01(tx, ty, 11) * .3
        pts = [(cx + r * math.cos(a), cy + .5 * r * math.sin(a) - s * fx.lift(d, hz)) for a in np.linspace(0, math.tau, 12)
               for s in (0, 1)]
        if not kit.core_inside(pts, footprint, 1.3):
            continue
        d.sphere(f'{name}-{k}', d.world(cx, cy, hz * .55), (r / 16, r / 16, hz * .5),
                 'gd-shrub' if k % 3 else 'gd-shrub-light')
        if k % 4 == 1:
            for i in range(3):
                a = i * math.tau / 3 + k
                d.sphere(f'{name}-bloom-{k}-{i}', d.world(cx + math.cos(a) * r * .5, cy + .5 * math.sin(a) * r * .5,
                                                         hz * .95), (.04, .04, .03), 'gd-blossom')
        k += 1


def blocked_tiles(field_id):
    walk = gz.walk_tiles(field_id)
    w, h = NATIVE[field_id][0] // 8, NATIVE[field_id][1] // 8
    return [(tx, ty) for tx in range(w) for ty in range(h) if (tx, ty) not in walk]


# --------------------------------------------------------------------------- cores

def garden_core(d, footprint, field):
    fid = footprint['fieldId']
    beds = bed_layout(field)
    for key, (cx, cy, r) in beds.items():
        bed(d, f'garden-bed-{key}', cx, cy, r, footprint, clump_colours(field))
    # Stone steps down the band between the terraces (descending toward the lower left).
    for k in range(5):
        cx, cy = 78.0 - 5.2 * k, 89.0 + 2.6 * k
        top = .12 - .025 * k
        for i, piece in enumerate(fit.clip_to_footprint(fx.quad(cx, cy, 10.5, 2.2), footprint, 1.5, top)):
            fx.prism(d, f'garden-step-{k}-{i}', piece, 0, top, 'gd-stone' if k % 2 else 'gd-stone-dark', .006)
    # Low retaining walls either side of the steps (blocked tiles).
    walls = (((50.0, 80.0), (58.0, 92.0)), ((104.0, 101.0), (128.0, 89.0)))
    for j, (a, b) in enumerate(walls):
        steps = 6
        for i in range(steps):
            t0, t1 = i / steps, (i + 1) / steps
            p = (a[0] + (b[0] - a[0]) * (t0 + t1) / 2, a[1] + (b[1] - a[1]) * (t0 + t1) / 2)
            if kit.core_inside([(p[0] - 2, p[1]), (p[0] + 2, p[1]), (p[0], p[1] - fx.lift(d, .4))], footprint, 1.3):
                kit.rock_mesh(d, f'garden-wall-{j}-{i}', p[0], p[1], 2.6, .32, 'gd-stone-dark', i + 3 * j)
    # Dirt paths: from the upper bed to the steps, from the steps to the lower bed.
    for j, (a, b) in enumerate((((92.0, 70.0), (80.0, 88.0)), ((54.0, 104.0), (54.0, 118.0)))):
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy)
        nx, ny = -dy / n * 4.0, dx / n * 4.0
        strip = [(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)]
        for i, piece in enumerate(fit.clip_to_footprint(strip, footprint, 2.0, .01)):
            fx.prism(d, f'garden-walk-{j}-{i}', piece, .002, .007, 'gd-path', 0)
    shrubs(d, 'garden-shrub', footprint, blocked_tiles(fid))
    return ['two-terrace-garden', 'raised-flower-beds-with-tulips', 'swaying-flower-clumps', 'stone-steps',
            'retaining-walls', 'rustic-fence', 'shrubs-on-blocked-tiles']


def small_garden_core(d, footprint, field):
    fid = footprint['fieldId']
    for key, (cx, cy, r) in bed_layout(field).items():
        bed(d, 'small-garden-bed', cx, cy, r, footprint, clump_colours(field))
    shrubs(d, 'small-garden-shrub', footprint, blocked_tiles(fid), .65, (3.4, 2.0))
    return ['raised-flower-bed-with-tulips', 'swaying-flower-clumps', 'shrubs-on-blocked-tiles']


def fit_post(d, footprint, window, region, r=1.1, tallest=1.0):
    """Front-most legal post spot in ``region`` (x0, x1) of the window, with its height."""
    x, y, w, h = window
    best = None
    for i in range(13):
        px = region[0] + (region[1] - region[0]) * i / 12
        for j in range(24):
            py = y + h - .7 - r / 2 - j * .5
            height = tallest
            while height >= .35:
                pts = [(px - r, py), (px + r, py), (px, py + r / 2), scr(d, px, py - r / 2, height + .12)]
                if inside(pts, footprint, window):
                    break
                height -= .05
            if height >= .35:
                score = (round(height, 2), py)
                if best is None or score > best[0]:
                    best = (score, (px, py), height)
                break
    if best is None:
        raise ValueError(f'FENCE_POST_DOES_NOT_FIT:{window}')
    return best[1], best[2]


def fence(d, name, record, footprint):
    """Rustic posts (two when the window allows) with rails, inside its own window."""
    window = containment.source_window(record)
    x, y, w, h = window
    regions = [(x + 1.5, x + w - 1.5)] if w <= 8 else [(x + 1.5, x + w / 2 - .5), (x + w / 2 + .5, x + w - 1.5)]
    posts = [fit_post(d, footprint, window, region) for region in regions]
    height = min(hgt for _, hgt in posts)
    for i, ((px, py), _) in enumerate(posts):
        fx.cylinder(d, f'{name}-post-{i}', px, py, 1.1, 0, height, 'gd-post', 10)
        fx.lathe(d, f'{name}-cap-{i}', px, py, [(height, 1.1), (height + .1, .5)], 'gd-post-dark', 10)
    if len(posts) == 2:
        (ax, ay), (bx, by) = posts[0][0], posts[1][0]
        for z in (height * .45, height * .82):
            fx.pipe(d, f'{name}-rail-{z:.2f}', [(ax, ay, z), (bx, by, z)], .04, 'gd-post-dark')
    return posts[0][0]


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_GARDEN_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = (garden_core if field_id == 'field_cm18_01' else small_garden_core)(d, footprint, field)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        frames = [f['cellId'] for f in contract[record['order']]['frames']]
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        name = f"garden{field_id[8:10]}-{record['order']:02d}"
        if set(frames) <= set(YELLOW_CELLS) or set(frames) <= set(BLUE_CELLS):
            colour = 'yellow' if set(frames) <= set(YELLOW_CELLS) else 'blue'
            role, anchor = f'{colour}-flower-clump', flower_clump(d, name, record, footprint, colour, phase)
        else:
            role, anchor = 'rustic-fence-post', fence(d, name + '-fence', record, footprint)
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
