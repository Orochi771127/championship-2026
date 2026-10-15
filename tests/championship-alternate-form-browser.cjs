// Real UI only. No fixture edits, clock manipulation, private app access, GPU flags,
// runtime replacements or changes to production readiness. Requires built public QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createHash}=require('node:crypto');
const {resolveAsset,serveBuild,assertEvolved,assertBattleLoaders}=require('./alternate-form-browser-support.cjs');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest');
const output=require('./browser-qa-output.cjs')('alternate-forms');fs.mkdirSync(output,{recursive:true});
const publicBase='https://orochi771127.github.io/championship-2026/';
const saveKey='championshipModernSave:v1',qaKey='championshipAlternateFormsQA:r1:'+saveKey;
const evidence={status:'RUNNING',commit:process.env.GITHUB_SHA||null,assertions:[],console:[],pageErrors:[],networkErrors:[],diagnostics:[],gpu:null};
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'pages-build.json')));evidence.buildId=manifest.buildId;assert.equal(manifest.target,'GITHUB_PAGES_OWNER_PLAYTEST');assert.equal(manifest.publicPlaytest?.ownerApproved,true);
 assert.ok(resolveAsset(root,'/alternate-form-qa.html'),'Approved public build must contain isolated QA entry');
 for(const entry of JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/product-species-extensions.r1.json'))).entries)for(const gate of ['runtimeReady','evolutionReady','networkReady'])assert.equal(entry[gate],false,'Production gate remains disabled');
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'qa/alternate-form-save.json')));
 assert.equal(fixture.raising.collection.find(i=>i.instanceId.endsWith(':0005')).speciesId,'species-139');
 assert.equal(fixture.raising.collection.find(i=>i.instanceId.endsWith(':0006')).speciesId,'species-144');
 const server=await serveBuild(root);let browser,context,page;
 const write=()=>fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
 try{
  // Official full Chromium new headless; sandbox retained. Unsupported runners fail.
  browser=await chromium.launch({channel:'chromium',headless:true,chromiumSandbox:true});
  evidence.browserVersion=browser.version();evidence.launch={channel:'chromium',headless:true,chromiumSandbox:true,customArgs:[]};
  context=await browser.newContext({viewport:{width:844,height:390},locale:'zh-TW',serviceWorkers:'block'});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith(server.origin+'/'))return route.continue();
   // Some published asset URLs are absolute: serve exact reviewed build bytes.
   if(url.startsWith(publicBase)){
    const file=resolveAsset(root,'/'+new URL(url).pathname.slice(new URL(publicBase).pathname.length));
    if(file){const localUrl=server.origin+'/'+new URL(url).pathname.slice(new URL(publicBase).pathname.length)+new URL(url).search;const response=await route.fetch({url:localUrl,maxRedirects:0});return route.fulfill({response});}
   }
   evidence.networkErrors.push({url,error:'NON_BUILD_REQUEST_BLOCKED'});return route.abort();
  });
  page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('console',m=>evidence.console.push({type:m.type(),text:m.text()}));
  page.on('pageerror',e=>evidence.pageErrors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)evidence.networkErrors.push({url:r.url(),status:r.status()});});
  page.on('requestfailed',r=>{const error=r.failure()?.errorText;if(error!=='net::ERR_ABORTED')evidence.networkErrors.push({url:r.url(),error});});
  const shot=label=>page.screenshot({path:path.join(output,label+'.png'),fullPage:true});
  async function diagnostics(label){
   const panel=page.locator('#alternate-form-qa-diagnostics');
   if(await panel.getAttribute('open')===null)await panel.locator('summary').click();
   await page.getByRole('button',{name:'Refresh read-only diagnostics',exact:true}).click();
   const report=JSON.parse(await page.locator('#alternate-form-qa-report').innerText());
   evidence.diagnostics.push({label,report});await shot(label);await panel.locator('summary').click();await shot(label+'-scene');write();return report;
  }
  async function raisingReady(label){
   const field=page.locator('#cm-root .int-rh2-field-host[data-load-state="ready"][aria-busy="false"]');
   await field.waitFor({state:'visible',timeout:180000});
   await page.locator('#cm-root .int-rh2-resident-assets[data-load-owner="raising"]:visible').waitFor({state:'hidden'});
   assert.equal(await page.locator('#cm-root[data-field-fallback="true"]').count(),0);
   const state=await field.evaluate(n=>({loadState:n.dataset.loadState,busy:n.getAttribute('aria-busy'),residents:JSON.parse(n.dataset.residentAssets||'[]')}));
   assert.equal(state.loadState,'ready');assert.equal(state.busy,'false');assert.ok(state.residents.length>0);assert.ok(state.residents.every(r=>!['error','loading'].includes(r.state)));
   const canvas=field.locator('canvas.cm-field-canvas');assert.equal(await canvas.count(),1);assert.equal(await canvas.isVisible(),true);
   const size=await canvas.evaluate(n=>({width:n.width,height:n.height}));assert.ok(size.width>0&&size.height>0);
   (evidence.raisingReady??=[]).push({label,...state,canvas:size});
  }
  async function captureFourFormDatabase(){
   // Existing isolated QA session, normal menu/list navigation and DOM reads only.
   const registry=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/database-hero-portraits.r1.json')));
   const codes=new Map([[222,'UL02'],[230,'UL03'],[211,'UL33'],[229,'UL34']]);
   const expected=new Map([...codes].map(([id,code])=>{
    const art=registry.entries.find(e=>e.speciesIndex===id);assert.ok(art);assert.equal(art.src,`assets/production/database-handpainted-r1-20261015/species-${id}.png`);
    const bytes=fs.readFileSync(path.join(root,art.src));assert.equal(createHash('sha256').update(bytes).digest('hex'),art.sha256);
    return [id,{...art,code,url:new URL(art.src,publicBase).href}];
   }));
   const imageJobs=[],received=new Map();
   const observe=response=>{const art=[...expected.values()].find(a=>a.url===response.url());if(art)imageJobs.push((async()=>{const bytes=await response.body();assert.equal(response.status(),200);const hash=createHash('sha256').update(bytes).digest('hex');assert.equal(hash,art.sha256);received.set(art.speciesIndex,{speciesIndex:art.speciesIndex,url:response.url(),sha256:hash,bytes:bytes.length});})().catch(error=>evidence.networkErrors.push({url:response.url(),error:String(error)})));};
   page.on('response',observe);
   const identitySnapshot=()=>page.evaluate(key=>{const save=JSON.parse(sessionStorage.getItem(key));return {schemaVersion:save?.schemaVersion,registeredSpecies:save?.progression?.registeredSpecies,collection:save?.raising?.collection?.map(i=>({instanceId:i.instanceId,speciesId:i.speciesId}))};},qaKey);
   evidence.dexIdentityBefore=await identitySnapshot();evidence.dexCaptures=[];
   await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="database"]').click();
   await page.locator('#cm-root[data-active-screen="DATABASE"]').waitFor({state:'visible'});
   await page.locator('.cm-vs2-database__stage').selectOption('');
   const detail=page.locator('.cm-vs2-database__detail'),back=page.locator('.cm-vs2-root[data-screen="DATABASE"] .cm-vs2-footer button');
   async function select(id){
    if(await detail.isVisible()){await back.click();await detail.waitFor({state:'hidden'});}
    const row=page.locator(`.cm-vs2-database__row[data-species-index="${id}"]`);await row.scrollIntoViewIfNeeded();await row.click();await detail.waitFor({state:'visible'});
    if(codes.has(id))assert.equal(await row.getAttribute('data-display-code'),codes.get(id));
   }
   async function capture(holder,id,kind,viewport){
    const img=holder.locator('img');await img.waitFor({state:'visible',timeout:30000});
    await holder.scrollIntoViewIfNeeded();await img.evaluate(image=>image.decode());
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const snapshot=await holder.evaluate(n=>{const image=n.querySelector('img'),rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return {art:n.dataset.art,revealed:n.dataset.revealed??null,src:image.currentSrc||image.src,complete:image.complete,hidden:image.hidden,natural:[image.naturalWidth,image.naturalHeight],imageRect:rect(image),holderRect:rect(n),objectFit:getComputedStyle(image).objectFit};});
    assert.equal(snapshot.art,'ready');assert.equal(snapshot.hidden,false);assert.equal(snapshot.complete,true);assert.deepEqual(snapshot.natural,[1254,1254]);assert.equal(snapshot.src,expected.get(id).url);assert.ok(snapshot.imageRect.width>0&&snapshot.imageRect.height>0);assert.equal(snapshot.objectFit,'contain');
    const name=`dex-${id}-${kind}-${viewport.width}`;await shot(name);await holder.screenshot({path:path.join(output,name+'-image.png')});evidence.dexCaptures.push({speciesIndex:id,displayCode:codes.get(id),kind,viewport,screenshot:name+'.png',imageScreenshot:name+'-image.png',...snapshot});write();
   }
   for(const viewport of [{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const id of [222,230,211,229]){await select(id);await capture(detail.locator('.cm-dex-hero'),id,'hero',viewport);await capture(detail.locator('.cm-dex-routes__source .cm-dex-portrait'),id,'source-preview',viewport);}
    for(const [source,ids] of [[139,[211,229]],[144,[222,230]]]){
     await select(source);
     for(const id of ids){const target=detail.locator(`.cm-dex-routes__target[aria-label^="${codes.get(id)} · "]`);assert.equal(await target.count(),1);assert.equal(await target.getAttribute('data-revealed'),'true');await capture(target.locator('.cm-dex-portrait'),id,'evolution-choice-preview',viewport);}
    }
   }
   evidence.dexIdentityAfter=await identitySnapshot();assert.deepEqual(evidence.dexIdentityAfter,evidence.dexIdentityBefore,'Read-only Dex navigation must not change saved identity or registration');
   await Promise.all(imageJobs);page.off('response',observe);for(const id of codes.keys())assert.ok(received.has(id),`Missing actual hero image response ${id}`);evidence.dexImageResponses=[...received.values()];
   if(await detail.isVisible()){await back.click();await detail.waitFor({state:'hidden'});}await back.click();
   await page.locator('#cm-root.int-rh2-root[data-active-screen="RAISING_HOME"]').waitFor({state:'visible'});await raisingReady('dex-return');
   evidence.assertions.push('FOUR_FORM_DEX_HERO_SOURCE_AND_CHOICE_PREVIEW_CAPTURE_PASS');evidence.dexVisualReview='PENDING_ROOT_SCREENSHOT_REVIEW';
  }
  async function boot(){
   await page.locator('#form-qa-start').click();
   const skip=page.locator('#cm-film-skip');
   await page.locator('#cm-login').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
   if(await skip.isVisible()){await skip.click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});await page.waitForTimeout(400);}
   // Respect the film's real 350ms input guard; never alter browser/game clocks.
   await page.locator('#cm-login').click();await page.locator('#cm-continue').waitFor({state:'visible'});await page.locator('#cm-continue').click();
   await page.locator('[data-active-screen="RAISING_HOME"]').waitFor();await raisingReady('continue');
  }
  await page.goto(publicBase+'alternate-form-qa.html',{waitUntil:'domcontentloaded'});
  // A separate unattached canvas probes capability, without changing app getContext.
  evidence.gpu=await page.evaluate(()=>['webgl','webgl2'].map(kind=>{
   const canvas=document.createElement('canvas'),gl=canvas.getContext(kind);
   if(!gl)return {kind,available:false};const ext=gl.getExtension('WEBGL_debug_renderer_info');
   const result={kind,available:true,lost:gl.isContextLost(),vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedVendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
   gl.getExtension('WEBGL_lose_context')?.loseContext();return result;
  }));write();
  if(!evidence.gpu.some(g=>g.available&&!g.lost&&!/Disabled/i.test(JSON.stringify(g))))throw Error('BLOCKED_GPU: standard official Chromium has no usable WebGL');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveKey),null);
  await boot();
  for(const target of [229,230]){
   const button=page.locator(`.int-rh2-evolution-choice__option[data-species-index="${target}"]`);
   await button.waitFor({state:'visible',timeout:180000});
   for(const viewport of [{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const boxes=await page.locator('.int-rh2-evolution-choice__option:visible').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,text:n.textContent,position:getComputedStyle(n).position};}));
    assert.equal(boxes.length,2);assert.ok(boxes.every(b=>b.width>0&&b.height>0&&b.text.trim()&&b.position!=='absolute'));
    const [a,b]=boxes;assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'Choice buttons must not overlap');
    assert.ok(boxes.every(b=>b.x>=0&&b.right<=viewport.width&&b.y>=0&&b.bottom<=viewport.height),'Choices must fit viewport');
    evidence.assertions.push({choice:target,viewport,boxes});await shot(`choice-${target}-${viewport.width}`);
   }
   await button.focus();assert.equal(await button.evaluate(n=>n===document.activeElement),true);await button.press('Enter');
   const ceremony=page.locator('.cm-ceremony[data-kind="evolve"]');
   await ceremony.waitFor({state:'visible',timeout:120000});await ceremony.waitFor({state:'hidden',timeout:10000});
  }
  await page.setViewportSize({width:844,height:390});
  await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="saveQuit"]').click();await page.locator('#cm-login').waitFor({state:'visible'});
  const saved=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),qaKey);
  assert.equal(saved.schemaVersion,6);
  for(const [suffix,species]of [['0005','species-229'],['0006','species-230']])assert.equal(saved.raising.collection.find(i=>i.instanceId.endsWith(':'+suffix)).speciesId,species);
  await page.reload({waitUntil:'domcontentloaded'});await boot();
  const reloaded=await diagnostics('save-reload-evolved');assertEvolved(assert,reloaded);const beforeBattleReportCount=reloaded.actualLoaderReports.length;evidence.assertions.push('NORMAL_SAVE_EXIT_RELOAD_EVOLVED_0005_0006_PASS');
  await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="battle"]').click();
  await page.locator('[data-face-id="PRACTICE_BATTLE"]').click();
  for(const [id,team]of [[211,'A'],[229,'A'],[222,'B'],[230,'B']]){
   const name=fixture.raising.collection.find(i=>i.speciesId===`species-${id}`).displayName;
   await page.getByRole('button',{name:`${name} ${team} 隊`,exact:true}).click();
  }
  await page.getByRole('button',{name:'開始練習',exact:true}).click();
  await page.locator('.cm-vs5-field[aria-busy="false"]').waitFor({timeout:180000});
  assert.equal(await page.locator('.cm-vs5-field__loading[data-state="error"]').count(),0);await page.locator('.cm-vs5-field__loading:visible').waitFor({state:'hidden'});
  assert.equal(await page.locator('.cm-vs5-fighter__name').count(),4);
  assert.equal(await page.locator('#cm-root[data-field-fallback="true"]').count(),0);
  evidence.renderCanvases=[];
  for(const selector of ['canvas.cm-field-canvas','canvas.cm-vs5-vfx-overlay']){
   const canvas=page.locator(selector);assert.equal(await canvas.count(),1);assert.equal(await canvas.isVisible(),true);
   const size=await canvas.evaluate(n=>({width:n.width,height:n.height,boxWidth:n.getBoundingClientRect().width,boxHeight:n.getBoundingClientRect().height}));
   assert.ok(Object.values(size).every(v=>v>0));evidence.renderCanvases.push({selector,...size});
  }
  const runtimeDiagnosticsKey='championshipAlternateFormsQA:r1:championshipModernSave:runtimeDiagnostics:v1';
  await page.waitForFunction(key=>JSON.parse(sessionStorage.getItem(key)||'null')?.events?.some(e=>e.area==='battle'&&e.stage==='first-render'&&e.phase==='done'),runtimeDiagnosticsKey);
  evidence.actualFirstRender=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),runtimeDiagnosticsKey);
  const qaCatalog=JSON.parse(fs.readFileSync(path.join(root,'qa/alternate-form-product-catalog.json')));
  const extensionName=id=>{const entry=qaCatalog.entries.find(e=>e.speciesIndex===id);return entry.displayNameByLocale?.['zh-Hant']??entry.displayNameZh;};
  evidence.hudTeams=await page.locator('.cm-vs5-fighter[data-present="true"]').evaluateAll(nodes=>nodes.map(n=>({team:Number(n.dataset.team),name:n.querySelector('.cm-vs5-fighter__name').textContent})));
  assert.deepEqual(evidence.hudTeams.filter(n=>n.team===0).map(n=>n.name).sort(),['黃銅王猿',extensionName(229)].sort());
  assert.deepEqual(evidence.hudTeams.filter(n=>n.team===1).map(n=>n.name).sort(),['天穹帝龍',extensionName(230)].sort());await diagnostics('four-actors-battle-running');
  // Natural game clock only. Timeout is failure, never a synthetic victory.
  await page.locator('#cm-root[data-active-screen="BATTLE_RESULT"]').waitFor({state:'visible',timeout:600000});await shot('battle-result');
  evidence.result=await page.locator('#cm-root[data-active-screen="BATTLE_RESULT"] .cm-vs5-shell').evaluate(n=>({verdict:n.dataset.verdict,reason:n.dataset.endReason,text:n.innerText}));
  assert.ok(['TEAM_ZERO_AHEAD','TEAM_ONE_AHEAD','LEVEL'].includes(evidence.result.verdict));assert.ok(['TIME_UP','TEAM_DOWN'].includes(evidence.result.reason));evidence.assertions.push('NATURAL_FOUR_ACTOR_BATTLE_RESULT_PASS');
  for(let n=0;n<12&&!(await page.locator('.cm-vs5-exit').isVisible());n++)await page.getByRole('button',{name:'下一頁',exact:true}).click();
  await page.locator('.cm-vs5-exit').click();await page.locator('#cm-root.int-rh2-root[data-active-screen="RAISING_HOME"]').waitFor({state:'visible'});assert.equal(await page.locator('#cm-root .cm-vs5-result__body').count(),0);
  await raisingReady('battle-return');const last=await diagnostics('battle-complete');
  assert.deepEqual(last.errors,[]);assert.deepEqual(evidence.pageErrors,[]);assert.deepEqual(evidence.networkErrors,[]);assert.deepEqual(evidence.console.filter(m=>m.type==='error'||/CHAMPIONSHIP_VFX_ART_FALLBACK|BATTLE_CORE_VFX_UNAVAILABLE/.test(m.text)),[],'No product error or VFX fallback is accepted');
  evidence.battleLoaderReport=assertBattleLoaders(assert,last.actualLoaderReports,beforeBattleReportCount,{exactCount:true});
  await captureFourFormDatabase();
  assert.deepEqual(evidence.pageErrors,[]);assert.deepEqual(evidence.networkErrors,[]);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveKey),null);
  evidence.assertions.push('FORMAL_SAVE_UNTOUCHED');evidence.status='PASS';console.log('ALTERNATE_FORM_BROWSER_PASS');
 }catch(error){evidence.status=String(error).includes('BLOCKED_GPU')?'BLOCKED_GPU':'FAIL';evidence.error=String(error.stack||error);if(page){evidence.failureDiagnostics=await page.locator('#alternate-form-qa-report').textContent().catch(()=>null);await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(output,'failure-dom.html'),await page.content().catch(()=>''));}throw error;
 }finally{write();await context?.tracing.stop({path:path.join(output,'trace.zip')}).catch(()=>{});await browser?.close();await server.close();}
})().catch(e=>{if(evidence.status==='RUNNING'){evidence.status='FAIL';evidence.error=String(e.stack||e);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));}console.error(e);process.exitCode=1;});
