"""The two gachapon-only cage maps (Owner 2026-11-03): 全自動皇家牧場 and 全自動星際動物園.

Owner direction: new maps in their own files, the ranch's barn, silo and trough torn down, the waiting
room's hexagon footprint (shape 10, four hexes), the royal ranch far more lavish than the plain one,
the zoo with stellar and space elements, finer detail and motion, built in Blender for the 3D ranch.

    blender -b --factory-startup --python scripts/build-royal-cage-maps.py -- \
        ROYAL_RANCH|STELLAR_ZOO <ground.png> <out_dir> [--glb] [--preview] [--samples N]

<ground.png> comes from scripts/paint-royal-cage-ground.py. --glb writes <out_dir>/<field>.glb (Draco,
one looping 8 s animation, the ground texture with props' ambient occlusion baked in); --preview renders a
Cycles look at the ranch camera (40 degrees) to <out_dir>/<field>_preview.png.

Everything sits under one root turned 45 degrees about Z: local X is screen right (native x / 16) and
local -Y is toward the camera (native y / (16 sin 52)), the field's native frame exactly as the runtime
maps it (ranchNativeToWorld). Floors are at Z = 0 and the skirt runs to -0.248 like every cage. Walkable
tiles come from scripts/lib/royal_cage_layout.py; tall pieces stand only on tiles it leaves unwalkable.
Each outer edge's fence is its own node named "...-rim-joint-eN", so the ranch hides it on a joined seam.
Materials stay web friendly: flat PBR colours, little metal (the ranch has no environment map), opaque
(the scene forces alphaTest), emission only where something glows.
"""
import bpy, bmesh, sys, os, math
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import royal_cage_layout as L

