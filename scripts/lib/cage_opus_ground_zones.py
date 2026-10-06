"""Ground zones for opus-round cages: blend ground looks by per-tile zone values.

A zone value is assigned to every 8-px tile (1 = where residents walk, lower
values for scenery zones such as scree, sky or thicket).  The values are
blurred into a small image, mapped from world position to native screen
coordinates in the shader, broken up with noise, and used to blend ground
materials.  Walkability itself always comes from the product's gameplay data
(``raising-ground.r1.json``); this module only paints the floor.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
_WALK = {}


def walk_tiles(field_id):
    if field_id not in _WALK:
        spec = json.loads((WORK / 'fields' / field_id / 'spec.json').read_text(encoding='utf8'))
        data = json.loads((ROOT / 'src/data/championship/catalogs/raising-ground.r1.json').read_text(encoding='utf8'))
        entry = next(f for f in data['fields'] if f['definitionIndex'] == spec['definitionIndex'])
        cells = [value for count, *value in entry['runs'] for _ in range(count)]
        width = entry['width']
        _WALK[field_id] = {(i % width, i // width) for i, value in enumerate(cells) if value[0] == 1}
    return _WALK[field_id]


def zone_image(key, native_size, values, blur=2.6, per_tile=4):
    import bpy
    import numpy as np
    name = f'opus-zones-{key}'
    if name in bpy.data.images:
        return bpy.data.images[name]
    width, height = native_size[0] // 8, native_size[1] // 8
    grid = np.zeros((height * per_tile, width * per_tile), dtype=np.float32)
    for (tx, ty), value in values.items():
        if 0 <= tx < width and 0 <= ty < height:
            grid[ty * per_tile:(ty + 1) * per_tile, tx * per_tile:(tx + 1) * per_tile] = value
    radius = int(blur * 3)
    kernel = np.exp(-.5 * (np.arange(-radius, radius + 1) / blur) ** 2)
    kernel /= kernel.sum()
    padded = np.pad(grid, radius, mode='edge')
    rows = np.apply_along_axis(lambda r: np.convolve(r, kernel, mode='valid'), 1, padded)
    soft = np.apply_along_axis(lambda c: np.convolve(c, kernel, mode='valid'), 0, rows)
    image = bpy.data.images.new(name, width=soft.shape[1], height=soft.shape[0], alpha=False, float_buffer=True)
    rgba = np.repeat(soft[::-1, :, None], 4, axis=2)
    rgba[..., 3] = 1.0
    image.pixels = rgba.ravel().tolist()
    image.pack()
    return image


def copy_shader(nodes, links, source):
    """Copy a material's node tree into ``nodes``; return its BSDF output socket."""
    mapping = {}
    for node in source.node_tree.nodes:
        if node.type == 'OUTPUT_MATERIAL':
            continue
        copy = nodes.new(node.bl_idname)
        for attr in ('operation', 'feature', 'blend_type', 'data_type', 'interpolation', 'extension'):
            if hasattr(node, attr):
                try:
                    setattr(copy, attr, getattr(node, attr))
                except (AttributeError, TypeError):
                    pass
        if node.bl_idname == 'ShaderNodeValToRGB':
            elements, target = node.color_ramp.elements, copy.color_ramp.elements
            while len(target) < len(elements):
                target.new(.5)
            for a, b in zip(elements, target):
                b.position, b.color = a.position, a.color
        if node.bl_idname == 'ShaderNodeTexImage':
            copy.image = node.image
        for index, socket in enumerate(node.inputs):
            if hasattr(socket, 'default_value') and index < len(copy.inputs):
                try:
                    copy.inputs[index].default_value = socket.default_value
                except (AttributeError, TypeError, ValueError):
                    pass
        mapping[node.name] = copy
    shader = None
    for link in source.node_tree.links:
        if link.to_node.type == 'OUTPUT_MATERIAL':
            shader = mapping[link.from_node.name].outputs[link.from_socket.identifier]
            continue
        links.new(mapping[link.from_node.name].outputs[link.from_socket.identifier],
                  mapping[link.to_node.name].inputs[link.to_socket.identifier])
    return shader


def zone_ground(d, name, key, native_size, values, layers, noise_amount=.30):
    """Blend ground looks by zone value: ``layers`` = [(material, from, to), ...], low to high."""
    import bpy
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes.get('Principled BSDF'))
    output = nodes.get('Material Output')
    geometry = nodes.new('ShaderNodeNewGeometry')
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(geometry.outputs['Position'], split.inputs[0])
    k = d.UNIT / math.sqrt(2)

    def op(kind, a, b):
        node = nodes.new('ShaderNodeMath')
        node.operation = kind
        for socket, value in ((node.inputs[0], a), (node.inputs[1], b)):
            if isinstance(value, (int, float)):
                socket.default_value = value
            else:
                links.new(value, socket)
        return node.outputs[0]
    w, h = native_size
    u = op('DIVIDE', op('MULTIPLY', op('ADD', split.outputs['X'], split.outputs['Y']), k), float(w))
    v = op('SUBTRACT', 1.0, op('DIVIDE', op('MULTIPLY', op('SUBTRACT', split.outputs['X'], split.outputs['Y']),
                                            k * d.S), float(h)))
    join = nodes.new('ShaderNodeCombineXYZ')
    links.new(u, join.inputs['X'])
    links.new(v, join.inputs['Y'])
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = zone_image(key, native_size, values)
    texture.interpolation = 'Cubic'
    texture.extension = 'EXTEND'
    links.new(join.outputs[0], texture.inputs['Vector'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2.4
    noise.inputs['Detail'].default_value = 3.0
    links.new(geometry.outputs['Position'], noise.inputs['Vector'])
    value = op('ADD', texture.outputs['Color'], op('MULTIPLY', op('SUBTRACT', noise.outputs['Fac'], .5), noise_amount))
    current = copy_shader(nodes, links, layers[0][0])
    for material, start, end in layers[1:]:
        ramp = nodes.new('ShaderNodeMapRange')
        ramp.inputs['From Min'].default_value = start
        ramp.inputs['From Max'].default_value = end
        links.new(value, ramp.inputs['Value'])
        mix = nodes.new('ShaderNodeMixShader')
        links.new(ramp.outputs['Result'], mix.inputs['Fac'])
        links.new(current, mix.inputs[1])
        links.new(copy_shader(nodes, links, material), mix.inputs[2])
        current = mix.outputs[0]
    links.new(current, output.inputs['Surface'])
    d.M[name] = mat
    return mat
