// Formal local artifact in fresh QA contexts. Existing QA fixture only.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright');
const {playOpening}=require('./championship-browser-opening.cjs');
const base='https://orochi771127.github.io/championship-2026/',key='championshipModernSave:v1';
const root=path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT||'dist/github-playtest');
const output=path.resolve('.tmp/desktop-landscape-20261013/browser');fs.mkdirSync(output,{recursive:true});
const seed=fs.readFileSync('qa/championship-full-qa-save.json','utf8');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.wav':'audio/wav','.mp3':'audio/mpeg','.woff2':'font/woff2'};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),reports=[];
 async function setup(theme,withSeed=true){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await ctx.newPage();
  const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({seed,key})=>{if(seed)localStorage.setItem(key,seed);window.__qaReady=false;addEventListener('championship:ready',()=>window.__qaReady=true);addEventListener('unhandledrejection',e=>(window.__qaErrors??=[]).push(String(e.reason)));},{seed:withSeed?seed:null,key});
  await ctx.route('**/*',async route=>{
   const url=route.request().url();if(!url.startsWith(base)){missing.push('external');await route.abort();return;}
   const relative=decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length)),file=path.resolve(root,relative||'index.html');
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){missing.push(relative);await route.fulfill({status:404,body:'missing QA input'});return;}
   if(relative.endsWith('.js')){
    let body=fs.readFileSync(file,'utf8');
    if(/main-.*\.js$/.test(relative)){
     assert.ok(body.includes('app=createChampionshipStandaloneApp('));
     body=body.replace('app=createChampionshipStandaloneApp(','app=globalThis.__qaApp=createChampionshipStandaloneApp(');
    }
    const start=body.indexOf('async function mountRaisingFieldPixiPresentation'),end=body.indexOf('function updateAnimations(ticker){',start),prefix=body.slice(start,end);
    if(start>=0){
    assert.ok(end>start,'find the presenter in its lazy chunk');
    const view=prefix.match(/(\w+)=Object.freeze\(\{get width\(\)\{return \w+\.screen.width/)[1];
    const cameraX=prefix.match(/\b(cameraX\w*)=0/)[1],cameraY=prefix.match(/\b(cameraY\w*)=0/)[1],actors=prefix.match(/\b(actors\w*)=new Map/)[1];
    const hook=`globalThis.__qaLandscape={stage,source,fieldArt,actors:${actors},getView:()=>${view},getCamera:()=>[${cameraX},${cameraY}],getFit:()=>raisingFieldViewport(fieldArt?.field,${view},12,${cameraX})};`;
    body=body.replace('function updateAnimations(ticker){','function updateAnimations(ticker){'+hook);
    }
    await route.fulfill({body,contentType:'text/javascript'});return;
   }
   await route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
  });
  await page.goto(base+'championship.html?presentation=developer',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__qaReady);
  await page.waitForTimeout(400);
  if(await page.locator('#cm-film-skip').isVisible()){await page.locator('#cm-film-skip').click();await page.waitForTimeout(400);}
  if(theme!=='warm'){
   await page.locator('#cm-title-settings').click();await page.locator('.cm-settings__category[data-category="appearance"]').click();
   await page.locator(`input[name="cm-setting-theme"][value="${theme}"]`).check({force:true});
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  }
  await page.locator('#cm-login').click();
  if(withSeed)await page.locator('#cm-continue').click();else await playOpening(page,{trainerName:'QA',eggName:'Egg',tutorial:'keep'});
  await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready'&&window.__qaLandscape);
  await page.waitForFunction(()=>{const s=document.querySelector('.int-rh2-field-host')?.dataset.residentAssets;return s&&JSON.parse(s).every(r=>r.state==='ready')});
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  return {ctx,page,errors,missing};
 }
 async function sample(page){return page.evaluate(()=>{
  const q=window.__qaLandscape,v=q.getView(),fit=q.getFit(),field=q.fieldArt.field,placements=field.placements;
  const tileRoot=field.expansionPreview?q.fieldArt.displayObject.children[0]:q.fieldArt.displayObject;
  const originals=field.fold?tileRoot.getChildByLabel('ranch ring band 0').children:tileRoot.children.slice(0,placements.filter(p=>!p.foldCap).length);
  const groups=new Map();let at=0;
  for(const p of placements){if(p.foldCap)continue;const tile=originals[at++];if(p.cageDefinitionIndex===null||p.cageDefinitionIndex===35||!Number.isInteger(p.fragmentOfSlot??p.slotIndex))continue;
   const id=p.fragmentOfSlot??p.slotIndex,b=tile.getBounds();const old=groups.get(id);groups.set(id,{id,left:Math.min(old?.left??Infinity,b.x),right:Math.max(old?.right??-Infinity,b.x+b.width),top:Math.min(old?.top??Infinity,b.y),bottom:Math.max(old?.bottom??-Infinity,b.y+b.height)});
  }
  const complete=[...groups.values()].filter(b=>[-1,0,1].some(n=>{const dx=n*(field.wrapWidthPx??0)*fit.scale;return b.left+dx>=-0.1&&b.right+dx<=v.width+0.1&&b.top>=-0.1&&b.bottom<=v.height+0.1})).map(b=>b.id);
  const box=selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
  return {viewport:{width:innerWidth,height:innerHeight},desktop:document.body.hasAttribute('data-desktop-raising'),portrait:document.body.hasAttribute('data-portrait-frame'),canvas:box('.cm-raising-pixi-canvas'),host:box('.int-rh2-field-host'),fit,world:{width:field.worldWidthPx,height:field.worldHeightPx,unit:field.nativePixelWorldScale,wrap:field.wrapWidthPx},
   camera:q.getCamera(),scales:[...q.actors].map(([id,e])=>({id,scale:e.nativeScale})),completeCages:complete,cageCount:groups.size,
   selected:q.source.getFrame().selection?.creatureId,canvasCount:document.querySelectorAll('.cm-raising-pixi-canvas').length,toolbarCount:document.querySelectorAll('.cm-toolbar').length,toolbar:box('.cm-toolbar'),hud:box('.cm-status-bar'),
   overflow:document.documentElement.scrollWidth>innerWidth,unlocks:window.__qaApp.getCageEditFrame().unlockedCount};
 });}
 async function point(page,id){return page.evaluate(id=>{
  const q=window.__qaLandscape,e=q.actors.get(id),a=e.root.hitArea;
  const p=e.root.toGlobal({x:a.x+a.width/2,y:a.y+a.height/2}),r=q.stage.app.canvas.getBoundingClientRect();
  return {x:r.x+p.x*r.width/q.stage.app.screen.width,y:r.y+p.y*r.height/q.stage.app.screen.height};
 },id);}
 try{
  for(const theme of ['warm','classic']){
   const {ctx,page,errors,missing}=await setup(theme);const cases=[];
   const tall=await page.evaluate(()=>window.__qaApp.getRaisingInstances().find(r=>r.speciesId==='species-189').instanceId);
   // Same selected individual and simulation truth; select through the existing seam without a camera command.
   await page.evaluate(id=>window.__qaLandscape.source.intents.selectCreature(id),tall);
   for(const locale of ['zh-Hant','en','ja','th','vi']){
    if(locale!=='zh-Hant'){
     await page.locator('button[data-menu-id="SYSTEM"]').click({force:true});await page.locator('[data-entry-id="settings"]').click({force:true});
     await page.locator('.cm-settings__category[data-category="language"]').click({force:true});
     await page.locator(`input[name="cm-setting-locale"][value="${locale}"]`).check({force:true});
     await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    }
    for(const [width,height] of [[390,844],[1024,768],[1366,768],[1920,1080]]){
     await page.setViewportSize({width,height});await page.clock.runFor(34);await page.waitForTimeout(80);await page.clock.runFor(34);
     const s=await sample(page);assert.equal(s.desktop,width>=1024);assert.equal(s.portrait,false);assert.equal(s.canvasCount,1);assert.equal(s.toolbarCount,1);assert.equal(s.overflow,false);
     if(s.desktop)assert.ok(s.fit.y>=0,'desktop resize keeps the existing main cage row inside the viewport');
     assert.ok(Math.abs(s.canvas.width-s.host.width)<1);assert.ok(s.toolbar.y+s.toolbar.height<=height+1);assert.ok(s.hud.width<=width+1);
     assert.deepEqual(s.scales.map(e=>e.scale),cases[0]?.scales.map(e=>e.scale)??s.scales.map(e=>e.scale),'same native zoom on every width');
     assert.equal(s.unlocks,cases[0]?.unlocks??s.unlocks);assert.equal(s.selected,tall);
     cases.push({theme,locale,...s});
     if(locale==='zh-Hant')await page.screenshot({path:path.join(output,`${theme}-${width}.png`)});
    }
   }
   const phone=cases.find(c=>c.locale==='zh-Hant'&&c.viewport.width===390),desktop=cases.find(c=>c.locale==='zh-Hant'&&c.viewport.width===1366);
   assert.ok(desktop.completeCages.length>phone.completeCages.length,JSON.stringify({phone:phone.completeCages,desktop:desktop.completeCages}));
   console.log('CAGE_COMPARE',theme,phone.completeCages.length,desktop.completeCages.length,'scale',phone.scales[0].scale);
   await page.setViewportSize({width:1366,height:768});await page.clock.runFor(50);
   await page.locator('.cm-toolbar [data-tool-id="hand"]').click({force:true});await page.clock.runFor(34);
   assert.equal(await page.locator('body').getAttribute('data-tool'),'hand');
   await page.locator('.int-rh2-companion__close').click({force:true});await page.clock.runFor(34);
   const p=await point(page,tall);await page.mouse.click(p.x,p.y);await page.clock.runFor(34);
   assert.equal(await page.evaluate(()=>window.__qaLandscape.source.getFrame().selection?.creatureId),tall,'native hit area selects the tall partner');
   const before=await sample(page),rect=await page.locator('.cm-raising-pixi-canvas').boundingBox();
   await page.mouse.move(rect.x+200,rect.y+20);await page.mouse.down();await page.mouse.move(rect.x+100,rect.y+20,{steps:5});await page.mouse.up();await page.clock.runFor(34);
   const after=await sample(page);assert.notDeepEqual(after.camera,before.camera,'empty-ground drag pans existing world');
   // Normal card navigation focuses the tall body through the existing camera.
   await page.locator('.int-rh2-companion__nav').last().click({force:true});await page.locator('.int-rh2-companion__nav').first().click({force:true});await page.clock.runFor(100);
   const dragId=await page.evaluate(()=>window.__qaLandscape.source.getFrame().selection.creatureId);
   for(let i=0;i<120;i++){
    if(await page.evaluate(id=>[1,2,3,5,17].includes(window.__qaApp.getRaisingActorFrame(id).state),dragId))break;
    await page.clock.runFor(34);
   }
   const oldPosition=await page.evaluate(id=>window.__qaApp.getRaisingActorFrame(id).positionQ12,dragId);
   const carryPoint=await point(page,dragId);
   await page.mouse.move(carryPoint.x,carryPoint.y);await page.mouse.down();await page.clock.runFor(120);
   assert.equal(await page.evaluate(id=>window.__qaApp.getRaisingActorFrame(id).state,dragId),6,'real held pointer enters native carry state');
   await page.mouse.move(carryPoint.x+30,carryPoint.y,{steps:5});await page.clock.runFor(34);await page.mouse.up();await page.clock.runFor(500);
   assert.notEqual(await page.evaluate(id=>window.__qaApp.getRaisingActorFrame(id).state,dragId),6,'pointer release leaves carry state');
   const newPosition=await page.evaluate(id=>window.__qaApp.getRaisingActorFrame(id).positionQ12,dragId);assert.notDeepEqual(newPosition,oldPosition,'carry reaches native movement/release');
   await page.locator('.int-rh2-companion__more').click({force:true});const dialog=page.locator('.int-rh2-detail[open]');await dialog.waitFor();const b=await dialog.boundingBox();assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=1367&&b.y+b.height<=769);await page.keyboard.press('Escape');
   // Existing 200% text preference stresses the same measured HUD/dock.
   await page.evaluate(()=>document.documentElement.style.setProperty('--text-scale','2'));await page.clock.runFor(34);await page.waitForTimeout(80);await page.clock.runFor(34);assert.equal((await sample(page)).overflow,false);
   assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert.deepEqual(await page.evaluate(()=>window.__qaErrors??[]),[]);
   reports.push({theme,cases,gestures:{nativeHit:true,mapPan:true,carry:true,tallFocus:true,dialogBounds:true,text200Percent:true},errors,missing});await ctx.close();
  }
  const {ctx,page,errors,missing}=await setup('warm',false);
  for(const width of [390,1366,1024,1920,390]){
   await page.setViewportSize({width,height:width===1920?1080:width===390?844:768});await page.clock.runFor(34);
   const d=await page.locator('dialog[open]').boundingBox();assert.ok(d&&d.x>=-1&&d.y>=-1&&d.x+d.width<=width+1);
  }
  await page.locator('dialog.cm-dialog [data-action="accept"]').click({force:true});await page.clock.runFor(100);
  for(const width of [390,1024,1366,1920,390]){
   await page.setViewportSize({width,height:width===1920?1080:width===390?844:768});await page.clock.runFor(34);
   const tip=await page.locator('.cm-tutorial-guidance').boundingBox();assert.ok(tip&&tip.x>=-1&&tip.x+tip.width<=width+1);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);reports.push({tutorialInvitationAndGuidanceResize:true,errors,missing});await ctx.close();
 }finally{
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({artifact:root,fixtureSha256:crypto.createHash('sha256').update(seed).digest('hex'),physicalDeviceAccepted:false,reports},null,2));await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
