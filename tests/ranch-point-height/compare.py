"""Bounded authored/derived point-height diagnostic. No universal visibility verdict."""
import json,gzip,hashlib,sys,math,importlib.util,base64
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('heightproof',Path(__file__).with_name('height-translation-proof.py'));hp=importlib.util.module_from_spec(spec);spec.loader.exec_module(hp)
root,pp=map(Path,sys.argv[1:3]);plan=json.loads(pp.read_text());doc=json.loads((root/'point-height-results.json').read_text());assert doc['planSha256']==hashlib.sha256(pp.read_bytes()).hexdigest();assert not doc['fieldFailures'];cases=plan['cases']+plan['trajectory'];assert len(cases)==49 and len(doc['results'])==98
pins={'reference':'256919ce036206dae0f5d2564a5dd7c938d54e6d91b2437b0f0a04b4b2e6340b','point':'ea2f10eba39bccbe20f28b0c8bacde078de5de4d4e786cbb0f20f6e963626dca'};assert doc['sourcePins']==pins
records={}
for row in doc['results']:
 k=row['mode'],row['id'];assert k not in records;r=json.loads(gzip.decompress((root/row['evidence']).read_bytes()));assert r['sourceSha256']==pins[k[0]];assert hashlib.sha256((root/row['normal']).read_bytes()).hexdigest()==r['normalSha256'];records[k]=r
assert set(records)=={(m,c['id']) for m in pins for c in cases}
def decode(m):
 assert (m['width'],m['height'])==(390,844);assert all(type(n)==type(v)==int and n>0 and 0<=v<=255 for n,v in m['runs']);assert sum(n for n,v in m['runs'])==390*844
 return np.repeat(np.array([v for n,v in m['runs']],dtype=np.int16),[n for n,v in m['runs']]).reshape(844,390)
def norm(r,c):
 d=r['data'];g=r['intensity']['targetGeometry'];screen=d['rootScreen'];screen=[screen['x'],screen['y']] if isinstance(screen,dict) else screen
 return dict(height=d['groundContact']['height'],nativeFrame=d['nativeFrame'],nativeZ=d['nativeZ'],nativeXY=d.get('pointNative',d.get('nativePoint')),nativeScreenPixels=d['nativeScreenPixels'],cameraProjection=g['cameraProjection'],cameraInverse=g['cameraInverse'],cssHeight=844,contactEllipses=d['contactEllipses'],rootScreen=screen,shadowScreenCenters=d['shadowScreenCenters'],parts=g['parts'])
