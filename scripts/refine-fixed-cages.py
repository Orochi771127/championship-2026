"""Local editable fixed-camera art candidates. Run through installed Blender MCP.
Sources are opened read-only and revised scenes are always saved under OUT.
"""
import bpy,math,json,re,hashlib
from pathlib import Path
from mathutils import Vector
OUT=Path('R:/Projects/Championship2026/ranch-fixed-art-assets-20261021')
SOURCE=json.loads((OUT/'sources.json').read_text())
S=math.sin(math.radians(52));K=16/math.sqrt(2)
def world(x,y,z=0):return Vector(((x+y/S)/(16*math.sqrt(2)),(x-y/S)/(16*math.sqrt(2)),z))
def native(v):return [(v.x+v.y)*K,(v.x-v.y)*K*S]
def mat(name,c,rough=.5,metal=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
def cube(name,p,size,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=name;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 b=o.modifiers.new('Manufactured radius','BEVEL');b.width=min(.025,min(size)*.15);b.segments=3;o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');return o
def rod(name,a,b,r,m):
 a,b=Vector(a),Vector(b);d=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d.length,location=(a+b)*.5)
 o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 bevel=o.modifiers.new('Edge radius','BEVEL');bevel.width=min(.015,r*.15);bevel.segments=2
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def shift(prefix,x,y):
 obs=[o for o in bpy.context.scene.objects if o.name.startswith(prefix)]
 pts=[o.matrix_world@Vector(p) for o in obs for p in o.bound_box]
 center=Vector(tuple((min(p[i] for p in pts)+max(p[i] for p in pts))*.5 for i in range(3)))
 delta=world(x,y)-Vector((center.x,center.y,0))
 for o in obs:o.location+=delta
def rack(name,x,y):
 origin=world(x,y);ax=world(1,.5).normalized();ay=Vector((-ax.y,ax.x,0));angle=math.atan2(ax.y,ax.x)
 def p(x,y,z):return origin+ax*x+ay*y+Vector((0,0,z))
 def box(s,x,y,z,sx,sy,sz,m):
  o=cube(name+'-'+s,p(x,y,z),(sx,sy,sz),m);o.rotation_euler.z=angle;return o
 box('rubber-platform',0,0,.06,2.8,2.6,.09,rubber)
 for side in [-1,1]:
  box('foot',side*1.04,0,.16,.22,2.4,.13,dark)
  for end in [-1,1]:
   box('upright',side*1.04,end*.88,1.68,.14,.14,3,red)
   for z in [.65,.95,1.25,1.55,1.85,2.15]:rod(name+'-pin',p(side*1.04-.085,end*.88,z),p(side*1.04+.085,end*.88,z),.025,chrome)
  box('top-side',side*1.04,0,3.2,.17,1.93,.18,red)
 rod(name+'-pullup',p(-1.04,-.88,3.2),p(1.04,-.88,3.2),.055,dark)
 rod(name+'-barbell',p(-1.65,.15,1.85),p(1.65,.15,1.85),.045,chrome)
 for side in [-1,1]:
  for k,r in enumerate([.34,.3,.23]):rod(name+'-plate',p(side*(1.18+k*.14),.15,1.85),p(side*(1.28+k*.14),.15,1.85),r,dark)
 box('bench-pad',0,.15,.68,.48,1.8,.17,rubber)
 for end in [-1,1]:box('bench-foot',0,.15+end*.65,.17,.72,.14,.15,dark);box('bench-leg',0,.15+end*.65,.42,.12,.12,.43,red)
def floor(fid):
 o=bpy.data.objects[fid+'-surface'];m=mat('polish-rubber-floor',(.1,.1,.1),.86);n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
 g=n.new('ShaderNodeNewGeometry');scale=n.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs[3].default_value=.85;l.new(g.outputs['Position'],scale.inputs[0])
 checker=n.new('ShaderNodeTexChecker');checker.inputs['Scale'].default_value=1;checker.inputs['Color1'].default_value=(.54,.14,.027,1);checker.inputs['Color2'].default_value=(.055,.065,.074,1)
 l.new(scale.outputs[0],checker.inputs[0]);l.new(checker.outputs['Color'],p.inputs['Base Color'])
 noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=110;noise.inputs['Detail'].default_value=2
 l.new(g.outputs['Position'],noise.inputs[0]);b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.13;b.inputs['Distance'].default_value=.006;l.new(noise.outputs['Fac'],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal'])
 o.data.materials.clear();o.data.materials.append(m)
def style(sc):
 sc.render.engine='CYCLES';sc.cycles.samples=96;sc.cycles.use_denoising=True;sc.render.film_transparent=True
 sc.view_settings.view_transform='Khronos PBR Neutral';sc.view_settings.look='None';sc.view_settings.exposure=.1
 for o in sc.objects:
  if o.type=='LIGHT' and o.data.type=='SUN':o.data.angle=.12;o.data.energy=2.3
 for m in bpy.data.materials:
  if not m.use_nodes:continue
  for n in m.node_tree.nodes:
   if n.type=='BUMP':n.inputs['Distance'].default_value=min(n.inputs['Distance'].default_value,.025)
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='OPTIX'
 sc.cycles.device='GPU';sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA'
records=[]
for fid in ['field_cm05_01','field_cm34_01']:
 bpy.ops.wm.open_mainfile(filepath=SOURCE[fid]);sc=bpy.context.scene
 red=mat('gy-frame',(.52,.025,.018),.37,.36);dark=mat('polish-black-steel',(.028,.035,.043),.4,.65);rubber=mat('gy-pad',(.025,.029,.035),.83);chrome=mat('gy-chrome',(.56,.63,.68),.24,.9)
 mat('gy-frame-dark',(.43,.02,.017),.38,.4);mat('gy-locker',(.5,.025,.018),.4,.35);mat('gy-red',(.045,.05,.055),.78);mat('gy-mat',(.06,.07,.08),.9)
 floor(fid)
 if fid=='field_cm05_01':
  for o in list(sc.objects):
   if o.name.startswith(('gym-treadmill','gym-locker','gym-barre','gym-towel','gym-mat','gym05-03','gym05-04')):bpy.data.objects.remove(o,do_unlink=True)
  shift('gym05-00',143,153);shift('gym05-01',94,99);shift('gym05-02',140,101);shift('gym05-05',214,70)
  rack('polish-50-rack',96,60);rack('polish-51-rack',188,58)
  for prefix,x,y in [('polish-50-rack',96,60),('polish-51-rack',188,58)]:
   center=world(x,y)
   for o in sc.objects:
    if o.name.startswith(prefix):o.location=center+(o.location-center)*.7;o.scale*=.7
  # A compact two-tier dumbbell station in the lower-left cell, away from seams.
  c=world(35,140)
  for z in [.52,.92]:
   cube('polish-52-storage-shelf',c+Vector((0,0,z)),(1.7,.48,.09),dark)
   for k in range(5):
    a=c+Vector((-.64+k*.32,-.16,z+.15));b=a+Vector((0,.32,0));rod('polish-52-handle',a,b,.025,chrome)
    for v in [a,b]:rod('polish-52-weight',v-Vector((0,.035,0)),v+Vector((0,.035,0)),.1,dark)
  for x in [-.7,.7]:cube('polish-52-storage-leg',c+Vector((x,0,.49)),(.09,.42,.88),red)
 else:
  for o in list(sc.objects):
   if o.name.startswith(('gym34-00','gym34-01')):bpy.data.objects.remove(o,do_unlink=True)
  shift('small-gym-locker',46,29);shift('small-gym-mat',31,66);shift('gym34-02',72,69)
 style(sc);sc['art_status']='LOCAL_CANDIDATE_NOT_OWNER_ACCEPTED';sc['source_master']=SOURCE[fid];sc['fixed_direction']=True
 folder=OUT/'masters'/fid;folder.mkdir(parents=True,exist_ok=True);dest=folder/'refined.blend';sc.render.filepath=str(folder/'preview.png')
 bpy.ops.wm.save_as_mainfile(filepath=str(dest));bpy.ops.render.render(write_still=True)
 records.append({'fieldId':fid,'source':SOURCE[fid],'master':str(dest),'preview':sc.render.filepath})
(OUT/'gym-candidates.json').write_text(json.dumps(records,indent=2))
result={'candidates':records}
