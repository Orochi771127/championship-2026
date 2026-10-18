// Isolated, disposable browser contexts; never connects to the player's 8732.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(process.env.NS33_ROOT||'dist/github-playtest');
// Loopback-only legacy art paths are intentionally absent from public output.
// An explicit local reference root can satisfy those older gates without
// copying references into the artifact or broadening the publication list.
const referenceRoot=process.env.NS33_REFERENCE_ROOT?path.resolve(process.env.NS33_REFERENCE_ROOT):null;
const baselineRoot=process.env.NS33_BASELINE_ROOT?path.resolve(process.env.NS33_BASELINE_ROOT):null;
const referenceReads=new Set();
const output=path.resolve(process.env.NS33_OUTPUT||'.tmp/browser-qa/ns33-opening');
fs.mkdirSync(output,{recursive:true});
const saveKey='championshipModernSave:v1',prefsKey='championshipModernSave:preferences:v1';
const report={generatedAt:new Date().toISOString(),checks:[],physicalDeviceAccepted:false,fullSubjectiveListeningAccepted:false};
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.mp4':'video/mp4','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/championship-2026\//,'/');
  let serveRoot=root,file=path.resolve(root,'.'+relative);
  if(baselineRoot){const candidate=path.resolve(baselineRoot,'.'+relative);if(candidate.startsWith(baselineRoot+path.sep)&&fs.existsSync(candidate)){serveRoot=baselineRoot;file=candidate;}}
  if(!fs.existsSync(file)&&referenceRoot&&/^\/assets\/production\/(?:internal-character-review\/|hunt\/(?:licensed-runtime-v1\/|final-intake-20261008\/|original-opus-v1\/))/.test(relative)){
    serveRoot=referenceRoot;file=path.resolve(referenceRoot,'.'+relative);
    if(file.startsWith(referenceRoot+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())referenceReads.add(relative.slice(1));
  }
  if(!file.startsWith(serveRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const size=fs.statSync(file).size,range=/^bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
  const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'public, max-age=3600'};
  let start=0,end=size-1;
  if(range){start=Number(range[1]);end=Math.min(Number(range[2]||end),end);headers['Content-Range']=`bytes ${start}-${end}/${size}`;}
  headers['Content-Length']=end-start+1;res.writeHead(range?206:200,headers);
  const stream=fs.createReadStream(file,{start,end});stream.pipe(res);res.on('close',()=>stream.destroy());
});
let browser,origin;
async function scenario(name,fn,options={}){
  if(process.env.NS33_CASE&&!new RegExp(process.env.NS33_CASE).test(name))return;
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,...options});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  try{await fn(page,context);assert.deepEqual(errors,[]);report.checks.push({name,passed:true});console.log('PASS '+name);}
  catch(error){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});report.checks.push({name,passed:false,error:String(error)});throw error;}
  finally{await context.close();}
}
async function boot(page){await page.goto(origin+'/championship-2026/championship.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!document.querySelector('#cm-opening-film')&&!document.querySelector('#cm-login').disabled);}
const state=page=>page.locator('#cm-opening-film').evaluate(n=>({hidden:n.hidden,result:n.dataset.result,state:n.dataset.state}));
async function playing(page){await page.waitForFunction(()=>document.querySelector('#cm-opening-film')?.dataset.state==='playing');}
async function skip(page){await page.click('#cm-film-skip');await page.waitForTimeout(400);assert.equal((await state(page)).hidden,true);}
async function prefs(context,value){await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:prefsKey,value});}

