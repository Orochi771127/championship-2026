"""Shared world-style kit for cages (Owner 2026-10-19: one bright, lived-in world style, the same as
the refined hunt maps). Native px coordinates of the cage frame (x right, y down), heights in
Blender units, same projection as build-cage-base3d's world().

Pieces: hunt lawn (material + dense soft blades), mown turf with stripes, park paving, sand pit,
leaf-card trees and shrub clumps, low flower beds, bench, drinking fountain, two-step bleacher.
Every piece is our own procedural geometry; nothing is traced.
"""
import bpy, bmesh, math, random
from mathutils import Vector

S = math.sin(math.radians(52))
U = 16 * math.sqrt(2)


def W(x, y, z=0.0):
    return Vector(((x + y / S) / U, (x - y / S) / U, z))


def nat(v):
    k = U / 2
    return ((v.x + v.y) * k, (v.x - v.y) * k * S)


# --------------------------------------------------------------------------- materials

def _bsdf(m):
    m.use_nodes = True
    return m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes.get('Principled BSDF')


def _noise(nodes, links, geo, scale, detail=4.0, rough=.55, kind='ShaderNodeTexNoise'):
    n = nodes.new(kind); n.inputs['Scale'].default_value = scale
    if 'Detail' in n.inputs: n.inputs['Detail'].default_value = detail
    if 'Roughness' in n.inputs: n.inputs['Roughness'].default_value = rough
    links.new(geo.outputs['Position'], n.inputs['Vector']); return n


def _ramp(nodes, links, fac, stops):
    r = nodes.new('ShaderNodeValToRGB'); e = r.color_ramp.elements
    e[0].position, e[0].color = stops[0][0], (*stops[0][1], 1); e[1].position, e[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]: x = e.new(p); x.color = (*c, 1)
    links.new(fac, r.inputs[0]); return r.outputs[0]


def _mix(nodes, links, fac, a, b, blend='MIX'):
    m = nodes.new('ShaderNodeMixRGB'); m.blend_type = blend
    if isinstance(fac, float): m.inputs[0].default_value = fac
    else: links.new(fac, m.inputs[0])
    for i, v in ((1, a), (2, b)):
        if isinstance(v, tuple): m.inputs[i].default_value = (*v, 1)
        else: links.new(v, m.inputs[i])
    return m.outputs[0]


def mat(name, col, rough=.6, metal=0.0, emit=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nodes, links, b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*col, 1)
    return m


