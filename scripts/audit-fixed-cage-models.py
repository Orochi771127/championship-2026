"""Use exported native footprint authority and evaluated Blender geometry."""
import json,math
from pathlib import Path
ROOT=Path('R:/Projects/Championship2026/ranch-fixed-art-assets-20261021')
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def hull(points):
 pts=sorted(set(map(tuple,points)))
 if len(pts)<3:return pts
 lo=[];hi=[]
 for p in pts:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(pts):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def inside(p,poly):
 signs=[cross(a,b,p) for a,b in zip(poly,poly[1:]+poly[:1])]
 return all(v>=-.02 for v in signs) or all(v<=.02 for v in signs)
def distance(p,a,b):
 dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/max(1e-10,dx*dx+dy*dy)))
 return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
def near(p,poly,r):return inside(p,poly) or any(distance(p,a,b)<r for a,b in zip(poly,poly[1:]+poly[:1]))

def area(poly):return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1])))/2
def clip(poly,cell):
 for a,b in zip(cell,cell[1:]+cell[:1]):
  result=[]
  for p,q in zip(poly,poly[1:]+poly[:1]):
   cp,cq=cross(a,b,p),cross(a,b,q)
   if cp>=0:result.append(p)
   if (cp>=0)!=(cq>=0):
    t=cp/(cp-cq);result.append([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])])
  poly=result
  if not poly:break
 return poly
models=json.loads((ROOT/'audit/model-geometry.json').read_text());fps={f['fieldId']:f for f in json.loads((ROOT/'audit/native-footprints.json').read_text(encoding='utf-8-sig'))['fields']}
out={}
for fid,model in models.items():
 fp=fps[fid];bad=[];colliders=[];crossingParts=[]
 for name,g in model['groups'].items():
  points=g['projection'];outside=[p for p in points if not any(inside(p,c['polygon']) for c in fp['cells'])]
  if outside:bad.append({'group':name,'outsidePoints':len(outside),'examples':outside[:4]})
  for part in g.get('projectionParts',[]):
   polygon=hull(part['points'])
   if len(polygon)<3 or any(all(inside(p,c['polygon']) for p in polygon) for c in fp['cells']):continue
   uncovered=area(polygon)-sum(area(clip(polygon,c['polygon'])) for c in fp['cells'])
   if uncovered>.02:crossingParts.append({'group':name,'object':part['object'],'uncoveredNativeArea':uncovered})
  for part in g.get('contactParts',[]):
   polygon=hull(part['points'])
   if len(polygon)>=3:colliders.append({'group':name,'object':part['object'],'polygon':polygon})
 out[fid]={'definitionIndex':fp['definitionIndex'],'outside':bad,'crossingParts':crossingParts,'colliders':colliders}
(ROOT/'audit/model-bounds.json').write_text(json.dumps(out,indent=2))
print(json.dumps({k:{'outside':v['outside'],'colliders':len(v['colliders'])} for k,v in out.items()},indent=2))
