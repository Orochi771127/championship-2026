import bpy,json,math
from pathlib import Path
from mathutils import Vector
exec(Path('R:/Projects/Championship2026/ranch-fixed-art-polish-20261021/scripts/refine-fixed-cages.py').read_text().split('records=[]')[0])
records=[]
for fid in ['field_cm02_01','field_cm30_01','field_cm09_01','field_cm15_01']:
 bpy.ops.wm.open_mainfile(filepath=SOURCE[fid]);sc=bpy.context.scene;style(sc)
 if fid in ['field_cm02_01','field_cm30_01']:
  for i,c in enumerate([(.22,.38,.065),(.28,.43,.09),(.19,.32,.05)],1):mat('kit-lawn-'+str(i),c,.9)
 if fid=='field_cm02_01':
  for o in sc.objects:
   if o.name.startswith('garden-'):o.location+=world(0,-18)
   elif o.name.startswith('back-shrub-1'):o.location+=world(0,-6)
 # Keep all contact geometry and grass park composition. Calm noisy material
 # contrast so the actual partner remains the visual focus at 70% zoom.
 for m in bpy.data.materials:
  if not m.use_nodes:continue
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    name=m.name.lower()
    if any(k in name for k in ['grass','turf','ground','leaf','frond']):n.inputs['Roughness'].default_value=.83
    if any(k in name for k in ['steel','chrome']):n.inputs['Roughness'].default_value=.28
    if any(k in name for k in ['rubber','pad']):n.inputs['Roughness'].default_value=.82
   if n.type=='VALTORGB' and m.name=='sp-ground':
    for e in n.color_ramp.elements:
     r,g,b,a=e.color;e.color=(.10+r*.35,.20+g*.35,.035+b*.35,a)
   if n.type=='BUMP':n.inputs['Strength'].default_value=min(.16,n.inputs['Strength'].default_value)
 if fid=='field_cm09_01':
  m=bpy.data.materials['cs-sea-field_cm09_01'];n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
  # Preserve the source alpha/shoreline graph. Rework only surface colour and normals.
  for key in ['Base Color','Emission Color']:
   for link in list(p.inputs[key].links):l.remove(link)
  l.new(n['Color Ramp'].outputs['Color'],p.inputs['Base Color']);p.inputs['Emission Strength'].default_value=0
  p.inputs['Roughness'].default_value=.22;p.inputs['IOR'].default_value=1.333
  wave=n['Wave Texture'];wave.inputs['Scale'].default_value=1.4;wave.inputs['Distortion'].default_value=3.2
  ripples=n.new('ShaderNodeTexNoise');ripples.inputs['Scale'].default_value=1.7;ripples.inputs['Detail'].default_value=2;l.new(n['Geometry'].outputs['Position'],ripples.inputs['Vector'])
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.14;bump.inputs['Distance'].default_value=.045;l.new(ripples.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
  # Restrained broken foam, rather than repeated full white bands.
  mix=n.new('ShaderNodeMixRGB');mix.inputs[0].default_value=.03;l.new(n['Color Ramp'].outputs['Color'],mix.inputs[1]);l.new(n['Mix (Legacy)'].outputs[0],mix.inputs[2]);l.new(mix.outputs[0],p.inputs['Base Color'])
 if fid=='field_cm15_01':
  mat('fx-robot-orange',(.64,.18,.025),.36,.3);mat('fx-robot-cream',(.62,.66,.65),.36,.32);mat('fx-steel',(.26,.32,.36),.27,.8)
  # Existing articulated arms: explicit shoulder / elbow pivots, rigid children.
  for number in [16,17]:
   prefix=f'factory-{number}-arm-';shoulder=bpy.data.objects.get(prefix+'shoulder');elbow=bpy.data.objects.get(prefix+'elbow')
   if not shoulder or not elbow:raise RuntimeError('SOURCE_ARM_PIVOT_MISSING')
   pivot=bpy.data.objects.new(f'polish-{number}-shoulder-pivot',None);sc.collection.objects.link(pivot);pivot.location=shoulder.location
   elbow_p=bpy.data.objects.new(f'polish-{number}-elbow-pivot',None);sc.collection.objects.link(elbow_p);elbow_p.location=elbow.location
   bpy.context.view_layer.update();mw=elbow_p.matrix_world.copy();elbow_p.parent=pivot;elbow_p.matrix_world=mw
   for o in list(sc.objects):
    if o.name.startswith(prefix) and any(k in o.name[len(prefix):] for k in ['upper','elbow','fore','wrist','tool','grip']):
     mw=o.matrix_world.copy();o.parent=elbow_p if any(k in o.name for k in ['fore','wrist','tool','grip']) else pivot;o.matrix_world=mw
   for frame in range(1,50,4):
    a=2*math.pi*(frame-1)/48+(number-16)*math.pi
    pivot.rotation_euler.z=.065*math.sin(a);elbow_p.rotation_euler.z=-.10*math.sin(a)
    pivot.keyframe_insert(data_path='rotation_euler',frame=frame);elbow_p.keyframe_insert(data_path='rotation_euler',frame=frame)
   pivot['motion_contract']='Rigid shoulder + elbow cycle; fixed plinth; sweep audited separately'
  sc.frame_start=1;sc.frame_end=48;sc.render.fps=24;sc.frame_set(1)
 sc['art_status']='LOCAL_CANDIDATE_NOT_OWNER_ACCEPTED';sc['source_master']=SOURCE[fid];sc['fixed_direction']=True
 folder=OUT/'masters'/fid;folder.mkdir(parents=True,exist_ok=True);dest=folder/'refined.blend';sc.render.filepath=str(folder/'preview.png')
 bpy.ops.wm.save_as_mainfile(filepath=str(dest));bpy.ops.render.render(write_still=True)
 records.append({'fieldId':fid,'source':SOURCE[fid],'master':str(dest),'preview':sc.render.filepath})
(OUT/'representative-candidates.json').write_text(json.dumps(records,indent=2));result={'candidates':records}
