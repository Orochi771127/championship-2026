"""Offline CC0 proxy study. Run with Blender --background --disable-autoexec.

This produces editable research aids, never character replacement artwork.
Source pose metadata is recorded, not interpreted as a skeletal animation.
"""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--source', required=True)
    args.add_argument('--output', required=True)
    args.add_argument('--brief', required=True)
    opts = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
    started = time.perf_counter()
    source = Path(opts.source).resolve()
    out = Path(opts.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    briefs = [json.loads(line) for line in Path(opts.brief).read_text(encoding='utf-8').splitlines() if line.strip()]
    bpy.ops.wm.open_mainfile(filepath=str(source), use_scripts=False)
    source_actions = [{'name': a.name, 'range': list(a.frame_range)} for a in bpy.data.actions]
    body = bpy.data.objects['Dragon']
    rig = bpy.data.objects['DragonArmature']
    original_vertices = len(body.data.vertices)
    original_bones = [b.name for b in rig.pose.bones]
    for obj in list(bpy.data.objects):
        obj.animation_data_clear()
        if obj.type == 'ARMATURE':
            for bone in obj.pose.bones:
                bone.matrix_basis = Matrix.Identity(4)
    # Remove only the downloaded model's wing geometry in the isolated copy.
    # Its arm/hand articulation remains insufficient for an M201 replacement.
    wing_groups = {g.index for g in body.vertex_groups if g.name.startswith('Wing')}
    remove = {v.index for v in body.data.vertices if any(g.group in wing_groups and g.weight > .15 for g in v.groups)}
    mesh = bmesh.new()
    mesh.from_mesh(body.data)
    mesh.verts.ensure_lookup_table()
    bmesh.ops.delete(mesh, geom=[v for v in mesh.verts if v.index in remove], context='VERTS')
    mesh.to_mesh(body.data)
    mesh.free()
    palette = {'Main': (0.78, .42, .055, 1), 'Belly': (.88, .73, .40, 1),
               'Claws': (.86, .85, .73, 1), 'Eyes': (.018, .014, .011, 1),
               'Wings': (.16, .11, .05, 1)}
    for material in bpy.data.materials:
        material.use_nodes = True
        material.diffuse_color = palette.get(material.name, (.2, .2, .2, 1))
        material.node_tree.nodes.clear()
        principled = material.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output = material.node_tree.nodes.new('ShaderNodeOutputMaterial')
        material.node_tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])
        if principled:
            principled.inputs['Base Color'].default_value = material.diffuse_color
            principled.inputs['Roughness'].default_value = .9
            principled.inputs['Metallic'].default_value = 0
    root = bpy.data.objects.new('PROXY_ONLY_common_source_origin', None)
    bpy.context.scene.collection.objects.link(root)
    for obj in list(bpy.context.scene.objects):
        if obj != root and obj.parent is None:
            world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world
    root.scale = (3.2, 3.2, 3.2)
    root.rotation_euler = (0, 0, -math.pi / 2)
    scene = bpy.context.scene
    scene.name = 'OFFLINE_M201_PROXY_STUDY_NOT_PRODUCTION'
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 464
    scene.render.resolution_y = 368
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.view_transform = 'Standard'
    scene.render.fps = 24  # Study preview only. Never exported as native timing.
    scene.world = bpy.data.worlds.new('Study ambient')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.5, .55, .62, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    camera_data = bpy.data.cameras.new('FixedSourceGridCamera')
    camera_data.type = 'ORTHO'
    # Blender orthographic scale is width for this landscape sensor fit.
    camera_data.ortho_scale = 464 / 12
    camera_data.sensor_fit = 'HORIZONTAL'
    camera = bpy.data.objects.new('FixedSourceGridCamera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (4, -100, 7)
    camera.rotation_euler = (math.pi / 2, 0, 0)
    scene.camera = camera
    for name, location, power, size in [('Key', (-20, -30, 40), 5500, 25), ('Fill', (25, -10, 18), 1700, 20)]:
        light_data = bpy.data.lights.new(name, 'AREA')
        light_data.energy = power
        light_data.shape = 'DISK'
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (Vector((0, 0, 8)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    # Named static approximation keys make the aid editable without importing
    # third-party animation names or durations into original gameplay truth.
    studies = [
        {'cell': '000', 'frame': 1, 'body': 0, 'tilt': 0, 'shift': (0, 0, 0), 'leg': 0},
        {'cell': '023', 'frame': 2, 'body': 18, 'tilt': -62, 'shift': (2, 0, -1), 'leg': 50},
        {'cell': '056', 'frame': 3, 'body': 15, 'tilt': -25, 'shift': (1, 0, -1), 'leg': 35},
        {'cell': '062', 'frame': 4, 'body': 0, 'tilt': 78, 'shift': (7, 0, 3), 'leg': 40},
    ]
    for study in studies:
        frame = study['frame']
        scene.frame_set(frame)
        root.location = study['shift']
        # World Y is screen-plane tilt. Keep model scale and camera fixed.
        root.rotation_mode = 'QUATERNION'
        root.rotation_quaternion = (Matrix.Rotation(math.radians(study['tilt']), 4, 'Y') @ Matrix.Rotation(-math.pi/2, 4, 'Z')).to_quaternion()
        root.keyframe_insert('location', frame=frame)
        root.keyframe_insert('rotation_quaternion', frame=frame)
        for bone in rig.pose.bones:
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = (0, 0, 0)
            bone.scale = (1, 1, 1)
        rig.pose.bones['Body'].rotation_euler.x = math.radians(study['body'])
        for side in ('L', 'R'):
            rig.pose.bones['UpperLeg.' + side].rotation_euler.x = math.radians(study['leg'])
            rig.pose.bones['LowerLeg.' + side].rotation_euler.x = math.radians(-study['leg'] * .8)
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_euler', frame=frame)
        scene.timeline_markers.new('PROXY main_' + study['cell'], frame=frame)
    scene.frame_start, scene.frame_end = 1, 4
    for action in bpy.data.actions:
        try:
            for curve in action.fcurves:
                for point in curve.keyframe_points:
                    point.interpolation = 'CONSTANT'
        except AttributeError:
            pass
    from bpy_extras.object_utils import world_to_camera_view
    origin = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
    projected_origin = [origin.x * 464, (1 - origin.y) * 368]
    assert abs(projected_origin[0] - 184) < .01 and abs(projected_origin[1] - 268) < .01, projected_origin
    receipt = {
        'schemaVersion': 1, 'classification': 'OFFLINE_CC0_POSE_PROXY_NOT_CHARACTER_ART',
        'source': {'path': str(source), 'sha256': digest(source), 'publisher': 'Quaternius',
                   'page': 'https://quaternius.itch.io/lowpoly-animated-monsters', 'license': 'CC0-1.0'},
        'blenderVersion': bpy.app.version_string, 'stockActionInventory': source_actions,
        'originalBones': original_bones, 'originalVertices': original_vertices,
        'modifiedVertices': len(body.data.vertices), 'camera': {'resolution': [464, 368],
        'orthoScale': camera_data.ortho_scale, 'nativeUnitsToPixels': 12,
        'projectedSourceOrigin': projected_origin, 'fixedAcrossAllPoses': True,
        'groundMeaning': 'UNKNOWN_REQUIRES_TRACE'},
        'sourcePoseMetadata': briefs, 'studyPoses': studies, 'renders': [],
        'runtimeEligible': False, 'shippingReady': False, 'humanApproved': False,
        'fitVerdict': 'NOT_ACCEPTED_AS_M201_REPLACEMENT',
        'limitations': ['No independently rigged hands/wrists', 'Dragon muzzle, horns and tail are not selected cat identity',
                        'Approximation poses are artist-authored, not ROM animation',
                        'Fixed projection validates coordinates only, not silhouette or motion fidelity'],
    }
    scene['classification'] = receipt['classification']
    scene['native_animation_authority'] = 'External raw sequence tables; scene frames are study selectors only'
    scene['source_origin'] = [184, 268]
    scene['source_scale'] = 12
    scene['runtimeEligible'] = False
    for study in studies:
        scene.frame_set(study['frame'])
        bpy.context.view_layer.update()
        image_path = out / ('proxy-main-' + study['cell'] + '.png')
        scene.render.filepath = str(image_path)
        bpy.ops.render.render(write_still=True)
        receipt['renders'].append({'cell': study['cell'], 'path': image_path.name, 'sha256': digest(image_path)})
    scene.frame_set(1)
    scene.render.filepath = '//proxy-main-000.png'
    blend = out / 'm201-offline-pose-proxy.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    receipt['blend'] = {'path': blend.name, 'sha256': digest(blend)}
    receipt['generationSeconds'] = round(time.perf_counter() - started, 2)
    (out / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('M201_STUDY_COMPLETE ' + str(out))


if __name__ == '__main__':
    main()
