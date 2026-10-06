"""Original facility family for refinement round opus-r1: lab, factory, ward.

Design notes (see each field's VISUAL_BRIEF.md for the full brief):

* Furniture is built on the cage's own 2:1 grid.  Under the locked 52-degree
  camera, boxes aligned to world axes project with edges at +/-0.79, while the
  hex outline and floor joints run at +/-0.5.  Ground footprints are therefore
  parallelograms along native (1, 0.5) and (1, -0.5), and round parts use 2:1
  ellipses, so props sit on the same grid as the floor instead of reading as
  screen-aligned flat panels.
* A hex's lower corner is a "V" of two bottom edges.  Benches and cabinet banks
  that live there follow both edges as an L-shaped corner unit, which uses the
  space a single box cannot, and keeps their tall parts away from top edges.
* The factory belt is one continuous model.  Each of its fifteen source objects
  receives exactly the part of that model inside its own screen column, so the
  slices tile without gaps or overlaps and the slats run straight through.
* Every source object is designed into its own window.  Containment is then
  verified, and only if needed corrected by one fixed placement per object, by
  ``cage_opus_containment``; nothing is hidden from the frame.

Research rasters were viewed locally only to understand intent.  None is
loaded, traced, sampled, textured or exported by this module.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment as containment


FIELDS = ('field_cm06_01', 'field_cm15_01', 'field_cm17_01')
SURFACES = {'field_cm06_01': 'fx-lab-floor', 'field_cm15_01': 'fx-factory-floor',
            'field_cm17_01': 'fx-ward-floor'}
CONTRACTS = {}

U = (1.0, 0.5)    # one ground axis of the cage grid, in native screen pixels
V = (1.0, -0.5)   # the other

PALETTE = {
    # name: (base colour, roughness, metallic, emission strength)
    'fx-white': ((.84, .87, .86), .36, .0, 0),
    'fx-panel': ((.62, .67, .69), .40, .10, 0),
    'fx-panel-dark': ((.27, .30, .32), .42, .25, 0),
    'fx-steel': ((.62, .66, .69), .28, .90, 0),
    'fx-steel-dark': ((.13, .15, .17), .38, .85, 0),
    'fx-chrome': ((.86, .88, .90), .12, 1.0, 0),
    'fx-rubber': ((.028, .03, .033), .82, .0, 0),
    'fx-charcoal': ((.055, .062, .07), .55, .20, 0),
    'fx-screen-cyan': ((.04, .80, .92), .18, .0, 2.4),
    'fx-screen-green': ((.12, .92, .32), .18, .0, 2.2),
    'fx-screen-amber': ((1.0, .58, .08), .20, .0, 2.4),
    'fx-led-red': ((1.0, .10, .05), .30, .0, 5.0),
    'fx-led-amber': ((1.0, .52, .04), .30, .0, 4.0),
    'fx-led-green': ((.18, 1.0, .28), .30, .0, 3.5),
    'fx-led-off': ((.07, .08, .08), .50, .0, 0),
    'fx-safety-yellow': ((.96, .70, .04), .48, .0, 0),
    'fx-hazard-black': ((.03, .03, .03), .60, .0, 0),
    'fx-robot-orange': ((.94, .38, .035), .36, .10, 0),
    'fx-robot-cream': ((.86, .82, .70), .40, .05, 0),
    'fx-copper': ((.74, .40, .18), .30, .90, 0),
    'fx-cable': ((.035, .035, .040), .62, .0, 0),
    'fx-cable-red': ((.55, .05, .04), .55, .0, 0),
    'fx-liquid': ((.02, .72, .70), .10, .0, 3.0),
    'fx-liquid-calm': ((.02, .42, .46), .12, .0, 1.1),
    'fx-bubble': ((.80, 1.0, .98), .10, .0, 2.2),
    'fx-core': ((1.0, .62, .12), .20, .10, 6.0),
    'fx-pad-blue': ((.06, .28, .62), .46, .0, 0),
    'fx-pad-dark': ((.035, .12, .30), .50, .0, 0),
    'fx-lamp-glow': ((1.0, .97, .88), .20, .0, 3.4),
    'fx-gas-green': ((.10, .40, .24), .34, .45, 0),
    'fx-gas-blue': ((.10, .22, .52), .34, .45, 0),
    'fx-gas-white': ((.85, .86, .84), .30, .30, 0),
    'fx-vent-glow': ((.10, .95, .85), .20, .0, 2.6),
    'fx-concrete-dark': ((.20, .19, .17), .85, .0, 0),
    'fx-cardboard': ((.62, .44, .22), .80, .0, 0),
    'fx-part-blue': ((.12, .42, .78), .35, .40, 0),
    'fx-lane-green': ((.20, .45, .32), .60, .0, 0),
}

FLOORS = {
    # name: tile colour, joint colour, plate period in 16-px lattice units, joint width
    'fx-lab-floor': ((.17, .23, .26), (.10, .14, .16), 2.0, .030),
    'fx-factory-floor': ((.25, .235, .21), (.17, .16, .145), 3.0, .022),
    'fx-ward-floor': ((.58, .70, .78), (.47, .59, .68), 1.0, .040),
}


# --------------------------------------------------------------------------- materials

def _lattice(d, nodes, links, period):
    """The cage grid as shader coordinates: joints run at slopes +/-0.5."""
    geometry = nodes.new('ShaderNodeNewGeometry')
    k = d.UNIT / math.sqrt(2)
    out = []
    for sign in (1, -1):
        dot = nodes.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        dot.inputs[1].default_value = (k * (1 / 16 + sign * d.S / 8) / period,
                                       k * (1 / 16 - sign * d.S / 8) / period, 0)
        links.new(geometry.outputs['Position'], dot.inputs[0])
        out.append(dot.outputs['Value'])
    return out


def _joint(nodes, links, socket, width):
    frac = nodes.new('ShaderNodeMath')
    frac.operation = 'FRACT'
    links.new(socket, frac.inputs[0])
    edge = nodes.new('ShaderNodeMath')
    edge.operation = 'PINGPONG'
    edge.inputs[1].default_value = .5
    links.new(frac.outputs[0], edge.inputs[0])
    less = nodes.new('ShaderNodeMath')
    less.operation = 'LESS_THAN'
    less.inputs[1].default_value = width
    links.new(edge.outputs[0], less.inputs[0])
    return less.outputs[0]


def _floor_material(d, name, tile, joint, period, width):
    mat = d.material(name, tile, .55, .05)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    u, v = _lattice(d, nodes, links, period)
    combined = nodes.new('ShaderNodeMath')
    combined.operation = 'MAXIMUM'
    links.new(_joint(nodes, links, u, width), combined.inputs[0])
    links.new(_joint(nodes, links, v, width), combined.inputs[1])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 14
    noise.inputs['Detail'].default_value = 2
    tone = nodes.new('ShaderNodeValToRGB')
    tone.color_ramp.elements[0].color = (*[c * .94 for c in tile], 1)
    tone.color_ramp.elements[1].color = (*[min(1, c * 1.04) for c in tile], 1)
    links.new(noise.outputs['Fac'], tone.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB')
    mix.blend_type = 'MIX'
    links.new(combined.outputs[0], mix.inputs[0])
    links.new(tone.outputs[0], mix.inputs[1])
    mix.inputs[2].default_value = (*joint, 1)
    links.new(mix.outputs[0], shader.inputs['Base Color'])
    if name == 'fx-ward-floor':
        shader.inputs['Roughness'].default_value = .18
        shader.inputs['Coat Weight'].default_value = .35
    return mat


def prepare(d, _cell_id):
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    if 'fx-glass' not in d.M:
        glass = d.material('fx-glass', (.86, .96, .98), .04, .0)
        bsdf = glass.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Transmission Weight'].default_value = .94
        bsdf.inputs['IOR'].default_value = 1.20
        bsdf.inputs['Roughness'].default_value = .02
    if 'fx-glass-frost' not in d.M:
        frost = d.material('fx-glass-frost', (.80, .92, .96), .30, .0)
        frost.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = .45
    for name, (tile, joint, period, width) in FLOORS.items():
        if name not in d.M:
            _floor_material(d, name, tile, joint, period, width)


# --------------------------------------------------------------------------- geometry

def lift(d, z):
    """Native pixels a point at world height ``z`` rises on screen."""
    return d.C * d.UNIT * z


def _object(d, name, verts, faces, mat, bevel=0.0, smooth=()):
    import bmesh
    import bpy
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    smooth = set(smooth)
    for index, poly in enumerate(mesh.polygons):
        poly.use_smooth = index in smooth
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return d.finish(obj, name, mat, bevel)


def prism(d, name, points, z0, z1, mat, bevel=0.0, smooth=False):
    pts = fit.oriented(points)
    n = len(pts)
    verts = [d.world(x, y, z) for z in (z0, z1) for x, y in pts]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return _object(d, name, verts, faces, mat, bevel, range(2, n + 2) if smooth else ())


def quad(cx, cy, a, b):
    """Ground parallelogram with half extents ``a`` along U and ``b`` along V."""
    return [(cx - a * U[0] - b * V[0], cy - a * U[1] - b * V[1]),
            (cx + a * U[0] - b * V[0], cy + a * U[1] - b * V[1]),
            (cx + a * U[0] + b * V[0], cy + a * U[1] + b * V[1]),
            (cx - a * U[0] + b * V[0], cy - a * U[1] + b * V[1])]


def box(d, name, cx, cy, a, b, z0, z1, mat, bevel=.010):
    return prism(d, name, quad(cx, cy, a, b), z0, z1, mat, bevel)


def ellipse(cx, cy, r, n=28):
    return [(cx + r * math.cos(i * math.tau / n), cy + .5 * r * math.sin(i * math.tau / n))
            for i in range(n)]


def lathe(d, name, cx, cy, profile, mat, n=28, bevel=0.0, caps=(True, True)):
    """Surface of revolution on the 2:1 grid; ``profile`` is [(z, radius), ...]."""
    rings = []
    verts = []
    for z, r in profile:
        rings.append(len(verts))
        verts += [d.world(x, y, z) for x, y in ellipse(cx, cy, max(r, 1e-4), n)]
    faces = []
    for a, b in zip(rings, rings[1:]):
        faces += [(a + i, a + (i + 1) % n, b + (i + 1) % n, b + i) for i in range(n)]
    smooth = range(len(faces))
    if caps[0]:
        faces.append(tuple(range(rings[0] + n - 1, rings[0] - 1, -1)))
    if caps[1]:
        faces.append(tuple(range(rings[-1], rings[-1] + n)))
    return _object(d, name, verts, faces, mat, bevel, smooth)


def cylinder(d, name, cx, cy, r, z0, z1, mat, n=28, bevel=0.0):
    return lathe(d, name, cx, cy, [(z0, r), (z1, r)], mat, n, bevel)


def pipe(d, name, points, radius, mat):
    """A tube through native ``(x, y, z)`` points (world-unit radius)."""
    return d.curve(name, [d.world(x, y, z) for x, y, z in points], radius, mat)


def ball(d, name, x, y, z, r, mat):
    """A sphere centred above native ground point (x, y) at world height z.

    ``r`` is in native pixels; an orthographic sphere projects as a true circle.
    """
    return d.sphere(name, d.world(x, y, z), (r / d.UNIT,) * 3, mat)


def face_panel(d, name, cx, cy, a, b, z0, z1, mat, side='front-left', inset=.15, depth=.6):
    """A flat panel on one of a box's two camera-facing walls (depth in native px)."""
    if side == 'front-left':
        ox, oy = cx - b * V[0], cy - b * V[1]
        span, normal, half = U, (-V[0], -V[1]), a
    else:
        ox, oy = cx + a * U[0], cy + a * U[1]
        span, normal, half = V, U, b
    length = math.hypot(*normal)
    nx, ny = normal[0] / length * depth, normal[1] / length * depth
    h = half * (1 - inset)
    pts = [(ox - span[0] * h, oy - span[1] * h), (ox + span[0] * h, oy + span[1] * h),
           (ox + span[0] * h + nx, oy + span[1] * h + ny), (ox - span[0] * h + nx, oy - span[1] * h + ny)]
    return prism(d, name, pts, z0, z1, mat, .003)


