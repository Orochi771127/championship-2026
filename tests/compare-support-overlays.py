"""A1 evidence: measure support deficit without pretending props should be invisible."""
import json,pathlib,sys,base64,math
import numpy as np
from PIL import Image,ImageDraw
root=pathlib.Path(sys.argv[1]);doc=json.loads((root/'support-results.json').read_text());assert not doc['failure'];rows=doc['results'];assert len(rows)==doc['expectedCount'];by={(r['mode'],r['id']):r for r in rows};assert len(by)==len(rows);assert set(doc['plannedIds'])=={i for m,i in by if m=='baseline'}=={i for m,i in by if m=='floor-only'}
def unpack(m,k):
 _,_,w,h=m['pixelBox'];return np.unpackbits(np.frombuffer(base64.b64decode(m[k]),dtype=np.uint8))[:w*h].astype(bool).reshape(h,w)
samples=[];regressions=[];unresolved=[];sheets={}
for key in doc['plannedIds']:
 b,c=by['baseline',key],by['floor-only',key]
 for r in [b,c]:
  settle=r['settling'];assert settle['converged'] and settle['frames'][-1]['sha256']==settle['frames'][-2]['sha256']
  q=r['controls'];assert q['status']=='GPU_KNOWN_CONTROL_ASSERTIONS_PASSED' and q['clearReferencePixels']>0 and q['blockedReferencePixels']>0 and q['blockedVisiblePixels']==q['clearMismatch']==q['referenceMismatch']==0;assert r['normalImageSha256']==r['restoredImageSha256']
 for prop in ['height','runtimeHash','geometry','subjectGroundScreen']:
  assert b['data'][prop]==c['data'][prop],(key,prop,'baseline/candidate fixture drift')
 assert b['probe']==c['probe'] and b['data']['subjectScreen']==c['data']['subjectScreen'];bm,cm=b['mask'],c['mask'];assert bm['pixelBox']==cm['pixelBox'] and bm['referenceMask']==cm['referenceMask'];ref=unpack(bm,'referenceMask');bv=unpack(bm,'visibleMask');cv=unpack(cm,'visibleMask');assert ref.any() and not ((bv|cv)&~ref).any()
 x,y,w,h=bm['pixelBox'];upper=ref&(np.indices((h,w))[0]+y+.5<b['data']['subjectScreen']['y']-1)
 changed=int(((bv!=cv)&upper).sum());lost=int((bv&~cv&~upper).sum());gain=int((~bv&cv&~upper).sum());deficit=int((ref&~cv).sum())
 row={'id':key,'fieldId':b['fieldId'],'subjectKind':b['subjectKind'],'zoom':b['zoom'],'probe':b['probe'],'referencePixels':int(ref.sum()),'baselineVisiblePixels':int(bv.sum()),'candidateVisiblePixels':int(cv.sum()),'upperChangedPixels':changed,'lowerOrTransitionRecoveredPixels':gain,'lowerOrTransitionLostPixels':lost,'candidateTerrainOccludedPixels':deficit,'candidateSurfaceEvidence':c['data']['surfaceEvidence'],'interpretation':'OCCLUSION_NEEDS_INDEPENDENT_SUPPORT_AND_PROP_CLASSIFICATION'};samples.append(row)
 if changed or lost:regressions.append(row)
 if deficit or c['data']['surfaceEvidence'].get('unverifiedCount') not in [0,'0']:unresolved.append(row)
 sheets.setdefault(b['fieldId'],[]).append((b,c))
for field,pairs in sheets.items():
 W,H=260,260;sheet=Image.new('RGB',(W*2,H*len(pairs)),'#eef0f2');draw=ImageDraw.Draw(sheet)
 for n,pair in enumerate(pairs):
  x,y,w,h=pair[0]['mask']['pixelBox'];box=(max(0,x-25),max(0,y-30),min(390,x+w+25),min(844,y+h+40))
  for side,r in enumerate(pair):
   im=Image.open(root/r['images']['actual']).convert('RGB').crop(box);im.thumbnail((W-8,H-55),Image.Resampling.NEAREST);px=side*W;py=n*H;sheet.paste(im,(px+(W-im.width)//2,py));draw.text((px+4,py+H-50),r['mode']+' '+r['subjectKind']+' zoom'+str(r['zoom']),fill='black');draw.text((px+4,py+H-35),r['probe']['id'][:40],fill='black');draw.text((px+4,py+H-20),f"{r['mask']['visiblePixels']}/{r['mask']['referencePixels']} terrain pixels",fill='black')
 sheet.save(root/(field+'-support-roi.png'))
report={'status':'NUMERICAL_REGRESSION_REVIEW_REQUIRED' if regressions else 'MEASURED_SUPPORT_SEMANTICS_AND_VISUAL_REVIEW_REQUIRED','samples':samples,'regressions':regressions,'unresolvedSupportOrOcclusion':unresolved,'releaseApproved':False,'scope':'Six low-overlay fields, exact finite probe IDs; no global support override; GPU target-last/MSAA limitations apply','warning':'Candidate occluded pixels may be real props OR still floor-clipped. Counts alone cannot distinguish. Independent triangle/support semantics and ordinary images required.'};(root/'support-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'cases':len(samples),'regressions':len(regressions),'unresolved':len(unresolved),'status':report['status']}))
if regressions:sys.exit(2)
