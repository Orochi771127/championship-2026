// Isolated, disposable browser contexts; never connects to the player's 8732.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve('dist/github-playtest');
// Loopback-only legacy art paths are intentionally absent from public output.
// An explicit local reference root can satisfy those older gates without
// copying references into the artifact or broadening the publication list.
const referenceRoot=process.env.NS33_REFERENCE_ROOT?path.resolve(process.env.NS33_REFERENCE_ROOT):null;
const baselineRoot=process.env.NS33_BASELINE_ROOT?path.resolve(process.env.NS33_BASELINE_ROOT):null;
const referenceReads=new Set();
const output=path.resolve('.tmp/browser-qa/ns33-opening');
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
async function boot(page){await page.goto(origin+'/championship-2026/championship.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!document.querySelector('#cm-opening-film'));}
const state=page=>page.locator('#cm-opening-film').evaluate(n=>({hidden:n.hidden,result:n.dataset.result,state:n.dataset.state}));
async function playing(page){await page.waitForFunction(()=>document.querySelector('#cm-opening-film')?.dataset.state==='playing');}
async function skip(page){await page.click('#cm-film-skip');await page.waitForTimeout(400);assert.equal((await state(page)).hidden,true);}
async function prefs(context,value){await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:prefsKey,value});}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;report.origin=origin;
  console.log('ISOLATED_ORIGIN '+origin);fs.writeFileSync(path.join(output,'origin.txt'),origin);
  browser=await chromium.launch({channel:'chrome',headless:true});
  await scenario('real playback, audio consent, native finish and unchanged save',async(page)=>{
    await boot(page);await playing(page);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveKey),null);
    const media=await page.locator('#cm-opening-film video').evaluate(v=>({muted:v.muted,inline:v.playsInline,w:v.videoWidth,h:v.videoHeight,d:v.duration,src:v.currentSrc}));
    assert.equal(media.muted,true);assert.equal(media.inline,true);assert.equal(media.w,720);assert.equal(media.h,1280);assert.ok(Math.abs(media.d-48.5)<.1);assert.ok(media.src.includes('/championship-2026/assets/production/'));
    await page.click('#cm-film-sound');assert.equal(await page.locator('video').evaluate(v=>v.muted),false);
    await page.click('#cm-film-sound');assert.equal(await page.locator('video').evaluate(v=>v.muted),true);
    await page.screenshot({path:path.join(output,'playing-zh.png')});
    await page.waitForFunction(()=>document.querySelector('#cm-opening-film .cm-title__logo')?.hidden===false,null,{timeout:52000});
    await page.screenshot({path:path.join(output,'closing-brand-zh.png')});
    await page.waitForFunction(()=>document.querySelector('#cm-opening-film')?.dataset.result==='ended');
    assert.equal(await page.locator('#cm-login').isVisible(),true);assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveKey),null);
  });
  await scenario('skip gesture guard, repeated manual watch, idle 14.9s input, menu block',async(page)=>{
    await boot(page);await playing(page);
    await page.click('#cm-film-skip');
    await page.locator('#cm-login').evaluate(n=>n.click());
    assert.equal(await page.locator('.cm-title__actions').isHidden(),true);
    await page.waitForTimeout(400);await page.click('#cm-watch-film');await playing(page);await skip(page);
    await page.clock.install();await page.clock.runFor(14900);assert.equal((await state(page)).hidden,true);
    await page.keyboard.press('Shift');await page.clock.runFor(14900);assert.equal((await state(page)).hidden,true);
    await page.clock.runFor(101);assert.equal((await state(page)).hidden,false);
    await page.click('#cm-film-skip');await page.clock.runFor(400);await page.click('#cm-login');
    await page.clock.runFor(30000);assert.equal((await state(page)).hidden,true);assert.equal(await page.locator('#cm-new-game').isVisible(),true);
    await page.click('#cm-new-game');await page.clock.runFor(30000);assert.equal((await state(page)).hidden,true);
  });
  await scenario('dialog idle block and controlled background/foreground reset',async(page)=>{
    await boot(page);await playing(page);await skip(page);await page.click('#cm-title-settings');
    await page.clock.install();await page.clock.runFor(20000);assert.equal((await state(page)).hidden,true);
    await page.keyboard.press('Escape');await page.clock.runFor(14900);assert.equal((await state(page)).hidden,true);
    await page.clock.runFor(101);assert.equal((await state(page)).hidden,false);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal((await state(page)).hidden,true);await page.clock.runFor(30000);assert.equal((await state(page)).hidden,true);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    await page.clock.runFor(14900);assert.equal((await state(page)).hidden,true);await page.clock.runFor(101);assert.equal((await state(page)).hidden,false);
  });
  for(const failure of ['reject','404','network','slow'])await scenario(failure+' returns TITLE without retry loop or save write',async(page,context)=>{
    if(failure==='reject')await context.addInitScript(()=>{const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return this.tagName==='VIDEO'?Promise.reject(new DOMException('blocked','NotAllowedError')):original.call(this);};});
    else await page.route('**/opening-720p-74e171ba.mp4',async route=>{if(failure==='404')await route.fulfill({status:404,body:''});else if(failure==='network')await route.abort();else await new Promise(resolve=>setTimeout(resolve,9000)).then(()=>route.abort()).catch(()=>{});});
    await boot(page);await page.waitForFunction(()=>['rejected','error','timeout'].includes(document.querySelector('#cm-opening-film')?.dataset.result));
    assert.equal(await page.locator('#cm-login').isVisible(),true);
    if(failure==='slow')assert.equal((await state(page)).result,'timeout');
    await page.clock.install();await page.clock.runFor(20000);assert.equal((await state(page)).hidden,true);assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveKey),null);
  });
  await scenario('film pauses unfinished TITLE art and resumes it on return',async(page)=>{
    const attempts=[];
    await page.route('**/title-morning-r1/*.webp',async route=>{
      attempts.push(route.request().url());
      await new Promise(resolve=>setTimeout(resolve,1500));
      await route.continue().catch(()=>{});
    });
    await boot(page);await playing(page);
    assert.equal(await page.locator('.cm-title__panel').getAttribute('data-title-background-state'),'paused');
    const titleImages=page.locator('#cm-title > .cm-title__panel img');
    assert.ok(await titleImages.count()>0);
    assert.equal(await titleImages.evaluateAll(images=>images.every(image=>!image.hasAttribute('src'))),true);
    await skip(page);
    assert.equal(await titleImages.evaluateAll(images=>images.every(image=>!!image.getAttribute('src'))),true);
    await page.waitForFunction(()=>document.querySelector('.cm-title__panel')?.dataset.titleBackgroundState==='ready');
    assert.ok(attempts.some(url=>url.endsWith('/arena.webp')));
  });
  await scenario('cold startup allows 4.2s delivery; playback stalls still return within 3s',async(page)=>{
    await page.route('**/opening-720p-74e171ba.mp4',async route=>{await new Promise(resolve=>setTimeout(resolve,4200));await route.continue();});
    await boot(page);assert.equal(await page.locator('#cm-film-skip').isVisible(),true);await playing(page);
    await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
    await page.locator('video').evaluate(v=>{v.pause();v.dispatchEvent(new Event('waiting'));});
    await page.clock.runFor(2999);assert.equal((await state(page)).hidden,false);
    await page.clock.runFor(2);assert.equal((await state(page)).result,'timeout');assert.equal(await page.locator('#cm-login').isVisible(),true);
  });
  for(const reduced of ['system','on'])await scenario('reduced motion '+reduced+' loads no video until manual watch',async(page,context)=>{
    await prefs(context,{reducedMotion:reduced});let requests=0;page.on('request',r=>{if(r.url().includes('opening-720p'))requests++;});
    await boot(page);await page.clock.install();await page.clock.runFor(30000);assert.equal(requests,0);assert.equal((await state(page)).hidden,true);
    await page.click('#cm-watch-film');await playing(page);assert.equal((await state(page)).hidden,false);await page.click('#cm-film-skip');
  },{reducedMotion:reduced==='system'?'reduce':'no-preference'});
  for(const locale of ['zh-Hant','en','ja','th','vi'])await scenario('locale '+locale+' portrait layout, brand and global volume',async(page,context)=>{
    await prefs(context,{locale,masterVolume:50,musicVolume:40,muted:locale==='vi'});await boot(page);await playing(page);
    assert.equal(await page.locator('html').getAttribute('lang'),locale);
    assert.equal(await page.locator('video').evaluate(v=>v.volume),.2);
    if(locale==='vi')assert.equal(await page.locator('#cm-film-sound').isDisabled(),true);
    for(const id of ['#cm-film-skip','#cm-film-sound']){
      const b=await page.locator(id).boundingBox();assert.ok(b.height>=44&&b.x>=0&&b.x+b.width<=391);
      assert.equal(await page.locator(id).evaluate(n=>n.scrollWidth>n.clientWidth),false);
    }
    await page.locator('video').evaluate(v=>{v.currentTime=46.3;});
    await page.waitForFunction(()=>!document.querySelector('#cm-opening-film .cm-title__logo').hidden);
    const label=await page.locator('#cm-opening-film .cm-title__name').getAttribute('aria-label');assert.ok(label&&!label.includes('CHAMPIONSHIP2026'));
    await page.waitForTimeout(900);
    if(locale!=='zh-Hant'){
      const h=await page.locator('#cm-opening-film .cm-title__name').boundingBox();
      assert.ok(h.x>=0&&h.x+h.width<=390,'brand fits portrait viewport');
    }
    await page.screenshot({path:path.join(output,'brand-'+locale+'.png')});await skip(page);
    await page.setViewportSize({width:844,height:390});await page.click('#cm-watch-film');await playing(page);await page.screenshot({path:path.join(output,'landscape-'+locale+'.png')});await skip(page);
  });
  await scenario('QA save bytes unchanged on TITLE, Continue keeps film off in Raising',async(page)=>{
    await page.goto(origin+'/full-qa-save.html');await page.locator('#install').waitFor();await page.waitForFunction(()=>!document.querySelector('#install').disabled);
    await Promise.all([page.waitForURL(/championship\.html$/),page.click('#install')]);await playing(page);
    const before=await page.evaluate(key=>localStorage.getItem(key),saveKey);assert.ok(before);await skip(page);await page.click('#cm-watch-film');await playing(page);await skip(page);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveKey),before);
    await page.click('#cm-login');await page.click('#cm-continue');await page.locator('.cm-raising-pixi-canvas').waitFor({timeout:60000});
    await page.clock.install();await page.clock.runFor(20000);assert.equal((await state(page)).hidden,true);assert.equal(await page.locator('video').getAttribute('src'),null);assert.equal(await page.locator('canvas').count(),1);
  });
  if(process.env.NS33_LEGACY_GATES==='1')for(const file of (process.env.NS33_LEGACY_FILES||'championship-int-rh2-browser.cjs,championship-recent-integration-browser.cjs,championship-ui-integration-browser.cjs').split(',')){
    const {spawn}=require('node:child_process');
    const log=fs.openSync(path.join(output,file+'.log'),'w');
    const child=spawn(process.execPath,[path.join(process.env.NS33_BASELINE_TESTS||'tests',file)],{env:{...process.env,CHAMPIONSHIP_QA_ORIGIN:origin,CHAMPIONSHIP_QA_URL:origin+'/championship.html'},stdio:['ignore',log,log],windowsHide:true});
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});fs.closeSync(log);
    report.checks.push({name:file,passed:code===0});console.log((code===0?'PASS ':'FAIL ')+file);
  }
  assert.ok(report.checks.every(check=>check.passed),'all requested browser gates pass');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{report.partial=Boolean(process.env.NS33_CASE);report.localReferences={root:referenceRoot,files:[...referenceReads].sort(),published:false};report.passed=report.checks.length>0&&report.checks.every(c=>c.passed);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();server.close();});