def edge_box(d, name, vertex, along, s0, s1, t0, t1, z0, z1, mat, bevel=.010):
    """A box following one of a hex's bottom edges, inset ``t0..t1`` above it.

    ``along`` is ``'left'`` (edge rising to the upper left) or ``'right'``.
    """
    vx, vy = vertex
    if along == 'left':
        point = lambda s, t: (vx - s + t, vy - .5 * s - .5 * t)
    else:
        point = lambda s, t: (vx + s - t, vy - .5 * s - .5 * t)
    pts = [point(s0, t0), point(s1, t0), point(s1, t1), point(s0, t1)]
    prism(d, name, pts, z0, z1, mat, bevel)
    s, t = (s0 + s1) / 2, (t0 + t1) / 2
    return point(s, t)


def bottom_corner(footprint, window):
    """The lowest outline vertex whose two neighbours both rise from it, near a window."""
    x, y, w, h = window
    outline = footprint['outline']
    best = None
    for i, (vx, vy) in enumerate(outline):
        before, after = outline[i - 1], outline[(i + 1) % len(outline)]
        if before[1] < vy and after[1] < vy and x - 12 <= vx <= x + w + 12 and vy >= y + h * .5:
            if best is None or abs(vx - (x + w / 2)) < abs(best[0] - (x + w / 2)):
                best = (vx, vy)
    return best


def corner_arms(footprint, window, t0=1.6, t1=8.6, margin=1.4):
    """Edge-parallel spans either side of a bottom corner, inside a window.

    Returns ``(vertex, left_span, right_span)`` where a span is (s0, s1) along
    its edge for a unit occupying ``t0..t1`` above that edge.  If the true hex
    corner lies below the window, the corner is raised to the window's bottom:
    the arms stay parallel to the hex edges and only move further inside.
    Without a hex corner under the window, a virtual corner at the window's
    bottom centre gives the same V-shaped unit, which is what fits a wide,
    shallow window that a single 2:1 box cannot.
    """
    x, y, w, h = window
    corner = bottom_corner(footprint, window)
    vx = corner[0] if corner else x + w / 2
    vy = min(corner[1], y + h - margin) if corner else y + h - margin
    left = (max(t0, vx + t1 - (x + w - margin)), min(34.0, vx - (x + margin) + t0))
    right = (max(t0, (x + margin) - vx + t1), min(34.0, (x + w - margin) - vx + t0))
    return (vx, vy), left, right


# --------------------------------------------------------------------------- lab (cm06)

