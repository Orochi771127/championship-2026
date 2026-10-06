"""Containment v2: v1 plus per-frame source windows for variable-window fields.

v1 (``cage_opus_containment``) is frozen because its hash is recorded in the
first opus batch.  v2 changes three things and nothing else:

* an object's window is looked up per animation cell, from that cell's own
  size and pivot, so a frame is never padded to another frame's window;
* the measure pass keeps each cell's constraints separately and the solver
  stacks every cell's constraints into one programme, so the single placement
  it returns is legal for every frame, each inside its own window;
* the design anchor is the first one registered, so one transform is applied
  to every frame and a variable-size prop still cannot drift between frames.

v1 rationale, unchanged below.  Containment for refinement round opus-r1,
generalised from Batch E.

Batch E's ``cage_footprint_refinement`` is hard-wired to three fields and its
hash is recorded in manifests that already shipped, so it is neither imported
nor edited here.  ``cage_footprint_fit`` is reused unchanged for the same reason.

What this round changes, and why:

* Batch E could only *scale about a fixed point*.  A prop whose window hugs an
  edge then had to shrink until its farthest corner cleared the edge, which is
  how a zoo fence ended up at 0.09.  Here a prop may also *move inside its own
  window*.  Scale and translation together are a tiny linear programme: inside
  one convex container (a hex cell clipped to the source window), every
  constraint ``n . (q + f (p - p0)) >= offset`` is linear in ``(q, f)``.
* One fixed placement per source object, taken from the worst animation cell of
  its own sequence and applied to every cell, so no prop breathes between frames.
  Two instances of one sequence may differ in size: each owns its own exported
  cell, and shrinking a roomy instance to match a cramped sibling only loses art.
* A prop that already lies inside the hex *union* is left exactly where it is.
  That test is exact and needs no convexity, which is what lets a conveyor run
  straight across a shared hex seam without being cut into mismatched pieces.
* The shared platform tray edge is reported apart from real prop overhang.

There is no ``hide_render`` path anywhere in this round.
"""
import json
import math

from . import cage_footprint_fit as fit


WORKING_INSET = 1.0
FALLBACK_INSETS = (1.0, 0.5, 0.25)
MINIMUM_LEGIBLE_SCALE = 0.85
MINIMUM_AUTHORING_SIDE = 4.0
OUTSIDE_TOLERANCE_NATIVE_PX = 0.5
WINDOW_MARGIN = 0.05
WINDOW_TOUCH_TOLERANCE = 0.01
TRAY_OBJECT_PREFIXES = ('flush-porcelain-joint', 'shallow-blue-fascia', 'continuous-rim-light')

MODE = {'pass': 'render'}
TABLE = {}
COLLECTED = {}
REPORTS = {}
WINDOWS = {}
ANCHORS = {}


def reset():
    for store in (TABLE, COLLECTED, REPORTS, WINDOWS, ANCHORS):
        store.clear()


def source_window(record):
    """The effective placed window, identical to ``placed_cell_bounds``."""
    x, y = record['placement']
    px, py = record['pivot']
    w, h = record['size']
    if record['horizontalFlip']:
        px = w - px
    if record['verticalFlip']:
        py = h - py
    return (x - px, y - py, w, h)


def authoring_window(field_id, footprint, record):
    """The rectangle a prop is designed into, keyed by the frame's own size and pivot."""
    key = (field_id, record['order'], tuple(record['size']), tuple(record['pivot']))
    if key in WINDOWS:
        return WINDOWS[key]
    x, y, w, h = source_window(record)
    window = fit.rectangle(x, y, w, h)
    regions = fit.usable_region(window, footprint, WORKING_INSET)
    covered = sum(abs(fit.signed_area(region)) for _, region in regions)
    decision = {'source': (x, y, w, h), 'window': (x, y, w, h), 'reduced': False,
                'insetNativePx': WORKING_INSET,
                'coveredFraction': round(covered / max(1e-9, w * h), 4)}
    if covered < w * h - 1e-6:
        for inset in FALLBACK_INSETS:
            rect = fit.largest_inside_rectangle(window, footprint, inset)
            if rect and min(rect[2], rect[3]) >= MINIMUM_AUTHORING_SIDE:
                decision = {**decision, 'window': tuple(round(v, 4) for v in rect),
                            'reduced': True, 'insetNativePx': inset}
                break
        else:
            decision = {**decision, 'conflict': 'NO_LEGIBLE_RECTANGLE_INSIDE_FIELD'}
    WINDOWS[key] = decision
    return decision


def unique_cells(frames):
    return list(dict.fromkeys(frame['cellId'] for frame in frames))


