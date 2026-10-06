"""Original clinic family for the opus round: small clinic (cm16) and clinic (cm31).

Field intent, from local research only: a school-style sick bay.  A bed behind a
pale privacy curtain on a rail, a glass-fronted medicine cabinet, a floor scale,
a rolling stool and a consulting desk.  What separates it from the operating
theatre (cm17) is the whole read, not a colour swap: warm vinyl floor and soft
cloth instead of cold tile and steel, a curtained bed instead of a table under a
round lamp.

Geometry comes from ``cage_opus_facility_authoring`` unchanged (2:1 grid boxes,
2:1 lathes, edge-following units), and containment from ``cage_opus_containment``.
Research rasters were viewed locally only; none is loaded, traced or exported.
"""
import math

from . import cage_opus_containment as containment
from . import cage_opus_facility_authoring as fx


FIELDS = ('field_cm16_01', 'field_cm31_01')
SURFACES = {'field_cm16_01': 'cl-floor', 'field_cm31_01': 'cl-floor'}
DEPENDENCIES = ('cage_opus_facility_authoring',)
CONTRACTS = {}
U, V = fx.U, fx.V

PALETTE = {
    'cl-wood': ((.50, .31, .16), .55, .0, 0),
    'cl-wood-dark': ((.30, .18, .09), .60, .0, 0),
    'cl-cream': ((.86, .82, .72), .45, .0, 0),
    'cl-blotter': ((.07, .36, .30), .65, .0, 0),
    'cl-curtain': ((.46, .64, .84), .82, .0, 0),
    'cl-curtain-fold': ((.36, .52, .72), .85, .0, 0),
    'cl-sheet': ((.92, .93, .90), .70, .0, 0),
    'cl-blanket': ((.55, .72, .86), .80, .0, 0),
    'cl-pillow': ((.96, .96, .94), .70, .0, 0),
    'cl-seat': ((.05, .055, .06), .55, .0, 0),
    'cl-scale': ((.10, .36, .66), .40, .20, 0),
    'cl-file-red': ((.66, .14, .10), .60, .0, 0),
    'cl-file-blue': ((.12, .30, .58), .60, .0, 0),
    'cl-file-yellow': ((.86, .66, .16), .60, .0, 0),
    'cl-lamp': ((1.0, .86, .55), .30, .0, 3.0),
    'cl-bottle-amber': ((.70, .36, .06), .25, .0, .4),
    'cl-bottle-green': ((.10, .52, .32), .25, .0, .4),
}


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'cl-floor' not in d.M:
        fx._floor_material(d, 'cl-floor', (.56, .45, .31), (.46, .36, .24), 2.0, .022)


# --------------------------------------------------------------------------- core pieces

def bed(d, name, cx, cy):
    """Clinic bed along the U axis: tube frame, mattress, blanket and pillow."""
    a, b = 12.0, 5.0
    for i, (sa, sb) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        px, py = cx + sa * (a - 1) * U[0] + sb * (b - 1) * V[0], cy + sa * (a - 1) * U[1] + sb * (b - 1) * V[1]
        fx.cylinder(d, f'{name}-leg-{i}', px, py, .45, 0, .42, 'fx-chrome', 8)
    fx.box(d, name + '-frame', cx, cy, a, b, .38, .46, 'fx-white', .008)
    fx.box(d, name + '-mattress', cx, cy, a * .97, b * .92, .46, .62, 'cl-sheet', .030)
    fx.box(d, name + '-blanket', cx + a * .22 * U[0], cy + a * .22 * U[1], a * .72, b * .96, .58, .66,
           'cl-blanket', .030)
    fx.box(d, name + '-pillow', cx - a * .78 * U[0], cy - a * .78 * U[1], a * .16, b * .74, .60, .76,
           'cl-pillow', .040)
    hx, hy = cx - a * U[0], cy - a * U[1]
    fx.box(d, name + '-headboard', hx, hy, .5, b, .38, .98, 'fx-white', .010)


def curtain(d, name, start, end, z1=1.42, folds=7, depth=.9):
    """Pale privacy curtain hanging from a rail, folded so it reads as cloth."""
    sx, sy = start
    ex, ey = end
    length = math.hypot(ex - sx, ey - sy)
    ux, uy = (ex - sx) / length, (ey - sy) / length
    # Fold offsets run across the curtain line in screen space; small and soft.
    nx, ny = -uy, ux
    points = []
    steps = folds * 4
    for i in range(steps + 1):
        t = i / steps
        wave = math.sin(t * folds * math.tau) * depth * .5
        points.append((sx + ux * length * t + nx * wave, sy + uy * length * t + ny * wave))
    back = [(x - nx * .35, y - ny * .35) for x, y in reversed(points)]
    fx.prism(d, name + '-cloth', points + back, .10, z1 - .06, 'cl-curtain', 0, True)
    fx.pipe(d, name + '-rail', [(sx, sy, z1), (ex, ey, z1)], .035, 'fx-chrome')
    for i, (px, py) in enumerate((start, end)):
        fx.cylinder(d, f'{name}-post-{i}', px, py, .30, 0, z1 + .02, 'fx-chrome', 8)