def culture_tank(d, name, rect, phase, phases, resting=False):
    """Glass culture column: steel plinth, lit liquid, a seed core and bubbles.

    ``resting`` is the sequence's longest-held source cell: the calm state.
    """
    x, y, w, h = rect
    r = min(w / 2 - 1.5, 13.0)
    cx, cy = x + w / 2, y + h - 1.5 - r / 2
    zt = min((h - 3.0 - r) / lift(d, 1) - .45, 3.6)
    plinth = .32
    cap = zt - .40
    lathe(d, name + '-plinth', cx, cy, [(0, r), (plinth * .55, r), (plinth, r * .90)], 'fx-steel-dark', 32)
    cylinder(d, name + '-plinth-band', cx, cy, r * .93, plinth * .55, plinth * .70, 'fx-screen-cyan', 32)
    level = cap - .30 - (.30 if resting else 0)
    cylinder(d, name + '-liquid', cx, cy, r * .76, plinth, level, 'fx-liquid-calm' if resting else 'fx-liquid', 28)
    lathe(d, name + '-glass', cx, cy, [(plinth, r * .84), (cap, r * .84)], 'fx-glass', 32, 0, (False, False))
    for i, angle in enumerate((.35, 1.25, 2.95, 4.35)):
        rx, ry = cx + math.cos(angle) * r * .86, cy + .5 * math.sin(angle) * r * .86
        cylinder(d, f'{name}-rib-{i}', rx, ry, .7, plinth, cap, 'fx-steel', 8)
    lathe(d, name + '-cap', cx, cy, [(cap, r * .92), (cap + .16, r * .92), (zt - .06, r * .62), (zt, r * .44)],
          'fx-steel', 32)
    cylinder(d, name + '-feed', cx + r * .18, cy, r * .13, zt - .1, zt + .26, 'fx-steel-dark', 12)
    pipe(d, name + '-feed-hose', [(cx + r * .18, cy, zt + .24), (cx + r * .52, cy - r * .08, zt + .30),
                                  (cx + r * .80, cy - r * .16, zt + .06)], .045, 'fx-cable')
    core_z = plinth + (level - plinth) * .46
    ball(d, name + '-core', cx, cy, core_z, r * .32, 'fx-core')
    if not resting:
        for i in range(5):
            rise = (i * .21 + phase * .25) % 1.0
            bz = plinth + .15 + rise * (level - plinth - .3)
            bx = cx + math.sin(i * 2.1 + phase) * r * .42
            by = cy + .5 * math.cos(i * 1.7) * r * .30
            ball(d, f'{name}-bubble-{i}', bx, by, bz, .9 + (i % 2) * .5, 'fx-bubble')
    return (cx, cy)


def coolant_grate(d, name, rect, phase, phases, resting=False):
    """Floor-level coolant grate with a pulsing glow and rising vapour."""
    x, y, w, h = rect
    total = min(w / 2 - 1.5, (h - 10) * .9, 13.0)
    cx, cy = x + w / 2, y + h - 1.5 - total / 2
    a = b = total / 2
    box(d, name + '-frame', cx, cy, a, b, 0, .06, 'fx-steel-dark', .006)
    box(d, name + '-glow', cx, cy, a * .82, b * .82, .02, .065, 'fx-liquid-calm' if resting else 'fx-vent-glow', 0)
    for i in range(5):
        t = -1 + (2 * i + 1) / 5
        px, py = cx + t * a * .82 * U[0], cy + t * a * .82 * U[1]
        box(d, f'{name}-slat-{i}', px, py, a * .06, b * .86, .06, .10, 'fx-steel', .003)
    if not resting:
        for i in range(3):
            rise = (i * .33 + phase * .25) % 1.0
            ball(d, f'{name}-vapour-{i}', cx + (i - 1) * a * .45, cy - (i % 2) * 1.5, .25 + rise * .9,
                 1.2 + rise * 1.1, 'fx-bubble')
    return (cx, cy)


def cryo_locker(d, name, rect):
    """Low cryo-sample locker: frosted lid and a status strip."""
    x, y, w, h = rect
    total = min(w / 2 - 1.5, 9.0)
    cx, cy = x + w / 2, y + h - 1.0 - total / 2
    a, b = total * .58, total * .42
    zt = .62
    box(d, name + '-body', cx, cy, a, b, 0, zt * .82, 'fx-white', .010)
    box(d, name + '-lid', cx, cy, a * .94, b * .90, zt * .82, zt, 'fx-glass-frost', .006)
    face_panel(d, name + '-status', cx, cy, a, b, zt * .40, zt * .56, 'fx-screen-cyan', 'front-left', .30)
    return (cx, cy)


def monitor_cart(d, name, rect, phase):
    """Rolling instrument cart with a waveform screen."""
    x, y, w, h = rect
    total = min(w / 2 - 1.5, 9.0)
    cx, cy = x + w / 2, y + h - 1.5 - total / 2
    a, b = total * .58, total * .42
    zt = 1.25
    for i, (sa, sb) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        wx, wy = cx + sa * a * .8 * U[0] + sb * b * .8 * V[0], cy + sa * a * .8 * U[1] + sb * b * .8 * V[1]
        ball(d, f'{name}-wheel-{i}', wx, wy, .06, .8, 'fx-rubber')
    box(d, name + '-base', cx, cy, a, b, .08, .20, 'fx-panel-dark', .006)
    cylinder(d, name + '-column', cx, cy, .8, .20, zt * .55, 'fx-steel', 10)
    box(d, name + '-tray', cx, cy, a * .9, b * .8, zt * .55, zt * .62, 'fx-white', .006)
    box(d, name + '-screen-case', cx, cy, a * .82, b * .34, zt * .62, zt, 'fx-charcoal', .006)
    face_panel(d, name + '-screen', cx, cy, a * .82, b * .34, zt * .66, zt * .96,
               'fx-screen-green' if phase % 2 == 0 else 'fx-screen-cyan', 'front-left', .10)
    return (cx, cy)


def cable_reel(d, name, rect):
    """Coiled power cable on a low reel."""
    x, y, w, h = rect
    r = min(w / 2 - 2, h - 4, 11.0) * .85
    cx, cy = x + w / 2, y + h - 2 - r / 2
    lathe(d, name + '-drum', cx, cy, [(0, r * .55), (.10, r * .55), (.10, r * .30), (.24, r * .30),
                                      (.24, r * .55), (.32, r * .55)], 'fx-panel-dark', 24)
    for i in range(3):
        rr = r * (.68 + i * .12)
        ring = [(cx + rr * math.cos(k * math.tau / 24), cy + .5 * rr * math.sin(k * math.tau / 24),
                 .05 + i * .035) for k in range(25)]
        pipe(d, f'{name}-coil-{i}', ring, .055, 'fx-cable')
    pipe(d, name + '-lead', [(cx + r * .9, cy, .06), (cx + r * 1.10, cy + r * .2, .03)], .05, 'fx-cable-red')
    return (cx, cy)


def status_beacon(d, name, rect, phase):
    """Free-standing signal tower; two-state pulse."""
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 2.5
    zt = min(2.0, max(.6, (h - 8.0) / lift(d, 1)))
    cylinder(d, name + '-foot', cx, cy, 2.6, 0, .12, 'fx-steel-dark', 14)
    cylinder(d, name + '-mast', cx, cy, .7, .12, zt * .70, 'fx-steel', 10)
    for k, mat in enumerate(('fx-led-green', 'fx-led-amber' if phase % 2 == 0 else 'fx-led-off',
                             'fx-led-red' if phase % 2 else 'fx-led-off')):
        z0 = zt * (.70 + k * .10)
        cylinder(d, f'{name}-lamp-{k}', cx, cy, 1.8, z0, z0 + zt * .09, mat, 16)
    lathe(d, name + '-cap', cx, cy, [(zt, 1.8), (zt + .05, .3)], 'fx-steel-dark', 16)
    return (cx, cy)


