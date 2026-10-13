// Fixed-seed baseline/packed comparison in fresh QA contexts; all requests use
// local reviewed bytes. Controlled clock and desktop Chromium, never iPhone.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest'),base='https://orochi771127.github.io/championship-2026/';
const out=require('./browser-qa-output.cjs')('battle-packed');fs.mkdirSync(out,{recursive:true});
const key='championshipModernSave:v1',pack=JSON.parse(fs.readFileSync('assets/production/characters/battle-packed-20261013/manifest.json'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.mp3':'audio/mpeg'};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const {createChampionshipStandaloneApp}=await import('../src/championship/app/championshipStandaloneApp.js');
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog:JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json')),cages:JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json')).cages,rngClock:()=>({hour:1,minute:2,second:3})});
 await app.newGame({trainerName:'QA',eggName:'Egg'});app.save();const seed=JSON.parse(storage.getItem(key));await app.dispose();
 seed.progression.nativeOpening={version:2,trainerName:'QA',tutorialStep:null,checkpoint:{version:1,stage:'battle-running',message:0}};
 const browser=await chromium.launch({channel:'chrome',headless:true}),reports=[];
 async function run(packed){
  const label=packed?'packed':'baseline',ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await ctx.newPage();const errors=[],missing=[],requests=[];let observerPatch=0,switchPatch=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({seed,key})=>{
   localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('championshipModernSave:preferences:v1',JSON.stringify({muted:true,reducedMotion:'on'}));
   window.__qaSources=new Map();window.__qaDraws=[];const original=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();
   HTMLCanvasElement.prototype.getContext=function(...args){const gl=original.apply(this,args);if(gl&&/^(webgl2?|experimental-webgl)$/.test(args[0])&&!seen.has(gl)){
    seen.add(gl);const counter={canvas:this,draws:0};window.__qaDraws.push(counter);
    for(const method of ['drawArrays','drawElements']){const fn=gl[method];gl[method]=function(...values){counter.draws++;return fn.apply(this,values);};}
   }return gl;};
  },{seed,key});
  await ctx.route('**/*',async route=>{
   if(!route.request().url().startsWith(base)){missing.push('external');await route.abort();return;}
   const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice(new URL(base).pathname.length)),file=path.resolve(root,relative||'index.html');requests.push(relative);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){missing.push(relative);await route.fulfill({status:404,body:'missing QA input'});return;}
   if(relative.endsWith('.js')){
    let body=fs.readFileSync(file,'utf8');const marker=/function characterTextureMemory\(pages\)\s*\{/;
    if(marker.test(body)){observerPatch++;body=body.replace(marker,match=>match+' for(const p of pages)globalThis.__qaSources.set(p.imageUrl,p.source);');}
    const choice=/battleAtlas:\s*(?:true|!0)/;
    if(!packed&&choice.test(body)){switchPatch++;body=body.replace(choice,'battleAtlas:false');}
    body=body.replace(/(\w+)=>(\w+)\.render\(\1\)/,(match,arg,view)=>`${arg}=>{globalThis.__qaStep=${arg}.animationFrame;globalThis.__qaView=${arg};${view}.render(${arg});}`);
    await route.fulfill({body,contentType:'text/javascript'});return;
   }
   await route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
  });
  async function wait(predicate){for(let i=0;i<900;i++){if(await page.evaluate(predicate))return;await new Promise(r=>setTimeout(r,50));}throw Error('QA predicate timeout');}
  try{
   await page.clock.install({time:new Date('2026-10-13T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-13T12:00:00.100Z'));
   await page.goto(base+'index.html',{waitUntil:'domcontentloaded'});await wait(()=>document.querySelector('#cm-login')?.disabled===false);
   const before=await page.evaluate(key=>localStorage.getItem(key),key);await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
   await wait(()=>JSON.parse(localStorage.getItem('championshipModernSave:runtimeDiagnostics:v1')||'null')?.events.some(e=>e.area==='battle'&&e.stage==='ready'));
   const sources=await page.evaluate(()=>[...window.__qaSources].map(([url,s])=>({url,pixelWidth:s.pixelWidth,pixelHeight:s.pixelHeight,format:s.format,destroyed:s.destroyed})));
   assert.equal(observerPatch,1);if(!packed)assert.equal(switchPatch,1);
   assert.equal(sources.length,packed?11:6);assert.equal(sources.reduce((n,s)=>n+s.pixelWidth*s.pixelHeight*4,0),packed?125843456:465567744);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
   // Freeze only the QA saved-at wall clock; performance/ticker time continues
   // through the controlled clock. Browser clock installation has 1ms jitter.
   await page.evaluate(()=>{const NativeDate=Date;globalThis.Date=class extends NativeDate{
    constructor(...args){super(...(args.length?args:['2026-10-13T12:00:00.100Z']));}
    static now(){return 1791892800100;}
   };});
   const imageHashes=[],drawCounts=[],views=[];
   for(const [i,target]of [1,31,61].entries()){
    await page.evaluate(()=>{for(const c of window.__qaDraws)c.draws=0;});
    for(let n=0;n<2000&&await page.evaluate(()=>window.__qaStep??-1)<target;n++)await page.clock.runFor(1);
    assert.equal(await page.evaluate(()=>window.__qaStep),target);views.push(await page.evaluate(()=>window.__qaView));
    const image=await page.locator('.cm-vs5-field canvas.cm-field-canvas').screenshot();fs.writeFileSync(path.join(out,label+'-'+i+'.png'),image);imageHashes.push(sha(image));
    drawCounts.push(await page.evaluate(()=>window.__qaDraws.filter(c=>c.canvas.isConnected).map(c=>({canvas:c.canvas.className,draws:c.draws}))));
   }
   for(let i=0;i<350;i++){if(await page.evaluate(()=>document.querySelector('#cm-root')?.dataset.activeScreen==='BATTLE_RESULT'))break;await page.clock.runFor(500);}
   assert.equal(await page.evaluate(()=>document.querySelector('#cm-root')?.dataset.activeScreen),'BATTLE_RESULT');
   await wait(()=>[...window.__qaSources.values()].filter(s=>!s.destroyed).length===0);
   const raw=await page.evaluate(key=>localStorage.getItem(key),key),save=JSON.parse(raw);assert.ok(save.progression.nativeOpening.checkpoint.stage.startsWith('battle-result-'));
   const mainRequests=requests.filter(p=>/\/main(?:-\d+)?\.webp$/.test(p));assert.equal(mainRequests.length,packed?11:6);assert.equal(new Set(mainRequests).size,mainRequests.length);
   if(packed)assert.ok(mainRequests.every(p=>p.startsWith(pack.root)));
   assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
   return {label,sources,imageHashes,drawCounts,views,save,rawSaveSha:sha(raw),mainRequests,allSourcesDestroyed:true,errors,missing};
  }finally{await ctx.close();}
 }
 try{
  reports.push(await run(false));reports.push(await run(true));
  assert.deepEqual(reports[1].views,reports[0].views,'same native frames must publish identical complete battle views');
  assert.deepEqual(reports[1].save,reports[0].save,'fixed-seed result and full saved game document must match');
  assert.equal(reports[1].rawSaveSha,reports[0].rawSaveSha,'serialized save bytes must match');
  console.log('BATTLE_PACKED_BROWSER_PASS',JSON.stringify({imageHashes:reports[0].imageHashes,rawSaveSha:reports[0].rawSaveSha,oldBytes:465567744,newBytes:125843456}));
 }finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({root,reports,controlledClock:true,seededCheckpoint:true,physicalIPhone:'UNVERIFIED'},null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
