"""Small split-mesh gate; original A2 failures remain immutable."""
import json,gzip,sys,importlib.util
from pathlib import Path
import numpy as np
from projected_geometry import prove_split_correspondence,prove_fullquad_correspondence
root=Path(sys.argv[1]);oracle_dir=Path(sys.argv[2]);doc=json.loads((root/'fullquad-results.json').read_text());cases=['4','16','87','87-z0.125','87-z32'];assert doc['failure'] is None and doc['selectedCases']==cases and len(doc['results'])==3
pins={'baseline4f':'1d60444883f996bcf939a4989b84bd602efe03cbe7ec35db59ef84f3abb134a6','rejected-split8c91':'8c91c18303bf7de7814603b85cb8bc0c2a49a699a5069d6c6dc1a61bfef7e315','fullquade3a3':'e3a337a0f7c15de62bebbeae237e18ba8c14de35be8dafc34281c1d04dea7dba'}
records={r['mode']:json.loads(gzip.decompress((root/r['ledger']).read_bytes())) for r in doc['results']};assert set(records)==set(pins)
for mode,r in records.items():assert r['sourceSha256']==pins[mode] and [x['sample']['caseId'] for x in r['ledger']]==cases
spec=importlib.util.spec_from_file_location('column_oracle',oracle_dir/'oracle.py');oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle);assets=json.loads((oracle_dir/'assets.json').read_text())
def column_state(s):
 mats={m['id']:m for m in s['materials']};names={n['nodeName'] for n in assets['nodes']};out=[]
 for o in s['objects']:
  if o['name'] in names:out.append({'name':o['name'],'visible':o['visible'],'matrix':o['matrixWorld'],'materials':[{k:v for k,v in mats[mid].items() if k not in ['id','version']} for mid in o['materialIds']]})
 return sorted(out,key=lambda x:json.dumps(x,sort_keys=True))
def decode(q):
 assert q['width']==390 and q['height']==844 and all(type(n)==type(v)==int and n>0 and 0<=v<=255 for n,v in q['runs']);assert sum(n for n,v in q['runs'])==390*844
 return np.repeat(np.array([v for n,v in q['runs']],dtype=np.uint8),[n for n,v in q['runs']]).reshape(844,390)
