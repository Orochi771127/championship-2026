"""Bounded retained-geometry negatives, with live source-alpha proof at the known tread witness."""
from pathlib import Path
import json,importlib.util,gzip,hashlib,numpy as np
O=Path(__file__).parent
spec=importlib.util.spec_from_file_location('retained_oracle',O/'retained-oracle.py');oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle)
def inspect_retained(record,root,case_id,mode):
 retained=record['retained'];assert retained['before']==retained['after'];assert retained['fieldId'] in ['field_cm18_01','field_cm34_01'];live=[s for s in retained['surfaces']if s['effectiveVisible']];assert live
 for s in live:
  for m in s['materials']:
   assert m['visible'] and m['opacity']==1 and not m['transparent'] and m['alphaTest']==.12 and m['depthWrite'] and m['depthTest'] and m['depthFunc']==3
   assert not m['alphaToCoverage'] and not m['alphaHash'] and not m['polygonOffset']
   t=m['map'];assert t['channel']==0 and t['flipY'] is False and t['magFilter']==1006 and t['minFilter']==1008
   assert t['matrix']==[1,0,0,0,1,0,0,0,1] and t['offset']==[0,0] and t['repeat']==[1,1] and t['rotation']==0
   gpu=m['gpu'];assert gpu['programAvailable'] and gpu['framebuffer']['target'] is None and gpu['framebuffer']['viewport']==[0,0,390,844] and not gpu['framebuffer']['scissorTest'];assert gpu['framebuffer']['samples']>0 and gpu['framebuffer']['depthBits']>0
   assert m['uniforms']['mapTransform']==[1,0,0,0,1,0,0,0,1] and m['uniforms']['opacity']==1
   assert m['uniforms']['alphaTest']==float(np.float32(.12))
 path=Path(root)/mode/case_id/'evidence.json.gz';out=Path(root)/mode/case_id/'retained-geometry.json';report=oracle.run(path,out)
 added=sum(len(q['addedInsideGeometryCandidates'])for q in report['sameHeightComparisons'])
 result={'id':case_id,'mode':mode,'candidateAddedGeometryPixels':added,'geometryWholePixels':len(report['wholePixelGeometryCandidates']),'knownOpaquePixel':{},'scope':'All retained geometry conservatively checked; only known UV-bounded tread witness has independently certified alpha. No allpositions claim.'}
 if case_id=='walk-scripted-22':
  witness=json.load(open(O/'opaque-tread-witness.json'));assert witness['fieldId']==retained['fieldId'];src=[q for q in report['sources']if q['sourceTriangleIndex']==40233];assert len(src)==1
  surface=next(s for s in live if s['id']==src[0]['objectId']);m=surface['materials'][0];t=m['map'];assert [t['width'],t['height']]==[1024,1024]
  patch=m['decodedAlphaProbe'];assert [patch['x'],patch['y'],patch['width'],patch['height']]==[304,492,16,48];assert patch['sourceWidth']==patch['sourceHeight']==1024;assert patch['alpha']==witness['decodedAlphaPatch']
  M=lambda a:np.array(a).reshape(4,4,order='F');state=record['intensity']['beforeState'];vp=M(state['camera']['projection'])@M(state['camera']['inverse']);xyz=np.array(witness['positions']);uv=np.array(witness['uv']);assert xyz[:,1].max()<.35
  h=np.c_[xyz,np.ones(3)]@(vp@M(surface['matrixWorld'])).T;ndc=h[:,:3]/h[:,3:];screen=np.c_[(ndc[:,0]+1)*195,(1-ndc[:,1])*422];A=np.c_[screen,np.ones(3)];c=np.linalg.solve(A,uv);corners=np.array([[195,532,1],[196,532,1],[196,533,1],[195,533,1]]);bary=np.linalg.solve(A.T,corners.T).T;assert bary.min()>.1
  lod=np.log2(max(np.linalg.norm(c[0]*1024),np.linalg.norm(c[1]*1024)));assert lod<0
  uvc=corners@c;lo,hi=uvc.min(0),uvc.max(0);axes=[sorted(set([lo[j],hi[j]]+[(k+.5)/1024 for k in range(1024)if lo[j]<(k+.5)/1024<hi[j]]))for j in range(2)];alpha=np.array(patch['alpha']).reshape(48,16)/255
  def sample(u,v):
   x=u*1024-.5;y=v*1024-.5;i=int(np.floor(x));j=int(np.floor(y));fx=x-i;fy=y-j;assert 304<=i<i+1<320 and 492<=j<j+1<540
   return sum(alpha[j+dy-492,i+dx-304]*(fx if dx else 1-fx)*(fy if dy else 1-fy)for dx in [0,1]for dy in [0,1])
  alpha_min=min(sample(u,v)for u in axes[0]for v in axes[1]);assert alpha_min==1
  assert [195,532] in report['wholePixelGeometryCandidates'];values={}
  for pair,stock in zip(record['intensity']['pairs'],record['stock']['records']):
   ref,a,s=map(oracle.decode,[pair['reference'],pair['actual'],stock['actual']]);assert ref[532,195]==255 and s[532,195]==0;values[pair['target']]=int(a[532,195])
  if mode=='point':assert values=={'default':0,'offscreen':0},'OPAQUE_HIGHER_TREAD_OVERDRAW'
  else:assert values=={'default':128,'offscreen':0},'FROZEN_FAILURE_MUST_REPRODUCE'
  result['knownOpaquePixel']=values;result['alphaLowerBound']=alpha_min;result['computedLod']=float(lod)
 return result