def lawn_material(m):
    """The hunt lawn ground: soft yellow-green with gentle drift and fine texture (world space)."""
    nodes, links, b = _bsdf(m)
    for n in list(nodes):
        if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'): nodes.remove(n)
    geo = nodes.new('ShaderNodeNewGeometry')
    base = _ramp(nodes, links, _noise(nodes, links, geo, .8, 3, .5).outputs['Fac'], [(.25, (.22, .45, .10)), (.5, (.27, .50, .11)), (.8, (.34, .55, .12))])
    base = _mix(nodes, links, .12, base, _noise(nodes, links, geo, 60.0, 2, .4).outputs['Fac'], 'OVERLAY')
    links.new(base, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .9; b.inputs['Metallic'].default_value = 0
    return m


def turf_material(name, axis_deg, stripe=.55):
    """Mown pitch turf: alternating light/dark mowing stripes along an axis."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nodes, links, b = _bsdf(m)
    geo = nodes.new('ShaderNodeNewGeometry')
    mp = nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, math.radians(axis_deg))
    links.new(geo.outputs['Position'], mp.inputs['Vector'])
    sep = nodes.new('ShaderNodeSeparateXYZ'); links.new(mp.outputs[0], sep.inputs[0])
    wave = nodes.new('ShaderNodeMath'); wave.operation = 'SINE'
    mul = nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = math.pi / stripe
    links.new(sep.outputs['X'], mul.inputs[0]); links.new(mul.outputs[0], wave.inputs[0])
    band = _ramp(nodes, links, wave.outputs[0], [(.45, (.20, .44, .10)), (.55, (.27, .52, .12))])
    band = _mix(nodes, links, .10, band, _noise(nodes, links, geo, 50.0, 2).outputs['Fac'], 'OVERLAY')
    links.new(band, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .85
    return m


def paving_material(name):
    """Light warm park paving: small irregular stones with soft joints (no global grid -> seam-free)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nodes, links, b = _bsdf(m)
    geo = nodes.new('ShaderNodeNewGeometry')
    v = _noise(nodes, links, geo, 7.0, kind='ShaderNodeTexVoronoi'); v.feature = 'DISTANCE_TO_EDGE'
    stones = _ramp(nodes, links, v.outputs['Distance'], [(.0, (.40, .37, .32)), (.05, (.66, .62, .55)), (.3, (.72, .68, .60))])
    vc = _noise(nodes, links, geo, 7.0, kind='ShaderNodeTexVoronoi')
    stones = _mix(nodes, links, .18, stones, vc.outputs['Color'], 'OVERLAY')
    links.new(stones, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .8
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .5; bump.inputs['Distance'].default_value = .01
    links.new(v.outputs['Distance'], bump.inputs['Height']); links.new(bump.outputs[0], b.inputs['Normal'])
    return m


def sand_material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nodes, links, b = _bsdf(m)
    geo = nodes.new('ShaderNodeNewGeometry')
    c = _ramp(nodes, links, _noise(nodes, links, geo, 30.0, 4).outputs['Fac'], [(.3, (.86, .74, .52)), (.7, (.94, .84, .62))])
    links.new(c, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .95
    return m


def leaf_material(name='kit-leaf', dark=(.025, .11, .035), mid=(.08, .27, .07), light=(.22, .46, .12)):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); nodes, links, b = _bsdf(m)
    oi = nodes.new('ShaderNodeObjectInfo'); tc = nodes.new('ShaderNodeTexCoord')
    sep = nodes.new('ShaderNodeSeparateXYZ'); links.new(tc.outputs['Object'], sep.inputs[0])
    h = nodes.new('ShaderNodeMapRange'); h.inputs['From Min'].default_value = -.5; h.inputs['From Max'].default_value = .6
    links.new(sep.outputs['Z'], h.inputs['Value'])
    lc = _ramp(nodes, links, h.outputs['Result'], [(.0, dark), (.5, mid), (1.0, light)])
    lc = _mix(nodes, links, .22, lc, _ramp(nodes, links, oi.outputs['Random'], [(.0, (.42, .5, .3)), (1.0, (.6, .5, .5))]), 'OVERLAY')
    links.new(lc, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .65
    if 'Subsurface Weight' in b.inputs: b.inputs['Subsurface Weight'].default_value = .2
    return m


# --------------------------------------------------------------------------- geometry helpers

def obj_from(name, verts, faces, material, layer='base', field=None, role=None, smooth=False):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); me.materials.append(material)
    o['cageLayer'] = layer
    if field: o['cageFieldId'] = field
    if role: o['objectRole'] = role
    return o


def slab(name, poly_native, z0, z1, material, field=None, role=None):
    """A thin pad over a native-px polygon (ground decals: turf, paving, sand)."""
    bm = bmesh.new()
    bot = [bm.verts.new(W(x, y, z0)) for x, y in poly_native]; top = [bm.verts.new(W(x, y, z1)) for x, y in poly_native]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    n = len(poly_native)
    for i in range(n): bm.faces.new((bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]))
    bm.normal_update(); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); me.materials.append(material)
    o['cageLayer'] = 'base'
    if field: o['cageFieldId'] = field
    if role: o['objectRole'] = role
    return o


def rounded_rect(cx, cy, w, h, r, n=5):
    pts = []
    for (qx, qy, a0) in ((cx + w / 2 - r, cy - h / 2 + r, -90), (cx + w / 2 - r, cy + h / 2 - r, 0), (cx - w / 2 + r, cy + h / 2 - r, 90), (cx - w / 2 + r, cy - h / 2 + r, 180)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n); pts.append((qx + r * math.cos(a), qy + r * math.sin(a)))
    return pts