rows=[];failures=[]
try:
 for ix,case in enumerate(cases):
  base=records['baseline4f']['ledger'][ix];split=records['fullquade3a3']['ledger'][ix];images={}
  proof=prove_fullquad_correspondence(base['intensity']['targetGeometry'],split['intensity']['targetGeometry']);rejectedProof=prove_split_correspondence(base['intensity']['targetGeometry'],records['rejected-split8c91']['ledger'][ix]['intensity']['targetGeometry'])
  for mode,r in records.items():
   q=r['ledger'][ix];assert q['sample']==base['sample']
   for key in ['nativeFrame','texture','nativePoint','nativeZ','cameraCenterNative','zoom','baseNativePixels','groundHeight','screenQuad','rootScreen','groundScreen','shadowCenter','contact','groundAdmission']:assert q['data'][key]==base['data'][key],(case,mode,key)
   for key in ['sceneClock','layout']:assert q['intensity'][key]==base['intensity'][key]
   assert q['intensity']['beforeState']['camera']==base['intensity']['beforeState']['camera'];assert column_state(q['intensity']['beforeState'])==column_state(base['intensity']['beforeState'])
   assert q['normalSha256']==q['restoredSha256'];n=q['intensity']['normalHashes'];assert n['beforeThree']==n['afterThree'] and n['beforePixi']==n['afterPixi'];assert n['beforePixi']==base['intensity']['normalHashes']['beforePixi'];assert q['settlingHashes'][-1]==q['settlingHashes'][-2]
   for j,p in enumerate(q['intensity']['pairs']):
    bp=base['intensity']['pairs'][j];assert p['target']==bp['target'] and p['referenceSha256']==bp['referenceSha256'];assert p['controls']=='EXACT_CLEAR_REFERENCE_AND_ZERO_BLOCKED' and p['coverage']['excessIntensity']==0
    ref=decode(p['reference']);actual=decode(p['actual']);assert ref.any() and np.all(actual<=ref);assert np.array_equal(ref,decode(bp['reference']));images[(mode,p['target'])]=actual
    logical=p['gpuDebug']['actual']['logicalMeshes'];assert logical and all(x['mask']['programAvailable'] for x in logical)
    if mode=='fullquade3a3':
     expected=[x['role'] for x in q['intensity']['targetGeometry']['parts'] if x['visible']];assert [x['role'] for x in logical]==expected
     for part in logical:
      fragment=[x['source'] for x in part['mask']['shaders'] if x['type']==35632];assert len(fragment)==1
      uniform='uniform float uRanchPartitionY;\n';branch='if(gl_FragCoord.y<uRanchPartitionY)discard;\n' if part['role']=='upper' else 'if(gl_FragCoord.y>=uRanchPartitionY)discard;\n';assert fragment[0].count(uniform)==fragment[0].count(branch)==1;assert part['mask']['uniforms']['uRanchPartitionY']==proof['expectedUniformFloat32'];stripped=fragment[0].replace(uniform,'').replace(branch,'')
      if part['role']=='upper':
       raw=[x['source'] for x in bp['gpuDebug']['actual']['logicalMeshes'][0]['mask']['shaders'] if x['type']==35632];assert [stripped]==raw,'UPPER_CHANGED_BEYOND_EXACT_COMPLEMENTARY_DISCARD'
      else:assert 'uRanchFloor' in fragment[0] and 'vRanchWorldPosition' in fragment[0]
     if case=='87-z32':
      y,x=np.where(ref>0);assert np.all(843-y+.5>=proof['expectedUniformFloat32']),'UPPER_ONLY_REFERENCE_CROSSES_PARTITION'
     if p['upperActualSha256']!=bp['upperActualSha256'] or p['upperNormalThreeSha256']!=bp['upperNormalThreeSha256']:failures.append({'case':case,'target':p['target'],'kind':'UPPER_ACTOR_MASK_OR_NORMAL_CHANGED'})
    # Independent expected geometry remains the original raw plane, justified by actual projected UV/union proof.
    d=root/'fullquad-oracle'/case/mode/p['target'];d.mkdir(parents=True,exist_ok=True);raw={'width':390,'height':844,'debugStates':{'beforeMasks':base['intensity']['beforeState']},'gpuDebug':bp['gpuDebug']}
    (d/'raw.json').write_text(json.dumps(raw));(d/'reference.json').write_text(json.dumps(bp['reference']));(d/'actual.json').write_text(json.dumps(p['actual']));result=oracle.run(d/'raw.json',d/'reference.json',d/'actual.json',d/'oracle.json')
    violations=[[x,y,int(actual[y,x])] for x,y in result['wholePixelBlockedCoordinates'] if actual[y,x]!=0]
    if mode in ['baseline4f','fullquade3a3'] and violations:failures.append({'case':case,'mode':mode,'target':p['target'],'kind':'GUARANTEED_COLUMN_OVERDRAW','pixels':violations})
    rows.append({'case':case,'mode':mode,'target':p['target'],'coverage':p['coverage'],'wholePixelColumnBlocks':result['guaranteedWholePixelColumnBlocked'],'guaranteedLowerBlocks':result['guaranteedBlockedLowerCapPixels'],'guaranteedBlockViolations':violations,'projectionProof':proof if mode=='fullquade3a3' else None})
  for target in ['default','offscreen']:
   a=images[('baseline4f',target)].astype(int);c=images[('fullquade3a3',target)].astype(int);loss=np.maximum(a-c,0);gain=np.maximum(c-a,0)
   if loss.any():failures.append({'case':case,'target':target,'kind':'ANY_ACTOR_INTENSITY_LOSS','pixels':int((loss>0).sum()),'intensity':int(loss.sum())})
   if case in ['4','16','87'] and not gain.any():failures.append({'case':case,'target':target,'kind':'REQUIRED_LOWER_RECOVERY_NOT_EXERCISED'})
   if case=='87-z32' and not np.array_equal(a,c):failures.append({'case':case,'target':target,'kind':'UPPER_ONLY_ACTOR_CHANGED'})
except Exception as e:failures.append({'kind':'STRICT_INVARIANT_ERROR','error':repr(e)})
for target in ['default','offscreen']:
 if not any(r['mode']=='fullquade3a3' and r['target']==target and r['case'] in ['4','16','87'] and r['guaranteedLowerBlocks']>0 for r in rows):failures.append({'target':target,'kind':'REQUIRED_LOWER_CAP_COLUMN_EXERCISE_MISSING'})
report={'engine':doc['engine'],'cases':cases,'sourcePins':pins,'rows':rows,'failures':failures,'status':'FAIL' if failures else 'BOUNDED_FULLQUAD_CONTROLS_PASS_CONTINUOUS_AND_PHYSICAL_SUPPORT_PENDING','releaseApproved':False,'limitations':['Five scripted poses, syntheticZ not authored jump.','Only pinned CM07 opaque columns; partial-edge uncertainty remains separately measured.','Exact actor/Pixi/restoration; not entire fresh-context background equivalence.','CM07 legacy support plane only; six physical support maps still require revalidation.']}
(root/'fullquad-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2));sys.exit(2 if failures else 0)
