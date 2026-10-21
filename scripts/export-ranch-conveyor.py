"""Export a rideable surface and direction from the original Blender conveyor."""
import bpy,json,math,hashlib
from pathlib import Path
ART=Path('R:/Projects/Championship2026/ranch-fixed-art-assets-20261021');ROOT=Path('R:/Projects/Championship2026/ranch-fixed-art-polish-20261021')
source=ART/'three-masters/field_cm15_01/editable.blend';bpy.ops.wm.open_mainfile(filepath=str(source));dg=bpy.context.evaluated_depsgraph_get();surfaces=[];drums={}
def xy(p):return [(p.x+p.y)*16/math.sqrt(2),(p.x-p.y)*16/math.sqrt(2)*math.sin(math.radians(52))]
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def hull(points):
 ps=sorted(set(map(tuple,points)));lo=[];hi=[]
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(ps):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
for o in bpy.context.scene.objects:
 if o.type!='MESH' or not ('-belt-belt' in o.name or '-belt-start-drum' in o.name or '-belt-end-drum' in o.name):continue
 ev=o.evaluated_get(dg);me=ev.to_mesh();ps=[ev.matrix_world@v.co for v in me.vertices];ev.to_mesh_clear()
 if '-belt-belt' in o.name:
  surfaces.append({'object':o.name,'polygon':hull([xy(p) for p in ps]),'height':max(p.z for p in ps)+.02})
 else:drums['start' if '-start-' in o.name else 'end']=[sum(xy(p)[i] for p in ps)/len(ps) for i in range(2)]
# Straight belt sections define the axis; asymmetric end caps do not.
centers={s['object']:[sum(p[i] for p in s['polygon'])/len(s['polygon']) for i in range(2)] for s in surfaces}
dx,dy=[centers['factory-11-belt-belt'][i]-centers['factory-01-belt-belt'][i] for i in range(2)];length=math.hypot(dx,dy)
result={'schemaVersion':1,'adaptation':'OWNER_APPROVED_RIDEABLE_FACTORY_CONVEYOR_20261021','definitionIndex':14,'fieldId':'field_cm15_01','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'nativePixelsPerTick':.14,'direction':[dx/length,dy/length],'surfaces':surfaces}
(ROOT/'src/data/championship/catalogs/ranch-conveyor.r1.json').write_text(json.dumps(result,indent=2))
(ART/'audit/conveyor-surface.json').write_text(json.dumps(result,indent=2))
