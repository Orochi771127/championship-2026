// Execute only inside an authorized repo browser-QA environment after applying overlay.
// Uses the existing owned-party fixture and actual PIXI/runtime/presenters; no mock renderer.
import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base=process.argv[2],prefix=process.argv[3],out=process.argv[4]??'qa034-density8';
assert.ok(base&&prefix,'Usage: node renderer-review.mjs BASE_URL ASSET_PREFIX OUTPUT_DIR');
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1060,height:760}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);
 const network=[];page.on('response',response=>{if(/runtime\.review\.json|\/(main|sub)\.(png|webp|json)/.test(response.url()))network.push({url:response.url(),status:response.status()})});
 const result=await page.evaluate(async({prefix,base})=>{
  const PIXI=await import('/node_modules/pixi.js/dist/pixi.mjs');
  const {loadPixiCharacterRuntimeBundle}=await import('/src/championship/presentation/pixiCharacterRuntimeBundle.js');
  const {applyNativeCharacterCellGeometry}=await import('/src/championship/presentation/nativeHuntCharacterAction.js');
  const {completedCharacterBundleLocation}=await import('/src/championship/presentation/completedOriginalCharacters.js');
  const selection=await (await fetch('/src/data/championship/accepted-original-character-selection.r1.json')).json();
  const config=selection.characters.find(c=>c.speciesId==='species-034');
  const route=completedCharacterBundleLocation(config,{battleAtlas:true,sides:['main']},base);
  const expectedRuntimeUrl=new URL(prefix+'runtime.review.json',base).href;
  const publicGameUrl='https://orochi771127.github.io/championship-2026/championship.html';
  const publicRoute=completedCharacterBundleLocation(config,{battleAtlas:true,sides:['main']},publicGameUrl);
  if(publicRoute.packed||publicRoute.runtimeUrl!==new URL(prefix+'runtime.review.json',publicGameUrl).href)throw Error('PUBLIC_SUBPATH_ROUTE_REGRESSION');
  const fixtureRelativeRoute=completedCharacterBundleLocation(config,{battleAtlas:true,sides:['main']},location.href);
  if(route.packed||route.runtimeUrl!==expectedRuntimeUrl)throw Error('STALE_OR_UNEXPECTED_RUNTIME_ROUTE');
  // Fixture documents are nested; assetRoot is app-relative, never fixture-relative.
  if(new URL(location.href).pathname.includes('/tests/fixtures/')&&fixtureRelativeRoute.runtimeUrl===expectedRuntimeUrl)throw Error('FIXTURE_BASE_REGRESSION_NOT_EXERCISED');
  const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl:route.runtimeUrl,cachePrefix:'034-density8-qa:'});
  const app=new PIXI.Application();await app.init({width:1040,height:1400,background:0x18212d,autoStart:false});document.body.replaceChildren(app.canvas);let frames=0,sequences=0;const failures=[],covered=new Set();
  for(const side of ['main','sub'])for(const sequence of bundle.runtime.sides[side].animations){
   const actor=bundle.createActor({side,animation:sequence.id,nativeSequence:true,nativeFramePresentation:true,nativeGeometry:bundle.runtime.reviewGeometry,battleGeometry:bundle.runtime.reviewGeometry});app.stage.addChild(actor.sprite);actor.sprite.position.set(300,400);
   for(const [index,frame] of sequence.frames.entries()){
    covered.add(frame.texture);if(actor.sequencePlayer.getSnapshot().cell!==frame.cell)failures.push('timeline '+side+'/'+sequence.id+'/'+index);
    const projected=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:sequence.id,frameIndex:index,flipBits:0});
    const battle=actor.battleAnimator.apply({battleFrame:frames,sequenceId:sequence.id,nativeRequest:true,nativeSample:{sequenceId:sequence.id,frameIndex:index,cell:frame.cell,active:1,elapsedQ12:0,playMode:sequence.playbackMode}});
    if(projected.cell!==frame.cell||battle.cell!==frame.cell)failures.push('projection');
    for(const zoom of [2,4,6]){applyNativeCharacterCellGeometry(actor.sprite,{geometry:projected.geometry},zoom);if(projected.geometry.scale!==8||actor.sprite.scale.x!==zoom*actor.sprite.texture.source.resolution/8||actor.sprite.anchor.x!==.4375||actor.sprite.anchor.y!==.640625)failures.push('native scale/origin');app.render();}
    for(let t=0;t<frame.ticks;t++)actor.sequencePlayer.advanceNative(4096);frames++;
   }actor.sprite.destroy();sequences++;
  }
  // Real sprite screenshot grid: three native zooms, idle/walk/eat current legacy actions.
  for(const [row,pose] of [[0,0],[0,1],[2,0],[2,1],[14,0],[14,1]].entries())for(const [col,zoom] of [2,4,6].entries()){const [id,frameIndex]=pose;
   const actor=bundle.createActor({side:'main',animation:id,nativeFramePresentation:true,nativeGeometry:bundle.runtime.reviewGeometry});const p=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:id,frameIndex,flipBits:0});applyNativeCharacterCellGeometry(actor.sprite,{geometry:p.geometry},zoom);actor.sprite.position.set(170+col*330,180+row*210);app.stage.addChild(actor.sprite);
  }app.render();return {frames,sequences,coveredCells:covered.size,route,routeRegression:{appBase:base,publicGameUrl,publicRuntimeUrl:publicRoute.runtimeUrl,fixtureUrl:location.href,expectedRuntimeUrl,fixtureRelativeRuntimeUrl:fixtureRelativeRoute.runtimeUrl},failures,diagnostics:bundle.getDiagnostics(),zoomColumns:[2,4,6],actionFrameRows:[[0,0],[0,1],[2,0],[2,1],[14,0],[14,1]],disclaimer:'Real isolated runtime renderer, not normal-game navigation acceptance'};
 },{prefix,base});
 await page.screenshot({path:out+'/actual-pixi-2x-4x-6x.png',fullPage:true});assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);assert.equal(result.diagnostics.textureCount,83);assert.equal(result.coveredCells,83);assert.equal(result.sequences,53);assert.ok(network.some(n=>n.url.endsWith('/'+prefix+'main.png')&&n.status===200));assert.ok(network.some(n=>n.url.endsWith('/'+prefix+'sub.png')&&n.status===200));assert.ok(!network.some(n=>n.url.includes('battle-packed-20261013')));
 const huntScene=await isolatedHuntSceneSmoke(browser,base,prefix,out);
 const normalGame=await normalOwnedPartySmoke(browser,base,prefix,out);
 await fs.writeFile(out+'/renderer-result.json',JSON.stringify({status:'PASS_ISOLATED_ACTUAL_PIXI_RUNTIME',...result,network,pageErrors:errors,normalGameNavigation:normalGame.status,huntSceneScope:huntScene.scope},null,2));
}catch(error){await fs.writeFile(out+'/renderer-failure.json',JSON.stringify({status:'FAIL',error:String(error),pageErrors:errors},null,2));await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close()}

