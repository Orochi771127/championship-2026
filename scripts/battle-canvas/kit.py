"""Blender kit for the props of a wide battle canvas (Blender 5.2, headless).

The ring's ground is a flat picture (groundlib); this scene holds only what stands on it:
trees, rocks, cliffs, walls, stands.  It is rendered with a transparent film over a shadow
catcher, so the output is the props and their shadows alone (RGBA), to be laid over the
ground picture by compose.py.  Camera: the locked 52 degree orthographic view of the arenas,
same centre and scale per pixel; only the frame is the canvas (ortho scale 54).

Shapes are authored by where they show on screen (base pixels); see canvaslib.
"""
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

import canvaslib as C

ROOT2 = math.sqrt(2)
EX = Vector((1, 1, 0)) / (C.UNIT * ROOT2)                      # world step per native pixel of screen X
EY = Vector((1 / C.SIN_E, -1 / C.SIN_E, 0)) / (C.UNIT * ROOT2)  # world step per native pixel of ground depth

SUN_STRENGTH = 1.53
SUN_COLOUR = (1.0, 1.0, .93)
SKY = (.344, .431, .541)
FILL_STRENGTH = .15
FILL_COLOUR = (.80, .90, 1.0)
LIGHT_FLAT = (.765, .862, .933)    # light on level sunlit ground: turns a wanted colour into an albedo


def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def lin(rgb):
    return tuple(srgb_to_linear(v) for v in rgb)


def world(x, y, z=0.0):
    """Native pixel (x, y) on the ground plane, at height z."""
    return Vector(((x + y / C.SIN_E) / (C.UNIT * ROOT2), (x - y / C.SIN_E) / (C.UNIT * ROOT2), z))


def P(X, Y, z=0.0):
    """World point that shows at base pixel (X, Y) when it is at height z."""
    return world(X / C.SCALE, (Y + C.LIFT * z) / C.SCALE, z)


def GP(point, dz=0.0, z0=0.0):
    """Point dz above the foot point that shows at ``point`` on level z0."""
    return P(point[0], point[1] - C.LIFT * dz, z0 + dz)


TO_SUN = (world(*C.SUN_FROM) - world(*C.SUN_AT)).normalized()