const webPattern='**/opening-web-540p-9577fea3.mp4';
async function watch(page){await page.click('#cm-watch-film');await playing(page);}
async function released(page){
 assert.equal((await state(page)).hidden,true);
 assert.equal(await page.locator('#cm-opening-film video').getAttribute('src'),null);
 assert.equal(await page.locator('#cm-opening-film video').evaluate(v=>v.paused),true);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;report.origin=origin;
  browser=await chromium.launch({channel:'chrome',headless:true});
  await scenario('cold entry and idle never download MP4; menus stay usable',async page=>{
    const mp4=[];page.on('request',r=>{if(r.url().endsWith('.mp4'))mp4.push(r.url());});
    await boot(page);await released(page);await page.clock.install();await page.clock.runFor(60000);
    assert.deepEqual(mp4,[]);assert.equal(await page.locator('#cm-login').isVisible(),true);
    await page.click('#cm-login');assert.equal(await page.locator('#cm-new-game').isVisible(),true);assert.deepEqual(mp4,[]);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),saveKey),null);
  });
  await scenario('native 58s playback, explicit audio consent, BGM exclusion, natural finish',async(page,context)=>{
    await context.addInitScript(()=>{window.__filmMedia=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!__filmMedia.includes(this))__filmMedia.push(this);return play.call(this);};});
    await boot(page);await watch(page);
    const media=await page.locator('#cm-opening-film video').evaluate(v=>({muted:v.muted,inline:v.playsInline,w:v.videoWidth,h:v.videoHeight,d:v.duration,src:v.currentSrc}));
    assert.deepEqual([media.muted,media.inline,media.w,media.h],[true,true,540,960]);assert.ok(Math.abs(media.d-58)<.1);assert.ok(media.src.includes('opening-web-540p-9577fea3.mp4'));
    await page.click('#cm-film-sound');assert.equal(await page.locator('video').evaluate(v=>v.muted),false);
    assert.equal(await page.evaluate(()=>__filmMedia.filter(v=>v.tagName==='AUDIO'&&!v.paused).length),0,'BGM media must be paused while intro sound is enabled');
    await page.click('#cm-film-sound');assert.equal(await page.locator('video').evaluate(v=>v.muted),true);
    await page.screenshot({path:path.join(output,'playing.png')});
    await page.waitForFunction(()=>!document.querySelector('#cm-opening-film .cm-title__logo').hidden,null,{timeout:65000});
    await page.screenshot({path:path.join(output,'closing-brand.png')});
    await page.waitForFunction(()=>document.querySelector('#cm-opening-film').dataset.result==='ended',null,{timeout:10000});
    await released(page);assert.equal(await page.locator('#cm-login').isVisible(),true);assert.equal(await page.evaluate(k=>localStorage.getItem(k),saveKey),null);
  });
  await scenario('skip guard, repeated watch, resize and fast skip retain one web source',async page=>{
    const mp4=[];page.on('request',r=>{if(r.url().endsWith('.mp4'))mp4.push(r.url());});
    await boot(page);await watch(page);await page.click('#cm-film-skip');await released(page);
    await page.locator('#cm-login').evaluate(n=>n.click());assert.equal(await page.locator('.cm-title__actions').isHidden(),true);
    await page.waitForTimeout(400);await page.setViewportSize({width:844,height:390});
    for(let i=0;i<3;i++){await watch(page);assert.equal(await page.locator('video').evaluate(v=>v.muted),true);await skip(page);await released(page);}
    assert.deepEqual([...new Set(mp4.map(u=>new URL(u).pathname.split('/').pop()))],['opening-web-540p-9577fea3.mp4']);
  });
  await scenario('controlled background, foreground, pagehide and return never resume video',async page=>{
    await boot(page);await watch(page);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await released(page);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    await page.clock.install();await page.clock.runFor(30000);await released(page);await page.clock.resume();
    await watch(page);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await released(page);
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await released(page);
  });
  await scenario('controlled rapid TITLE leave and return releases media; replay remains available',async page=>{
    await boot(page);await watch(page);
    await page.locator('#cm-title').evaluate(n=>n.hidden=true);await released(page);
    await page.locator('#cm-title').evaluate(n=>n.hidden=false);await page.locator('#cm-watch-film').waitFor();await watch(page);await skip(page);await released(page);
  });
  for(const failure of ['reject','404','network','slow'])await scenario(failure+' restores usable TITLE with no automatic retry; manual retry works',async(page,context)=>{
    if(failure==='reject')await context.addInitScript(()=>{const original=HTMLMediaElement.prototype.play;window.__rejectFilm=true;HTMLMediaElement.prototype.play=function(){return this.tagName==='VIDEO'&&__rejectFilm?Promise.reject(new DOMException('blocked','NotAllowedError')):original.call(this);};});
    else await page.route(webPattern,async route=>{if(failure==='404')await route.fulfill({status:404,body:''});else if(failure==='network')await route.abort();else await new Promise(resolve=>setTimeout(resolve,9000)).then(()=>route.abort()).catch(()=>{});});
    await boot(page);await page.click('#cm-watch-film');
    await page.waitForFunction(()=>['rejected','error','timeout'].includes(document.querySelector('#cm-opening-film').dataset.result),null,{timeout:14000});
    await released(page);assert.equal(await page.locator('#cm-login').isVisible(),true);
    if(failure==='slow')assert.equal((await state(page)).result,'timeout');
    await page.clock.install();await page.clock.runFor(20000);await released(page);await page.clock.resume();
    await page.unroute(webPattern);if(failure==='reject')await page.evaluate(()=>window.__rejectFilm=false);
    await watch(page);await skip(page);assert.equal(await page.evaluate(k=>localStorage.getItem(k),saveKey),null);
  });
  for(const locale of ['zh-Hant','en','ja','th','vi'])await scenario(locale+' volume, global mute, reduced motion and touch controls',async(page,context)=>{
    await prefs(context,{locale,masterVolume:50,musicVolume:40,muted:locale==='vi',reducedMotion:'on'});
    await boot(page);await released(page);await watch(page);
    assert.equal(await page.locator('html').getAttribute('lang'),locale);assert.equal(await page.locator('video').evaluate(v=>v.volume),.2);
    if(locale==='vi')assert.equal(await page.locator('#cm-film-sound').isDisabled(),true);
    for(const id of ['#cm-film-skip','#cm-film-sound']){const b=await page.locator(id).boundingBox();assert.ok(b.height>=44&&b.x>=0&&b.x+b.width<=391);assert.equal(await page.locator(id).evaluate(n=>n.scrollWidth>n.clientWidth),false);}
    await page.keyboard.press('Escape');await released(page);
  },{reducedMotion:'reduce'});
  await scenario('normal Continue flow and TITLE return preserve save and one Pixi application',async(page,context)=>{
    const seed=fs.readFileSync(path.resolve('qa/championship-full-qa-save.json'),'utf8');await context.addInitScript(({key,seed})=>localStorage.setItem(key,seed),{key:saveKey,seed});
    await boot(page);const before=await page.evaluate(k=>localStorage.getItem(k),saveKey);await watch(page);await skip(page);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),saveKey),before);
    await page.click('#cm-login');await page.click('#cm-continue');
    await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready',null,{timeout:180000});
    await released(page);assert.equal(await page.locator('canvas').count(),1);
    await page.locator('.cm-toolbar button[data-menu-id="SYSTEM"]:visible').click();
    await page.locator('.cm-toolbar__menu[data-menu-id="SYSTEM"]:not([hidden]) button[data-entry-id="saveQuit"]').click();
    await page.locator('#cm-login:visible').waitFor();await released(page);
    await watch(page);await skip(page);await released(page);
  });
  assert.ok(report.checks.every(c=>c.passed));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{report.partial=Boolean(process.env.NS33_CASE);report.passed=report.checks.length>0&&report.checks.every(c=>c.passed);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();server.close();});
