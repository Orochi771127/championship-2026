"""CM07 opaque retained-column oracle; exact full-pixel region geometry, no GPU sample assumptions."""
import sys,json,hashlib
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0,'/tmp/ranch-overlay-shapely')
from shapely.geometry import Polygon,box
from shapely.ops import unary_union
P=Path(__file__).parent

def matrix(a):return np.asarray(a,dtype=float).reshape(4,4,order='F')
def transform(a,m):
 p=np.concatenate([a,np.ones((*a.shape[:-1],1))],axis=-1)@m.T
 return p[...,:3]/p[...,3:4]
def plane(t):return np.linalg.solve(np.c_[t[:,:2],np.ones(3)],t[:,2])
def clip(poly,coef):
 """Sutherland-Hodgman against affine coef dot [x,y,1] <= 0."""
 out=[]
 for a,b in zip(poly,np.roll(poly,-1,axis=0)):
  da=np.r_[a,1]@coef;db=np.r_[b,1]@coef
  if da<=0:out.append(a)
  if (da<=0)!=(db<=0):out.append(a+(b-a)*da/(da-db))
 return np.asarray(out)
def mask(path):
 path=Path(path)
 if path.suffix.lower()!='.json':return np.asarray(Image.open(path).convert('RGB'))[:,:,0]
 q=json.loads(path.read_text());w=q['width'];h=q['height'];assert isinstance(w,int) and isinstance(h,int) and 0<w<=8192 and 0<h<=8192
 total=0;pieces=[]
 for count,value in q['runs']:
  assert isinstance(count,int) and isinstance(value,int) and count>0 and 0<=value<=255
  total+=count;assert total<=w*h;pieces.append(np.full(count,value,dtype=np.uint8))
 assert total==w*h
 return np.concatenate(pieces).reshape(h,w)

