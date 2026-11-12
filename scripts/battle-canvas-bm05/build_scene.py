"""Build and render the scenery ring of the BM05 battle canvas (Blender 5.2, headless).

    blender -b --factory-startup --python scripts/battle-canvas-bm05/build_scene.py -- \
        --work <work dir> --blend <master-canvas.blend> [--samples 96] [--no-render]

Needs <work dir>/sea-colour.png from sea_map.py.  Writes the .blend, then
<work dir>/ring.png (the whole 2304x2240 canvas; compose.py keeps only the ring
outside the play area) and <work dir>/ring-sea.png (white where open sea shows).

Camera: the locked 52 degree orthographic view of the R1 arenas with the same
centre and the same scale per pixel; only the frame is larger (ortho scale 36).
Look: matched to the live play-area picture (bm05-southpole-polish-r2): flat
shaded ice with white caps, smooth snow mounds, slate rocks, a sea that lightens
near the shelf.  No source raster is loaded; all geometry is procedural.
"""
import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import layout as L  # noqa: E402

ROOT2 = math.sqrt(2)
EX = Vector((1, 1, 0)) / (L.UNIT * ROOT2)                      # world step per native pixel of screen X
EY = Vector((1 / L.SIN_E, -1 / L.SIN_E, 0)) / (L.UNIT * ROOT2)  # world step per native pixel of ground depth

# Light: one sun with soft shadows, sky fill, and a low shadowless fill from the camera side so
# faces turned away from the sun stay readable (as in the play-area picture).
SUN_STRENGTH = 1.53
SUN_COLOUR = (1.0, 1.0, .93)
SKY = (.344, .431, .541)
FILL_STRENGTH = .15
FILL_COLOUR = (.80, .90, 1.0)
LIGHT_FLAT = (.765, .862, .933)    # light on level sunlit ground, used to turn target colours into albedo
OWN_LIGHT = .6                     # faceted ice: share of the picked colour shown as its own light
DIFFUSE_SHARE = .45                # ... and the share that still takes sun and cast shadows

MATS = {}


def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def lin(rgb):
    return tuple(srgb_to_linear(v) for v in rgb)


def world(x, y, z=0.0):
    """Native pixel (x, y) on the ground plane, at height z."""
    return Vector(((x + y / L.SIN_E) / (L.UNIT * ROOT2), (x - y / L.SIN_E) / (L.UNIT * ROOT2), z))


def P(X, Y, z=0.0):
    """World point that shows at base pixel (X, Y) when it is at height z."""
    return world(X / L.SCALE, (Y + L.LIFT * z) / L.SCALE, z)


def GP(point, z0, dz=0.0):
    """Point dz above (or below) the foot point that shows at ``point`` on level z0."""
    return P(point[0], point[1] - L.LIFT * dz, z0 + dz)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


TO_SUN = (world(*L.SUN_FROM) - world(*L.SUN_AT)).normalized()


# --------------------------------------------------------------------------- materials

