// Ranch partner-appearance load diagnostics (docs/reports/ranch-load-2026-11-08/).
//
// Reproduces "正在載入夥伴外觀…" after the ranch is shown, on an unmodified
// built artifact (default dist/github-playtest) served with GitHub-Pages-like
// cache headers. One fixed save (tests/fixtures/ranch-load-diagnostic-save.json,
// re-stamped to the install time), one device profile and one operation path:
//
//   A  cold HTTP cache: title -> continue -> ranch
//   C  same page: ranch -> Dex -> ranch, three round trips
//   B  reload keeping the HTTP cache: title -> continue -> ranch
//   E  backpack -> catalyst evolution (real UI) -> evolution target load -> new species
//   E2 same page: ranch -> Dex -> ranch after the evolution
//   R  reload: the evolved species is what the save restores
//
// Only test-side observers are installed (no product module is rewritten). It
// records the scene's own data-resident-assets publication, the resident
// notice, every request seen by the server (including Pixi decode-worker
// fetches that page resource timing cannot see), SubtleCrypto digests, long
// tasks and long animation frames. CPU/GPU numbers are this machine's
// software-WebGL Chromium only; they are not iPhone measurements.
//
// node tests/championship-ranch-load-diagnostics-browser.cjs --label before [--profile mobile-4g] [--trace]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');
const {createPagesLikeServer}=require('./support/pages-like-static-server.cjs');

const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];};
const ARTIFACT=path.resolve(arg('artifact',process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest'));
const LABEL=arg('label','run'),PROFILE=arg('profile','unthrottled'),TRACE=process.argv.includes('--trace');
// full: A, C x3, B, E, E2, R. reentry: A, then leave the ranch while the
// evolution target is still loading and come back (the reported second wait).
// interrupt: A, catalyst, then reload the page before the evolution finishes
// and read what the save restored (species, catalyst stock).
const SCENARIO=arg('scenario','full');
const OUT=path.resolve(arg('out','.tmp/ranch-load-diagnostics'),`${LABEL}-${PROFILE}${SCENARIO==='full'?'':'-'+SCENARIO}`);
const EXECUTABLE=process.env.CHAMPIONSHIP_CHROMIUM||(fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined);
const PROFILES={unthrottled:{latency:0,download:-1,upload:-1,cpu:1},
  // Synthetic shaping only (CDP); not a physical phone or carrier network.
  'mobile-4g':{latency:150,download:4_000_000/8,upload:1_000_000/8,cpu:4},
  // Network shaping only: isolates request-chain cost from this machine's CPU.
  'mobile-net':{latency:150,download:4_000_000/8,upload:1_000_000/8,cpu:1}};
const SAVE_KEY='championshipModernSave:v1',MAIN='resident:species-000',TARGET='championship:creature:species-096';
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/ranch-load-diagnostic-save.json'),'utf8');

// Runs in the page before any product script. Observers only.
function installObservers(save){
  try{
    if(!localStorage.getItem('championshipModernSave:v1')){
      const value=JSON.parse(save),now=Date.now();value.updatedAt=new Date(now).toISOString();
      if(value.raising?.nativeHome?.discoveries)value.raising.nativeHome.discoveries.lastAt=now;
      localStorage.setItem('championshipModernSave:v1',JSON.stringify(value));
    }
  }catch(error){console.error('DIAGNOSTIC_SAVE_INSTALL',error);}
  const epoch=()=>performance.timeOrigin+performance.now();
  const d=globalThis.__ranchDiag={residents:[],load:[],notice:[],digests:[],longTasks:[],longFrames:[],frames:0,marks:{}};
  const digest=crypto.subtle.digest.bind(crypto.subtle);
  crypto.subtle.digest=async function(algorithm,data){
    const t=epoch(),bytes=data?.byteLength??0;
    try{return await digest(algorithm,data);}finally{d.digests.push({t,ms:epoch()-t,bytes});}
  };
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())d.longTasks.push({t:performance.timeOrigin+e.startTime,ms:e.duration});}).observe({type:'longtask',buffered:true});}catch{}
  let last=null;const frame=now=>{d.frames++;if(last!==null&&now-last>50)d.longFrames.push({t:performance.timeOrigin+now,ms:now-last});last=now;requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
  let lastResidents=null,lastLoad=null,lastNotice=null;
  const inspect=()=>{
    const host=document.querySelector('.int-rh2-field-host');
    const load=host?.dataset.loadState??null;if(load!==lastLoad){lastLoad=load;d.load.push({t:epoch(),state:load});}
    const residents=host?.dataset.residentAssets??null;if(residents!==lastResidents){lastResidents=residents;d.residents.push({t:epoch(),value:residents?JSON.parse(residents):null});}
    const status=document.querySelector('.int-rh2-resident-assets');
    const notice=status&&!status.hidden&&status.dataset.phase==='ready'?status.querySelector('[role=status]')?.textContent??'':null;
    if(notice!==lastNotice){lastNotice=notice;d.notice.push({t:epoch(),text:notice});}
  };
  new MutationObserver(inspect).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-load-state','data-resident-assets','hidden','data-phase']});
}

