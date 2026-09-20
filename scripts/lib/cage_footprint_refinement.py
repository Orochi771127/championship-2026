"""Footprint-accurate wrappers around the existing zoo, ranch and forest families.

The upstream prop modules stay byte-identical: their hashes are recorded in
manifests that earlier batches already shipped, so they are wrapped here rather
than edited.  Two corrections are applied on top of whatever they build.

* Core slabs are clipped to the hex union.  Clipping preserves position, which
  matters for paving and paths that are supposed to reach an edge.
* Each source object's authored geometry is scaled about a point inside the hex
  that owns its window.  The projection is affine, so one Blender matrix
  reproduces exactly the screen-space fit computed in ``cage_footprint_fit``.

Deliberately absent: ``hide_render``.  Suppressing a prop in the full frame
while still exporting its object cell makes the assembled board disagree with
the frame, which is the defect this batch exists to remove.  Numeric anchors,
pivots, windows, flips and animation timing are never touched.
"""
import json

from . import cage_footprint_fit as fit
from . import cage_nature_authoring as nature
from . import cage_remaining_fixed_authoring as fixed


FIELDS = ('field_cm11_01', 'field_cm25_01', 'field_cm26_01')
SURFACES = {'field_cm11_01': 'forest-floor', 'field_cm25_01': 'zoo-floor',
            'field_cm26_01': 'ranch-floor'}
FAMILY = {'field_cm11_01': 'nature', 'field_cm25_01': 'fixed', 'field_cm26_01': 'fixed'}

# The audit dilates the footprint by six pixels of a four-times render, i.e.
# 1.5 native pixels, before calling anything an overhang.  Authoring one native
# pixel inside the outline therefore leaves 2.5 pixels of margin while staying
# far away from shrinking props for no visible reason.
WORKING_INSET = 1.0
# A window whose anchor sits almost entirely outside this field keeps little or
# no room at the working inset.  Relaxing is preferable to inventing a
# suppression rule: the prop stays present, as large as the field allows, and
# the report says which inset it needed.  Even the last of these stays inside
# the outline the audit measures against.
FALLBACK_INSETS = (1.0, 0.5, 0.25, 0.0)
# Below this the prop is still rendered, but flagged for the human review pass.
PREFERRED_MINIMUM_SCALE = 0.5
# An authoring rectangle thinner than this cannot carry a readable prop; the
# window is handed over untouched and the scale pass deals with it instead.
MINIMUM_AUTHORING_SIDE = 6.0

TABLE = {}
COLLECTED = {}
REPORTS = {}
WINDOWS = {}


def prepare(d, cell_id):
    """Both upstream palettes; each skips materials it has already created."""
    nature.prepare_nature_materials(d)
    fixed.prepare(d, cell_id)


def _polygon_area(points):
    return abs(fit.signed_area([(float(x), float(y)) for x, y in points]))


def _clipping_slab(d, footprint, original, inset=WORKING_INSET):
    """``d.slab`` replacement that keeps base-layer geometry inside the field."""

    def slab(name, points, z0, z1, mat, bevel=.02):
        if d.LAYER != 'base':
            return original(name, points, z0, z1, mat, bevel)
        pieces = fit.clip_to_footprint(points, footprint, inset, max(z0, z1))
        if len(pieces) == 1 and abs(_polygon_area(pieces[0]) - _polygon_area(points)) < 1e-6:
            return original(name, points, z0, z1, mat, bevel)
        made = None
        for index, piece in enumerate(pieces):
            # A cut piece loses its bevel: a bevelled edge on a hex seam would
            # carve a groove exactly where two clipped halves must stay flush.
            built = original(f'{name}-footprint-{index:02d}', piece, z0, z1, mat, 0)
            if made is None or _polygon_area(piece) > made[0]:
                made = (_polygon_area(piece), built)
        return made[1] if made else None

    return slab


