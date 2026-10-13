// Fresh profiles, formal artifact at mocked approved URL; no player profile/server.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');
const root=path.resolve('dist/github-playtest'),base='https://orochi771127.github.io/championship-2026/';
const out=path.resolve('.tmp/opening-title-buffer-20261013/browser');fs.mkdirSync(out,{recursive:true});
const key='championshipModernSave:v1',seed=fs.readFileSync('qa/championship-full-qa-save.json','utf8');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const reports=[];let browser;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function scenario(name,options,run){
 const context=await browser.newContext(options.device==='iphone'?{...devices['iPhone 13'],reducedMotion:'no-preference'}:{viewport:{width:1366,height:768},reducedMotion:'no-preference'});
 const page=await context.newPage(),requests=[],errors=[],gates=[],revoked=[],created=[];
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({controlled,key,seed,reduced})=>{
  window.__qaReady=false;addEventListener('championship:ready',()=>window.__qaReady=true);
  if(seed)localStorage.setItem(key,seed);
  localStorage.setItem(key.replace(':v1',':preferences:v1'),JSON.stringify({reducedMotion:reduced?'on':'off'}));
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  window.__created=[];window.__revoked=[];
  URL.createObjectURL=b=>{const u=create(b);window.__created.push(u);return u;};
  URL.revokeObjectURL=u=>{window.__revoked.push(u);revoke(u);};
  if(controlled){
   window.__media={paused:true,readyState:2,currentTime:0,duration:58,end:0};
   for(const k of ['paused','readyState','currentTime','duration'])Object.defineProperty(HTMLVideoElement.prototype,k,{configurable:true,get(){return __media[k];},set(v){__media[k]=v;}});
   Object.defineProperty(HTMLVideoElement.prototype,'buffered',{configurable:true,get(){return {length:1,start:()=>0,end:()=>__media.end};}});
   HTMLVideoElement.prototype.play=function(){__media.paused=false;return Promise.resolve();};
   HTMLVideoElement.prototype.pause=function(){__media.paused=true;this.dispatchEvent(new Event('pause'));};
  }
 },{controlled:options.controlled,key,seed:options.seed?seed:null,reduced:options.reduced});
 const titleRequests=()=>requests.filter(r=>r.path.includes('title-morning-r1/')&&r.path.endsWith('.webp'));
 const mediaPaths=()=>[...new Set(requests.filter(r=>/opening-\d+p-.*\.mp4$/.test(r.path)).map(r=>r.path))];
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
 cdp.on('Network.loadingFailed',e=>requests.find(r=>r.id===e.requestId)&&(requests.find(r=>r.id===e.requestId).canceled=Boolean(e.canceled)));
 cdp.on('Network.requestWillBeSent',e=>{if(e.request.url.startsWith(base))requests.push({id:e.requestId,path:new URL(e.request.url).pathname.slice(new URL(base).pathname.length),at:e.timestamp});});
 await context.route('**/*',async route=>{
  const url=route.request().url();if(!url.startsWith(base))return route.abort();
  const relative=decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length)),file=path.resolve(root,relative||'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'missing QA input'});
  if(options.controlled&&/opening-\d+p-.*\.mp4$/.test(relative)){await new Promise(r=>gates.push(r));return route.abort().catch(()=>{});}
  if(relative.includes('title-morning-r1/')&&relative.endsWith('.webp')){
   if(options.gateTitle?.(relative,titleRequests()))await new Promise(r=>gates.push(r));
   if(options.failTitle?.(relative,titleRequests()))return route.fulfill({status:503,body:'controlled failure'});
  }
  if(/main-.*\.js$/.test(relative)){
   let body=fs.readFileSync(file,'utf8');
   for(const [old,replacement] of [['openingFilm=createOpeningFilm(','openingFilm=globalThis.__qaFilm=createOpeningFilm('],['syncTitleImages=createTitleImageLifecycle(','syncTitleImages=globalThis.__qaTitle=createTitleImageLifecycle(']]){assert.ok(body.includes(old));body=body.replace(old,replacement);}
   return route.fulfill({body,contentType:'text/javascript'});
  }
  if(relative.endsWith('.mp4')){
   const size=fs.statSync(file).size,range=/^bytes=(\d+)-(\d*)/.exec(route.request().headers().range||''),start=range?Number(range[1]):0,end=range?Math.min(Number(range[2]||size-1),size-1):size-1;
   const fd=fs.openSync(file,'r'),body=Buffer.alloc(end-start+1);fs.readSync(fd,body,0,body.length,start);fs.closeSync(fd);
   return route.fulfill({status:range?206:200,body,headers:{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':String(body.length),...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})}});
  }
  return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'}).catch(()=>{});
 });
 const media=async(change,event='progress')=>page.evaluate(({change,event})=>{Object.assign(__media,change);document.querySelector('#cm-opening-film video').dispatchEvent(new Event(event));},{change,event});
 const readyTitle=()=>page.waitForFunction(()=>__qaTitle.inspect().state==='ready'&&[...document.querySelectorAll('#cm-title > .cm-title__panel img')].every(i=>i.complete&&i.naturalWidth>0));
 const skip=async()=>{await page.click('#cm-film-skip');await page.waitForTimeout(400);};
 try{
  await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>__qaReady);
  await run({page,context,requests,titleRequests,mediaPaths,media,readyTitle,skip,gates});
  assert.deepEqual(errors,[]);if(!options.continue)assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),options.seed?seed:null,'TITLE flow must preserve save bytes');
  const urls=await page.evaluate(()=>({created:__created,revoked:__revoked}));created.push(...urls.created);revoked.push(...urls.revoked);
  reports.push({name,passed:true,controlledMedia:Boolean(options.controlled),device:options.device||'desktop',titleRequests:titleRequests().map(({path,at,canceled})=>({path,at,canceled})),mediaPaths:mediaPaths(),created:created.length,revoked:revoked.length});console.log('PASS '+name);
 }catch(e){reports.push({name,passed:false,error:String(e)});await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
 finally{for(const release of gates)release();await context.close();}
}
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true});
 await scenario('native desktop 1080p, serial warmup, resize and replay retain source/cache',{},async({page,titleRequests,mediaPaths,readyTitle,skip})=>{
  await page.waitForFunction(()=>document.querySelector('#cm-opening-film video').videoWidth===1080&&__qaFilm.canPreloadTitle());
  await readyTitle();assert.equal(titleRequests().length,4);assert.equal(new Set(titleRequests().map(r=>r.path)).size,4);
  await page.setViewportSize({width:390,height:844});assert.equal(mediaPaths().length,1);assert.ok(mediaPaths()[0].includes('1080p'));
  await skip();await page.click('#cm-watch-film');await page.waitForFunction(()=>__qaFilm.isPlaying());await skip();
  assert.equal(titleRequests().length,4);assert.equal(mediaPaths().length,1);await page.screenshot({path:path.join(out,'title-ready.png')});
 });
 await scenario('iPhone browser emulation picks 720p; native playback ends with ready TITLE',{device:'iphone'},async({page,titleRequests,mediaPaths,readyTitle})=>{
  await page.waitForFunction(()=>document.querySelector('#cm-opening-film video').videoWidth===720);await readyTitle();
  await page.setViewportSize({width:1366,height:768});assert.equal(mediaPaths().length,1);assert.ok(mediaPaths()[0].includes('720p'));
  // Native ended event at higher playback rate; unchanged file/timeline.
  await page.locator('video').evaluate(v=>v.playbackRate=4);
  await page.waitForFunction(()=>document.querySelector('#cm-opening-film').dataset.result==='ended',null,{timeout:25000});
  assert.equal(titleRequests().length,4);assert.equal(mediaPaths().length,1);assert.ok(mediaPaths()[0].includes('720p'));assert.equal(await page.locator('#cm-login').isVisible(),true);
 });
 await scenario('immediate skip requests no TITLE pixels before buffer; LOGIN remains usable',{controlled:true},async({page,titleRequests,skip,mediaPaths})=>{
  assert.equal(titleRequests().length,0);await skip();await page.click('#cm-login');assert.equal(await page.locator('#cm-new-game').isVisible(),true);assert.equal(mediaPaths().length,1);
 });
 await scenario('low buffer/stall stops new warm requests; skip joins the pending background',{controlled:true,gateTitle:p=>p.endsWith('/arena.webp')},async({page,titleRequests,media,skip,gates,readyTitle})=>{
  await media({readyState:4,end:5.9},'playing');await delay(100);assert.equal(titleRequests().length,0);
  await media({end:6});await page.waitForFunction(()=>__qaTitle.inspect().state==='loading');await delay(100);assert.equal(titleRequests().length,1);
  await media({end:58},'waiting');gates.at(-1)();await delay(150);assert.equal(titleRequests().length,1,'waiting must not queue partners');
  await skip();await readyTitle();assert.equal(titleRequests().length,4);assert.equal(new Set(titleRequests().map(r=>r.path)).size,4);
 });
 await scenario('warm image error retains background/progress and retries only failed image',{controlled:true,failTitle:(p,rs)=>p.endsWith('/blaze.webp')&&rs.filter(r=>r.path===p).length===1},async({page,titleRequests,media,skip,readyTitle})=>{
  await media({readyState:4,end:58},'playing');await page.waitForFunction(()=>__qaTitle.inspect().state==='error');await skip();
  assert.equal(await page.locator('#cm-login').isEnabled(),true);await page.click('#cm-title-background-retry');await readyTitle();
  assert.equal(titleRequests().filter(r=>r.path.endsWith('/arena.webp')).length,1);assert.equal(titleRequests().filter(r=>r.path.endsWith('/blaze.webp')).length,2);
 });
 await scenario('background and leaving TITLE abort pending warm work and release owned URLs',{controlled:true,gateTitle:p=>p.endsWith('/blaze.webp')},async({page,titleRequests,media,gates,skip})=>{
  await media({readyState:4,end:58},'playing');await page.waitForFunction(()=>__qaTitle.inspect().state==='loading'&&__created.length>=2);await delay(100);
  const beforeHidden=titleRequests().length;
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>__qaFilm.isPlaying()),false);
  await delay(100);assert.equal(titleRequests().length,beforeHidden,'hidden page must not start another TITLE request');
  await page.evaluate(()=>{document.querySelector('#cm-title').hidden=true;__qaTitle(true);});
  for(const release of gates)release();await delay(100);
  const urls=await page.evaluate(()=>{__qaTitle.dispose();return {created:__created,revoked:__revoked};});assert.deepEqual(new Set(urls.revoked),new Set(urls.created));
 });
 await scenario('reduced motion loads no video until manual watch',{device:'iphone',reduced:true},async({page,mediaPaths,skip})=>{
  assert.equal(mediaPaths().length,0);await page.click('#cm-watch-film');await page.waitForFunction(()=>document.querySelector('#cm-opening-film video').videoWidth===720);await skip();assert.equal(mediaPaths().length,1);
 });
 await scenario('seeded QA Continue enters existing Raising after immediate skip',{controlled:true,seed:true,continue:true},async({page,skip})=>{
  await skip();await page.click('#cm-login');assert.equal(await page.locator('#cm-continue').isEnabled(),true);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),seed);
  await page.click('#cm-continue');await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:60000});
  assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('#cm-opening-film video').getAttribute('src'),null);assert.equal(await page.evaluate(()=>__qaFilm.isPlaying()),false);
 });
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({formalArtifact:true,mockedApprovedOrigin:base,physicalDeviceAccepted:false,normalNativePlayback:reports.filter(r=>!r.controlledMedia&&r.passed).length,reports},null,2)+'\n');await browser?.close();
});
