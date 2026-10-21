"""Bounded causal measurement, not a relaxed A2 acceptance comparator."""
import json,gzip,sys,importlib.util,hashlib
from pathlib import Path
import numpy as np
root=Path(sys.argv[1]);oracle_dir=Path(sys.argv[2]);doc=json.loads((root/'depth-identity-results.json').read_text());assert doc['failure'] is None and doc['selectedFrames']==[4,16,87] and len(doc['results'])==3
pins={'baseline4f':'1d60444883f996bcf939a4989b84bd602efe03cbe7ec35db59ef84f3abb134a6','identity-depth-only':'e2dea23666706f92d4a6a3a4ab7e2ed99ebbda4170f67bcb30bf31a6d3fec71a','final-wiring253b':'253b395eeae17428d1868aa3886b4723ebad34ad646ee250b4047aae50181549'}
records={r['mode']:json.loads(gzip.decompress((root/r['ledger']).read_bytes())) for r in doc['results']};assert set(records)==set(pins)
for mode,r in records.items():assert r['sourceSha256']==pins[mode] and [x['sample']['index'] for x in r['ledger']]==[4,16,87]
spec=importlib.util.spec_from_file_location('column_oracle',oracle_dir/'oracle.py');oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle)
def decode(q):
 assert q['width']==390 and q['height']==844 and all(type(n)==type(v)==int and n>0 and 0<=v<=255 for n,v in q['runs']);assert sum(n for n,v in q['runs'])==390*844
 return np.repeat(np.array([v for n,v in q['runs']],dtype=np.uint8),[n for n,v in q['runs']]).reshape(844,390)
def differences(a,b):
 yy,xx=np.where(a!=b);return {'pixels':len(xx),'coordinates':[[int(x),int(y),int(a[y,x]),int(b[y,x])] for y,x in zip(yy,xx)]}
assets=json.loads((oracle_dir/'assets.json').read_text())
def column_state(s):
 mats={m['id']:m for m in s['materials']};names={n['nodeName'] for n in assets['nodes']};out=[]
 for o in s['objects']:
  if o['name'] in names:out.append({'name':o['name'],'visible':o['visible'],'matrix':o['matrixWorld'],'materials':[{k:v for k,v in mats[mid].items() if k not in ['id','version']} for mid in o['materialIds']]})
 return sorted(out,key=lambda x:json.dumps(x,sort_keys=True))
rows=[]
for ix,frame in enumerate([4,16,87]):
 base=records['baseline4f']['ledger'][ix];images={}
 for mode,r in records.items():
  q=r['ledger'][ix];assert q['sample']==base['sample']
  for key in ['nativeFrame','texture','nativePoint','nativeZ','cameraCenterNative','zoom','baseNativePixels','groundHeight','screenQuad','rootScreen','groundScreen','shadowCenter','contact','groundAdmission']:assert q['data'][key]==base['data'][key],(frame,mode,key)
  for key in ['targetGeometry','sceneClock','layout']:assert q['intensity'][key]==base['intensity'][key],(frame,mode,key)
  assert q['intensity']['beforeState']['camera']==base['intensity']['beforeState']['camera'];assert column_state(q['intensity']['beforeState'])==column_state(base['intensity']['beforeState']),('COLUMN_STATE_DRIFT',frame,mode);assert q['normalSha256']==q['restoredSha256'];n=q['intensity']['normalHashes'];assert n['beforeThree']==n['afterThree'] and n['beforePixi']==n['afterPixi'];assert n['beforePixi']==base['intensity']['normalHashes']['beforePixi']
  assert q['settlingHashes'][-1]==q['settlingHashes'][-2]
  for j,p in enumerate(q['intensity']['pairs']):
   bp=base['intensity']['pairs'][j];assert p['target']==bp['target'];assert p['referenceSha256']==bp['referenceSha256'];assert p['controls']=='EXACT_CLEAR_REFERENCE_AND_ZERO_BLOCKED';assert p['coverage']['excessIntensity']==0
   ref=decode(p['reference']);actual=decode(p['actual']);assert ref.any() and np.all(actual<=ref);assert np.array_equal(ref,decode(bp['reference']));images[(mode,p['target'])]=actual
   debug=p['gpuDebug']['actual']['mask'];assert debug['programAvailable'];flags=debug['shaderFlags'];sources=debug['compiledShaderSources'];assert sources;compiled='\n'.join(x['source'] for x in sources) if 'source' in sources[0] else None;
   if mode=='identity-depth-only':assert compiled is not None and 'gl_FragDepth=gl_FragCoord.z;' in compiled
   assert any(f['hasFloorProxy'] for f in flags)==(mode=='final-wiring253b')
   d=root/'causal-oracle'/str(frame)/mode/p['target'];d.mkdir(parents=True,exist_ok=True);raw={'width':390,'height':844,'debugStates':{'beforeMasks':q['intensity']['beforeState']},'gpuDebug':p['gpuDebug']}
   (d/'raw.json').write_text(json.dumps(raw));(d/'reference.json').write_text(json.dumps(p['reference']));(d/'actual.json').write_text(json.dumps(p['actual']));result=oracle.run(d/'raw.json',d/'reference.json',d/'actual.json',d/'oracle.json')
   violations=[[x,y,int(actual[y,x])] for x,y in result['wholePixelBlockedCoordinates'] if actual[y,x]!=0]
   rows.append({'frame':frame,'mode':mode,'target':p['target'],'coverage':p['coverage'],'wholePixelColumnBlocks':result['guaranteedWholePixelColumnBlocked'],'guaranteedLowerBlocks':result['guaranteedBlockedLowerCapPixels'],'guaranteedBlockViolations':violations,'normalSha256':q['normalSha256'],'upperNormalSha256':p['upperNormalThreeSha256'],'actualShaderFlags':flags})
 for target in ['default','offscreen']:
  for other in ['identity-depth-only','final-wiring253b']:
   rows.append({'frame':frame,'comparison':['baseline4f',other],'target':target,'difference':differences(images[('baseline4f',target)],images[(other,target)])})
  rows.append({'frame':frame,'comparison':['identity-depth-only','final-wiring253b'],'target':target,'difference':differences(images[('identity-depth-only',target)],images[('final-wiring253b',target)])})
report={'engine':doc['engine'],'sourcePins':pins,'frames':[4,16,87],'status':'CAUSAL_MEASUREMENTS_CAPTURED_NOT_RENDER_ACCEPTANCE','releaseApproved':False,'originalA2StrictFailureRetained':True,'rows':rows,'limitations':['Observed differences and guaranteed-block violations are retained, never normalized or tolerated.','Nine fixed poses only; not a replacement for continuous A2.','Default and offscreen compared only to their own references.']}
(root/'depth-identity-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2))