def _authoring_window(field_id, footprint, record, bounds, reduce=True):
    """The rectangle a prop should be authored into, and why.

    The fixed families size every prop proportionally from the window they are
    handed, so narrowing the window to the part of it this field actually owns
    keeps a fence full width and merely shortens it.  Uniform scaling would
    instead shrink the whole prop until its farthest corner cleared the edge.

    ``reduce`` is off for the nature family, whose trees measure trunk height and
    canopy offsets from the window's top edge in absolute pixels: a shorter
    window there would not produce a shorter tree, it would produce a broken one.

    Depends only on the window and the field, so every animation cell of one
    object is authored identically.
    """
    key = (field_id, record['order'])
    if key in WINDOWS:
        return WINDOWS[key]
    x, y, width, height = bounds(record)
    window = fit.rectangle(x, y, width, height)
    regions = fit.usable_region(window, footprint, WORKING_INSET)
    covered = sum(abs(fit.signed_area(region)) for _, region in regions)
    decision = {'source': (x, y, width, height), 'window': (x, y, width, height), 'reduced': False,
                'coveredFraction': round(covered / max(1e-9, width * height), 4)}
    if reduce and regions and covered < width * height - 1e-6:
        for inset in FALLBACK_INSETS:
            rectangle = fit.largest_inside_rectangle(window, footprint, inset)
            if rectangle and min(rectangle[2], rectangle[3]) >= MINIMUM_AUTHORING_SIDE:
                decision = {**decision, 'window': tuple(round(v, 4) for v in rectangle),
                            'reduced': True, 'authoringInsetNativePx': inset}
                break
    WINDOWS[key] = decision
    return decision


def _windowed_bounds(field_id, footprint, original):
    """``placed_cell_bounds`` replacement used only while a family is building."""
    def placed_cell_bounds(record):
        return list(_authoring_window(field_id, footprint, record, original)['window'])
    return placed_cell_bounds


def _cell_planes(footprint):
    return [fit.half_planes(cell['polygon']) for cell in footprint['cells']]


def _outside_distance(point, cell_planes):
    """Native pixels a point lies beyond the hex union; negative means inside."""
    return -max(fit.clearance(point, planes) for planes in cell_planes)


def _measure_base_overflow(d, footprint):
    """Diagnostic only: what the fixed core and the shared tray edge still do.

    The platform's own fascia and rim light sit just outside the outline by
    design; this reports the numbers rather than pretending they are zero.
    """
    import bpy
    cell_planes = _cell_planes(footprint)
    worst = []
    for obj in bpy.context.scene.objects:
        if obj.get('cageLayer') != 'base':
            continue
        points = [fit.native_screen(p) for p in d.evaluated_world_vertices(obj)]
        if not points:
            continue
        distance = max(_outside_distance(point, cell_planes) for point in points)
        if distance > 0.5:
            worst.append({'object': obj.name, 'outsideNativePx': round(distance, 3)})
    worst.sort(key=lambda row: -row['outsideNativePx'])
    return worst[:12]


def _apply_scale(objects, center_native, factor):
    import bpy
    from mathutils import Matrix, Vector
    pivot = Vector(fit.world_point(center_native[0], center_native[1], 0.0))
    transform = Matrix.Translation(pivot) @ Matrix.Scale(factor, 4) @ Matrix.Translation(-pivot)
    for obj in objects:
        obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()