def corner_lab_bench(d, name, window, footprint, phase, monitors=True):
    """L-shaped lab bench hugging a hex's bottom corner."""
    depth = 7.0
    desk = .82
    vertex, left, right = corner_arms(footprint, window, 1.6, 1.6 + depth)
    anchors = []
    t0, t1 = 1.6, 1.6 + depth
    vx, vy = vertex
    top_y = window[1] + 1.2

    def reach(height):
        # Furthest distance along an edge whose back corner, at this height,
        # still clears the window's top: tall parts stay near the low corner.
        return 2 * (vy - .5 * (t1 + .4) - lift(d, height) - top_y)

    for side, (s0, s1) in (('left', left), ('right', right)):
        s0 = max(s0, t1 + .1)
        s1 = min(s1, reach(desk) - .5)
        if s1 - s0 < 6:
            continue
        c = edge_box(d, f'{name}-{side}-cabinet', vertex, side, s0, s1, 1.6, 1.6 + depth, 0, desk - .06,
                     'fx-panel', .012)
        edge_box(d, f'{name}-{side}-top', vertex, side, s0 - .4, s1 + .4, 1.2, 2.0 + depth, desk - .06, desk,
                 'fx-white', .006)
        # Raised instrument shelf at the back of the bench, monitors on it.
        shelf_end = min(s1 - 1, reach(desk + .34))
        if shelf_end - (s0 + 1) > 3:
            edge_box(d, f'{name}-{side}-shelf', vertex, side, s0 + 1, shelf_end, depth - 1.0, 1.6 + depth,
                     desk, desk + .34, 'fx-panel-dark', .006)
        monitor_end = min(shelf_end, reach(desk + 1.05)) - 3.4
        count = max(0, min(int((s1 - s0) // 12) or 1, int((monitor_end - s0) // 7.5) + 1))
        for i in range(count):
            s = min(s0 + 3.6 + i * 7.5, monitor_end)
            if s < s0 + 3.2:
                break
            edge_box(d, f'{name}-{side}-monitor-{i}', vertex, side, s - 3.2, s + 3.2, depth - .6, depth + .2,
                     desk + .34, desk + 1.05, 'fx-charcoal', .006)
            lit = ('fx-screen-green', 'fx-screen-cyan', 'fx-screen-amber')[(i + phase + (side == 'right')) % 3]
            edge_box(d, f'{name}-{side}-screen-{i}', vertex, side, s - 2.7, s + 2.7, depth - 1.0, depth - .55,
                     desk + .42, desk + .98, lit, 0)
        for i in range(3):
            s = s0 + 2.5 + i * 1.6
            px, py = (vertex[0] - s + 3.0, vertex[1] - .5 * s - 1.5) if side == 'left' else \
                     (vertex[0] + s - 3.0, vertex[1] - .5 * s - 1.5)
            cylinder(d, f'{name}-{side}-vial-{i}', px, py, .8, desk, desk + .30,
                     ('fx-liquid', 'fx-screen-amber', 'fx-led-red')[i], 10)
        anchors.append(c)
    if not anchors:
        return lab_bench_box(d, name, window, phase)
    vx, vy = vertex
    corner = [(vx - a * U[0] + b * V[0], vy - a * U[1] + b * V[1])
              for a, b in ((t0, t0), (t1 + .1, t0), (t1 + .1, t1 + .1), (t0, t1 + .1))]
    prism(d, name + '-corner-cabinet', corner, 0, desk - .06, 'fx-panel', .012)
    top = [(vx - a * U[0] + b * V[0], vy - a * U[1] + b * V[1])
           for a, b in ((t0 - .4, t0 - .4), (t1 + .5, t0 - .4), (t1 + .5, t1 + .5), (t0 - .4, t1 + .5))]
    prism(d, name + '-corner-top', top, desk - .06, desk, 'fx-white', .006)
    return anchors[0]


def lab_bench_box(d, name, rect, phase):
    x, y, w, h = rect
    total = min(w / 2 - 1.5, h * .55)
    cx, cy = x + w / 2, y + h - 1.5 - total / 2
    a, b = total * .64, total * .36
    box(d, name + '-cabinet', cx, cy, a, b, 0, .76, 'fx-panel', .012)
    box(d, name + '-top', cx, cy, a * 1.02, b * 1.04, .76, .82, 'fx-white', .006)
    box(d, name + '-screen-case', cx + b * .5 * V[0], cy + b * .5 * V[1], a * .5, b * .3, .82, 1.4,
        'fx-charcoal', .006)
    face_panel(d, name + '-screen', cx + b * .5 * V[0], cy + b * .5 * V[1], a * .5, b * .3, .88, 1.34,
               'fx-screen-green' if phase % 2 == 0 else 'fx-screen-cyan', 'front-left', .12)
    return (cx, cy)


def lab_core(d, footprint):
    """Floor plates, rear service cabinets and cable runs; the centre stays open."""
    for i, (cx, cy) in enumerate(((243, 50), (274, 50), (305, 50))):
        box(d, f'lab-wall-cabinet-{i}', cx, cy, 8.5, 2.6, 0, 1.25, 'fx-panel', .012)
        face_panel(d, f'lab-wall-cabinet-door-{i}', cx, cy, 8.5, 2.6, .25, 1.05, 'fx-panel-dark',
                   'front-left', .16)
        for k in range(3):
            lx, ly = cx - 4.5 + k * 4.5, cy + 2.6 + k * 2.25 - 1.3
            box(d, f'lab-wall-cabinet-led-{i}-{k}', lx, ly, .7, .4, 1.06, 1.12,
                ('fx-led-green', 'fx-led-amber', 'fx-led-green')[k], 0)
    for i, (cx, cy, mat) in enumerate(((14, 130, 'fx-gas-green'), (20, 134, 'fx-gas-blue'))):
        lathe(d, f'lab-gas-bottle-{i}', cx, cy, [(0, 2.4), (1.15, 2.4), (1.30, 1.7), (1.42, .8)], mat, 18)
        cylinder(d, f'lab-gas-valve-{i}', cx, cy, .7, 1.42, 1.56, 'fx-chrome', 10)
    return ['glass-culture-tanks', 'rear-service-cabinets', 'open-central-lab-floor']


def held_longest(contract_object):
    """The source cell a sequence holds longest (raw ticks, never a clock)."""
    frames = contract_object['frames']
    return max(frames, key=lambda frame: frame['rawDurationTicks'])['cellId'] if len(frames) > 2 else None


def lab_object(d, record, rect, footprint, phase, phases, contract_object=None, cell_id=0):
    seq = record['sequenceId']
    name = f"lab-{record['order']:02d}"
    if seq in (6, 7):
        resting = contract_object is not None and cell_id == held_longest(contract_object)
        if contract_object is not None:
            # Sequences 6 and 7 share cells 8-12.  Tie the bubble phase to the
            # cell itself, so a shared cell shows the same state in both.
            moving = sorted({f['cellId'] for f in contract_object['frames']} - {held_longest(contract_object)})
            phase = moving.index(cell_id) if cell_id in moving else 0
            phases = len(moving) + 1
        if rect[2] >= 24 and rect[3] >= 48 and record['order'] != 13:
            return 'culture-tank', culture_tank(d, name + '-tank', rect, phase, phases, resting)
        return 'coolant-grate', coolant_grate(d, name + '-grate', rect, phase, phases, resting)
    if seq == 5:
        return 'cryo-locker', cryo_locker(d, name + '-locker', rect)
    if seq == 3:
        return 'monitor-cart', monitor_cart(d, name + '-cart', rect, phase)
    if seq == 4:
        return 'cable-reel', cable_reel(d, name + '-reel', rect)
    if seq == 2:
        return 'status-beacon', status_beacon(d, name + '-beacon', rect, phase)
    window = containment.source_window(record)
    role = 'analysis-workstation' if seq == 0 else 'lab-bench'
    return role, corner_lab_bench(d, name + '-bench', window, footprint, phase)


# --------------------------------------------------------------------------- factory (cm15)

BELT_HALF = 6.2      # native px across the belt (along V)
BELT_TOP = .30       # world z of the belt surface
BELT_U = (10.0, 206.0)


def belt_origin_y(d):
    return 64.0 + lift(d, BELT_TOP) / 2


def belt_point(d, u, t):
    """Ground point at distance ``u`` along the belt and ``t`` across it (V)."""
    return (u + t, belt_origin_y(d) + .5 * u - .5 * t)


def belt_centre_y(d, x):
    return belt_origin_y(d) + .5 * x


def belt_parts(d, phase):
    """The whole belt as (name, ground polygon, z0, z1, material) components."""
    u0, u1 = BELT_U
    h = BELT_HALF

    def part(name, ua, ub, ta, tb, z0, z1, mat):
        pts = [belt_point(d, ua, ta), belt_point(d, ub, ta), belt_point(d, ub, tb), belt_point(d, ua, tb)]
        return (name, pts, z0, z1, mat)

    parts = [
        part('body', u0, u1, -h * .96, h * .96, .10, BELT_TOP - .05, 'fx-steel-dark'),
        part('belt', u0, u1, -h * .80, h * .80, BELT_TOP - .05, BELT_TOP, 'fx-rubber'),
        part('rail-near', u0, u1, -h, -h * .80, BELT_TOP - .05, BELT_TOP + .07, 'fx-safety-yellow'),
        part('rail-far', u0, u1, h * .80, h, BELT_TOP - .05, BELT_TOP + .07, 'fx-steel'),
        part('start-drum', u0 - 2.2, u0, -h, h, .10, BELT_TOP + .09, 'fx-steel'),
        part('end-drum', u1, u1 + 2.6, -h, h, .10, BELT_TOP + .09, 'fx-steel'),
        part('end-guard', u1 + .4, u1 + 2.2, -h * .9, h * .9, BELT_TOP + .09, BELT_TOP + .16, 'fx-hazard-black'),
    ]
    slat = 4.0
    s = u0 + (phase % 4)
    k = 0
    while s + 1.1 <= u1:
        parts.append(part(f'slat-{k}', s, s + 1.1, -h * .74, h * .74, BELT_TOP, BELT_TOP + .02, 'fx-panel'))
        s += slat
        k += 1
    for k, u in enumerate(range(int(u0) + 14, int(u1), 32)):
        for sign in (-1, 1):
            parts.append(part(f'leg-{k}-{sign}', u - .8, u + .8, sign * h * .7 - .8, sign * h * .7 + .8,
                              0, .12, 'fx-steel'))
    return parts


def conveyor_slice(d, name, x0, x1, phase):
    """Emit exactly the part of the continuous belt inside screen columns [x0, x1]."""
    strip = [(1.0, 0.0, x0), (-1.0, 0.0, -x1)]
    made = 0
    for part_name, pts, z0, z1, mat in belt_parts(d, phase):
        piece = fit.clip_to_half_planes(pts, strip)
        if len(piece) >= 3 and abs(fit.signed_area(piece)) > .02:
            prism(d, f'{name}-{part_name}', piece, z0, z1, mat, 0)
            made += 1
    if not made:
        return None
    xm = (x0 + x1) / 2
    return (xm, belt_centre_y(d, xm))


def conveyor_end(d, name, rect, phase):
    """Collection bin at the belt's end with a status lamp."""
    x, y, w, h = rect
    total = min(w / 2 - 1.5, 7.0)
    cx, cy = x + w / 2, y + h - 1.2 - total / 2
    a = b = total / 2
    box(d, name + '-bin', cx, cy, a, b, 0, .48, 'fx-part-blue', .008)
    box(d, name + '-bin-inner', cx, cy, a * .8, b * .8, .32, .49, 'fx-charcoal', 0)
    for i in range(3):
        ball(d, f'{name}-part-{i}', cx - a * .5 + i * a * .5, cy, .52, .8,
             ('fx-copper', 'fx-steel', 'fx-copper')[(i + phase) % 3])
    lamp = ('fx-led-green', 'fx-led-amber', 'fx-led-green', 'fx-led-off')[phase % 4]
    lx, ly = cx + a * .8 * V[0], cy + a * .8 * V[1]
    cylinder(d, name + '-lamp-post', lx, ly, .45, .48, .80, 'fx-steel', 8)
    ball(d, name + '-lamp', lx, ly, .88, .9, lamp)
    return (cx, cy)


def belt_band(d, x):
    """Visible screen y range of the belt (rails included) at column x."""
    c = belt_centre_y(d, x)
    return c - BELT_HALF - lift(d, BELT_TOP + .16), c + BELT_HALF


def arm_base(d, rect, footprint, radius, want_px):
    """A floor spot for an arm pedestal: clear of the belt, inside the field,
    as close to the belt as possible while leaving ``want_px`` of headroom."""
    x, y, w, h = rect
    planes = fit.footprint_cell_planes(footprint, 1.5)
    best = None
    for i in range(41):
        for j in range(41):
            bx = x + 2 * radius + 1.5 + (w - 4 * radius - 3) * i / 40
            by = y + radius + 1.5 + (h - 2 * radius - 3) * j / 40
            corners = quad(bx, by, radius, radius)
            if not all(fit.point_inside(c, planes) for c in corners):
                continue
            clear = True
            for sx in (bx - 2 * radius, bx, bx + 2 * radius):
                top, bottom = belt_band(d, sx)
                if not (by + radius < top - 1.0 or by - radius > bottom + 1.0):
                    clear = False
            if not clear:
                continue
            headroom = (by - radius) - (y + 1.0)
            reach = abs(by - belt_centre_y(d, bx))
            score = min(headroom, want_px) * 2 - reach
            if best is None or score > best[0]:
                best = (score, bx, by, headroom)
    if best is None:
        return None
    return best[1], best[2], best[3]


def six_axis_arm(d, name, rect, footprint, phase, phases):
    """Floor-mounted articulated arm reaching over the belt."""
    placed = arm_base(d, rect, footprint, 4.0, 26.0)
    if placed is None:
        return scara_arm(d, name, rect, footprint, phase, phases)
    bx, by, headroom = placed
    budget = max(1.2, min(2.6, (headroom - 3.0) / lift(d, 1)))
    box(d, name + '-plinth', bx, by, 4.0, 4.0, 0, .16, 'fx-steel-dark', .008)
    box(d, name + '-hazard', bx, by, 4.7, 4.7, 0, .015, 'fx-safety-yellow', 0)
    cylinder(d, name + '-base', bx, by, 3.2, .16, .46, 'fx-robot-cream', 24)
    cylinder(d, name + '-turret', bx, by, 2.5, .46, .78, 'fx-robot-orange', 24)
    sweep = (-6.0, 0.0, 6.0, 2.0)[phase % 4] if phases > 1 else 0.0
    tx = min(max(bx + sweep - 4.0, rect[0] + 3.0), rect[0] + rect[2] - 3.0)
    ty = belt_centre_y(d, tx)
    ty = min(max(ty, rect[1] + 4.0), rect[1] + rect[3] - 2.0)
    sz = .86
    wz = BELT_TOP + .55
    ez = min(budget, sz + .9 + .25 * (phase % 2))
    ex, ey = bx + (tx - bx) * .45, by + (ty - by) * .45
    pipe(d, name + '-upper', [(bx, by, sz), (ex, ey, ez)], .15, 'fx-robot-orange')
    pipe(d, name + '-fore', [(ex, ey, ez), (tx, ty, wz)], .11, 'fx-robot-orange')
    ball(d, name + '-shoulder', bx, by, sz, 2.2, 'fx-robot-cream')
    ball(d, name + '-elbow', ex, ey, ez, 1.7, 'fx-robot-cream')
    ball(d, name + '-wrist', tx, ty, wz, 1.2, 'fx-steel')
    pipe(d, name + '-tool', [(tx, ty, wz), (tx, ty, BELT_TOP + .18)], .05, 'fx-steel-dark')
    return (bx, by)


def scara_arm(d, name, rect, footprint, phase, phases):
    """Low horizontally swinging arm: suits shallow windows beside the belt."""
    placed = arm_base(d, rect, footprint, 4.2, 12.0)
    x, y, w, h = rect
    if placed is None:
        bx, by = x + w / 2, y + h - 4.0
    else:
        bx, by, _ = placed
    z0 = .72
    box(d, name + '-plinth', bx, by, 4.2, 4.2, 0, .14, 'fx-steel-dark', .008)
    box(d, name + '-hazard', bx, by, 4.9, 4.9, 0, .015, 'fx-safety-yellow', 0)
    cylinder(d, name + '-column', bx, by, 3.0, .14, z0, 'fx-robot-cream', 22)
    swing = (-.55, -.18, .18, .55)[phase % 4] if phases > 1 else 0.0
    tx = bx + (-14.0 + 10.0 * swing)
    ty = belt_centre_y(d, tx) - 2.0
    tx = min(max(tx, x + 3.0), x + w - 3.0)
    ty = min(max(ty, y + 3.0), y + h - 2.0)
    jx, jy = (bx + tx) / 2 + 4.0 * math.cos(swing * 2 + 1.0), (by + ty) / 2 - 2.0 * math.sin(swing * 2 + 1.0)
    _arm_link(d, name + '-link-0', (bx, by), (jx, jy), z0, z0 + .24, 2.0, 'fx-robot-orange')
    _arm_link(d, name + '-link-1', (jx, jy), (tx, ty), z0 + .08, z0 + .28, 1.6, 'fx-robot-orange')
    cylinder(d, name + '-elbow', jx, jy, 2.1, z0, z0 + .32, 'fx-robot-cream', 18)
    cylinder(d, name + '-quill', tx, ty, .8, BELT_TOP + .10, z0 + .34, 'fx-steel', 12)
    box(d, name + '-gripper', tx, ty, 1.3, 1.3, BELT_TOP + .04, BELT_TOP + .16, 'fx-steel-dark', .004)
    return (bx, by)


def _arm_link(d, name, a, b, z0, z1, width, mat):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = max(.001, math.hypot(dx, dy))
    nx, ny = -dy / length * width, dx / length * width
    prism(d, name, [(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny),
                    (a[0] - nx, a[1] - ny)], z0, z1, mat, .01)


def safety_railing(d, name, rect):
    """Yellow tubular safety railing laid along the cage grid."""
    x, y, w, h = rect
    span = min(w / 2 - 2.0, 10.0)
    cx, cy = x + w / 2, y + h - 2.0 - span * .5
    zt = min(1.15, max(.5, (h - 4.0 - span) / lift(d, 1)))
    start = (cx - span * V[0], cy - span * V[1])
    end = (cx + span * V[0], cy + span * V[1])
    posts = 3
    for i in range(posts):
        t = i / (posts - 1)
        px, py = start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t
        box(d, f'{name}-foot-{i}', px, py, .9, .9, 0, .06, 'fx-steel-dark', 0)
        pipe(d, f'{name}-post-{i}', [(px, py, .05), (px, py, zt)], .07, 'fx-safety-yellow')
    for k, z in enumerate((zt, zt * .55)):
        pipe(d, f'{name}-rail-{k}', [(start[0], start[1], z), (end[0], end[1], z)], .065, 'fx-safety-yellow')
    return (cx, cy)


def safety_bollard(d, name, rect):
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 2.5
    zt = max(.4, min(.9, (h - 6) / lift(d, 1)))
    lathe(d, name + '-body', cx, cy, [(0, 2.0), (.08, 2.0), (.10, 1.4), (zt, 1.4), (zt + .08, .6)],
          'fx-safety-yellow', 18)
    for k in range(2):
        cylinder(d, f'{name}-band-{k}', cx, cy, 1.45, zt * (.35 + k * .3), zt * (.45 + k * .3),
                 'fx-hazard-black', 18)
    return (cx, cy)


def factory_core(d, footprint):
    """Painted walkways, a belt guide line, a drain and parked crates."""
    lane = [(56, 170), (84, 156), (132, 180), (104, 194)]
    prism(d, 'factory-safety-lane', lane, 0, .010, 'fx-lane-green', 0)
    for i in range(7):
        t0, t1 = i / 7, (i + .55) / 7
        a = (56 + 28 * t0, 170 - 14 * t0)
        b = (56 + 28 * t1, 170 - 14 * t1)
        prism(d, f'factory-lane-edge-{i}', [a, b, (b[0] + 1.6, b[1] + .8), (a[0] + 1.6, a[1] + .8)], 0, .014,
              'fx-safety-yellow' if i % 2 == 0 else 'fx-hazard-black', 0)
    g0, g1 = belt_point(d, 16.0, -BELT_HALF - 3.0), belt_point(d, 200.0, -BELT_HALF - 3.0)
    prism(d, 'factory-belt-guide-line', [g0, g1, (g1[0] - .6, g1[1] + 1.2), (g0[0] - .6, g0[1] + 1.2)],
          0, .010, 'fx-safety-yellow', 0)
    h0, h1 = belt_point(d, 26.0, BELT_HALF + 3.0), belt_point(d, 196.0, BELT_HALF + 3.0)
    prism(d, 'factory-belt-guide-far', [h0, h1, (h1[0] + .6, h1[1] - 1.2), (h0[0] + .6, h0[1] - 1.2)],
          0, .010, 'fx-safety-yellow', 0)
    box(d, 'factory-drain', 206, 138, 8.0, .9, 0, .015, 'fx-concrete-dark', 0)
    for i, (cx, cy, z) in enumerate(((222, 140, .42), (215, 146, .34), (226, 148, .26))):
        box(d, f'factory-crate-{i}', cx, cy, 2.5, 2.5, 0, z, 'fx-cardboard', .01)
    for i, (cx, cy) in enumerate(((22, 40), (34, 34))):
        box(d, f'factory-parts-rack-{i}', cx, cy + 6, 5.0, 2.0, 0, .9, 'fx-steel-dark', .010)
        for k in range(3):
            box(d, f'factory-parts-bin-{i}-{k}', cx - 3 + k * 3, cy + 7.5 + k * 1.5 - 1.5, 1.2, 1.5, .55, .75,
                ('fx-part-blue', 'fx-safety-yellow', 'fx-part-blue')[k], .004)
    return ['continuous-diagonal-conveyor', 'robot-arms-both-sides', 'yellow-safety-railings',
            'green-safety-walkway']


def factory_object(d, record, rect, footprint, phase, phases, contract_object=None, cell_id=0):
    seq = record['sequenceId']
    name = f"factory-{record['order']:02d}"
    if seq == 2:
        x, y, w, h = containment.source_window(record)
        anchor = conveyor_slice(d, name + '-belt', x, x + w, phase)
        if anchor is None:
            box(d, name + '-drip-tray', x + w / 2, y + h - 6, 3, 3, 0, .05, 'fx-steel-dark', 0)
            anchor = (x + w / 2, y + h - 6)
        return 'conveyor-slice', anchor
    if seq == 5:
        return 'belt-end-bin', conveyor_end(d, name + '-end', rect, phase)
    if seq == 0:
        return 'six-axis-arm', six_axis_arm(d, name + '-arm', rect, footprint, phase, phases)
    if seq == 1:
        return 'scara-arm', scara_arm(d, name + '-arm', rect, footprint, phase, phases)
    if seq == 3:
        return 'safety-bollard', safety_bollard(d, name + '-bollard', rect)
    return 'safety-railing', safety_railing(d, name + '-railing', rect)


# --------------------------------------------------------------------------- ward (cm17)

def surgical_table(d, name, cx, cy):
    box(d, name + '-foot', cx, cy, 3.6, 2.4, 0, .12, 'fx-steel', .010)
    cylinder(d, name + '-column', cx, cy, 1.5, .12, .80, 'fx-chrome', 18)
    box(d, name + '-frame', cx, cy, 12.5, 4.6, .78, .90, 'fx-steel', .008)
    box(d, name + '-pad', cx, cy, 12.0, 4.2, .90, 1.10, 'fx-pad-blue', .030)
    box(d, name + '-head-pad', cx - 9.0 * U[0], cy - 9.0 * U[1], 3.2, 3.6, 1.10, 1.22, 'fx-pad-dark', .025)
    box(d, name + '-seam', cx + 2.0 * U[0], cy + 2.0 * U[1], .35, 4.25, 1.06, 1.12, 'fx-pad-dark', 0)


def surgical_lamp(d, name, cx, cy, head):
    """Floor-standing surgical lamp: weighted base, column, arm and round head."""
    lathe(d, name + '-base', cx, cy, [(0, 4.2), (.10, 4.2), (.16, 2.0)], 'fx-steel-dark', 24)
    cylinder(d, name + '-column', cx, cy, .9, .16, 2.75, 'fx-white', 12)
    hx, hy, hz = head
    pipe(d, name + '-arm', [(cx, cy, 2.75), (cx + (hx - cx) * .5, cy + (hy - cy) * .5, 2.95), (hx, hy, hz + .30)],
         .10, 'fx-white')
    lathe(d, name + '-head', hx, hy, [(hz + .34, 1.4), (hz + .26, 6.2), (hz + .04, 7.6), (hz, 7.6)],
          'fx-white', 36)
    lathe(d, name + '-rim', hx, hy, [(hz - .02, 7.7), (hz + .05, 7.7), (hz + .05, 6.9), (hz - .02, 6.9)],
          'fx-lamp-glow', 36)
    lathe(d, name + '-lens', hx, hy, [(hz - .04, 6.8), (hz - .06, .4)], 'fx-lamp-glow', 36)


def anesthesia_tower(d, name, cx, cy):
    box(d, name + '-cart', cx, cy, 4.0, 3.2, 0, .95, 'fx-white', .015)
    face_panel(d, name + '-drawers', cx, cy, 4.0, 3.2, .12, .78, 'fx-panel', 'front-left', .12)
    box(d, name + '-shelf', cx, cy, 4.3, 3.5, .95, 1.02, 'fx-steel', .006)
    box(d, name + '-monitor', cx, cy, 3.4, 1.0, 1.02, 1.95, 'fx-charcoal', .010)
    face_panel(d, name + '-trace', cx, cy, 3.4, 1.0, 1.15, 1.85, 'fx-screen-green', 'front-left', .12)
    for i, mat in enumerate(('fx-gas-blue', 'fx-gas-white')):
        gx, gy = cx + 4.6 * U[0] + (i * 2.4 - 1.2) * V[0], cy + 4.6 * U[1] + (i * 2.4 - 1.2) * V[1]
        lathe(d, f'{name}-cylinder-{i}', gx, gy, [(0, 1.3), (1.10, 1.3), (1.22, .8), (1.30, .4)], mat, 16)


def instrument_stand(d, name, cx, cy):
    cylinder(d, name + '-foot', cx, cy, 2.4, 0, .06, 'fx-steel-dark', 16)
    cylinder(d, name + '-pole', cx, cy, .5, .06, .88, 'fx-chrome', 10)
    box(d, name + '-tray', cx, cy, 3.4, 2.2, .88, .94, 'fx-chrome', .006)
    for i in range(3):
        box(d, f'{name}-tool-{i}', cx - 1.4 + i * 1.4, cy - .3 + i * .5, 1.1, .25, .94, .97, 'fx-steel', 0)


def iv_stand(d, name, cx, cy):
    cylinder(d, name + '-foot', cx, cy, 2.2, 0, .05, 'fx-steel-dark', 16)
    cylinder(d, name + '-pole', cx, cy, .35, .05, 2.2, 'fx-chrome', 10)
    box(d, name + '-hook', cx, cy, 1.6, .3, 2.15, 2.22, 'fx-chrome', 0)
    lathe(d, name + '-bag', cx + 1.0, cy - .5, [(1.55, .3), (1.70, 1.0), (2.05, 1.0), (2.12, .4)],
          'fx-glass-frost', 12)


def vitals_monitor(d, name, rect, phase):
    """Short rolling vitals monitor; its screen trace alternates per cell."""
    x, y, w, h = rect
    cx, cy = x + w / 2, y + h - 3.0
    zt = max(.8, min(1.5, (h - 8.0) / lift(d, 1)))
    for i, (sa, sb) in enumerate(((-1, 0), (1, 0), (0, -1), (0, 1))):
        ball(d, f'{name}-castor-{i}', cx + sa * 1.6 * U[0] + sb * 1.6 * V[0],
             cy + sa * 1.6 * U[1] + sb * 1.6 * V[1], .05, .7, 'fx-rubber')
    cylinder(d, name + '-pole', cx, cy, .45, .08, zt * .72, 'fx-chrome', 10)
    box(d, name + '-case', cx, cy, 2.6, 1.0, zt * .72, zt, 'fx-white', .010)
    face_panel(d, name + '-screen', cx, cy, 2.6, 1.0, zt * .76, zt * .96,
               'fx-screen-green' if phase % 2 == 0 else 'fx-screen-amber', 'front-left', .12)
    return (cx, cy)


def cable_cover(d, name, rect):
    """Low rubber cable protector carrying the monitor feed along the floor."""
    x, y, w, h = rect
    span = min(w / 2 - 2, 14.0)
    cx, cy = x + w / 2, y + h - 2.0 - span * .25
    start = (cx - span * U[0], cy - span * U[1])
    end = (cx + span * U[0], cy + span * U[1])
    pts = [(start[0] - .8, start[1] + 1.6), (end[0] - .8, end[1] + 1.6), (end[0] + .8, end[1] - 1.6),
           (start[0] + .8, start[1] - 1.6)]
    prism(d, name + '-ramp', pts, 0, .06, 'fx-panel-dark', .010)
    pts = [(start[0] - .3, start[1] + .5), (end[0] - .3, end[1] + .5), (end[0] + .3, end[1] - .5),
           (start[0] + .3, start[1] - .5)]
    prism(d, name + '-stripe', pts, .06, .066, 'fx-panel', 0)
    return (cx, cy)


def sterilizer_bank(d, name, window, footprint, phase):
    """L-shaped bank of steel sterilizer cabinets following a hex's bottom corner."""
    depth = 6.5
    zt = 1.30
    vertex, left, right = corner_arms(footprint, window, 1.4, 1.8 + depth)
    corner_end = 1.6 + depth + .2
    anchors = []
    for side, (s0, s1) in (('left', left), ('right', right)):
        s1 = min(s1, 30.0)
        # Overlapping metallic volumes reflect each other's interiors as black;
        # the corner cabinet alone owns the corner cell.
        s0 = max(s0, corner_end)
        if s1 - s0 < 8:
            continue
        units = max(1, int((s1 - s0) // 9))
        step = (s1 - s0) / units
        for i in range(units):
            a0, a1 = s0 + i * step + .25, s0 + (i + 1) * step - .25
            c = edge_box(d, f'{name}-{side}-unit-{i}', vertex, side, a0, a1, 1.6, 1.6 + depth, .06, zt,
                         'fx-steel', .012)
            edge_box(d, f'{name}-{side}-door-{i}', vertex, side, a0 + .9, a1 - .9, 1.0, 1.6, .30, zt - .22,
                     'fx-glass-frost', .004)
            for k in range(2):
                lit = 'fx-led-green' if (i + k + phase) % 3 else 'fx-led-amber'
                edge_box(d, f'{name}-{side}-led-{i}-{k}', vertex, side, a0 + 1.0 + k * 2.0, a0 + 1.9 + k * 2.0,
                         1.2, 1.6, zt - .17, zt - .09, lit, 0)
            anchors.append(c)
        edge_box(d, f'{name}-{side}-plinth', vertex, side, s0, s1, 1.4, 1.8 + depth, 0, .06, 'fx-steel-dark', .006)
    if anchors:
        # The two arms meet at the corner; a corner cabinet closes the L.
        t0, t1 = 1.6, 1.6 + depth
        vx, vy = vertex
        corner = [(vx - a * U[0] + b * V[0], vy - a * U[1] + b * V[1])
                  for a, b in ((t0, t0), (t1, t0), (t1, t1), (t0, t1))]
        prism(d, name + '-corner-unit', corner, .06, zt, 'fx-steel', .012)
        prism(d, name + '-corner-plinth', corner, 0, .06, 'fx-steel-dark', .006)
        lx, ly = vx - (t0 + .6) * U[0] + (t0 + .6) * V[0], vy - (t0 + .6) * U[1] + (t0 + .6) * V[1]
        box(d, name + '-corner-led', lx, ly, .5, .5, zt - .02, zt + .03,
            'fx-led-green' if phase % 2 == 0 else 'fx-led-amber', 0)
    return anchors[0] if anchors else vertex


def service_port(d, name, rect):
    """Floor service port where the cabinet cables drop through."""
    x, y, w, h = rect
    r = min(w / 2 - 1.5, (h - 1.5) * 1.6, 9.0)
    cx, cy = x + w / 2, y + h - 1.0 - r / 2
    lathe(d, name + '-ring', cx, cy, [(0, r), (.05, r), (.06, r * .78)], 'fx-steel', 24)
    cylinder(d, name + '-well', cx, cy, r * .74, .0, .03, 'fx-charcoal', 24)
    for i in range(3):
        angle = 3.6 + i * .5
        pipe(d, f'{name}-cable-{i}', [(cx + math.cos(angle) * r * .4, cy + .5 * math.sin(angle) * r * .4, .03),
                                      (cx + math.cos(angle) * r * .9, cy + .5 * math.sin(angle) * r * .9, .05)],
             .045, ('fx-cable', 'fx-cable-red', 'fx-cable')[i])
    return (cx, cy)


def ward_core(d, footprint):
    """Operating theatre: table, lamp and anaesthesia tower in the upper bay."""
    surgical_table(d, 'ward-surgical-table', 92, 70)
    surgical_lamp(d, 'ward-surgical-lamp', 66, 56, (86, 66, 2.55))
    anesthesia_tower(d, 'ward-anaesthesia-tower', 121, 52)
    instrument_stand(d, 'ward-instrument-stand', 112, 86)
    iv_stand(d, 'ward-iv-stand', 64, 84)
    for sign in (-1, 1):
        cx, cy = 92 + sign * 7.6 * V[0], 70 + sign * 7.6 * V[1]
        box(d, f'ward-sterile-line-long-{sign}', cx, cy, 16.5, .45, 0, .008, 'fx-screen-cyan', 0)
        cx, cy = 92 + sign * 17.2 * U[0], 70 + sign * 17.2 * U[1]
        box(d, f'ward-sterile-line-short-{sign}', cx, cy, .45, 7.6, 0, .008, 'fx-screen-cyan', 0)
    box(d, 'ward-scrub-sink', 40, 128, 6.0, 2.4, 0, .82, 'fx-steel', .012)
    box(d, 'ward-scrub-basin', 40, 128, 5.0, 1.8, .70, .83, 'fx-charcoal', .006)
    cylinder(d, 'ward-scrub-tap', 40 + 2.0 * V[0], 128 + 2.0 * V[1], .3, .82, 1.15, 'fx-chrome', 8)
    return ['surgical-table-under-round-lamp', 'anaesthesia-tower', 'sterilizer-cabinet-banks']


def ward_object(d, record, rect, footprint, phase, phases, contract_object=None, cell_id=0):
    seq = record['sequenceId']
    name = f"ward-{record['order']:02d}"
    if seq == 0:
        return 'vitals-monitor', vitals_monitor(d, name + '-vitals', rect, phase)
    if seq == 1:
        return 'cable-cover', cable_cover(d, name + '-cable-cover', rect)
    if seq == 2:
        window = containment.source_window(record)
        return 'sterilizer-bank', sterilizer_bank(d, name + '-sterilizers', window, footprint, phase)
    return 'service-port', service_port(d, name + '-port', rect)


# --------------------------------------------------------------------------- entry point

CORES = {'field_cm06_01': lab_core, 'field_cm15_01': factory_core, 'field_cm17_01': ward_core}
OBJECTS = {'field_cm06_01': lab_object, 'field_cm15_01': factory_object, 'field_cm17_01': ward_object}


def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_FACILITY_FIELD:' + field_id)
    footprint = d.field_footprint(d.ROOT, field)
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = CORES[field_id](d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        decision = containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        role, anchor = OBJECTS[field_id](d, record, decision['window'], footprint, phase, phases,
                                         contract[record['order']], cell_id)
        containment.register_anchor(field_id, record['order'], anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = record['order']
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = record['sequenceId']
            obj['sourceCellId'] = cell_id
            obj['objectRole'] = role
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': record['sequenceId'],
                        'role': role, 'anchorNative': record['placement'],
                        'phase': phase, 'phases': phases})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
