// Real game UI, fresh isolated profiles, exact built game bytes. Private installer
// fixtures are routed only inside this test. No app/state injection,
// fake timers, private gameplay methods or custom browser/GPU flags. The original
// QA seed stays unchanged; one explicitly historical-wallet derivative is test-only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {resolveAsset,serveBuild}=require('./alternate-form-browser-support.cjs');
const {createInstallerFixtures}=require('./friends-installer-fixture-support.cjs');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest');
const output=require('./browser-qa-output.cjs')('friends-playtest');fs.mkdirSync(output,{recursive:true});
const publicBase='https://orochi771127.github.io/championship-2026/',saveKey='championshipModernSave:v1';
const evidence={status:'RUNNING',commit:process.env.GITHUB_SHA||null,assertions:[],console:[],pageErrors:[],networkErrors:[],routeErrors:[]};
const {sourceCase,selectedGroups}=require('./friends-playtest-groups.cjs');
const groups=selectedGroups(process.env.CHAMPIONSHIP_FRIENDS_GROUP);
evidence.partition={schema:1,requested:process.env.CHAMPIONSHIP_FRIENDS_GROUP||'all',expected:groups,completed:[],runnerSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')};
const digits=s=>Number(String(s).replace(/[^0-9]/g,''));
const write=()=>fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2)+'\n');
// Test-only ordinary overlay classification. No app access, input, clock, or DOM mutation.
function ordinaryRanchOverlayState(selector){
 const visible=el=>Boolean(el&&!el.hidden&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none');
 const dialogs=[...document.querySelectorAll('[role="dialog"]')].filter(visible);
 if(dialogs.length){
  if(dialogs.length!==1)return false;
  const letter=dialogs[0],text=letter.querySelector('.int-rh2-letter__text');
  const buttons=[...letter.querySelectorAll('button')].filter(visible);
  if(!letter.matches('.int-rh2-letter[data-system="true"]')||text?.textContent?.trim()!=='已到戰鬥入場登錄時間。'
    ||buttons.length!==1||!buttons[0].matches('.int-rh2-letter__ack')||buttons[0].textContent.trim()!=='確認'||buttons[0].disabled)return false;
  return {kind:'registration-notice-94',text:text.textContent.trim(),system:true};
 }
 const layer=document.querySelector('.int-rh2-lifecycle'),calendar=document.querySelector('.int-rh2-calendar');
 if(calendar&&!calendar.hidden&&!calendar.disabled)return {kind:'calendar'};
 if(layer&&!layer.hidden||document.querySelector('.cm-ceremony'))return false;
 const canvases=document.querySelectorAll(selector);if(canvases.length!==1)return false;const canvas=canvases[0];if(getComputedStyle(canvas).pointerEvents==='none')return false;
 const box=canvas.getBoundingClientRect();return [180,260,Math.min(360,box.height-150)].some(y=>document.elementFromPoint(box.right-35,box.top+y)===canvas)?{kind:'canvas'}:false;
}
function registrationNoticeInvariant(save){
 assert.ok(save?.shop&&save?.progression?.nativeTitles&&Array.isArray(save.progression.nativeTitles.registered),'Actual saved economy and registration required');
 return {shop:save.shop,battleEconomy:save.battleEconomy,friendsPlaytest:save.flags?.friendsPlaytest,registered:save.progression.nativeTitles.registered};
}
// End test-only ordinary overlay helpers.
// BEGIN FRIENDS PUBLIC THREE / MENU / ROUTE CONTRACTS (test-only)
const FRIENDS_THREE_RESOURCES=Object.freeze([
 {"path":"assets/production/cage/three-20261021/manifest.json","bytes":8532,"sha256":"d97a823fa3259cfa23fd38c75243cfe506be0eddab3f99031ebecf2bdf6cdc2e"},
 {"fieldId":"field_cm02_01","path":"assets/production/cage/three-20261021/field_cm02_01.glb","bytes":1269244,"sha256":"19c7add2891cd084e26be2b7e9f3363dc082a6c8e5d97c064a8e7b793c0e94c9"},
 {"fieldId":"field_cm18_01","path":"assets/production/cage/three-20261021/field_cm18_01.glb","bytes":1922864,"sha256":"b1b033df28513eae232f43a4307894528583c62dd8c5e029189ea486ccad1f0d"},
 {"fieldId":"field_cm39_01","path":"assets/production/cage/three-20261021/field_cm39_01.glb","bytes":491068,"sha256":"90b760b1ee831ce3b1fdd2f6f1086ac202582704bd9ebaa6fd715f0cd67031ea"}
]);
async function friendsDrainReadbacks(reads){
 let count=-1;while(count!==reads.length){count=reads.length;await Promise.all(reads);}
}
function friendsThreeIdentity(rows){
 return FRIENDS_THREE_RESOURCES.map(expected=>{
  const found=rows.filter(row=>row.path===expected.path);
  assert.ok(found.length,'Actual successful Three response required: '+expected.path);
  for(const row of found){assert.equal(row.status,200);assert.equal(row.bytes,expected.bytes);assert.equal(row.sha256,expected.sha256);assert.equal(row.error,undefined);}
  return {...expected};
 });
}
function friendsThreeSnapshot({includeRenderer=false}={}){const all=[...document.querySelectorAll('#cm-root[data-active-screen="RAISING_HOME"] .cm-ranch-three-canvas')],c=all[0],h=document.querySelector('.int-rh2-field-host'),r=c?.getBoundingClientRect();const state={canvasCount:all.length,frames:Number(c?.dataset.frames),width:c?.width??0,height:c?.height??0,visible:Boolean(r&&r.width>0&&r.height>0&&getComputedStyle(c).display!=='none'&&getComputedStyle(c).visibility!=='hidden'),loadState:h?.dataset.loadState,busy:h?.getAttribute('aria-busy'),fallbackCount:document.querySelectorAll('[data-field-fallback="true"]').length};
 let renderer=null;if(includeRenderer&&c){const gl=c.getContext('webgl2');if(gl){const ext=gl.getExtension('WEBGL_debug_renderer_info');renderer={version:gl.getParameter(gl.VERSION),vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,contextLost:gl.isContextLost(),hardwareConcurrencyHint:navigator.hardwareConcurrency};}}
 return {...state,renderer,runtimeClockText:document.querySelector('.cm-status-bar')?.textContent??null,residents:JSON.parse(h?.dataset.residentAssets||'[]')};
}
function friendsThreeSnapshotReady(state){
 if(state.fallbackCount!==0)throw new Error('FRIENDS_THREE_FALLBACK_PRESENT');
 if(state.canvasCount>1)throw new Error('FRIENDS_THREE_DUPLICATE_CANVAS');
 if(state.loadState==='error'||state.residents.some(row=>row.state==='error'))throw new Error('FRIENDS_THREE_RESIDENT_OR_FIELD_ERROR');
 return state.canvasCount===1&&state.loadState==='ready'&&state.busy==='false'&&state.visible&&state.width>0&&state.height>0&&Number.isSafeInteger(state.frames)&&state.frames>0&&state.residents.length>0&&state.residents.every(row=>row.state==='ready');
}
function friendsMakeThreeReadiness(){return new Function(`const state=(${friendsThreeSnapshot.toString()})();return (${friendsThreeSnapshotReady.toString()})(state)?state:false;`);}
// Pure test-only preparation: preserve raw observation; never act on a later unrelated visibility read.
function friendsPreparationReady(s,fieldReady){
 if(!s.overlay)return false;
 if(s.overlay.kind==='canvas')return !fieldReady||friendsThreeSnapshotReady(s.three);
 return friendsRecognizedOverlay(s.overlay);
}
function friendsMakePreparationObservation(fieldReady=false){return new Function('selector',`return {overlay:(${ordinaryRanchOverlayState.toString()})(selector),three:${fieldReady?'('+friendsThreeSnapshot.toString()+')()':'null'}};`);}
function friendsMakePreparationPoll(fieldReady=false){return new Function('selector',`const s=(${friendsMakePreparationObservation(fieldReady).toString()})(selector);const friendsThreeSnapshotReady=(${friendsThreeSnapshotReady.toString()});const friendsRecognizedOverlay=(${friendsRecognizedOverlay.toString()});return (${friendsPreparationReady.toString()})(s,${fieldReady})?s:false;`);}
async function friendsObservePreparation(api){
 const row={fieldReady:api.fieldReady,startedAt:api.wall()};api.record(row);
 try{row.initial=await api.observe();api.write();let left=api.deadline-api.now();assert.ok(left>0,'Original ordinary UI deadline exhausted');
  if(friendsPreparationReady(row.initial,api.fieldReady)){row.final=row.initial;row.waited=false;}
  else{row.waited=true;row.pollBudgetMs=left;api.write();row.final=await api.poll(left);}
  assert.ok(api.now()<api.deadline,'Original ordinary UI deadline exhausted');assert.ok(friendsPreparationReady(row.final,api.fieldReady));api.write();return row.final.overlay;
 }catch(error){row.error=String(error.stack||error);api.write();throw error;}
}
function friendsThreeProgress(before,after){
 for(const state of [before,after]){
  assert.equal(state.canvasCount,1,'Unique actual Three renderer required');
  assert.equal(state.fallbackCount,0,'No fallback renderer allowed');
  assert.equal(state.loadState,'ready');assert.equal(state.busy,'false');
  assert.ok(state.width>0&&state.height>0&&state.visible,'Actual Three canvas visible');
  assert.ok(Number.isSafeInteger(state.frames)&&state.frames>0,'Actual Three frame counter required');
 }
 assert.ok(after.frames>before.frames,'Actual Three frames must advance across normal camera gestures');
}
// Same-state DOM observation only; serialized functions contain no app/state access.
function friendsMenuDomState({group,entry}){
    const controls=[...document.querySelectorAll(`button.cm-toolbar__cell[data-menu-id="${group}"]`)],control=controls[0];
    const panels=[...document.querySelectorAll('.cm-toolbar__menu:not([hidden])')],panel=panels[0];
    const visible=el=>Boolean(el&&!el.hidden&&el.getClientRects().length&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden');
    return {buttonCount:controls.length,buttonVisible:visible(control),buttonEnabled:Boolean(control&&!control.disabled),expanded:control?.getAttribute('aria-expanded')==='true',openMenu:panels.length===0?null:panels.length===1?panel.dataset.menuId:'MULTIPLE_OPEN_MENUS',entryCount:panel?.dataset.menuId===group?panel.querySelectorAll(`button[data-entry-id="${entry}"]`).length:0};
}
function friendsMakeMenuObservation(overlayReader){
 // Playwright serializes functions without Node closures. Embed only these exact
 // local read-only helpers; no page globals or production functions are installed.
 return new Function('input',`const readOverlay=(${overlayReader.toString()});const readState=(${friendsMenuDomState.toString()});const calendar=document.querySelector('.int-rh2-calendar');return {overlay:readOverlay(input.selector),calendarAbsentOrHidden:!calendar||calendar.hidden,state:readState(input)};`);
}
async function friendsInspectMenu(api,deadline){
 const snapshot=await api.observe();
 // Disabled/visible calendars, known dialogs, animations and unknown obstruction
 // retain the full existing acknowledgment/wait path and a fresh state read.
 if(snapshot.overlay?.kind==='canvas'&&snapshot.calendarAbsentOrHidden===true)return {handled:[],state:snapshot.state};
 const handled=await api.clear(deadline);return {handled,state:await api.state()};
}
function friendsRecognizedOverlay(value){return value?.kind==='calendar'||value?.kind==='registration-notice-94';}
async function friendsMenuTransaction(api){
 // One 90s wall-clock budget for the entire transaction; never extend it on re-open.
 const deadline=api.now()+90000;let first=true;
 const remaining=()=>{const left=deadline-api.now();assert.ok(left>0,'Original menu deadline exhausted');return Math.min(30000,left);};
 for(;;){
  remaining();const handled=await api.clear(deadline);remaining();
  const state=await api.state();remaining();
  assert.equal(state.buttonCount,1,'Exactly one live group control required');assert.ok(state.buttonVisible&&state.buttonEnabled,'Normal visible enabled group control required');
  assert.ok(state.openMenu===null||state.openMenu===api.group,'Unexpected nonmatching open menu');
  if(state.openMenu===api.group){assert.equal(state.expanded,true);assert.equal(state.entryCount,1,'Exact live entry required');}
  else assert.equal(state.expanded,false,'Closed menu must have collapsed group control');
  try{
   if(state.openMenu===null){
    const reopening=!first;
    if(reopening){assert.equal(api.group,'SYSTEM','Only the observed SYSTEM interruption authorizes re-open');assert.ok(handled.length>0&&handled.every(friendsRecognizedOverlay),'Re-open requires an actually acknowledged known overlay');}
    const before=reopening?registrationNoticeInvariant(await api.saved()):null;
    // A timed-out click may already have dispatched. Never retry it as a new initial click.
    first=false;await api.clickGroup(remaining());
    if(reopening){const after=registrationNoticeInvariant(await api.saved());api.record({menuReopened:api.group,entry:api.entry,normalUi:true,handled,before,after});assert.deepEqual(after,before,'Menu re-open cannot change economy or registrations');}
    continue;
   }
   first=false;await api.clickEntry(remaining());return;
  }catch(error){
   if(error.name!=='TimeoutError'||api.now()>=deadline||!friendsRecognizedOverlay(await api.observeOverlay()))throw error;
   // Only the next loop's normal UI acknowledgment authorizes a re-open.
  }
 }
}
async function friendsGuardedRoute(operation,onFailure,abort){
 try{return await operation();}
 catch(error){
  // Persist the real error before awaiting any cleanup. Never retry or whitelist it.
  onFailure(error,null);
  try{await abort();}catch(abortError){onFailure(error,abortError);}
 }
}

// Test-only wall-time boundary ledger; no browser RPC, simulation or clock mutation.
async function friendsAwaitBoundary(api,label,action){
 const parent=api.current?.()??null;const row={id:api.rows.length,parentId:parent?.id??null,label,startedAt:api.wall(),startedMs:api.now(),status:'RUNNING',cpuStart:api.cpu()};api.rows.push(row);api.active(row);api.write();
 try{const value=await action();row.status='PASS';return value;}
 catch(error){row.status='FAIL';row.error=String(error.stack||error);throw error;}
 finally{row.endedAt=api.wall();row.elapsedMs=api.now()-row.startedMs;row.cpuEnd=api.cpu();api.active(parent);api.write();}
}
function friendsToolSnapshot({selector,tool}){
 const visible=el=>Boolean(el&&!el.hidden&&el.getClientRects().length&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden');
 const all=[...document.querySelectorAll(`button.cm-toolbar__cell[data-icon="${tool}"]`)];const button=all[0];
 return {count:all.length,visible:visible(button),enabled:Boolean(button&&!button.disabled),pressed:button?.getAttribute('aria-pressed')==='true',bodyTool:document.body.dataset.tool??null};
}
function friendsMakeToolObservation(){return new Function('input',`return {overlay:(${ordinaryRanchOverlayState.toString()})(input.selector),state:(${friendsToolSnapshot.toString()})(input)};`);}
async function friendsToolTransaction(api){
 const deadline=api.now()+90000;const left=()=>{const n=deadline-api.now();assert.ok(n>0,'Original tool deadline exhausted');return n;};let attempted=false;
 for(;;){
  left();const observation=await api.observe();left();api.record({kind:'tool-observation',tool:api.tool,observation,attempted});
  if(observation.overlay?.kind!=='canvas'){
   assert.ok(friendsRecognizedOverlay(observation.overlay),'Unknown tool obstruction must fail');
   const handled=await api.clear(deadline);left();assert.ok(handled.some(friendsRecognizedOverlay),'Observed native overlay must be normally acknowledged');api.record({kind:'tool-overlay-ack',tool:api.tool,handled});continue;
  }
  const state=observation.state;assert.equal(state.count,1);assert.ok(state.visible&&state.enabled,'Normal visible enabled tool required');
  if(state.pressed){api.record({kind:'tool-already-selected',tool:api.tool,attempted});return;}
  try{attempted=true;await api.click(Math.min(30000,left()));left();const after=await api.observe();left();api.record({kind:'tool-after-click',tool:api.tool,observation:after});
   if(after.state.pressed){assert.ok(after.overlay?.kind==='canvas'||friendsRecognizedOverlay(after.overlay),'Unknown postclick obstruction');if(after.overlay?.kind==='canvas')return;}
   assert.ok(friendsRecognizedOverlay(after.overlay),'Tool click did not select target and no recognized native overlay explains it');
  }catch(error){if(error.name!=='TimeoutError')throw error;const after=await api.observe();left();api.record({kind:'tool-click-timeout',tool:api.tool,observation:after,error:String(error)});assert.ok(friendsRecognizedOverlay(after.overlay),'Unclassified tool timeout remains fatal');}
 }
}
function friendsFieldCaptureReady(state){
 assert.equal(state.overlay?.kind,'canvas','Raw phase capture is not unobstructed field evidence');assert.ok(state.three);assert.equal(friendsThreeSnapshotReady(state.three),true,'Raw phase capture field must be actually ready');return true;
}
function friendsMakeFieldObservation(){return new Function('selector',`return {overlay:(${ordinaryRanchOverlayState.toString()})(selector),three:(${friendsThreeSnapshot.toString()})()};`);}

// END FRIENDS PUBLIC THREE / MENU / ROUTE CONTRACTS

(async()=>{
 // The 40° ranch view (2026-10-27) squeezes the ground vertically; bodies keep the horizontal scale.
 const {groundScaleY}=(await import(require('node:url').pathToFileURL(path.join(__dirname,'../src/championship/presentation/ranchThreeCoordinates.js')).href)).ranchViewProjection();
 const build=JSON.parse(fs.readFileSync(path.join(root,'pages-build.json')));evidence.buildId=build.buildId;assert.equal(build.target,'GITHUB_PAGES_OWNER_PLAYTEST');assert.equal(build.publicPlaytest?.ownerApproved,true);
 assert.ok(resolveAsset(root,'/championship.html'));
 assert.equal(resolveAsset(root,'/full-qa-save.html'),null,'Private QA installer must stay outside the public build');
 assert.equal(resolveAsset(root,'/qa/championship-full-qa-save.json'),null,'Private QA seed must stay outside the public build');
 const fixtures=await createInstallerFixtures(path.resolve(__dirname,'..'));
 // Explicit historical wallet, not a grant from the game or a change to the QA seed.
 const historicalWalletSeed={...fixtures.seed,flags:{...fixtures.seed.flags,friendsPlaytest:{version:1,grants:[],diamonds:10000,purchases:[]}}};
 // Partner life (Owner 2026-10-28): partners may find items while the ranch is
 // open. Only finds the later save's stroll log records may change the bag.
 const STROLL_RECORDS={feed:0,protein:1,medicine:2,woundMedicine:3};
 const expectedShop=(shop,later=null,baseline=null)=>{
  const base={...shop,cageQuantities:shop.cageQuantities??Object.fromEntries(shop.cageOwned.map(id=>[id,1]))};
  const since=baseline?.raising?.nativeHome?.strollLog?.sequence??0,entries=(later?.raising?.nativeHome?.strollLog?.entries??[]).filter(e=>e.id>since);
  if(!entries.length)return base;
  const quantities=[...base.quantities];let bits=base.bits;
  for(const e of entries){if(e.reward in STROLL_RECORDS)quantities[STROLL_RECORDS[e.reward]]+=e.quantity;else if(e.reward==='bits')bits=Math.min(9999999,bits+30*e.quantity);}
  return {...base,quantities,bits};
 };
 // Bits a later save's stroll log adds after a log sequence and/or a wall-clock time.
 const strollBits=(later,{since=0,after=0}={})=>(later?.raising?.nativeHome?.strollLog?.entries??[])
  .filter(e=>e.id>since&&e.at>after&&e.reward==='bits').reduce((sum,e)=>sum+30*e.quantity,0);
 const strollSequence=save=>save?.raising?.nativeHome?.strollLog?.sequence??0;
 // Hex cage world (Owner 2026-10-26): loading a 10x10 save moves it 8 rows / 7 columns into the
 // 24-wide world (productRanchGrid.legacyGrid100SlotToWorld), so a legacy anchor keeps its layout.
 const legacyToWorld=s=>{const row=s<40?Math.floor(s/20)*2+s%2:4+Math.floor((s-40)/10),column=s<40?Math.floor((s%20)/2):(s-40)%10;return (row+8)*24+column+7;};
 const expectedPlacements=placements=>placements.map(p=>({...p,slotIndex:legacyToWorld(p.slotIndex),instanceId:p.instanceId??`cage:legacy:${p.moduleId.endsWith(':waiting-room')?35:p.moduleId.split(':').at(-1)}`}));
 const server=await serveBuild(root);let browser,context,page;
 async function fresh(label){
  if(context){await context.tracing.stop({path:path.join(output,evidence.context+'-trace.zip')});await context.close();}
  evidence.context=label;
  context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',acceptDownloads:true,serviceWorkers:'block'});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.route('**/*',async route=>friendsGuardedRoute(async()=>{
   const url=route.request().url();
   if(url.startsWith(server.origin+'/'))return route.continue();
   if(url.startsWith(publicBase)){
    const parsed=new URL(url),relative=parsed.pathname.slice(new URL(publicBase).pathname.length);
    const fixture=fixtures.route('/'+relative);
    if(fixture&&label==='historical-wallet'&&relative==='qa/championship-full-qa-save.json')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(historicalWalletSeed),headers:{'Cache-Control':'no-store'}});
    if(fixture)return route.fulfill({status:200,...fixture,headers:{'Cache-Control':'no-store'}});
    if(resolveAsset(root,'/'+relative)){const response=await route.fetch({url:server.origin+'/'+relative+parsed.search,maxRedirects:0});return route.fulfill({response});}
   }
   evidence.networkErrors.push({context:label,url,error:'NON_BUILD_REQUEST_BLOCKED'});return route.abort();
  },(error,abortError)=>{
   const row={context:label,url:route.request().url(),method:route.request().method(),resourceType:route.request().resourceType(),at:new Date().toISOString(),sourceCornerStage:evidence.sourceCornerStage??null,activeMenu:evidence.activeMenu??null,error:String(error.stack||error),abortError:abortError?String(abortError.stack||abortError):null};
   evidence.routeErrors.push(row);evidence.networkErrors.push({...row,error:'BUILD_ROUTE_FAILURE: '+error.message});evidence.status='FAIL';process.exitCode=1;write();
  },()=>route.abort('failed')));
  page=await context.newPage();page.setDefaultTimeout(90000);
  page.on('requestfailed',r=>{const error=r.failure()?.errorText;if(error!=='net::ERR_ABORTED')evidence.networkErrors.push({context:label,url:r.url(),error});});
  page.on('pageerror',e=>evidence.pageErrors.push({context:label,error:e.message}));
  page.on('console',m=>evidence.console.push({context:label,type:m.type(),text:m.text()}));
  page.on('response',r=>{if(r.status()>=400)evidence.networkErrors.push({context:label,url:r.url(),status:r.status()});});
 }
 const shot=name=>page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey); // Read only.
 const boundary=(label,action)=>{if(!evidence.sourceCoverage)return action();const rows=evidence.awaitBoundaries??=[];return friendsAwaitBoundary({rows,now:()=>performance.now(),wall:()=>new Date().toISOString(),cpu:()=>process.cpuUsage(),current:()=>evidence.activeAwait??null,active:row=>{evidence.activeAwait=row;},write},label,action);};
 const sourceTool=async tool=>{
  if(!evidence.sourceCoverage)return page.locator(`button.cm-toolbar__cell[data-icon="${tool}"]`).click();
  return boundary('tool:'+tool,()=>friendsToolTransaction({tool,now:()=>Date.now(),observe:()=>page.evaluate(friendsMakeToolObservation(),{selector:ranchCanvasSelector,tool}),clear:deadline=>clearCalendar(deadline),click:timeout=>page.locator(`button.cm-toolbar__cell[data-icon="${tool}"]`).click({timeout}),record:row=>{(evidence.toolTransactions??=[]).push({...row,at:new Date().toISOString()});write();}}));
 };
 const sourceShot=async label=>{
  const row={label,startedAt:new Date().toISOString()};(evidence.fieldCaptures??=[]).push(row);write();
  row.before=await boundary('capture-observe-before:'+label,()=>page.evaluate(friendsMakeFieldObservation(),ranchCanvasSelector));write();
  await boundary('screenshot:'+label,()=>shot(label));row.rawPngRetained=true;write();
  row.after=await boundary('capture-observe-after:'+label,()=>page.evaluate(friendsMakeFieldObservation(),ranchCanvasSelector));write();
  // Preserve raw screenshot before rejecting invalid/covered evidence. Never auto-recapture.
  friendsFieldCaptureReady(row.before);friendsFieldCaptureReady(row.after);row.validFieldBoundary=true;write();
 };

 async function login(){
  await page.locator('#cm-login').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
  if(await page.locator('#cm-film-skip').isVisible()){
   await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});
   await page.waitForTimeout(400); // Respect the real film input guard, never alter clocks.
  }
  await page.locator('#cm-login').click();await page.locator('#cm-new-game').waitFor({state:'visible'});
 }
 async function screen(name){await page.locator(`#cm-root[data-active-screen="${name}"]`).waitFor();}
 // Three supplies visuals underneath; the unique Pixi canvas owns real input.
 const ranchCanvasSelector='#cm-root[data-active-screen="RAISING_HOME"] canvas.cm-raising-pixi-canvas';
 async function ranchCanvas(){const canvas=page.locator(ranchCanvasSelector);await canvas.waitFor({state:'visible',timeout:180000});assert.equal(await canvas.count(),1,'Exactly one ranch input canvas');assert.notEqual(await canvas.evaluate(el=>getComputedStyle(el).pointerEvents),'none','Ranch canvas must receive ordinary input');return canvas;}
 async function home(){await screen('RAISING_HOME');await page.locator('button.cm-toolbar__cell[data-menu-id="MANAGEMENT"]').waitFor();await ranchCanvas();await page.waitForFunction(()=>{const h=document.querySelector('.int-rh2-field-host');const a=JSON.parse(h?.dataset.residentAssets||'[]');return h?.dataset.loadState==='ready'&&a.length>0&&a.every(x=>x.state==='ready');},{},{timeout:180000});assert.equal(await page.locator('[data-field-fallback="true"]').count(),0);}
 async function menu(group,entry){
  evidence.activeMenu={group,entry};write();
  const groupControl=()=>page.locator(`button.cm-toolbar__cell[data-menu-id="${group}"]`);
  const entryControl=()=>page.locator(`.cm-toolbar__menu:not([hidden])[data-menu-id="${group}"] button[data-entry-id="${entry}"]`);
  const observeMenu=friendsMakeMenuObservation(ordinaryRanchOverlayState);let inspectedState=null;
  await friendsMenuTransaction({group,entry,now:()=>Date.now(),saved,
   clear:async deadline=>{const result=await friendsInspectMenu({
    observe:()=>page.evaluate(observeMenu,{group,entry,selector:ranchCanvasSelector}),
    clear:value=>clearCalendar(value),state:()=>page.evaluate(friendsMenuDomState,{group,entry})
   },deadline);inspectedState=result.state;return result.handled;},
   state:async()=>{assert.ok(inspectedState,'Same-state menu observation required');return inspectedState;},
   clickGroup:timeout=>groupControl().click({timeout}),clickEntry:timeout=>entryControl().click({timeout}),
   observeOverlay:()=>page.evaluate(ordinaryRanchOverlayState,ranchCanvasSelector),
   record:row=>{evidence.assertions.push(row);write();}
  });
  evidence.activeMenu=null;write();
 }
 // Owner 2026-10-27: while the dock shows Hunt, Battle, Shop and Database, the System menu does not repeat them.
 async function dock(entry){const key=page.locator(`button[data-quick-id="${entry}"]`);if(!await key.isVisible())return menu('SYSTEM',entry);await clearCalendar();await key.click();}
 async function saveQuit(){await menu('SYSTEM','saveQuit');await page.locator('#cm-login').waitFor({state:'visible'});}
 async function continueSaved(){await login();await page.locator('#cm-continue').click();await home();}
 async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile document must not overflow');}
 // Read-only renderer diagnostics plus ordinary camera gestures, never private state.
 async function topContour(label){
  const host=page.locator('.int-rh2-field-host');
  const read=()=>host.evaluate(h=>({width:h.clientWidth,height:h.clientHeight,positions:JSON.parse(h.dataset.residentScreenPositions||'[]')}));
  const before=await saved();
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
   await page.setViewportSize(viewport);await home();await page.waitForTimeout(800);
   let state=await read();assert.ok(state.positions.length,'Top-edge evidence needs renderer diagnostics');
   for(let gesture=0;gesture<8&&state.positions[0].scrollY<state.positions[0].scrollMaxY-1;gesture++){
    const canvas=await ranchCanvas();
    // Start in empty upper sky, excluding generous bounds around every actor.
    const previous=state.positions[0].scrollY;
    const {box,start:{x,y}}=await beginCanvasDrag(canvas,box=>[80,180,Math.min(320,box.height/2)].flatMap(y=>[20,box.width/4,box.width/2,box.width*3/4,box.width-20].map(x=>({x,y}))).filter(({x,y})=>state.positions.every(p=>Math.abs(p.x-x)>110||y<p.bodyTop-35||y>p.footY+35)),'A safe empty canvas drag origin must exist',{width:0,height:160});
    await page.mouse.move(box.x+x,box.y+Math.min(box.height-90,y+360),{steps:18});await page.mouse.up();await page.waitForTimeout(250);
    state=await read();assert.ok(state.positions[0].scrollY>previous,'Normal blank-field drag must reveal upper headroom');
   }
   const first=state.positions[0];assert.ok(first.scrollMaxY-first.scrollY<=1,'Camera reached upper presentation bound');
   assert.ok(first.boardTop-24*first.nativeScreenPixels*groundScaleY>=0,'Entire restored hex cap is inside viewport');
   for(const p of state.positions){if(p.groundScreen&&Number.isFinite(p.nativeY))assert.ok(Math.abs(p.groundScreen.y-(p.boardTop+p.nativeY*p.nativeScreenPixels*groundScaleY))<1,'Actor ground and native grid retain the same transform');}
   evidence.assertions.push({topContour:label,viewport,state});write();await shot(label+'-top-contour-'+viewport.width);
  }
  const after=await saved();assert.deepEqual(after.cageEdit.placements,before.cageEdit.placements,'Camera gestures cannot move slot anchors');assert.deepEqual(after.shop,before.shop,'Camera gestures cannot alter economy or inventory');
 }
 // Legacy saves do not enable developer actor telemetry. Capture them via
 // public camera gestures; inspect these screenshots alongside fresh-save
 // numeric cap/ground assertions rather than inventing legacy diagnostics.
  // Long visual sweeps can cross midnight. Only the calendar and exact system94 are acknowledged.
 async function clearCalendar(deadline=null,{fieldReady=false}={}){
   deadline??=Date.now()+90000;
   const handled=[];
   const left=()=>{if(deadline===null)return 90000;const value=deadline-Date.now();assert.ok(value>0,'Menu deadline exhausted during ordinary overlay');return value;};
   for(;;){
    const observed=await friendsObservePreparation({fieldReady,deadline,now:()=>Date.now(),wall:()=>new Date().toISOString(),record:row=>{(evidence.ordinaryPreparation??=[]).push(row);write();},write,
     observe:()=>page.evaluate(friendsMakePreparationObservation(fieldReady),ranchCanvasSelector),
     poll:async timeout=>{const handle=await page.waitForFunction(friendsMakePreparationPoll(fieldReady),ranchCanvasSelector,{timeout});try{return await handle.jsonValue();}finally{await handle.dispose();}}
    });
    if(observed.kind==='canvas')return handled;
    if(observed.kind==='registration-notice-94'){
     const beforeSave=await saved(),before=registrationNoticeInvariant(beforeSave);
     const receipt={ordinarySystemRegistrationAcknowledged:false,normalUi:true,observed,before,
      scope:'Persisted economy/registration invariants only; native clock/profile/message state may advance normally'};
     evidence.assertions.push(receipt);write();
     const letter=page.locator('.int-rh2-letter[data-system="true"]:visible').filter({has:page.locator('.int-rh2-letter__text').filter({hasText:/^已到戰鬥入場登錄時間。$/})});
     assert.equal(await letter.count(),1,'Exactly one observed system94 dialog');
     const confirm=letter.getByRole('button',{name:'確認',exact:true});
     assert.equal(await confirm.count(),1);assert.equal(await confirm.isEnabled(),true,'Only enabled normal confirmation may be clicked');
     await confirm.click({timeout:left()});await letter.waitFor({state:'hidden',timeout:left()});
     receipt.after=registrationNoticeInvariant(await saved());write();
     assert.deepEqual(receipt.after,before,'System94 acknowledgement cannot alter persisted economy or registrations');
     receipt.ordinarySystemRegistrationAcknowledged=true;handled.push(observed);write();continue;
    }
    const calendar=page.locator('.int-rh2-calendar');
    assert.equal(observed.kind,'calendar','Only the actually observed enabled native calendar can be acknowledged');
    await calendar.click({timeout:left()});await page.waitForTimeout(250);handled.push({kind:'calendar',priorObserved:observed.kind});
    evidence.assertions.push({ordinaryCalendarAcknowledged:true,normalUi:true});write();
   }
  }

 // A date/lifecycle overlay can appear after a prior clearCalendar await.
 // Re-hit-test this gesture's exact candidates immediately before real input.
 // Only ordinary known UI is acknowledged; unknown obstruction still fails.
 async function beginCanvasDrag(canvas,makeCandidates,message,minimum={width:0,height:0}){
  const deadline=Date.now()+90000;
  const knownOverlay=()=>page.evaluate(()=>{
   const calendar=document.querySelector('.int-rh2-calendar'),layer=document.querySelector('.int-rh2-lifecycle');
   return Boolean(calendar&&!calendar.hidden||layer&&!layer.hidden||document.querySelector('.cm-ceremony'));
  });
  while(Date.now()<deadline){
   await clearCalendar();
   const box=await canvas.boundingBox();
   assert.ok(box&&box.width>minimum.width&&box.height>minimum.height,'Canvas bounds must support ordinary drag');
   const candidates=makeCandidates(box);
   const start=await canvas.evaluate((canvas,{box,candidates})=>candidates.find(({x,y})=>document.elementFromPoint(box.x+x,box.y+y)===canvas),{box,candidates});
   if(!start&&await knownOverlay())continue;
   assert.ok(start,message);
   await page.mouse.move(box.x+start.x,box.y+start.y);
   const stillClear=await canvas.evaluate((canvas,{x,y})=>document.elementFromPoint(x,y)===canvas,{x:box.x+start.x,y:box.y+start.y});
   if(!stillClear&&await knownOverlay())continue;
   assert.ok(stillClear,message+' after pointer positioning');
   await page.mouse.down();
   return {box,start};
  }
  assert.fail(message+' timed out waiting for ordinary date/lifecycle UI');
 }

 async function legacyTopContour(label,viewports=[{width:1280,height:800},{width:390,height:844}]){
  const before=await boundary('saved:read-only',()=>saved());
  for(const viewport of viewports){
   await boundary('viewport:'+viewport.width,()=>page.setViewportSize(viewport));await boundary('home',()=>home());await boundary('wait:800',()=>page.waitForTimeout(800));
   // Clean-mode swipes pan even when begun on an actor; only a tap cleans.
   // Every gesture below exceeds the drag threshold and stays on the canvas.
   await boundary('clearCalendar',()=>clearCalendar());
   await sourceTool('clean');
   await boundary('wait:body-tool-clean',()=>page.waitForFunction(()=>document.body.dataset.tool==='clean'));
   const canvas=await boundary('canvas:ready',()=>ranchCanvas());
   for(let gesture=0;gesture<4;gesture++){
    const {box,start}=await boundary('beginCanvasDrag',()=>beginCanvasDrag(canvas,box=>[180,270].flatMap(y=>[20,box.width/2,box.width-20].map(x=>({x,y}))),'Legacy camera swipe must start on unobstructed canvas',{width:0,height:500}));
    await boundary('mouse.move',()=>page.mouse.move(box.x+start.x,box.y+Math.min(box.height-120,start.y+420),{steps:20}));await boundary('mouse.up',()=>page.mouse.up());await boundary('wait:250',()=>page.waitForTimeout(250));
   }
   await boundary('clearCalendar',()=>clearCalendar());
   await sourceTool('hand');await boundary('mouse.move',()=>page.mouse.move(1,1));await boundary('wait:300',()=>page.waitForTimeout(300));
   evidence.assertions.push({topContour:label,viewport,ordinaryCameraSwipes:4,legacyTelemetry:'NOT_ENABLED',visualReviewRequired:true});write();await boundary('clearCalendar',()=>clearCalendar(null,{fieldReady:Boolean(evidence.sourceCoverage)}));await (evidence.sourceCoverage?sourceShot(label+'-top-contour-'+viewport.width):shot(label+'-top-contour-'+viewport.width));
  }
  const after=await boundary('saved:read-only',()=>saved());assert.deepEqual(after.cageEdit.placements,before.cageEdit.placements);assert.deepEqual(after.shop,before.shop,'Swipes cannot spend food or change inventory');
 }
 // Separate installed QA profile: normal editor clicks only, never real player data.
 async function sourceCornerReview(caseId){
  const selected=sourceCase(caseId);assert.ok(selected,'Exact source case required');
  await fresh(caseId);evidence.sourceCornerStage='install';
  const coverage={caseId,scenario:selected.scenario,viewport:selected.viewport,topGestures:0,framingGestures:0,panGestures:0,phaseCaptures:[],setup:[],persistence:false,three:false,readbacks:false,continuity:'INDEPENDENT_VIEWPORT_NOT_CROSS_VIEWPORT_CLOCK_OR_CAMERA'};evidence.sourceCoverage=coverage;write();
  const threeResponses=[],threeResponseReads=[];evidence.sourceThreeResponses=threeResponses;
  const onThreeResponse=response=>{
   const expected=FRIENDS_THREE_RESOURCES.find(row=>response.url()===publicBase+row.path);if(!expected)return;
   const row={path:expected.path,url:response.url(),status:response.status()};threeResponses.push(row);
   threeResponseReads.push((async()=>{try{const bytes=await response.body();row.bytes=bytes.length;row.sha256=require('node:crypto').createHash('sha256').update(bytes).digest('hex');}catch(error){row.error=String(error.stack||error);evidence.networkErrors.push({context:'source-corners',url:response.url(),error:'THREE_RESPONSE_READ_FAILURE: '+error.message});}finally{write();}})());
  };page.on('response',onThreeResponse);
  const readThree=async()=>{
   const started=Date.now(),row={stage:evidence.sourceCornerStage};(evidence.sourceThreeReadiness??=[]).push(row);
   try{
    row.initial=await page.evaluate(friendsThreeSnapshot,{includeRenderer:true});write();
    const remaining=90000-(Date.now()-started);assert.ok(remaining>0,'Three readiness operation budget exhausted');
    if(friendsThreeSnapshotReady(row.initial)){row.final=row.initial;row.waited=false;row.elapsedMs=Date.now()-started;write();return row.final;}
    row.waited=true;row.pollBudgetMs=remaining;write();
    const handle=await page.waitForFunction(friendsMakeThreeReadiness(),undefined,{timeout:remaining});
    try{row.final=await handle.jsonValue();}finally{await handle.dispose();}
    assert.equal(friendsThreeSnapshotReady(row.final),true);row.elapsedMs=Date.now()-started;assert.ok(row.elapsedMs<90000,'Three readiness operation budget exhausted');write();return row.final;
   }catch(error){row.error=String(error.stack||error);write();throw error;}
  };
  await boundary('installer-navigation',()=>page.goto(publicBase+'full-qa-save.html',{waitUntil:'domcontentloaded'}));
  await boundary('installer:button-visible',()=>page.locator('#install').waitFor());await boundary('installer:button-enabled',()=>page.waitForFunction(()=>!document.querySelector('#install').disabled));
  await boundary('installer:click',()=>page.locator('#install').click());await boundary('installer:wait-url',()=>page.waitForURL(/championship\.html$/));await boundary('continueSaved',()=>continueSaved());
  const installed=await boundary('saved:read-only',()=>saved());coverage.baseline={fixtureSeedSha256:require('node:crypto').createHash('sha256').update(JSON.stringify(fixtures.seed)).digest('hex'),schemaVersion:installed.schemaVersion,layoutVersion:installed.cageEdit.layoutVersion,shop:installed.shop,placements:installed.cageEdit.placements.map(({moduleId,slotIndex})=>({moduleId,slotIndex})).sort((a,b)=>a.moduleId.localeCompare(b.moduleId))};write();
  // Hex cage world (Owner 2026-10-26): the former 10x10 slots 4 / 8 / 7 / 19 sit at world
  // slots 201 / 203 / 226 / 232 (same relative layout); the world no longer wraps, so the
  // 'wrap' case is now a set of apart cages, still rendered and persisted the same way.
  for(const scenario of [{name:'adjacent',slots:[201,203,226]},{name:'wrap',slots:[201,203,232]}]){
   if(selected.scenario==='adjacent'&&scenario.name==='wrap')break;
   evidence.sourceCornerStage=scenario.name+':editor';write();
   await boundary('viewport:editor',()=>page.setViewportSize({width:1280,height:800}));await boundary('clearCalendar',()=>clearCalendar());await boundary('menu:cageEdit',()=>menu('MANAGEMENT','cageEdit'));await boundary('screen:CAGE_EDIT',()=>screen('CAGE_EDIT'));
   // One-screen editor (2026-10-27): placed cages list under the 場上已放置 tab, cages in hand under their size tab.
   const placedTab=page.locator('.cm-cage-filter[data-filter="placed"]');if(await placedTab.isVisible())await boundary('editor:filter:placed',()=>placedTab.click());
   while(await page.locator('.cm-cage-facility:not([disabled]):not([hidden])').count())await boundary('editor:withdraw',()=>page.locator('.cm-cage-facility:not([disabled]):not([hidden])').first().click());
   const specs=[{id:'02',definition:1},{id:'18',definition:17},{id:'39',definition:33}];
   for(const [i,spec] of specs.entries()){
    const row=page.locator('.cm-vs2-cage-tray__item').filter({has:page.locator(`img[src*="field_cm${spec.id}_01"]`)});
    assert.equal(await row.count(),1,'Exact field image identifies one owned facility');
    for(const tab of await page.locator('.cm-cage-filter:not([data-filter="placed"])').all()){if(await row.isVisible())break;if(await tab.isVisible())await boundary('editor:filter:'+spec.id,()=>tab.click());}
    await boundary('editor:tray:'+spec.id,()=>row.click());
    const slot=page.locator(`.cm-vs2-cage-slot[data-slot-index="${scenario.slots[i]}"]`);
    assert.equal(await slot.getAttribute('data-unlocked'),'true');assert.equal(await slot.getAttribute('data-filled'),'false');await boundary('editor:slot:'+scenario.slots[i],()=>slot.click());
   }
   await boundary('editor:confirm',()=>page.locator('#cm-root[data-active-screen="CAGE_EDIT"] .cm-vs2-footer button.cm-vs2-action--primary').click());
   await boundary('editor:return-home',()=>page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click());await boundary('home',()=>home());await boundary('saveQuit',()=>saveQuit());
   const placed=await boundary('saved:read-only',()=>saved());
   assert.deepEqual(placed.cageEdit.placements.map(p=>({moduleId:p.moduleId,slotIndex:p.slotIndex})).sort((a,b)=>a.moduleId.localeCompare(b.moduleId)),[
    {moduleId:'championship:2026:cage:waiting-room',slotIndex:199},...specs.map((s,i)=>({moduleId:`championship:2026:cage:${s.definition}`,slotIndex:scenario.slots[i]}))
   ].sort((a,b)=>a.moduleId.localeCompare(b.moduleId)));
   assert.deepEqual(placed.shop,expectedShop(installed.shop,placed,installed),'Editor-only inspection must preserve entire wallet and inventory');await boundary('continueSaved',()=>continueSaved());
   const reloadedPlacement=await boundary('saved:read-only',()=>saved());assert.deepEqual(reloadedPlacement.cageEdit.placements,placed.cageEdit.placements);assert.deepEqual(reloadedPlacement.shop,expectedShop(installed.shop,reloadedPlacement,installed));
   assert.equal(reloadedPlacement.schemaVersion,7);assert.equal(reloadedPlacement.cageEdit.layoutVersion,'PRODUCT_HEX_WORLD_V1');
   coverage.setup.push({schemaVersion:reloadedPlacement.schemaVersion,layoutVersion:reloadedPlacement.cageEdit.layoutVersion,scenario:scenario.name,slots:scenario.slots,placements:placed.cageEdit.placements.map(({moduleId,slotIndex})=>({moduleId,slotIndex})).sort((a,b)=>a.moduleId.localeCompare(b.moduleId)),shop:placed.shop,reloaded:true});write();
   if(scenario.name!==selected.scenario)continue;
   evidence.sourceCornerStage=scenario.name+':visual';write();
   // These product-grid fields use verified Three GLBs, not unused 2D padded atlases.
   await boundary('Three:response-readbacks',()=>Promise.all(threeResponseReads));const resourceIdentity=friendsThreeIdentity(threeResponses),threeBefore=await boundary('readThree:before',()=>readThree());
   // The existing legacy helper reaches upper headroom through real tool swipes.
   await legacyTopContour('08-source-'+scenario.name,[selected.viewport]);coverage.topGestures=4;write();
   for(const viewport of [selected.viewport]){
    await boundary('viewport:'+viewport.width,()=>page.setViewportSize(viewport));await boundary('home',()=>home());await boundary('wait:500',()=>page.waitForTimeout(500));await boundary('clearCalendar',()=>clearCalendar());
    await sourceTool('clean');await boundary('wait:body-tool-clean',()=>page.waitForFunction(()=>document.body.dataset.tool==='clean'));
    const canvas=await boundary('canvas:ready',()=>ranchCanvas());
    // Top-headroom proof was captured above; lift the field 100px so lower tips clear the toolbar.
    if(viewport.width===1280){
     const {box,start}=await boundary('beginCanvasDrag',()=>beginCanvasDrag(canvas,box=>[260,320,380].map(y=>({x:box.width-35,y})),'Lower-tip framing must begin on unobstructed canvas'));
     await boundary('mouse.move',()=>page.mouse.move(box.x+start.x,box.y+start.y-100,{steps:20}));await boundary('mouse.up',()=>page.mouse.up());await boundary('wait:250',()=>page.waitForTimeout(250));coverage.framingGestures++;write();
    }
    const count=viewport.width<500?9:6;
    for(let pan=0;pan<count;pan++){
     // Real elapsed time: two 170ms samples bracket the 334.302ms sea phases.
     for(let frame=0;frame<3;frame++){await boundary('wait:170',()=>page.waitForTimeout(170));await boundary('capture-ready',()=>clearCalendar(null,{fieldReady:true}));await sourceShot(`08-source-${scenario.name}-${viewport.width}-pan${pan}-phase${frame}`);coverage.phaseCaptures.push({pan,phase:frame});write();}
     const {box,start}=await boundary('beginCanvasDrag',()=>beginCanvasDrag(canvas,box=>[180,260,Math.min(360,box.height-150)].map(y=>({x:box.width-35,y})),'Pan origin must be ordinary unobstructed canvas',{width:250,height:200}));
     await boundary('mouse.move',()=>page.mouse.move(box.x+Math.max(25,start.x-Math.min(420,box.width-70)),box.y+start.y,{steps:20}));await boundary('mouse.up',()=>page.mouse.up());await boundary('wait:200',()=>page.waitForTimeout(200));coverage.panGestures++;write();
    }
    await boundary('clearCalendar',()=>clearCalendar());await sourceTool('hand');
   }
   await boundary('Three:response-readbacks',()=>Promise.all(threeResponseReads));friendsThreeIdentity(threeResponses);const threeAfter=await boundary('readThree:after',()=>readThree());friendsThreeProgress(threeBefore,threeAfter);coverage.three=true;write();
   evidence.assertions.push({sourceThreeAuthority:scenario.name,resourceIdentity,threeBefore,threeAfter,actualResponseBytesVerified:true});write();
   evidence.sourceCornerStage=scenario.name+':persistence';write();
   await boundary('clearCalendar',()=>clearCalendar());await boundary('saveQuit',()=>saveQuit());const after=await boundary('saved:read-only',()=>saved());assert.deepEqual(after.cageEdit.placements,placed.cageEdit.placements);assert.deepEqual(after.shop,expectedShop(installed.shop,after,installed));await boundary('continueSaved',()=>continueSaved());
   coverage.persistence=true;write();
   evidence.assertions.push({sourceCorners:scenario.name,slots:scenario.slots,oldSaveProfile:false,normalInstaller:true,normalUiPlacement:true,phaseSamplingMs:170,visualReviewRequired:true,checks:['adjacent sidewall joins','lower tips','left/right wrap','top headroom','three unchanged source-art styles']});write();
  }
  // Final continueSaved also loads models: settle all owned readbacks before terminal guards/close.
  await boundary('Three:drain-readbacks',()=>friendsDrainReadbacks(threeResponseReads));page.off('response',onThreeResponse);
  friendsThreeIdentity(threeResponses);evidence.sourceThreeReadbacksComplete={responses:threeResponses.length,reads:threeResponseReads.length};coverage.readbacks=true;write();
 }

 async function wallet(amount){const button=page.locator('.cm-status-bar__diamond');await button.waitFor({state:'visible'});assert.equal(digits(await button.innerText()),amount);assert.match(await button.getAttribute('aria-label'),/測試/);}
 try{
  browser=await chromium.launch({channel:'chromium',headless:true,chromiumSandbox:true});evidence.browserVersion=browser.version();
  evidence.launch={channel:'chromium',headless:true,chromiumSandbox:true,customArgs:[]};
  if(groups.includes('fresh-economy')){
  await fresh('new-save');await page.goto(publicBase+'championship.html',{waitUntil:'domcontentloaded'});await login();
  assert.equal(await page.locator('#cm-continue').isEnabled(),false,'Fresh profile must have no save');
  await page.locator('#cm-new-game').click();
  // Advance the normal comic using its real click affordance, without touching time/state.
  const story=page.locator('.cm-opening-story');
  // The final comic frame can complete between visibility and a real click.
  // Continue only to another visible normal story surface or the first envelope.
  async function clickStoryAffordance(target,options={}){
   try{await target.click({...options,timeout:3000});}
   catch(error){
    if(error.name!=='TimeoutError'||await target.isVisible())throw error;
    const storyVisible=await story.isVisible();
    const firstEnvelopeVisible=await story.count()===0&&await page.locator('.cm-opening__envelope').isVisible();
    if(!storyVisible&&!firstEnvelopeVisible)throw error;
    evidence.assertions.push({openingComicTransitionObserved:true,normalUi:true,storyVisible,firstEnvelopeVisible});write();
   }
  }
  const until=Date.now()+120000;
  while(await story.count()){
   if(Date.now()>until)throw Error('Normal opening comic did not finish');
   const text=page.locator('[data-story-action="text"]');if(await text.isVisible())await clickStoryAffordance(text);
   if(await story.isVisible())await clickStoryAffordance(story,{position:{x:10,y:10}});
   await page.waitForTimeout(1200);
  }
  await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();
  await page.locator('#cm-opening-name').fill('朋友測試');await page.locator('.cm-opening__name button[type="submit"]').click();
  await page.locator('.cm-opening__choices button').first().click();
  await page.locator('.cm-opening__envelope').click();await page.locator('.cm-opening__letter button').click();await page.locator('.cm-opening__letter button').click();
  if(await page.locator('[data-egg-confirm]').isVisible())await page.locator('[data-egg-confirm]').click();
  await page.locator('#cm-opening-name').fill('小夥伴');await page.locator('.cm-opening__name button[type="submit"]').click();
  await home();
  const decline=page.locator('dialog[open] [data-action="decline"]');
  await decline.waitFor({state:'visible',timeout:15000});await decline.click();await decline.waitFor({state:'hidden'});
  // The existing renderer-owned diagnostics are enabled by normal onboarding.
  // Decline must keep the already loaded egg on screen, not merely leave a canvas.
  const settledActors=[];
  for(let sample=0;sample<3;sample++){
   await page.waitForTimeout(250);
   const state=await page.locator('.int-rh2-field-host').evaluate(host=>({height:host.clientHeight,width:host.clientWidth,assets:JSON.parse(host.dataset.residentAssets||'[]'),positions:JSON.parse(host.dataset.residentScreenPositions||'[]')}));
   assert.ok(state.positions.length>0,'Renderer must report the real resident after tutorial decline');
   assert.ok(state.positions.some(p=>state.assets.some(a=>a.creatureId===p.creatureId&&a.state==='ready')&&p.x>0&&p.x<state.width&&p.bodyTop>=0&&p.footY>p.bodyTop&&p.footY<state.height),'Loaded partner body and feet must remain inside the settled viewport');
   settledActors.push(state);
  }
  evidence.assertions.push({settledNewSaveActors:settledActors});write();
  const initial=await saved();assert.equal(initial.shop.bits,8000000);assert.equal(initial.flags.friendsPlaytest.diamonds,20000);
  assert.equal(digits(await page.locator('.cm-status-bar__bits-value').innerText()),8000000);await wallet(20000);await noOverflow();await shot('01-new-wallet');await topContour('01-new-save');
  await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');
  // Hex cage world (Owner 2026-10-26): land is a capacity with one control for the next row.
  const landNote=()=>page.locator('.cm-hexworld__land-note').innerText();
  assert.equal(digits(await landNote()),20);assert.equal(await page.locator('[data-locked-test-row]').count(),1);assert.equal(await page.locator('.cm-vs2-cage-slot[data-unlocked="false"]').count(),0);await shot('02-land-control');
  assert.equal(await page.locator('[data-buy-test-row],.cm-cage-row-purchase').count(),0,'Lower purchase controls removed');
  for(const lock of await page.locator('button[data-locked-test-row]').all()){
   assert.equal(await lock.getAttribute('aria-haspopup'),'dialog');
   assert.ok(['none','normal','""'].includes(await lock.evaluate(el=>getComputedStyle(el,'::before').content)),'No horizontal row-rule pseudo-element');
  }
  for(const [row,balance,total]of [[2,19000,30],[3,18000,40],[4,17000,50],[5,16000,60],[6,15000,70],[7,14000,80],[8,13000,90],[9,12000,100]]){
   const button=page.locator(`button.cm-cage-row-lock[data-locked-test-row="${row}"]`);
   const label=await button.getAttribute('aria-label');assert.match(label.replaceAll(',',''),/1000/);assert.match(label,/測試鑽/);assert.match(label,/10/);
   await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box&&box.height>=44&&box.width>=44,'Row lock touch target');assert.ok(box.x>=0&&box.x+box.width<=390,'Lock stays inside mobile viewport');await noOverflow();
   const beforePurchase=await saved();
   await button.click();
   const dialog=page.locator('dialog.cm-dialog[data-variant="ranch-row-purchase"]');await dialog.waitFor({state:'visible'});
   assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true,'Native modal owns input');
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'cancel');
   assert.ok((await dialog.locator('.cm-dialog__title').innerText()).includes(String(row+1)));
   const detail=await dialog.locator('.cm-dialog__message').innerText();
   for(const value of ['10','1000',String(balance+1000)])assert.ok(detail.replaceAll(',','').includes(value),'Dialog includes count, price and balance');
   assert.match(detail,/測試鑽/);assert.deepEqual(await saved(),beforePurchase,'Opening confirmation cannot mutate save');
   await button.evaluate(el=>{el.click();el.click();});assert.equal(await page.locator('dialog[open]').count(),1);assert.deepEqual(await saved(),beforePurchase);
   await shot('row-'+row+'-confirmation');
   if(row===2){
    await dialog.locator('[data-action="cancel"]').click();await dialog.waitFor({state:'detached'});assert.deepEqual(await saved(),beforePurchase,'Cancel cannot debit or unlock');
    assert.equal(await button.evaluate(el=>document.activeElement===el),true,'Cancel restores lock focus');
    await button.press('Enter');await dialog.waitFor({state:'visible'});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.deepEqual(await saved(),beforePurchase,'Escape cannot debit');
    await button.click();await dialog.waitFor({state:'visible'});
   }
   await dialog.locator('[data-action="buy"]').evaluate(el=>{el.click();el.click();});
   await page.waitForFunction(({key,balance})=>JSON.parse(localStorage.getItem(key)).flags.friendsPlaytest.diamonds===balance,{key:saveKey,balance});
   assert.equal(await page.locator('dialog[open]').count(),0);
   if(total<100)assert.equal(digits(await landNote()),total);else assert.match(await landNote(),/全部土地已開放/);assert.equal(await page.locator('[data-locked-test-row]').count(),row<9?1:0);await shot('row-'+row);
  }
  assert.equal(await page.locator('button[data-locked-test-row],[data-buy-test-row],.cm-cage-row-purchase').count(),0);
  evidence.assertions.push({rowUnlockConfirmation:{cancelAndEscapeNoDebit:true,details:true,repeatedOpenAndBuySafe:true,noRowLinesOrLowerControls:true,slots:100,diamonds:12000}});
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await wallet(12000);await saveQuit();
  await page.reload({waitUntil:'domcontentloaded'});await continueSaved();await wallet(12000);
  await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');assert.match(await page.locator('.cm-hexworld__land-note').innerText(),/全部土地已開放/,'Reload must restore all purchased land');assert.equal(await page.locator('[data-locked-test-row]').count(),0);await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();
  const afterRows=await saved();assert.equal(afterRows.shop.bits,8000000+strollBits(afterRows,{since:strollSequence(initial)}));assert.deepEqual(afterRows.flags.friendsPlaytest.purchases,[2,3,4,5,6,7,8,9]);assert.equal(afterRows.flags.friendsPlaytest.diamonds,12000);
  await dock('shop');await screen('SHOP');const walletAtShop=digits(await page.locator('.cm-vs2-shop__wallet').innerText());
  let purchase;
  for(const tab of await page.locator('.cm-vs2-shop__tab').all()){
   await tab.click();
   for(const [cardIndex,card] of (await page.locator('.cm-vs2-shop__row').all()).entries()){
    await card.click();const buy=page.locator('.cm-vs2-shop__buy');const values=(await page.locator('.cm-vs2-shop__detail-meta').innerText()).replaceAll(',','').match(/\d+/g)?.map(Number);
    if(await buy.isEnabled()&&values?.[0]>0){purchase={price:values[0],owned:values[1],category:await tab.getAttribute('data-category'),cardIndex,itemName:await page.locator('.cm-vs2-shop__detail-name').innerText()};await buy.click();break;}
   }if(purchase)break;
  }
  assert.ok(purchase,'A normally paid, not fully owned item must be purchasable');const purchasedAt=Date.now();
  const purchasedMeta=(await page.locator('.cm-vs2-shop__detail-meta').innerText()).replaceAll(',','').match(/\d+/g).map(Number);assert.equal(purchasedMeta[1],purchase.owned+1,'Paid purchase must increase actual displayed ownership');
  assert.equal(digits(await page.locator('.cm-vs2-shop__wallet').innerText()),walletAtShop-purchase.price);
  await shot('05-shop-purchased');await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await saveQuit();await continueSaved();
  const afterShop=await saved();assert.equal(afterShop.shop.bits,walletAtShop-purchase.price+strollBits(afterShop,{after:purchasedAt}));assert.notDeepEqual({quantities:afterShop.shop.quantities,cageOwned:afterShop.shop.cageOwned,cageQuantities:afterShop.shop.cageQuantities},{quantities:afterRows.shop.quantities,cageOwned:afterRows.shop.cageOwned,cageQuantities:afterRows.shop.cageQuantities},'Persisted inventory, not just wallet, must change');assert.equal(afterShop.flags.friendsPlaytest.diamonds,12000);
  await dock('shop');await screen('SHOP');await page.locator(`.cm-vs2-shop__tab[data-category="${purchase.category}"]`).click();await page.locator('.cm-vs2-shop__row').nth(purchase.cardIndex).click();
  assert.equal(await page.locator('.cm-vs2-shop__detail-name').innerText(),purchase.itemName);
  const restoredItem=(await page.locator('.cm-vs2-shop__detail-meta').innerText()).replaceAll(',','').match(/\d+/g).map(Number);assert.equal(restoredItem[1],purchase.owned+1,'Purchased item ownership survives reload');
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();
  await dock('hunt');await screen('GATE_SELECT');
  const listToggle=page.locator('.cm-vs2-gate3d__toggle');if((await listToggle.innerText()).includes('場地列表'))await listToggle.click();
  let fee=0;
  for(const gate of await page.locator('[data-gate-id]').all()){
   if(!await gate.isVisible()||!await gate.isEnabled())continue;await gate.click();
   const confirm=page.getByRole('button',{name:'前往狩獵設定',exact:true});if(!await confirm.isEnabled())continue;await confirm.click();await screen('HUNT_LOADOUT');
   const nums=(await page.locator('.cm-vs2-destination__fee').innerText()).replaceAll(',','').match(/\d+/g)?.map(Number);fee=nums?.[0]||0;
   if(fee>0)break;await page.locator('#cm-root').getByRole('button',{name:'返回選場',exact:true}).click();if((await listToggle.innerText()).includes('場地列表'))await listToggle.click();
  }
  assert.ok(fee>0,'Use a paid gate, not a fee-waiver/free gate');
  await page.getByRole('button',{name:'開始狩獵',exact:true}).click();await screen('HUNT_FIELD');
  await page.locator('.cm-vs2-field__canvas[aria-busy="false"]').waitFor({timeout:180000});
  await page.locator('.cm-vs2-field__loading').waitFor({state:'detached',timeout:5000});
  assert.equal(await page.locator('[data-field-fallback="true"],.int-rh2-field-fallback').count(),0,'Hunt must not use an unplayable fallback');
  const huntCanvas=page.locator('.cm-vs2-field__canvas canvas').first();await huntCanvas.waitFor({state:'visible'});
  const huntBox=await huntCanvas.boundingBox();assert.ok(huntBox&&huntBox.width>0&&huntBox.height>0,'Normal Pixi hunt canvas must be visible');await shot('06-paid-hunt');
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await saveQuit();
  const afterHunt=await saved();assert.equal(afterHunt.shop.bits,afterShop.shop.bits-fee+strollBits(afterHunt,{since:strollSequence(afterShop)}));assert.equal(afterHunt.flags.friendsPlaytest.diamonds,12000);
  evidence.assertions.push({freshUi:true,rowBalances:[20000,19000,18000,17000,16000,15000,14000,13000,12000],shopPrice:purchase.price,huntFee:fee,finalBits:afterHunt.shop.bits});write();
  evidence.partition.completed.push('fresh-economy');write();
  }
  if(groups.includes('legacy-persistence')){
  // Unmodified old QA profile: no new-save grant, including after save/reload.
  await fresh('old-qa-no-topup');await page.goto(publicBase+'full-qa-save.html',{waitUntil:'domcontentloaded'});
  await page.locator('#install').waitFor();await page.waitForFunction(()=>!document.querySelector('#install').disabled);await page.locator('#install').click();await page.waitForURL(/championship\.html$/);
  assert.deepEqual((await saved()).shop,fixtures.seed.shop);assert.deepEqual((await saved()).cageEdit.placements,fixtures.seed.cageEdit.placements);
  await continueSaved();await wallet(0);await saveQuit();await continueSaved();await wallet(0);await saveQuit();
  const noTopup=await saved();assert.equal(noTopup.flags.friendsPlaytest.version,2);assert.equal(noTopup.flags.friendsPlaytest.diamonds,0);assert.deepEqual(noTopup.flags.friendsPlaytest.purchases,[]);
  assert.deepEqual(noTopup.shop,expectedShop(fixtures.seed.shop,noTopup,fixtures.seed));assert.deepEqual(noTopup.cageEdit.placements,expectedPlacements(fixtures.seed.cageEdit.placements));
  assert.deepEqual(noTopup.progression.battleBadges,fixtures.seed.progression.battleBadges);assert.equal(noTopup.progression.tamerRank,fixtures.seed.progression.tamerRank);
  evidence.assertions.push({legacyNoTopup:true,diamonds:0,saveReloadPreserved:true});write();
  // Separate historical-wallet fixture preserves purchase/reload coverage without a grant.
  await fresh('historical-wallet');await page.goto(publicBase+'full-qa-save.html',{waitUntil:'domcontentloaded'});
  await page.locator('#install').waitFor();await page.waitForFunction(()=>!document.querySelector('#install').disabled);await page.locator('#install').click();await page.waitForURL(/championship\.html$/);
  const old=await saved();const oldFixture=historicalWalletSeed;assert.deepEqual(old.shop,oldFixture.shop,'Installer must preserve fixture economy/inventory');assert.deepEqual(old.cageEdit.placements,oldFixture.cageEdit.placements,'Installer must preserve fixture anchors');await continueSaved();await wallet(10000);await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');
  // Hex cage world: the old save's four open rows read as 40 cells of land and one land control.
  const legacyLand=async()=>digits(await page.locator('.cm-hexworld__land-note').innerText());
  assert.equal(await legacyLand(),40);assert.equal(await page.locator('[data-locked-test-row]').count(),1);await shot('07-legacy-land-control');
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await saveQuit();
  const migrated=await saved();assert.deepEqual(migrated.shop,expectedShop(old.shop,migrated,old),'Continue/save must preserve entire old wallet, quantities, visibility and ownership');assert.deepEqual(migrated.cageEdit.placements,expectedPlacements(old.cageEdit.placements));assert.equal(migrated.flags.friendsPlaytest?.diamonds,10000);assert.equal(migrated.flags.friendsPlaytest.version,2);
  await continueSaved();await wallet(10000);await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');
  assert.equal(await legacyLand(),40);
  await page.locator('button[data-locked-test-row="4"]').click();
  await page.locator('dialog[data-variant="ranch-row-purchase"] [data-action="buy"]').click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).flags.friendsPlaytest.diamonds===9000,saveKey);
  assert.equal(await legacyLand(),50);
  await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();await saveQuit();await continueSaved();await wallet(9000);
  const legacyAfterPurchase=await saved();assert.deepEqual(legacyAfterPurchase.shop,expectedShop(old.shop,legacyAfterPurchase,old));assert.deepEqual(legacyAfterPurchase.cageEdit.placements,expectedPlacements(old.cageEdit.placements));
  evidence.assertions.push({historicalWalletPreserved:10000,legacyGrant:0,afterPurchaseAndReload:9000});
  evidence.assertions.push({oldQaPreserved:true,oldBits:old.shop.bits,oldPlacements:old.cageEdit.placements});await shot('07-old-save-preserved');await legacyTopContour('07-old-save');
  evidence.partition.completed.push('legacy-persistence');write();
  }
  for(const caseId of groups.filter(group=>sourceCase(group))){
  await sourceCornerReview(caseId);
  evidence.partition.completed.push(caseId);write();
  }
  assert.deepEqual(evidence.partition.completed,groups,'Every selected scenario must finish');
  assert.deepEqual(evidence.pageErrors,[]);assert.deepEqual(evidence.networkErrors,[]);
  assert.deepEqual(evidence.console.filter(m=>m.type==='error'||/CHAMPIONSHIP_RANCH_3D_FALLBACK|CHAMPIONSHIP_PIXI_FALLBACK|CHAMPIONSHIP_HUNT_(ART|DEPTH)_FALLBACK|Hunt feedback art unavailable/.test(m.text)),[],'No renderer, asset fallback or console error may masquerade as a playable field');
  evidence.status='PASS';write();console.log('CHAMPIONSHIP_FRIENDS_PLAYTEST_BROWSER_PASS');
 }catch(error){evidence.status='FAIL';evidence.failure=error.stack||String(error);await shot('failure').catch(()=>{});write();throw error;}
 finally{if(context){
  const tracePath=path.join(output,evidence.context+'-trace.zip');
  try{await context.tracing.stop({path:tracePath});const bytes=fs.statSync(tracePath).size;assert.ok(bytes>0,'Trace must be retained');evidence.finalTrace={file:path.basename(tracePath),bytes};}
  catch(error){evidence.status='FAIL';evidence.traceRetentionError=String(error.stack||error);process.exitCode=1;}
  write();await context.close();
 }if(browser)await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
