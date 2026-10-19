"""CM30 small sports ground -> basketball court (Owner 2026-10-19: CM02 keeps the running track,
CM30 becomes basketball so the pair complements instead of repeating a track).

Opens the reviewed CM30 master, keeps the foundation, surface, side fascia, porcelain joints,
rim light, hedges, camera and light untouched (footprint, thickness and frame stay identical),
removes only the mini track/infield/lanes/start line/hurdle, and builds inside the hex:
  teal court with terracotta keys and cream lines (boundary, centre line and circle,
  free-throw circles, three-point arcs), two hoops (post, backboard, orange rim, cord net as
  separate objects tagged cageLayer=decor / objectRole=hoop-net for later motion), a wooden
  bench and a ball cart at the court side.
args: <master.blend> <out.blend>
"""
import bpy, bmesh, math, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[0], args[1]
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene
FIELD = 'field_cm30_01'

REMOVE = ('mini-track', 'mini-infield', 'mini-lane', 'mini-start-line', 'ath30-00-hurdle')
for o in list(sc.objects):
    if o.name.startswith(REMOVE):
        bpy.data.objects.remove(o, do_unlink=True)

surface = bpy.data.objects[f'{FIELD}-surface']
top = [surface.matrix_world @ v.co for v in surface.data.vertices]
zmax = max(v.z for v in top)
ring = [v for v in top if abs(v.z - zmax) < 1e-4]
cx = sum(v.x for v in ring) / len(ring); cy = sum(v.y for v in ring) / len(ring)


def inside(x, y, margin):
    """Point inside the surface's convex top outline with a margin (world units)."""
    pts = sorted(ring, key=lambda v: math.atan2(v.y - cy, v.x - cx))
    hull = []
    for p in pts:
        hull.append((p.x, p.y))
    n = len(hull)
    for i in range(n):
        (x0, y0), (x1, y1) = hull[i], hull[(i + 1) % n]
        ex, ey = x1 - x0, y1 - y0
        L = math.hypot(ex, ey)
        if L < 1e-6: continue
        cross = (ex * (y - y0) - ey * (x - x0)) / L
        if cross < margin: return False
    return True


# The court's long axis runs along screen-horizontal (world (1, 1)): both hoops then stand at
# the hex's left/right sides, low on screen, inside the cage silhouette.
TH = math.radians(float(__import__("os").environ.get("CM30_TH", "24")))
def rot(x, y):
    dx, dy = x - cx, y - cy
    return cx + dx * math.cos(TH) - dy * math.sin(TH), cy + dx * math.sin(TH) + dy * math.cos(TH)
# largest court (aspect 28:15) centred on the hex that keeps a margin to every edge
best = None
for k in range(400, 40, -2):
    L = k / 100.0; W = L * 15 / 28
    corners = [(cx + sx * L / 2, cy + sy * W / 2) for sx in (-1, 1) for sy in (-1, 1)]
    # also leave room for the hoop posts behind each baseline
    posts = [(cx + sx * (L / 2 + .32), cy) for sx in (-1, 1)]
    if all(inside(*rot(x, y), .30) for x, y in corners) and all(inside(*rot(x, y), .22) for x, y in posts):
        best = (L, W); break
assert best, 'COURT_DOES_NOT_FIT'
L, W = best
s = L / 28.0                                       # world units per metre of the stylised court
print('COURT', round(L, 3), round(W, 3), 'centre', round(cx, 3), round(cy, 3), 'surfaceTop', zmax)


def mat(name, col, rough=.5, metal=0.0, emit=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*col, 1)
        b.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*col, 1)
    return m


M = {
    'court': mat('bb-court-teal', (.07, .40, .42), .55), 'key': mat('bb-court-key', (.70, .30, .18), .55),
    'line': mat('bb-court-line', (.93, .90, .80), .5), 'post': mat('bb-post', (.16, .18, .20), .35, .7),
    'board': mat('bb-backboard', (.95, .96, .96), .25), 'square': mat('bb-board-square', (.86, .24, .12), .4),
    'rim': mat('bb-rim', (.96, .40, .06), .3, .5), 'net': mat('bb-net', (.97, .97, .95), .6),
    'wood': mat('bb-bench-wood', (.60, .40, .22), .7), 'ball': mat('bb-ball', (.90, .42, .10), .55),
    'seam': mat('bb-ball-seam', (.10, .08, .06), .6), 'cart': mat('bb-cart', (.22, .40, .70), .4, .3),
}
created = []