def medicine_cabinet(d, name, cx, cy):
    """Glass-fronted cabinet along the V axis: shelves and bottles read through glass.

    Only the back half is solid.  The front half is an open case of thin side
    walls and shelves behind clear doors, so the bottles are actually visible
    rather than sealed inside an opaque box behind a frosted panel.
    """
    a, b = 3.0, 9.0
    zt = 1.55
    back = (cx - a * .5 * U[0], cy - a * .5 * U[1])
    # Stops under the top slab: coplanar overlapping volumes render as a black seam.
    fx.box(d, name + '-back', back[0], back[1], a * .5, b, .26, zt - .06, 'cl-cream', .012)
    fx.box(d, name + '-plinth', cx, cy, a * 1.04, b * 1.02, 0, .26, 'cl-wood-dark', .006)
    fx.box(d, name + '-top', cx, cy, a * 1.04, b * 1.02, zt - .06, zt, 'cl-cream', .008)
    front = (cx + a * .5 * U[0], cy + a * .5 * U[1])
    for sign in (-1, 1):
        sx, sy = front[0] + sign * (b - .25) * V[0], front[1] + sign * (b - .25) * V[1]
        fx.box(d, f'{name}-side-{sign}', sx, sy, a * .5, .25, .26, zt - .06, 'cl-cream', .004)
    for row, z in enumerate((.26, .66, 1.06)):
        fx.box(d, f'{name}-shelf-{row}', front[0], front[1], a * .48, b - .5, z, z + .05, 'fx-white', .003)
        for k in range(5):
            t = -1 + (2 * k + 1) / 5
            bx, by = front[0] + t * (b - 1.6) * V[0], front[1] + t * (b - 1.6) * V[1]
            height = .22 + .06 * ((k + row) % 3)
            fx.cylinder(d, f'{name}-bottle-{row}-{k}', bx, by, .62, z + .05, z + .05 + height,
                        ('cl-bottle-amber', 'cl-bottle-green', 'fx-white', 'cl-bottle-amber', 'cl-file-blue')
                        [(k + row) % 5], 10)
    fx.face_panel(d, name + '-glass', cx, cy, a, b, .30, zt - .08, 'fx-glass', 'front-right', .04, .3)
    for sign in (-1, 0, 1):
        fx.face_panel(d, f'{name}-mullion-{sign}', cx + sign * (b - .3) * V[0], cy + sign * (b - .3) * V[1],
                      a, .35, .26, zt - .06, 'cl-cream', 'front-right', 0, .45)


def floor_scale(d, name, cx, cy):
    fx.box(d, name + '-platform', cx, cy, 3.6, 3.6, 0, .07, 'cl-scale', .012)
    fx.box(d, name + '-tread', cx, cy, 3.0, 3.0, .07, .08, 'fx-panel-dark', 0)
    px, py = cx + 3.2 * V[0], cy + 3.2 * V[1]
    fx.cylinder(d, name + '-column', px, py, .45, .05, 1.25, 'fx-chrome', 10)
    fx.ball(d, name + '-dial', px, py, 1.32, 1.6, 'fx-white')
    fx.box(d, name + '-readout', px - .6 * V[0], py - .6 * V[1], .7, .25, 1.24, 1.40, 'fx-screen-amber', 0)


def clinic_room(d, prefix, ox, cabinet=True, scale=False):
    """One sick-bay bay inside a hex whose left corner is at x = ox."""
    bed(d, prefix + '-bed', ox + 74, 38)
    # Curtain closes the bed's left end and half of its open front.
    left_back = (ox + 74 - 14 * U[0] + 7 * V[0], 38 - 14 * U[1] + 7 * V[1])
    left_front = (ox + 74 - 14 * U[0] - 7 * V[0], 38 - 14 * U[1] - 7 * V[1])
    mid_front = (ox + 74 - 2 * U[0] - 7 * V[0], 38 - 2 * U[1] - 7 * V[1])
    curtain(d, prefix + '-curtain-end', left_back, left_front, folds=4)
    curtain(d, prefix + '-curtain-front', left_front, mid_front, folds=6)
    if cabinet:
        medicine_cabinet(d, prefix + '-cabinet', ox + 16, 37)
    if scale:
        floor_scale(d, prefix + '-scale', ox + 26, 52)