def _fit_objects(d, field, footprint, cell_id):
    import bpy
    field_id = field['id']
    table = TABLE.get(field_id, {})
    collected = COLLECTED.setdefault(field_id, {})
    records = []
    for record in field['objects']:
        ordinal = record['order']
        objects = [o for o in bpy.context.scene.objects
                   if o.get('cageLayer') == 'decor' and o.get('sourceObjectOrdinal') == ordinal]
        if not objects:
            raise ValueError(f'MISSING_INDEPENDENT_OBJECT_GROUP:{field_id}:{ordinal}')
        points = [fit.native_screen(p) for o in objects for p in d.evaluated_world_vertices(o)]
        decision = _authoring_window(field_id, footprint, record, d.placed_cell_bounds,
                                     FAMILY[field_id] == 'fixed')
        x, y, width, height = decision['window']
        window = fit.rectangle(x, y, width, height)
        # Props read as standing on the ground, so bias the scale centre toward
        # the bottom of the window instead of its geometric middle.
        preferred = (x + width / 2, y + height - 1)
        # Prefer the working inset, but a prop crushed to a speck by it is worse
        # art than the same prop one fraction of a pixel nearer the edge.
        plan = used_inset = None
        for inset in FALLBACK_INSETS:
            candidate = fit.plan_object_fit(points, window, footprint, inset, preferred)
            if plan is None or candidate['factor'] > plan['factor']:
                plan, used_inset = candidate, inset
            if plan['factor'] >= PREFERRED_MINIMUM_SCALE:
                break
        if plan['factor'] <= 0:
            raise ValueError(f'NO_FOOTPRINT_INTERIOR:{field_id}:{ordinal}')
        measured = plan['factor']
        key = str(ordinal)
        collected[key] = min(collected.get(key, 1.0), measured)
        factor = min(measured, table.get(key, 1.0))
        if factor < 1.0:
            _apply_scale(objects, plan['center'], factor)
        records.append({
            'sourceOrdinal': ordinal, 'sequenceId': record['sequenceId'],
            'sourceCellId': cell_id, 'anchorNative': record['placement'],
            'sourceWindowNative': list(decision['source']),
            'authoringWindowNative': [x, y, width, height],
            'authoringWindowReduced': decision['reduced'],
            'windowInsideFieldFraction': decision['coveredFraction'],
            'cellBit': plan['cellBit'], 'scaleCenterNative': plan['center'],
            'insetNativePx': used_inset, 'measuredScale': round(measured, 6),
            'appliedScale': round(factor, 6),
            'belowPreferredScale': factor < PREFERRED_MINIMUM_SCALE,
        })
    return records


def build(field, d, cell_id):
    """Build the upstream family, then make it respect its own hex footprint."""
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError(f'UNSUPPORTED_FOOTPRINT_REFINEMENT_FIELD:{field_id}')
    footprint = d.field_footprint(d.ROOT, field)
    original_slab, original_bounds = d.slab, d.placed_cell_bounds
    try:
        if FAMILY[field_id] == 'fixed':
            d.slab = _clipping_slab(d, footprint, original_slab)
            d.placed_cell_bounds = _windowed_bounds(field_id, footprint, original_bounds)
            anchors = fixed.build(field, d, cell_id)
        else:
            anchors = nature.build_nature_family(field, d)
    finally:
        # Restored before render_field exports object cells: the export must
        # still crop at the untouched source window, never the authoring one.
        d.slab, d.placed_cell_bounds = original_slab, original_bounds
    bpy.context.view_layer.update()
    objects = _fit_objects(d, field, footprint, cell_id)
    REPORTS[(field_id, cell_id)] = {
        'fieldId': field_id, 'sourceCellId': cell_id,
        'workingInsetNativePx': WORKING_INSET,
        'coreClipped': FAMILY[field_id] == 'fixed',
        'objects': objects,
        'baseLayerOutsideFootprint': _measure_base_overflow(d, footprint),
    }
    d.LAYER = 'base'
    features = json.loads(bpy.context.scene.get('natureFeatures') or '[]')
    bpy.context.scene['natureFeatures'] = json.dumps(features + [
        'numeric-native-hex-union', 'footprint-clipped-core-v1',
        'footprint-scaled-source-objects-v1', 'no-full-frame-suppression'])
    bpy.context.scene['footprintFitReport'] = json.dumps(REPORTS[(field_id, cell_id)])
    return anchors