// Existing controlled fixture only; all later input uses ordinary production UI.
// No real profile, save edits, synthetic game ticks or production debug additions.
async function normalOwnedPartySmoke(browser,base,prefix,out){
 const url=new URL(base);assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Controlled QA requires loopback');
 const game=await browser.newPage({viewport:{width:1280,height:900},locale:'zh-TW'});game.setDefaultTimeout(90000);
 const evidence={status:'RUNNING',fixture:'tests/fixtures/championship-owned-party.html#prepare-practice',network:[],errors:[],scenes:[],huntNormal034:'NOT_COVERED_NO_GUARANTEED_WILD_SPAWN_FIXTURE'};let scene='fixture';
 game.on('response',r=>{if(r.url().includes('/m201_agumon'))evidence.network.push({scene,url:r.url(),status:r.status()})});
 game.on('pageerror',e=>evidence.errors.push(e.message));game.on('console',m=>{if(/FALLBACK|CHARACTER_REVIEW_FAILED|CANDIDATE_.*DRIFT/.test(m.text()))evidence.errors.push(m.text())});
 const save=()=>fs.writeFile(out+'/normal-game-result.json',JSON.stringify(evidence,null,2));
 const screen=async name=>game.locator(`#cm-root[data-active-screen="${name}"]`).waitFor();
 async function home(){await screen('RAISING_HOME');await game.waitForFunction(()=>{const h=document.querySelector('.int-rh2-field-host'),a=JSON.parse(h?.dataset.residentAssets||'[]');return h?.dataset.loadState==='ready'&&a.some(x=>x.speciesId==='species-034'&&x.entityId==='m201_agumon'&&x.state==='ready')},{},{timeout:180000});assert.equal(await game.locator('[data-field-fallback="true"],.int-rh2-field-fallback').count(),0);}
 async function menu(entry){await game.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').click();await game.locator(`.cm-toolbar__menu:not([hidden]) [data-entry-id="${entry}"]`).click();}
 try{
  await game.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);await game.locator('#prepare-practice').click();await game.locator('#status').filter({hasText:'受控存檔已準備'}).waitFor();
  scene='raising';await game.goto(new URL('championship.html?presentation=developer&battleFxDebug',base).href);await game.locator('#cm-login').waitFor();
  if(await game.locator('#cm-film-skip').isVisible()){await game.locator('#cm-film-skip').click();await game.locator('#cm-opening-film').waitFor({state:'hidden'});await game.waitForTimeout(400);}
  await game.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await game.locator('#cm-login').click();await game.locator('#cm-continue').click();await home();
  await game.waitForFunction(()=>JSON.parse(document.querySelector('.int-rh2-field-host')?.dataset.residentScreenPositions||'[]').some(p=>p.speciesIndex===34));
  const raising=await game.locator('.int-rh2-field-host').evaluate(h=>({assets:JSON.parse(h.dataset.residentAssets),positions:JSON.parse(h.dataset.residentScreenPositions)}));
  for(const p of raising.positions.filter(p=>p.speciesIndex===34)){assert.ok(p.nativeScreenPixels>0&&Number.isFinite(p.bodyTop)&&p.footY>p.bodyTop);assert.ok(p.groundScreen&&Math.abs(p.groundScreen.y-(p.boardTop+p.nativeY*p.nativeScreenPixels))<1,'Shared native ground transform');}
  for(const asset of ['runtime.review.json','main.png'])assert.ok(evidence.network.some(n=>n.scene==='raising'&&n.url===new URL(prefix+asset,base).href&&n.status===200),'Raising new '+asset);
  assert.ok(!evidence.network.some(n=>n.scene==='raising'&&n.url.includes('battle-packed')));evidence.scenes.push({scene:'raising',entry:'PASS',diagnostics:raising,groundShadow:'SCREENSHOT_REVIEW_REQUIRED'});await game.screenshot({path:out+'/normal-raising034.png',fullPage:true});await save();
  scene='battle';await menu('battle');await screen('BATTLE_SELECT');assert.equal(await game.locator('.int-rh2-field-host').count(),0,'Raising scene released');
  await game.locator('[data-face-id="PRACTICE_BATTLE"]:visible').first().click();
  const members=game.locator('.cm-vs5-practice-member');await members.nth(1).waitFor();await members.nth(0).getByRole('button',{name:/A 隊$/}).click();await members.nth(1).getByRole('button',{name:/B 隊$/}).click();await game.getByRole('button',{name:'開始練習',exact:true}).click();await screen('BATTLE_FIELD');
  await game.waitForFunction(()=>{const d=globalThis.__championshipBattleDiagnostics?.();return d?.characters?.some(c=>c.speciesId==='species-034'&&c.rendered&&c.animation?.geometry?.scale===8)},{},{timeout:180000});
  const battle=await game.evaluate(()=>globalThis.__championshipBattleDiagnostics());const fighters=battle.characters.filter(c=>c.speciesId==='species-034');assert.equal(fighters.length,2);
  for(const c of fighters){assert.equal(c.entityId,'m201_agumon');assert.equal(c.rendered,true);assert.equal(c.nativeSizing.packedPixelsPerNativePixel,8);assert.equal(c.animation.geometry.scale,8);assert.deepEqual(c.animation.geometry.origin,[224,328]);assert.deepEqual(c.animation.geometry.sourceSize,[512,512]);}
  assert.ok(battle.groundShadows,'Actual battle shadow diagnostics required');assert.equal(await game.locator('[data-field-fallback="true"]').count(),0);
  // Same-document PIXI cache may reuse Raising's verified atlas without another GET.
  assert.ok(evidence.network.some(n=>n.url===new URL(prefix+'main.png',base).href&&n.status===200));assert.ok(!evidence.network.some(n=>n.url.includes('/battle-packed-20261013/m201_agumon/')));
  evidence.scenes.push({scene:'battle',entry:'PASS',diagnostics:battle,textureBinding:'same-document cache or new request; exact entity, density8 geometry, no packed route',groundShadow:'DIAGNOSTICS_AND_SCREENSHOT_REVIEW_REQUIRED'});await game.screenshot({path:out+'/normal-battle034.png',fullPage:true});await save();
  await game.getByRole('button',{name:'離開對戰',exact:true}).first().click();const dialog=game.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('button',{name:'離開對戰',exact:true}).click();await home();
  assert.equal(await game.evaluate(()=>typeof globalThis.__championshipBattleDiagnostics),'undefined','Battle diagnostics disposed on exit');await game.screenshot({path:out+'/normal-return-raising034.png',fullPage:true});
  evidence.scenes.push({scene:'raising-return',entry:'PASS',battleExit:'PASS'});assert.deepEqual(evidence.errors,[]);evidence.status='PASS_CONTROLLED_NORMAL_RAISING_BATTLE';await save();return evidence;
 }catch(error){evidence.status='FAIL';evidence.error=String(error);await save();await game.screenshot({path:out+'/normal-game-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await game.close();}
}

// Same isolated static-world review contract as hunt-measured-contact-review.mjs.
// This exercises the real Hunt scene, not random-spawn/normal Hunt gameplay.
async function isolatedHuntSceneSmoke(browser,base,prefix,out){
 const review=await browser.newPage({viewport:{width:1000,height:700}}),network=[];review.on('response',r=>{if(r.url().includes('/m201_agumon'))network.push({url:r.url(),status:r.status()})});
 try{await review.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);
 const evidence=await review.evaluate(async({base,prefix})=>{
  const PIXI=await import('/node_modules/pixi.js/dist/pixi.mjs');
  const {createChampionshipPixiStage}=await import('/src/championship/presentation/championshipPixiStage.js');
  const {mountHuntFieldPixiPresentation}=await import('/src/championship/presentation/vs2/createHuntFieldPixiPresentation.js');
  const {loadCompletedOriginalCharacters}=await import('/src/championship/presentation/completedOriginalCharacters.js');
  const {LICENSED_CHARACTER_MANIFEST}=await import('/src/championship/presentation/licensedCharacterRoster.js');
  const {huntContactShadow}=await import('/src/championship/presentation/vs2/huntContactShadow.js');
  const read=async p=>{const r=await fetch(new URL(p,base));if(!r.ok)throw Error('INPUT_MISSING:'+p);return r.json()};
  const roster=await loadCompletedOriginalCharacters({PIXI,speciesIds:['species-034'],manifest:await read(LICENSED_CHARACTER_MANIFEST),productionIndex:await read('assets/production/ART_PRODUCTION_INDEX.json'),manifestUrl:new URL(LICENSED_CHARACTER_MANIFEST,base).href},new URL('championship.html',base).href);
  const loaded=roster.getDiagnostics().completedOriginalArt;if(!loaded.loaded.includes('m201_agumon')||loaded.failures.length)throw Error('HUNT_SELECTED_ADAPTER_FAILED');
  const host=document.createElement('div');host.style.cssText='width:980px;height:650px';document.body.replaceChildren(host);const shared=await createChampionshipPixiStage({PIXI,canvasHost:host,resolutionCap:1,antialias:false});shared.app.stop();const baselineTicker=shared.app.ticker.count;let root;
  const stage={...shared,createSceneRoot(label){root=shared.createSceneRoot(label);return root;}};
  const wilds=[0,1].map(i=>({wildId:'qa034-'+i,speciesId:'species-034',worldX:90+i*130,worldY:100,worldZ:0,facing:i?'left':'right',nativeAnimation:{contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:0,frameIndex:0,flipBits:i}}));
  const view={gateId:'isolated034-contact',worldWidthPx:2048,worldHeightPx:2048,transform:{scale:3},camera:{left:0,top:0},visibleChunks:[],objects:[],player:{worldX:0,worldY:0,facing:'right'},wildCreatures:wilds,selectedWildId:null};
  const scene=await mountHuntFieldPixiPresentation({stage,source:{field:{tick(){},getView:()=>view},intents:{panCamera(){},selectWildAt(){},abortEnclosureStroke(){}}},characterBundle:roster});
  const descendants=n=>[n,...(n.children??[]).flatMap(descendants)];const actors=descendants(root).filter(n=>n.label==='wild creature'),samples=[];
  for(const sequenceId of [0,2])for(const frameIndex of [0,1])for(const height of [0,3]){
   wilds.forEach((w,i)=>{w.worldZ=height;w.nativeAnimation={...w.nativeAnimation,sequenceId,frameIndex}});scene.render();shared.app.renderer.render(shared.app.stage);
   for(const [i,n] of actors.entries()){const frame=n.nativeFramePresenter.getSnapshot(),contact=huntContactShadow('species-034',frame,height,n.contactShadowArt);if(!contact||n.contactShadow.y!==contact.localY||n.contactShadow.scale.y!==contact.scaleY||frame.geometry.scale!==8||n.characterSprite.scale.x!==2*n.characterSprite.texture.source.resolution/8||n.characterSprite.anchor.x!==.4375||n.characterSprite.anchor.y!==.640625)throw Error('HUNT_SCALE_PIVOT_OR_CONTACT');samples.push({sequenceId,frameIndex,height,flip:i,geometry:frame.geometry,contact,shadowY:n.contactShadow.y,bodyY:n.y});}
  }
  wilds.forEach(w=>{w.worldZ=0;w.nativeAnimation={...w.nativeAnimation,sequenceId:0,frameIndex:0}});scene.render();shared.app.renderer.render(shared.app.stage);
  globalThis.__qa034Dispose=async()=>{scene.dispose();await roster.dispose();const d={ticker:shared.app.ticker.count,baselineTicker,rootDestroyed:root.destroyed};shared.destroy();return d;};
  return {scope:'ISOLATED_ACTUAL_HUNT_SCENE_NOT_NORMAL_SPAWN',samples,roster:loaded};
 },{base,prefix});
 await review.screenshot({path:out+'/isolated-hunt034-contact.png',fullPage:true});const disposal=await review.evaluate(()=>globalThis.__qa034Dispose());assert.equal(disposal.ticker,disposal.baselineTicker);assert.equal(disposal.rootDestroyed,true);assert.ok(network.some(n=>n.url===new URL(prefix+'main.png',base).href&&n.status===200));await fs.writeFile(out+'/isolated-hunt034-result.json',JSON.stringify({status:'PASS_ISOLATED_HUNT_SCENE',...evidence,disposal,network},null,2));return evidence;
 }finally{await review.close();}
}