def ellipse(cx, cy, rx, ry, n=28, wob=0.0, seed=0):
    rnd = random.Random(seed)
    return [(cx + rx * (1 + wob * rnd.uniform(-1, 1)) * math.cos(a), cy + ry * (1 + wob * rnd.uniform(-1, 1)) * math.sin(a))
            for a in (k * math.tau / n for k in range(n))]


def blades(name, pts_native, z, tints, n=(3, 5), h=(.04, .08), w=(.006, .010), lean=.02, seed=1, field=None):
    """Soft lawn blades (same look as the hunt lawn) at native points."""
    rnd = random.Random(seed)
    buckets = {t: ([], []) for t in tints}
    for (x, y) in pts_native:
        p = W(x, y, z)
        for _ in range(rnd.randint(*n)):
            t = tints[rnd.randrange(len(tints))]; verts, faces = buckets[t]
            ox, oy = rnd.uniform(-.018, .018), rnd.uniform(-.018, .018); hh = rnd.uniform(*h); ww = rnd.uniform(*w)
            lx, ly = rnd.uniform(-lean, lean), rnd.uniform(-lean, lean)
            i = len(verts)
            verts += [(p.x + ox - ww, p.y + oy + ww, z), (p.x + ox + ww, p.y + oy - ww, z), (p.x + ox + lx, p.y + oy + ly, z + hh)]
            faces.append((i, i + 1, i + 2))
    for t, (verts, faces) in buckets.items():
        if faces: obj_from(f'{name}-{t}', verts, faces, mat(t, KIT_TINTS[t], .75), field=field, role='lawn')


KIT_TINTS = {'kit-lawn-1': (.23, .46, .10), 'kit-lawn-2': (.27, .505, .11), 'kit-lawn-3': (.30, .53, .12),
             'kit-turf-1': (.20, .44, .10), 'kit-turf-2': (.25, .50, .12)}


def leaf_ball(bm, centre, radii, count, rnd, size=(.04, .07), floor=None):
    for _ in range(count):
        u, v = rnd.uniform(0, math.tau), math.acos(rnd.uniform(-.25, 1))
        rr = rnd.uniform(.6, 1.05)
        p = Vector((centre.x + radii[0] * rr * math.sin(v) * math.cos(u), centre.y + radii[1] * rr * math.sin(v) * math.sin(u),
                    centre.z + radii[2] * rr * math.cos(v)))
        if floor is not None and p.z < floor: continue
        nrm = (p - Vector((centre.x, centre.y, centre.z - radii[2] * .5))).normalized()
        t1 = nrm.orthogonal().normalized(); t2 = nrm.cross(t1)
        s = rnd.uniform(*size); a = rnd.uniform(0, math.tau); d1 = t1 * math.cos(a) + t2 * math.sin(a); d2 = nrm.cross(d1)
        bm.faces.new([bm.verts.new(p + d1 * s * 1.7), bm.verts.new(p + d2 * s * .7), bm.verts.new(p - d1 * s * .4), bm.verts.new(p - d2 * s * .7)])


def shrub(name, x, y, r_native, h_units, seed, field=None):
    """A spreading shrub clump of 3-5 lobes (same language as the refined CM30 shrubs)."""
    rnd = random.Random(seed); c = W(x, y, 0.0); r = r_native / U * 1.4
    bm = bmesh.new()
    lobes = [(0, 0, 1.0)] + [(rnd.uniform(-1, 1) * r * .8, rnd.uniform(-1, 1) * r * .8, rnd.uniform(.55, .85)) for _ in range(rnd.randint(2, 4))]
    for lx, ly, ls in lobes:
        leaf_ball(bm, Vector((c.x + lx, c.y + ly, h_units * .45 * ls)), (r * .7 * ls, r * .7 * ls, h_units * .55 * ls), int(160 * ls * ls) + 40, rnd, floor=.01)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); me.materials.append(leaf_material())
    o['cageLayer'] = 'decor'; o['objectRole'] = 'shrub'
    if field: o['cageFieldId'] = field
    return o


