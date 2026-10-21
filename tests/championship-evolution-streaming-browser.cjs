// Dedicated loopback CI regression. Production files remain unchanged.
// Test-only response transforms expose app state and trigger the real native
// evolution state machine on a synthetic owned resident; no renderer/clock mock.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:8765/';
const engine=process.argv[3]||'chromium';
const out=process.argv[4]||'.tmp/browser-qa/evolution';
const baseline=process.argv.includes('--baseline');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const exactReplace=(s,a,b)=>{assert.equal(s.split(a).length,2,`Unique test seam: ${a}`);return s.replace(a,b);};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const catalog=JSON.parse(await fs.readFile('src/data/championship/public-character-catalog.v1.json','utf8'));
 const binding=catalog.speciesBindings.find(x=>x.speciesId==='species-035');
 const config=catalog.characters.find(x=>x.entityId===binding.entityId);
 const runtime=JSON.parse(await fs.readFile(config.runtimePath,'utf8'));
 const sequence=runtime.sides.main.animations.find(x=>x.id===39);
 assert.ok(sequence?.frames.length&&runtime.streaming,'Real streamed target sequence39');
 const pages=[...new Set(sequence.frames.map(f=>runtime.streaming.texturePages[f.texture]))];
 const initial=new Set(runtime.sides.main.animations.find(x=>x.id===0).frames.map(f=>runtime.streaming.texturePages[f.texture]));
 const delayed=pages.filter(p=>!initial.has(p));assert.ok(delayed.length,'Target39 must have noninitial pages');
 const targetPaths=new Set(delayed.map(p=>'/'+path.posix.join(path.posix.dirname(config.runtimePath),runtime.streaming.pages[p].image)));
 const browser=await ({chromium,webkit}[engine]).launch({headless:true});
 const results=[];
 try{
  for(const mode of baseline?['baseline']:['delay','reject']){
   const context=await browser.newContext({viewport:engine==='webkit'?{width:390,height:844}:{width:320,height:712},deviceScaleFactor:engine==='webkit'?3:1,isMobile:true,hasTouch:true,locale:'zh-TW'});
   const page=await context.newPage();page.setDefaultTimeout(120000);
   const evidence={mode,engine,target:35,targetEntity:config.entityId,targetPaths:[...targetPaths],errors:[],console:[],network:[],httpFailures:[],requestFailures:[],writes:[]};
   let release,blocked=0,allow=false,baselinePresenterRequests=0;const injectedRequests=new WeakSet();
   const barrier=new Promise(r=>release=r);
   page.on('pageerror',e=>evidence.errors.push(e.message));
   page.on('console',m=>{if(['error','warning'].includes(m.type()))evidence.console.push({type:m.type(),text:m.text(),location:m.location()})});
   page.on('response',r=>{if(targetPaths.has(new URL(r.url()).pathname))evidence.network.push({url:r.url(),status:r.status()});if(r.status()>=400)evidence.httpFailures.push({url:r.url(),status:r.status(),method:r.request().method(),injected:injectedRequests.has(r.request())})});
   page.on('requestfailed',r=>evidence.requestFailures.push({url:r.url(),failure:r.failure()?.errorText,method:r.method(),injected:injectedRequests.has(r)}));
   await page.addInitScript(()=>{globalThis.__freezeWrites=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){globalThis.__freezeWrites.push(String(k));return set.call(this,k,v)};globalThis.__freezeRaf=0;function frame(){globalThis.__freezeRaf++;requestAnimationFrame(frame)}requestAnimationFrame(frame)});
   // Shared-streamed target control: both owned residents begin with seq0.
   // A previously unseen species is eagerly loaded by production roster and
   // cannot reproduce the cached-streaming missing39 incident.
   await page.route(url=>url.origin===new URL(base).origin&&url.pathname==='/tests/fixtures/championship-owned-party.html',async route=>{
    const response=await route.fetch();let text=await response.text();
    text=exactReplace(text,"speciesId:'species-034',displayName:'乙隊驗收'","speciesId:'species-035',displayName:'乙隊驗收'");
    text=exactReplace(text,'nativeHuntSpeciesByIndex(34),rng:{next:()=>11}','nativeHuntSpeciesByIndex(35),rng:{next:()=>11}');
    await route.fulfill({response,body:text});
   });
   await page.route('**/src/championship/app/championshipStandaloneApp.js' ,async route=>{
    const response=await route.fetch();let text=await response.text();
    text="import {beginNativeRaisingEvolution as __testBeginEvolution} from '../raising/nativeRaisingActor.js';\n"+text;
    text=exactReplace(text,'    getRaisingState() {',`    __testBeginEvolution(target) {
      const id = requireSession().getRaisingHomeSnapshot().residents[0].residentId;
      const actor = nativeRaisingActor(id);
      if (!actor || actor.evolution) throw Error('TEST_RESIDENT_NOT_READY');
      __testBeginEvolution(actor,{target,productChoiceConfirmed:true},{next:()=>11},raisingFoods);
      publishRaising(); return id;
    },
    getRaisingState() {`);
    await route.fulfill({response,body:text});
   });
   await page.route(url=>url.origin===new URL(base).origin&&url.pathname==='/src/championship/app/main.js',async route=>{
    const response=await route.fetch();let text=await response.text();
    text=exactReplace(text,'scene = next; owner.stopTimer();','scene = next; globalThis.__freezeScene = scene; owner.stopTimer();');
    text+='\nObject.defineProperty(globalThis,"__freezeApp",{get:()=>app});Object.defineProperty(globalThis,"__freezeSource",{get:()=>raisingSource});\n';
    await route.fulfill({response,body:text});
   });
   if(baseline)await page.route('**/src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',async route=>{
    baselinePresenterRequests++;await route.fulfill({status:200,contentType:'text/javascript',body:await fs.readFile('.tmp/evolution-baseline-presenter.js','utf8')});
   });
   await page.route('**/*',async route=>{
    if(!targetPaths.has(new URL(route.request().url()).pathname)||allow)return route.fallback();
    blocked++;if(mode==='reject'){injectedRequests.add(route.request());return route.fulfill({status:503,body:'Controlled target sequence39 failure'});}
    await barrier;await route.continue();
   });
   const save=async()=>{evidence.writes=await page.evaluate(()=>[...new Set(globalThis.__freezeWrites)]).catch(()=>[]);await fs.writeFile(`${out}/${engine}-${mode}.json`,JSON.stringify(evidence,null,2));};
   const snapshot=()=>page.evaluate(()=>({life:__freezeApp.getRaisingLifecycleFrame(),scene:__freezeScene.getDiagnostics(),playable:__freezeScene.isPlayable,raf:__freezeRaf,residents:__freezeSource.getFrame().residents.map(r=>({id:r.creatureId,speciesId:r.speciesId})),actor:__freezeApp.getRaisingActorFrame(__freezeApp.getRaisingLifecycleFrame().evolution?.instanceId)}));
   const mark=phase=>console.log(JSON.stringify({engine,mode,phase,time:new Date().toISOString()}));
   try{
    mark('prepare-valid-owned-fixture');
    // Existing fixture constructs a valid isolated local profile, not user data.
    await page.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);
    await page.locator('#prepare-practice').click();await page.locator('#status').filter({hasText:'受控存檔已準備'}).waitFor();
    await page.goto(new URL('championship.html?presentation=developer',base).href);
    await page.locator('#cm-login').waitFor();
    if(await page.locator('#cm-film-skip').isVisible()){await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});}
    await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
    assert.equal(await page.evaluate(()=>Object.getOwnPropertyDescriptor(globalThis,'__freezeApp')?.get instanceof Function),true,'Exact main.js test seam installed (including cache query)');
    await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
    await page.waitForFunction(()=>globalThis.__freezeScene?.isPlayable===true&&document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
    mark('actual-home-ready');
    evidence.before=await snapshot();assert.equal(evidence.before.life.evolution,null);
    const storageBefore=await page.evaluate(()=>Object.keys(localStorage));
    const ownedId=evidence.before.residents[0].id;assert.equal(evidence.before.residents.length,2);
    assert.ok(evidence.before.residents[0].speciesId.endsWith('species-034'));
    assert.equal(new Set(evidence.before.residents.map(r=>r.id)).size,2,'Distinct owned residents');
    assert.ok(evidence.before.residents.some(r=>r.speciesId.endsWith('species-035')),'Target is an already-streamed resident');
    assert.equal(blocked,0,'Target39 page has not been requested before evolution');
    assert.deepEqual(evidence.network,[],'No target39 response before evolution');
    const loadedPages=evidence.before.scene.characterArt.textureMemory.atlasPages;
    assert.ok(loadedPages.some(p=>p.entityId===config.entityId),'Target initial atlas is actually resident');
    assert.ok(!loadedPages.some(p=>targetPaths.has(new URL(p.imageUrl).pathname)),'Target39 page absent from real loaded atlas diagnostics');
    if(baseline)assert.ok(baselinePresenterRequests>0,'Baseline presenter response actually installed');
    assert.deepEqual(evidence.errors,[],'No startup page error');
    evidence.preparation={console:evidence.console,httpFailures:evidence.httpFailures,requestFailures:evidence.requestFailures};
    evidence.console=[];evidence.httpFailures=[];evidence.requestFailures=[];
    await page.evaluate(()=>{globalThis.__freezeWrites=[]});
    mark('begin-native-evolution-target35-sequence39');
    await page.evaluate(()=>__freezeApp.__testBeginEvolution(35));
    if(baseline){
     await page.waitForFunction(()=>globalThis.__freezeApp.getRaisingLifecycleFrame().evolution!==null);
     for(let i=0;i<150&&!evidence.errors.some(x=>x.includes(`NATIVE_CHARACTER_TEXTURE_MISSING:${config.entityId}:39:`));i++)await delay(100);
     evidence.baselineState=await snapshot();evidence.baselinePresenterRequests=baselinePresenterRequests;evidence.interceptedRequests=blocked;
     assert.ok(evidence.errors.some(x=>x.includes(`NATIVE_CHARACTER_TEXTURE_MISSING:${config.entityId}:39:`)),'Baseline reproduces exact exception in actual browser');
     evidence.status='EXPECTED_BASELINE_REPRODUCED';await page.screenshot({path:`${out}/${engine}-baseline.png`,fullPage:true});
    }else{
     await page.waitForFunction(expected=>JSON.parse(document.querySelector('.int-rh2-field-host').dataset.residentAssets||'[]').some(x=>x.state===expected),mode==='reject'?'error':'loading');
     for(let i=0;i<1200&&blocked===0;i++)await delay(100);
     assert.ok(blocked>0,'Actual sequence39 image intercepted');
     mark('target39-intercepted');
     evidence.pending=await snapshot();assert.equal(evidence.pending.playable,false);
     const existingTarget=evidence.before.residents.find(r=>r.id!==ownedId);
     assert.equal(evidence.pending.scene.residentAssets.find(r=>r.creatureId===existingTarget.id).state,'ready','Existing target resident stays independently ready');
     assert.equal(evidence.pending.life.evolution.phase,0);assert.equal(evidence.pending.life.evolution.reveal,false);
     await delay(700);evidence.stillPending=await snapshot();
     assert.equal(evidence.stillPending.life.evolution.totalFrames,evidence.pending.life.evolution.totalFrames,'Native evolution clock is paused');
     assert.deepEqual(evidence.stillPending.actor,evidence.pending.actor,'Source native frame unchanged while target pending');
     assert.ok(evidence.stillPending.raf>evidence.pending.raf,'Browser animation loop remains alive');
     // Exercise real visibility handlers with a labelled synthetic event;
     // this is not proof of OS/iPhone process suspension.
     await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
     await delay(250);
     await page.evaluate(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
     evidence.syntheticVisibilityResume=await snapshot();
     assert.equal(evidence.syntheticVisibilityResume.life.evolution.totalFrames,evidence.pending.life.evolution.totalFrames,'Visibility resume does not advance unready lifecycle');
     await page.screenshot({path:`${out}/${engine}-${mode}-pending.png`,fullPage:true});
     if(mode==='reject'){
      const retry=page.locator('.int-rh2-resident-assets--recovery [data-load-action="retry"]');await retry.waitFor({state:'visible'});
      evidence.retry=await retry.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inert:!!el.closest('[inert]'),hit:hit===el||el.contains(hit),rect:r.toJSON(),viewport:[innerWidth,innerHeight],z:getComputedStyle(el.parentElement).zIndex}});
      assert.equal(evidence.retry.inert,false);assert.equal(evidence.retry.hit,true);assert.ok(evidence.retry.rect.y>=0&&evidence.retry.rect.bottom<=evidence.retry.viewport[1]);
      mark('real-retry-click');allow=true;release();await retry.click();
     }else{allow=true;release();}
     await page.waitForFunction(()=>!__freezeApp.getRaisingLifecycleFrame().evolution&&__freezeScene.isPlayable===true);
     mark('native-evolution-completed');
     evidence.after=await snapshot();assert.deepEqual(evidence.after.residents,evidence.before.residents.map(r=>r.id===ownedId?{...r,speciesId:r.speciesId.replace(/species-\d+$/, 'species-035')}:r),'Same owned resident, no duplication/reset');assert.equal(evidence.after.life.message?.target,35);assert.equal(evidence.after.life.message?.kind,'EVOLVED');
     assert.equal(await page.locator('.int-rh2-field-host').evaluate(e=>e.inert),false);
     assert.equal(await page.locator('.int-rh2-resident-assets--recovery').isVisible(),false);
     // The production completion ceremony is a separate real UI owner.
     const ceremony=page.locator('.cm-ceremony[data-kind="evolve"]');
     await ceremony.waitFor({state:'visible'});await ceremony.tap();
     if(await ceremony.isVisible())await ceremony.tap();
     await ceremony.waitFor({state:'detached'});
     // Real browser pointer input after recovery, not a direct camera mutation.
     const canvas=page.locator('.int-rh2-field-host canvas').first();
     const box=await canvas.boundingBox();assert.ok(box&&box.width>0&&box.height>0);
     const cameraBefore=await page.evaluate(()=>__freezeScene.getDiagnostics().cameraX);
     await page.mouse.move(box.x+box.width*.7,box.y+box.height*.65);await page.mouse.down();
     await page.mouse.move(box.x+box.width*.25,box.y+box.height*.65,{steps:12});await page.mouse.up();
     await delay(100);const cameraAfter=await page.evaluate(()=>__freezeScene.getDiagnostics().cameraX);
     evidence.drag={cameraBefore,cameraAfter};assert.notEqual(cameraAfter,cameraBefore,'Recovered world responds to drag');
     const zoomBefore=await page.evaluate(()=>__freezeScene.getDiagnostics().zoom);
     await page.locator('.cm-ranch-zoom').click();
     const zoomAfter=await page.evaluate(()=>__freezeScene.getDiagnostics().zoom);
     evidence.zoom={zoomBefore,zoomAfter};assert.notEqual(zoomAfter,zoomBefore,'Recovered zoom button responds');
     await page.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').click();
     assert.ok(await page.locator('.cm-toolbar__menu:not([hidden])').isVisible(),'HUD toolbar is interactive after resume');
     await page.screenshot({path:`${out}/${engine}-${mode}-resumed.png`,fullPage:true});
     const storageAfter=await page.evaluate(()=>Object.keys(localStorage));
     evidence.writeKeys=await page.evaluate(()=>[...new Set(__freezeWrites)]);
     assert.deepEqual(storageAfter.filter(k=>!storageBefore.includes(k)),[],'No new save/migration key');
     assert.deepEqual(storageBefore.filter(k=>!storageAfter.includes(k)),[],'No deleted save/preference key');
     assert.deepEqual(evidence.writeKeys.filter(k=>!storageBefore.includes(k)),[],'Writes restricted to existing keys');
     await delay(300);const settled=await snapshot();
     assert.deepEqual(settled.residents,evidence.after.residents,'No duplicate lifecycle commit');
     assert.equal(settled.life.message?.instanceId,ownedId);
     assert.deepEqual(evidence.errors,[],'No page error through recovery interactions');
     const controlled=url=>mode==='reject'&&url&&targetPaths.has(new URL(url,base).pathname);
     assert.deepEqual(evidence.httpFailures.filter(x=>!(x.injected&&controlled(x.url)&&x.status===503&&x.method==='GET')),[],'No unrelated HTTP failure');
     assert.deepEqual(evidence.requestFailures.filter(x=>!(x.injected&&controlled(x.url)&&x.method==='GET')),[],'No unrelated request failure');
     assert.ok(evidence.httpFailures.length<=8*targetPaths.size,'Bounded controlled loader retries');
     assert.ok(evidence.requestFailures.length<=8*targetPaths.size,'Bounded controlled request failures');
     const expectedWarning=x=>mode==='reject'&&(
       x.text.startsWith('CHAMPIONSHIP_EVOLUTION_ART_FAILED 35:')&&[...targetPaths].some(p=>x.text.includes(p))||
       controlled(x.location?.url)&&/^Failed to load resource:.*503/.test(x.text));
     assert.deepEqual(evidence.console.filter(x=>!expectedWarning(x)),[],'No unrelated console warning/error');
     assert.ok(evidence.console.length<=10*targetPaths.size,'Bounded expected warnings');
     evidence.status='PASS_ACTUAL_APP_NATIVE_EVOLUTION_AND_RETRY';
    }
    mark(evidence.status);await save();results.push({mode,status:evidence.status});
   }catch(error){evidence.status='FAIL';evidence.failure=String(error);evidence.failureState=await snapshot().catch(()=>null);evidence.interceptedRequests=blocked;await page.screenshot({path:`${out}/${engine}-${mode}-failure.png`,fullPage:true}).catch(()=>{});await save();throw error;}
   finally{allow=true;release();await context.close();}
  }
  await fs.writeFile(`${out}/${engine}-summary.json`,JSON.stringify({status:'PASS',results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
