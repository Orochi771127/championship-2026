"""Run through the installed Blender Lab MCP bridge; never overwrite sources.

Real evaluated geometry, fixed world units, baked procedural base colour.
The editable master and the optimized export scene are separate files.
"""
import bpy, json, math, hashlib, numpy as np
from pathlib import Path

ROOT=Path('R:/Projects/Championship2026/ranch-fixed-art-polish-20261021')
ART=Path('R:/Projects/Championship2026/ranch-fixed-art-assets-20261021')
OUT=ROOT/'assets/production/cage/three-20261021'
OUT.mkdir(parents=True,exist_ok=True)
sources=json.loads((ART/'sources.json').read_text())
for n in ['28','29']:
 sources[f'field_cm{n}_01']=str(Path('R:/Projects/Championship2026/championship-2026/docs/art/production/original-character-cage-r1/cage-base3d-v1/seam-v3/fields')/f'field_cm{n}_01/master.blend')
sources['field_cm24_01']='R:/Projects/Championship2026/cm24-foreground-20261010/source/CM24_SHRINE_REARRANGEMENT_R1_ART/master.blend'
jobs=json.loads((ART/'three-jobs.json').read_text())
records=[]
for fid in jobs:
 revised=ART/'masters'/fid/'refined.blend'
 source=str(revised) if revised.exists() else sources[fid]
 bpy.ops.wm.open_mainfile(filepath=source)
 sc=bpy.context.scene;sc.frame_set(1)
 folder=ART/'three-masters'/fid;folder.mkdir(parents=True,exist_ok=True)
 sc['runtime_contract']='TRUE_3D_FIXED_CAMERA_2D_ACTORS_20261021'
 sc['source_master']=source
 bpy.ops.wm.save_as_mainfile(filepath=str(folder/'editable.blend'))
 # Convert evaluated modifiers once; keep original object hierarchy in editable.blend.
 bpy.ops.object.select_all(action='DESELECT')
 objects=[o for o in sc.objects if o.type in {'MESH','CURVE','FONT','SURFACE'} and not o.hide_render]
 for o in objects:o.hide_set(False);o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.object.convert(target='MESH')
 def animated_parent(o):
  parent=o.parent
  while parent:
   if parent.animation_data and parent.animation_data.action:return True
   parent=parent.parent
  return False
 moving=[o for o in bpy.context.selected_objects if animated_parent(o)]
 for o in moving:o.select_set(False)
 bpy.context.view_layer.objects.active=next(o for o in bpy.context.selected_objects)
 bpy.ops.object.join()
 obj=bpy.context.object;obj.name=fid+'-runtime-static'
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 for o in moving:o.select_set(True)
 meshes=[obj,*moving]
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.003,area_weight=1)
 bpy.ops.object.mode_set(mode='OBJECT')
 image=bpy.data.images.new(fid+'-basecolor',width=2048,height=2048,alpha=True)
 # Emission bake copies the authored colour graph without baking a camera or light.
 bake_nodes=[]
 for m in set(m for o in meshes for m in o.data.materials):
  if m is None:continue
  m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links
  p=next((n for n in n if n.type=='BSDF_PRINCIPLED'),None)
  output=next((n for n in n if n.type=='OUTPUT_MATERIAL' and n.is_active_output),None)
  emission=n.new('ShaderNodeEmission')
  if p:
   if p.inputs['Base Color'].is_linked:l.new(p.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
   else:emission.inputs['Color'].default_value=p.inputs['Base Color'].default_value
  else:emission.inputs['Color'].default_value=m.diffuse_color
  l.new(emission.outputs[0],output.inputs['Surface'])
  tex=n.new('ShaderNodeTexImage');tex.image=image;n.active=tex
  bake_nodes.append((m,p,emission,tex))
 sc.render.engine='CYCLES';sc.cycles.samples=1;sc.render.bake.margin=4
 try:
  prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
  for d in prefs.devices:d.use=d.type!='CPU'
  sc.cycles.device='GPU'
 except Exception:sc.cycles.device='CPU'
 bpy.ops.object.bake(type='EMIT')
 pixels=np.empty(2048*2048*4,dtype=np.float32);image.pixels.foreach_get(pixels)
 # Carry shader-defined shore/river masks into the texture alpha. Omitting
 # this would paint lava across the walkable volcanic ground.
 alpha=bpy.data.images.new(fid+'-alpha',width=2048,height=2048,alpha=False,float_buffer=True)
 for m,p,emission,tex in bake_nodes:
  l=m.node_tree.links
  for link in list(emission.inputs['Color'].links):l.remove(link)
  if p and p.inputs['Alpha'].is_linked:l.new(p.inputs['Alpha'].links[0].from_socket,emission.inputs['Color'])
  else:
   a=p.inputs['Alpha'].default_value if p else 1;emission.inputs['Color'].default_value=(a,a,a,1)
  tex.image=alpha
 bpy.ops.object.bake(type='EMIT')
 alpha_pixels=np.empty_like(pixels);alpha.pixels.foreach_get(alpha_pixels)
 pixels[3::4]=alpha_pixels[0::4];image.pixels.foreach_set(pixels);image.update()
 image.filepath_raw=str(folder/'basecolor.png');image.file_format='PNG';image.save();image.pack()
 orm=bpy.data.images.new(fid+'-roughness-metallic',width=2048,height=2048,alpha=False)
 orm.colorspace_settings.name='Non-Color'
 for m,p,emission,tex in bake_nodes:
  n=m.node_tree.nodes;l=m.node_tree.links;combine=n.new('ShaderNodeCombineColor');combine.mode='RGB';combine.inputs['Red'].default_value=1
  for channel,key,default in [('Green','Roughness',.78),('Blue','Metallic',0)]:
   if p and p.inputs[key].is_linked:l.new(p.inputs[key].links[0].from_socket,combine.inputs[channel])
   else:combine.inputs[channel].default_value=p.inputs[key].default_value if p else default
  l.new(combine.outputs[0],emission.inputs['Color']);tex.image=orm
 bpy.ops.object.bake(type='EMIT')
 orm.filepath_raw=str(folder/'roughness-metallic.png');orm.file_format='PNG';orm.save();orm.pack()
 material=bpy.data.materials.new(fid+'-baked-colour');material.use_nodes=True
 p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.78
 tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
 material.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
 material.node_tree.links.new(tex.outputs['Alpha'],p.inputs['Alpha'])
 t=material.node_tree.nodes.new('ShaderNodeTexImage');t.image=orm
 separate=material.node_tree.nodes.new('ShaderNodeSeparateColor');separate.mode='RGB'
 material.node_tree.links.new(t.outputs['Color'],separate.inputs[0])
 material.node_tree.links.new(separate.outputs['Green'],p.inputs['Roughness']);material.node_tree.links.new(separate.outputs['Blue'],p.inputs['Metallic'])
 for o in meshes:
  o.data.materials.clear();o.data.materials.append(material)
  for poly in o.data.polygons:poly.material_index=0
 for o in moving:
  parent=o.parent
  while parent:parent.select_set(True);parent=parent.parent
 target=OUT/(fid+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_animations=bool(moving),export_frame_range=True,export_cameras=False,export_lights=False,export_yup=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(folder/'export.blend'))
 record={'fieldId':fid,'url':'assets/production/cage/three-20261021/'+target.name,'source':source,'sourceSha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'movingMeshes':len(moving),'editable':str(folder/'editable.blend')}
 (folder/'receipt.json').write_text(json.dumps(record,indent=2));records.append(record)
 manifest={'version':1,'coordinateSystem':'BLENDER_Z_UP_GLTF_Y_UP','nativePixelsPerWorldUnit':16,'cameraElevationDegrees':52,'status':'LOCAL_INTEGRATION_CANDIDATE','fields':[json.loads(p.read_text()) for p in sorted((ART/'three-masters').glob('*/receipt.json'))]}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
result={'exported':records}