argv = sys.argv[sys.argv.index('--') + 1:]
EDITION, GROUND, OUTDIR = argv[0], argv[1], argv[2]
WANT_GLB, WANT_PREVIEW = '--glb' in argv, '--preview' in argv
SAMPLES = int(argv[argv.index('--samples') + 1]) if '--samples' in argv else 96
ROYAL = EDITION == 'ROYAL_RANCH'
FIELD = 'field_royal_ranch_01' if ROYAL else 'field_stellar_zoo_01'
FPS, LOOP = 12, 96                     # one 8-second loop; every motion repeats a whole number of times in it
os.makedirs(OUTDIR, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, LOOP
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'

root = bpy.data.objects.new(f'{FIELD}-root', None)
scene.collection.objects.link(root)
root.rotation_euler = (0, 0, math.radians(45))
TAU = 2 * math.pi


def P(nx, ny, z=0.0):
    return Vector((nx / 16.0, -ny / (16.0 * L.S52), z))


def Q(nx, ny, du=0.0, dw=0.0):
    """A native point moved du world units right and dw toward the camera."""
    return (nx + du * 16.0, ny + dw * 16.0 * L.S52)


# ---- materials ---------------------------------------------------------------------------------
MATS = {}


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [(v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]


def mat(name, color, metallic=0.0, roughness=0.55, emit=None, strength=0.0):
    key = f'{FIELD}-{name}'
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if emit:
        b.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    MATS[key] = m
    return m


if ROYAL:
    M = dict(
        marble=mat('marble', '#f6f1e6', 0, 0.38), cream=mat('cream', '#eadfc6', 0, 0.55),
        gold=mat('gold', '#f3c24a', 0.25, 0.32), gold_dark=mat('gold-dark', '#c98f22', 0.2, 0.4),
        blue=mat('slate-blue', '#2f56b8', 0.05, 0.4), crimson=mat('crimson', '#b3172f', 0, 0.55),
        glow=mat('lantern', '#ffeab0', 0, 0.4, '#ffcc66', 4.0), window=mat('window', '#ffe2a0', 0, 0.3, '#ffbe55', 2.5),
        leaf=mat('topiary', '#2f7d2e', 0, 0.75), leaf2=mat('topiary-light', '#53a33a', 0, 0.75),
        water=mat('water', '#6fd0ff', 0, 0.12, '#3aa8ff', 0.6), hay=mat('golden-hay', '#f2c84e', 0, 0.85),
        rose=mat('rose', '#ec3550', 0, 0.5), pink=mat('pink', '#ff9cc0', 0, 0.5), white=mat('white', '#ffffff', 0, 0.45),
        dark=mat('iron', '#2e3242', 0.2, 0.5), soil=mat('soil', '#5b3d26', 0, 0.9), beak=mat('beak', '#ff9a2e', 0, 0.5),
        wing_a=mat('wing-a', '#ffb3e0', 0, 0.5, '#ff7fc8', 0.6), wing_b=mat('wing-b', '#ffe066', 0, 0.5, '#ffd040', 0.6),
        cyan=mat('robot-eye', '#8ff7ff', 0, 0.3, '#3ff2ff', 3.0),
        skirt=mat('skirt-marble', '#efe9dc', 0, 0.45), skirt_band=mat('skirt-gold', '#f3c24a', 0.25, 0.32),
        skirt_base=mat('skirt-blue', '#2f56b8', 0.05, 0.45))
else:
    M = dict(
        hull=mat('hull', '#eef2fa', 0.15, 0.32), metal=mat('chrome', '#b8c2de', 0.3, 0.28),
        dark=mat('dark-hull', '#283050', 0.2, 0.45), cyan=mat('neon-cyan', '#8ff9ff', 0, 0.25, '#3ff2ff', 4.5),
        violet=mat('crystal-violet', '#b892ff', 0, 0.2, '#8a5cff', 2.2), pink=mat('spore-pink', '#ffa2dc', 0, 0.3, '#ff5cc0', 2.4),
        green=mat('nutrient-green', '#a8ff86', 0, 0.3, '#57ff6a', 3.2), red=mat('rocket-red', '#e5413f', 0.05, 0.45),
        amber=mat('beacon', '#ffd46a', 0, 0.3, '#ffb020', 4.0), white=mat('white', '#ffffff', 0, 0.4),
        rock=mat('crater-rock', '#433d62', 0, 0.85), stem=mat('stem', '#2f8a84', 0, 0.6),
        planet=mat('planet', '#ffb866', 0, 0.55, '#ff9040', 1.1), planet_band=mat('planet-band', '#ff7a6a', 0, 0.55, '#ff5a4a', 0.9),
        ring=mat('planet-ring', '#a8ecff', 0, 0.3, '#7fdcff', 1.8), nebula=mat('nebula', '#7a4cff', 0, 0.1, '#7d4dff', 1.6),
        nebula2=mat('nebula-pink', '#ff7fd6', 0, 0.1, '#ff5ec8', 1.8), star=mat('star', '#fff3b0', 0, 0.3, '#ffe066', 4.0),
        glass=mat('glass', '#bfe8ff', 0, 0.1, '#7fd8ff', 0.35),
        skirt=mat('skirt-hull', '#2c3456', 0.2, 0.45), skirt_band=mat('skirt-neon', '#8ff9ff', 0, 0.25, '#3ff2ff', 3.5),
        skirt_base=mat('skirt-dark', '#171c33', 0.2, 0.5))

objects = []


def own(o, m, tag='static', parent=None):
    if m is not None:
        o.data.materials.clear()
        o.data.materials.append(m)
    o.parent = parent or root
    o['tag'] = tag
    objects.append(o)
    return o


def at(nx, ny, z, parent):
    """Location for a primitive: world-local under the root, or relative to an animated pivot."""
    p = P(nx, ny, z)
    return p - Vector(parent['pivot']) if parent is not None else p


def cyl(nx, ny, z, r, h, m, verts=16, tag='static', parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=at(nx, ny, z + h / 2, parent))
    return own(bpy.context.object, m, tag, parent)


def cone(nx, ny, z, r1, r2, h, m, verts=16, tag='static', parent=None, open_ends=False):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h, location=at(nx, ny, z + h / 2, parent),
                                    end_fill_type='NOTHING' if open_ends else 'NGON')
    return own(bpy.context.object, m, tag, parent)


def ball(nx, ny, z, r, m, tag='static', parent=None, scale=(1, 1, 1), seg=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(6, seg // 2), radius=r, location=at(nx, ny, z, parent))
    o = own(bpy.context.object, m, tag, parent)
    o.scale = scale
    return o


def box(nx, ny, z, size, m, rot=0.0, tag='static', parent=None):
    """size = (across, depth, height) in world units; z is the bottom."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=at(nx, ny, z + size[2] / 2, parent), rotation=(0, 0, rot))
    o = own(bpy.context.object, m, tag, parent)
    o.scale = size
    return o


def torus(nx, ny, z, R, r, m, rot=(0, 0, 0), tag='static', parent=None, seg=24):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=6,
                                     location=at(nx, ny, z, parent), rotation=rot)
    return own(bpy.context.object, m, tag, parent)


def frustum(nx, ny, z, w0, d0, w1, d1, h, m, tag='static', parent=None):
    me = bpy.data.meshes.new('frustum'); bm = bmesh.new()
    c = at(nx, ny, 0, parent)
    lo = [bm.verts.new((c.x + sx * w0 / 2, c.y + sy * d0 / 2, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    hi = [bm.verts.new((c.x + sx * w1 / 2, c.y + sy * d1 / 2, z + h)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(lo[::-1]); bm.faces.new(hi)
    for i in range(4):
        bm.faces.new((lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('frustum', me); scene.collection.objects.link(o)
    return own(o, m, tag, parent)


def rail(a, b, z, r, m, tag='static', parent=None, verts=8):
    pa, pb = at(*a, z, parent), at(*b, z, parent)
    d = pb - pa
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(pa + pb) / 2,
                                        rotation=(0, math.pi / 2, math.atan2(d.y, d.x)))
    return own(bpy.context.object, m, tag, parent)


def arch_window(nx, ny, z, w, h, m_glass, m_frame, front_dw):
    """A glowing arched window on a facade facing the camera."""
    x, y = Q(nx, ny, 0, front_dw)
    box(x, y, z, (w, 0.03, h), m_glass)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=w / 2, depth=0.03, location=P(x, y, z + h), rotation=(math.pi / 2, 0, 0))
    own(bpy.context.object, m_glass)
    x2, y2 = Q(nx, ny, 0, front_dw + 0.012)
    box(x2, y2, z - 0.04, (w + 0.1, 0.03, 0.04), m_frame)


# ---- animation: pivots carry the motion; every curve repeats inside the 8-second loop -----------------
def pivot(name, nx, ny, z=0.0, parent=None):
    e = bpy.data.objects.new(f'{FIELD}-{name}', None)
    scene.collection.objects.link(e)
    e.parent = parent or root
    p = P(nx, ny, z)
    e.location = p - Vector(parent['pivot']) if parent is not None else p
    e['pivot'] = p
    e['tag'] = 'pivot'
    return e


def keys(o, path, index, fn, steps=24):
    """fn(t in 0..1) -> value; LINEAR keys at `steps` points of the loop, last equal to first."""
    base = getattr(o, path)[index]
    for k in range(steps + 1):
        t = k / steps
        getattr(o, path)[index] = base + fn(t)
        o.keyframe_insert(path, index=index, frame=round(t * LOOP))
    getattr(o, path)[index] = base


def spin(o, turns=1.0, axis=2):
    keys(o, 'rotation_euler', axis, lambda t: TAU * turns * t, steps=max(8, int(8 * abs(turns))))


def bob(o, amp, cycles=1, phase=0.0, axis=2):
    keys(o, 'location', axis, lambda t: amp * math.sin(TAU * (cycles * t + phase)), steps=12 * cycles)


def sway(o, deg, cycles=1, phase=0.0, axis=2):
    keys(o, 'rotation_euler', axis, lambda t: math.radians(deg) * math.sin(TAU * (cycles * t + phase)), steps=12 * cycles)


def pulse(o, amp, cycles=1, phase=0.0):
    for axis in range(3):
        keys(o, 'scale', axis, lambda t: amp * math.sin(TAU * (cycles * t + phase)), steps=8 * cycles)


# ---- the plate: the waiting room's four hexes, floor at 0, skirt to -0.248 ---------------------------
outline = L.outline()
me = bpy.data.meshes.new(f'{FIELD}-plate'); bm = bmesh.new()
uv = bm.loops.layers.uv.new('UVMap')
top = [bm.verts.new(P(x, y, 0)) for x, y in outline]
face = bm.faces.new(top)
bmesh.ops.triangulate(bm, faces=[face], quad_method='BEAUTY', ngon_method='BEAUTY')
ring_prev = top
for z0, z1, mi in [(0.0, -0.035, 1), (-0.035, -0.19, 2), (-0.19, -0.248, 3)]:
    ring = [bm.verts.new(P(x, y, z1)) for x, y in outline]
    upper = ring_prev if z0 == 0.0 else [bm.verts.new(P(x, y, z0)) for x, y in outline]
    for i in range(len(outline)):
        bm.faces.new((upper[i], ring[i], ring[(i + 1) % len(ring)], upper[(i + 1) % len(upper)])).material_index = mi
    ring_prev = ring
bm.faces.new(ring_prev).material_index = 3
for f in bm.faces:
    for loop in f.loops:
        loop[uv].uv = (loop.vert.co.x * 16 / L.FIELD_W, 1 - (-loop.vert.co.y * 16 * L.S52) / L.FIELD_H)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.normal_update(); bm.to_mesh(me); bm.free()
plate = bpy.data.objects.new(f'{FIELD}-plate', me); scene.collection.objects.link(plate)
gm = bpy.data.materials.new(f'{FIELD}-ground'); gm.use_nodes = True
ground_img = bpy.data.images.load(GROUND)
tn = gm.node_tree.nodes.new('ShaderNodeTexImage'); tn.image = ground_img; tn.interpolation = 'Linear'
gb = gm.node_tree.nodes['Principled BSDF']; gb.inputs['Roughness'].default_value = 0.88
gm.node_tree.links.new(tn.outputs['Color'], gb.inputs['Base Color'])
for m in (gm, M['skirt_band'], M['skirt'], M['skirt_base']):
    me.materials.append(m)
plate.parent = root; plate['tag'] = 'plate'


# ---- rim fence: one node per outer edge, a little inside it ----------------------------------------
def offset_outline(d):
    pts = [P(x, y) for x, y in outline]
    n, lines = len(pts), []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        t = (b - a).normalized()
        nrm = Vector((-t.y, t.x, 0))
        mid = (a + b) / 2 + nrm * 0.01
        if not L.point_in_poly(mid.x * 16, -mid.y * 16 * L.S52, outline):
            nrm = -nrm
        lines.append((a + nrm * d, t))
    out = []
    for i in range(n):
        (p1, t1), (p2, t2) = lines[i - 1], lines[i]
        s = ((p2.x - p1.x) * t2.y - (p2.y - p1.y) * t2.x) / (t1.x * t2.y - t1.y * t2.x)
        out.append(p1 + t1 * s)
    return out


def native(v):
    return (v.x * 16, -v.y * 16 * L.S52)


inset = offset_outline(0.26)
for e in range(len(inset)):
    a, b = inset[e], inset[(e + 1) % len(inset)]
    steps = max(2, round((b - a).length / 0.78))
    posts = [native(a.lerp(b, k / steps)) for k in range(steps + 1)]
    tag = f'rim-joint-e{e}'
    for k, (x, y) in enumerate(posts):
        corner = k in (0, len(posts) - 1)
        if ROYAL:
            if corner:
                cyl(x, y, 0, 0.16, 0.1, M['marble'], 12, tag)
                box(x, y, 0.1, (0.22, 0.22, 0.42), M['marble'], math.radians(0), tag)
                box(x, y, 0.52, (0.27, 0.27, 0.05), M['gold'], 0, tag)
                ball(x, y, 0.66, 0.085, M['gold'], tag, seg=12)
                cone(x, y, 0.72, 0.03, 0, 0.1, M['gold'], 6, tag)
            else:
                box(x, y, 0, (0.13, 0.13, 0.38), M['marble'], 0, tag)
                ball(x, y, 0.43, 0.05, M['gold'], tag, seg=10)
        else:
            if corner:
                cyl(x, y, 0, 0.13, 0.08, M['dark'], 6, tag)
                cyl(x, y, 0.08, 0.05, 0.5, M['metal'], 8, tag)
                ball(x, y, 0.62, 0.075, M['cyan'], tag, seg=10)
            else:
                cyl(x, y, 0, 0.04, 0.42, M['metal'], 8, tag)
                ball(x, y, 0.46, 0.045, M['cyan'], tag, seg=8)
    pa, pb = posts[0], posts[-1]
    if ROYAL:
        rail(pa, pb, 0.37, 0.04, M['marble'], tag)
        rail(pa, pb, 0.41, 0.018, M['gold'], tag)
        rail(pa, pb, 0.06, 0.035, M['marble'], tag)
        for k in range(len(posts) - 1):
            (x0, y0), (x1, y1) = posts[k], posts[k + 1]
            for j in (1, 2, 3, 4):
                t = j / 5
                bx, by = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                cone(bx, by, 0.08, 0.034, 0.02, 0.28, M['marble'], 6, tag)
    else:
        rail(pa, pb, 0.18, 0.016, M['cyan'], tag)
        rail(pa, pb, 0.36, 0.016, M['cyan'], tag)
        rail(pa, pb, 0.03, 0.03, M['dark'], tag)

cx, cy = L.PLAZA


def royal_ranch():
    # ---- the palace stable (hex B, back) ----
    px, py = 144, 30
    front = 0.62                                  # the hall's front face, world units toward the camera
    box(px, py, 0, (4.3, 2.05, 0.16), M['marble'])
    box(px, py, 0.16, (4.36, 2.1, 0.03), M['gold'])
    for s in range(3):
        x, y = Q(px, py, 0, 1.08 + s * 0.13)
        box(x, y, 0, (1.7 - s * 0.16, 0.16, 0.16 - s * 0.05), M['marble'])
    hx, hy = Q(px, py, 0, -0.1)
    box(hx, hy, 0.19, (2.7, 1.45, 1.3), M['marble'])
    box(hx, hy, 0.19, (2.76, 1.5, 0.12), M['cream'])
    box(hx, hy, 1.49, (2.92, 1.62, 0.1), M['gold'])
    frustum(hx, hy, 1.59, 2.92, 1.62, 1.85, 0.7, 0.56, M['blue'])
    for side in (-0.75, 0.75):                    # dormers
        x, y = Q(hx, hy, side, 0.55)
        box(x, y, 1.66, (0.34, 0.3, 0.3), M['marble'])
        frustum(x, y, 1.96, 0.42, 0.36, 0.02, 0.36, 0.16, M['blue'])
        arch_window(x, y, 1.72, 0.16, 0.13, M['window'], M['gold'], 0.16)
    cyl(hx, hy, 2.12, 0.5, 0.32, M['marble'], 24)
    for k in range(8):
        a = k * TAU / 8
        x, y = Q(hx, hy, math.cos(a) * 0.5, -math.sin(a) * 0.5)
        box(x, y, 2.16, (0.06, 0.06, 0.26), M['gold'], -a)
    torus(hx, hy, 2.44, 0.5, 0.04, M['gold'])
    ball(hx, hy, 2.44, 0.5, M['gold'], scale=(1, 1, 0.95), seg=24)
    cyl(hx, hy, 2.9, 0.035, 0.28, M['gold'], 8)
    vane = pivot('weather-vane', hx, hy, 3.18)       # a crown weather vane that turns slowly
    cyl(hx, hy, 3.18, 0.14, 0.07, M['gold'], 16, 'anim', vane)
    for k in range(5):
        a = k * TAU / 5
        x, y = Q(hx, hy, math.cos(a) * 0.12, math.sin(a) * 0.12)
        cone(x, y, 3.25, 0.04, 0, 0.13, M['gold'], 6, 'anim', vane)
        ball(x, y, 3.4, 0.03, M['rose'], 'anim', vane, seg=8)
    x, y = Q(hx, hy, 0.22, 0)
    box(x, y, 3.26, (0.36, 0.02, 0.14), M['gold'], 0, 'anim', vane)
    spin(vane, 1)
    # Colonnade, pediment with a crest, balcony, door, windows.
    fx, fy = Q(hx, hy, 0, 0.73 + 0.28)
    for ox in (-1.0, -0.42, 0.42, 1.0):
        x, y = Q(fx, fy, ox, 0)
        cyl(x, y, 0.19, 0.1, 0.08, M['gold'], 12)
        cyl(x, y, 0.27, 0.08, 1.06, M['marble'], 12)
        cyl(x, y, 1.33, 0.11, 0.08, M['gold'], 12)
    box(fx, fy, 1.41, (2.4, 0.32, 0.1), M['gold'])
    frustum(fx, fy, 1.51, 2.3, 0.3, 0.05, 0.3, 0.45, M['marble'])
    x, y = Q(fx, fy, 0, 0.16)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.13, depth=0.03, location=P(x, y, 1.68), rotation=(math.pi / 2, 0, 0))
    own(bpy.context.object, M['gold'])
    dx, dy = Q(hx, hy, 0, 0.74)
    box(dx, dy, 0.19, (0.66, 0.04, 0.86), M['gold'])
    box(*Q(dx, dy, 0, 0.012), 0.19, (0.52, 0.04, 0.76), M['crimson'])
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.33, depth=0.04, location=P(dx, dy, 1.05), rotation=(math.pi / 2, 0, 0))
    own(bpy.context.object, M['gold'])
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.26, depth=0.045, location=P(*Q(dx, dy, 0, 0.01), 1.05), rotation=(math.pi / 2, 0, 0))
    own(bpy.context.object, M['crimson'])
    for ox in (-0.62, 0.62):
        for oz in (0.42, 0.96):
            x, y = Q(hx, hy, ox, 0)
            arch_window(x, y, 0.19 + oz, 0.24, 0.3, M['window'], M['gold'], 0.74)
            if oz < 0.5:
                bx, by = Q(x, y, 0, 0.8)
                box(bx, by, 0.19 + oz - 0.12, (0.34, 0.1, 0.08), M['gold_dark'])
                for j in range(4):
                    ball(*Q(bx, by, -0.12 + j * 0.08, 0), 0.19 + oz - 0.02, 0.04, M['rose' if j % 2 else 'pink'], seg=8)
    # Gold lions on the stair cheeks.
    for side in (-1, 1):
        lx, ly = Q(px, py, side * 0.98, 1.2)
        box(lx, ly, 0, (0.3, 0.3, 0.22), M['marble'])
        ball(lx, ly, 0.36, 0.12, M['gold'], scale=(1, 1.25, 0.9), seg=12)
        ball(*Q(lx, ly, 0, 0.12), 0.48, 0.085, M['gold'], seg=12)
        ball(*Q(lx, ly, 0, 0.11), 0.5, 0.11, M['gold_dark'], scale=(1, 0.6, 1), seg=12)
    # Towers with pennants that wave.
    for side in (-1, 1):
        tx, ty = Q(px, py, side * 1.85, -0.05)
        cyl(tx, ty, 0.19, 0.44, 1.85, M['marble'], 24)
        torus(tx, ty, 0.25, 0.45, 0.04, M['gold'])
        torus(tx, ty, 2.04, 0.45, 0.05, M['gold'])
        for k in range(10):                      # crenels
            a = k * TAU / 10
            box(*Q(tx, ty, math.cos(a) * 0.42, math.sin(a) * 0.42), 2.04, (0.12, 0.12, 0.12), M['marble'], -a)
        cone(tx, ty, 2.1, 0.5, 0, 0.9, M['blue'], 24)
        ball(tx, ty, 3.02, 0.06, M['gold'], seg=10)
        cyl(tx, ty, 3.0, 0.016, 0.6, M['gold'], 6)
        flag = pivot(f'pennant-{side}', tx, ty, 3.45)
        box(*Q(tx, ty, 0.2, 0), 3.37, (0.38, 0.016, 0.2), M['crimson'], 0, 'anim', flag)
        box(*Q(tx, ty, 0.36, 0), 3.37, (0.06, 0.018, 0.2), M['gold'], 0, 'anim', flag)
        sway(flag, 14, 2, 0.25 if side > 0 else 0)
        for oz in (0.75, 1.35):
            arch_window(tx, ty, 0.19 + oz, 0.17, 0.26, M['window'], M['gold'], 0.44)
        x, y = Q(tx, ty, 0, 0.45)
        box(x, y, 0.95, (0.32, 0.03, 0.7), M['crimson'])
        box(*Q(x, y, 0, 0.005), 1.65, (0.36, 0.035, 0.05), M['gold'])
    # ---- the auto-feed pavilion (hex A, back) ----
    fx, fyy = 46, 40
    cyl(fx, fyy, 0, 1.3, 0.12, M['marble'], 40)
    cyl(fx, fyy, 0.12, 1.22, 0.04, M['cream'], 40)
    torus(fx, fyy, 0.13, 1.3, 0.03, M['gold'])
    for k in range(8):
        a = k * TAU / 8 + TAU / 16
        x, y = Q(fx, fyy, math.cos(a) * 1.08, math.sin(a) * 1.08)
        cyl(x, y, 0.16, 0.1, 0.07, M['gold'], 12)
        cyl(x, y, 0.23, 0.07, 1.05, M['marble'], 12)
        cyl(x, y, 1.28, 0.1, 0.07, M['gold'], 12)
    cyl(fx, fyy, 1.35, 1.24, 0.16, M['marble'], 40)
    torus(fx, fyy, 1.51, 1.24, 0.04, M['gold'])
    ball(fx, fyy, 1.51, 1.2, M['crimson'], scale=(1, 1, 0.56), seg=32)
    for k in range(8):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.2, minor_radius=0.024, major_segments=24, minor_segments=4,
                                         location=P(fx, fyy, 1.51), rotation=(math.pi / 2, 0, k * TAU / 16))
        o = own(bpy.context.object, M['gold']); o.scale = (1, 1, 0.56)
    for k in range(8):                           # scalloped valance
        a = k * TAU / 8
        ball(*Q(fx, fyy, math.cos(a) * 1.24, math.sin(a) * 1.24), 1.33, 0.12, M['crimson'], scale=(1, 1, 0.6), seg=10)
    crown = pivot('pavilion-crown', fx, fyy, 2.18)
    cyl(fx, fyy, 2.18, 0.16, 0.08, M['gold'], 16, 'anim', crown)
    for k in range(5):
        a = k * TAU / 5
        x, y = Q(fx, fyy, math.cos(a) * 0.14, math.sin(a) * 0.14)
        cone(x, y, 2.26, 0.045, 0, 0.14, M['gold'], 6, 'anim', crown)
        ball(x, y, 2.42, 0.03, M['rose'], 'anim', crown, seg=8)
    ball(fx, fyy, 2.32, 0.07, M['glow'], 'anim', crown, seg=10)
    spin(crown, -1)
    for k in range(4):                           # lanterns that swing
        a = k * TAU / 4
        x, y = Q(fx, fyy, math.cos(a) * 0.82, math.sin(a) * 0.82)
        lan = pivot(f'pavilion-lantern-{k}', x, y, 1.35)
        cyl(x, y, 1.12, 0.008, 0.23, M['gold'], 6, 'anim', lan)
        box(x, y, 0.98, (0.12, 0.12, 0.15), M['glow'], 0, 'anim', lan)
        cone(x, y, 1.13, 0.09, 0, 0.07, M['gold'], 4, 'anim', lan)
        sway(lan, 6, 2, k * 0.25, axis=0)
    cyl(fx, fyy, 0.16, 0.78, 0.22, M['marble'], 32)          # trough, hay and the golden hopper
    torus(fx, fyy, 0.38, 0.78, 0.03, M['gold'])
    ball(fx, fyy, 0.34, 0.7, M['hay'], scale=(1, 1, 0.22), seg=24)
    cone(fx, fyy, 0.62, 0.12, 0.42, 0.48, M['gold'], 24)
    cyl(fx, fyy, 1.1, 0.42, 0.06, M['gold_dark'], 24)
    ball(fx, fyy, 1.18, 0.34, M['hay'], scale=(1, 1, 0.35), seg=16)
    for side in (-1, 1):
        x, y = Q(fx, fyy, 0.75 * side, 0.55)
        box(x, y, 0.16, (0.28, 0.2, 0.2), M['gold_dark'])
        ball(x, y, 0.42, 0.14, M['hay'], scale=(1.2, 1, 0.7), seg=12)
    # ---- the fountain on the plaza ----
    cyl(cx, cy, 0, 1.44, 0.3, M['marble'], 48)
    torus(cx, cy, 0.3, 1.44, 0.06, M['gold'])
    for k in range(12):
        a = k * TAU / 12
        box(*Q(cx, cy, math.cos(a) * 1.44, math.sin(a) * 1.44), 0.02, (0.14, 0.14, 0.26), M['cream'], -a)
    cyl(cx, cy, 0, 1.32, 0.25, M['water'], 48)
    cyl(cx, cy, 0.25, 0.22, 0.6, M['marble'], 16)
    torus(cx, cy, 0.5, 0.24, 0.04, M['gold'])
    cone(cx, cy, 0.78, 0.22, 0.78, 0.2, M['marble'], 32)
    torus(cx, cy, 0.98, 0.78, 0.035, M['gold'])
    cyl(cx, cy, 0.9, 0.72, 0.07, M['water'], 32)
    cone(cx, cy, 0.32, 1.05, 0.77, 0.64, M['water'], 40, open_ends=True)
    cyl(cx, cy, 0.98, 0.11, 0.4, M['marble'], 12)
    cone(cx, cy, 1.36, 0.12, 0.4, 0.12, M['marble'], 24)
    torus(cx, cy, 1.48, 0.4, 0.025, M['gold'])
    cyl(cx, cy, 1.4, 0.36, 0.05, M['water'], 24)
    cone(cx, cy, 1.0, 0.44, 0.38, 0.46, M['water'], 24, open_ends=True)
    cyl(cx, cy, 1.48, 0.12, 0.08, M['gold'], 16)
    for k in range(5):
        a = k * TAU / 5
        x, y = Q(cx, cy, math.cos(a) * 0.1, math.sin(a) * 0.1)
        cone(x, y, 1.56, 0.035, 0, 0.12, M['gold'], 6)
    jet = pivot('fountain-jet', cx, cy, 1.56)
    cyl(cx, cy, 1.56, 0.035, 0.38, M['water'], 10, 'anim', jet)
    ball(cx, cy, 1.96, 0.07, M['water'], 'anim', jet, seg=10)
    pulse(jet, 0.18, 4)
    drops = [pivot(f'fountain-drops-{k}', cx, cy, 1.15) for k in range(2)]   # droplets off the top bowl, two alternating rings
    for k in range(8):
        a = k * TAU / 8
        ball(*Q(cx, cy, math.cos(a) * 0.58, math.sin(a) * 0.58), 1.15, 0.04, M['water'], 'anim', drops[k % 2], seg=8)
    bob(drops[0], 0.18, 2)
    bob(drops[1], 0.18, 2, 0.5)
    swans = pivot('swans', cx, cy, 0.25)      # two swans gliding round the basin
    for k in range(2):
        a = k * math.pi
        sx, sy = Q(cx, cy, math.cos(a) * 1.08, math.sin(a) * 1.08)
        body = ball(sx, sy, 0.31, 0.11, M['white'], 'anim', swans, scale=(1.4, 0.8, 0.7), seg=12)
        body.rotation_euler = (0, 0, a + math.pi / 2)
        hx2, hy2 = Q(sx, sy, -math.sin(a) * 0.12, math.cos(a) * 0.12)
        cyl(hx2, hy2, 0.34, 0.022, 0.2, M['white'], 8, 'anim', swans)
        ball(hx2, hy2, 0.55, 0.04, M['white'], 'anim', swans, seg=8)
        bx2, by2 = Q(hx2, hy2, -math.sin(a) * 0.05, math.cos(a) * 0.05)
        cone(bx2, by2, 0.53, 0.015, 0, 0.05, M['beak'], 6, 'anim', swans).rotation_euler = (math.pi / 2, 0, a)
    spin(swans, 1)
    # ---- the auto-clean kiosk (hex D, right) and its sweeper robot ----
    kx, ky = 219, 126
    box(kx, ky, 0, (1.0, 0.75, 0.08), M['gold_dark'])
    box(kx, ky, 0.08, (0.92, 0.66, 0.8), M['marble'])
    frustum(kx, ky, 0.88, 1.08, 0.82, 0.12, 0.12, 0.42, M['gold'])
    ball(kx, ky, 1.32, 0.06, M['glow'], seg=10)
    x, y = Q(kx, ky, 0, 0.34)
    arch_window(kx, ky, 0.3, 0.42, 0.32, M['window'], M['gold'], 0.34)
    loop_c = Q(kx, ky, -0.35, 1.05)
    robot = pivot('sweeper-path', *loop_c, 0.0)
    rx, ry = Q(*loop_c, 0.55, 0)
    cyl(rx, ry, 0.02, 0.24, 0.1, M['marble'], 24, 'anim', robot)
    torus(rx, ry, 0.08, 0.24, 0.025, M['gold'], tag='anim', parent=robot)
    cyl(rx, ry, 0.12, 0.12, 0.05, M['gold'], 16, 'anim', robot)
    ball(rx, ry, 0.2, 0.045, M['cyan'], 'anim', robot, seg=8)
    spin(robot, -1)
    # ---- topiary, lanterns, flower clumps, butterflies ----
    corners = offset_outline(0.62)
    for i in range(len(outline)):
        q = native(corners[i])
        if L.obstacle_hit(EDITION, *q, 0.3):
            continue
        cyl(*q, 0, 0.2, 0.2, M['marble'], 16)
        torus(*q, 0.2, 0.2, 0.025, M['gold'])
        cyl(*q, 0.18, 0.17, 0.02, M['soil'], 12)
        if i % 2:
            cone(*q, 0.2, 0.2, 0.0, 0.78, M['leaf'], 12)
            ball(*q, 1.0, 0.03, M['gold'], seg=8)
        else:
            ball(*q, 0.38, 0.19, M['leaf2'], seg=14)
            ball(*q, 0.64, 0.14, M['leaf2'], seg=12)
            ball(*q, 0.84, 0.09, M['leaf2'], seg=10)
    for (x, y) in ((96, 76), (150, 120), (78, 116), (168, 86)):
        cyl(x, y, 0, 0.09, 0.08, M['dark'], 8)
        cyl(x, y, 0.08, 0.035, 0.95, M['dark'], 8)
        torus(x, y, 1.04, 0.07, 0.015, M['gold'])
        box(x, y, 1.04, (0.15, 0.15, 0.2), M['glow'])
        cone(x, y, 1.24, 0.13, 0, 0.12, M['gold'], 4)
        ball(x, y, 1.37, 0.025, M['gold'], seg=8)
    # Low rose clumps on the painted beds.
    for name, c in L.CENTERS.items():
        cu, cw = L.to_world(*c); pu, pw = L.to_world(*L.PLAZA)
        du, dw = cu - pu, cw - pw; n = math.hypot(du, dw); du, dw = du / n, dw / n
        for t in (0.42, 0.72):
            for side in (-1, 1):
                bu, bw = pu + du * n * t - dw * 1.15 * side, pw + dw * n * t + du * 1.15 * side
                bx, by = L.from_world(bu, bw)
                if L.rim_distance(bx, by) < 0.9:
                    continue
                for j in range(5):
                    a = j * TAU / 5 + t * 3
                    x, y = Q(bx, by, math.cos(a) * 0.22, math.sin(a) * 0.22)
                    ball(x, y, 0.06, 0.06, M[('rose', 'pink', 'white')[(j + int(t * 10)) % 3]], seg=6)
    for k, (bx, by, h) in enumerate(((70, 92, 0.9), (176, 150, 1.0), (110, 160, 0.8))):
        fly = pivot(f'butterfly-{k}', bx, by, h)
        wx, wy = Q(bx, by, 0.45, 0)
        wing_m = M['wing_a' if k % 2 == 0 else 'wing_b']
        for s in (-1, 1):
            w = pivot(f'butterfly-{k}-wing-{s}', wx, wy, h, fly)
            box(*Q(wx, wy, s * 0.06, 0), h, (0.11, 0.08, 0.008), wing_m, 0, 'anim', w)
            sway(w, 50 * s, 8, k * 0.13, axis=1)
        spin(fly, 1 if k % 2 else -1)
        bob(fly, 0.12, 2, k * 0.3)


def stellar_zoo():
    # ---- the observatory (hex B, back) ----
    ox_, oy_ = 150, 30
    cyl(ox_, oy_, 0, 1.28, 0.12, M['dark'], 40)
    torus(ox_, oy_, 0.12, 1.28, 0.03, M['cyan'])
    cyl(ox_, oy_, 0.12, 1.18, 0.88, M['hull'], 40)
    for k in range(10):
        a = k * TAU / 10
        x, y = Q(ox_, oy_, math.cos(a) * 1.18, math.sin(a) * 1.18)
        box(x, y, 0.45, (0.18, 0.04, 0.22), M['cyan'], -a + math.pi / 2)
        box(x, y, 0.12, (0.05, 0.05, 0.88), M['metal'], -a + math.pi / 2)
    torus(ox_, oy_, 1.0, 1.18, 0.05, M['metal'])
    dome = pivot('observatory-dome', ox_, oy_, 1.0)
    ball(ox_, oy_, 1.0, 1.16, M['metal'], 'anim', dome, seg=32)
    for k in range(8):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.165, minor_radius=0.018, major_segments=32, minor_segments=6,
                                         location=P(ox_, oy_, 1.0) - Vector(dome['pivot']), rotation=(math.pi / 2, 0, k * TAU / 16))
        own(bpy.context.object, M['dark'], 'anim', dome)
    sl = box(ox_, oy_, 1.25, (0.34, 2.36, 0.95), M['dark'], 0, 'anim', dome)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.17, depth=1.7, location=P(*Q(ox_, oy_, 0, -0.3), 2.0) - Vector(dome['pivot']),
                                        rotation=(math.radians(-48), 0, 0))
    own(bpy.context.object, M['dark'], 'anim', dome)
    torus(*Q(ox_, oy_, 0, -0.85), 2.62, 0.19, 0.035, M['amber'], rot=(math.radians(-48), 0, 0), parent=dome, tag='anim')
    sway(dome, 28, 1)
    x, y = Q(ox_, oy_, 0, 1.16)
    box(x, y, 0.12, (0.5, 0.06, 0.66), M['dark'])
    box(*Q(x, y, 0, 0.02), 0.14, (0.4, 0.05, 0.58), M['cyan'])
    for s in range(3):
        box(*Q(x, y, 0, 0.12 + s * 0.12), 0, (0.62, 0.14, 0.12 - s * 0.035), M['metal'])
    cyl(*Q(ox_, oy_, 1.0, -0.4), 0.95, 0.025, 1.4, M['metal'], 8)
    beacon = pivot('observatory-beacon', *Q(ox_, oy_, 1.0, -0.4), 2.38)
    ball(*Q(ox_, oy_, 1.0, -0.4), 2.38, 0.07, M['amber'], 'anim', beacon, seg=10)
    pulse(beacon, 0.45, 8)
    # ---- the satellite dish ----
    dx_, dy_ = 122, 24
    cyl(dx_, dy_, 0, 0.18, 0.1, M['dark'], 12)
    cyl(dx_, dy_, 0.1, 0.05, 0.75, M['metal'], 8)
    dish = pivot('satellite-dish', dx_, dy_, 0.88)
    d = ball(dx_, dy_, 1.05, 0.42, M['hull'], 'anim', dish, scale=(1, 1, 0.3), seg=24)
    d.rotation_euler = (math.radians(42), 0, 0)
    cyl(*Q(dx_, dy_, 0, 0.18), 1.06, 0.02, 0.42, M['metal'], 6, 'anim', dish).rotation_euler = (math.radians(42), 0, 0)
    ball(*Q(dx_, dy_, 0, 0.32), 1.32, 0.05, M['amber'], 'anim', dish, seg=8)
    sway(dish, 35, 1, 0.25)
    # ---- the rocket on its launch pad (hex A, back) and the gantry ----
    rx, ry = 44, 38
    cyl(rx, ry, 0, 1.0, 0.1, M['dark'], 40)
    torus(rx, ry, 0.1, 1.0, 0.03, M['amber'])
    for k in range(4):
        a = k * TAU / 4 + TAU / 8
        box(*Q(rx, ry, math.cos(a) * 0.55, math.sin(a) * 0.55), 0.1, (0.08, 0.08, 0.32), M['metal'], -a)
    cyl(rx, ry, 0.1, 0.2, 0.2, M['dark'], 20)
    cone(rx, ry, 0.12, 0.26, 0.18, 0.2, M['metal'], 20)
    cyl(rx, ry, 0.3, 0.32, 1.5, M['hull'], 28)
    cyl(rx, ry, 0.95, 0.325, 0.18, M['red'], 28)
    cyl(rx, ry, 1.5, 0.325, 0.06, M['red'], 28)
    cone(rx, ry, 1.8, 0.32, 0, 0.7, M['red'], 28)
    ball(rx, ry, 2.5, 0.04, M['white'], seg=8)
    for k in range(3):
        a = k * TAU / 3 - math.pi / 2
        box(*Q(rx, ry, math.cos(a) * 0.38, math.sin(a) * 0.38), 0.3, (0.05, 0.38, 0.55), M['red'], a + math.pi / 2)
    for z in (1.28, 1.62):
        x, y = Q(rx, ry, 0, 0.31)
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.1, depth=0.03, location=P(x, y, z), rotation=(math.pi / 2, 0, 0))
        own(bpy.context.object, M['cyan'])
        bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.018, location=P(*Q(x, y, 0, 0.01), z), rotation=(math.pi / 2, 0, 0))
        own(bpy.context.object, M['metal'])
    flame = pivot('rocket-glow', rx, ry, 0.1)
    cone(rx, ry, 0.1, 0.0, 0.17, 0.18, M['amber'], 12, 'anim', flame)
    pulse(flame, 0.25, 6)
    gx, gy = Q(rx, ry, -0.95, -0.45)
    for sx in (-0.18, 0.18):
        for sy in (-0.18, 0.18):
            cyl(*Q(gx, gy, sx, sy), 0, 0.03, 2.3, M['metal'], 6)
    for z in (0.45, 0.9, 1.35, 1.8, 2.25):
        box(gx, gy, z, (0.44, 0.44, 0.04), M['dark'])
        for s in (-1, 1):
            rail(Q(gx, gy, -0.18, s * 0.18), Q(gx, gy, 0.18, s * 0.18), z - 0.2, 0.012, M['metal'])
    box(*Q(gx, gy, 0.5, 0.15), 1.55, (0.6, 0.06, 0.06), M['metal'])
    gb_ = pivot('gantry-beacon', gx, gy, 2.36)
    ball(gx, gy, 2.36, 0.07, M['amber'], 'anim', gb_, seg=10)
    pulse(gb_, 0.45, 8, 0.5)
    # ---- the nebula pool on the plaza ----
    torus(cx, cy, 0.09, 1.52, 0.17, M['rock'], seg=48)
    cyl(cx, cy, 0, 1.44, 0.1, M['dark'], 48)
    swirl = pivot('nebula-swirl', cx, cy, 0.1)
    neb = bpy.data.materials.new(f'{FIELD}-galaxy'); neb.use_nodes = True
    gal = neb.node_tree.nodes.new('ShaderNodeTexImage')
    gal.image = bpy.data.images.load(GROUND.replace('.png', '_galaxy.png'))
    nb = neb.node_tree.nodes['Principled BSDF']; nb.inputs['Roughness'].default_value = 0.2
    neb.node_tree.links.new(gal.outputs['Color'], nb.inputs['Base Color'])
    neb.node_tree.links.new(gal.outputs['Color'], nb.inputs['Emission Color'])
    nb.inputs['Emission Strength'].default_value = 1.3
    disc = cyl(cx, cy, 0.08, 1.42, 0.03, neb, 48, 'anim', swirl)
    for poly in disc.data.polygons:                        # planar UVs over the top
        for li in poly.loop_indices:
            co = disc.data.vertices[disc.data.loops[li].vertex_index].co
            disc.data.uv_layers.active.data[li].uv = (0.5 + co.x / 2.84, 0.5 + co.y / 2.84)
    spin(swirl, -0.5)
    for k in range(9):
        a = k * TAU / 9 + 0.3
        qx, qy = Q(cx, cy, math.cos(a) * 1.62, math.sin(a) * 1.62)
        h = 0.32 + 0.24 * ((k * 7) % 3)
        c = cyl(qx, qy, 0, 0.08, h, M['violet'], 6)
        c.rotation_euler = (math.radians(14 * math.cos(a)), math.radians(14 * math.sin(a)), 0)
        cone(qx, qy, h, 0.08, 0, 0.12, M['violet'], 6).rotation_euler = c.rotation_euler
    star = pivot('pool-star', cx, cy, 1.2)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.16, location=(0, 0, 0))
    own(bpy.context.object, M['star'], 'anim', star)
    for k in range(6):
        a = k * math.pi / 3
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.055, radius2=0, depth=0.24,
                                        location=(math.cos(a) * 0.2, 0, math.sin(a) * 0.2), rotation=(0, math.pi / 2 - a, 0))
        own(bpy.context.object, M['star'], 'anim', star)
    star.rotation_euler = (0, 0, math.radians(45))
    spin(star, 1)
    bob(star, 0.12, 2)
    # ---- the ringed planet hologram over the notch between the top hexes ----
    cyl(96, 32, 0, 0.26, 0.14, M['dark'], 16)
    cyl(96, 32, 0.14, 0.16, 0.05, M['cyan'], 16)
    for k in range(3):
        a = k * TAU / 3
        rail(Q(96, 32, math.cos(a) * 0.14, math.sin(a) * 0.14), Q(96, 32, math.cos(a) * 0.05, math.sin(a) * 0.05), 0.4 + k * 0.3, 0.006, M['cyan'])
    planet = pivot('planet', 96, 30, 2.15)
    ball(96, 30, 2.15, 0.42, M['planet'], 'anim', planet, seg=24)
    for z, r in ((0.13, 0.4), (-0.12, 0.405)):
        torus(96, 30, 2.15 + z, r, 0.035, M['planet_band'], parent=planet, tag='anim')
    planet.rotation_euler = (math.radians(18), math.radians(-12), 0)
    keys(planet, 'rotation_euler', 2, lambda t: TAU * t, steps=8)
    torus(96, 30, 2.15, 0.72, 0.04, M['ring'], rot=(math.radians(68), math.radians(-18), 0))
    torus(96, 30, 2.15, 0.62, 0.015, M['ring'], rot=(math.radians(68), math.radians(-18), 0))
    moons = pivot('planet-moons', 96, 30, 2.15)
    ball(*Q(96, 30, 1.05, 0), 2.35, 0.1, M['violet'], 'anim', moons, seg=12)
    ball(*Q(96, 30, -0.95, 0), 1.98, 0.075, M['ring'], 'anim', moons, seg=10)
    saucer = pivot('saucer', *Q(96, 30, 1.45, 0), 2.6, moons)
    sx_, sy_ = Q(96, 30, 1.45, 0)
    ball(sx_, sy_, 2.6, 0.22, M['metal'], 'anim', saucer, scale=(1, 1, 0.22), seg=16)
    ball(sx_, sy_, 2.65, 0.1, M['glass'], 'anim', saucer, seg=12)
    for k in range(6):
        a = k * TAU / 6
        ball(*Q(sx_, sy_, math.cos(a) * 0.19, math.sin(a) * 0.19), 2.58, 0.022, M['amber'], 'anim', saucer, seg=6)
    spin(moons, 1)
    bob(saucer, 0.06, 4)
    # ---- the nutrient tower (auto-feed, hex D right) and the cleaning drone ----
    tx, ty = 220, 128
    cyl(tx, ty, 0, 0.44, 0.18, M['metal'], 24)
    torus(tx, ty, 0.18, 0.44, 0.025, M['cyan'])
    for k in range(4):
        a = k * TAU / 4 + TAU / 8
        cyl(*Q(tx, ty, math.cos(a) * 0.3, math.sin(a) * 0.3), 0.18, 0.025, 1.1, M['metal'], 8)
    for z in (0.5, 0.85):
        torus(tx, ty, z, 0.3, 0.018, M['metal'])
    cyl(tx, ty, 0.18, 0.2, 1.1, M['glass'], 16)
    caps = [pivot(f'nutrient-capsules-{k}', tx, ty, 0.3) for k in range(2)]
    for k in range(6):
        ball(*Q(tx, ty, ((k % 2) - 0.5) * 0.12, 0.2), 0.3 + k * 0.16, 0.075, M['green'], 'anim', caps[k % 2], scale=(1, 1, 1.35), seg=10)
    bob(caps[0], 0.07, 2)
    bob(caps[1], 0.07, 2, 0.5)
    cyl(tx, ty, 1.28, 0.38, 0.14, M['metal'], 24)
    torus(tx, ty, 1.3, 0.38, 0.03, M['cyan'])
    cone(tx, ty, 1.42, 0.2, 0.06, 0.2, M['dark'], 16)
    top = pivot('nutrient-light', tx, ty, 1.66)
    ball(tx, ty, 1.66, 0.08, M['green'], 'anim', top, seg=10)
    pulse(top, 0.4, 4)
    bx, by = Q(tx, ty, 0, 0.55)
    cyl(bx, by, 0, 0.28, 0.1, M['dark'], 24)
    ball(bx, by, 0.11, 0.22, M['green'], scale=(1, 1, 0.28), seg=16)
    drone = pivot('cleaning-drone-path', 200, 152, 0.0)
    dpx, dpy = Q(200, 152, 0.62, 0)
    hover = pivot('cleaning-drone', dpx, dpy, 0.72, drone)
    cyl(dpx, dpy, 0.7, 0.24, 0.06, M['hull'], 24, 'anim', hover)
    torus(dpx, dpy, 0.73, 0.24, 0.025, M['cyan'], parent=hover, tag='anim')
    ball(dpx, dpy, 0.79, 0.08, M['dark'], 'anim', hover, seg=10)
    ball(*Q(dpx, dpy, 0, 0.08), 0.8, 0.03, M['cyan'], 'anim', hover, seg=8)
    for s in (-1, 1):
        cyl(*Q(dpx, dpy, s * 0.26, 0), 0.74, 0.08, 0.015, M['metal'], 12, 'anim', hover)
    spin(drone, 1)
    bob(hover, 0.06, 4)
    # ---- the teleporter (hex C) ----
    cyl(70, 150, 0, 0.84, 0.03, M['dark'], 40)
    tp = pivot('teleporter', 70, 150, 0.03)
    torus(70, 150, 0.04, 0.8, 0.025, M['violet'], parent=tp, tag='anim')
    for k in range(6):
        a = k * TAU / 6
        box(*Q(70, 150, math.cos(a) * 0.62, math.sin(a) * 0.62), 0.03, (0.16, 0.05, 0.02), M['cyan'], -a, 'anim', tp)
    spin(tp, 1)
    core = pivot('teleporter-core', 70, 150, 0.04)
    torus(70, 150, 0.05, 0.42, 0.02, M['cyan'], parent=core, tag='anim')
    pulse(core, 0.12, 4)
    # ---- corner crystals and alien bulb plants ----
    corners = offset_outline(0.62)
    for i in range(len(outline)):
        q = native(corners[i])
        if L.obstacle_hit(EDITION, *q, 0.3):
            continue
        if i % 2:
            for k in range(5):
                a = k * 2.1
                c = cyl(*Q(*q, math.cos(a) * 0.12, math.sin(a) * 0.09), 0, 0.07, 0.3 + 0.13 * k, M['violet'], 6)
                c.rotation_euler = (math.radians(16 * math.cos(a)), math.radians(16 * math.sin(a)), 0)
        else:
            for k, (du, dw) in enumerate(((0, 0), (0.18, 0.1), (-0.15, 0.13))):
                hgt = 0.6 - k * 0.13
                x, y = Q(*q, du, dw)
                cyl(x, y, 0, 0.025, hgt, M['stem'], 6)
                ball(x, y, hgt + 0.06, 0.09 - k * 0.015, M['pink'] if k % 2 else M['cyan'], seg=10)


(royal_ranch if ROYAL else stellar_zoo)()

# ---- shading, light and camera ---------------------------------------------------------------------
for o in objects:
    if o.type == 'MESH':
        for poly in o.data.polygons:
            poly.use_smooth = True
        try:
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
            o.select_set(False)
        except Exception:
            pass

world = bpy.data.worlds.new('w'); world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.42, 0.40, 0.55, 1); bg.inputs[1].default_value = 0.9
scene.world = world
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.color = (1.0, 0.95, 0.86); sun.angle = math.radians(4)
so = bpy.data.objects.new('sun', sun); scene.collection.objects.link(so)
so.rotation_euler = Vector((-15, -8, 35)).normalized().to_track_quat('Z', 'Y').to_euler()

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for dv in prefs.devices:
        dv.use = dv.type == 'OPTIX'
    scene.cycles.device = 'GPU'
except Exception as exc:
    print('GPU unavailable', exc)

if WANT_GLB:
    # Bake the props' ambient occlusion into the ground, then multiply it into the painted ground.
    import numpy as np
    W, H = ground_img.size
    ao = bpy.data.images.new(f'{FIELD}-ao', W, H, alpha=False, float_buffer=True)
    ao_node = gm.node_tree.nodes.new('ShaderNodeTexImage'); ao_node.image = ao
    for n in gm.node_tree.nodes:
        n.select = False
    ao_node.select = True; gm.node_tree.nodes.active = ao_node
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    plate.select_set(True); bpy.context.view_layer.objects.active = plate
    scene.cycles.samples = 64
    scene.cycles.bake_type = 'AO'
    scene.world.light_settings.distance = 1.2
    bpy.ops.object.bake(type='AO', margin=4, use_clear=True)
    a = np.array(ao.pixels[:], dtype=np.float32).reshape(H, W, 4)[..., 0]
    g = np.array(ground_img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    shade = np.clip(0.42 + 0.58 * a, 0, 1) ** 0.9
    g[..., :3] *= shade[..., None]
    g[..., 3] = 1.0
    baked = bpy.data.images.new(f'{FIELD}-ground', W, H, alpha=False)
    baked.pixels[:] = g.ravel()
    baked.file_format = 'JPEG'
    baked.pack()
    tn.image = baked
    gm.node_tree.nodes.remove(ao_node)

# Animate the plate's rim nodes and statics: join statics by material, each rim edge into one node.
def join(objs, name):
    if not objs:
        return None
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1:
        bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = name
    j.data.name = name
    return j


groups = {}
for o in objects:
    if o.type != 'MESH':
        continue
    tag = o['tag']
    if tag == 'static':
        groups.setdefault(('static', o.data.materials[0].name), []).append(o)
    elif tag.startswith('rim-joint'):
        groups.setdefault((tag, ''), []).append(o)
    elif tag == 'anim':
        groups.setdefault(('anim', o.parent.name, o.data.materials[0].name), []).append(o)
for key, objs in groups.items():
    if key[0] == 'static':
        join(objs, f'{FIELD}-{key[1].removeprefix(FIELD + "-")}')
    elif key[0].startswith('rim-joint'):
        join(objs, f'{FIELD}-{key[0]}')
    else:
        join(objs, f'{key[1]}-{key[2].removeprefix(FIELD + "-")}')

if WANT_PREVIEW:
    target = root.matrix_world @ P(120, 100, 0.6)
    pitch = math.radians(40)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = 17.5
    cam = bpy.data.objects.new('cam', cd); scene.collection.objects.link(cam); scene.camera = cam
    d = Vector((math.cos(pitch) / math.sqrt(2), -math.cos(pitch) / math.sqrt(2), math.sin(pitch)))
    cam.location = target + d * 40
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cd.clip_end = 200
    scene.frame_set(18)
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1300
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.render.filepath = os.path.join(OUTDIR, f'{FIELD}_preview.png')
    bpy.ops.render.render(write_still=True)
    scene.frame_set(0)

if WANT_GLB:
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    keep = [root] + [o for o in root.children_recursive]
    for o in keep:
        o.select_set(True)
    out = os.path.join(OUTDIR, f'{FIELD}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='JPEG',
                              export_jpeg_quality=88, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, export_draco_position_quantization=16,
                              export_animations=True, export_animation_mode='SCENE', export_frame_range=True,
                              export_force_sampling=True, export_optimize_animation_size=True, export_extras=False,
                              export_cameras=False, export_lights=False)
    tris = sum(len(o.data.loop_triangles) if (o.data.calc_loop_triangles() or True) else 0 for o in keep if o.type == 'MESH')
    print('ROYAL_GLB', FIELD, out, os.path.getsize(out), 'nodes', len(keep), 'tris', tris)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTDIR, f'{FIELD}.blend'))
print('ROYAL_MAP_DONE', FIELD)
