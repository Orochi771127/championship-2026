"""Screen-space footprint fitting for offline cage art.

The cage render is a locked orthographic projection, so mapping a Blender world
point to native screen pixels is affine.  Two consequences drive this module:

* a uniform three-dimensional scale about a point becomes a uniform
  two-dimensional scale about that point's projection, so an object can be
  fitted analytically instead of by re-rendering and guessing;
* a slab's top face projects higher on screen than its base polygon by exactly
  ``cos(elevation) * UNIT * z``, so a flat clip of the base polygon is not
  enough on its own.

Nothing here touches a numeric source anchor, pivot, window or flip.  It only
decides where authored presentation geometry is allowed to sit.
"""
from __future__ import annotations

import math


ELEVATION = math.radians(52)
SIN_ELEVATION, COS_ELEVATION = math.sin(ELEVATION), math.cos(ELEVATION)
UNIT = 16
EPSILON = 1e-9


def native_screen(point, unit=UNIT, sin_elevation=SIN_ELEVATION, cos_elevation=COS_ELEVATION):
    """Project a Blender world point to native screen pixels.

    The x/y half mirrors the measured floor extraction in ``build-cage-base3d``;
    the height term is the same 52-degree lift the camera applies.
    """
    x, y, z = point[0], point[1], point[2]
    return ((x + y) * unit / math.sqrt(2),
            (x - y) * unit * sin_elevation / math.sqrt(2) - cos_elevation * unit * z)


def world_point(x, y, z=0.0, unit=UNIT, sin_elevation=SIN_ELEVATION):
    """Native ground coordinates back to world space (mirrors ``build-cage-base3d.world``)."""
    return ((x + y / sin_elevation) / (unit * math.sqrt(2)),
            (x - y / sin_elevation) / (unit * math.sqrt(2)),
            z)


def screen_lift(height, unit=UNIT, cos_elevation=COS_ELEVATION):
    """Native pixels a feature of world height ``height`` rises on screen."""
    return cos_elevation * unit * height


def signed_area(polygon):
    total = 0.0
    for index, (x1, y1) in enumerate(polygon):
        x2, y2 = polygon[(index + 1) % len(polygon)]
        total += x1 * y2 - x2 * y1
    return total / 2


def oriented(polygon):
    """Native screen space has y pointing down; keep the positive-area winding."""
    points = [(float(x), float(y)) for x, y in polygon]
    return points if signed_area(points) >= 0 else points[::-1]


def edge_plane(start, end, inset=0.0):
    """Inward half-plane ``n . p >= offset`` for one edge of an oriented polygon."""
    nx, ny = -(end[1] - start[1]), (end[0] - start[0])
    length = math.hypot(nx, ny)
    if length < EPSILON:
        return None
    nx, ny = nx / length, ny / length
    return (nx, ny, nx * start[0] + ny * start[1] + inset)


def boundary_key(start, end):
    return tuple(sorted((tuple(round(float(v), 4) for v in start),
                         tuple(round(float(v), 4) for v in end))))


def boundary_edges(footprint):
    """Edges on the field's outer silhouette; the rest are shared hex seams."""
    return {boundary_key(a, b) for a, b in footprint["boundaryEdges"]}


def half_planes(polygon, inset=0.0, boundary=None):
    """Inward half-planes, insetting only edges that face the outside world.

    A shared hex seam gets no inset, so pieces clipped against neighbouring
    hexes still meet exactly and no seam gap is introduced.
    """
    points = oriented(polygon)
    planes = []
    for index, start in enumerate(points):
        end = points[(index + 1) % len(points)]
        applied = inset if boundary is None or boundary_key(start, end) in boundary else 0.0
        plane = edge_plane(start, end, applied)
        if plane:
            planes.append(plane)
    return planes


def clearance(point, planes):
    """Smallest signed distance from ``point`` to the half-plane set."""
    if not planes:
        return 0.0
    return min(nx * point[0] + ny * point[1] - offset for nx, ny, offset in planes)


def _crossing(previous, current, previous_distance, current_distance):
    t = previous_distance / (previous_distance - current_distance)
    return (previous[0] + (current[0] - previous[0]) * t,
            previous[1] + (current[1] - previous[1]) * t)


def clip_to_half_planes(polygon, planes):
    """Sutherland-Hodgman clip of a polygon against a convex half-plane set."""
    output = [(float(x), float(y)) for x, y in polygon]
    for nx, ny, offset in planes:
        if not output:
            return []
        subject, output = output, []
        previous = subject[-1]
        previous_distance = nx * previous[0] + ny * previous[1] - offset
        for current in subject:
            current_distance = nx * current[0] + ny * current[1] - offset
            if current_distance >= 0:
                if previous_distance < 0:
                    output.append(_crossing(previous, current, previous_distance, current_distance))
                output.append(current)
            elif previous_distance >= 0:
                output.append(_crossing(previous, current, previous_distance, current_distance))
            previous, previous_distance = current, current_distance
    return output


