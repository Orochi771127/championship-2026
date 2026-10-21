import {watchNormalRequests} from './normal-lifecycle/request-audit.mjs';
// The real production presenter, no replicated decorateActor/ground alignment.
// Captures do not by themselves certify waste, authored jumping, or contact feet.
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const [base,out,baselineFile,probeFile,oldContactDir]=process.argv.slice(2);assert.ok(base&&out&&baselineFile&&probeFile&&oldContactDir);assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const baselineRevision='4f64421314f0d0f5d0c04b916d30e821587c1a6a',scenePath='src/championship/presentation/ranchThreeScene.js',presenterPath='src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const baseline=await fs.readFile(baselineFile,'utf8'),candidate=await fs.readFile(scenePath,'utf8'),probe=await fs.readFile(probeFile,'utf8');
assert.equal(sha(baseline),sha(execFileSync('git',['show',baselineRevision+':'+scenePath])));
assert.equal(sha(candidate),'1ae46df21194a20536fb8319681cce06026c058c94bce5c2b1c0d3d09ea5b9bb');
assert.equal(sha(await fs.readFile(presenterPath)),'865286f7f74ddbdc9391244d623c0cc4d10f2c9031feb4821375d688c7659793');
assert.equal(sha(probe),'325ad54f05ff89b01b7bdb69d3cfc10357a462b12019134b87eb32e42e161224','Reviewed generated probe identity');
const contactPaths={roster:'src/championship/presentation/publicCharacterRoster.js',helper:'src/championship/presentation/vs2/huntContactShadow.js'};
const contactHashes={old:{roster:'5a810256912ba9faec9825480ccf789b78537848742e2163f4aa0bf695d6e4b5',helper:'5db6ea2ee5e4d06bc2b52a70fed79fa94cec55e6cb3e96caec114c152f4efe17'},candidate:{roster:'a195da3e2d2a4d1ddd26ca59405ace675d38028ac9d084bd3a90391f15c9d9ed',helper:'c284a006e2bec65205011553f2c62633edd514c5a3ec587d6a282caf1172cc41'}};
const contactSources={old:{},candidate:{}};
for(const [key,sourcePath] of Object.entries(contactPaths)){
 contactSources.old[key]=await fs.readFile(oldContactDir+'/'+sourcePath.split('/').at(-1),'utf8');contactSources.candidate[key]=await fs.readFile(sourcePath,'utf8');
 for(const variant of ['old','candidate'])assert.equal(sha(contactSources[variant][key]),contactHashes[variant][key],'Exact contact '+variant+' '+key);
 assert.equal(sha(execFileSync('git',['show',baselineRevision+':'+sourcePath])),contactHashes.old[key],'Actual old source at baseline revision');
}
// Independent reviewed local-ellipse constants, not a renderer self-oracle.
const reviewedEllipses={"13":[{"x":-0.125,"y":-0.25,"radiusX":3.125,"radiusY":0.75}],"23":[{"x":-2.875,"y":-0.25,"radiusX":1.875,"radiusY":0.75},{"x":0.5,"y":-0.25,"radiusX":2.5,"radiusY":0.75},{"x":4.375,"y":-0.5,"radiusX":2.375,"radiusY":0.625}],"36":[{"x":-8.5,"y":-0.5,"radiusX":2,"radiusY":0.75},{"x":-2,"y":-0.25,"radiusX":2.5,"radiusY":0.75},{"x":2.625,"y":-1,"radiusX":2.125,"radiusY":0.75},{"x":9.875,"y":-0.5,"radiusX":2.125,"radiusY":0.75}]};
const runnerSha256=sha(await fs.readFile(new URL(import.meta.url))),fixtureSha256=sha(await fs.readFile('tests/fixtures/ranch-normal-pairs.html'));
assert.equal(sha(await fs.readFile(new URL('./normal-lifecycle/request-audit.mjs',import.meta.url))),'b2255fb0255def1cf31770fd5dc442239d34462a260a34d2d28400ae2d29a0ad','Reviewed narrow audio-lifecycle observer');
const pairKeys=new Map(),oldContacts=new Map();
const engine=process.env.BROWSER_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));
const browser=await ({chromium,webkit}[engine]).launch({headless:true});const results=[];
// All three reviewed contact species and an ordinary default contact go through
// real normal app paths. No numeric assumption about a species' anatomy.
try{for(const species of [25])for(const zoom of [1,.7])for(const mode of ['baseline','floor-only']){
 let sceneRequests=0,probeRequests=0;const contactRequests={roster:0,helper:0},contactVariant=mode==='floor-contact'?'candidate':'old';
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});const page=await context.newPage(),errors=[];
 const requestAudit=await watchNormalRequests(page,base,engine);let requestAuditEvidence=null;
 page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push('console:'+m.type()+':'+m.text());});
 page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});
 try{
  for(const [key,sourcePath] of Object.entries(contactPaths))await page.route('**/'+sourcePath,async route=>{contactRequests[key]++;await route.fulfill({status:200,contentType:'text/javascript',body:contactSources[contactVariant][key]});});
  await page.route('**/'+presenterPath,async route=>{probeRequests++;await route.fulfill({status:200,contentType:'text/javascript',body:probe});});
  await page.route('**/'+scenePath,async route=>{sceneRequests++;await route.fulfill({status:200,contentType:'text/javascript',body:mode==='baseline'?baseline:candidate});});
  await page.addInitScript(()=>{let state=0x137ab;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};});
  await page.goto(new URL('tests/fixtures/ranch-normal-pairs.html',base).href);await page.waitForFunction(()=>!!globalThis.prepareNormalContactPair);
  const preparation=await page.evaluate(i=>globalThis.prepareNormalContactPair(i),species);
  requestAudit.setPhase('login');await page.goto(new URL('championship.html?presentation=developer',base).href);await page.locator('#cm-login').waitFor();
  if(await page.locator('#cm-film-skip').isVisible()){await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});}
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);requestAudit.setPhase('leaving-login');await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();requestAudit.setPhase('raising-loading');
  await page.waitForFunction(i=>{const h=document.querySelector('.int-rh2-field-host');return h?.dataset.loadState==='ready'&&JSON.parse(h?.dataset.residentAssets||'[]').some(a=>a.speciesId.endsWith('species-'+String(i).padStart(3,'0'))&&a.state==='ready')},species,{timeout:180000});
  await page.waitForFunction(i=>{const h=document.querySelector('.int-rh2-field-host'),assets=JSON.parse(h?.dataset.residentAssets||'[]'),positions=JSON.parse(h?.dataset.residentScreenPositions||'[]'),panels=[...document.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')];return h?.dataset.loadState==='ready'&&h.getAttribute('aria-busy')==='false'&&assets.length>0&&assets.every(a=>a.state==='ready'&&!a.error)&&panels.length>0&&panels.every(p=>p.hidden)&&positions.some(p=>p.speciesIndex===i&&Number.isFinite(p.nativeFrame)&&assets.some(a=>a.creatureId===p.creatureId&&a.state==='ready'))},species,{timeout:180000});
  await page.getByText(/正在載入夥伴外觀/).first().waitFor({state:'hidden',timeout:180000});
  if(zoom===.7){await page.locator('.cm-ranch-zoom').click();await page.waitForFunction(()=>document.querySelector('.cm-ranch-zoom')?.textContent?.includes('70%'));}
  const readyProgress=await page.evaluate(i=>({threeFrames:Number(document.querySelector('.cm-ranch-three-canvas')?.dataset.frames),nativeFrame:JSON.parse(document.querySelector('.int-rh2-field-host').dataset.residentScreenPositions).find(p=>p.speciesIndex===i).nativeFrame}),species);
  await page.waitForFunction(({species,before})=>{const h=document.querySelector('.int-rh2-field-host'),assets=JSON.parse(h?.dataset.residentAssets||'[]'),p=JSON.parse(h?.dataset.residentScreenPositions||'[]').find(p=>p.speciesIndex===species);return h?.getAttribute('aria-busy')==='false'&&assets.every(a=>a.state==='ready'&&!a.error)&&[...h.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')].every(e=>e.hidden)&&Number(document.querySelector('.cm-ranch-three-canvas')?.dataset.frames)>before.threeFrames+2&&p?.nativeFrame>before.nativeFrame},{species,before:readyProgress},{timeout:30000});
  requestAuditEvidence=await requestAudit.assertClean();requestAudit.setPhase('capture');
  assert.equal(await page.locator('[data-field-fallback="true"],.int-rh2-field-fallback').count(),0);
  assert.ok(sceneRequests>0&&probeRequests>0&&contactRequests.roster>0&&contactRequests.helper>0,'Exact routed scene, identity sources and test presenter consumed');
  const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));assert.deepEqual(viewport,{width:390,height:844,dpr:1});
  const pairId=species+':'+zoom;const expected=pairKeys.get(pairId)??null;
  // Match the actual native-presenter cell, not a guessed idle frame or ellipse.
  await page.waitForFunction(({species,expected})=>{const h=document.querySelector('.int-rh2-field-host'),assets=JSON.parse(h?.dataset.residentAssets||'[]'),panels=[...document.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')];
    if(h?.dataset.loadState!=='ready'||h?.getAttribute('aria-busy')!=='false'||!assets.length||!assets.every(a=>a.state==='ready'&&!a.error)||!panels.length||!panels.every(p=>p.hidden))return false;
    const p=globalThis.__ranchContactAudit?.snapshot()?.positions.find(p=>p.speciesIndex===species),d=p?.testOnlyContactDiagnostic;
    if(!assets.some(a=>a.creatureId===p?.creatureId&&a.state==='ready'))return false;
    if(!d?.entityId||!d.speciesId||!d.frame||d.frame.cell==null||d.frame.sequenceId==null||!d.ellipses?.length||d.nativeLift!==0)return false;
    if(d.frame.sequenceId!==14||d.frame.flipX||d.frame.flipY)return false;
    if(!(p.x>0&&p.x<390&&p.bodyTop>=0&&p.footY<844&&p.groundScreen?.x>0&&p.groundScreen.x<390&&p.groundScreen.y>=0&&p.groundScreen.y<844))return false;
    const key=JSON.stringify({entityId:d.entityId,speciesId:d.speciesId,sequenceId:d.frame.sequenceId,cell:d.frame.cell,geometry:d.frame.geometry,flipX:d.frame.flipX,flipY:d.frame.flipY});
    if(expected&&key!==expected)return false;globalThis.__normalPairPaused=globalThis.__ranchContactAudit.pause();return true;
  },{species,expected},{timeout:60000});
  const evidence=await page.evaluate(()=>globalThis.__normalPairPaused),position=evidence.positions.find(p=>p.speciesIndex===species),d=position.testOnlyContactDiagnostic;
  const key=JSON.stringify({entityId:d.entityId,speciesId:d.speciesId,sequenceId:d.frame.sequenceId,cell:d.frame.cell,geometry:d.frame.geometry,flipX:d.frame.flipX,flipY:d.frame.flipY});
  if(expected)assert.equal(key,expected,'Exact same native source cell/geometry/entity');else pairKeys.set(pairId,key);
  assert.ok(evidence.serial>0);assert.equal(position.creatureId,preparation.residentId,'Actual prepared resident identity');assert.deepEqual(errors,[]);
  const expectedReviewed=mode==='floor-contact'&&Boolean(reviewedEllipses[species]);
  assert.equal(d.mode,expectedReviewed?'reviewed':'fallback','Actual selected shadow profile');
  let liftedHelperChecks=null;
  if(expectedReviewed){
   assert.ok(d.contactShadowArt?.entityId===d.entityId&&d.contactShadowArt?.side==='main'&&/^[a-f0-9]{64}$/.test(d.contactShadowArt?.sourceBankSha256??''),'Actual accepted delivery identity');
   assert.deepEqual(d.ellipses,reviewedEllipses[species],'Existing reviewed ellipse constants, seq14 unflipped');
   assert.equal(d.ellipseScreen.length,d.ellipses.length);
   for(const [i,e] of d.ellipses.entries()){
    assert.ok(Math.abs(d.ellipseScreen[i].x-(d.root.x+e.x*d.root.scaleX))<1e-5,'Actual screen X contact matches reviewed local ellipse');
    assert.ok(Math.abs(d.ellipseScreen[i].y-(d.root.y+e.y*d.root.scaleY))<1e-5,'Actual screen Y contact matches reviewed local ellipse');
   }
   // Read-only pure-helper checks only. NOT an actual airborne normal-game render.
   liftedHelperChecks=await page.evaluate(async({d})=>{const {getReviewedRaisingContactShadow}=await import('/src/championship/presentation/intRh2/raisingContactShadow.js');return [0,8,32].map(lift=>({lift,ellipses:getReviewedRaisingContactShadow(d.speciesId,d.frame,d.contactShadowArt,lift,false)}));},{d});
   for(const check of liftedHelperChecks)assert.deepEqual(check.ellipses,reviewedEllipses[species],'Existing helper preserves landing footprint under synthetic lift');
  }else{
   assert.equal(d.contactShadowArt,null,'Old path and nonreviewed controls do not gain reviewed identity');
   if(!oldContacts.has(pairId))oldContacts.set(pairId,d.ellipses);else assert.deepEqual(d.ellipses,oldContacts.get(pairId),'Fallback contact unchanged');
  }
  const cameraCalibration=await page.evaluate(()=>{const h=document.querySelector('.int-rh2-field-host'),c=document.querySelector('.cm-ranch-three-canvas');const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {host:rect(h),threeCanvas:rect(c),zoomButtonText:document.querySelector('.cm-ranch-zoom')?.textContent,hostLoadState:h.dataset.loadState,hostAriaBusy:h.getAttribute('aria-busy')};});

  assert.ok(Math.abs(position.nativeScreenPixels-3*zoom)<1e-8,'Actual production UI zoom native-pixel scale');
  assert.ok(Math.abs(d.root.scaleX-position.nativeScreenPixels)<1e-8&&Math.abs(d.root.scaleY-position.nativeScreenPixels)<1e-8,'Body root and camera pixel scale agree');
  const file=mode+'-zoom'+zoom+'-normal-contact-'+species+'.png';
  const png=await page.screenshot({path:out+'/'+file});assert.equal(png.readUInt32BE(16),390);assert.equal(png.readUInt32BE(20),844);
  assert.deepEqual(await page.evaluate(()=>globalThis.__ranchContactAudit.snapshot()),evidence,'Recorded visual frame remains unchanged across PNG');
  assert.equal(await page.evaluate(()=>{const h=document.querySelector('.int-rh2-field-host'),assets=JSON.parse(h?.dataset.residentAssets||'[]'),panels=[...document.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')];return h?.dataset.loadState==='ready'&&h?.getAttribute('aria-busy')==='false'&&assets.length>0&&assets.every(a=>a.state==='ready'&&!a.error)&&panels.length>0&&panels.every(p=>p.hidden);}),true,'Readiness remains valid through PNG');assert.deepEqual(errors,[]);
  requestAuditEvidence=await requestAudit.assertClean();
  results.push({species,mode,requestAuditEvidence,zoom,contactVariant,contactSourceSha256:contactHashes[contactVariant],contactRequests,liftedHelperChecks,liftedChecksScope:'PURE_HELPER_ONLY_NOT_NATIVE_AIRBORNE_RENDER',cameraCalibration,status:'PAIRED_IDENTITY_ACTIVATION_CAPTURED_VISUAL_PENDING',sceneSha256:sha(mode==='baseline'?baseline:candidate),probeSha256:sha(probe),screenshot:file,viewport,preparation,readyProgress,evidence,sourceFrameKey:key});
 }catch(error){results.push({species,mode,zoom,status:'FAIL',failureSnapshot:await page.evaluate(()=>globalThis.__ranchContactAudit?.snapshot()).catch(()=>null),error:String(error),errors,requestAuditEvidence:error.auditEvidence??await requestAudit.snapshot().catch(e=>({snapshotError:String(e)}))});await page.screenshot({path:out+'/'+mode+'-normal-failure-'+species+'.png'}).catch(()=>{});throw error;}
 finally{await page.evaluate(()=>globalThis.__ranchContactAudit?.resume()).catch(()=>{});await page.mouse.up().catch(()=>{});await context.close();await fs.writeFile(out+'/normal-scale-calibration-results.json',JSON.stringify({engine,runnerSha256,fixtureSha256,baselineRevision,releaseApproved:false,results,coverage:{expectedCases:4,successfulCases:results.filter(r=>r.status==='PAIRED_IDENTITY_ACTIVATION_CAPTURED_VISUAL_PENDING').length},visualReview:'PENDING',uncovered:['native authored airborne','waste real lifecycle','care prop source-frame pairing','CM28','pan/wrap','all character routes']},null,2));}
}
}finally{await browser.close();}

