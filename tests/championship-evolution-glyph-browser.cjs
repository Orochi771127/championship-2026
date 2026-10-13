// Fresh QA contexts, local formal artifact, no personal profile or live writes.
// New Game uses the normal DOM opening; care/day commands and native clock
// stepping are controlled through the existing app API, never state mutation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {playOpening}=require('./championship-browser-opening.cjs');
const base='https://orochi771127.github.io/championship-2026/';
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest');
const output=path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT||'.tmp/evolution-glyphs-20261013/browser');
const key='championshipModernSave:v1';
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css','.mp4':'video/mp4','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg'};
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const reports=[];let checkpoint=null;
 async function run({locale,width,reduced,newGame=false}){
  const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await ctx.newPage(),errors=[],missing=[],requests=[];let patches=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({seed,key})=>{if(seed)localStorage.setItem(key,seed);window.__qaReady=false;addEventListener('championship:ready',()=>window.__qaReady=true);addEventListener('unhandledrejection',e=>{(window.__qaRejections??=[]).push(String(e.reason))});},{seed:newGame?null:checkpoint,key});
  await ctx.route('**/*',async route=>{
   const url=route.request().url();if(!url.startsWith(base)){missing.push('external');await route.abort();return;}
   const relative=decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length)),file=path.resolve(root,relative||'index.html');requests.push(relative);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){missing.push(relative);await route.fulfill({status:404,body:'missing QA artifact input'});return;}
   if(/main-.*\.js$/.test(relative)){
    let body=fs.readFileSync(file,'utf8');
    assert.ok(body.includes('app=createChampionshipStandaloneApp('));
    body=body.replace('app=createChampionshipStandaloneApp(','app=globalThis.__qaApp=createChampionshipStandaloneApp(');
    assert.ok(body.includes('function updateAnimations(ticker){'));
    body=body.replace('function updateAnimations(ticker){','function updateAnimations(ticker){globalThis.__qaField={app,source,scene,actors,evolutionWords,evolutionWriting};');
    const band=/function createEvolutionGlyphBand\(PIXI,(\w+)\)\{let container=new PIXI\.Container\(\{label:"Owner original evolution glyphs"\}\);container\.eventMode="none";/;
    assert.ok(band.test(body));
    body=body.replace(band,(match,art)=>match+`globalThis.__qaGlyph={container,art:${art}};`);patches++;
    await route.fulfill({body,contentType:'text/javascript'});return;
   }
   await route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
  });
  const advance=async frames=>{
   await page.evaluate(n=>{for(let i=0;i<n;i++){const app=window.__qaApp;if(app.hasRaisingPresentation())app.advanceRaisingPresentation({frames:1});else app.advanceNaturalClock({frames:1});const m=app.getRaisingMailbox();if(m.activeId!==null&&m.queue.find(q=>q.id===m.activeId)?.system)app.acknowledgeRaisingMail();}},frames);
   await page.clock.runFor(34);
  };
  const evolution=()=>page.evaluate(()=>window.__qaApp.getRaisingLifecycleFrame().evolution);
  const sample=()=>page.evaluate(()=>{const q=window.__qaGlyph,f=window.__qaField,b=q?.container.getBounds();return {phase:window.__qaApp.getRaisingLifecycleFrame().evolution,
   glyphs:q?.container.children.map(s=>({id:s.label,width:s.width,height:s.height})),x:q?.container.x,y:q?.container.y,bounds:b?{x:b.x,y:b.y,width:b.width,height:b.height}:null,
   writingVisible:f.evolutionWriting.visible,words:f.evolutionWords.map(w=>w.text??'EXISTING_NATIVE_WORD_CELL'),motion:document.documentElement.dataset.motion,
   canvasCount:document.querySelectorAll('.cm-raising-pixi-canvas').length,viewportWidth:window.innerWidth}});
  try{
   await page.goto(base+'championship.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);
   await page.waitForFunction(()=>window.__qaReady);await page.waitForTimeout(300);
   if(await page.locator('#cm-film-skip').isVisible())await page.locator('#cm-film-skip').click();
   await page.waitForFunction(()=>document.querySelector('#cm-opening-film').hidden);
   // Skip consumes follow-up pointer events for its existing 350ms guard.
   await page.waitForTimeout(400);
   if(locale!=='zh-Hant'){
    await page.locator('#cm-title-settings').click();await page.locator('.cm-settings__category[data-category="language"]').click();
    await page.locator(`input[name="cm-setting-locale"][value="${locale}"]`).check({force:true});
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.equal(await page.locator('html').getAttribute('lang'),locale);
   }
   await page.locator('#cm-login').click();
   await page.waitForFunction(()=>!document.querySelector('.cm-title__actions').hidden);
   if(newGame)await playOpening(page,{trainerName:'QA',eggName:'Egg'});else await page.locator('#cm-continue').click();
   await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready'&&window.__qaField);
   await page.waitForFunction(()=>{const states=document.querySelector('.int-rh2-field-host')?.dataset.residentAssets;return states&&JSON.parse(states).every(s=>s.state==='ready')});
   if(newGame)assert.equal(requests.filter(r=>r.includes('evolution-glyphs-v1/')&&r.endsWith('.png')).length,0,'no glyph preload before evolution');
   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
   if(newGame){
    // Controlled released Hand commands via the existing input API.
    for(let i=0;i<3;i++){
     assert.equal(await page.evaluate(()=>{const a=window.__qaApp,id=a.getRaisingInstances()[0].instanceId,f=a.getRaisingActorFrame(id),p={x:f.positionQ12[0]/4096,y:f.positionQ12[1]/4096};if(!a.beginRaisingHand(id,p))return false;return a.endRaisingHand(id)}),true);
     await advance(1);
    }
    await advance(200);
    assert.ok(await page.evaluate(()=>window.__qaApp.getRaisingActorFrame(window.__qaApp.getRaisingInstances()[0].instanceId).speciesIndex>=8),'released Hand commands hatch normally');
    for(let day=0;day<12;day++){
     await page.evaluate(()=>{const a=window.__qaApp,id=a.getRaisingInstances()[0].instanceId,f=a.getRaisingActorFrame(id);a.placeRaisingFood({x:f.positionQ12[0]/4096,y:f.positionQ12[1]/4096})});
     let started=false;
     for(let n=0;n<600;n+=5){await advance(5);const e=await evolution();if(e?.target>=8){started=true;break;}}
     console.log('NATURAL_DAY',day,'evolution',started);
     if(started){await page.evaluate(()=>window.__qaApp.save());checkpoint=await page.evaluate(k=>localStorage.getItem(k),key);fs.writeFileSync(path.join(output,'own-pre-evolution-save.json'),checkpoint);break;}
     assert.equal(await page.evaluate(()=>window.__qaApp.endDay().accepted),true);
     await advance(40);await page.locator('.int-rh2-calendar').click({force:true});await advance(26);
    }
    assert.ok(checkpoint,'normal care/day path reaches automatic evolution');
   }
   for(let i=0;i<200&&!((await evolution())?.phase>=2);i++)await advance(1);
   await page.waitForFunction(()=>window.__qaGlyph?.container.children.length===4);
   await page.clock.runFor(34);
   const first=await sample();await advance(20);const second=await sample();
   assert.deepEqual(first.glyphs.map(g=>g.id),['CP-G01','CP-G02','CP-G03','CP-G04']);
   assert.equal(first.writingVisible,true);assert.equal(first.canvasCount,1);
   assert.equal(first.words.length,6);assert.ok(first.words.some(w=>w.includes('進化（しんか）')&&w.includes('TIẾN HÓA')&&w.includes('วิวัฒนาการ')));
   assert.deepEqual(second.words,first.words,'new band preserves every existing word row');
   if(reduced)assert.equal(second.x,first.x);else assert.ok(second.x<first.x,'right-to-left native-frame travel');
   const glyphRequests=requests.filter(r=>r.includes('evolution-glyphs-v1/')&&r.endsWith('.png'));
   assert.equal(glyphRequests.length,4);assert.ok(glyphRequests.every(r=>r.endsWith('-128.png')));
   await page.screenshot({path:path.join(output,`${locale}-${width}-${reduced?'reduced':'full'}.png`)});
   await advance(350);assert.equal(await evolution(),null);
   assert.equal(await page.evaluate(()=>window.__qaField.evolutionWriting.visible),false,'decorations hide after completion');
   await page.locator('button[data-menu-id="SYSTEM"]').click({force:true});await page.locator('[data-entry-id="saveQuit"]').click({force:true});
   await page.waitForFunction(()=>window.__qaGlyph.container.destroyed&&window.__qaGlyph.art.assets.every(a=>a.texture.destroyed));
   await page.clock.resume();await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
   await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready');
   assert.equal(await page.locator('.cm-raising-pixi-canvas').count(),1,'one shared canvas after reentry');
   assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert.deepEqual(await page.evaluate(()=>window.__qaRejections??[]),[]);assert.equal(patches,1);
   reports.push({locale,width,reduced,newGame,first,second,glyphRequests,returnAndReentry:true,errors,missing});console.log('GLYPH_BROWSER_PASS',locale,width,reduced);
  }catch(error){await page.screenshot({path:path.join(output,`${locale}-failure.png`)}).catch(()=>{});throw error;}finally{await ctx.close();}
 }
 try{
  await run({locale:'zh-Hant',width:390,reduced:false,newGame:true});
  for(const c of [{locale:'en',width:320,reduced:false},{locale:'ja',width:320,reduced:true},{locale:'th',width:390,reduced:false},{locale:'vi',width:320,reduced:true}])await run(c);
 }finally{
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({artifact:root,classification:'ISOLATED_CONTROLLED_BROWSER_NATIVE_EVOLUTION',newGameOpening:'normal DOM',handCareAndClock:'existing public app API; no state or eligibility mutation',laterContexts:'own naturally reached pre-evolution save',physicalDeviceAccepted:false,reports},null,2));
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