def tree(name, x, y, height, crown_native, seed, field=None):
    """A park tree: tapered trunk with two branches and a layered leaf-card crown of 4-6 lobes."""
    rnd = random.Random(seed); base = W(x, y, 0.0)
    bark = mat('kit-bark', (.34, .22, .13), .85)
    trunk_h = height * .45
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=.09, radius2=.055, depth=trunk_h, location=(base.x, base.y, trunk_h / 2))
    t = bpy.context.object; t.name = name + '-trunk'; t.data.materials.append(bark)
    for p in t.data.polygons: p.use_smooth = True
    t['cageLayer'] = 'decor'; t['objectRole'] = 'tree'
    if field: t['cageFieldId'] = field
    r = crown_native / U * 1.4
    bm = bmesh.new()
    lobes = [(0, 0, trunk_h + r * .55, 1.0)] + [(rnd.uniform(-1, 1) * r * .6, rnd.uniform(-1, 1) * r * .6, trunk_h + rnd.uniform(.2, .9) * r, rnd.uniform(.6, .85))
                                                for _ in range(rnd.randint(3, 5))]
    for lx, ly, lz, ls in lobes:
        leaf_ball(bm, Vector((base.x + lx, base.y + ly, lz)), (r * .62 * ls, r * .62 * ls, r * .5 * ls), int(260 * ls * ls) + 60, rnd, size=(.05, .085))
    me = bpy.data.meshes.new(name + '-crown'); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name + '-crown', me); bpy.context.scene.collection.objects.link(o); me.materials.append(leaf_material())
    o['cageLayer'] = 'decor'; o['objectRole'] = 'tree-crown'
    if field: o['cageFieldId'] = field
    return t, o


def flower_bed(name, poly_native, seed, field=None, colours=((1.0, .52, .62), (1.0, .88, .32), (.98, .98, .95))):
    """Low planted bed: a soil kerb, leafy ground cover and small flowers in drifts."""
    rnd = random.Random(seed)
    slab(name + '-soil', poly_native, -.01, .03, mat('kit-soil', (.30, .21, .13), .95), field, 'flower-bed')
    xs = [p[0] for p in poly_native]; ys = [p[1] for p in poly_native]
    bm = bmesh.new(); fl = {c: bmesh.new() for c in colours}
    def inside(x, y):
        c = False; n = len(poly_native)
        for i in range(n):
            (x0, y0), (x1, y1) = poly_native[i], poly_native[(i + 1) % n]
            if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0: c = not c
        return c
    for _ in range(int((max(xs) - min(xs)) * (max(ys) - min(ys)) * .9)):
        x, y = rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys))
        if not inside(x, y): continue
        p = W(x, y, .05)
        leaf_ball(bm, p, (.05, .05, .04), 6, rnd, size=(.025, .04), floor=.03)
        if rnd.random() < .6:
            c = colours[int((x * .07 + y * .05)) % len(colours)]
            leaf_ball(fl[c], W(x, y, .11 + rnd.uniform(0, .04)), (.025, .025, .012), 4, rnd, size=(.016, .026))
    for nm, b_, m in [(name + '-cover', bm, leaf_material())] + [(f'{name}-flowers-{k}', fl[c], mat(f'kit-flower-{k}', c, .6)) for k, c in enumerate(colours)]:
        me = bpy.data.meshes.new(nm); b_.to_mesh(me); b_.free()
        o = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(o); me.materials.append(m)
        o['cageLayer'] = 'decor'; o['objectRole'] = 'flower-bed'
        if field: o['cageFieldId'] = field