def phase_for(contract_object, cell_id):
    """Which distinct pose of its own sequence an object shows in ``cell_id``."""
    cells = unique_cells(contract_object['frames'])
    return (cells.index(cell_id) if cell_id in cells else 0), len(cells)


def register_anchor(field_id, ordinal, point):
    """The design anchor: the first one registered is kept for every cell."""
    ANCHORS.setdefault((field_id, ordinal), (float(point[0]), float(point[1])))


# --------------------------------------------------------------------------- geometry

def _points(d, objects):
    import numpy as np
    rows = []
    for obj in objects:
        for p in d.evaluated_world_vertices(obj):
            rows.append(fit.native_screen(p))
    return np.asarray(rows, dtype=float).reshape(-1, 2)


def _union_depth(points, footprint):
    """Signed distance to the hex union's outer boundary, per point.

    Positive inside, negative outside.  Measured to the boundary *segments*
    only, so a shared seam between two hexes of the same field is never
    mistaken for an edge: a belt running straight across it is deep inside.
    """
    import numpy as np
    pts = np.asarray(points, dtype=float).reshape(-1, 2)
    edges = np.asarray(footprint['boundaryEdges'], dtype=float)
    a, b = edges[:, 0, :], edges[:, 1, :]
    ab = b - a
    length2 = (ab ** 2).sum(axis=1)
    rel = pts[:, None, :] - a[None, :, :]
    t = np.clip((rel * ab[None, :, :]).sum(axis=2) / length2[None, :], 0.0, 1.0)
    closest = a[None, :, :] + t[:, :, None] * ab[None, :, :]
    distance = np.sqrt(((pts[:, None, :] - closest) ** 2).sum(axis=2)).min(axis=1)
    inside = np.zeros(len(pts), dtype=bool)
    for cell in footprint['cells']:
        planes = np.asarray(fit.half_planes(cell['polygon']), dtype=float)
        inside |= (pts @ planes[:, :2].T - planes[:, 2]).min(axis=1) >= -1e-9
    return np.where(inside, distance, -distance)


def _union_outside(points, footprint):
    """Worst native-pixel distance outside the hex union (negative = inside)."""
    if not len(points):
        return -1e9
    return float(-_union_depth(points, footprint).min())


def _window_outside(points, source):
    """Worst native-pixel distance outside the object's own source window.

    The exporter crops every object cell at exactly this window, so a prop
    that is inside the field but not inside its window is still a failure.
    """
    if not len(points):
        return -1e9
    x, y, w, h = source
    over = [x - points[:, 0], points[:, 0] - (x + w), y - points[:, 1], points[:, 1] - (y + h)]
    return float(max(values.max() for values in over))


def containers(footprint, source, inset):
    """Convex containers: one hex cell clipped to the source window."""
    window = fit.rectangle(*source)
    window_planes = fit.half_planes(window, WINDOW_MARGIN * 2)
    boundary = fit.boundary_edges(footprint)
    out = []
    for cell in footprint['cells']:
        hex_planes = fit.half_planes(cell['polygon'], inset, boundary)
        region = fit.clip_to_half_planes(window, hex_planes)
        if len(region) >= 3 and abs(fit.signed_area(region)) > 1.0:
            out.append({'cellBit': cell['bit'], 'region': region,
                        'planes': hex_planes + window_planes})
    return out


def _support(points, planes, p0):
    import numpy as np
    arr = np.asarray(planes, dtype=float)
    shifted = points - np.asarray(p0, dtype=float)
    return (shifted @ arr[:, :2].T).min(axis=0).tolist()


def _max_factor(q, planes, support):
    factor = 1.0
    for (nx, ny, offset), s in zip(planes, support):
        room = nx * q[0] + ny * q[1] - offset
        if room < -1e-9:
            return -1.0
        if s < 0:
            factor = min(factor, room / -s)
    return factor


def solve_container(container, support, p0, target=None, samples=48):
    """Best ``(q, f)`` inside one convex container.

    With ``target`` set, return the placement nearest the design anchor that
    still reaches that scale; otherwise maximise the scale.
    """
    planes, region = container['planes'], container['region']
    at_home = _max_factor(p0, planes, support)
    if target is None and at_home >= 1.0:
        return tuple(p0), 1.0
    if target is not None and at_home + 1e-6 >= target:
        # Never drift a prop that already reaches the shared sequence scale.
        return tuple(p0), target
    region_planes = fit.half_planes(region)
    xs = [pt[0] for pt in region]
    ys = [pt[1] for pt in region]
    best = None
    for i in range(samples + 1):
        for j in range(samples + 1):
            q = (min(xs) + (max(xs) - min(xs)) * i / samples,
                 min(ys) + (max(ys) - min(ys)) * j / samples)
            if fit.clearance(q, region_planes) < -1e-9:
                continue
            factor = _max_factor(q, planes, support)
            if factor <= 0:
                continue
            distance = math.dist(q, p0)
            if target is not None:
                if factor + 1e-6 >= target and (best is None or distance < best[1]):
                    best = (q, distance, target)
            elif best is None or factor > best[2] + 1e-6 or (
                    abs(factor - best[2]) <= 1e-6 and distance < best[1]):
                best = (q, distance, factor)
    if best is None:
        return None, 0.0
    return best[0], best[2]