def clinic_core(d, footprint, field_id):
    if field_id == 'field_cm16_01':
        clinic_room(d, 'clinic', 0, cabinet=True, scale=False)
        floor_scale(d, 'clinic-scale', 28, 60)
        return ['curtained-bed', 'glass-medicine-cabinet', 'floor-scale', 'warm-vinyl-floor']
    clinic_room(d, 'clinic-left', 0, cabinet=True, scale=False)
    clinic_room(d, 'clinic-right', 96, cabinet=False, scale=True)
    return ['two-curtained-bed-bays', 'glass-medicine-cabinet', 'floor-scale', 'warm-vinyl-floor']


# --------------------------------------------------------------------------- objects

def rolling_stool(d, name, rect):
    x, y, w, h = rect
    r = min(w / 2 - 1.5, 6.0)
    cx, cy = x + w / 2, y + h - 1.5 - r / 2
    for i in range(5):
        angle = i * math.tau / 5 + .3
        tx, ty = cx + math.cos(angle) * r * .95, cy + .5 * math.sin(angle) * r * .95
        fx.pipe(d, f'{name}-leg-{i}', [(cx, cy, .12), (tx, ty, .07)], .05, 'fx-steel-dark')
        fx.ball(d, f'{name}-caster-{i}', tx, ty, .05, .6, 'fx-rubber')
    fx.cylinder(d, name + '-column', cx, cy, .45, .10, .52, 'fx-chrome', 10)
    fx.lathe(d, name + '-seat', cx, cy, [(.50, r * .62), (.60, r * .70), (.66, r * .55)], 'cl-seat', 24)
    return (cx, cy)


def consulting_desk(d, name, window, footprint):
    """Desk following the hex's lower-right edge: blotter, lamp and files."""
    depth = 8.2
    t0, t1 = 1.6, 1.6 + depth
    vertex, left, right = fx.corner_arms(footprint, window, t0, t1)
    s0, s1 = right
    s0 = max(s0, 3.0)
    s1 = min(s1, 32.0)
    if s1 - s0 < 10:
        x, y, w, h = window
        return fx.lab_bench_box(d, name, window, 0)
    desk = .76
    centre = fx.edge_box(d, name + '-pedestal', vertex, 'right', s0 + 1, s0 + 9, t0 + .8, t1 - .4, 0, desk - .05,
                         'cl-cream', .012)
    fx.edge_box(d, name + '-modesty', vertex, 'right', s0 + 9, s1 - 1, t1 - 1.6, t1 - .4, .10, desk - .05,
                'cl-cream', .008)
    fx.edge_box(d, name + '-top', vertex, 'right', s0, s1, t0, t1, desk - .05, desk + .02, 'cl-wood', .010)
    mid = (s0 + s1) / 2
    fx.edge_box(d, name + '-blotter', vertex, 'right', mid - 5, mid + 3, t0 + 1.8, t1 - 2.0, desk + .02, desk + .035,
                'cl-blotter', 0)
    for k, mat in enumerate(('cl-file-red', 'cl-file-blue', 'cl-file-yellow')):
        fx.edge_box(d, f'{name}-file-{k}', vertex, 'right', s1 - 7.5, s1 - 3.5, t0 + 2.4, t1 - 2.4,
                    desk + .02 + k * .06, desk + .075 + k * .06, mat, .004)
    lx, ly = vertex[0] + (s0 + 3.0) - (t1 - 2.2), vertex[1] - .5 * (s0 + 3.0) - .5 * (t1 - 2.2)
    fx.cylinder(d, name + '-lamp-foot', lx, ly, 1.1, desk + .02, desk + .07, 'fx-steel-dark', 12)
    fx.pipe(d, name + '-lamp-arm', [(lx, ly, desk + .06), (lx + .6, ly - .8, desk + .62), (lx + 2.2, ly - .4, desk + .74)],
            .04, 'fx-steel-dark')
    fx.lathe(d, name + '-lamp-shade', lx + 2.2, ly - .4, [(desk + .76, .5), (desk + .70, 1.5), (desk + .62, 1.7)],
             'fx-steel-dark', 16)
    fx.lathe(d, name + '-lamp-bulb', lx + 2.2, ly - .4, [(desk + .63, 1.4), (desk + .62, .2)], 'cl-lamp', 16)
    return centre


def clinic_object(d, record, rect, footprint):
    name = f"clinic-{record['order']:02d}"
    if record['sequenceId'] == 7:
        return 'rolling-stool', rolling_stool(d, name + '-stool', rect)
    window = containment.source_window(record)
    return 'consulting-desk', consulting_desk(d, name + '-desk', window, footprint)


def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_CLINIC_FIELD:' + field_id)
    footprint = d.field_footprint(d.ROOT, field)
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = clinic_core(d, footprint, field_id)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        decision = containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        role, anchor = clinic_object(d, record, decision['window'], footprint)
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
