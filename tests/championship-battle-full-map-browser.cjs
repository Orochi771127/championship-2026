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
  body+='\nglobalThis.__qaBattleRuntime=()=>battleRuntime;\n';
 }
 if(rel.endsWith('/createBattleFieldPixiPresentation.js'))body=body.replace('const { app } = stage;','const { app } = stage; globalThis.__qaStage=stage; globalThis.__qaSource=source;').replace('const actors = new Map();','const actors = new Map(); globalThis.__qaActors=actors; globalThis.__qaWorld=world;');
 return body;
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});let report={phase,profile,runtimeBaseline:runtimeSource?{source:runtimeSource,base:process.env.CHAMPIONSHIP_QA_RUNTIME_BASE||null,sha256:crypto.createHash('sha256').update(fs.readFileSync(runtimeSource)).digest('hex')}:null,sourceRoot:repo,origin:base,entryQuery,expectedMap:{assetId:manifest.assetId,manifest:manifestPath,manifestSha256:hash(manifestPath),frame:expectedFrame.src,frameSha256:hash(expectedFrame.src)},requests:[],cases:[],errors:[],missing:[],physicalDevice:false,publication:'NOT_PUBLISHED'};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(!u.href.startsWith(base)){report.missing.push(u.origin);return route.abort();}const rel=decodeURIComponent(u.pathname.slice(new URL(base).pathname.length)),file=path.resolve(repo,rel||'championship.html');if([manifestPath,expectedFrame.src].includes(rel)&&!report.requests.includes(rel))report.requests.push(rel);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){report.missing.push(rel);return route.fulfill({status:404,body:'missing QA input'});}if(rel.endsWith('.js'))return route.fulfill({body:hooks(fs.readFileSync(runtimeSource&&rel==='src/championship/app/battleRuntime.js'?runtimeSource:file,'utf8'),rel),contentType:'text/javascript'});return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});});
 await page.addInitScript(seed=>{localStorage.setItem('championshipModernSave:v1',seed);localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:'zh-Hant',theme:'warm',muted:true,reducedMotion:'off'}));},fs.readFileSync(repo+'/qa/championship-full-qa-save.json','utf8'));
 await page.goto(base+'championship.html?'+entryQuery,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await page.locator('#cm-login').click();await page.locator('#cm-continue').click();await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 async function step(ms=67){await page.waitForTimeout(40);await page.clock.runFor(ms);}
 await page.locator('button[data-menu-id="SYSTEM"]').click();await page.locator('[data-entry-id="battle"]').click();await page.locator('.cm-vs5-cube__face[data-face-id="PRACTICE_BATTLE"]').click();
 await page.locator('.cm-vs5-arena-choice select').waitFor();
 const selects=await page.locator('select').evaluateAll(es=>es.map(e=>({class:e.className,options:[...e.options].map(o=>[o.value,o.textContent])})));console.log(JSON.stringify({selects}));
 const arena=page.locator('.cm-vs5-arena-select select, select.cm-vs5-arena-select');
 const allSelects=page.locator('select');if(await allSelects.count())await allSelects.last().selectOption('3');
 await page.locator('.cm-vs5-practice-member button:nth-of-type(1):enabled').first().click();await page.locator('.cm-vs5-practice-member button:nth-of-type(2):enabled').first().click();await page.locator('.cm-vs5-footer .cm-vs5-action--primary').click();
 for(let i=0;i<900;i++){if(await page.locator('.cm-vs5-field[aria-busy="false"] canvas.cm-field-canvas').count())break;await step(17);}
 assert.equal(await page.locator('.cm-vs5-field[aria-busy="false"] canvas.cm-field-canvas').count(),1);
 await page.evaluate(()=>{
   globalThis.__qaMatch=__qaBattleRuntime();globalThis.__qaAppIdentity=__qaStage.app;globalThis.__qaTicker=__qaStage.app.ticker;
   globalThis.__qaCameraAudit={frames:0,violations:[],primaryViolations:[],byViewport:{},minZoom:Infinity,maxZoom:0};
   globalThis.__qaAuditTick=()=>{
    const p=__qaBattleScene?.getFieldPlacement();if(!p)return;const r=p.artRect,a=__qaCameraAudit;
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
 for(const [i,[width,height]] of [[390,844],[844,390],[1366,768],[320,568],[568,320],[390,844],[844,390],[390,844]].entries()){
  await page.setViewportSize({width,height});await step();await step();
  const s=await page.evaluate(()=>{const p=__qaBattleScene.getFieldPlacement(),d=__qaBattleScene.getDiagnostics(),box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}:null;};return {screen:document.querySelector('#cm-root').dataset.activeScreen,viewport:[innerWidth,innerHeight],placement:p,diagnostics:d,canvas:box('.cm-field-canvas'),field:box('.cm-vs5-field'),clock:box('.cm-vs5-clock'),opponents:box('.cm-vs5-roster--opponent'),players:box('.cm-vs5-roster--player'),log:box('.cm-vs5-log'),sameMatch:__qaMatch===__qaBattleRuntime(),sameApp:__qaAppIdentity===__qaStage.app,sameTicker:__qaTicker===__qaStage.app.ticker,overflow:document.documentElement.scrollWidth>innerWidth,sceneLabels:__qaStage.app.stage.children.flatMap(c=>c.children?.map(x=>x.label)||[])};});
  assert.equal(s.screen,'BATTLE_FIELD');assert.ok(s.sameMatch&&s.sameApp&&s.sameTicker);assert.equal(s.overflow,false);
  assert.equal(s.diagnostics.art.fieldId,'field_bm04_01');assert.equal(s.diagnostics.art.assetId,manifest.assetId);
  s.layout=await page.evaluate(()=>{const shell=document.querySelector('.cm-vs5-shell'),log=document.querySelector('.cm-vs5-log'),r=log.getBoundingClientRect(),sr=shell.getBoundingClientRect(),cr=document.querySelector('.cm-vs5-clock').getBoundingClientRect(),style=getComputedStyle(shell),ends=[...log.children].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().bottom);return {rows:style.gridTemplateRows,alignContent:style.alignContent,shellTop:sr.top,shellBottom:sr.bottom,logHeight:r.height,blankBelowLogContent:r.bottom-Math.max(r.top,...ends),centerDelta:Math.abs((cr.top+r.bottom)/2-(sr.top+sr.bottom)/2),url:location.href};});
  if(width<height){assert.ok(s.layout.logHeight<120,JSON.stringify(s.layout));assert.ok(s.layout.blankBelowLogContent<24);assert.ok(s.layout.centerDelta<2,JSON.stringify(s.layout));}
  if(phase!=='before'){const p=s.placement,r=p.artRect;const bounds={left:r.x*p.zoom+p.x,top:r.y*p.zoom+p.y,right:(r.x+r.width)*p.zoom+p.x,bottom:(r.y+r.height)*p.zoom+p.y};assert.ok(bounds.left<=.01&&bounds.top<=.01&&bounds.right>=p.width-.01&&bounds.bottom>=p.height-.01,JSON.stringify(bounds));s.mapBounds=bounds;
   s.alignment=await page.evaluate(()=>{const p=__qaBattleScene.getFieldPlacement(),v=__qaSource.getView(),d=__qaBattleScene.getDiagnostics();return d.dynamicFx.bodies.map(b=>{const stand=v.combatants[b.slot].stand,expected={x:p.artRect.x+stand.x*p.artRect.width,y:p.artRect.y+stand.y*p.artRect.height};const actual=__qaWorld.toGlobal({x:expected.x,y:expected.y});return {slot:b.slot,localError:Math.max(Math.abs(b.x-expected.x),Math.abs(b.groundY-expected.y)),screenError:Math.max(Math.abs(actual.x-(expected.x*p.zoom+p.x)),Math.abs(actual.y-(expected.y*p.zoom+p.y)))};});});
   assert.ok(s.alignment.every(a=>a.localError<=1&&a.screenError<.01));
   assert.ok(s.field.right<=width+1&&s.field.bottom<=height+1);
   if(width>height){assert.ok(s.field.width>=width*.67);assert.ok(s.field.height>=height*.8);assert.ok(s.opponents.x>=s.field.right-1&&s.players.x>=s.field.right-1&&s.log.x>=s.field.right-1);}
  }
  await page.locator('.cm-vs5-exit').scrollIntoViewIfNeeded();await page.locator('.cm-vs5-exit').click();await page.locator('.cm-dialog__action[data-action="stay"]').click();await step(17);
  assert.equal(await page.evaluate(()=>__qaMatch===__qaBattleRuntime()),true);s.exitDialogAndResume=true;
  const file=`${phase}-${i}-${width}x${height}.png`;await page.screenshot({path:path.join(out,file)});s.screenshot=file;report.cases.push(s);
 }
 if(phase!=='before'){
  // Synthetic notch budgets exercise layout arithmetic; real iOS safe areas remain unverified.
  await page.addStyleTag({content:'.cm-vs5-shell[data-responsive-battle="candidate"] {padding:20px 30px 16px 30px !important;}'});await page.setViewportSize({width:844,height:390});await step();await step();
  report.syntheticSafeArea=await page.evaluate(()=>{const r=document.querySelector('.cm-vs5-field').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};});assert.ok(report.syntheticSafeArea.x>=30&&report.syntheticSafeArea.y>=68&&report.syntheticSafeArea.bottom<=374);
  await page.screenshot({path:path.join(out,phase+'-safe-area-844x390.png')});
  // Observe actual running frames, including native special prelude and effects.
  report.liveFrames=[];for(let i=0;i<25;i++){await step(400);const d=await page.evaluate(()=>{const p=__qaBattleScene.getFieldPlacement(),r=p.artRect,v=__qaSource.getView();return {frame:v.nativeLifecycle?.frame,special:!!v.specialPrelude,fx:__qaBattleScene.getDiagnostics().dynamicFx.eventsHandled,zoom:p.zoom,left:r.x*p.zoom+p.x,top:r.y*p.zoom+p.y,right:(r.x+r.width)*p.zoom+p.x,bottom:(r.y+r.height)*p.zoom+p.y,width:p.width,height:p.height};});assert.ok(d.left<=.01&&d.top<=.01&&d.right>=d.width-.01&&d.bottom>=d.height-.01);report.liveFrames.push(d);}
  report.cameraAudit=await page.evaluate(()=>{__qaStage.app.ticker.remove(__qaAuditTick);return __qaCameraAudit;});assert.ok(report.cameraAudit.frames>100);assert.deepEqual(report.cameraAudit.violations,[]);assert.deepEqual(report.cameraAudit.primaryViolations,[]);
  await page.locator('.cm-vs5-exit').click();await page.locator('.cm-dialog__action[data-action="leave"]').click();await step();report.exitScreen=await page.locator('#cm-root').getAttribute('data-active-screen');assert.notEqual(report.exitScreen,'BATTLE_FIELD');
 }
 assert.ok(report.requests.includes(manifestPath)&&report.requests.includes(expectedFrame.src));assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({phase,cases:report.cases.length,errors:report.errors,missing:report.missing}));
}catch(e){report.failure=String(e);throw e;}finally{fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
