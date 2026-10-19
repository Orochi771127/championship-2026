"""CM30 refinement pass (Owner 2026-10-19: find why it looks rough, fix the cause, no fake sharpening).

Causes found against the original and the reference stills:
  1. the ground was one flat beige tone: no grain, clods, pebbles, wear or grass edge;
  2. hedges were smooth green spheres (toy-like), no leaf structure;
  3. the court was flat paint with no surface texture or wear;
  4. nothing at ground level linked the court to the yard.
Fixes (same camera, footprint, walls, rim, court layout and props):
  * dirt material with grain, clods, worn darker patches, pebbles; soft grass verges along the
    hex border and corners (real blade tufts) and a few tufts in cracks;
  * every hedge sphere replaced by a bush of overlapping leaf cards around the same centre/size;
  * court paint with fine acrylic grain and faint wear; lines slightly chalky.
Generic for every cage master (refine_cage.py): the surface object is found by name, bushes by
material (sp-hedge*), grass placement by a downward ray (yard material -> sparse interior patches,
lawn material sp-grass -> soft blade carpet). Nothing is placed near the hex border.
args: <in.blend> <out.blend>
"""
import bpy, bmesh, math, random, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=args[0])
sc = bpy.context.scene
FIELD = next(o.name[:-len('-surface')] for o in sc.objects if o.name.endswith('-surface'))
rnd = random.Random(30)


def nodes_of(m):
    m.use_nodes = True
    return m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes.get('Principled BSDF')


def noise(nodes, links, geo, scale, detail=4.0, rough=.55, kind='ShaderNodeTexNoise'):
    n = nodes.new(kind); n.inputs['Scale'].default_value = scale
    if 'Detail' in n.inputs: n.inputs['Detail'].default_value = detail
    if 'Roughness' in n.inputs: n.inputs['Roughness'].default_value = rough
    links.new(geo.outputs['Position'], n.inputs['Vector']); return n


def ramp(nodes, links, fac, stops):
    r = nodes.new('ShaderNodeValToRGB'); e = r.color_ramp.elements
    e[0].position, e[0].color = stops[0][0], (*stops[0][1], 1); e[1].position, e[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]: x = e.new(p); x.color = (*c, 1)
    links.new(fac, r.inputs[0]); return r.outputs[0]


def mix(nodes, links, fac, a, b, blend='MIX'):
    m = nodes.new('ShaderNodeMixRGB'); m.blend_type = blend
    if isinstance(fac, float): m.inputs[0].default_value = fac
    else: links.new(fac, m.inputs[0])
    for i, v in ((1, a), (2, b)):
        if isinstance(v, tuple): m.inputs[i].default_value = (*v, 1)
        else: links.new(v, m.inputs[i])
    return m.outputs[0]


# 1. dirt yard
ground = bpy.data.materials['sp-ground']
nodes, links, b = nodes_of(ground)
geo = nodes.new('ShaderNodeNewGeometry')
base = ramp(nodes, links, noise(nodes, links, geo, 1.2, 4).outputs['Fac'], [(.3, (.43, .33, .23)), (.55, (.51, .40, .28)), (.8, (.58, .47, .34))])
grain = noise(nodes, links, geo, 38.0, 3)
base = mix(nodes, links, .45, base, grain.outputs['Fac'], 'OVERLAY')
clod = noise(nodes, links, geo, 9.0, kind='ShaderNodeTexVoronoi')
base = mix(nodes, links, .42, base, ramp(nodes, links, clod.outputs['Distance'], [(.0, (.70, .58, .43)), (.5, (.34, .26, .17))]), 'OVERLAY')
wear = ramp(nodes, links, noise(nodes, links, geo, .9, 5, .6).outputs['Fac'], [(.58, (0, 0, 0)), (.70, (.35, .35, .35))])
base = mix(nodes, links, wear, base, (.36, .27, .18))
peb = noise(nodes, links, geo, 22.0, kind='ShaderNodeTexVoronoi')
base = mix(nodes, links, ramp(nodes, links, peb.outputs['Distance'], [(.06, (1, 1, 1)), (.12, (0, 0, 0))]), base, (.70, .66, .58))
links.new(base, b.inputs['Base Color'])
bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .4; bump.inputs['Distance'].default_value = .01
links.new(grain.outputs['Fac'], bump.inputs['Height']); links.new(bump.outputs[0], b.inputs['Normal'])
b.inputs['Roughness'].default_value = .95