def faceted_material(name, shade_rgb, lit_rgb, ramp=(-.15, .65), mottle=0.08, mottle_scale=3.2, grain=0.03,
                     own=None, share=None, smooth=False):
    """Flat-shaded ice or packed snow with art-directed colours for faces turned from / to the sun.

    The play-area picture keeps shaded ice dark and saturated, which plain diffuse light does not
    give.  Colour is picked by the face normal against the sun, then shown mostly as its own light
    (so the pick holds) with a diffuse share so cast shadows still fall on it.
    """
    own = OWN_LIGHT if own is None else own
    share = DIFFUSE_SHARE if share is None else share
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    geometry = nodes.new('ShaderNodeNewGeometry')
    facing = nodes.new('ShaderNodeVectorMath')
    facing.operation = 'DOT_PRODUCT'
    facing.inputs[1].default_value = tuple(TO_SUN)
    links.new(geometry.outputs['Normal' if smooth else 'True Normal'], facing.inputs[0])
    amount = nodes.new('ShaderNodeMapRange')
    amount.interpolation_type = 'SMOOTHSTEP'
    amount.inputs['From Min'].default_value = ramp[0]
    amount.inputs['From Max'].default_value = ramp[1]
    links.new(facing.outputs['Value'], amount.inputs['Value'])
    pick = nodes.new('ShaderNodeMixRGB')
    # In shade a face shows own light plus a weak diffuse share: divide so it lands on the target.
    shade = tuple(v / (own + share * .32) for v in lin(shade_rgb))
    lit = tuple(v / (own + share * f) for v, f in zip(lin(lit_rgb), LIGHT_FLAT))
    pick.inputs[1].default_value = (*shade, 1)
    pick.inputs[2].default_value = (*lit, 1)
    links.new(amount.outputs['Result'], pick.inputs[0])
    value = None
    for strength, scale, detail in ((mottle, mottle_scale, 2.0), (grain, 90.0, 0.0)):
        if not strength:
            continue
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = scale
        noise.inputs['Detail'].default_value = detail
        links.new(geometry.outputs['Position'], noise.inputs['Vector'])
        remap = nodes.new('ShaderNodeMapRange')
        remap.inputs['From Min'].default_value = .25
        remap.inputs['From Max'].default_value = .75
        remap.inputs['To Min'].default_value = 1 - strength
        remap.inputs['To Max'].default_value = 1 + strength
        links.new(noise.outputs['Fac'], remap.inputs['Value'])
        if value is None:
            value = remap.outputs['Result']
        else:
            both = nodes.new('ShaderNodeMath')
            both.operation = 'MULTIPLY'
            links.new(value, both.inputs[0])
            links.new(remap.outputs['Result'], both.inputs[1])
            value = both.outputs[0]
    colour = pick.outputs[0]
    if value is not None:
        tint = nodes.new('ShaderNodeVectorMath')
        tint.operation = 'SCALE'
        links.new(colour, tint.inputs[0])
        links.new(value, tint.inputs['Scale'])
        colour = tint.outputs['Vector']
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Roughness'].default_value = 0.0
    part = nodes.new('ShaderNodeVectorMath')
    part.operation = 'SCALE'
    part.inputs['Scale'].default_value = share
    links.new(colour, part.inputs[0])
    links.new(part.outputs['Vector'], diffuse.inputs['Color'])
    glow = nodes.new('ShaderNodeEmission')
    glow.inputs['Strength'].default_value = own
    links.new(colour, glow.inputs['Color'])
    add = nodes.new('ShaderNodeAddShader')
    links.new(diffuse.outputs['BSDF'], add.inputs[0])
    links.new(glow.outputs['Emission'], add.inputs[1])
    links.new(add.outputs['Shader'], out.inputs['Surface'])
    MATS[name] = mat
    return mat


def material(name, albedo, emission=(0, 0, 0), mottle=0.0, mottle_scale=2.2, grain=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Roughness'].default_value = 0.0
    colour = diffuse.inputs['Color']
    colour.default_value = (*albedo, 1)
    if mottle or grain:
        geometry = nodes.new('ShaderNodeNewGeometry')
        value = None
        for amount, scale, detail in ((mottle, mottle_scale, 2.0), (grain, 90.0, 0.0)):
            if not amount:
                continue
            noise = nodes.new('ShaderNodeTexNoise')
            noise.inputs['Scale'].default_value = scale
            noise.inputs['Detail'].default_value = detail
            links.new(geometry.outputs['Position'], noise.inputs['Vector'])
            remap = nodes.new('ShaderNodeMapRange')
            remap.inputs['From Min'].default_value = .25
            remap.inputs['From Max'].default_value = .75
            remap.inputs['To Min'].default_value = 1 - amount
            remap.inputs['To Max'].default_value = 1 + amount
            links.new(noise.outputs['Fac'], remap.inputs['Value'])
            if value is None:
                value = remap.outputs['Result']
            else:
                both = nodes.new('ShaderNodeMath')
                both.operation = 'MULTIPLY'
                links.new(value, both.inputs[0])
                links.new(remap.outputs['Result'], both.inputs[1])
                value = both.outputs[0]
        tint = nodes.new('ShaderNodeVectorMath')
        tint.operation = 'SCALE'
        tint.inputs[0].default_value = albedo
        links.new(value, tint.inputs['Scale'])
        links.new(tint.outputs['Vector'], colour)
    shader = diffuse.outputs['BSDF']
    if any(emission):
        glow = nodes.new('ShaderNodeEmission')
        glow.inputs['Color'].default_value = (*emission, 1)
        glow.inputs['Strength'].default_value = 1.0
        add = nodes.new('ShaderNodeAddShader')
        links.new(shader, add.inputs[0])
        links.new(glow.outputs['Emission'], add.inputs[1])
        shader = add.outputs['Shader']
    links.new(shader, out.inputs['Surface'])
    MATS[name] = mat
    return mat


def sea_material(image_path):
    mat = bpy.data.materials.new('sea')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Roughness'].default_value = 0.0
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(image_path), check_existing=False)
    tex.image.pack()
    tex.extension = 'EXTEND'
    tex.interpolation = 'Cubic'
    scale = nodes.new('ShaderNodeVectorMath')
    scale.operation = 'MULTIPLY'
    scale.inputs[1].default_value = tuple(1 / v for v in LIGHT_FLAT)
    links.new(tex.outputs['Color'], scale.inputs[0])
    links.new(scale.outputs['Vector'], diffuse.inputs['Color'])
    links.new(diffuse.outputs['BSDF'], out.inputs['Surface'])
    MATS['sea'] = mat
    return mat


