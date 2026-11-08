// System sweep: every reachable entry from the ranch, round-tripped back to the
// ranch, several cycles, with lifecycle invariants (docs/reports/system-sweep-2026-11-08/).
//
// Unmodified built artifact (default dist/github-playtest) on the GitHub-Pages-
// like loopback server, an isolated browser context and the repository's full
// QA save (qa/championship-full-qa-save.json). Test-side observers only:
//   - page errors, unhandled rejections, console errors, failed requests;
//   - live WebGL textures/buffers/framebuffers and WebGL contexts created;
//   - live window/document listeners, intervals, pending timeouts, blob URLs,
//     requestAnimationFrame callbacks per frame (duplicate loops), DOM nodes;
//   - JS heap after a forced GC (Chromium only), localStorage writes;
//   - whether each entry opened and returned to an operable ranch.
// A value that grows every cycle at the same idle ranch is a leak candidate;
// one sample is direction only. SwiftShader CPU numbers are not iPhone numbers.
//
// node tests/championship-system-sweep-browser.cjs --label main --cycles 4 [--artifact dir]
const fs=require('node:fs'),path=require('node:path');
const {chromium,devices}=require('playwright');
const {createPagesLikeServer}=require('./support/pages-like-static-server.cjs');

const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];};
const ARTIFACT=path.resolve(arg('artifact',process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest'));
const LABEL=arg('label','run'),CYCLES=Number(arg('cycles','4'));
const OUT=path.resolve(arg('out','.tmp/system-sweep'),LABEL);
const EXECUTABLE=process.env.CHAMPIONSHIP_CHROMIUM||(fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined);
const SAVE=fs.readFileSync(path.join(__dirname,'../qa/championship-full-qa-save.json'),'utf8');
// Navigation entries as the toolbar exposes them. endDay changes gameplay state
// and is exercised by its own flow, not by a navigation sweep.
const ENTRIES=[
  {menu:'quick',id:'shop'},{menu:'quick',id:'database'},{menu:'quick',id:'hunt'},{menu:'quick',id:'battle'},
  {menu:'system',id:'backpack'},{menu:'system',id:'journal'},{menu:'system',id:'story'},{menu:'system',id:'medals'},
  {menu:'system',id:'friends'},{menu:'system',id:'account'},{menu:'system',id:'help'},{menu:'system',id:'settings'},
  {menu:'manage',id:'digimon'},{menu:'manage',id:'cageEdit'},{menu:'manage',id:'tamer'},{menu:'manage',id:'schedule'}];

function observers(save){
  try{if(!localStorage.getItem('championshipModernSave:v1'))localStorage.setItem('championshipModernSave:v1',save);}catch{}
  const d=globalThis.__sweep={gl:{texture:0,buffer:0,framebuffer:0,renderbuffer:0},contexts:0,listeners:new Map(),intervals:new Set(),
    timeouts:new Set(),blobs:new Set(),raf:0,frames:0,storageWrites:0,storageBytes:0,storageKeys:{},rejections:[],workers:0,workersTerminated:0,
    workerUrls:{},audio:0,contextList:[],contextLost:0};
  for(const proto of [globalThis.WebGLRenderingContext?.prototype,globalThis.WebGL2RenderingContext?.prototype].filter(Boolean)){
    for(const kind of ['Texture','Buffer','Framebuffer','Renderbuffer']){
      const create=proto['create'+kind],remove=proto['delete'+kind],key=kind.toLowerCase();
      proto['create'+kind]=function(...a){const v=create.apply(this,a);if(v)d.gl[key]++;return v;};
      proto['delete'+kind]=function(o,...a){if(o)d.gl[key]--;return remove.call(this,o,...a);};
    }
  }
  const getContext=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();
  HTMLCanvasElement.prototype.getContext=function(type,...a){const c=getContext.call(this,type,...a);
    if(c&&/webgl/.test(type)&&!seen.has(c)){seen.add(c);d.contexts++;d.contextList.push(new WeakRef(this));
      this.addEventListener('webglcontextlost',()=>d.contextLost++);}return c;};
  const watched=t=>t===globalThis||t===document||t===document.documentElement||t===document.body||t===globalThis.visualViewport;
  const name=t=>t===globalThis?'window':t===document?'document':t===globalThis.visualViewport?'visualViewport':'element';
  const live=new WeakMap(),add=EventTarget.prototype.addEventListener,rem=EventTarget.prototype.removeEventListener;
  const bump=(key,n)=>d.listeners.set(key,(d.listeners.get(key)??0)+n);
  EventTarget.prototype.addEventListener=function(type,fn,opt){
    if(fn&&watched(this)&&!(typeof opt==='object'&&opt?.once)){
      const capture=typeof opt==='boolean'?opt:!!opt?.capture,key=`${name(this)}:${type}`,id=`${key}:${capture}`;
      let set=live.get(fn);if(!set)live.set(fn,set=new Set());
      if(!set.has(id)){set.add(id);bump(key,1);
        opt?.signal?.addEventListener?.('abort',()=>{if(set.delete(id))bump(key,-1);},{once:true});}
    }
    return add.call(this,type,fn,opt);
  };
  EventTarget.prototype.removeEventListener=function(type,fn,opt){
    if(fn&&watched(this)){const capture=typeof opt==='boolean'?opt:!!opt?.capture,key=`${name(this)}:${type}`,set=live.get(fn);
      if(set?.delete(`${key}:${capture}`))bump(key,-1);}
    return rem.call(this,type,fn,opt);
  };
  const si=globalThis.setInterval,ci=globalThis.clearInterval,st=globalThis.setTimeout,ct=globalThis.clearTimeout;
  globalThis.setInterval=function(...a){const id=si.apply(this,a);d.intervals.add(id);return id;};
  globalThis.clearInterval=function(id){d.intervals.delete(id);return ci.call(this,id);};
  globalThis.setTimeout=function(fn,...a){let id;const wrapped=typeof fn==='function'?function(...x){d.timeouts.delete(id);return fn.apply(this,x);}:fn;
    id=st.call(this,wrapped,...a);d.timeouts.add(id);return id;};
  globalThis.clearTimeout=function(id){d.timeouts.delete(id);return ct.call(this,id);};
  const raf=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=function(fn){d.raf++;return raf.call(this,fn);};
  const frame=()=>{d.frames++;raf.call(globalThis,frame);};raf.call(globalThis,frame);
  const cu=URL.createObjectURL,ru=URL.revokeObjectURL;
  URL.createObjectURL=function(o){const u=cu.call(this,o);d.blobs.add(u);return u;};
  URL.revokeObjectURL=function(u){d.blobs.delete(u);return ru.call(this,u);};
  const W=globalThis.Worker;
  if(W){const terminate=W.prototype.terminate;W.prototype.terminate=function(){d.workersTerminated++;return terminate.call(this);};
    globalThis.Worker=new Proxy(W,{construct(t,a){d.workers++;const src=String(a[0]).replace(/^blob:.*/,'blob:').replace(/^.*\//,'').slice(0,60);
      d.workerUrls[src]=(d.workerUrls[src]??0)+1;return new t(...a);}});}
  const A=globalThis.AudioContext;if(A)globalThis.AudioContext=new Proxy(A,{construct(t,a){d.audio++;return new t(...a);}});
  const setItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(this===globalThis.localStorage){d.storageWrites++;d.storageBytes+=String(v).length;
    d.storageKeys[k]=(d.storageKeys[k]??0)+1;}return setItem.call(this,k,v);};
  addEventListener('unhandledrejection',e=>d.rejections.push(String(e.reason?.message??e.reason).slice(0,300)));
}

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const build=JSON.parse(fs.readFileSync(path.join(ARTIFACT,'pages-build.json'),'utf8'));
  const pages=createPagesLikeServer({root:ARTIFACT,now:()=>Date.now(),
    fallbacks:build.externalCharacterAssets?[{prefix:'assets/production/characters/',root:process.cwd()}]:[]});
  const base=await pages.listen();
  const utcHour=new Date().getUTCHours(),offset=((13-utcHour+36)%24)-12,timezoneId=offset===0?'Etc/UTC':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`;
  const browser=await chromium.launch({executablePath:EXECUTABLE,headless:true,args:['--enable-precise-memory-info','--js-flags=--expose-gc']});
  const context=await browser.newContext({...devices['Pixel 7'],locale:'zh-TW',timezoneId});
  await context.addInitScript(observers,SAVE);
  const page=await context.newPage();page.setDefaultTimeout(60000);
  const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.enable');
  const events=[];let current='boot';const taintedCycles=new Set();
  const note=(kind,detail)=>events.push({t:Date.now(),at:current,kind,...detail});
  page.on('pageerror',e=>note('pageerror',{message:e.message.slice(0,300)}));
  page.on('console',m=>{if(m.type()==='error')note('console-error',{text:m.text().slice(0,300)});
    else if(m.type()==='warning'&&/WebGL|context/i.test(m.text())&&!/GL Driver Message/.test(m.text()))note('webgl-warning',{text:m.text().slice(0,300)});});
  page.on('requestfailed',r=>note('request-failed',{url:r.url().slice(0,200),error:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)note('http',{url:r.url().slice(0,200),status:r.status()});});
  const screen=()=>page.evaluate(()=>document.getElementById('cm-root')?.dataset.activeScreen??null);
  const ranchReady=()=>page.waitForFunction(()=>{const h=document.querySelector('.int-rh2-field-host');const r=JSON.parse(h?.dataset.residentAssets||'[]');
    return document.getElementById('cm-root')?.dataset.activeScreen==='RAISING_HOME'&&h?.dataset.loadState==='ready'&&r.length&&r.every(x=>x.state==='ready');},null,{timeout:120000});
  const dialogOpen=()=>page.evaluate(()=>[...document.querySelectorAll('[role=dialog],dialog[open],.cm-dialog')].some(e=>e.getClientRects().length&&!e.closest('[hidden]')));
  async function metrics(){
    await page.waitForTimeout(1500);
    await cdp.send('HeapProfiler.collectGarbage');await cdp.send('HeapProfiler.collectGarbage');
    return page.evaluate(async()=>{const d=globalThis.__sweep,r0=d.raf,f0=d.frames;await new Promise(r=>setTimeout(r,1000));
      return {gl:{...d.gl},contexts:d.contexts,canvases:document.querySelectorAll('canvas').length,
        listeners:Object.fromEntries([...d.listeners].filter(([,n])=>n)),listenerTotal:[...d.listeners.values()].reduce((a,b)=>a+b,0),
        intervals:d.intervals.size,timeouts:d.timeouts.size,blobs:d.blobs.size,workers:d.workers,workersTerminated:d.workersTerminated,
        workerUrls:{...d.workerUrls},audio:d.audio,contextLost:d.contextLost,
        // A context whose canvas left the DOM is garbage only once collected; count the ones still attached.
        contextsAttached:d.contextList.map(r=>r.deref()).filter(c=>c?.isConnected).length,
        contextsAlive:d.contextList.map(r=>r.deref()).filter(Boolean).length,storageKeys:{...d.storageKeys},
        rafPerFrame:Math.round((d.raf-r0)/Math.max(1,d.frames-f0)*100)/100,domNodes:document.getElementsByTagName('*').length,
        heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576*10)/10:null,
        storageWrites:d.storageWrites,storageBytes:d.storageBytes,rejections:d.rejections.length};});
  }
  async function openEntry(entry){
    if(entry.menu==='quick')await page.locator(`.cm-toolbar__quick-entry[data-quick-id="${entry.id}"]`).click();
    else{await page.locator(`.cm-toolbar__cell[data-icon="${entry.menu==='system'?'system':'manage'}"]`).click();
      await page.locator(`[data-entry-id="${entry.id}"]:not(.cm-toolbar__quick-entry)`).first().click();}
  }
  async function leaveToRanch(){
    for(let attempt=0;attempt<8;attempt++){
      if(await screen()==='RAISING_HOME'&&!await dialogOpen())return true;
      if(await dialogOpen()){
        // Escape is every choice dialog's cancel. Playwright's actionability check
        // misreads the top-layer <dialog> as covering its own buttons (a hit test at
        // the button centre returns the button), so a DOM click is the fallback.
        await page.keyboard.press('Escape');await page.waitForTimeout(600);
        if(await dialogOpen()){
          const clicked=await page.evaluate(()=>{const open=[...document.querySelectorAll('dialog[open],[role=dialog]')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]'));
            const d=open[open.length-1],b=d&&[...d.querySelectorAll('button')].filter(x=>x.getClientRects().length).find(x=>/^(關閉|知道了|返回|取消|完成|×)$/.test(x.textContent.trim()));
            if(b){b.click();return b.textContent.trim();}return null;});
          note('dom-close',{button:clicked});
        }
      }else{
        const back=page.locator('.cm-vs2-footer .cm-vs2-action, button[aria-label="Return to Raising Home"], [data-action="back"], [data-action="exit"]').filter({visible:true});
        if(await back.count())await back.first().click({timeout:3000}).catch(()=>{});
        else{const text=page.locator('button:visible').filter({hasText:/^(返回|BACK|返回牧場|離開)$/});
          if(await text.count())await text.first().click({timeout:3000}).catch(()=>{});else await page.keyboard.press('Escape');}
      }
      await page.waitForTimeout(800);
    }
    return await screen()==='RAISING_HOME'&&!await dialogOpen();
  }
  const results={schemaVersion:1,label:LABEL,buildId:build.buildId,artifactCommit:build.commit,timezoneId,cycles:CYCLES,
    measurement:'Loopback built artifact, Chromium SwiftShader, Pixel 7 emulation; not an iPhone measurement',baseline:null,cycleMetrics:[],entries:[],events};
  try{
    await page.goto(base+'championship.html');
    await page.locator('#cm-login').waitFor({state:'attached'});
    if(await page.locator('#cm-film-skip').isVisible().catch(()=>false))await page.locator('#cm-film-skip').click().catch(()=>{});
    await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
    await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
    current='ranch';await ranchReady();results.baseline=await metrics();
    console.log(JSON.stringify({baseline:results.baseline}));
    for(let cycle=1;cycle<=CYCLES;cycle++){
      for(const entry of ENTRIES){
        current=`${entry.menu}:${entry.id}`;const before=events.length,t0=Date.now();
        let opened=null,returned=false,error=null;
        try{
          await openEntry(entry);
          await page.waitForFunction(()=>document.getElementById('cm-root')?.dataset.activeScreen!=='RAISING_HOME'
            ||[...document.querySelectorAll('[role=dialog],dialog[open],.cm-dialog')].some(e=>e.getClientRects().length),null,{timeout:15000}).catch(()=>{});
          opened=await screen();await page.waitForTimeout(2500);
          await page.screenshot({path:path.join(OUT,`c${cycle}-${entry.id}.png`)}).catch(()=>{});
          returned=await leaveToRanch();
          if(returned){current='ranch';await ranchReady();}
        }catch(e){error=String(e.message).split('\n')[0].slice(0,200);}
        const row={cycle,entry:`${entry.menu}:${entry.id}`,opened,dialog:opened==='RAISING_HOME',returned,ms:Date.now()-t0,error,
          events:events.slice(before).map(e=>e.kind)};
        results.entries.push(row);console.log(JSON.stringify(row));
        if(!returned){
          // Recover the run without losing the evidence: reload into the ranch. A
          // reload resets page state, so this cycle's resource numbers are tainted.
          note('recover',{entry:row.entry});current='recover';taintedCycles.add(cycle);
          await page.goto(base+'championship.html');await page.locator('#cm-login').waitFor({state:'attached'});
          if(await page.locator('#cm-film-skip').isVisible().catch(()=>false))await page.locator('#cm-film-skip').click().catch(()=>{});
          await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
          await page.locator('#cm-login').click();await page.locator('#cm-continue').click();current='ranch';await ranchReady();
        }
      }
      const m=await metrics();results.cycleMetrics.push({cycle,tainted:taintedCycles.has(cycle),...m});console.log(JSON.stringify({cycle,...m}));
    }
    results.status=events.some(e=>e.kind==='pageerror')?'PAGE_ERRORS':'COMPLETE';
  }catch(error){results.status='FAILED';results.failure=String(error?.stack??error);await page.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});process.exitCode=1;}
  finally{
    fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(results,null,1));
    fs.writeFileSync(path.join(OUT,'server-requests.json'),JSON.stringify(pages.log));
    await context.close().catch(()=>{});await browser.close();await pages.close();
    console.log(`summary: ${path.relative(process.cwd(),path.join(OUT,'summary.json'))} status=${results.status}`);
  }
})();
