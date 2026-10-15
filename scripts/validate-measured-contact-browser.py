import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/reports/character-contact-2026-10-15'
PRIVATE=ROOT.parent/'contact-browser-inspection'
OUT.mkdir(parents=True,exist_ok=True);PRIVATE.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True);page=browser.new_page(viewport={'width':960,'height':920},device_scale_factor=1);errors=[];responses=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:responses.append([r.status,r.url]) if r.status>=400 else None)
 page.goto('http://127.0.0.1:8846/tests/fixtures/hunt-measured-contact-review.html');page.wait_for_load_state('networkidle')
 try:page.wait_for_function('window.contactReviewReady===true',timeout=10000)
 except Exception:
  print('PAGE ERRORS',errors,'HTTP ERRORS',responses);raise
 initial=page.evaluate('window.contactReview.diagnostics()')
 assert initial['pixi']=='8.19.0';assert sorted(initial['roster']['completedOriginalArt']['loaded'])==sorted(['m104_tunomon','m006_punimon','m203_elecmon'])
 for mode in ['generic','measured']:
  page.locator('#mode').select_option(mode);page.wait_for_function('(m)=>window.contactReview.diagnostics().settings.mode===m',arg=mode);page.locator('#field').screenshot(path=str(PRIVATE/(mode+'-reference.png')))
 samples=[]
 for pose in ['reference','idle0','idle1','walk0','walk1','air']:
  for flip in [False,True]:
   for height in [0,18,6,0]:
    d=page.evaluate('(s)=>window.contactReview.render(s)',{'mode':'measured','pose':pose,'height':height,'flipY':flip})
    for f in d['frames']:
     assert f['art']['entityId']==f['entityId'];assert f['contact'] is not None
     assert f['bodyY']==f['worldY']-height;assert f['nativeScale']==.5
     assert f['anchor']['x']==f['frame']['geometry']['origin'][0]/256 and f['anchor']['y']==f['frame']['geometry']['origin'][1]/256
     for e in f['contact']['ellipses']:
      actual=f['bodyY']+f['bodyFlipY']*(f['shadowY']+f['shadowFlipY']*e['y'])
      assert actual==f['worldY']+e['y']
    samples.append({'settings':d['settings'],'frames':d['frames']})
  page.evaluate('(pose)=>window.contactReview.render({pose,height:0,flipY:false})',pose);page.locator('#field').screenshot(path=str(PRIVATE/(pose+'-measured.png')))
 cleanup=page.evaluate('window.contactReview.dispose()');assert cleanup['sceneCount']==0 and cleanup['ticker']==cleanup['baselineTicker'] and cleanup['rootDestroyed'];assert not errors,errors
 report={'browser':browser.version,'pixi':'8.19.0','headless':True,'normalPlayerEntryValidated':False,'scope':'Real completed-original loader and Hunt renderer, exact selected atlas bytes through a loopback asset-root alias; no save or AI state.',
  'sourceBase':'b01ed619375641f5578b2bc65883ebfa32ad8914','samples':samples,'initial':initial,'cleanup':cleanup,'errors':errors,'performanceClaims':'NONE; no FPS or battery claim; no silhouette prototype was loaded.'}
 (OUT/'browser-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS',len(samples)*6,'rendered actor cases; 3 exact art identities; body origins preserved; cleanup',cleanup)
 browser.close()
