"""Offline CM18/34 retained source geometry: alpha uncertainty is NOT an opaque pass."""
from pathlib import Path
import json,gzip,hashlib,sys,numpy as np
sys.path.insert(0,'/tmp/ranch-overlay-shapely')
from shapely.geometry import Polygon,box
from shapely.ops import unary_union
O=Path(__file__).parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def matrix(v):return np.array(v,dtype=float).reshape(4,4,order='F')
def transform(p,m):
 h=np.concatenate([p,np.ones((*p.shape[:-1],1))],axis=-1)@m.T
 return h[...,:3]/h[...,3:4]
def plane(t):return np.linalg.solve(np.c_[t[:,:2],np.ones(3)],t[:,2])
def clip(p,c):
 q=[]
 for a,b in zip(p,np.roll(p,-1,axis=0)):
  da=np.r_[a,1]@c;db=np.r_[b,1]@c
  if da<=0:q.append(a)
  if (da<=0)!=(db<=0):q.append(a+(b-a)*da/(da-db))
 return np.array(q)
def decode(q):
 assert all(type(n)==type(v)==int and n>0 and 0<=v<=255 for n,v in q['runs']);assert sum(n for n,v in q['runs'])==q['width']*q['height']
 return np.repeat(np.array([v for n,v in q['runs']],dtype=np.int16),[n for n,v in q['runs']]).reshape(q['height'],q['width'])