def tag(o, layer='base', role=None):
    o['cageLayer'] = layer; o['cageFieldId'] = FIELD
    if role: o['objectRole'] = role
    created.append(o)
    return o


def slab(name, poly, z0, z1, m, layer='base'):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bot = [bm.verts.new((x, y, z0)) for x, y in poly]; topv = [bm.verts.new((x, y, z1)) for x, y in poly]
    bm.faces.new(topv); bm.faces.new(list(reversed(bot)))
    n = len(poly)
    for i in range(n):
        bm.faces.new((bot[i], bot[(i + 1) % n], topv[(i + 1) % n], topv[i]))
    bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); me.materials.append(m)
    return tag(o, layer)


def line_strip(name, pts, width, z, m, closed=False):
    """Flat painted line of constant width through world (x, y) points."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    P = pts + ([pts[0]] if closed else [])
    left, right = [], []
    for i, (x, y) in enumerate(P):
        a = P[max(0, i - 1)]; b = P[min(len(P) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]; l = math.hypot(tx, ty) or 1
        nx, ny = -ty / l * width / 2, tx / l * width / 2
        left.append(bm.verts.new((x + nx, y + ny, z))); right.append(bm.verts.new((x - nx, y - ny, z)))
    for i in range(len(P) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); me.materials.append(m)
    return tag(o)


def arc(x0, y0, r, a0, a1, n=28):
    return [(x0 + r * math.cos(a0 + (a1 - a0) * i / n), y0 + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


Z = zmax
rect = lambda x0, y0, x1, y1: [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
# court slab with a softly rounded apron, keys, lines
apron = .10
slab('bb-court', rect(cx - L / 2 - apron, cy - W / 2 - apron, cx + L / 2 + apron, cy + W / 2 + apron), Z - .02, Z + .006, M['court'])
kw, kd = 4.9 * s, 5.8 * s
for sx in (-1, 1):
    bx = cx + sx * L / 2
    slab(f'bb-key{sx}', rect(min(bx, bx - sx * kd), cy - kw / 2, max(bx, bx - sx * kd), cy + kw / 2), Z, Z + .009, M['key'])
lw, lz = .028, Z + .012
line_strip('bb-line-boundary', rect(cx - L / 2, cy - W / 2, cx + L / 2, cy + W / 2), lw, lz, M['line'], closed=True)
line_strip('bb-line-centre', [(cx, cy - W / 2), (cx, cy + W / 2)], lw, lz, M['line'])
line_strip('bb-line-circle', arc(cx, cy, 1.8 * s, 0, math.tau, 40)[:-1], lw, lz, M['line'], closed=True)
for sx in (-1, 1):
    bx = cx + sx * L / 2
    ftx = bx - sx * kd
    line_strip(f'bb-line-key{sx}', [(bx, cy - kw / 2), (ftx, cy - kw / 2), (ftx, cy + kw / 2), (bx, cy + kw / 2)], lw, lz, M['line'])
    a0 = math.pi / 2 if sx > 0 else -math.pi / 2
    line_strip(f'bb-line-ft{sx}', arc(ftx, cy, 1.8 * s, a0, a0 + math.pi, 24), lw, lz, M['line'])
    hx = bx - sx * 1.6 * s
    r3 = 6.75 * s
    lim = math.asin(min(.98, (W / 2 - .9 * s) / r3))
    if sx > 0:
        pts = arc(hx, cy, r3, math.pi - lim, math.pi + lim)
    else:
        pts = arc(hx, cy, r3, -lim, lim)
    pts = [(bx, pts[0][1])] + pts + [(bx, pts[-1][1])]
    line_strip(f'bb-line-three{sx}', pts, lw, lz, M['line'])


def box(name, c, size, m, layer='decor', role=None, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.object; o.name = name; o.scale = size; o.rotation_euler[2] = rot
    o.data.materials.append(m)
    return tag(o, layer, role)


def cyl(name, a, b, r, m, layer='decor', role=None, verts=12):
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object; o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(m)
    return tag(o, layer, role)


# hoops: post behind each baseline, arm, backboard facing the court, rim and a cord net
H = 2.0                        # rim height (Blender units); the hunt/cage character scale (vending machine ~2.6)
for sx in (-1, 1):
    bx = cx + sx * L / 2
    px = bx + sx * .30
    cyl(f'bb-post{sx}', (px, cy, Z), (px, cy, Z + H + .45), .055, M['post'], role='hoop')
    box(f'bb-post-foot{sx}', (px, cy, Z + .03), (.22, .22, .06), M['post'], role='hoop')
    cyl(f'bb-arm{sx}', (px, cy, Z + H + .32), (bx - sx * .02, cy, Z + H + .32), .035, M['post'], role='hoop')
    box(f'bb-board{sx}', (bx - sx * .03, cy, Z + H + .30), (.04, 1.0, .62), M['board'], role='hoop')
    box(f'bb-square{sx}', (bx - sx * .055, cy, Z + H + .20), (.012, .36, .26), M['square'], role='hoop')
    box(f'bb-square-in{sx}', (bx - sx * .060, cy, Z + H + .20), (.012, .28, .19), M['board'], role='hoop')
    rx = bx - sx * (.05 + .24)
    bpy.ops.mesh.primitive_torus_add(major_radius=.20, minor_radius=.022, major_segments=24, minor_segments=8, location=(rx, cy, Z + H))
    o = bpy.context.object; o.name = f'bb-rim{sx}'; o.data.materials.append(M['rim']); tag(o, 'decor', 'hoop')
    for k in range(10):
        a = k * math.tau / 10
        top = (rx + .20 * math.cos(a), cy + .20 * math.sin(a), Z + H - .01)
        bot = (rx + .12 * math.cos(a + .35), cy + .12 * math.sin(a + .35), Z + H - .38)
        cyl(f'bb-net{sx}-{k}', top, bot, .008, M['net'], role='hoop-net', verts=5)
    for j, (zz, rr) in enumerate(((Z + H - .14, .175), (Z + H - .27, .145))):
        bpy.ops.mesh.primitive_torus_add(major_radius=rr, minor_radius=.007, major_segments=20, minor_segments=4, location=(rx, cy, zz))
        o = bpy.context.object; o.name = f'bb-netring{sx}-{j}'; o.data.materials.append(M['net']); tag(o, 'decor', 'hoop-net')

# court-side bench (along the far long side, outside the line) and a ball cart near the near side
by = cy + W / 2 + .40
for k in range(3):
    box(f'bb-bench-slat{k}', (cx - .2, by + (k - 1) * .09, Z + .42), (1.25, .07, .04), M['wood'], role='bench')
for sx in (-1, 1):
    box(f'bb-bench-leg{sx}', (cx - .2 + sx * .55, by, Z + .21), (.05, .26, .42), M['post'], role='bench')
box('bb-bench-back', (cx - .2, by + .17, Z + .72), (1.25, .04, .22), M['wood'], role='bench')
ty = cy - W / 2 - .42
box('bb-cart', (cx + L * .30, ty, Z + .30), (.46, .30, .30), M['cart'], role='ball-cart')
for k in range(3):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.12, segments=16, ring_count=10, location=(cx + L * .30 + (k - 1) * .15, ty, Z + .55))
    o = bpy.context.object; o.name = f'bb-ball{k}'
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(M['ball']); tag(o, 'decor', 'ball-cart')

# rotate everything built above about the hex centre so the court lies screen-horizontal
from mathutils import Matrix
R = Matrix.Translation((cx, cy, 0)) @ Matrix.Rotation(TH, 4, 'Z') @ Matrix.Translation((-cx, -cy, 0))
for o in created:
    o.matrix_world = R @ o.matrix_world
bpy.context.view_layer.update()
# keep hedges out of the court and its posts (move, never delete: the composition stays theirs)
for o in sc.objects:
    if o.name.startswith('mini-hedge'):
        c = o.matrix_world.translation
        # court-local coordinates of the hedge
        u = (c.x - cx) * math.cos(TH) + (c.y - cy) * math.sin(TH)
        v = -(c.x - cx) * math.sin(TH) + (c.y - cy) * math.cos(TH)
        if abs(u) < L / 2 + .45 and abs(v) < W / 2 + .30:
            nv = (W / 2 + .45) * (1 if v > 0 else -1)
            dv = nv - v
            o.location.x += -dv * math.sin(TH); o.location.y += dv * math.cos(TH)
print('CM30_BASKETBALL objects', len(created))
bpy.ops.wm.save_as_mainfile(filepath=dst)