class Kit:
    def __init__(self, work, samples=96):
        self.work = Path(work)
        self.samples = samples
        self.mats = {}
        self.count = 0
        notes = self.work / 'notes.json'
        self.notes = json.loads(notes.read_text(encoding='utf8')) if notes.exists() else {}
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        self.scene = self._scene()

    # ------------------------------------------------------------------ scene

    def _scene(self):
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
        except Exception as error:  # no GPU: the picture is the same, only slower
            print('OPTIX_UNAVAILABLE', error)
        scene.cycles.device = device
        scene.cycles.samples = self.samples
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = .01
        scene.cycles.use_denoising = True
        scene.cycles.seed = 0
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.image_settings.color_depth = '8'
        scene.render.film_transparent = True
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
        scene.view_settings.exposure = 0.0
        scene.view_settings.gamma = 1.0
        scene.world.use_nodes = True
        background = scene.world.node_tree.nodes.get('Background')
        background.inputs[0].default_value = (*SKY, 1)
        background.inputs[1].default_value = 1.0
        sun_at = world(*C.SUN_AT)
        bpy.ops.object.light_add(type='SUN', location=world(*C.SUN_FROM))
        sun = bpy.context.object
        sun.name = 'sun'
        sun.data.energy = SUN_STRENGTH
        sun.data.color = SUN_COLOUR
        sun.data.angle = .16
        sun.rotation_euler = (sun_at - sun.location).to_track_quat('-Z', 'Y').to_euler()
        centre = world(208, 136)
        toward_camera = Vector((C.COS_E / ROOT2, -C.COS_E / ROOT2, 0)).normalized()
        side = Vector((1, 1, 0)).normalized()
        bpy.ops.object.light_add(type='SUN', location=centre + toward_camera * 30 + side * 12 + Vector((0, 0, 12)))
        fill = bpy.context.object
        fill.name = 'fill'
        fill.data.energy = FILL_STRENGTH
        fill.data.color = FILL_COLOUR
        fill.data.angle = .6
        fill.data.use_shadow = False
        fill.rotation_euler = (centre - fill.location).to_track_quat('-Z', 'Y').to_euler()
        direction = Vector((C.COS_E / ROOT2, -C.COS_E / ROOT2, C.SIN_E))
        bpy.ops.object.camera_add(location=centre + direction * 160)
        camera = bpy.context.object
        camera.name = 'locked-orthographic-camera'
        camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.type = 'ORTHO'
        camera.data.sensor_fit = 'HORIZONTAL'
        camera.data.ortho_scale = C.NATIVE_CANVAS[0] / C.UNIT
        camera.data.clip_end = 2000
        scene.camera = camera
        scene.render.resolution_x, scene.render.resolution_y = C.CANVAS_W, C.CANVAS_H
        scene.render.resolution_percentage = 100
        bpy.context.view_layer.update()
        from bpy_extras.object_utils import world_to_camera_view
        worst = 0.0
        for X, Y in ((0, 0), (C.BASE_W, 0), (C.BASE_W, C.BASE_H), (0, C.BASE_H), (C.X0, C.Y0), (C.X1, C.Y1)):
            p = world_to_camera_view(scene, camera, P(X, Y))
            worst = max(worst, math.dist((p.x * C.CANVAS_W, (1 - p.y) * C.CANVAS_H), (X + C.OX, Y + C.OY)))
        if worst > .02:
            raise ValueError(f'CAMERA_CALIBRATION_FAILED {worst}')
        print('CAMERA_CALIBRATION_PX', worst, 'DEVICE', device)
        return scene

    def ground(self, picture):
        """The ground: a shadow catcher for the render, and the painted picture for whoever opens the file."""
        pad = 96
        corners = [(C.X0 - pad, C.Y0 - pad), (C.X1 + pad, C.Y0 - pad), (C.X1 + pad, C.Y1 + pad), (C.X0 - pad, C.Y1 + pad)]
        catcher = self.mesh('ground-shadow-catcher', [P(x, y) for x, y in corners], [(0, 1, 2, 3)], self.matte('ground-plain', (200, 200, 200)))
        catcher.is_shadow_catcher = True
        mat = bpy.data.materials.new('ground-picture')
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        nodes.clear()
        out = nodes.new('ShaderNodeOutputMaterial')
        glow = nodes.new('ShaderNodeEmission')
        tex = nodes.new('ShaderNodeTexImage')
        view = Path(picture).with_name('ground-view.jpg')
        tex.image = bpy.data.images.load(str(view if view.exists() else picture), check_existing=False)
        tex.image.pack()
        links.new(tex.outputs['Color'], glow.inputs['Color'])
        links.new(glow.outputs['Emission'], out.inputs['Surface'])
        inner = [(C.X0, C.Y0), (C.X1, C.Y0), (C.X1, C.Y1), (C.X0, C.Y1)]
        shown = self.mesh('ground-picture', [P(x, y, -.01) for x, y in inner], [(0, 1, 2, 3)], mat)
        uv = shown.data.uv_layers.new(name='canvas')
        corner = {0: (0, 1), 1: (1, 1), 2: (1, 0), 3: (0, 0)}
        for loop in shown.data.loops:
            uv.data[loop.index].uv = corner[loop.vertex_index]
        shown.hide_render = True
        return catcher

    def render(self, path):
        self.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)

    def save(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(path).resolve()), compress=True)

    # ------------------------------------------------------------------ materials

    def _new(self, name):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.node_tree.nodes.clear()
        self.mats[name] = mat
        return mat, mat.node_tree.nodes, mat.node_tree.links

    def _mottle(self, nodes, links, colour, mottle, scale, grain):
        """Multiply a colour socket by slow and fine noise (painted, not flat)."""
        value = None
        geometry = None
        for strength, size, detail in ((mottle, scale, 2.0), (grain, 90.0, 0.0)):
            if not strength:
                continue
            geometry = geometry or nodes.new('ShaderNodeNewGeometry')
            noise = nodes.new('ShaderNodeTexNoise')
            noise.inputs['Scale'].default_value = size
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
        if value is None:
            return colour
        tint = nodes.new('ShaderNodeVectorMath')
        tint.operation = 'SCALE'
        links.new(colour, tint.inputs[0])
        links.new(value, tint.inputs['Scale'])
        return tint.outputs['Vector']

    def matte(self, name, rgb, mottle=0.0, scale=2.5, grain=0.0):
        """Plain diffuse surface that shows ``rgb`` on level sunlit ground."""
        if name in self.mats:
            return self.mats[name]
        mat, nodes, links = self._new(name)
        out = nodes.new('ShaderNodeOutputMaterial')
        diffuse = nodes.new('ShaderNodeBsdfDiffuse')
        diffuse.inputs['Roughness'].default_value = 0.0
        albedo = tuple(v / f for v, f in zip(lin(rgb), LIGHT_FLAT))
        base = nodes.new('ShaderNodeRGB')
        base.outputs[0].default_value = (*albedo, 1)
        links.new(self._mottle(nodes, links, base.outputs[0], mottle, scale, grain), diffuse.inputs['Color'])
        links.new(diffuse.outputs['BSDF'], out.inputs['Surface'])
        return mat

    def ramp(self, name, shade_rgb, lit_rgb, ramp=(-.15, .65), mottle=0.06, scale=3.0, grain=0.02,
             own=.6, share=.45, smooth=False, picture=None, picture_px=256, glow=None):
        """Art-directed surface: one colour for faces turned from the sun, one for faces turned to it.

        The colour is picked by the normal against the sun and shown mostly as its own light, with a
        diffuse share so cast shadows still fall on it.  ``picture`` lays a tiling texture (in screen
        space, ``picture_px`` canvas pixels per tile) over the pick, as leaves on a crown.
        """
        if name in self.mats:
            return self.mats[name]
        mat, nodes, links = self._new(name)
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
        shade = tuple(v / (own + share * .32) for v in lin(shade_rgb))
        lit = tuple(v / (own + share * f) for v, f in zip(lin(lit_rgb), LIGHT_FLAT))
        pick.inputs[1].default_value = (*shade, 1)
        pick.inputs[2].default_value = (*lit, 1)
        links.new(amount.outputs['Result'], pick.inputs[0])
        colour = pick.outputs[0]
        if picture is not None:
            coords = nodes.new('ShaderNodeTexCoord')
            mapping = nodes.new('ShaderNodeMapping')
            mapping.inputs['Scale'].default_value = (C.CANVAS_W / picture_px, C.CANVAS_H / picture_px, 1)
            links.new(coords.outputs['Window'], mapping.inputs['Vector'])
            tex = nodes.new('ShaderNodeTexImage')
            tex.image = bpy.data.images.load(str(picture), check_existing=True)
            tex.image.pack()
            tex.image.colorspace_settings.name = 'Non-Color'      # a detail map around 0.5, not a colour
            links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
            detail = nodes.new('ShaderNodeVectorMath')
            detail.operation = 'MULTIPLY'
            twice = nodes.new('ShaderNodeVectorMath')
            twice.operation = 'SCALE'
            twice.inputs['Scale'].default_value = 2.0
            links.new(tex.outputs['Color'], twice.inputs[0])
            links.new(colour, detail.inputs[0])
            links.new(twice.outputs['Vector'], detail.inputs[1])
            colour = detail.outputs['Vector']
        colour = self._mottle(nodes, links, colour, mottle, scale, grain)
        diffuse = nodes.new('ShaderNodeBsdfDiffuse')
        diffuse.inputs['Roughness'].default_value = 0.0
        part = nodes.new('ShaderNodeVectorMath')
        part.operation = 'SCALE'
        part.inputs['Scale'].default_value = share
        links.new(colour, part.inputs[0])
        links.new(part.outputs['Vector'], diffuse.inputs['Color'])
        light = nodes.new('ShaderNodeEmission')
        light.inputs['Strength'].default_value = own
        links.new(colour, light.inputs['Color'])
        add = nodes.new('ShaderNodeAddShader')
        links.new(diffuse.outputs['BSDF'], add.inputs[0])
        links.new(light.outputs['Emission'], add.inputs[1])
        shader = add.outputs['Shader']
        if glow:
            extra = nodes.new('ShaderNodeEmission')
            extra.inputs['Color'].default_value = (*lin(glow[0]), 1)
            extra.inputs['Strength'].default_value = glow[1]
            more = nodes.new('ShaderNodeAddShader')
            links.new(shader, more.inputs[0])
            links.new(extra.outputs['Emission'], more.inputs[1])
            shader = more.outputs['Shader']
        links.new(shader, out.inputs['Surface'])
        return mat

    def glow(self, name, rgb, strength=1.0):
        """A surface that only shines (lamps, screens, lava, neon): shows ``rgb`` at strength 1."""
        if name in self.mats:
            return self.mats[name]
        mat, nodes, links = self._new(name)
        out = nodes.new('ShaderNodeOutputMaterial')
        light = nodes.new('ShaderNodeEmission')
        light.inputs['Color'].default_value = (*lin(rgb), 1)
        light.inputs['Strength'].default_value = strength
        links.new(light.outputs['Emission'], out.inputs['Surface'])
        return mat

    # ------------------------------------------------------------------ meshes

    def mesh(self, name, verts, faces, mats, face_mats=None, smooth=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([tuple(v) for v in verts], [], faces)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        for mat in (mats if isinstance(mats, (list, tuple)) else [mats]):
            mesh.materials.append(mat)
        for index, poly in enumerate(mesh.polygons):
            poly.material_index = face_mats[index] if face_mats else 0
            poly.use_smooth = smooth
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        self.count += 1
        return obj

    @staticmethod
    def split(a, b, c, d, flip):
        return [(a, b, c), (a, c, d)] if flip else [(a, b, d), (b, c, d)]

    def prism(self, name, points, z0, z1, mat, top_mat=None):
        """Upright prism over a screen outline of its foot (level z0), walls up to z1."""
        n = len(points)
        verts = [GP(p, 0.0, z0) for p in points] + [GP(p, z1 - z0, z0) for p in points]
        faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        face_mats = [0, 1 if top_mat else 0] + [0] * n
        return self.mesh(name, verts, faces, [mat, top_mat] if top_mat else mat, face_mats)

    def box(self, name, x, y, w, d, z0, z1, mat, top_mat=None):
        """Box whose foot is a screen rectangle centred at (x, y): w wide, d deep on the ground."""
        return self.prism(name, [(x - w / 2, y - d / 2), (x + w / 2, y - d / 2), (x + w / 2, y + d / 2), (x - w / 2, y + d / 2)], z0, z1, mat, top_mat)

    def lump(self, name, x, y, rx, ry, h, mat, seed=0, jag=.36, detail=2, z0=0.0, smooth=False, sink=.25):
        """A faceted lump (rock, boulder, bush mass): a jittered icosphere on a ground ellipse."""
        bm = bmesh.new()
        made = bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
        centre = P(x, y, z0)
        for k, v in enumerate(made['verts']):
            u = v.co.copy() * (1 - jag / 2 + jag * C.hash01(name, seed, k))
            # ``h`` is the top; ``sink`` of the body's height stays under the ground.
            half = h / (2 - 2 * sink)
            v.co = centre + EX * (rx / C.SCALE) * u.x + EY * (ry / C.SCALE) * u.y + Vector((0, 0, half * (u.z + 1 - 2 * sink)))
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(mat)
        for poly in mesh.polygons:
            poly.use_smooth = smooth
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        self.count += 1
        return obj

    def blob(self, name, lobes, mat, z0=0.0, voxel=.07, soften=14, bumps=0.0, bump_scale=.5):
        """Lobes merged into one smooth body: (x, y, a, b, c[, zc]) = ground ellipse a x b, height c, centre height zc."""
        bm = bmesh.new()
        for lobe in lobes:
            gx, gy, a, b, c = lobe[:5]
            zc = lobe[5] if len(lobe) > 5 else 0.0
            centre = P(gx, gy, z0) + Vector((0, 0, zc))
            made = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=1.0)
            for v in made['verts']:
                u = v.co.copy()
                v.co = centre + EX * (a / C.SCALE) * u.x + EY * (b / C.SCALE) * u.y + Vector((0, 0, c)) * u.z
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        remesh = obj.modifiers.new('merge-lobes', 'REMESH')
        remesh.mode = 'VOXEL'
        remesh.voxel_size = voxel
        remesh.use_smooth_shade = True
        if soften:
            smooth = obj.modifiers.new('soften', 'SMOOTH')
            smooth.factor = .8
            smooth.iterations = soften
        if bumps:
            tex = bpy.data.textures.get(f'bumps-{bump_scale}') or bpy.data.textures.new(f'bumps-{bump_scale}', 'CLOUDS')
            tex.noise_scale = bump_scale
            tex.noise_depth = 2
            mod = obj.modifiers.new('bumps', 'DISPLACE')
            mod.texture = tex
            mod.strength = bumps
            mod.mid_level = .5
            mod.texture_coords = 'GLOBAL'
        self.count += 1
        return obj

    def pole(self, name, points, radius, mat, taper=1.0):
        """A tube through (x, y, z) points: x, y the foot on screen, z the height (trunks, branches, masts)."""
        data = bpy.data.curves.new(name, 'CURVE')
        data.dimensions = '3D'
        data.resolution_u = 2
        data.bevel_depth = radius
        data.bevel_resolution = 2
        data.use_fill_caps = True
        spline = data.splines.new('POLY')
        spline.points.add(len(points) - 1)
        for k, (point, (x, y, z)) in enumerate(zip(spline.points, points)):
            point.co = (*GP((x, y), z), 1)
            point.radius = 1.0 + (taper - 1.0) * k / max(1, len(points) - 1)
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        data.materials.append(mat)
        self.count += 1
        return obj

    def ridge(self, name, path, width, height, mat, top_mat=None, seed=0, jag=.25, step=70, z0=0.0, lean=.35):
        """A faceted wall or cliff along a screen path of its foot line: ``width`` deep on the ground.

        The crest wavers in height and depth; faces are split into triangles so the rock reads faceted.
        """
        pts = []
        for k, (a, b) in enumerate(zip(path, path[1:])):
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            parts = max(1, round(length / step))
            for i in range(parts):
                pts.append(C.lerp(a, b, i / parts))
        pts.append(path[-1])
        n = len(pts)
        front, back, crest_f, crest_b = [], [], [], []
        for k, (x, y) in enumerate(pts):
            j = lambda tag: C.hash01(name, seed, k, tag) - .5
            h = height * (1 + jag * 2 * j('h'))
            front.append(GP((x + 12 * j('fx'), y + width * .5 + 10 * j('fy')), 0.0, z0))
            back.append(GP((x + 12 * j('bx'), y - width * .5 + 10 * j('by')), 0.0, z0))
            crest_f.append(GP((x + 14 * j('cx'), y + width * .5 * (1 - lean) + 8 * j('cy')), h, z0))
            crest_b.append(GP((x + 14 * j('dx'), y - width * .5 * (1 - lean) + 8 * j('dy')), h * (.9 + .2 * C.hash01(name, k, 'bh')), z0))
        verts = front + crest_f + crest_b + back
        faces, face_mats = [], []
        for row, slot in ((0, 0), (1, 1), (2, 0)):
            for k in range(n - 1):
                a = row * n + k
                tris = self.split(a, a + 1, a + n + 1, a + n, C.hash01(name, row, k) < .5)
                faces += tris
                face_mats += [slot if top_mat else 0] * len(tris)
        for a, b, c, d in ((0, n, 2 * n, 3 * n), (n - 1, 2 * n - 1, 3 * n - 1, 4 * n - 1)):   # the two ends
            faces.append((a, b, c, d))
            face_mats.append(0)
        return self.mesh(name, verts, faces, [mat, top_mat] if top_mat else mat, face_mats)

    def butte(self, name, x, y, r, h, wall, top, seed=0, corners=12, squash=.78, star=.06, bevel=.17, crown=.3, z0=0.0, flare=1.07):
        """A faceted block with a scalloped, lightly domed top: mesa, crag, rock stack, pillar.

        Foot outline is a wavering star polygon of radius ``r`` on the ground (``squash`` deep).  Walls
        rise through a wavering waist to ``h``; a bevel ring leans in, and the cap is a fan of facets
        to a centre ``crown`` higher, so its top catches the light unevenly like cut stone.
        """
        ring = []
        for k in range(corners):
            a = (k + .4 * C.hash01(name, seed, k, 'a')) * math.tau / corners
            rr = r * (1 + star * (1 if k % 2 else -1) + .20 * (C.hash01(name, seed, k, 'r') - .5))
            ring.append((x + rr * math.cos(a), y + rr * squash * math.sin(a)))
        scale = lambda pts, f, jit=0.0, tag='': [(x + (px - x) * (f + jit * (C.hash01(name, seed, i, tag) - .5)),
                                                  y + (py - y) * (f + jit * (C.hash01(name, seed, i, tag) - .5))) for i, (px, py) in enumerate(pts)]
        n = corners
        verts = ([GP(p, 0.0, z0) for p in scale(ring, flare, .06, 'f')]
                 + [GP(p, h * (.42 + .2 * C.hash01(name, seed, k, 'w')), z0) for k, p in enumerate(scale(ring, 1.02, .06, 'm'))]
                 + [GP(p, h, z0) for p in ring]
                 + [GP(p, h + crown * (.55 + .5 * C.hash01(name, seed, k, 'c')), z0) for k, p in enumerate(scale(ring, 1 - bevel, .05, 'b'))]
                 + [GP((x + r * .12 * (C.hash01(name, seed, 'cx') - .5), y), h + crown * 1.25, z0)])
        faces, face_mats = [], []
        for row, slot in ((0, 0), (1, 0), (2, 1)):
            for k in range(n):
                j = (k + 1) % n
                a = row * n
                tris = self.split(a + k, a + j, a + n + j, a + n + k, C.hash01(name, seed, row, k) < .5)
                faces += tris
                face_mats += [slot] * len(tris)
        for k in range(n):
            faces.append((3 * n + k, 3 * n + (k + 1) % n, 4 * n))
            face_mats.append(1)
        return self.mesh(name, verts, faces, [wall, top], face_mats)

    def crown(self, name, x, y, size, zc, seed, leaf, voxel=.09):
        """A broadleaf crown: one main lobe and four smaller ones, merged and roughened; ``zc`` is its centre height."""
        lobes = [(x, y, 104 * size, 80 * size, 1.5 * size, zc)]
        for k in range(4):
            a = k * 1.57 + C.hash01(seed, k, 'a') * 1.2
            r = 62 * size
            lobes.append((x + r * 1.15 * math.cos(a), y + r * .7 * math.sin(a),
                          (58 + 22 * C.hash01(seed, k, 'r')) * size, (46 + 16 * C.hash01(seed, k, 'd')) * size,
                          (.95 + .35 * C.hash01(seed, k, 'h')) * size, zc + (C.hash01(seed, k, 'z') - .6) * .7 * size))
        return self.blob(name, lobes, leaf, voxel=voxel, soften=6, bumps=.32 * min(1.0, size + .2), bump_scale=.42)

    def tree(self, name, x, y, size, seed, leaf, bark):
        """A broadleaf tree: leaning trunk, three boughs, crown.  About 240 px tall on screen at size 1."""
        h = 2.3 * size
        self.pole(f'{name}-trunk', [(x, y, 0), (x + 5 * size, y, h * .5), (x + 2 * size, y, h + .4)], .26 * size, bark, taper=.55)
        for k in range(3):
            a = k * 2.1 + C.hash01(seed, 'b', k) * 1.5
            reach = (58 + 30 * C.hash01(seed, 'c', k)) * size
            self.pole(f'{name}-branch-{k}', [(x + 3 * size, y, h * .55), (x + reach * .5 * math.cos(a), y + reach * .2 * math.sin(a), h * .95),
                                             (x + reach * math.cos(a), y + reach * .4 * math.sin(a), h * 1.25)], .09 * size, bark, taper=.4)
        return self.crown(f'{name}-crown', x, y, size, h + .9 * size, seed, leaf)

    def seam_crowns(self, runs, leaf, zc=3.2, piece=170, scale=1.0):
        """Carry the canopies that the play area's edge cuts on over the seam: ``runs`` from Ground.edge_runs."""
        lift = C.LIFT * zc
        for side, spans in runs.items():
            for lo, hi in spans:
                pieces = max(1, round((hi - lo) / piece))
                for i in range(pieces):
                    mid = lo + (hi - lo) * (i + .5) / pieces
                    half = (hi - lo) / pieces / 2 + 30 * scale
                    size = max(.6 * scale, min(1.3 * scale, half / 100)) * (.92 + .3 * C.hash01(side, lo, i, 's'))
                    out = (20 + 44 * C.hash01(side, lo, i, 'o')) * scale     # how far past the seam the crown's centre sits
                    if side == 'top':
                        x, y = mid, -out + lift
                    elif side == 'bottom':
                        x, y = mid, C.BASE_H + out + lift
                    elif side == 'left':
                        x, y = -out, mid + lift
                    else:
                        x, y = C.BASE_W + out, mid + lift
                    self.crown(f'seam-crown-{side}-{lo}-{i}', x, y, size, zc, f'{side}{lo}{i}', leaf)

    def fence(self, name, path, mat, post=74, height=.95, rails=(.42, .78)):
        """A post-and-rail fence along a screen path of its foot line."""
        feet = []
        for a, b in zip(path, path[1:]):
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            parts = max(1, round(length / post))
            feet += [C.lerp(a, b, i / parts) for i in range(parts)]
        feet.append(path[-1])
        for k, (x, y) in enumerate(feet):
            self.box(f'{name}-post-{k}', x, y, 11, 9, 0.0, height, mat)
        for r, z in enumerate(rails):
            for k, (a, b) in enumerate(zip(feet, feet[1:])):
                verts = [GP((a[0], a[1] - 3), z - .07), GP((b[0], b[1] - 3), z - .07), GP((b[0], b[1] - 3), z + .07), GP((a[0], a[1] - 3), z + .07),
                         GP((a[0], a[1] + 3), z - .07), GP((b[0], b[1] + 3), z - .07), GP((b[0], b[1] + 3), z + .07), GP((a[0], a[1] + 3), z + .07)]
                faces = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (3, 2, 6, 7), (0, 3, 7, 4), (1, 2, 6, 5)]
                self.mesh(f'{name}-rail-{r}-{k}', verts, faces, mat)
