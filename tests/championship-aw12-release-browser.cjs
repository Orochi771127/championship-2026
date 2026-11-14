// Isolated QA save made through existing canonical profile builders. Real ranch,
// natural ticker and read-only observation; no gameplay/state/frame setters.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {hooks}=require('./championship-responsive-layout-browser.cjs');
const {login}=require('./championship-browser-opening.cjs');
const fast=process.env.AW32_FAST==='1';
const attackProbe=process.env.AW32_ATTACK==='1';
const aimDirection=process.env.AW32_DIRECTION||'D';const vectors={D:[0,1],DR:[1,1],R:[1,0],UR:[1,-1],U:[0,-1],UL:[-1,-1],L:[-1,0],DL:[-1,1]};
const out=path.resolve(process.env.AW32_OUTPUT||(attackProbe?'output/playwright/aw32-attack-r5':fast?'output/playwright/aw32-fast-r4':'output/playwright/aw32-natural')),base=process.env.AW32_BASE||'http://127.0.0.1:8776';
fs.mkdirSync(out,{recursive:true});
const report={origin:base,scope:['main:2','main:3'],naturalTicker:true,reducedMotion:false,technicalAccepted:false,errors:[],missing:[],samples:[]};
const flush=()=>fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(report,null,2)+'\n');
async function seed(){
 const [save,identity,raising,capture,sources,profile]=await Promise.all([
 import('../src/championship/app/championshipStandaloneSave.js'),import('../src/championship/raising/raisingInstanceIdentity.js'),
 import('../src/championship/app/championshipRaisingProduction.js'),import('../src/championship/hunt/capture/nativeHuntIndividual.js'),
 import('../src/championship/hunt/capture/nativeHuntSources.js'),import('../src/championship/raising/nativeIndividualProfile.js')]);
 const b=save.deserializeChampionshipModernSave(fs.readFileSync('qa/championship-full-qa-save.json','utf8'));
 const assigned=identity.allocateRaisingInstanceIdentity(b.instanceIdentity,{creature:b.creature,residents:JSON.parse(b.raisingHome).payload?.residents??[],collection:b.raising.collection,assignments:b.raising.assignments,interactions:b.raising.interactions});
 const burst=await import('../src/championship/contracts/productBurstEvolution.js');
 assert.ok(burst.burstFormsFor(76).some(f=>f.form===144));
 const species=sources.nativeHuntSpeciesByIndex(76);assert.ok(species);
 const nativeProfile=profile.nativeIndividualProfile(capture.createNativeHuntIndividual({species,rng:{next:()=>7},traitOverride:fast?2:-1,nameOverride:'AW12 QA'}),'species-076');
 let next=raising.recordEnclosedCreature(b.raising,{instanceId:assigned.instanceId,speciesId:'species-076',displayName:'AW12 QA',enclosedAt:'2026-11-09T00:00:00.000Z',originGateId:null,cageId:null});
 next={...next,collection:next.collection.map(e=>e.instanceId===assigned.instanceId?{...e,successAuthority:'QA_FULL_SAVE_FIXTURE',nativeProfile}:e)};
 report.instanceId=assigned.instanceId;
 const learned=burst.learnAwakening(burst.normalizeBurstEvolution(b.progression.burstEvolution),assigned.instanceId,144);
 const appearance=burst.setAwakeningAppearance(learned,assigned.instanceId,144);assert.ok(appearance);
 report.fixture={canonicalBase:76,learnedAppearance:144,traitOverride:fast?2:null,authority:'ISOLATED_QA_FIXTURE_NOT_PLAYER_PROGRESSION'};
 return save.serializeChampionshipModernSave(save.createChampionshipModernSave({...b,raisingHomeSerialized:b.raisingHome,raising:next,instanceIdentity:assigned.state,progression:{...b.progression,burstEvolution:appearance}}));
}
(async()=>{
 const fixture=await seed(),browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'video'),size:{width:1366,height:768}}}),page=await context.newPage();page.setDefaultTimeout(45000);
 page.on('console',m=>{if(m.type()==='error'){(report.consoleErrors??=[]).push(m.text());flush();}});
 page.on('requestfailed',r=>{(report.requestFailures??=[]).push({url:r.url(),error:r.failure()});flush();});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push({url:r.url(),status:r.status()})});
 await context.addInitScript(seed=>{localStorage.setItem('championshipModernSave:v1',seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:'zh-Hant',muted:true,reducedMotion:'off'}));},fixture);
 const dependencyRoot=path.resolve('node_modules/three');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dependencyRoot,'package.json'))).version,JSON.parse(fs.readFileSync('package-lock.json')).packages['node_modules/three'].version);
 report.dependencySource={three:dependencyRoot,version:'0.185.1',lockMatched:true};
 await context.route('**/*',async route=>{
  const url=route.request().url();if(!url.startsWith(base+'/'))return route.continue();
  if(url.startsWith(base+'/node_modules/three/')){const rel=new URL(url).pathname.slice('/node_modules/three/'.length);assert.ok(!rel.includes('..'));return route.fulfill({path:path.join(dependencyRoot,rel),contentType:rel.endsWith('.wasm')?'application/wasm':'text/javascript'});}
  if(!new URL(url).pathname.endsWith('.js'))return route.continue();
  const r=await route.fetch();let body=hooks(await r.text());
  if(url.includes('/reviewedCharacterLoader.js'))body=body.replace('return Object.freeze({...bundle,reviewedAnimation:document,createActor(options={}){',`if(document.displayCode==='AW12'){(globalThis.__aw12Loaded??={})[usage]={PIXI,textures,geometry,document};} return Object.freeze({...bundle,reviewedAnimation:document,createActor(options={}){`);
  if(url.includes('/reviewedCharacterLoader.js'))body=body.replace('if(sampled)current={...native,...sampled};',`if(sampled)current={...native,...sampled};
   if(document.displayCode==='AW12'&&sampled){const rows=globalThis.__aw12Atomic??=[];if(rows.length<10000)rows.push({sequence:frame.sequenceId,nativeIndex:frame.frameIndex,elapsedQ12:frame.elapsedQ12,visualIndex:sampled.frameIndex,assetId:sampled.assetId,ticks});}`);

  if(attackProbe&&url.includes('/dataArenaPixiScene.js')){
   body=body.replace('reviewedSample=sample;',`reviewedSample=sample;
    if(sample.assetId?.startsWith('aw12-r6-')){const trace=globalThis.__aw32AnimationTrace??=[];if(trace.length<3000)trace.push({time:state.time,assetId:sample.assetId,frameIndex:sample.frameIndex,actionId:sample.actionId,phase:sample.phase,direction:sample.direction,release:sample.release,geometry:sample.geometry,position:[body.x,body.y]});}`);
   body=body.replace('const point = casterView(event.casterId)?.releasePoint(event.angle,event);',`const point = casterView(event.casterId)?.releasePoint(event.angle,event);
    const probeView=casterView(event.casterId),probeSprite=probeView?.sprite;
    const trace=globalThis.__aw32ReleaseTrace??=[];if(trace.length<1000)trace.push({event:{...event},point,playerSpecies:state.player.speciesId,renderScale:probeSprite?[probeSprite.scale.x,probeSprite.scale.y]:null,renderPosition:probeSprite?[probeView.container.x+probeSprite.x,probeView.container.y+probeSprite.y]:null});`);
  }
  await route.fulfill({response:r,body});
 });
 try{
  await page.goto(base+'/championship.html?arenaQa=1',{waitUntil:'domcontentloaded'});await login(page);await page.locator('#cm-continue').click();
  await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready'&&globalThis.__qaRaising);
  await page.waitForFunction(id=>__qaRaising.actors.has(id),report.instanceId);
  const captured=new Set();
  for(let i=0;i<(fast?900:320);i++){
   const s=await page.evaluate(id=>{const e=__qaRaising.actors.get(id),a=e.actor??e,s=a.sprite??e.sprite;return {time:performance.now(),native:__qaRaising.source.getActorFrame(id),entryKeys:Object.keys(e),presenter:a.nativeFramePresenter?.getSnapshot?.()??a.controller?.getSnapshot?.(),sprite:s?{x:s.x,y:s.y,scale:[s.scale.x,s.scale.y],anchor:[s.anchor.x,s.anchor.y],textureSize:[s.texture?.orig?.width,s.texture?.orig?.height],bounds:s.getBounds().rectangle}:null,root:[e.root?.x,e.root?.y]};},report.instanceId);
   report.samples.push(s);
   if(s.native?.sequenceId===(fast?3:2)&&s.presenter?.assetId?.startsWith('aw12-r6-')&&!captured.has(s.presenter.assetId)){captured.add(s.presenter.assetId);await page.screenshot({path:path.join(out,s.presenter.assetId+'.png')});flush();}
   if(captured.size>=2&&report.samples.filter(s=>s.native?.sequenceId===(fast?3:2)&&s.presenter?.assetId?.startsWith('aw12-r6-')).length>=(fast?12:35))break;
   await page.waitForTimeout(100);
  }
  const generalOverlay=await page.evaluate(()=>{
 const q=__aw12Loaded.general,{PIXI}=q,root=new PIXI.Container(),poses=[];let i=0;
 for(const [id,texture] of q.textures){const g=q.geometry.get(id),x=(i%8)*180+90,y=Math.floor(i/8)*180+140;
 const sprite=new PIXI.Sprite(texture);sprite.anchor.set(g.origin[0]/480,g.origin[1]/480);sprite.scale.set(2/g.scale);sprite.position.set(x,y);root.addChild(sprite);
 const cross=new PIXI.Graphics().moveTo(x-5,y).lineTo(x+5,y).moveTo(x,y-5).lineTo(x,y+5).stroke({color:0xff3333,width:1});root.addChild(cross);
 const label=new PIXI.Text({text:id.split('-').at(-1),style:{fontSize:13,fill:0xffffff}});label.position.set(x-70,y-130);root.addChild(label);poses.push({id,origin:g.origin,density:g.scale});i++;}
 const canvas=__qaRaising.stage.app.renderer.extract.canvas({target:root,frame:new PIXI.Rectangle(0,0,1440,Math.ceil(i/8)*180),resolution:1});const result={poses,data:canvas.toDataURL('image/png')};root.destroy({children:true});return result;});
 fs.writeFileSync(path.join(out,'general-all-poses.png'),Buffer.from(generalOverlay.data.split(',')[1],'base64'));report.generalOverlay=generalOverlay.poses;
 report.capturedAssets=[...captured];report.dom=await page.locator('.int-rh2-field-host').getAttribute('data-resident-assets');
  await page.screenshot({path:path.join(out,'desktop.png')});
  for(const [width,height] of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(600);await page.screenshot({path:path.join(out,`${width}x${height}.png`)});}
  report.movingSamples=report.samples.filter(s=>s.presenter?.assetId?.startsWith('aw12-r6-')).length;
  report.positionCount=new Set(report.samples.map(s=>JSON.stringify(s.native?.positionQ12))).size;
  report.fastSamples=report.samples.filter(s=>s.native?.sequenceId===3&&s.presenter?.assetId?.startsWith('aw12-r6-')).length;report.atomic=await page.evaluate(()=>globalThis.__aw12Atomic??[]);report.observationComplete=true;assert.ok(captured.size>=2,'AW12 animated poses observed');assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);flush();console.log(JSON.stringify({assets:report.capturedAssets,movingSamples:report.movingSamples,positionCount:report.positionCount,errors:report.errors,missing:report.missing.length}));
  if(process.env.AW32_ARENA==='1'){
   await page.setViewportSize({width:1366,height:768});
   await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="battle"]').click();await page.locator('#cm-data-arena').click();
   await page.locator('.da-mode[data-mode="RELAY"]').click();
   report.arenaSelect=await page.locator('button[data-partner]').evaluateAll(es=>es.map(e=>({class:e.className,id:e.dataset.partner,disabled:e.disabled,text:e.textContent.slice(0,120)})));flush();
   const target=page.locator('button[data-partner="relay-species-076"]').last();await target.click();
   await page.locator('.da-panel--select .da-btn--primary').click();await page.locator('.da-panel--brief .da-btn--primary').click();
   await page.waitForFunction(()=>__dataArenaQA.state()==='PLAY');
   report.arenaSamples=[];const arenaAssets=new Set(),arenaFrames=new Set();
   for(let i=0;i<(attackProbe?360:120);i++){
    const s=await page.evaluate(()=>({state:__dataArenaQA.state(),snapshot:__dataArenaQA.snapshot(),diagnostics:__dataArenaQA.diagnostics()}));report.arenaSamples.push(s);
    const ready=page.locator('button[data-burst="READY"]:visible').first();if(await ready.count())await page.keyboard.press('KeyB');
    const anim=s.diagnostics.scene?.playerAnimation;
    if(anim?.reviewed?.assetId?.startsWith('aw12-r6-A')){
     const asset=anim.reviewed.assetId;arenaFrames.add(anim.frameIndex);
     if(!arenaAssets.has(asset)){arenaAssets.add(asset);await page.screenshot({path:path.join(out,asset+'.png')});}
     report.arenaObservedNew=true;report.arenaAssets=[...arenaAssets];report.arenaEventIndices=[...arenaFrames];
     if(!attackProbe&&arenaAssets.size>=3&&arenaFrames.size>=4){await page.keyboard.up('ArrowDown');break;}
    }
    if(s.state!=='PLAY')break;
    if(attackProbe&&s.snapshot.relay?.burst?.phase==='BURST'){
     await page.keyboard.up('ArrowDown');await page.keyboard.up('ArrowUp');
     const aim=await page.evaluate(v=>{const p=__dataArenaQA.snapshot().player;return __dataArenaQA.worldToScreen(p.x+v[0]*130,p.y+v[1]*130);},vectors[aimDirection]);
     if(aim)await page.mouse.move(aim.x,aim.y);
     // AW12's existing own-344 NOVA skill exercises the actual ranged caller;
     // this probe does not invent a new move or change its gameplay timing.
     if(s.snapshot.player.speciesId==='species-144'&&s.snapshot.time-s.snapshot.relay.burst.startedAt>1.3&&s.snapshot.kit?.moves?.[1]?.ready&&!s.snapshot.kit?.casting)await page.keyboard.press('3');
     const trace=await page.evaluate(()=>({animation:globalThis.__aw32AnimationTrace??[],release:globalThis.__aw32ReleaseTrace??[]}));report.attackTrace=trace;report.requestedDirection=aimDirection;
     if(anim?.reviewed?.assetId?.startsWith('aw12-r6-')&&!arenaAssets.has(anim.reviewed.assetId)){arenaAssets.add(anim.reviewed.assetId);await page.screenshot({path:path.join(out,anim.reviewed.assetId+'.png')});}
     if(trace.animation.some(x=>x.phase==='WINDUP')&&trace.animation.some(x=>x.phase==='RELEASE'&&x.frameIndex===4)&&trace.animation.some(x=>x.frameIndex>=10)){await page.keyboard.up('j');report.attackObserved=true;break;}
     await page.waitForTimeout(30);
    }
    else if(s.snapshot.relay?.burst?.phase==='BURST'){await page.keyboard.down('ArrowDown');await page.waitForTimeout(100);}
    else {const key=i%16<8?'ArrowUp':'ArrowDown';await page.keyboard.down(key);await page.waitForTimeout(250);await page.keyboard.up(key);await page.waitForTimeout(250);}
    if(i%10===0)flush();
   }
   report.headingChecks=[];
   for(const [heading,keys] of Object.entries({D:['ArrowDown'],DR:['ArrowDown','ArrowRight'],R:['ArrowRight'],UR:['ArrowUp','ArrowRight'],U:['ArrowUp'],UL:['ArrowUp','ArrowLeft'],L:['ArrowLeft'],DL:['ArrowDown','ArrowLeft']})){
    for(const key of keys)await page.keyboard.down(key);
    const rows=[];for(let i=0;i<14;i++){await page.waitForTimeout(50);rows.push(await page.evaluate(()=>({snapshot:__dataArenaQA.snapshot(),animation:__dataArenaQA.diagnostics().scene?.playerAnimation})));}
    for(const key of keys)await page.keyboard.up(key);
    report.headingChecks.push({heading,rows});await page.screenshot({path:path.join(out,'heading-'+heading+'.png')});flush();
   }
   const arenaOverlay=await page.evaluate(()=>{
 const q=__aw12Loaded.arena,{PIXI}=q,root=new PIXI.Container(),poses=[];let i=0;
 for(const [id,texture] of q.textures){const g=q.geometry.get(id),x=(i%8)*180+90,y=Math.floor(i/8)*180+140;
 const sprite=new PIXI.Sprite(texture);sprite.anchor.set(g.origin[0]/480,g.origin[1]/480);sprite.scale.set(78/g.referenceHeight/g.scale);sprite.position.set(x,y);root.addChild(sprite);
 const cross=new PIXI.Graphics().moveTo(x-5,y).lineTo(x+5,y).moveTo(x,y-5).lineTo(x,y+5).stroke({color:0xff3333,width:1});root.addChild(cross);
 const label=new PIXI.Text({text:id.split('-').at(-1),style:{fontSize:13,fill:0xffffff}});label.position.set(x-70,y-130);root.addChild(label);poses.push({id,origin:g.origin,density:g.scale,referenceHeight:g.referenceHeight});i++;}
 const canvas=__qaRaising.stage.app.renderer.extract.canvas({target:root,frame:new PIXI.Rectangle(0,0,1440,Math.ceil(i/8)*180),resolution:1});const result={poses,data:canvas.toDataURL('image/png')};root.destroy({children:true});return result;});
 fs.writeFileSync(path.join(out,'arena-all-poses.png'),Buffer.from(arenaOverlay.data.split(',')[1],'base64'));report.arenaOverlay=arenaOverlay.poses;
 assert.ok(arenaOverlay.poses.every(p=>Math.abs(p.referenceHeight-200/7.6)<1e-8),'renderer consumes the calibrated constant reference height');
 for(const [width,height] of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(300);await page.screenshot({path:path.join(out,`arena-${width}x${height}.png`)});}
 report.actualEvents=await page.evaluate(()=>__dataArenaQA.events());
   await page.screenshot({path:path.join(out,'arena-last.png')});flush();console.log('ARENA',report.arenaObservedNew??false);
   if(attackProbe){assert.ok(report.attackObserved,'AW12 authored attack display must start offensive pose4 on actual CAST_RELEASE and recover');assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);}
  }
 }catch(e){report.failure=String(e);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});flush();throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