def clip_to_footprint(polygon, footprint, inset=0.0, height=0.0):
    """Split a native core polygon into per-hex pieces that stay inside the field.

    ``height`` is the slab's top world z.  The lift is folded into the outer
    inset because the top face, not the base polygon, is what a viewer sees
    crossing the silhouette.
    """
    lift = screen_lift(height)
    boundary = boundary_edges(footprint)
    pieces = []
    for cell in footprint["cells"]:
        piece = clip_to_half_planes(polygon, half_planes(cell["polygon"], inset + lift, boundary))
        if len(piece) >= 3 and abs(signed_area(piece)) > EPSILON:
            pieces.append(piece)
    return pieces


def plane_support(points, planes):
    """Per-plane minimum of ``n . p``.

    Only the extreme point along each plane normal can bind the scale, so this
    collapses a mesh of tens of thousands of vertices into one number per edge
    and makes the search below independent of how the centre is chosen.
    """
    return [min(nx * x + ny * y for x, y in points) for nx, ny, _ in planes]


def fit_factor(points, planes, center, support=None):
    """Largest uniform scale about ``center`` keeping every point inside ``planes``.

    Returns ``0.0`` when the centre itself is not strictly inside, which the
    caller must treat as "this window has no usable interior", never as a
    licence to clip the art away.
    """
    support = plane_support(points, planes) if support is None else support
    factor = 1.0
    cx, cy = center
    for (nx, ny, offset), lowest in zip(planes, support):
        reach = nx * cx + ny * cy
        room = reach - offset
        if room <= EPSILON:
            return 0.0
        span = reach - lowest
        if span > EPSILON:
            factor = min(factor, room / span)
    return max(0.0, factor)


def rectangle(x, y, width, height):
    return [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]


def usable_region(window, footprint, inset=0.0):
    """The parts of a source window that a hex of this field actually owns.

    Each hex is clipped separately so the result stays convex, which is what
    makes the scale search below exact rather than approximate.
    """
    boundary = boundary_edges(footprint)
    regions = []
    for cell in footprint["cells"]:
        region = clip_to_half_planes(window, half_planes(cell["polygon"], inset, boundary))
        if len(region) >= 3 and abs(signed_area(region)) > EPSILON:
            regions.append((cell, region))
    return regions


def vertical_span(polygon, x):
    """The y interval of a polygon at one x, or ``None`` outside its extent."""
    points = oriented(polygon)
    values = []
    for index, (x1, y1) in enumerate(points):
        x2, y2 = points[(index + 1) % len(points)]
        if not (min(x1, x2) - EPSILON <= x <= max(x1, x2) + EPSILON):
            continue
        if abs(x2 - x1) < EPSILON:
            values.extend((y1, y2))
        else:
            values.append(y1 + (y2 - y1) * (x - x1) / (x2 - x1))
    return (min(values), max(values)) if values else None


def inscribed_rectangle(region, samples=48):
    """Largest axis-aligned rectangle inside a convex region.

    A prop authored into this rectangle is inside the field by construction, so
    it keeps its full width instead of being uniformly shrunk until its farthest
    corner happens to clear an edge.  Convexity is what makes the scan exact:
    the lower bound of a vertical slice is convex and the upper bound concave,
    so a candidate x span is constrained by its two endpoints alone.
    """
    if len(region) < 3:
        return None
    xs = sorted({point[0] for point in region})
    low, high = xs[0], xs[-1]
    if high - low < EPSILON:
        return None
    grid = sorted(set(xs) | {low + (high - low) * i / samples for i in range(samples + 1)})
    spans = {x: vertical_span(region, x) for x in grid}
    best = None
    for index, x0 in enumerate(grid):
        first = spans[x0]
        if first is None:
            continue
        for x1 in grid[index + 1:]:
            second = spans[x1]
            if second is None:
                continue
            top = max(first[0], second[0])
            bottom = min(first[1], second[1])
            if bottom - top <= EPSILON:
                continue
            area = (x1 - x0) * (bottom - top)
            if best is None or area > best[0]:
                best = (area, (x0, top, x1 - x0, bottom - top))
    return best[1] if best else None


def footprint_cell_planes(footprint, inset=0.0):
    boundary = boundary_edges(footprint)
    return [half_planes(cell["polygon"], inset, boundary) for cell in footprint["cells"]]


def point_inside(point, cell_planes):
    """Inside the hex union when inside any one hex."""
    return max(clearance(point, planes) for planes in cell_planes) >= 0


def points_inside(points, cell_planes):
    return all(point_inside(point, cell_planes) for point in points)


