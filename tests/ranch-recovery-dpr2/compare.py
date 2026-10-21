"""Small split-mesh gate; original A2 failures remain immutable."""
import json,gzip,sys,importlib.util
from pathlib import Path
import numpy as np
from projected_geometry import prove_split_correspondence,prove_fullquad_correspondence
root=Path(sys.argv[1]);oracle_dir=Path(sys.argv[2]);doc=json.loads((root/'recovery-results.json').read_text());cases=['87','87-z0.125'];assert doc['failure'] is None and doc['selectedCases']==cases and len(doc['results'])==2
pins={'baseline4f':'1d60444883f996bcf939a4989b84bd602efe03cbe7ec35db59ef84f3abb134a6','recovery8a65':'8a65acb62685e1c00dec88b3023301dcfba332c33b9378ebb6bb1366b9228284'}
records={r['mode']:json.loads(gzip.decompress((root/r['ledger']).read_bytes())) for r in doc['results']};assert set(records)==set(pins)
for mode,r in records.items():assert r['sourceSha256']==pins[mode] and [x['sample']['caseId'] for x in r['ledger']]==cases
spec=importlib.util.spec_from_file_location('column_oracle',oracle_dir/'oracle.py');oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle);assets=json.loads((oracle_dir/'assets.json').read_text())
def column_state(s):
 mats={m['id']:m for m in s['materials']};names={n['nodeName'] for n in assets['nodes']};out=[]
 for o in s['objects']:
  if o['name'] in names:out.append({'name':o['name'],'visible':o['visible'],'matrix':o['matrixWorld'],'materials':[{k:v for k,v in mats[mid].items() if k not in ['id','version']} for mid in o['materialIds']]})
 return sorted(out,key=lambda x:json.dumps(x,sort_keys=True))
def decode(q):
 assert q['width']==780 and q['height']==1688 and all(type(n)==type(v)==int and n>0 and 0<=v<=255 for n,v in q['runs']);assert sum(n for n,v in q['runs'])==780*1688
 return np.repeat(np.array([v for n,v in q['runs']],dtype=np.uint8),[n for n,v in q['runs']]).reshape(1688,780)