def box(name, centre, size, material, rot=0.0, layer='decor', role=None, field=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    o = bpy.context.object; o.name = name; o.scale = size; o.rotation_euler[2] = rot; o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 2
    o['cageLayer'] = layer
    if role: o['objectRole'] = role
    if field: o['cageFieldId'] = field
    return o


def screen_dirs():
    """World-space unit vectors for screen-right and screen-down (into the picture's depth)."""
    o = W(0, 0); r = (W(10, 0) - o).normalized(); d = (W(0, 10) - o).normalized()
    return r, d


def bench(name, x, y, length_native, seed, field=None, facing='down'):
    """Park bench along screen-horizontal, seat facing the camera (or away)."""
    r, d = screen_dirs(); c = W(x, y, 0.0); L = length_native / U * 1.4
    wood = mat('kit-bench-wood', (.62, .42, .24), .65); iron = mat('kit-iron', (.16, .17, .18), .4, .6)
    rot = math.atan2(r.y, r.x)
    objs = []
    for k in range(3):
        objs.append(box(f'{name}-seat{k}', c + d * (k - 1) * .07 + Vector((0, 0, .40)), (L, .055, .035), wood, rot, role='bench', field=field, bevel=.008))
    sgn = -1 if facing == 'down' else 1
    for k in range(2):
        objs.append(box(f'{name}-back{k}', c + d * .13 * sgn + Vector((0, 0, .55 + k * .14)), (L, .03, .07), wood, rot, role='bench', field=field, bevel=.008))
    for s in (-1, 1):
        objs.append(box(f'{name}-leg{s}', c + r * s * L * .42 + Vector((0, 0, .2)), (.04, .26, .4), iron, rot, role='bench', field=field))
    return objs


def fountain(name, x, y, field=None):
    c = W(x, y, 0.0)
    stone = mat('kit-fountain-stone', (.78, .76, .72), .5); steel = mat('kit-steel', (.70, .72, .74), .25, .9)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=.085, depth=.8, location=(c.x, c.y, .4))
    p = bpy.context.object; p.name = name + '-post'; p.data.materials.append(stone); p['cageLayer'] = 'decor'; p['objectRole'] = 'fountain'
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=.15, depth=.06, location=(c.x, c.y, .82))
    bwl = bpy.context.object; bwl.name = name + '-bowl'; bwl.data.materials.append(steel); bwl['cageLayer'] = 'decor'; bwl['objectRole'] = 'fountain'
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.13, depth=.04, location=(c.x, c.y, .02))
    f = bpy.context.object; f.name = name + '-foot'; f.data.materials.append(stone); f['cageLayer'] = 'decor'; f['objectRole'] = 'fountain'
    for o in (p, bwl, f):
        for poly in o.data.polygons: poly.use_smooth = True
        if field: o['cageFieldId'] = field
    return p, bwl, f


def bleacher(name, x, y, length_native, field=None, rows=2):
    """Small aluminium bleacher along screen-horizontal; seats step up away from the camera."""
    r, d = screen_dirs(); c = W(x, y, 0.0); L = length_native / U * 1.4
    alu = mat('kit-alu', (.78, .80, .82), .3, .85); seat = mat('kit-bleacher-seat', (.20, .46, .78), .45)
    frame = mat('kit-iron', (.16, .17, .18), .4, .6); rot = math.atan2(r.y, r.x)
    for k in range(rows):
        z = .32 + k * .3
        box(f'{name}-seat{k}', c - d * k * .24 + Vector((0, 0, z)), (L, .2, .05), seat, rot, role='bleacher', field=field, bevel=.01)
        box(f'{name}-foot{k}', c - d * k * .24 - d * .05 + Vector((0, 0, z - .16)), (L, .06, .03), alu, rot, role='bleacher', field=field)
    for s in (-1, -.33, .33, 1):
        h = .32 + (rows - 1) * .3
        box(f'{name}-frame{s}', c + r * s * L * .46 - d * (rows - 1) * .12 + Vector((0, 0, h / 2)), (.035, .24 * rows, h), frame, rot, role='bleacher', field=field)
