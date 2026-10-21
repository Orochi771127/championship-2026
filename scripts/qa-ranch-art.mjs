import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {PRODUCT_RANCH_GRID,validateProductRanch} from '../src/championship/cage/productRanchGrid.js';
import {composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {applyRaisingGroundReview} from '../src/championship/raising/raisingGroundReview.js';
import {deserializeChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';
import review from '../src/data/championship/catalogs/raising-ground.review-20261019.json' with {type:'json'};
import conveyor from '../src/data/championship/catalogs/ranch-conveyor.r1.json' with {type:'json'};
const require=createRequire(import.meta.url),{chromium}=require('playwright');
applyRaisingGroundReview(review);
const root=path.resolve(import.meta.dirname,'..'),out=process.env.CHAMPIONSHIP_QA_OUTPUT;if(!out)throw Error('QA output required');fs.mkdirSync(out,{recursive:true});
const origin=process.env.CHAMPIONSHIP_QA_ORIGIN??'http://127.0.0.1:8745';
const pageUrl=process.env.CHAMPIONSHIP_QA_URL??origin+'/championship.html';
const publicDist=process.env.CHAMPIONSHIP_QA_PUBLIC_DIST;
const defs=listCageDefinitions(),slots=Array.from({length:100},(_,i)=>i),report={physicalDevice:false,controlledSave:true,scenarios:[],errors:[],warnings:[],failed:[],externalModels:[]};
const browser=await chromium.launch({executablePath:'C:/Users/User/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const counterparts={27:1,30:4,31:6,32:9,33:8,29:17,28:15};
const scenarios=process.env.CHAMPIONSHIP_QA_ALL_CAGES==='1'?Array.from({length:35},(_,i)=>['cage-'+String(i).padStart(2,'0'),i,counterparts[i]??i]):[['grass',7,7],['volcano',6,31],['gym',4,30],['sports',1,27],['beach',8,33],['factory',14,14]];
try{for(const [name,definition,other] of scenarios){
 if(process.env.CHAMPIONSHIP_QA_SCENES&&!process.env.CHAMPIONSHIP_QA_SCENES.split(',').includes(name))continue;
 const waiting={moduleId:defs[35].moduleId,slotIndex:0,instanceId:'cage:waiting'},a={moduleId:defs[definition].moduleId,slotIndex:24,instanceId:'cage:a'};
 let placements,ground;
 for(const slotIndex of slots){const b={moduleId:defs[other].moduleId,slotIndex,instanceId:'cage:b'},ps=[waiting,a,b];if(!validateProductRanch(ps,slots))continue;const g=composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,unlockedSlots:slots,placements:ps});if(g.navigation.connections.some(c=>c.left===1&&c.right===2)){placements=ps;ground=g;break;}}
 if(!placements)throw Error('NO_ADJACENT_LAYOUT '+name);
 const seed=JSON.parse(fs.readFileSync(path.join(root,'qa/championship-full-qa-save.json'),'utf8'));
 seed.schemaVersion=7;seed.cageEdit={layoutVersion:PRODUCT_RANCH_GRID,gridAccess:{version:1,legacyUnlockedSlots:slots.slice(0,40),purchasedRows:[],testUnlockedRows:[4,5,6,7,8,9],legacyGrants:[]},placements,nextInstanceSequence:4};
 seed.shop.cageQuantities=Object.fromEntries(seed.shop.cageOwned.map(i=>[i,2]));
 seed.raising.nativeHome.cageAssignments={[seed.creature.creatureId]:'cage:a'};
 if(process.env.CHAMPIONSHIP_QA_CONVEYOR==='1'&&definition===14){
   const s=conveyor.surfaces[7];seed.creature.nativeProfile.fields['014']=definition;
   seed.creature.nativeProfile.fields['1c0']=Math.round(s.polygon.reduce((n,p)=>n+p[0],0)/s.polygon.length);
   seed.creature.nativeProfile.fields['1c4']=Math.round(s.polygon.reduce((n,p)=>n+p[1],0)/s.polygon.length);
 }
 for(const [i,p] of seed.raising.collection.entries()){seed.raising.nativeHome.poolSlots[p.instanceId]=i+1;seed.raising.nativeHome.cageAssignments[p.instanceId]='cage:waiting';}
 if(process.env.CHAMPIONSHIP_QA_WALKER==='1'){
   const walker=seed.raising.collection[0];seed.raising.nativeHome.cageAssignments[walker.instanceId]='cage:a';
   walker.nativeProfile.fields['014']=definition;walker.nativeProfile.fields['1c0']=0;walker.nativeProfile.fields['1c4']=0;
   if(process.env.CHAMPIONSHIP_QA_CONVEYOR==='1'&&definition===14){
     const s=conveyor.surfaces[7];
     walker.nativeProfile.fields['1c0']=Math.round(s.polygon.reduce((n,p)=>n+p[0],0)/s.polygon.length);
     walker.nativeProfile.fields['1c4']=Math.round(s.polygon.reduce((n,p)=>n+p[1],0)/s.polygon.length);
   }
 }
 deserializeChampionshipModernSave(JSON.stringify(seed));
 const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block',...(process.env.CHAMPIONSHIP_QA_VIDEO==='1'?{recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}}:{})}),page=await context.newPage();
 if(publicDist)await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   let file=null;
   if(url.origin==='https://orochi771127.github.io'&&url.pathname.startsWith('/championship-2026/'))
     file=path.join(publicDist,url.pathname.slice('/championship-2026/'.length));
   if(file&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
   return route.fulfill({status:404,body:'QA route has no selected file'});
 });
 const passageRequests=[];page.on('request',r=>{if(r.url().includes('/passages-20261021/'))passageRequests.push(r.url());});
 if(process.env.CHAMPIONSHIP_QA_COMPARE_2D==='1'){
   await page.route('**/presentation/ranchThreeScene.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'src/championship/presentation/ranchThreeScene.js'),'utf8').replace('renderer.render(scene,camera);frames++;','globalThis.__qaThree={renderer,scene,camera,sprites};renderer.render(scene,camera);frames++;')}));
   await page.route('**/presentation/intRh2/createRaisingFieldPixiPresentation.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js'),'utf8').replace('function updateAnimations(ticker) {','function updateAnimations(ticker) {globalThis.__qaStage=stage;')}));
 }
 if(process.env.CHAMPIONSHIP_QA_PASSAGE_BASELINE==='1')await page.route('**/presentation/ranchPassages.js',r=>r.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','HEAD:src/championship/presentation/ranchPassages.js'],{cwd:root,encoding:'utf8'})}));
 page.on('pageerror',e=>report.errors.push({name,error:e.message,stack:e.stack}));page.on('console',m=>{if(m.type()==='warning')report.warnings.push({name,text:m.text()});});page.on('response',r=>{if(r.status()>=400)report.failed.push({name,status:r.status(),url:r.url()});});
 await page.addInitScript(({seed,origin})=>{if(location.origin===origin&&!localStorage.getItem('championshipModernSave:v1'))localStorage.setItem('championshipModernSave:v1',JSON.stringify(seed));},{seed,origin});
 await page.goto(pageUrl+'?presentation=developer');await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
 try{await page.locator('.int-rh2-field-host[data-load-state="ready"]').waitFor({timeout:Number(process.env.CHAMPIONSHIP_QA_LOAD_TIMEOUT??60000)});}
 catch(error){await page.screenshot({path:path.join(out,name+'-load-failure.png')});
   const blobUrl=report.errors.at(-1)?.stack?.match(/(blob:https?:\/\/[^\s]+):\d+:\d+/)?.[1];
   if(blobUrl){const source=await page.evaluate(async url=>fetch(url).then(r=>r.text()),blobUrl).catch(()=>null);
     if(source)fs.writeFileSync(path.join(out,name+'-failing-blob.js'),source);}
   fs.writeFileSync(path.join(out,name+'-load-failure.json'),JSON.stringify({errors:report.errors,warnings:report.warnings,failed:report.failed,externalModels:report.externalModels},null,2));throw error;}
 await page.waitForTimeout(1800);
 if(process.env.CHAMPIONSHIP_QA_CONVEYOR_UI==='1'){
   await page.locator('.cm-toolbar [data-tool-id="hand"]').click();
   await page.mouse.click(160,250);await page.waitForTimeout(150);
   let picked,anchor;report.conveyorPickupAttempts=[];
   for(let attempt=0;attempt<6&&!picked;attempt++){
     const rows=await page.locator('.int-rh2-field-host').evaluate(el=>JSON.parse(el.dataset.residentScreenPositions??'[]'));
     const walker=rows.find(a=>a.creatureId===seed.raising.collection[0].instanceId);anchor=rows.find(a=>a.creatureId===seed.creature.creatureId);
     if(!walker||!anchor)throw Error('CONVEYOR_UI_ACTOR_MISSING');
     await page.mouse.move(walker.x,walker.y);await page.mouse.down();await page.waitForTimeout(350);
     const after=await page.locator('.int-rh2-field-host').evaluate(el=>JSON.parse(el.dataset.residentScreenPositions??'[]'));
     report.conveyorPickupAttempts.push({walker,after});picked=after.find(a=>a.state===6);
     if(!picked){await page.mouse.up();await page.waitForTimeout(200);}
   }
   if(!picked)throw Error('CONVEYOR_UI_PICKUP_FAILED');
   const s=conveyor.surfaces[7],o=ground.origin('cage:a');
   const local=[0,1].map(i=>s.polygon.reduce((n,p)=>n+p[i],0)/s.polygon.length);
   const x=anchor.groundScreen.x+(o[0]+local[0]-anchor.nativePositionQ12[0]/4096)*anchor.nativeScreenPixels;
   const y=anchor.groundScreen.y+(o[1]+local[1]-13-anchor.nativePositionQ12[1]/4096)*anchor.nativeScreenPixels;
   await page.mouse.move(x,y,{steps:12});await page.waitForTimeout(600);await page.mouse.up();await page.waitForTimeout(550);
   report.conveyorPointer={picked:picked.creatureId,targetNative:[o[0]+local[0],o[1]+local[1]],normalPointer:true};
 }
 await page.screenshot({path:path.join(out,name+'-initial.png')});
 if(process.env.CHAMPIONSHIP_QA_COMPARE_2D==='1'){
   const geometry=await page.evaluate(()=>{
     __qaStage.app.ticker.stop();const q=__qaThree;
     const result=[...q.sprites].map(([id,s])=>({id,visible:s.mesh.visible,box:s.sprite.getBounds(),visual:s.sprite.visualBounds,image:s.sprite.texture.source.resource.constructor.name,orig:s.sprite.texture.orig,trim:s.sprite.texture.trim}));
     for(const s of q.sprites.values()){s.qaVisible=s.mesh.visible;s.mesh.visible=false;s.sprite.renderable=true;}
     q.renderer.render(q.scene,q.camera);__qaStage.app.renderer.render(__qaStage.app.stage);return result;
   });
   fs.writeFileSync(path.join(out,name+'-sprite-geometry.json'),JSON.stringify(geometry,null,2));
   await page.screenshot({path:path.join(out,name+'-reference-pixi.png')});
   await page.evaluate(()=>{const q=__qaThree;for(const s of q.sprites.values()){s.mesh.visible=s.qaVisible;s.sprite.renderable=false;}q.renderer.render(q.scene,q.camera);__qaStage.app.renderer.render(__qaStage.app.stage);__qaStage.app.ticker.start();});
 }
 const canvas=await page.locator('canvas.cm-raising-pixi-canvas').boundingBox();
 const timings=await page.evaluate(()=>new Promise(resolve=>{const a=[];let last=performance.now();const tick=now=>{a.push(now-last);last=now;if(a.length<90)requestAnimationFrame(tick);else{a.sort((x,y)=>x-y);resolve({median:a[45],p95:a[85],heap:performance.memory?.usedJSHeapSize??null});}};requestAnimationFrame(tick);}));
 await page.locator('.cm-ranch-zoom').click();await page.waitForTimeout(300);await page.screenshot({path:path.join(out,name+'-overview.png')});
 const three=await page.locator('.cm-ranch-three-canvas').evaluateAll(nodes=>nodes.map(n=>({...n.dataset})));
 if(process.env.CHAMPIONSHIP_QA_REQUIRE_3D==='1'&&(!three.length||!Number(three[0].frames)))throw Error('3D_NOT_RENDERING:'+name);
 if(three.length&&(three[0].passageAppearance!=='invisible'||passageRequests.length))throw Error('VISIBLE_PASSAGE_ART:'+name);
 const actors=await page.locator('.int-rh2-field-host').evaluate(el=>JSON.parse(el.dataset.residentScreenPositions??'[]'));
 if(three.length&&Number(three[0].actorProjectionError)>1)throw Error('3D_ACTOR_ALIGNMENT:'+name);
 const blockedActors=actors.filter(a=>a.nativePositionQ12&&ground.readTerrain(Math.floor(a.nativePositionQ12[0]/32768),Math.floor(a.nativePositionQ12[1]/32768))===1);
 if(blockedActors.length)report.warnings.push({name,blockedActors});
 report.scenarios.push({name,placements,connections:ground.navigation.connections,canvas,timings,three,actors,passageRequests});
 if(process.env.CHAMPIONSHIP_QA_CONVEYOR==='1'){
   const samples=[];for(let i=0;i<30;i++){
     samples.push(await page.locator('.int-rh2-field-host').evaluate(el=>JSON.parse(el.dataset.residentScreenPositions??'[]')));
     await page.waitForTimeout(100);
   }
   report.scenarios.at(-1).motionSamples=samples;
 }
 if(process.env.CHAMPIONSHIP_QA_CONTEXT_RESTORE==='1'){
   const before=Number(await page.locator('.cm-ranch-three-canvas').getAttribute('data-frames'));
   await page.locator('.cm-ranch-three-canvas').evaluate(c=>{const e=c.getContext('webgl2').getExtension('WEBGL_lose_context');if(!e)throw Error('CONTEXT_LOSS_EXTENSION_REQUIRED');e.loseContext();setTimeout(()=>e.restoreContext(),350);});
   await page.waitForFunction(n=>Number(document.querySelector('.cm-ranch-three-canvas')?.dataset.frames)>n+10,before,{timeout:10000});
   report.scenarios.at(-1).contextRestored=true;
 }
 if(process.env.CHAMPIONSHIP_QA_FEED==='1'){
   const feed=page.locator('.cm-toolbar [data-tool-id="feed"]');const stock=Number(await feed.getAttribute('data-owned'));
   await feed.click();await page.waitForTimeout(1800);
   const point=await page.locator('.int-rh2-field-host').evaluate(el=>JSON.parse(el.dataset.residentScreenPositions??'[]').find(a=>a.speciesIndex===0));
   await page.mouse.click(point.groundScreen.x,point.groundScreen.y);
   await page.waitForFunction(n=>Number(document.querySelector('.cm-toolbar [data-tool-id="feed"]')?.dataset.owned)===n-1,stock,{timeout:10000});
   await page.waitForTimeout(900);await page.screenshot({path:path.join(out,name+'-food.png')});
   report.scenarios.at(-1).normalPointerFeed=true;
 }
 if(process.env.CHAMPIONSHIP_QA_VIDEO==='1')await page.waitForTimeout(6000);
 await context.close();
 if(process.env.CHAMPIONSHIP_QA_VIDEO==='1')await page.video().saveAs(path.join(out,name+'.webm'));
 console.log('Checked '+name);
}}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({scenarios:report.scenarios.map(s=>({name:s.name,timings:s.timings})),errors:report.errors,warnings:report.warnings,failed:report.failed},null,2));
if(report.errors.length||report.failed.length)process.exitCode=1;
