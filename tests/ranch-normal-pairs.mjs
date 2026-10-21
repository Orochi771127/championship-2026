// The real production presenter, no replicated decorateActor/ground alignment.
// Captures do not by themselves certify waste, authored jumping, or contact feet.
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const [base,out,baselineFile,probeFile]=process.argv.slice(2);assert.ok(base&&out&&baselineFile&&probeFile);assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const baselineRevision='4f64421314f0d0f5d0c04b916d30e821587c1a6a',scenePath='src/championship/presentation/ranchThreeScene.js',presenterPath='src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const baseline=await fs.readFile(baselineFile,'utf8'),candidate=await fs.readFile(scenePath,'utf8'),probe=await fs.readFile(probeFile,'utf8');
assert.equal(sha(baseline),sha(execFileSync('git',['show',baselineRevision+':'+scenePath])));
assert.equal(sha(candidate),'1ae46df21194a20536fb8319681cce06026c058c94bce5c2b1c0d3d09ea5b9bb');
assert.equal(sha(await fs.readFile(presenterPath)),'865286f7f74ddbdc9391244d623c0cc4d10f2c9031feb4821375d688c7659793');
assert.equal(sha(probe),'325ad54f05ff89b01b7bdb69d3cfc10357a462b12019134b87eb32e42e161224','Reviewed generated probe identity');
const pairKeys=new Map();
const engine=process.env.BROWSER_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));
const browser=await ({chromium,webkit}[engine]).launch({headless:true});const results=[];
// All three reviewed contact species and an ordinary default contact go through
// real normal app paths. No numeric assumption about a species' anatomy.
try{for(const species of (process.env.AUDIT_NORMAL_SPECIES?process.env.AUDIT_NORMAL_SPECIES.split(',').map(Number):[13,25,23,36,73]))for(const mode of ['baseline','floor-only']){
 let sceneRequests=0,probeRequests=0;
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});const page=await context.newPage(),errors=[];
 page.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));
 page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push('console:'+m.type()+':'+m.text());});
 page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});
 try{
  await page.route('**/'+presenterPath,async route=>{probeRequests++;await route.fulfill({status:200,contentType:'text/javascript',body:probe});});
  await page.route('**/'+scenePath,async route=>{sceneRequests++;await route.fulfill({status:200,contentType:'text/javascript',body:mode==='baseline'?baseline:candidate});});
  await page.addInitScript(()=>{let state=0x137ab;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};});
  await page.goto(new URL('tests/fixtures/ranch-normal-pairs.html',base).href);await page.waitForFunction(()=>!!globalThis.prepareNormalContactPair);
  const preparation=await page.evaluate(i=>globalThis.prepareNormalContactPair(i),species);
  await page.goto(new URL('championship.html?presentation=developer',base).href);await page.locator('#cm-login').waitFor();
  if(await page.locator('#cm-film-skip').isVisible()){await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});}
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();
  await page.waitForFunction(i=>{const h=document.querySelector('.int-rh2-field-host');return h?.dataset.loadState==='ready'&&JSON.parse(h?.dataset.residentAssets||'[]').some(a=>a.speciesId.endsWith('species-'+String(i).padStart(3,'0'))&&a.state==='ready')},species,{timeout:180000});
  await page.waitForFunction(i=>{const h=document.querySelector('.int-rh2-field-host'),assets=JSON.parse(h?.dataset.residentAssets||'[]'),positions=JSON.parse(h?.dataset.residentScreenPositions||'[]'),panels=[...document.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')];return h?.dataset.loadState==='ready'&&h.getAttribute('aria-busy')==='false'&&assets.length>0&&assets.every(a=>a.state==='ready'&&!a.error)&&panels.length>0&&panels.every(p=>p.hidden)&&positions.some(p=>p.speciesIndex===i&&Number.isFinite(p.nativeFrame)&&assets.some(a=>a.creatureId===p.creatureId&&a.state==='ready'))},species,{timeout:180000});
  await page.getByText(/正在載入夥伴外觀/).first().waitFor({state:'hidden',timeout:180000});
  const readyProgress=await page.evaluate(i=>({threeFrames:Number(document.querySelector('.cm-ranch-three-canvas')?.dataset.frames),nativeFrame:JSON.parse(document.querySelector('.int-rh2-field-host').dataset.residentScreenPositions).find(p=>p.speciesIndex===i).nativeFrame}),species);
  await page.waitForFunction(({species,before})=>{const h=document.querySelector('.int-rh2-field-host'),assets=JSON.parse(h?.dataset.residentAssets||'[]'),p=JSON.parse(h?.dataset.residentScreenPositions||'[]').find(p=>p.speciesIndex===species);return h?.getAttribute('aria-busy')==='false'&&assets.every(a=>a.state==='ready'&&!a.error)&&[...h.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')].every(e=>e.hidden)&&Number(document.querySelector('.cm-ranch-three-canvas')?.dataset.frames)>before.threeFrames+2&&p?.nativeFrame>before.nativeFrame},{species,before:readyProgress},{timeout:30000});
  assert.equal(await page.locator('[data-field-fallback="true"],.int-rh2-field-fallback').count(),0);
  assert.ok(sceneRequests>0&&probeRequests>0,'Exact routed scene and test presenter consumed');
  const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));assert.deepEqual(viewport,{width:390,height:844,dpr:1});
  const expected=pairKeys.get(species)??null;
  // Match the actual native-presenter cell, not a guessed idle frame or ellipse.
  await page.waitForFunction(({species,expected})=>{const h=document.querySelector('.int-rh2-field-host'),assets=JSON.parse(h?.dataset.residentAssets||'[]'),panels=[...document.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')];
    if(h?.dataset.loadState!=='ready'||h?.getAttribute('aria-busy')!=='false'||!assets.length||!assets.every(a=>a.state==='ready'&&!a.error)||!panels.length||!panels.every(p=>p.hidden))return false;
    const p=globalThis.__ranchContactAudit?.snapshot()?.positions.find(p=>p.speciesIndex===species),d=p?.testOnlyContactDiagnostic;
    if(!assets.some(a=>a.creatureId===p?.creatureId&&a.state==='ready'))return false;
    if(!d?.entityId||!d.speciesId||!d.frame||d.frame.cell==null||d.frame.sequenceId==null||!d.ellipses?.length||d.nativeLift!==0)return false;
    if(!(p.x>0&&p.x<390&&p.bodyTop>=0&&p.footY<844&&p.groundScreen?.x>0&&p.groundScreen.x<390&&p.groundScreen.y>=0&&p.groundScreen.y<844))return false;
    const key=JSON.stringify({entityId:d.entityId,speciesId:d.speciesId,sequenceId:d.frame.sequenceId,cell:d.frame.cell,geometry:d.frame.geometry,flipX:d.frame.flipX,flipY:d.frame.flipY});
    if(expected&&key!==expected)return false;globalThis.__normalPairPaused=globalThis.__ranchContactAudit.pause();return true;
  },{species,expected},{timeout:60000});
  const evidence=await page.evaluate(()=>globalThis.__normalPairPaused),position=evidence.positions.find(p=>p.speciesIndex===species),d=position.testOnlyContactDiagnostic;
  const key=JSON.stringify({entityId:d.entityId,speciesId:d.speciesId,sequenceId:d.frame.sequenceId,cell:d.frame.cell,geometry:d.frame.geometry,flipX:d.frame.flipX,flipY:d.frame.flipY});
  if(expected)assert.equal(key,expected,'Exact same native source cell/geometry/entity');else pairKeys.set(species,key);
  assert.ok(evidence.serial>0);assert.equal(position.creatureId,preparation.residentId,'Actual prepared resident identity');assert.deepEqual(errors,[]);
  const file=mode+'-normal-contact-'+species+'.png';
  const png=await page.screenshot({path:out+'/'+file});assert.equal(png.readUInt32BE(16),390);assert.equal(png.readUInt32BE(20),844);
  assert.deepEqual(await page.evaluate(()=>globalThis.__ranchContactAudit.snapshot()),evidence,'Recorded visual frame remains unchanged across PNG');
  assert.equal(await page.evaluate(()=>{const h=document.querySelector('.int-rh2-field-host'),assets=JSON.parse(h?.dataset.residentAssets||'[]'),panels=[...document.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')];return h?.dataset.loadState==='ready'&&h?.getAttribute('aria-busy')==='false'&&assets.length>0&&assets.every(a=>a.state==='ready'&&!a.error)&&panels.length>0&&panels.every(p=>p.hidden);}),true,'Readiness remains valid through PNG');assert.deepEqual(errors,[]);
  results.push({species,mode,status:'PAIRED_SOURCE_CELL_CAPTURED_VISUAL_PENDING',sceneSha256:sha(mode==='baseline'?baseline:candidate),probeSha256:sha(probe),screenshot:file,viewport,preparation,readyProgress,evidence,sourceFrameKey:key});
 }catch(error){results.push({species,mode,status:'FAIL',error:String(error),errors});await page.screenshot({path:out+'/'+mode+'-normal-failure-'+species+'.png'}).catch(()=>{});throw error;}
 finally{await page.evaluate(()=>globalThis.__ranchContactAudit?.resume()).catch(()=>{});await context.close();await fs.writeFile(out+'/normal-pairs-results.json',JSON.stringify({baselineRevision,releaseApproved:false,results,visualReview:'PENDING',uncovered:['native authored airborne','waste real lifecycle','care prop source-frame pairing','CM28','zoom0.7','pan/wrap','all character routes']},null,2));}
}
}finally{await browser.close();}
