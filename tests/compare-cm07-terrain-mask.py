"""GPU white-ID terrain visibility; does not certify expected foreground geometry."""
import json,pathlib,sys,base64
import numpy as np
from PIL import Image,ImageDraw
root=pathlib.Path(sys.argv[1]);doc=json.loads((root/'terrain-mask-results.json').read_text());rows=doc['results'];assert len(rows)==32
by={(r['mode'],r['id']):r for r in rows};assert len(by)==32
samples=[];flags=[];sheet=Image.new('RGB',(4*195,8*252),'#eeeeee');draw=ImageDraw.Draw(sheet)
def unpack(mask,key):
 x,y,w,h=mask['pixelBox'];bits=np.unpackbits(np.frombuffer(base64.b64decode(mask[key]),dtype=np.uint8));assert bits.size>=w*h
 return bits[:w*h].astype(bool).reshape((h,w))
for index,key in enumerate(sorted(r['id'] for r in rows if r['mode']=='baseline')):
 b,c=[by[(mode,key)] for mode in ['baseline','floor-only']]
 for name in ['nativePoint','nativeZ','groundHeight','screenQuad','rootScreen','texture']:assert b['data'][name]==c['data'][name],(key,name,'controlled geometry drift')
 for r in [b,c]:
  assert r['normalImageSha256']==r['restoredImageSha256'],(key,'normal render changed by probe')
  control=r['controls'];assert control['status']=='GPU_KNOWN_CONTROL_ASSERTIONS_PASSED' and control['clearReferencePixels']>0 and control['blockedReferencePixels']>0 and control['blockedVisiblePixels']==0 and control['clearMismatch']==control['referenceMismatch']==0
 bm,cm=b['mask'],c['mask'];assert bm['pixelBox']==cm['pixelBox'] and bm['referenceMask']==cm['referenceMask'],(key,'GPU reference drift')
 ref=unpack(bm,'referenceMask');bv=unpack(bm,'visibleMask');cv=unpack(cm,'visibleMask')
 assert ref.any() and not ((bv|cv)&~ref).any();assert int(ref.sum())==bm['referencePixels']==cm['referencePixels']
 assert int(bv.sum())==bm['visiblePixels'] and int(cv.sum())==cm['visiblePixels']
 x,y,w,h=bm['pixelBox'];above=ref&(np.indices((h,w))[0]+y+.5 < b['data']['rootScreen']['y']-1)
 changed=int(((bv!=cv)&above).sum());lost=int((bv&~cv&~above).sum());recovered=int((~bv&cv&~above).sum())
 row={'id':key,'referencePixels':int(ref.sum()),'baselineTerrainVisiblePixels':int(bv.sum()),'candidateTerrainVisiblePixels':int(cv.sum()),'aboveSupportExclusionBandChangedPixels':changed,'lowerOrTransitionRecoveredPixels':recovered,'lowerOrTransitionLostPixels':lost,'surfaceEvidence':c['data']['surfaceEvidence']};samples.append(row)
 if changed or lost:flags.append(row)
 for side,entry in enumerate([b,c]):
  im=Image.open(root/entry['images']['actual']).convert('RGB');im.thumbnail((190,212));n=index*2+side;px=n%4*195;py=n//4*252;sheet.paste(im,(px,py));draw.text((px+2,py+214),entry['mode'],fill='black');draw.text((px+2,py+228),key[:26],fill='black')
sheet.save(root/'terrain-mask-contact-sheet.jpg',quality=92)
report={'status':'TERRAIN_MASK_REVIEW_REQUIRED' if flags else 'UPPER_TERRAIN_MASK_MATCH_NO_LOST_LOWER_PIXELS_NOT_RELEASE_APPROVAL','samples':samples,'flags':flags,'releaseApproved':False,'oracleScope':'Single isolated sprite against opaque depth-writing terrain; white RGB after actual alpha/discard/depth','limitations':['probe target-last changes equal-depth tie precedence','other sprite interactions and non-depth-writing particle color NOT_TESTED','recovered lower pixels do not establish expected pillar foreground ordering','scalar support height remains independently unverified','diagnostic shader requires GPU known-visible/hidden/restored-floor controls before trusted oracle acceptance'],'requiredReview':doc['pending']}
(root/'terrain-mask-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'samples':len(samples),'flags':len(flags),'status':report['status']}))
if flags:sys.exit(2)
