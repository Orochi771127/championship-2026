"""Exact paired A2 invariants plus independent conservative retained-column depth oracle."""
import sys,json,gzip,hashlib,tempfile,importlib.util,shutil
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
root=Path(sys.argv[1]);oracle_dir=Path(sys.argv[2]);doc=json.loads((root/'final-motion-results.json').read_text());assert doc['failure'] is None and len(doc['results'])==2 and doc['expectedFrames']==480
spec=importlib.util.spec_from_file_location('column_oracle',oracle_dir/'oracle.py');oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle);assets=json.loads((oracle_dir/'assets.json').read_text())
expected={'baseline4f':'1d60444883f996bcf939a4989b84bd602efe03cbe7ec35db59ef84f3abb134a6','final-wiring253b':'253b395eeae17428d1868aa3886b4723ebad34ad646ee250b4047aae50181549'}
records={r['mode']:json.loads(gzip.decompress((root/r['ledger']).read_bytes())) for r in doc['results']};assert set(records)==set(expected)
for mode,r in records.items():
 assert r['sourceSha256']==expected[mode] and len(r['ledger'])==240 and r['clipId']==doc['clipId']
 for node in assets['nodes']:
  matches=[x for x in r['columnGeometryHashes'] if x['name']==node['nodeName']];assert matches
  for x in matches:
   for k in ['positionCount','indexCount','positionSha256Float32LE','indexSha256Uint32LE']:assert x[k]==node[k],('ACTUAL_COLUMN_GEOMETRY_DRIFT',mode,k)

def decode(q):
 assert q['width']==390 and q['height']==844;total=0;parts=[]
 for n,v in q['runs']:
  assert type(n)==type(v)==int and n>0 and 0<=v<=255;total+=n;assert total<=390*844;parts.append(np.full(n,v,dtype=np.uint8))
 assert total==390*844
 return np.concatenate(parts).reshape(844,390)
def pack(a):
 f=a.reshape(-1);where=np.r_[0,np.flatnonzero(f[1:]!=f[:-1])+1,len(f)];return {'width':390,'height':844,'runs':[[int(b-a),int(f[a])] for a,b in zip(where[:-1],where[1:])]}
def column_state(s):
 mats={m['id']:m for m in s['materials']};names={n['nodeName'] for n in assets['nodes']};out=[]
 for o in s['objects']:
  if o['name'] in names:out.append({'name':o['name'],'visible':o['visible'],'matrix':o['matrixWorld'],'materials':[{k:v for k,v in mats[mid].items() if k not in ['id','version']} for mid in o['materialIds']]})
 return sorted(out,key=lambda x:json.dumps(x,sort_keys=True))
base=records['baseline4f']['ledger'];cand=records['final-wiring253b']['ledger'];metrics=[];failures=[];selected={0,34,68,102,136,170,204,239};oracle_samples=root/'oracle-samples';oracle_samples.mkdir(exist_ok=True)
try:
 with tempfile.TemporaryDirectory(prefix='a2-column-oracle-') as temp:
  t=Path(temp)
  for i,(b,c) in enumerate(zip(base,cand)):
   assert b['sample']==c['sample'] and b['sample']['index']==i
   for r in [b,c]:
    assert r['normalSha256']==r['restoredSha256'] and r['settlingHashes'][-1]==r['settlingHashes'][-2]
    n=r['intensity']['normalHashes'];assert n['beforeThree']==n['afterThree'] and n['beforePixi']==n['afterPixi']
    assert r['data']['groundHeight']==0 and 0<=r['data']['nativeZ']<=8
   for k in ['nativeFrame','texture','nativePoint','nativeZ','cameraCenterNative','zoom','baseNativePixels','groundHeight','screenQuad','rootScreen','groundScreen','shadowCenter','contact','groundAdmission']:assert b['data'][k]==c['data'][k],('POSE_OR_QUERY_DRIFT',i,k)
   assert b['intensity']['layout']==c['intensity']['layout']==[[0,0,390,844],[0,0,390,844]]
   assert b['intensity']['targetGeometry']==c['intensity']['targetGeometry'],'ACTUAL_TARGET_MATRIX_BUFFER_UV_IMAGE_DRIFT'
   assert b['intensity']['sceneClock']==c['intensity']['sceneClock'];assert b['intensity']['beforeState']['camera']==c['intensity']['beforeState']['camera'];assert column_state(b['intensity']['beforeState'])==column_state(c['intensity']['beforeState'])
   assert b['intensity']['normalHashes']['beforePixi']==c['intensity']['normalHashes']['beforePixi'],'EXACT_CONTACT_LAYER_REQUIRED'
   pairs=[];refs=[]
   for pb,pc in zip(b['intensity']['pairs'],c['intensity']['pairs']):
    assert pb['target']==pc['target'] and pb['referenceSha256']==pc['referenceSha256'];assert pb['upperReferenceSha256']==pc['upperReferenceSha256'] and pb['upperActualSha256']==pc['upperActualSha256']
    assert pb['upperNormalThreeSha256']==pc['upperNormalThreeSha256'],'UPPER_BODY_NORMAL_RGB_CHANGED'
    assert pb['unchangedRows']==pc['unchangedRows'];assert pb['controls']==pc['controls']=='EXACT_CLEAR_REFERENCE_AND_ZERO_BLOCKED'
    assert pb['coverage']['excessIntensity']==pc['coverage']['excessIntensity']==0
    assert not any(x['hasFloorProxy'] for x in pb['gpuDebug']['actual']['mask']['shaderFlags']);assert any(x['hasFloorProxy'] for x in pc['gpuDebug']['actual']['mask']['shaderFlags'])
    uniforms=pc['gpuDebug']['actual']['mask']['uniforms'];assert abs(uniforms['uRanchFloor']-.015)<1e-8;assert uniforms.get('uRanchSupportCount',0)==0
    ref=decode(pb['reference']);assert np.array_equal(ref,decode(pc['reference']));ba=decode(pb['actual']);ca=decode(pc['actual']);assert np.all(ba<=ref) and np.all(ca<=ref);assert ref.any()
    lost=np.maximum(ba.astype(int)-ca.astype(int),0);gain=np.maximum(ca.astype(int)-ba.astype(int),0)
    if lost.any():failures.append({'frame':i,'target':pb['target'],'kind':'UNEXPECTED_LOWER_OR_TRANSITION_LOSS','pixels':int((lost>0).sum()),'intensity':int(lost.sum())})
    pairs.append((pb,pc,ref,ba,ca,gain));refs.append(ref)
   union=np.maximum.reduce(refs);raw={'width':390,'height':844,'debugStates':{'beforeMasks':c['intensity']['beforeState']},'gpuDebug':c['intensity']['pairs'][0]['gpuDebug']}
   (t/'raw.json').write_text(json.dumps(raw));(t/'reference.json').write_text(json.dumps(pack(union)));(t/'actual.json').write_text(json.dumps(c['intensity']['pairs'][0]['actual']))
   geometry=oracle.run(t/'raw.json',t/'reference.json',t/'actual.json',t/'oracle.json');blocked=geometry['wholePixelBlockedCoordinates'];row={'frame':i,'timeSeconds':b['sample']['timeSeconds'],'geometricSideDiagnosticOnly':b['sample']['geometricSide'],'guaranteedColumnBlockedPixels':geometry['guaranteedWholePixelColumnBlocked'],'guaranteedBlockedLowerCapPixels':geometry['guaranteedBlockedLowerCapPixels'],'ambiguousEdgePixels':geometry['partialEdgePixels'],'targets':[]}
   for pb,pc,ref,ba,ca,gain in pairs:
    for mode,actual in [('baseline4f',ba),('final-wiring253b',ca)]:
     violations=[[x,y,int(actual[y,x])] for x,y in blocked if actual[y,x]!=0]
     if violations:failures.append({'frame':i,'target':pb['target'],'mode':mode,'kind':'GUARANTEED_COLUMN_OVERDRAW','pixels':violations})
    row['targets'].append({'target':pb['target'],'baseline':pb['coverage'],'candidate':pc['coverage'],'recoveredIntensity':int(gain.sum())})
   metrics.append(row)
   if i in selected or any(x['frame']==i for x in failures):
    d=oracle_samples/str(i).zfill(4);d.mkdir(exist_ok=True)
    for name in ['raw.json','reference.json','actual.json','oracle.json','oracle.json.regions.png']:shutil.copyfile(t/name,d/name)
   if failures:break
