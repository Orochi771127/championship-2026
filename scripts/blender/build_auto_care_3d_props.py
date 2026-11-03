# Blender 5.2 CLI producer for the ranch auto-care props (Owner 2026-11-03, AUTO_CARE_3D_20261103).
#
#   blender -b --factory-startup --python scripts/blender/build_auto_care_3d_props.py -- \
#     --out assets/production/items/auto-care-3d-r1 [--icons] [--device GPU]
#
# Writes auto_cleaner_bot.glb and auto_feeder_tower.glb (glTF Y-up, 1 unit = one ranch world
# unit = 16 * sqrt(2) native pixels), and with --icons the three bag/gacha icons rendered from
# the same models (auto_clean_core_160.png, auto_feed_core_160.png, auto_royal_core_160.png).
# Every part the game animates is its own named node with its pivot at its own origin:
#   cleaner: Body, Brush_L, Brush_R, Sensor, Halo, Light_Tail
#   feeder:  Base, BaseRing, Hopper, Meat_Store, Turret (yaw pivot), Nozzle, Muzzle, Meat (template)
# Original design: plain primitives, no reference art.
import argparse, math, os, sys
import bpy, bmesh
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--out", required=True)
parser.add_argument("--icons", action="store_true")
parser.add_argument("--device", default="GPU")
args = parser.parse_args(argv)
OUT = os.path.abspath(args.out)
os.makedirs(OUT, exist_ok=True)

# ---- palette (linear-ish sRGB picks) ----
TITANIUM = (0.86, 0.89, 0.93, 1)      # 心輝鈦白
GRAPHITE = (0.10, 0.12, 0.17, 1)
CYAN = (0.05, 0.85, 1.0, 1)           # 電光青
GREEN = (0.25, 1.0, 0.45, 1)
AMBER = (1.0, 0.68, 0.12, 1)          # 琥珀金
MEAT = (0.78, 0.28, 0.18, 1)
BONE = (0.97, 0.93, 0.84, 1)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, *, metal=0.0, rough=0.45, emit=0.0, alpha=1.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = color
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if emit > 0:
        p.inputs["Emission Color"].default_value = color
        p.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        p.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED" if hasattr(m, "surface_render_method") else None
    if transmission > 0:
        p.inputs["Transmission Weight"].default_value = transmission
    return m


