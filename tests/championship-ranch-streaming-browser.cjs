const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'..'),root=repo,temp=path.join(repo,'.tmp/stream-loader-review'),out=process.env.CHAMPIONSHIP_QA_OUTPUT||path.join(repo,'.tmp/loading-browser-results');fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(out,{recursive:true});
const entities=['e000_digitama','m503_warglaymon','m509_shinegraymon','m518_blackwargreymon','m529_metalgarurumon_va','m541_dukemon'];
const entry=`import * as PIXI from '../../node_modules/pixi.js/dist/pixi.mjs';
import {loadPublicCharacterRoster} from '../../src/championship/presentation/publicCharacterRoster.js';
import {createPixiAssetScope} from '../../src/championship/presentation/pixiCharacterRuntimeBundle.js';

import selection from '../../src/data/championship/public-character-catalog.v1.json' with {type:'json'};
const base='https://orochi771127.github.io/championship-2026/',entities=${JSON.stringify(entities)},selected=selection.characters.filter(c=>entities.includes(c.entityId));
let app,roster,actors=[];const initial={};
const frame=seq=>({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:seq.id,frameIndex:0,flipBits:0});
async function run(){
 app=new PIXI.Application();await app.init({width:390,height:570,resolution:1,backgroundColor:0xe8f5fc,preference:'webgl'});document.querySelector('#stage').append(app.canvas);
 const scope=createPixiAssetScope(PIXI,base);
 const started=performance.now();roster=await loadPublicCharacterRoster({PIXI:scope,speciesIds:selected.map(c=>c.speciesId),sides:['main'],ranchStreaming:true,initialSequences:Object.fromEntries(selected.map(c=>[c.speciesId,[0]])),},base);
 const diagnostics=roster.getDiagnostics();if(diagnostics.failures.length)throw Error(JSON.stringify(diagnostics.failures));
 for(const [i,c]of selected.entries()){
  const actor=roster.createActor({speciesId:c.speciesId,presentation:'raising'});if(!actor?.nativeFramePresenter)throw Error('Missing resident '+c.entityId);
  const runtime=await(await fetch(base+c.runtimePath)).json();const applied=actor.nativeFramePresenter.apply(frame(runtime.sides.main.animations[0]));
  actor.sprite.scale.set(Math.min(92/actor.sprite.width,140/actor.sprite.height));actor.sprite.position.set(65+(i%3)*130,180+Math.floor(i/3)*250);app.stage.addChild(actor.sprite);actors.push({actor,runtime});initial[c.entityId]={cell:applied.cell,geometry:applied.geometry};
 }
 app.render();document.querySelector('#state').textContent='6/6 initial native frames decoded and rendered';
 return {residents:actors.length,initialReadyMs:performance.now()-started,diagnostics,initial,applicationCount:1};
}
window.loadingQA={run,async deferred(){const {actor,runtime}=actors[1],seq=runtime.sides.main.animations.at(-1),pending=!actor.nativeFramePresenter.isFrameReady(frame(seq));await actor.nativeFramePresenter.ensureFrame(frame(seq));const applied=actor.nativeFramePresenter.apply(frame(seq));return {pendingBefore:pending,readyAfter:actor.nativeFramePresenter.isFrameReady(frame(seq)),expectedCell:seq.frames[0].cell,actualCell:applied.cell};},
async hunt(){
 actors.forEach(({actor})=>actor.sprite.destroy());actors=[];app.stage.removeChildren();await roster.dispose();
 const c=selected.find(c=>c.entityId==='m541_dukemon'),scope=createPixiAssetScope(PIXI,base);
 roster=await loadPublicCharacterRoster({PIXI:scope,speciesIds:[c.speciesId],sides:['main'],ranchStreaming:true,},base);
 const diagnostics=roster.getDiagnostics();if(diagnostics.failures.length)throw Error(JSON.stringify(diagnostics.failures));
 const runtime=await(await fetch(base+c.runtimePath)).json(),actor=roster.createActor({speciesId:c.speciesId,presentation:'hunt'});let checked=0;
 for(const sequence of runtime.sides.main.animations)for(let i=0;i<sequence.frames.length;i++){
  const applied=actor.nativeFramePresenter.apply({...frame(sequence),frameIndex:i});if(applied.cell!==sequence.frames[i].cell)throw Error('HUNT_CELL_DRIFT');checked++;
 }
 actor.sprite.scale.set(0.5);actor.sprite.position.set(195,420);app.stage.addChild(actor.sprite);actors.push({actor,runtime});app.render();
 return {checked,diagnostics,applicationCount:1};
},async dispose(){actors.forEach(({actor})=>actor.sprite.destroy());app.stage.removeChildren();await roster.dispose();app.destroy(true);return {canvasCount:document.querySelectorAll('canvas').length};}};`;
fs.writeFileSync(path.join(temp,'entry.js'),entry);
const html='<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#e8f5fc;font:14px system-ui;color:#17394c}h1{font-size:18px;padding:14px}p{padding:0 14px}canvas{display:block;max-width:100%}</style><h1>Isolated production-loader check</h1><p id="state">Loading six existing resident frames...</p><div id="stage"></div><script type="module" src="/.tmp/stream-loader-review/entry.js"></script></html>';
(async()=>{
 const report={kind:'ISOLATED_REAL_PIXI_LOADER_NOT_NORMAL_GAME_OR_PERFORMANCE_BENCHMARK',status:'RUNNING',requests:[],errors:[],externalNetworkRequestsAllowed:false};
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browser=browser.version();
 try{const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.route('**/*',async route=>{const url=new URL(route.request().url());if(!['http://127.0.0.1:8879','https://orochi771127.github.io'].includes(url.origin))return route.abort();
 let rel=decodeURIComponent(url.pathname).replace(/^\/championship-2026\//,'/').slice(1);if(!rel)return route.fulfill({body:html,contentType:'text/html'});
 const full=path.resolve(repo,rel);if(!full.startsWith(repo+path.sep)||!fs.existsSync(full))return route.abort();
 report.requests.push(rel);return route.fulfill({path:full,headers:{'Access-Control-Allow-Origin':'*'},contentType:rel.endsWith('.js')||rel.endsWith('.mjs')?'text/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.webp')?'image/webp':undefined});});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:8879/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.loadingQA);
 report.initial=await page.evaluate(()=>loadingQA.run());assert.equal(report.initial.residents,6);assert.equal(report.initial.applicationCount,1);assert.deepEqual(report.initial.diagnostics.failures,[]);
 report.initialImages=[...new Set(report.requests.filter(p=>p.endsWith('.webp')))];assert.ok(report.initialImages.length>=6);assert.ok(report.initialImages.every(p=>p.includes('/ranch-streaming-v1/')));assert.ok(report.initialImages.length<30);
 assert.ok(!report.requests.some(p=>p.endsWith('runtime.review.json')||p.includes('ART_PRODUCTION_INDEX')||p.includes('/internal-')||p.endsWith('accepted-original-character-selection.r1.json')||p.endsWith('alternate-form-assets.r1.json')));
 await page.screenshot({path:path.join(out,'six-initial-native-frames.png'),fullPage:true});report.deferred=await page.evaluate(()=>loadingQA.deferred());assert.equal(report.deferred.pendingBefore,true);assert.equal(report.deferred.readyAfter,true);assert.equal(report.deferred.actualCell,report.deferred.expectedCell);
 report.hunt=await page.evaluate(()=>loadingQA.hunt());assert.ok(report.hunt.checked>60);assert.equal(report.hunt.applicationCount,1);assert.deepEqual(report.hunt.diagnostics.failures,[]);
 assert.ok(!report.requests.some(p=>/\/accepted-20261010\/[^/]+\/(main|sub)\.(webp|png)$/.test(p)));
 report.disposed=await page.evaluate(()=>loadingQA.dispose());assert.equal(report.disposed.canvasCount,0);assert.deepEqual(report.errors,[]);report.status='PASS';
 }finally{await browser.close();fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({status:report.status,residents:report.initial?.residents,initialImagePages:report.initialImages?.length,decodedEstimatedBytes:report.initial?.diagnostics?.textureMemory?.estimatedBaseRgbaBytes,deferred:report.deferred,disposed:report.disposed,errors:report.errors}));
})().catch(e=>{console.error(e);process.exitCode=1;});
