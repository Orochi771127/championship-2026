#!/usr/bin/env python3
"""CI filesystem-only actual alpha coverage. No browser, network or source edits."""
import argparse,base64,hashlib,json,math,re
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--repo',default='.');p.add_argument('--coverage',required=True);p.add_argument('--out',required=True);p.add_argument('--scene',default='src/championship/presentation/ranchThreeScene.js');a=p.parse_args();root=Path(a.repo)
scene=(root/a.scene).read_text();match=re.search(r'MeshBasicMaterial\(\{map:texture,alphaTest:([.\d]+)',scene)
if not match:raise RuntimeError('ACTUAL_ACTOR_ALPHA_TEST_NOT_FOUND_DO_NOT_GUESS')
alpha_test=float(match[1]);alpha_byte=math.ceil(alpha_test*255)
activity=json.loads((root/'src/data/championship/catalogs/raising-activity.r1.json').read_text());seq={0,1,2,3,5,11,12,13,14,15,28,30,33};seq.update(v[k] for v in activity['reactions'] for k in ('sequence','alternate') if v.get(k,-1)>=0);seq.discard(39)
coverage=json.loads(Path(a.coverage).read_text());forms=[];errors=[]
expected_forms=coverage.get('forms',[])
if len(expected_forms)!=226 or len({f['entityId'] for f in expected_forms})!=226 or len({f['path'] for f in expected_forms})!=226:
 raise RuntimeError('EXACT_226_UNIQUE_PUBLIC_FORM_ROUTES_REQUIRED')
# Default candidate mesh already includes +.015, as does its floor cap. They
# cancel: affected iff nativeY>lift. This measures proxy-affected source pixels,
# NOT actual floor-penetration pixels (whose flat H threshold is lift+.147759).
# Explicit support-height overrides require a separate Hoverride-Hroot delta.

def checked(path,sha=None):
 data=path.read_bytes()
 if sha and hashlib.sha256(data).hexdigest()!=sha:raise RuntimeError('SHA_MISMATCH:'+str(path))
 return data
for form in coverage['forms']:
 path=form['path'];path=path if path.startswith('assets/') else 'assets/production/characters/'+path
 try:
  runtime=json.loads(checked(root/path,form['contentSha256']));base=(root/path).parent;wanted={f['texture'] for anim in runtime['sides']['main']['animations'] if anim['id'] in seq for f in anim['frames']};metrics=[];pages={}
  for page in runtime['sides']['main']['atlases']:
   streaming=next((v for v in runtime.get('streaming',{}).get('pages',[]) if v['data']==page['data']),{})
   atlas=json.loads(checked(base/page['data'],streaming.get('dataSha256')))
   # Verify full image once then decode. Larger-than-1MB connector limits do not apply to checked-out CI assets.
   checked(base/page['image'],streaming.get('imageSha256'));image=Image.open(base/page['image']).convert('RGBA')
   for key,frame in atlas['frames'].items():
    if key not in wanted:continue
    if frame.get('rotated'):raise RuntimeError('ROTATED_ATLAS_REQUIRES_VERIFIED_TRANSFORM:'+key)
    g=runtime['geometry']['frames'][key]
    if g.get('blank'):continue
    f=frame['frame'];trim=frame['spriteSourceSize'];alpha=image.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).getchannel('A');hist=[];pixels=list(alpha.getdata());scale=form['normalization']['scale'];offset=form['normalization']['fixedEggOffsetY'];offset=(g['nativeBounds'][3]*(1-scale)) if offset is None else offset
    for iy in range(f['h']):
     n=sum(v>=alpha_byte for v in pixels[iy*f['w']:(iy+1)*f['w']])
     if n:hist.append((((trim['y']+iy+.5-g['origin'][1])/g['scale'])*scale+offset,n))
    total=sum(n for y,n in hist);lifts=[]
    for lift in (0,8,32):
     affected=sum(n for y,n in hist if y>lift);maxnative=max([max(0,y-lift) for y,n in hist]or[0]);lifts.append({'nativeLift':lift,'affectedOpaquePixels':affected,'opaqueFraction':affected/total if total else 0,'maxFragmentDepthPushWorld':maxnative/(16*math.sin(math.radians(52))*math.cos(math.radians(52)))})
    metrics.append({'texture':key,'opaquePixels':total,'opaqueYRange':[min(y for y,n in hist),max(y for y,n in hist)] if hist else None,'lifts':lifts})
   image.close()
  actual={v['texture'] for v in metrics};expected={k for k in wanted if not runtime['geometry']['frames'][k].get('blank')};missing=sorted(expected-actual)
  if missing:raise RuntimeError('FRAME_PIXEL_COVERAGE_MISSING:'+','.join(missing))
  forms.append({'entityId':form['entityId'],'frameCount':len(metrics),'frames':metrics})
 except Exception as e:errors.append({'entityId':form['entityId'],'error':str(e)})
result={'scope':'Actual source-alpha pixels affected by default same-height candidate cap for static Raising request set; existing mesh +.015 and cap +.015 cancel. Not GPU visibility, actual terrain penetration, linear-filtered screen alpha, explicit support overrides or full simulated-state reachability. Native Z0/8/32 are diagnostic conditions.','actualActorAlphaTest':alpha_test,'sourceAlphaByteThreshold':alpha_byte,'raisingSequenceSet':sorted(seq),'forms':forms,'errors':errors,'allFormsCovered':len(forms)==len(coverage['forms']) and not errors}
Path(a.out).write_text(json.dumps(result,indent=2));print(json.dumps({'forms':len(forms),'frames':sum(f['frameCount'] for f in forms),'errors':len(errors),'allFormsCovered':result['allFormsCovered']}));raise SystemExit(bool(errors))
