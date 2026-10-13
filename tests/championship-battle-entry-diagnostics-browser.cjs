// One isolated seeded tutorial Battle entry via normal Continue. Every request
// is served from reviewed local bytes, never the live site or a personal profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'pages-build.json')));
const output=require('./browser-qa-output.cjs')('battle-entry-diagnostics');fs.mkdirSync(output,{recursive:true});
const key='championshipModernSave:v1',base='https://orochi771127.github.io/championship-2026/';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.mp3':'audio/mpeg'};
(async()=>{
 const {createChampionshipStandaloneApp}=await import('../src/championship/app/championshipStandaloneApp.js');
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog:JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json')),cages:JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json')).cages,rngClock:()=>({hour:1,minute:2,second:3})});
 await app.newGame({trainerName:'QA',eggName:'Egg'});app.save();const seed=JSON.parse(storage.getItem(key));await app.dispose();
 seed.progression.nativeOpening={version:2,trainerName:'QA',tutorialStep:null,checkpoint:{version:1,stage:'battle-running',message:0}};
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(45000);
 const missing=[],errors=[],documents=[];let result;
 page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',f=>{if(f===page.mainFrame())documents.push(f.url());});
 await context.route('**/*',async route=>{
  if(!route.request().url().startsWith(base)){missing.push('external request');await route.abort();return;}
  const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice(new URL(base).pathname.length)),file=path.resolve(root,relative||'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){missing.push(relative);await route.fulfill({status:404,body:'missing QA input'});return;}
  await route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
 });
 await page.addInitScript(({seed,key})=>{
  localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({muted:true,reducedMotion:'on'}));
  const contexts=new Set(),original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(...args){const gl=original.apply(this,args);if(gl&&/^(webgl2?|experimental-webgl)$/.test(args[0]))contexts.add(gl);return gl;};
  window.__qaContextCount=()=>contexts.size;
  window.__qaContexts=()=>[...contexts].map(gl=>({canvas:gl.canvas.className,connected:gl.canvas.isConnected,width:gl.canvas.width,height:gl.canvas.height,lost:gl.isContextLost()}));
 },{seed,key});
 const boundary=log=>log.events.filter(e=>e.area==='battle'&&['ready','loading-card','audio','first-render'].includes(e.stage));
 try{
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
  assert.equal((await page.locator('script[type="module"][src]').getAttribute('src')).replace(/^\.\//,''),manifest.browserBundle.entry);
  const before=await page.evaluate(key=>localStorage.getItem(key),key);
  await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('championshipModernSave:runtimeDiagnostics:v1')||'null')?.events.some(e=>e.area==='battle'&&e.stage==='first-render'&&e.phase==='done'));
  const inspect=()=>page.evaluate(()=>({log:JSON.parse(localStorage.getItem('championshipModernSave:runtimeDiagnostics:v1')),cards:document.querySelectorAll('.cm-vs5-field__loading').length,busy:document.querySelector('.cm-vs5-field')?.getAttribute('aria-busy'),screen:document.querySelector('#cm-root')?.dataset.activeScreen,contexts:window.__qaContexts(),pixi:document.querySelectorAll('canvas.cm-field-canvas').length,three:document.querySelectorAll('canvas.cm-vs5-vfx-overlay').length}));
  const first=await inspect(),events=boundary(first.log);
  assert.deepEqual(events.map(e=>[e.stage,e.phase]),[['ready',undefined],['loading-card','done'],['audio','start'],['first-render','start'],['first-render','done']]);
  assert.ok(events.every(e=>e.document===events[0].document&&e.screen==='BATTLE_FIELD'));
  assert.equal(first.cards,0);assert.equal(first.busy,'false');assert.equal(first.screen,'BATTLE_FIELD');assert.equal(first.pixi,1);assert.equal(first.three,1);assert.equal(first.contexts.filter(c=>c.connected).length,2);
  await page.waitForTimeout(2000);const after=await inspect();assert.deepEqual(boundary(after.log),events);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before,'entry diagnostics cannot change saved bytes');
  assert.ok(after.log.events.some(e=>e.type==='BOOT'));assert.ok(after.log.events.length<=32);assert.ok(Buffer.byteLength(JSON.stringify(after.log))<=8192);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert.equal(documents.length,1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'pages-build.json'))).buildId,manifest.buildId);
  await page.screenshot({path:path.join(output,'entry.png')});result={root,buildId:manifest.buildId,events,unchangedSaveBytes:true,onePixiApplicationCanvas:true,boundedThreeCanvas:true,webglContexts:after.contexts,onceAfterFurtherFrames:true,missing,errors,seededCheckpoint:true,physicalSafari:'UNVERIFIED'};
  console.log('BATTLE_ENTRY_DIAGNOSTICS_BROWSER_PASS');
 }catch(error){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});result={root,error:String(error),missing,errors,documents};throw error;}
 finally{fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