# --------------------------------------------------------------------------- passes

def _collect(field_id, record, decision, points, inside_union, cell_id):
    ordinal = record['order']
    entry = COLLECTED.setdefault(field_id, {}).setdefault(str(ordinal), {
        'sequenceId': record['sequenceId'], 'insideUnion': True,
        'anchor': ANCHORS[(field_id, ordinal)], 'frames': {}, 'cells': []})
    entry['insideUnion'] = entry['insideUnion'] and inside_union
    entry['cells'].append(cell_id)
    footprint = FOOTPRINTS[field_id]
    frame = entry['frames'].setdefault(str(cell_id), {'source': list(decision['source']), 'containers': {}})
    for inset in FALLBACK_INSETS:
        for container in containers(footprint, decision['source'], inset):
            key = f"{container['cellBit']}@{inset}"
            support = _support(points, container['planes'], entry['anchor'])
            slot = frame['containers'].setdefault(key, {'cellBit': container['cellBit'], 'inset': inset,
                                                        'support': support})
            slot['support'] = [min(a, b) for a, b in zip(slot['support'], support)]


FOOTPRINTS = {}


def _stacked(footprint, entry, key):
    """One container whose constraints are every frame's constraints at once."""
    planes, support, region, first = [], [], None, None
    for frame in entry['frames'].values():
        slot = frame['containers'].get(key)
        if slot is None:
            return None
        container = next(c for c in containers(footprint, frame['source'], slot['inset'])
                         if c['cellBit'] == slot['cellBit'])
        planes += container['planes']
        support += slot['support']
        region = container['region'] if region is None else region
        first = first or slot
    return {'cellBit': first['cellBit'], 'inset': first['inset'], 'planes': planes, 'region': region}, support


def solve_table(field_id):
    """Turn the measure pass into one fixed placement per object.

    Preference order: untouched if the worst cell already sits inside the hex
    union; otherwise the largest scale any container allows, preferring the
    working inset, then the smallest drift from where the prop was designed.
    """
    entries = COLLECTED.get(field_id, {})
    footprint = FOOTPRINTS[field_id]
    table = {}
    for key, entry in entries.items():
        cells_seen = sorted(set(entry['cells']))
        if entry['insideUnion']:
            table[key] = {'sequenceId': entry['sequenceId'], 'mode': 'inside-union',
                          'anchor': entry['anchor'], 'target': entry['anchor'], 'factor': 1.0,
                          'cells': cells_seen}
            continue
        candidates = []
        keys = set.intersection(*(set(frame['containers']) for frame in entry['frames'].values()))
        for container_key in sorted(keys):
            stacked = _stacked(footprint, entry, container_key)
            if stacked is None:
                continue
            container, support = stacked
            slot = {'cellBit': container['cellBit'], 'inset': container['inset']}
            q, factor = solve_container(container, support, entry['anchor'])
            if q is not None and factor > 0:
                candidates.append((round(factor, 4), slot['inset'] >= WORKING_INSET,
                                   -math.dist(q, entry['anchor']), q, factor, slot))
        if not candidates:
            raise ValueError(f'NO_PLACEMENT_INSIDE_FIELD:{field_id}:{key}')
        candidates.sort(key=lambda row: row[:3], reverse=True)
        _, _, _, q, factor, slot = candidates[0]
        table[key] = {'sequenceId': entry['sequenceId'], 'mode': 'placed-in-container',
                      'anchor': entry['anchor'], 'target': [round(q[0], 4), round(q[1], 4)],
                      'factor': round(min(1.0, factor), 6), 'cellBit': slot['cellBit'],
                      'insetNativePx': slot['inset'], 'cells': cells_seen}
    return table


def _apply(objects, anchor, target, factor):
    import bpy
    from mathutils import Matrix, Vector
    if factor >= 1.0 and math.dist(anchor, target) < 1e-9:
        return
    origin = Vector(fit.world_point(anchor[0], anchor[1], 0.0))
    destination = Vector(fit.world_point(target[0], target[1], 0.0))
    transform = Matrix.Translation(destination) @ Matrix.Scale(factor, 4) @ Matrix.Translation(-origin)
    for obj in objects:
        obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()


