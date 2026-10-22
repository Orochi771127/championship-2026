// Execute only inside an authorized repo browser-QA environment after applying overlay.
// Uses the existing owned-party fixture and actual PIXI/runtime/presenters; no mock renderer.
import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const base=process.argv[2],prefix=process.argv[3],out=process.argv[4]??'qa034-clarity-trial';
// Independently frozen trial expectations, not values inferred from rendered output.
const EXPECTED_PREFIX='assets/production/characters/accepted-20261010/m201_agumon-clarity-trial-20261021-r01/';
assert.equal(prefix,EXPECTED_PREFIX,'Exact trial source route');
assert.ok(base&&prefix,'Usage: node renderer-review.mjs BASE_URL ASSET_PREFIX OUTPUT_DIR');
const publicCatalog=JSON.parse(await fs.readFile('src/data/championship/public-character-catalog.v1.json','utf8'));
const publicConfig=publicCatalog.characters.find(c=>c.entityId==='m201_agumon');assert.ok(publicConfig);
assert.equal(publicConfig.density,4);assert.deepEqual(publicConfig.logicalCanvas,[64,64]);assert.deepEqual(publicConfig.origin,[28,41]);
assert.equal(publicConfig.runtimePath,EXPECTED_PREFIX+'ranch-streaming-v1/ab20986d3006da84/runtime.render.json');
assert.equal(publicConfig.runtimeSha256,'5120d252e8bdc64eeb62357d4a140f3225dc46ddca40351f1c6f12ff3cd3d0d6');
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.CHAMPIONSHIP_CHROME?{executablePath:process.env.CHAMPIONSHIP_CHROME}: {})});const page=await browser.newPage({viewport:{width:1060,height:760}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);
 const network=[];page.on('response',response=>{if(/runtime\.review\.json|\/(main|sub)\.(png|webp|json)/.test(response.url()))network.push({url:response.url(),status:response.status()})});
 const result=await page.evaluate(async({prefix,base,publicConfig})=>{
  const PIXI=await import('/node_modules/pixi.js/dist/pixi.mjs');
  const {loadPixiCharacterRuntimeBundle}=await import('/src/championship/presentation/pixiCharacterRuntimeBundle.js');
  const {applyNativeCharacterCellGeometry}=await import('/src/championship/presentation/nativeHuntCharacterAction.js');
  const {completedCharacterBundleLocation}=await import('/src/championship/presentation/completedOriginalCharacters.js');
  const selection=await (await fetch('/src/data/championship/accepted-original-character-selection.r1.json')).json();
  const config=selection.characters.find(c=>c.speciesId==='species-034');
  // The full source atlas still proves all 83 cells and 53 sequences. Normal
  // main-only play now uses the independently hash-validated public pages.
  const route=completedCharacterBundleLocation(config,{battleAtlas:false,sides:['main','sub']},base);
  const expectedRuntimeUrl=new URL(prefix+'runtime.review.json',base).href;
  const publicGameUrl='https://orochi771127.github.io/championship-2026/championship.html';
  const publicRoute=completedCharacterBundleLocation(config,{battleAtlas:true,sides:['main']},publicGameUrl);
  if(publicRoute.packed||!publicRoute.streamed||publicRoute.runtimeUrl!==new URL(publicConfig.runtimePath,publicGameUrl).href||publicRoute.streamed.runtimeSha256!==publicConfig.runtimeSha256)throw Error('PUBLIC_SUBPATH_ROUTE_REGRESSION');
  const fixtureRelativeRoute=completedCharacterBundleLocation(config,{battleAtlas:false,sides:['main','sub']},location.href);
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
    for(const zoom of [2,4,6]){applyNativeCharacterCellGeometry(actor.sprite,{geometry:projected.geometry},zoom);if(projected.geometry.scale!==4||JSON.stringify(projected.geometry.sourceSize)!=='[256,256]'||JSON.stringify(projected.geometry.origin)!=='[112,164]'||actor.sprite.scale.x!==zoom*actor.sprite.texture.source.resolution/4||actor.sprite.anchor.x!==.4375||actor.sprite.anchor.y!==.640625)failures.push('native scale/origin');app.render();}
    for(let t=0;t<frame.ticks;t++)actor.sequencePlayer.advanceNative(4096);frames++;
   }actor.sprite.destroy();sequences++;
  }
  // Real sprite screenshot grid: three native zooms, idle/walk/eat current legacy actions.
  for(const [row,pose] of [[0,0],[0,1],[2,0],[2,1],[14,0],[14,1]].entries())for(const [col,zoom] of [2,4,6].entries()){const [id,frameIndex]=pose;
   const actor=bundle.createActor({side:'main',animation:id,nativeFramePresentation:true,nativeGeometry:bundle.runtime.reviewGeometry});const p=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:id,frameIndex,flipBits:0});applyNativeCharacterCellGeometry(actor.sprite,{geometry:p.geometry},zoom);actor.sprite.position.set(170+col*330,180+row*210);app.stage.addChild(actor.sprite);
  }app.render();return {frames,sequences,coveredCells:covered.size,route,routeRegression:{appBase:base,publicGameUrl,publicRuntimeUrl:publicRoute.runtimeUrl,fixtureUrl:location.href,expectedRuntimeUrl,fixtureRelativeRuntimeUrl:fixtureRelativeRoute.runtimeUrl},failures,diagnostics:bundle.getDiagnostics(),zoomColumns:[2,4,6],actionFrameRows:[[0,0],[0,1],[2,0],[2,1],[14,0],[14,1]],disclaimer:'Real isolated runtime renderer, not normal-game navigation acceptance'};
 },{prefix,base,publicConfig});
 await page.screenshot({path:out+'/actual-pixi-2x-4x-6x.png',fullPage:true});assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);assert.equal(result.diagnostics.textureCount,83);assert.equal(result.coveredCells,83);assert.equal(result.sequences,53);assert.ok(network.some(n=>n.url.endsWith('/'+prefix+'main.webp')&&n.status===200));assert.ok(network.some(n=>n.url.endsWith('/'+prefix+'sub.webp')&&n.status===200));assert.ok(!network.some(n=>n.url.includes('battle-packed-20261013')));
 const huntScene=await isolatedHuntSceneSmoke(browser,base,prefix,out);
 const normalGame=await normalOwnedPartySmoke(browser,base,prefix,out);
 await fs.writeFile(out+'/renderer-result.json',JSON.stringify({status:'PASS_ISOLATED_ACTUAL_PIXI_RUNTIME',...result,network,pageErrors:errors,normalGameNavigation:normalGame.status,huntSceneScope:huntScene.scope},null,2));
}catch(error){await fs.writeFile(out+'/renderer-failure.json',JSON.stringify({status:'FAIL',error:String(error),pageErrors:errors},null,2));await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close()}