rows=[];failures=[];trajectory=[]
for c in cases:
 try:
  b,p=[records[m,c['id']] for m in pins];h=p['data']['groundContact']['height'];expected=c['expectedHeightWorld']
  assert p['data']['groundContact']['owner']==c['expectedQuery']['derivedSupportOwner']
  if c['expectedAdmitted']:
   ct=p['data']['groundContact'];assert any(all(ct.get(k)==v for k,v in hit.items() if k!='height') for hit in c['expectedContact']['acceptableGeometryHits'])
   assert abs(h-expected)<1e-10;assert p['data']['groundContact']['authority'] in ['EXACT_ADMITTED_AUTHORED_POINT','EXACT_ADMITTED_DERIVED_LOGICAL_POINT']
  else:assert not p['data']['groundContact']['authority'].startswith('EXACT_ADMITTED_');assert h==b['data']['groundContact']['height']
  proof=hp.prove_height_translation(norm(b,c),norm(p,c),b['data']['groundContact']['height'],h)
  assert [q['target'] for q in b['intensity']['pairs']]==[q['target'] for q in p['intensity']['pairs']]==['default','offscreen']
  for qb,qp in zip(b['intensity']['pairs'],p['intensity']['pairs']):
   ub=qb['gpuDebug']['actual']['logicalMeshes'][1]['mask'];up=qp['gpuDebug']['actual']['logicalMeshes'][1]['mask'];assert ub['shaders']==up['shaders'],'MATCHED_REFERENCE_STOCK_SHADER_CHANGED'
  for mode,r in [('reference',b),('point',p)]:
   i=r['intensity'];assert r['normalSha256']==r['restoredSha256'];assert r['settlingHashes'][-1]==r['settlingHashes'][-2];assert i['layout']==[[0,0,390,844],[0,0,390,844]]
   n=i['normalHashes'];assert n['beforeThree']==n['afterThree'] and n['beforePixi']==n['afterPixi'];assert r['stock']['normal']['before']==r['stock']['normal']['restored']
   nb=r['stock']['normalBuffers'];assert nb['encoding']=='RGBA_BASE64_BOTTOM_UP' and [nb['width'],nb['height']]==[390,844]
   raw={k:np.frombuffer(base64.b64decode(nb[k]),dtype=np.uint8).reshape(844,390,4)[::-1] for k in ['recovery','stock','restored']};assert np.array_equal(raw['recovery'],raw['restored'])
   assert [q['target'] for q in i['pairs']]==['default','offscreen'];assert [q['target'] for q in r['stock']['records']]==['default','offscreen']
   for q,stock in zip(i['pairs'],r['stock']['records']):
    assert q['target']==stock['target'];assert q['controls']=='EXACT_CLEAR_REFERENCE_AND_ZERO_BLOCKED';ref,a,sref,s=[decode(x) for x in [q['reference'],q['actual'],stock['reference'],stock['actual']]]
    assert ref.any() and np.array_equal(ref,sref);assert np.all(a<=ref) and np.all(s<=ref);assert np.all(a>=s),'SAME_HEIGHT_STOCK_COVERAGE_LOSS'
    upper=q['unchangedRows'];assert np.array_equal(a[:upper],s[:upper]),'UPPER_STOCK_MASK_CHANGED'
    if q['target']=='default':
     body=(a[:upper]>0)|(s[:upper]>0);assert np.array_equal(raw['recovery'][:upper][body],raw['stock'][:upper][body]),'EXACT_SAME_HEIGHT_UPPER_VISIBLE_BODY_RGBA'
    parts=q['gpuDebug']['actual']['logicalMeshes'];assert [x['role'] for x in parts]==['lower','upper']
    upperSource=[x['source'] for x in parts[1]['mask']['shaders'] if x['type']==35632];assert len(upperSource)==1;assert 'uRanchPartitionY' not in parts[1]['mask']['uniforms']
    stockParts=stock['gpuDebug']['logicalMeshes'];assert len(stockParts)==1 and stockParts[0]['role']=='upper';assert upperSource==[x['source'] for x in stockParts[0]['mask']['shaders'] if x['type']==35632]
    uniforms=parts[0]['mask']['uniforms'];assert uniforms['uRanchSupportCount']==0;assert abs(uniforms['uRanchFloor']-(r['data']['groundContact']['height']+.015))<1e-7
    for x in parts:
     f=x['mask']['framebuffer'];assert f['viewport']==[0,0,390,844] and not f['scissorTest']
    gain=a-s;deficit=ref-a;rows.append(dict(id=c['id'],mode=mode,target=q['target'],height=r['data']['groundContact']['height'],authority=r['data']['groundContact']['authority'],gainIntensity=int(gain.sum()),deficitIntensity=int(deficit.sum()),heightProjection=proof,visibility='RETAINED_FOREGROUND_ORACLE_REVIEW_REQUIRED_NOT_FULL_REFERENCE_PASS'))
  if c['lane'].startswith('SCRIPTED_'):trajectory.append(dict(index=c['index'],height=h,expected=expected,contact=p['data']['groundContact']))
 except Exception as e:failures.append(dict(id=c['id'],error=repr(e)))
assert len(trajectory)==25 or failures
if len(trajectory)==25:
 for i in range(1,25):
  delta=trajectory[i]['height']-trajectory[i-1]['height'];expected=trajectory[i]['expected']-trajectory[i-1]['expected'];
  if abs(delta-expected)>1e-10:failures.append(dict(id='trajectory',error='AUTHORITATIVE_CONTINUITY_MISMATCH'))
report=dict(engine=doc['engine'],status='FAIL' if failures else 'BOUNDED_HEIGHT_TRANSLATION_AND_SAME_HEIGHT_RECOVERY_PASS_FOREGROUND_VISUAL_PENDING',rows=rows,trajectory=trajectory,failures=failures,releaseApproved=False,scope=['21static+3negative+25scripted samples/source','Derived logical bridges are not GLB triangles','Actual native-engine walking and normal presenter contacts separate','No allpositions or allmaps claim'])
(root/'point-height-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':report['status'],'rows':len(rows),'failures':failures}));sys.exit(2 if failures else 0)
