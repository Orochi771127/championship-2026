"""Bounded final-source physical support measurements, not universal visibility approval."""
import json,gzip,sys,hashlib
from pathlib import Path
import numpy as np
from projected_geometry import prove_fullquad_correspondence
root=Path(sys.argv[1]);planpath=Path(sys.argv[2]);assert hashlib.sha256(planpath.read_bytes()).hexdigest()=='5aa8660365715c8cbb1778a35dc434a57092d277dd3d739e15a9ea6213a72de3';plan=json.loads(planpath.read_text());doc=json.loads((root/'final-support-results.json').read_text());assert not doc['fieldFailures'] and len(doc['results'])==64 and len(plan['cases'])==32
pins={'reference':'c71ae0661bc447176fa3bf3f8981fee861cd0e32b5915ddac9484411f1c03135','recovery':'8a65acb62685e1c00dec88b3023301dcfba332c33b9378ebb6bb1366b9228284'};assert doc['sourcePins']==pins
records={}
for r in doc['results']:
 key=(r['mode'],r['id']);assert key not in records;data=json.loads(gzip.decompress((root/r['evidence']).read_bytes()));assert data['sourceSha256']==pins[r['mode']];records[key]=data
assert set(records)=={(mode,c['id']) for mode in pins for c in plan['cases']}
def decode(q):
 assert (q['width'],q['height'])==(390,844);assert all(type(n)==type(v)==int and n>0 and 0<=v<=255 for n,v in q['runs']);assert sum(n for n,v in q['runs'])==390*844
 return np.repeat(np.array([v for n,v in q['runs']],dtype=np.int16),[n for n,v in q['runs']]).reshape(844,390)
