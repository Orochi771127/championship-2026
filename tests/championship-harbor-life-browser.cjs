// Real UI input over local-file fixtures: no network, no simulation writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {chromium}=require('playwright');
const out=path.resolve('docs/reports/presentation-uplift-2026-10-18/evidence');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const report={method:'Windows desktop Chrome; intercepted local artifact bytes, no HTTP/network; headless WebGL is not physical-phone performance',cases:[]};let browser;
(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 for(const label of ['before','after','reduced','low']){
  const root=path.resolve(label==='before'?'dist/title-before':'dist/title-final'),quiet=label==='reduced';
  const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:quiet?'reduce':'no-preference',recordVideo:['before','after'].includes(label)?{dir:path.join(out,'video'),size:{width:960,height:540}}:undefined});
  await ctx.route('**/*',async route=>{const url=new URL(route.request().url()),rel=decodeURIComponent(url.pathname).replace(/^\/championship-2026\//,'');const file=path.resolve(root,rel||'index.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:rel});return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});});
  const page=await ctx.newPage();page.setDefaultTimeout(60000);const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
  await page.addInitScript(({low})=>{
   localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({locale:'zh-Hant',muted:true,quality:low?'saver':'high'}));
   if(low)localStorage.setItem('championshipModernSave:dataArena:v1',JSON.stringify({schemaVersion:1,kind:'DATA_ARENA_RECORDS',lastMode:'HARBOR',settings:{quality:'low',shake:false}}));
  },{low:label==='low'});
  await page.goto('https://orochi771127.github.io/championship-2026/index.html?arenaQa=1&arenaSeed=7',{waitUntil:'domcontentloaded'});
  await page.locator('#cm-login').click();await page.locator('#cm-data-arena').click();await page.locator('.da-mode[data-mode="HARBOR"]').click();await page.locator('.da-partner').first().click();
  await page.locator('.da-panel--select .da-btn--primary').click();await page.locator('.da-panel--brief .da-btn--primary').click();
  await page.waitForFunction(()=>window.__dataArenaQA?.state()==='PLAY');
  const samples=[];const sample=async()=>{const r=await page.evaluate(()=>({snapshot:__dataArenaQA.snapshot(),diagnostics:__dataArenaQA.diagnostics()}));samples.push(r);assert.equal(r.diagnostics.frameFault,null);return r;};
  const first=await sample();assert.equal(first.diagnostics.scene.hasCreatureArt,true);assert.ok(first.diagnostics.scene.environment);
  for(let i=0;i<6;i++){await page.waitForTimeout(650);await sample();}
  await page.screenshot({path:path.join(out,`B-${label}-idle.png`)});
  await page.keyboard.down('KeyD');await page.waitForTimeout(600);const walking=await sample();await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyA');await page.waitForTimeout(600);await sample();await page.keyboard.up('KeyA');
  await page.waitForTimeout(900);await sample();await page.screenshot({path:path.join(out,`B-${label}-walk.png`)});
  await page.keyboard.down('KeyJ');await page.waitForTimeout(250);await page.keyboard.up('KeyJ');
  await page.locator('.da-hud__pause').click();const paused=await sample();await page.waitForTimeout(350);const still=await sample();assert.equal(paused.snapshot.time,still.snapshot.time);
  assert.equal(await page.evaluate(()=>localStorage.getItem('championshipModernSave:v1')),null);
  if(label!=='before'){
   const actors=first.diagnostics.scene.harborLife;assert.deepEqual(actors.map(a=>a.speciesId),['species-034','species-073']);assert.ok(actors.every(a=>a.pilot));
   if(['reduced','low'].includes(label)){assert.ok(samples.every(s=>s.diagnostics.scene.environment.waterOffsetX===0));assert.ok(samples.every(s=>s.diagnostics.scene.environment.armFrames.every(f=>f===0)));}
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  await page.locator('.da-panel--pause .da-btn--quiet').click();await page.locator('#cm-data-arena').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>!!window.__dataArenaQA),false);
  const video=page.video();await ctx.close();if(video)await video.saveAs(path.join(out,`B-${label}.webm`));
  report.cases.push({label,samples,walking,errors,failed,saveUnchanged:true,exitDisposed:true});fs.writeFileSync(path.join(out,'B_BROWSER.json'),JSON.stringify(report,null,2));console.log(`B ${label}: native actors, movement, pause, save isolation and exit PASS`);
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();});
