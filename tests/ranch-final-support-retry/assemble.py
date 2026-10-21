"""Compose immutable49 old captures +15 missing-only retries, preserving old failure provenance."""
import sys,json,hashlib,gzip,shutil
from pathlib import Path
old,new,out,contract=map(Path,sys.argv[1:5]);engine=sys.argv[5]
def sha(b):return hashlib.sha256(b).hexdigest()
assert sha(contract.read_bytes())=='51c276724aa483c183b6a0ad62ccd4d25e8f45edef5a924d902d58181ac4ce03'
c=json.loads(contract.read_text());pin=c['engines'][engine];ob=(old/'final-support-results.json').read_bytes();assert sha(ob)==pin['resultsSha256'];a=json.loads(ob);nb=(new/'final-support-results.json').read_bytes();b=json.loads(nb)
assert a['engine']==b['engine']==engine and a['expectedCaptures']==64 and b['expectedCaptures']==15
assert a['baselineRevision']==b['baselineRevision']=='4f64421314f0d0f5d0c04b916d30e821587c1a6a'
assert a['sourcePins']==b['sourcePins']=={'reference':'c71ae0661bc447176fa3bf3f8981fee861cd0e32b5915ddac9484411f1c03135','recovery':'8a65acb62685e1c00dec88b3023301dcfba332c33b9378ebb6bb1366b9228284'}
assert a['planSha256']==b['planSha256']=='5aa8660365715c8cbb1778a35dc434a57092d277dd3d739e15a9ea6213a72de3'
assert a['plannedCaseIds']==b['plannedCaseIds'] and len(a['plannedCaseIds'])==32
assert len(a['results'])==49 and len(b['results'])==15 and not b['fieldFailures']
assert b['retryOfRunId']==39664230414 and b['retryContractSha256']==sha(contract.read_bytes())
assert sorted(b['selectedCaseIds'])==sorted(c['missingRecoveryIds'])==sorted(r['id'] for r in b['results']) and all(r['mode']=='recovery' for r in b['results'])
assert not out.exists(),'FRESH_COMPOSED_OUTPUT_REQUIRED';out.mkdir(parents=True)
seen=set();provenance=[]
for label,root,doc in [('immutable-prior-run39664230414',old,a),('missing-only-retry',new,b)]:
 for r in doc['results']:
  key=(r['mode'],r['id']);assert key not in seen;seen.add(key);assert r['sourceSha256']==a['sourcePins'][r['mode']]
  evpath=Path(r['evidence']);np=Path(r['normal']);assert evpath==Path(r['mode'])/r['id']/'evidence.json.gz' and np==Path(r['mode'])/r['id']/'normal.png'
  evb=(root/evpath).read_bytes();ev=json.loads(gzip.decompress(evb));assert ev['id']==r['id'] and ev['mode']==r['mode'] and ev['sourceSha256']==r['sourceSha256'];normal=(root/np).read_bytes();assert sha(normal)==ev['normalSha256']==ev['restoredSha256']
  for rel,data in [(str(evpath),evb),(str(np),normal)]:
   if label.startswith('immutable'):assert pin['files'][rel]=={'sha256':sha(data),'bytes':len(data)}
   dst=out/rel;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data);provenance.append({'path':rel,'source':label,'sha256':sha(data),'bytes':len(data)})
assert seen=={(m,i) for m in a['sourcePins'] for i in a['plannedCaseIds']}
merged={**a,'results':a['results']+b['results'],'fieldFailures':[],'composition':{'kind':'IMMUTABLE_PRIOR49_PLUS_MISSING15_NOT_HISTORICAL_REWRITE','priorRunId':39664230414,'priorArtifactId':pin['artifactId'],'priorResultsSha256':sha(ob),'retryResultsSha256':sha(nb),'originalFieldFailures':a['fieldFailures'],'contractSha256':sha(contract.read_bytes()),'files':provenance},'releaseApproved':False}
(out/'original-failed-results.json').write_bytes(ob);(out/'retry-results.json').write_bytes(nb);(out/'final-support-results.json').write_text(json.dumps(merged,indent=2)+'\n');print('64 exact unique captures composed; original failure receipt retained. Comparator not yet run.')
