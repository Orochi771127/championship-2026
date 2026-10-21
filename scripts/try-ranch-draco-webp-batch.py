import bpy
import json
import os
from pathlib import Path

root = Path(os.environ['RANCH_TEST_MASTERS'])
output = Path(os.environ['RANCH_TEST_OUTPUT'])
output.mkdir(parents=True, exist_ok=True)
rows = []
only = set(filter(None, os.environ.get('RANCH_TEST_ONLY', '').split(',')))
for directory in sorted(root.iterdir()):
    if only and directory.name not in only:
        continue
    source = directory / 'export.blend'
    if not source.is_file():
        continue
    target = output / (directory.name + '.glb')
    bpy.ops.wm.open_mainfile(filepath=str(source))
    cap = int(os.environ.get('RANCH_TEST_TEXTURE_CAP', '2048'))
    for image in bpy.data.images:
        if image.source == 'FILE' and max(image.size) > cap:
            image.scale(cap, cap)
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format='GLB', export_image_format='WEBP',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=8,
        export_draco_position_quantization=int(os.environ.get('RANCH_TEST_POSITION_BITS', '14')),
        export_draco_normal_quantization=int(os.environ.get('RANCH_TEST_NORMAL_BITS', '10')),
        export_draco_texcoord_quantization=int(os.environ.get('RANCH_TEST_UV_BITS', '12')),
        export_image_quality=int(os.environ.get('RANCH_TEST_IMAGE_QUALITY', '75')),
        export_yup=True,
    )
    rows.append({'id':directory.name,'bytes':target.stat().st_size})
    print('OPTIMIZED', directory.name, target.stat().st_size, flush=True)
print('TOTAL', len(rows), sum(row['bytes'] for row in rows), flush=True)
(output / 'sizes.json').write_text(json.dumps(rows, indent=2) + '\n')