// Existing controlled fixture only; all later input uses ordinary production UI.
// No real profile, save edits, synthetic game ticks or production debug additions.
async function normalOwnedPartySmoke(browser,base,prefix,out){
 const url=new URL(base);assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Controlled QA requires loopback');
 const game=await browser.newPage({viewport:{width:1280,height:900},locale:'zh-TW'});game.setDefaultTimeout(90000);
 const evidence={status:'RUNNING',fixture:'tests/fixtures/championship-owned-party.html#prepare-practice',network:[],errors:[],pageErrors:[],consoleFailures:[],httpFailures:[],requestFailures:[],scenes:[],huntNormal034:'NOT_COVERED_NO_GUARANTEED_WILD_SPAWN_FIXTURE'};let scene='fixture';
 game.on('response',r=>{if(r.url().includes('/m201_agumon'))evidence.network.push({scene,url:r.url(),status:r.status()});if(r.status()>=400)evidence.httpFailures.push({scene,url:r.url(),status:r.status()})});
 game.on('requestfailed',r=>evidence.requestFailures.push({scene,url:r.url(),failure:r.failure()?.errorText,method:r.method(),resourceType:r.resourceType()}));
 game.on('pageerror',e=>{evidence.pageErrors.push(e.message);evidence.errors.push(e.message)});game.on('console',m=>{if(/FALLBACK|CHARACTER_REVIEW_FAILED|CANDIDATE_.*DRIFT/.test(m.text())){evidence.consoleFailures.push({type:m.type(),message:m.text()});evidence.errors.push(m.text())}});
 const audioQA=attachM201AudioDiagnostics(game);evidence.audioLoadDiagnostics=audioQA.diagnostic;await game.addInitScript(observeM201AudioLoads);
 const save=async()=>{if(evidence.status!=='RUNNING')await audioQA.collect();await fs.writeFile(out+'/normal-game-result.json',JSON.stringify(evidence,null,2));};
 const screen=async name=>game.locator(`#cm-root[data-active-screen="${name}"]`).waitFor();
 async function home(){await screen('RAISING_HOME');await game.waitForFunction(()=>{const h=document.querySelector('.int-rh2-field-host'),a=JSON.parse(h?.dataset.residentAssets||'[]');return h?.dataset.loadState==='ready'&&a.some(x=>x.speciesId==='championship:creature:species-034'&&x.entityId==='m201_agumon'&&x.state==='ready')},{},{timeout:180000});assert.equal(await game.locator('[data-field-fallback="true"],.int-rh2-field-fallback').count(),0);}
 async function menu(entry){await game.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').click();await game.locator(`.cm-toolbar__menu:not([hidden]) [data-entry-id="${entry}"]`).click();}
 try{
  await game.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);await game.locator('#prepare-practice').click();await game.locator('#status').filter({hasText:'受控存檔已準備'}).waitFor();
  audioQA.markPhase('raising-entry');scene='raising';await game.goto(new URL('championship.html?presentation=developer&battleFxDebug',base).href);await game.locator('#cm-login').waitFor();
  if(await game.locator('#cm-film-skip').isVisible()){await game.locator('#cm-film-skip').click();await game.locator('#cm-opening-film').waitFor({state:'hidden'});await game.waitForTimeout(400);}
  await game.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await game.locator('#cm-login').click();await game.locator('#cm-continue').click();await home();
  await game.waitForFunction(()=>JSON.parse(document.querySelector('.int-rh2-field-host')?.dataset.residentScreenPositions||'[]').some(p=>p.speciesIndex===34));
  audioQA.markPhase('raising-ready');const raising=await game.locator('.int-rh2-field-host').evaluate(h=>({assets:JSON.parse(h.dataset.residentAssets),positions:JSON.parse(h.dataset.residentScreenPositions)}));
  for(const p of raising.positions.filter(p=>p.speciesIndex===34)){assert.ok(p.nativeScreenPixels>0&&Number.isFinite(p.bodyTop)&&p.footY>p.bodyTop);assert.ok(p.groundScreen&&Math.abs(p.groundScreen.y-(p.boardTop+p.nativeY*p.nativeScreenPixels))<1,'Shared native ground transform');}
  assert.ok(evidence.network.some(n=>n.scene==='raising'&&n.url===new URL(publicConfig.runtimePath,base).href&&n.status===200),'Raising selected public runtime');
  assert.ok(evidence.network.some(n=>n.scene==='raising'&&n.url.includes('/ranch-streaming-v1/')&&n.url.endsWith('.webp')&&n.status===200),'Raising selected public image page');
  assert.ok(!evidence.network.some(n=>/runtime\.review\.json|\/(?:main|sub)\.(?:png|webp)$/.test(n.url)),'Normal app does not request private source atlases');
  assert.ok(!evidence.network.some(n=>n.scene==='raising'&&n.url.includes('battle-packed')));evidence.scenes.push({scene:'raising',entry:'PASS',diagnostics:raising,groundShadow:'SCREENSHOT_REVIEW_REQUIRED'});await game.screenshot({path:out+'/normal-raising034.png',fullPage:true});await save();
  audioQA.markPhase('battle-menu');scene='battle';await menu('battle');await screen('BATTLE_SELECT');assert.equal(await game.locator('.int-rh2-field-host').count(),0,'Raising scene released');
  await game.locator('[data-face-id="PRACTICE_BATTLE"]:visible').first().click();
  const members=game.locator('.cm-vs5-practice-member');await members.nth(1).waitFor();await members.nth(0).getByRole('button',{name:/A 隊$/}).click();await members.nth(1).getByRole('button',{name:/B 隊$/}).click();audioQA.markPhase('battle-start-click');await game.getByRole('button',{name:'開始練習',exact:true}).click();await screen('BATTLE_FIELD');audioQA.markPhase('battle-field-mounted');
  await game.waitForFunction(()=>{const d=globalThis.__championshipBattleDiagnostics?.();return d?.characters?.some(c=>c.speciesId==='species-034'&&c.rendered&&c.animation?.geometry?.scale===4)},{},{timeout:180000});
  audioQA.markPhase('battle-characters-ready');const battle=await game.evaluate(()=>globalThis.__championshipBattleDiagnostics());const fighters=battle.characters.filter(c=>c.speciesId==='species-034');assert.equal(fighters.length,2);
  for(const c of fighters){assert.equal(c.entityId,'m201_agumon');assert.equal(c.rendered,true);assert.equal(c.nativeSizing.packedPixelsPerNativePixel,4);assert.equal(c.animation.geometry.scale,4);assert.deepEqual(c.animation.geometry.origin,[112,164]);assert.deepEqual(c.animation.geometry.sourceSize,[256,256]);}
  assert.equal(battle.art.assetId,'art:battle:original-opus:v1:arena-polish-20261018','Normal approved default arena, not opt-in baked-shadow review');assert.equal(battle.groundShadows,null,'Default arena uses existing ellipse shadows; baked-review diagnostics are absent');assert.equal(await game.locator('[data-field-fallback="true"]').count(),0);
  // Same-document PIXI cache may reuse Raising's verified atlas without another GET.
  assert.ok(evidence.network.some(n=>n.url.includes('/ranch-streaming-v1/')&&n.url.endsWith('.webp')&&n.status===200));assert.ok(!evidence.network.some(n=>n.url.includes('/battle-packed-20261013/m201_agumon/')));
  assert.ok(!evidence.network.some(n=>/runtime\.review\.json|\/(?:main|sub)\.(?:png|webp)$/.test(n.url)),'Battle retains the selected public pages');
  evidence.scenes.push({scene:'battle',entry:'PASS',diagnostics:battle,textureBinding:'same-document cache or new request; exact entity, frozen density4 trial geometry, no packed route',groundShadow:'DEFAULT_ELLIPSE_SCREENSHOT_REVIEW_REQUIRED_NOT_BAKED_REVIEW'});await game.screenshot({path:out+'/normal-battle034.png',fullPage:true});await save();
  audioQA.markPhase('battle-exit-open');await game.getByRole('button',{name:'離開對戰',exact:true}).first().click();const dialog=game.getByRole('dialog');await dialog.waitFor();audioQA.markPhase('battle-exit-confirm');await dialog.getByRole('button',{name:'離開對戰',exact:true}).click();audioQA.markPhase('raising-return-wait');await home();audioQA.markPhase('raising-return-ready');
  assert.equal(await game.evaluate(()=>typeof globalThis.__championshipBattleDiagnostics),'undefined','Battle diagnostics disposed on exit');await game.screenshot({path:out+'/normal-return-raising034.png',fullPage:true});
  evidence.scenes.push({scene:'raising-return',entry:'PASS',battleExit:'PASS'});
  // a540 and current bm03GroundShadows.js share blob ff3327693ec6fe1df788d53da36ec8705a7ae523.
  // Loopback arena-polish selects PRIVATE review shadows, absent from the Pages payload.
  // Published non-loopback resolves null (source evidence, not a live-public-browser claim).
  const shadowRoots=Object.fromEntries(['01','02','04','05','06','07','08','09','10','11'].map(n=>[`field_bm${n}_01`,`assets/production/battle/stage-review-20261007/fields/field_bm${n}_01/`]));
  shadowRoots.field_bm03_01='assets/production/battle/bm03-volcano-review-r2/';
  assert.ok(Object.hasOwn(shadowRoots,battle.art.fieldId),'Approved arena field has independently frozen private shadow route');
  const expectedShadowUrl=new URL(shadowRoots[battle.art.fieldId]+'shadows.json',base).href;
  assert.deepEqual(evidence.httpFailures,[{scene:'battle',url:expectedShadowUrl,status:404}],'Only the exact baseline private shadow metadata 404 is expected');
  // Actual run39558366558 observed only these streaming-media cancellations across scene changes.
  // Unchanged musicPresentation.js release(): pause(), removeAttribute('src'), load().
  const allowedMediaAborts=new Map([
   [new URL('assets/production/original-music-r1/bgm_login_page.mp3',base).href,'raising'],
   [new URL('assets/production/scene-music-r1/battle/clash_at_the_emerald_edge.mp3',base).href,'battle']
  ]);
  await audioQA.collect();
  evidence.audioExitCancellation=validateSceneOwnedAudioExits(evidence,base,await loadSceneOwnedAudioContract(base));
  const mediaFailures=evidence.requestFailures.filter(r=>r.resourceType==='media');
  assert.ok(mediaFailures.length<=2,'At most the two observed scene-transition media cancellations');
  assert.equal(new Set(evidence.requestFailures.map(r=>r.url)).size,evidence.requestFailures.length,'No repeated media failure');
  for(const r of mediaFailures){
   assert.ok(allowedMediaAborts.has(r.url),'No failed character image/JSON/module or unlisted audio request');
   assert.equal(r.scene,allowedMediaAborts.get(r.url),'Only the corresponding controlled scene transition');
   assert.equal(r.failure,'net::ERR_ABORTED');assert.equal(r.method,'GET');assert.equal(r.resourceType,'media');
  }
  evidence.mediaLifecycle={abortedRequests:evidence.requestFailures,completePlayback:'NOT_TESTED',sourceBlob:'da504c9c1f76235f4fb6314b0218bbda41107186'};
  assert.deepEqual(evidence.pageErrors,[],'No page errors, including errors resembling the known warning');
  assert.deepEqual(evidence.consoleFailures,[{type:'warning',message:'CHAMPIONSHIP_BM03_SHADOW_FALLBACK BM03_SHADOW_METADATA_UNAVAILABLE'}],'Exactly one warning-level baseline diagnostic');
  assert.deepEqual(evidence.errors,['CHAMPIONSHIP_BM03_SHADOW_FALLBACK BM03_SHADOW_METADATA_UNAVAILABLE'],'Exactly one known loopback-only baseline warning; all other errors/fallbacks fail');
  evidence.baselineWarning={message:evidence.errors[0],count:1,metadataUrl:expectedShadowUrl,httpStatus:404,bakedShadows:battle.groundShadows,rendering:'EXISTING_ELLIPSE',baselineSourceBlob:'ff3327693ec6fe1df788d53da36ec8705a7ae523'};evidence.status='PASS_CONTROLLED_NORMAL_RAISING_BATTLE';await save();return evidence;
 }catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.failureDiagnostics=await game.evaluate(()=>{const h=document.querySelector('.int-rh2-field-host');return {activeScreen:document.querySelector('#cm-root')?.dataset.activeScreen,loadState:h?.dataset.loadState,residentAssets:h?.dataset.residentAssets,residentScreenPositions:h?.dataset.residentScreenPositions,battle:globalThis.__championshipBattleDiagnostics?.()??null}}).catch(e=>({unavailable:String(e)}));await save();await game.screenshot({path:out+'/normal-game-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await game.close();}
}

// Typed evidence admission, not a blanket ERR_ABORTED exception. Pins make the
// owner stack lines and four-worker bound a reviewed contract, not a guess.
async function loadSceneOwnedAudioContract(base){
 const pins={
  'assets/production/public-runtime/battle-audio.render.v1.json':'98d24b4c5f371aa29f3344fd33f050c7a46ba97f183a13c4c8dfff5e6b04fa3f',
  'src/championship/app/main.js':'b91fdfd3f6b0493b048929fc114ad2ae05c9ba49dabe0ced8b6a594b5b804e66',
  'src/championship/app/vs5Screens.js':'ba413d951013b008d18771adec38d87ad717c9f6f24d3dd76c54f726bf4462cf',
  'src/championship/presentation/battleAudioPresentation.js':'751c0f598b7a9de7062b9d392d7af2574f27f41e0350fc83199953cbb1f16737'
 };
 let manifest;
 for(const [file,hash] of Object.entries(pins)){
  const bytes=await fs.readFile(file);assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,`Exit-owner source pin: ${file}`);
  if(file.endsWith('.json'))manifest=JSON.parse(bytes);
 }
 assert.equal(manifest.kind,'BATTLE_AUDIO_RENDER_V1');assert.equal(manifest.sounds.length,54);
 const urls=manifest.sounds.map(x=>new URL(x.src,base).href);assert.equal(new Set(urls).size,54);
 return {pins,urls,manifestUrl:new URL('assets/production/public-runtime/battle-audio.render.v1.json',base).href,concurrency:4};
}
function validateSceneOwnedAudioExits(evidence,base,contract){
 const d=evidence.audioLoadDiagnostics,b=d?.browser;
 assert.ok(d&&b&&!d.collectError&&!b.unavailable,'Complete audio ownership snapshot required');
 assert.equal(d.version,1);assert.equal(b.version,1);assert.equal(b.dropped,0);assert.equal(b.observerErrors,0);
 assert.deepEqual(d.dropped,{phases:0,network:0,console:0},'No lost host evidence');
 assert.ok(b.events.length<=b.limit&&b.limit===1024);
 const events=b.events,fetches=events.filter(e=>e.type==='audio-fetch-call');assert.equal(fetches.length,b.audioFetchCalls,'No missing fetch-call event');
 for(const e of events){
  assert.ok(Number.isFinite(e.epochMs)&&Number.isFinite(e.timeMs));
  for(const key of ['creationStack','callStack'])if(e[key]!=null)assert.ok(e[key].length<4096,'Untruncated owner stack required');
  if(e.url!=null)assert.ok(e.url.length<2048,'Untruncated request URL required');
  for(const r of [e.reason,e.providedReason])if(r)assert.ok(!r.unavailable&&r.name.length<120&&r.message.length<2048&&r.stack.length<4096,'Untruncated abort reason required');
 }
 assert.deepEqual(evidence.pageErrors,[],'No page errors for exit admission');
 for(const c of d.console){
  assert.equal(c.truncated,false,'Complete console required');assert.equal(c.message.length,c.messageLength);
  assert.ok(!/audio|decode|NotSupportedError|EncodingError|MEDIA_ERR/i.test(c.message),'No audio warning, failure or fallback');
  if(c.type==='error')assert.ok(evidence.httpFailures.length===1&&c.location?.url===evidence.httpFailures[0].url&&/^Failed to load resource:.*404/.test(c.message),'No unrelated console error');
 }
 const expectedPhases=['fixture','raising-entry','raising-ready','battle-menu','battle-start-click','battle-field-mounted','battle-characters-ready','battle-exit-open','battle-exit-confirm','raising-return-wait','raising-return-ready'];
 assert.deepEqual(d.phases.map(x=>x.phase),expectedPhases,'Complete single normal-UI phase sequence required');
 for(let i=0;i<d.phases.length;i++)assert.ok(Number.isFinite(d.phases[i].hostEpochMs)&&(i===0||d.phases[i].hostEpochMs>=d.phases[i-1].hostEpochMs),'Monotonic phase timestamps');
 const phases=Object.fromEntries(d.phases.map(x=>[x.phase,x.hostEpochMs]));
 const known=new Set(contract.urls),allKnown=new Set([...known,contract.manifestUrl]),groups=new Map();
 for(const n of d.network){
  assert.ok(allKnown.has(n.url),'Exact pinned manifest audio URLs only');assert.equal(n.method,'GET');assert.equal(n.resourceType,'fetch');assert.ok(Number.isInteger(n.requestId)&&n.requestId>0&&Number.isFinite(n.hostEpochMs));
  if(!groups.has(n.requestId))groups.set(n.requestId,[]);groups.get(n.requestId).push(n);
 }
 const unique=(array,predicate,label)=>{const selected=array.filter(predicate);assert.equal(selected.length,1,label);return selected[0];};
 const requests=[];
 for(const [requestId,rows] of groups){
  const request=unique(rows,n=>n.event==='request','Exactly one request event'),response=unique(rows,n=>n.event==='response','Exactly one response event'),terminal=unique(rows,n=>['requestfinished','requestfailed'].includes(n.event),'Exactly one terminal event');
  assert.equal(rows.length,3,'No duplicate/unknown network events');assert.ok(rows.every(n=>n.url===request.url));assert.equal(response.status,200,'No audio HTTP failure');
  const fetch=unique(fetches,f=>f.url===request.url,'Exactly one browser fetch owner per URL');
  assert.equal(fetch.signalAlreadyAborted,false);assert.equal(fetch.activeScreen,'BATTLE_FIELD');assert.ok(Number.isInteger(fetch.signalId)&&fetch.signalId>0);
  requests.push({requestId,request,response,terminal,fetch});
 }
 assert.equal(requests.length,fetches.length,'Every native fetch has complete matching network evidence');
 assert.equal(new Set(requests.map(x=>x.request.url)).size,requests.length,'No repeated audio request');
 const descriptor=unique(requests,r=>r.request.url===contract.manifestUrl,'One descriptor request');assert.equal(descriptor.terminal.event,'requestfinished');
 const failures=evidence.requestFailures.filter(r=>r.resourceType!=='media'),failedNetwork=requests.filter(x=>x.terminal.event==='requestfailed');
 assert.equal(failures.length,failedNetwork.length,'No unmatched failed audio request');
 assert.ok(failures.length<=contract.concurrency&&failures.length<=requests.filter(r=>known.has(r.request.url)).length,'Owned cancellations bounded by actual manifest requests and pinned worker count');
 const receipts=[];
 for(const failure of failures){
  assert.ok(known.has(failure.url),'Only exact manifest WAV may use owned exit rule');assert.equal(failure.scene,'battle');assert.equal(failure.method,'GET');assert.equal(failure.resourceType,'fetch');assert.equal(failure.failure,'net::ERR_ABORTED');
  const row=unique(failedNetwork,r=>r.request.url===failure.url,'One failed request identity'),fetch=row.fetch,id=fetch.signalId;
  assert.equal(row.terminal.failure,'net::ERR_ABORTED');assert.equal(row.terminal.phase,'battle-exit-confirm');
  assert.ok(['battle-field-mounted','battle-characters-ready','battle-exit-open','battle-exit-confirm'].includes(row.request.phase));
  const childCreated=unique(events,e=>e.type==='controller-created'&&e.signalId===id,'Known created audio signal');
  const childAbort=unique(events,e=>e.type==='abort-call'&&e.signalId===id,'Single audio abort');
  const parentId=childAbort.parentAbortSignalId;assert.ok(Number.isInteger(parentId)&&parentId>0&&parentId!==id,'Actual synchronous parent owner');
  const parentCreated=unique(events,e=>e.type==='controller-created'&&e.signalId===parentId,'Known created field signal');
  const parentAbort=unique(events,e=>e.type==='abort-call'&&e.signalId===parentId,'Single field disposal');
  const childReturn=unique(events,e=>e.type==='abort-return'&&e.signalId===id,'Audio abort returned');
  const parentReturn=unique(events,e=>e.type==='abort-return'&&e.signalId===parentId,'Field abort returned');
  const frame=(stack,name,file,line)=>assert.ok(stack.includes(`at ${name}${name?' (':''}${new URL(file,base).href}:${line}:`),`Pinned owner frame: ${name}:${line}`);
  frame(parentCreated.creationStack,'mountField','src/championship/app/main.js?v=settings-2',1440);
  frame(childCreated.creationStack,'mountBattleAudioPresentation','src/championship/presentation/battleAudioPresentation.js',32);
  frame(childCreated.creationStack,'','src/championship/app/main.js?v=settings-2',1527);
  frame(parentAbort.callStack,'Object.dispose','src/championship/app/main.js?v=settings-2',1553);
  frame(parentAbort.callStack,'Object.dispose','src/championship/app/vs5Screens.js',916);
  frame(parentAbort.callStack,'mountCurrentScreen','src/championship/app/main.js?v=settings-2',1782);
  frame(childAbort.callStack,'dispose','src/championship/presentation/battleAudioPresentation.js',46);
  frame(childAbort.callStack,'AbortSignal.abort','src/championship/presentation/battleAudioPresentation.js',54);
  frame(fetch.callStack,'','src/championship/presentation/battleAudioPresentation.js',67);
  assert.equal(parentAbort.parentAbortSignalId,null);assert.equal(parentReturn.parentAbortSignalId,null);assert.equal(childReturn.parentAbortSignalId,parentId);
  for(const e of [parentAbort,childAbort]){assert.equal(e.alreadyAborted,false);assert.equal(e.providedReason,null);assert.equal(e.activeScreen,'BATTLE_FIELD');}
  for(const e of [parentReturn,childReturn]){assert.equal(e.aborted,true);assert.equal(e.reason?.name,'AbortError');}
  const chain=[parentCreated,childCreated,fetch,parentAbort,childAbort,childReturn,parentReturn];
  for(let i=1;i<chain.length;i++){assert.ok(events.indexOf(chain[i])>events.indexOf(chain[i-1]),'Observed causal order');assert.ok(chain[i].epochMs>=chain[i-1].epochMs,'Browser causal timestamp order');}
  assert.ok(parentAbort.epochMs>=phases['battle-exit-confirm']&&parentReturn.epochMs<=phases['raising-return-wait'],'Abort strictly inside actual exit-confirm operation');
  assert.ok(row.terminal.hostEpochMs>=parentReturn.epochMs&&row.terminal.hostEpochMs<=phases['raising-return-wait'],'Failure follows disposal before return wait');
  const timing=row.terminal.timing;assert.ok(timing&&Number.isFinite(timing.startTime)&&Number.isFinite(timing.responseEnd)&&timing.responseEnd>=0);
  assert.ok(timing.startTime<=childAbort.epochMs&&timing.startTime+timing.responseEnd>=childReturn.epochMs,'Failed request still in flight at actual owned abort');
  assert.equal(descriptor.fetch.signalId,id,'Same manifest/mount signal');
  receipts.push({url:failure.url,requestId:row.requestId,signalId:id,parentSignalId:parentId,network:row,ownership:{parentCreated,childCreated,parentAbort,childAbort,childReturn,parentReturn}});
 }
 if(receipts.length)assert.equal(new Set(receipts.map(x=>x.signalId)).size,1,'One scene-owned audio load batch');
 return {scope:'PINNED_SCENE_EXIT_ONLY_NOT_COMPLETE_AUDIO_PLAYBACK',sourcePins:contract.pins,manifestRequests:requests.length-1,manifestTotal:contract.urls.length,workerBound:contract.concurrency,validatedBrowserEvents:events.length,validatedNetworkEvents:d.network.length,receipts};
}

// Diagnostic-only native forwarding. No requests, clocks, aborts, or promises are substituted.
function observeM201AudioLoads() {
 const limit=1024,events=[],signals=new WeakMap(),abortParents=[];
 let nextSignal=0,nextFetch=0,dropped=0,observerErrors=0;
 const errorInfo=value=>{
  try{return value==null?null:{name:String(value.name??typeof value).slice(0,120),message:String(value.message??value).slice(0,2048),stack:String(value.stack??'').slice(0,4096)};}
  catch{return {unavailable:true};}
 };
 const stack=()=>String(new Error().stack??'').slice(0,4096);
 const state=()=>({activeScreen:document.querySelector('#cm-root')?.dataset.activeScreen??null,battleBusy:document.querySelector('.cm-vs5-field')?.getAttribute('aria-busy')??null,raisingLoadState:document.querySelector('.int-rh2-field-host')?.dataset.loadState??null});
 const record=(type,details={})=>{
  try{if(events.length>=limit){dropped++;return;}const now=performance.now();events.push({type,timeMs:now,epochMs:performance.timeOrigin+now,...state(),...details});}catch{observerErrors++;}
 };
 const signalId=signal=>{
  if(!signal||(typeof signal!=='object'&&typeof signal!=='function'))return null;
  let id=signals.get(signal);if(!id){id=++nextSignal;signals.set(signal,id);record('signal-first-seen',{signalId:id,aborted:signal.aborted,creationStack:null});}return id;
 };
 const NativeAbortController=globalThis.AbortController,nativeAbort=NativeAbortController.prototype.abort;
 globalThis.AbortController=new Proxy(NativeAbortController,{construct(Target,args,newTarget){
  const controller=Reflect.construct(Target,args,newTarget);
  try{const id=++nextSignal;signals.set(controller.signal,id);record('controller-created',{signalId:id,creationStack:stack()});}catch{observerErrors++;}
  return controller;
 }});
 NativeAbortController.prototype.abort=function(...args){
  let id=null,parentAbortSignalId=null,pushed=false;
  try{id=signalId(this.signal);parentAbortSignalId=abortParents.at(-1)??null;record('abort-call',{signalId:id,parentAbortSignalId,alreadyAborted:this.signal.aborted,providedReason:errorInfo(args[0]),callStack:stack()});abortParents.push(id);pushed=true;}catch{observerErrors++;}
  try{return Reflect.apply(nativeAbort,this,args);}
  finally{try{if(pushed)abortParents.pop();record('abort-return',{signalId:id,parentAbortSignalId,aborted:this.signal.aborted,reason:errorInfo(this.signal.reason)});}catch{observerErrors++;}}
 };
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=new Proxy(nativeFetch,{apply(target,thisArg,args){
  try{
   const input=args[0],options=args[1],url=typeof input==='string'?input:input?.url??String(input);
   if(/(?:\/battle-audio-v1\/|\/battle-audio\.render\.v1\.json(?:[?#]|$))/.test(url)){
    const signal=options?.signal??input?.signal;
    record('audio-fetch-call',{fetchId:++nextFetch,url:String(url).slice(0,2048),signalId:signalId(signal),signalAlreadyAborted:signal?.aborted??null,callStack:stack()});
   }
  }catch{observerErrors++;}
  // Return the exact native promise; attaching a rejection observer would alter
  // unhandled-rejection reporting, so network/console events capture outcomes.
  return Reflect.apply(target,thisArg,args);
 }});
 globalThis.__m201AudioLoadQA={snapshot:()=>({version:1,timeOrigin:performance.timeOrigin,url:location.href,limit,dropped,observerErrors,signalsSeen:nextSignal,audioFetchCalls:nextFetch,events:events.slice()})};
}

function attachM201AudioDiagnostics(game) {
 const diagnostic={version:1,scope:'CONTROLLED_FIXTURE_TYPED_EXIT_OWNERSHIP_VALIDATION',phases:[],network:[],console:[],dropped:{phases:0,network:0,console:0},browser:null};
 const requests=new WeakMap();let nextRequest=0,phase='fixture';
 const push=(key,row,limit)=>{if(diagnostic[key].length<limit)diagnostic[key].push(row);else diagnostic.dropped[key]++;};
 const markPhase=name=>{phase=name;push('phases',{phase,hostEpochMs:Date.now()},64);};
 const isAudio=url=>/(?:\/battle-audio-v1\/|\/battle-audio\.render\.v1\.json(?:[?#]|$))/.test(url);
 const network=(event,request,extra={})=>{
  if(!isAudio(request.url()))return;
  let id=requests.get(request);if(!id){id=++nextRequest;requests.set(request,id);}
  let timing;try{timing=request.timing();}catch(error){timing={unavailable:String(error)};}
  push('network',{event,requestId:id,phase,hostEpochMs:Date.now(),url:request.url(),method:request.method(),resourceType:request.resourceType(),timing,...extra},512);
 };
 game.on('request',request=>network('request',request));
 game.on('response',response=>network('response',response.request(),{status:response.status()}));
 game.on('requestfinished',request=>network('requestfinished',request));
 game.on('requestfailed',request=>network('requestfailed',request,{failure:request.failure()?.errorText}));
 game.on('console',message=>{if(['warning','error'].includes(message.type())){const text=message.text();push('console',{type:message.type(),phase,hostEpochMs:Date.now(),message:text.slice(0,16384),messageLength:text.length,truncated:text.length>16384,location:message.location()},256);}});
 markPhase('fixture');
 return {diagnostic,markPhase,async collect(){
  try{diagnostic.browser=await game.evaluate(()=>globalThis.__m201AudioLoadQA?.snapshot()??{unavailable:'observer not installed'});}
  catch(error){diagnostic.collectError=String(error).slice(0,4096);}
 }};
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
  const {loadPublicCharacterRoster}=await import('/src/championship/presentation/publicCharacterRoster.js');
  const {huntContactShadow}=await import('/src/championship/presentation/vs2/huntContactShadow.js');
  const read=async p=>{const r=await fetch(new URL(p,base));if(!r.ok)throw Error('INPUT_MISSING:'+p);return r.json()};
  // Exercise the actual selected public roster; loopback legacy catalog intentionally retains historical density8.
  const roster=await loadPublicCharacterRoster({PIXI,speciesIds:['species-034']},new URL('championship.html',base).href);
  const loaded=roster.getDiagnostics().publicCharacters;if(!loaded.loaded.includes('m201_agumon')||loaded.privateIndexRequested!==false)throw Error('HUNT_SELECTED_ADAPTER_FAILED');
  const host=document.createElement('div');host.style.cssText='width:980px;height:650px';document.body.replaceChildren(host);const shared=await createChampionshipPixiStage({PIXI,canvasHost:host,resolutionCap:1,antialias:false});shared.app.stop();const baselineTicker=shared.app.ticker.count;let root;
  const stage={...shared,createSceneRoot(label){root=shared.createSceneRoot(label);return root;}};
  const wilds=[0,1].map(i=>({wildId:'qa034-'+i,speciesId:'species-034',worldX:90+i*130,worldY:100,worldZ:0,facing:i?'left':'right',nativeAnimation:{contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:0,frameIndex:0,flipBits:i}}));
  const view={gateId:'isolated034-contact',worldWidthPx:2048,worldHeightPx:2048,transform:{scale:3},camera:{left:0,top:0},visibleChunks:[],objects:[],player:{worldX:0,worldY:0,facing:'right'},wildCreatures:wilds,selectedWildId:null};
  const scene=await mountHuntFieldPixiPresentation({stage,source:{field:{tick(){},getView:()=>view},intents:{panCamera(){},selectWildAt(){},abortEnclosureStroke(){}}},characterBundle:roster});
  const descendants=n=>[n,...(n.children??[]).flatMap(descendants)];const actors=descendants(root).filter(n=>n.label==='wild creature'),samples=[];if(actors.length!==2)throw Error('HUNT_ACTOR_COVERAGE');
  for(const sequenceId of [0,2])for(const frameIndex of [0,1])for(const height of [0,3]){
   wilds.forEach((w,i)=>{w.worldZ=height;w.nativeAnimation={...w.nativeAnimation,sequenceId,frameIndex}});scene.render();shared.app.renderer.render(shared.app.stage);
   for(const [i,n] of actors.entries()){const frame=n.nativeFramePresenter.getSnapshot(),contact=huntContactShadow('species-034',frame,height,n.contactShadowArt);if(!contact||n.contactShadow.y!==contact.localY||n.contactShadow.scale.y!==contact.scaleY||frame.geometry.scale!==4||JSON.stringify(frame.geometry.origin)!=='[112,164]'||JSON.stringify(frame.geometry.sourceSize)!=='[256,256]'||n.characterSprite.scale.x!==2*n.characterSprite.texture.source.resolution/4||n.characterSprite.anchor.x!==.4375||n.characterSprite.anchor.y!==.640625)throw Error('HUNT_SCALE_PIVOT_OR_CONTACT');samples.push({sequenceId,frameIndex,height,flip:i,geometry:frame.geometry,contact,shadowY:n.contactShadow.y,bodyY:n.y});}
  }
  wilds.forEach(w=>{w.worldZ=0;w.nativeAnimation={...w.nativeAnimation,sequenceId:0,frameIndex:0}});scene.render();shared.app.renderer.render(shared.app.stage);
  globalThis.__qa034Dispose=async()=>{scene.dispose();await roster.dispose();const d={ticker:shared.app.ticker.count,baselineTicker,rootDestroyed:root.destroyed};shared.destroy();return d;};
  if(samples.length!==16)throw Error('HUNT_SAMPLE_COVERAGE');
  return {scope:'ISOLATED_ACTUAL_HUNT_SCENE_NOT_NORMAL_SPAWN',samples,roster:loaded};
 },{base,prefix});
 await review.screenshot({path:out+'/isolated-hunt034-contact.png',fullPage:true});const disposal=await review.evaluate(()=>globalThis.__qa034Dispose());assert.equal(disposal.ticker,disposal.baselineTicker);assert.equal(disposal.rootDestroyed,true);assert.ok(network.some(n=>n.url===new URL(publicConfig.runtimePath,base).href&&n.status===200));assert.ok(network.some(n=>n.url.startsWith(new URL(prefix+'ranch-streaming-v1/',base).href)&&/main-[a-f0-9]{16}\.webp$/.test(n.url)&&n.status===200));assert.ok(!network.some(n=>/runtime\.review\.json|\/(?:main|sub)\.(?:png|webp)$/.test(n.url)));await fs.writeFile(out+'/isolated-hunt034-result.json',JSON.stringify({status:'PASS_ISOLATED_HUNT_SCENE',...evidence,disposal,network},null,2));return evidence;
 }finally{await review.close();}
}


