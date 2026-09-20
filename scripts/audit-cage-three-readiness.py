"""Read original-created Blender masters; do not export or modify their contents.

Run via Blender --background --factory-startup --python-exit-code 1 --python.
This is an asset portability inventory, NOT a renderer or performance acceptance.
"""
import hashlib
import json
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
FIELDS=('field_cm28_01','field_cm09_01','field_cm21_01')


def inspect(path):
    sha=hashlib.sha256(path.read_bytes()).hexdigest().upper()
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    scene=bpy.context.scene
    objects=[o for o in scene.objects if o.type in ('MESH','CURVE')]
    materials={slot.material.name:slot.material for o in objects for slot in o.material_slots if slot.material}
    procedural=[]
    for name,mat in materials.items():
        nodes=mat.node_tree.nodes if mat.use_nodes else []
        # Conservative inventory of node types, not a full glTF exporter analysis.
        kinds=sorted({n.bl_idname for n in nodes if n.bl_idname in
                      ('ShaderNodeTexNoise','ShaderNodeTexChecker','ShaderNodeTexWave','ShaderNodeBump','ShaderNodeValToRGB')})
        if kinds:procedural.append({'name':name,'nodeTypes':kinds})
    triangles=0
    graph=bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles();triangles+=len(mesh.loop_triangles)
        finally:evaluated.to_mesh_clear()
    if hashlib.sha256(path.read_bytes()).hexdigest().upper()!=sha:raise ValueError('MASTER_MODIFIED')
    return {'fieldId':scene.get('fieldId'),'source':path.relative_to(ROOT).as_posix(),
            'sha256':sha,'sourceBytes':path.stat().st_size,'meshAndCurveObjects':len(objects),
            'evaluatedTriangles':triangles,'usedMaterials':len(materials),
            'proceduralMaterialsRequiringExportReview':procedural,
            'meshObjectsWithoutUV':sum(o.type=='MESH' and len(o.data.uv_layers)==0 for o in objects),
            'taggedIndependentPropObjects':sum(o.get('sourceObjectOrdinal') is not None for o in objects),
            'cameraType':scene.camera.data.type,'cameraProjection':scene.get('projection'),
            'geometryOwnerIds':sorted({o.get('cageFieldId','UNASSIGNED') for o in objects}),
            'exportedGLB':False,'runtimeVerified':False}


def main():
    fields=[inspect(WORK/'seam-v3/fields'/fid/'master.blend') for fid in FIELDS]
    report={'schemaVersion':1,'status':'SOURCE_INVENTORY_ONLY_NOT_GLTF_OR_RUNTIME_ACCEPTANCE',
            'fields':fields,'decision':'DEFER_CAGE_RUNTIME_MIGRATION_CONTINUE_FULL_ASSET_BATCH',
            'remainingChecks':['Bake or translate procedural materials and verify UVs.',
                               'Export and validate GLB with original field origins and prop hierarchy.',
                               'Calibrate native hex coordinates, crop and wrap in a bounded presentation adapter.',
                               'Prove actor/prop depth with a shared depth strategy, not stacked canvases alone.',
                               'Measure target mobile rendering, context recovery and fallback.'],
            'sourceFilesModified':False,'runtimeModified':False}
    output=WORK/'seam-v3/review/stage3-batch2/three-readiness.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'fields':[{k:r[k] for k in
                     ('fieldId','evaluatedTriangles','usedMaterials','meshObjectsWithoutUV')} for r in fields]}))


if __name__=='__main__':main()