rows=[];failures=[];unresolved=[];grass=[]
for case in plan['cases']:
 try:
  b=records[('reference',case['id'])];c=records[('recovery',case['id'])];bi=b['intensity'];ci=c['intensity'];proof=prove_fullquad_correspondence(bi['targetGeometry'],ci['targetGeometry'],expected_kind='FULL_STOCK_BASELINE_PLUS_LOWER_RECOVERY')
  for k in ['admission','careEvidence','subjectKind','subjectScreen','subjectGroundScreen','runtimeHash','baseNativePixels','nativeZ','height','geometry']:assert b['data'][k]==c['data'][k],('PAIRED_SOURCE_OR_GEOMETRY_DRIFT',k)
  assert c['data']['admission']==case['expectedQuery']['admission'];assert c['data'].get('supportOwner')==case['expectedQuery']['derivedSupportOwner'];assert bi['beforeState']['camera']==ci['beforeState']['camera'] and bi['sceneClock']==ci['sceneClock'];assert bi['targetGeometry']['parts'][0]['matrixWorld']==ci['targetGeometry']['parts'][0]['matrixWorld'];assert bi['normalHashes']['beforePixi']==ci['normalHashes']['beforePixi']
  for r in [b,c]:
   assert r['normalSha256']==r['restoredSha256'] and r['settlingHashes'][-1]==r['settlingHashes'][-2];n=r['intensity']['normalHashes'];assert n['beforeThree']==n['afterThree'] and n['beforePixi']==n['afterPixi'];assert r['intensity']['layout']==[[0,0,390,844],[0,0,390,844]]
  diag=next(d for d in ci['diagnostics']['spriteDiagnostics'] if d['key']==ci['subjectKey']);support=diag['physicalSupport'];assert support['owner']==case['expectedQuery']['derivedSupportOwner']
  if case['expectedAdmitted']:
   assert support['status']=='VERIFIED_OWNER_PROJECTED_TOPS'
   if '-interior-' in case['id']:assert support['candidateCount']>0
  else:assert support['candidateCount']==0 and support['owner'] is None
  for pb,pc in zip(bi['pairs'],ci['pairs']):
   assert pb['target']==pc['target'] and pb['referenceSha256']==pc['referenceSha256'];assert pb['controls']==pc['controls']=='EXACT_CLEAR_REFERENCE_AND_ZERO_BLOCKED';assert pb['coverage']['excessIntensity']==pc['coverage']['excessIntensity']==0
   assert pb['upperActualSha256']==pc['upperActualSha256'] and pb['upperNormalThreeSha256']==pc['upperNormalThreeSha256'],'ABOVE_SUPPORT_STOCK_RGB_OR_MASK_CHANGED';assert pb['unchangedRows']==pc['unchangedRows']
   ref=decode(pb['reference']);assert ref.any() and np.array_equal(ref,decode(pc['reference']));a,z=decode(pb['actual']),decode(pc['actual']);assert np.all(a<=ref) and np.all(z<=ref)
   loss=np.maximum(a-z,0);gain=np.maximum(z-a,0);assert not loss.any(),('ANY_BASELINE_COVERAGE_LOSS',int((loss>0).sum()),int(loss.sum()))
   logical=pc['gpuDebug']['actual']['logicalMeshes'];assert [m['role'] for m in logical]==['lower','upper'];raw=[s['source'] for s in pb['gpuDebug']['actual']['logicalMeshes'][0]['mask']['shaders'] if s['type']==35632];assert len(raw)==1
   for m in logical:
    assert m['mask']['programAvailable'];f=[s['source'] for s in m['mask']['shaders'] if s['type']==35632];assert len(f)==1
    if m['role']=='upper':assert f==raw and 'uRanchPartitionY' not in m['mask']['uniforms'],'EXACT_RAW_STOCK_BASE_SHADER'
    else:
     u=m['mask']['uniforms'];assert f[0].count('if(gl_FragCoord.y>=uRanchPartitionY)discard;\n')==1;assert u['uRanchPartitionY']==proof['expectedUniformFloat32'];assert u['uRanchSupportCount']==support['candidateCount'];assert u['uRanchBufferSize']==[390,844]
   deficit=np.maximum(ref-z,0);row={'id':case['id'],'fieldId':case['fieldId'],'subjectKind':case['subjectKind'],'target':pc['target'],'support':support,'projectionProof':proof,'gainPixels':int((gain>0).sum()),'gainIntensity':int(gain.sum()),'ownReferenceDeficitPixels':int((deficit>0).sum()),'ownReferenceDeficitIntensity':int(deficit.sum()),'scope':'OWN_REFERENCE_DEFICIT_MAY_BE_RETAINED_FOREGROUND_OR_UNSUPPORTED_BOUNDARY;NOT_AUTOMATIC_FULL_VISIBILITY_PASS'};rows.append(row)
   if deficit.any():unresolved.append({k:row[k] for k in ['id','target','ownReferenceDeficitPixels','ownReferenceDeficitIntensity']})
  if c['grassAttribution']:
   assert case['fieldId']=='field_cm02_01' and case['subjectKind']=='food' and '-interior-' in case['id'];g={r['triangleMode']:r for r in c['grassAttribution']};assert set(g)=={'without-grass','only-grass'};p=ci['pairs'][0];assert p['target']=='default';without=decode(g['without-grass']['mask']);only=decode(g['only-grass']['mask']);full=decode(p['actual']);ref=decode(p['reference']);grass.append({'id':case['id'],'provenance':[r['triangleControl'] for r in c['grassAttribution']],'withoutEqualsOwnReference':bool(np.array_equal(without,ref)),'onlyEqualsFullActual':bool(np.array_equal(only,full)),'fullDeficitIntensity':int(np.maximum(ref-full,0).sum()),'scope':'CAUSAL_GRASS_ATTRIBUTION_ONLY_IF_BOTH_EXACT_EQUALITIES_AND_NONZERO_DEFICIT;OTHERWISE_UNRESOLVED_NO_TOLERANCE'})
 except Exception as e:failures.append({'id':case['id'],'error':repr(e)})
if len(grass)!=1:failures.append({'kind':'EXACT_GRASS_WITNESS_REQUIRED','observed':len(grass)})
report={'engine':doc['engine'],'status':'FAIL' if failures else 'FINAL32_STRICT_SOURCE_PAIR_INVARIANTS_PASS_GEOMETRY_VISIBILITY_REVIEW_PENDING','rows':rows,'failures':failures,'unresolvedOwnReferenceDeficits':unresolved,'grassAttribution':grass,'sourcePins':pins,'releaseApproved':False,'scope':['32cases/source, six authored physical support fields only; noall37/allframes.','Realreadonly production query and wrap-derived owner; no actor movement or navigation traversal claim.','Same-target own-reference intensity and exact stockbase/above-supportRGB; no cross-AA equality.','Existing full-footprint geometry/grass review must classify remaining deficits, not blanket fullvisibility.','Both sources use exact verified careHTMLpixels; no normal multi-actor shadow approval.']}
(root/'final-support-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['rows','unresolvedOwnReferenceDeficits']},indent=2));sys.exit(2 if failures else 0)