def mesh_object(name, build, mat, parent=None, location=(0, 0, 0)):
    """build(bm) fills a bmesh in Blender Z-up local space."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    build(bm)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    ob.location = location
    if parent is not None:
        ob.parent = parent
    return ob


def cyl(bm, r1, r2, depth, z=0.0, segs=40):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=depth)
    bmesh.ops.translate(bm, verts=res["verts"], vec=(0, 0, z + depth / 2))
    return res


def torus(bm, major, minor, z=0.0, segs=48, ring=12):
    verts = []
    rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            r = major + minor * math.cos(b)
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z + minor * math.sin(b))))
        rings.append(row)
    for i in range(segs):
        for j in range(ring):
            a, b = rings[i][j], rings[(i + 1) % segs][j]
            c, d = rings[(i + 1) % segs][(j + 1) % ring], rings[i][(j + 1) % ring]
            bm.faces.new((a, b, c, d))
    return verts


def sphere(bm, r, z=0.0, scale=(1, 1, 1), segs=32, rings=16):
    res = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    bmesh.ops.scale(bm, verts=res["verts"], vec=scale)
    bmesh.ops.translate(bm, verts=res["verts"], vec=(0, 0, z))
    return res


def bevel_box(bm, sx, sy, sz, z=0.0):
    res = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=res["verts"], vec=(sx, sy, sz))
    bmesh.ops.translate(bm, verts=res["verts"], vec=(0, 0, z + sz / 2))
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges], offset=min(sx, sy, sz) * 0.18, segments=3, affect="EDGES")
    return res


# ---------------------------------------------------------------- cleaner bot
def build_cleaner():
    reset()
    shell = material("CleanerShell", TITANIUM, metal=0.35, rough=0.28)
    trim = material("CleanerTrim", GRAPHITE, metal=0.2, rough=0.55)
    cyan = material("CleanerCyan", CYAN, emit=4.0, rough=0.2)
    green = material("CleanerHalo", GREEN, emit=5.0, rough=0.2)
    brushmat = material("CleanerBrush", (0.20, 0.55, 0.85, 1), rough=0.7)

    root = bpy.data.objects.new("AutoCleanerBot", None)
    bpy.context.scene.collection.objects.link(root)

    # Body: a low disc with a domed armoured lid; forward is +X (glTF +X; the game turns it).
    def body(bm):
        cyl(bm, 0.55, 0.55, 0.10, z=0.04, segs=56)            # skirt
        cyl(bm, 0.55, 0.50, 0.12, z=0.14, segs=56)            # shoulder
        sphere(bm, 0.50, z=0.24, scale=(1, 1, 0.22), segs=48, rings=12)  # dome
    b = mesh_object("Body", body, shell, root)

    def bumper(bm):
        # front bumper arc (graphite) spanning -60..60 degrees
        segs = 20
        for i in range(segs):
            a0 = math.radians(-62 + 124 * i / segs)
            a1 = math.radians(-62 + 124 * (i + 1) / segs)
            ring = []
            for a in (a0, a1):
                for r, z in ((0.555, 0.05), (0.60, 0.05), (0.60, 0.17), (0.555, 0.17)):
                    ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
            q = ring
            for k in range(4):
                bm.faces.new((q[k], q[(k + 1) % 4], q[4 + (k + 1) % 4], q[4 + k]))
    mesh_object("Bumper", bumper, trim, b)

    def sensor(bm):
        # glowing sensor light bar across the bumper face
        segs = 16
        for i in range(segs):
            a0 = math.radians(-40 + 80 * i / segs)
            a1 = math.radians(-40 + 80 * (i + 1) / segs)
            q = []
            for a in (a0, a1):
                for r, z in ((0.603, 0.095), (0.62, 0.095), (0.62, 0.125), (0.603, 0.125)):
                    q.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
            for k in range(4):
                bm.faces.new((q[k], q[(k + 1) % 4], q[4 + (k + 1) % 4], q[4 + k]))
    mesh_object("Sensor", sensor, cyan, b)

    def halo(bm):
        torus(bm, 0.31, 0.04, z=0.345)
    mesh_object("Halo", halo, green, b)

    def lid_core(bm):
        cyl(bm, 0.14, 0.10, 0.05, z=0.33, segs=32)
    mesh_object("Core", lid_core, cyan, b)

    def tail(bm):
        sphere(bm, 0.035, z=0.0, segs=12, rings=8)
    mesh_object("Light_Tail", tail, cyan, b, location=(-0.56, 0, 0.12))

    # Side brushes: hub + 3 bristle arms, pivot at their own centre (they spin about Z).
    for name, y in (("Brush_L", 0.36), ("Brush_R", -0.36)):
        def brush(bm):
            cyl(bm, 0.05, 0.05, 0.03, z=0.0, segs=16)
            for k in range(3):
                a = 2 * math.pi * k / 3
                res = bmesh.ops.create_cube(bm, size=1.0)
                bmesh.ops.scale(bm, verts=res["verts"], vec=(0.20, 0.022, 0.012))
                bmesh.ops.translate(bm, verts=res["verts"], vec=(0.10, 0, 0.006))
                bmesh.ops.rotate(bm, verts=res["verts"], cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, "Z"))
        mesh_object(name, brush, brushmat, b, location=(0.34, y, 0.012))
    return root


# ---------------------------------------------------------------- feeder tower
def build_feeder():
    reset()
    shell = material("FeederShell", TITANIUM, metal=0.3, rough=0.3)
    trim = material("FeederTrim", GRAPHITE, metal=0.25, rough=0.5)
    amber = material("FeederAmber", AMBER, emit=4.5, rough=0.2)
    glass = material("FeederGlass", (0.55, 0.95, 1.0, 1), rough=0.05, alpha=0.32, transmission=0.6)
    meat = material("FeederMeat", MEAT, rough=0.55)
    bone = material("FeederBone", BONE, rough=0.4)
    cyan = material("FeederCyan", CYAN, emit=3.5, rough=0.2)

    root = bpy.data.objects.new("AutoFeederTower", None)
    bpy.context.scene.collection.objects.link(root)

    def base(bm):
        cyl(bm, 0.50, 0.46, 0.14, z=0.0, segs=48)
        cyl(bm, 0.40, 0.30, 0.20, z=0.14, segs=48)
        cyl(bm, 0.30, 0.30, 0.06, z=0.34, segs=48)
    b = mesh_object("Base", base, shell, root)

    def ring(bm):
        torus(bm, 0.47, 0.03, z=0.10)
    mesh_object("BaseRing", ring, amber, b)

    def collar(bm):
        cyl(bm, 0.33, 0.33, 0.05, z=0.38, segs=48)
        cyl(bm, 0.33, 0.33, 0.05, z=1.10, segs=48)
    mesh_object("Collars", collar, trim, b)

    def hopper(bm):
        # capsule store: open cylinder + top hemisphere, transparent
        cyl(bm, 0.30, 0.30, 0.68, z=0.43, segs=48)
    mesh_object("Hopper", hopper, glass, b)

    def store(bm):
        # meat chunks visible inside the store
        for i, (x, y, z, s) in enumerate(((0.10, 0.05, 0.52, 0.11), (-0.10, 0.08, 0.53, 0.10), (0.02, -0.12, 0.54, 0.10),
                                          (-0.06, -0.02, 0.66, 0.11), (0.11, -0.06, 0.68, 0.09), (0.0, 0.12, 0.70, 0.09),
                                          (-0.12, -0.10, 0.74, 0.08), (0.06, 0.04, 0.82, 0.10))):
            res = sphere(bm, s, z=z, scale=(1.15, 0.9, 0.85), segs=14, rings=8)
            bmesh.ops.translate(bm, verts=res["verts"], vec=(x, y, 0))
    mesh_object("Meat_Store", store, meat, b)

    # Turret: yaws about Z at the tower axis; the nozzle points along +X.
    turret = bpy.data.objects.new("Turret", None)
    bpy.context.scene.collection.objects.link(turret)
    turret.parent = b
    turret.location = (0, 0, 1.15)

    def head(bm):
        sphere(bm, 0.30, z=0.12, scale=(1, 1, 0.75), segs=40, rings=16)
        cyl(bm, 0.31, 0.31, 0.06, z=0.0, segs=40)
    mesh_object("Head", head, shell, turret)

    def eye(bm):
        torus(bm, 0.16, 0.018, z=0.30)
    mesh_object("HeadRing", eye, cyan, turret)

    nozzle = bpy.data.objects.new("Nozzle", None)
    bpy.context.scene.collection.objects.link(nozzle)
    nozzle.parent = turret
    nozzle.location = (0.18, 0, 0.14)
    nozzle.rotation_euler = (0, math.radians(-28), 0)   # tilted up for the lob

    def barrel(bm):
        res = cyl(bm, 0.10, 0.085, 0.30, z=0.0, segs=24)
        bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
    mesh_object("Barrel", barrel, trim, nozzle)

    def muzzle(bm):
        torus(bm, 0.085, 0.02, z=0.0, segs=24, ring=8)
        bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
    mesh_object("Muzzle", muzzle, amber, nozzle, location=(0.30, 0, 0))

    # Meat projectile template (bone-in), hidden by the game until a throw.
    meat_root = bpy.data.objects.new("Meat", None)
    bpy.context.scene.collection.objects.link(meat_root)
    meat_root.parent = root
    meat_root.location = (0, -1.2, 0.3)

    def chunk(bm):
        sphere(bm, 0.16, z=0.0, scale=(1.25, 0.95, 0.9), segs=20, rings=10)
    mesh_object("Meat_Chunk", chunk, meat, meat_root)

    def bonepart(bm):
        res = cyl(bm, 0.035, 0.035, 0.30, z=-0.15, segs=12)
        bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
        bmesh.ops.translate(bm, verts=bm.verts[:], vec=(0.22, 0, 0))
        for dy in (-0.04, 0.04):
            r = sphere(bm, 0.045, z=0.0, segs=12, rings=8)
            bmesh.ops.translate(bm, verts=r["verts"], vec=(0.38, dy, 0))
    mesh_object("Meat_Bone", bonepart, bone, meat_root)
    return root


def export(name):
    path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True,
                              export_materials="EXPORT", export_cameras=False, export_lights=False)
    print("WROTE", path, os.path.getsize(path))


def use_device(scene, device):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    if device != "GPU":
        return "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "OPTIX"
        if any(d.use for d in prefs.devices):
            scene.cycles.device = "GPU"
            return "OPTIX"
    except Exception as error:  # noqa: BLE001 - fall back to CPU
        print("GPU unavailable:", error)
    return "CPU"


def render_icon(root, filename, *, extra=None, look=(0, 0, 0.35), dist=3.0):
    scene = bpy.context.scene
    device = use_device(scene, args.device)
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 320
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    cam_data = bpy.data.cameras.new("IconCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = dist
    cam = bpy.data.objects.new("IconCam", cam_data)
    scene.collection.objects.link(cam)
    target = Vector(look)
    direction = Vector((1.0, -1.15, 0.95)).normalized()
    cam.location = target + direction * 10
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    key = bpy.data.lights.new("Key", "AREA"); key.energy = 900; key.size = 4
    keyo = bpy.data.objects.new("Key", key); scene.collection.objects.link(keyo)
    keyo.location = (3, -4, 6); keyo.rotation_euler = (Vector((0, 0, 0)) - keyo.location).to_track_quat("-Z", "Y").to_euler()
    fill = bpy.data.lights.new("Fill", "AREA"); fill.energy = 250; fill.size = 6; fill.color = (0.6, 0.7, 1.0)
    fillo = bpy.data.objects.new("Fill", fill); scene.collection.objects.link(fillo)
    fillo.location = (-5, 2, 3); fillo.rotation_euler = (Vector((0, 0, 0)) - fillo.location).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("IconWorld"); world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.35, 0.38, 0.5, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world
    scene.render.filepath = os.path.join(OUT, filename)
    bpy.ops.render.render(write_still=True)
    print("ICON", filename, device)


build_cleaner()
export("auto_cleaner_bot.glb")
if args.icons:
    render_icon(None, "auto_clean_core_160.png", look=(0, 0, 0.14), dist=1.85)

build_feeder()
meat = bpy.data.objects["Meat"]
export("auto_feeder_tower.glb")
if args.icons:
    meat.hide_render = True
    for child in meat.children:
        child.hide_render = True
    render_icon(None, "auto_feed_core_160.png", look=(0, 0, 0.72), dist=1.9)

if args.icons:
    # The royal core: both machines together, a gold-trimmed pair.
    build_feeder()
    for ob in list(bpy.data.objects):
        if ob.name.startswith("Meat") and ob.name != "Meat_Store":
            ob.hide_render = True
    tower = bpy.data.objects["AutoFeederTower"]
    tower.location = (-0.15, 0.35, 0)
    gold = material("RoyalGold", (1.0, 0.78, 0.25, 1), metal=0.9, rough=0.25)
    for ob in tower.children_recursive:
        if ob.type == "MESH" and ob.name in ("Collars",):
            ob.data.materials[0] = gold
    path = os.path.join(OUT, "auto_cleaner_bot.glb")
    bpy.ops.import_scene.gltf(filepath=path)
    bot = bpy.data.objects["AutoCleanerBot"]
    # glTF import gives Y-up converted back to Z-up; place it in front.
    bot.location = (0.45, -0.45, 0)
    bot.scale = (0.85, 0.85, 0.85)
    render_icon(None, "auto_royal_core_160.png", look=(0.1, 0, 0.6), dist=2.3)
