#!/usr/bin/env python3
"""Bounded paired depth metrics + per-route contact boards. No anatomical verdict."""
import json,sys,pathlib
import numpy as np
from PIL import Image,ImageDraw
root=pathlib.Path(sys.argv[1]); report=json.loads((root/'contact-results.json').read_text());rows=report['results']; assert report['failure'] is None
assert len(rows)==report['expectedRows'] and report['routes'] in (8,226)
results=[]; boards=root/'boards';boards.mkdir(exist_ok=True)
for route in sorted({r['formIndex'] for r in rows}):
 rr=[r for r in rows if r['formIndex']==route];assert len(rr)==4
 panels=[]
 for role in ['IDLE_REQUEST_SEED','SOURCE_PREDICTED_RISK_NOT_MEASURED_WORST']:
  a=next(r for r in rr if r['mode']=='raw4f' and r['role']==role);b=next(r for r in rr if r['mode']=='recovery8a65' and r['role']==role)
  assert a['frameId']==b['frameId'] and a['viewport']==b['viewport']
  assert a['evidence']['source']==b['evidence']['source']
  for key in ['frameGeometry','texture','nativePoint','nativeZ','screenQuad','rootScreen','groundScreen','shadowCenter','contactProfile','contactEllipses']:
   assert a['evidence']['presentation'][key]==b['evidence']['presentation'][key],key
  metrics=[]
  for target in ['default','offscreen']:
   paths=lambda r,kind:root/(r['prefix']+'-'+target+'-'+kind+'.png')
   refa=np.array(Image.open(paths(a,'reference')).convert('RGBA'));refb=np.array(Image.open(paths(b,'reference')).convert('RGBA'));assert np.array_equal(refa,refb),'OWN_REFERENCE_CHANGED'
   old=np.array(Image.open(paths(a,'actual')).convert('RGBA'))[:,:,:3].astype(int);new=np.array(Image.open(paths(b,'actual')).convert('RGBA'))[:,:,:3].astype(int);ref=refa[:,:,:3].astype(int)
   loss=np.maximum(old-new,0);excess=np.maximum(new-ref,0);deficit=np.maximum(ref-new,0)
   metrics.append(dict(target=target,lostIntensity=int(loss.sum()),lostPixels=int(np.any(loss>0,axis=2).sum()),excessIntensity=int(excess.sum()),remainingDeficit=int(deficit.sum()),depthVerdict='PASS_NO_NEW_LOSS' if not loss.any() and not excess.any() else 'FAIL'))
  results.append(dict(formIndex=route,role=role,profile=b['evidence']['profile'],metrics=metrics,anatomicalContact='MANUAL_REVIEW_PENDING',poseScope=b['scope'],omittedStaticTextures=b['omittedStaticTextures']))
  for r in [a,b]:
   im=Image.open(root/(r['prefix']+'-normal.png')).convert('RGB');p=r['evidence']['presentation'];q=p['screenQuad'];rects=[(q['x'],q['y'],q['x']+q['width'],q['y']+q['height'])]
   for e in r['evidence']['ellipses']:
    x=p['rootScreen']['x']+e['x']*3;y=p['rootScreen']['y']+e['y']*3;rects.append((x-e['radiusX']*3,y-e['radiusY']*3,x+e['radiusX']*3,y+e['radiusY']*3))
   box=(max(0,int(min(t[0] for t in rects))-12),max(0,int(min(t[1] for t in rects))-12),min(im.width,int(max(t[2] for t in rects))+13),min(im.height,int(max(t[3] for t in rects))+13));crop=im.crop(box)
   panel=Image.new('RGB',(max(420,crop.width),crop.height+54),'#18212d');panel.paste(crop,(0,54));d=ImageDraw.Draw(panel);d.text((4,4),r['mode']+' '+role,fill='white');d.text((4,21),r['entityId']+' '+r['frameId']+' '+r['evidence']['profile'],fill='white');d.text((4,36),'Native unit 3; no anatomical feet inference',fill='white');panels.append(panel)
  
 width=max(p.width for p in panels);height=max(p.height for p in panels);board=Image.new('RGB',(width*2,height*2),'#18212d')
 for i,panel in enumerate(panels):board.paste(panel,((i%2)*width,(i//2)*height))
 board.save(boards/f'route-{route:03d}.png')
verdict={'status':'PASS_BOUNDED_DEPTH_ONLY' if all(m['depthVerdict'].startswith('PASS') for r in results for m in r['metrics']) else 'FAIL_STRICT_DEPTH','routes':report['routes'],'seedPairs':len(results),'rows':results,'anatomicalReview':'OPEN; floating, nativeZ and anatomical ground support require separate review','allFramesClaim':False}
(root/'contact-comparison.json').write_text(json.dumps(verdict,indent=2)+'\n')
if verdict['status'].startswith('FAIL'):sys.exit(2)
