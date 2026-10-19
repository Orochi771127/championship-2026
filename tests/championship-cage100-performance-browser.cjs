// Controlled QA contexts only; no persistent browser profile or real user saves.
const {chromium}=require('playwright');
const {serveBuild,resolveAsset}=require('./alternate-form-browser-support.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),artifact=path.join(root,'dist/github-playtest');
const output=path.join(root,'.tmp/browser-qa/cage100'),fixtures=path.join(output,'performance-fixtures');
const cases=JSON.parse(fs.readFileSync(path.join(fixtures,'cases.json'),'utf8'));
const base='https://orochi771127.github.io/championship-2026/',saveKey='championshipModernSave:v1';
const report={started:new Date().toISOString(),scope:'12 isolated QA saves, normal Continue and UI; desktop only',
 limitations:['30/50/80/100 unlocked cells because ordinary land purchases use ten-cell rows; world extent always100',
 'static CM01 versus animated CM39 substitutions is not a same-art animation-off A/B',
 'RAF interval is browser frame cadence, not GPU render duration; pointerup-to-second-RAF is a paint opportunity proxy, not physical input latency',
 'cold local artifact loads, not public internet download speed; 390px viewport is not phone hardware',
 'normal runtime has no map zoom gesture; responsive resize and canvas drag measured'],
 build:((b)=>({buildId:b.buildId,commit:b.commit,createdAt:b.createdAt}))(JSON.parse(fs.readFileSync(path.join(artifact,'pages-build.json'),'utf8'))),cases:[],errors:[]};
const write=()=>fs.writeFileSync(path.join(output,'performance.json'),JSON.stringify(report,null,2));
const summary=a=>{const s=a.filter(Number.isFinite).sort((a,b)=>a-b);return {samples:s.length,p50:s.length?s[Math.max(0,Math.ceil(s.length*.50)-1)]:null,p95:s.length?s[Math.max(0,Math.ceil(s.length*.95)-1)]:null,max:s.at(-1)??null};};
(async()=>{
 let server,browser;
 try{
  server=await serveBuild(artifact);browser=await chromium.launch({channel:'chromium',headless:true,chromiumSandbox:true});
  report.environment={browser:browser.version(),headless:true,sandbox:true,customArgs:[],viewport:{width:1280,height:800},dpr:1,os:process.platform,node:process.version,
   physicalHardware:fs.existsSync(path.join(output,'hardware.json'))?JSON.parse(fs.readFileSync(path.join(output,'hardware.json'),'utf8')):null};
  for(const config of cases.cases.slice(0,process.env.CAGE100_PERF_LIMIT?Number(process.env.CAGE100_PERF_LIMIT):undefined)){
   const row={...config,errors:[]};report.cases.push(row);write();
   const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,locale:'zh-TW',serviceWorkers:'block'});
   let page;
   try{
    await context.route('**/*',async route=>{
     const url=route.request().url();if(url.startsWith(server.origin+'/'))return route.continue();
     if(url.startsWith(base)){const u=new URL(url),relative=u.pathname.slice(new URL(base).pathname.length);if(resolveAsset(artifact,'/'+relative)){const response=await route.fetch({url:server.origin+'/'+relative+u.search,maxRedirects:0});return route.fulfill({response});}}
     row.errors.push({type:'blocked-network',url});return route.abort();
    });
    await context.addInitScript(({fixture,key})=>{
     if(!sessionStorage.getItem('cage100:perf:seeded')){localStorage.setItem(key,fixture);sessionStorage.setItem('cage100:perf:seeded','1');}
     const raf=requestAnimationFrame.bind(window),store=Storage.prototype.setItem;
     const perf=window.__cagePerf={active:false,intervals:[],callbacks:[],inputs:[],writes:[],last:null,longTasks:[]};
     window.requestAnimationFrame=callback=>raf(time=>{const start=performance.now();try{return callback(time);}finally{if(perf.active)perf.callbacks.push(performance.now()-start);}});
     const tick=time=>{if(perf.active){if(perf.last!==null)perf.intervals.push(time-perf.last);perf.last=time;}else perf.last=null;raf(tick);};raf(tick);
     document.addEventListener('pointerup',event=>{const start=performance.now();raf(()=>raf(()=>perf.inputs.push({target:event.target?.className?.baseVal??String(event.target?.className??event.target?.tagName),ms:performance.now()-start})));},true);
     Storage.prototype.setItem=function(k,value){const start=performance.now();try{return store.call(this,k,value);}finally{if(k===key)perf.writes.push({ms:performance.now()-start,bytes:new TextEncoder().encode(value).length});}};
     try{new PerformanceObserver(list=>{for(const entry of list.getEntries())if(perf.active)perf.longTasks.push(entry.duration);}).observe({type:'longtask',buffered:false});}catch{}
    },{fixture:fs.readFileSync(path.join(fixtures,config.fixture),'utf8'),key:saveKey});
    page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>row.errors.push({type:'pageerror',message:e.message}));
    const screen=name=>page.locator(`#cm-root[data-active-screen="${name}"]`).waitFor();
    const menu=async(group,entry)=>{await page.locator(`button.cm-toolbar__cell[data-menu-id="${group}"]`).click();await page.locator(`.cm-toolbar__menu:not([hidden]) button[data-entry-id="${entry}"]`).click();};
    const home=async()=>{await screen('RAISING_HOME');await page.waitForFunction(n=>{const host=document.querySelector('.int-rh2-field-host');if(host?.dataset.loadState!=='ready')return false;const assets=JSON.parse(host.dataset.residentAssets??'[]');return assets.length===n&&assets.every(a=>a.state==='ready');},config.actorCount);assert.equal(await page.locator('[data-field-fallback="true"]').count(),0);};
    const start=Date.now();await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await page.locator('#cm-login').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await page.locator('#cm-login').click();
    const continued=Date.now();await page.locator('#cm-continue').click();await home();row.coldLocalReadyMs=Date.now()-start;row.continueToReadyMs=Date.now()-continued;
    row.actual=await page.evaluate(()=>{const host=document.querySelector('.int-rh2-field-host'),canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2')??canvas.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return {residentAssets:JSON.parse(host.dataset.residentAssets??'[]'),gpu:{vendor:gl?.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:gl.VENDOR),renderer:gl?.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)},hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGiB:navigator.deviceMemory,dpr:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null};});
    const sample=async(name,action)=>{
     await page.evaluate(()=>{const p=window.__cagePerf;p.intervals=[];p.callbacks=[];p.longTasks=[];p.last=null;p.active=true;});
     await action();const data=await page.evaluate(()=>{const p=window.__cagePerf;p.active=false;return {intervals:p.intervals,callbacks:p.callbacks,longTasks:p.longTasks};});
     row[name]={frameIntervalMs:summary(data.intervals),rafCallbackCpuMs:summary(data.callbacks),longTasksMs:summary(data.longTasks),over33ms:data.intervals.filter(x=>x>33.4).length};write();
    };
    await page.waitForTimeout(2000);await sample('idle',()=>page.waitForTimeout(8000));
    await sample('drag',async()=>{const box=await page.locator('.int-rh2-field-host canvas').first().boundingBox();assert.ok(box);for(let i=0;i<4;i++){const direction=i%2?-1:1,x=box.x+box.width*(direction===1?.30:.70),y=box.y+box.height*.80;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box.width*.35*direction,y-20,{steps:16});await page.mouse.up();}await page.waitForTimeout(1000);});
    const resized=Date.now();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1000);row.resizeAndOneSecondSettleMs=Date.now()-resized;row.smallViewportOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(500);
    await menu('MANAGEMENT','cageEdit');await screen('CAGE_EDIT');assert.equal(await page.locator('.cm-vs2-cage-slot').count(),100);assert.equal(await page.locator('.cm-vs2-cage-slot[data-unlocked="true"]').count(),config.cells);
    // Pick five static copies far from the first sixteen resident owners.
    const fixture=JSON.parse(fs.readFileSync(path.join(fixtures,config.fixture),'utf8'));
    const chosen=fixture.cageEdit.placements.filter((p,i)=>i>=17&&p.moduleId==='championship:2026:cage:0').slice(-5);assert.equal(chosen.length,5);
    const inputStart=await page.evaluate(()=>window.__cagePerf.inputs.length),editStart=Date.now();
    for(const p of chosen)await page.locator(`.cm-vs2-cage-slot[data-slot-index="${p.slotIndex}"]`).click();
    await page.locator('#cm-root[data-active-screen="CAGE_EDIT"] .cm-vs2-footer .cm-vs2-action--primary').click();
    for(const p of chosen){await page.locator('.cm-vs2-cage-tray__item').filter({has:page.locator('img[src*="field_cm01_01"]')}).click();await page.locator(`.cm-vs2-cage-slot[data-slot-index="${p.slotIndex}"]`).click();}
    await page.locator('#cm-root[data-active-screen="CAGE_EDIT"] .cm-vs2-footer .cm-vs2-action--primary').click();await page.waitForTimeout(100);
    row.continuousPlacement={withdraw:5,replace:5,automationElapsedMs:Date.now()-editStart,pointerupToSecondRafMs:summary(await page.evaluate(i=>window.__cagePerf.inputs.slice(i).map(p=>p.ms),inputStart))};
    await page.locator('#cm-root').getByRole('button',{name:'返回牧場',exact:true}).click();await home();
    if(config.cells===100&&config.actorCount===16)await page.screenshot({path:path.join(output,'performance-100-16.png'),fullPage:true});
    const saveStart=Date.now();await menu('SYSTEM','saveQuit');await page.locator('#cm-login').waitFor({state:'visible'});row.saveQuitUiMs=Date.now()-saveStart;
    row.storage=await page.evaluate(key=>{const text=localStorage.getItem(key),s=JSON.parse(text);return {writes:window.__cagePerf.writes,bytes:new TextEncoder().encode(text).length,placementCount:s.cageEdit.placements.length,uniqueIds:new Set(s.cageEdit.placements.map(p=>p.instanceId)).size,bits:s.shop.bits,diamonds:s.flags.friendsPlaytest.diamonds,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null};},saveKey);
    assert.equal(row.storage.placementCount,config.moduleCount);assert.equal(row.storage.uniqueIds,config.moduleCount);assert.ok(row.storage.bytes<65536);assert.equal(row.storage.bits,8000000);assert.equal(row.smallViewportOverflow,false);assert.deepEqual(row.errors,[]);
    row.storage.setItemMs=summary(row.storage.writes.map(w=>w.ms));row.passed=true;write();console.log(JSON.stringify({cells:row.cells,phase:row.phase,p50:row.idle.frameIntervalMs.p50,p95:row.idle.frameIntervalMs.p95,dragP95:row.drag.frameIntervalMs.p95,load:row.continueToReadyMs,save:row.saveQuitUiMs,errors:row.errors}));
   }catch(error){row.passed=false;row.failure={message:error.message,stack:error.stack};write();if(page)await page.screenshot({path:path.join(output,'performance-failure.png'),fullPage:true}).catch(()=>{});throw error;}
   finally{await context.unrouteAll({behavior:'wait'});await context.close();}
  }
  report.completed=new Date().toISOString();report.passed=report.cases.length===12&&report.cases.every(c=>c.passed);write();
 }finally{await browser?.close();await server?.close();}
})().catch(error=>{report.errors.push({message:error.message,stack:error.stack});write();console.error(error);process.exitCode=1;});
