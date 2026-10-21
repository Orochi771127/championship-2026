"""Rasterize evaluated contact hulls, retaining native ownership boundaries."""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
ART=Path('R:/Projects/Championship2026/ranch-fixed-art-assets-20261021')
source=json.loads((ROOT/'src/data/championship/catalogs/raising-ground.r1.json').read_text())
repair=json.loads((ART/'audit/portal-repair.json').read_text())
bounds=json.loads((ART/'audit/model-bounds.json').read_text())
conveyor=json.loads((ROOT/'src/data/championship/catalogs/ranch-conveyor.r1.json').read_text())
footprints={f['fieldId']:f for f in json.loads((ART/'audit/native-footprints.json').read_text(encoding='utf-8-sig'))['fields']}
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def inside(p,poly):
 s=[cross(a,b,p) for a,b in zip(poly,poly[1:]+poly[:1])]
 return all(v>=0 for v in s) or all(v<=0 for v in s)
def intersects(poly,x,y):
 box=[(x-4,y-4),(x+4,y-4),(x+4,y+4),(x-4,y+4)]
 if any(inside(p,poly) for p in box) or any(inside(p,box) for p in poly):return True
 for a,b in zip(poly,poly[1:]+poly[:1]):
  for c,d in zip(box,box[1:]+box[:1]):
   if cross(a,b,c)*cross(a,b,d)<0 and cross(c,d,a)*cross(c,d,b)<0:return True
 return False
def runs(values):
 out=[]
 for v in values:
  if out and out[-1][1:]==v:out[-1][0]+=1
  else:out.append([1,*v])
 return out
out=[]
for fid,data in bounds.items():
 definition=data['definitionIndex']
 if definition>=35:continue
 f=next(f for f in source['fields'] if f['definitionIndex']==definition);w=f['width'];h=f['height']
 cells=[list(v) for n,*v in f['runs'] for _ in range(n)]
 if definition==conveyor['definitionIndex']:
  # The Owner made the actual belt rideable. Its evaluated surface extends
  # beyond the old painted walking guide, but never beyond the occupied hexes.
  for i,c in enumerate(cells):
   x,y=i%w*8+4,i//w*8+4
   if any(inside((x,y),hexagon['polygon']) for hexagon in footprints[fid]['cells']) and any(intersects(s['polygon'],x,y) for s in conveyor['surfaces']):
    if not c[0]:c[0]=1;c[1]=0
 colliders=[c for c in data['colliders'] if not c['group'].startswith(('volcano-rock','volcano-smoke')) and not any(k in c.get('object',c['group']) for k in ['-cloud-','-smoke-','-flame-','-spark-','-tuft-','-grass-','-petal-','-bloom-','-leaf-'])]
 for col in colliders:col['bounds']=(min(p[0] for p in col['polygon']),min(p[1] for p in col['polygon']),max(p[0] for p in col['polygon']),max(p[1] for p in col['polygon']))
 for i,c in enumerate(cells):
  x,y=i%w*8+4,i//w*8+4
  if c[0] and any(col['bounds'][0]<=x+4 and col['bounds'][2]>=x-4 and col['bounds'][1]<=y+4 and col['bounds'][3]>=y-4 and intersects(col['polygon'],x,y) for col in colliders):c[1]=1;c[2]=0
 maximum=max(r[1] for r in f['clearanceRuns']);blocked=[(i%w,i//w) for i,c in enumerate(cells) if not c[0] or c[1]==1]
 clearance=[]
 for i,c in enumerate(cells):
  x,y=i%w,i//w
  distance=0 if not c[0] or c[1]==1 else min(maximum,x+1,y+1,w-x,h-y,min((max(abs(x-bx),abs(y-by)) for bx,by in blocked),default=maximum))
  c[2]=distance;clearance.append([distance])
 out.append({'definitionIndex':definition,'width':w,'height':h,'runs':runs(cells),'clearanceRuns':runs(clearance)})
doc={'schemaVersion':1,'adaptation':'OWNER_APPROVED_3D_CAGE_MODEL_CONTACTS_20261021','source':'Evaluated original Blender contact hulls after rigid portal repair; native ownership retained','fields':out}
(ROOT/'src/data/championship/catalogs/ranch-three-ground.r1.json').write_text(json.dumps(doc,indent=2))
print({f['definitionIndex']:sum(r[0] for r in f['runs'] if r[1] and r[2]==1) for f in out})