def rock_material():
    """Slate with snow lying on the upward faces."""
    mat = bpy.data.materials.new('rock')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    geometry = nodes.new('ShaderNodeNewGeometry')
    sep = nodes.new('ShaderNodeSeparateXYZ')
    links.new(geometry.outputs['True Normal'], sep.inputs[0])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 5.0
    noise.inputs['Detail'].default_value = 1.0
    links.new(geometry.outputs['Position'], noise.inputs['Vector'])
    lift = nodes.new('ShaderNodeMath')
    lift.operation = 'MULTIPLY_ADD'
    lift.inputs[1].default_value = .9
    lift.inputs[2].default_value = -.45
    links.new(noise.outputs['Fac'], lift.inputs[0])
    lying = nodes.new('ShaderNodeMath')
    lying.operation = 'ADD'
    links.new(sep.outputs['Z'], lying.inputs[0])
    links.new(lift.outputs[0], lying.inputs[1])
    snow = nodes.new('ShaderNodeMath')
    snow.operation = 'GREATER_THAN'
    snow.inputs[1].default_value = .62
    links.new(lying.outputs[0], snow.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB')
    mix.inputs[1].default_value = (.070, .105, .140, 1)
    mix.inputs[2].default_value = (.92, .94, .96, 1)
    links.new(snow.outputs[0], mix.inputs[0])
    links.new(mix.outputs[0], diffuse.inputs['Color'])
    links.new(diffuse.outputs['BSDF'], out.inputs['Surface'])
    MATS['rock'] = mat
    return mat


def make_materials(sea_image):
    # Snow: level ground stays fully lit; a mound's far flank greys toward blue as in the play area.
    faceted_material('snow', (127, 138, 150), (210, 226, 239), ramp=(.25, .84), mottle=.03, mottle_scale=1.1, grain=.012,
                     own=.15, share=.95, smooth=True)
    faceted_material('cap', (174, 196, 220), (229, 237, 242), ramp=(.48, .92), mottle=.02, mottle_scale=3.0, grain=.015)
    faceted_material('ice-berg', (48, 118, 168), (172, 209, 238), ramp=(-.3, .35), mottle=.11, mottle_scale=4.0, grain=.05)
    faceted_material('ice-crag', (44, 130, 190), (120, 172, 200), ramp=(-.25, .45), mottle=.16, mottle_scale=2.4, grain=.05)
    material('slab', (.125, .165, .195), mottle=.06, mottle_scale=4.0)
    rock_material()
    sea_material(sea_image)


# --------------------------------------------------------------------------- mesh helpers

def mesh_object(name, verts, faces, face_mats, slots, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for slot in slots:
        mesh.materials.append(MATS[slot])
    for poly, index in zip(mesh.polygons, face_mats):
        poly.material_index = index
        poly.use_smooth = smooth
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj['canvasLayer'] = 'ring'
    return obj


def split(a, b, c, d, flip):
    """Two triangles for quad a-b-c-d; ``flip`` picks the diagonal, so facets vary."""
    return [(a, b, c), (a, c, d)] if flip else [(a, b, d), (b, c, d)]


# --------------------------------------------------------------------------- ice

def build_ice(item):
    rows = L.resolve_ice(item)
    G, hc, ha, z0, name = item['G'], item['hc'], item['ha'], item['z0'], item['name']
    berg = item['kind'] != 'crag'
    n = len(rows)
    verts, faces, mats = [], [], []
    rings = {}

    def ring(key, points):
        rings[key] = len(verts)
        verts.extend(points)

    water = [L.spoke_point(G, a, rw) for a, rw, _ in rows]
    cap = [L.spoke_point(G, a, rc) for a, _, rc in rows]
    mid_t = [(.42 + .22 * L.hash01(name, k, 't')) for k in range(n)]
    mid_z = [(.45 + .25 * L.hash01(name, k, 'z')) for k in range(n)]
    if not berg:                      # crags stand as walls: the mid ring bulges only a little
        mid_t = [.75 + .2 * L.hash01(name, k, 't') for k in range(n)]
    # The cap is a pleated fan: alternate spokes ride high and low, so its facets catch the light apart.
    pleat = .10 if berg else .16
    inner_z = [hc + (ha - hc) * (.58 + pleat * (1 if k % 2 else -1) + .08 * L.hash01(name, k, 'i')) for k in range(n)]
    inner_t = [.5 + .12 * (1 if k % 2 else -1) for k in range(n)]
    ring('sunk', [GP(p, z0, -.3) for p in water])
    ring('water', [GP(p, z0, 0.0) for p in water])
    ring('mid', [GP(lerp(w, c, t), z0, hc * z) for w, c, t, z in zip(water, cap, mid_t, mid_z)])
    ring('cap', [GP(p, z0, hc) for p in cap])
    ring('inner', [GP(lerp(c, G, t), z0, z) for c, t, z in zip(cap, inner_t, inner_z)])
    apex = len(verts)
    verts.append(GP(G, z0, ha))
    for lower, upper, slot in (('sunk', 'water', 0), ('water', 'mid', 0), ('mid', 'cap', 0), ('cap', 'inner', 1)):
        a0, b0 = rings[lower], rings[upper]
        for k in range(n):
            j = (k + 1) % n
            tris = split(a0 + k, a0 + j, b0 + j, b0 + k, L.hash01(name, k, lower) < .5)
            faces += tris
            mats += [slot] * len(tris)
    for k in range(n):
        faces.append((rings['inner'] + k, rings['inner'] + (k + 1) % n, apex))
        mats.append(1)
    return mesh_object(name, verts, faces, mats, ('ice-berg' if berg else 'ice-crag', 'cap'))


def build_floe(x, y, radius, seed):
    count = 8
    spokes = [((k + .5 * L.hash01('floe', seed, k)) * 360 / count, radius * (.75 + .5 * L.hash01('floe', seed, k, 'r')),
               None) for k in range(count)]
    spokes = [(a, rw, rw * .86) for a, rw, _ in spokes]
    return build_ice(dict(name=f'floe-{seed}', kind='berg', z0=0.0, G=(x, y), hc=.16, ha=.2, spokes=spokes))


# --------------------------------------------------------------------------- snow

def build_mound(item):
    """Lobes merged into one smooth body (voxel remesh, then smoothing)."""
    bm = bmesh.new()
    for gx, gy, a, b, c in item['lobes']:
        centre = P(gx, gy, item['z0'])
        made = bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=1.0)
        for v in made['verts']:
            u = v.co.copy()
            v.co = centre + EX * (a / L.SCALE) * u.x + EY * (b / L.SCALE) * u.y + Vector((0, 0, c)) * u.z
    mesh = bpy.data.meshes.new(item['name'])
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(MATS['snow'])
    obj = bpy.data.objects.new(item['name'], mesh)
    bpy.context.collection.objects.link(obj)
    remesh = obj.modifiers.new('merge-lobes', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = .07
    remesh.use_smooth_shade = True
    smooth = obj.modifiers.new('soften', 'SMOOTH')
    smooth.factor = .8
    smooth.iterations = 14
    obj['canvasLayer'] = 'ring'
    return obj


def densify(points, step, jitter, seed):
    out = []
    for k, (a, b) in enumerate(zip(points, points[1:])):
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        parts = max(1, round(length / step))
        for i in range(parts):
            x, y = lerp(a, b, i / parts)
            dy = 0.0 if i == 0 else (L.hash01(seed, k, i) - .5) * 2 * jitter
            out.append((x, y + dy))
    out.append(points[-1])
    return out


def build_land():
    first, last = L.SOUTH_EDGE
    south = densify(L.LAND[first:last], 46, 7, 'south')
    outline = L.LAND[:first] + south + L.LAND[last:]
    n = len(outline)
    top = [P(x, y, L.H_LAND) for x, y in outline]
    bottom = [GP(p, L.H_LAND, -(L.H_LAND + .4)) for p in outline]
    faces = [tuple(range(n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    mesh_object('snow-shelf', top + bottom, faces, [0] * len(faces), ('snow',))
    # The shelf's camera-facing edge: a faceted ice skirt from the snow line down into the sea.
    m = len(south)
    reach = [8 + 24 * L.hash01('reach', k) for k in range(m)]
    drop = L.LIFT * L.H_LAND
    rim = [P(x, y, L.H_LAND + .004) for x, y in south]
    mid = [P(x + (L.hash01('mx', k) - .5) * 10, y + drop * .5 + reach[k] * .45, L.H_LAND * .5) for k, (x, y) in enumerate(south)]
    foot = [P(x + (L.hash01('fx', k) - .5) * 14, y + drop + reach[k] + .2 * L.LIFT, -.2) for k, (x, y) in enumerate(south)]
    back = [P(x, y - 10, L.H_LAND + .004) for x, y in south]
    verts = back + rim + mid + foot
    faces, mats = [], []
    for row, slot in ((0, 1), (1, 0), (2, 0)):
        for k in range(m - 1):
            a = row * m + k
            tris = split(a, a + 1, a + m + 1, a + m, L.hash01('shelf', row, k) < .5)
            faces += tris
            mats += [slot] * len(tris)
    mesh_object('shelf-edge', verts, faces, mats, ('ice-crag', 'snow'))


def build_sea():
    pad = 64
    x0, y0, x1, y1 = L.X0 - pad, L.Y0 - pad, L.X1 + pad, L.Y1 + pad
    verts = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
    obj = mesh_object('sea', verts, [(0, 1, 2, 3)], [0], ('sea',))
    uv = obj.data.uv_layers.new(name='canvas')
    corner = {0: (0, 1), 1: (1, 1), 2: (1, 0), 3: (0, 0)}
    for loop in obj.data.loops:
        uv.data[loop.index].uv = corner[loop.vertex_index]
    obj['canvasLayer'] = 'sea'
    return obj


def build_rock(x, y, radius, height, seed):
    bm = bmesh.new()
    made = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    centre = P(x, y, L.H_LAND)
    for k, v in enumerate(made['verts']):
        u = v.co.copy() * (.82 + .36 * L.hash01('rock', seed, k))
        v.co = centre + EX * (radius / L.SCALE) * u.x + EY * (radius * .7 / L.SCALE) * u.y + Vector((0, 0, height)) * u.z
    mesh = bpy.data.meshes.new(f'rock-{seed}')
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(MATS['rock'])
    obj = bpy.data.objects.new(f'rock-{seed}', mesh)
    bpy.context.collection.objects.link(obj)
    obj['canvasLayer'] = 'ring'
    return obj


def build_slab():
    n = len(L.SLAB)
    top = [P(x, y, L.H_LAND + .012) for x, y in L.SLAB]
    bottom = [P(x, y, L.H_LAND - .05) for x, y in L.SLAB]
    faces = [tuple(range(n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    mesh_object('slab', top + bottom, faces, [0] * len(faces), ('slab',))


# --------------------------------------------------------------------------- scene

def setup_scene(samples):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    device = 'CPU'
    try:
        prefs.compute_device_type = 'OPTIX'
        prefs.get_devices()
        chosen = [dev for dev in prefs.devices if dev.type == 'OPTIX']
        for dev in prefs.devices:
            dev.use = dev in chosen
        if chosen:
            device = 'GPU'
    except Exception as error:  # no GPU: fall back, the picture is the same
        print('OPTIX_UNAVAILABLE', error)
    scene.cycles.device = device
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .01
    scene.cycles.use_denoising = True
    scene.cycles.seed = 0
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs[0].default_value = (*SKY, 1)
    background.inputs[1].default_value = 1.0

    sun_at = world(*L.SUN_AT)
    bpy.ops.object.light_add(type='SUN', location=world(*L.SUN_FROM))
    sun = bpy.context.object
    sun.name = 'sun'
    sun.data.energy = SUN_STRENGTH
    sun.data.color = SUN_COLOUR
    sun.data.angle = .16
    sun.rotation_euler = (sun_at - sun.location).to_track_quat('-Z', 'Y').to_euler()
    centre = world(208, 136)
    toward_camera = Vector((L.COS_E / ROOT2, -L.COS_E / ROOT2, 0)).normalized()
    side = Vector((1, 1, 0)).normalized()
    bpy.ops.object.light_add(type='SUN', location=centre + toward_camera * 30 + side * 12 + Vector((0, 0, 12)))
    fill = bpy.context.object
    fill.name = 'fill'
    fill.data.energy = FILL_STRENGTH
    fill.data.color = FILL_COLOUR
    fill.data.angle = .6
    fill.data.use_shadow = False
    fill.rotation_euler = (centre - fill.location).to_track_quat('-Z', 'Y').to_euler()

    direction = Vector((L.COS_E / ROOT2, -L.COS_E / ROOT2, L.SIN_E))
    bpy.ops.object.camera_add(location=centre + direction * 120)
    camera = bpy.context.object
    camera.name = 'locked-orthographic-camera'
    camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.sensor_fit = 'HORIZONTAL'
    camera.data.ortho_scale = L.NATIVE_CANVAS[0] / L.UNIT
    camera.data.clip_end = 1000
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = L.CANVAS_W, L.CANVAS_H
    scene.render.resolution_percentage = 100
    bpy.context.view_layer.update()
    from bpy_extras.object_utils import world_to_camera_view
    worst = 0.0
    for X, Y in ((0, 0), (L.BASE_W, 0), (L.BASE_W, L.BASE_H), (0, L.BASE_H), (L.X0, L.Y0), (L.X1, L.Y1)):
        p = world_to_camera_view(scene, camera, P(X, Y))
        worst = max(worst, math.dist((p.x * L.CANVAS_W, (1 - p.y) * L.CANVAS_H), (X + L.OX, Y + L.OY)))
    if worst > .02:
        raise ValueError(f'CAMERA_CALIBRATION_FAILED {worst}')
    print('CAMERA_CALIBRATION_PX', worst, 'DEVICE', device)
    return scene


def render(scene, path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def render_sea_mask(scene, path):
    """White where the open sea shows, black elsewhere (antialiased)."""
    def flat(name, value):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        nodes.clear()
        out = nodes.new('ShaderNodeOutputMaterial')
        glow = nodes.new('ShaderNodeEmission')
        glow.inputs['Color'].default_value = (value, value, value, 1)
        links.new(glow.outputs['Emission'], out.inputs['Surface'])
        return mat
    white, black = flat('mask-white', 1.0), flat('mask-black', 0.0)
    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        target = white if obj.get('canvasLayer') == 'sea' else black
        for slot in obj.material_slots:
            slot.material = target
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value = 0.0
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    render(scene, path)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--work', required=True)
    parser.add_argument('--blend', required=True)
    parser.add_argument('--samples', type=int, default=96)
    parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--no-mask', action='store_true')
    args = parser.parse_args(argv)
    work = Path(args.work)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = setup_scene(args.samples)
    make_materials(work / 'sea-colour.png')
    build_sea()
    build_land()
    build_slab()
    for item in L.all_ice():
        build_ice(item)
    for row in L.FLOES:
        build_floe(*row)
    for item in L.MOUNDS:
        build_mound(item)
    for row in L.ROCKS:
        build_rock(*row)
    Path(args.blend).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.blend).resolve()), compress=True)
    print('CANVAS_SCENE_SAVED', args.blend, 'objects', len(scene.objects))
    if args.no_render:
        return
    render(scene, work / 'ring.png')
    if not args.no_mask:
        render_sea_mask(scene, work / 'ring-sea.png')
    print('CANVAS_RING_RENDERED', work)


if __name__ == '__main__':
    main()