def is_tray_object(name, field_id):
    return name.startswith(TRAY_OBJECT_PREFIXES) or name in (field_id + '-foundation',
                                                             field_id + '-surface')


def measure_base(d, field_id, footprint):
    """Split base-layer overhang into the shared tray and this field's own core."""
    import bpy
    tray, core = [], []
    for obj in bpy.context.scene.objects:
        if obj.get('cageLayer') != 'base':
            continue
        points = _points(d, [obj])
        if not len(points):
            continue
        row = {'object': obj.name, 'outsideNativePx': round(_union_outside(points, footprint), 3)}
        (tray if is_tray_object(obj.name, field_id) else core).append(row)
    outside = sorted((row for row in core if row['outsideNativePx'] > OUTSIDE_TOLERANCE_NATIVE_PX),
                     key=lambda row: -row['outsideNativePx'])
    return {
        'trayMaxOutsideNativePx': max((row['outsideNativePx'] for row in tray), default=0.0),
        'trayObjects': len(tray),
        'coreMaxOutsideNativePx': max((row['outsideNativePx'] for row in core), default=0.0),
        'coreObjects': len(core),
        'coreObjectsOutside': outside[:12],
    }


def finish(d, field, footprint, cell_id, features):
    """Measure or place every source object for one rendered cell."""
    import bpy
    field_id = field['id']
    FOOTPRINTS[field_id] = footprint
    rows = []
    for record in field['objects']:
        ordinal = record['order']
        objects = [o for o in bpy.context.scene.objects
                   if o.get('cageLayer') == 'decor' and o.get('sourceObjectOrdinal') == ordinal]
        if not objects:
            raise ValueError(f'MISSING_INDEPENDENT_OBJECT_GROUP:{field_id}:{ordinal}')
        decision = authoring_window(field_id, footprint, record)
        points = _points(d, objects)
        # Inside the union by at least the working inset, and inside its own
        # source window, in this cell.
        inside_union = (_union_outside(points, footprint) <= -WORKING_INSET + 1e-6
                        and _window_outside(points, decision["source"]) <= WINDOW_TOUCH_TOLERANCE)
        if MODE['pass'] == 'measure':
            _collect(field_id, record, decision, points, inside_union, cell_id)
            placement = None
        else:
            placement = TABLE[field_id][str(ordinal)]
            _apply(objects, placement['anchor'], placement['target'], placement['factor'])
        after = _points(d, objects)
        worst = _union_outside(after, footprint)
        window_worst = _window_outside(after, decision['source'])
        if MODE['pass'] != 'measure' and worst > OUTSIDE_TOLERANCE_NATIVE_PX:
            raise ValueError(f'OBJECT_OUTSIDE_FOOTPRINT_AFTER_PLACEMENT:{field_id}:{ordinal}:{worst:.3f}')
        if MODE["pass"] != "measure" and window_worst > WINDOW_TOUCH_TOLERANCE:
            raise ValueError(f'OBJECT_OUTSIDE_SOURCE_WINDOW_AFTER_PLACEMENT:{field_id}:{ordinal}:{window_worst:.3f}')
        rows.append({
            'sourceOrdinal': ordinal, 'sequenceId': record['sequenceId'], 'sourceCellId': cell_id,
            'anchorNative': record['placement'], 'sourceWindowNative': list(decision['source']),
            'authoringWindowNative': list(decision['window']),
            'authoringWindowReduced': decision['reduced'],
            'windowInsideFieldFraction': decision['coveredFraction'],
            'conflict': decision.get('conflict'),
            'designAnchorNative': list(ANCHORS[(field_id, ordinal)]),
            'placement': placement,
            'worstOutsideNativePx': round(worst, 3),
        })
    base = measure_base(d, field_id, footprint)
    if base['coreObjectsOutside']:
        raise ValueError('CORE_GEOMETRY_OUTSIDE_FOOTPRINT:' + field_id + ':'
                         + json.dumps(base['coreObjectsOutside'][:3]))
    REPORTS[(field_id, cell_id)] = {'fieldId': field_id, 'sourceCellId': cell_id,
                                    'pass': MODE['pass'], 'workingInsetNativePx': WORKING_INSET,
                                    'objects': rows, 'base': base}
    d.LAYER = 'base'
    bpy.context.scene['natureFeatures'] = json.dumps(features + [
        'numeric-native-hex-union', 'designed-into-authoring-window-v1',
        'fixed-sequence-scale-worst-cell-v1', 'no-full-frame-suppression'])
    bpy.context.scene['footprintFitReport'] = json.dumps(REPORTS[(field_id, cell_id)])