def run(raw,reference,actual,output):
 q=json.loads(Path(raw).read_text());s=q['debugStates']['beforeMasks'];objects={o['id']:o for o in s['objects']};materials={m['id']:m for m in s['materials']};meta=json.loads((P/'assets.json').read_text());assert hashlib.sha256((P/'columns-local.npz').read_bytes()).hexdigest()==meta['npzSha256'];geo=np.load(P/'columns-local.npz')
 def vis(o):return o['visible'] and(o['parent'] is None or vis(objects[o['parent']]))
 tid=q['gpuDebug']['actual']['original']['material']['id'];targets=[o for o in objects.values() if vis(o) and tid in o['materialIds']];assert len(targets)==1;target=targets[0];assert target['geometryType']=='PlaneGeometry' and target['positionCount']==4 and target['indexCount']==6
 ref=mask(reference);act=mask(actual);assert ref.shape==act.shape==(q['height'],q['width']);h,w=ref.shape;ys,xs=np.where(ref>0);assert len(xs)>0
 vp=matrix(s['camera']['projection'])@matrix(s['camera']['inverse']);ivp=np.linalg.inv(vp);ray=matrix(s['camera']['world'])[:3,2];assert abs(ray[1])>.1
 unit=np.array([[-.5,-.5,0],[.5,-.5,0],[.5,.5,0]]);sprite=transform(unit,vp@matrix(target['matrixWorld']));sp=plane(sprite)
 # CM07 nominal support H=0. Only .015 floor cap, not unknown raised surfaces.
 sample=np.array([[-1,-1],[1,-1],[1,1]]);orig=transform(np.c_[sample,np.zeros(3)],ivp);cap=orig+((.015-orig[:,1])/ray[1])[:,None]*ray;fp=plane(transform(cap,vp))
 bbox=box(xs.min()*2/w-1,1-(ys.max()+1)*2/h,(xs.max()+1)*2/w-1,1-ys.min()*2/h)
 polygons=[];sources=[];epsilon=1e-7
 for spec in meta['nodes']:
  matches=[o for o in objects.values() if vis(o) and o.get('name')==spec['nodeName']];assert matches,'MISSING_VISIBLE_COLUMN_NODE_'+spec['nodeName']
  for o in matches:
   assert o['positionCount']==spec['positionCount'] and o['indexCount']==spec['indexCount'];assert len(o['materialIds'])==1;m=materials[o['materialIds'][0]];assert m['visible'] and m['depthWrite'] and m['depthTest'] and m['side']==2 and m['opacity']==1 and not m['transparent'],'COLUMN_MATERIAL_DRIFT'
   tris=transform(geo['node'+str(spec['nodeIndex'])],vp@matrix(o['matrixWorld']));lo=tris[:,:,:2].min(1);hi=tris[:,:,:2].max(1);keep=((hi>=np.array(bbox.bounds[:2]))&(lo<=np.array(bbox.bounds[2:]))).all(1);count=0
   for t in tris[keep]:
    if abs(np.linalg.det(np.c_[t[:,:2],np.ones(3)]))<1e-16:continue
    tp=plane(t);poly=t[:,:2]
    # Nearer than BOTH raw sprite and floor proxy: works for original/final depth,
    # and proves a retained-column foreground region independent of proxy activation.
    for targetplane in [sp,fp]:
     co=tp-targetplane;co[2]+=epsilon;poly=clip(poly,co)
     if len(poly)<3:break
    if len(poly)<3:continue
    p=Polygon(poly).intersection(bbox)
    if not p.is_empty and p.area>1e-18:polygons.append(p);count+=1
   sources.append({'objectId':o['id'],'nodeIndex':spec['nodeIndex'],'nodeName':spec['nodeName'],'matrixWorld':o['matrixWorld'],'candidateTriangles':int(keep.sum()),'frontPolygons':count})
 foreground=unary_union(polygons);blocked=[];edge=[];clear=[];lower=[]
 for x,y in zip(xs,ys):
  rect=box(x*2/w-1,1-(y+1)*2/h,(x+1)*2/w-1,1-y*2/h);corners=np.asarray(rect.exterior.coords)[:-1];depth=np.c_[corners,np.ones(4)]@sp;world=transform(np.c_[corners,depth],ivp);low=bool(np.max(world[:,1])<.015)
  if foreground.covers(rect):blocked.append([int(x),int(y)]);lower.append(low)
  elif foreground.intersects(rect):edge.append([int(x),int(y)])
  else:clear.append([int(x),int(y)])
 violations=[p for p in blocked if act[p[1],p[0]]!=0];regionmask=np.zeros((h,w,3),dtype=np.uint8)
 for color,pts in [((0,100,200),clear),((255,190,0),edge),((200,0,100),blocked)]:
  for x,y in pts:regionmask[y,x]=color
 Image.fromarray(regionmask).save(str(output)+'.regions.png')
 result={'schema':1,'status':'OPAQUE_COLUMN_BLOCK_VIOLATION' if violations else 'NO_GUARANTEED_COLUMN_BLOCK_VIOLATION','glbSha256':meta['glbSha256'],'rawSha256':hashlib.sha256(Path(raw).read_bytes()).hexdigest(),'referenceSha256':hashlib.sha256(Path(reference).read_bytes()).hexdigest(),'actualSha256':hashlib.sha256(Path(actual).read_bytes()).hexdigest(),'targetObjectId':target['id'],'columnInstances':sources,'referenceNonzeroPixels':len(xs),'guaranteedWholePixelColumnBlocked':len(blocked),'guaranteedBlockedLowerCapPixels':int(sum(lower)),'partialEdgePixels':len(edge),'noColumnForegroundPixels':len(clear),'nonzeroActualInsideGuaranteedBlock':violations,'wholePixelBlockedCoordinates':blocked,'partialEdgeCoordinates':edge,'limitations':['Only pinned opaque basalt nodes5/6/7, not rocks/smoke/other maps/other actors.','No-column region is NOT proof of total visibility: other occluders remain possible.','Partial edges intentionally unresolved; no assumed MSAA sample locations or intensity tolerance.','Requires actual source pin and target/floor geometry unchanged; CM07 nominal H0 only.','Geometry front-region epsilon1e-7 clip-space is conservative; omitted borderline regions are not a pass.','No stable-block coverage => cannot claim pillar occlusion tested.']}
 Path(output).write_text(json.dumps(result,indent=2));return result
if __name__=='__main__':print(json.dumps(run(*sys.argv[1:]),indent=2))
