const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||path.join(__dirname,'..'));
const {chromium}=require(repo+'/node_modules/playwright');
const profile=process.argv[3]||'public-default';assert.ok(['public-default','lagoon-r2'].includes(profile));
const out=require('./browser-qa-output.cjs')('battle-full-map/'+profile),phase=process.argv[2]||'verified';fs.mkdirSync(out,{recursive:true});
const review=profile==='lagoon-r2',base=review?'http://127.0.0.1:8879/':'https://orochi771127.github.io/championship-2026/';
const crypto=require('node:crypto'),hash=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,rel))).digest('hex');
const registry=JSON.parse(fs.readFileSync(path.join(repo,'assets/production/PUBLIC_RUNTIME_INDEX.json')));
const manifestPath=review?'assets/production/battle/bm04-island-polish-r2/manifest.json':registry.assets.find(a=>a.id==='art:public:metadata:battle-original:v1').src;
const manifest=JSON.parse(fs.readFileSync(path.join(repo,manifestPath))),expectedField=manifest.fields.find(f=>f.fieldId==='field_bm04_01'),expectedFrame=expectedField.frames[0];
assert.equal(hash(expectedFrame.src),expectedFrame.sha256.toLowerCase());
const runtimeSource=process.env.CHAMPIONSHIP_QA_RUNTIME_SOURCE||null;
const entryQuery='gateMode=fallback'+(review?'&battleReview=bm04-lagoon-r2':'');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.woff2':'font/woff2'};
function hooks(body,rel){
 if(rel.endsWith('/main.js')){
  body=body.replace(/\bapp\s*=\s*createChampionshipStandaloneApp\(/,'app=globalThis.__qaApp=createChampionshipStandaloneApp(');
  body=body.replace(/\bscene\s*=\s*await mountBattleFieldPixiPresentation\(/,'scene=globalThis.__qaBattleScene=await mountBattleFieldPixiPresentation(');
  body+='\nglobalThis.__qaBattleRuntime=()=>battleRuntime; globalThis.__qaRecoveryDiagnostics=()=>JSON.parse(recoveryDiagnostics.exportText());\n';
 }
 if(rel.endsWith('/createBattleFieldPixiPresentation.js'))body=body.replace('const { app } = stage;','const { app } = stage; globalThis.__qaStage=stage; globalThis.__qaSource=source;').replace('const actors = new Map();','const actors = new Map(); globalThis.__qaActors=actors; globalThis.__qaWorld=world;');
 return body;
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});let report={phase,profile,runtimeBaseline:runtimeSource?{source:runtimeSource,base:process.env.CHAMPIONSHIP_QA_RUNTIME_BASE||null,sha256:crypto.createHash('sha256').update(fs.readFileSync(runtimeSource)).digest('hex')}:null,sourceRoot:repo,origin:base,entryQuery,expectedMap:{assetId:manifest.assetId,manifest:manifestPath,manifestSha256:hash(manifestPath),frame:expectedFrame.src,frameSha256:hash(expectedFrame.src)},requests:[],cases:[],errors:[],missing:[],physicalDevice:false,publication:'NOT_PUBLISHED'};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(!u.href.startsWith(base)){report.missing.push(u.origin);return route.abort();}const rel=decodeURIComponent(u.pathname.slice(new URL(base).pathname.length)),file=path.resolve(repo,rel||'championship.html');if([manifestPath,expectedFrame.src].includes(rel)&&!report.requests.includes(rel))report.requests.push(rel);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){report.missing.push(rel);return route.fulfill({status:404,body:'missing QA input'});}if(rel.endsWith('.js'))return route.fulfill({body:hooks(fs.readFileSync(runtimeSource&&rel==='src/championship/app/battleRuntime.js'?runtimeSource:file,'utf8'),rel),contentType:'text/javascript'});return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});});
 // The shared seed has five eligible adults and one baby. Derive a test-only
 // six-adult fixture by giving its resident an existing adult's consistent
 // species/name/native profile; preserve its stable instance ID and the file.
 const sixActorSeed=JSON.parse(fs.readFileSync(repo+'/qa/championship-full-qa-save.json','utf8'));
 const adult=sixActorSeed.raising.collection[0];
 Object.assign(sixActorSeed.creature,{speciesId:adult.speciesId,displayName:adult.displayName,nativeProfile:structuredClone(adult.nativeProfile)});
 report.teamFixture={kind:'six-admitted-adults-derived-test-seed',baseSha256:hash('qa/championship-full-qa-save.json'),derivedSha256:crypto.createHash('sha256').update(JSON.stringify(sixActorSeed)).digest('hex'),residentInstanceId:sixActorSeed.creature.creatureId,residentSpeciesId:adult.speciesId,sourceSeedUnchanged:true};
 await page.addInitScript(seed=>{localStorage.setItem('championshipModernSave:v1',seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:'zh-Hant',theme:'warm',muted:true,reducedMotion:'off'}));},JSON.stringify(sixActorSeed));
 await page.goto(base+'championship.html?'+entryQuery,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await page.locator('#cm-login').click();await page.locator('#cm-continue').click();await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 async function step(ms=67){await page.waitForTimeout(40);await page.clock.runFor(ms);}
 await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="battle"]').click();await page.locator('.cm-vs5-cube__face[data-face-id="PRACTICE_BATTLE"]').click();
 await page.locator('.cm-vs5-arena-choice select').waitFor();
 const selects=await page.locator('select').evaluateAll(es=>es.map(e=>({class:e.className,options:[...e.options].map(o=>[o.value,o.textContent])})));console.log(JSON.stringify({selects}));
 const arena=page.locator('.cm-vs5-arena-select select, select.cm-vs5-arena-select');
 const allSelects=page.locator('select');if(await allSelects.count())await allSelects.last().selectOption('3');
 // Exercise a real six-actor practice battle through the existing team UI.
 assert.ok(await page.locator('.cm-vs5-practice-member button:nth-of-type(1):enabled').count()>=6,'QA seed must admit six actual actors; do not substitute cloned HUDs for the live battle');
 for(const team of [1,2])for(let n=0;n<3;n++)await page.locator(`.cm-vs5-practice-member button:nth-of-type(${team}):enabled[aria-pressed="false"]`).first().click();
 await page.locator('.cm-vs5-footer .cm-vs5-action--primary').click();
 for(let i=0;i<900;i++){
  const ready=await page.locator('.cm-vs5-field[aria-busy="false"] canvas.cm-field-canvas').count();
  const prepared=phase==='before'||await page.evaluate(()=>__qaRecoveryDiagnostics().events.some(e=>e.stage==='gpu-warmup'&&e.phase==='done'));
  if(ready&&prepared)break;await step(17);
 }
 if(phase!=='before'){
  const events=await page.evaluate(()=>__qaRecoveryDiagnostics().events.filter(e=>e.stage==='gpu-warmup'));
  assert.deepEqual(events.map(e=>e.phase),['start','done'],'real WebGL preparation must complete, not silently fall back');
  assert.equal(events[0].gpuWarmupGroups,0);assert.equal(events[1].gpuWarmupGroups,81);
  assert.ok(events[1].elapsedMs>=events[0].elapsedMs);
  report.gpuWarmup={events,submittedGroups:81,documentElapsedMs:events[1].elapsedMs-events[0].elapsedMs,submissionOnly:true,gpuCompletionClaim:false};
 }
 assert.equal(await page.locator('.cm-vs5-field[aria-busy="false"] canvas.cm-field-canvas').count(),1);
 await page.evaluate(async()=>{
   const catalog=await import(new URL('src/championship/battle/battleCatalogs.js',location.href));
   globalThis.__qaKind1Moves=new Set(catalog.listBattleCatalogRecords('moves').filter(m=>m.kind===1).map(m=>m.recordIndex));
   globalThis.__qaFirstKind1BySlot={};
   globalThis.__qaMatch=__qaBattleRuntime();globalThis.__qaAppIdentity=__qaStage.app;globalThis.__qaTicker=__qaStage.app.ticker;
   globalThis.__qaCameraAudit={frames:0,violations:[],primaryViolations:[],byViewport:{},minZoom:Infinity,maxZoom:0};
   globalThis.__qaAuditTick=()=>{
    const p=__qaBattleScene?.getFieldPlacement();if(!p)return;const r=p.artRect,a=__qaCameraAudit;
    for(const event of __qaSource.getView().nativeLifecycle?.normalFlow?.history??[]){
      if(event.type==='LAUNCHED'&&__qaKind1Moves.has(event.moveId)&&!__qaFirstKind1BySlot[event.slot])
        __qaFirstKind1BySlot[event.slot]={...event,activeSeconds:event.clock/(33513982/560190)};
    }
    a.frames++;const key=p.width+'x'+p.height,bucket=a.byViewport[key]??={frames:0,minZoom:Infinity,maxZoom:0};bucket.frames++;bucket.minZoom=Math.min(bucket.minZoom,p.zoom);bucket.maxZoom=Math.max(bucket.maxZoom,p.zoom);
    const box=__qaBattleScene.getDiagnostics().dynamicFx?.camera?.framingBox,cover=Math.max(p.width/r.width,p.height/r.height);
    if(box&&box.left>=r.x&&box.top>=r.y&&box.right<=r.x+r.width&&box.bottom<=r.y+r.height&&(box.right-box.left)*cover<=p.width&&(box.bottom-box.top)*cover<=p.height){
      const crop=Math.max(0,-(box.left*p.zoom+p.x),-(box.top*p.zoom+p.y),box.right*p.zoom+p.x-p.width,box.bottom*p.zoom+p.y-p.height);
      if(crop>1&&a.primaryViolations.length<16)a.primaryViolations.push({crop,box,p});
    }
    a.minZoom=Math.min(a.minZoom,p.zoom);a.maxZoom=Math.max(a.maxZoom,p.zoom);
    const gap=Math.max(0,r.x*p.zoom+p.x,r.y*p.zoom+p.y,p.width-((r.x+r.width)*p.zoom+p.x),p.height-((r.y+r.height)*p.zoom+p.y));
    if(gap>.01&&a.violations.length<16)a.violations.push({gap,p});
   };
   __qaStage.app.ticker.add(__qaAuditTick);
  });await step(5000);
 for(const [i,[width,height]] of [[390,844],[430,932],[430,873],[844,390],[1366,768],[320,568],[568,320],[390,844],[844,390],[390,844]].entries()){
  await page.setViewportSize({width,height});await step();await step();
  const s=await page.evaluate(()=>{const p=__qaBattleScene.getFieldPlacement(),d=__qaBattleScene.getDiagnostics(),box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}:null;};return {screen:document.querySelector('#cm-root').dataset.activeScreen,viewport:[innerWidth,innerHeight],placement:p,diagnostics:d,canvas:box('.cm-field-canvas'),field:box('.cm-vs5-field'),clock:box('.cm-vs5-clock'),opponents:box('.cm-vs5-roster--opponent'),players:box('.cm-vs5-roster--player'),log:box('.cm-vs5-log'),sameMatch:__qaMatch===__qaBattleRuntime(),sameApp:__qaAppIdentity===__qaStage.app,sameTicker:__qaTicker===__qaStage.app.ticker,overflow:document.documentElement.scrollWidth>innerWidth,sceneLabels:__qaStage.app.stage.children.flatMap(c=>c.children?.map(x=>x.label)||[])};});
  // Retain actual pixels even if a later strict geometry/font assertion fails.
  await page.screenshot({path:path.join(out,`${phase}-${i}-${width}x${height}.png`)});
  assert.equal(s.screen,'BATTLE_FIELD');assert.ok(s.sameMatch&&s.sameApp&&s.sameTicker);assert.equal(s.overflow,false);
  assert.equal(s.diagnostics.art.fieldId,'field_bm04_01');assert.equal(s.diagnostics.art.assetId,manifest.assetId);
  s.layout=await page.evaluate(()=>{const shell=document.querySelector('.cm-vs5-shell'),log=document.querySelector('.cm-vs5-log'),r=log.getBoundingClientRect(),sr=shell.getBoundingClientRect(),cr=document.querySelector('.cm-vs5-clock').getBoundingClientRect(),style=getComputedStyle(shell),ends=[...log.children].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().bottom);return {rows:style.gridTemplateRows,alignContent:style.alignContent,shellTop:sr.top,shellBottom:sr.bottom,logHeight:r.height,blankBelowLogContent:r.bottom-Math.max(r.top,...ends),centerDelta:Math.abs((cr.top+r.bottom)/2-(sr.top+sr.bottom)/2),url:location.href};});
  s.floatingHud=await page.evaluate(()=>{
   const shell=document.querySelector('.cm-vs5-shell'),sr=shell.getBoundingClientRect(),field=document.querySelector('.cm-vs5-field').getBoundingClientRect();
   const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
   const cards=[...document.querySelectorAll('.cm-vs5-fighter[data-present="true"]')];
   const numberProbe=(value,kind)=>{if(!value)return null;const probe=document.createElement('span'),style=getComputedStyle(value);Object.assign(probe.style,{position:'absolute',visibility:'hidden',whiteSpace:'pre',fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,fontStyle:style.fontStyle,fontStretch:style.fontStretch,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,fontVariantNumeric:style.fontVariantNumeric});document.body.append(probe);const widths=[kind+' 65535',' / 65535'].map(text=>{probe.textContent=text;return probe.getBoundingClientRect().width;});const measured=getComputedStyle(probe),result={width:Math.max(...widths),unwrappedWidth:widths.reduce((a,b)=>a+b,0),valueFont:{family:style.fontFamily,size:style.fontSize,weight:style.fontWeight,numeric:style.fontVariantNumeric},probeFont:{family:measured.fontFamily,size:measured.fontSize,weight:measured.fontWeight,numeric:measured.fontVariantNumeric}};probe.remove();return result;};
   // Isolated geometry fixtures supplement, never replace, the real six-actor screenshots.
   // Actual font layout chooses one/two numeric lines at 100% and 125% text scale.
   const probeRoot=shell.parentElement.cloneNode(false),probeShell=shell.cloneNode(false);
   probeRoot.removeAttribute('id');Object.assign(probeRoot.style,{position:'fixed',left:'-10000px',top:'0',width:sr.width+'px',height:sr.height+'px',visibility:'hidden',pointerEvents:'none'});
   probeRoot.append(probeShell);document.body.append(probeRoot);
   let threeMemberGroups=[];try{
    for(const textScale of [1,1.25])for(const count of [1,2,3])for(const digits of ['1180','65535']){
     probeRoot.style.setProperty('--text-scale',String(textScale));probeShell.replaceChildren();
     for(const original of shell.querySelectorAll('.cm-vs5-roster')){
      const roster=original.cloneNode(false),card=original.querySelector('.cm-vs5-fighter[data-present="true"]');if(!card)continue;
      for(let i=0;i<count;i++){const clone=card.cloneNode(true);for(const bar of clone.querySelectorAll('.cm-vs5-meter')){const kind=bar.classList.contains('cm-vs5-meter--hp')?'HP':'TP',value=bar.querySelector('.cm-vs5-fighter__hp,.cm-vs5-meter__value');if(value.children.length===2){value.children[0].textContent=kind+' '+digits;value.children[1].textContent=' / '+digits;}else value.textContent=kind+' '+digits+' / '+digits;}roster.append(clone);}probeShell.append(roster);
     }
     const probeBounds=rect(probeShell);
     threeMemberGroups.push(...[...probeShell.querySelectorAll('.cm-vs5-roster')].map(roster=>({textScale,count,digits,opponent:roster.classList.contains('cm-vs5-roster--opponent'),cards:[...roster.children].map(card=>{const r=rect(card);return {left:r.left-probeBounds.left,right:r.right-probeBounds.left,top:r.top-probeBounds.top,width:r.width,bars:[...card.querySelectorAll('.cm-vs5-meter')].map(bar=>{const value=bar.querySelector('.cm-vs5-fighter__hp,.cm-vs5-meter__value');return {bar:rect(bar),value:rect(value),fontSize:parseFloat(getComputedStyle(value).fontSize),parts:[...value.children].map(rect),overflow:value.scrollWidth>value.clientWidth+1};})};})})));
    }
   }finally{probeRoot.remove();}
   return {threeMemberGroups,mode:shell.dataset.hud,shell:rect(shell),field:{left:field.left,top:field.top,right:field.right,bottom:field.bottom},
    rosterStyles:[...shell.querySelectorAll('.cm-vs5-roster')].map(e=>({opponent:e.classList.contains('cm-vs5-roster--opponent'),direction:getComputedStyle(e).flexDirection,justify:getComputedStyle(e).justifyContent})),namedAreas:getComputedStyle(shell).gridTemplateAreas,exit:rect(document.querySelector('.cm-vs5-exit')),
    overlays:[...shell.querySelectorAll(':scope > .cm-vs5-clock,:scope > .cm-vs5-roster,:scope > .cm-vs5-log')].map(e=>({pointerEvents:getComputedStyle(e).pointerEvents,background:getComputedStyle(e).backgroundColor})),
    cards:cards.map(c=>({slot:c.dataset.slot,team:c.dataset.team,rect:rect(c),bars:[...c.querySelectorAll('.cm-vs5-meter')].map(bar=>{const value=bar.querySelector('.cm-vs5-fighter__hp,.cm-vs5-meter__value');return {kind:bar.classList.contains('cm-vs5-meter--hp')?'HP':'TP',bar:rect(bar),value:value?rect(value):null,text:value?.textContent,maxNumberProbe:numberProbe(value,bar.classList.contains('cm-vs5-meter--hp')?'HP':'TP'),ariaLabel:bar.getAttribute('aria-label'),now:bar.getAttribute('aria-valuenow'),max:bar.getAttribute('aria-valuemax'),overflow:!!value&&value.scrollWidth>value.clientWidth+1}})}))};
  });
  if(phase!=='before'){const hud=s.floatingHud;assert.equal(hud.mode,'floating');assert.equal(hud.namedAreas,'none');
  for(const edge of ['left','top','right','bottom'])assert.ok(Math.abs(hud.shell[edge]-hud.field[edge])<=1,'field fills shell '+edge);
  assert.ok(hud.exit.width>=44&&hud.exit.height>=44);assert.ok(hud.exit.right<=width+1&&hud.exit.bottom<=height+1);
  assert.ok(hud.overlays.every(e=>e.pointerEvents==='none'&&e.background==='rgba(0, 0, 0, 0)'));
  assert.equal(hud.cards.length,6,'real battle has three actors per team');
  for(const team of ['0','1']){const members=hud.cards.filter(c=>c.team===team);assert.equal(members.length,3);assert.equal(new Set(members.map(c=>Math.round(c.rect.top))).size,1,'real team stays on one row');}
  for(const row of hud.rosterStyles){assert.equal(row.direction,'row');assert.equal(row.justify,row.opponent?'flex-end':'flex-start');}
  for(const group of hud.threeMemberGroups){
   assert.equal(group.cards.length,group.count);assert.equal(new Set(group.cards.map(c=>Math.round(c.top))).size,1,'one/two/three members stay on one row');
   assert.ok(Math.max(...group.cards.map(c=>c.width))-Math.min(...group.cards.map(c=>c.width))<=1,'equal adaptive columns');
   for(const card of group.cards){assert.ok(card.width<=140*group.textScale+1&&card.left>=-1&&card.right<=hud.shell.width+1,'chip stays inside shell');
    for(const bar of card.bars){assert.equal(bar.parts.length,2);assert.ok(bar.fontSize>=11*group.textScale-.01);assert.ok(!bar.overflow);
     assert.ok(bar.value.top>=bar.bar.top-1&&bar.value.bottom<=bar.bar.bottom+1,'adaptive track contains all numeral lines');
     for(const part of bar.parts)assert.ok(part.left>=bar.value.left-1&&part.right<=bar.value.right+1&&part.top>=bar.value.top-1&&part.bottom<=bar.value.bottom+1,'whole number remains readable');
     const fits=bar.parts.reduce((n,r)=>n+r.width,0)<=bar.value.width-.5,lines=new Set(bar.parts.map(r=>Math.round(r.top))).size;
     assert.ok(lines===1||lines===2);if(fits)assert.equal(lines,1,'no unnecessary second line when actual-font numerals fit');
    }
   }
  }
  for(const card of hud.cards){assert.ok(card.rect.width<=141,'compact actor chip width');assert.ok(card.rect.left>=hud.shell.left-1&&card.rect.right<=hud.shell.right+1);}
  assert.ok(hud.cards.every(card=>card.bars.find(b=>b.kind==='TP').bar.height<card.bars.find(b=>b.kind==='HP').bar.height),'TP is thinner than HP');
  for(const card of hud.cards){assert.deepEqual(card.bars.map(b=>b.kind).sort(),['HP','TP']);for(const b of card.bars){
   assert.ok(b.value&&b.ariaLabel);assert.match(b.text,new RegExp('^'+b.kind+' \\d+ / \\d+$'));
   assert.ok(!b.overflow,'bar number overflow '+JSON.stringify(b));
   assert.deepEqual(b.maxNumberProbe.probeFont,b.maxNumberProbe.valueFont,'probe inherits actual meter font');
   assert.ok(parseFloat(b.maxNumberProbe.valueFont.size)>=11,'never reduce the 11px meter font');
   assert.ok(b.maxNumberProbe.width<=b.value.width+1,'five-digit unbreakable fragment capacity '+JSON.stringify(b));
   assert.ok(b.value.left>=b.bar.left-1&&b.value.top>=b.bar.top-1&&b.value.right<=b.bar.right+1&&b.value.bottom<=b.bar.bottom+1);
  }}
  }
  if(phase!=='before'){const p=s.placement,r=p.artRect;const bounds={left:r.x*p.zoom+p.x,top:r.y*p.zoom+p.y,right:(r.x+r.width)*p.zoom+p.x,bottom:(r.y+r.height)*p.zoom+p.y};assert.ok(bounds.left<=.01&&bounds.top<=.01&&bounds.right>=p.width-.01&&bounds.bottom>=p.height-.01,JSON.stringify(bounds));s.mapBounds=bounds;
   s.alignment=await page.evaluate(()=>{const p=__qaBattleScene.getFieldPlacement(),v=__qaSource.getView(),d=__qaBattleScene.getDiagnostics();return d.dynamicFx.bodies.map(b=>{const stand=v.combatants[b.slot].stand,expected={x:p.artRect.x+stand.x*p.artRect.width,y:p.artRect.y+stand.y*p.artRect.height};const actual=__qaWorld.toGlobal({x:expected.x,y:expected.y});return {slot:b.slot,localError:Math.max(Math.abs(b.x-expected.x),Math.abs(b.groundY-expected.y)),screenError:Math.max(Math.abs(actual.x-(expected.x*p.zoom+p.x)),Math.abs(actual.y-(expected.y*p.zoom+p.y)))};});});
   assert.ok(s.alignment.every(a=>a.localError<=1&&a.screenError<.01));
   assert.ok(s.field.right<=width+1&&s.field.bottom<=height+1);
   if(width>height){assert.ok(s.field.width>=width*.9);assert.ok(s.field.height>=height*.8);}
  }
  await page.locator('.cm-vs5-exit').scrollIntoViewIfNeeded();await page.locator('.cm-vs5-exit').click();await page.locator('.cm-dialog__action[data-action="stay"]').click();await step(17);
  assert.equal(await page.evaluate(()=>__qaMatch===__qaBattleRuntime()),true);s.exitDialogAndResume=true;
  const file=`${phase}-${i}-${width}x${height}.png`;await page.screenshot({path:path.join(out,file)});s.screenshot=file;report.cases.push(s);
 }
 if(phase!=='before'){
  // Synthetic notch budgets exercise layout arithmetic; real iOS safe areas remain unverified.
  await page.addStyleTag({content:'.cm-vs5-shell[data-responsive-battle="candidate"] {padding:20px 30px 16px 30px !important;}'});await page.setViewportSize({width:844,height:390});await step();await step();
  report.syntheticSafeArea=await page.evaluate(()=>{const shell=document.querySelector('.cm-vs5-shell').getBoundingClientRect(),field=document.querySelector('.cm-vs5-field').getBoundingClientRect(),clock=document.querySelector('.cm-vs5-clock').getBoundingClientRect(),exit=document.querySelector('.cm-vs5-exit').getBoundingClientRect();return {shell:{x:shell.x,y:shell.y,right:shell.right,bottom:shell.bottom},field:{x:field.x,y:field.y,right:field.right,bottom:field.bottom},clock:{x:clock.x,y:clock.y},exit:{right:exit.right,bottom:exit.bottom}};});const safe=report.syntheticSafeArea;assert.ok(Math.abs(safe.field.x-safe.shell.x)<1&&Math.abs(safe.field.right-safe.shell.right)<1);assert.ok(safe.clock.x>=safe.shell.x+29&&safe.clock.y>=safe.shell.y+19);assert.ok(safe.exit.right<=safe.shell.right-29&&safe.exit.bottom<=safe.shell.bottom-15);
  await page.screenshot({path:path.join(out,phase+'-safe-area-844x390.png')});
  // Observe actual running frames, including native special prelude and effects.
  report.liveFrames=[];for(let i=0;i<25;i++){await step(400);const d=await page.evaluate(()=>{const p=__qaBattleScene.getFieldPlacement(),r=p.artRect,v=__qaSource.getView();return {frame:v.nativeLifecycle?.frame,special:!!v.specialPrelude,fx:__qaBattleScene.getDiagnostics().dynamicFx.eventsHandled,zoom:p.zoom,left:r.x*p.zoom+p.x,top:r.y*p.zoom+p.y,right:(r.x+r.width)*p.zoom+p.x,bottom:(r.y+r.height)*p.zoom+p.y,width:p.width,height:p.height};});assert.ok(d.left<=.01&&d.top<=.01&&d.right>=d.width-.01&&d.bottom>=d.height-.01);report.liveFrames.push(d);}
  // Observe the real first kind-1 launch without forcing combat state. This is
  // a bounded additional 20s window, not a promise of a launch at tick300.
  for(let n=0;n<100;n++){
   if(await page.evaluate(()=>Object.keys(__qaFirstKind1BySlot).length>0||__qaSource.getView().outcome?.ended))break;
   await step(200);
  }
  report.openingSkillAudit=await page.evaluate(()=>({eligibilityActiveTick:300,tickRate:33513982/560190,firstKind1BySlot:__qaFirstKind1BySlot,combatants:__qaSource.getView().combatants.map(c=>({slot:c.slot,speciesId:c.speciesId,present:c.present})),observation:'actual normalFlow LAUNCHED history; no runtime state mutation; eligibility is not an unconditional launch deadline'}));
  assert.ok(Object.values(report.openingSkillAudit.firstKind1BySlot).every(e=>Number.isFinite(e.clock)&&Number.isFinite(e.activeSeconds)));
  report.openingSkillAudit.observed=Object.keys(report.openingSkillAudit.firstKind1BySlot).length>0;
  assert.ok(report.openingSkillAudit.observed,'selected six-actor fixture must expose a real first skill launch within the bounded observation window');
  assert.ok(Object.values(report.openingSkillAudit.firstKind1BySlot).every(e=>e.clock>=300),'opening eligibility is not earlier than 300 active ticks');
  const vfxEvents=await page.evaluate(()=>__qaRecoveryDiagnostics().events.filter(e=>e.stage==='first-vfx-render'));
  assert.deepEqual(vfxEvents.map(e=>e.phase),['start','done'],'first visible Three render must return without error');
  assert.ok(vfxEvents[0].elapsedMs>=report.gpuWarmup.events[1].elapsedMs,'warmup precedes first visible VFX submission');
  report.firstVisibleVfxSubmission={events:vfxEvents,submissionOnly:true,gpuCompletionClaim:false,notEquivalentToFirstSkillLaunch:true};
  assert.equal(await page.locator('#cm-root').getAttribute('data-active-screen'),'BATTLE_FIELD');
  assert.equal(await page.evaluate(()=>__qaMatch===__qaBattleRuntime()),true,'no page/match replacement after the first cast');
  report.cameraAudit=await page.evaluate(()=>{__qaStage.app.ticker.remove(__qaAuditTick);return __qaCameraAudit;});assert.ok(report.cameraAudit.frames>100);assert.deepEqual(report.cameraAudit.violations,[]);assert.deepEqual(report.cameraAudit.primaryViolations,[]);
  await page.locator('.cm-vs5-exit').click();await page.locator('.cm-dialog__action[data-action="leave"]').click();await step();report.exitScreen=await page.locator('#cm-root').getAttribute('data-active-screen');assert.notEqual(report.exitScreen,'BATTLE_FIELD');
 }
 assert.ok(report.requests.includes(manifestPath)&&report.requests.includes(expectedFrame.src));assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({phase,cases:report.cases.length,errors:report.errors,missing:report.missing}));
}catch(e){report.failure=String(e);throw e;}finally{fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