except Exception as error:
 failures.append({'kind':'STRICT_INVARIANT_OR_ORACLE_ERROR','error':repr(error)})
report={'engine':doc['engine'],'clipId':doc['clipId'],'pairedFrames':len(metrics),'expectedPairedFrames':240,'metrics':metrics,'failures':failures,'wholePixelColumnExerciseFrames':sum(x['guaranteedColumnBlockedPixels']>0 for x in metrics),'lowerCapColumnExerciseFrames':sum(x['guaranteedBlockedLowerCapPixels']>0 for x in metrics),'status':'FAIL' if failures else 'PAIRED_INVARIANTS_AND_CONSERVATIVE_COLUMN_ORACLE_PASS_VISUAL_REVIEW_REQUIRED','releaseApproved':False,'limitations':['Partial column-edge/MSAA pixels unresolved, not numerical tolerance.','Only pinned opaque basalt nodes5/6/7; no-column region not guaranteed visible.','Exact replicated Pixi fallback shadow, not all normal contact profiles.','Scripted path, actual native sequence2/frozen controls; not gameplay collision/walkability. Controlled-lift clips use synthetic Z, not authored jumps.','Per-target resolved intensity; no default/offscreen equality assumption.']}
if not failures and (len(metrics)!=240 or not report['wholePixelColumnExerciseFrames'] or ('controlled-lift' not in doc['clipId'] and not report['lowerCapColumnExerciseFrames'])):report['status']='INSUFFICIENT_COLUMN_OR_LOWER_CAP_EXERCISE';failures.append({'kind':'REQUIRED_FOREGROUND_REGION_NOT_EXERCISED'})
(root/'final-motion-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['metrics','limitations']},indent=2))
if failures:sys.exit(2)
# Eight paired ordinary screenshot ROIs, retained pixels only, no generated surrogate.
W,H=200,220;board=Image.new('RGB',(W*8,H*2),'#eeeeee');draw=ImageDraw.Draw(board)
for col,i in enumerate(sorted(selected)):
 q=base[i]['data']['screenQuad'];box=(max(0,int(q['x'])-25),max(0,int(q['y'])-40),min(390,int(q['x']+q['width'])+25),min(844,int(q['y']+q['height'])+30))
 for side,mode in enumerate(expected):
  im=Image.open(root/(mode+'-'+doc['clipId'])/('frame-'+str(i).zfill(4)+'.png')).convert('RGB').crop(box);im.thumbnail((W-4,H-30),Image.Resampling.NEAREST);board.paste(im,(col*W+(W-im.width)//2,side*H));draw.text((col*W+4,side*H+H-24),mode+' #'+str(i),fill='black')
board.save(root/'paired-motion-roi.jpg',quality=92)
