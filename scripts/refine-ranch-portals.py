"""Move complete original prop assemblies out of all current legal portals."""
import bpy,json,math,re
from pathlib import Path
from mathutils import Vector
ROOT=Path('R:/Projects/Championship2026/ranch-fixed-art-assets-20261021')
sources=json.loads((ROOT/'sources.json').read_text())
portals=json.loads((ROOT/'audit/portal-corridors.json').read_text())
fps={f['fieldId']:f for f in json.loads((ROOT/'audit/native-footprints.json').read_text(encoding='utf-8-sig'))['fields']}
S=math.sin(math.radians(52));K=16/math.sqrt(2)
def native(v):return ((v.x+v.y)*K,(v.x-v.y)*K*S)
def world(x,y):return Vector(((x+y/S)/(16*math.sqrt(2)),(x-y/S)/(16*math.sqrt(2)),0))
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def inside(p,poly):
 signs=[cross(a,b,p) for a,b in zip(poly,poly[1:]+poly[:1])]
 return all(v>=-.01 for v in signs) or all(v<=.01 for v in signs)
def hull(points):
 ps=sorted(set(points));a=[];b=[]
 for p in ps:
  while len(a)>1 and cross(a[-2],a[-1],p)<=0:a.pop()
  a.append(p)
 for p in reversed(ps):
  while len(b)>1 and cross(b[-2],b[-1],p)<=0:b.pop()
  b.append(p)
 return a[:-1]+b[:-1]
def distance(p,a,b):
 dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/max(1e-10,dx*dx+dy*dy)))
 return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
def touches(poly,points,r):return any(inside(p,poly) or any(distance(p,a,b)<r for a,b in zip(poly,poly[1:]+poly[:1])) for p in points)
records={}
for fid in portals:
 bpy.ops.wm.open_mainfile(filepath=sources[fid]);sc=bpy.context.scene;groups={};dg=bpy.context.evaluated_depsgraph_get()
 for o in sc.objects:
  if o.type not in {'MESH','CURVE'}:continue
  if not o.name.startswith(('meadow-shrub','meadow-ridge','meadow-boulder','volcano-crag','volcano-rock')):continue
  match=re.match(r'((?:meadow-(?:shrub|ridge|boulder)|volcano-(?:crag|rock))-\d+)',o.name)
  name=match.group(1) if match else o.name
  g=groups.setdefault(name,{'objects':[],'points':[],'contacts':[]});g['objects'].append(o)
  ev=o.evaluated_get(dg);mesh=ev.to_mesh();vertices=[ev.matrix_world@v.co for v in mesh.vertices];ev.to_mesh_clear()
  g['points']+=list(map(native,vertices))
  zmin=min(v.z for v in vertices)
  g['contacts']+=[native(v) for v in vertices if v.z<max(.22,zmin+.12)]
 for g in groups.values():g['hull']=hull(g['points'])
 cells=[c['polygon'] for c in fps[fid]['cells']];points=portals[fid]['points'];moves=[]
 def contained(poly):return all(any(inside(p,c) for c in cells) for p in poly)
 for name,g in groups.items():
  poly=g['hull']
  if not touches(poly,points,5.8) and contained(poly):continue
  offsets=sorted(((dx,dy) for dx in range(-48,49,2) for dy in range(-48,49,2)),key=lambda p:p[0]**2+p[1]**2)
  selected=None
  for dx,dy in offsets:
   moved=[(x+dx,y+dy) for x,y in poly]
   if not contained(moved) or touches(moved,points,5.8):continue
   # Retain a small gap from unrelated props. Original touching crag clusters
   # may remain touching; relocated pieces must not stack over other pieces.
   center=(sum(x for x,y in moved)/len(moved),sum(y for x,y in moved)/len(moved))
   if any(touches(other['hull'],[center],2) for key,other in groups.items() if key!=name):continue
   selected=(dx,dy,moved);break
  if selected is None:raise RuntimeError('NO_RIGID_PORTAL_RELOCATION:'+fid+':'+name)
  dx,dy,moved=selected
  for o in g['objects']:o.location+=world(dx,dy)
  g['hull']=moved;g['contacts']=[(x+dx,y+dy) for x,y in g['contacts']]
  moves.append({'group':name,'objects':[o.name for o in g['objects']],'nativeTranslation':[dx,dy]})
 folder=ROOT/'masters'/fid;folder.mkdir(parents=True,exist_ok=True)
 sc['portal_repair']='Rigid translations only; original geometry and all prop counts retained'
 bpy.ops.wm.save_as_mainfile(filepath=str(folder/'refined.blend'))
 records[fid]={'source':sources[fid],'moves':moves,'objects':sum(len(g['objects']) for g in groups.values()),'colliders':[{'group':name,'polygon':hull(g['contacts'])} for name,g in groups.items() if len(g['contacts'])>=3],'portalViolations':[name for name,g in groups.items() if touches(g['hull'],points,5.8)]}
(ROOT/'audit/portal-repair.json').write_text(json.dumps(records,indent=2));result={k:{'moved':len(v['moves']),'violations':v['portalViolations']} for k,v in records.items()}
