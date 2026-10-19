"""Headless cage polish (local review 2026-10-19): same camera, geometry,
layout and objects as the reviewed master; only lighting, materials and the
render are refined, following the CM06 look the dot candidate set:
  * Cycles 128 samples + denoise, Khronos PBR Neutral, slight exposure lift
  * crisper sun (smaller angle, a little stronger), softer world fill
  * emissive parts brighter; large emitters spill a matching point light
  * indoor floors glossier and a touch brighter; metals sharper
  * outdoor ground and foliage slightly richer in colour
  * a subtle fog-glow halo on the brightest pixels
args: <master.blend> <out.png> [--pad PX]
"""
import bpy, colorsys, mathutils, re, sys

args = sys.argv[sys.argv.index('--') + 1:]
master, out = args[0], args[1]
pad = int(args[args.index('--pad') + 1]) if '--pad' in args else 0
hide = args[args.index('--hide') + 1] if '--hide' in args else None          # shared-edge patches: render without these
segments = args[args.index('--segments') + 1] if '--segments' in args else None  # raster segment of each rim joint
bpy.ops.wm.open_mainfile(filepath=master)
sc = bpy.context.scene
FLOOR = re.compile(r'floor|tile|deck|mat$|-mat|pavement|concrete|plank|parquet|linoleum|platform')
OUTDOOR = re.compile(r'grass|meadow|turf|soil|dirt|sand|leaf|leaves|foliage|crown|frond|moss|hedge|bush|shrub')


def bsdf(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.use_nodes else None


def richer(col, sat=1.12, val=1.03):
    h, s, v = colorsys.rgb_to_hsv(*col[:3])
    r, g, b = colorsys.hsv_to_rgb(h, min(1, s * sat), min(1, v * val))
    return (r, g, b, col[3])


sc.render.engine = 'CYCLES'
sc.cycles.samples = 128
sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'Khronos PBR Neutral'
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.10
for o in sc.objects:
    if o.type == 'LIGHT' and o.data.type == 'SUN':
        o.data.angle = min(o.data.angle, 0.07)
        o.data.energy *= 1.15
if sc.world and sc.world.use_nodes:
    for n in sc.world.node_tree.nodes:
        if n.type == 'BACKGROUND':
            n.inputs[1].default_value *= 0.85

emitters = {}
for m in bpy.data.materials:
    p = bsdf(m)
    if not p: continue
    name = m.name.lower()
    e = p.inputs['Emission Strength'].default_value
    if e > 0:
        p.inputs['Emission Strength'].default_value = min(8.0, e * 1.5)
        emitters[m.name] = p
    metal, rough = p.inputs['Metallic'].default_value, p.inputs['Roughness'].default_value
    if metal >= 0.7:
        p.inputs['Roughness'].default_value = max(0.05, rough * 0.75)
    elif FLOOR.search(name) and metal < 0.3:
        p.inputs['Roughness'].default_value = max(0.25, rough * 0.65)
        p.inputs['Base Color'].default_value = richer(p.inputs['Base Color'].default_value, 1.05, 1.12)
        if 'Coat Weight' in p.inputs:
            p.inputs['Coat Weight'].default_value = max(p.inputs['Coat Weight'].default_value, 0.12)
            p.inputs['Coat Roughness'].default_value = 0.1
    elif OUTDOOR.search(name):
        p.inputs['Base Color'].default_value = richer(p.inputs['Base Color'].default_value)

spills = 0
for o in list(sc.objects):
    if o.type != 'MESH' or o.hide_render: continue
    em = [s.material for s in o.material_slots if s.material and s.material.name in emitters]
    if not em: continue
    p = emitters[em[0].name]
    strength = p.inputs['Emission Strength'].default_value
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    size = max(max(v[i] for v in bb) - min(v[i] for v in bb) for i in range(3))
    if strength < 2.5 or size < 0.4: continue
    col = p.inputs['Emission Color'].default_value
    L = bpy.data.lights.new(f'polish-spill-{o.name}', 'POINT')
    L.energy = max(4.0, min(30.0, 6.0 * strength * size))
    L.color = col[:3]
    L.shadow_soft_size = max(0.15, size * 0.3)
    ob = bpy.data.objects.new(L.name, L)
    c = sum(bb, mathutils.Vector()) / 8
    ob.location = (c.x, c.y, min(v.z for v in bb) + min(0.35, size * 0.4))
    sc.collection.objects.link(ob)
    spills += 1

# Canvas recovery fields keep their visual padding: same camera, larger frame.
if pad:
    cam = sc.camera.data
    W, H = sc.render.resolution_x, sc.render.resolution_y
    scale = (max(W, H) + 2 * pad) / max(W, H)
    sc.render.resolution_x, sc.render.resolution_y = W + 2 * pad, H + 2 * pad
    if cam.type == 'ORTHO': cam.ortho_scale *= scale

if hide:
    for o in sc.objects:
        if re.search(hide, o.name): o.hide_render = True
if segments:
    import json
    from bpy_extras.object_utils import world_to_camera_view
    W, H = sc.render.resolution_x, sc.render.resolution_y
    rec = []
    for o in sc.objects:
        if not o.name.startswith('flush-porcelain-joint') or o.type != 'MESH': continue
        pts = [o.matrix_world @ v.co for v in o.data.vertices]
        a = max(((p, q) for p in pts for q in pts), key=lambda pq: (pq[0] - pq[1]).length)
        ends = []
        for v in a:
            c = world_to_camera_view(sc, sc.camera, mathutils.Vector((v.x, v.y, 0.0)))
            ends.append([round(c.x * W, 2), round((1 - c.y) * H, 2)])
        rec.append({'object': o.name, 'a': ends[0], 'b': ends[1]})
    json.dump({'width': W, 'height': H, 'pad': pad, 'joints': rec}, open(segments, 'w'), indent=1)
tree = getattr(sc, 'compositing_node_group', None)
if tree is None:
    tree = bpy.data.node_groups.new('polish-compositor', 'CompositorNodeTree')
    sc.compositing_node_group = tree
nodes, links = tree.nodes, tree.links
rl = next((n for n in nodes if n.type == 'R_LAYERS'), None) or nodes.new('CompositorNodeRLayers')
gout = next((n for n in nodes if n.bl_idname == 'NodeGroupOutput'), None)
if gout is None:
    gout = nodes.new('NodeGroupOutput')
    if not any(s.in_out == 'OUTPUT' for s in tree.interface.items_tree):
        tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
glare = nodes.new('CompositorNodeGlare')
for k, v in (('Type', 'Fog Glow'), ('Threshold', 1.0), ('Strength', 0.14), ('Size', 0.35)):
    if glare.inputs.get(k) is not None: glare.inputs[k].default_value = v
links.new(rl.outputs['Image'], glare.inputs['Image'])
links.new(glare.outputs['Image'], gout.inputs[0])
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('POLISH_DONE', out, 'spills', spills, 'emitters', len(emitters), 'res', sc.render.resolution_x, sc.render.resolution_y, flush=True)