def run(path,output):
 path=Path(path);raw=path.read_bytes();r=json.loads(gzip.decompress(raw) if path.suffix=='.gz' else raw);assert r['sourceSha256'] in ['a2b55e308112ac1ce838913105e649142bad3883a2e4ed2f02a04a37b9ef77a6','4eebd5f756597164a1be9223c30aba6c521f312844a2b36c00064d71cd7b0338'];i=r['intensity'];s=i['beforeState'];contact=r['data']['groundContact'];H=float(contact['height']);assert np.isfinite(H);objects={o['id']:o for o in s['objects']};materials={m['id']:m for m in s['materials']};meta=json.load(open(O/'assets.json'));fid=r.get('fieldId') or r['data'].get('fieldId')
 if not fid:
  ids={o.get('name','').removesuffix('-runtime-static') for o in objects.values()};matches=[f['fieldId'] for f in meta['fields'] if f['fieldId'] in ids];assert len(matches)==1;fid=matches[0]
 spec=next(f for f in meta['fields'] if f['fieldId']==fid);assert sha((O/spec['npz']).read_bytes())==spec['npzSha256'];g=np.load(O/spec['npz']);tri=g['positions'][g['indices']];tags=g['semanticTags'];vp=matrix(s['camera']['projection'])@matrix(s['camera']['inverse']);ivp=np.linalg.inv(vp);ray=matrix(s['camera']['world'])[:3,2];assert abs(ray[1])>.1
 part=next(p for p in i['targetGeometry']['parts'] if p['role']=='upper');verts=part['vertices'];sp=plane(np.array([v['ndc'] for v in verts[:3]]));sample=np.array([[-1,-1],[1,-1],[1,1]]);origin=transform(np.c_[sample,np.zeros(3)],ivp);cap=origin+((H+.015-origin[:,1])/ray[1])[:,None]*ray;fp=plane(transform(cap,vp));pairs=i['pairs'];stock=r['stock']['records'];assert [x['target'] for x in pairs]==[x['target'] for x in stock]
 refs=[]
 for p,st in zip(pairs,stock):
  a,b=decode(p['reference']),decode(st['reference']);assert np.array_equal(a,b);refs.append(a)
  u=p['gpuDebug']['actual']['logicalMeshes'][0]['mask']['uniforms'];assert u.get('uRanchSupportCount',0)==0;assert abs(u['uRanchFloor']-(H+.015))<1e-7
 ref=np.maximum.reduce(refs);height,width=ref.shape;ys,xs=np.where(ref>0);assert len(xs);bbox=box(xs.min()*2/width-1,1-(ys.max()+1)*2/height,(xs.max()+1)*2/width-1,1-ys.min()*2/height)
 def visible(o,seen=None):
  seen=set() if seen is None else seen;assert o['id'] not in seen;seen.add(o['id']);return o['visible'] and(o['parent'] is None or visible(objects[o['parent']],seen))
 polys=[];sources=[];epsilon=1e-7
 for obj in objects.values():
  if obj.get('name')!=spec['runtimeMeshName'] or not visible(obj):continue
  assert obj['positionCount']==spec['positionCount'] and obj['indexCount']==spec['indexCount'];assert len(obj['materialIds'])==1;m=materials[obj['materialIds'][0]]
  if not(m['visible'] and m['depthWrite'] and m['depthTest']):continue
  assert m['opacity']==1 and not m['transparent'];assert m['side'] in [0,1,2];projected=transform(tri,vp@matrix(obj['matrixWorld']));lo=projected[:,:,:2].min(1);hi=projected[:,:,:2].max(1);keep=((hi>=bbox.bounds[:2])&(lo<=bbox.bounds[2:])).all(1);count=0
  for idx in np.where(keep)[0]:
   t=projected[idx];det=np.linalg.det(np.c_[t[:,:2],np.ones(3)])
   if abs(det)<1e-16 or (m['side']==0 and det<0) or(m['side']==1 and det>0):continue
   tp=plane(t);poly=t[:,:2]
   for targetplane in [sp,fp]:
    c=tp-targetplane;c[2]+=epsilon;poly=clip(poly,c)
    if len(poly)<3:break
   if len(poly)<3:continue
   pg=Polygon(poly).intersection(bbox)
   if pg.is_empty or pg.area<=1e-18:continue
   polys.append(pg);sources.append({'objectId':obj['id'],'sourceTriangleIndex':int(idx),'semanticTags':int(tags[idx]),'materialId':m['id'],'depthPlaneNdc':tp.tolist(),'matrixWorld':obj['matrixWorld']});count+=1
 fg=unary_union(polys);whole=[];edge=[]
 for x,y in zip(xs,ys):
  pixel=box(x*2/width-1,1-(y+1)*2/height,(x+1)*2/width-1,1-y*2/height)
  if fg.covers(pixel):whole.append([int(x),int(y)])
  elif fg.intersects(pixel):edge.append([int(x),int(y)])
 comparisons=[]
 for p,st in zip(pairs,stock):
  a,b=decode(p['actual']),decode(st['actual']);added=[{'pixel':[x,y],'stock':int(b[y,x]),'recovery':int(a[y,x])} for x,y in whole if a[y,x]>b[y,x]];conflict=[{'pixel':[x,y],'stock':int(b[y,x]),'recovery':int(a[y,x])} for x,y in whole if b[y,x]>0];comparisons.append({'target':p['target'],'addedInsideGeometryCandidates':added,'stockPositiveGeometryCandidates':conflict})
 out={'status':'GEOMETRY_CANDIDATES_ALPHA_REVIEW_REQUIRED_NOT_GPU_PASS','evidenceSha256':sha(raw),'sourceSha256':r['sourceSha256'],'glbSha256':spec['glbSha256'],'groundContact':contact,'actualHeight':H,'projectedSupportCount':0,'sources':sources,'wholePixelGeometryCandidates':whole,'partialEdgesUnresolved':edge,'sameHeightComparisons':comparisons,'limitations':['Source geometry only; alphaTest/map sampling unresolved until actual sampler/UV state and per-region alpha are verified.','Candidate increase inside a geometry candidate is a review witness, not automatically proven opaque overdraw.','Once opaque region is independently certified, ANY candidate-added intensity is failure; baseline-common conflict stays unresolved, never absolutezeroPASS.','Higher physical tread and mat surfaces remain occluders; derived collision bridges are absent.','Uses actual captured upper quad at actual groundContact height, not H0/planned origin.','Whole-pixel double precision predicates may differ from finite GPU rasterization; edge/sliver cases not passes.','Only these authored fields; generated effects/other maps may additionally occlude.']};Path(output).write_text(json.dumps(out,indent=2));return out
if __name__=='__main__':
 result=run(*sys.argv[1:]);print(json.dumps({k:v for k,v in result.items() if k not in ['sources','wholePixelGeometryCandidates','partialEdgesUnresolved']},indent=2))