# 3. court paint grain and wear
for name, wearc in (('bb-court-teal', (.10, .46, .46)), ('bb-court-key', (.76, .38, .24)), ('bb-court-line', (.86, .84, .76))):
    m = bpy.data.materials.get(name)
    if not m: continue
    nodes, links, b = nodes_of(m)
    geo = nodes.new('ShaderNodeNewGeometry')
    col = b.inputs['Base Color'].default_value[:3]
    g2 = noise(nodes, links, geo, 60.0, 2)
    c = mix(nodes, links, .14, tuple(col), g2.outputs['Fac'], 'OVERLAY')
    w = ramp(nodes, links, noise(nodes, links, geo, 2.2, 5, .6).outputs['Fac'], [(.62, (0, 0, 0)), (.75, (.55, .55, .55))])
    c = mix(nodes, links, w, c, wearc)
    links.new(c, b.inputs['Base Color'])

# 2. leaf-card bushes in place of the hedge spheres
leaf = bpy.data.materials.new('rf-cage-leaf'); nodes, links, b = nodes_of(leaf)
oi = nodes.new('ShaderNodeObjectInfo'); tc = nodes.new('ShaderNodeTexCoord')
sep = nodes.new('ShaderNodeSeparateXYZ'); links.new(tc.outputs['Object'], sep.inputs[0])
hgt = nodes.new('ShaderNodeMapRange'); hgt.inputs['From Min'].default_value = -.4; hgt.inputs['From Max'].default_value = .5
links.new(sep.outputs['Z'], hgt.inputs['Value'])
lc = ramp(nodes, links, hgt.outputs['Result'], [(.0, (.025, .11, .035)), (.5, (.08, .27, .07)), (1.0, (.20, .44, .11))])
lc = mix(nodes, links, .25, lc, ramp(nodes, links, oi.outputs['Random'], [(.0, (.4, .5, .3)), (1.0, (.6, .5, .5))]), 'OVERLAY')
links.new(lc, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .65
if 'Subsurface Weight' in b.inputs: b.inputs['Subsurface Weight'].default_value = .2
replaced = 0
zmin_ground = 0.0
bush_centres = []
for o in list(sc.objects):
    if o.type != 'MESH' or not any(m and m.name.startswith('sp-hedge') for m in o.data.materials): continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    c = sum(bb, Vector()) / 8; rx = (max(v.x for v in bb) - min(v.x for v in bb)) / 2
    bush_centres.append((c.x, c.y))
    ry = (max(v.y for v in bb) - min(v.y for v in bb)) / 2; rz = (max(v.z for v in bb) - min(v.z for v in bb)) / 2
    me = bpy.data.meshes.new(o.name + '-leaves'); bm = bmesh.new()
    # an irregular shrub clump: 3-5 lobes of different sizes, spreading low, plus sprigs at the base
    lobes = [(0.0, 0.0, 1.0)] + [(rnd.uniform(-1, 1) * rx * .9, rnd.uniform(-1, 1) * ry * .9, rnd.uniform(.5, .85)) for _ in range(rnd.randint(2, 4))]
    for lx, ly, ls in lobes:
        lc0 = Vector((c.x + lx, c.y + ly, c.z - rz * .35 + rz * .7 * ls))
        lr = (rx * .72 * ls, ry * .72 * ls, rz * .78 * ls)
        for k in range(int(170 * ls * ls) + 40):
            u, v = rnd.uniform(0, math.tau), math.acos(rnd.uniform(-.25, 1))
            rr = rnd.uniform(.6, 1.05)
            p = Vector((lc0.x + lr[0] * rr * math.sin(v) * math.cos(u), lc0.y + lr[1] * rr * math.sin(v) * math.sin(u), lc0.z + lr[2] * rr * math.cos(v)))
            if p.z < zmin_ground + .01: continue
            nrm = (p - Vector((lc0.x, lc0.y, lc0.z - lr[2] * .5))).normalized()
            t1 = nrm.orthogonal().normalized(); t2 = nrm.cross(t1)
            s_ = rnd.uniform(.04, .07)
            a = rnd.uniform(0, math.tau); d1 = t1 * math.cos(a) + t2 * math.sin(a); d2 = nrm.cross(d1)
            vs = [bm.verts.new(p + d1 * s_ * 1.7), bm.verts.new(p + d2 * s_ * .7), bm.verts.new(p - d1 * s_ * .4), bm.verts.new(p - d2 * s_ * .7)]
            bm.faces.new(vs)
    for k in range(18):   # sprigs reaching out at the base
        a = rnd.uniform(0, math.tau); L = rnd.uniform(1.0, 1.5)
        p = Vector((c.x + math.cos(a) * rx * L, c.y + math.sin(a) * ry * L, zmin_ground + rnd.uniform(.02, .10)))
        d1 = Vector((math.cos(a), math.sin(a), .25)).normalized(); d2 = Vector((-math.sin(a), math.cos(a), 0)) * .03
        vs = [bm.verts.new(p - d1 * .03), bm.verts.new(p + d2), bm.verts.new(p + d1 * .09), bm.verts.new(p - d2)]
        bm.faces.new(vs)
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    nb = bpy.data.objects.new(o.name + '-leaves', me); sc.collection.objects.link(nb); me.materials.append(leaf)
    for k in o.keys(): nb[k] = o[k]
    # a dark core keeps light from showing through
    o.scale = o.scale * .62; o.data.materials.clear(); o.data.materials.append(bpy.data.materials.get('sp-hedge') or leaf)
    replaced += 1

# 1b. grass verges along the border and tufts in cracks (real blades)
surface = bpy.data.objects[f'{FIELD}-surface']
top = [surface.matrix_world @ v.co for v in surface.data.vertices]
zmax = max(v.z for v in top); ring = [v for v in top if abs(v.z - zmax) < 1e-4]
cx = sum(v.x for v in ring) / len(ring); cy = sum(v.y for v in ring) / len(ring)
# real outline: boundary edges of the surface's top face(s) (concave three-lobe cages too)
me_s = surface.data
edge_faces = {}
for poly in me_s.polygons:
    vs = list(poly.vertices)
    if min(surface.matrix_world @ me_s.vertices[i].co for i in vs).z if False else False: pass
    for a, b in zip(vs, vs[1:] + vs[:1]):
        k = (min(a, b), max(a, b)); edge_faces[k] = edge_faces.get(k, 0) + 1
segs = []
for (a, b), n in edge_faces.items():
    pa, pb = surface.matrix_world @ me_s.vertices[a].co, surface.matrix_world @ me_s.vertices[b].co
    if n == 1 and abs(pa.z - zmax) < 1e-3 and abs(pb.z - zmax) < 1e-3: segs.append((pa.x, pa.y, pb.x, pb.y))
def edge_dist(x, y):
    best = 9.0
    for x0, y0, x1, y1 in segs:
        ex, ey = x1 - x0, y1 - y0; L2 = ex * ex + ey * ey or 1e-9
        u = max(0.0, min(1.0, ((x - x0) * ex + (y - y0) * ey) / L2))
        best = min(best, math.hypot(x - (x0 + u * ex), y - (y0 + u * ey)))
    return best
xs = [v.x for v in ring]; ys = [v.y for v in ring]
_lat = {}
def vnoise(x, y, f=2.2, seed=7):
    x, y = x * f, y * f; x0, y0 = math.floor(x), math.floor(y)
    def r(i, j):
        k = (i, j, seed)
        if k not in _lat: _lat[k] = random.Random(hash(k) & 0xffffffff).random()
        return _lat[k]
    tx, ty = x - x0, y - y0; tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a = r(x0, y0) * (1 - tx) + r(x0 + 1, y0) * tx; b = r(x0, y0 + 1) * (1 - tx) + r(x0 + 1, y0 + 1) * tx
    return a * (1 - ty) + b * ty
dg = bpy.context.evaluated_depsgraph_get()
ground_mat = surface.data.materials[0].name if surface.data.materials else 'sp-ground'
def hit_material(x, y):
    ok, loc, nrm, idx, ob, mtx = sc.ray_cast(dg, Vector((x, y, zmax + 5)), Vector((0, 0, -1)))
    if not ok or ob is None or ob.type != 'MESH' or loc.z > zmax + .05: return None
    mats = ob.data.materials
    if not mats: return None
    poly = ob.data.polygons[idx] if idx < len(ob.data.polygons) else None
    return mats[poly.material_index if poly else 0].name if mats[0] else None
def on_court(x, y):
    return hit_material(x, y) not in (ground_mat, 'sp-grass')
gm = {}
for name, col in (('rf-cage-grass-1', (.16, .40, .10)), ('rf-cage-grass-2', (.26, .50, .12)), ('rf-cage-grass-3', (.36, .58, .16))):
    m = bpy.data.materials.new(name); _, _, bb_ = nodes_of(m); bb_.inputs['Base Color'].default_value = (*col, 1); bb_.inputs['Roughness'].default_value = .7
    gm[name] = m
meshes = {k: ([], []) for k in gm}
count = 0
step = .035
xg = min(xs)
while xg < max(xs):
    yg = min(ys)
    while yg < max(ys):
        x, y = xg + rnd.uniform(-.015, .015), yg + rnd.uniform(-.015, .015)
        yg += step
        dd = edge_dist(x, y)
        if dd < .03 or on_court(x, y): continue
        # no grass along the hex border (joined cages must read as one ground): grass only in small
        # interior patches and around shrub bases, fading out well before the edge
        hm = hit_material(x, y)
        if hm is None: continue
        if dd < (.08 if hm == 'sp-grass' else .70): continue
        if hm == 'sp-grass':
            count += 1
            for bl in range(rnd.randint(3, 4)):
                mname = list(gm)[1 + rnd.randrange(2)]; verts, faces = meshes[mname]
                ox, oy = rnd.uniform(-.02, .02), rnd.uniform(-.02, .02); hgt_ = rnd.uniform(.03, .06)
                w = rnd.uniform(.007, .011); lx, ly = rnd.uniform(-.02, .02), rnd.uniform(-.02, .02)
                i = len(verts)
                verts += [(x + ox - w, y + oy + w, zmax + .012), (x + ox + w, y + oy - w, zmax + .012), (x + ox + lx, y + oy + ly, zmax + .012 + hgt_)]
                faces.append((i, i + 1, i + 2))
            continue
        patch = vnoise(x, y) * .7 + vnoise(x, y, 6.0, 9) * .3
        near_bush = min((math.hypot(x - bx, y - by) for bx, by in bush_centres), default=9)
        p_in = 1.0 if near_bush < .30 else (.8 if patch > .80 else 0.0)
        p_in *= min(1.0, (dd - .70) / .25)
        if rnd.random() > p_in: continue
        count += 1
        for bl in range(rnd.randint(3, 5)):
            mname = list(gm)[rnd.randrange(3)]; verts, faces = meshes[mname]
            ox, oy = rnd.uniform(-.02, .02), rnd.uniform(-.02, .02); hgt_ = rnd.uniform(.05, .12) * (.6 + .4 * p_in)
            w = rnd.uniform(.008, .013); lx, ly = rnd.uniform(-.03, .03), rnd.uniform(-.03, .03)
            i = len(verts)
            verts += [(x + ox - w, y + oy + w, zmax), (x + ox + w, y + oy - w, zmax), (x + ox + lx, y + oy + ly, zmax + hgt_)]
            faces.append((i, i + 1, i + 2))
    xg += step
for name, (verts, faces) in meshes.items():
    if not faces: continue
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); me.materials.append(gm[name])
    ob['cageLayer'] = 'base'; ob['cageFieldId'] = FIELD
print('CAGE_REFINE', FIELD, 'bushes', replaced, 'grass tufts', count)
bpy.ops.wm.save_as_mainfile(filepath=args[1])