def largest_inside_rectangle(window, footprint, inset=0.0, resolution=0.5):
    """Largest axis-aligned rectangle inside the hex union, within a window.

    Rasterised rather than clipped hex by hex because a window can straddle a
    shared seam: each clipped half is then small while the union they form is
    exactly the space the prop wants.  The result spans tested sample centres,
    so it is conservative by half a sample on every side rather than optimistic.
    """
    planes = footprint_cell_planes(footprint, inset)
    xs = [point[0] for point in window]
    ys = [point[1] for point in window]
    x0, y0 = min(xs), min(ys)
    width, height = max(xs) - x0, max(ys) - y0
    if width <= EPSILON or height <= EPSILON:
        return None
    columns = max(1, int(round(width / resolution)))
    rows = max(1, int(round(height / resolution)))
    step_x, step_y = width / columns, height / rows
    spans = [0] * columns
    best = None
    for row in range(rows):
        y = y0 + (row + 0.5) * step_y
        for column in range(columns):
            inside = point_inside((x0 + (column + 0.5) * step_x, y), planes)
            spans[column] = spans[column] + 1 if inside else 0
        stack = []
        for column in range(columns + 1):
            span = spans[column] if column < columns else 0
            start = column
            while stack and stack[-1][1] >= span:
                origin, tall = stack.pop()
                area = tall * (column - origin)
                if best is None or area > best[0]:
                    best = (area, origin, column, row - tall + 1, row + 1)
                start = origin
            stack.append((start, span))
    if best is None or best[0] == 0:
        return None
    _, first_column, last_column, first_row, last_row = best
    left = x0 + (first_column + 0.5) * step_x
    right = x0 + (last_column - 0.5) * step_x
    top = y0 + (first_row + 0.5) * step_y
    bottom = y0 + (last_row - 0.5) * step_y
    if right - left <= EPSILON or bottom - top <= EPSILON:
        return None
    return (left, top, right - left, bottom - top)


def interior_center(region, planes, preferred=None, samples=32):
    """A deep interior point of ``region``, biased toward ``preferred``.

    Depth first keeps the scale search from collapsing against a nearby edge;
    the bias then pulls the result back toward where the art naturally sits,
    so a prop does not drift across its own cell for no visible reason.
    """
    region_planes = half_planes(region)
    xs = [point[0] for point in region]
    ys = [point[1] for point in region]
    candidates = []
    for i in range(samples + 1):
        for j in range(samples + 1):
            point = (min(xs) + (max(xs) - min(xs)) * i / samples,
                     min(ys) + (max(ys) - min(ys)) * j / samples)
            if clearance(point, region_planes) < -EPSILON:
                continue
            room = clearance(point, planes)
            if room <= EPSILON:
                continue
            candidates.append((room, point))
    if not candidates:
        return None
    deepest = max(room for room, _ in candidates)
    shortlist = [point for room, point in candidates if room >= deepest * 0.75]
    if preferred is None:
        return max(candidates, key=lambda entry: entry[0])[1]
    return min(shortlist, key=lambda point: math.dist(point, preferred))


def choose_anchor(window, footprint, inset=0.0, preferred=None):
    """Pick the hex that owns a source window, and a scale centre inside it.

    The choice deliberately depends only on the window and the field, never on
    the object's own geometry, so every animation cell of the same object lands
    on the same centre and the prop cannot drift between frames.
    """
    regions = usable_region(window, footprint, inset)
    best = None
    for cell, region in regions:
        area = abs(signed_area(region))
        if best is not None and area <= best[0]:
            continue
        planes = half_planes(cell["polygon"], inset, boundary_edges(footprint))
        center = interior_center(region, planes, preferred)
        if center is not None:
            best = (area, cell["bit"], center, planes)
    if best is None:
        return None
    area, bit, center, planes = best
    return {"cellBit": bit, "center": (round(center[0], 4), round(center[1], 4)),
            "regionArea": round(area, 4), "planes": planes}


def plan_object_fit(points, window, footprint, inset=0.0, preferred=None):
    """Decide how one source object's authored geometry must shrink to fit.

    ``points`` are the object's projected native screen positions.  A factor of
    ``1.0`` means the object already fits and must not be touched.
    """
    anchor = choose_anchor(window, footprint, inset, preferred)
    if anchor is None:
        return {"cellBit": None, "center": None, "factor": 0.0, "regionArea": 0.0,
                "reason": "WINDOW_HAS_NO_INTERIOR_INSIDE_THIS_FIELD"}
    # Containment in the union is an exact test and needs no convexity, so check
    # it first.  A prop spanning a shared seam is already legal and must not be
    # shrunk merely because no single hex holds all of it.
    if points_inside(points, footprint_cell_planes(footprint, inset)):
        factor = 1.0
    else:
        factor = fit_factor(points, anchor["planes"], anchor["center"])
    return {"cellBit": anchor["cellBit"], "center": list(anchor["center"]),
            "factor": round(min(1.0, factor), 6), "regionArea": anchor["regionArea"]}