rows=[];failures=[]
try:
 for ix,case in enumerate(cases):
  base=records['baseline4f']['ledger'][ix];split=records['recovery8a65']['ledger'][ix];images={}
  proof=prove_fullquad_correspondence(base['intensity']['targetGeometry'],split['intensity']['targetGeometry'],buffer_height=1688,expected_kind='FULL_STOCK_BASELINE_PLUS_LOWER_RECOVERY')
  for mode,r in records.items():
   q=r['ledger'][ix];assert q['sample']==base['sample']
   for key in ['nativeFrame','texture','nativePoint','nativeZ','cameraCenterNative','zoom','baseNativePixels','groundHeight','screenQuad','rootScreen','groundScreen','shadowCenter','contact','groundAdmission']:assert q['data'][key]==base['data'][key],(case,mode,key)
   assert q['intensity']['actualResolution']=={'devicePixelRatio':2,'quality':'balanced','pixiResolution':2,'css':[390,844],'buffers':[780,1688]}
   for key in ['sceneClock','layout']:assert q['intensity'][key]==base['intensity'][key]
   assert q['intensity']['beforeState']['camera']==base['intensity']['beforeState']['camera'];assert column_state(q['intensity']['beforeState'])==column_state(base['intensity']['beforeState'])
   assert q['normalSha256']==q['restoredSha256'];n=q['intensity']['normalHashes'];assert n['beforeThree']==n['afterThree'] and n['beforePixi']==n['afterPixi'];assert n['beforePixi']==base['intensity']['normalHashes']['beforePixi'];assert q['settlingHashes'][-1]==q['settlingHashes'][-2]
   for j,p in enumerate(q['intensity']['pairs']):
    bp=base['intensity']['pairs'][j];assert p['target']==bp['target'] and p['referenceSha256']==bp['referenceSha256'];assert p['controls']=='EXACT_CLEAR_REFERENCE_AND_ZERO_BLOCKED' and p['coverage']['excessIntensity']==0
    ref=decode(p['reference']);actual=decode(p['actual']);assert ref.any() and np.all(actual<=ref);assert np.array_equal(ref,decode(bp['reference']));images[(mode,p['target'])]=actual
    logical=p['gpuDebug']['actual']['logicalMeshes'];assert logical and all(x['mask']['programAvailable'] for x in logical)
    if mode=='recovery8a65':
     expected=[x['role'] for x in q['intensity']['targetGeometry']['parts'] if x['visible']];assert [x['role'] for x in logical]==expected
     for part in logical:
      fragment=[x['source'] for x in part['mask']['shaders'] if x['type']==35632];assert len(fragment)==1
      if part['role']=='upper':
       raw=[x['source'] for x in bp['gpuDebug']['actual']['logicalMeshes'][0]['mask']['shaders'] if x['type']==35632];assert fragment==raw,'STOCK_BASE_SHADER_NOT_EXACT_RAW';assert 'uRanchPartitionY' not in part['mask']['uniforms']
      else:
       uniform='uniform float uRanchPartitionY;\n';branch='if(gl_FragCoord.y>=uRanchPartitionY)discard;\n';assert fragment[0].count(uniform)==fragment[0].count(branch)==1;assert part['mask']['uniforms']['uRanchPartitionY']==proof['expectedUniformFloat32'];assert 'uRanchFloor' in fragment[0] and 'vRanchWorldPosition' in fragment[0]
     if case=='87-z32':
      y,x=np.where(ref>0);assert np.all(1687-y+.5>=proof['expectedUniformFloat32']),'UPPER_ONLY_REFERENCE_CROSSES_PARTITION'
     if p['upperActualSha256']!=bp['upperActualSha256'] or p['upperNormalThreeSha256']!=bp['upperNormalThreeSha256']:failures.append({'case':case,'target':p['target'],'kind':'UPPER_ACTOR_MASK_OR_NORMAL_CHANGED'})
    # Independent expected geometry remains the original raw plane, justified by actual projected UV/union proof.
    d=root/'recovery-oracle'/case/mode/p['target'];d.mkdir(parents=True,exist_ok=True);raw={'width':780,'height':1688,'debugStates':{'beforeMasks':base['intensity']['beforeState']},'gpuDebug':bp['gpuDebug']}
    (d/'raw.json').write_text(json.dumps(raw));(d/'reference.json').write_text(json.dumps(bp['reference']));(d/'actual.json').write_text(json.dumps(p['actual']));result=oracle.run(d/'raw.json',d/'reference.json',d/'actual.json',d/'oracle.json')
    violations=[[x,y,int(actual[y,x])] for x,y in result['wholePixelBlockedCoordinates'] if actual[y,x]!=0]
    if mode in ['baseline4f','recovery8a65'] and violations:failures.append({'case':case,'mode':mode,'target':p['target'],'kind':'GUARANTEED_COLUMN_OVERDRAW','pixels':violations})
    rows.append({'case':case,'mode':mode,'target':p['target'],'coverage':p['coverage'],'wholePixelColumnBlocks':result['guaranteedWholePixelColumnBlocked'],'guaranteedLowerBlocks':result['guaranteedBlockedLowerCapPixels'],'guaranteedBlockViolations':violations,'projectionProof':proof if mode=='recovery8a65' else None})
  for target in ['default','offscreen']:
   a=images[('baseline4f',target)].astype(int);c=images[('recovery8a65',target)].astype(int);loss=np.maximum(a-c,0);gain=np.maximum(c-a,0)
   if loss.any():failures.append({'case':case,'target':target,'kind':'ANY_ACTOR_INTENSITY_LOSS','pixels':int((loss>0).sum()),'intensity':int(loss.sum())})
   if case in ['87'] and not gain.any():failures.append({'case':case,'target':target,'kind':'REQUIRED_LOWER_RECOVERY_NOT_EXERCISED'})
   if case=='87-z32' and not np.array_equal(a,c):failures.append({'case':case,'target':target,'kind':'UPPER_ONLY_ACTOR_CHANGED'})
except Exception as e:failures.append({'kind':'STRICT_INVARIANT_ERROR','error':repr(e)})
for target in ['default','offscreen']:
 if not any(r['mode']=='recovery8a65' and r['target']==target and r['case'] in ['87'] and r['guaranteedLowerBlocks']>0 for r in rows):failures.append({'target':target,'kind':'REQUIRED_LOWER_CAP_COLUMN_EXERCISE_MISSING'})
report={'engine':doc['engine'],'cases':cases,'sourcePins':pins,'rows':rows,'failures':failures,'status':'FAIL' if failures else 'BOUNDED_ACTUAL_DPR2_PASS_NOT_DEVICE_PERFORMANCE_APPROVAL','releaseApproved':False,'limitations':['Two scripted poses at actual DPR2, syntheticZ not authored jump.','Only pinned CM07 opaque columns; partial-edge uncertainty remains separately measured.','Exact actor/Pixi/restoration; not entire fresh-context background equivalence.','CM07 legacy support plane only; six physical support maps still require revalidation.']}
(root/'recovery-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2));sys.exit(2 if failures else 0)