const results={schemaVersion:1,label:LABEL,profile:PROFILE,scenario:SCENARIO,artifact:path.relative(process.cwd(),ARTIFACT),generatedAt:new Date().toISOString(),
  measurement:'Loopback built artifact, GitHub-Pages-like cache headers, Chromium software WebGL; not an iPhone/Safari measurement',cases:[]};

(async()=>{
  const build=JSON.parse(fs.readFileSync(path.join(ARTIFACT,'pages-build.json'),'utf8'));
  Object.assign(results,{buildId:build.buildId,artifactCommit:build.commit});
  fs.mkdirSync(OUT,{recursive:true});
  // A --external-characters build ships its character bytes in a separate
  // immutable release; on loopback the resolver keeps the logical paths, so
  // they are served from this checkout (byte-identical, verified in the report).
  const pages=createPagesLikeServer({root:ARTIFACT,now:()=>Date.now(),
    fallbacks:build.externalCharacterAssets?[{prefix:'assets/production/characters/',root:process.cwd()}]:[]});const base=await pages.listen();
  // The ranch runs on the device's local time; pick a fixed UTC offset that puts
  // this run at about 13:00 local, clear of the 22:00-07:00 night nap.
  const utcHour=new Date().getUTCHours(),offset=((13-utcHour+36)%24)-12,timezoneId=offset===0?'Etc/UTC':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`;
  Object.assign(results,{timezoneId,localHourAtStart:(utcHour+offset+24)%24,externalCharacterAssets:Boolean(build.externalCharacterAssets)});
  const browser=await chromium.launch({executablePath:EXECUTABLE,headless:true});
  const context=await browser.newContext({...devices['Pixel 7'],locale:'zh-TW',timezoneId,
    recordHar:{path:path.join(OUT,'network.har'),content:'omit',mode:'minimal'}});
  await context.addInitScript(installObservers,fixture);
  const page=await context.newPage();page.setDefaultTimeout(180000);
  const errors=[],warnings=[];
  page.on('pageerror',e=>errors.push({t:Date.now(),message:e.message}));
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning'&&!/GL Driver Message/.test(m.text()))warnings.push({t:Date.now(),type:m.type(),text:m.text().slice(0,400)});});
  const cdp=await context.newCDPSession(page),shape=PROFILES[PROFILE];
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:shape.latency,downloadThroughput:shape.download,uploadThroughput:shape.upload});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:shape.cpu});

  const diag=()=>page.evaluate(()=>{const d=globalThis.__ranchDiag;return JSON.parse(JSON.stringify(d));});
  const residentsNow=()=>page.evaluate(()=>JSON.parse(document.querySelector('.int-rh2-field-host')?.dataset.residentAssets||'[]'));
  const allReady=list=>list.length>0&&list.every(r=>r.state==='ready');
  async function waitAllResidentsReady(timeout=180000){
    await page.waitForFunction(()=>{const h=document.querySelector('.int-rh2-field-host');if(h?.dataset.loadState!=='ready')return false;
      const r=JSON.parse(h.dataset.residentAssets||'[]');return r.length>0&&r.every(x=>x.state==='ready');},null,{timeout});
  }
  // A real touch tap on a toolbar tool: input -> pressed state -> next painted
  // frame, while the ranch runs. The second tap restores the selection.
  async function tapResponse(){
    const cell=page.locator('.cm-toolbar__cell[data-tool-id]').nth(1);
    await cell.evaluate(el=>{const d=globalThis.__ranchDiag;d.tap=null;
      el.addEventListener('pointerdown',()=>{d.tap={down:performance.now()};},{once:true,capture:true});
      const o=new MutationObserver(()=>{if(d.tap&&!d.tap.changed){d.tap.changed=performance.now();o.disconnect();
        requestAnimationFrame(()=>requestAnimationFrame(()=>{d.tap.painted=performance.now();}));}});
      o.observe(el,{attributes:true,attributeFilter:['aria-pressed']});});
    await cell.tap();
    await page.waitForFunction(()=>globalThis.__ranchDiag.tap?.painted,null,{timeout:30000});
    const result=await page.evaluate(()=>{const t=globalThis.__ranchDiag.tap;return {inputToStateMs:Math.round(t.changed-t.down),inputToPaintMs:Math.round(t.painted-t.down)};});
    await cell.tap();await page.waitForTimeout(300);
    return result;
  }
  function summarize(name,start,end,snapshot,extra={}){
    const within=x=>x.t>=start&&x.t<=end;
    const requests=pages.log.filter(within),paths=new Map();
    for(const r of requests)paths.set(r.path,(paths.get(r.path)??0)+1);
    const duplicates=[...paths].filter(([,n])=>n>1).map(([p,n])=>({path:p.replace(/^\/championship-2026\//,''),count:n}));
    const reviewed=requests.filter(r=>/\/characters\/reviewed/.test(r.path)&&/\.(webp|png)$/.test(r.path));
    const fieldReady=snapshot.load.find(x=>x.t>=start&&x.state==='ready')?.t??null;
    const firstAllReady=snapshot.residents.find(x=>x.t>=start&&x.value&&allReady(x.value))?.t??null;
    const noticeSpans=[];let open=null;
    for(const n of snapshot.notice.filter(within)){if(n.text&&open===null)open=n;else if(!n.text&&open){noticeSpans.push({from:open.t-start,ms:n.t-open.t,text:open.text});open=null;}}
    if(open)noticeSpans.push({from:open.t-start,ms:end-open.t,text:open.text,unfinished:true});
    const pendingKinds=[...new Set(snapshot.residents.filter(within).flatMap(x=>(x.value??[]).filter(r=>r.state!=='ready').map(r=>`${r.speciesId.replace('championship:creature:','')}:${r.loadKind}:${r.state}`)))];
    const digests=snapshot.digests.filter(within);
    const row={name,startEpoch:start,
      fieldReadyMs:fieldReady===null?null:Math.round(fieldReady-start),
      allResidentsReadyMs:firstAllReady===null?null:Math.round(firstAllReady-start),
      residentsReadyAfterFieldMs:fieldReady!==null&&firstAllReady!==null?Math.round(firstAllReady-fieldReady):null,
      noticeMs:Math.round(noticeSpans.reduce((n,x)=>n+x.ms,0)),noticeSpans,pendingKinds,
      requests:{count:requests.length,status200:requests.filter(r=>r.status===200).length,status304:requests.filter(r=>r.status===304).length,
        bytes200:requests.reduce((n,r)=>n+(r.status===200?r.bytes:0),0),duplicates,
        reviewedImages:reviewed.length,reviewedImageDistinct:new Set(reviewed.map(r=>r.path)).size,
        reviewedImageBytes:reviewed.reduce((n,r)=>n+r.bytes,0)},
      digests:{count:digests.length,bytes:digests.reduce((n,x)=>n+x.bytes,0),ms:Math.round(digests.reduce((n,x)=>n+x.ms,0))},
      longTasks:{count:snapshot.longTasks.filter(within).length,maxMs:Math.round(Math.max(0,...snapshot.longTasks.filter(within).map(x=>x.ms))),
        totalMs:Math.round(snapshot.longTasks.filter(within).reduce((n,x)=>n+x.ms,0))},
      longFrames:{count:snapshot.longFrames.filter(within).length,maxMs:Math.round(Math.max(0,...snapshot.longFrames.filter(within).map(x=>x.ms)))},
      ...extra};
    results.cases.push(row);console.log(JSON.stringify({case:name,fieldReadyMs:row.fieldReadyMs,allResidentsReadyMs:row.allResidentsReadyMs,
      noticeMs:row.noticeMs,pendingKinds,requests:row.requests.count,reviewedImages:row.requests.reviewedImages,digests:row.digests.count,
      duplicates:duplicates.length,...extra}));
    return row;
  }
  const settle=()=>page.waitForTimeout(1500);
  async function enterFromTitle(name){
    await page.locator('#cm-login').waitFor({state:'attached'});
    if(await page.locator('#cm-film-skip').isVisible().catch(()=>false))await page.locator('#cm-film-skip').click().catch(()=>{});
    await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
    await page.locator('#cm-login').click();
    const start=Date.now();await page.locator('#cm-continue').click();
    await waitAllResidentsReady();await settle();
    const end=Date.now(),tap=await tapResponse();
    return summarize(name,start,end,await diag(),{tap});
  }
  async function roundTrip(name){
    await page.locator('.cm-toolbar__quick-entry[data-entry-id="database"]').click();
    await page.waitForFunction(()=>!document.querySelector('.int-rh2-field-host'));
    await page.waitForTimeout(800);
    const exit=page.locator('.cm-vs2-footer .cm-vs2-action').first();
    const start=Date.now();await exit.click();
    await waitAllResidentsReady();await settle();
    const end=Date.now(),tap=await tapResponse();
    return summarize(name,start,end,await diag(),{tap});
  }

  // E: catalyst evolution through the bag (the partner card's own entry event).
  async function catalystEvolution(name,{reentry=false}={}){
  const before=await residentsNow();assert.ok(before.some(r=>r.creatureId===MAIN&&r.speciesId.endsWith('species-034')),'Main partner species-034 present');
  if(TRACE)await browser.startTracing(page,{path:path.join(OUT,'evolution-trace.json'),screenshots:false});
  await page.evaluate(id=>document.dispatchEvent(new CustomEvent('cm-open-backpack',{detail:{tab:'metals',partnerId:id}})),MAIN);
  await page.locator('.cm-backpack [data-use="metal:chrono-ore-shard"]').click();
  const catalyst=page.locator('.cm-backpack [data-use-mode="CATALYST"]');await catalyst.waitFor();
  const start=Date.now();await catalyst.click();
  const receipt=await page.locator('.cm-backpack__receipt').first().evaluate(el=>({ok:el.dataset.ok,text:el.textContent.trim()}));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.cm-backpack'),null,{timeout:10000}).catch(async()=>{
    await page.locator('button:has-text("關閉")').last().click();await page.waitForFunction(()=>!document.querySelector('.cm-backpack'));});
  const closed=Date.now();let reentryMs=null;
  if(reentry){
    // Leave as soon as the target is loading, then return to the ranch.
    await page.waitForFunction(()=>JSON.parse(document.querySelector('.int-rh2-field-host')?.dataset.residentAssets||'[]')
      .some(r=>r.creatureId==='resident:species-000'&&r.loadKind==='evolution'&&r.state==='loading'),null,{timeout:5000}).catch(()=>{});
    await page.locator('.cm-toolbar__quick-entry[data-entry-id="database"]').click();
    await page.waitForFunction(()=>!document.querySelector('.int-rh2-field-host'));
    reentryMs=Date.now()-start;await page.locator('.cm-vs2-footer .cm-vs2-action').first().click();
  }
  const evolved=await page.waitForFunction(target=>JSON.parse(document.querySelector('.int-rh2-field-host')?.dataset.residentAssets||'[]')
    .some(r=>r.creatureId==='resident:species-000'&&r.speciesId===target&&r.state==='ready'),TARGET,{timeout:180000}).then(()=>Date.now());
  await waitAllResidentsReady();await settle();
  if(TRACE)await browser.stopTracing();
  const snap=await diag();
  const evo=snap.residents.filter(x=>x.t>=start).map(x=>({t:x.t,main:(x.value??[]).find(r=>r.creatureId===MAIN)}));
  const loading=evo.find(x=>x.main?.loadKind==='evolution'&&x.main.state==='loading'),readyAfter=loading&&evo.find(x=>x.t>loading.t&&x.main?.state==='ready');
  summarize(name,start,Date.now(),snap,{reentryMs,receipt,dialogClosedMs:closed-start,
    evolutionTargetLoadMs:loading&&readyAfter?Math.round(readyAfter.t-loading.t):null,
    evolutionTargetLoadStartMs:loading?Math.round(loading.t-start):null,newSpeciesReadyMs:evolved-start});
  }

  try{
    await page.goto(base+'championship.html');
    results.cases.push({name:'environment',userAgent:await page.evaluate(()=>navigator.userAgent),
      webgl:await page.evaluate(()=>{const c=document.createElement('canvas').getContext('webgl2');const x=c?.getExtension('WEBGL_debug_renderer_info');return x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null;})});
    await enterFromTitle('A-cold');
    if(SCENARIO==='full')for(let i=1;i<=3;i++)await roundTrip(`C-roundtrip-${i}`);
    if(SCENARIO==='full'){await page.reload();await enterFromTitle('B-reload-warm-http-cache');}
    if(SCENARIO==='interrupt'){
      const stock=()=>page.evaluate(k=>{const v=JSON.parse(localStorage.getItem(k));return {species:v.creature.speciesId,metals:v.progression?.cyberGacha?.metals??{}};},SAVE_KEY);
      results.interrupt={before:await stock()};
      await page.evaluate(id=>document.dispatchEvent(new CustomEvent('cm-open-backpack',{detail:{tab:'metals',partnerId:id}})),MAIN);
      await page.locator('.cm-backpack [data-use="metal:chrono-ore-shard"]').click();
      await page.locator('.cm-backpack [data-use-mode="CATALYST"]').click();
      results.interrupt.receipt=await page.locator('.cm-backpack__receipt').first().evaluate(el=>({ok:el.dataset.ok,text:el.textContent.trim()}));
      results.interrupt.afterCatalyst=await stock();
      await page.reload();await enterFromTitle('I-reload-during-evolution');
      // Give a restarted evolution time to appear before reading the outcome.
      await page.waitForTimeout(20000);
      results.interrupt.afterReload={...await stock(),residents:(await residentsNow()).map(r=>({creatureId:r.creatureId,speciesId:r.speciesId,state:r.state,loadKind:r.loadKind}))};
      results.errors=errors;results.warnings=warnings.slice(0,80);results.status=errors.length?'PAGE_ERRORS':'COMPLETE';
      console.log(JSON.stringify(results.interrupt));return;
    }
    if(SCENARIO==='reentry'){await catalystEvolution('E-reentry-during-target-load',{reentry:true});results.errors=errors;results.warnings=warnings.slice(0,80);results.status=errors.length?'PAGE_ERRORS':'COMPLETE';return;}
    await catalystEvolution('E-catalyst-evolution');
    await roundTrip('E2-roundtrip-after-evolution');
    await page.reload();const restored=await enterFromTitle('R-reload-after-evolution');
    const after=await residentsNow();
    results.saveCheck={mainSpecies:after.find(r=>r.creatureId===MAIN)?.speciesId??null,residentCount:after.length,
      storedSpecies:await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).creature.speciesId,SAVE_KEY),
      storedMetals:await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).progression?.cyberGacha?.metals??{},SAVE_KEY)};
    assert.equal(results.saveCheck.mainSpecies,TARGET,'Evolved species restored from the save');
    // The fixture holds two shards; the completed catalyst spends exactly one.
    assert.equal(results.saveCheck.storedMetals['metal:chrono-ore-shard'],1,'One catalyst shard spent with the evolution');
    assert.equal(restored.allResidentsReadyMs!==null,true);
    results.errors=errors;results.warnings=warnings.slice(0,80);results.status=errors.length?'PAGE_ERRORS':'COMPLETE';
  }catch(error){
    results.status='FAILED';results.failure=String(error?.stack??error);results.errors=errors;results.warnings=warnings.slice(0,80);
    await page.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});
    process.exitCode=1;
  }finally{
    results.serverLog=pages.log.length;
    fs.writeFileSync(path.join(OUT,'server-requests.json'),JSON.stringify(pages.log));
    fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(results,null,1));
    await context.close().catch(()=>{});await browser.close();await pages.close();
    console.log(`summary: ${path.relative(process.cwd(),path.join(OUT,'summary.json'))} status=${results.status}`);
  }
})();
